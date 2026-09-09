"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronRight, ScanLine } from "lucide-react";
import { Card, StatusBadge } from "@/components/ui/primitives";
import { useJson } from "@/lib/use-live";

type ScanJob = {
  id: string;
  kind: string;
  status: string;
  createdAt: string;
  lastError: string | null;
  progress: { label?: string };
};

/** A compact view of saved scan activity; opening an overview never starts a scan. */
export function SiteScanCentre({ siteId }: { siteId: string }) {
  const { data, loading, error, refresh } = useJson<{ jobs: ScanJob[] }>(`/api/scan-centre?site=${encodeURIComponent(siteId)}`, 0);
  const jobs = data?.jobs ?? [];
  const running = jobs.filter((job) => job.status === "running").length;
  const queued = jobs.filter((job) => job.status === "queued").length;
  const active = running + queued;
  const latest = jobs.find((job) => job.status === "running") ?? jobs.find((job) => job.status === "queued") ?? jobs[0];

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [active, refresh]);

  const label = latest?.kind === "browser_crawl" ? "Technical browser crawl" : latest?.progress.label ?? "Website scan";
  const status = latest?.status === "queued" && latest.lastError ? "Waiting to retry" : latest?.status;
  const activity = active
    ? [running ? `${running} running` : null, queued ? `${queued} queued` : null].filter(Boolean).join(" · ")
    : "Latest scan";

  return <Card role="region" aria-label="Website Scan Centre" className="border-purple/25 border-l-4 border-l-purple bg-gradient-to-r from-purple/5 to-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-purple/10 text-purple"><ScanLine className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0"><h2 className="text-lg font-bold text-ink">Scan Centre</h2><p className="text-xs text-muted">Scans and data refreshes for this website</p></div>
      </div>
      <div className="min-w-0 text-sm" aria-live="polite">
        {error ? <p className="text-muted">Scan status unavailable. <button type="button" onClick={refresh} className="font-semibold text-purple underline underline-offset-2">Retry</button></p>
          : loading && !data ? <p className="text-muted">Checking scan activity…</p>
          : latest ? <><p className="mb-1 text-xs text-muted">{activity}</p><div className="flex flex-wrap items-center gap-2"><span className="text-ink">{label}</span><StatusBadge label={status!} tone={latest.status === "completed" ? "success" : latest.status === "failed" ? "critical" : active ? "info" : "neutral"} /></div></>
          : <p className="text-muted">No scans yet. Choose tools and preview the cost.</p>}
      </div>
      <Link href={`/scan-centre?site=${encodeURIComponent(siteId)}`} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md bg-purple-deep px-4 py-2 text-sm font-semibold text-white hover:brightness-95">
        Open Scan Centre <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  </Card>;
}
