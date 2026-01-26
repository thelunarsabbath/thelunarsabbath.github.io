# Refactoring Plan: Breaking Down index.html

## Goal
Extract code from index.html into separate modules to reduce file size and improve maintainability.

## Strategy
- **Incremental**: One module at a time
- **Verifiable**: Test after each extraction
- **Reversible**: Keep backups/notes
- **Safe**: Start with lowest-risk changes

## Current State
- `index.html`: 9,016 lines (down from 14,203!)
- Contains: HTML structure, JavaScript (~9,000 lines)
- Already extracted: `sabbath-tester.js` ✅, `styles.css` ✅ (4,401 lines), `astronomy-utils.js` ✅ (778 lines)

## Phase 1: Extract CSS (LOWEST RISK)
**Status**: ✅ COMPLETED

### Steps:
1. ✅ Create `styles.css` file
2. ✅ Copy all CSS from `<style>` tag (lines 25-4425)
3. ✅ Replace `<style>` with `<link rel="stylesheet" href="/styles.css">`
4. ✅ Update service worker to cache `styles.css`
5. ✅ Bump cache version (v347)
6. ⬜ Test: Visual appearance unchanged

### Verification:
- [ ] All styles load correctly
- [ ] No visual regressions
- [ ] Service worker caches new file

### Notes:
- CSS extracted: ~4,400 lines
- File created: `/http/styles.css`
- Service worker updated: Added `/styles.css` to ASSETS_TO_CACHE
- Cache version: v347

---

## Phase 2: Extract Astronomy Utilities (LOW RISK)
**Status**: ✅ COMPLETED

### Functions to Extract:
- `getSunsetTimestamp()`
- `getSunriseTimestamp()`
- `getCorrectWeekday()`
- `getLocalDateFromUTC()`
- `formatTimeInObserverTimezone()`
- `getDayStartTime()`
- Other astronomy helper functions

### Steps:
1. ✅ Create `astronomy-utils.js`
2. ✅ Identify all astronomy utility functions
3. ✅ Copy functions to new file
4. ✅ Add script tag BEFORE main script
5. ✅ Remove functions from index.html
6. ⬜ Test: Calendar still works, day calculations correct

### Verification:
- [ ] Calendar generates correctly
- [ ] Day start times calculate correctly
- [ ] Weekday calculations work

### Notes:
- Functions extracted: ~20 astronomy utility functions (~776 lines)
- File created: `/http/astronomy-utils.js`
- Service worker updated: Added `/astronomy-utils.js` to ASSETS_TO_CACHE
- Cache version: v348
- Functions depend on global `state` and `getAstroEngine()` which remain in index.html
- [ ] No console errors

---

## Phase 3: Extract Calendar Core (MEDIUM RISK)
**Status**: ⬜ Not Started

### Functions to Extract:
- `generateCalendar()`
- `renderMonth()`
- `buildLunarMonths()`
- `updateMonthButtons()`
- `updateTimeDisplay()`
- `getViewTime()`
- `navigateToTimestamp()`
- Calendar rendering helpers

### Steps:
1. ⬜ Create `calendar-core.js`
2. ⬜ Copy calendar generation functions
3. ⬜ Copy month rendering functions
4. ⬜ Add script tag (after astronomy-utils.js)
5. ⬜ Remove functions from index.html
6. ⬜ Test: Calendar displays correctly, navigation works

### Verification:
- [ ] Calendar renders months correctly
- [ ] Month navigation works
- [ ] Year navigation works
- [ ] Today highlighting works
- [ ] Time display updates

---

## Phase 4: Extract Day Detail Panel (MEDIUM RISK)
**Status**: ⬜ Not Started

### Functions to Extract:
- `showDayDetail()`
- `renderDatelineVisualization()`
- `updateCrescentVisibility()`
- `getEquinoxMethodologyHtml()`
- `getPassoverMethodologyHtml()`
- `getVirgoMethodologyHtml()`
- Day detail rendering helpers

### Steps:
1. ⬜ Create `day-detail.js`
2. ⬜ Copy day detail functions
3. ⬜ Add script tag (after calendar-core.js)
4. ⬜ Remove functions from index.html
5. ⬜ Test: Day detail panel works, all info displays

