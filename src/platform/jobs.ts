import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { DomainSyncReport, SyncTiers } from "@/sync/engine";
import { queueBrowserCrawl } from "./advanced-crawler";
import { checkReliability } from "./reliability";
import { getManagedSite } from "./site-store";
import { FULL_SCAN_MODULES, tiersForModules } from "./scan-policy";
import type { ScanModule } from "./types";

export interface PlatformJobSummary {
  due: number;
  completed: number;
  failed: number;
  reports: DomainSyncReport[];
}

/** Process a bounded onboarding batch; subsequent cron runs resume the queue. */
export async function processPlatformJobs(
  sync: (siteSlug: string, tiers?: SyncTiers) => Promise<DomainSyncReport>,
  now = new Date(),
  jobId?: string,
): Promise<PlatformJobSummary> {
  // An interrupted web process must not leave a paid scan running forever.
  // Preserve its evidence and require an explicit retry instead of recharging automatically.
  await db().update(schema.platformJobs).set({ status: "failed", lastError: "The scan worker stopped before this run finished. Saved datasets are retained. Review the evidence before retrying." }).where(and(
    inArray(schema.platformJobs.kind, ["initial_site_scan", "site_scan"]),
    eq(schema.platformJobs.status, "running"),
    lte(schema.platformJobs.startedAt, new Date(now.getTime() - 30 * 60_000)),
    jobId ? eq(schema.platformJobs.id, jobId) : undefined,
  ));
  const limit = Math.min(Math.max(Number(process.env.ONBOARDING_JOBS_PER_RUN ?? "5"), 1), 20);
  const due = await db()
    .select()
    .from(schema.platformJobs)
    .where(and(inArray(schema.platformJobs.kind, ["initial_site_scan", "site_scan"]), eq(schema.platformJobs.status, "queued"), lte(schema.platformJobs.runAfter, now), jobId ? eq(schema.platformJobs.id, jobId) : undefined))
    .orderBy(asc(schema.platformJobs.createdAt))
    .limit(limit);
  let completed = 0;
  let failed = 0;
  const reports: DomainSyncReport[] = [];
  for (const job of due) {
    try {
      const requested = Array.isArray(job.progress.modules)
        ? job.progress.modules.filter((value): value is ScanModule => typeof value === "string" && FULL_SCAN_MODULES.includes(value as ScanModule))
        : FULL_SCAN_MODULES;
      const [claimed] = await db().update(schema.platformJobs).set({
        status: "running",
        attempts: job.attempts + 1,
        startedAt: now,
        progress: { ...job.progress, modules: requested, phase: "collecting", completed: [] },
      }).where(and(eq(schema.platformJobs.id, job.id), eq(schema.platformJobs.status, "queued"))).returning({ id: schema.platformJobs.id });
      if (!claimed) continue;
      const report = await sync(job.siteSlug, tiersForModules(requested));
      reports.push(report);
      const errors = report.results.filter((item) => item.status === "error" || (item.status === "skipped" && /budget|limit|credentials/i.test(item.note ?? "")));
      const progressUpdate = await db().update(schema.platformJobs).set({ progress: { ...job.progress, modules: requested, phase: errors.length ? "interrupted" : "saving", datasets: report.results.map((item) => ({ dataset: item.dataset, status: item.status, note: item.note })) } }).where(and(eq(schema.platformJobs.id, job.id), eq(schema.platformJobs.status, "running"))).returning({ id: schema.platformJobs.id });
      if (!progressUpdate.length) continue;
      if (errors.length) throw new Error(errors.map((item) => `${item.dataset}: ${item.note}`).join("; "));
      const site = await getManagedSite(job.siteSlug);
      if (site && requested.includes("technical")) await queueBrowserCrawl(job.siteSlug, site.crawlMaxPages);
      if (site && requested.includes("reliability")) await checkReliability(site);
      await db().transaction(async (tx) => {
        const updated = await tx.update(schema.platformJobs).set({
          status: "completed",
          completedAt: new Date(),
          progress: {
            ...job.progress,
            modules: requested,
            phase: "completed",
            completed: requested,
            datasets: report.results.map((item) => ({ dataset: item.dataset, status: item.status, note: item.note })),
          },
          lastError: null,
        }).where(and(eq(schema.platformJobs.id, job.id), eq(schema.platformJobs.status, "running"))).returning({ id: schema.platformJobs.id });
        if (updated.length && job.kind === "initial_site_scan") {
          await tx.update(schema.siteProfiles).set({ lifecycleStatus: "active", onboardingProgress: { initialScan: "completed" }, updatedAt: new Date() }).where(eq(schema.siteProfiles.slug, job.siteSlug));
        }
      });
      completed++;
    } catch (error) {
      const note = error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000);
      const terminal = job.attempts >= 2 || /Payment Required|credentials|budget|daily limit|forbidden|permission/i.test(note);
      await db().transaction(async (tx) => {
        await tx.update(schema.platformJobs).set({ status: terminal ? "failed" : "queued", attempts: job.attempts + 1, runAfter: new Date(Date.now() + 5 * 60_000), lastError: note }).where(and(eq(schema.platformJobs.id, job.id), eq(schema.platformJobs.status, "running")));
        if (terminal && job.kind === "initial_site_scan") await tx.update(schema.siteProfiles).set({ lifecycleStatus: "error", updatedAt: new Date() }).where(eq(schema.siteProfiles.slug, job.siteSlug));
      });
      failed++;
    }
  }
  return { due: due.length, completed, failed, reports };
}
