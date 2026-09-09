"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Send } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/primitives";
import { useDomain } from "@/components/shell/domain-context";
import { stamp } from "./shared";

export function AskCommand() {
  const { scope, activeDomain, activeGroup } = useDomain();
  const [open, setOpen] = useState(false), [question, setQuestion] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [result, setResult] = useState<{ answer: string; scope: string; note: string; evidence: { title: string; detail: string; date: string | null; href: string }[] } | null>(null);
  useEffect(() => { setResult(null); setError(""); setQuestion(""); }, [scope]);
  async function ask(text: string) {
    if (!text.trim() || busy) return; setBusy(true); setError(""); setQuestion(text); setResult(null);
    try { const response = await fetch("/api/command/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, question: text }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not load evidence."); setResult(body); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load evidence."); } finally { setBusy(false); }
  }
  return <><button onClick={() => setOpen(true)} className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-purple" aria-label="Ask SEO Command"><MessageCircle className="h-4 w-4" /><span className="hidden md:inline">Ask SEO Command</span></button><Drawer open={open} onClose={() => setOpen(false)} title="Ask SEO Command" subtitle={activeDomain?.name ?? activeGroup?.name ?? "All accessible websites"} width="max-w-xl"><div className="space-y-5"><p className="text-sm text-muted">Ask about saved performance, changes, pages and priority issues. Answers link to their evidence and never start a scan.</p><div className="flex flex-wrap gap-2">{["What changed in my search performance?", "Which pages get the most clicks?", "What should I fix next?", "When was my data updated?", "How fast is this website?", "How many enquiries were recorded?"].map((text) => <button key={text} disabled={busy} onClick={() => void ask(text)} className="min-h-9 rounded-md border border-border px-3 py-2 text-left text-xs hover:bg-workspace">{text}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); void ask(question); }} className="flex gap-2"><input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={700} aria-label="Your question" placeholder="What would you like to know?" className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm" /><Button type="submit" disabled={busy || question.trim().length < 3}><Send className="h-4 w-4" />{busy ? "Checking…" : "Ask"}</Button></form>{error && <p role="alert" className="text-sm text-critical">{error}</p>}{result?.scope === scope && <div className="space-y-4" aria-live="polite"><p className="text-sm leading-7">{result.answer}</p>{result.evidence.map((item, i) => <Link key={i} href={item.href} onClick={() => setOpen(false)} className="block rounded-md border border-border p-4 hover:bg-workspace"><h3 className="break-words text-sm font-bold text-purple">{item.title}</h3><p className="mt-2 text-sm leading-6">{item.detail}</p><p className="mt-2 text-xs text-muted">Evidence: {stamp(item.date)} · Open results →</p></Link>)}<p className="text-xs leading-5 text-muted">{result.note}</p></div>}</div></Drawer></>;
}
