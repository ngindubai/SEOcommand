import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMeta } = vi.hoisted(() => ({ getMeta: vi.fn() }));
vi.mock("@/providers/dataforseo", () => ({
  dataForSeoConfigured: () => true,
  getDataForSeoClient: () => ({ getMeta }),
}));

describe("DataForSEO balance endpoint", () => {
  beforeEach(() => { vi.resetModules(); getMeta.mockReset(); });

  it("returns depleted credit as an available balance and excludes private account fields", async () => {
    getMeta.mockResolvedValue([{ login: "private@example.test", money: { balance: -0.006292 }, rates: { private: true } }]);
    const { GET } = await import("./route");
    const response = await GET();
    expect(await response.json()).toEqual({
      provider: "dataforseo", configured: true, available: true,
      balanceUsd: -0.006292, updatedAt: expect.any(String),
    });
    expect(getMeta).toHaveBeenCalledWith("/v3/appendix/user_data");
    expect(response.headers.get("Cache-Control")).toContain("private");
  });

  it("does not turn a missing balance into zero credit", async () => {
    getMeta.mockResolvedValue([{ money: {} }]);
    const { GET } = await import("./route");
    expect(await (await GET()).json()).toEqual({ provider: "dataforseo", configured: true, available: false });
  });
});
