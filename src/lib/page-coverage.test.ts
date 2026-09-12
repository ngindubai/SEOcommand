import { describe, expect, it } from "vitest";
import { summarizePageCoverage } from "./page-coverage";
import type { CommandRecord } from "./command-model";

const host = "example.com";
const record = (url: string, verdict = "PASS", extra: Partial<CommandRecord> = {}): CommandRecord => ({
  id: url, siteSlug: "example", kind: "indexing", recordKey: url, status: "completed",
  payload: { url, verdict, indexing: "INDEXING_ALLOWED", inspectedAt: "2026-09-12T10:00:00Z", lastCrawl: "2026-09-11T09:00:00Z" },
  nextRunAt: null, createdAt: "2026-09-12T10:00:00Z", updatedAt: "2026-09-12T10:00:00Z", ...extra,
});
const summary = (inspections: CommandRecord[], urls: string[] = []) => summarizePageCoverage({ host, inspections, pages: urls.map((url) => ({ url })) });

describe("website page coverage", () => {
  it("keeps missing evidence unavailable instead of claiming zero pages or zero indexing", () => {
    expect(summary([])).toMatchObject({ known: null, crawled: null, indexed: null, inspected: 0, inspectedAt: null, lastGoogleCrawl: null });
    expect(summary([], ["https://example.com/a"])).toMatchObject({ known: 1, crawled: null, indexed: null });
  });
  it("counts Google crawl dates and index verdicts independently, never indexing directives", () => {
    const absentCrawl = record("https://example.com/b", "NEUTRAL"); absentCrawl.payload.lastCrawl = null;
    const unknown = record("https://example.com/c", "VERDICT_UNSPECIFIED"); unknown.payload.lastCrawl = "invalid";
    expect(summary([record("https://example.com/a"), absentCrawl, unknown])).toMatchObject({ known: 3, crawled: 1, indexed: 1, inspected: 3, unknownVerdicts: 1 });
    expect(summary([unknown])).toMatchObject({ indexed: null, crawled: 0, unknownVerdicts: 1 });
    expect(summary([absentCrawl])).toMatchObject({ indexed: 0, crawled: 0 });
  });
  it("uses the latest successful inspection per URL and preserves it during a failed or pending recheck", () => {
    const old = record("https://www.example.com/a", "PASS", { updatedAt: "2026-09-10T10:00:00Z" }); old.payload.inspectedAt = old.updatedAt;
    const current = record("https://example.com/a", "NEUTRAL");
    expect(summary([old, current, record("https://example.com/a", "PASS", { status: "failed" }), record("https://example.com/a", "PASS", { status: "queued" })])).toMatchObject({ known: 1, inspected: 1, indexed: 0 });
  });
  it("deduplicates known URLs, excludes other websites and preserves distinct query pages", () => {
    expect(summary([record("https://evil.test/"), record("https://example.com/b")], ["https://example.com/a", "https://www.example.com/a#section", "https://example.com/a?q=1", "https://evil.test/x"])).toMatchObject({ known: 3, inspected: 1, indexed: 1 });
  });
  it("separates Google’s crawl date from the time the saved results were checked", () => {
    expect(summary([record("https://example.com/a")])).toMatchObject({ lastGoogleCrawl: "2026-09-11T09:00:00Z", inspectedAt: "2026-09-12T10:00:00Z" });
  });
  it("counts all saved inspected URLs, beyond the recent activity history window", () => {
    const rows = Array.from({ length: 150 }, (_, index) => record(`https://example.com/page-${index}`));
    expect(summary(rows)).toMatchObject({ known: 150, inspected: 150, crawled: 150, indexed: 150 });
  });
});
