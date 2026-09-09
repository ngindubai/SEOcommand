import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { hasDatabase } from "@/sync/store";
import type { Severity } from "@/lib/types";
import { incidentState } from "@/lib/incident-state";

const notice = schema.portfolioNotifications;
// A root groups repeats, while distinct affected queries/pages keep their own identity.
const root = sql<string>`concat_ws(':', coalesce(${notice.siteSlug}, 'account'), ${notice.eventType}, case
  when ${notice.eventType} in ('site_unavailable', 'site_recovered', 'tls_risk', 'domain_expiry') then ''
  when ${notice.eventType} in ('collection_failed', 'collection_blocked', 'dataset_stale', 'dataset_empty', 'dataset_failed') then split_part(${notice.fingerprint}, ':', 3)
  else ${notice.title} end)`;

/** One latest decision per incident, plus its event count; history is kept in storage. */
export async function readNotificationGroups(siteSlugs?: string[] | null) {
  if (!hasDatabase()) return [];
  const visible = siteVisibility(siteSlugs);
  const slugs = siteSlugs;
  const [groups, checks, snapshots] = await Promise.all([
    db().selectDistinctOn([root], { item: notice, eventCount: sql<number>`count(*) over (partition by ${root})`.mapWith(Number) })
      .from(notice).where(visible).orderBy(root, desc(notice.createdAt), desc(notice.id)),
    db().selectDistinctOn([schema.reliabilityChecks.siteSlug]).from(schema.reliabilityChecks)
      .where(slugs ? slugs.length ? inArray(schema.reliabilityChecks.siteSlug, slugs) : sql`false` : undefined)
      .orderBy(schema.reliabilityChecks.siteSlug, desc(schema.reliabilityChecks.checkedAt)),
    db().selectDistinctOn([schema.datasetSnapshots.domainSlug, schema.datasetSnapshots.dataset], { site: schema.datasetSnapshots.domainSlug, dataset: schema.datasetSnapshots.dataset, createdAt: schema.datasetSnapshots.createdAt })
      .from(schema.datasetSnapshots).where(slugs ? slugs.length ? inArray(schema.datasetSnapshots.domainSlug, slugs) : sql`false` : undefined)
      .orderBy(schema.datasetSnapshots.domainSlug, schema.datasetSnapshots.dataset, desc(schema.datasetSnapshots.createdAt)),
  ]);
  const latestChecks = new Map(checks.map((check) => [check.siteSlug, check]));
  const collected = new Map(snapshots.map((snapshot) => [`${snapshot.site}:${snapshot.dataset}`, snapshot.createdAt]));
  return groups.map(({ item, eventCount }) => {
    const dataset = item.fingerprint.split(":")[2];
    const status = incidentState(item, latestChecks.get(item.siteSlug ?? ""), collected.get(`${item.siteSlug}:${dataset}`));
    return { ...item, status, eventCount, recovered: status === "resolved" && item.status !== "resolved" };
  }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createNotification(input: {
  siteSlug?: string | null;
  eventType: string;
  severity: Severity;
  title: string;
  detail?: string;
  actionUrl?: string;
  fingerprint: string;
}) {
  if (!hasDatabase()) return null;
  const [item] = await db()
    .insert(schema.portfolioNotifications)
    .values({
      siteSlug: input.siteSlug ?? null,
      eventType: input.eventType,
      severity: input.severity,
      title: input.title,
      detail: input.detail,
      actionUrl: input.actionUrl,
      fingerprint: input.fingerprint,
    })
    .onConflictDoNothing({ target: schema.portfolioNotifications.fingerprint })
    .returning();
  if (!item) return null;

  const rules = await db()
    .select()
    .from(schema.notificationRules)
    .where(
      and(
        eq(schema.notificationRules.enabled, true),
        input.siteSlug
          ? sql`(${schema.notificationRules.siteSlug} = ${input.siteSlug} OR ${schema.notificationRules.siteSlug} IS NULL)`
          : isNull(schema.notificationRules.siteSlug),
      ),
    );
  const deliveries: (typeof schema.notificationDeliveries.$inferInsert)[] = [];
  for (const rule of rules) {
    if (rule.eventTypes.length && !rule.eventTypes.includes(input.eventType)) continue;
    for (const channel of rule.channels.filter((value) => value !== "in_app")) {
      const prefix = `${channel}:`;
      const addressed = rule.recipients
        .filter((recipient) => recipient.startsWith(prefix))
        .map((recipient) => recipient.slice(prefix.length));
      const recipients = addressed.length ? addressed : [null];
      for (const recipient of recipients) {
        deliveries.push({ notificationId: item.id, channel, recipient });
      }
    }
  }
  if (deliveries.length) await db().insert(schema.notificationDeliveries).values(deliveries);
  return item;
}

function siteVisibility(siteSlugs?: string[] | null) {
  if (siteSlugs === undefined || siteSlugs === null) return undefined;
  return siteSlugs.length
    ? or(isNull(schema.portfolioNotifications.siteSlug), inArray(schema.portfolioNotifications.siteSlug, siteSlugs))
    : isNull(schema.portfolioNotifications.siteSlug);
}

export async function notificationInbox(limit = 100, siteSlugs?: string[] | null) {
  if (!hasDatabase()) return [];
  const query = db().select().from(schema.portfolioNotifications);
  const visible = siteVisibility(siteSlugs);
  return (visible ? query.where(visible) : query)
    .orderBy(desc(schema.portfolioNotifications.createdAt))
    .limit(Math.min(Math.max(limit, 1), 250));
}

export async function unreadNotificationCount(siteSlugs?: string[] | null): Promise<number> {
  return (await readNotificationGroups(siteSlugs)).filter((item) => !item.readAt && item.status === "open").length;
}

export async function readIncidentHistory(id: string, siteSlugs: string[] | null, offset = 0, limit = 20) {
  if (!hasDatabase()) return { items: [], total: 0 };
  const [incident] = await db().select({ key: root }).from(notice).where(and(eq(notice.id, id), siteVisibility(siteSlugs))).limit(1);
  if (!incident) return { items: [], total: 0 };
  const where = and(eq(root, incident.key), siteVisibility(siteSlugs));
  const [items, [count]] = await Promise.all([
    db().select().from(notice).where(where).orderBy(desc(notice.createdAt), desc(notice.id)).limit(limit).offset(offset),
    db().select({ total: sql<number>`count(*)`.mapWith(Number) }).from(notice).where(where),
  ]);
  return { items, total: count.total };
}
