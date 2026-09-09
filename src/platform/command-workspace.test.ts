import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { commandRecords, saveCommandRecord } from "./command-store";
import { processCommandChecks, queueCommandCheck, queueCommandSchedules } from "./command-jobs";
import { collectSpeed } from "./command-collect";
import { POST } from "@/app/api/command/route";
import { canAccessSite, hasPermission } from "./access";

let client: PGlite;
let testDb: ReturnType<typeof drizzle>;
vi.mock("@/db", async () => ({ schema: await import("@/db/schema"), db: () => testDb }));
vi.mock("@/sync/store", () => ({ hasDatabase: () => true }));
vi.mock("@/sync/bundle", () => ({ buildDomainBundle: vi.fn(async (id) => ({ domainId: id, datasets: {}, lastSync: null })), buildPortfolio: vi.fn() }));
vi.mock("@/lib/auth", () => ({ sessionFromRequest: vi.fn(async () => ({ email: "owner@test.local", role: "admin" })) }));
vi.mock("./access", () => ({ canAccessSite: vi.fn(async () => true), hasPermission: vi.fn(async () => true), accessibleSiteSlugs: vi.fn(async () => null) }));
vi.mock("./site-store", () => ({ getManagedSite: vi.fn(async (id) => ({ id, name: id, host: `${id}.test`, lifecycleStatus: "active", spendApproval: "approved", gscSite: `sc-domain:${id}.test` })), resolveGroupSiteSlugs: vi.fn(async () => ["a"]), listManagedSites: vi.fn(async () => []) }));
vi.mock("./command-collect", () => ({ collectSpeed: vi.fn(async (_site, url, device) => ({ url, device, score: 80, testedAt: new Date().toISOString(), field: null })), inspectIndex: vi.fn(), collectBusiness: vi.fn(), checkWatchedPage: vi.fn(async (_site, url) => ({ url, statusCode: 404, indexable: false, hash: "a", capturedAt: new Date().toISOString() })) }));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), after: vi.fn() }));
const request = (body: unknown) => new Request("https://seo.test/api/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeAll(async () => {
  vi.stubEnv("QA_SYNTHETIC", "false");
  client = new PGlite(); testDb = drizzle(client);
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  for (const { tag } of journal.entries) await client.exec(await readFile(`drizzle/${tag}.sql`, "utf8"));
  await testDb.insert(schema.datasetSnapshots).values({ domainSlug: "a", dataset: "existing", capturedOn: "2026-09-01", payload: { clicks: 123 }, provenance: { mode: "live" } });
});
afterAll(async () => { await client.close(); vi.unstubAllEnvs(); });
beforeEach(async () => { await testDb.delete(schema.commandRecords); await testDb.delete(schema.platformJobs); await testDb.delete(schema.notificationDeliveries); await testDb.delete(schema.portfolioNotifications); await testDb.delete(schema.userAccessGrants); await testDb.delete(schema.workspaceUsers); vi.clearAllMocks(); vi.mocked(canAccessSite).mockResolvedValue(true); vi.mocked(hasPermission).mockResolvedValue(true); });

