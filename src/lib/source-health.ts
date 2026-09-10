import type { DomainLiveBundle } from "./live";

export function sourceHealth(bundle: DomainLiveBundle, now = Date.now()) {
  const ds = bundle.datasets;
  const sources = [
    { label: "Search Console", data: ds.gsc_timeseries ?? ds.gsc_totals, days: 4, through: ds.gsc_timeseries?.data.map((row) => row.date).sort().at(-1) ?? ds.gsc_totals?.provenance.rangeEnd },
    { label: "Google Analytics", data: ds.ga4_dashboard ?? ds.ga4_overview, days: 4, through: ds.ga4_dashboard?.data.endDate ?? ds.ga4_overview?.provenance.rangeEnd },
    { label: "Keywords", data: ds.keywords, days: 8 },
    { label: "Site audit", data: ds.onpage, days: 31 },
    { label: "Backlinks", data: ds.backlinks, days: 31 },
  ];
  return sources.map((source) => {
    const collectedAt = source.data?.provenance.collectedAt ?? null;
    const through = source.through ?? null;
    const stale = collectedAt && (!Number.isFinite(Date.parse(collectedAt)) || now - Date.parse(collectedAt) > source.days * 86400000 || (through && now - Date.parse(through) > (source.days + 1) * 86400000));
    return { label: source.label, state: !collectedAt ? "missing" as const : stale ? "stale" as const : "ready" as const, collectedAt, through };
  });
}