### Verification:
- [ ] Clicking day shows detail panel
- [ ] Crescent visibility calculates correctly
- [ ] Dateline visualization works
- [ ] Methodology explanations show
- [ ] All day info displays correctly

---

## Phase 5: Extract Settings & Profiles (MEDIUM RISK)
**Status**: ⬜ Not Started

### Functions to Extract:
- `toggleSettings()`
- `displayProfileSettings()`
- `selectMoonPhase()`
- `selectDayStartTime()`
- `selectYearStartRule()`
- `cloneProfile()`
- `deleteCustomProfile()`
- `saveProfileModal()`
- `updateProfileButtonStates()`
- All profile management functions

### Steps:
1. ⬜ Create `settings-profiles.js`
2. ⬜ Copy all settings/profile functions
3. ⬜ Add script tag (after day-detail.js)
4. ⬜ Remove functions from index.html
5. ⬜ Test: Settings page works, profiles can be edited

### Verification:
- [ ] Settings page opens/closes
- [ ] Profile selection works
- [ ] Profile editing works
- [ ] Profile cloning works
- [ ] Profile deletion works
- [ ] Settings changes apply correctly

---

## Phase 6: Extract Navigation & Routing (MEDIUM RISK)
**Status**: ⬜ Not Started

### Functions to Extract:
- `navigateTo()`
- `updateURL()`
- `parseURL()`
- `buildPathURL()`
- `handlePopState()`
- URL routing logic

### Steps:
1. ⬜ Create `navigation.js`
2. ⬜ Copy navigation/routing functions
3. ⬜ Add script tag (after settings-profiles.js)
4. ⬜ Remove functions from index.html
5. ⬜ Test: URL updates, back button works, deep links work

### Verification:
- [ ] URL updates when navigating
- [ ] Back/forward buttons work
- [ ] Direct URL access works
- [ ] Profile/location in URL works

---

## Phase 7: Extract World Clock (LOW RISK)
**Status**: ⬜ Not Started

### Functions to Extract:
- `renderWorldClock()`
- `addWorldClockEntry()`
- `removeWorldClockEntry()`
- `updateWorldClockTimes()`
- World clock related functions

### Steps:
1. ⬜ Create `world-clock.js`
2. ⬜ Copy world clock functions
3. ⬜ Add script tag (after navigation.js)
4. ⬜ Remove functions from index.html
5. ⬜ Test: World clock displays, entries can be added/removed

### Verification:
- [ ] World clock displays correctly
- [ ] Can add locations
- [ ] Can remove locations
- [ ] Times update correctly

---

## Phase 8: Extract Export & Feasts (LOW RISK)
**Status**: ⬜ Not Started

### Functions to Extract:
- `exportToCalendar()`
- `generateFeastList()`
- `openInCalendar()`
- Export related functions

### Steps:
1. ⬜ Create `export-feasts.js`
2. ⬜ Copy export/feast functions
3. ⬜ Add script tag (after world-clock.js)
4. ⬜ Remove functions from index.html
5. ⬜ Test: Export works, feast list generates

### Verification:
- [ ] Calendar export works
- [ ] Feast list displays correctly
- [ ] Export formats are correct

---

## Phase 9: Cleanup & Final Verification
**Status**: ⬜ Not Started

### Steps:
1. ⬜ Remove any leftover code/comments
2. ⬜ Verify all script tags are in correct order
3. ⬜ Update service worker with all new files
4. ⬜ Final cache version bump
5. ⬜ Full feature test

### Final Verification Checklist:
- [ ] Calendar displays and works
- [ ] Settings page works
- [ ] Day detail panel works
- [ ] Profile management works
- [ ] Navigation/routing works
- [ ] World clock works
- [ ] Export works
- [ ] Sabbath tester works
- [ ] All features functional
- [ ] No console errors
- [ ] No visual regressions

---

## Notes Section
(For tracking issues, decisions, and state during crashes)

### Current Phase: 
### Last Completed Step:
### Issues Encountered:
### Decisions Made:
### Files Modified:

---

## Recovery Protocol
If crash occurs:
1. Check REFACTORING_PLAN.md for current phase
2. Check TODO list for last completed step
3. Verify current state of files
4. Continue from last checkpoint
5. Test before proceeding
