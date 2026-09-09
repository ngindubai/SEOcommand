import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { processPlatformJobs } from "./jobs";
import { POST, PATCH } from "@/app/api/scan-centre/route";
import { after } from "next/server";
import { runQueuedScan } from "./run-scan";
import { getManagedSite } from "./site-store";

let client: PGlite;
let testDb: ReturnType<typeof drizzle>;
vi.mock("@/db", async () => ({ schema: await import("@/db/schema"), db: () => testDb }));
vi.mock("./advanced-crawler", () => ({ queueBrowserCrawl: vi.fn() }));
vi.mock("./reliability", () => ({ checkReliability: vi.fn() }));
vi.mock("./site-store", () => ({ getManagedSite: vi.fn(async () => ({ id: "a", name: "A", spendApproval: "approved" })) }));
vi.mock("./run-scan", () => ({ runQueuedScan: vi.fn() }));
vi.mock("@/platform/access", () => ({ canAccessSite: vi.fn(async () => true), hasPermission: vi.fn(async () => true) }));
vi.mock("@/sync/store", () => ({ hasDatabase: () => true }));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), after: vi.fn() }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = new Date("2026-09-10T00:00:00Z");
const report = (results: Array<{ dataset: string; status: "ok" | "error" | "skipped"; note?: string }> = [{ dataset: "backlinks", status: "ok" }]) => ({ domainId: "a", startedAt: now.toISOString(), completedAt: now.toISOString(), results });
const job = (n: number, extra: Partial<typeof schema.platformJobs.$inferInsert> = {}) => ({ id: id(n), siteSlug: "a", kind: "site_scan", status: "queued", runAfter: new Date("2026-09-01"), progress: { modules: ["backlinks"] }, ...extra });
async function saved(n: number) { return (await testDb.select().from(schema.platformJobs).where(eq(schema.platformJobs.id, id(n))))[0]!; }
const request = (body: unknown) => new Request("https://seo.test/api/scan-centre", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

beforeAll(async () => {
  vi.stubEnv("QA_SYNTHETIC", "false");
  client = new PGlite(); testDb = drizzle(client);
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  for (const { tag } of journal.entries) await client.exec(await readFile(`drizzle/${tag}.sql`, "utf8"));
});
afterAll(async () => { await client.close(); vi.unstubAllEnvs(); });
beforeEach(async () => { await testDb.delete(schema.platformJobs); await testDb.delete(schema.accessAuditEvents); vi.clearAllMocks(); });

it("runs only the requested saved job and its selected provider modules", async () => {
  await testDb.insert(schema.platformJobs).values([job(1), job(2, { siteSlug: "b" })]);
  const sync = vi.fn(async () => report());
  expect(await processPlatformJobs(sync, now, id(1))).toMatchObject({ completed: 1 });
  expect(sync).toHaveBeenCalledWith("a", expect.objectContaining({ dfsLight: true, dfsLightModules: ["backlinks"], rankings: false, google: false }));
  expect((await saved(1)).status).toBe("completed");
  expect((await saved(2)).status).toBe("queued");
});
it("atomically claims a job so overlapping runners cannot duplicate provider calls", async () => {
  await testDb.insert(schema.platformJobs).values(job(1));
  const sync = vi.fn(async () => report());
  await Promise.all([processPlatformJobs(sync, now, id(1)), processPlatformJobs(sync, now, id(1))]);
  expect(sync).toHaveBeenCalledTimes(1);
  expect((await saved(1)).attempts).toBe(1);
});
it("does not overwrite cancellation when an in-flight provider response completes", async () => {
  await testDb.insert(schema.platformJobs).values(job(1));
  await processPlatformJobs(async () => { await testDb.update(schema.platformJobs).set({ status: "cancelled" }).where(eq(schema.platformJobs.id, id(1))); return report(); }, now, id(1));
  expect((await saved(1)).status).toBe("cancelled");
});
it("keeps partial dataset evidence and stops automatic retries for payment failures", async () => {
  await testDb.insert(schema.platformJobs).values(job(1));
  await processPlatformJobs(async () => report([{ dataset: "backlinks", status: "ok" }, { dataset: "referring_domains", status: "error", note: "Payment Required." }]), now, id(1));
  const row = await saved(1);
  expect(row.status).toBe("failed"); expect(row.lastError).toContain("Payment Required");
  expect(row.progress.datasets).toHaveLength(2);
});
it("does not report a budget-blocked scan as successfully completed", async () => {
  await testDb.insert(schema.platformJobs).values(job(1));
  await processPlatformJobs(async () => report([{ dataset: "backlinks", status: "skipped", note: "monthly budget guardrail reached" }]), now, id(1));
  expect((await saved(1)).status).toBe("failed");
});
it("starts a newly persisted manual scan after the response, without calling the provider during the request", async () => {
  const response = await POST(request({ siteSlug: "a", modules: ["backlinks"] }));
  expect(response.status).toBe(202); expect(after).toHaveBeenCalledTimes(1); expect(runQueuedScan).not.toHaveBeenCalled();
  const body = await response.json(); expect(body.job.runAfter).toBeTruthy();
  const callback = vi.mocked(after).mock.calls[0]![0]; if (typeof callback === "function") await callback();
  expect(runQueuedScan).toHaveBeenCalledWith(body.job.id);
});
it("starts an existing queued scan but rejects starting an already running scan", async () => {
  await testDb.insert(schema.platformJobs).values([job(1), job(2, { status: "running" })]);
  expect((await PATCH(request({ jobId: id(1), action: "start" }))).status).toBe(200);
  expect((await PATCH(request({ jobId: id(2), action: "start" }))).status).toBe(409);
  expect(after).toHaveBeenCalledTimes(1);
});
it("preserves the paid-scan approval check for queued work", async () => {
  await testDb.insert(schema.platformJobs).values(job(1));
  vi.mocked(getManagedSite).mockResolvedValueOnce({ id: "a", spendApproval: "pending" } as Awaited<ReturnType<typeof getManagedSite>>);
  expect((await PATCH(request({ jobId: id(1), action: "start" }))).status).toBe(409);
  expect(after).not.toHaveBeenCalled(); expect((await saved(1)).status).toBe("queued");
});
it("keeps the browser image version aligned with the locked Playwright runtime", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
  const docker = await readFile("Dockerfile.operations", "utf8");
  expect(docker).toContain(`playwright:v${packageJson.dependencies.playwright}-noble`);
  expect(lock.packages["node_modules/playwright"].version).toBe(packageJson.dependencies.playwright);
  expect(docker).toContain("RUN node scripts/check-browser-runtime.mjs");
});

it("recovers interrupted scans as reviewable failures without repeating paid work", async () => {
  await testDb.insert(schema.platformJobs).values(job(1, { status: "running", startedAt: new Date(now.getTime() - 31 * 60_000), progress: { modules: ["backlinks"], datasets: [{ dataset: "backlinks", status: "ok" }] } }));
  const sync = vi.fn(async () => report());
  await processPlatformJobs(sync, now, id(1));
  expect(sync).not.toHaveBeenCalled(); expect((await saved(1)).status).toBe("failed");
  expect((await saved(1)).progress.datasets).toHaveLength(1);
});
