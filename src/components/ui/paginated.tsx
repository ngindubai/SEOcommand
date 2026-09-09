"use client";

import { Children, useMemo, useState, type ReactNode } from "react";
import { cellText } from "@/lib/csv";
import { Button } from "./primitives";

/** Keep long queues searchable and bounded without discarding their available rows. */
export function Paginated({ children, label = "results", pageSize = 12 }: { children: ReactNode; label?: string; pageSize?: number }) {
  const [query, setQuery] = useState(""); const [page, setPage] = useState(0);
  const rows = useMemo(() => Children.toArray(children).filter((row) => !query || cellText(row).toLowerCase().includes(query.toLowerCase())), [children, query]);
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
  if (Children.count(children) === 0) return null;
  return <div><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3"><input aria-label={`Search ${label}`} placeholder={`Search ${label}…`} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} className="h-10 min-w-0 rounded-md border border-border bg-card px-3 text-sm" /><span role="status" className="text-xs text-muted">{rows.length ? `${current * pageSize + 1}–${Math.min((current + 1) * pageSize, rows.length)} of ${rows.length}` : "No matching results"}</span></div><div className="divide-y divide-border">{rows.slice(current * pageSize, (current + 1) * pageSize)}</div>{rows.length > pageSize && <div className="flex justify-between border-t border-border p-3"><Button size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</Button><Button size="sm" disabled={(current + 1) * pageSize >= rows.length} onClick={() => setPage(current + 1)}>Next</Button></div>}</div>;
}
