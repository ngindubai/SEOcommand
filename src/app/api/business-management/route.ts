import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { safeEvidenceUrl } from "@/lib/research-evidence";
import { db, schema } from "@/db";
import { canAccessSite, hasPermission } from "@/platform/access";
import { saveCommandRecord } from "@/platform/command-store";
import { businessConfigured, businessRequest, compareListing } from "@/providers/google/business";
export const runtime = "nodejs";
const records = schema.commandRecords;
export async function GET(request: Request) {
  const site = new URL(request.url).searchParams.get("site") ?? "";
  if (!await canAccessSite(request, site)) return NextResponse.json({ error: "Website access required." }, { status: 403 });
  if (process.env.QA_SYNTHETIC === "true") return NextResponse.json({ businesses: [], records: [], connected: false });
  const businesses = await db().select({ id: schema.localSeoLocations.id, name: schema.localSeoLocations.name, address: schema.localSeoLocations.address }).from(schema.localSeoLocations).where(eq(schema.localSeoLocations.siteSlug, site));
  const rows = await db().select().from(records).where(and(eq(records.siteSlug, site), inArray(records.kind, ["workspace_business", "workspace_business_reviews", "workspace_reply_draft", "workspace_listing"]))).orderBy(desc(records.updatedAt)).limit(100);
  return NextResponse.json({ businesses, records: rows, connected: businessConfigured() });
}
const inputSchema = z.object({ action: z.enum(["connect", "refresh", "profile", "reply_draft", "reply_publish", "listing"]), site: z.string().min(1).max(120), businessId: z.string().uuid(), account: z.string().regex(/^accounts\/\d+$/).optional(), location: z.string().regex(/^locations\/\d+$/).optional(), title: z.string().trim().min(1).max(200).optional(), phone: z.string().max(50).optional(), website: z.string().url().max(2000).refine((value) => !!safeEvidenceUrl(value), "Use an HTTP or HTTPS URL without credentials.").optional(), reviewId: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200).optional(), reply: z.string().trim().min(1).max(4096).optional(), sourceUrl: z.string().url().max(2000).refine((value) => !!safeEvidenceUrl(value), "Use an HTTP or HTTPS URL without credentials.").optional(), observed: z.object({ name: z.string().max(200), address: z.string().max(1000), phone: z.string().max(50) }).optional() });
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the business details." }, { status: 400 });
  const input = parsed.data;
  if (!await canAccessSite(request, input.site) || !await hasPermission(request, ["connect", "profile"].includes(input.action) ? "manage_connectors" : "manage_content", input.site)) return NextResponse.json({ error: "Business management access required." }, { status: 403 });
  if (process.env.QA_SYNTHETIC === "true") return NextResponse.json({ error: "Business changes are disabled in preview." }, { status: 409 });
  try {
    const [business] = await db().select().from(schema.localSeoLocations).where(and(eq(schema.localSeoLocations.siteSlug, input.site), eq(schema.localSeoLocations.id, input.businessId)));
    if (!business) throw new Error("Choose a local business on this website.");
    const [connection] = await db().select().from(records).where(and(eq(records.siteSlug, input.site), eq(records.kind, "workspace_business"), eq(records.recordKey, business.id)));
    if (input.action === "connect") {
      if (!business.placeId) throw new Error("Add this business's Place ID in its local location settings first.");
      let account = input.account, location = input.location;
      if (!account || !location) {
        const accounts = await businessRequest("accounts?pageSize=20", { accounts: true });
        for (const candidate of (accounts.accounts as { name: string }[] ?? [])) {
          const locations = await businessRequest(`${candidate.name}/locations?readMask=name,title,metadata&pageSize=100`, { information: true });
          const match = (locations.locations as { name: string; metadata?: { placeId?: string } }[] ?? []).find((row) => row.metadata?.placeId === business.placeId);
          if (match) { account = candidate.name; location = match.name; break; }
        }
      }
      if (!account || !location) throw new Error("No matching profile was found in the connected Google account (first 20 accounts and 100 locations per account). Check that this account manages the saved Place ID.");
      const profile = await businessRequest(`${location}?readMask=title,storefrontAddress,phoneNumbers,websiteUri,metadata`, { information: true });
      if ((profile.metadata as { placeId?: string } | undefined)?.placeId !== business.placeId) throw new Error("That Google location does not match this business's saved Place ID.");
      await saveCommandRecord(input.site, "workspace_business", business.id, { account, location, profile, checkedAt: new Date().toISOString() });
    } else if (input.action === "listing") {
      if (!input.sourceUrl || !input.observed) throw new Error("Add the listing URL and observed business details.");
      const profile = connection?.payload.profile as { phoneNumbers?: { primaryPhone?: string } } | undefined;
      const expected = { name: business.name, address: business.address ?? "", phone: profile?.phoneNumbers?.primaryPhone ?? "" };
      await saveCommandRecord(input.site, "workspace_listing", crypto.randomUUID(), { businessId: business.id, sourceUrl: input.sourceUrl, observed: input.observed, expected, comparison: compareListing(expected, input.observed), method: "Manually recorded listing evidence; normalised text comparison", checkedAt: new Date().toISOString() });
    } else {
      const account = String(connection?.payload.account ?? ""), location = String(connection?.payload.location ?? "");
      if (!/^accounts\/\d+$/.test(account) || !/^locations\/\d+$/.test(location)) throw new Error("Link this business to its authorised Google location first.");
      if (input.action === "refresh") {
        const reviews: unknown[] = []; let pageToken = "";
        for (let page = 0; page < 4; page++) { const response = await businessRequest(`${account}/${location}/reviews?pageSize=50&orderBy=updateTime%20desc${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`); reviews.push(...(Array.isArray(response.reviews) ? response.reviews : [])); pageToken = typeof response.nextPageToken === "string" ? response.nextPageToken : ""; if (!pageToken) break; }
        await saveCommandRecord(input.site, "workspace_business_reviews", business.id, { reviews, checkedAt: new Date().toISOString(), moreAvailable: !!pageToken });
      } else if (input.action === "profile") {
        if (!input.title || !input.phone || !input.website) throw new Error("Review the business name, phone and website before publishing.");
        const profile = await businessRequest(`${location}?updateMask=title,phoneNumbers.primaryPhone,websiteUri`, { information: true, method: "PATCH", body: { title: input.title, phoneNumbers: { primaryPhone: input.phone }, websiteUri: input.website } });
        await saveCommandRecord(input.site, "workspace_business", business.id, { ...connection!.payload, profile, checkedAt: new Date().toISOString() });
      } else {
        if (!input.reviewId || !input.reply) throw new Error("Choose a saved review and write a reply.");
        const [savedReviews] = await db().select().from(records).where(and(eq(records.siteSlug, input.site), eq(records.kind, "workspace_business_reviews"), eq(records.recordKey, business.id)));
        if (!(savedReviews?.payload.reviews as { reviewId: string }[] | undefined)?.some((r) => r.reviewId === input.reviewId)) throw new Error("Refresh the business's reviews before replying.");
        const key = `${business.id}:${input.reviewId}`;
        if (input.action === "reply_publish") {
          const [draft] = await db().select().from(records).where(and(eq(records.siteSlug, input.site), eq(records.kind, "workspace_reply_draft"), eq(records.recordKey, key)));
          if (draft?.payload.reply !== input.reply) throw new Error("Save this exact reply as a draft before publishing.");
          await businessRequest(`${account}/${location}/reviews/${input.reviewId}/reply`, { method: "PUT", body: { comment: input.reply } });
        }
        await saveCommandRecord(input.site, "workspace_reply_draft", key, { businessId: business.id, reviewId: input.reviewId, reply: input.reply }, { status: input.action === "reply_publish" ? "published" : "draft" });
      }
    }
    return NextResponse.json({ message: input.action === "reply_publish" ? "Reply published to Google." : input.action === "profile" ? "Business profile update submitted to Google." : "Business evidence saved." });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Business request failed." }, { status: 400 }); }
}
