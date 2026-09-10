"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, Menu, Settings, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Modal } from "@/components/ui/modal";
import { GLOBAL_NAV, SITE_NAV, UTILITY_NAV, navigationHref, workspaceSection, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { useDomain } from "./domain-context";
import { ScopePicker } from "./scope-picker";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { scope, activeDomain, range } = useDomain();
  const pathname = usePathname(), params = useSearchParams(), section = workspaceSection(pathname, new URLSearchParams(params));
  const primary = activeDomain ? SITE_NAV : GLOBAL_NAV.filter((entry) => !["/action-centre", "/reports", "/settings"].includes(entry.href));
  function row(entry: NavItem) {
    const active = entry.section ? section?.id === entry.section : pathname === entry.href.split("?")[0];
    return <Link key={entry.href} href={navigationHref(entry, scope, range)} onNavigate={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold", active ? "bg-rail-selected text-purple" : "text-muted hover:bg-workspace")}><entry.icon className="h-5 w-5" />{entry.label}</Link>;
  }
  return <div className="lg:hidden"><button onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-md text-ink hover:bg-workspace" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
    <Modal open={open} onClose={() => setOpen(false)} title="Navigation"><div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="absolute inset-y-0 left-0 flex w-[90%] max-w-sm flex-col bg-card text-ink shadow-xl">
        <div className="flex shrink-0 items-center justify-between p-4"><BrandLogo className="w-48" /><button autoFocus onClick={() => setOpen(false)} aria-label="Close navigation" className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-workspace"><X className="h-5 w-5" /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <ScopePicker label="Select website in navigation" onNavigate={() => setOpen(false)} />
          {activeDomain && <Link href={navigationHref({ href: "/portfolio?scope=portfolio" }, scope, range)} onNavigate={() => setOpen(false)} className="my-2 flex min-h-10 items-center gap-2 text-xs font-semibold text-muted"><ArrowLeft className="h-4 w-4" />All websites</Link>}
          <nav aria-label="Website sections" className="mt-3 space-y-1">{primary.map(row)}</nav>
          <nav aria-label="Tasks, reports and scans" className="mt-3 border-t border-border pt-3">{UTILITY_NAV.filter((entry) => activeDomain || entry.href !== "/scan-centre").map(row)}</nav>
          <div className="mt-3 border-t border-border pt-2">{row({ href: "/settings", label: "Settings", icon: Settings })}</div>
        </div>
      </div>
    </Modal>
  </div>;
}
