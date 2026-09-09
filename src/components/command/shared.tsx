"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import styles from "./command.module.css";

export function stamp(value: string | null | undefined) { if (!value || !Number.isFinite(Date.parse(value))) return "Not collected"; return new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", ...(value.includes("T") ? { hour: "2-digit", minute: "2-digit" } : {}) }); }
export function metric(value: number | null | undefined, digits = 0) { return value == null ? "—" : value.toLocaleString("en-GB", { maximumFractionDigits: digits }); }
export function Panel({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) { return <section className={styles.panel}><div className={styles.heading}><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions}</div>{children}</section>; }
export function Empty({ children }: { children: ReactNode }) { return <p className={styles.empty}>{children}</p>; }
export function Metric({ label, value, note }: { label: string; value: string; note?: string }) { return <div className={styles.metric}><span className={styles.muted}>{label}</span><strong>{value}</strong>{note && <p className={styles.muted}>{note}</p>}</div>; }
export function useCommandAction(refresh: () => void, context?: string) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  useEffect(() => { setMessage(""); setError(""); }, [context]);
  async function action(input: Record<string, unknown>) {
    if (busy) return null;
    setBusy(true); setMessage(""); setError("");
    try { const response = await fetch("/api/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not save this change."); setMessage(body.message ?? "Saved."); refresh(); return body; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this change."); return null; }
    finally { setBusy(false); }
  }
  return { busy, message, error, action, feedback: <>{error && <p role="alert" className="rounded-md border border-critical/30 bg-critical/5 p-3 text-sm text-critical">{error}</p>}{message && <p role="status" className="text-sm text-success">{message}</p>}</> };
}
