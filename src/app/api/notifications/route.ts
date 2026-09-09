import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { hasDatabase } from "@/sync/store";
import { readIncidentHistory, readNotificationGroups } from "@/platform/notifications";
import { accessibleSiteSlugs, canAccessSite, hasPermission } from "@/platform/access";
import { resolveGroupSiteSlugs } from "@/platform/site-store";
import { QA_SITES } from "@/data/qa-fixtures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const number = (key: string, fallback: number) => { const value = Number(params.get(key) ?? fallback); return Number.isFinite(value) ? Math.trunc(value) : fallback; };
  const limit = Math.min(100, Math.max(1, number("limit", 20)));
  const offset = Math.max(0, number("offset", 0));
  const scope = params.get("site") ?? params.get("scope") ?? "portfolio";
  const allowed = await accessibleSiteSlugs(request);
  const requested = scope === "portfolio" ? null : scope.startsWith("group:") ? await resolveGroupSiteSlugs(scope.slice(6)) : [scope];
  const accessible = requested ? requested.filter((site) => allowed === null || allowed.includes(site)) : allowed;
  function respond<T extends { status: string; title: string; detail: string | null; readAt: Date | string | null; severity: string }>(all: T[]) {
    const query = params.get("q")?.trim().toLowerCase() ?? "";
    const severity = params.get("severity");
    const matching = all.filter((item) => (!query || `${item.title} ${item.detail ?? ""}`.toLowerCase().includes(query)) && (!severity || item.severity === severity));
    const counts = { open: matching.filter((item) => item.status === "open").length, snoozed: matching.filter((item) => item.status === "snoozed").length, history: matching.filter((item) => ["resolved", "dismissed"].includes(item.status)).length };
    const status = params.get("status");
    const filtered = matching.filter((item) => !status || (status === "history" ? ["resolved", "dismissed"].includes(item.status) : item.status === status));
    return NextResponse.json({ items: filtered.slice(offset, offset + limit), unread: all.filter((item) => !item.readAt && item.status === "open").length, counts, total: filtered.length, offset, limit });
  }
  if (process.env.QA_SYNTHETIC === "true") {
    const sites = accessible === null ? QA_SITES : QA_SITES.filter((site) => accessible.includes(site.id));
    const items = sites.map((site) => {
      const index = QA_SITES.findIndex((item) => item.id === site.id);
      return {
      id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      siteSlug: site.id,
      eventType: index % 4 === 0 ? "technical_regression" : "rank_drop",
      severity: index % 4 === 0 ? "critical" : index % 3 === 0 ? "high" : "medium",
      title: index % 4 === 0 ? "Technical health needs attention" : "Tracked rankings moved",
      detail: "Synthetic staging notification used for workflow and responsive QA.",
      actionUrl: `/sites/${site.id}`,
      fingerprint: `qa-notice-${index}`, status: index > 16 ? "resolved" : index > 13 ? "snoozed" : "open",
      readAt: index % 2 ? new Date("2026-08-26T08:00:00Z") : null,
      snoozedUntil: index > 13 && index <= 16 ? new Date("2026-08-27T08:00:00Z") : null,
      resolvedAt: index > 16 ? new Date("2026-08-26T09:00:00Z") : null, resolvedBy: index > 16 ? "qa@orwell.local" : null,
      createdAt: new Date(Date.UTC(2026, 7, 26, 8, index)),
      };
    });
    return respond(items);
  }
  const historyId = params.get("historyId");
  if (historyId) {
    if (!z.string().uuid().safeParse(historyId).success) return NextResponse.json({ error: "Invalid incident." }, { status: 400 });
    return NextResponse.json(await readIncidentHistory(historyId, accessible, offset, limit));
  }
  return respond(await readNotificationGroups(accessible));
}

const PatchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["read", "unread", "resolve", "dismiss", "snooze", "reopen"]).optional(),
  read: z.boolean().optional(),
  snoozedUntil: z.string().datetime().optional(),
});

export async function PATCH(request: Request) {
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification update." }, { status: 400 });
  const action = parsed.data.action ?? (parsed.data.read === false ? "unread" : "read");
  if (process.env.QA_SYNTHETIC === "true") {
    if (!await hasPermission(request, "manage_content")) return NextResponse.json({ error: "Notification workflow permission required." }, { status: 403 });
    return NextResponse.json({ item: { id: parsed.data.id, status: action, synthetic: true } });
  }
  if (!hasDatabase()) return NextResponse.json({ error: "DATABASE_URL is required." }, { status: 503 });
  const [existing] = await db().select({ siteSlug: schema.portfolioNotifications.siteSlug }).from(schema.portfolioNotifications).where(eq(schema.portfolioNotifications.id, parsed.data.id)).limit(1);
  if (!existing || (existing.siteSlug && !await canAccessSite(request, existing.siteSlug))) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  if (!await hasPermission(request, "manage_content", existing.siteSlug)) return NextResponse.json({ error: "Notification workflow permission required for this scope." }, { status: 403 });
  const now = new Date();
  const values =
    action === "resolve"
      ? { status: "resolved", resolvedAt: now, resolvedBy: request.headers.get("x-orwell-user-email"), readAt: now, snoozedUntil: null }
      : action === "dismiss"
        ? { status: "dismissed", readAt: now, snoozedUntil: null }
        : action === "snooze"
          ? { status: "snoozed", snoozedUntil: parsed.data.snoozedUntil ? new Date(parsed.data.snoozedUntil) : new Date(now.getTime() + 24 * 60 * 60 * 1000), readAt: now }
          : action === "reopen"
            ? { status: "open", resolvedAt: null, resolvedBy: null, snoozedUntil: null }
            : { readAt: action === "read" ? now : null };
  const [item] = await db()
    .update(schema.portfolioNotifications)
    .set(values)
    .where(eq(schema.portfolioNotifications.id, parsed.data.id))
    .returning();
  if (item) {
    await db().insert(schema.accessAuditEvents).values({
      siteSlug: item.siteSlug,
      actorEmail: request.headers.get("x-orwell-user-email"),
      actorRole: request.headers.get("x-orwell-user-role"),
      action,
      area: "notification",
      summary: `${action[0]?.toUpperCase()}${action.slice(1)} notification: ${item.title}`,
      metadata: { notificationId: item.id },
    });
  }
  return item
    ? NextResponse.json({ item })
    : NextResponse.json({ error: "Notification not found." }, { status: 404 });
}
