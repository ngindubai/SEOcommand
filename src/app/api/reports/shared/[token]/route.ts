import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { reportById, shareHash } from "@/reports/archive";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return new Response("Report unavailable", { status: 404 });
  const [share] = await db().select().from(schema.commandRecords).where(and(eq(schema.commandRecords.kind, "workspace_share"), eq(schema.commandRecords.recordKey, shareHash(token)), eq(schema.commandRecords.status, "active")));
  if (!share || !Number.isFinite(Date.parse(String(share.payload.expiresAt))) || Date.parse(String(share.payload.expiresAt)) <= Date.now()) return new Response("This report link expired or was revoked.", { status: 404 });
  const report = await reportById(share.siteSlug, String(share.payload.reportId));
  if (!report) return new Response("Report unavailable", { status: 404 });
  return new Response(String(report.payload.html), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" } });
}
