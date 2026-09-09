"use client";

import Link from "next/link";
import { Button, Card } from "@/components/ui/primitives";
import { useDomain } from "@/components/shell/domain-context";
import { hrefWithScope } from "@/lib/site-context";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { scope } = useDomain();
  return <Card className="mx-auto max-w-xl p-6"><h1 className="text-xl font-bold">This section couldn’t load</h1><p role="alert" className="mt-3 text-sm text-muted">Your saved websites, research and work are still available. Try this section again or return to your overview.</p><div className="mt-5 flex flex-wrap gap-3"><Button onClick={reset}>Try again</Button><Link className="rounded-md border border-border px-4 py-2 text-sm" href={hrefWithScope("/portfolio", scope)}>Return to overview</Link></div>{error.digest && <p className="mt-4 text-xs text-muted">Support reference: {error.digest}</p>}</Card>;
}
