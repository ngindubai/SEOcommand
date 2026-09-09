"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Settings2, ScanLine } from "lucide-react";
import { RESEARCH_NAV, navigationHref, toolSections } from "@/lib/nav";
import { navigateSafely } from "@/components/ui/unsaved-changes";
import { useDomain, type RangeKey } from "./domain-context";
import { switchScopeHref } from "@/lib/site-context";
import { cn } from "@/lib/cn";

export function ContextBar() {
  const { activeDomain, activeGroup, scope, setScope, sites, groups, range, setRange } = useDomain();
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  const globalResearch = pathname === "/research" && params.get("workspace") === "global" || pathname.startsWith("/domain-research") || pathname.startsWith("/keyword-research");
  const globalAdmin = pathname === "/settings" || pathname === "/sites" || pathname === "/sites/new";
  const dateAware = ["/portfolio", "/reports/client", "/market-intelligence"].includes(pathname);
  const workPages = ["/action-centre", "/work", "/outcomes", "/notifications"];
  const section = toolSections.find((group) => group.items.some((item) => pathname === item.href.split("?")[0]));
  const links = globalResearch ? RESEARCH_NAV : workPages.includes(pathname) ? toolSections.find((group) => group.label === "Work")!.items : section?.items ?? [];
  if (globalAdmin) return <div className="border-b border-border bg-card px-4 py-3 text-xs text-muted sm:px-6">{pathname === "/settings" ? "Account settings · shared providers, people and access" : "Website management · all websites you can access"}</div>;
  return <div className="border-b border-border bg-card">
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
      {globalResearch ? <><span className="text-sm font-semibold">Research workspace</span><span className="text-xs text-muted">Independent of any website; choose a destination when saving work.</span></> : <>
        <select aria-label="Website or portfolio scope" value={scope} onChange={(event) => { const next = event.target.value; navigateSafely(() => { setScope(next); router.push(switchScopeHref(pathname, new URLSearchParams(params), next)); }); }} className="h-10 min-w-0 max-w-full flex-1 rounded-md border border-border bg-card px-3 text-sm font-semibold sm:max-w-72 sm:flex-none">
          <option value="portfolio">All websites</option>{groups.length > 0 && <optgroup label="Groups">{groups.map((group) => <option key={group.id} value={`group:${group.id}`}>{group.name}</option>)}</optgroup>}<optgroup label="Websites">{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</optgroup>
        </select>
        <span className="hidden text-xs text-muted xl:inline">{activeDomain?.host ?? (activeGroup ? "Group including subgroups" : "Portfolio-wide view")}</span>
        {dateAware && <div className="flex rounded-md border border-border bg-workspace p-0.5" aria-label="Reporting period">{(["7d", "28d", "90d"] as RangeKey[]).map((key) => <button key={key} aria-pressed={range === key} onClick={() => setRange(key)} className={cn("min-h-9 rounded px-3 text-xs", range === key ? "bg-card font-bold text-purple shadow-sm" : "text-muted")}>{parseInt(key)} days</button>)}</div>}
        {activeDomain && <div className="ml-auto flex items-center gap-1"><Link href={`/scan-centre?site=${encodeURIComponent(activeDomain.id)}`} className="hidden min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-muted hover:bg-workspace sm:flex"><ScanLine className="h-4 w-4" />Refresh sources</Link><Link href={`/sites/${encodeURIComponent(activeDomain.id)}/settings`} aria-label="Website settings" className="flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-workspace"><Settings2 className="h-4 w-4" /></Link></div>}
      </>}
    </div>
    {links.length > 0 && <nav aria-label={globalResearch ? "Research tools" : `${section?.label ?? "Work"} tools`} className="flex gap-1 overflow-x-auto px-4 pb-1 sm:px-6">{links.map((item) => <Link key={item.href} href={navigationHref(item, scope)} aria-current={pathname === item.href.split("?")[0] && (item.href.includes("view=projects") ? params.get("view") === "projects" : !params.get("view")) ? "page" : undefined} className="flex min-h-10 shrink-0 items-center rounded-md px-3 text-sm text-muted hover:bg-workspace aria-[current=page]:bg-purple/10 aria-[current=page]:font-semibold aria-[current=page]:text-purple">{item.label}</Link>)}</nav>}
  </div>;
}
