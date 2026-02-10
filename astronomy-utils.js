// Astronomy Utility Functions

// Gregorian calendar reform date: October 15, 1582
// Before this date, use Julian calendar (following NASA/Stellarium convention)
const GREGORIAN_REFORM_DATE = new Date(1582, 9, 15); // Oct 15, 1582

// Check if a date is before the Gregorian reform
function isBeforeGregorianReform(date) {
  return date < GREGORIAN_REFORM_DATE;
}

// Calculate Julian Day Number from Julian calendar date (year, month 0-indexed, day)
function julianCalendarToJDN(year, month, day) {
  // Convert 0-indexed month to 1-indexed
  const m = month + 1;
  const a = Math.floor((14 - m) / 12);
  const y = year + 4800 - a;
  const mm = m + 12 * a - 3;
  // Julian calendar formula
  return day + Math.floor((153 * mm + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}

// Calculate day of week from Julian Day Number (0 = Sunday, 6 = Saturday)
function jdnToWeekday(jdn) {
  return (jdn + 1) % 7;
}

// Get the current location name from state or URLRouter
function getCurrentLocationName() {
  try {
    const lat = state?.lat ?? 31.7683;
    const lon = state?.lon ?? 35.2137;
    
    // Try URLRouter's city lookup if available
    if (typeof URLRouter !== 'undefined' && URLRouter._getLocationSlug) {
      const slug = URLRouter._getLocationSlug({ lat, lon });
      if (slug) {
        // Convert "new-york" to "New York"
        return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }
    // Fallback to coordinates
    return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
  } catch (e) {
    return 'Jerusalem';
  }
}

function getSunriseTimestamp(date) {
  if (typeof getAstroEngine !== 'function') return null;
  const engine = getAstroEngine();
  if (!engine) return null;
  const observer = engine.createObserver(state.lat, state.lon, 0);
  // Search for sunrise starting from midnight of that day (use UTC for ancient dates)
  const midnightUTC = new Date(Date.UTC(2000, date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  midnightUTC.setUTCFullYear(date.getUTCFullYear());
  const sunrise = engine.searchRiseSet('sun', observer, +1, midnightUTC, 1);
  if (sunrise) {
    return sunrise.date.getTime();
  }
  // Fallback to 6am if no sunrise found (polar regions)
  return midnightUTC.getTime() + 6 * 60 * 60 * 1000;
}

// Calculate sunset timestamp for a given date at the selected location
function getSunsetTimestamp(date) {
  if (typeof getAstroEngine !== 'function') return null;
  const engine = getAstroEngine();
  if (!engine) return null;
  const observer = engine.createObserver(state.lat, state.lon, 0);
  // Use noon UTC as search start to find THIS day's sunset (not previous day's)
  const noonUTC = new Date(Date.UTC(2000, date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));
  noonUTC.setUTCFullYear(date.getUTCFullYear());
  const sunset = engine.searchRiseSet('sun', observer, -1, noonUTC, 1);
  if (sunset) {
    return sunset.date.getTime();
  }
  // Fallback to 6pm if no sunset found (polar regions)
  return noonUTC.getTime() + 6 * 60 * 60 * 1000;
}

// Format a UTC time in the observer's local timezone based on longitude
// Returns an object with formatted time string and timezone abbreviation
function formatTimeInObserverTimezone(utcDate) {
  // Calculate timezone offset based on longitude (simple solar time approximation)
  // Each 15 degrees = 1 hour
  const offsetHours = state.lon / 15;
  const offsetMs = offsetHours * 60 * 60 * 1000;
  
  // Create local time by adding offset
  const localTime = new Date(utcDate.getTime() + offsetMs);
  
  // Format the time
  let hours = localTime.getUTCHours();
  const minutes = localTime.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const timeStr = `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  
  // Format timezone offset (e.g., UTC+2, UTC-5)
  const offsetSign = offsetHours >= 0 ? '+' : '';
  const offsetStr = `UTC${offsetSign}${offsetHours.toFixed(0)}`;
  
  return {
    time: timeStr,
    timezone: offsetStr,
    full: `${timeStr} ${offsetStr}`
  };
}

// Get all astronomical times for a given date (first light, sunrise, sunset, nautical twilight)
// @param date - Date object for the day
// @param location - Optional {lat, lon} object. If not provided, uses AppStore state or falls back to global state
function getAstronomicalTimes(date, location) {
  try {
    if (typeof getAstroEngine !== 'function') {
      console.warn('[getAstronomicalTimes] Astro engine not yet available');
      return null;
    }
    if (!date || typeof date.getTime !== 'function' || isNaN(date.getTime())) {
      return null;
    }
    const engine = getAstroEngine();
    
    // Get location from parameter, AppStore, or global state
    let lat, lon;
    if (location && typeof location.lat === 'number') {
      lat = location.lat;
      lon = location.lon;
    } else if (typeof AppStore !== 'undefined') {
      const appState = AppStore.getState();
      lat = appState.context?.location?.lat ?? 31.77;
      lon = appState.context?.location?.lon ?? 35.21;
    } else if (typeof state !== 'undefined') {
      lat = state.lat;
      lon = state.lon;
    } else {
      lat = 31.77;  // Jerusalem default
      lon = 35.21;
    }
    
    const observer = engine.createObserver(lat, lon, 0);
    
    // Normalize to a clean calendar date (noon UTC) so TODAY and other dates behave the same
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();
    const midnightUTC = new Date(Date.UTC(2000, m, d, 0, 0, 0));
    midnightUTC.setUTCFullYear(y);
    const noonUTC = new Date(Date.UTC(2000, m, d, 12, 0, 0));
    noonUTC.setUTCFullYear(y);
    
    // Sunrise (sun rises above horizon) - search from midnight
    const sunriseResult = engine.searchRiseSet('sun', observer, +1, midnightUTC, 1);
    const sunriseTs = sunriseResult ? sunriseResult.date.getTime() : null;
    
    // Sunset (sun sets below horizon) - search from noon to get THIS day's sunset (matches getSunsetTimestamp)
    let sunsetTs = null;
    const sunsetResult = engine.searchRiseSet('sun', observer, -1, noonUTC, 1);
    if (sunsetResult) {
      sunsetTs = sunsetResult.date.getTime();
    } else {
      // Fallback: search from midnight (e.g. polar regions or engine edge cases)
      const sunsetFromMidnight = engine.searchRiseSet('sun', observer, -1, midnightUTC, 1);
      if (sunsetFromMidnight) sunsetTs = sunsetFromMidnight.date.getTime();
    }
    
    // First light (civil dawn) - sun is 6° below horizon in the morning
    // Search for sun reaching -6° altitude before sunrise
    let firstLightTs = null;
    if (sunriseTs) {
      const beforeSunrise = new Date(sunriseTs - 2 * 60 * 60 * 1000); // 2 hours before sunrise
      const civilDawn = engine.searchAltitude('sun', observer, +1, beforeSunrise, 1, -6);
      if (civilDawn) {
        firstLightTs = civilDawn.date.getTime();
      }
    }
    
    // Morning nautical twilight (dark ends) - sun is 12° below horizon in the morning
    // This is when it stops being truly dark in the morning
    let morningDarkTs = null;
    if (sunriseTs) {
      const beforeSunrise = new Date(sunriseTs - 2 * 60 * 60 * 1000); // 2 hours before sunrise
      const nauticalDawn = engine.searchAltitude('sun', observer, +1, beforeSunrise, 1, -12);
      if (nauticalDawn) {
        morningDarkTs = nauticalDawn.date.getTime();
      }
    }
    
    // Civil twilight (end) - sun is 6° below horizon after sunset
    let civilTwilightTs = null;
    if (sunsetTs) {
      const civilDusk = engine.searchAltitude('sun', observer, -1, new Date(sunsetTs), 1, -6);
      if (civilDusk) {
        civilTwilightTs = civilDusk.date.getTime();
      }
    }
    
    // Nautical twilight (end) - sun is 12° below horizon after sunset
    let nauticalTwilightTs = null;
    if (sunsetTs) {
      const nauticalDusk = engine.searchAltitude('sun', observer, -1, new Date(sunsetTs), 1, -12);
      if (nauticalDusk) {
        nauticalTwilightTs = nauticalDusk.date.getTime();
      }
    }
    
    // Moonrise - search from midnight
    let moonriseTs = null;
    const moonriseResult = engine.searchRiseSet('moon', observer, +1, midnightUTC, 1);
    if (moonriseResult) {
      moonriseTs = moonriseResult.date.getTime();
    }
    
    // Moonset - search from midnight (moon can set at any time of day)
    let moonsetTs = null;
    const moonsetResult = engine.searchRiseSet('moon', observer, -1, midnightUTC, 1);
    if (moonsetResult) {
      moonsetTs = moonsetResult.date.getTime();
    }
    
    // Format times in observer's local time
    const formatTime = (ts) => {
      if (!ts) return '--:--';
      const localTime = utcToLocalTime(ts, lon);
      const hours = localTime.getUTCHours();
      const mins = String(localTime.getUTCMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${mins} ${ampm}`;
    };
    
    return {
      morningDark: formatTime(morningDarkTs),
      firstLight: formatTime(firstLightTs),
      sunrise: formatTime(sunriseTs),
      sunset: formatTime(sunsetTs),
      civilTwilight: formatTime(civilTwilightTs),
      nauticalTwilight: formatTime(nauticalTwilightTs),
      moonrise: formatTime(moonriseTs),
      moonset: formatTime(moonsetTs),
      // Also return raw timestamps for further calculations
      morningDarkTs,
      sunriseTs,
      sunsetTs,
      firstLightTs,
      civilTwilightTs,
      nauticalTwilightTs,
      moonriseTs,
      moonsetTs
    };
  } catch (err) {
    console.warn('Error calculating astronomical times:', err);
    return null;
  }
}

// Calculate moon altitude at sunset for a given date
// Returns an object with sunset time, moon altitude, and elongation
function getMoonAltitudeAtSunset(date) {
  try {
    if (typeof getAstroEngine !== 'function') return null;
    const engine = getAstroEngine();
    if (!engine) return null;
    const observer = engine.createObserver(state.lat, state.lon, 0);
    
    // Create midnight date with proper handling for ancient years
    // Using setUTCFullYear to avoid JavaScript treating small years (0-99) as 1900+year
    const midnight = new Date(Date.UTC(2000, date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
    midnight.setUTCFullYear(date.getUTCFullYear());
    
    // Find sunset on this day
    const sunset = engine.searchRiseSet('sun', observer, -1, midnight, 1);
    
    if (!sunset) {
      return null;
    }
    
    // Ensure the sunset date has the correct year (engine may return 1900+year for small years)
    let sunsetDate = sunset.date;
    if (sunsetDate.getUTCFullYear() !== date.getUTCFullYear()) {
      // Create a corrected date with the proper year
      const correctedSunset = new Date(Date.UTC(
        2000,
        sunsetDate.getUTCMonth(),
        sunsetDate.getUTCDate(),
        sunsetDate.getUTCHours(),
        sunsetDate.getUTCMinutes(),
        sunsetDate.getUTCSeconds()
      ));
      correctedSunset.setUTCFullYear(date.getUTCFullYear());
      sunsetDate = correctedSunset;
    }
    
    // Calculate moon position at sunset (use original sunset.date for astronomy calculations)
    const moonEquator = engine.getEquator('moon', sunset.date, observer);
    const moonHorizon = engine.getHorizon(sunset.date, observer, moonEquator.ra, moonEquator.dec);
    
    // Calculate sun position at sunset
    const sunEquator = engine.getEquator('sun', sunset.date, observer);
    
    // Calculate elongation using spherical geometry (angular distance between RA/Dec positions)
    // Convert RA from hours to degrees
    const moonRaDeg = moonEquator.ra * 15;
    const sunRaDeg = sunEquator.ra * 15;
    const moonDecRad = moonEquator.dec * Math.PI / 180;
    const sunDecRad = sunEquator.dec * Math.PI / 180;
    const deltaRaRad = (moonRaDeg - sunRaDeg) * Math.PI / 180;
    
    // Spherical law of cosines for angular distance
    const cosAngle = Math.sin(sunDecRad) * Math.sin(moonDecRad) + 
                     Math.cos(sunDecRad) * Math.cos(moonDecRad) * Math.cos(deltaRaRad);
    const elongation = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;
    
    return {
      sunsetTime: sunsetDate,  // Use corrected date with proper year
      moonAltitude: moonHorizon.altitude,
      moonAzimuth: moonHorizon.azimuth,
      elongation: elongation
    };
  } catch (e) {
    console.error('Error calculating moon altitude at sunset:', e);
    return null;
  }
}

// Get the day start time for a given date based on current settings
// Returns a UTC timestamp for when the day starts
function getDayStartTime(date) {
  if (typeof getAstroEngine !== 'function') return null;
  const engine = getAstroEngine();
  if (!engine) return null;
  const observer = engine.createObserver(state.lat, state.lon, 0);
  
  // Use UTC methods to avoid timezone issues with ancient dates
  const midnightUTC = new Date(Date.UTC(2000, date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  midnightUTC.setUTCFullYear(date.getUTCFullYear());
  
  // Direction: -1 for evening (descending sun), +1 for morning (ascending sun)
  const direction = state.dayStartTime === 'evening' ? -1 : +1;
  
  // For evening, we need to search from noon of the previous day
  // For morning, we search from midnight of this day
  let searchStart = midnightUTC;
  if (state.dayStartTime === 'evening') {
    // Search starting from noon of the previous day to find evening twilight
    searchStart = new Date(midnightUTC.getTime() - 12 * 60 * 60 * 1000);
  }
  
  let result;
  if (state.dayStartAngle === 0) {
    // Use sunrise/sunset (sun at horizon)
    result = engine.searchRiseSet('sun', observer, direction, searchStart, 1);
  } else {
    // Use twilight angle (sun below horizon)
    // SearchAltitude finds when sun reaches the specified altitude
    result = engine.searchAltitude('sun', observer, direction, searchStart, 1, -state.dayStartAngle);
  }
  
  if (result) {
    return result.date.getTime();
  }
  
  // Fallback for polar regions
  if (state.dayStartTime === 'morning') {
    return midnightUTC.getTime() + 6 * 60 * 60 * 1000; // 6am
  } else {
    return midnightUTC.getTime() - 6 * 60 * 60 * 1000; // 6pm previous day
  }
}

// Get the year start point based on yearStartRule setting
function getYearStartPoint(year, location = null) {
  if (typeof getAstroEngine !== 'function') return null;
  const engine = getAstroEngine();
  if (!engine) return null;
  const springEquinox = engine.getSeasons(year).mar_equinox.date;
  
  if (state.yearStartRule === '14daysBefore') {
    // Return 14 days before the equinox (Day 15 must be on or after equinox per Maimonides)
    return new Date(springEquinox.getTime() - 14 * 24 * 60 * 60 * 1000);
  }
  if (state.yearStartRule === '1dayBefore') {
    // Eq −1 day: first conjunction on or after (equinox − 1 day), so equinox "on the day" counts (119-style)
    return new Date(springEquinox.getTime() - 1 * 24 * 60 * 60 * 1000);
  }
  
  if (state.yearStartRule === 'virgoFeet') {
    // Creator's Calendar: First full moon after equinox where moon is "under Virgo's feet"
    // Moon ecliptic longitude must be > Spica longitude (~204°)
    // This returns the date of that specific full moon, not just the equinox
    const virgoFullMoon = findVirgoFeetFullMoon(year, location);
    if (virgoFullMoon) {
      // Return a point just before the full moon so it gets selected
      return new Date(virgoFullMoon.getTime() - 1000);
    }
  }
  
  return springEquinox;
}

// Spica (α Virginis) ecliptic longitude at J2000.0 epoch
const SPICA_ECLIPTIC_LON_J2000 = 203.8;

// Precession rate: ~50.3 arcseconds per year = 0.01397 degrees per year
const PRECESSION_RATE_DEG_PER_YEAR = 50.3 / 3600;

// Get Spica's ecliptic longitude adjusted for precession at a given year
// Precession causes the vernal equinox to move westward, so ecliptic longitudes of fixed stars increase over time
function getSpicaLongitudeForYear(year) {
  const yearsFromJ2000 = year - 2000;
  // Ecliptic longitude increases as the vernal equinox precesses westward
  return SPICA_ECLIPTIC_LON_J2000 + (yearsFromJ2000 * PRECESSION_RATE_DEG_PER_YEAR);
}

// ============================================================================
// VIRGO RULE FUNCTIONS
// ============================================================================
// NOTE: The Virgo cache is now owned by LunarCalendarEngine instances.
// These global functions are DEPRECATED - use engine.getVirgoCalculation() instead.
// They are kept for backward compatibility and delegate to AppStore's engine.
// ============================================================================

/**
 * @deprecated Use LunarCalendarEngine._findVirgoFeetFullMoon() instead
 * This global function delegates to AppStore's engine if available.
 * 
 * Find the first full moon where Moon is "under Virgo's feet" (Moon RA > Spica RA at sunrise)
 * @param {number} year - Gregorian year
 * @param {Object} location - { lat, lon } - REQUIRED
 * @returns {Date|null} The qualifying full moon date
 */
function findVirgoFeetFullMoon(year, location) {
  if (!location || typeof location.lat !== 'number' || typeof location.lon !== 'number') {
    console.warn('[findVirgoFeetFullMoon] DEPRECATED: location is now required. Use engine._findVirgoFeetFullMoon() instead.');
    // Try to get location from AppStore
    if (typeof AppStore !== 'undefined') {
      const appState = AppStore.getState();
      location = appState?.context?.location;
    }
    if (!location) {
      console.error('[findVirgoFeetFullMoon] No location available');
      return null;
    }
  }
  
  // Delegate to AppStore's engine
  if (typeof AppStore !== 'undefined') {
    const engine = AppStore.getEngine();
    if (engine && typeof engine._findVirgoFeetFullMoon === 'function') {
      return engine._findVirgoFeetFullMoon(year, location);
    }
  }
  
  console.error('[findVirgoFeetFullMoon] AppStore engine not available');
  return null;
}

/**
 * @deprecated Use LunarCalendarEngine.getVirgoCalculation() instead
 * This global function delegates to AppStore's engine if available.
 * 
 * Get Virgo calculation details for a specific year and location
 * @param {number} year - Gregorian year
 * @param {Object} location - { lat, lon } - REQUIRED
 * @returns {Object|null} Cached Virgo calculation details
 */
function getVirgoCalculation(year, location) {
  if (!location || typeof location.lat !== 'number' || typeof location.lon !== 'number') {
    console.warn('[getVirgoCalculation] DEPRECATED: location is now required. Use engine.getVirgoCalculation() instead.');
    // Try to get location from AppStore
    if (typeof AppStore !== 'undefined') {
      const appState = AppStore.getState();
      location = appState?.context?.location;
    }
    if (!location) {
      console.error('[getVirgoCalculation] No location available');
      return null;
    }
  }
  
  // Delegate to AppStore's engine
  if (typeof AppStore !== 'undefined') {
    const engine = AppStore.getEngine();
    if (engine && typeof engine.getVirgoCalculation === 'function') {
      return engine.getVirgoCalculation(year, location);
    }
  }
  
  console.error('[getVirgoCalculation] AppStore engine not available');
  return null;
}

/**
 * Check if a full moon date passes the Virgo rule criterion
 * (Moon RA > Spica RA at sunrise = Spica sets before Moon = Moon under Virgo's feet)
 * @param {Date} fullMoonDate - The date of the full moon
 * @param {Object} location - { lat, lon } of the observer
 * @returns {boolean} true if this full moon qualifies as a year start
 */
function checkFullMoonPassesVirgoRule(fullMoonDate, location) {
  try {
    if (typeof getAstroEngine !== 'function') return false;
    const engine = getAstroEngine();
    if (!engine) return false;
    
    const year = fullMoonDate.getUTCFullYear();
    
    // Calculate Spica's RA with precession adjustment
    const PRECESSION_RATE_DEG_PER_YEAR = 0.0139;
    const yearsFromJ2000 = year - 2000;
    const spicaRA_J2000 = 201.298;  // degrees
    const spicaRA = spicaRA_J2000 + (yearsFromJ2000 * PRECESSION_RATE_DEG_PER_YEAR);
    
    // Find sunrise on the full moon date
    const obsLat = location?.lat ?? 31.7683;
    const obsLon = location?.lon ?? 35.2137;
    const observer = engine.createObserver(obsLat, obsLon, 0);
    
    const midnightUTC = new Date(Date.UTC(
      fullMoonDate.getUTCFullYear(),
      fullMoonDate.getUTCMonth(),
      fullMoonDate.getUTCDate(),
      0, 0, 0
    ));
    const sunriseResult = engine.searchRiseSet('sun', observer, +1, midnightUTC, 1);
    const sunriseTime = sunriseResult ? sunriseResult.date : midnightUTC;
    
    // Get Moon's Right Ascension at sunrise
    const moonRA = getMoonRightAscension(sunriseTime);
    
    // Check if Spica sets before Moon (Moon RA > Spica RA)
    return moonRA > spicaRA;
  } catch (err) {
    console.error('[Virgo Check] Error:', err);
    return false;
  }
}

// Get Moon's Right Ascension in degrees at a given date
function getMoonRightAscension(date, debug = false) {
  try {
    if (typeof getAstroEngine !== 'function') return null;
    const engine = getAstroEngine();
    if (!engine) return null;
    // Use observer's configured location
    const obsLat = state.lat ?? 31.7683;
    const obsLon = state.lon ?? 35.2137;
    const observer = engine.createObserver(obsLat, obsLon, 0);
    const eq = engine.getEquator('moon', date, observer);
    
    // RA is returned in hours (0-24), convert to degrees (0-360)
    const raDegrees = eq.ra * 15;
    
    if (debug) {
      console.log(`[Moon RA Debug] Date: ${date.toISOString()}`);
      console.log(`[Moon RA Debug] Observer: ${obsLat.toFixed(4)}°, ${obsLon.toFixed(4)}°`);
      console.log(`[Moon RA Debug] Raw eq.ra: ${eq.ra} (hours), eq.dec: ${eq.dec}°`);
      console.log(`[Moon RA Debug] RA in degrees: ${raDegrees.toFixed(3)}°`);
      
      // Also get ecliptic longitude for comparison
      const eclLon = getMoonEclipticLongitude(date);
      console.log(`[Moon RA Debug] Ecliptic longitude: ${eclLon.toFixed(3)}°`);
    }
    
    return raDegrees;
  } catch (err) {
    console.error('Error getting Moon RA:', err);
    // Fallback: estimate from ecliptic longitude (rough approximation)
    return getMoonEclipticLongitude(date);
  }
}

// Get moon's ecliptic longitude at a given date
function getMoonEclipticLongitude(date) {
  try {
    // astronomy-engine has EclipticLongitude function
    if (typeof Astronomy !== 'undefined' && Astronomy.EclipticLongitude) {
      return Astronomy.EclipticLongitude(Astronomy.Body.Moon, date);
    }
    
    // Fallback: approximate from moon's position
    // This is less accurate but works if EclipticLongitude isn't available
    if (typeof getAstroEngine !== 'function') return null;
    const engine = getAstroEngine();
    if (!engine) return null;
    const observer = engine.createObserver(0, 0, 0);
    const eq = engine.getEquator('moon', date, observer);
    
    // Rough conversion from RA to ecliptic longitude (not accounting for obliquity properly)
    // RA is in hours (0-24), convert to degrees (0-360)
    const raDeg = eq.ra * 15;
    
    // This is a simplification - proper ecliptic conversion requires obliquity
    // For approximate purposes near the ecliptic, RA roughly correlates with ecliptic longitude
    return raDeg;
  } catch (err) {
    console.warn('Could not calculate moon ecliptic longitude:', err);
    return 0;
  }
}

// Get human-readable label for current year start setting
function getYearStartLabel() {
  switch (state.yearStartRule) {
    case '14daysBefore': return 'Passover after Equinox';
    case '1dayBefore': return 'Equinox −1 day';
    case 'virgoFeet': return 'Moon Under Virgo\'s Feet';
    default: return 'Renewed Moon after Equinox';
  }
}

// Generate Equinox rule methodology HTML (used in settings and day detail)
function getEquinoxMethodologyHtml(options = {}) {
  const { showCalculation = false, equinoxDate = null, day1Date = null, timingStr = '', beforeAfter = '' } = options;
  
  let html = `
    <p><strong>⚖️ Renewed Moon after Equinox</strong></p>
    <p>The first renewed moon <em>on or after</em> the spring equinox begins the year. This ensures:</p>
    <ul style="margin: 10px 0; padding-left: 20px; color: var(--text-primary);">
      <li><strong>Observation before the month</strong> — the sign precedes the decision</li>
      <li><strong>No calculation errors</strong> — watch the sun, not a formula</li>
      <li><strong>Practical globally</strong> — anyone can observe without technology</li>
      <li><strong>Barley ripe by First Fruits</strong> — harvest ready by Day 16</li>
    </ul>
    <p style="font-size: 0.9em; color: var(--text-secondary);">Starting 2 weeks earlier risks unripe barley. Any later and the harvest would be over.</p>`;
  
  if (showCalculation && equinoxDate && day1Date) {
    html += `
    <div style="margin: 12px 0; padding: 10px; background: var(--surface-hover); border-radius: 6px;">
      <strong>This Year:</strong><br>
      • Spring Equinox: ${equinoxDate}<br>
      • Day 1 begins: ${day1Date}<br>
      • Timing: ${timingStr} ${beforeAfter} equinox
    </div>`;
  }
  
  html += `
    <details class="settings-accordion">
      <summary>View Biblical Justification</summary>
      <div class="accordion-content">
        <p><strong>Twelve Hours in the Day</strong></p>
        <blockquote>"Are there not twelve hours in the day?"<br>— John 11:9</blockquote>
        <p>Yeshua likely spoke these words around Renewed Moon day, shortly before Passover (see John 11:55, 12:1). The equinox—when day and night are equal (~12 hours each)—may be the precondition He was referencing for starting the year.</p>
        
        <p><strong>What is Aviv?</strong></p>
        <p>The first month is called <strong>Aviv</strong> (אָבִיב), describing barley at a specific stage of ripeness—heads formed, soft dough stage, ready for harvest within 2-3 weeks:</p>
        <blockquote>"And the flax and the barley was smitten: for the barley was in the ear [aviv], and the flax was bolled."<br>— Exodus 9:31</blockquote>
        
        <p><strong>First Fruits Requirement</strong></p>
        <p><strong>First Fruits (Day 16)</strong> requires ripe barley for the wave-sheaf offering:</p>
        <blockquote>"From such time as thou begin to put the sickle to the standing grain shalt thou begin to number seven weeks."<br>— Deuteronomy 16:9</blockquote>
        
        <p><strong>The Tekufah (Turning Point)</strong></p>
        <p>The Feast of Ingathering (Tabernacles) is connected to the <em>tekufah</em> (turning point):</p>
        <blockquote>"You shall observe the Feast of Weeks… and the Feast of Ingathering at the turning (tekufah) of the year."<br>— Exodus 34:22</blockquote>
        <p>If the fall feast is at one turning point (autumn equinox), Passover should be at the other (spring equinox).</p>
        
        <p style="margin-top: 15px;"><a href="#" style="color: var(--accent-primary);" onclick="event.preventDefault();AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'08_When_does_the_Year_Start'}})">📖 See "Time Tested Tradition" chapter: When Does the Year Start?</a></p>
      </div>
    </details>`;
  
  return html;
}

// Generate Passover rule methodology HTML (used in settings and day detail)
function getPassoverMethodologyHtml(options = {}) {
  const { showCalculation = false, equinoxDate = null, day1Date = null, day15Date = null, timingStr = '', beforeAfter = '' } = options;
  
  let html = `
    <p><strong>🐑 Passover after Equinox</strong></p>
    <p>The first new moon is chosen such that <strong>Day 15</strong> (when Unleavened Bread begins) occurs <em>on or after</em> the spring equinox. This ensures:</p>
    <ul style="margin: 10px 0; padding-left: 20px; color: var(--text-primary);">
      <li>Passover is always a true "spring festival" (<em>ḥag ha-aviv</em>)</li>
      <li>Matches the traditional Jewish calendar intercalation rule</li>
      <li>Allows the month to start up to 14 days before the equinox</li>
    </ul>`;
  
  if (showCalculation && equinoxDate && day1Date) {
    html += `
    <div style="margin: 12px 0; padding: 10px; background: var(--surface-hover); border-radius: 6px;">
      <strong>This Year:</strong><br>
      • Spring Equinox: ${equinoxDate}<br>
      • Day 1 begins: ${day1Date}<br>
      ${day15Date ? `• Day 15 (Unleavened): ${day15Date}<br>` : ''}
      • Timing: ${timingStr} ${beforeAfter} equinox
    </div>`;
  }
  
  html += `
    <details class="settings-accordion">
      <summary>View Traditional Source</summary>
      <div class="accordion-content">
        <p><strong>Maimonides' Codification</strong></p>
        <p>Maimonides codified the ancient rabbinic intercalation rule in <em>Hilchot Kiddush HaChodesh 4:2</em>:</p>
        <blockquote>"When the court calculates and determines that the vernal equinox will fall on the sixteenth of Nisan or later, the year is made full [a leap month is added]."</blockquote>
        <p>This means if the equinox would fall on Day 16 or later, a leap month (Adar II) is added, pushing Nisan forward so that the equinox falls on Day 15 or earlier.</p>
        
        <p><strong>Torah Command</strong></p>
        <blockquote>"Observe the month of Aviv, and keep the Passover unto the LORD thy God: for in the month of Aviv the LORD thy God brought thee forth out of Egypt by night."<br>— Deuteronomy 16:1</blockquote>
        <p>The month must be Aviv (spring) when Passover occurs, ensuring the festival aligns with the season of redemption and renewal.</p>
        
        <p style="margin-top: 15px;"><a href="#" style="color: var(--accent-primary);" onclick="event.preventDefault();AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'08_When_does_the_Year_Start'}})">📖 See "Time Tested Tradition" chapter: When Does the Year Start?</a></p>
      </div>
    </details>`;
  
  return html;
}

// Generate Virgo rule methodology HTML (used in settings and day detail)
function getVirgoMethodologyHtml(options = {}) {
  const { showCalculation = false, virgoCalc = null } = options;
  
  let html = `<p><strong>♍ Moon Under Virgo's Feet (Revelation 12:1)</strong></p>
    <p>The year begins with the first full moon where the Moon's leading edge RA &gt; Spica RA. When this is true, Spica sets before the Moon, placing the Moon "under" Virgo's feet.</p>`;
  
  // Add detailed calculation with human-readable explanations
  if (showCalculation && virgoCalc) {
    const virgoDate = new Date(virgoCalc.selectedFullMoon);
    const virgoParts = getFormattedDateParts(virgoDate);
    const virgoDateStr = `${virgoParts.weekdayName}, ${virgoParts.shortMonthName} ${virgoParts.day}${getOrdinalSuffix(virgoParts.day)}, ${virgoParts.yearStr}`;
    const daystartDate = new Date(virgoCalc.daystart || virgoCalc.selectedFullMoon);
    const daystartTimeStr = daystartDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const diff = parseFloat(virgoCalc.difference);
    const moonLeadingEdgeRA = parseFloat(virgoCalc.moonRA);
    const moonCenterRA = parseFloat(virgoCalc.moonCenterRA || (moonLeadingEdgeRA - 0.25));
    const spicaRA = parseFloat(virgoCalc.spicaRA);
    
    // Determine if the selection is valid
    const isValid = diff > 0;
    const validityIcon = isValid ? '✓' : '✗';
    const validityStyle = isValid ? 'color: #4ade80;' : 'color: #f87171;';
    
    html += `
    <div style="margin: 12px 0; padding: 12px; background: var(--color-purple-muted); border: 1px solid var(--color-purple-muted); border-radius: 8px;">
      <div style="font-size: 1.1em; font-weight: bold; margin-bottom: 10px; ${validityStyle}">${validityIcon} Selected Full Moon: ${virgoDateStr}</div>
      
      <div style="background: var(--surface-hover); padding: 10px; border-radius: 6px; margin-bottom: 10px;">
        <strong>The Test (at daystart ${daystartTimeStr} in ${virgoCalc.locationName || 'Jerusalem'}):</strong>
        <table style="width: 100%; margin-top: 8px; font-size: 0.95em;">
          <tr><td style="padding: 4px 0;"><strong>Moon Center RA:</strong></td><td style="padding: 4px 0; text-align: right;">${moonCenterRA.toFixed(2)}°</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Moon Leading Edge RA:</strong></td><td style="padding: 4px 0; text-align: right;">${moonLeadingEdgeRA.toFixed(2)}° <span style="font-size: 0.8em; color: var(--text-secondary);">(+0.25° radius)</span></td></tr>
          <tr><td style="padding: 4px 0;"><strong>Spica RA:</strong></td><td style="padding: 4px 0; text-align: right;">${spicaRA.toFixed(2)}°</td></tr>
          <tr style="border-top: 1px solid var(--border-default);"><td style="padding: 4px 0;"><strong>Difference (Leading Edge − Spica):</strong></td><td style="padding: 4px 0; text-align: right; ${validityStyle}"><strong>${diff >= 0 ? '+' : ''}${diff.toFixed(2)}°</strong></td></tr>
        </table>
      </div>
      
      <div style="padding: 8px; background: var(--surface-hover); border-radius: 6px; margin-bottom: 10px;">
        <strong>Interpretation:</strong><br>
        ${isValid 
          ? `Moon leading edge (${moonLeadingEdgeRA.toFixed(1)}°) &gt; Spica RA (${spicaRA.toFixed(1)}°). The front of the Moon has passed Spica. As they set in the west, <strong style="color: #4ade80;">Spica sets first</strong>, then the Moon follows — the Moon is under Virgo's feet. ✓`
          : `Moon leading edge (${moonLeadingEdgeRA.toFixed(1)}°) &lt; Spica RA (${spicaRA.toFixed(1)}°). The front of the Moon has not yet passed Spica. As they set in the west, <strong style="color: #f87171;">the Moon sets first</strong>, then Spica follows — the Moon is NOT under Virgo's feet.`
        }
      </div>`;
    
    // Show all full moons that were evaluated
    if (virgoCalc.attempts && virgoCalc.attempts.length > 0) {
      const stellariumLat = virgoCalc.locationLat ?? 31.7683;
      const stellariumLon = virgoCalc.locationLon ?? 35.2137;
      
      html += `<details style="margin-top: 10px;"><summary style="cursor: pointer; color: var(--accent-primary);">View All ${virgoCalc.attempts.length} Full Moons Evaluated</summary>
        <div style="margin-top: 8px; padding: 8px; background: var(--surface-hover); border-radius: 6px;">
          <p style="font-size: 0.85em; color: var(--text-secondary); margin: 0 0 8px 0;">Moon RA shown is the leading edge (center + 0.25° radius)</p>
          <table style="width: 100%; font-size: 0.9em; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid var(--border-default);"><th style="text-align: left; padding: 4px;">Full Moon Date</th><th style="text-align: right; padding: 4px;">Moon RA</th><th style="text-align: right; padding: 4px;">Spica RA</th><th style="text-align: right; padding: 4px;">Diff</th><th style="text-align: center; padding: 4px;">Result</th><th style="text-align: center; padding: 4px;">Verify</th></tr>`;
      
      for (let i = 0; i < virgoCalc.attempts.length; i++) {
        const attempt = virgoCalc.attempts[i];
        if (!attempt) continue;
        const attemptDate = new Date(attempt.fullMoon);
        const attParts = getFormattedDateParts(attemptDate);
        const attDiff = parseFloat(attempt.diff);
        const attPassed = attempt.qualifies || attempt.spicaSetsFirst;  // Support both property names
        const rowBg = attPassed ? 'background: rgba(74, 222, 128, 0.1);' : '';
        const resultIcon = attPassed ? '✓ SELECTED' : '✗ Rejected';
        const resultStyle = attPassed ? 'color: #4ade80;' : 'color: #f87171;';
        
        // Generate Stellarium link for this attempt's daystart time
        const attDaystartDate = new Date(attempt.daystart || attempt.fullMoon);
        const attStellariumDateStr = attDaystartDate.toISOString().split('.')[0] + 'Z';
        const stellariumLink = `https://stellarium-web.org/?date=${attStellariumDateStr}&lat=${stellariumLat}&lng=${stellariumLon}`;
        
        html += `<tr style="${rowBg}"><td style="padding: 4px;">${attParts.shortMonthName} ${attParts.day}, ${attParts.yearStr}</td><td style="text-align: right; padding: 4px;">${parseFloat(attempt.moonRA).toFixed(1)}°</td><td style="text-align: right; padding: 4px;">${parseFloat(attempt.spicaRA).toFixed(1)}°</td><td style="text-align: right; padding: 4px; ${resultStyle}">${attDiff >= 0 ? '+' : ''}${attDiff.toFixed(1)}°</td><td style="text-align: center; padding: 4px; ${resultStyle}">${resultIcon}</td><td style="text-align: center; padding: 4px;"><a href="${stellariumLink}" target="_blank" rel="noopener" title="View in Stellarium at daystart">🔭</a></td></tr>`;
      }
      
      html += `</table>
          <p style="margin-top: 8px; font-size: 0.85em; color: var(--text-secondary);"><strong>Rule:</strong> Select the first full moon where Moon RA &gt; Spica RA (positive difference). Objects with lower RA set earlier.</p>
        </div></details>`;
    }
    
    // Stellarium verification link - use daystart time for verification
    const stellariumCheckDate = new Date(virgoCalc.daystart || virgoCalc.selectedFullMoon);
    const stellariumDateStr = stellariumCheckDate.toISOString().split('.')[0] + 'Z';
    const stellariumLat = virgoCalc.locationLat ?? 31.7683;
    const stellariumLon = virgoCalc.locationLon ?? 35.2137;
    
    html += `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-subtle);">
        <a href="https://stellarium-web.org/?date=${stellariumDateStr}&lat=${stellariumLat}&lng=${stellariumLon}" target="_blank" rel="noopener" style="display: inline-block; padding: 6px 12px; background: var(--accent-primary-muted); border-radius: 4px; text-decoration: none; color: var(--accent-primary);">🔭 Verify in Stellarium (${virgoCalc.locationName || 'Jerusalem'} at daystart on ${virgoParts.shortMonthName} ${virgoParts.day})</a>
        <p style="margin-top: 6px; font-size: 0.85em; color: var(--text-secondary);">Check Moon and Spica RA in Stellarium at sunrise. Moon RA must exceed Spica RA for the rule to be satisfied.</p>
      </div></div>`;
  }
  
  // Add methodology accordion
  html += `<details class="settings-accordion" style="margin-top: 12px;"><summary>View Methodology Explanation</summary>
      <div class="accordion-content">
        <p><strong>What is Right Ascension (RA)?</strong></p>
        <p>Right Ascension measures how far east an object is on the celestial sphere (0° to 360°). Objects with lower RA rise and set earlier.</p>
        
        <p><strong>The Logic</strong></p>
        <p>When Moon RA &gt; Spica RA, the Moon is "behind" Spica. As they move west, Spica (at Virgo's feet) sets first while the Moon is still visible—the Moon is "under" where Virgo's feet were.</p>
        
        <p><strong>Why Full Moon?</strong></p>
        <p>At full moon, the Moon is opposite the Sun. In spring (Sun in Pisces/Aries, RA ~0-30°), the full Moon is in Virgo/Libra (RA ~180-210°). The first full moon where Moon RA exceeds Spica RA (~201°) marks the year.</p>
        
        <p><strong>Biblical Basis</strong></p>
        <blockquote>"And there appeared a great wonder in heaven; a woman clothed with the sun, and the moon under her feet..."<br>— Revelation 12:1</blockquote>
        
        <p><strong>Sources</strong></p>
        <p>Taught by <a href="https://thecreatorscalendar.com" target="_blank" style="color: var(--accent-primary);">TheCreatorsCalendar.com</a> and <a href="https://www.youtube.com/@MikalShabbat" target="_blank" style="color: var(--accent-primary);">Mikal Shabbat Scriptural Studies</a>.</p>
      </div></details>
    
    <div class="settings-warning" style="margin-top: 12px; padding: 10px; background: var(--color-warning-muted); border: 1px solid var(--color-warning-muted); border-radius: 6px;">
      <p style="margin: 0; color: var(--accent-gold);"><strong>⚠️ Precession Warning</strong></p>
      <p style="margin: 8px 0 0 0; color: var(--text-primary);">Spica's position is adjusted for precession (~1° per 72 years). In ancient/future dates, the Virgo alignment may occur earlier or later in spring, potentially affecting barley ripeness for Wave Sheaf (Day 16).</p>
    </div>`;
  
  return html;
}

// Get human-readable label for current day start setting
function getDayStartLabel() {
  const timeLabel = state.dayStartTime === 'evening' ? 'evening' : 'morning';
  
  let angleLabel;
  switch (state.dayStartAngle) {
    case 0: angleLabel = state.dayStartTime === 'evening' ? 'sunset' : 'sunrise'; break;
    case 6: angleLabel = 'civil twilight'; break;
    case 12: angleLabel = 'nautical twilight'; break;
    case 18: angleLabel = 'astronomical twilight'; break;
    default: angleLabel = `${state.dayStartAngle}° twilight`;
  }
  
  // Return "morning nautical twilight" instead of "nautical twilight (morning)"
  // For sunrise/sunset, just return that without time prefix
  if (state.dayStartAngle === 0) {
    return angleLabel;
  }
  return `${timeLabel} ${angleLabel}`;
}

// Convert UTC timestamp to local time at the selected longitude
function utcToLocalTime(utcTimestamp, longitude) {
  // Each 15° of longitude = 1 hour offset
  const hourOffset = longitude / 15;
  return new Date(utcTimestamp + hourOffset * 60 * 60 * 1000);
}

// Convert local time at selected longitude to UTC timestamp
function localTimeToUtc(localDate, longitude) {
  // Each 15° of longitude = 1 hour offset
  const hourOffset = longitude / 15;
  return localDate.getTime() - hourOffset * 60 * 60 * 1000;
}

// Format date for datetime-local input (YYYY-MM-DDTHH:MM)
// Uses UTC values since we pre-convert to local time
// Returns null for dates before year 1 (datetime-local doesn't support negative years)
function formatDatetimeLocal(date) {
  const year = date.getUTCFullYear();
  // datetime-local inputs don't support years before 1
  if (year < 1) return null;
  
  // Year must be 4 digits for datetime-local format
  return String(year).padStart(4, '0') + '-' + 
    String(date.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(date.getUTCDate()).padStart(2, '0') + 'T' +
    String(date.getUTCHours()).padStart(2, '0') + ':' +
    String(date.getUTCMinutes()).padStart(2, '0');
}

// Format UTC timestamp as local time string at selected location
// Returns empty string for ancient dates (datetime-local doesn't support them)
function formatLocalDatetime(utcTimestamp) {
  const localDate = utcToLocalTime(utcTimestamp, state.lon);
  return formatDatetimeLocal(localDate) || '';
}

// Parse datetime-local input as local time at selected location, return UTC timestamp
function parseDatetimeLocal(datetimeStr) {
  // Parse the datetime-local string as if it were UTC
  const [datePart, timePart] = datetimeStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  
  // Build date so year 1-99 is 1-99 AD, not 1900-1999
  const d = new Date(Date.UTC(2000, month - 1, day, hours, minutes));
  d.setUTCFullYear(year);
  return localTimeToUtc(d, state.lon);
}

function getTimezoneFromLongitude(lon) {
  // Calculate UTC offset based on longitude (15 degrees per hour)
  const offsetHours = Math.round(lon / 15);
  if (offsetHours === 0) {
    return 'Atlantic';
  } else if (offsetHours > 0) {
    // Eastern hemisphere regions
    if (offsetHours <= 3) return 'Europe';
    if (offsetHours <= 5) return 'Middle East';
    if (offsetHours <= 8) return 'South Asia';
    if (offsetHours <= 10) return 'East Asia';
    return 'Pacific';
  } else {
    // Western hemisphere regions  
    if (offsetHours >= -4) return 'Eastern Americas';
    if (offsetHours >= -7) return 'Central Americas';
    if (offsetHours >= -9) return 'Western Americas';
    return 'Pacific';
  }
}
function getCorrectWeekday(date) {
  if (isBeforeGregorianReform(date)) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const jdn = julianCalendarToJDN(year, month, day);
    return jdnToWeekday(jdn);
  }
  return date.getUTCDay();
}
function getLocalDateFromUTC(utcDate, longitude) {
  // Calculate timezone offset based on longitude
  // Each 15° of longitude = 1 hour offset
  const hourOffset = longitude / 15;
  
  // For ancient dates, _jdToDate stores Julian calendar components in the Date object.
  // We need to work with UTC components directly to avoid JavaScript's proleptic Gregorian timestamp issues.
  const utcHour = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60;
  const localHour = utcHour + hourOffset;
  
  // Get the base date components (these are already in the correct calendar from _jdToDate)
  let year = utcDate.getUTCFullYear();
  let month = utcDate.getUTCMonth();
  let day = utcDate.getUTCDate();
  
  // Helper to get days in month (handles negative years)
  function getDaysInMonth(y, m) {
    const temp = new Date(Date.UTC(2000, m + 1, 0));
    temp.setUTCFullYear(y);
    return temp.getUTCDate();
  }
  
  // Adjust day if local time crosses midnight
  if (localHour >= 24) {
    day += 1;
    // Handle month/year rollover
    const daysInMonth = getDaysInMonth(year, month);
    if (day > daysInMonth) {
      day = 1;
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
  } else if (localHour < 0) {
    day -= 1;
    if (day < 1) {
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      day = getDaysInMonth(year, month);
    }
  }
  
  // Create date with correct components (use Date.UTC and setUTCFullYear for ancient dates)
  const result = new Date(Date.UTC(2000, month, day, 0, 0, 0));
  result.setUTCFullYear(year);
  return result;
}

// Explicitly expose key functions on window for cross-file access
window.isBeforeGregorianReform = isBeforeGregorianReform;
window.julianCalendarToJDN = julianCalendarToJDN;
window.jdnToWeekday = jdnToWeekday;
