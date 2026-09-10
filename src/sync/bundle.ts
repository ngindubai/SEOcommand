import type {
  Backlink,
  Keyword,
  RankSnapshot,
  ReferringDomain,
} from "@/lib/types";
import type { DomainHeadline, DomainLiveBundle, OnPageResult, PortfolioLive } from "@/lib/live";
import { getManagedSite, listManagedSites } from "@/platform/site-store";
import { qualifyRecommendations, normalizedHost } from "@/lib/recommendation-quality";
import { sourceHealth } from "@/lib/source-health";
import { analyticsPeriod, searchPeriod } from "@/lib/reporting";
import { computeAuthorityScore } from "@/lib/scoring";
import {
  hasDatabase,
  readLatestForDomains,
  readLatestSnapshots,
  readSnapshotHistory,
  type StoredSnapshot,
} from "./store";
import { aggregateBundles, PORTFOLIO_SCOPE_ID } from "./aggregate";
import { QA_SITES, qaDomainBundle, qaPortfolio } from "@/data/qa-fixtures";

/**
 * Assembles API read-models from stored snapshots. Pure reads — no provider
 * calls, no spend. Missing datasets simply stay absent from the bundle and the
 * UI renders an honest "awaiting first sync" state.
 */

function attach(bundle: DomainLiveBundle, snaps: StoredSnapshot[]): void {
  let last: string | null = null;
  for (const s of snaps) {
    if (s.dataset === "onpage_task" || s.dataset === "visibility_point") continue;
    (bundle.datasets as Record<string, unknown>)[s.dataset] = {
      data: s.payload,
      capturedOn: s.capturedOn,
      provenance: s.provenance,
    };
    const collected = s.provenance?.collectedAt ?? s.capturedOn;
    if (!last || collected > last) last = collected;
  }
  const audit = bundle.datasets.onpage?.data;
  if (audit && audit.methodologyVersion !== 2 && audit.crawlRun) {
    // Older page counts used an internal-link fallback. Retain the original snapshot;
    // the read model withholds that unverified count until a corrected crawl exists.
    bundle.datasets.onpage = { ...bundle.datasets.onpage!, data: { ...audit, breakdown: [], crawlRun: { ...audit.crawlRun, pagesCrawled: null } } };
  }
  if (bundle.datasets.recommendations) bundle.datasets.recommendations = { ...bundle.datasets.recommendations, data: qualifyRecommendations(bundle) };
  bundle.lastSync = last;
}

export async function buildDomainBundle(domainId: string): Promise<DomainLiveBundle> {
  if (process.env.QA_SYNTHETIC === "true") return qaDomainBundle(domainId);
  const bundle: DomainLiveBundle = { domainId, lastSync: null, datasets: {} };
  if (!hasDatabase()) return bundle;

  const snaps = await readLatestSnapshots(domainId);
  attach(bundle, snaps);
  const site = await getManagedSite(domainId);
  if (site && bundle.datasets.competitors) bundle.datasets.competitors.data = bundle.datasets.competitors.data.filter((item) => normalizedHost(item.host) !== normalizedHost(site.host));

  // Visibility history accumulates one point per sync day.
  const visHistory = await readSnapshotHistory(domainId, "visibility_point");
  if (visHistory.length > 0) {
    const latest = visHistory[visHistory.length - 1]!;
    bundle.datasets.visibility_series = {
      data: visHistory.map((v) => v.payload as { date: string; value: number }),
      capturedOn: latest.capturedOn,
      provenance: latest.provenance,
    };
  }
  return bundle;
}

/**
 * Portfolio-wide bundle: every domain's latest snapshots merged into one bundle
 * shaped like a single-domain bundle. Snapshots are read in ONE batched query
 * rather than a per-domain round-trip.
 */
export async function buildAggregateBundle(siteSlugs?: string[]): Promise<DomainLiveBundle> {
  if (process.env.QA_SYNTHETIC === "true") {
    const sites = siteSlugs ? QA_SITES.filter((site) => siteSlugs.includes(site.id)) : QA_SITES;
    return aggregateBundles(sites.map((site) => qaDomainBundle(site.id)));
  }
  if (!hasDatabase()) {
    return { domainId: PORTFOLIO_SCOPE_ID, lastSync: null, datasets: {} };
  }
  const allSites = await listManagedSites();
  const allowed = siteSlugs ? new Set(siteSlugs) : null;
  const sites = allowed ? allSites.filter((site) => allowed.has(site.id)) : allSites;
  const map = await readLatestForDomains(sites.map((d) => d.id));
  const bundles: DomainLiveBundle[] = [];
  for (const d of sites) {
    const snaps = map.get(d.id);

    const bundle: DomainLiveBundle = { domainId: d.id, lastSync: null, datasets: {} };
    attach(bundle, snaps ?? []);
    if (bundle.datasets.competitors) bundle.datasets.competitors.data = bundle.datasets.competitors.data.filter((item) => normalizedHost(item.host) !== normalizedHost(d.host));
    bundles.push(bundle);
  }
  return aggregateBundles(bundles);
}

