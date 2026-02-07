# Calendar Backend Evaluation: @hebcal/core

## Goal

Allow a profile to use **@hebcal/core** (rabbinic Hebrew calendar) instead of our astronomy-based `LunarCalendarEngine`, so the rest of the app does not depend on implementation details. The app only needs: **lunar date ↔ Gregorian date ↔ JD** and a **year calendar structure** for the UI.

---

## What the app actually needs from “the engine”

From current usage across `app-store.js`, `calendar-view.js`, `sabbath-tester-view.js`, `event-resolver.js`, `world-clock.js`, `dateline-map.js`, `priestly-divisions.js`:

| Requirement | Used by | Notes |
|-------------|---------|--------|
| **generateYear(year, location, options)** | AppStore, CalendarView, SabbathTester, event-resolver, world-clock, dateline-map | Returns `{ year, location?, months: [ { monthNumber, days: [ { lunarDay, gregorianDate, jd, weekday, weekdayName } ], ... } ], yearStartUncertainty?, springEquinox? }`. `location` can be ignored for arithmetic calendars. |
| **getDayInfo(calendar, month, day)** | AppStore (indirect), SabbathTester | Returns `{ lunarMonth, lunarDay, gregorianDate, jd, weekday, weekdayName, monthData? }` or null. |
| **findLunarDay(calendar, gregorianDate)** | AppStore._findMonthAndDay | Returns `{ lunarMonth, lunarDay, gregorianDate, weekday, weekdayName }` or null. Used for JD → lunar date when navigating (e.g. “Today”). |
| **jdToDisplayDate(jd)** | CalendarView, world-clock | Returns `{ year, month, day, isJulian? }` for display. Can be pure JD↔Gregorian/Julian math; need not be lunar-specific. |
| **configure(config)** | AppStore, SabbathTester | Options: moonPhase, dayStartTime, dayStartAngle, yearStartRule, crescentThreshold. Hebcal has no such options (single fixed calendar). |

So a **calendar backend** only needs to support:

- `generateYear(year, location, options)` → same shape as above  
- `getDayInfo(calendar, month, day)`  
- `findLunarDay(calendar, gregorianDate)`  
- `jdToDisplayDate(jd)` (or move this to a shared util)  
- `configure(config)` (no-op for Hebcal)

The app already uses a **single engine instance** from `AppStore.getEngine()` and `AppStore._engine`; that engine is created and configured from the active profile. So we can introduce a **backend type per profile** (e.g. `calendarBackend: 'lunar' | 'hebcal'`) and have the store create either `LunarCalendarEngine(astroEngine)` or a Hebcal-backed adapter.

---

## @hebcal/core in brief

- **Purpose**: Perpetual Jewish (rabbinic) calendar: Hebrew ↔ Gregorian, holidays, candle lighting, etc.
- **License**: GPL-2.0 (confirm compatibility with your project).
- **Key type**: `HDate` (Hebrew date). Construct:
  - `new HDate(day, month, year)` — Hebrew day, month (1=Nisan, 7=Tishrei), Hebrew year
  - `new HDate(Date)` — Gregorian date → Hebrew date (uses **local** time zone)
- **Conversions**:
  - `hdate.greg()` → `Date` (local midnight of the **civil** day that corresponds to that Hebrew date).
  - `hdate.abs()` → Rata Die. **JD = RD + 1,721,424.5** (so JD ↔ RD is trivial).
- **Year**: Hebrew year is 1–9999 (e.g. 5785 ≈ 2024/25). Roughly **Hebrew year = Gregorian year + 3760** for the Nisan-based year (Nisan in spring of that Gregorian year). For BC: e.g. 1446 BC → Hebrew ≈ 2315 (check Hebcal’s range).
- **No location** for the calendar itself (molad is arithmetic). Location only matters for zmanim/candle lighting.
- **Single system**: No “full vs crescent vs dark” or “equinox vs 14 days before”; one fixed rabbinic calendar. So a “Hebcal profile” is one fixed option for comparison.

---

## What a Hebcal adapter would do

1. **Year mapping**  
   Our `year` is Gregorian/astronomical (e.g. 32, -1445). For Hebcal, convert to Hebrew year: e.g. AD: `hebrewYear = year + 3760` (and handle year-boundary so Nisan of `hebrewYear` falls in `year`). BC: e.g. `hebrewYear = year + 3761` (again, verify for your range).

