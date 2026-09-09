import { describe, expect, it } from "vitest";
import { groupCauses, keywordOverlap, migrationDiff, segmentBrand, siteUrl, suggestLinks, unifiedPages, type PageEvidence } from "./command-model";
import type { DomainLiveBundle, DS } from "./live";
import type { TechnicalIssue } from "./types";
const host = "example.com";
const ds = <T>(data: T): DS<T> => ({ data, capturedOn: "2026-09-09", provenance: { source: "google-search-console", collectedAt: "2026-09-09T10:00:00Z", rangeStart: "2026-08-10", rangeEnd: "2026-09-06", location: "UAE", device: "desktop", freshness: "fresh", mode: "live" } });
const crawl = (url: string, title = "Dubai bus rental"): PageEvidence => ({ url, title, finalUrl: url, statusCode: 200, canonical: url, indexable: true, hash: "a", tracking: ["G-ABCDEF"], capturedAt: "2026-09-09T10:00:00Z", issues: [] });
const issue = (extra: Partial<TechnicalIssue>): TechnicalIssue => ({ id: "a", domainId: "a", title: "Missing canonical", category: "Indexing", severity: "high", explanation: "Missing canonical template", affectedPages: 300, samplePages: ["https://example.com/services/a", "https://example.com/services/b", "https://example.com/services/c"], evidence: "Missing tags in crawl", recommendedFix: "Review template", potentialImpact: "Indexing", firstSeen: "2026-09-01", lastSeen: "2026-09-09", status: "open", taskId: null, ...extra });
describe("connected evidence", () => {
  it("rejects cross-website, credential and non-web URLs while preserving page identity", () => {
    for (const url of ["https://evil.example/x", "https://example.com.evil.test", "javascript:alert(1)", "https://a:b@example.com/", "http://example.com:5000/", "//127.0.0.1/"]) expect(siteUrl(url, host)).toBeNull();
    expect(siteUrl("/services/?a=1#section", host)).toBe("https://example.com/services/?a=1");
  });
  it("classifies whole brand phrases, handles aliases and exposes coverage gaps", () => {
    const rows = ["Bus Go prices", "business loans", "GLOBAL BUS RENTAL"].map((key) => ({ key, clicks: 10, impressions: 100, ctr: .1, position: 3 }));
    const result = segmentBrand(rows, ["bus go", "global bus rental"], 50);
    expect(result.brand.clicks).toBe(20); expect(result.nonBrand.clicks).toBe(10); expect(result.coveragePct).toBe(60);
    expect(segmentBrand(undefined, [], null)).toMatchObject({ available: false, configured: false, coveragePct: null });
  });
  it("joins URLs without inventing missing measurements or conflating query variants", () => {
    const bundle: DomainLiveBundle = { domainId: "a", lastSync: null, datasets: { gsc_pages: ds([{ key: "https://www.example.com/a", clicks: 0, impressions: 5, ctr: 0, position: 4 }, { key: "https://example.com/a?q=1", clicks: 9, impressions: 10, ctr: .9, position: 1 }]) } };
    const pages = unifiedPages(host, bundle, [crawl("https://example.com/a"), crawl("https://example.com/b")], [], []);
    expect(pages).toHaveLength(3); expect(pages.find((page) => page.url.endsWith("/a"))).toMatchObject({ clicks: 0, backlinks: null, keyEvents: null });
    expect(pages.find((page) => page.url.endsWith("/b"))?.clicks).toBeNull();
  });
  it("makes Analytics page-title rows available in the unified page view", () => {
    const bundle: DomainLiveBundle = { domainId: "a", lastSync: null, datasets: { ga4_dashboard: ds({ pages: [{ domainId: "a", host, path: "/contact", title: "Contact us", views: 20 }] } as any) } };
    expect(unifiedPages(host, bundle, [], [], [])[0]).toMatchObject({ url: "https://example.com/contact", title: "Contact us", clicks: null });
  });
  it("groups shared issue patterns, labels sampled URL counts and never calls the cause certain", () => {
    const result = groupCauses([issue({}), issue({ id: "b", title: "Duplicate canonical", affectedPages: 3 }), issue({ id: "c", status: "resolved" })], host);
    expect(result).toHaveLength(1); expect(result[0]).toMatchObject({ confidence: "medium", sampled: true });
    expect(result[0]!.urls).toHaveLength(3); expect(result[0]!.findings).toHaveLength(2);
  });
  it("does not suggest an existing internal link", () => {
    const bundle: DomainLiveBundle = { domainId: "a", lastSync: null, datasets: { gsc_pages: ds([{ key: "https://example.com/target", clicks: 4, impressions: 90, ctr: .05, position: 8 }]) } };
    const pages = unifiedPages(host, bundle, [crawl("https://example.com/source"), crawl("https://example.com/target")], [], []);
    expect(suggestLinks(pages, [], host, "2026-09-09")).toHaveLength(1);
    expect(suggestLinks(pages, [{ sourceUrl: "https://example.com/source", targetUrl: "https://example.com/target" }], host, "2026-09-09")).toHaveLength(0);
  });
  it("detects launch regressions and distinguishes missing crawl rows from proven deletion", () => {
    const before = [crawl("https://example.com/a"), crawl("https://example.com/b")];
    const after = [{ ...before[0]!, statusCode: 404, indexable: false, title: "Not found", tracking: [] }];
    const result = migrationDiff(before, after, host);
    expect(result[0]!.changes.join(" ")).toMatch(/HTTP status.*Indexing directives.*tracking/);
    expect(result[1]!.changes[0]).toContain("verify it directly");
  });
  it("compares portfolio keywords only within the same recorded market", () => {
    const entry = (id: string, location: string) => ({ site: { id, name: id, host: `${id}.test` }, bundle: { domainId: id, lastSync: null, datasets: { keywords: ds([{ keyword: "bus rental", location, position: 5, targetUrl: null }] as any) } } });
    expect(keywordOverlap([entry("a", "UAE"), entry("b", "USA")])).toHaveLength(0);
    expect(keywordOverlap([entry("a", "UAE"), entry("b", "UAE")])[0]!.sites).toHaveLength(2);
  });
});
