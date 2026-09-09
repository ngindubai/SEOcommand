import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./auth", () => ({ getGoogleAccessToken: vi.fn().mockResolvedValue("test-token") }));
vi.mock("@/platform/site-store", () => ({ getManagedSite: vi.fn().mockResolvedValue({ ga4PropertyId: "123" }) }));
import { ga4Dashboard } from "./ga4";

afterEach(() => vi.unstubAllGlobals());
describe("GA4 dashboard collector", () => {
  it("uses only organic search, full closed dates, and canonical response fields", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [{ dimensionValues: [{ value: "20260826" }], metricValues: ["12", "7", "20", "2"].map((value) => ({ value })) }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [{ dimensionValues: [{ value: "GB" }, { value: "United Kingdom" }], metricValues: [{ value: "12" }] }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [{ dimensionValues: [{ value: "Home" }, { value: "example.test" }, { value: "/" }], metricValues: [{ value: "20" }] }] }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await ga4Dashboard("example");
    expect(result.series[0]).toEqual({ date: "2026-08-26", sessions: 12, engagedSessions: 7, views: 20, conversions: 2 });
    expect(result.countries[0]).toEqual({ code: "GB", country: "United Kingdom", sessions: 12 });
    expect(result.pages[0]).toMatchObject({ domainId: "example", title: "Home", views: 20 });
    const requests = fetchMock.mock.calls.map((call) => JSON.parse(call[1].body));
    expect(requests).toHaveLength(3);
    for (const request of requests) {
      expect(request.dimensionFilter.filter.stringFilter.value).toBe("Organic Search");
      expect(request.dateRanges[0].endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(request.dateRanges[0].endDate < new Date().toISOString().slice(0, 10)).toBe(true);
    }
    expect(requests[1].dateRanges).toEqual(requests[2].dateRanges);
  });
  it("propagates report failures instead of inventing successful zero data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: { message: "Denied" } }) }));
    await expect(ga4Dashboard("example")).rejects.toThrow("GA4 Data API 403");
  });
});
