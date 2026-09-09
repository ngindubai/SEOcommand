import { describe, expect, it } from "vitest";
import { actionDestination, compareActions, isUrgentAction, type ActionItem } from "./action-queue";
const base: ActionItem = { id: "task", kind: "recommendation", siteSlug: "website-a", siteName: "Website A", title: "Fix a page", detail: null, status: "approved", severity: "high", score: 90, actionUrl: "/recommendations", createdAt: "2026-01-01" };
describe("task destinations and priority", () => {
  it("takes approved work to its module and affected website", () => {
    expect(actionDestination({ ...base, module: "Site Audit" })).toEqual({ href: "/site-audit?site=website-a", label: "Review audit" });
    expect(actionDestination({ ...base, module: "Settings" }).href).toBe("/sites/website-a/settings?site=website-a");
    expect(actionDestination({ ...base, module: "Unknown" }).href).toBe("/recommendations?site=website-a");
  });
  it("preserves alert details but corrects a stale website scope", () => {
    expect(actionDestination({ ...base, kind: "alert", actionUrl: "/rankings?site=other&filter=losses#keywords" }).href).toBe("/rankings?site=website-a&filter=losses#keywords");
  });
  it("falls back to an internal destination for unexpected links", () => {
    for (const actionUrl of ["https://outside.test", "//outside.test", "javascript:alert(1)"]) {
      expect(actionDestination({ ...base, actionUrl }).href).toBe("/recommendations?site=website-a");
    }
  });
  it("ranks critical alerts above equally scored growth tasks and uses the existing urgent threshold", () => {
    const critical = { ...base, id: "critical", kind: "alert" as const, severity: "critical" as const, score: 100, createdAt: "2025-01-01" };
    expect([{ ...base, score: 100 }, critical].sort(compareActions)[0].id).toBe("critical");
    expect(isUrgentAction({ severity: "medium", score: 75 })).toBe(true);
    expect(isUrgentAction({ severity: "medium", score: 74 })).toBe(false);
  });
});
