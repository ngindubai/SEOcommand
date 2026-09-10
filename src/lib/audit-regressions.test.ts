import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { analyticsPeriod, searchPeriod, shippedInPeriod } from "./reporting";
import { incidentState } from "./incident-state";
import { cellText, csvCell } from "./csv";
import { qualifyRecommendations } from "./recommendation-quality";
import { switchScopeHref } from "./site-context";
import { aggregateBundles } from "@/sync/aggregate";
import type { DomainLiveBundle, DS } from "./live";

const source = <T,>(data: T, start = "2026-08-01", end = "2026-08-28"): DS<T> => ({ data, capturedOn: "2026-09-09", provenance: { source: "google-search-console", mode: "live", rangeStart: start, rangeEnd: end } as DS<T>["provenance"] });
const bundle = (datasets: DomainLiveBundle["datasets"], domainId = "a"): DomainLiveBundle => ({ domainId, datasets, lastSync: "2026-09-09" });
const series = Array.from({ length: 56 }, (_, index) => ({ date: new Date(Date.UTC(2026, 6, index + 1)).toISOString().slice(0, 10), clicks: index < 28 ? 10 : 20, impressions: 100, position: 5, ctr: 20 }));

describe("audit reporting contracts", () => {
  it("uses the same explicit period for headline, chart and change; ignores unrelated saved totals", () => {
    const data = bundle({ gsc_timeseries: source(series), gsc_totals: source({ clicks: 9999, impressions: 99999, ctr: 10, position: 7 }) });
    const report = searchPeriod(data, 28);
    expect(report.total?.clicks).toBe(560);
    expect(report.clickChange).toBe(100);
    expect(report.availableDays).toBe(28);
    expect(searchPeriod(data, 7).total?.clicks).toBe(140);
  });
  it("does not claim a comparison from incomplete evidence", () => {
    const report = searchPeriod(bundle({ gsc_timeseries: source(series.slice(-20)) }), 28);
    expect(report.availableDays).toBe(20);
    expect(report.clickChange).toBeNull();
  });
  it("only reuses saved totals when their exact period is selected", () => {
    const data = bundle({ gsc_totals: source({ clicks: 219, impressions: 69900, ctr: 0.3, position: 22 }) });
    expect(searchPeriod(data, 28)).toMatchObject({ total: { clicks: 219 }, availableDays: 28, snapshotOnly: true });
    expect(searchPeriod(data, 7).total).toBeNull();
  });
  it("preserves older Analytics evidence and its own dates", () => {
    const data = bundle({ ga4_overview: source({ sessions: 473, engagedSessions: 300, engagementRate: 63.4, conversions: 65, screenPageViews: 800, totalUsers: 400, newUsers: 200 }) });
    expect(analyticsPeriod(data, 28)).toMatchObject({ total: { sessions: 473, conversions: 65 }, start: "2026-08-01", end: "2026-08-28", snapshotOnly: true });
    expect(analyticsPeriod(data, 7).total).toBeNull();
  });
  it("counts dated shipments, excluding approved work, invalid dates and shipments outside the report", () => {
    const records = [{ verification: {}, id: "approved" }, { id: "shipped", shippedAt: "2026-08-20", verification: {} }, { id: "outside", shippedAt: "2026-09-01", verification: {} }, { id: "bad-date", shippedAt: "unknown", verification: {} }, { id: "explicitly-unshipped", shippedAt: "2026-08-20", proof: { shipped: false }, verification: {} }];
    expect(shippedInPeriod(records, "2026-08-01", "2026-08-28").map((row) => row.id)).toEqual(["shipped"]);
  });
  it("never combines totals from different measurement periods", () => {
    const first = bundle({ gsc_totals: source({ clicks: 10, impressions: 100, ctr: 10, position: 5 }) });
    const second = bundle({ gsc_totals: source({ clicks: 99, impressions: 990, ctr: 10, position: 5 }, "2026-07-01", "2026-07-28") }, "b");
    expect(aggregateBundles([first, second]).datasets.gsc_totals?.data.clicks).toBe(10);
    expect(aggregateBundles([first, second]).datasets.gsc_totals?.includedDomains).toBe(1);
  });
});

describe("current incident projection", () => {
  const event = { eventType: "site_unavailable", status: "open", createdAt: "2026-09-01" };
  const healthy = { checkedAt: "2026-09-09", available: true, tlsValid: true, tlsExpiresAt: "2027-09-01", domainExpiresAt: "2027-09-01" };
  it("resolves old availability and certificate incidents from newer valid evidence", () => {
    expect(incidentState(event, healthy)).toBe("resolved");
    expect(incidentState({ ...event, eventType: "tls_risk" }, healthy, undefined, new Date("2026-09-09"))).toBe("resolved");
    expect(event.status).toBe("open");
  });
  it("retains unresolved risks, decisions and unavailable evidence", () => {
    expect(incidentState(event, { ...healthy, checkedAt: "2026-08-31" })).toBe("open");
    expect(incidentState({ ...event, eventType: "tls_risk" }, { ...healthy, tlsExpiresAt: null })).toBe("open");
    expect(incidentState({ ...event, status: "dismissed" }, healthy)).toBe("dismissed");
  });
  it("resolves failed collections only after that dataset is saved successfully", () => {
    expect(incidentState({ ...event, eventType: "collection_failed" }, undefined, "2026-09-02")).toBe("resolved");
    expect(incidentState({ ...event, eventType: "collection_failed" }, healthy)).toBe("open");
  });
});

describe("scope, exports and qualified advice", () => {
  it("switches the website inside the current tool, retaining its filters", () => {
    expect(switchScopeHref("/rankings", new URLSearchParams("site=a&range=7d&device=mobile"), "b")).toBe("/rankings?range=7d&device=mobile&site=b");
    expect(switchScopeHref("/work", new URLSearchParams("site=a&item=old"), "b")).toBe("/work?site=b");
  });
  it("exports visible badges, links and zero values even without a sorting accessor", () => {
    expect(cellText(createElement("span", null, "Connected"))).toBe("Connected");
    expect(cellText(createElement("a", { href: "/site" }, "Website A"))).toBe("Website A");
    expect(cellText(0)).toBe("0");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
  });
  it("distinguishes existing page-one queries and preserves the existing workflow key", () => {
    const data = bundle({ striking_distance: source([{ query: "one", position: 5, impressions: 500 }, { query: "two", position: 15, impressions: 200 }] as never), recommendations: source([{ id: "legacy-rec-1", title: "Push 2 striking-distance queries onto page one", domainId: "a", module: "Rankings", confidence: "high", priorityScore: 95, effort: "M", estImpact: "", evidence: "", relatedMetric: "clicks" }]) });
    const qualified = qualifyRecommendations(data)[0];
    expect(qualified.id).toBe("legacy-rec-1");
    expect(qualified.evidence).toContain("1 queries rank 11–20");
    expect(qualified.evidence).toContain("1 already rank 4–10");
    expect(qualified.confidence).toBe("medium");
  });
});

import { normalizeOnPageHealth } from "@/providers/dataforseo/normalizers";
it("does not substitute internal links for the number of pages or fabricate weighted scores", () => {
  const audit = normalizeOnPageHealth({ page_metrics: { onpage_score: 98.52, internal_links_count: 14072, checks: {} } }, "2026-09-09");
  expect(audit.breakdown).toEqual([]);
  expect(audit.crawlRun?.pagesCrawled).toBeNull();
  expect(audit.healthScore).toBe(99);
});
