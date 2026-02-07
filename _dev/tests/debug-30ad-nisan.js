#!/usr/bin/env node
/**
 * Debug 30 AD: conjunctions vs equinox, and why 14th is May 6 (us) vs April 5 (119).
 * Run from repo root: node _dev/tests/debug-30ad-nisan.js
 */

const Astronomy = require('astronomy-engine');
const { LunarCalendarEngine } = require('../../lunar-calendar-engine.js');

const LOCATION = { lat: 31.7683, lon: 35.2137 }; // Jerusalem

const astroEngine = {
  name: 'astronomy-engine',
  searchMoonPhase(phase, startDate, limitDays) {
    return Astronomy.SearchMoonPhase(phase, startDate, limitDays);
  },
  getSeasons(year) {
    if (year >= 0 && year < 100) {
      const startDate = new Date(Date.UTC(2000, 0, 1));
      startDate.setUTCFullYear(year);
      const equinox = Astronomy.SearchSunLongitude(0, startDate, 120);
      if (equinox) return { mar_equinox: equinox };
    }
    return Astronomy.Seasons(year);
  },
  searchRiseSet(body, observer, direction, startDate, limitDays) {
    const astroBody = body === 'sun' ? Astronomy.Body.Sun : Astronomy.Body.Moon;
    return Astronomy.SearchRiseSet(astroBody, observer, direction, startDate, limitDays);
  },
  searchAltitude(body, observer, direction, startDate, limitDays, altitude) {
    const astroBody = body === 'sun' ? Astronomy.Body.Sun : Astronomy.Body.Moon;
    return Astronomy.SearchAltitude(astroBody, observer, direction, startDate, limitDays, altitude);
  },
  createObserver(lat, lon, elevation = 0) {
    return new Astronomy.Observer(lat, lon, elevation);
  }
};

function formatDate(d) {
  if (!d || !d.date) return '?';
  const x = d.date instanceof Date ? d.date : d;
  return x.toISOString().slice(0, 19).replace('T', ' ');
}

function weekday(d) {
  const x = d instanceof Date ? d : (d && d.date);
  if (!x) return '?';
  const jdn = Math.floor((x.getTime() / 86400000) + 2440587.5);
  const w = (jdn + 1) % 7;
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][w];
}

// 30 AD: build dates from JD to avoid JS Date 0-99 = 1900-1999
const yearAD = 30;
const JD_EPOCH_MS = 2440587.5 * 86400000;
function jdToDate(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}
// Jan 1 30 AD ≈ JD 1732016.5, May 31 30 AD ≈ JD 1732116.5
const jan1_30 = jdToDate(1732016.5);
const may31_30 = jdToDate(1732116.5);

console.log('=== 30 AD: Equinox and conjunctions (Jerusalem) ===\n');

const equinoxResult = Astronomy.SearchSunLongitude(0, jan1_30, 120);
if (!equinoxResult) {
  console.error('No equinox for year', yearAD);
  process.exit(1);
}
const equinoxDate = equinoxResult.date || jdToDate(equinoxResult.tt / 24 + 2451545);
console.log('Spring equinox', yearAD + ' AD:', equinoxDate.toISOString(), weekday(equinoxDate));

// Conjunctions (phase 0) from Jan 1 to end May 30 AD
let searchDate = new Date(jan1_30.getTime());
const endDate = new Date(may31_30.getTime());
const conjunctions = [];
while (searchDate < endDate) {
  const result = Astronomy.SearchMoonPhase(0, searchDate, 35);
  if (!result) break;
  const d = result.date || jdToDate(result.tt / 24 + 2451545);
  if (d >= endDate) break;
  if (d >= jan1_30) {
    conjunctions.push(d);
  }
  searchDate = new Date(d.getTime() + 25 * 86400000);
}

console.log('\nConjunctions (new moon) Jan–May 30 AD:');
conjunctions.forEach((c, i) => {
  const beforeEq = c < equinoxDate ? ' BEFORE equinox' : ' on or after equinox';
  const y = c.getUTCFullYear();
  console.log('  ', (i + 1) + '.', c.toISOString().slice(0, 19), weekday(c), beforeEq, y < 100 ? '(year ' + y + ')' : '');
});

// Which one is "first on or after equinox"?
const firstOnOrAfter = conjunctions.find(c => c >= equinoxDate);
console.log('\nFirst conjunction on or after equinox:', firstOnOrAfter ? firstOnOrAfter.toISOString().slice(0, 19) : 'April (next lunation)');
console.log('March conjunction (~Mar 20) is BEFORE equinox (~Mar 20 22:31) → 119 use it → Nisan 1 ~Mar 21, 14th ~Apr 5 (Wed).');
console.log('We use first conjunction ≥ equinox → April conjunction → Nisan 1 in April, 14th in May.\n');

// 119 profile: dark, evening, 18°, equinox
const engine119 = new LunarCalendarEngine(astroEngine);
engine119.configure({
  moonPhase: 'dark',
  dayStartTime: 'evening',
  dayStartAngle: 18,
  yearStartRule: 'equinox',
  crescentThreshold: 18
});

// Engine generateYear(30, ...) uses JS Date year 30 = 1930 in internal search; so skip engine run
// or run with year 2030 and note. We already have conjunctions vs equinox above.
const marchConj = conjunctions.find(c => c.getUTCMonth() === 2);
const aprilConj = conjunctions.find(c => c.getUTCMonth() === 3);
if (marchConj && equinoxDate) {
  const marchBeforeEq = marchConj < equinoxDate;
  console.log('\nMarch conjunction', marchBeforeEq ? 'BEFORE' : 'AFTER', 'equinox →', marchBeforeEq ? '119 would use this (Nisan 1 ~March, 14th ~April 5)' : 'we would use this');
}
if (aprilConj) {
  console.log('April conjunction is the first ON OR AFTER equinox → our rule picks this → Nisan 14 in May.');
}

console.log('\n119 Ministries claim: 14th = Wednesday April 5, 30 AD');
console.log('Conclusion: We use first conjunction *on or after* equinox → Nisan ~late April → 14th in May.');
console.log('119 uses the conjunction *before* equinox (March) → Nisan ~March → 14th = April 5. One month earlier.');
