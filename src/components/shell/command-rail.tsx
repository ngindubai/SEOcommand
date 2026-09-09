"use client";

import { BrandLogo } from "@/components/brand/brand-logo";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Building2, FolderTree, ListChecks, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Settings, X } from "lucide-react";
import { GLOBAL_NAV, RESEARCH_NAV, SITE_NAV, SCAN_CENTRE, TECHNICAL_SECONDARY, KEYWORD_SECONDARY, BACKLINK_SECONDARY, navigationHref, type NavItem } from "@/lib/nav";
import { hrefWithScope, requiresSiteContext } from "@/lib/site-context";
import { cn } from "@/lib/cn";
import { PortfolioRail } from "./portfolio-rail";
import { useDomain } from "./domain-context";

export function CommandRail() {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLButtonElement>(null);
  const portfolioButtonRef = useRef<HTMLButtonElement>(null);
  const expanded = pinned || hovered || focused || portfolioOpen;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { scope, activeDomain } = useDomain();
  const items: NavItem[] = [
    { href: "/portfolio", label: "Dashboard", icon: LayoutDashboard },
    { href: "/sites", label: "Websites", icon: Building2 },
    ...GLOBAL_NAV.filter((item) => !["/portfolio", "/sites", "/settings", "/action-centre"].includes(item.href)),
    ...RESEARCH_NAV.filter((item) => item.href !== "/research"),
    ...SITE_NAV.filter((item) => !["/domain", "/reports"].includes(item.href)),
    SCAN_CENTRE,
    ...TECHNICAL_SECONDARY,
    ...KEYWORD_SECONDARY.filter((item) => item.href !== "/keyword-research"),
    ...BACKLINK_SECONDARY,
  ];

  useEffect(() => {
    if (!portfolioOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!railRef.current?.contains(event.target as Node)) setPortfolioOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [portfolioOpen]);

  function finishNavigation() {
    setHovered(false);
    setFocused(false);
    setPortfolioOpen(false);
  }

  function togglePinned() {
    setPinned(!pinned);
    if (pinned) finishNavigation();
  }

  const labelClass = cn("whitespace-nowrap text-[13px] font-semibold transition-opacity duration-150 motion-reduce:transition-none", expanded ? "opacity-100" : "opacity-0");
  const rowClass = "flex h-10 w-full shrink-0 items-center gap-2.5 overflow-hidden rounded-md border px-2.5 text-left transition-colors";

  return (
    <div
      ref={railRef}
      className={cn("relative z-40 hidden shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex", pinned ? "w-64" : "w-16")}
      onPointerEnter={(event) => { if (event.pointerType !== "touch") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) => { if (event.target.matches(":focus-visible")) setFocused(true); }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        pinRef.current?.focus();
        setPinned(false);
        finishNavigation();
      }}
    >
      <aside className={cn("absolute inset-y-0 left-0 flex flex-col border-r border-border bg-card transition-[width,box-shadow] duration-200 ease-out motion-reduce:transition-none", expanded ? "w-64" : "w-16", expanded && !pinned && "shadow-[12px_0_32px_-12px_rgba(32,24,18,0.18)]")} aria-label="Main navigation">
        <div className="flex h-20 shrink-0 items-center overflow-hidden px-3">
          <Link href={hrefWithScope("/portfolio", scope)} onNavigate={finishNavigation} aria-label="SEO Command dashboard" className="flex h-10 shrink-0 items-center rounded-md">
            <BrandLogo variant={expanded ? "full" : "mark"} className={expanded ? "w-52" : undefined} />
          </Link>
        </div>
        <nav id="command-navigation" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-2 py-2" aria-label="Dashboard and tools">
          {items.map(({ href, label, icon: Icon, group }) => {
            const [itemPath, itemQuery] = href.split("?");
            const itemView = new URLSearchParams(itemQuery ?? "").get("view");
            const isSite = group === "site" || requiresSiteContext(itemPath!);
            const active = itemPath === "/research"
              ? pathname === "/research" && (isSite ? Boolean(searchParams.get("site")) : !searchParams.get("site"))
              : (pathname === itemPath || pathname.startsWith(`${itemPath}/`)) && (itemView ? searchParams.get("view") === itemView : !searchParams.get("view"));
            return <Link key={`${group}:${href}`} href={navigationHref({ href, group }, scope)} onNavigate={finishNavigation} aria-label={label} aria-current={active ? "page" : undefined} className={cn(rowClass, active ? "border-purple/15 bg-rail-selected text-purple" : "border-transparent text-muted hover:bg-workspace hover:text-ink")}>
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded", active && "bg-gradient-to-br from-[#f1792e] to-[#efa94e] text-white")}><Icon className="h-4 w-4" aria-hidden="true" /></span>
              <span className={labelClass} aria-hidden={!expanded}>{label}</span>
            </Link>;
          })}
        </nav>
        <div className="mt-2 flex shrink-0 flex-col gap-1 border-t border-border px-2 py-3">
          <button ref={portfolioButtonRef} onClick={() => setPortfolioOpen(!portfolioOpen)} aria-label="Websites and groups" aria-controls={portfolioOpen ? "portfolio-navigation" : undefined} aria-expanded={portfolioOpen} className={cn(rowClass, "border-transparent", portfolioOpen ? "bg-rail-selected text-purple" : "text-muted hover:bg-workspace hover:text-ink")}>
            <FolderTree className="mx-1 h-4 w-4 shrink-0" aria-hidden="true" /><span className={labelClass} aria-hidden={!expanded}>Websites and groups</span>
          </button>
          {[{ href: activeDomain ? `/sites/${encodeURIComponent(activeDomain.id)}/settings` : "/settings", label: "Settings", icon: Settings }, { href: hrefWithScope("/action-centre", scope), label: "Action centre", icon: ListChecks }].map(({ href, label, icon: Icon }) => {
            const path = href.split("?")[0]!;
            const active = pathname === path || pathname.startsWith(`${path}/`);
            return <Link key={href} href={href} onNavigate={finishNavigation} aria-label={label} aria-current={active ? "page" : undefined} className={cn(rowClass, "border-transparent", active ? "bg-rail-selected text-purple" : "text-muted hover:bg-workspace hover:text-ink")}><Icon className="mx-1 h-4 w-4 shrink-0" aria-hidden="true" /><span className={labelClass} aria-hidden={!expanded}>{label}</span></Link>;
          })}
          <button ref={pinRef} onClick={togglePinned} aria-label={pinned ? "Collapse menu" : "Keep menu open"} aria-controls="command-navigation" aria-expanded={expanded} aria-pressed={pinned} className={cn(rowClass, "border-transparent text-muted hover:bg-workspace hover:text-purple")}>
            {pinned ? <PanelLeftClose className="mx-1 h-4 w-4 shrink-0" aria-hidden="true" /> : <PanelLeftOpen className="mx-1 h-4 w-4 shrink-0" aria-hidden="true" />}
            <span className={labelClass} aria-hidden={!expanded}>{pinned ? "Collapse menu" : "Keep menu open"}</span>
          </button>
        </div>
        {portfolioOpen && <div id="portfolio-navigation" className="absolute inset-y-0 left-full flex shadow-xl">
          <PortfolioRail />
          <button onClick={() => { setPortfolioOpen(false); portfolioButtonRef.current?.focus(); }} aria-label="Close websites and groups" className="absolute right-2 top-2 rounded-md bg-card p-1.5 text-muted hover:bg-workspace hover:text-ink"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
        </div>}
      </aside>
    </div>
  );
}
