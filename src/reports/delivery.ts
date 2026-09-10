import { createHmac } from "node:crypto";
import { and, eq, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { nextReportRun, type ReportCadence } from "@/lib/report-schedule";
import { buildDomainBundle, buildPortfolio } from "@/sync/bundle";
import { getManagedSite, resolveGroupSiteSlugs } from "@/platform/site-store";
import { resolveReportBranding } from "@/reports/branding";
import { archiveReport, reportBrowserAvailable } from "./archive";
import { mailConfigured, sendMail } from "@/providers/google/mail";

export interface DeliverySummary {
  due: number;
  delivered: number;
  failed: number;
  skipped: number;
}

/**
 * Deliver due reports to an operator-owned webhook (Make, n8n, Zapier, etc.).
 * The webhook receives canonical live data plus recipients and can render/send
 * through the portfolio's chosen email provider. No third-party mail vendor is
 * hard-coded into the platform.
 */
export async function deliverDueReports(now = new Date(), nativeOnly = false): Promise<DeliverySummary> {
  const due = await db()
    .select()
    .from(schema.reportDeliverySchedules)
    .where(
      and(
        eq(schema.reportDeliverySchedules.enabled, true),
        lte(schema.reportDeliverySchedules.nextRun, now),
      ),
    );

  const webhook = process.env.REPORT_DELIVERY_WEBHOOK_URL;
  const native = { delivered: 0, failed: 0, handled: new Set<string>() };
  if (!webhook && reportBrowserAvailable() && mailConfigured() && process.env.QA_SYNTHETIC !== "true") {
    for (const schedule of due.filter((row) => row.domainSlug || row.scopeType === "site")) {
      native.handled.add(schedule.id);
      if (schedule.lastError?.startsWith("[manual review]")) { native.failed++; continue; }
      const site = schedule.domainSlug ?? schedule.scopeId!;
      // Claim this scheduled delivery before contacting Gmail. Interrupted or uncertain sends need manual review.
      const [claimed] = await db().update(schema.reportDeliverySchedules).set({ lastError: "[manual review] Delivery started; check Sent before retrying if interrupted.", updatedAt: now }).where(and(eq(schema.reportDeliverySchedules.id, schedule.id), eq(schema.reportDeliverySchedules.updatedAt, schedule.updatedAt))).returning();
      if (!claimed) continue;
      try {
        const report = await archiveReport(site, schedule.createdBy ?? "report-scheduler");
        await sendMail({ id: `${schedule.id}-${now.toISOString().slice(0, 10)}`, to: schedule.recipients, subject: schedule.templateName, text: `Your SEO performance report for ${site} is attached.`, attachment: Buffer.from(String(report.payload.pdf), "base64") });
        await db().update(schema.reportDeliverySchedules).set({ lastDelivered: now, lastError: null, nextRun: nextReportRun(schedule.cadence as ReportCadence, now), updatedAt: new Date() }).where(eq(schema.reportDeliverySchedules.id, schedule.id));
        native.delivered++;
      } catch (error) {
        native.failed++;
        await db().update(schema.reportDeliverySchedules).set({ lastError: `[manual review] ${error instanceof Error ? error.message : "Delivery failed"}`.slice(0, 500), updatedAt: new Date() }).where(eq(schema.reportDeliverySchedules.id, schedule.id));
      }
    }
  }
  if (!webhook || nativeOnly) return { due: due.length, delivered: native.delivered, failed: native.failed, skipped: due.length - native.handled.size };
  const url = new URL(webhook);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("REPORT_DELIVERY_WEBHOOK_URL must use HTTPS in production.");
  }

  let delivered = 0;
  let failed = 0;
  const portfolio = due.some((schedule) => !schedule.domainSlug) ? await buildPortfolio() : null;

  for (const schedule of due) {
    try {
      let data: unknown;
      let presentation: Record<string, unknown> = {
        documentVersion: "client-report-v2",
        brandName: "SEO Portfolio",
        accent: "#335CFF",
        secondaryColor: "#12B8C4",
      };
      if (schedule.scopeType === "group" && schedule.scopeId) {
        const siteSlugs = await resolveGroupSiteSlugs(schedule.scopeId);
        data = { scope: { type: "group", id: schedule.scopeId }, domains: await Promise.all(siteSlugs.map(buildDomainBundle)) };
      } else if (schedule.scopeType === "campaign" && schedule.scopeId) {
        const [campaign] = await db().select().from(schema.rankTrackingCampaigns).where(eq(schema.rankTrackingCampaigns.id, schedule.scopeId)).limit(1);
        const keywords = campaign ? await db().select().from(schema.rankTrackingKeywords).where(eq(schema.rankTrackingKeywords.campaignId, campaign.id)) : [];
        data = { scope: { type: "campaign", id: schedule.scopeId }, campaign, keywords };
      } else if (schedule.domainSlug || schedule.scopeType === "site") {
        const siteSlug = schedule.domainSlug ?? schedule.scopeId!;
        data = await buildDomainBundle(siteSlug);
        const site = await getManagedSite(siteSlug);
        if (site) presentation = { documentVersion: "client-report-v2", ...resolveReportBranding(site) };
      } else data = portfolio;
      const payload = JSON.stringify({
        event: "seo.report.due",
        schedule: {
          id: schedule.id,
          templateId: schedule.templateId,
          templateName: schedule.templateName,
          cadence: schedule.cadence,
          domainId: schedule.domainSlug,
          scopeType: schedule.scopeType,
          scopeId: schedule.scopeId,
          recipients: schedule.recipients,
          channels: schedule.channels,
          definition: schedule.definition,
          format: schedule.format,
        },
        generatedAt: now.toISOString(),
        presentation,
        data,
      });
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (process.env.REPORT_WEBHOOK_SECRET) {
        headers["x-orwell-signature"] = `sha256=${createHmac("sha256", process.env.REPORT_WEBHOOK_SECRET)
          .update(payload)
          .digest("hex")}`;
      }
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}.`);

      await db()
        .update(schema.reportDeliverySchedules)
        .set({
          lastDelivered: now,
          lastError: null,
          nextRun: nextReportRun(schedule.cadence as ReportCadence, now),
          updatedAt: now,
        })
        .where(eq(schema.reportDeliverySchedules.id, schedule.id));
      delivered++;
    } catch (error) {
      failed++;
      await db()
        .update(schema.reportDeliverySchedules)
        .set({
          lastError: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
          updatedAt: now,
        })
        .where(eq(schema.reportDeliverySchedules.id, schedule.id));
    }
  }

  return { due: due.length, delivered, failed, skipped: 0 };
}
