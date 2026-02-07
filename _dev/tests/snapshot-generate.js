#!/usr/bin/env node
/**
 * Snapshot Generator for Sabbath Tester
 *
 * Runs all BIBLICAL_TESTS against all profile combinations using
 * LunarCalendarEngine, then writes the results to a golden JSON file.
 *
 * Usage: node snapshot-generate.js
 */

const fs = require('fs');
const path = require('path');
const astroEngine = require('./astro-engine-node');
const { LunarCalendarEngine } = require('../../lunar-calendar-engine.js');
const { BIBLICAL_TESTS } = require('../../views/sabbath-tester-view.js');

// Same profile combinations as SabbathTesterView.getSabbathTestProfiles()
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

  // Determine pass/fail (same logic as SabbathTesterView.runBiblicalTest)
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

console.log('Generating snapshot...\n');

const profiles = buildProfiles();
const results = [];
let errorCount = 0;

for (const test of BIBLICAL_TESTS) {
  for (const profile of profiles) {
    process.stdout.write(`  ${test.id} + ${profile.id}...`);
    try {
      const outcome = runTest(test, profile);
      results.push({
        testId: test.id,
        profileId: profile.id,
        ...outcome
      });
      process.stdout.write(` ${outcome.result || 'error'}\n`);
    } catch (err) {
      errorCount++;
      results.push({
        testId: test.id,
        profileId: profile.id,
        error: err.message
      });
      process.stdout.write(` ERROR: ${err.message}\n`);
    }
  }
}

// Write snapshot
const snapshotDir = path.join(__dirname, 'snapshots');
if (!fs.existsSync(snapshotDir)) {
  fs.mkdirSync(snapshotDir);
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  testCount: BIBLICAL_TESTS.length,
  profileCount: profiles.length,
  totalResults: results.length,
  results
};

const outPath = path.join(snapshotDir, 'sabbath-tester.json');
fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

console.log(`\nSnapshot written: ${outPath}`);
console.log(`  ${results.length} results (${BIBLICAL_TESTS.length} tests x ${profiles.length} profiles)`);
if (errorCount > 0) {
  console.log(`  ${errorCount} errors`);
}
