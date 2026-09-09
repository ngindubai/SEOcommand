"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/** Native modal semantics provide focus containment, inert background and focus return. */
export function Modal({ open, onClose, title, children, className }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open, mounted]);
  if (!mounted || !open) return null;
  return createPortal(<dialog ref={ref} aria-label={title} aria-modal="true" tabIndex={-1}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const dialog = event.currentTarget;
      const elements = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')].filter((element) => element.getClientRects().length > 0 && element.tabIndex >= 0);
      const first = elements[0], last = elements.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    className={cn("fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 text-ink backdrop:bg-transparent", className)}>
    {children}
  </dialog>, document.body);
}
