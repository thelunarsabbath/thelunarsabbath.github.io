#!/usr/bin/env node
/**
 * Virgo Feet Year-Start Rule Tests
 * 
 * Tests _findVirgoFeetFullMoon and generateYear with yearStartRule: 'virgoFeet'
 * for the years that produce console warnings:
 *   "No qualifying Virgo full moon found in 7 attempts for year 1534/1535/1536"
 *
 * These years are triggered by the Sultan Suleiman 1535 AD decree event
 * in historical-events-v2.json (490 lunar years prophecy).
 *
 * Run: node _dev/tests/test-virgo-feet.js
 */

const astroEngine = require('./astro-engine-node');
const { LunarCalendarEngine } = require('../../lunar-calendar-engine.js');

const JERUSALEM = { lat: 31.7683, lon: 35.2137 };

const VIRGO_PROFILE = {
  moonPhase: 'full',
  dayStartTime: 'morning',
  dayStartAngle: 12,
  yearStartRule: 'virgoFeet',
  crescentThreshold: 18
};

// The bug years plus known-good years for comparison
const BUG_YEARS = [1534, 1535, 1536];
const GOOD_YEARS = [2024, 2025, 2026];
const ALL_YEARS = [...BUG_YEARS, ...GOOD_YEARS];

let passed = 0;
let failed = 0;

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 1: getEquator returns valid (non-zero) RA for all years
// ═══════════════════════════════════════════════════════════
console.log('TEST 1: getEquator returns valid Moon RA for historical dates');
console.log('  (If these fail, the astronomy engine cannot compute positions for these dates)');

for (const year of ALL_YEARS) {
  const observer = astroEngine.createObserver(JERUSALEM.lat, JERUSALEM.lon, 0);

  // Test a mid-April date (when a qualifying full moon is typically expected)
  const date = new Date(Date.UTC(2000, 3, 15));
  date.setUTCFullYear(year);

  let result;
  try {
    result = astroEngine.getEquator('moon', date, observer);
  } catch (err) {
    result = null;
  }

  const raValid = result && typeof result.ra === 'number' && result.ra > 0 && isFinite(result.ra);
  const raDeg = raValid ? (result.ra * 15).toFixed(3) : 'INVALID';
  assert(
    `Year ${year}: Moon RA = ${raDeg}°`,
    raValid,
    `getEquator returned: ${JSON.stringify(result)}`
  );
}

// ═══════════════════════════════════════════════════════════
// TEST 2: _findVirgoFeetFullMoon finds a qualifying moon (not fallback)
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 2: _findVirgoFeetFullMoon finds qualifying full moon');
console.log('  (Fallback = bug — means no full moon in 7 attempts had moonRA > spicaRA)');

