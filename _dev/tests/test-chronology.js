#!/usr/bin/env node
/**
 * Chronology Unit Tests
 * 
 * Verifies that the event resolution system produces the expected dates
 * for key biblical chronology anchors.
 * 
 * Expected results (all Spring-to-Spring / Nisan years):
 *   - Exodus from Egypt: Spring 1446 BC (Nisan 15)
 *   - Jordan Crossing:   Spring 1406 BC (Nisan 10) 
 *   - 4th Year of Solomon: Spring 967 BC (Nisan 1)
 *   - Temple Construction: Spring 966 BC (Iyyar 2)
 *   - 480th inclusive year from Exodus = 4th year of Solomon
 * 
 * Run: node _dev/tests/test-chronology.js
 */

const fs = require('fs');
const path = require('path');

// Load event resolver
const EventResolver = require('../../event-resolver.js');

// Load event data
const dataPath = path.join(__dirname, '../../historical-events-v2.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Time-Tested profile (default)
const PROFILE = {
  moonPhase: 'full',
  dayStartTime: 'morning',
  dayStartAngle: 12,
  yearStartRule: 'equinox',
  crescentThreshold: 18,
  amEpoch: -3959  // Anno Mundi epoch
};

// Resolve all events (resolveAllEvents takes full data object + profile)
console.log('Resolving events...');
let resolved;
try {
  resolved = EventResolver.resolveAllEvents(data, PROFILE);
} catch(e) {
  console.error('Resolution error:', e.message);
  resolved = [];
}
console.log(`Resolved ${resolved.length} events`);
const withJD = resolved.filter(e => e.startJD !== null);
const withoutJD = resolved.filter(e => e.startJD === null);
console.log(`  ${withJD.length} with dates, ${withoutJD.length} without`);
if (withoutJD.length > 0 && withoutJD.length <= 10) {
  withoutJD.forEach(e => console.log(`  - ${e.id}: ${e._error || 'no JD'}`));
}
console.log();

// Helper to find a resolved event
function getEvent(id) {
  const e = resolved.find(r => r.id === id);
  if (!e) throw new Error(`Event not found: ${id}`);
  return e;
}

// Helper to get Gregorian year from JD  
function jdToGreg(jd) {
  return EventResolver.julianDayToGregorian(jd);
}

// Helper to format date for display
function formatDate(jd) {
  if (!jd) return 'null';
  const g = jdToGreg(jd);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const yearStr = g.year <= 0 ? `${1 - g.year} BC` : `${g.year} AD`;
  return `${months[g.month - 1]} ${g.day}, ${yearStr} (JD ${jd.toFixed(2)})`;
}

// Test results tracking
let passed = 0;
let failed = 0;

function assert(name, actual, expected, tolerance = 0) {
  if (typeof expected === 'number' && typeof actual === 'number') {
    if (Math.abs(actual - expected) <= tolerance) {
      console.log(`  ✓ ${name}: ${actual} (expected ${expected})`);
      passed++;
    } else {
      console.log(`  ✗ ${name}: got ${actual}, expected ${expected} (off by ${actual - expected})`);
      failed++;
    }
  } else if (actual === expected) {
    console.log(`  ✓ ${name}: ${actual}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}: got ${actual}, expected ${expected}`);
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 1: Solomon's 4th Year (anchor)
// ═══════════════════════════════════════════════════════════
console.log('TEST 1: Solomon\'s 4th Year');
const sol4 = getEvent('solomon-4th-year');
const sol4Greg = jdToGreg(sol4.startJD);
console.log(`  Resolved: ${formatDate(sol4.startJD)}`);
// Should be Spring 967 BC = astronomical year -966
assert('Year', sol4Greg.year, -966);
assert('Month (Nisan ~= Mar/Apr)', sol4Greg.month >= 3 && sol4Greg.month <= 4, true);

// ═══════════════════════════════════════════════════════════
// TEST 2: Temple Construction
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 2: Temple Construction');
const temple = getEvent('solomon-temple-construction');
const templeGreg = jdToGreg(temple.startJD);
console.log(`  Resolved: ${formatDate(temple.startJD)}`);
// Should be Spring 966 BC = astronomical year -965, Iyyar (month 2)
assert('Year', templeGreg.year, -965);
// Iyyar 2 should be ~April/May
assert('Month (Iyyar ~= Apr/May)', templeGreg.month >= 4 && templeGreg.month <= 5, true);

// ═══════════════════════════════════════════════════════════
// TEST 3: Solomon's Reign
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 3: Solomon\'s Reign');
const solReign = getEvent('solomon-reign');
const solReignGreg = jdToGreg(solReign.startJD);
console.log(`  Resolved: ${formatDate(solReign.startJD)}`);
// 4th year (inclusive) = 3 years before 4th year anchor
// 967 BC + 3 = 970 BC = astronomical year -969
assert('Year', solReignGreg.year, -969);

// ═══════════════════════════════════════════════════════════
// TEST 4: Exodus from Egypt
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 4: Exodus from Egypt');
const exodus = getEvent('exodus-from-egypt');
const exodusGreg = jdToGreg(exodus.startJD);
console.log(`  Resolved: ${formatDate(exodus.startJD)}`);
// Should be Spring 1446 BC = astronomical year -1445
assert('Year', exodusGreg.year, -1445);
// Nisan 15 should be ~March/April
assert('Month (Nisan ~= Mar/Apr)', exodusGreg.month >= 3 && exodusGreg.month <= 4, true);

// ═══════════════════════════════════════════════════════════
// TEST 5: Jordan Crossing
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 5: Jordan Crossing');
const jordan = getEvent('jordan-crossing');
const jordanGreg = jdToGreg(jordan.startJD);
console.log(`  Resolved: ${formatDate(jordan.startJD)}`);
// Should be Spring 1406 BC = astronomical year -1405
assert('Year', jordanGreg.year, -1405);
// Nisan 10 should be ~March/April
assert('Month (Nisan ~= Mar/Apr)', jordanGreg.month >= 3 && jordanGreg.month <= 4, true);

// ═══════════════════════════════════════════════════════════
// TEST 6: Verify 480-year span (Exodus → 4th Year of Solomon)
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 6: 480-year span');
const exodusYear = exodusGreg.year; // Should be -1445
const sol4Year = sol4Greg.year;     // Should be -966
const span = sol4Year - exodusYear;
console.log(`  Exodus: ${exodusYear} → 4th Year: ${sol4Year} = ${span} years (exclusive)`);
assert('Exclusive span', span, 479);
assert('Inclusive span (480th year)', span + 1, 480);

// ═══════════════════════════════════════════════════════════
// TEST 7: Verify 40-year span (Exodus → Jordan)
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 7: 40-year span (Exodus → Jordan)');
const jordanYear = jordanGreg.year; // Should be -1405
const wildernessSpan = jordanYear - exodusYear;
console.log(`  Exodus: ${exodusYear} → Jordan: ${jordanYear} = ${wildernessSpan} years (exclusive)`);
assert('Wilderness years (exclusive)', wildernessSpan, 40);

// ═══════════════════════════════════════════════════════════
// TEST 8: Moses Death before Jordan
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 8: Moses Death before Jordan');
const moses = getEvent('moses-death');
const mosesGreg = jdToGreg(moses.startJD);
console.log(`  Moses Death: ${formatDate(moses.startJD)}`);
console.log(`  Jordan:      ${formatDate(jordan.startJD)}`);
assert('Moses dies before Jordan', moses.startJD < jordan.startJD, true);
// Should be in the same year or year before
assert('Same year or year before', jordanGreg.year - mosesGreg.year <= 1, true);

// ═══════════════════════════════════════════════════════════
// TEST 9: Aaron Death before Moses Death
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 9: Aaron Death before Moses');
const aaron = getEvent('death-of-aaron');
console.log(`  Aaron Death: ${formatDate(aaron.startJD)}`);
console.log(`  Moses Death: ${formatDate(moses.startJD)}`);
assert('Aaron dies before Moses', aaron.startJD < moses.startJD, true);

// ═══════════════════════════════════════════════════════════
// TEST 10: Crucifixion in 32 AD
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 10: Crucifixion');
const crucifixion = getEvent('crucifixion-32ad');
const crucGreg = jdToGreg(crucifixion.startJD);
console.log(`  Resolved: ${formatDate(crucifixion.startJD)}`);
assert('Year', crucGreg.year, 32);

// ═══════════════════════════════════════════════════════════
// TEST 11: David dies in Solomon's 1st year
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 11: David dies in Solomon\'s 1st year');
const david = getEvent('david-death');
const davidGreg = jdToGreg(david.startJD);
console.log(`  David Death:    ${formatDate(david.startJD)}`);
console.log(`  Solomon Reign:  ${formatDate(solReign.startJD)}`);
// David dies after Solomon's accession (Fall) but within his 1st regal year (next Spring)
assert('David dies after Solomon accession', david.startJD > solReign.startJD, true);
// Both in same or adjacent calendar year
const yearDiff = davidGreg.year - solReignGreg.year;
assert('Within 1 calendar year of accession', yearDiff >= 0 && yearDiff <= 1, true);

// ═══════════════════════════════════════════════════════════
// TEST 12: David death → Crucifixion/Pentecost = 1000 years
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 12: David → Crucifixion/Pentecost = 1000 years');
const crucifixionGreg = jdToGreg(crucifixion.startJD);
const davidToCruc = crucifixionGreg.year - davidGreg.year;
console.log(`  David Death: ${davidGreg.year} → Crucifixion: ${crucifixionGreg.year} = ${davidToCruc} years`);
assert('David to Crucifixion (exclusive)', davidToCruc, 1000);

const pentecost = getEvent('pentecost-32ad');
const pentGreg = jdToGreg(pentecost.startJD);
const davidToPent = pentGreg.year - davidGreg.year;
console.log(`  David Death: ${davidGreg.year} → Pentecost: ${pentGreg.year} = ${davidToPent} years`);
assert('David to Pentecost (exclusive)', davidToPent, 1000);

// ═══════════════════════════════════════════════════════════
// TEST 13: Fixed Gregorian events get reverse-calculated lunar dates
// ═══════════════════════════════════════════════════════════
console.log('\nTEST 13: Reverse lunar date calculation');
const israel = getEvent('israel-independence-1948');
console.log(`  Israel 1948: lunarYear=${israel._lunarYear}, lunarMonth=${israel._lunarMonth}, lunarDay=${israel._lunarDay}`);
assert('Israel 1948 has lunar year', israel._lunarYear !== undefined && israel._lunarYear !== null, true);
assert('Israel 1948 has lunar month', israel._lunarMonth !== undefined && israel._lunarMonth !== null, true);
assert('Israel 1948 has lunar day', israel._lunarDay !== undefined && israel._lunarDay !== null, true);
assert('Israel 1948 lunar year is 1948', israel._lunarYear, 1948);

// Eclipse also has fixed gregorian — should get lunar date
const eclipse = getEvent('bur-sagale-eclipse');
console.log(`  Bur-Sagale Eclipse: lunarMonth=${eclipse._lunarMonth}, lunarDay=${eclipse._lunarDay}`);
assert('Eclipse has lunar month', eclipse._lunarMonth !== undefined && eclipse._lunarMonth !== null, true);
assert('Eclipse has lunar day', eclipse._lunarDay !== undefined && eclipse._lunarDay !== null, true);

// ═══════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
}
