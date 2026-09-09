import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { POST as ask } from "./ask/route";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { QA_GROUPS } from "@/data/qa-fixtures";
import { resolveGroupSiteSlugs } from "@/platform/site-store";
const group = QA_GROUPS.find((row) => row.slug === "finance")!;
beforeAll(() => { vi.stubEnv("QA_SYNTHETIC", "true"); vi.stubEnv("AUTH_SECRET", "command-access-test-secret"); });
afterAll(() => vi.unstubAllEnvs());
async function request(path: string, body?: unknown) {
  const token = await createSessionToken({ email: "viewer@test.local", name: "Viewer", role: "viewer", groupIds: [group.id], siteIds: [], allAccess: false, grants: [] }, process.env.AUTH_SECRET!);
  return new Request(`https://seo.test${path}`, { method: body ? "POST" : "GET", headers: { cookie: `${SESSION_COOKIE}=${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
it("filters portfolio evidence and Ask answers to accessible websites", async () => {
  const allowed = await resolveGroupSiteSlugs(group.id);
  const response = await GET(await request("/api/command?scope=portfolio"));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.sites.length).toBeGreaterThan(0);
  expect(data.sites.every((site: { id: string }) => allowed.includes(site.id))).toBe(true);
  const answer = await ask(await request("/api/command/ask", { scope: "portfolio", question: "How are my websites ranking?" }));
  expect(answer.status).toBe(200);
  for (const item of (await answer.json()).evidence) expect(allowed).toContain(new URL(item.href, "https://seo.test").searchParams.get("site"));
});
it("rejects out-of-scope website evidence and viewer mutations", async () => {
  expect((await GET(await request("/api/command?site=busrentalglobal"))).status).toBe(403);
  expect((await ask(await request("/api/command/ask", { scope: "busrentalglobal", question: "How many clicks?" }))).status).toBe(403);
  expect((await POST(await request("/api/command", { action: "speed", site: "mortgagecompare", url: "/" }))).status).toBe(403);
});
