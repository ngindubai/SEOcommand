import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { POST as editor } from "./content-editor/route";
import { POST as topic } from "./topic-plans/route";
import { POST as business } from "./business-management/route";
import { POST as archive } from "./reports/archive/route";
import { GET as shared } from "./reports/shared/[token]/route";
import { shareReport, processReportArchives } from "@/reports/archive";
import { canAccessSite, hasPermission } from "@/platform/access";
import { sendMail } from "@/providers/google/mail";
import { businessRequest } from "@/providers/google/business";
const browserMocks = vi.hoisted(() => ({ pdf: vi.fn(async () => Buffer.from("%PDF-1.4 test")) }));
vi.mock("playwright", () => ({ chromium: { executablePath: () => process.execPath, launch: async () => ({ close: async () => {}, newPage: async () => ({ route: async () => {}, setContent: async () => {}, pdf: browserMocks.pdf }) }) } }));
let client: PGlite, testDb: ReturnType<typeof drizzle>;
vi.mock("@/db", async () => ({ schema: await import("@/db/schema"), db: () => testDb }));
vi.mock("@/sync/store", () => ({ hasDatabase: () => true, readLatestSnapshots: async () => [] }));
vi.mock("@/lib/auth", () => ({ sessionFromRequest: async () => ({ email: "owner@test.local", role: "admin" }) }));
vi.mock("@/platform/access", () => ({ canAccessSite: vi.fn(async () => true), hasPermission: vi.fn(async () => true) }));
vi.mock("@/platform/site-store", () => ({ getManagedSite: async (id: string) => ({ id, host: `${id}.test` }) }));
vi.mock("@/platform/command-read", () => ({ buildSiteCommand: vi.fn() }));
vi.mock("@/providers/google/mail", () => ({ mailConfigured: () => true, sendMail: vi.fn(async () => ({ id: "message-id" })) }));
vi.mock("@/providers/google/business", () => ({ businessConfigured: () => true, businessRequest: vi.fn(), compareListing: vi.fn() }));
const req = (body: unknown) => new Request("https://seo.test/api/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeAll(async () => { vi.stubEnv("QA_SYNTHETIC", "false"); client = new PGlite(); testDb = drizzle(client); const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")); for (const { tag } of journal.entries) await client.exec(await readFile(`drizzle/${tag}.sql`, "utf8")); });
afterAll(async () => { await client.close(); vi.unstubAllEnvs(); });
beforeEach(async () => { await testDb.delete(schema.commandRecords); await testDb.delete(schema.workflowItems); await testDb.delete(schema.localSeoLocations); vi.clearAllMocks(); vi.mocked(canAccessSite).mockResolvedValue(true); vi.mocked(hasPermission).mockResolvedValue(true); });
it("saves editor text without changing brief evidence and rejects stale edits", async () => {
 const [item] = await testDb.insert(schema.workflowItems).values({ domainSlug: "a", recommendationKey: "test", decision: "approved", title: "Draft", module: "Content", effort: "medium", priorityScore: 50, executionType: "content_brief", executionData: { brief: { primaryKeyword: "existing" }, earlierEvidence: [1, 2] } }).returning();
 const response = await editor(req({ action: "save", id: item!.id, revision: null, text: "# New draft" })); expect(response.status).toBe(200);
 const [saved] = await testDb.select().from(schema.workflowItems); expect(saved!.executionData).toMatchObject({ brief: { primaryKeyword: "existing" }, earlierEvidence: [1, 2], editor: { text: "# New draft" } });
 expect((await editor(req({ action: "save", id: item!.id, revision: null, text: "Stale overwrite" }))).status).toBe(409);
 vi.mocked(canAccessSite).mockResolvedValue(false); expect((await editor(req({ action: "save", id: item!.id, revision: null, text: "Foreign" }))).status).toBe(404);
});
it("keeps topic page assignments on the selected website and guards concurrent edits", async () => {
 const input = { site: "a", label: "Topic", keywords: ["topic"], targetUrl: "https://other.test/page" };
 expect((await topic(req(input))).status).toBe(400); expect((await topic(req({ ...input, targetUrl: "/guide" }))).status).toBe(200);
 const [saved] = await testDb.select().from(schema.commandRecords);
 expect((await topic(req({ ...input, targetUrl: "/new", id: saved!.recordKey, updatedAt: new Date(0).toISOString() }))).status).toBe(409);
 expect((await testDb.select().from(schema.commandRecords))[0]!.payload.targetUrl).toBe("https://a.test/guide");
});
it("requires business ownership and rejects active-content URLs before external changes", async () => {
 const [place] = await testDb.insert(schema.localSeoLocations).values({ siteSlug: "a", name: "Our business", businessKeyword: "business", placeId: "expected" }).returning();
 expect((await business(req({ action: "listing", site: "a", businessId: place!.id, sourceUrl: "javascript:alert(1)", observed: { name: "a", phone: "1", address: "x" } }))).status).toBe(400);
 expect((await business(req({ action: "connect", site: "b", businessId: place!.id, account: "accounts/1", location: "locations/1" }))).status).toBe(400);
 expect(businessRequest).not.toHaveBeenCalled();
 vi.mocked(businessRequest).mockResolvedValue({ metadata: { placeId: "different" } });
 expect((await business(req({ action: "connect", site: "a", businessId: place!.id, account: "accounts/1", location: "locations/1" }))).status).toBe(400);
 expect(await testDb.select().from(schema.commandRecords)).toHaveLength(0);
});
it("shares only the exact saved report and makes revocation immediate", async () => {
 const [report] = await testDb.insert(schema.commandRecords).values({ siteSlug: "a", kind: "workspace_report", recordKey: "report", status: "ready", payload: { html: "<h1>Saved report</h1>", pdf: "JVBERi0=" } }).returning();
 const share = await shareReport("a", report!.id, "owner");
 const response = await shared(new Request("https://seo.test"), { params: Promise.resolve({ token: share.token }) }); expect(response.status).toBe(200); expect(await response.text()).toContain("Saved report"); expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
 expect((await archive(req({ action: "revoke", site: "b", id: report!.id }))).status).toBe(400);
 expect((await archive(req({ action: "revoke", site: "a", id: report!.id }))).status).toBe(200);
 expect((await shared(new Request("https://seo.test"), { params: Promise.resolve({ token: share.token }) })).status).toBe(404);
});
it("deduplicates report delivery and blocks sending without report permissions", async () => {
 const [report] = await testDb.insert(schema.commandRecords).values({ siteSlug: "a", kind: "workspace_report", recordKey: "report", status: "ready", payload: { html: "Report", pdf: "JVBERi0=" } }).returning();
 const body = { action: "email", site: "a", id: report!.id, recipients: ["recipient@test.local"] };
 vi.mocked(hasPermission).mockResolvedValue(false); expect((await archive(req(body))).status).toBe(403); expect(sendMail).not.toHaveBeenCalled(); vi.mocked(hasPermission).mockResolvedValue(true);
 const responses = await Promise.all([archive(req(body)), archive(req(body))]); expect(responses.map((r) => r.status).sort()).toEqual([200, 400]); expect(sendMail).toHaveBeenCalledTimes(1);
 const [saved] = await testDb.select().from(schema.commandRecords).where(eq(schema.commandRecords.id, report!.id)); expect(saved!.payload.pdf).toBe("JVBERi0=");
});

it("renders a queued immutable report once across overlapping browser workers", async () => {
 const [report] = await testDb.insert(schema.commandRecords).values({ siteSlug: "a", kind: "workspace_report", recordKey: "queued", status: "queued", payload: { html: "<h1>Original saved snapshot</h1>", generatedAt: "2026-09-01" } }).returning();
 await Promise.all([processReportArchives(), processReportArchives()]);
 const [saved] = await testDb.select().from(schema.commandRecords).where(eq(schema.commandRecords.id, report!.id));
 expect(saved!.status).toBe("ready"); expect(saved!.payload.html).toBe("<h1>Original saved snapshot</h1>"); expect(saved!.payload.generatedAt).toBe("2026-09-01"); expect(browserMocks.pdf).toHaveBeenCalledTimes(1);
});
