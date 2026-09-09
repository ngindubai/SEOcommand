import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import { scanModuleFreshness } from "./scan-freshness";

let client: PGlite;
let testDb: ReturnType<typeof drizzle>;
vi.mock("@/db", async () => ({ schema: await import("@/db/schema"), db: () => testDb }));
vi.mock("@/sync/store", () => ({ hasDatabase: () => true }));
beforeAll(async () => {
  vi.stubEnv("QA_SYNTHETIC", "false");
  client = new PGlite(); testDb = drizzle(client);
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  for (const { tag } of journal.entries) await client.exec(await readFile(`drizzle/${tag}.sql`, "utf8"));
});
afterAll(async () => { await client.close(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  await testDb.delete(schema.datasetSnapshots);
  await testDb.delete(schema.browserCrawlRuns);
  await testDb.delete(schema.reliabilityChecks);
  await testDb.delete(schema.localSeoSnapshots);
  await testDb.delete(schema.localSeoLocations);
});
const at = new Date("2026-09-09T20:50:26Z");

it("reports never collected separately from queued task metadata and sample data", async () => {
  await testDb.insert(schema.datasetSnapshots).values([
    { domainSlug: "a", dataset: "onpage_task", capturedOn: "2026-09-09", payload: { taskId: "queued" }, provenance: { mode: "live", collectedAt: at.toISOString() } },
    { domainSlug: "a", dataset: "keywords", capturedOn: "2026-09-09", payload: [], provenance: { mode: "demo", collectedAt: at.toISOString() } },
  ]);
  const result = await scanModuleFreshness("a");
  expect(Object.keys(result)).toHaveLength(11);
  expect(Object.values(result).every(value => value.lastUpdatedAt === null)).toBe(true);
});

it("uses collection time, maps each provider module, and isolates websites", async () => {
  for (const dataset of ["gsc_timeseries", "daily_rankings", "keywords", "competitors", "onpage", "backlinks", "ai_crawler_audit"]) {
    await testDb.insert(schema.datasetSnapshots).values({ domainSlug: "a", dataset, capturedOn: "2026-09-09", payload: [], provenance: { mode: "live", collectedAt: at.toISOString() }, createdAt: new Date("2026-09-10T06:00:00Z") });
  }
  await testDb.insert(schema.datasetSnapshots).values({ domainSlug: "b", dataset: "backlinks", capturedOn: "2026-09-10", payload: [], provenance: { collectedAt: "2026-09-10T09:00:00Z" } });
  const result = await scanModuleFreshness("a");
  for (const moduleId of ["google", "rankings", "keywords", "competitors", "technical", "backlinks", "ai"] as const) expect(result[moduleId].lastUpdatedAt).toBe(at.toISOString());
  expect(result.local.lastUpdatedAt).toBeNull();
});

it("uses completed crawls and saved monitoring checks, excluding running and failed crawls", async () => {
  await testDb.insert(schema.browserCrawlRuns).values([
    { siteSlug: "a", status: "completed", completedAt: at },
    { siteSlug: "a", status: "failed", completedAt: new Date("2026-09-10T10:00:00Z") },
    { siteSlug: "a", status: "running" },
  ]);
  await testDb.insert(schema.reliabilityChecks).values({ siteSlug: "a", checkedAt: at, available: false });
  const result = await scanModuleFreshness("a");
  expect(result.technical.lastUpdatedAt).toBe(at.toISOString());
  expect(result.reliability.lastUpdatedAt).toBe(at.toISOString());
});

it("keeps legacy local dates honest and uses precise collection times when recorded", async () => {
  const [location] = await testDb.insert(schema.localSeoLocations).values({ siteSlug: "a", name: "Office", businessKeyword: "office" }).returning();
  await testDb.insert(schema.localSeoSnapshots).values({ locationId: location!.id, siteSlug: "a", capturedOn: "2026-09-08", profile: {} });
  expect((await scanModuleFreshness("a")).local).toEqual({ lastUpdatedAt: null, lastUpdatedDate: "2026-09-08" });
  await testDb.insert(schema.localSeoSnapshots).values({ locationId: location!.id, siteSlug: "a", capturedOn: "2026-09-09", profile: { _collectedAt: at.toISOString() } });
  expect((await scanModuleFreshness("a")).local.lastUpdatedAt).toBe(at.toISOString());
});
