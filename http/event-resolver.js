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
  
  // TEMPORARILY DISABLED: Astronomy engine is too slow for bulk resolution
  // Skip directly to fallback calculation
  const USE_ASTRONOMY_ENGINE = false;
  
  // Try to use the astronomy engine for accurate moon phase calculation
  // Only for years within the Swiss Ephemeris range (~3000 BC to present)
  const MIN_ASTRO_YEAR = -3000;
  
  if (USE_ASTRONOMY_ENGINE && year >= MIN_ASTRO_YEAR && typeof findMoonEvents === 'function' && typeof getYearStartPoint === 'function' && typeof state !== 'undefined') {
    try {
      // Map resolver profile to calendar state settings
      const moonPhaseMap = {
        'conjunction': 'dark',
        'crescent': 'crescent', 
        'full': 'full'
      };
      const dayStartMap = {
        'sunset': 'evening',
        'sunrise': 'morning'
      };
      const yearStartMap = {
        'spring-equinox': 'equinox',
        'fall-equinox': 'equinox',
        'barley': 'barley'
      };
      
      // Save and set ALL relevant state variables (matching getLunarDayForTimestamp)
      const savedState = {
        moonPhase: state.moonPhase,
        dayStartTime: state.dayStartTime,
        dayStartAngle: state.dayStartAngle,
        yearStartRule: state.yearStartRule,
        crescentThreshold: state.crescentThreshold,
        lat: state.lat,
        lon: state.lon
      };
      
      // Apply profile settings
      state.moonPhase = moonPhaseMap[profile.monthStart] || 'dark';
      state.dayStartTime = dayStartMap[profile.dayStart] || 'evening';
      state.dayStartAngle = profile.dayStart === 'sunset' ? 0 : 12;
      state.yearStartRule = yearStartMap[profile.yearStart] || 'equinox';
      state.crescentThreshold = 18;
      state.lat = 31.7683;  // Jerusalem
      state.lon = 35.2137;
      
      const moonPhase = state.moonPhase;
      
      // Find moon events for this year
      const moonEvents = findMoonEvents(year, moonPhase);
      
      if (moonEvents && moonEvents.length > 0) {
        const yearStartPoint = getYearStartPoint(year);
        
        // Find the first moon event on or after year start (this is Nisan)
        let nissanMoon = moonEvents.find(m => m >= yearStartPoint);
        if (!nissanMoon) nissanMoon = moonEvents[0];
        
        // Get the target month's moon event (month 1 = Nisan = index 0)
        const monthIndex = normalizedLunar.month - 1;
        const nissanIndex = moonEvents.indexOf(nissanMoon);
        const targetMoonIndex = nissanIndex + monthIndex;
        
        if (targetMoonIndex < moonEvents.length) {
          const monthStart = moonEvents[targetMoonIndex];
          // monthStart is a Date object, convert to JD
          const jd = dateToJulianDay(monthStart) + (normalizedLunar.day - 1);
          
          // Restore state
          Object.assign(state, savedState);
          return jd;
        }
      }
      
      // Restore state if we didn't return early
      Object.assign(state, savedState);
    } catch (err) {
      console.warn('Astronomy engine calculation failed, using fallback:', err);
    }
  }
  
  // Fallback: use synodic month approximation
  let yearStartApprox;
  if (profile.yearStart === 'spring-equinox' || profile.yearStart === 'barley') {
    yearStartApprox = gregorianToJulianDay(year, 3, 20);
  } else if (profile.yearStart === 'fall-equinox') {
    yearStartApprox = gregorianToJulianDay(year, 9, 22);
  } else {
    yearStartApprox = gregorianToJulianDay(year, 3, 20);
  }
  
  const yearStartLunation = lunationForJD(yearStartApprox, profile);
  const targetLunation = yearStartLunation + (normalizedLunar.month - 1);
  const monthStartJD = newMoonJD(targetLunation, profile);
  let jd = monthStartJD + (normalizedLunar.day - 1);
  
  // Adjust for time of day
  if (lunar.time_of_day) {
    if (profile.dayStart === 'sunset') {
      if (lunar.time_of_day === 'evening' || lunar.time_of_day === 'night') {
        jd -= 0.25;
      } else if (lunar.time_of_day === 'morning' || lunar.time_of_day === 'afternoon') {
        jd += 0.25;
      }
    } else if (profile.dayStart === 'sunrise') {
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
  const value = duration.value;
  const unit = duration.unit;
  
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
  if (dateSpec.regal) {
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
      return lunarToJulianDay(dateSpec.lunar, year, profile);
    }
    // Can't resolve without year context
    console.warn('Cannot resolve lunar date without year context');
    return null;
  }
  
  // Priority 6: Anno Mundi
  if (dateSpec.anno_mundi) {
    return annoMundiToJulianDay(dateSpec.anno_mundi, profile);
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
    const offset = dateSpec.relative.offset;
    const direction = dateSpec.relative.direction || 'after';
    
    let offsetDays = 0;
    if (offset.years) offsetDays += offset.years * 365.2422;
    if (offset.months) offsetDays += offset.months * SYNODIC_MONTH;
    if (offset.weeks) offsetDays += offset.weeks * 7;
    if (offset.days) offsetDays += offset.days;
    
    let resultJD;
    if (direction === 'before') {
      resultJD = refResolved.startJD - offsetDays;
    } else {
      resultJD = refResolved.startJD + offsetDays;
    }
    
    // If there's also a lunar date specified, use it to refine the result
    // (e.g., get the exact Nisan 1 of the calculated year)
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
  
  let startJD = event.start ? resolveDateSpec(event.start, profile, epochs, newContext) : null;
  let endJD = event.end ? resolveDateSpec(event.end, profile, epochs, newContext) : null;
  
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
  
  const result = {
    // Identity
    id: event.id,
    title: event.title,
    type: event.type,
    
    // TOP-LEVEL JD values for backward compatibility with resolver chain
    startJD,
    endJD,
    
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
    certainty: event.certainty,
    tags: event.tags,
    anniversary_display: event.anniversary_display,
    description: event.description,
    sources: event.sources
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
  
  // Resolve all events
  const resolved = events.map(event => resolveEvent(event, profile, epochs, context));
  
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
