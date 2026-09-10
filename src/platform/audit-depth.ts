type InternationalPage = { url: string; finalUrl: string | null; statusCode: number | null; indexable: boolean; canonical: string | null; hreflang: Record<string, string>; issues: string[] };
const key = (value: string) => { try { const url = new URL(value); url.hash = ""; return url.toString(); } catch { return value; } };
export function internationalChecks(pages: InternationalPage[]) {
  const indexed = new Map(pages.flatMap((page) => [[key(page.url), page], ...(page.finalUrl ? [[key(page.finalUrl), page] as const] : [])] as [string, InternationalPage][]));
  let checked = 0, unchecked = 0;
  for (const page of pages) for (const [language, destination] of Object.entries(page.hreflang)) {
    if (!/^(?:x-default|[a-z]{2,3}(?:-[a-z]{4})?(?:-[a-z]{2}|-\d{3})?)$/i.test(language)) page.issues.push("hreflang_invalid_code_format");
    let valid = true; try { valid = ["http:", "https:"].includes(new URL(destination).protocol); } catch { valid = false; }
    if (!valid) { page.issues.push("hreflang_invalid_url"); continue; }
    const target = indexed.get(key(destination));
    if (!target) { unchecked++; continue; }
    checked++;
    if (target.statusCode != null && target.statusCode >= 400) page.issues.push("hreflang_target_http_error");
    if (!target.indexable) page.issues.push("hreflang_target_not_indexable");
    if (target.canonical && key(target.canonical) !== key(target.finalUrl ?? target.url)) page.issues.push("hreflang_target_noncanonical");
    if (!Object.values(target.hreflang).some((value) => key(value) === key(page.finalUrl ?? page.url))) page.issues.push("hreflang_missing_return_link");
    page.issues = [...new Set(page.issues)];
  }
  return { hreflangChecked: checked, hreflangOutsideCrawl: unchecked };
}
/** Structural checks, not a promise of Google rich-result eligibility. */
export function structuredDataIssues(scripts: string[]): string[] {
  const issues = new Set<string>();
  const visit = (value: unknown, context: boolean, root: boolean) => {
    if (Array.isArray(value)) { value.forEach((v) => visit(v, context, root)); return; }
    if (!value || typeof value !== "object") { if (root) issues.add("schema_invalid_root"); return; }
    const node = value as Record<string, unknown>;
    const hasContext = context || !!node["@context"];
    if (root && !hasContext) issues.add("schema_missing_context");
    const types = typeof node["@type"] === "string" ? [node["@type"]] : Array.isArray(node["@type"]) ? node["@type"] : [];
    if (root && !types.length && !Array.isArray(node["@graph"])) issues.add("schema_missing_type");
    if (types.includes("Product") && !node.name) issues.add("schema_product_missing_name");
    if (types.includes("Product") && !node.offers && !node.review && !node.aggregateRating) issues.add("schema_product_missing_offer_or_review");
    if (types.includes("FAQPage") && !Array.isArray(node.mainEntity)) issues.add("schema_faq_missing_questions");
    if (types.includes("Question") && !node.acceptedAnswer) issues.add("schema_question_missing_answer");
    if (types.includes("BreadcrumbList") && !Array.isArray(node.itemListElement)) issues.add("schema_breadcrumb_missing_items");
    if (types.includes("ListItem") && (!node.position || (!node.name && !(node.item && typeof node.item === "object" && "name" in node.item && node.item.name)))) issues.add("schema_list_item_missing_position_or_name");
    if (types.some((type) => ["LocalBusiness", "Organization"].includes(String(type))) && !node.name) issues.add("schema_business_missing_name");
    if (node.aggregateRating && typeof node.aggregateRating === "object") { const rating = node.aggregateRating as Record<string, unknown>; if (rating.ratingValue == null || (rating.reviewCount == null && rating.ratingCount == null)) issues.add("schema_rating_missing_value_or_count"); }
    for (const [field, child] of Object.entries(node)) if (!field.startsWith("@") && child && typeof child === "object") visit(child, hasContext, false);
    if (Array.isArray(node["@graph"])) node["@graph"].forEach((child) => visit(child, hasContext, true));
  };
  for (const script of scripts) { try { visit(JSON.parse(script), false, true); } catch { issues.add("invalid_json_ld"); } }
  return [...issues];
}
export function excludedFromCrawl(url: string, prefixes: string[]): boolean {
  const path = new URL(url).pathname;
  return prefixes.some((prefix) => { const clean = prefix.replace(/\/$/, ""); return path === clean || path.startsWith(`${clean}/`); });
}