2. **generateYear(year, location, options)**  
   - Map `year` → Hebrew year.  
   - Iterate months 1..13 (Nisan=1; Hebcal uses same numbering for religious months).  
   - For each month, get `daysInMonth = HDate.daysInMonth(month, hebrewYear)`.  
   - For each day 1..daysInMonth, build `HDate(day, month, hebrewYear)`, then:
     - `.greg()` → `Date` (local); normalize to **UTC noon** (or one fixed time) for a stable JD.  
     - JD = `date.getTime()/86400000 + 2440587.5` (or via Rata Die: `HDate.hebrew2abs(hebrewYear, month, day)` then RD→JD).  
   - Weekday: use `hdate.getDay()` (0=Sunday … 6=Saturday).  
   - Build the same `{ year, months: [ { monthNumber, days: [ { lunarDay, gregorianDate, jd, weekday, weekdayName } ] } ] }` shape.  
   - No `yearStartUncertainty` or `springEquinox` unless you want to leave them null.

3. **getDayInfo(calendar, month, day)**  
   Implement as a lookup into the calendar object returned by `generateYear` (same as current engine).

4. **findLunarDay(calendar, gregorianDate)**  
   Option A: iterate `calendar.months[].days[]` and match by `gregorianDate` (e.g. same YYYY-MM-DD).  
   Option B: use Hebcal directly: `const h = new HDate(gregorianDate); return { lunarMonth: h.getMonth(), lunarDay: h.getDate(), ... }` and build the minimal return shape. Option B avoids needing the pre-built calendar.

5. **jdToDisplayDate(jd)**  
   JD → Gregorian (or Julian for old dates) is independent of lunar system. Can live in a shared util (e.g. `date-utils.js`) and be used by both LunarCalendarEngine and HebcalAdapter, or implemented on the adapter using the same math as now.

6. **configure(config)**  
   No-op for Hebcal; optionally store config for API compatibility.

7. **Location**  
   Passed in but not used for the calendar structure (rabbinic calendar is location-independent). Could still be passed for future use (e.g. zmanim).

---

## Gaps and caveats

- **One calendar only**: Hebcal is rabbinic/molad only. You get a single “Rabbinic (Hebcal)” profile for comparison, not multiple moon-phase/year-start variants.
- **Day start**: Our engine has “day start” at sunset/sunrise; Hebcal’s `.greg()` is the civil day. For consistency you may want to document “Hebcal profile uses civil midnight (UTC noon in adapter)” for JD.
- **Ancient dates**: Confirm Hebcal’s range (e.g. Hebrew 2315 for 1446 BC) and any limits.
- **Time zone**: `HDate(Date).greg()` is in local time; for a consistent JD we should fix a convention (e.g. UTC noon for the day) in the adapter.
- **AppStore today**: `_lunarDateToJD` currently checks `if (!this._engine || !this._astroEngine)`. For Hebcal, there is no astro engine; change to `if (!this._engine)` and have `_lunarDateToJD` use only the engine (which Hebcal adapter will implement via `generateYear` + day lookup).

---

## Suggested implementation steps

1. **Define a small “calendar backend” contract** (see below) and document it in code (e.g. JSDoc or a short `calendar-backend-interface.js` that only exports the expected method signatures).
2. **Add a Hebcal adapter** that implements that contract using `@hebcal/core`: `generateYear`, `getDayInfo`, `findLunarDay`, `jdToDisplayDate`, `configure`. Use RD↔JD for consistency; use UTC noon (or fixed time) for JD of each day.
3. **Profile option**: e.g. `calendarBackend: 'hebcal'` in the profile. In AppStore (or a factory), if `calendarBackend === 'hebcal'` then create the Hebcal adapter (no astro engine); else create `LunarCalendarEngine(astroEngine)`.
4. **Relax engine dependency**: Where the app currently requires both `_engine` and `_astroEngine`, allow “engine only” so Hebcal can be used without an astronomy engine.
5. **Optional**: Move `jdToDisplayDate` (and JD↔Gregorian/Julian) into a shared util so both backends call the same logic.

---

## Calendar backend interface (contract)

Any backend used as `AppStore._engine` should implement:

```text
configure(config) → void
generateYear(year, location, options?) → { year, months: [ { monthNumber, days: [ { lunarDay, gregorianDate, jd, weekday, weekdayName } ] } ], yearStartUncertainty?, springEquinox?, location? }
getDayInfo(calendar, month, day) → { lunarMonth, lunarDay, gregorianDate, jd, weekday, weekdayName, monthData? } | null
findLunarDay(calendar, gregorianDate) → { lunarMonth, lunarDay, gregorianDate, weekday, weekdayName } | null
jdToDisplayDate(jd) → { year, month, day, isJulian? }
```

Optional for compatibility with code that clears caches: `_calendarCache`, `_moonEventsCache`, `_virgoCache` (or no-ops / empty objects for Hebcal).

