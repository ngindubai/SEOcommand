"use client";
import { ResearchDirectory } from "@/components/research/evidence-panel";

import Link from "next/link";
import { EvidenceMessage } from "@/components/ui/evidence-message";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, Bot, ChevronRight, CircleDollarSign, Clock3, Database, Globe2, Gauge, Link2, Loader2, MapPin, Radar, RefreshCcw, Search, ShieldCheck, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Card, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { useDomain } from "@/components/shell/domain-context";
import { cn } from "@/lib/cn";
import { ScanPlans } from "@/components/command/bulk-scan-plan";
import type { ScanModule } from "@/platform/types";

type ModuleMeta = { id: ScanModule; label: string; description: string; paid: boolean; estimatedUsd: number; color: string; lastUpdatedAt: string | null; lastUpdatedDate: string | null; nextRunAt: string | null };
type ScanJob = { id: string; siteSlug: string; kind: string; status: string; progress: Record<string, unknown>; attempts: number; requestedBy: string | null; createdAt: string; startedAt: string | null; completedAt: string | null; lastError: string | null; runAfter?: string };
type Payload = { site: { id: string; name: string; spendApproval: string; forecastMonthlyUsd: number; approvedMonthlyUsd: number | null }; modules: ModuleMeta[]; jobs: ScanJob[] };

