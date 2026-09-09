import { afterEach, expect, it, vi } from "vitest";
import { inspectIndex, normalizeSpeed } from "./command-collect";
import type { ManagedSite } from "./types";
vi.mock("@/providers/google/auth", () => ({ getGoogleAccessToken: vi.fn(async () => "test-token") }));
afterEach(() => vi.unstubAllGlobals());
it("keeps missing lab and field metrics absent; does not fabricate INP", () => {
  const result = normalizeSpeed({ lighthouseResult: { fetchTime: "2026-09-09T10:00:00Z", categories: { performance: { score: .64 } }, audits: { "largest-contentful-paint": { numericValue: 4100, score: .2, title: "LCP", displayValue: "4.1s" } } } }, "https://example.com", "mobile");
  expect(result).toMatchObject({ score: 64, lcpMs: 4100, tbtMs: null, cls: null, field: null }); expect(result).not.toHaveProperty("inp");
  expect(() => normalizeSpeed({ lighthouseResult: { runtimeError: { message: "Navigation failed" } } }, "https://example.com", "desktop")).toThrow("Navigation failed");
});
it("labels origin field data separately from a page lab test", () => {
  const result = normalizeSpeed({ originLoadingExperience: { id: "https://example.com", metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 140, category: "FAST" } } }, lighthouseResult: { categories: { performance: { score: 0 } } } }, "https://example.com/page", "desktop");
  expect(result.score).toBe(0); expect(result.field?.scope).toBe("origin");
});
it("uses the authorised property for inspection and preserves Google crawl versus inspection dates", async () => {
  const fetcher = vi.fn(async () => Response.json({ inspectionResult: { indexStatusResult: { verdict: "PASS", coverageState: "Submitted and indexed", lastCrawlTime: "2026-08-01T10:00:00Z" } } }));
  vi.stubGlobal("fetch", fetcher);
  const site = { host: "example.com", gscSite: "sc-domain:example.com" } as ManagedSite;
  const result = await inspectIndex(site, "/page");
  expect(result.lastCrawl).toBe("2026-08-01T10:00:00Z"); expect(result.inspectedAt).not.toBe(result.lastCrawl);
  expect(JSON.parse((fetcher.mock.calls[0] as any)[1].body)).toMatchObject({ inspectionUrl: "https://example.com/page", siteUrl: "sc-domain:example.com" });
  await expect(inspectIndex(site, "http://evil.test/")).rejects.toThrow("this website"); expect(fetcher).toHaveBeenCalledTimes(1);
});
