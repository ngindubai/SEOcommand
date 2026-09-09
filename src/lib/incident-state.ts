export interface IncidentEvent {
  eventType: string; status: string; createdAt: Date | string; snoozedUntil?: Date | string | null;
}
export interface ReliabilityEvidence {
  checkedAt: Date | string; available: boolean; tlsValid: boolean | null;
  tlsExpiresAt: Date | string | null; domainExpiresAt: Date | string | null;
}

/** Project a current incident without deleting or rewriting its historical events. */
export function incidentState(event: IncidentEvent, check?: ReliabilityEvidence, collectedAt?: Date | string, now = new Date()) {
  if (event.eventType === "site_recovered") return "resolved";
  if (["resolved", "dismissed"].includes(event.status)) return event.status;
  const newerCheck = check && new Date(check.checkedAt) >= new Date(event.createdAt);
  const beyond = (date: Date | string | null, days: number) => date != null && new Date(date).getTime() > now.getTime() + days * 86_400_000;
  if (newerCheck && (
    (event.eventType === "site_unavailable" && check.available) ||
    (event.eventType === "tls_risk" && check.tlsValid === true && beyond(check.tlsExpiresAt, 21)) ||
    (event.eventType === "domain_expiry" && beyond(check.domainExpiresAt, 45))
  )) return "resolved";
  if (["collection_failed", "collection_blocked"].includes(event.eventType) && collectedAt && new Date(collectedAt) > new Date(event.createdAt)) return "resolved";
  if (event.status === "snoozed" && event.snoozedUntil && new Date(event.snoozedUntil) <= now) return "open";
  return event.status;
}
