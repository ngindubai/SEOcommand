"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDomain } from "./domain-context";
import { hrefWithScope } from "@/lib/site-context";
import { Bell } from "lucide-react";

export function NotificationBell() {
  const { scope } = useDomain();
  const [unread, setUnread] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => { fetch(`/api/notifications?scope=${encodeURIComponent(scope)}&limit=1`).then((response) => response.ok ? response.json() : null).then((body) => { if (active && body) setUnread(body.unread); }).catch(() => undefined); };
    setUnread(null); refresh();
    window.addEventListener("orwell:notifications-changed", refresh);
    return () => { active = false; window.removeEventListener("orwell:notifications-changed", refresh); };
  }, [scope]);
  return <Link href={hrefWithScope("/notifications", scope)} className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-workspace hover:text-ink" aria-label={unread == null ? "Notifications; checking unread incidents" : `${unread} unread incidents`}>
    <Bell className="h-4 w-4" />
    {unread != null && unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-critical px-1 text-center text-[12px] font-semibold leading-4 text-white">{unread > 99 ? "99+" : unread}</span>}
  </Link>;
}
