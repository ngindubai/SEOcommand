"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Plus, ServerCog, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, EmptyState, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { ManagedSite } from "@/platform/types";
import type { PortfolioGroup } from "@/platform/types";
import { BulkScanPlan } from "@/components/command/bulk-scan-plan";
import { useLivePortfolio } from "@/lib/use-live";
import { metric, stamp } from "@/components/command/shared";
import { GroupManager } from "@/components/portfolio/group-manager";

interface Connection {
  id: string;
  siteSlug: string;
  kind: string;
  status: string;
  displayName: string;
  remoteUrl: string | null;
}

function tone(status: string): "success" | "warning" | "critical" | "neutral" | "info" {
  if (status === "active" || status === "approved" || status === "connected") return "success";
  if (status === "error" || status === "rejected") return "critical";
  if (status === "provisioning" || status === "forecast_pending" || status === "pending") return "warning";
  return "neutral";
}

export default function SitesPage() {
  const performance = useLivePortfolio();
  const [view, setView] = useState<"performance" | "management">("performance");
  const [groupFilter, setGroupFilter] = useState("");
  const [sites, setSites] = useState<ManagedSite[] | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [groups, setGroups] = useState<PortfolioGroup[]>([]);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [syntheticOnboardingComplete, setSyntheticOnboardingComplete] = useState(false);

  useEffect(() => {
    setSyntheticOnboardingComplete(new URLSearchParams(window.location.search).get("onboarded") === "synthetic");
  }, []);

  useEffect(() => {
    fetch("/api/sites")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json() as Promise<{ sites: ManagedSite[]; connections: Connection[]; groups: PortfolioGroup[] }>;
      })
      .then((body) => {
        setSites(body.sites);
        setConnections(body.connections);
        setGroups(body.groups ?? []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [reload]);

  const managementColumns = useMemo<Column<ManagedSite>[]>(
    () => [
      {
        key: "groups",
        header: "Groups",
        render: (site) => {
          const assigned = groups.filter((group) => group.siteSlugs.includes(site.id));
          return assigned.length ? <div className="flex max-w-56 flex-wrap gap-1">{assigned.map((group) => <span key={group.id} className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-2xs" style={{ color: group.color }}>{group.name}</span>)}</div> : <span className="text-muted">Ungrouped</span>;
        },
      },
      {
        key: "site",
        header: "Website",
        sortValue: (site) => site.name,
        render: (site) => (
          <div className="flex items-center gap-2.5">
            <Circle className="h-2.5 w-2.5" style={{ fill: site.accent, color: site.accent }} />
            <div>
              <Link href={`/sites/${site.id}`} className="font-medium text-ink hover:underline">
                {site.name}
              </Link>
              <div className="text-2xs text-muted">{site.host}</div>
            </div>
          </div>
        ),
      },
      {
        key: "settings",
        header: "",
        align: "right",
        render: (site) => <Link href={`/sites/${site.id}/settings`} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-workspace hover:text-ink"><Settings2 className="h-3.5 w-3.5" /> Settings</Link>,
      },
      {
        key: "status",
        header: "Lifecycle",
        sortValue: (site) => site.lifecycleStatus,
        render: (site) => <StatusBadge label={site.lifecycleStatus} tone={tone(site.lifecycleStatus)} />,
      },
      {
        key: "spend",
        header: "Spend approval",
        sortValue: (site) => site.spendApproval,
        render: (site) => <StatusBadge label={site.spendApproval} tone={tone(site.spendApproval)} />,
      },
      {
        key: "forecast",
        header: "Monthly forecast",
        align: "right",
        sortValue: (site) => site.forecastMonthlyUsd,
        render: (site) => site.forecastMonthlyUsd ? `$${site.forecastMonthlyUsd.toFixed(2)}` : "Legacy plan",
      },
      {
        key: "market",
        header: "Market / devices",
        sortValue: (site) => site.primaryMarket,
        render: (site) => (
          <div>
            <div>{site.primaryMarket}</div>
            <div className="text-2xs capitalize text-muted">{site.devices.join(" + ")}</div>
          </div>
        ),
      },
      {
        key: "connections",
        header: "Publishing connections",
        exportValue: (site) => connections.filter((connection) => connection.siteSlug === site.id).map((connection) => `${connection.kind}: ${connection.status}`).join("; ") || "No publishing connection",
        render: (site) => {
          const linked = connections.filter((connection) => connection.siteSlug === site.id);
          return linked.length ? (
            <div className="flex flex-wrap gap-1">
              {linked.map((connection) => (
                <StatusBadge key={connection.id} label={connection.kind} tone={tone(connection.status)} />
              ))}
            </div>
          ) : (
            <span className="text-muted">None</span>
          );
        },
      },
    ],
    [connections, groups],
  );

  const headlines = new Map((performance.data?.domains ?? []).map((row) => [row.domainId, row]));
  const performanceColumns: Column<ManagedSite>[] = [
    managementColumns.find((column) => column.key === "site")!,
    { key: "clicks", header: "Clicks · 28 days", sortValue: (site) => headlines.get(site.id)?.searchPeriod?.clicks ?? -1, render: (site) => <div>{metric(headlines.get(site.id)?.searchPeriod?.clicks)}<span className="block text-xs text-muted">Through {headlines.get(site.id)?.searchPeriod?.end ?? "unavailable"}</span></div> },
    { key: "change", header: "Click change", sortValue: (site) => headlines.get(site.id)?.searchPeriod?.clickChange ?? -Infinity, render: (site) => { const change = headlines.get(site.id)?.searchPeriod?.clickChange; return change == null ? "No comparison" : <span className={change < 0 ? "text-critical" : "text-success"}>{change > 0 ? "+" : ""}{change.toFixed(1)}%</span>; } },
    { key: "issues", header: "Priority issues", sortValue: (site) => headlines.get(site.id)?.criticalIssues ?? -1, render: (site) => <Link href={`/health?site=${site.id}`} className="font-semibold text-purple">{metric(headlines.get(site.id)?.criticalIssues)}</Link> },
    { key: "health", header: "Data health", render: (site) => { const row = headlines.get(site.id); return <div><span className="text-xs">{!row?.lastSync ? "Not collected" : row.dataHealth?.some((source) => source.state === "stale") ? "Needs refresh" : row.dataHealth?.some((source) => source.state === "missing") ? "Partial data" : "Recent saved data"}</span><span className="block text-xs text-muted">{row?.dataHealth?.filter((source) => source.state !== "ready").map((source) => `${source.label}: ${source.state}`).join(" · ") || `Last collection ${stamp(row?.lastSync)}`}</span></div>; } },
    { key: "action", header: "Next action", render: (site) => <Link href={headlines.get(site.id)?.criticalIssues ? `/health?site=${site.id}` : `/portfolio?site=${site.id}`} className="font-semibold text-purple">{headlines.get(site.id)?.criticalIssues ? "Review issues" : "Open overview"} →</Link> },
  ];
  const visibleSites = (sites ?? []).filter((site) => !groupFilter || groups.find((group) => group.id === groupFilter)?.siteSlugs.includes(site.id));
  return (
    <div className="animate-in space-y-5">
      <PageHeader
        title="Websites"
        description="See what changed, which websites need attention and where to work next."
        actions={<div className="flex flex-wrap gap-2"><GroupManager sites={sites ?? []} groups={groups} onChanged={() => setReload((value) => value + 1)} /><Link href="/sites/new" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-purple px-3.5 text-sm font-medium text-white hover:bg-purple-deep"><Plus className="h-4 w-4" /> Add website</Link></div>}
      />

      <div className="flex flex-wrap items-center gap-3"><div className="flex gap-1 rounded-md border border-border bg-card p-1">{(["performance", "management"] as const).map((item) => <button key={item} aria-pressed={view === item} onClick={() => setView(item)} className={`min-h-9 rounded px-3 text-sm capitalize ${view === item ? "bg-rail-selected font-bold text-purple" : "text-muted"}`}>{item}</button>)}</div><label className="text-sm">Group <select aria-label="Filter websites by group" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="ml-2 h-10 rounded-md border border-border bg-card px-3"><option value="">All groups</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><Link href="/performance?scope=portfolio&view=overlap" className="ml-auto text-sm font-semibold text-purple">Compare keyword overlap →</Link></div>
      {performance.error && view === "performance" && <p className="text-sm text-critical">Performance could not refresh. <button className="underline" onClick={performance.refresh}>Retry</button></p>}
      {syntheticOnboardingComplete && (
        <div role="status" className="flex items-start gap-2 rounded-md border border-success/25 bg-success/5 px-4 py-3 text-xs text-ink">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <div><strong>Synthetic onboarding completed.</strong> The free-monitoring handoff and paid-spend gate passed; the fixed 20-site staging dataset remains unchanged.</div>
        </div>
      )}

      {error ? (
        <EmptyState title="Could not load websites" description={error} icon={<ServerCog className="h-6 w-6" />} />
      ) : !sites ? (
        <Skeleton className="h-96" />
      ) : (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink">Your websites</h2>
              <p className="mt-0.5 text-2xs text-muted">{sites.length} websites · choose a website to open its overview</p>
            </div>
            <Link href="/notifications" className="inline-flex items-center gap-1 text-xs font-medium text-purple hover:underline">
              Open notification centre <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <DataTable
            rows={visibleSites}
            columns={view === "performance" ? performanceColumns : [managementColumns.find((column) => column.key === "site")!, ...managementColumns.filter((column) => column.key !== "site")]}
            searchKeys={(site) => `${site.name} ${site.host} ${site.primaryMarket} ${site.industry}`}
            pageSize={25}
            exportName="portfolio-sites"
          />
        </Card>
      )}
      <BulkScanPlan />
    </div>
  );
}
