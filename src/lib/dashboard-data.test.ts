import { describe, expect, it } from "vitest";
import { mergeDashboardData, percentageChange, reportingWindow, searchSummary, sessionSummary, shiftDate, type Ga4Dashboard } from "./dashboard-data";
import { aggregateBundles } from "@/sync/aggregate";
import { qaDomainBundle, QA_SITES } from "@/data/qa-fixtures";

describe("dashboard reporting", () => {
  it("uses captured dates and refuses a partial previous comparison", () => {
    const rows = Array.from({ length: 55 }, (_, i) => ({ date: shiftDate("2026-06-01", i), clicks: i }));
    const window = reportingWindow(rows, 28);
    expect(window.current).toHaveLength(28);
    expect(window.previous).toHaveLength(27);
    expect(window.comparable).toBe(false);
    expect(window.end).toBe("2026-07-25");
    expect(reportingWindow(rows, 7).comparable).toBe(true);
    expect(reportingWindow(rows, 90).availableDays).toBe(55);
  });
  it("weights ranking by impressions and distinguishes missing data from zero", () => {
    expect(searchSummary([])).toBeNull();
    expect(searchSummary([{ date: "2026-07-01", clicks: 0, impressions: 0, position: 0, ctr: 0 }])).toEqual({ clicks: 0, impressions: 0, position: null });
    expect(searchSummary([{ date: "a", clicks: 5, impressions: 100, position: 2, ctr: 5 }, { date: "b", clicks: 5, impressions: 900, position: 10, ctr: .55 }])?.position).toBe(9.2);
    expect(percentageChange(10, 0)).toBeNull();
  });
  it("recomputes engagement from totals, never averages daily rates", () => {
    const summary = sessionSummary([{ date: "a", sessions: 10, engagedSessions: 10, views: 20, conversions: 1 }, { date: "b", sessions: 90, engagedSessions: 0, views: 80, conversions: 2 }]);
    expect(summary).toEqual({ sessions: 100, engaged: 10, engagementRate: 10, viewsPerSession: 1, conversions: 3 });
  });
  it("combines matching GA4 windows and preserves page ownership", () => {
    const base: Ga4Dashboard = { startDate: "2026-03-01", endDate: "2026-08-26", breakdownStartDate: "2026-07-30", domainIds: ["a"], series: [{ date: "2026-08-26", sessions: 10, engagedSessions: 7, views: 20, conversions: 1 }], countries: [{ code: "GB", country: "United Kingdom", sessions: 10 }], pages: [{ domainId: "a", host: "a.test", path: "/", title: "Home", views: 10 }] };
    const merged = mergeDashboardData([base, { ...base, domainIds: ["b"], pages: [{ ...base.pages[0], domainId: "b" }] }, { ...base, endDate: "2026-08-25", domainIds: ["stale"] }]);
    expect(merged?.series[0]?.sessions).toBe(20);
    expect(merged?.countries[0]?.sessions).toBe(20);
    expect(merged?.domainIds).toEqual(["a", "b"]);
    expect(merged?.pages.map((p) => p.domainId)).toEqual(["a", "b"]);
    expect(mergeDashboardData([])).toBeUndefined();
  });
  it("excludes dates missing from a property so coverage changes cannot mimic growth", () => {
    const a = qaDomainBundle(QA_SITES[0].id);
    const b = qaDomainBundle(QA_SITES[1].id);
    b.datasets.gsc_timeseries!.data = b.datasets.gsc_timeseries!.data.slice(1);
    const combined = aggregateBundles([a, b]);
    expect(combined.datasets.gsc_timeseries?.data).toHaveLength(55);
    expect(combined.datasets.gsc_timeseries?.includedDomains).toBe(2);
    expect(reportingWindow(combined.datasets.gsc_timeseries!.data, 28).comparable).toBe(false);
  });
  it("renders true multi-site fixture aggregates and reconciled search totals", () => {
    const bundles = QA_SITES.slice(0, 2).map((site) => qaDomainBundle(site.id));
    const combined = aggregateBundles(bundles);
    expect(combined.datasets.ga4_dashboard?.data.domainIds).toHaveLength(2);
    expect(combined.datasets.keywords?.data).toHaveLength(24);
    const window = reportingWindow(combined.datasets.gsc_timeseries!.data, 28);
    expect(searchSummary(window.current)?.clicks).toBe(combined.datasets.gsc_totals?.data.clicks);
    expect(window.comparable).toBe(true);
    expect(aggregateBundles([]).datasets).toEqual({});
  });
});
