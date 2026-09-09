import { describe, expect, it } from "vitest";
import { parseDataForSeoBalance } from "./account";

describe("DataForSEO account balance", () => {
  it("extracts the wallet balance without exposing other account data", () => {
    expect(parseDataForSeoBalance([{ login: "private@example.com", money: { total: 500, balance: 127.43 }, rates: { private: true } }])).toBe(127.43);
  });

  it("accepts the numeric-string format defensively", () => {
    expect(parseDataForSeoBalance([{ money: { balance: "42.10" } }])).toBe(42.1);
  });

  it.each([0, -0.006292, "-0.006292"])("preserves depleted account balance %s", (balance) => {
    expect(parseDataForSeoBalance([{ money: { balance } }])).toBe(Number(balance));
  });

  it("rejects missing or invalid balances", () => {
    expect(() => parseDataForSeoBalance([{ money: {} }])).toThrow("DataForSEO balance is unavailable.");
    expect(() => parseDataForSeoBalance([{ money: { balance: null } }])).toThrow("DataForSEO balance is unavailable.");
    for (const balance of ["", "   ", false, [], {}, "not a number", NaN, Infinity, -Infinity]) {
      expect(() => parseDataForSeoBalance([{ money: { balance } }])).toThrow("DataForSEO balance is unavailable.");
    }
  });
});
