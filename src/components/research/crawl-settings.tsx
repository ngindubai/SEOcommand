"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { useJson } from "@/lib/use-live";
import { useCommandAction } from "@/components/command/shared";
import type { SiteCommand } from "@/lib/command-model";
import styles from "@/components/command/command.module.css";
export function CrawlSettings({ site }: { site: string }) {
  const state = useJson<SiteCommand>(`/api/command?site=${site}`), [value, setValue] = useState("");
  const action = useCommandAction(state.refresh, site);
  useEffect(() => { const exclusions = state.data?.records.find((r) => r.kind === "settings")?.payload.crawlExclusions; setValue(Array.isArray(exclusions) ? exclusions.join("\n") : ""); }, [state.data]);
  return <details className="rounded-lg border border-border bg-card p-4"><summary className="cursor-pointer text-sm font-bold">Rendered crawl scope and exclusions</summary><div className="mt-3 space-y-3"><p className="text-xs text-muted">One path prefix per line, e.g. /account or /checkout. Each excludes that path and its descendants. Saved crawl history stays available.</p><label className={styles.label}>Excluded paths<textarea rows={4} className={styles.field} value={value} onChange={(e) => setValue(e.target.value)} /></label><Button disabled={action.busy || !state.data?.permissions.settings} onClick={() => void action.action({ action: "crawl_settings", site, exclusions: value.split("\n").map((v) => v.trim()).filter(Boolean) })}>Save exclusions</Button>{action.feedback}</div></details>;
}
