import { ENDPOINTS } from "./config";
import { getDataForSeoClient } from "./index";

type Row = Record<string, unknown>;

function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

export function parseDataForSeoBalance(rows: Row[]): number {
  const value = record(rows[0]?.money).balance;
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) {
    throw new Error("DataForSEO balance is unavailable.");
  }
  const balance = typeof value === "number" ? value : Number(value);
  // DataForSEO can report a negative balance when the account runs out of credit.
  // Preserve it so the UI can explain that a top-up is required.
  if (!Number.isFinite(balance)) throw new Error("DataForSEO balance is unavailable.");
  return balance;
}

/** Zero-cost provider account lookup. No login, rates or pricing data leaves the server. */
export async function fetchDataForSeoBalance(): Promise<number> {
  const rows = await getDataForSeoClient().getMeta<Row>(ENDPOINTS.userData);
  return parseDataForSeoBalance(rows);
}
