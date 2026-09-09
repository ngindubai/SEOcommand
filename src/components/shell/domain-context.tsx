"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Domain, DomainId } from "@/lib/types";
import type { PortfolioGroup } from "@/platform/types";
import { hrefWithScope, scopeFromLocation } from "@/lib/site-context";

export type Scope = DomainId | "portfolio" | `group:${string}`;

interface DomainState {
  scope: Scope;
  setScope: (s: Scope) => void;
  activeDomain: Domain | null; // null when scope === "portfolio"
  activeGroup: PortfolioGroup | null;
  sites: Domain[];
  groups: PortfolioGroup[];
  sitesLoading: boolean;
  scopeReady: boolean;
  refreshPortfolio: () => Promise<void>;
  range: RangeKey;
  setRange: (r: RangeKey) => void;
}

export type RangeKey = "7d" | "28d" | "90d";

const DomainCtx = createContext<DomainState | null>(null);

export function DomainProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [scope, setScopeState] = useState<Scope>("portfolio");
  const selection = useRef<Scope | null>(null);
  const [scopeReady, setScopeReady] = useState(false);
  const [range, setRange] = useState<RangeKey>("28d");
  const [sites, setSites] = useState<Domain[]>([]);
  const [groups, setGroups] = useState<PortfolioGroup[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const setScope = useCallback((next: Scope) => {
    selection.current = next;
    setScopeState(next);
    try { window.localStorage.setItem("orwell.scope", next); } catch { /* Storage may be disabled. */ }
  }, []);

  const refreshPortfolio = useCallback(async () => {
    setSitesLoading(true);
    try {
      const response = await fetch("/api/sites", { cache: "no-store" });
      if (!response.ok) throw new Error(`Site registry request failed (${response.status})`);
      const body = await response.json() as { sites?: Domain[]; groups?: PortfolioGroup[] };
      setSites(body.sites ?? []);
      if (body.groups) setGroups(body.groups);
    } finally {
      setSitesLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/sites", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Site registry request failed (${response.status})`);
        return response.json() as Promise<{ sites?: Domain[]; groups?: PortfolioGroup[] }>;
      })
      .then((body) => {
        if (active) setSites(body.sites ?? []);
        if (active && body.groups) setGroups(body.groups);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setSitesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  // Keep explicit routes authoritative and remember the selection on unscoped
  // pages. Write it into website-aware URLs before mounting their data/actions.
  useEffect(() => {
    let saved: string | null = selection.current;
    // Restore once per tab; another tab must not switch this tab's website.
    if (saved === null) {
      try { saved = window.localStorage.getItem("orwell.scope"); } catch { /* Use in-memory selection. */ }
    }
    const next = scopeFromLocation(pathname, new URLSearchParams(searchParams.toString()), saved);
    setScope(next);
    setScopeReady(true);
    const currentHref = `${pathname}${searchParams.size ? `?${searchParams}` : ""}${window.location.hash}`;
    const nextHref = hrefWithScope(currentHref, next);
    if (nextHref !== currentHref) router.replace(nextHref, { scroll: false });
  }, [pathname, searchParams, router, setScope]);

  const currentHref = `${pathname}${searchParams.size ? `?${searchParams}` : ""}`;
  const contextReady = scopeReady
    && scopeFromLocation(pathname, new URLSearchParams(searchParams.toString()), scope) === scope
    && hrefWithScope(currentHref, scope) === currentHref;

  // Website identity stays in its marker; the application keeps one shared theme.
  const activeDomain = scope === "portfolio" || scope.startsWith("group:")
    ? null
    : (sites.find((site) => site.id === scope) ?? null);
  const activeGroup = scope.startsWith("group:")
    ? groups.find((group) => group.id === scope.slice(6)) ?? null
    : null;
  useEffect(() => {
    const accent = activeDomain?.accent ?? activeGroup?.color ?? "#d87832";
    document.documentElement.style.setProperty("--site-accent", accent);
  }, [activeDomain, activeGroup]);

  const value = useMemo<DomainState>(
    () => ({
      scope,
      setScope,
      activeDomain,
      activeGroup,
      sites,
      groups,
      sitesLoading,
      scopeReady: contextReady,
      refreshPortfolio,
      range,
      setRange,
    }),
    [scope, setScope, activeDomain, activeGroup, sites, groups, sitesLoading, contextReady, refreshPortfolio, range],
  );

  return <DomainCtx.Provider value={value}>{children}</DomainCtx.Provider>;
}

export function useDomain(): DomainState {
  const ctx = useContext(DomainCtx);
  if (!ctx) throw new Error("useDomain must be used within DomainProvider");
  return ctx;
}

/** Resolve a website only after an explicit route or query selection. */
export function useResolvedDomain(): Domain {
  const { activeDomain } = useDomain();
  if (!activeDomain) throw new Error("This tool requires an explicit website context.");
  return activeDomain;
}
