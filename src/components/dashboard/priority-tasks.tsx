"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ListTodo } from "lucide-react";
import { useDomain } from "@/components/shell/domain-context";
import { Card, Skeleton } from "@/components/ui/primitives";
import { actionDestination, type ActionData } from "@/lib/action-queue";
import type { LiveState } from "@/lib/use-live";
import { cn } from "@/lib/cn";
import styles from "@/components/dashboard/dashboard.module.css";

export function PriorityTasks({ tasks }: { tasks: LiveState<ActionData> }) {
  const { scope, setScope } = useDomain();
  const { data, loading, error, refresh } = tasks;
  const queueHref = `/action-centre?${new URLSearchParams({ scope, priority: "urgent" })}`;
  const available = data?.available;

  return <Card className={cn(styles.panel, styles.priority)} role="region" aria-labelledby="priority-tasks-heading">
    <div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2", styles.taskHeading)}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h2 id="priority-tasks-heading" className={styles.taskTitle}><ListTodo className="h-3.5 w-3.5" aria-hidden="true" />Priority tasks</h2>
        {available && !error && <span className="flex items-center gap-1.5 text-[10px]"><span className="text-critical">{data.counts.critical} critical</span><span aria-hidden="true" className="text-muted">·</span><span className="text-purple">{data.counts.urgent - data.counts.critical} urgent</span></span>}
        {data?.synthetic && <span className="text-[9px] text-muted">Sample data</span>}
      </div>
      <Link href={queueHref} aria-label="View all priority tasks" className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-ink hover:text-purple">View all{available && !error ? ` (${data.counts.urgent})` : ""}<ArrowUpRight className="h-3 w-3" aria-hidden="true" /></Link>
    </div>
    {loading && !data ? <div className="grid gap-2 px-4 py-2 md:grid-cols-2" aria-busy="true" aria-label="Loading priority tasks"><Skeleton className="h-5" /><Skeleton className="h-5" /></div>
      : error ? <div role="alert" className="flex items-center justify-between gap-3 px-4 py-2.5 text-[11px]"><p className="text-muted">Tasks couldn’t load.</p><button onClick={refresh} className="font-medium text-purple">Try again</button></div>
      : !available ? <p className="px-4 py-2.5 text-[11px] text-muted">Task data isn’t available yet.</p>
      : !data.items.length ? <div className="flex items-center gap-2 px-4 py-2.5 text-[11px]"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" /><p>No urgent or critical tasks in this view</p></div>
      : <ul className="grid md:grid-cols-2">{data.items.map((item, index) => {
        const destination = actionDestination(item);
        return <li key={`${item.kind}-${item.id}`} className={cn("min-w-0 border-border", index > 0 && "border-t", index === 1 && "md:border-t-0", index % 2 === 1 && "md:border-l")}>
          <Link href={destination.href} onClick={() => { if (item.siteSlug) setScope(item.siteSlug); }} className="group flex min-h-9 items-center gap-2 px-4 py-2 transition-colors hover:bg-workspace" aria-label={`${item.title} — ${item.siteName}. ${destination.label}${item.status === "in_progress" ? ". In progress" : ""}`} title={[item.title, item.siteName, item.detail, item.status === "in_progress" ? "In progress" : null].filter(Boolean).join(" · ")}>
            <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium", item.severity === "critical" ? "bg-critical/10 text-critical" : "bg-purple/10 text-purple")}>{item.severity === "critical" ? "Critical" : "Urgent"}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="truncate text-[10px] text-muted sm:max-w-28 sm:shrink-0">{item.siteName}</span>
              <span className="truncate text-[11px] font-medium group-hover:text-purple">{item.title}</span>
            </span>
            <ArrowUpRight className="h-3 w-3 shrink-0 text-muted group-hover:text-purple" aria-hidden="true" />
          </Link>
        </li>;
      })}</ul>}
  </Card>;
}
