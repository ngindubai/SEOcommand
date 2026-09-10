import { describe, expect, it } from "vitest";
import { hrefWithScope, requiresSiteContext, scopeFromLocation, siteIdFromLocation } from "./site-context";
import { navigationHref } from "./nav";

describe("explicit website context", () => {
  it("resolves route and query website identifiers without a fallback", () => {
    expect(siteIdFromLocation("/sites/pettransportglobal/settings", null)).toBe(
      "pettransportglobal",
    );
    expect(siteIdFromLocation("/link-building", "busrentalglobal")).toBe(
      "busrentalglobal",
    );
    expect(siteIdFromLocation("/link-building", null)).toBeNull();
    expect(siteIdFromLocation("/research", null)).toBeNull();
  });

  it("separates global workspaces from website tools", () => {
    expect(requiresSiteContext("/link-building")).toBe(true);
    expect(requiresSiteContext("/monitoring")).toBe(true);
    expect(requiresSiteContext("/serp-intelligence")).toBe(true);
    expect(requiresSiteContext("/market-intelligence")).toBe(true);
    expect(requiresSiteContext("/reports/client")).toBe(true);
    expect(requiresSiteContext("/sites/pettransportglobal")).toBe(true);
    expect(requiresSiteContext("/research")).toBe(false);
    expect(requiresSiteContext("/keyword-research")).toBe(false);
    expect(requiresSiteContext("/portfolio")).toBe(false);
  });
});

describe("persistent website navigation", () => {
  function visit(href: string, saved: string | null) {
    const url = new URL(href, "https://seo-command.local");
    const scope = scopeFromLocation(url.pathname, url.searchParams, saved);
    return { scope, href: hrefWithScope(href, scope) };
  }

  it("keeps a website through tools, dashboard, tasks, reports and refresh", () => {
    let current = visit("/sites/alpha", null);
    for (const destination of ["/rankings", "/portfolio", "/action-centre", "/reports", "/ai-visibility", "/keyword-research", "/domain-research", "/questions"]) {
      current = visit(destination, current.scope);
      expect(current).toEqual({ scope: "alpha", href: `${destination}?site=alpha` });
      expect(visit(current.href, null)).toEqual(current);
    }
  });

  it("retains selection when visiting shared pages and independent research", () => {
    for (const destination of ["/settings#connections", "/sites", "/keyword-research?view=projects&workspace=global", "/research?workspace=global"]) {
      const current = visit(destination, "alpha");
      expect(current).toEqual({ scope: "alpha", href: destination });
      expect(visit("/backlinks", current.scope).href).toBe("/backlinks?site=alpha");
    }
  });

  it("switches sites using explicit URLs, including browser history", () => {
    expect(visit("/sites/beta/settings?site=alpha", "alpha").scope).toBe("beta");
    expect(visit("/rankings?site=beta", "alpha").scope).toBe("beta");
    expect(visit("/rankings?site=alpha", "beta").scope).toBe("alpha");
    expect(visit("/action-centre?scope=beta&priority=urgent", "alpha").scope).toBe("beta");
    expect(visit("/portfolio?scope=beta", "alpha").scope).toBe("beta");
    // Never substitute the saved website for an unavailable explicit one.
    expect(visit("/rankings?site=unavailable", "alpha").scope).toBe("unavailable");
  });

  it("returns to all websites only when explicitly selected", () => {
    const current = visit("/portfolio?scope=portfolio", "alpha");
    expect(current.scope).toBe("portfolio");
    expect(visit("/reports", current.scope)).toEqual({ scope: "portfolio", href: "/reports" });
    expect(visit("/rankings", null)).toEqual({ scope: "portfolio", href: "/rankings" });
  });

  it("keeps folder reports scoped without treating a folder as a website", () => {
    const current = visit("/portfolio?scope=group%3Aclients", "alpha");
    expect(current.scope).toBe("group:clients");
    expect(visit("/action-centre", current.scope).href).toBe("/action-centre?scope=group%3Aclients");
    expect(visit("/rankings", current.scope).href).toBe("/rankings");
  });

  it("preserves existing filters, anchors, destinations and external links", () => {
    expect(hrefWithScope("/rankings?view=changes&device=mobile#history", "alpha")).toBe("/rankings?view=changes&device=mobile&site=alpha#history");
    expect(hrefWithScope("/sites/beta/settings", "alpha")).toBe("/sites/beta/settings");
    expect(hrefWithScope("/sites/new", "alpha")).toBe("/sites/new");
    expect(hrefWithScope("https://example.com/portfolio", "alpha")).toBe("https://example.com/portfolio");
    expect(hrefWithScope("//example.com/portfolio", "alpha")).toBe("//example.com/portfolio");
    expect(hrefWithScope("/rankings", "site with spaces")).toBe("/rankings?site=site+with+spaces");
  });

  it("uses consistent desktop, mobile and search destinations", () => {
    expect(navigationHref({ href: "/reports", group: "global" }, "alpha")).toBe("/reports?site=alpha");
    expect(navigationHref({ href: "/research", group: "site" }, "alpha")).toBe("/research?site=alpha");
    expect(navigationHref({ href: "/research", group: "global" }, "alpha")).toBe("/research?workspace=global");
    expect(navigationHref({ href: "/research", group: "research" }, "alpha")).toBe("/research?workspace=global");
  });
});
