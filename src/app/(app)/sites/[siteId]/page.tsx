import { redirect } from "next/navigation";

/** Existing website links retain their identity and open the canonical overview. */
export default async function SiteWorkspaceOverviewPage({ params, searchParams }: {
  params: Promise<{ siteId: string }>; searchParams: Promise<{ range?: string }>;
}) {
  const { siteId } = await params;
  const { range } = await searchParams;
  const query = new URLSearchParams({ site: siteId });
  if (range && ["7d", "28d", "90d"].includes(range)) query.set("range", range);
  redirect(`/portfolio?${query}`);
}
