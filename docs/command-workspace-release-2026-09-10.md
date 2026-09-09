# Connected SEO Command release — 10 September 2026

The original colour variables, dashboard section colours, orange logo and Manrope font are preserved. New views use the existing palette.

## The 16 features

| Feature | Where to find it |
| --- | --- |
| Data health | Overview summary; Health → Grouped issues has collection dates, data periods, connection status and recovery links. |
| Portfolio briefing | Portfolio gains/losses with coverage; website overview adds page-level click changes and evidence links. |
| Unified page view | Pages: search, open a URL and inspect search metrics, Analytics events, rankings, backlink samples, technical evidence and linked work. |
| Next actions | Website overview: at most three priorities, with recommendations connected to the existing work approval drawer. |
| Chart timeline | Optional overview chart annotations; Performance insights → Change timeline includes recorded changes and shipped work. |
| Business results | Performance insights → Business results: explicitly mapped GA4 enquiries, bookings and qualified-lead events by page and period. |
| Google indexing | Health → Google indexing; per-URL saved inspections and separate Google crawl/inspection dates. |
| Internal links | Pages: suggested source, target and anchor from saved crawl and search evidence; review into existing work. |
| Brand segmentation | Performance insights → Brand & non-brand: editable aliases, query classification and coverage. |
| Cross-website overlap | Websites comparison link; Performance insights → Website overlap, matching recorded keyword markets. |
| Important-page watchlist | Pages watch buttons; Health → Watchlist with daily HTTP/HTML checks, history and in-app alerts. |
| Bulk scan plans | Websites and Scan Centre: website/module selection, cost preview, once/daily/weekly/30-day schedule, saved plans and pause. |
| Ask SEO Command | Header: supported saved-data questions, current website/portfolio scope, evidence links and dates. |
| Launch/migration checks | Health → Launch checks: save baseline, collect new evidence, compare and create follow-up work. |
| Underlying causes | Health → Grouped issues: suspected cause, confidence, distinct evidenced URLs and one investigation with expandable findings. |
| Website speed | Health → Speed, Pages detail and Scan Centre: mobile/desktop PageSpeed tests, lab metrics, opportunities, optional field measurements and history. |

## UI improvements

Websites opens with performance, data readiness and next actions; management remains a secondary view. The website overview removes repeated identity and its redundant one-row website table. One scope picker drives sidebar links and local tool tabs. The mobile header is compact and page check URLs get their own line. Scan Centre uses aligned rows with last update, next planned run, costs and result links; selection starts empty, review precedes collection, and current activity is separate from history. Page details retain website and search context. Stronger headings and spacing use the existing colour tokens.

## Data, scheduling and integration behaviour

One additive command_records table holds preferences, watch settings, plans, timeline entries, baselines and check history. No existing table is dropped, reseeded or replaced. Previous datasets, credentials, approved budgets and workflow items remain in their original tables. Simultaneous preference updates merge safely; checks use atomic claims and deduplication; each tool retains a separate recent-history window without deleting older records.

The existing hourly operations service dispatches plans and daily watches. Schedule times are due times picked up by that worker, not exact-to-the-minute promises. The existing paid scan engine enforces website and $200 monthly portfolio limits; no limits are raised. New watch alerts are in-app only. Adding this release does not automatically enrol websites in new paid plans.

Business results require explicit mapping of existing GA4 event names to the three categories. Counts are recorded event occurrences, not independently verified unique people or revenue. Google indexing requires existing Search Console access to the configured property. Speed uses PageSpeed Insights, preferring PAGESPEED_API_KEY when configured and otherwise using the existing Google connection with the documented openid scope. Anonymous requests are used only without either credential. Google must allow PageSpeed access and quota on the associated project. Missing field data is shown as unavailable; no INP is inferred from a lab test. Watch checks read HTTP/HTML and cannot verify browser-only or consent-gated tracking execution. Internal links require completed crawl edges, titles and search evidence. Suspected causes and timeline correlations are investigation aids.

Ask SEO Command supports the displayed question categories using saved evidence; unsupported questions receive an honest limitation. It does not call an external language model or launch scans.

## Validation

266 tests passed across 57 files, including a rehearsal of all migrations against a populated PostgreSQL-compatible test database, access boundaries, concurrent writes/claims, schedule permissions, cost review, retained history, URL safety and collector response handling. TypeScript, ESLint and production build pass. Representative desktop/phone browser checks cover selected-site navigation, page details/watch controls, grouped investigations, saved answers and reviewed plans. Provider collectors are tested with fixtures; routine QA makes no paid provider calls.

Deployment receipt is maintained in the task outputs after release verification.
