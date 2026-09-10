import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { canAccessSite, hasPermission } from "@/platform/access";
import { getManagedSite } from "@/platform/site-store";
import { readLatestSnapshots } from "@/sync/store";
import { saveCommandRecord } from "@/platform/command-store";
import { keywordEffort } from "@/lib/planning";
import type { Keyword } from "@/lib/types";
import { siteUrl } from "@/lib/command-model";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const site = new URL(request.url).searchParams.get("site") ?? "";
  if (!await canAccessSite(request, site)) return NextResponse.json({ error: "Website access required." }, { status: 403 });
  if (process.env.QA_SYNTHETIC === "true") return NextResponse.json({ plans: [], effort: keywordEffort([]), collectedAt: null });
  const [records, snapshots] = await Promise.all([db().select().from(schema.commandRecords).where(and(eq(schema.commandRecords.siteSlug, site), eq(schema.commandRecords.kind, "workspace_topic"))).orderBy(desc(schema.commandRecords.updatedAt)), readLatestSnapshots(site)]);
  const keywords = snapshots.find((s) => s.dataset === "keywords");
  return NextResponse.json({ plans: records.map((r) => ({ id: r.recordKey, ...r.payload, updatedAt: r.updatedAt.toISOString() })), effort: keywordEffort(Array.isArray(keywords?.payload) ? keywords.payload as Keyword[] : []), collectedAt: keywords?.provenance.collectedAt ?? null });
}
const inputSchema = z.object({ site: z.string().min(1).max(120), id: z.string().uuid().optional(), label: z.string().trim().min(2).max(150), keywords: z.array(z.string().trim().min(1).max(250)).min(1).max(100), targetUrl: z.string().max(2000), updatedAt: z.string().datetime().optional() });
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add a topic, keywords and a destination on this website." }, { status: 400 });
  const body = parsed.data;
  if (!await canAccessSite(request, body.site) || !await hasPermission(request, "manage_content", body.site)) return NextResponse.json({ error: "Content access required." }, { status: 403 });
  if (process.env.QA_SYNTHETIC === "true") return NextResponse.json({ error: "Saving plans requires a real website workspace." }, { status: 409 });
  const site = await getManagedSite(body.site), url = site && siteUrl(body.targetUrl, site.host);
  if (!site || !url) return NextResponse.json({ error: "Use an existing or planned page on this website." }, { status: 400 });
  const payload = { label: body.label, keywords: [...new Set(body.keywords)], targetUrl: url };
  if (body.id) {
    if (!body.updatedAt) return NextResponse.json({ error: "Reopen the plan before editing." }, { status: 409 });
    const [row] = await db().update(schema.commandRecords).set({ payload, updatedAt: new Date() }).where(and(eq(schema.commandRecords.siteSlug, site.id), eq(schema.commandRecords.kind, "workspace_topic"), eq(schema.commandRecords.recordKey, body.id), eq(schema.commandRecords.updatedAt, new Date(body.updatedAt)))).returning();
    if (!row) return NextResponse.json({ error: "This plan changed in another session. Reload it before saving." }, { status: 409 });
  } else await saveCommandRecord(site.id, "workspace_topic", crypto.randomUUID(), payload);
  return NextResponse.json({ message: "Topic group and page assignment saved." });
}
