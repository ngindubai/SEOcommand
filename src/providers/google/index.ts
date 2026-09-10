import type { DomainId, Provenance } from "@/lib/types";
import type { Envelope, GoogleProvider } from "../contracts";
import { GSC_SITE_MAP, GA4_PROPERTY_MAP, GSC_API, GSC_SCOPE, GSC_DATA_LAG_DAYS, GA4_DATA_LAG_DAYS } from "./config";
import { googleConfigured, getGoogleAccessToken } from "./auth";
import { gscTotals, gscBreakdown, gscStrikingDistance, gscMovers, shareOfMarket } from "./gsc";
import { ga4OrganicOverview, ga4LandingPages, ga4Channels } from "./ga4";

/**
 * First-party Google provider (Search Console + GA4). Server-side only.
 * Supplies the owned-site metrics DataForSEO cannot (clicks, impressions, CTR,
 * position, sessions, conversions, landing pages) via headless service-account
 * or refresh-token auth. Every response carries live GSC/GA4 provenance.
 */

function provenance(source: "google-search-console" | "google-analytics", days = 28): Provenance {
  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() - (source === "google-search-console" ? GSC_DATA_LAG_DAYS : GA4_DATA_LAG_DAYS));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    source,
    collectedAt: now.toISOString(),
    rangeStart: start.toISOString().slice(0, 10),
    rangeEnd: end.toISOString().slice(0, 10),
    location: "owned property",
    device: "desktop",
    freshness: "fresh",
    mode: "live",
  };
}

function gsc<T>(data: T, days = 28): Envelope<T> {
  return { data, provenance: provenance("google-search-console", days) };
}
function ga4<T>(data: T, days = 28): Envelope<T> {
  return { data, provenance: provenance("google-analytics", days) };
}

export function createGoogleProvider(): GoogleProvider {
  return {
    name: "Google Search Console + GA4",
    live: true,

    async gscTotals(domainId, days) {
      return gsc(await gscTotals(domainId, days), days);
    },
    async gscBreakdown(domainId, dimension, days, rowLimit) {
      return gsc(await gscBreakdown(domainId, dimension, days, rowLimit), days);
    },
    async gscStrikingDistance(domainId, days) {
      return gsc(await gscStrikingDistance(domainId, days), days);
    },
    async gscMovers(domainId, days) {
      return gsc(await gscMovers(domainId, days), days);
    },
    async shareOfMarket(domainId, days) {
      return gsc(await shareOfMarket(domainId, days), days);
    },

    async ga4OrganicOverview(domainId, days) {
      return ga4(await ga4OrganicOverview(domainId, days), days);
    },
    async ga4LandingPages(domainId, days) {
      return ga4(await ga4LandingPages(domainId, days), days);
    },
    async ga4Channels(domainId, days) {
      return ga4(await ga4Channels(domainId, days), days);
    },
  } as GoogleProvider;
}

export function googleAvailable(): boolean {
  return googleConfigured();
}

/**
 * Health probe for the go-live check: verifies Google credentials work by
 * listing Search Console properties (read-only), and reports the configured
 * property mappings. Never exposes secrets.
 */
export async function probeGoogle(): Promise<{
  configured: boolean;
  gscReachable?: boolean;
  propertiesVisible?: number;
  gscSiteMap?: Record<DomainId, string>;
  ga4PropertyMap?: Record<DomainId, string | null>;
  error?: string;
}> {
  if (!googleConfigured()) return { configured: false };
  try {
    const token = await getGoogleAccessToken([GSC_SCOPE]);
    const res = await fetch(`${GSC_API}/sites`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const ok = res.ok;
    const count = ok ? ((await res.json())?.siteEntry?.length ?? 0) : 0;
    return {
      configured: true,
      gscReachable: ok,
      propertiesVisible: ok ? count : undefined,
      gscSiteMap: GSC_SITE_MAP,
      ga4PropertyMap: GA4_PROPERTY_MAP,
      error: ok ? undefined : `Search Console API ${res.status}`,
    };
  } catch (err) {
    return { configured: true, error: err instanceof Error ? err.message : String(err) };
  }
}
