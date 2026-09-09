import { processPlatformJobs } from "./jobs";
import { syncDomain } from "@/sync/engine";

/** Run only an already authorised, persisted scan. Atomic claiming prevents duplicate calls. */
export async function runQueuedScan(jobId: string) {
  try {
    const summary = await processPlatformJobs(syncDomain, new Date(), jobId);
    console.log(`[scan-queue] ${jobId}: ${summary.completed} completed, ${summary.failed} failed.`);
  } catch (error) {
    console.error(`[scan-queue] ${jobId}: runner could not finish. The saved job remains recoverable.`, error instanceof Error ? error.message : String(error));
  }
}