export function headlineFrom(domainId: string, snaps: StoredSnapshot[], ga4Mapped = false, days = 28, end?: string): DomainHeadline {
  const by = new Map(snaps.map((s) => [s.dataset, s]));
  const bundle: DomainLiveBundle = { domainId, lastSync: null, datasets: {} };
  attach(bundle, snaps);
  const period = searchPeriod(bundle, days, end);
  const latestSearch = bundle.datasets.gsc_timeseries?.data.map((row) => row.date).sort().at(-1);
  if (end && latestSearch && latestSearch < end) { period.total = null; period.clickChange = null; period.availableDays = 0; period.end = latestSearch; }
  const analytics = analyticsPeriod(bundle, days);
  const onpage = by.get("onpage")?.payload as OnPageResult | undefined;
  const keywords = by.get("keywords")?.payload as Keyword[] | undefined;
  const snapshots = by.get("rank_snapshots")?.payload as RankSnapshot[] | undefined;
  const backlinks = by.get("backlinks")?.payload as Backlink[] | undefined;
  const referring = by.get("referring_domains")?.payload as ReferringDomain[] | undefined;
  const visPoint = by.get("visibility_point")?.payload as { value: number } | undefined;
  const ai = by.get("ai_prompts")?.payload as { mentionRate: number }[] | undefined;

  let last: string | null = null;
  for (const s of snaps) {
    const collected = s.provenance?.collectedAt ?? s.capturedOn;
    if (!last || collected > last) last = collected;
  }

  const visibility = visPoint?.value ?? null;
  return {
    domainId,
    searchPeriod: { start: period.start, end: period.end, availableDays: period.availableDays, clicks: period.total?.clicks ?? null, impressions: period.total?.impressions ?? null, position: period.total?.position ?? null, clickChange: period.clickChange },
    lastSync: last,
    dataHealth: sourceHealth(bundle),
    clicks28d: period.total?.clicks ?? null,
    impressions28d: period.total?.impressions ?? null,
    avgPosition: period.total?.position ?? null,
    sessions28d: analytics.total?.sessions ?? null,
    conversions28d: analytics.total?.conversions ?? null,
    visibility,
    health: onpage ? onpage.healthScore : null,
    authority:
      backlinks && referring
        ? computeAuthorityScore(referring, backlinks, visibility ?? 0)
        : null,
    keywordsTracked: keywords?.length ?? null,
    top10: snapshots ? snapshots.filter((s) => s.position > 0 && s.position <= 10).length : null,
    referringDomains: referring?.length ?? null,
    criticalIssues: onpage
      ? onpage.issues.filter((i) => i.status !== "resolved" && (i.severity === "critical" || i.severity === "high")).length
      : null,
    aiMentionRate:
      ai && ai.length
        ? Math.round(ai.reduce((s, p) => s + p.mentionRate, 0) / ai.length)
        : null,
    ga4Mapped,
  };
}

export async function buildPortfolio(siteSlugs?: string[], days = 28, end?: string): Promise<PortfolioLive> {
  if (process.env.QA_SYNTHETIC === "true") {
    const portfolio = qaPortfolio(siteSlugs);
    for (const site of portfolio.domains) {
      const period = searchPeriod(qaDomainBundle(site.domainId), days, end);
      site.searchPeriod = { start: period.start, end: period.end, availableDays: period.availableDays, clicks: period.total?.clicks ?? null, impressions: period.total?.impressions ?? null, position: period.total?.position ?? null, clickChange: period.clickChange };
    }
    return portfolio;
  }
  const allSites = await listManagedSites();
  const allowed = siteSlugs ? new Set(siteSlugs) : null;
  const sites = allowed ? allSites.filter((site) => allowed.has(site.id)) : allSites;
  const empty: PortfolioLive = {
    generatedAt: new Date().toISOString(),
    domains: sites.map((d) => headlineFrom(d.id, [], Boolean(d.ga4PropertyId))),
    totals: {
      clicks28d: 0,
      impressions28d: 0,
      sessions28d: 0,
      conversions28d: 0,
      avgHealth: null,
      avgVisibility: null,
      criticalIssues: 0,
      referringDomains: 0,
      domainsSynced: 0,
    },
  };
  if (!hasDatabase()) return empty;

  const map = await readLatestForDomains(sites.map((d) => d.id));
  const domains = sites.map((d) => headlineFrom(d.id, map.get(d.id) ?? [], Boolean(d.ga4PropertyId), days, end));

  const bundles = sites.map((site) => { const bundle: DomainLiveBundle = { domainId: site.id, lastSync: null, datasets: {} }; attach(bundle, map.get(site.id) ?? []); return bundle; });
  const merged = aggregateBundles(bundles);
  const search = searchPeriod(merged, days, end), analytics = analyticsPeriod(merged, days);
  const synced = domains.filter((d) => d.lastSync != null);
  const healths = domains.map((d) => d.health).filter((h): h is number => h != null);
  const vis = domains.map((d) => d.visibility).filter((v): v is number => v != null);

  return {
    generatedAt: new Date().toISOString(),
    domains,
    totals: {
      clicks28d: search.total?.clicks ?? 0,
      impressions28d: search.total?.impressions ?? 0,
      sessions28d: analytics.total?.sessions ?? 0,
      conversions28d: analytics.total?.conversions ?? 0,
      avgHealth: healths.length
        ? Math.round(healths.reduce((s, h) => s + h, 0) / healths.length)
        : null,
      avgVisibility: vis.length ? Math.round(vis.reduce((s, v) => s + v, 0) / vis.length) : null,
      criticalIssues: domains.reduce((s, d) => s + (d.criticalIssues ?? 0), 0),
      referringDomains: domains.reduce((s, d) => s + (d.referringDomains ?? 0), 0),
      domainsSynced: synced.length,
    },
  };
}
