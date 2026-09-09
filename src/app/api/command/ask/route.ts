import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionFromRequest } from "@/lib/auth";
import { visibleCommandSites, portfolioCommand } from "@/platform/command-portfolio";
import { buildSiteCommand } from "@/platform/command-read";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const input = z.object({ scope: z.string().min(1).max(150), question: z.string().trim().min(3).max(700) }).safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Enter a question and choose a website or portfolio." }, { status: 400 });
  if (!await sessionFromRequest(request)) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const sites = await visibleCommandSites(request, input.data.scope);
  if (!sites.length) return NextResponse.json({ error: "No accessible websites in this scope." }, { status: 403 });
  const question = input.data.question.toLowerCase();
  type Evidence = { title: string; detail: string; date: string | null; href: string };
  const evidence: Evidence[] = [];
  let answer = "";
  try {
    if (sites.length === 1 && input.data.scope === sites[0]!.id) {
      const data = await buildSiteCommand(sites[0]!.id), site = data.site.id;
      if (/speed|fast|slow|lcp|performance test/.test(question)) {
        for (const row of data.records.filter((row) => row.kind === "speed" && row.status === "completed").slice(0, 2)) evidence.push({ title: `${row.payload.device} speed test`, detail: `Lab score ${row.payload.score ?? "unavailable"}; LCP ${row.payload.lcpMs ?? "unavailable"} ms. Simulated test, not visitor experience.`, date: row.updatedAt, href: `/health?site=${site}&view=speed` });
        answer = evidence.length ? "These are the latest saved speed tests. Review the individual opportunities before choosing a fix." : "No completed speed test is saved for this website yet.";
      } else if (/index|crawl/.test(question)) {
        for (const row of data.records.filter((row) => row.kind === "indexing" && row.status === "completed").slice(0, 5)) evidence.push({ title: String(row.payload.url), detail: `Google reported: ${row.payload.coverage}. Last crawl: ${row.payload.lastCrawl ?? "not reported"}.`, date: row.updatedAt, href: `/health?site=${site}&view=indexing` });
        answer = evidence.length ? "These are Google’s saved inspection results. They describe the reported index state at inspection time." : "No Google URL inspections have been saved yet. A technical crawl alone does not establish Google’s index status.";
      } else if (/lead|enquir|booking|conversion|business/.test(question)) {
        const business = data.business;
        answer = business ? `Google Analytics recorded ${business.rows.reduce((sum, row) => sum + row.count, 0).toLocaleString()} mapped business events from organic search between ${business.start} and ${business.end}. These are event occurrences, not deduplicated people or revenue.` : "Business events have not been collected yet. Map the actual enquiry, booking and qualified-lead events first; generic key events are not treated as leads.";
        if (business) evidence.push({ title: "Recorded business events", detail: `${Object.keys(business.mapping).join(", ")}${business.truncated || business.thresholded ? "; limited coverage applies" : ""}`, date: business.collectedAt, href: `/performance?site=${site}&view=business` });
      } else if (/fix|issue|action|priorit|next|cause/.test(question)) {
        for (const cause of data.causes.slice(0, 3)) evidence.push({ title: cause.title, detail: `${cause.findings.length} findings; ${cause.urls.length} evidenced URLs${cause.sampled ? " (sample only)" : ""}; ${cause.confidence} confidence in suspected cause.`, date: data.bundle.datasets.onpage?.provenance.collectedAt ?? null, href: `/health?site=${site}&cause=${encodeURIComponent(cause.id)}` });
        answer = evidence.length ? "Start with these saved issue groups, ordered by severity. The shared cause remains a hypothesis until investigated." : "There are no unresolved issue groups in the available audit evidence. Check data health before interpreting this as an all-clear.";
      } else if (/fresh|update|connect|data health|missing/.test(question)) {
        for (const health of data.health) evidence.push({ title: health.label, detail: `${health.state.replace(/_/g, " ")}. Data through ${health.through ?? "unavailable"}.`, date: health.updatedAt, href: health.href });
        answer = "Collection dates and reporting periods differ. These statuses use only the saved data for the selected website.";
      } else if (/page|url/.test(question)) {
        for (const page of data.pages.filter((page) => page.clicks !== null).slice(0, 5)) evidence.push({ title: page.url, detail: `${page.clicks} clicks; ${page.impressions} impressions; average position ${page.position?.toFixed(1) ?? "unavailable"}.`, date: data.bundle.datasets.gsc_pages?.provenance.rangeEnd ?? null, href: `/pages?site=${site}&page=${encodeURIComponent(page.url)}` });
        answer = "These pages lead the latest saved Search Console page report. Each link opens its connected evidence.";
      }
    }
    if (!answer && /click|impression|rank|chang|traffic|perform|best|worst|gain|los/.test(question)) {
      const data = await portfolioCommand(request, input.data.scope);
      const rows = data.domains.filter((row) => row.searchPeriod?.clicks != null).sort((a, b) => /worst|los|drop/.test(question) ? (a.searchPeriod?.clickChange ?? 0) - (b.searchPeriod?.clickChange ?? 0) : (b.searchPeriod?.clicks ?? 0) - (a.searchPeriod?.clicks ?? 0));
      for (const row of rows.slice(0, 5)) evidence.push({ title: sites.find((site) => site.id === row.domainId)?.name ?? row.domainId, detail: `${row.searchPeriod!.clicks} clicks; ${row.searchPeriod!.impressions} impressions; average position ${row.searchPeriod!.position?.toFixed(1) ?? "unavailable"}; click change ${row.searchPeriod!.clickChange == null ? "unavailable" : `${row.searchPeriod!.clickChange.toFixed(1)}%`}. ${row.searchPeriod!.availableDays}/28 days available.`, date: row.searchPeriod!.end, href: `/portfolio?site=${row.domainId}` });
      answer = `Saved search performance is available for ${rows.length} of ${sites.length} websites in this scope. Figures use each website’s latest 28-day reporting window; dates may differ. These changes alone do not establish a cause.`;
    }
    if (!answer) answer = "I can answer from saved search performance, top pages, data freshness, issue groups, speed tests, indexing and recorded business events. Choose one of those questions or select a website for more detail. I don’t have evidence to answer this question reliably.";
    return NextResponse.json({ answer, evidence, generatedAt: new Date().toISOString(), scope: input.data.scope, note: "Answers use supported questions and saved evidence only. No external model or paid scan was called." });
  } catch { return NextResponse.json({ error: "Saved evidence could not be loaded. Retry shortly." }, { status: 503 }); }
}
