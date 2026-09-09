# SEO Command dashboard — selected Suggest direction

The portfolio landing page now uses the selected orange-and-white treatment with a compact icon rail, shared scope controls and the approved panel arrangement. Position Tracking contains audit health, tracked-keyword distribution and the top-keyword table. Search Overview and Sessions & Engagement sit beneath it. Geography and page titles complete the main dashboard, followed by the website comparison table.

## Approved branding and typography

The approved orange SEO Command logo is reused unchanged from the original transparent PNG. A shared logo component presents the compact mark in the icon rail and the full wordmark in expanded navigation, mobile navigation and the sign-in screen. The full wordmark receives a white backing in dark mode to preserve readability. The browser title is SEO Command.

Manrope is applied throughout the interface through Next.js font loading, with tabular numerals for aligned dashboard metrics. The dashboard arrangement and scope controls remain intact.

## Section hierarchy

Dashboard sections now have stronger headings, identifying icons, coloured top edges, tinted header bands and subtle shadows. Position Tracking anchors the page with a copper header; Search uses violet, Engagement teal, Geography blue, Content amber and Websites slate. Priority tasks keeps its compact rows with a rose header. Selected metric tiles and chart lines match their section colours. Table and subsection headings are more prominent. Styles are scoped to dashboard components and include dark-theme colours.

## Expanded navigation

The desktop icon rail expands from 64 to 256 pixels on pointer hover or keyboard focus, revealing the full link labels and approved wordmark. Hover expansion overlays the dashboard; Keep menu open reserves space for the sidebar and retains the expanded state during navigation. Collapse menu or Escape restores the compact rail. Website and group navigation remains available in a separate flyout with close and outside-click dismissal.

The narrow-screen drawer places navigation links before the website list and uses one scrollable area beneath its fixed logo header. This prevents a large portfolio from hiding the tool links. Duplicate destinations are shown once.

## Data behavior

- A Priority tasks panel appears above Position Tracking. It shows up to four saved alerts or approved workflow tasks, with critical alerts first, exact scoped critical/urgent counts, website labels, and links to the working section for the affected website. It follows portfolio, group (including subgroups) and website scope; task status is independent of the chart date range.
- Priority tasks uses compact clickable rows with severity, website, title and an arrow. Descriptions and status details remain in tooltips and accessible labels. The desktop panel measures 108 pixels tall, down from 350; mobile rows wrap into two short lines without horizontal overflow.
- The existing Action Centre read model filters accessible scope and actionable status before sorting and limiting. Completed/dismissed work and unexpired snoozes are excluded. Counts are computed separately over all eligible records, so the four-item preview does not undercount work. Missing task storage and load errors are distinguished from a clear queue. Opening the full queue preserves scope and selects its urgent filter.
- Task links retain the affected website and use the saved alert destination or approved recommendation's module. Dashboard reload also refreshes tasks, and returning to the dashboard rechecks saved task status. No provider calls or workflow mutations are made by the task panel.

- Search Overview uses clicks, impressions and impression-weighted average position, replacing reference-only authority metrics the app does not collect.
- The 7/28/90-day controls apply to the search and session charts. Ranges end at the latest saved reporting day. Missing days and incomplete comparisons are explicitly identified; missing values remain unavailable rather than becoming zero.
- Position Tracking uses the latest audit/keyword snapshots. Country and page-title panels display their exact saved 28-day range. Website rows retain the existing saved 28-day summaries.
- Aggregated search history includes only dates available in every contributing property, preventing changes in property coverage from appearing as traffic growth. Source footers show the number of included properties.
- A new `ga4_dashboard` snapshot is populated by the existing Google sync tier: daily organic sessions, engaged sessions, views and key events over 180 closed dates; country sessions and page titles over 28 closed dates. These are standard GA4 read-only reports. No database schema change is required.
- New GA4 dashboard snapshots combine only matching reporting windows and retain page ownership. Countries and pages show awaiting-sync states until these snapshots exist. The new reports have been tested against mocked API responses; live account compatibility remains to be checked in staging.
- Browser reload/export/range changes only read saved data. They do not call providers or incur DataForSEO spend.
- Scope changes clear the previous scope's visible response while loading. Navigation retains a selected group, and direct site routes take precedence over saved scope.

## Validation

Typecheck, lint, unit tests and production build pass. 125 tests across 27 files. Browser checks used the existing explicit synthetic QA mode on loopback only, with sample-data labels visible. Desktop and mobile layouts, portfolio/group/site switching, range and metric controls were checked. No production credentials or paid provider calls were used.

After the branding update, all checks passed again. Browser inspection confirmed that Manrope loaded, both logo variants rendered correctly, the sign-in screen displayed the approved branding, and the dashboard fit a 390-pixel mobile viewport without horizontal overflow.

Navigation checks covered hover expansion without moving the dashboard, collapse on pointer exit, pinning across routes, complete labels, preserved site scope in links, keyboard focus and Escape, and the website/group flyout. The desktop rail stays hidden at the mobile breakpoint. Production preview builds use Next.js's supported webpack option because Turbopack's local worker port is restricted in this environment.

After the priority-task addition, typecheck, lint, the production build and 134 tests across 29 files pass. New tests execute the task-selection SQL against an in-memory PostgreSQL database, covering old critical alerts behind 160 resolved notices, full counts despite preview limits, website/group access, completed/dismissed/snoozed states, subsequent resolution, missing storage and destination links. Browser checks confirmed audit/content destinations and website scope, the full priority queue, the no-urgent-work state, and desktop/mobile layouts without horizontal overflow.

After compacting the task panel, typecheck, lint, all 134 tests and the production build passed again. Browser checks confirmed the reduced desktop height and a 390-pixel mobile layout without overflow. The local preview was refreshed.

The section-hierarchy update passed typecheck, lint, all 134 tests and the production build. Browser checks covered section headers, metric selection, desktop and dark-theme layouts, plus 390- and 616-pixel viewports without horizontal overflow. The existing local preview was refreshed with its selected date range preserved.

## Delivery state

The design was integrated with the current primary branch, `claude/seo-dashboard-dataforseo-112fbm`, at `921f74b`. The merge preserves research approvals, outcome-based task prioritisation, execution links, report printing, explicit website access, scan jobs, provider balance and group-management controls. The primary branch already contains the earlier UX release.

The release delta makes no changes to database schemas, migrations, connection configuration, seed scripts or startup commands. The new GA4 dashboard dataset uses its own snapshot key; existing metrics and history remain in their existing records. Dashboard and queue reads do not reset or modify saved data. A PostgreSQL integration test compares saved alerts, workflow items, research mappings and evidence before and after queue reads, including learned task priorities, and confirms they are unchanged.

Integrated validation: 200 tests across 49 files, TypeScript, ESLint and the production build pass. Browser checks confirmed the dashboard, task-to-audit navigation, independent global research, retained research approval controls and mobile layout. The local preview uses an isolated synthetic account and no live database or provider credentials.

The typecheck command generates Next.js declarations before checking TypeScript, so fresh CI checkouts recognise the approved logo image without requiring a previous build. This was verified in a clean checkout with no generated Next.js files. Runtime, deployment startup and database commands are unchanged.

Local implementation branch: `codex/suggest-dashboard`. The user approved release to the existing primary branch, `claude/seo-dashboard-dataforseo-112fbm`; the repository has no branch named `main`. No production or staging database was contacted or changed during preparation.

The dot-map geometry is derived from https://github.com/johan/world.geo.json/blob/master/countries.geo.json; its source is retained in `world-dots.json`.
