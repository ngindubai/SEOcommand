import type { DomainLiveBundle } from "./live";
import { analyticsDays, percentageChange, reportingWindow, searchSummary, sessionSummary } from "./dashboard-data";

/** A single period contract for dashboards, website rows and client reports. */
export function searchPeriod(bundle: DomainLiveBundle | null | undefined, days = 28, end?: string) {
  const period = reportingWindow(bundle?.datasets.gsc_timeseries?.data ?? [], days, end);
  const current = searchSummary(period.current);
  const previous = period.comparable ? searchSummary(period.previous) : null;
  const saved = bundle?.datasets.gsc_totals;
  const savedDays = saved?.provenance.rangeStart && saved.provenance.rangeEnd ? Math.round((Date.parse(saved.provenance.rangeEnd) - Date.parse(saved.provenance.rangeStart)) / 86_400_000) + 1 : 0;
  const fallback = !period.current.length && savedDays === days && (!end || end === saved?.provenance.rangeEnd) ? saved : undefined;
  return {
    ...period,
    start: fallback?.provenance.rangeStart ?? period.start,
    end: fallback?.provenance.rangeEnd ?? period.end,
    total: current ? { ...current, ctr: current.impressions ? current.clicks / current.impressions * 100 : 0 } : fallback?.data ?? null,
    clickChange: percentageChange(current?.clicks, previous?.clicks),
    impressionChange: percentageChange(current?.impressions, previous?.impressions),
    positionChange: percentageChange(current?.position, previous?.position),
    availableDays: fallback ? savedDays : period.availableDays,
    snapshotOnly: Boolean(fallback),
  };
}

export function analyticsPeriod(bundle: DomainLiveBundle | null | undefined, days = 28) {
  const data = bundle?.datasets.ga4_dashboard?.data;
  const period = reportingWindow(data ? analyticsDays(data) : [], days, data?.endDate);
  if (data?.qualityNote) period.comparable = false;
  const saved = bundle?.datasets.ga4_overview;
  const legacy = saved?.data;
  const savedDays = saved?.provenance.rangeStart && saved.provenance.rangeEnd ? (Date.parse(saved.provenance.rangeEnd) - Date.parse(saved.provenance.rangeStart)) / 86_400_000 + 1 : 0;
  const fallback = !data && !period.current.length && legacy && savedDays === days ? {
    sessions: legacy.sessions, engaged: legacy.engagedSessions, engagementRate: legacy.engagementRate,
    viewsPerSession: legacy.sessions ? legacy.screenPageViews / legacy.sessions : 0, conversions: legacy.conversions,
  } : null;
  return { ...period, start: fallback ? saved?.provenance.rangeStart ?? null : period.start, end: fallback ? saved?.provenance.rangeEnd ?? null : period.end,
    total: sessionSummary(period.current) ?? fallback, previousTotal: period.comparable ? sessionSummary(period.previous) : null, snapshotOnly: Boolean(fallback) };
}

export interface DeliveryRecord {
  shippedAt?: Date | string | null; proof?: { shipped: boolean; verified?: boolean };
  verification: { shipment?: { recordedAt?: string }; outcome?: string };
}
export function shippedInPeriod<T extends DeliveryRecord>(rows: T[], start: string | null, end: string | null): T[] {
  return rows.filter((row) => {
    const date = row.shippedAt ?? row.verification.shipment?.recordedAt;
    if (!date || row.proof?.shipped === false) return false;
    const timestamp = new Date(date);
    if (!Number.isFinite(timestamp.getTime())) return false;
    const day = timestamp.toISOString().slice(0, 10);
    return (!start || day >= start) && (!end || day <= end);
  });
}
