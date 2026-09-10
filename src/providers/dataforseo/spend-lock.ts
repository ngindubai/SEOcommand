import { sql } from "drizzle-orm";
import { db } from "@/db";

let tail: Promise<unknown> = Promise.resolve();
/** Serialise provider budget checks across web/worker processes, and avoid pool starvation locally. */
export async function withProviderSpendLock<T>(action: () => Promise<T>): Promise<T> {
  const previous = tail;
  let release!: () => void;
  tail = new Promise<void>((resolve) => { release = resolve; });
  await previous.catch(() => undefined);
  try {
    if (!process.env.DATABASE_URL) return await action();
    return await db().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('dataforseo-provider-spend'))`);
      return await action();
    });
  } finally { release(); }
}
