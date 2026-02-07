#!/usr/bin/env node
/**
 * Snapshot Verifier for Sabbath Tester
 *
 * Loads the golden snapshot, re-runs all computations, and compares.
 * Exits 0 if everything matches, 1 if any mismatch is found.
 *
 * Usage: node snapshot-verify.js
 */

const fs = require('fs');
const path = require('path');
const astroEngine = require('./astro-engine-node');
const { LunarCalendarEngine } = require('../../lunar-calendar-engine.js');
const { BIBLICAL_TESTS } = require('../../views/sabbath-tester-view.js');

// Same profile builder as snapshot-generate.js
const MOON_PHASES = [
  { id: 'full', name: 'Full Moon' },
  { id: 'dark', name: 'Dark Moon' },
  { id: 'crescent', name: 'Crescent Moon' }
];

const DAY_STARTS = [
  { id: 'morning', name: 'Daybreak', angle: 12 },
  { id: 'evening', name: 'Sunset', angle: 0 }
];

const YEAR_RULES = [
  { id: 'equinox', name: 'Equinox' },
  { id: '14daysBefore', name: 'Lamb' }
];

function buildProfiles() {
  const profiles = [];
  for (const moon of MOON_PHASES) {
    for (const dayStart of DAY_STARTS) {
      for (const yearRule of YEAR_RULES) {
        profiles.push({
          id: `test-${moon.id}-${dayStart.id}-${yearRule.id}`,
          name: `${moon.name} ${dayStart.name} ${yearRule.name}`,
          moonPhase: moon.id,
          dayStartTime: dayStart.id,
          dayStartAngle: dayStart.angle,
          yearStartRule: yearRule.id,
          crescentThreshold: 18,
          sabbathMode: 'saturday'
        });
      }
    }
  }
  return profiles;
}

function runTest(test, profile) {
  const engine = new LunarCalendarEngine(astroEngine);
  engine.configure({
    moonPhase: profile.moonPhase,
    dayStartTime: profile.dayStartTime,
    dayStartAngle: profile.dayStartAngle,
    yearStartRule: profile.yearStartRule,
    crescentThreshold: profile.crescentThreshold
  });

  const calendar = engine.generateYear(test.year, test.location, { includeUncertainty: true });
  const dayInfo = engine.getDayInfo(calendar, test.month, test.day);

  if (!dayInfo) {
    return { error: 'Day not found in calendar' };
  }

  const monthData = dayInfo.monthData;
  const uncertainty = monthData?.uncertainty || null;
  let result, probability = null;

  if (dayInfo.weekday === test.expectedWeekday) {
    if (uncertainty && uncertainty.probability > 0) {
      result = 'uncertain';
      probability = 100 - uncertainty.probability;
    } else {
      result = 'pass';
    }
  } else {
    if (uncertainty && uncertainty.probability > 0) {
      let alternativeWeekday = null;
      if (uncertainty.direction === '-') {
        alternativeWeekday = (dayInfo.weekday + 6) % 7;
      } else if (uncertainty.direction === '+') {
        alternativeWeekday = (dayInfo.weekday + 1) % 7;
      }
      if (alternativeWeekday === test.expectedWeekday) {
        result = 'uncertain';
        probability = uncertainty.probability;
      } else {
        result = 'fail';
      }
    } else {
      result = 'fail';
    }
  }

  return {
    jd: Math.floor(dayInfo.jd),
    weekday: dayInfo.weekday,
    weekdayName: dayInfo.weekdayName,
    gregorianDate: dayInfo.gregorianDate.toISOString(),
    result,
    probability
  };
}

// --- Main ---

const snapshotPath = path.join(__dirname, 'snapshots', 'sabbath-tester.json');

if (!fs.existsSync(snapshotPath)) {
  console.error('No snapshot found. Run "npm run snapshot:generate" first.');
  process.exit(1);
}

const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
console.log(`Loaded snapshot: ${snapshot.totalResults} results (generated ${snapshot.generatedAt})\n`);

const profiles = buildProfiles();
const profileMap = {};
for (const p of profiles) profileMap[p.id] = p;

const testMap = {};
for (const t of BIBLICAL_TESTS) testMap[t.id] = t;

let passed = 0;
let failed = 0;
let errors = 0;

// Fields to compare (skip probability since floating-point can vary)
const COMPARE_FIELDS = ['jd', 'weekday', 'weekdayName', 'result'];

for (const expected of snapshot.results) {
  const test = testMap[expected.testId];
  const profile = profileMap[expected.profileId];

  if (!test || !profile) {
    console.log(`  ? SKIP ${expected.testId} + ${expected.profileId} (test or profile not found)`);
    errors++;
    continue;
  }

  let actual;
  try {
    actual = runTest(test, profile);
  } catch (err) {
    console.log(`  \x1b[31mX\x1b[0m ${expected.testId} + ${expected.profileId}: ERROR ${err.message}`);
    failed++;
    continue;
  }

  // If snapshot recorded an error, check we also get an error
  if (expected.error) {
    if (actual.error) {
      passed++;
    } else {
      console.log(`  \x1b[31mX\x1b[0m ${expected.testId} + ${expected.profileId}: expected error but got result`);
      failed++;
    }
    continue;
  }

  // Compare fields
  const mismatches = [];
  for (const field of COMPARE_FIELDS) {
    if (expected[field] !== actual[field]) {
      mismatches.push(`${field}: expected ${expected[field]}, got ${actual[field]}`);
    }
  }

  if (mismatches.length === 0) {
    passed++;
  } else {
    console.log(`  \x1b[31mX\x1b[0m ${expected.testId} + ${expected.profileId}:`);
    for (const m of mismatches) {
      console.log(`      ${m}`);
    }
    failed++;
  }
}

// Summary
console.log(`\n${'='.repeat(50)}`);
if (failed === 0 && errors === 0) {
  console.log(`\x1b[32m  ALL ${passed} TESTS PASSED\x1b[0m`);
  process.exit(0);
} else {
  console.log(`\x1b[32m  ${passed} passed\x1b[0m`);
  if (failed > 0) console.log(`\x1b[31m  ${failed} failed\x1b[0m`);
  if (errors > 0) console.log(`\x1b[33m  ${errors} skipped/errors\x1b[0m`);
  console.log(`\nIf changes are intentional, run: npm run snapshot:update`);
  process.exit(1);
}
