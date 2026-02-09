# Deferred Tasks

A central tracking document for tasks identified during development that are not yet implemented. Organized by area. Check items off or move to "Completed" when done.

---

## Translation Patch System (docs/verse-studies-design.md)

- [ ] **Phase 2: Patch rendering** — Orange/blue highlights in the reader for translation patches (verse-specific and Strong's-based). Tooltips with justification + accept/reject UX. See design doc for full spec.
- [ ] **Phase 3: Strong's-based patches** — Systematic word swaps (e.g., "new moon" → "renewed moon") applied via Strong's number across all translations.
- [ ] **Phase 4: Settings page** — Translation patches section in settings with toggle switches, verse counts, and study links.
- [ ] **GoatCounter analytics** — Track patch seen/tooltip/study/accept/revert funnel per patch group.
- [ ] **Parallel passage view** — Multi-column layout with color-coded phrase connections (Matthew 24 / Isaiah / Jeremiah style). JSON-driven connections data.

## Study System Enhancements

- [ ] **Strong's hints in markdown** — `word{H####}` syntax in study articles that strips the number from display but makes the word clickable to open the Strong's panel. Needs `processStrongsHints()` function in renderer.
- [ ] **Strong's panel in all views** — Make the Strong's side panel available not just in Bible reader but in any study view (verse studies, word studies, symbol studies). Currently tied to Bible reader DOM.
- [x] **GRASS symbol in symbol-dictionary.js** — Add GRASS entry to the symbol dictionary so it appears in the symbol grid and gets word-matched in Bible text. Study is written (`symbols/GRASS.md`) but dictionary entry not yet added.
- [x] **Delete old DANIEL-9-26.md** — `words/DANIEL-9-26.md` is superseded by `words/DANIEL-9.md`. Remove the old file and update any references.

## Event System

- [ ] **Multiple derivation paths** — Events should support multiple independent paths to the same date (e.g., Darius year 1 = First Captivity + 75 years = Temple Destroyed + 64 years = Persian records). Currently `start.relative` supports only one reference. Need a `derivations` array and UI to show convergence/divergence.
- [ ] **Abraham covenant event** — Created in `biblical-date-events.json` but needs a concrete anchor chain (date for Abraham's call is uncertain). Currently `certainty: "low"`.
- [ ] **Missing timeline events to add** — Events created in `biblical-date-events.json` (Daniel's captivity, Daniel's prayer, Second Temple completed, Abraham's covenant) need to be verified against the timeline display and duration chains.

## Symbol Studies

- [x] **JERUSALEM symbol study** — Written (`symbols/JERUSALEM.md`). Jerusalem = Bride / Covenant Community. Referenced in Daniel 9 study.
- [x] **GRASS in symbol dictionary** — The study is written but the entry in `symbol-dictionary.js` is not yet added.

## Daniel 9 Study Refinements

- [ ] **Daniel 9:25 deep dive** — The two-decree / two-timeline reading needs more development. Currently a placeholder section.
- [ ] **Daniel 9:27 week-and-a-half calculation** — From the video transcript: "week of 1 and 1/2 weeks or 7 x 1.5 x 7 = 73.5 years" from John the Baptist's conception to 70 AD. Not yet incorporated.
- [ ] **Jeremiah second witness** — Section exists but could be expanded with more parallel verses and color-coded connections (future parallel passage view).
- [x] **Ottoman rebuilding of Jerusalem (1535 AD)** — The 60th jubilee connection. Incorporated into Daniel 9 study under the definite article analysis (#the-definite-article) with full word-by-word breakdown.

## Scripture Reference Parser (linkifyScriptureRefs)

- [x] **Comma-separated verse support** — The regex in `views/reader-view.js` line 1028 does not handle comma-separated verses like `Deuteronomy 16:9,10,16` or `Daniel 9:24,25,26`. It stops after the first verse. Fix the pattern to handle `Book Chapter:Verse(,Verse)*(-EndVerse)?`.
- [x] **Unit tests for linkifyScriptureRefs** — Create test cases covering:
  - Simple: `Genesis 1:1` (works)
  - Range: `Romans 11:17-24` (works)
  - Chapter only: `Matthew 13` (works)
  - Comma-separated: `Deuteronomy 16:9,10,16` (BROKEN)
  - Comma-separated: `Daniel 9:24,25,26` (BROKEN)
  - Range notation: `Daniel 9:24-27` (should work, verify)
  - Mixed: `Isaiah 60:10,11,12` (BROKEN)
  - Psalm/Psalms: `Psalm 37:10` and `Psalms 37:10` (verify both)
  - Books with numbers: `1 Thessalonians 4:17` (verify)
  - Adjacent references: `Genesis 12:2-3, 17:7, 22:18` — multiple refs with different chapters (complex case)
- [ ] **Multiverse link generation** — Comma-separated verses should generate a multiverse link (`/reader/multiverse/kjv/Deut.16.9.10.16`) rather than individual single-verse links, so the user sees all verses together.

## Markdown Rendering

- [x] **Custom anchor support in headings** — The `{#anchor-name}` syntax used in study markdown (e.g., `## Title {#context}`) is not handled by `marked.js`. It renders `{#context}` as visible text. Fix: add a post-processing regex in `renderMarkdown()` (line 970 of `views/reader-view.js`) after `marked.parse()`:
  ```javascript
  html = html.replace(/<(h[1-6])([^>]*)>(.*?)\s*\{#([\w-]+)\}\s*<\/(h[1-6])>/g, '<$1$2 id="$4">$3</$5>');
  ```
  This strips `{#...}` from display and uses it as the heading's `id` attribute — enabling deep-linking from tooltips in Phase 2.

## Bugs (from v89 session)

- [ ] **Word search click doesn't navigate to verse** — Clicking a verse in word search results navigates to `http://localhost:8080/bible/akjv/` (translation picker) instead of the actual verse. Displays the "select a translation" page. The search result click handler may not be passing book/chapter/verse params correctly.
- [ ] **Strong's pane missing morphology** — Clicking a verb no longer shows morphology info (gender, tense, etc.) in the Strong's panel. This may have been broken by changes to bible-reader.js during the patch system integration. Check if `_renderPlainSegment` changes or the patch hooks disrupted the Strong's click handler data flow.
- [ ] **Patch system: whole verse colored instead of patched phrase** — The verse-level CSS class approach (`patch-verse-unapproved`) colors the entire verse orange. Need to revert to the marker-based approach but with short numeric markers (e.g., `\u2060P0\u2060` / `\u2060/P\u2060`) that won't trigger symbol highlighting. Store patch metadata in a lookup table keyed by index, not in the marker text. Re-add `applyPatchMarkers()` calls after `renderInlineStrongs()`.
- [ ] **Patch tooltip not showing** — Proposed-state tooltip (dotted orange underline + hover) not appearing on patched phrases. Related to the above — once markers work, the tooltip spans need to be generated by `applyPatchMarkers()`.

## Styling

- [ ] **Study article link styling** — ALL links inside study articles are dark blue and barely distinguishable from bold body text. This affects both static markdown links (`linkifyReaderLinks`) and injected scripture reference links (`linkifyScriptureRefs`). Links must be visually distinct from surrounding bold/blue text — needs underline + color differentiation. Apply to all `<a>` tags inside `.word-study-body`, `.symbol-study-body`, `.symbol-article-body`, `.number-study-body`. Verify in both light and dark mode. Scripture links should look clickable at a glance.

## Scroll Position Restoration

- [ ] **Replace 300ms setTimeout with content-ready signal** — In `url-router.js` line 233, scroll position restore uses a blind `setTimeout(300)` that races against async content loads. Replace with a "content ready" pattern:
  - Add a `AppStore.dispatch({ type: 'CONTENT_READY' })` at the end of every async content loader (`loadWordStudy`, `loadVerseStudy`, `loadSymbolStudy`, `loadSymbolArticle`, `loadNumberStudy`, `goToBibleChapter`, etc.)
  - In the `popstate` handler, store the pending scroll position in state (e.g., `state.ui.pendingScrollRestore`)
  - In the AppStore subscriber, when `CONTENT_READY` fires and `pendingScrollRestore` exists, apply the scroll and clear the pending value
  - Use `textArea.scrollTop = value` (instant jump) — NOT `scrollTo({ behavior: 'smooth' })`. Animated scroll on back-navigation is disorienting; the user expects to be where they left off immediately.
  - Only apply to reader views (`#bible-explorer-text`) — non-reader views don't need it
  - Remove the `setTimeout(300)` entirely

## Infrastructure

- [x] **Service worker caching** — New study files (`words/DANIEL-9.md`, `words/H369.md`, `symbols/GRASS.md`, `symbols/JERUSALEM.md`) added to the service worker cache lists for offline access.
- [ ] **Verse study content type in service worker** — The new `/reader/verse-studies/` route may need service worker handling for offline navigation.
