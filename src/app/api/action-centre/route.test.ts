import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createSessionToken, SESSION_COOKIE, type AppRole } from "@/lib/auth";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { hasDatabase } from "@/sync/store";
import { GET } from "./route";
import type { ActionData } from "@/lib/action-queue";

let client: PGlite;
let testDb: ReturnType<typeof drizzle>;
vi.mock("@/db", async () => ({ schema: await import("@/db/schema"), db: () => testDb }));
vi.mock("@/sync/store", () => ({ hasDatabase: vi.fn(() => true) }));
vi.mock("@/platform/site-store", () => ({
  listManagedSites: async () => [{ id: "a", name: "Website A", lifecycleStatus: "active" }, { id: "b", name: "Website B", lifecycleStatus: "active" }],
  resolveGroupSiteSlugs: async (id: string) => id === "group-a" ? ["a"] : id === "group-b" ? ["b"] : [],
}));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const notice = (n: number, extra: Partial<typeof schema.portfolioNotifications.$inferInsert> = {}) => ({ id: id(n), siteSlug: "a", eventType: "test", severity: "low" as const, title: `Alert ${n}`, fingerprint: `alert-${n}`, status: "open", actionUrl: "/site-audit", createdAt: new Date("2025-01-01"), ...extra });
const task = (n: number, extra: Partial<typeof schema.workflowItems.$inferInsert> = {}) => ({ id: id(n), domainSlug: "a", recommendationKey: `task-${n}`, decision: "approved", title: `Task ${n}`, module: "Content", effort: "M", priorityScore: 100, status: "approved", updatedAt: new Date("2026-01-01"), ...extra });
async function read(query: string, role = "admin", groups = "") {
  const token = role ? await createSessionToken({ email: "reader@seo.test", name: "Reader", role: role as AppRole, groupIds: groups.split(",").filter(Boolean), siteIds: [], allAccess: false, grants: [] }, process.env.AUTH_SECRET!) : null;
  const response = await GET(new Request(`https://seo.test/api/action-centre?${query}`, { headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {} }));
  expect(response.status).toBe(200);
  return response.json() as Promise<ActionData>;
}

