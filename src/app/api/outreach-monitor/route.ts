import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { canAccessSite, hasPermission } from "@/platform/access";
import { getManagedSite } from "@/platform/site-store";
import { saveCommandRecord } from "@/platform/command-store";
import { outreachEvidence, syncOutreachReplies, verifyAcquiredLink } from "@/platform/outreach-monitor";
import { mailConfigured } from "@/providers/google/mail";
import { siteUrl } from "@/lib/command-model";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const site = new URL(request.url).searchParams.get("site") ?? "";
  if (!await canAccessSite(request, site)) return NextResponse.json({ error: "Website access required." }, { status: 403 });
  if (process.env.QA_SYNTHETIC === "true") return NextResponse.json({ records: [], drafts: [], connected: false });
  const drafts = await db().select({ id: schema.outreachDrafts.id, subject: schema.outreachDrafts.subject, recipientEmail: schema.outreachDrafts.recipientEmail, status: schema.outreachDrafts.status }).from(schema.outreachDrafts).where(eq(schema.outreachDrafts.siteSlug, site));
  return NextResponse.json({ records: await outreachEvidence(site), drafts, connected: mailConfigured() });
}
const inputSchema = z.object({ action: z.enum(["replies", "followup", "complete", "verify"]), site: z.string().min(1).max(120), draftId: z.string().uuid().optional(), id: z.string().uuid().optional(), title: z.string().trim().min(2).max(200).optional(), due: z.string().datetime().optional(), sourceUrl: z.string().url().max(2000).optional(), targetUrl: z.string().max(2000).optional() });
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review these outreach details." }, { status: 400 });
  const input = parsed.data;
  if (!await canAccessSite(request, input.site) || !await hasPermission(request, "manage_content", input.site)) return NextResponse.json({ error: "Outreach access required." }, { status: 403 });
  if (process.env.QA_SYNTHETIC === "true") return NextResponse.json({ error: "External outreach checks are disabled in preview." }, { status: 409 });
  try {
    const site = await getManagedSite(input.site); if (!site) throw new Error("Website not found.");
    if (input.draftId) {
      const [draft] = await db().select({ id: schema.outreachDrafts.id }).from(schema.outreachDrafts).where(and(eq(schema.outreachDrafts.id, input.draftId), eq(schema.outreachDrafts.siteSlug, site.id)));
      if (!draft) throw new Error("Choose a message from this website.");
    }
    if (input.action === "replies") { if (!input.draftId) throw new Error("Choose a sent message."); await syncOutreachReplies(site.id, input.draftId); }
    if (input.action === "followup") { if (!input.title || !input.due || Date.parse(input.due) <= Date.now()) throw new Error("Add a follow-up title and future date."); await saveCommandRecord(site.id, "workspace_followup", crypto.randomUUID(), { title: input.title, draftId: input.draftId }, { status: "active", nextRunAt: new Date(input.due) }); }
    if (input.action === "complete") { if (!input.id) throw new Error("Choose a reminder."); await db().update(schema.commandRecords).set({ status: "done", nextRunAt: null, updatedAt: new Date() }).where(and(eq(schema.commandRecords.id, input.id), eq(schema.commandRecords.siteSlug, site.id), eq(schema.commandRecords.kind, "workspace_followup"))); }
    if (input.action === "verify") { const target = input.targetUrl ? siteUrl(input.targetUrl, site.host) : null; if (!target || !input.sourceUrl) throw new Error("Enter a linking page and a target page on this website."); await verifyAcquiredLink(site.id, input.sourceUrl, target); }
    return NextResponse.json({ message: input.action === "replies" ? "Replies checked and saved." : input.action === "verify" ? "Link evidence collected." : "Follow-up saved." });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Outreach action failed." }, { status: 400 }); }
}
