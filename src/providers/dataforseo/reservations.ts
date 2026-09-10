import { sql } from "drizzle-orm";
import { db } from "@/db";
/** Paid research with an uncertain response consumes headroom until a matching ledger entry exists. */
export async function uncertainResearchSpend(month: string, options: { site?: string; endpoints?: string[]; excludeId?: string } = {}): Promise<number> {
  if (!process.env.DATABASE_URL || options.endpoints?.length === 0) return 0;
  const rows = await db().execute(sql`select coalesce(sum((unit->>'estimateUsd')::numeric),0)::float as total
    from command_records r cross join lateral jsonb_array_elements(case when jsonb_typeof(r.payload->'units') = 'array' then r.payload->'units' else '[]'::jsonb end) unit
    where r.kind like 'research_%' and unit->>'status' = 'running' and unit->>'chargeId' is not null
      and left(unit->>'startedAt',7) = ${month}
      and jsonb_typeof(unit->'estimateUsd') = 'number'
      ${options.site ? sql`and r.site_slug = ${options.site}` : sql``}
      ${options.excludeId ? sql`and unit->>'chargeId' <> ${options.excludeId}` : sql``}
      ${options.endpoints ? sql`and unit->>'endpoint' in (${sql.join(options.endpoints.map((e) => sql`${e}`), sql`,`)})` : sql``}
      and not exists(select 1 from provider_spend p where p.id::text = unit->>'chargeId')`);
  const result = rows as unknown as { total: number }[] | { rows: { total: number }[] };
  return Math.max(0, Number((Array.isArray(result) ? result : result.rows)[0]?.total ?? 0));
}
