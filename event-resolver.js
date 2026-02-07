// Event Resolver Module
// Resolves events from schema v2 format to Julian Day numbers based on calendar profile
// See EVENT_SCHEMA.md for full schema specification

// Wrap in IIFE to avoid global namespace conflicts
(function() {
'use strict';

// ============================================================================
// JULIAN DAY CONVERSION UTILITIES
// ============================================================================

/**
 * Convert Gregorian date to Julian Day Number
 * Uses astronomical year numbering (year 0 exists, negative years = BC)
 * @param {number} year - Gregorian year (negative for BC)
 * @param {number} month - Month (1-12)
 * @param {number} day - Day of month
 * @returns {number} Julian Day Number
 */
function gregorianToJulianDay(year, month, day) {
  // Algorithm from Astronomical Algorithms by Jean Meeus
  // Uses astronomical year numbering: 1 BC = year 0, 2 BC = year -1, 35 BC = year -34
  // Our data uses astronomical years directly
  let y = year;
  let m = month;
  
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  
  return Math.floor(365.25 * (y + 4716)) +
         Math.floor(30.6001 * (m + 1)) +
         day + B - 1524.5;
}

/**
 * Convert Julian Day Number to Proleptic Gregorian date
 * @param {number} jd - Julian Day Number
 * @returns {{year: number, month: number, day: number}}
 */
function julianDayToGregorian(jd) {
  const Z = Math.floor(jd + 0.5);
  const F = (jd + 0.5) - Z;
  
  // Apply Gregorian correction for all dates (proleptic Gregorian)
  const alpha = Math.floor((Z - 1867216.25) / 36524.25);
  const A = Z + 1 + alpha - Math.floor(alpha / 4);
  
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  
  const day = B - D - Math.floor(30.6001 * E) + F;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  
  // Return astronomical year numbering:
  // Year 1 = 1 AD, Year 0 = 1 BC, Year -1 = 2 BC, Year -17 = 18 BC
  return { year, month, day: Math.floor(day) };
}

/**
 * Convert Julian Day to JavaScript Date object
 * @param {number} jd - Julian Day Number
 * @returns {Date}
 */
function julianDayToDate(jd) {
  // JD to Unix timestamp: (JD - 2440587.5) * 86400000
  const unixMs = (jd - 2440587.5) * 86400000;
  return new Date(unixMs);
}

/**
 * Convert Julian Day Number to Julian calendar date
 * Use this for historical dates before 1582
 * @param {number} jd - Julian Day Number
 * @returns {{year: number, month: number, day: number}}
 */
function julianDayToJulianCalendar(jd) {
  const Z = Math.floor(jd + 0.5);
  const F = (jd + 0.5) - Z;
  
  // No Gregorian correction - straight Julian calendar
  const A = Z;
  
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  
  const day = B - D - Math.floor(30.6001 * E) + F;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  
  // Return astronomical year numbering
  return { year, month, day: Math.floor(day) };
}

/**
 * Get Julian Day for start of a Gregorian year
 * @param {number} year - Gregorian year
 * @returns {number} Julian Day Number
 */
function yearStartJD(year) {
  return gregorianToJulianDay(year, 1, 1);
}

// ============================================================================
// LUNAR CALENDAR CALCULATIONS
// ============================================================================

const SYNODIC_MONTH = 29.53059; // Average lunar month in days
const LUNAR_YEAR_12 = SYNODIC_MONTH * 12; // ~354.37 days
const LUNAR_YEAR_13 = SYNODIC_MONTH * 13; // ~383.90 days

// Metonic cycle: 19 years with 7 leap years (13 months instead of 12)
const METONIC_CYCLE = 19;
const LEAP_YEARS_IN_CYCLE = [3, 6, 8, 11, 14, 17, 19]; // 1-indexed within cycle

/**
 * Check if a lunar year is a leap year (13 months)
 * @param {number} lunarYear - Lunar year number
 * @returns {boolean}
 */
function isLunarLeapYear(lunarYear) {
  const cyclePos = ((lunarYear % METONIC_CYCLE) + METONIC_CYCLE) % METONIC_CYCLE + 1;
  return LEAP_YEARS_IN_CYCLE.includes(cyclePos);
}

/**
 * Get number of months in a lunar year
 * @param {number} lunarYear - Lunar year number
 * @returns {number} 12 or 13
 */
function monthsInLunarYear(lunarYear) {
  return isLunarLeapYear(lunarYear) ? 13 : 12;
}

/**
 * Calculate the Julian Day of the new moon for a given lunation
 * Uses approximation based on known new moon reference point
 * @param {number} lunation - Lunation number (0 = reference new moon)
 * @param {object} profile - Calendar profile with month start settings
 * @returns {number} Julian Day Number
 */
function newMoonJD(lunation, profile) {
  // Reference new moon: January 6, 2000 at 18:14 UTC = JD 2451550.26
  const referenceJD = 2451550.26;
  const referenceLunation = 0;
  
  // Calculate new moon for this lunation
  let jd = referenceJD + (lunation - referenceLunation) * SYNODIC_MONTH;
  
  // Adjust based on month start rule
  if (profile.monthStart === 'crescent') {
    // Crescent visible ~1-2 days after conjunction
    jd += 1.5;
  } else if (profile.monthStart === 'full') {
    // Full moon is ~14.76 days after new moon
    // But "full moon month start" means month starts at full moon
    // so we need to offset by half a lunation backwards
    jd -= SYNODIC_MONTH / 2;
  }
  // 'conjunction' uses jd as-is
  
  return jd;
}

/**
 * Find the lunation number for a given Julian Day
 * @param {number} jd - Julian Day Number
 * @param {object} profile - Calendar profile
 * @returns {number} Lunation number
 */
function lunationForJD(jd, profile) {
  const referenceJD = 2451550.26;
  let adjustedJD = jd;
  
  // Reverse the month start adjustment
  if (profile.monthStart === 'crescent') {
    adjustedJD -= 1.5;
  } else if (profile.monthStart === 'full') {
    adjustedJD += SYNODIC_MONTH / 2;
  }
  
  return Math.floor((adjustedJD - referenceJD) / SYNODIC_MONTH);
}

// Track iterations to detect runaway calculations
let _resolverIterationCount = 0;
const MAX_RESOLVER_ITERATIONS = 10000;

// Shared LunarCalendarEngine instance - avoids creating new engines repeatedly
// Key: profileConfigKey, Value: configured LunarCalendarEngine
let _sharedLunarEngine = null;
let _sharedEngineConfigKey = null;

function _getEngineConfigKey(profile) {
  const backend = profile.calendarBackend || 'lunar';
  return `${backend}:${profile.moonPhase || 'full'}:${profile.yearStartRule || 'equinox'}:${profile.dayStartTime || 'morning'}:${profile.dayStartAngle ?? 12}:${profile.crescentThreshold ?? 18}`;
}

function _getSharedEngine(profile) {
  const configKey = _getEngineConfigKey(profile);
  
  // Return cached engine if configuration matches
  if (_sharedLunarEngine && _sharedEngineConfigKey === configKey) {
    return _sharedLunarEngine;
  }
  
  const useHebcal = profile.calendarBackend === 'hebcal' &&
    typeof HebcalCalendarAdapter !== 'undefined' &&
    HebcalCalendarAdapter.isAvailable();
  const hasLunarEngine = typeof LunarCalendarEngine !== 'undefined' && typeof getAstroEngine === 'function';
  const astroEngine = hasLunarEngine ? getAstroEngine() : null;
  
  if (useHebcal) {
    if (_sharedEngineConfigKey !== null && _sharedEngineConfigKey !== configKey) {
      _calendarCache.clear();
    }
    _sharedLunarEngine = new HebcalCalendarAdapter();
    _sharedLunarEngine.configure({
      moonPhase: profile.moonPhase || 'full',
      dayStartTime: profile.dayStartTime || 'morning',
      yearStartRule: 'hebcal',
      sabbathMode: profile.sabbathMode || 'saturday'
    });
    _sharedEngineConfigKey = configKey;
    return _sharedLunarEngine;
  }
  
  if (!hasLunarEngine || !astroEngine) {
    return null;
  }
  
  if (_sharedEngineConfigKey !== null && _sharedEngineConfigKey !== configKey) {
    _calendarCache.clear();
  }
  
  _sharedLunarEngine = new LunarCalendarEngine(astroEngine);
  _sharedLunarEngine.configure({
    moonPhase: profile.moonPhase || 'full',
    dayStartTime: profile.dayStartTime || 'morning',
    dayStartAngle: profile.dayStartAngle ?? 12,
    yearStartRule: profile.yearStartRule || 'equinox',
    crescentThreshold: profile.crescentThreshold ?? 18
  });
  _sharedEngineConfigKey = configKey;
  
  return _sharedLunarEngine;
}

// Calendar cache for lunarToJulianDay - avoids regenerating calendars repeatedly
// Key: "year:profileKey", Value: calendar object
const _calendarCache = new Map();
const MAX_CALENDAR_CACHE_SIZE = 20;

function _getCalendarCacheKey(year, profile) {
  const backend = profile.calendarBackend || 'lunar';
  return `${backend}:${year}:${profile.moonPhase || 'full'}:${profile.yearStartRule || 'equinox'}:${profile.dayStartTime || 'morning'}`;
}

function _getCachedCalendar(year, profile, location) {
  const cacheKey = _getCalendarCacheKey(year, profile);
  
  if (_calendarCache.has(cacheKey)) {
    return _calendarCache.get(cacheKey);
  }
  
  // Get shared engine (reuses existing if config matches)
  const engine = _getSharedEngine(profile);
  if (!engine) {
    return null;
  }
  
  // Generate calendar using shared engine
  const calendar = engine.generateYear(year, location);
  
  // Evict oldest entries if cache is full
  if (_calendarCache.size >= MAX_CALENDAR_CACHE_SIZE) {
    const firstKey = _calendarCache.keys().next().value;
    _calendarCache.delete(firstKey);
  }
  
  _calendarCache.set(cacheKey, calendar);
  return calendar;
}

/**
 * Convert lunar date to Julian Day
 * Uses astronomy engine for accurate calculations when available
 * @param {object} lunar - { month, day, year? }
 * @param {number} gregorianYear - Gregorian year for context (if lunar.year not provided)
 * @param {object} profile - Calendar profile
 * @returns {number} Julian Day Number
 */
function lunarToJulianDay(lunar, gregorianYear, profile) {
  // Track iterations
  _resolverIterationCount++;
  if (_resolverIterationCount > MAX_RESOLVER_ITERATIONS) {
    throw new Error(`Resolver exceeded ${MAX_RESOLVER_ITERATIONS} iterations - possible infinite loop`);
  }
  
  const year = lunar.year !== undefined ? lunar.year : gregorianYear;
  
  
  // Default month/day to 1 if not specified (year-only lunar date)
  const month = lunar.month !== undefined ? lunar.month : 1;
  const day = lunar.day !== undefined ? lunar.day : 1;
  
  // Create normalized lunar object with defaults
  const normalizedLunar = { year, month, day };
  
  // Use LunarCalendarEngine for accurate lunar date calculations
  const USE_ASTRONOMY_ENGINE = true;
  
  // Swiss Ephemeris Moshier range: JD 625000.50 to 2818000.50
  // This corresponds roughly to years -1700 to 4300
  // Only use astronomy engine for years within this range
  const MIN_ASTRO_YEAR = -1700;
  const MAX_ASTRO_YEAR = 4300;
  const yearInRange = year >= MIN_ASTRO_YEAR && year <= MAX_ASTRO_YEAR;
  
  const location = { lat: profile.lat || 31.7683, lon: profile.lon || 35.2137 };
  
  if (USE_ASTRONOMY_ENGINE && yearInRange) {
    // Use cached calendar (generates only once per year/profile combination)
    const calendar = _getCachedCalendar(year, profile, location);
  
    if (calendar && calendar.months && calendar.months.length >= normalizedLunar.month) {
      const targetMonth = calendar.months[normalizedLunar.month - 1];
      if (targetMonth && targetMonth.days) {
        const targetDay = targetMonth.days.find(d => d.lunarDay === normalizedLunar.day);
        if (targetDay && targetDay.jd) {
          return targetDay.jd;
        }
      }
    }
    
  }
  const yearStartRule = profile.yearStartRule || 'equinox';
  let yearStartApprox;
  if (yearStartRule === 'equinox' || yearStartRule === 'barley' || yearStartRule === '1dayBefore') {
    yearStartApprox = gregorianToJulianDay(year, 3, 20);
  } else if (yearStartRule === 'fall-equinox') {
    yearStartApprox = gregorianToJulianDay(year, 9, 22);
  } else {
    yearStartApprox = gregorianToJulianDay(year, 3, 20);
  }
  
  const yearStartLunation = lunationForJD(yearStartApprox, profile);
  const targetLunation = yearStartLunation + (normalizedLunar.month - 1);
  const monthStartJD = newMoonJD(targetLunation, profile);
  let jd = monthStartJD + (normalizedLunar.day - 1);
  
  // Adjust for time of day
  const dayStartTime = profile.dayStartTime || 'evening';
  if (lunar.time_of_day) {
    if (dayStartTime === 'evening') {
      if (lunar.time_of_day === 'evening' || lunar.time_of_day === 'night') {
        jd -= 0.25;
      } else if (lunar.time_of_day === 'morning' || lunar.time_of_day === 'afternoon') {
        jd += 0.25;
      }
    } else if (dayStartTime === 'morning') {
      if (lunar.time_of_day === 'morning') {
        jd += 0.0;
      } else if (lunar.time_of_day === 'evening' || lunar.time_of_day === 'night') {
        jd += 0.5;
      }
    }
  }
  
  return jd;
}

/**
 * Convert Julian Day to lunar date
 * @param {number} jd - Julian Day Number
 * @param {object} profile - Calendar profile
 * @returns {object} { year, month, day } in lunar calendar
 */
function julianDayToLunar(jd, profile) {
  // Get the Gregorian date to find the approximate year
  const greg = julianDayToGregorian(jd);
  
  // Try the year and previous year to find which lunar year this JD is in
  for (let yearOffset = 0; yearOffset >= -1; yearOffset--) {
    const testYear = greg.year + yearOffset;
    
    // Find when Nisan 1 starts for this lunar year
    const nisan1JD = lunarToJulianDay({ month: 1, day: 1 }, testYear, profile);
    
    
    // If JD is before Nisan 1 of this year, try previous year
    if (jd < nisan1JD) continue;
    
    // Find Nisan 1 of NEXT year to see if JD is within this year
    const nextNisan1JD = lunarToJulianDay({ month: 1, day: 1 }, testYear + 1, profile);
    
    if (jd >= nextNisan1JD) continue; // JD is in a later year
    
    // JD is within this lunar year (between nisan1JD and nextNisan1JD)
    // Now find which month
    for (let month = 1; month <= 13; month++) {
      const monthStartJD = lunarToJulianDay({ month: month, day: 1 }, testYear, profile);
      const nextMonthStartJD = month < 13 
        ? lunarToJulianDay({ month: month + 1, day: 1 }, testYear, profile)
        : nextNisan1JD;
      
      if (jd >= monthStartJD && jd < nextMonthStartJD) {
        // Found the month
        const day = Math.floor(jd - monthStartJD) + 1;
        return { year: testYear, month: month, day: day };
      }
    }
  }
  
  // Fallback: use approximate calculation
  const approxYear = greg.year;
  const nisan1JD = lunarToJulianDay({ month: 1, day: 1 }, approxYear, profile);
  const daysSinceNisan1 = jd - nisan1JD;
  const approxMonth = Math.floor(daysSinceNisan1 / SYNODIC_MONTH) + 1;
  const monthStartJD = lunarToJulianDay({ month: approxMonth, day: 1 }, approxYear, profile);
  const day = Math.floor(jd - monthStartJD) + 1;
  
  return { year: approxYear, month: Math.max(1, approxMonth), day: Math.max(1, day) };
}

/**
 * Convert JavaScript Date to Julian Day
 */
function dateToJulianDay(date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate() + (date.getUTCHours() + date.getUTCMinutes()/60) / 24;
  return gregorianToJulianDay(year, month, day);
}

// ============================================================================
// REGAL YEAR CALCULATIONS
// ============================================================================

/**
 * Convert regal year to Julian Day
 * @param {object} regal - { epoch, year }
 * @param {object} epochs - Epochs definition from data
 * @param {object} profile - Calendar profile
 * @param {object} context - Resolution context (for recursive calls)
 * @returns {number} Julian Day Number
 */
function regalToJulianDay(regal, epochs, profile, context) {
  const epoch = epochs[regal.epoch];
  if (!epoch) {
    console.warn(`Unknown epoch: ${regal.epoch}`);
    return null;
  }
  
  // Get epoch start JD
  const epochStartJD = resolveDateSpec(epoch.start, profile, epochs, context);
  if (epochStartJD === null) return null;
  
  const epochStartGreg = julianDayToGregorian(epochStartJD);
  
  // Apply regal year based on reckoning
  const yearNum = regal.year - 1; // Year 1 = first year, so 0 years offset
  
  switch (epoch.reckoning) {
    case 'spring-to-spring':
      // Each regal year starts at Nisan 1 (approximately March 20-April 20)
      // Find the Nisan 1 for the target year
      const epochGregorian = julianDayToGregorian(epochStartJD);
      const targetYear = epochGregorian.year + yearNum;
      // Nisan 1 is around spring equinox - use lunar calculation
      return lunarToJulianDay({ month: 1, day: 1 }, targetYear, profile);
      
    case 'fall-to-fall':
      // Each regal year starts at Tishri 1 (approximately September)
      const epochGreg2 = julianDayToGregorian(epochStartJD);
      const targetYear2 = epochGreg2.year + yearNum;
      return lunarToJulianDay({ month: 7, day: 1 }, targetYear2, profile);
      
    case 'accession-year':
      // First partial year is "year 0", first full year is "year 1"
      // Add years from epoch start
      return epochStartJD + (yearNum * 365.2422);
      
    case 'exact-date':
      // Count exact years from the specific date
      return epochStartJD + (yearNum * 365.2422);
      
    default:
      // Default to solar years
      return epochStartJD + (yearNum * 365.2422);
  }
}

// ============================================================================
// ANNO MUNDI CALCULATIONS
// ============================================================================

// Default: AM 1 = 4000 BC (can be adjusted based on chronology model)
const DEFAULT_AM_EPOCH = -4000;

/**
 * Convert Anno Mundi date to Julian Day
 * @param {object} am - { year, month?, day? }
 * @param {object} profile - Calendar profile
 * @returns {number} Julian Day Number
 */
function annoMundiToJulianDay(am, profile) {
  const amEpoch = profile.amEpoch || DEFAULT_AM_EPOCH;
  const gregorianYear = amEpoch + am.year - 1; // AM 1 = amEpoch
  
  const month = am.month || 1;
  const day = am.day || 1;
  
  // If we have month/day, use lunar calendar
  if (am.month) {
    return lunarToJulianDay({ month, day }, gregorianYear, profile);
  }
  
  // Otherwise just year start
  return gregorianToJulianDay(gregorianYear, 1, 1);
}

/**
 * Find the next priestly course service date after a reference point
 * @param {object} cycleSpec - { course, after_event, after_offset? }
 *   - course: Course number (1-24) or name (e.g., "Abijah")
 *   - after_event: Event ID to calculate from
 *   - after_offset: Optional offset to add to the reference date
 * @param {object} profile - Calendar profile
 * @param {object} epochs - Epochs definitions
 * @param {object} context - Resolution context
 * @returns {number|null} Julian Day of the next course service
 */
function priestlyCycleToJulianDay(cycleSpec, profile, epochs, context) {
  const { course, after_event, after_offset } = cycleSpec;
  
  
  // Resolve the reference event
  if (!after_event) {
    console.warn('[PriestlyCycle] Error: requires after_event');
    return null;
  }
  
  const refEvent = context.allEvents?.find(e => e.id === after_event);
  if (!refEvent) {
    console.warn(`[PriestlyCycle] Error: referenced event not found: ${after_event}`);
    return null;
  }
  
  const refResolved = resolveEvent(refEvent, profile, epochs, context);
  if (!refResolved?.startJD) {
    console.warn(`[PriestlyCycle] Error: could not resolve referenced event: ${after_event}`);
    return null;
  }
  
  // Apply optional offset to get the "after this date" point
  let afterJD = refResolved.startJD;
  if (after_offset) {
    if (after_offset.days) {
      afterJD += after_offset.days;
    }
    if (after_offset.weeks) {
      afterJD += after_offset.weeks * 7;
    }
  }
  
  // Determine target course number
  let targetCourse = course;
  if (typeof course === 'string') {
    // Map course name to number
    const courseNames = {
      'jehoiarib': 1, 'jedaiah': 2, 'harim': 3, 'seorim': 4,
      'malchijah': 5, 'mijamin': 6, 'hakkoz': 7, 'abijah': 8,
      'jeshua': 9, 'shecaniah': 10, 'eliashib': 11, 'jakim': 12,
      'huppah': 13, 'jeshebeab': 14, 'bilgah': 15, 'immer': 16,
      'hezir': 17, 'happizzez': 18, 'pethahiah': 19, 'jehezkel': 20,
      'jachin': 21, 'gamul': 22, 'delaiah': 23, 'maaziah': 24
    };
    targetCourse = courseNames[course.toLowerCase()] || 8; // Default to Abijah
  }
  
  // Use the passed profile instead of building from global state
  const calcProfile = {
    sabbathMode: profile.sabbathMode || 'lunar',
    moonPhase: profile.moonPhase || 'full',
    dayStartTime: profile.dayStartTime || 'morning',
    dayStartAngle: profile.dayStartAngle ?? 12,
    yearStartRule: profile.yearStartRule || 'equinox',
    crescentThreshold: profile.crescentThreshold ?? 18,
    priestlyCycleAnchor: profile.priestlyCycleAnchor || 'destruction',
    lat: profile.lat || 31.7683,
    lon: profile.lon || 35.2137
  };
  
  // Convert afterJD to Julian calendar for display
  const afterJulian = julianDayToJulianCalendar(afterJD);
  const afterLunar = julianDayToLunar(afterJD, calcProfile);
  
  // Helper to format year as BC/AD
  const formatYear = (y) => y <= 0 ? (1 - y) + ' BC' : y + ' AD';
  
  
  // Find the FIRST occurrence of target course AFTER afterJD
  // Use same method as Day Detail: iterate through calendar days with actual lunarDay values
  if (typeof getPriestlyCourse === 'function' && typeof LunarCalendarEngine !== 'undefined' && typeof getAstroEngine === 'function') {
    // Use shared engine (avoids creating new engine on every call)
    const calendarEngine = _getSharedEngine(calcProfile);
    if (calendarEngine) {
      const location = { lat: calcProfile.lat, lon: calcProfile.lon };
      
      // Get the LUNAR year for afterJD (not Gregorian year)
      const afterLunarInfo = julianDayToLunar(afterJD, calcProfile);
      if (!afterLunarInfo) {
        console.warn('[PriestlyCycle] Could not determine lunar year for afterJD');
        return null;
      }
      
      
      // Generate calendar for current lunar year and next year
      for (let yearOffset = 0; yearOffset <= 1; yearOffset++) {
        const lunarYear = afterLunarInfo.year + yearOffset;
        const calendar = calendarEngine.generateYear(lunarYear, location);
        if (!calendar?.months) continue;
        
        for (const month of calendar.months) {
          if (!month.days) continue;
          
          for (const dayObj of month.days) {
            if (!dayObj.jd || dayObj.jd <= afterJD) continue;
            
            // Call getPriestlyCourse with lunar day only (NOT month)
            // If we pass month, it uses state.lunarMonths which is the CURRENT year, not this historical year
            const courseInfo = getPriestlyCourse(
              dayObj.gregorianDate,
              dayObj.lunarDay,
              null,  // Don't pass month - it would use wrong year's state.lunarMonths
              calcProfile
            );
            
            if (courseInfo && !courseInfo.beforeAnchor && !courseInfo.beforeDedication && courseInfo.order === targetCourse) {
              // Found the target course (Abijah)
              // Now find when the NEXT course starts - that's when Zechariah is done and home
              const nextCourse = (targetCourse % 24) + 1; // Course 9 after Abijah (8)
              
              for (const nextMonth of calendar.months) {
                if (!nextMonth.days) continue;
                for (const nextDayObj of nextMonth.days) {
                  if (!nextDayObj.jd || nextDayObj.jd <= dayObj.jd) continue;
                  
                  const nextCourseInfo = getPriestlyCourse(
                    nextDayObj.gregorianDate,
                    nextDayObj.lunarDay,
                    null,
                    calcProfile
                  );
                  
                  if (nextCourseInfo && nextCourseInfo.order === nextCourse) {
                    // Found the next course - return the start of this week
                    let weekStartLunarDay;
                    if (nextDayObj.lunarDay <= 8) weekStartLunarDay = 2; // Day 1 is New Moon
                    else if (nextDayObj.lunarDay <= 15) weekStartLunarDay = 9;
                    else if (nextDayObj.lunarDay <= 22) weekStartLunarDay = 16;
                    else weekStartLunarDay = 23;
                    
                    const daysBack = nextDayObj.lunarDay - weekStartLunarDay;
                    return nextDayObj.jd - daysBack;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    console.warn('[PriestlyCycle] Could not find course', targetCourse, 'in calendar');
    return null;
  }
  
  // Fallback: original calculation if LunarCalendarEngine is not available
  console.log('[PriestlyCycle] Using fallback calculation (LunarCalendarEngine not available)');
  
  const sabbathMode = profile?.sabbathMode || 'lunar';
  const TEMPLE_DESTRUCTION_JD = 1746839;
  
  if (sabbathMode === 'lunar') {
    // Lunar sabbath: 4 weeks per lunar month
    const deltaJD = afterJD - TEMPLE_DESTRUCTION_JD;
    const deltaMonths = deltaJD / SYNODIC_MONTH;
    const fullMonths = Math.floor(deltaMonths);
    const totalWeeks = fullMonths * 4;
    const currentCourseIndex = ((totalWeeks % 24) + 24) % 24;
    
    let weeksUntilTarget = (targetCourse - 1) - currentCourseIndex;
    if (weeksUntilTarget <= 0) {
      weeksUntilTarget += 24;
    }
    
    const daysPerLunarWeek = SYNODIC_MONTH / 4;
    const serviceWeekDuration = daysPerLunarWeek;
    const travelHomeBuffer = 1;
    const daysUntilConception = (weeksUntilTarget * daysPerLunarWeek) + serviceWeekDuration + travelHomeBuffer;
    
    const resultJD = afterJD + daysUntilConception;
    return resultJD;
    
  } else {
    // Saturday sabbath: continuous 7-day weeks
    const deltaJD = afterJD - TEMPLE_DESTRUCTION_JD;
    const deltaWeeks = Math.floor(deltaJD / 7);
    const currentCourseIndex = ((deltaWeeks % 24) + 24) % 24;
    
    let weeksUntilTarget = (targetCourse - 1) - currentCourseIndex;
    if (weeksUntilTarget <= 0) {
      weeksUntilTarget += 24;
    }
    
    const serviceWeekDuration = 7;
    const travelHomeBuffer = 1;
    const daysUntilConception = (weeksUntilTarget * 7) + serviceWeekDuration + travelHomeBuffer;
    
    const resultJD = afterJD + daysUntilConception;
    return resultJD;
  }
}

// ============================================================================
// DURATION APPLICATION
// ============================================================================

/**
 * Apply a duration to a Julian Day
 * @param {number} startJD - Starting Julian Day
 * @param {object} duration - { value, unit, reckoning? }
 * @param {object} profile - Calendar profile
 * @returns {number} Ending Julian Day
 */
function applyDuration(startJD, duration, profile) {
  // Handle both new format { value, unit } and legacy format { years, days, months }
  let value = duration.value;
  let unit = duration.unit;
  
  // Legacy format support: { years: X } or { days: X } or { months: X }
  if (value === undefined || unit === undefined) {
    if (duration.years !== undefined) {
      value = duration.years;
      unit = 'years';
    } else if (duration.days !== undefined) {
      value = duration.days;
      unit = 'days';
    } else if (duration.months !== undefined) {
      value = duration.months;
      unit = 'months';
    } else if (duration.weeks !== undefined) {
      value = duration.weeks;
      unit = 'weeks';
    }
  }
  
  switch (unit) {
    case 'days':
      return startJD + value;
      
    case 'weeks':
      return startJD + (value * 7);
      
    case 'lunar_weeks':
      // Lunar weeks average ~7.38 days (29.53 / 4)
      return startJD + (value * SYNODIC_MONTH / 4);
      
    case 'months':
      return startJD + (value * SYNODIC_MONTH);
      
    case 'solar_years':
      return startJD + (value * 365.2422);
      
    case 'years':
    case 'lunar_years': {
      // For lunar year durations:
      // 1. Convert the start JD to a lunar date (month, day, year)
      // 2. Add/subtract the duration from the lunar year
      // 3. Find the JD for the same lunar month/day in the target year
      
      // Convert start JD to lunar date
      const startLunar = julianDayToLunar(startJD, profile);
      const targetYear = startLunar.year + value;
      
      // Find the same lunar month/day in the target year
      return lunarToJulianDay({ month: startLunar.month, day: startLunar.day }, targetYear, profile);
    }
      
    case 'regal_years':
      // Regal years depend on reckoning
      if (duration.reckoning === 'spring-to-spring' || duration.reckoning === 'fall-to-fall') {
        // Spring-to-spring: starts Nisan 1, ends last day of Adar (Nisan 1 - 1 day)
        // Fall-to-fall: starts Tishri 1, ends last day of Elul (Tishri 1 - 1 day)
        // N regal years means from Nisan 1 year X to Adar 29/30 year X+(N-1)
        const avgLunarYear = (235 * SYNODIC_MONTH) / 19;
        return startJD + (value * avgLunarYear) - 1; // -1 day: ends day before next year starts
      }
      // Default to solar years
      return startJD + (value * 365.2422);
      
    default:
      console.warn(`Unknown duration unit: ${unit}, defaulting to solar years`);
      return startJD + (value * 365.2422);
  }
}

// ============================================================================
// MAIN RESOLVER
// ============================================================================

/**
 * Resolve a date specification to Julian Day
 * @param {object} dateSpec - Date specification (start or end object)
 * @param {object} profile - Calendar profile
 * @param {object} epochs - Epochs definitions
 * @param {object} context - Resolution context { allEvents, resolvedEvents, resolutionStack }
 * @returns {number|null} Julian Day Number or null if unresolvable
 */
function resolveDateSpec(dateSpec, profile, epochs, context) {
  if (!dateSpec) return null;
  
  // Priority 1: Fixed Julian Day (highest certainty)
  if (dateSpec.fixed?.julian_day !== undefined) {
    return dateSpec.fixed.julian_day;
  }
  
  // Priority 2: Fixed Gregorian date (astronomically/historically certain)
  if (dateSpec.fixed?.gregorian) {
    const g = dateSpec.fixed.gregorian;
    return gregorianToJulianDay(g.year, g.month || 1, g.day || 1);
  }
  
  // Priority 3: Plain Gregorian date
  if (dateSpec.gregorian) {
    const g = dateSpec.gregorian;
    return gregorianToJulianDay(g.year, g.month || 1, g.day || 1);
  }
  
  // Priority 4: Regal year (requires epoch lookup)
  // BUT: Skip if there's also a relative reference (relative is the primary source,
  // regal is just verification/reference in that case)
  if (dateSpec.regal && !dateSpec.relative) {
    return regalToJulianDay(dateSpec.regal, epochs, profile, context);
  }
  
  // Priority 5: Lunar date (profile-dependent)
  // Note: If there's also a relative reference, we'll use that to get the year
  if (dateSpec.lunar && !dateSpec.relative) {
    // Need a year context - try to get from lunar object, other fields, or default
    let year = null;
    if (dateSpec.lunar.year !== undefined) {
      // Year specified directly in lunar object
      year = dateSpec.lunar.year;
    } else if (dateSpec.gregorian?.year !== undefined) {
      year = dateSpec.gregorian.year;
    } else if (dateSpec.anno_mundi?.year !== undefined) {
      year = (profile.amEpoch || DEFAULT_AM_EPOCH) + dateSpec.anno_mundi.year - 1;
    }
    
    if (year !== null) {
      if (dateSpec.lunar.month != null) {
        // Has at least month precision — use full lunar calendar
        return lunarToJulianDay(dateSpec.lunar, year, profile);
      } else {
        // Year-only — cheap Gregorian approximation (skip lunar engine)
        return gregorianToJulianDay(year, 1, 1);
      }
    }
    // Can't resolve without year context
    return null;
  }
  
  // Priority 6: Anno Mundi
  if (dateSpec.anno_mundi) {
    return annoMundiToJulianDay(dateSpec.anno_mundi, profile);
  }
  
  // Priority 6.5: Priestly Cycle - find next service date for a course after reference
  // Used for events like John the Baptist's conception (next Abijah service)
  if (dateSpec.priestly_cycle) {
    return priestlyCycleToJulianDay(dateSpec.priestly_cycle, profile, epochs, context);
  }
  
  // Priority 6.6: Lunar Relative - use year from reference event, but specific month/day
  // Used for events that need a specific month/day but derive year from another event
  if (dateSpec.lunar_relative) {
    const refEventId = dateSpec.lunar_relative.event;
    
    // Check for circular dependency
    if (context.resolutionStack?.includes(refEventId)) {
      console.warn(`Circular dependency detected in lunar_relative: ${refEventId}`);
      return null;
    }
    
    // Find and resolve the referenced event to get the year
    const refEvent = context.allEvents?.find(e => e.id === refEventId);
    if (!refEvent) {
      console.warn(`Referenced event not found for lunar_relative: ${refEventId}`);
      return null;
    }
    
    const refResolved = resolveEvent(refEvent, profile, epochs, context);
    if (!refResolved?.startJD) {
      console.warn(`Could not resolve referenced event for lunar_relative: ${refEventId}`);
      return null;
    }
    
    // Get the lunar year from the resolved reference event
    // Prefer _lunarYear from chain calculation (more accurate)
    let refYear;
    if (refResolved._lunarYear !== undefined) {
      refYear = refResolved._lunarYear;
    } else if (refEvent.start?.lunar?.year !== undefined) {
      refYear = refEvent.start.lunar.year;
    } else {
      const refLunar = julianDayToLunar(refResolved.startJD, profile);
      if (!refLunar) {
        console.warn(`Could not convert reference event to lunar date`);
        return null;
      }
      refYear = refLunar.year;
    }
    
    // Use the reference year with the specified month/day
    const targetLunar = {
      month: dateSpec.lunar_relative.month,
      day: dateSpec.lunar_relative.day
    };
    
    let resultJD = lunarToJulianDay(targetLunar, refYear, profile);
    
    // If the proposed date is BEFORE the reference event, advance to next year
    // This handles cases like: reference is month 7, proposed is month 1 (should be next year)
    if (resultJD < refResolved.startJD) {
      resultJD = lunarToJulianDay(targetLunar, refYear + 1, profile);
      // Store the advanced year for chain propagation
      context._lastCalculatedLunar = { year: refYear + 1, month: targetLunar.month, day: targetLunar.day };
    } else {
      context._lastCalculatedLunar = { year: refYear, month: targetLunar.month, day: targetLunar.day };
    }
    
    return resultJD;
  }
  
  // Priority 7: Relative to another event (may also have lunar date for refinement)
  if (dateSpec.relative) {
    const refEventId = dateSpec.relative.event;
    
    // Check for circular dependency
    if (context.resolutionStack?.includes(refEventId)) {
      console.warn(`Circular dependency detected: ${refEventId}`);
      return null;
    }
    
    // Find the referenced event
    const refEvent = context.allEvents?.find(e => e.id === refEventId);
    if (!refEvent) {
      console.warn(`Referenced event not found: ${refEventId}`);
      return null;
    }
    
    // Resolve the referenced event
    const refResolved = resolveEvent(refEvent, profile, epochs, context);
    if (!refResolved?.startJD) {
      console.warn(`Could not resolve referenced event: ${refEventId}`);
      return null;
    }
    
    // Apply offset
    const offset = dateSpec.relative.offset || {};
    const direction = dateSpec.relative.direction || 'after';
    
    // YEAR OFFSETS: Always use integer year math (not fractional days)
    // This ensures "80 years before 1446 BC" = 1526 BC, not 1527 BC
    if (offset.years && !offset.solar_years) {
      // First, try to get the reference event's lunar year from multiple sources
      // Priority: 1) explicit source lunar.year, 2) previously calculated _lunarYear, 3) julianDayToLunar fallback
      let refYear = null;
      let refMonth = null;
      let refDay = null;
      
      // Check if reference event has explicit lunar year in its source
      if (refEvent.start?.lunar?.year !== undefined) {
        refYear = refEvent.start.lunar.year;
        refMonth = refEvent.start.lunar.month;
        refDay = refEvent.start.lunar.day;
      } 
      // Check if resolved event has a previously calculated lunar year (from chain)
      else if (refResolved._lunarYear !== undefined) {
        refYear = refResolved._lunarYear;
        refMonth = refResolved._lunarMonth;
        refDay = refResolved._lunarDay;
      }
      // Fall back to deriving from resolved JD (least accurate due to boundary issues)
      else {
        const refLunar = julianDayToLunar(refResolved.startJD, profile);
        if (refLunar) {
          refYear = refLunar.year;
          refMonth = refLunar.month;
          refDay = refLunar.day;
        }
      }
      
      if (refYear !== null) {
        const yearsOffset = direction === 'before' ? -offset.years : offset.years;
        const targetYear = refYear + yearsOffset;
        
        // Does THIS event specify its own month/day?
        const hasExplicitMonthDay = dateSpec.lunar?.month != null;
        
        if (hasExplicitMonthDay) {
          // Event stipulates its own month/day — full lunar computation (day precision)
          const targetMonth = dateSpec.lunar.month;
          const targetDay = dateSpec.lunar.day ?? 1;
          
          let resultJD = lunarToJulianDay({ month: targetMonth, day: targetDay }, targetYear, profile);
          
          // Apply any sub-year offsets (months, weeks, days)
          if (offset.months) resultJD += offset.months * SYNODIC_MONTH;
          if (offset.weeks) resultJD += offset.weeks * 7;
          if (offset.days) resultJD += offset.days;
          
          // Store calculated lunar date for chain propagation
          context._lastCalculatedLunar = { year: targetYear, month: targetMonth, day: targetDay };
          return resultJD;
        } else {
          // Year-only precision — fast arithmetic, skip lunar engine entirely.
          // We only know the year; no need to compute new moons / equinoxes.
          let resultJD = refResolved.startJD + (yearsOffset * 365.2422);
          
          // Apply any sub-year offsets (months, weeks, days)
          if (offset.months) resultJD += offset.months * SYNODIC_MONTH;
          if (offset.weeks) resultJD += offset.weeks * 7;
          if (offset.days) resultJD += offset.days;
          
          // Store year for chain propagation, but month/day are null (unknown)
          context._lastCalculatedLunar = { year: targetYear, month: null, day: null };
          return resultJD;
        }
      }
    }
    
    // SOLAR YEAR OFFSETS: Use fractional days (for precise astronomical calculations)
    // This is explicitly requested with offset.solar_years
    // Note: Use absolute value and let 'direction' control the sign
    // (handles legacy data where both negative value AND direction:"before" might exist)
    if (offset.solar_years) {
      let resultJD = refResolved.startJD;
      const solarYears = Math.abs(offset.solar_years);
      const sign = direction === 'before' ? -1 : 1;
      resultJD += sign * solarYears * 365.2422;
      
      // Apply sub-year offsets
      if (offset.months) resultJD += sign * offset.months * SYNODIC_MONTH;
      if (offset.weeks) resultJD += sign * offset.weeks * 7;
      if (offset.days) resultJD += sign * offset.days;
      
      // If lunar date refinement specified, apply it
      if (dateSpec.lunar) {
        const approxGregorian = julianDayToGregorian(resultJD);
        return lunarToJulianDay(dateSpec.lunar, approxGregorian.year, profile);
      }
      
      return resultJD;
    }
    
    // SUB-YEAR OFFSETS ONLY (months, weeks, days - no year component)
    let offsetDays = 0;
    if (offset.months) offsetDays += offset.months * SYNODIC_MONTH;
    if (offset.weeks) offsetDays += offset.weeks * 7;
    if (offset.days) offsetDays += offset.days;
    
    let resultJD;
    if (direction === 'before') {
      resultJD = refResolved.startJD - offsetDays;
    } else {
      resultJD = refResolved.startJD + offsetDays;
    }
    
    // If lunar date refinement specified, apply it
    if (dateSpec.lunar) {
      const approxGregorian = julianDayToGregorian(resultJD);
      return lunarToJulianDay(dateSpec.lunar, approxGregorian.year, profile);
    }
    
    return resultJD;
  }
  
  // Priority 8: Reference to another event (end defined by another event's start)
  if (dateSpec.event) {
    const refEventId = dateSpec.event;
    
    if (context.resolutionStack?.includes(refEventId)) {
      console.warn(`Circular dependency detected: ${refEventId}`);
      return null;
    }
    
    const refEvent = context.allEvents?.find(e => e.id === refEventId);
    if (!refEvent) {
      console.warn(`Referenced event not found: ${refEventId}`);
      return null;
    }
    
    const refResolved = resolveEvent(refEvent, profile, epochs, context);
    return refResolved?.startJD || null;
  }
  
  return null;
}

/**
 * Resolve an event to Julian Day range
 * @param {object} event - Event object from schema v2
 * @param {object} profile - Calendar profile settings
 * @param {object} epochs - Epochs definitions from data
 * @param {object} context - Resolution context (optional, created if not provided)
 * @returns {object} { startJD, endJD, prophecies: [...] }
 */
function resolveEvent(event, profile, epochs, context = null) {
  // Initialize context if not provided
  if (!context) {
    context = {
      allEvents: [],
      resolvedEvents: new Map(),
      resolutionStack: []
    };
  }
  
  // Check cache
  if (context.resolvedEvents?.has(event.id)) {
    return context.resolvedEvents.get(event.id);
  }
  
  // Add to resolution stack (for circular dependency detection)
  const stack = [...(context.resolutionStack || []), event.id];
  const newContext = { ...context, resolutionStack: stack };
  
  // Resolve start and end dates
  // Support three patterns:
  // 1. start + duration → calculate end
  // 2. start + end → both specified
  // 3. end + duration → calculate start (duration goes backward)
  
  // Support both old schema (start/end) and new schema (dates)
  // Try event.start first, then fall back to event.dates
  let startSpec = event.start || event.dates || null;
  let endSpec = event.end || null;
  
  // Determine date precision from the event's own dateSpec.
  // This records how precisely the SOURCE DATA specifies the date —
  // not how precisely the resolver computed it.
  let datePrecision = 'year'; // default: only year-level knowledge
  if (startSpec) {
    const _lu = startSpec.lunar;
    const _fg = startSpec.fixed?.gregorian;
    const _gr = startSpec.gregorian;
    if (_lu?.month != null && _lu?.day != null) datePrecision = 'day';
    else if (_lu?.month != null) datePrecision = 'month';
    else if (startSpec.lunar_relative) datePrecision = 'day';
    else if (startSpec.priestly_cycle) datePrecision = 'day';
    else if (_fg?.month != null && _fg?.day != null) datePrecision = 'day';
    else if (_fg?.month != null) datePrecision = 'month';
    else if (_gr?.month != null && _gr?.day != null) datePrecision = 'day';
    else if (_gr?.month != null) datePrecision = 'month';
    else if (startSpec.anno_mundi?.month != null) datePrecision = 'month';
  }
  
  let startJD = startSpec ? resolveDateSpec(startSpec, profile, epochs, newContext) : null;
  
  // Capture calculated lunar date from year offset resolution (if any)
  const calculatedLunar = newContext._lastCalculatedLunar;
  newContext._lastCalculatedLunar = null; // Clear for next resolution
  
  let endJD = endSpec ? resolveDateSpec(endSpec, profile, epochs, newContext) : null;
  
  // If we have start but no end, and there's a duration, calculate end
  if (startJD !== null && endJD === null && event.duration) {
    endJD = applyDuration(startJD, event.duration, profile);
  }
  
  // If we have end but no start, and there's a duration, calculate start (go backward)
  if (endJD !== null && startJD === null && event.duration) {
    // Apply negative duration to go backward from end
    const backwardDuration = { ...event.duration, value: -event.duration.value };
    startJD = applyDuration(endJD, backwardDuration, profile);
  }
  
  // Resolve prophecies (multiple durations from same start point)
  const prophecies = [];
  if (event.prophecies && startJD !== null) {
    event.prophecies.forEach(prophecy => {
      const prophEndJD = applyDuration(startJD, prophecy.duration, profile);
      prophecies.push({
        id: `${event.id}-${prophecy.id}`,
        title: prophecy.title,
        startJD: startJD,
        endJD: prophEndJD,
        source: prophecy.source,
        end_event: prophecy.end_event,
        duration: prophecy.duration
      });
    });
  }
  
  // Calculate resolved gregorian dates from JD
  let resolvedStartGreg = null;
  let resolvedEndGreg = null;
  
  if (startJD !== null && isFinite(startJD)) {
    resolvedStartGreg = julianDayToGregorian(startJD);
  }
  
  if (endJD !== null && isFinite(endJD)) {
    resolvedEndGreg = julianDayToGregorian(endJD);
  }
  
  // Reverse-calculate lunar date from JD when no lunar date is available from source/chain
  // This ensures events with fixed Gregorian dates still show on the calendar
  let _reverseLunar = null;
  if (startJD && datePrecision !== 'year' && !calculatedLunar && !event.start?.lunar?.month) {
    try { _reverseLunar = julianDayToLunar(startJD, profile); } catch(e) { /* ignore */ }
  }
  
  const result = {
    // Identity
    id: event.id,
    title: event.title,
    type: event.type,
    
    // TOP-LEVEL JD values for backward compatibility with resolver chain
    startJD,
    endJD,
    
    // Date precision: 'day', 'month', or 'year' — how precisely the source data
    // specifies this event's date. Consumers use this to avoid false precision
    // (e.g., bible-events-loader skips year-only events for calendar anniversaries).
    _datePrecision: datePrecision,
    
    // Calculated lunar year/month/day (for chain propagation and calendar display)
    // _lunarYear is always set (downstream events need it for year offsets).
    // _lunarMonth/_lunarDay are null for year-only events to prevent false anniversaries.
    // For events with day precision but no lunar date, reverse-calculate from JD.
    _lunarYear: calculatedLunar?.year ?? event.start?.lunar?.year ?? _reverseLunar?.year,
    _lunarMonth: datePrecision !== 'year'
      ? (calculatedLunar?.month ?? event.start?.lunar?.month ?? _reverseLunar?.month ?? null)
      : null,
    _lunarDay: datePrecision !== 'year'
      ? (calculatedLunar?.day ?? event.start?.lunar?.day ?? _reverseLunar?.day ?? null)
      : null,
    
    // SOURCE DATA (stipulated - exactly as provided in JSON)
    source: {
      start: event.start || null,
      end: event.end || null,
      duration: event.duration || null
    },
    
    // RESOLVED DATA (calculated from source)
    // Note: Lunar dates require full calendar profile and are NOT reverse-calculated here
    resolved: {
      startJD,
      endJD,
      startGregorian: resolvedStartGreg,
      endGregorian: resolvedEndGreg,
      durationDays: (startJD !== null && endJD !== null) ? (endJD - startJD) : null
    },
    
    // Prophecies (each with their own resolved dates)
    prophecies,
    
    // Metadata (passed through from source)
    priority: event.priority,
    certainty: event.certainty,
    tags: event.tags,
    anniversary_display: event.anniversary_display,
    description: event.description,
    sources: event.sources,
    
    // Display metadata
    icon: event.icon,
    image: event.image,
    article: event.article,
    details: event.details,
    detailsTitle: event.detailsTitle,
    contentFile: event.contentFile
  };
  
  // Cache result
  if (context.resolvedEvents) {
    context.resolvedEvents.set(event.id, result);
  }
  
  return result;
}

/**
 * Resolve all events from data file
 * @param {object} data - Full data object with events and epochs
 * @param {object} profile - Calendar profile settings
 * @returns {object[]} Array of resolved events
 */
function resolveAllEvents(data, profile) {
  // Reset iteration counter
  _resolverIterationCount = 0;
  
  const epochs = data.epochs || {};
  const events = data.events || [];
  
  // Create resolution context
  const context = {
    allEvents: events,
    resolvedEvents: new Map(),
    resolutionStack: []
  };
  
  // Resolve all events (catch per-event errors so one bad event doesn't crash the batch)
  const resolved = events.map(event => {
    try {
      return resolveEvent(event, profile, epochs, context);
    } catch (e) {
      console.warn(`[EventResolver] Failed to resolve event "${event.id}":`, e.message);
      return { id: event.id, title: event.title, type: event.type, startJD: null, endJD: null, _error: e.message };
    }
  });
  
  // Expand prophecies into separate timeline events
  const expanded = [];
  resolved.forEach(r => {
    // Add main event
    expanded.push(r);
    
    // Add prophecy durations as separate events
    r.prophecies?.forEach(p => {
      expanded.push({
        id: p.id,
        title: p.title,
        type: 'prophecy-duration',
        startJD: p.startJD,
        endJD: p.endJD,
        source: p.source,
        duration: p.duration,
        _parentEvent: r.id
      });
    });
  });
  
  return expanded;
}

/**
 * Async version of resolveAllEvents with progress updates
 * Yields to UI periodically for smooth progress bar updates
 * @param {object} data - Full data object with events and epochs
 * @param {object} profile - Calendar profile settings
 * @param {function} onProgress - Progress callback (percent, message)
 * @returns {Promise<object[]>} Array of resolved events
 */
async function resolveAllEventsAsync(data, profile, onProgress) {
  // Reset iteration counter
  _resolverIterationCount = 0;
  
  const epochs = data.epochs || {};
  const events = data.events || [];
  
  // Create resolution context
  const context = {
    allEvents: events,
    resolvedEvents: new Map(),
    resolutionStack: []
  };
  
  // Resolve all events with periodic UI yields
  const resolved = [];
  const total = events.length;
  const batchSize = 20; // Process 20 events, then yield to UI
  
  for (let i = 0; i < events.length; i++) {
    try {
      resolved.push(resolveEvent(events[i], profile, epochs, context));
    } catch (e) {
      console.warn(`[EventResolver] Failed to resolve event "${events[i].id}":`, e.message);
      resolved.push({ id: events[i].id, title: events[i].title, type: events[i].type, startJD: null, endJD: null, _error: e.message });
    }
    
    // Report progress and yield to UI every batch
    if (i % batchSize === 0) {
      const percent = Math.round((i / total) * 90); // 0-90% for resolution
      if (onProgress) {
        onProgress(percent, `Resolving ${i + 1} of ${total} events...`);
      }
      // Yield to UI
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  if (onProgress) {
    onProgress(95, 'Finalizing...');
  }
  await new Promise(resolve => setTimeout(resolve, 0));
  
  // Expand prophecies into separate timeline events
  const expanded = [];
  resolved.forEach(r => {
    // Add main event
    expanded.push(r);
    
    // Add prophecy durations as separate events
    r.prophecies?.forEach(p => {
      expanded.push({
        id: p.id,
        title: p.title,
        type: 'prophecy-duration',
        startJD: p.startJD,
        endJD: p.endJD,
        source: p.source,
        duration: p.duration,
        _parentEvent: r.id
      });
    });
  });
  
  if (onProgress) {
    onProgress(100, 'Done');
  }
  
  return expanded;
}

/**
 * Convert resolved events to timeline-friendly format
 * @param {object[]} resolvedEvents - Array from resolveAllEvents
 * @returns {object[]} Events with pixel positions (requires additional timeline params)
 */
function resolvedEventsToTimeline(resolvedEvents, minYear, maxYear, pixelPerYear) {
  const minJD = gregorianToJulianDay(minYear, 1, 1);
  const maxJD = gregorianToJulianDay(maxYear, 12, 31);
  const jdRange = maxJD - minJD;
  const totalHeight = (maxYear - minYear) * pixelPerYear;
  
  return resolvedEvents
    .filter(e => e.startJD !== null)
    .map(event => {
      const startPos = ((event.startJD - minJD) / jdRange) * totalHeight;
      const endPos = event.endJD 
        ? ((event.endJD - minJD) / jdRange) * totalHeight 
        : startPos;
      
      return {
        ...event,
        startPos,
        endPos,
        height: endPos - startPos,
        isDuration: event.endJD !== null && (event.endJD - event.startJD) > 30,
        // Convert JD back to Gregorian for display
        startDate: julianDayToGregorian(event.startJD),
        endDate: event.endJD ? julianDayToGregorian(event.endJD) : null
      };
    });
}

// ============================================================================
// DEFAULT PROFILE
// ============================================================================

const DEFAULT_PROFILE = {
  monthStart: 'conjunction',  // 'conjunction', 'crescent', 'full'
  dayStart: 'sunset',         // 'sunset', 'sunrise', 'midnight'
  yearStart: 'spring-equinox', // 'spring-equinox', 'barley', 'fall-equinox'
  amEpoch: -4000              // Anno Mundi year 1 in Gregorian
};

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof window !== 'undefined') {
  window.EventResolver = {
    // Main resolver functions
    resolveEvent,
    resolveAllEvents,
    resolveAllEventsAsync,
    resolveDateSpec,
    
    // Timeline helpers
    resolvedEventsToTimeline,
    
    // Utility functions
    gregorianToJulianDay,
    julianDayToGregorian,
    julianDayToJulianCalendar,
    lunarToJulianDay,
    julianDayToLunar,
    applyDuration,
    
    // Lunar calendar utilities
    newMoonJD,
    isLunarLeapYear,
    monthsInLunarYear,
    
    // Constants
    SYNODIC_MONTH,
    DEFAULT_PROFILE,
    DEFAULT_AM_EPOCH
  };
}

// ============================================================================
// TEST FUNCTION
// ============================================================================

/**
 * Test the resolver with v2 data
 * Run in browser console: EventResolver.test()
 */
async function testResolver() {
  console.log('=== Event Resolver Test ===\n');
  
  try {
    // Load v2 data
    const response = await fetch('/historical-events-v2.json');
    const data = await response.json();
    console.log(`Loaded ${data.events.length} events, ${Object.keys(data.epochs).length} epochs\n`);
    
    // Use default profile
    const profile = DEFAULT_PROFILE;
    console.log('Profile:', profile, '\n');
    
    // Resolve all events
    const resolved = resolveAllEvents(data, profile);
    console.log(`Resolved ${resolved.length} events (including expanded prophecies)\n`);
    
    // Show results
    console.log('--- Resolved Events ---');
    resolved.forEach(e => {
      if (e.startJD) {
        const startDate = julianDayToGregorian(e.startJD);
        const startStr = `${startDate.year < 0 ? Math.abs(startDate.year) + ' BC' : startDate.year + ' AD'}`;
        
        let endStr = '';
        if (e.endJD) {
          const endDate = julianDayToGregorian(e.endJD);
          endStr = ` → ${endDate.year < 0 ? Math.abs(endDate.year) + ' BC' : endDate.year + ' AD'}`;
          const durationYears = (e.endJD - e.startJD) / 365.2422;
          endStr += ` (${durationYears.toFixed(1)} years)`;
        }
        
        console.log(`  ${e.title}: ${startStr}${endStr}`);
      } else {
        console.log(`  ${e.title}: [unresolved]`);
      }
    });
    
    // Test specific calculations
    console.log('\n--- Specific Tests ---');
    
    // Test Julian Day conversion
    const testJD = gregorianToJulianDay(-31, 9, 2);
    const backToGreg = julianDayToGregorian(testJD);
    console.log(`Battle of Actium (Sep 2, 31 BC): JD ${testJD} → ${backToGreg.year}/${backToGreg.month}/${backToGreg.day}`);
    
    // Test lunar calculation
    const passoverJD = lunarToJulianDay({ month: 1, day: 14 }, 32, profile);
    const passoverGreg = julianDayToGregorian(passoverJD);
    console.log(`Passover 32 AD (Nisan 14): JD ${passoverJD.toFixed(2)} → ${passoverGreg.year}/${passoverGreg.month}/${passoverGreg.day}`);
    
    // Test duration
    const exodusEvent = resolved.find(e => e.id === 'exodus-from-egypt');
    const wildernessEvent = resolved.find(e => e.id === 'wilderness-wandering');
    if (exodusEvent && wildernessEvent) {
      console.log(`Exodus: JD ${exodusEvent.startJD?.toFixed(0)}`);
      console.log(`Wilderness end: JD ${wildernessEvent.endJD?.toFixed(0)}`);
      const wildernessYears = (wildernessEvent.endJD - wildernessEvent.startJD) / 365.2422;
      console.log(`Wilderness duration: ${wildernessYears.toFixed(2)} solar years`);
    }
    
    // Find duration events for timeline
    const durationEvents = resolved.filter(e => e.endJD && (e.endJD - e.startJD) > 30);
    console.log(`\n--- Duration Events (for timeline bars): ${durationEvents.length} ---`);
    durationEvents.slice(0, 10).forEach(e => {
      const years = (e.endJD - e.startJD) / 365.2422;
      console.log(`  ${e.title}: ${years.toFixed(1)} years`);
    });
    
    console.log('\n=== Test Complete ===');
    return resolved;
    
  } catch (error) {
    console.error('Test failed:', error);
    return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof window !== 'undefined') {
  window.EventResolver = {
    // Main resolver functions
    resolveEvent,
    resolveAllEvents,
    resolveAllEventsAsync,
    resolveDateSpec,
    
    // Timeline helpers
    resolvedEventsToTimeline,
    
    // Utility functions
    gregorianToJulianDay,
    julianDayToGregorian,
    julianDayToJulianCalendar,
    lunarToJulianDay,
    julianDayToLunar,
    applyDuration,
    
    // Lunar calendar utilities
    newMoonJD,
    isLunarLeapYear,
    monthsInLunarYear,
    
    // Constants
    SYNODIC_MONTH,
    DEFAULT_PROFILE,
    DEFAULT_AM_EPOCH,
    
    // Test function
    test: testResolver
  };
}

// For Node.js / testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    resolveEvent,
    resolveAllEvents,
    resolveAllEventsAsync,
    resolveDateSpec,
    resolvedEventsToTimeline,
    gregorianToJulianDay,
    julianDayToGregorian,
    lunarToJulianDay,
    julianDayToLunar,
    applyDuration,
    newMoonJD,
    isLunarLeapYear,
    monthsInLunarYear,
    SYNODIC_MONTH,
    DEFAULT_PROFILE,
    DEFAULT_AM_EPOCH,
    test: testResolver
  };
}

})(); // End IIFE
