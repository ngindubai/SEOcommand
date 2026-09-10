"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { GLOBAL_NAV, SITE_NAV, UTILITY_NAV, navigationHref, workspaceSection, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { useDomain } from "./domain-context";
import { ScopePicker } from "./scope-picker";

export function CommandRail() {
  const [pinned, setPinned] = useState(true), [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false);
  const expanded = pinned || hovered || focused;
  const pathname = usePathname(), params = useSearchParams();
  const { scope, activeDomain, range } = useDomain();
  const section = workspaceSection(pathname, new URLSearchParams(params));
  useEffect(() => { try { setPinned(window.localStorage.getItem("orwell.sidebar-pinned") !== "false"); } catch { /* Default to readable labels. */ } }, []);
  const primary = activeDomain ? SITE_NAV : GLOBAL_NAV.filter((entry) => !["/action-centre", "/reports", "/settings"].includes(entry.href));
  const utilities = activeDomain ? UTILITY_NAV : UTILITY_NAV.filter((entry) => entry.href !== "/scan-centre");
  const finish = () => { setHovered(false); setFocused(false); };
  function togglePinned() { setPinned(!pinned); try { window.localStorage.setItem("orwell.sidebar-pinned", String(!pinned)); } catch { /* Memory remains available. */ } if (pinned) finish(); }
  function row(entry: NavItem) {
    const active = entry.section ? section?.id === entry.section : entry.href.split("?")[0] === pathname || pathname.startsWith(`${entry.href}/`);
    const Icon = entry.icon;
    return <Link key={entry.href} href={navigationHref(entry, scope, range)} onNavigate={finish} aria-label={entry.label} title={!expanded ? entry.label : undefined} aria-current={active ? "page" : undefined}
      className={cn("flex h-10 shrink-0 items-center gap-3 overflow-hidden rounded-md border px-3 transition-colors", active ? "border-purple/15 bg-rail-selected font-bold text-purple" : "border-transparent font-semibold text-muted hover:bg-workspace hover:text-ink")}>
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded", active && "bg-gradient-to-br from-[#f1792e] to-[#efa94e] text-white")}><Icon className="h-4 w-4" /></span>
      <span className={cn("whitespace-nowrap text-[13px]", !expanded && "hidden")}>{entry.label}</span>
    </Link>;
  }
  return <div className={cn("relative z-40 hidden shrink-0 transition-[width] duration-200 motion-reduce:transition-none lg:block", pinned ? "w-64" : "w-[72px]")}
    onPointerEnter={(event) => { if (event.pointerType !== "touch") setHovered(true); }} onPointerLeave={() => setHovered(false)}
    onFocusCapture={(event) => { if (event.target.matches(":focus-visible")) setFocused(true); }} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <aside className={cn("absolute inset-y-0 left-0 flex flex-col border-r border-border bg-card transition-[width,box-shadow] duration-200 motion-reduce:transition-none", expanded ? "w-64" : "w-[72px]", expanded && !pinned && "shadow-pop")} aria-label="Main navigation">
      <Link href={navigationHref({ href: "/portfolio", group: "site" }, scope, range)} aria-label="SEO Command dashboard" className="flex h-20 shrink-0 items-center px-3"><BrandLogo variant={expanded ? "full" : "mark"} className={expanded ? "w-52" : undefined} /></Link>
      {expanded && <div className="space-y-2 border-b border-border px-3 pb-3">
        <ScopePicker label="Select website in sidebar" />
        {activeDomain && <Link href={navigationHref({ href: "/portfolio?scope=portfolio" }, scope, range)} className="flex min-h-8 items-center gap-2 text-xs font-semibold text-muted hover:text-purple"><ArrowLeft className="h-3.5 w-3.5" />All websites</Link>}
      </div>}
      <nav id="command-navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2" aria-label="Website sections">
        {primary.map(row)}
      </nav>
      <nav aria-label="Tasks, reports and scans" className="shrink-0 space-y-1 border-t border-border p-2">{utilities.map(row)}</nav>
      <div className="shrink-0 border-t border-border p-2">
        {row({ href: "/settings", label: "Settings", icon: Settings })}
        <button onClick={togglePinned} aria-label={pinned ? "Collapse menu" : "Keep menu open"} aria-controls="command-navigation" aria-expanded={expanded} aria-pressed={pinned} className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-xs font-semibold text-muted hover:bg-workspace">
          {pinned ? <PanelLeftClose className="mx-1 h-4 w-4 shrink-0" /> : <PanelLeftOpen className="mx-1 h-4 w-4 shrink-0" />}{expanded && (pinned ? "Collapse menu" : "Keep menu open")}
        </button>
      </div>
    </aside>
  </div>;
}
