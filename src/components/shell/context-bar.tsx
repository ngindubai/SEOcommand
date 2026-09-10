"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Settings2 } from "lucide-react";
import { RESEARCH_NAV, activeNavigationItem, navigationHref, workspaceSection } from "@/lib/nav";
import { useDomain, type RangeKey } from "./domain-context";
import { ScopePicker } from "./scope-picker";
import { cn } from "@/lib/cn";

export function ContextBar() {
  const { activeDomain, activeGroup, scope, range, setRange } = useDomain();
  const pathname = usePathname(), params = useSearchParams();
  const [hash, setHash] = useState("");
  useEffect(() => { const sync = () => setHash(window.location.hash); sync(); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync); }, [pathname, params]);
  const section = workspaceSection(pathname, new URLSearchParams(params));
  const globalResearch = !activeDomain && section?.id === "research";
  const globalAdmin = ["/settings", "/sites", "/sites/new"].includes(pathname);
  const links = globalResearch ? RESEARCH_NAV : section?.items ?? [];
  const selected = activeNavigationItem(links, pathname, new URLSearchParams(params), hash);
  const dateAware = ["/portfolio", "/reports/client", "/market-intelligence", "/performance"].includes(pathname);
  if (globalAdmin) return <div className="border-b border-border bg-card px-4 py-3 text-xs text-muted sm:px-6">{pathname === "/settings" ? "Account settings · providers, people and access" : "Website management · all websites you can access"}</div>;
  return <div className="border-b border-border bg-card">
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
      <div className="min-w-0 flex-1 lg:hidden"><ScopePicker /></div>
      <div className="hidden min-w-0 lg:block"><p className="truncate text-sm font-bold text-ink">{activeDomain?.name ?? activeGroup?.name ?? "All websites"}<span className="px-2 font-normal text-muted">/</span>{section?.label ?? (pathname.startsWith("/reports") ? "Reports" : pathname === "/scan-centre" ? "Scan Centre" : "Workspace")}</p></div>
      {dateAware && <div className="ml-auto flex rounded-md border border-border bg-workspace p-0.5" aria-label="Reporting period">{(["7d", "28d", "90d"] as RangeKey[]).map((key) => <button key={key} aria-pressed={range === key} onClick={() => setRange(key)} className={cn("min-h-9 rounded px-2 text-xs sm:px-3", range === key ? "bg-card font-bold text-purple shadow-sm" : "text-muted")}>{parseInt(key)}d</button>)}</div>}
      {activeDomain && <Link href={`/sites/${encodeURIComponent(activeDomain.id)}/settings`} aria-label="Website settings" className={cn("flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-workspace", !dateAware && "ml-auto")}><Settings2 className="h-4 w-4" /></Link>}
    </div>
    {links.length > 0 && <nav aria-label={`${section?.label ?? "Research"} features`} className="flex flex-wrap gap-1 px-4 pb-2 sm:px-6">{links.map((entry) => <Link key={entry.href} href={navigationHref(entry, scope, range)} aria-current={selected?.href === entry.href ? "page" : undefined} className="flex min-h-9 items-center rounded-md px-2.5 text-xs font-semibold text-muted hover:bg-workspace aria-[current=page]:bg-purple/10 aria-[current=page]:text-purple sm:text-[13px]">{entry.label}</Link>)}</nav>}
  </div>;
}
