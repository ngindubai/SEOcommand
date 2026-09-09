import { and, count, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { buildLearningSignals } from "@/platform/outcome-ledger";
import { hasDatabase } from "@/sync/store";
import { listManagedSites, resolveGroupSiteSlugs } from "@/platform/site-store";
import { filterAccessibleSiteSlugs } from "@/platform/access";
import { QA_SITES } from "@/data/qa-fixtures";
import { actionDestination, compareActions, isUrgentAction, type ActionData, type ActionItem } from "@/lib/action-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requestedLimit = Number(params.get("limit") ?? "150");
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : 150, 1), 250);
  const scope = params.get("scope") ?? "portfolio";
  const urgentOnly = params.get("priority") === "urgent";
  const allSites = await listManagedSites();
  const requestedSlugs = scope === "portfolio" ? allSites.map((site) => site.id)
    : scope.startsWith("group:") ? await resolveGroupSiteSlugs(scope.slice(6)) : [scope];
  const allowed = new Set(await filterAccessibleSiteSlugs(request, requestedSlugs));
  const sites = allSites.filter((site) => allowed.has(site.id));
  const paused = sites.filter((site) => site.lifecycleStatus === "paused").length;

  function respond(allItems: ActionItem[], counts: ActionData["counts"], available = true, synthetic = false) {
    const total = urgentOnly ? counts.urgent : counts.open;
    const items = allItems.filter((item) => !urgentOnly || isUrgentAction(item)).sort(compareActions).slice(0, limit)
      .map((item) => ({ ...item, actionUrl: actionDestination(item).href }));
    return NextResponse.json({ items, counts, available, synthetic, meta: { returned: items.length, total, hasMore: total > items.length } } satisfies ActionData);
  }

  if (process.env.QA_SYNTHETIC === "true") {
    const allItems: ActionItem[] = sites.flatMap((site) => {
      const index = QA_SITES.findIndex((item) => item.id === site.id);
      return [
        {
          id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, kind: "alert" as const,
          siteSlug: site.id, siteName: site.name, title: index % 4 === 0 ? "Technical health needs attention" : "Tracked rankings moved",
          detail: index % 4 === 0 ? "High-impact synthetic crawl evidence is ready for review." : "A monitored keyword moved beyond the configured threshold.",
          status: "open", severity: index % 4 === 0 ? "critical" as const : index % 3 === 0 ? "high" as const : "medium" as const,
          score: index % 4 === 0 ? 100 : index % 3 === 0 ? 75 : 45,
          actionUrl: index % 4 === 0 ? "/site-audit" : "/rankings", createdAt: new Date(Date.UTC(2026, 7, 26, 8, index)).toISOString(),
        },
        {
          id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, kind: "recommendation" as const,
          siteSlug: site.id, siteName: site.name, title: "Improve the highest-potential landing page",
          detail: "Content · M effort", module: "Content", status: index % 4 === 0 ? "in_progress" : "approved", severity: "high" as const,
          score: 78 - index, actionUrl: "/recommendations", createdAt: new Date(Date.UTC(2026, 7, 25, 8, index)).toISOString(),
        },
        ...(index === 0 ? [{
          id: "72000000-0000-4000-8000-000000000001", kind: "research" as const,
          siteSlug: site.id, siteName: site.name, title: "Investigate competitor.example opportunity",
          detail: "Mapped domain evidence · awaiting approval", status: "mapped", severity: "medium" as const,
          duplicateWarning: { severity: "none", summary: "No overlap found in the latest stored website evidence.", matches: [] },
          score: 70, actionUrl: "/domain-research?evidence=71000000-0000-4000-8000-000000000001&mapping=72000000-0000-4000-8000-000000000001", createdAt: new Date(Date.UTC(2026, 7, 27, 9, 0)).toISOString(),
        }] : []),
      ];
    });
    return respond(allItems, { critical: allItems.filter((item) => item.severity === "critical").length, urgent: allItems.filter(isUrgentAction).length, open: allItems.length, paused }, true, true);
  }
  if (!hasDatabase() || sites.length === 0) {
    return respond([], { critical: 0, urgent: 0, open: 0, paused }, hasDatabase());
  }

  const slugs = sites.map((site) => site.id);
  const notice = schema.portfolioNotifications;
  const task = schema.workflowItems;
  // Filter active work before limiting, so newer resolved notices cannot hide a critical alert.
  const noticeWhere = and(inArray(notice.siteSlug, slugs), or(eq(notice.status, "open"), and(eq(notice.status, "snoozed"), lte(notice.snoozedUntil, new Date()))));
  const taskWhere = and(inArray(task.domainSlug, slugs), eq(task.decision, "approved"), or(isNull(task.status), ne(task.status, "done")));
  const mapping = schema.researchMappings;
  const researchWhere = and(inArray(mapping.siteSlug, slugs), eq(mapping.status, "mapped"));
  // Retain verified outcome learning from existing work, including completed work.
  const verifiedWork = await db().select().from(task)
    .where(and(inArray(task.domainSlug, slugs), sql`${task.verification}->>'outcome' is not null`, sql`${task.verification}->>'outcome' <> 'awaiting_data'`));
  const learning = buildLearningSignals(verifiedWork);
  const learningByWork = new Map(learning.map((signal) => [`${signal.domainSlug}:${signal.executionType}`, signal]));
  const adjustments = learning.filter((signal) => signal.adjustment).map((signal) => sql`when ${task.domainSlug} = ${signal.domainSlug} and coalesce(${task.executionType}, 'general') = ${signal.executionType} then ${signal.adjustment}`);
  const learnedPriority = adjustments.length
    ? sql<number>`greatest(0, least(100, ${task.priorityScore} + case ${sql.join(adjustments, sql` `)} else 0 end))`.mapWith(Number)
    : sql<number>`${task.priorityScore}`.mapWith(Number);
  const severityScore = { critical: 100, high: 75, medium: 45, low: 20 };
  const noticePriority = sql`case ${notice.severity} when 'critical' then 100 when 'high' then 75 when 'medium' then 45 else 20 end`;
  const [notices, tasks, mappedResearch, [noticeCounts], [taskCounts], [researchCounts]] = await Promise.all([
    db().select().from(notice).where(and(noticeWhere, urgentOnly ? inArray(notice.severity, ["critical", "high"]) : undefined))
      .orderBy(desc(noticePriority), desc(notice.createdAt), notice.id).limit(limit),
    db().select({ item: task, score: learnedPriority }).from(task).where(and(taskWhere, urgentOnly ? gte(learnedPriority, 75) : undefined))
      .orderBy(desc(learnedPriority), desc(task.updatedAt), task.id).limit(limit),
    db().select({ mapping, evidence: schema.researchEvidence }).from(mapping)
      .innerJoin(schema.researchEvidence, eq(schema.researchEvidence.id, mapping.evidenceId))
      .where(and(researchWhere, urgentOnly ? gte(mapping.priorityScore, 75) : undefined))
      .orderBy(desc(mapping.priorityScore), desc(mapping.updatedAt), mapping.id).limit(limit),
    db().select({ open: count(), critical: sql<number>`count(*) filter (where ${notice.severity} = 'critical')`.mapWith(Number), urgent: sql<number>`count(*) filter (where ${notice.severity} in ('critical', 'high'))`.mapWith(Number) }).from(notice).where(noticeWhere),
    db().select({ open: count(), urgent: sql<number>`count(*) filter (where ${learnedPriority} >= 75)`.mapWith(Number) }).from(task).where(taskWhere),
    db().select({ open: count(), urgent: sql<number>`count(*) filter (where ${mapping.priorityScore} >= 75)`.mapWith(Number) }).from(mapping).where(researchWhere),
  ]);
  const siteNames = new Map(sites.map((site) => [site.id, site.name]));
  const allItems: ActionItem[] = [
    ...notices.map((item) => ({
      id: item.id, kind: "alert" as const, siteSlug: item.siteSlug,
      siteName: siteNames.get(item.siteSlug!) ?? item.siteSlug!, title: item.title, detail: item.detail,
      status: item.status, severity: item.severity, score: severityScore[item.severity], actionUrl: item.actionUrl,
      createdAt: item.createdAt.toISOString(),
    })),
    ...tasks.map(({ item, score }) => {
      const signal = learningByWork.get(`${item.domainSlug}:${item.executionType ?? "general"}`);
      return {
        id: item.id, kind: "recommendation" as const, siteSlug: item.domainSlug,
        siteName: siteNames.get(item.domainSlug) ?? item.domainSlug, title: item.title,
        detail: `${item.module} · ${item.effort} effort${signal?.adjustment ? ` · outcome learning ${signal.adjustment > 0 ? "+" : ""}${signal.adjustment}` : ""}`,
        module: item.module, status: item.status ?? "approved",
        severity: score >= 80 ? "high" as const : score >= 50 ? "medium" as const : "low" as const,
        score, actionUrl: item.executionType ? `/work?item=${encodeURIComponent(item.id)}` : item.sourceUrl ?? `/recommendations?item=${encodeURIComponent(item.id)}`,
        createdAt: item.updatedAt.toISOString(),
      };
    }),
    ...mappedResearch.map(({ mapping: item, evidence }) => ({
      id: item.id, kind: "research" as const, siteSlug: item.siteSlug,
      siteName: siteNames.get(item.siteSlug) ?? item.siteSlug, title: item.title,
      detail: `${item.executionType.replace(/_/g, " ")} · ${item.pageMode.replace(/_/g, " ")} · ${item.ownerEmail ?? "Unassigned"}${item.dueDate ? ` · due ${item.dueDate}` : ""}`,
      duplicateWarning: item.duplicateWarning, status: item.status,
      severity: item.priorityScore >= 80 ? "high" as const : item.priorityScore >= 50 ? "medium" as const : "low" as const,
      score: item.priorityScore, actionUrl: `/domain-research?evidence=${encodeURIComponent(evidence.id)}&mapping=${encodeURIComponent(item.id)}`,
      createdAt: item.updatedAt.toISOString(),
    })),
  ];
  return respond(allItems, { critical: noticeCounts.critical, urgent: noticeCounts.urgent + taskCounts.urgent + researchCounts.urgent, open: noticeCounts.open + taskCounts.open + researchCounts.open, paused });
}
