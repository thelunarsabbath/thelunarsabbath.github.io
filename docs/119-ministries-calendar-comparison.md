# 119 Ministries Calendar vs. App Calculation

This document compares **119 Ministries’ stated rules** (from their teaching “Why the Biblical Month Begins at Conjunction”) to **how the app’s 119-related profiles are configured** and where they match or differ.

---

## 1. Month start (when does the month begin?)

| 119 Ministries | App |
|-----------------|-----|
| Month begins at **conjunction** (dark moon), not at the first visible crescent. | **Matches.** The “119 Ministries” and “Rabbinic Saturday” profiles use `moonPhase: 'dark'`, which uses the **astronomical conjunction** (phase = 0) as the moon event. No crescent offset is applied. |

So for **month start**, the app is aligned with 119: the month is driven by the instant of conjunction; day 1 is the day whose evening (or morning) contains or follows that instant.

---

## 2. Day start (when does the day begin?)

| 119 Ministries | App |
|----------------|-----|
| The 15th “begins in darkness, **not at sunset, but once the light is completely gone**.” So the day begins when it is fully dark. | **119 Ministries** profile uses **`dayStartAngle: 18`** (astronomical / “complete darkness”). The **month boundary** uses the same rule: `calculateMonthStart()` compares the moon event to `getDayStartTime()` (so 18° is used for both “when does day 1 start?” and “when does each day start?”). |

**Status:** The app’s “119 Ministries” profile is configured to match 119’s “complete darkness” day start, and the engine uses that same boundary for the start of the month.

---

## 3. Year start (which conjunction is month 1?) — eq − 1 day

| 119 Ministries | App |
|----------------|-----|
| They assert that in **30 C.E.** the 14th of the first month fell on **Wednesday, April 5, 30 C.E.** The equinox in 30 AD occurred *after* sunset (on “the next day” in evening reckoning), so a strict “after equinox” rule would postpone to the next conjunction; they treat the equinox as *on the day* of the equinox, so the March conjunction counts. | **“119 Ministries”** profile uses **`yearStartRule: '1dayBefore'`**: year start point = **equinox − 1 day**. First conjunction on or after that point is Nisan. So the March conjunction (before the equinox instant but on the same calendar day) is accepted → 14th ≈ April 5 in 30 AD. |

**Rule in one line:** Lamb rule = eq − 14 days; 119 rule = eq − 1 day. Same “first conjunction on or after” logic, different threshold.

---

## 4. Summary table

| Rule | 119 teaching | App “119 Ministries” (ministries119Equinox) | App “Rabbinic Saturday” (ministries119) |
|------|----------------|---------------------------------------------|----------------------------------------|
| **Month start** | Conjunction (dark moon) | ✅ Dark (conjunction) | ✅ Dark (conjunction) |
| **Day start** | “Complete darkness” (after sunset) | ✅ 18° (complete darkness); month boundary uses same | ⚠️ Sunset (0°) |
| **Year start** | 30 AD: 14th = Wed Apr 5 (equinox “on the day” → no postpone) | eq − 1 day → first conjunction on or after (eq − 1) → 14th ≈ Apr 5 in 30 AD | 14 days before equinox (lamb) |

---

## 5. Implemented changes

1. **Profile “119 Ministries”:** `dayStartAngle: 18` (astronomical / “complete darkness”).  
2. **Month boundary:** `calculateMonthStart()` now uses `getDayStartTime()` so the same day-boundary rule (including `dayStartAngle`) is used for “when does day 1 of the month start?”  
3. **30 AD:** Documented that 119’s April 5 date comes from using the conjunction **before** the equinox; our “equinox” rule uses the first conjunction **on or after** the equinox, so we are one lunation later (14th in May).

---

## 6. References in app code

- **Profiles:** `index.html` — `ministries119`, `ministries119Equinox` (119 Ministries has `dayStartAngle: 18`).
- **Month = conjunction:** `lunar-calendar-engine.js` — `findMoonEvents()`, `calculateMonthStart()` (uses `getDayStartTime()` for boundary).
- **Day boundary:** `lunar-calendar-engine.js` — `getDayStartTime()` (uses `dayStartAngle`).
- **30 AD debug:** `_dev/tests/debug-30ad-nisan.js` — lists equinox and conjunctions for 30 AD and explains the one-month difference.
