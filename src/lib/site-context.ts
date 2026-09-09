/**
 * Routes whose data and mutations belong to one explicitly selected website.
 * The server still requires an explicit website ID. Client navigation carries
 * the user's selected website into these routes before their tools mount.
 */
const SITE_CONTEXT_ROUTES = [
  "/domain",
  "/rankings",
  "/keyword-strategy",
  "/serp-intelligence",
  "/market-intelligence",
  "/competitors",
  "/site-audit",
  "/technical-crawler",
  "/monitoring",
  "/content",
  "/backlinks",
  "/link-building",
  "/local-seo",
  "/recommendations",
  "/scan-centre",
  "/reports/client",
] as const;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "new" ? trimmed : null;
}

export function siteIdFromLocation(
  pathname: string,
  siteQuery?: string | null,
): string | null {
  const match = pathname.match(/^\/sites\/([^/]+)/);
  return clean(match?.[1] ? decodeURIComponent(match[1]) : siteQuery);
}

export function requiresSiteContext(pathname: string): boolean {
  if (/^\/sites\/(?!new(?:\/|$))[^/]+/.test(pathname)) return true;
  return SITE_CONTEXT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/** Explicit destinations win over the remembered selection, including Back/Forward. */
export function scopeFromLocation(pathname: string, params: URLSearchParams, saved: string | null): string {
  const site = siteIdFromLocation(pathname, params.get("site"));
  if (site) return site;
  const scope = params.get("scope");
  if (scope === "portfolio" || scope?.startsWith("group:")) return scope;
  // Existing task/dashboard deep links use ?scope=<website>.
  if (["/portfolio", "/action-centre"].includes(pathname) && clean(scope)) return clean(scope)!;
  return clean(saved) ?? "portfolio";
}

/** Carry context only into tools that support it; shared admin/research stay shared. */
export function hrefWithScope(href: string, scope: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://seo-command.local");
  if (siteIdFromLocation(url.pathname, url.searchParams.get("site")) || url.searchParams.has("scope")) return href;
  if (url.pathname === "/sites/new" || url.searchParams.get("workspace") === "global") return href;
  if (scope === "portfolio") return href;
  if (scope.startsWith("group:")) {
    if (!["/portfolio", "/action-centre"].includes(url.pathname)) return href;
    url.searchParams.set("scope", scope);
  } else {
    if (!requiresSiteContext(url.pathname) && !["/portfolio", "/research", "/reports", "/action-centre", "/ai-visibility"].includes(url.pathname)) return href;
    url.searchParams.set("site", scope);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
