import { NextResponse } from "next/server";
import { buildPortfolio } from "@/sync/bundle";
import { resolveGroupSiteSlugs } from "@/platform/site-store";
import { accessibleSiteSlugs } from "@/platform/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Portfolio headline aggregates from stored live snapshots. */
export async function GET(request: Request) {
  try {
    const groupId = new URL(request.url).searchParams.get("groupId");
    const requested = groupId ? await resolveGroupSiteSlugs(groupId) : null;
    const accessible = await accessibleSiteSlugs(request);
    const slugs = accessible === null
      ? requested ?? undefined
      : (requested ?? accessible).filter((slug) => accessible.includes(slug));
    const params = new URL(request.url).searchParams;
    const days = [7, 28, 90].includes(Number(params.get("days"))) ? Number(params.get("days")) : 28;
    const end = params.get("end");
    const validEnd = end && /^\d{4}-\d{2}-\d{2}$/.test(end) && Number.isFinite(Date.parse(end)) ? end : undefined;
    const portfolio = await buildPortfolio(slugs, days, validEnd);
    return NextResponse.json(portfolio);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build portfolio" },
      { status: 500 },
    );
  }
}
