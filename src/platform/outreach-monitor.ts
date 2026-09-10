import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { saveCommandRecord } from "./command-store";
import { createNotification } from "./notifications";
import { fetchPublic, readBoundedText } from "./public-network";
import { readMailThread } from "@/providers/google/mail";

export async function syncOutreachReplies(site: string, draftId: string) {
  const [draft] = await db().select().from(schema.outreachDrafts).where(and(eq(schema.outreachDrafts.id, draftId), eq(schema.outreachDrafts.siteSlug, site)));
  const threadId = draft?.delivery.threadId;
  if (!draft?.recipientEmail || typeof threadId !== "string") throw new Error("This message has no saved Gmail thread. New messages sent through the connected mailbox can receive replies here.");
  const replies = await readMailThread(threadId, draft.recipientEmail);
  return saveCommandRecord(site, "workspace_replies", draftId, { draftId, threadId, checkedAt: new Date().toISOString(), replies }, { status: "saved" });
}
export function findAcquiredLink(html: string, sourceUrl: string, targetUrl: string) {
  const target = new URL(targetUrl); target.hash = "";
  for (const match of html.matchAll(/<a\b([^>]+)>/gi)) {
    const href = match[1]!.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    try { const url = new URL((href?.[1] ?? href?.[2] ?? href?.[3] ?? "").replace(/&amp;/g, "&"), sourceUrl); url.hash = ""; if (url.toString() === target.toString()) return { found: true, nofollow: /\brel\s*=\s*["'][^"']*\bnofollow\b/i.test(match[1]!), sponsored: /\brel\s*=\s*["'][^"']*\bsponsored\b/i.test(match[1]!) }; } catch { /* Invalid markup is not a confirmed link. */ }
  }
  return { found: false, nofollow: null, sponsored: null };
}
export async function verifyAcquiredLink(site: string, sourceUrl: string, targetUrl: string, actor?: string) {
  const response = await fetchPublic(sourceUrl, { headers: { "user-agent": "OrwellSEOCommand/2.0 (+acquired link check)" }, signal: AbortSignal.timeout(15000) });
  const html = response.ok && response.headers.get("content-type")?.includes("html") ? await readBoundedText(response) : null;
  const evidence = html == null ? { found: null, nofollow: null, sponsored: null } : findAcquiredLink(html, response.url || sourceUrl, targetUrl);
  return saveCommandRecord(site, "workspace_link_check", crypto.randomUUID(), { sourceUrl, targetUrl, statusCode: response.status, checkedAt: new Date().toISOString(), ...evidence, note: "Checks returned HTML only; JavaScript-inserted links may be absent. A blocked page is unknown, not a lost link." }, { actor, status: "completed" });
}
export async function outreachEvidence(site: string) {
  return db().select().from(schema.commandRecords).where(and(eq(schema.commandRecords.siteSlug, site), inArray(schema.commandRecords.kind, ["workspace_replies", "workspace_followup", "workspace_link_check"]))).orderBy(desc(schema.commandRecords.updatedAt)).limit(100);
}
export async function notifyOutreachFollowups() {
  const due = await db().select().from(schema.commandRecords).where(and(eq(schema.commandRecords.kind, "workspace_followup"), eq(schema.commandRecords.status, "active"), lte(schema.commandRecords.nextRunAt, new Date()))).limit(50);
  for (const row of due) {
    await createNotification({ siteSlug: row.siteSlug, eventType: "outreach_followup", severity: "medium", title: String(row.payload.title), detail: "Review the conversation before preparing a follow-up. No email has been sent.", actionUrl: `/link-building?site=${row.siteSlug}`, fingerprint: `followup:${row.id}` });
    await db().update(schema.commandRecords).set({ status: "notified", updatedAt: new Date(), nextRunAt: null }).where(and(eq(schema.commandRecords.id, row.id), eq(schema.commandRecords.status, "active")));
  }
}
