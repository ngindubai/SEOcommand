import { and, desc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { canAccessSite, hasPermission } from "@/platform/access";
import { saveCommandRecord } from "@/platform/command-store";
import { sessionFromRequest } from "@/lib/auth";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const site = new URL(request.url).searchParams.get("site") ?? "";
  if (!await canAccessSite(request, site)) return NextResponse.json({ error: "Website access required." }, { status: 403 });
  if (process.env.QA_SYNTHETIC === "true") return NextResponse.json({ answers: [], reviews: [], limited: false });
  const table = schema.aiResponseObservations;
  const [answers, reviews] = await Promise.all([db().select({ id: table.id, prompt: table.prompt, platform: table.platform, capturedOn: table.capturedOn, capturedAt: table.capturedAt, sampleIndex: table.sampleIndex, mentioned: table.mentioned, cited: table.cited, sentiment: table.sentiment, responseText: table.responseText, responseHash: table.responseHash, modelName: table.modelName }).from(table).where(and(eq(table.siteSlug, site), gte(table.capturedOn, new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)))).orderBy(desc(table.capturedAt)).limit(2000), db().select().from(schema.commandRecords).where(and(eq(schema.commandRecords.siteSlug, site), eq(schema.commandRecords.kind, "workspace_sentiment"))).orderBy(desc(schema.commandRecords.updatedAt)).limit(2000)]);
  return NextResponse.json({ answers, reviews, limited: answers.length === 2000 });
}
const inputSchema = z.object({ site: z.string().min(1).max(120), id: z.string().uuid(), responseHash: z.string().min(1).max(100), sentiment: z.enum(["positive", "neutral", "mixed", "negative"]), reason: z.string().trim().min(10).max(2000) });
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null)), session = await sessionFromRequest(request);
  if (!parsed.success || !session) return NextResponse.json({ error: "Add a sentiment assessment with supporting evidence." }, { status: 400 });
  const input = parsed.data;
  if (!await canAccessSite(request, input.site) || !await hasPermission(request, "manage_content", input.site)) return NextResponse.json({ error: "Content access required." }, { status: 403 });
  if (process.env.QA_SYNTHETIC === "true") return NextResponse.json({ error: "Review saving requires real saved answers." }, { status: 409 });
  const [answer] = await db().select().from(schema.aiResponseObservations).where(and(eq(schema.aiResponseObservations.id, input.id), eq(schema.aiResponseObservations.siteSlug, input.site)));
  if (!answer || answer.responseHash !== input.responseHash) return NextResponse.json({ error: "This answer changed. Reload it before assessing sentiment." }, { status: 409 });
  await saveCommandRecord(input.site, "workspace_sentiment", input.id, { responseHash: input.responseHash, sentiment: input.sentiment, reason: input.reason, reviewer: session.email }, { actor: session.email });
  return NextResponse.json({ message: "Human sentiment assessment saved with the evidence. Original automated assessment retained." });
}
