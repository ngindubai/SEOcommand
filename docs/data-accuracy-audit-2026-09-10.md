# SEO Command data accuracy audit — 10 September 2026

The stored search and tracked-ranking numbers reconcile with their saved source evidence, but several presentation and aggregation defects made the dashboard misleading. This release corrects those defects while preserving source records and the original colours.

## Verified against production records

- All 12 saved Search Console property totals reconcile exactly with clicks and impressions summed from their daily records for the dates the collector actually requested.
- Latest current search cohort: **347 clicks and 97,075 impressions**, 11 August–7 September, across **11 of 13 websites**. WarmHomeSchemeLoan is excluded because its latest search day is 18 August. Global Bus Rental has no saved Google search report.
- Latest Analytics daily sums: **803 organic sessions and 75 key events**, 13 August–9 September, across **12 properties**. These are sums of reported daily metrics, not independently counted visitors or sales.
- **358 of 358 matched tracked ranking rows** agree with the saved daily tracking table. Another 56 PestRemovalUSA rows are discovery snapshots rather than matching daily-tracking records and were not independently reconciled this way.
- Live connection probes succeeded: Google Search Console exposes 12 properties; DataForSEO authenticated successfully. A working connection does not prove every website's reports are current.

## Corrections

1. Search Console's historical date labels used collection dates and described a 29-day interval, while requests used a 28-day window ending two days earlier. Read-time compatibility corrects only this recognisable metadata signature; original snapshots remain untouched. New snapshots use the requested dates.
2. A stale property was forcing the whole portfolio search chart back to 18 August. The portfolio now uses properties with the latest available end date and retains that same cohort for the comparison. Excluded coverage is visible. Google page/query breakdowns and movers also exclude mismatched reporting periods.
3. Website summaries and portfolio API totals now use the dashboard's reporting calculations. Properties without aligned search coverage are not added as if current.
4. Successful Analytics reports with no date rows erased the whole portfolio daily chart. Successful full daily reports now retain no-recorded-activity dates and the property cohort. Historical quality flags were not stored, so those reports disclose this limitation and suppress comparison claims.
5. New legacy Analytics requests now use exactly 28 closed dates rather than including today in a 29-day request. Two UTC dates of lag keep the end day closed across Google property time zones. A requested 7-day view cannot silently reuse 28/29-day totals.
6. Source freshness is evaluated separately for Search Console, Analytics, keywords, audits and backlinks. An unrelated successful collection can no longer make all sources appear fresh. Older failed jobs cannot override a newer successful source collection.
7. Nine empty placeholder records across five websites were being counted as a backlink, referring domain or keyword. The DataForSEO adapter now handles items:null as an empty result. Read-time filtering removes impossible empty identities from displayed samples without deleting saved records.
8. Missing previous rankings and manufactured previous distribution counts are unavailable instead of implying zero change. Ambiguous historical equal-position comparisons are withheld.
9. Backlink cards explicitly identify fetched samples. Resolved issues are excluded from priority-issue totals. Search request dates, actual available search dates and Analytics dates are shown distinctly.

## Website reconciliation

Search columns below use each website's latest available 28-day daily window. The portfolio excludes the stale row rather than adding mismatched dates. Analytics is the daily sum for 13 August–9 September.

| Website | Search through | Clicks | Impressions | Organic sessions |
|---|---|---:|---:|---:|
| BusRentalGlobal | 2026-09-07 | 22 | 4,672 | 0 |
| CheckMyEnergyClaim | 2026-09-07 | 6 | 527 | 0 |
| CloseProtectionHire | 2026-09-07 | 49 | 4,950 | 100 |
| EnergyClaimHelpline.com | 2026-09-07 | 0 | 0 | 0 |
| EnergyClaimHelpline UK | 2026-09-07 | 7 | 1,001 | 0 |
| InsureCompare | 2026-09-07 | 38 | 14,406 | 60 |
| MoneyCompare | 2026-09-07 | 0 | 601 | 2 |
| MortgageCompare | 2026-09-07 | 224 | 70,051 | 487 |
| MyEnergyClaim | 2026-09-07 | 0 | 389 | 0 |
| PestRemovalUSA | 2026-09-07 | 1 | 145 | 2 |
| PetTransportGlobal | 2026-09-07 | 0 | 333 | 152 |
| WarmHomeSchemeLoan | 2026-08-18 | 2 | 682 | 0 |
| Global Bus Rental | No saved Google report | — | — | — |

## Remaining verification limits

- **Six Analytics properties report no activity in any channel:** BusRentalGlobal, CheckMyEnergyClaim, EnergyClaimHelpline.com, EnergyClaimHelpline UK, MyEnergyClaim and WarmHomeSchemeLoan. This does not establish zero real visitors. Tag installation, consent behaviour and property assignment need a separate tracking check.
- WarmHomeSchemeLoan's saved search data is stale. Its recent crawl jobs report DNS resolution failure for warmhomeschemeloan.co.uk. That is a separate site/collection problem; no domain settings were altered.
- Global Bus Rental has saved DataForSEO records but no Google datasets. Its missing Google metrics remain unavailable.
- Analytics session figures are estimates and can differ slightly when summed across days versus queried for a whole period. MortgageCompare: 487 daily-summed sessions versus 484 in the saved overview; InsureCompare: 60 versus 59. PetTransportGlobal's overview uses property-relative dates, while the dashboard used fixed UTC dates; the saved reports differ (156 versus 152). The exact property time zones were not retained, so the historical dashboard's latest day may still have been open in a US property. Future collections allow two UTC dates of lag. These were not force-adjusted to agree.
- No paid keyword, backlink or SERP refresh was performed for QA. Saved evidence consistency was checked; current search-engine rankings, complete backlink inventories, missing keyword metrics and provider-native estimates have not been independently certified.
- Business key events are not a verified lead count. Saved audit and backlink samples have limited coverage and their own collection dates. Historical Google sampling/threshold flags were not retained.

## Validation and preservation

Regression tests cover stale portfolio cohorts, zero-activity Analytics properties, exact report windows, per-source freshness, empty DataForSEO envelopes and unknown ranking comparisons. An isolated replay of the actual production Google snapshots passed independently calculated per-site and portfolio totals. 276 automated tests passed; type checking, lint and production build also passed before release.

At the pre-release audit checkpoint the database contained 7,853 dataset snapshots, 6 workflow items, 10 workflow-history entries and 3 command records, plus the existing registry and one custom website (13 visible websites). This release adds no migration and performs no production record rewrite, reset or paid scan.

## Primary documentation

- [Google Search Analytics query contract](https://developers.google.com/webmaster-tools/v1/searchanalytics/query): final data, requested date range, property versus page/query aggregation and row limitations.
- [Google Analytics report contract](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport): date rows, empty rows and report limits.
- [Google Analytics date ranges](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/DateRange): inclusive dates.
- [Google Analytics session estimates](https://support.google.com/analytics/answer/9191807): session counting and approximation.
- [DataForSEO ranked keyword contract](https://docs.dataforseo.com/v3/dataforseo_labs-google-ranked_keywords-live/): nullable previous positions.
