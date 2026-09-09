import { accessibleSiteSlugs } from "./access";
import { listManagedSites, resolveGroupSiteSlugs } from "./site-store";
import { buildPortfolio, buildDomainBundle } from "@/sync/bundle";
import { hasDatabase, readLatestForDomains } from "@/sync/store";
import { keywordOverlap } from "@/lib/command-model";
import type { DomainLiveBundle } from "@/lib/live";

export async function visibleCommandSites(request: Request, scope: string) {
  const [all, granted] = await Promise.all([listManagedSites(), accessibleSiteSlugs(request)]);
  const ids = scope.startsWith("group:") ? await resolveGroupSiteSlugs(scope.slice(6)) : scope !== "portfolio" ? [scope] : null;
  return all.filter((site) => (granted === null || granted.includes(site.id)) && (!ids || ids.includes(site.id)));
}
export async function portfolioCommand(request: Request, scope = "portfolio", days = 28) {
  const sites = await visibleCommandSites(request, scope);
  const portfolio = await buildPortfolio(sites.map((site) => site.id), days);
  const map = hasDatabase() && process.env.QA_SYNTHETIC !== "true" && sites.length ? await readLatestForDomains(sites.map((site) => site.id)) : new Map();
  const entries = await Promise.all(sites.map(async (site) => {
    const bundle: DomainLiveBundle = process.env.QA_SYNTHETIC === "true" ? await buildDomainBundle(site.id) : { domainId: site.id, lastSync: null, datasets: {} };
    const keywords = map.get(site.id)?.find((row: { dataset: string }) => row.dataset === "keywords");
    if (keywords) bundle.datasets.keywords = { data: keywords.payload, capturedOn: keywords.capturedOn, provenance: keywords.provenance };
    return { site, bundle };
  }));
  return { ...portfolio, sites: sites.map((site) => ({ id: site.id, name: site.name, host: site.host })), overlap: keywordOverlap(entries), overlapCoverage: { included: entries.filter((row) => row.bundle.datasets.keywords).length, total: sites.length }, generatedAt: new Date().toISOString() };
}
