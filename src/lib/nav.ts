import {
  Activity, Bell, Bot, Building2, FileText, FolderKanban, Gauge, GitCompareArrows,
  Globe2, LayoutDashboard, Link2, ListChecks, ListTodo, MapPinned, Radar, Search, Settings,
  ScanLine, ShieldCheck, Sparkles, Swords, TrendingUp, Trophy, Waypoints, type LucideIcon,
} from "lucide-react";
import { hrefWithScope } from "./site-context";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group?: "global" | "research" | "site";
}

export function navigationHref(item: Pick<NavItem, "href" | "group">, scope: string): string {
  // Research home is deliberately independent; Search performance shares its
  // route but belongs to the selected website.
  if (item.href === "/research" && item.group !== "site") return "/research?workspace=global";
  return hrefWithScope(item.href, scope);
}

export const GLOBAL_NAV: NavItem[] = [
  { href: "/portfolio?scope=portfolio", label: "Portfolio", icon: LayoutDashboard, group: "global" },
  { href: "/sites", label: "Websites", icon: Building2, group: "global" },
  { href: "/action-centre", label: "Work", icon: ListChecks, group: "global" },
  { href: "/research", label: "Research", icon: Search, group: "global" },
  { href: "/reports", label: "Reports", icon: FileText, group: "global" },
  { href: "/settings", label: "Settings", icon: Settings, group: "global" },
];

export const RESEARCH_NAV: NavItem[] = [
  { href: "/research", label: "Research home", icon: Search, group: "research" },
  { href: "/domain-research", label: "Domain research", icon: Globe2, group: "research" },
  { href: "/keyword-research", label: "Keyword research", icon: Waypoints, group: "research" },
  { href: "/keyword-research?view=projects", label: "Research projects", icon: FolderKanban, group: "research" },
];

export const SITE_NAV: NavItem[] = [
  { href: "/portfolio", label: "Overview", icon: Gauge, group: "site" },
  { href: "/research", label: "Search performance", icon: Search, group: "site" },
  { href: "/rankings", label: "Rankings", icon: TrendingUp, group: "site" },
  { href: "/keyword-strategy", label: "Keyword strategy", icon: Waypoints, group: "site" },
  { href: "/competitors", label: "Competitors", icon: Swords, group: "site" },
  { href: "/site-audit", label: "Site audit", icon: ShieldCheck, group: "site" },
  { href: "/content", label: "Content", icon: FileText, group: "site" },
  { href: "/backlinks", label: "Backlinks", icon: Link2, group: "site" },
  { href: "/ai-visibility", label: "AI visibility", icon: Sparkles, group: "site" },
  { href: "/local-seo", label: "Local SEO", icon: MapPinned, group: "site" },
  { href: "/reports", label: "Reports", icon: FileText, group: "site" },
];

export const SCAN_CENTRE: NavItem = { href: "/scan-centre", label: "Scan centre", icon: ScanLine, group: "site" };

export const TECHNICAL_SECONDARY: NavItem[] = [
  { href: "/technical-crawler", label: "Rendered crawler", icon: GitCompareArrows },
  { href: "/monitoring", label: "Monitoring", icon: Radar },
];
export const KEYWORD_SECONDARY: NavItem[] = [{ href: "/keyword-research", label: "Keyword discovery", icon: Search }, { href: "/serp-intelligence", label: "SERP intelligence", icon: Activity }, { href: "/market-intelligence", label: "Market intelligence", icon: Radar }];
export const BACKLINK_SECONDARY: NavItem[] = [{ href: "/link-building", label: "Link building", icon: Activity }];
export const AI_SECONDARY: NavItem[] = [{ href: "/ai-visibility", label: "AI visibility", icon: Bot }];

/** Compatibility exports used by small-screen and legacy surfaces. */
export const NAV_ITEMS: NavItem[] = [...GLOBAL_NAV, ...RESEARCH_NAV.slice(1), SCAN_CENTRE, ...SITE_NAV, ...TECHNICAL_SECONDARY, ...KEYWORD_SECONDARY, ...BACKLINK_SECONDARY];
export const PRIMARY_NAV = SITE_NAV;
export const toolSections: { label: string; icon: LucideIcon; items: NavItem[] }[] = [
  { label: "Performance", icon: TrendingUp, items: [SITE_NAV[0]!, SITE_NAV[1]!, SITE_NAV[2]!] },
  { label: "Opportunities", icon: Search, items: [SITE_NAV[3]!, SITE_NAV[4]!, SITE_NAV[6]!, { href: "/recommendations", label: "Insights", icon: Sparkles, group: "site" }, ...KEYWORD_SECONDARY.slice(1)] },
  { label: "Site health", icon: ShieldCheck, items: [SITE_NAV[5]!, ...TECHNICAL_SECONDARY, SCAN_CENTRE] },
  { label: "Links, AI & local", icon: Globe2, items: [SITE_NAV[7]!, ...BACKLINK_SECONDARY, SITE_NAV[8]!, SITE_NAV[9]!] },
  { label: "Work", icon: ListChecks, items: [
    { href: "/action-centre", label: "Needs attention", icon: ListChecks },
    { href: "/work", label: "In progress", icon: ListTodo },
    { href: "/outcomes", label: "Outcomes", icon: Trophy },
    { href: "/notifications", label: "Notifications", icon: Bell },
  ] },
];
export const NAV_SECTIONS = toolSections;
