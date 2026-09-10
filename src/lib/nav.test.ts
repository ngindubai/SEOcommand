import { describe, expect, it } from "vitest";
import { activeNavigationItem, navigationHref, searchFeatures, SITE_NAV, WORKSPACE_SECTIONS, workspaceSection } from "./nav";

describe("website workspace navigation", () => {
  it("keeps site and reporting period on feature and research links", () => {
    for (const href of ["/questions", "/keyword-research", "/domain-research", "/health?view=speed", "/backlinks?feature=recovery#research"]) {
      const url = new URL(navigationHref({ href, group: "site" }, "alpha", "90d"), "https://example.test");
      expect(url.searchParams.get("site")).toBe("alpha");
      expect(url.searchParams.get("range")).toBe("90d");
      if (href.includes("feature=")) expect(url.hash).toBe("#research");
    }
    expect(navigationHref({ href: "/portfolio?scope=portfolio" }, "alpha", "90d")).not.toContain("site=");
  });
  it("assigns legacy routes to one of the visible sections", () => {
    const destinations = [["/research", "performance"], ["/performance", "performance"], ["/questions", "research"], ["/keyword-research", "research"], ["/domain-research", "research"], ["/content", "content"], ["/pages", "content"], ["/technical-crawler", "health"], ["/link-building", "backlinks"], ["/outcomes", "tasks"]];
    for (const [path, section] of destinations) expect(workspaceSection(path!)?.id).toBe(section);
    expect(workspaceSection("/research", new URLSearchParams("workspace=global"))?.id).toBe("research");
    expect(SITE_NAV).toHaveLength(8);
  });
  it("selects the exact feature rather than every tab sharing a route", () => {
    const health = WORKSPACE_SECTIONS.find((section) => section.id === "health")!.items;
    expect(activeNavigationItem(health, "/health", new URLSearchParams())?.label).toBe("Issues & data health");
    expect(activeNavigationItem(health, "/health", new URLSearchParams("view=speed"))?.label).toBe("Speed tests");
    const links = WORKSPACE_SECTIONS.find((section) => section.id === "backlinks")!.items;
    expect(activeNavigationItem(links, "/backlinks", new URLSearchParams("feature=recovery"), "#research")?.label).toBe("Broken-page recovery");
  });
  it("finds features by everyday names and opens their exact view", () => {
    expect(searchFeatures("broken backlinks")[0]?.href).toBe("/backlinks?feature=recovery#research");
    expect(searchFeatures("speed")[0]?.href).toBe("/health?view=speed");
    expect(searchFeatures("customer reviews")[0]?.href).toBe("/local-seo?feature=reviews#research");
    expect(searchFeatures("people also ask")[0]?.href).toBe("/questions");
  });
});
