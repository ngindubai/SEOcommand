"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDomain } from "@/components/shell/domain-context";
import { useJson } from "@/lib/use-live";
import { hrefWithScope } from "@/lib/site-context";
import { PageHeader } from "@/components/ui/page-header";
import { EvidenceMessage } from "@/components/ui/evidence-message";
import { Button, Card, EmptyState, SeverityBadge, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

interface Notice {
  id: string; siteSlug: string | null; title: string; detail: string | null; actionUrl: string | null;
  status: string; severity: "critical" | "high" | "medium" | "low"; createdAt: string;
  eventCount?: number; recovered?: boolean;
}
interface Inbox { items: Notice[]; counts: Record<"open" | "snoozed" | "history", number>; total: number; }

export default function NotificationsPage() {
  const { scope, sites, activeDomain, activeGroup } = useDomain();
  const [filter, setFilter] = useState<"open" | "snoozed" | "history">("open");
  const [query, setQuery] = useState(""); const [severity, setSeverity] = useState(""); const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState("");
  useEffect(() => { setPage(0); setMessage(""); setError(null); }, [scope]);
  const params = new URLSearchParams({ scope, status: filter, q: query, severity, offset: String(page * 20), limit: "20" });
  const inbox = useJson<Inbox>(`/api/notifications?${params}`, 0);
  async function update(item: Notice, action: string) {
    if (busy) return;
    setBusy(item.id); setError(null); setMessage("");
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, action }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "The alert could not be updated. Try again.");
      setMessage(`Alert ${action === "snooze" ? "snoozed for one day" : action === "reopen" ? "reopened" : action === "dismiss" ? "dismissed" : "resolved"}. History is preserved.`);
      inbox.refresh(); window.dispatchEvent(new Event("orwell:notifications-changed"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The update failed. Try again."); }
    finally { setBusy(null); }
  }
  return <div className="space-y-5"><PageHeader title="Notifications" description={`Current incidents and their history · ${activeDomain?.name ?? activeGroup?.name ?? "All websites"}. Repeated events are grouped; recovered problems move to history.`} actions={<Button onClick={inbox.refresh}>Refresh</Button>} />
    <div className="flex flex-wrap items-center gap-2">{(["open", "snoozed", "history"] as const).map((value) => <button key={value} onClick={() => { setFilter(value); setPage(0); }} aria-pressed={filter === value} className={cn("min-h-10 rounded-md border px-4 py-2 text-sm capitalize", filter === value ? "border-purple bg-purple/10 font-semibold text-purple" : "border-border bg-card")}>{value} <span className="ml-2 tnum">{inbox.data?.counts[value] ?? "—"}</span></button>)}</div>
    <div className="flex flex-wrap gap-3"><input aria-label="Search incidents" placeholder="Search incidents…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} className="h-10 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm" /><select aria-label="Severity" value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(0); }} className="h-10 rounded-md border border-border bg-card px-3 text-sm"><option value="">All severities</option>{["critical", "high", "medium", "low"].map((value) => <option key={value}>{value}</option>)}</select></div>
    {(error || inbox.error) && <p role="alert" className="rounded-md border border-critical/20 bg-critical/5 p-3 text-sm text-critical">{error || "Notifications couldn’t refresh. Your previous results are retained; use Refresh to retry."}</p>}
    {message && <p role="status" className="text-sm text-success">{message}</p>}
    {inbox.loading && !inbox.data ? <Skeleton className="h-64" /> : inbox.data && <>
      <p role="status" className="text-xs text-muted">{inbox.data.total ? `${page * 20 + 1}–${Math.min((page + 1) * 20, inbox.data.total)} of ${inbox.data.total} incidents` : "0 matching incidents"}</p>
      {inbox.data.items.length ? <Card className="divide-y divide-border">{inbox.data.items.map((item) => <article key={item.id} className="p-4 sm:p-5"><div className="flex flex-wrap items-center gap-2"><SeverityBadge severity={item.severity} /><span className="text-xs text-muted">{sites.find((site) => site.id === item.siteSlug)?.name ?? item.siteSlug ?? "Account"}</span><time className="ml-auto text-xs text-muted">{new Date(item.createdAt).toLocaleString()}</time></div><h2 className="mt-2 text-base font-semibold">{item.title}</h2>{item.recovered && <p className="mt-2 text-sm text-success">Recovered according to newer saved evidence.</p>}<EvidenceMessage detail={item.detail} />{(item.eventCount ?? 1) > 1 && <IncidentHistory id={item.id} scope={scope} count={item.eventCount!} />}<div className="mt-4 flex flex-wrap items-center gap-2">{item.actionUrl && <Link className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-sm font-semibold text-purple" href={hrefWithScope(item.actionUrl, item.siteSlug ?? scope)}>Review evidence</Link>}{item.status === "open" ? <><Button size="sm" disabled={Boolean(busy)} onClick={() => void update(item, "snooze")}>Snooze</Button><Button size="sm" disabled={Boolean(busy)} onClick={() => void update(item, "dismiss")}>Dismiss</Button><Button size="sm" disabled={Boolean(busy)} onClick={() => void update(item, "resolve")}>{busy === item.id ? "Saving…" : "Resolve"}</Button></> : !item.recovered && <Button size="sm" disabled={Boolean(busy)} onClick={() => void update(item, "reopen")}>Reopen</Button>}</div></article>)}</Card> : <EmptyState title="No matching incidents" description="Change the filters or check History for recovered and closed incidents." />}
      <div className="flex justify-between"><Button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button disabled={(page + 1) * 20 >= inbox.data.total} onClick={() => setPage(page + 1)}>Next</Button></div>
    </>}
  </div>;
}

function IncidentHistory({ id, scope, count }: { id: string; scope: string; count: number }) {
  const [open, setOpen] = useState(false); const [page, setPage] = useState(0);
  return <div className="mt-3"><Button size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide" : "View"} {count} historical events</Button>{open && <HistoryRows id={id} scope={scope} page={page} setPage={setPage} />}</div>;
}
function HistoryRows({ id, scope, page, setPage }: { id: string; scope: string; page: number; setPage: (page: number) => void }) {
  const data = useJson<{ items: Notice[]; total: number }>(`/api/notifications?historyId=${encodeURIComponent(id)}&scope=${encodeURIComponent(scope)}&limit=10&offset=${page * 10}`, 0);
  return <div className="mt-3 rounded-md border border-border p-3">{data.error ? <Button onClick={data.refresh}>History couldn’t load · Retry</Button> : !data.data ? <p role="status">Loading history…</p> : <><ol className="space-y-3">{data.data.items.map((event) => <li key={event.id}><time className="text-xs text-muted">{new Date(event.createdAt).toLocaleString()} · {event.status}</time><p className="text-sm font-semibold">{event.title}</p><EvidenceMessage detail={event.detail} /></li>)}</ol><div className="mt-3 flex items-center justify-between"><Button size="sm" disabled={!page} onClick={() => setPage(page - 1)}>Previous events</Button><span className="text-xs">{page * 10 + 1}–{Math.min((page + 1) * 10, data.data.total)} of {data.data.total}</span><Button size="sm" disabled={(page + 1) * 10 >= data.data.total} onClick={() => setPage(page + 1)}>Next events</Button></div></>}</div>;
}