for (const year of ALL_YEARS) {
  const engine = new LunarCalendarEngine(astroEngine);
  engine.configure(VIRGO_PROFILE);

  const result = engine._findVirgoFeetFullMoon(year, JERUSALEM);

  // Inspect cache for attempt details
  const cacheKey = `${year}_${JERUSALEM.lat.toFixed(4)}_${JERUSALEM.lon.toFixed(4)}`;
  const cached = engine._virgoCache[cacheKey];
  const isFallback = cached?.fallback === true;

  if (result && !isFallback) {
    assert(
      `Year ${year}: Qualifying moon on ${result.toISOString().slice(0, 10)} (moonRA=${cached.moonRA}, spicaRA=${cached.spicaRA}, diff=${cached.difference})`,
      true
    );
  } else if (result && isFallback) {
    // Log all attempts for diagnosis
    console.log(`  ✗ Year ${year}: FALLBACK — no qualifying moon in ${cached.attempts?.length} attempts`);
    cached.attempts?.forEach((a, i) => {
      console.log(`      #${i + 1}: FM=${a.fullMoon.slice(0, 10)}  moonRA=${a.moonRA}  spicaRA=${a.spicaRA}  diff=${a.diff}  qualifies=${a.qualifies}`);
    });
    failed++;
  } else {
    assert(`Year ${year}: returned non-null`, false, 'null returned');
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 3: generateYear succeeds with virgoFeet rule
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 3: generateYear produces valid calendar with virgoFeet rule');

for (const year of ALL_YEARS) {
  const engine = new LunarCalendarEngine(astroEngine);
  engine.configure(VIRGO_PROFILE);

  try {
    const calendar = engine.generateYear(year, JERUSALEM);
    const monthCount = calendar.months?.length || 0;
    assert(
      `Year ${year}: ${monthCount} months`,
      monthCount >= 12 && monthCount <= 13,
      `got ${monthCount} months`
    );
  } catch (err) {
    assert(`Year ${year}: no error`, false, err.message);
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 4: Virgo qualifying moon is astronomically reasonable
//         (should be March–May for most years)
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 4: Qualifying full moon falls in expected March–June window');

for (const year of GOOD_YEARS) {
  const engine = new LunarCalendarEngine(astroEngine);
  engine.configure(VIRGO_PROFILE);

  const result = engine._findVirgoFeetFullMoon(year, JERUSALEM);
  if (result) {
    const month = result.getUTCMonth(); // 0-based
    assert(
      `Year ${year}: qualifying moon in month ${month + 1} (${result.toISOString().slice(0, 10)})`,
      month >= 2 && month <= 5, // March (2) through June (5)
      `month ${month + 1} is outside expected range`
    );
  } else {
    assert(`Year ${year}: found qualifying moon`, false, 'null');
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 5: Zero-RA detection (simulate broken getEquator)
//         Proves that silent {ra:0} fallback is the failure mode
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 5: Broken getEquator (ra=0) always causes fallback');

const brokenEngine = {
  ...astroEngine,
  getEquator: () => ({ ra: 0, dec: 0 })
};

const brokenCalc = new LunarCalendarEngine(brokenEngine);
brokenCalc.configure(VIRGO_PROFILE);

const brokenResult = brokenCalc._findVirgoFeetFullMoon(2025, JERUSALEM);
const brokenCacheKey = `2025_${JERUSALEM.lat.toFixed(4)}_${JERUSALEM.lon.toFixed(4)}`;
const brokenCached = brokenCalc._virgoCache[brokenCacheKey];

assert(
  'Broken engine: search uses fallback',
  brokenCached?.fallback === true,
  `fallback=${brokenCached?.fallback}`
);

const allZero = brokenCached?.attempts?.every(a => parseFloat(a.moonRA) < 1);
assert(
  'Broken engine: all attempts have moonRA near 0',
  allZero === true,
  `moonRAs: ${brokenCached?.attempts?.map(a => a.moonRA).join(', ')}`
);

// ═══════════════════════════════════════════════════════════
// TEST 6: Spica RA precession is reasonable for all years
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 6: Spica RA precession sanity check');

const PRECESSION_RATE = 0.0139;
const SPICA_RA_J2000 = 201.298;

for (const year of ALL_YEARS) {
  const yearsFromJ2000 = year - 2000;
  const spicaRA = SPICA_RA_J2000 + (yearsFromJ2000 * PRECESSION_RATE);
  assert(
    `Year ${year}: Spica RA = ${spicaRA.toFixed(3)}° (precession offset: ${(yearsFromJ2000 * PRECESSION_RATE).toFixed(3)}°)`,
    spicaRA > 180 && spicaRA < 210,
    `Spica RA ${spicaRA.toFixed(3)}° outside plausible range`
  );
}

// ═══════════════════════════════════════════════════════════
// TEST 7: Year boundary — generateYear(1535) must call
//         getYearStartPoint for both 1535 AND 1536
//         Verify both work without fallback
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 7: Year boundary — both year N and year N+1 start points resolve');

for (const year of BUG_YEARS) {
  const engine = new LunarCalendarEngine(astroEngine);
  engine.configure(VIRGO_PROFILE);

  // Call getYearStartPoint for both year and year+1
  // (this is what generateYear does internally)
  try {
    const startPoint = engine.getYearStartPoint(year, JERUSALEM);
    const nextStartPoint = engine.getYearStartPoint(year + 1, JERUSALEM);

    assert(
      `Year ${year}: yearStart=${startPoint.toISOString().slice(0, 10)}, nextYearStart=${nextStartPoint.toISOString().slice(0, 10)}`,
      startPoint < nextStartPoint,
      `year start ${startPoint.toISOString()} should be before next year start ${nextStartPoint.toISOString()}`
    );
  } catch (err) {
    assert(`Year ${year}: getYearStartPoint didn't throw`, false, err.message);
  }
}

// ═══════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(55)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('SOME TESTS FAILED — see details above');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
}
