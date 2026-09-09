export function friendlyEvidenceMessage(detail: string): string {
  if (/browserType\.launch|Executable doesn.t exist.*playwright|Please update docker image/i.test(detail)) return "The technical crawler could not start because its browser runtime needs an update. This is separate from DataForSEO. The saved crawl will resume after the worker is repaired.";
  if (/payment required|insufficient (funds|balance)|402/i.test(detail)) return "The last collection could not run because provider credit was unavailable. Check the current account balance, then review and retry the affected collection.";
  if (/403|permission.denied|forbidden/i.test(detail)) return "The data source did not allow access to this property. Check the website’s property mapping and the connected account’s permissions.";
  if (/insert into|select .* from|DATABASE_URL|postgres|sql/i.test(detail)) return "This result could not be saved. Existing saved data is still available. Review the failed run before retrying.";
  if (/fetch failed|ECONN|timeout|timed out/i.test(detail)) return "The last check could not reach the service. Review the latest status and retry if the problem remains.";
  return detail.replace(/Expected every weekly\./g, "Expected weekly.").replace(/Expected every daily\./g, "Expected daily.");
}
export function EvidenceMessage({ detail }: { detail: string | null | undefined }) {
  if (!detail) return null;
  const message = friendlyEvidenceMessage(detail);
  return <div className="mt-2 text-sm leading-6 text-muted"><p>{message}</p>{message !== detail && <details className="mt-2 text-xs"><summary className="cursor-pointer font-medium">Technical details</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-workspace p-3 text-xs">{detail}</pre></details>}</div>;
}