const ICONS: Record<ScanModule, React.ComponentType<{ className?: string }>> = {
  google: Globe2, rankings: Radar, keywords: Search, competitors: Activity, technical: ShieldCheck,
  backlinks: Link2, ai: Bot, local: MapPin, reliability: Activity, indexing: Search, speed: Gauge,
};
const RESULT_LINKS: Record<ScanModule, string> = {
  google: "/domain", rankings: "/rankings", keywords: "/keyword-research", competitors: "/competitors",
  technical: "/site-audit", backlinks: "/backlinks", ai: "/ai-visibility", local: "/local-seo", reliability: "/monitoring", indexing: "/health", speed: "/health",
};
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value); }
function ago(value: string) { const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000)); return minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : minutes < 1_440 ? `${Math.round(minutes / 60)}h ago` : `${Math.round(minutes / 1_440)}d ago`; }
function updatedLabel(module: ModuleMeta) {
  if (module.lastUpdatedAt) return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(module.lastUpdatedAt));
  if (module.lastUpdatedDate) return `${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${module.lastUpdatedDate}T00:00:00Z`))} · time not recorded`;
  return "Not updated yet";
}

export default function ScanCentrePage() {
  const { activeDomain } = useDomain();
  const searchParams = useSearchParams();
  const requestedModule = searchParams.get("module") as ScanModule | null;
  const [siteSlug, setSiteSlug] = useState(activeDomain?.id ?? "");
  const [loadedData, setData] = useState<Payload | null>(null);
  const data = loadedData?.site.id === siteSlug ? loadedData : null;
  const loadSequence = useRef(0);
  const [selected, setSelected] = useState<ScanModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [managing, setManaging] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeDomain?.id) setSiteSlug(activeDomain.id);
  }, [activeDomain?.id]);
  const load = useCallback(async () => {
    if (!siteSlug) return;
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/scan-centre?site=${encodeURIComponent(siteSlug)}`, { cache: "no-store" });
      const body = await response.json();
      if (sequence !== loadSequence.current) return;
      if (!response.ok) throw new Error(body.error ?? "Could not load the scan centre.");
      setData(body as Payload);

      setError(null);
    } catch (cause) { if (sequence === loadSequence.current) setError(cause instanceof Error ? cause.message : "Could not load the scan centre."); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [siteSlug]);
  useEffect(() => { setSelected(requestedModule ? [requestedModule] : []); setReviewing(false); }, [requestedModule, siteSlug]);
  const invalidateLoads = useCallback(() => { loadSequence.current++; }, []);
  useEffect(() => { void load(); return invalidateLoads; }, [load, invalidateLoads]);
  useEffect(() => {
    if (!data?.jobs.some((job) => ["queued", "running"].includes(job.status))) return;
    const timer = window.setInterval(() => void load(), 8_000);
    return () => window.clearInterval(timer);
  }, [data?.jobs, load]);

  const estimate = useMemo(() => data?.modules.filter((module) => selected.includes(module.id)).reduce((sum, module) => sum + module.estimatedUsd, 0) ?? 0, [data?.modules, selected]);
  const paidSelected = data?.modules.some((module) => selected.includes(module.id) && module.paid) ?? false;
  const blocked = paidSelected && data?.site.spendApproval !== "approved";
  async function run(modules = selected) {
    if (!siteSlug || !modules.length || running) return;
    setRunning(true); setError(null);
    try {
      const response = await fetch("/api/scan-centre", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteSlug, modules, label: modules.length === data?.modules.length ? "Full website scan" : "Selected tool scan" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not queue the scan.");
      setReviewing(false); setMessage("Scan queued. Existing saved results remain available.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not queue the scan."); }
    finally { setRunning(false); }
  }
  async function manage(jobId: string, action: "cancel" | "retry" | "start") {
    if (managing) return;
    setManaging(jobId); setError(null); setMessage("");
    try {
      const response = await fetch("/api/scan-centre", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, action }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? `Could not ${action} the scan.`);
      setMessage(action === "start" ? "Starting the saved scan now. Existing evidence is retained." : action === "retry" ? "Scan queued again. Existing evidence is retained." : "Scan cancellation requested.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The action failed. Retry when connected."); }
    finally { setManaging(null); }
  }

  return <div>
    <PageHeader title="Scan Centre" description="Choose what to update. Review the cost, follow progress and open saved results." actions={<Button onClick={() => void load()} disabled={loading}>Reload saved status</Button>} />
    <ResearchDirectory />
    <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4"><div><h2 className="text-lg font-bold">Scan modules</h2><p className="text-sm text-muted">{selected.length} selected · estimated {money(estimate)}</p></div><Button variant="primary" disabled={loading || !data || running || !selected.length} onClick={() => setReviewing(true)}>Review scan</Button></Card>
    {reviewing && <Card className="mb-5 space-y-3 p-5"><h2 className="text-lg font-bold">Review scan for {data?.site.name}</h2><p className="text-sm">{data?.modules.filter((module) => selected.includes(module.id)).map((module) => module.label).join(", ")}</p><p className="text-lg font-bold">Estimated {money(estimate)}</p><p className="text-sm text-muted">Only the selected modules will run. Estimates vary with website size; existing website and portfolio spending limits apply.</p><div className="flex gap-3"><Button variant="primary" disabled={blocked || running} onClick={() => void run()}>{running ? "Queuing…" : "Start selected scan"}</Button><Button onClick={() => setReviewing(false)}>Close review</Button></div></Card>}
    {error && <div className="mb-5 flex items-start gap-2 rounded-lg border border-critical/25 bg-critical/5 px-4 py-3 text-sm text-critical"><X className="mt-0.5 h-4 w-4 shrink-0" /><EvidenceMessage detail={error} /></div>}
    {message && <p role="status" className="mb-4 text-sm text-success">{message}</p>}
    <p className="mb-4 text-xs text-muted">Opening saved evidence is free. A retry reruns all modules in that scan and may incur provider costs again; the same spending limits apply.</p>
    {blocked && <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3"><div className="flex items-center gap-2 text-sm text-ink"><CircleDollarSign className="h-4 w-4 text-warning" /><span>Paid modules are locked until this website’s spending ceiling is approved.</span></div><Link href={`/sites/${siteSlug}/settings?tab=budgets`} className="text-xs font-bold text-purple hover:underline">Review budget</Link></div>}
    <div className="grid gap-5 "><div>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-ink">Scan modules</h2><button onClick={() => setSelected(selected.length === data?.modules.length ? [] : data?.modules.map((module) => module.id) ?? [])} className="text-xs font-semibold text-purple">{selected.length === data?.modules.length ? "Clear selection" : "Select all"}</button></div>
      <p className="mb-3 text-xs text-muted">Latest saved data in each module · times shown in your local time zone.</p>
      {loading && !data ? <div className="h-60 animate-pulse rounded-lg border border-border bg-card" /> : <Card className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted"><tr>{["Module / state", "Last updated", "Next planned", "Estimated cost", "Results"].map((label) => <th key={label} className="border-b border-border px-4 py-3">{label}</th>)}</tr></thead><tbody>{data?.modules.map((module) => {
        const Icon = ICONS[module.id]; const active = selected.includes(module.id); const current = data.jobs.find((job) => ["queued", "running"].includes(job.status) && (Array.isArray(job.progress.modules) ? job.progress.modules.includes(module.id) : job.kind === "browser_crawl" && module.id === "technical"));
        return <tr key={module.id} className="border-b border-border last:border-0"><td className="px-4 py-3"><label className="flex min-h-10 items-center gap-3"><input aria-label={`Select ${module.label}`} type="checkbox" checked={active} onChange={() => { setReviewing(false); setSelected((current) => current.includes(module.id) ? current.filter((id) => id !== module.id) : [...current, module.id]); }} /><Icon className="h-4 w-4 shrink-0" /><span><strong className="block">{module.label}</strong><span className="block whitespace-normal text-xs text-muted">{module.description}</span>{current && <span className="mt-1 block text-xs text-purple">Scan {current.status}</span>}</span></label></td><td className="px-4 py-3 text-xs">{module.lastUpdatedAt || module.lastUpdatedDate ? <time dateTime={module.lastUpdatedAt ?? module.lastUpdatedDate!}>{updatedLabel(module)}</time> : "Not updated yet"}</td><td className="px-4 py-3 text-xs">{module.nextRunAt ? new Date(module.nextRunAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "No saved plan"}</td><td className="px-4 py-3">{module.paid ? `~${money(module.estimatedUsd)}` : "Free"}</td><td className="px-4 py-3"><Link href={`${RESULT_LINKS[module.id]}?site=${siteSlug}${["indexing", "speed"].includes(module.id) ? `&view=${module.id}` : ""}`} className="font-semibold text-purple">View results</Link></td></tr>;
      })}</tbody></table></Card>}
    </div><Card className="h-fit overflow-hidden"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-bold text-ink">{showHistory ? "Scan history" : "Current activity"}</h2><p className="mt-0.5 text-2xs text-muted">Saved progress continues when you leave this page</p></div><button aria-label="Refresh scans" onClick={() => void load()} className="rounded-md p-2 text-muted hover:bg-workspace"><RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} /></button></div><div className="border-b border-border px-5 py-2"><button onClick={() => setShowHistory(!showHistory)} className="min-h-9 text-sm font-semibold text-purple">{showHistory ? "View current activity" : "View scan history"}</button></div><div className="max-h-[720px] divide-y divide-border overflow-y-auto">
      {!loading && !error && !data?.jobs.filter((job) => showHistory ? !["queued", "running"].includes(job.status) : ["queued", "running"].includes(job.status)).length && <div className="p-4"><EmptyState icon={<Database className="h-6 w-6" />} title={showHistory ? "No scan history" : "No active scans"} description="Choose modules above to review a new scan." /></div>}
      {data?.jobs.filter((job) => showHistory ? !["queued", "running"].includes(job.status) : ["queued", "running"].includes(job.status)).map((job) => { const browserCrawl = job.kind === "browser_crawl"; const modules = (Array.isArray(job.progress.modules) ? job.progress.modules : browserCrawl ? ["technical"] : []) as ScanModule[]; const active = ["queued", "running"].includes(job.status); return <div key={job.id} className="p-4">
        <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold text-ink">{String(job.progress.label ?? (browserCrawl ? "Technical browser crawl" : job.kind === "initial_site_scan" ? "Initial website scan" : "Website scan"))}</div><div className="mt-1 flex items-center gap-1.5 text-2xs text-muted"><Clock3 className="h-3 w-3" /> {ago(job.createdAt)} · {browserCrawl ? "Rendered pages · no DataForSEO call" : `${modules.length} modules`}</div></div><StatusBadge label={job.status === "queued" && job.lastError ? "Waiting to retry" : job.status} tone={job.status === "completed" ? "success" : job.status === "failed" ? "critical" : active ? "info" : "neutral"} /></div>
        <div className="mt-3 flex flex-wrap gap-1.5">{modules.map((module) => { const meta = data.modules.find((item) => item.id === module); const Icon = ICONS[module]; return <Link title={`Open ${meta?.label ?? module}`} key={module} href={`${browserCrawl ? "/technical-crawler" : RESULT_LINKS[module]}?site=${siteSlug}${["speed", "indexing"].includes(module) ? `&view=${module}` : ""}`} className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-workspace" style={{ color: meta?.color }}><Icon className="h-3.5 w-3.5" /></Link>; })}</div>
        {job.status === "running" && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-workspace"><div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-[#335CFF] to-[#12B8C4]" /></div>}{job.status === "queued" && <p className="mt-3 text-xs text-muted">{browserCrawl ? "Waiting for the hourly browser worker." : "Waiting to start. Data scans can start now."}{job.lastError && job.runAfter ? ` Retry eligible after ${new Date(job.runAfter).toLocaleString()}.` : ""}</p>}{job.lastError && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-critical">View the stage that needs attention</summary><EvidenceMessage detail={job.lastError} /></details>}{Array.isArray(job.progress.datasets) && <details className="mt-2 text-xs"><summary className="cursor-pointer text-purple">View saved dataset progress</summary>{(job.progress.datasets as { dataset: string; status: string; note?: string }[]).map((item) => <p key={item.dataset} className="mt-1">{item.dataset}: {item.status}{item.note ? ` · ${item.note}` : ""}</p>)}</details>}
        <div className="mt-3 flex items-center justify-between"><span className="text-[12px] text-muted">{job.requestedBy ? `By ${job.requestedBy}` : "Scheduled"}</span>{active ? <div className="flex gap-3">{job.status === "queued" && !browserCrawl && <button disabled={Boolean(managing)} onClick={() => void manage(job.id, "start")} className="text-xs font-semibold text-purple">Start now</button>}<button disabled={Boolean(managing)} onClick={() => void manage(job.id, "cancel")} className="text-xs font-semibold text-critical">Cancel</button></div> : ["failed", "cancelled"].includes(job.status) ? <button disabled={Boolean(managing)} onClick={() => void manage(job.id, "retry")} className="text-xs font-semibold text-purple">{browserCrawl ? "Retry browser crawl" : "Retry all tools"} · ~{money(browserCrawl ? 0 : data.modules.filter((item) => modules.includes(item.id)).reduce((sum, item) => sum + item.estimatedUsd, 0))}</button> : <Link href={`/sites/${siteSlug}`} className="flex items-center gap-1 text-xs font-semibold text-purple">Website overview <ChevronRight className="h-3 w-3" /></Link>}</div>
      </div>; })}
    </div></Card></div>
    <div className="mt-5 space-y-5"><ScanPlans key={siteSlug} siteId={siteSlug} onSaved={() => void load()} /></div>
  </div>;
}
