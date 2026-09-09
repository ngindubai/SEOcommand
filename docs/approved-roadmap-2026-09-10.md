# SEO Command — agreed feature roadmap

Recorded 10 September 2026 at the user's request.

## Current instruction and implementation status

The user wants all 14 features from the first two recommendation lists, plus grouping issues by underlying cause and a website speed test: **16 items total**. These form the approved implementation scope. The user explicitly wants to review UI/UX improvements **before making application changes**. The review is complete. The user subsequently authorised implementation of all 16 features and the recommended UI improvements, expressly retaining the original colour scheme. All 16 items have been implemented and verified locally; see the release notes for behaviour, setup requirements and deployment validation.

The remaining ideas from the third recommendation list are not included. The speed test is the user's separate explicit addition; include useful speed history within that feature, rather than counting it as a seventeenth item.

## Agreed scope

| ID | Feature | Intended behaviour |
| --- | --- | --- |
| 01 | Data health panel | Site and portfolio connection/data status, stale or missing data, failed scans, next scheduled refresh and direct recovery actions. Distinguish missing data from measured zero. |
| 02 | Portfolio briefing | Extend What changed into a concise summary of meaningful gains, losses and changes across websites, with date ranges, coverage and evidence links. |
| 03 | Unified page view | One URL view joining rankings, clicks, impressions, conversions, technical issues, backlinks and associated tasks. |
| 04 | Next recommended actions | Extend existing priority tasks to the top actions per site, with impact, effort, confidence, explanation and direct execution links. |
| 05 | Change timeline on charts | Annotate edits, fixes, migrations and shipped tasks; connect to existing Outcomes evidence without implying proven causation. |
| 06 | Leads and business performance | Show recorded enquiries, bookings and qualified leads by website and page where connected; distinguish measured results from estimates. |
| 07 | Google indexing tracker | Inspect important URLs using authorised Search Console access, storing reported index status, Google's last crawl and inspection timestamp; do not imply live indexability tests or instant indexing. |
| 08 | Internal link suggestions | Evidence-backed source URL, target URL and suggested anchor; accepted suggestions enter the existing task workflow. |
| 09 | Brand and non-brand performance | Configurable brand terms and aliases; separate query-based performance with visible classification and coverage limits. |
| 10 | Keyword overlap across websites | Extend existing within-site analysis across the portfolio; show overlapping queries, brands and intended targets, without treating every overlap as a problem. |
| 11 | Important-page watchlist | Closer monitoring of selected booking, enquiry and service URLs, including broken pages, redirects, content changes and indexing blocks. |
| 12 | Bulk scan plans | Select multiple websites, preview affected modules, schedule and cost, then save within existing approval and budget limits. |
| 13 | Ask SEO Command | Answer portfolio/site questions from authorised saved data, with dates and evidence links. Respect website permissions and never invent metrics. |
| 14 | Launch and migration checks | Compare before/after redirects, missing URLs, titles, indexing settings and tracking; create focused follow-up tasks. |
| 15 | Group issues by underlying cause | Group related findings under an evidence-backed suspected shared template or other cause. Show affected URLs, confidence, one investigation and expandable supporting findings; preserve history and avoid asserting unverified causation. |
| 16 | Website speed test | Test an authorised website/page on mobile and desktop; show performance results, useful timings, opportunities, history and collection time. Clearly separate simulated tests from real visitor measurements when available. Include in Health and Scan Centre, with a compact overview entry. |

## Established user preferences and constraints

- Keep the ORIGINAL colour values and selected aesthetic, orange branding and Manrope typography. The revised-colour preview was rejected. Improve hierarchy and navigation without adopting that preview palette.
- Keep sections distinct, headings clear and overview tasks compact.
- Sidebar links must be readable in an expanded menu; selected website context must persist through navigation.
- Site overview includes a compact Scan Centre entry. Module update dates already exist and should remain.
- Make the product feel connected and easy to navigate; avoid one new top-level tool for each roadmap item.
- Preserve every existing website, credential, setting, metric, history and workflow item. No resets/reseeding/replacement of production data.
- Keep DataForSEO as the paid SEO provider and preserve all spending ceilings. Normal QA must not incur paid provider calls.
- Publishing was authorised earlier in the task, but the current request expressly places UI/UX review before implementation. Do not interpret this roadmap as permission to skip that sequencing.

## Initial proposed homes (subject to UI/UX review)

- Overview: 01, 02, 04, 05, 06; compact entries to 11, 13, 16.
- Pages: 03, 08, 11, plus page-specific evidence from 07, 15, 16.
- Performance: 05, 06, 09; Keywords/competition: 10.
- Health: 07, 14, 15, 16, with existing audits and monitoring retained.
- Scan Centre: 01 and 12; collection controls for the relevant modules, including 07 and 16.
- Ask SEO Command: one contextual entry in the header using current scope.

This is a durable scope record, not a delivery estimate or a claim that integrations/data are ready.
