# Engine Snapshot Tests

Snapshot tests for the LunarCalendarEngine. These verify that all Sabbath Tester biblical test results remain stable after code changes.

## Setup

```bash
cd tests
npm install
```

## Run Tests

```bash
npm test
```

This re-runs all 84 test combinations (7 biblical tests x 12 calendar profiles) and compares the output against the golden snapshot. If any JD, weekday, or pass/fail result differs, the test fails with a clear diff.

## Update Snapshot

After an intentional engine change (e.g. fixing a calculation), regenerate the golden file:

```bash
npm run snapshot:update
```

Then review the git diff on `snapshots/sabbath-tester.json` to confirm the changes are expected before committing.

## What Gets Tested

Each snapshot entry captures the full calendar pipeline:

1. Moon phase search (full, dark, crescent)
2. Year start point (equinox vs 13-days-before)
3. Month start calculation (sunrise vs sunset boundary)
4. Day boundary and JD assignment
5. Weekday derivation from JD
6. Pass/fail determination against expected weekday

The 12 profiles are all combinations of:
- **Moon phase:** Full, Dark, Crescent
- **Day start:** Daybreak (angle 12), Sunset (angle 0)
- **Year rule:** Equinox, Lamb (13 days before)

The 7 biblical tests are defined in `http/views/sabbath-tester-view.js` (`BIBLICAL_TESTS`).

## Files

- `astro-engine-node.js` — Node.js wrapper for the astronomy-engine npm package
- `snapshot-generate.js` — generates the golden snapshot JSON
- `snapshot-verify.js` — verifies current engine output matches the snapshot
- `snapshots/sabbath-tester.json` — the golden reference data
