"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Modal } from "@/components/ui/modal";
import { GLOBAL_NAV, navigationHref, toolSections } from "@/lib/nav";
import { switchScopeHref } from "@/lib/site-context";
import { navigateSafely } from "@/components/ui/unsaved-changes";
import { useDomain } from "./domain-context";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { scope, activeDomain, setScope, sites, groups } = useDomain();
  const pathname = usePathname(); const params = useSearchParams(); const router = useRouter();
  return <div className="lg:hidden"><button onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-md text-ink hover:bg-workspace" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
    <Modal open={open} onClose={() => setOpen(false)} title="Navigation">
      <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="absolute inset-y-0 left-0 flex w-[90%] max-w-sm flex-col bg-card text-ink shadow-xl">
        <div className="flex items-center justify-between p-4"><BrandLogo className="w-48" /><button autoFocus onClick={() => setOpen(false)} aria-label="Close navigation" className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-workspace"><X className="h-5 w-5" /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6"><nav aria-label="Main navigation" className="space-y-1">{GLOBAL_NAV.map((item) => <Link key={item.href} href={navigationHref(item, scope)} onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-md px-3 text-base font-semibold hover:bg-workspace"><item.icon className="h-5 w-5 text-purple" />{item.label}</Link>)}</nav>
          <label className="mt-5 block border-t border-border pt-4 text-sm font-semibold">Website<select aria-label="Select website in navigation" value={scope} onChange={(event) => { const next = event.target.value; navigateSafely(() => { setScope(next); router.push(switchScopeHref(pathname, new URLSearchParams(params), next)); }); setOpen(false); }} className="mt-2 h-11 w-full rounded-md border border-border bg-card px-3 text-sm"><option value="portfolio">All websites</option>{groups.map((group) => <option key={group.id} value={`group:${group.id}`}>{group.name}</option>)}{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          <nav aria-label="Workspace tools" className="mt-4">{toolSections.filter((group) => activeDomain || group.label === "Work").map((group) => <details key={group.label} className="border-b border-border"><summary className="cursor-pointer py-3 text-sm font-semibold">{group.label}</summary><div className="space-y-1 pb-3">{group.items.map((item) => <Link key={item.href} href={navigationHref(item, scope)} onClick={() => setOpen(false)} aria-current={pathname === item.href.split("?")[0] ? "page" : undefined} className="flex min-h-11 items-center rounded-md px-3 text-sm text-muted hover:bg-workspace aria-[current=page]:font-semibold aria-[current=page]:text-purple">{item.label}</Link>)}</div></details>)}</nav>
        </div>
      </div>
    </Modal>
  </div>;
}
