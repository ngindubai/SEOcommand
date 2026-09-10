# SEO Command research expansion — 10 September 2026

## Agreed scope
All eight areas from the Semrush comparison, plus trends, broken backlink recovery, customer questions and full review analysis. Existing colours, Manrope, selected-website context and saved evidence are retained. This delivers a first usable version of each area, not a claim of feature-for-feature Semrush parity.

| Area | Implemented | Scope / activation |
| --- | --- | --- |
| Keyword planning | Numeric and intent filters; website-relative difficulty benchmark; complete-link SERP clusters; editable topic groups and page assignments | At least five current top-ten keywords with KD for a benchmark; estimate, not ranking probability. Clusters require three common organic URLs for every keyword pair. |
| Competitor research | Up to 1,000 ranking keywords and 100 pages per domain; exact page/folder keyword filters; twelve full months of ranking and traffic estimates; selectable date comparisons | Four domains per collection. Provider estimates remain separate from Search Console measurements. |
| Content optimisation | Internal Markdown draft; revision protection; heading/phrase/readability analysis; comparison of up to three public competitor pages | English readability is approximate. HTML benchmark is bounded to 2 MB per page. No publishing to a CMS. |
| Technical audit | Hreflang format, return links, target indexability/canonical/status checks; selected JSON-LD structural checks; saved path exclusions; coverage counts | Inspects the rendered crawl sample, not unlimited crawling or Google's full rich-results eligibility rules. Off-crawl alternates remain unverified. |
| Outreach | Sent Gmail thread reply history; in-app follow-up reminders; acquired-link verification; deeper backlink evidence and filters | Gmail consent needed for native mail/replies. Link verification is an explicit recheck of returned HTML; blocked pages are unknown. Existing delivery webhook remains supported. |
| AI intelligence | Indexed prompt/answer/citation discovery; matched prompt/date/sample comparisons; human sentiment review linked to an answer hash; modelled AI demand history | Indexed ChatGPT mentions support US only. Cohort matching does not control all model/geography differences. AI demand is explicitly modelled, never relabelled Google keyword volume. |
| Reporting | Native PDF generator; saved PDF/HTML archives; 30-day unguessable client links, revocation; native Gmail delivery and site report schedules | Gmail account consent needed. The web service saves HTML immediately and queues PDF rendering on the existing hourly browser worker, with progress and retry controls. Native scheduled PDF covers website reports; existing external delivery remains for other scopes/formats. Failed/uncertain delivery needs review, without automatic resend. |
| Local business management | Match owned Google profile by saved Place ID; retrieve up to 200 owned reviews; draft/review/publish replies; review/publish name, phone and website edits; directory consistency evidence | Business Profile API approval and business.manage consent needed. Directory observations are manually recorded and clearly labelled. No bulk distribution to directory networks. |
| Trends | Two years of relative interest; equal-window changes and peak months | Up to five keywords share a normalised request; scales across separate batches cannot be compared as absolute demand. |
| Broken backlinks | Up to 1,000 own-domain broken destination records, sorted by incoming links | Provider-reported errors require live verification before redirects or removal. |
| Customer questions | People Also Ask questions and source evidence with work creation | Search result sample at selected location, language and device. |
| Review analysis | Full review text, rating, timestamp, reported owner replies and suggested themes | Up to 100 newest public reviews per collection; rule-based English themes, not a claim of all-language sentiment accuracy. |

## Data and spending

- No migration, reset, seed, destructive update or history deletion. New records use `command_records`; drafts merge into existing workflow execution data.
- No new recurring paid research is enabled automatically. Every collection has a free estimate review, bounded requests and the existing site/category approvals and $200 portfolio monthly ceiling.
- Paid requests are serialized across processes. Every unit is checkpointed before and after the request. Paid research POSTs are not retried automatically.
- Review task IDs persist and are polled through free retrieval. Cancelling retains completed evidence, including an in-flight response.
- Unknown request outcomes reserve their estimate against headroom. They are not labelled actual spend. The charge ID correlates the reservation with `provider_spend.id`; a recorded charge removes the hold automatically. For an interrupted request without a ledger entry, an operator must reconcile the provider's task/charge history before clearing it. Starting another collection does not clear the hold.
- Paid estimates: footprint $0.19/domain (path only $0.15); history $0.15/domain; backlinks/recovery $0.07/domain; top-ten SERP $0.003/keyword; AI mentions $0.22/domain; AI demand $0.01 + $0.0001/keyword; trends $0.03 per five keywords; reviews $0.02/business. Actual provider-returned cost is recorded.
- Archived PDFs, research payloads and workspace operational records are excluded from the general overview history query.
- Public report links expose only the specifically shared immutable report. They expire after 30 days, can be revoked and disable scripts, external resources, forms and indexing.

## Account activation

No messages, public profile changes or paid collections were sent during implementation or QA.

Native mail requires a dedicated, authorised mailbox and these server-only settings on the web service and operations worker: `MAIL_GOOGLE_CLIENT_ID`, `MAIL_GOOGLE_CLIENT_SECRET`, `MAIL_GOOGLE_REFRESH_TOKEN`, `MAIL_FROM`. OAuth consent must include `gmail.send` and `gmail.readonly`. Existing analytics tokens are insufficient. Existing outreach/report webhooks take precedence when configured.

Google profile management requires an approved Business Profile API project, an account managing the exact saved Place IDs, and `BUSINESS_GOOGLE_CLIENT_ID`, `BUSINESS_GOOGLE_CLIENT_SECRET`, `BUSINESS_GOOGLE_REFRESH_TOKEN` with `business.manage` consent. The app does not request credentials in a chat or expose tokens to the browser. Account selection/consent is outstanding; connected controls remain disabled meanwhile.

## Verification

- Production build and lint passed.
- Final suite: 309 tests across 61 files.
- Database-backed tests cover concurrent queue/worker claims, free previews, no replay after interruption, saved review task retrieval, in-flight cancellation, reserved budget headroom, preservation of earlier snapshots, stale content revision rejection, existing brief preservation, same-site assignments, Google Place ID matching, unsafe URL rejection, share revocation and deduplicated report delivery.
- Browser checks: eleven affected sections load without page errors; four mobile views have no horizontal overflow; cost preview renders correctly. Additional populated evidence checks cover date selection, pagination, inspection and the work drawer.
- Native PDF function generated a valid offline PDF with all browser network requests blocked.
- Production baseline before release: 7,853 snapshots (`7f54bdf892d088843dcab5c8e40df9e2`), six workflow items (`c99a8c608683231957575dc462cb7ff0`), three command records (`c75cd4d4f78135bdb0ecee7874e4bf40`). Fingerprints hash full rows ordered by ID; verify again after deployment.

## API references checked

DataForSEO documentation: ranked keywords, relevant pages, historical rank overview, backlinks, domain pages summary, organic SERP, trends explore, indexed LLM mentions, AI keyword volumes and Google review task lifecycle. Google documentation: Gmail message send/thread retrieval and Business Profile accounts, locations, reviews and replies. Missing values stay unavailable; estimated/indexed/sampled evidence is labelled at the point of use.