Once this contract is in place, the rest of the app can treat “the engine” as this interface and not care whether it is LunarCalendarEngine or a Hebcal adapter.

---

## Implementation checklist

A concrete **Hebcal adapter** is in `hebcal-adapter.js`. To use it:

1. **Vendor the bundle** (no npm): Run `./scripts/fetch-hebcal.sh` to download `lib/hebcal/hebcal-core.min.js`. The app loads it and `lib/hebcal/hebcal-loader.js` sets `window.Hebcal`.
3. **Profile**: Add a profile with `calendarBackend: 'hebcal'` (e.g. "Rabbinic (Hebcal)").
4. **AppStore**: If `profile.calendarBackend === 'hebcal'` and `HebcalCalendarAdapter.isAvailable()`, use `new HebcalCalendarAdapter()`; else `new LunarCalendarEngine(astroEngine)`. Call `engine.configure(profile)` in both cases.
5. **Engine guard**: In `_lunarDateToJD`, require only `this._engine` (not `_astroEngine`) so Hebcal works without an astronomy engine.
6. **Optional**: Move `jdToDisplayDate` / JD to Gregorian into a shared util.

---

## How disruptive is this to existing code?

**Short answer: low.** Almost all call sites use the engine only via the same interface (`generateYear`, `getDayInfo`, `findLunarDay`, `jdToDisplayDate`, `configure`). No refactor of the rest of the app is required. You add a branch where the engine is *created* and relax one guard.

### Required changes (minimal)

| File | Change | Size |
|------|--------|------|
| **app-store.js** | (1) When creating the engine in `_recomputeDerived` and in `SET_ASTRO_ENGINE`, if `profile.calendarBackend === 'hebcal'` and `HebcalCalendarAdapter.isAvailable()`, use `new HebcalCalendarAdapter()` instead of `new LunarCalendarEngine(astroEngine)`. (2) In `_lunarDateToJD`, change `if (!this._engine \|\| !this._astroEngine)` to `if (!this._engine)` so Hebcal (no astro engine) still works. | ~15 lines |
| **sabbath-tester-view.js** | In `runBiblicalTest`, when building the engine for a profile, if `profile.calendarBackend === 'hebcal'` use `new HebcalCalendarAdapter()` (no astro), else keep `new LunarCalendarEngine(astroEngine)`. | ~5–10 lines |
| **event-resolver.js** | In the path that creates the shared engine (e.g. `_sharedLunarEngine`), if the profile has `calendarBackend === 'hebcal'`, create or reuse a Hebcal adapter instead of `new LunarCalendarEngine(astroEngine)`. | ~10 lines |

So **3 files**, on the order of **30–35 lines** of additive/branch logic. No existing call sites need to change their usage of `generateYear`, `getDayInfo`, `findLunarDay`, or `jdToDisplayDate`.

### Optional (defensive / consistency)

| File | Change | Reason |
|------|--------|--------|
| **settings-view.js** | When clearing caches, only clear properties that exist (e.g. `if (engine._calendarCache) engine._calendarCache = {}`). Hebcal adapter has only `_calendarCache`; no `_moonEventsCache` or `_virgoCache`. | Avoids harmless errors if someone clears caches with a Hebcal engine. |
| **astronomy-utils.js** | Any use of engine methods that are lunar-specific (e.g. Virgo) should check for existence or use optional chaining. Hebcal adapter doesn’t implement those. | Only matters if deprecated Virgo helpers are still used. |
| **world-clock.js** / **priestly-divisions.js** / **dateline-map.js** | Prefer `AppStore.getEngine()` when the calendar needed is for the current profile, instead of always constructing a new `LunarCalendarEngine(astroEngine)`. | Ensures “current profile” (including Hebcal) is used when appropriate; otherwise those features keep using a lunar engine. |

### What stays unchanged

- **calendar-view.js** — Uses only `AppStore._engine` / `getEngine()`, `.jdToDisplayDate()`, `.generateYear()`. No edits.
- **url-router.js** — Uses `AppStore._dateToJulian` (not the engine). No edits.
- **LunarCalendarEngine** — No changes; it remains the default backend.
- **_dev tests** (snapshot-generate, snapshot-verify, test-lunar-date) — They explicitly test the lunar engine. No changes unless you add Hebcal-specific tests.

### Risk

- **Regression**: Low. New code is “if Hebcal profile then use adapter, else current path.” Default behavior is unchanged.
- **Testing**: Run the main flows (calendar nav, Sabbath tester, event resolution) with a non-Hebcal profile to confirm nothing broke; then add one Hebcal profile and test the same flows.
