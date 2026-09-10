import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { buildSiteCommand } from "@/platform/command-read";
import { getManagedSite } from "@/platform/site-store";
import { resolveReportBranding } from "./branding";
import { saveCommandRecord } from "@/platform/command-store";

const esc = (value: unknown) => String(value ?? "Not reported").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
export const shareHash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function reportHtml(siteSlug: string) {
  const [data, site] = await Promise.all([buildSiteCommand(siteSlug), getManagedSite(siteSlug)]);
  if (!site) throw new Error("Website not found.");
  const brand = resolveReportBranding(site), totals = data.bundle.datasets.gsc_totals, metrics = totals?.data as { clicks?: number; impressions?: number; ctr?: number; position?: number } | undefined;
  const metric = (value: number | undefined) => value == null ? "Not reported" : value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(site.name)} · SEO report</title><style>body{font-family:Arial,sans-serif;color:#292335;background:#fff;margin:0;padding:40px;line-height:1.5}main{max-width:960px;margin:auto}h1{font-size:32px;letter-spacing:-1px}h2{font-size:19px;border-bottom:2px solid ${brand.accent};padding-bottom:9px;margin-top:30px}p,td{font-size:12px}.muted{color:#6b6476}.metrics{display:flex;flex-wrap:wrap;gap:15px}.metric{background:#f6f3fa;border-radius:12px;padding:18px;flex:1;min-width:120px}.metric strong{display:block;font-size:27px}table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{text-align:left;padding:10px;border-bottom:1px solid #ece7f1;overflow-wrap:anywhere}th{font-size:11px}tr{break-inside:avoid}footer{margin-top:30px;font-size:10px;color:#716779}@media(max-width:600px){body{padding:20px}.metric{min-width:90px}}@page{size:A4;margin:12mm}</style></head><body><main><p class="muted">${esc(brand.brandName)} · ${esc(site.host)}</p><h1>Search performance and priorities</h1><p>Generated ${esc(data.generatedAt)}. Search period: ${esc(totals?.provenance.rangeStart)} to ${esc(totals?.provenance.rangeEnd)}. Collected ${esc(totals?.provenance.collectedAt)}.</p><div class="metrics"><div class="metric">Search clicks<strong>${metric(metrics?.clicks)}</strong></div><div class="metric">Impressions<strong>${metric(metrics?.impressions)}</strong></div><div class="metric">Average position<strong>${metric(metrics?.position)}</strong></div></div><p class="muted">Google Search Console measurements. Missing datasets are shown as unavailable. This report is an immutable snapshot, not a live promise of current data.</p><h2>Data coverage</h2><table><thead><tr><th>Source</th><th>Status</th><th>Last update</th></tr></thead><tbody>${data.health.map((row) => `<tr><td>${esc(row.label)}</td><td>${esc(row.state)}</td><td>${esc(row.updatedAt)}</td></tr>`).join("")}</tbody></table><h2>Leading pages</h2><table><thead><tr><th>Page</th><th>Clicks</th><th>Impressions</th></tr></thead><tbody>${data.pages.slice(0, 15).map((page) => `<tr><td>${esc(page.url)}</td><td>${page.clicks == null ? "Not reported" : metric(page.clicks)}</td><td>${page.impressions == null ? "Not reported" : metric(page.impressions)}</td></tr>`).join("")}</tbody></table><h2>Issues to investigate</h2>${data.causes.slice(0, 8).map((cause) => `<p><strong>${esc(cause.title)}</strong> · ${esc(cause.severity)} · ${cause.urls.length} affected URLs in saved evidence<br>${esc(cause.explanation)}</p>`).join("") || "<p>No grouped issues in the saved evidence.</p>"}<h2>Recent work</h2>${data.tasks.slice(0, 10).map((task) => `<p>${esc(task.title)} · ${esc(task.status)}</p>`).join("") || "<p>No saved work.</p>"}<footer>${esc(brand.footerText)} · Prepared by ${esc(brand.preparedBy)}</footer></main></body></html>`;
}
export async function renderReportPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--disable-dev-shm-usage", "--no-sandbox"] });
  try { const page = await browser.newPage({ javaScriptEnabled: false }); await page.route("**/*", (route) => route.abort()); await page.setContent(html, { waitUntil: "load" }); return await page.pdf({ format: "A4", printBackground: true, margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" } }); } finally { await browser.close(); }
}
export function reportBrowserAvailable() { return existsSync(process.env.PLAYWRIGHT_CHROMIUM_PATH || chromium.executablePath()); }
export async function archiveReport(siteSlug: string, actor: string) {
  const html = await reportHtml(siteSlug), pdf = reportBrowserAvailable() ? await renderReportPdf(html) : null;
  return saveCommandRecord(siteSlug, "workspace_report", crypto.randomUUID(), { html, ...(pdf ? { pdf: pdf.toString("base64") } : {}), title: "Search performance and priorities", generatedAt: new Date().toISOString() }, { actor, status: pdf ? "ready" : "queued" });
}
/** The existing browser worker renders saved HTML without fetching fresh or paid data. */
export async function processReportArchives(shouldStop: () => boolean = () => false) {
  if (process.env.QA_SYNTHETIC === "true" || !reportBrowserAvailable()) return;
  const records = schema.commandRecords;
  await db().update(records).set({ status: "queued", updatedAt: new Date() }).where(and(eq(records.kind, "workspace_report"), eq(records.status, "rendering"), lte(records.updatedAt, new Date(Date.now() - 15 * 60000))));
  const due = await db().select({ id: records.id }).from(records).where(and(eq(records.kind, "workspace_report"), eq(records.status, "queued"))).orderBy(records.createdAt).limit(10);
  for (const item of due) {
    if (shouldStop()) break;
    const [row] = await db().update(records).set({ status: "rendering", updatedAt: new Date() }).where(and(eq(records.id, item.id), eq(records.status, "queued"))).returning();
    if (!row) continue;
    const owns = and(eq(records.id, row.id), eq(records.updatedAt, row.updatedAt), eq(records.status, "rendering"));
    try {
      const pdf = await renderReportPdf(String(row.payload.html));
      await db().update(records).set({ status: "ready", updatedAt: new Date(), payload: sql`${records.payload} || ${JSON.stringify({ pdf: pdf.toString("base64"), renderedAt: new Date().toISOString(), error: null })}::jsonb` }).where(owns);
    } catch {
      await db().update(records).set({ status: "failed", updatedAt: new Date(), payload: sql`${records.payload} || '{"error":"PDF rendering failed. The saved report is retained; retry PDF generation."}'::jsonb` }).where(owns);
    }
  }
}
export async function reportArchives(siteSlug: string) {
  return db().select({ id: schema.commandRecords.id, recordKey: schema.commandRecords.recordKey, status: schema.commandRecords.status, createdAt: schema.commandRecords.createdAt }).from(schema.commandRecords).where(and(eq(schema.commandRecords.siteSlug, siteSlug), eq(schema.commandRecords.kind, "workspace_report"))).orderBy(desc(schema.commandRecords.createdAt)).limit(30);
}
export async function reportById(siteSlug: string, id: string) {
  const [row] = await db().select().from(schema.commandRecords).where(and(eq(schema.commandRecords.siteSlug, siteSlug), eq(schema.commandRecords.id, id), eq(schema.commandRecords.kind, "workspace_report")));
  return row;
}
export async function shareReport(siteSlug: string, reportId: string, actor: string) {
  const token = randomBytes(32).toString("base64url"), expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  await saveCommandRecord(siteSlug, "workspace_share", shareHash(token), { reportId, expiresAt }, { actor, status: "active" });
  return { token, expiresAt };
}