it("preserves unrelated preferences under concurrent updates and existing metric history", async () => {
  await Promise.all([saveCommandRecord("a", "settings", "preferences", { brandTerms: ["Alpha"] }), saveCommandRecord("a", "settings", "preferences", { businessEvents: { enquiry_sent: "enquiry" } })]);
  const records = await commandRecords("a");
  expect(records[0]!.payload).toEqual({ brandTerms: ["Alpha"], businessEvents: { enquiry_sent: "enquiry" } });
  expect((await testDb.select().from(schema.datasetSnapshots))[0]!.payload).toEqual({ clicks: 123 });
});
it("atomically deduplicates repeated test requests and concurrent workers", async () => {
  const [a, b] = await Promise.all([queueCommandCheck("a", "speed", { url: "https://a.test/", device: "mobile" }), queueCommandCheck("a", "speed", { url: "https://a.test/", device: "mobile" })]);
  expect(a.id).toBe(b.id);
  await Promise.all([processCommandChecks(a.id), processCommandChecks(a.id)]);
  expect(collectSpeed).toHaveBeenCalledTimes(1);
  expect((await commandRecords("a"))[0]!.status).toBe("completed");
});
it("recovers an interrupted check without losing its URL or earlier test history", async () => {
  await saveCommandRecord("a", "speed", "old", { url: "https://a.test/", score: 73 }, { status: "completed" });
  const pending = await saveCommandRecord("a", "speed", "interrupted", { url: "https://a.test/", device: "desktop" }, { status: "running" });
  await testDb.update(schema.commandRecords).set({ updatedAt: new Date(Date.now() - 20 * 60000) }).where(eq(schema.commandRecords.id, pending.id));
  await processCommandChecks(pending.id);
  const rows = await commandRecords("a");
  expect(rows.find((row) => row.recordKey === "interrupted")).toMatchObject({ status: "failed", payload: { url: "https://a.test/", device: "desktop" } });
  expect(rows.find((row) => row.recordKey === "old")?.payload.score).toBe(73);
  expect(collectSpeed).not.toHaveBeenCalled();
});
it("rejects foreign URLs and insufficient permissions before creating checks", async () => {
  expect((await POST(request({ action: "speed", site: "a", url: "https://b.test/" }))).status).toBe(400);
  vi.mocked(hasPermission).mockResolvedValue(false);
  expect((await POST(request({ action: "speed", site: "a", url: "/" }))).status).toBe(403);
  expect(await commandRecords("a")).toHaveLength(0);
});
it("validates every site in a bulk plan before saving any of them", async () => {
  vi.mocked(canAccessSite).mockImplementation(async (_request, id) => id === "a");
  const response = await POST(request({ action: "plan_save", sites: ["a", "b"], modules: ["google"], cadence: "weekly", start: new Date(Date.now() + 3600000).toISOString() }));
  expect(response.status).toBe(403); expect(await commandRecords("a")).toHaveLength(0);
});
it("previews cost without writing and saves plans atomically across selected sites", async () => {
  const input = { sites: ["a", "b"], modules: ["backlinks"], cadence: "weekly", start: new Date(Date.now() + 3600000).toISOString() };
  const preview = await POST(request({ ...input, action: "plan_preview" }));
  expect(await preview.json()).toMatchObject({ preview: { perRun: .28, monthlyEstimate: 1.4 } });
  expect(await commandRecords("a")).toHaveLength(0);
  expect((await POST(request({ ...input, action: "plan_save" }))).status).toBe(200);
  expect(await commandRecords("a")).toHaveLength(1); expect(await commandRecords("b")).toHaveLength(1);
});
it("queues each due plan once even when schedulers overlap", async () => {
  await saveCommandRecord("a", "plan", "weekly", { name: "Weekly", modules: ["backlinks"], cadence: "weekly" }, { status: "active", nextRunAt: new Date("2026-01-01") });
  await Promise.all([queueCommandSchedules(), queueCommandSchedules()]);
  const jobs = await testDb.select().from(schema.platformJobs);
  expect(jobs).toHaveLength(1); expect(jobs[0]!.progress.modules).toEqual(["backlinks"]);
  expect((await commandRecords("a"))[0]!.nextRunAt! > new Date().toISOString()).toBe(true);
});
it("pauses future scans after the owner loses permissions", async () => {
  await testDb.insert(schema.workspaceUsers).values({ email: "owner@test.local", name: "Owner", role: "viewer", status: "active" });
  await saveCommandRecord("a", "plan", "weekly", { modules: ["backlinks"], cadence: "weekly" }, { actor: "owner@test.local", status: "active", nextRunAt: new Date("2026-01-01") });
  await queueCommandSchedules();
  expect((await commandRecords("a"))[0]!.status).toBe("paused"); expect(await testDb.select().from(schema.platformJobs)).toHaveLength(0);
});
it("watch alerts stay in-app and preserve previous checks", async () => {
  const row = await queueCommandCheck("a", "watch_run", { url: "https://a.test/booking" });
  await processCommandChecks(row.id);
  expect(await testDb.select().from(schema.portfolioNotifications)).toHaveLength(1);
  expect(await testDb.select().from(schema.notificationDeliveries)).toHaveLength(0);
  expect((await commandRecords("a"))[0]!.status).toBe("completed");
});

it("retains the latest evidence for each tool when another tool has many recent checks", async () => {
  await saveCommandRecord("a", "speed", "old-speed", { score: 73 }, { status: "completed" });
  await saveCommandRecord("a", "business", "old-business", { total: 12 }, { status: "completed" });
  await testDb.insert(schema.commandRecords).values(Array.from({ length: 125 }, (_, i) => ({ siteSlug: "a", kind: "watch_run", recordKey: `watch-${i}`, status: "completed", payload: {}, createdAt: new Date(Date.now() + i) })));
  const records = await commandRecords("a");
  expect(records.filter((row) => row.kind === "watch_run")).toHaveLength(120);
  expect(records.find((row) => row.kind === "speed")?.payload.score).toBe(73);
  expect(records.find((row) => row.kind === "business")?.payload.total).toBe(12);
  expect(await testDb.select().from(schema.commandRecords)).toHaveLength(127);
});
