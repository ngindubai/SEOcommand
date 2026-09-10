import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { canAccessSite, hasPermission } from "@/platform/access";
import { benchmarkHtml } from "@/lib/content-analysis";
import { fetchPublic } from "@/platform/public-network";
export const runtime = "nodejs";
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), id: z.string().uuid(), text: z.string().max(200000), revision: z.string().max(60).nullable() }),
  z.object({ action: z.literal("compare"), id: z.string().uuid(), urls: z.array(z.string().url().max(2000)).min(1).max(3) }),
]);
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose valid editorial details." }, { status: 400 });
  const input = parsed.data;
  if (process.env.QA_SYNTHETIC === "true") return NextResponse.json({ error: "Editor saving requires a real saved content task." }, { status: 409 });
  const [item] = await db().select().from(schema.workflowItems).where(eq(schema.workflowItems.id, input.id));
  if (!item || !await canAccessSite(request, item.domainSlug)) return NextResponse.json({ error: "Content task not found." }, { status: 404 });
  if (!await hasPermission(request, "manage_content", item.domainSlug)) return NextResponse.json({ error: "Content permission required." }, { status: 403 });
  if (!["content_brief", "refresh_brief"].includes(item.executionType ?? "")) return NextResponse.json({ error: "Select a content task." }, { status: 400 });
  try {
    if (input.action === "save") {
      const editor = item.executionData?.editor as { revision?: string; text?: string } | undefined;
      if ((editor?.revision ?? null) !== input.revision) return NextResponse.json({ error: "This draft changed in another session. Reopen it before saving." }, { status: 409 });
      const revision = new Date().toISOString();
      const value = { text: input.text, revision };
      const [saved] = await db().update(schema.workflowItems).set({ executionData: sql`${schema.workflowItems.executionData} || ${JSON.stringify({ editor: value })}::jsonb`, updatedAt: new Date() }).where(and(eq(schema.workflowItems.id, item.id), eq(schema.workflowItems.updatedAt, item.updatedAt))).returning();
      if (!saved) return NextResponse.json({ error: "This task changed while saving. Reopen it before retrying." }, { status: 409 });
      return NextResponse.json({ editor: value });
    }
    const benchmarks = [];
    for (const url of [...new Set(input.urls)]) {
      const response = await fetchPublic(url, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "OrwellSEOCommand/2.0 (+editor comparison)" } });
      if (!response.ok || !response.headers.get("content-type")?.includes("html")) throw new Error(`Could not read HTML from ${new URL(url).hostname}.`);
      const reader = response.body?.getReader(); let size = 0; const chunks: Uint8Array[] = [];
      if (reader) try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 2000000) throw new Error("Comparison page exceeds the 2 MB limit."); chunks.push(part.value); } } finally { await reader.cancel().catch(() => undefined); }
      benchmarks.push(benchmarkHtml(Buffer.concat(chunks).toString("utf8"), url));
    }
    await db().update(schema.workflowItems).set({ executionData: sql`${schema.workflowItems.executionData} || ${JSON.stringify({ contentBenchmarks: benchmarks })}::jsonb`, updatedAt: new Date() }).where(eq(schema.workflowItems.id, item.id));
    return NextResponse.json({ benchmarks });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Editor request failed." }, { status: 400 }); }
}
