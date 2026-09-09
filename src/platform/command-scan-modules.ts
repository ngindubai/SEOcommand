import { commandRecords } from "./command-store";
import { queueCommandCheck, processCommandChecks } from "./command-jobs";
import type { ManagedSite, ScanModule } from "./types";

export async function runAdditionalModules(site: ManagedSite, modules: ScanModule[]) {
  if (!modules.some((module) => ["google", "speed", "indexing"].includes(module))) return;
  const records = await commandRecords(site.id);
  const requests: { kind: string; payload: Record<string, unknown> }[] = [];
  if (modules.includes("speed")) for (const device of ["mobile", "desktop"]) requests.push({ kind: "speed", payload: { url: `https://${site.host}/`, device } });
  if (modules.includes("indexing")) {
    const watched = records.filter((row) => row.kind === "watch" && row.status === "active").map((row) => String(row.payload.url));
    for (const url of (watched.length ? watched : [`https://${site.host}/`]).slice(0, 20)) requests.push({ kind: "indexing", payload: { url } });
  }
  const events = records.find((row) => row.kind === "settings")?.payload.businessEvents;
  if (modules.includes("google") && events && Object.keys(events).length) requests.push({ kind: "business", payload: {} });
  const failures: string[] = [];
  for (const request of requests) {
    const check = await queueCommandCheck(site.id, request.kind, request.payload);
    await processCommandChecks(check.id);
    const result = (await commandRecords(site.id)).find((row) => row.id === check.id);
    if (result?.status !== "completed") failures.push(`${request.kind}: ${String(result?.payload.error ?? "Check is still queued or running; review its saved status")}`);
  }
  if (failures.length) throw new Error(`Review required: ${failures.join("; ")}`);
}