beforeAll(async () => {
  vi.stubEnv("QA_SYNTHETIC", "false");
  vi.stubEnv("AUTH_SECRET", "seo-queue-integration-test-secret");
  client = new PGlite();
  testDb = drizzle(client);
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
  for (const { tag } of journal.entries) {
    await client.exec(await readFile(`drizzle/${tag}.sql`, "utf8"));
  }

});
afterAll(async () => { await client.close(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  vi.mocked(hasDatabase).mockReturnValue(true);
  await testDb.delete(schema.researchMappings);
  await testDb.delete(schema.researchEvidence);
  await testDb.delete(schema.portfolioNotifications);
  await testDb.delete(schema.workflowItems);
  await testDb.insert(schema.portfolioNotifications).values([
    ...Array.from({ length: 160 }, (_, i) => notice(i + 10, { status: "resolved", createdAt: new Date("2026-08-01") })),
    notice(1, { severity: "critical" }), notice(2, { severity: "high" }), notice(3),
    notice(4, { severity: "critical", status: "snoozed", snoozedUntil: new Date("2099-01-01") }),
    notice(5, { severity: "high", status: "snoozed", snoozedUntil: new Date("2020-01-01") }),
    notice(6, { severity: "critical", siteSlug: "b" }),
  ]);
  await testDb.insert(schema.workflowItems).values([
    task(201), task(202, { status: "done" }), task(203, { decision: "dismissed", status: null }),
    task(204, { priorityScore: 70 }), task(205, { priorityScore: 82, status: null }),
    task(206, { domainSlug: "b" }),
  ]);
});

describe("priority task read model", () => {
  it("finds old critical alerts before limiting and returns exact scoped counts", async () => {
    const data = await read("scope=a&priority=urgent&limit=2");
    expect(data.counts).toEqual({ critical: 1, urgent: 5, open: 7, paused: 0 });
    expect(data.items.map((item) => item.id)).toEqual([id(1), id(201)]);
    expect(data.meta).toEqual({ returned: 2, total: 5, hasMore: true });
    expect(data.items[0].actionUrl).toBe("/site-audit?site=a");
    expect(data.items[1].actionUrl).toBe(`/recommendations?item=${id(201)}&site=a`);
  });
  it("omits completed, dismissed and still-snoozed work while restoring expired snoozes", async () => {
    const data = await read("scope=a");
    expect(data.items.map((item) => item.id).sort()).toEqual([1, 2, 3, 5, 201, 204, 205].map(id).sort());
  });
  it("intersects requested websites and groups with the caller's access", async () => {
    const group = await read("scope=group%3Agroup-a", "viewer", "group-a");
    expect(group.items.length).toBe(7);
    expect(group.items.every((item) => item.siteSlug === "a")).toBe(true);
    expect((await read("scope=b", "viewer", "group-a")).items).toEqual([]);
    expect((await read("scope=group%3Agroup-b", "viewer", "group-a")).counts.open).toBe(0);
    expect((await read("scope=portfolio", "", "")).items).toEqual([]);
  });
  it("reflects resolution and completion on the next saved-data read", async () => {
    await testDb.update(schema.portfolioNotifications).set({ status: "resolved" }).where(eq(schema.portfolioNotifications.id, id(1)));
    await testDb.update(schema.workflowItems).set({ status: "done" }).where(eq(schema.workflowItems.id, id(201)));
    const data = await read("scope=a&priority=urgent");
    expect(data.counts).toMatchObject({ critical: 0, urgent: 3, open: 5 });
    expect(data.items.map((item) => item.id)).not.toContain(id(201));
  });
  it("distinguishes missing task storage from a clear queue", async () => {
    vi.mocked(hasDatabase).mockReturnValue(false);
    expect(await read("scope=a")).toMatchObject({ available: false, items: [] });
  });
  it("keeps mapped research and outcome-adjusted work in the scoped priority queue without changing saved records", async () => {
    await testDb.insert(schema.workflowItems).values([
      ...[301, 302, 303].map((n) => task(n, { status: "done", executionType: "content_brief", verification: { outcome: "won" } })),
      task(304, { priorityScore: 70, executionType: "content_brief", sourceUrl: "/content?site=a" }),
    ]);
    await testDb.insert(schema.researchEvidence).values({ id: id(401), kind: "domain", title: "Saved evidence", sourceValue: "competitor.test", locationCode: 2840, languageCode: "en", locationLabel: "United States" });
    await testDb.insert(schema.researchMappings).values({ id: id(402), evidenceId: id(401), siteSlug: "a", title: "Existing research", priorityScore: 90, duplicateWarning: { severity: "warning", summary: "Check existing page" } });
    const before = await client.query("select 'notices' as kind, to_jsonb(t) as data from portfolio_notifications t union all select 'work', to_jsonb(t) from workflow_items t union all select 'research', to_jsonb(t) from research_mappings t union all select 'evidence', to_jsonb(t) from research_evidence t order by kind, data");
    const queue = await read("scope=a&priority=urgent&limit=250");
    expect(queue.counts).toMatchObject({ urgent: 7, open: 9 });
    expect(queue.items.find((item) => item.id === id(304))).toMatchObject({ score: 80, actionUrl: `/work?item=${id(304)}&site=a` });
    expect(queue.items.find((item) => item.id === id(402))).toMatchObject({ kind: "research", duplicateWarning: { severity: "warning" }, actionUrl: `/domain-research?evidence=${id(401)}&mapping=${id(402)}&site=a` });
    expect((await read("scope=a&priority=urgent&limit=1")).counts).toEqual(queue.counts);
    const after = await client.query("select 'notices' as kind, to_jsonb(t) as data from portfolio_notifications t union all select 'work', to_jsonb(t) from workflow_items t union all select 'research', to_jsonb(t) from research_mappings t union all select 'evidence', to_jsonb(t) from research_evidence t order by kind, data");
    expect(after.rows).toEqual(before.rows);
  });

});

it("groups repeated incidents without changing their stored historical events", async () => {
  await testDb.insert(schema.portfolioNotifications).values([
    notice(601, { eventType: "site_unavailable", title: "Website unavailable", fingerprint: "a:site_unavailable:old", severity: "critical" }),
    notice(602, { eventType: "site_unavailable", title: "Website unavailable again", fingerprint: "a:site_unavailable:new", severity: "critical", createdAt: new Date("2026-09-01") }),
  ]);
  const data = await read("scope=a&kind=alerts");
  expect(data.items.filter((item) => [id(601), id(602)].includes(item.id)).map((item) => item.id)).toEqual([id(602)]);
  expect(data.items.find((item) => item.id === id(602))?.detail).toContain("2 related events");
  expect(await testDb.select().from(schema.portfolioNotifications).where(eq(schema.portfolioNotifications.eventType, "site_unavailable"))).toHaveLength(2);
});
it("paginates a filtered queue without skipping items or changing total counts", async () => {
  const first = await read("scope=a&kind=alerts&limit=2&offset=0");
  const second = await read("scope=a&kind=alerts&limit=2&offset=2");
  expect(first.meta.total).toBe(4);
  expect(second.meta.total).toBe(4);
  expect(first.meta.hasMore).toBe(true);
  expect(second.meta.hasMore).toBe(false);
  expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(4);
});
