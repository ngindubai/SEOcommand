# Website navigation — 10 September 2026

## Approved structure

The user accepted eight visible website sections: Overview, Performance, Research, Pages & Content, Health & Speed, Backlinks, AI Visibility and Local SEO. Tasks, Reports and Scan Centre remain separate and visible; Settings stays at the bottom. The sidebar opens with full labels by default and has a website selector and an explicit return to all websites. Desktop and mobile share the same structure.

Related screens appear as links below the current website/section. Existing URLs remain valid. Customer questions now lives at `/questions`, under Research; the old Content location links there and continues to use the same saved records. Search supports feature names and common terms such as speed, People Also Ask, reviews and broken backlinks, and opens the exact view. Research collection choices use URL parameters for direct links and Back/Forward navigation. Website and reporting-period context travel with navigation. Keyword and domain research default their destination to the selected website; explicit user choices remain available.

The original palette, orange brand and Manrope font are retained. This release changes navigation and presentation only: no schema, providers, budget changes, scans, account authorization or data migration.

## Remaining agreed additions

Autocomplete, competitor total traffic with channel breakdown, and the wider connected research workflow remain agreed future work. This navigation release does not claim to implement those collectors or the workflow automation. In particular, the existing organic traffic estimates have not been relabelled as total competitor visits. The earlier feature audit remains applicable.

## Verification

313 tests pass, including site context and exact feature destinations. Type checking and lint pass. A production build with Next's webpack engine passes; the local environment blocks Turbopack's child-process port binding, so the standard production build is also checked through the existing Render release.

Isolated browser checks cover all eight sections, selected website/reporting period, feature search, website switching, research project Back navigation, return to portfolio and mobile navigation. No browser page errors or horizontal page overflow were found. Preview uses synthetic data and no provider credentials. Release receipts and screenshots are in the task's `outputs/navigation-release` folder.
