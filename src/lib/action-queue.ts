export interface ActionItem {
  id: string;
  kind: "alert" | "recommendation" | "research";
  siteSlug: string | null;
  siteName: string;
  title: string;
  detail: string | null;
  status: string;
  severity: "critical" | "high" | "medium" | "low";
  score: number;
  actionUrl: string | null;
  module?: string;
  duplicateWarning?: { severity?: string; summary?: string; matches?: unknown[] };
  createdAt: string;
}

export interface ActionData {
  items: ActionItem[];
  counts: { critical: number; urgent: number; open: number; paused: number };
  meta: { returned: number; total: number; hasMore: boolean };
  available: boolean;
  synthetic?: boolean;
}

export function isUrgentAction(item: Pick<ActionItem, "severity" | "score">) {
  return item.severity === "critical" || item.score >= 75;
}

export function compareActions(a: ActionItem, b: ActionItem) {
  return Number(b.severity === "critical") - Number(a.severity === "critical")
    || b.score - a.score || Date.parse(b.createdAt) - Date.parse(a.createdAt)
    || a.id.localeCompare(b.id);
}

const modules: Record<string, string> = {
  technical: "/site-audit", "site audit": "/site-audit", rankings: "/rankings",
  content: "/content", backlinks: "/backlinks", settings: "/settings",
  keywords: "/keyword-strategy", competitors: "/competitors",
  "ai visibility": "/ai-visibility", "local seo": "/local-seo",
};
const destinations: Record<string, string> = {
  "/site-audit": "Review audit", "/rankings": "View rankings", "/content": "Review content",
  "/backlinks": "Review backlinks", "/settings": "Open settings", "/keyword-strategy": "Review keywords",
  "/competitors": "View competitors", "/ai-visibility": "Review AI visibility",
  "/local-seo": "Review local SEO", "/monitoring": "Review monitoring",
  "/technical-crawler": "Review crawl", "/recommendations": "Review task", "/notifications": "View alert", "/work": "Continue work", "/domain-research": "Review research",
};

/** Keep each task attached to its own website when opening its working section. */
export function actionDestination(item: ActionItem): { href: string; label: string } {
  const fallback = item.kind === "recommendation" ? "/recommendations" : "/notifications";
  const path = item.actionUrl && item.actionUrl !== "/recommendations"
    ? item.actionUrl
    : (item.kind === "recommendation" && modules[item.module?.toLowerCase() ?? ""]) || item.actionUrl || fallback;
  const url = new URL(path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : fallback, "https://seo-command.local");
  let label = destinations[url.pathname] ?? "Open website";
  if (item.siteSlug) {
    if (url.pathname === "/settings") {
      url.pathname = `/sites/${encodeURIComponent(item.siteSlug)}/settings`;
      label = "Open settings";
    }
    url.searchParams.set("site", item.siteSlug);
  }
  return { href: `${url.pathname}${url.search}${url.hash}`, label };
}

export function actionQueueUrl(scope: string, urgent = false, limit = 150) {
  const params = new URLSearchParams({ scope, limit: String(limit) });
  if (urgent) params.set("priority", "urgent");
  return `/api/action-centre?${params}`;
}
