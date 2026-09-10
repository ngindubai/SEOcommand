import type { GscTimeseriesPoint } from "./live";

export interface SessionDay {
  date: string;
  sessions: number;
  engagedSessions: number;
  views: number;
  conversions: number;
}
export interface Ga4Dashboard {
  startDate: string;
  endDate: string;
  breakdownStartDate: string;
  domainIds: string[];
  series: SessionDay[];
  /** True only after a successful, untruncated daily report. */
  completeDateRange?: boolean;
  qualityNote?: string;
  countries: { code: string; country: string; sessions: number }[];
  pages: { domainId: string; title: string; host: string; path: string; views: number }[];
}

export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Anchor the range to the latest captured day, never invent missing dates. */
export function reportingWindow<T extends { date: string }>(rows: T[], days: number, endDate?: string) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const end = endDate ?? sorted.at(-1)?.date;
  if (!end) return { current: [] as T[], previous: [] as T[], start: null, end: null, availableDays: 0, comparable: false };
  const start = shiftDate(end, 1 - days);
  const previousStart = shiftDate(start, -days);
  const current = sorted.filter((r) => r.date >= start && r.date <= end);
  const previous = sorted.filter((r) => r.date >= previousStart && r.date < start);
  const availableDays = new Set(current.map((r) => r.date)).size;
  return { current, previous, start, end, availableDays, comparable: availableDays === days && new Set(previous.map((r) => r.date)).size === days };
}

export function searchSummary(rows: GscTimeseriesPoint[]) {
  if (!rows.length) return null;
  const clicks = rows.reduce((sum, r) => sum + r.clicks, 0);
  const impressions = rows.reduce((sum, r) => sum + r.impressions, 0);
  return { clicks, impressions, position: impressions ? rows.reduce((sum, r) => sum + r.position * r.impressions, 0) / impressions : null };
}

export function sessionSummary(rows: SessionDay[]) {
  if (!rows.length) return null;
  const sessions = rows.reduce((sum, r) => sum + r.sessions, 0);
  const engaged = rows.reduce((sum, r) => sum + r.engagedSessions, 0);
  const views = rows.reduce((sum, r) => sum + r.views, 0);
  const conversions = rows.reduce((sum, r) => sum + r.conversions, 0);
  return { sessions, engaged, engagementRate: sessions ? engaged / sessions * 100 : 0, viewsPerSession: sessions ? views / sessions : 0, conversions };
}

export function percentageChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return (current - previous) / previous * 100;
}

/** Dates omitted by a complete GA4 date report represent no recorded activity.
 * This does not verify that the website tracking tag was working. */
export function analyticsDays(data: Ga4Dashboard): SessionDay[] {
  if (!data.completeDateRange) return data.series;
  const span = (Date.parse(data.endDate) - Date.parse(data.startDate)) / 86_400_000;
  if (!Number.isInteger(span) || span < 0 || span > 366) return data.series;
  const byDate = new Map(data.series.map((row) => [row.date, row]));
  return Array.from({ length: span + 1 }, (_, i) => {
    const date = shiftDate(data.startDate, i);
    return byDate.get(date) ?? { date, sessions: 0, engagedSessions: 0, views: 0, conversions: 0 };
  });
}

/** Only combine matching reporting windows; delayed properties remain visibly absent. */
export function mergeDashboardData(parts: Ga4Dashboard[]): Ga4Dashboard | undefined {
  const latest = [...parts].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  if (!latest) return undefined;
  const included = parts.filter((p) => p.startDate === latest.startDate && p.endDate === latest.endDate && p.breakdownStartDate === latest.breakdownStartDate).map((part) => ({ ...part, series: analyticsDays(part) }));
  const days = new Map<string, SessionDay>();
  const countries = new Map<string, Ga4Dashboard["countries"][number]>();
  for (const part of included) {
    for (const row of part.series) {
      const previous = days.get(row.date) ?? { date: row.date, sessions: 0, engagedSessions: 0, views: 0, conversions: 0 };
      days.set(row.date, { date: row.date, sessions: previous.sessions + row.sessions, engagedSessions: previous.engagedSessions + row.engagedSessions, views: previous.views + row.views, conversions: previous.conversions + row.conversions });
    }
    for (const row of part.countries) {
      countries.set(row.code, { ...row, sessions: row.sessions + (countries.get(row.code)?.sessions ?? 0) });
    }
  }
  return { ...latest, completeDateRange: included.every((part) => part.completeDateRange), qualityNote: included.find((part) => part.qualityNote)?.qualityNote, domainIds: [...new Set(included.flatMap((p) => p.domainIds))], series: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)), countries: [...countries.values()].sort((a, b) => b.sessions - a.sessions), pages: included.flatMap((p) => p.pages).sort((a, b) => b.views - a.views) };
}
