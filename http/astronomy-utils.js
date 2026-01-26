// Astronomy Utility Functions
function getSunriseTimestamp(date) {
  const engine = getAstroEngine();
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
  const engine = getAstroEngine();
  const observer = engine.createObserver(state.lat, state.lon, 0);
  // Use noon UTC as search start to find THIS day's sunset (not previous day's)
  const noonUTC = new Date(Date.UTC(2000, date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));
  noonUTC.setUTCFullYear(date.getUTCFullYear());
  const sunset = engine.searchRiseSet('sun', observer, -1, noonUTC, 1);
  if (sunset) {
    return sunset.date.getTime();
  }
  // Fallback to 6pm if no sunset found (polar regions)
  return midnightUTC.getTime() + 18 * 60 * 60 * 1000;
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
function getAstronomicalTimes(date) {
  try {
    const engine = getAstroEngine();
    const observer = engine.createObserver(state.lat, state.lon, 0);
    
    // Use UTC for dates
    const midnightUTC = new Date(Date.UTC(2000, date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
    midnightUTC.setUTCFullYear(date.getUTCFullYear());
    
    // Sunrise (sun rises above horizon)
    const sunriseResult = engine.searchRiseSet('sun', observer, +1, midnightUTC, 1);
    const sunriseTs = sunriseResult ? sunriseResult.date.getTime() : null;
    
    // Sunset (sun sets below horizon)
    const sunsetResult = engine.searchRiseSet('sun', observer, -1, midnightUTC, 1);
    const sunsetTs = sunsetResult ? sunsetResult.date.getTime() : null;
    
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
    
    // Nautical twilight (end) - sun is 12° below horizon after sunset
    // Search for sun reaching -12° altitude after sunset
    let nauticalTwilightTs = null;
    if (sunsetTs) {
      const nauticalDusk = engine.searchAltitude('sun', observer, -1, new Date(sunsetTs), 1, -12);
      if (nauticalDusk) {
        nauticalTwilightTs = nauticalDusk.date.getTime();
      }
    }
    
    // Format times in observer's local time
    const formatTime = (ts) => {
      if (!ts) return '--:--';
      const localTime = utcToLocalTime(ts, state.lon);
      const hours = localTime.getUTCHours();
      const mins = String(localTime.getUTCMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${mins} ${ampm}`;
    };
    
    return {
      firstLight: formatTime(firstLightTs),
      sunrise: formatTime(sunriseTs),
      sunset: formatTime(sunsetTs),
      nauticalTwilight: formatTime(nauticalTwilightTs)
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
    const engine = getAstroEngine();
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
  const engine = getAstroEngine();
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
function getYearStartPoint(year) {
  const engine = getAstroEngine();
  const springEquinox = engine.getSeasons(year).mar_equinox.date;
  
  if (state.yearStartRule === '13daysBefore') {
    // Return 14 days before the equinox (Day 15 must be on or after equinox per Maimonides)
    return new Date(springEquinox.getTime() - 14 * 24 * 60 * 60 * 1000);
  }
  
  if (state.yearStartRule === 'virgoFeet') {
    // Creator's Calendar: First full moon after equinox where moon is "under Virgo's feet"
    // Moon ecliptic longitude must be > Spica longitude (~204°)
    // This returns the date of that specific full moon, not just the equinox
    const virgoFullMoon = findVirgoFeetFullMoon(year);
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

// Virgo calculation cache is stored in AstroEngines.virgoCache

// Find the first full moon after spring equinox where Spica sets before the Moon
// This is the Creator's Calendar rule: at moonset (morning after full moon night),
// Spica must set before the Moon sets. When Spica sets first, the Moon is "under 
// Virgo's feet" - behind/below Spica in the sky.
// 
// The Creator's Calendar day starts at sunrise, so we check at sunrise on the full moon date.
// We compare Right Ascensions: if Moon RA > Spica RA, Spica sets before Moon.
// (Objects with lower RA cross the horizon earlier)
function findVirgoFeetFullMoon(year) {
  const engine = getAstroEngine();
  const springEquinox = engine.getSeasons(year).mar_equinox.date;
  
  // Spica's coordinates (J2000, with precession adjustment)
  // RA: 13h 25m 11.6s = 201.298° at J2000
  // The RA increases slightly due to precession (~0.0139°/year)
  const yearsFromJ2000 = year - 2000;
  const spicaRA_J2000 = 201.298;  // degrees
  const spicaRA = spicaRA_J2000 + (yearsFromJ2000 * PRECESSION_RATE_DEG_PER_YEAR);
  
  // Use observer's configured location for sunrise calculation
  const obsLat = state.lat ?? 31.7683;
  const obsLon = state.lon ?? 35.2137;
  const observer = engine.createObserver(obsLat, obsLon, 0);
  
  // Start search 29 days before equinox to catch the prior full moon
  // The Virgo rule is purely about Spica/Moon position, not the equinox
  const searchStart = new Date(springEquinox.getTime() - 29 * 24 * 60 * 60 * 1000);
  
  const locationName = getCurrentLocationName();
  console.log(`[Virgo Rule] Year ${year}: Spring equinox = ${springEquinox.toISOString()}`);
  console.log(`[Virgo Rule] Location: ${locationName} (${obsLat.toFixed(4)}, ${obsLon.toFixed(4)})`);
  console.log(`[Virgo Rule] Search starts: ${searchStart.toISOString()} (29 days before equinox)`);
  console.log(`[Virgo Rule] Spica RA (precession-adjusted) = ${spicaRA.toFixed(3)}°`);
  
  // Find full moons from 29 days before equinox
  let searchDate = new Date(searchStart.getTime());
  const attempts_log = [];
  
  for (let attempts = 0; attempts < 4; attempts++) {
    const result = engine.searchMoonPhase(180, searchDate, 40);  // 180 = full moon
    if (!result) break;
    
    const fullMoonDate = result.date;
    
    // Find sunrise on the full moon date (Creator's Calendar day start)
    const midnightUTC = new Date(Date.UTC(
      fullMoonDate.getUTCFullYear(),
      fullMoonDate.getUTCMonth(),
      fullMoonDate.getUTCDate(),
      0, 0, 0
    ));
    const sunriseResult = engine.searchRiseSet('sun', observer, +1, midnightUTC, 1);
    const sunriseTime = sunriseResult ? sunriseResult.date : midnightUTC;
    
    // Get Moon's Right Ascension at sunrise (when checking moonset)
    const moonRA = getMoonRightAscension(sunriseTime);
    
    const diff = moonRA - spicaRA;
    const spicaSetsFirst = diff > 0;  // Moon RA > Spica RA means Spica sets first
    const attemptInfo = {
      fullMoon: fullMoonDate.toISOString(),
      sunrise: sunriseTime.toISOString(),
      moonRA: moonRA.toFixed(3),
      spicaRA: spicaRA.toFixed(3),
      spicaSetsFirst: spicaSetsFirst,
      diff: diff.toFixed(3)
    };
    attempts_log.push(attemptInfo);
    
    console.log(`[Virgo Rule] Full Moon #${attempts + 1}: ${fullMoonDate.toISOString()}`);
    console.log(`[Virgo Rule]   Sunrise: ${sunriseTime.toISOString()}`);
    console.log(`[Virgo Rule]   Moon RA: ${moonRA.toFixed(3)}°, Spica RA: ${spicaRA.toFixed(3)}°`);
    console.log(`[Virgo Rule]   Difference: ${(moonRA - spicaRA).toFixed(3)}° (positive = Spica sets first)`);
    console.log(`[Virgo Rule]   Spica sets before Moon: ${moonRA > spicaRA}`);
    
    // Check if Spica sets before the Moon (Moon RA > Spica RA means Spica sets first)
    // For spring full moons, both Spica (~201°) and Moon (~180-220°) are in similar range
    // With correct location-based calculation, no tolerance should be needed
    if (moonRA > spicaRA) {
      // Spica sets before Moon - Moon is under Virgo's feet
      console.log(`[Virgo Rule] ✓ SELECTED: Full Moon on ${fullMoonDate.toISOString()}`);
      const cacheKey = `${year}_${obsLat.toFixed(4)}_${obsLon.toFixed(4)}`;
      AstroEngines.virgoCache[cacheKey] = {
        year,
        springEquinox: springEquinox.toISOString(),
        spicaRA: spicaRA.toFixed(3),
        selectedFullMoon: fullMoonDate.toISOString(),
        sunriseCheck: sunriseTime.toISOString(),
        moonRA: moonRA.toFixed(3),
        difference: (moonRA - spicaRA).toFixed(3),
        attempts: attempts_log,
        locationName: locationName,
        locationLat: obsLat,
        locationLon: obsLon
      };
      return fullMoonDate;
    }
    
    // Move search to after this full moon
    searchDate = new Date(fullMoonDate.getTime() + 24 * 60 * 60 * 1000);
  }
  
  // Fallback: return first full moon after equinox
  console.log(`[Virgo Rule] No qualifying full moon found, using fallback`);
  const firstResult = engine.searchMoonPhase(180, springEquinox, 40);
  const fallbackCacheKey = `${year}_${obsLat.toFixed(4)}_${obsLon.toFixed(4)}`;
  AstroEngines.virgoCache[fallbackCacheKey] = {
    year,
    springEquinox: springEquinox.toISOString(),
    spicaRA: spicaRA.toFixed(3),
    fallback: true,
    selectedFullMoon: firstResult ? firstResult.date.toISOString() : springEquinox.toISOString(),
    attempts: attempts_log,
    locationName: locationName,
    locationLat: obsLat,
    locationLon: obsLon
  };
  return firstResult ? firstResult.date : springEquinox;
}

// Get Virgo calculation details for a specific year and current location
function getVirgoCalculation(year) {
  const cacheKey = `${year}_${(state.lat ?? 31.7683).toFixed(4)}_${(state.lon ?? 35.2137).toFixed(4)}`;
  return AstroEngines.virgoCache[cacheKey] || null;
}

// Get Moon's Right Ascension in degrees at a given date
function getMoonRightAscension(date) {
  try {
    const engine = getAstroEngine();
    // Use observer's configured location
    const obsLat = state.lat ?? 31.7683;
    const obsLon = state.lon ?? 35.2137;
    const observer = engine.createObserver(obsLat, obsLon, 0);
    const eq = engine.getEquator('moon', date, observer);
    // RA is returned in hours (0-24), convert to degrees (0-360)
    return eq.ra * 15;
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
    const engine = getAstroEngine();
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
    case '13daysBefore': return 'Passover after Equinox';
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
    <ul style="margin: 10px 0; padding-left: 20px; color: rgba(255,255,255,0.9);">
      <li><strong>Observation before the month</strong> — the sign precedes the decision</li>
      <li><strong>No calculation errors</strong> — watch the sun, not a formula</li>
      <li><strong>Practical globally</strong> — anyone can observe without technology</li>
      <li><strong>Barley ripe by First Fruits</strong> — harvest ready by Day 16</li>
    </ul>
    <p style="font-size: 0.9em; color: rgba(255,255,255,0.7);">Starting 2 weeks earlier risks unripe barley. Any later and the harvest would be over.</p>`;
  
  if (showCalculation && equinoxDate && day1Date) {
    html += `
    <div style="margin: 12px 0; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px;">
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
        
        <p style="margin-top: 15px;"><a href="/chapters/08-when-does-the-year-start/" style="color: #7ec8e3;">📖 See "Time Tested Tradition" chapter: When Does the Year Start?</a></p>
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
    <ul style="margin: 10px 0; padding-left: 20px; color: rgba(255,255,255,0.9);">
      <li>Passover is always a true "spring festival" (<em>ḥag ha-aviv</em>)</li>
      <li>Matches the traditional Jewish calendar intercalation rule</li>
      <li>Allows the month to start up to 14 days before the equinox</li>
    </ul>`;
  
  if (showCalculation && equinoxDate && day1Date) {
    html += `
    <div style="margin: 12px 0; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px;">
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
        
        <p style="margin-top: 15px;"><a href="/chapters/08-when-does-the-year-start/" style="color: #7ec8e3;">📖 See "Time Tested Tradition" chapter: When Does the Year Start?</a></p>
      </div>
    </details>`;
  
  return html;
}

// Generate Virgo rule methodology HTML (used in settings and day detail)
function getVirgoMethodologyHtml(options = {}) {
  const { showCalculation = false, virgoCalc = null } = options;
  
  let html = `
    <p><strong>♍ Moon Under Virgo's Feet</strong></p>
    <p>The year begins with the first spring full moon where <em>Spica sets before the Moon</em>, placing the Moon "under the feet of Virgo" (Bethulah), as described in Revelation 12:1.</p>
    <ul style="margin: 10px 0; padding-left: 20px; color: rgba(255,255,255,0.9);">
      <li><strong>Stellar witness</strong> — uses the stars as signs (Genesis 1:14)</li>
      <li><strong>Revelation 12:1 alignment</strong> — "moon under her feet"</li>
      <li><strong>Spica marks Wave Sheaf</strong> — the star aligns with Day 16 (First Fruits)</li>
      <li><strong>Passover in Aries</strong> — sun typically at 0°-15° Aries on Day 14</li>
    </ul>`;
  
  // Add calculation details if provided
  if (showCalculation && virgoCalc) {
    const virgoDate = new Date(virgoCalc.selectedFullMoon);
    const virgoParts = getFormattedDateParts(virgoDate);
    const virgoDateStr = `${virgoParts.weekdayName}, ${virgoParts.shortMonthName} ${virgoParts.day}${getOrdinalSuffix(virgoParts.day)}, ${virgoParts.yearStr}`;
    const equinoxDate = new Date(virgoCalc.springEquinox);
    const eqParts = getFormattedDateParts(equinoxDate);
    const equinoxDateStr = `${eqParts.weekdayName}, ${eqParts.shortMonthName} ${eqParts.day}${getOrdinalSuffix(eqParts.day)}, ${eqParts.yearStr}`;
    const diff = parseFloat(virgoCalc.difference);
    const statusIcon = diff >= 0 ? '✓ Spica sets first' : '✗ Spica sets after';
    
    html += `
    <div style="margin: 12px 0; padding: 10px; background: rgba(138, 43, 226, 0.15); border: 1px solid rgba(138, 43, 226, 0.3); border-radius: 6px;">
      <strong>This Year's Calculation:</strong><br>
      • Location: ${virgoCalc.locationName || 'Jerusalem'}<br>
      • Spring Equinox: ${equinoxDateStr}<br>
      • Selected Full Moon: ${virgoDateStr}<br>
      • Check at Sunrise: ${new Date(virgoCalc.sunriseCheck).toLocaleTimeString()} (${virgoCalc.locationName || 'Jerusalem'})<br>
      • Moon RA: ${virgoCalc.moonRA}° | Spica RA: ${virgoCalc.spicaRA}°<br>
      • Difference: ${virgoCalc.difference}° ${statusIcon}`;
    
    if (virgoCalc.attempts && virgoCalc.attempts.length > 1) {
      html += `<br><br><strong>Previous Full Moon(s) Rejected:</strong>`;
      for (let i = 0; i < virgoCalc.attempts.length - 1; i++) {
        const attempt = virgoCalc.attempts[i];
        if (attempt && !attempt.spicaSetsFirst) {
          const attemptDate = new Date(attempt.fullMoon);
          const attParts = getFormattedDateParts(attemptDate);
          html += `<br>• ${attParts.shortMonthName} ${attParts.day}: Moon RA ${attempt.moonRA}°, Diff ${attempt.diff}° — Spica sets after Moon`;
        }
      }
    }
    
    // Add Stellarium link with the location used in the calculation
    const stellariumCheckDate = new Date(virgoCalc.sunriseCheck);
    const stellariumDateStr = stellariumCheckDate.toISOString().split('.')[0] + 'Z';
    const stellariumLat = virgoCalc.locationLat ?? 31.7683;
    const stellariumLon = virgoCalc.locationLon ?? 35.2137;
    const stellariumLocationName = virgoCalc.locationName || 'Jerusalem';
    html += `<br><br><a href="https://stellarium-web.org/?date=${stellariumDateStr}&lat=${stellariumLat}&lng=${stellariumLon}" target="_blank" rel="noopener" class="stellarium-link"><img src="https://stellarium-web.org/favicon.ico" alt="" onerror="this.style.display='none'">Verify in Stellarium (${stellariumLocationName} at sunrise)</a>`;
    
    html += `</div>`;
  }
  
  // Add methodology accordion
  html += `
    <details class="settings-accordion">
      <summary>View Methodology</summary>
      <div class="accordion-content">
        <p><strong>The Algorithm</strong></p>
        <p>Starting 29 days before the spring equinox, find each full moon and compare Right Ascensions at sunrise in your location. Select the first full moon where Spica's RA is less than the Moon's RA, meaning Spica sets before the Moon.</p>
        
        <p><strong>Biblical Basis</strong></p>
        <blockquote>"And there appeared a great wonder in heaven; a woman clothed with the sun, and the moon under her feet, and upon her head a crown of twelve stars."<br>— Revelation 12:1</blockquote>
        <p>This method interprets the sign as an annual astronomical configuration marking the new year.</p>
        
        <p><strong>Sources</strong></p>
        <p>This methodology is taught by <a href="https://thecreatorscalendar.com" target="_blank" style="color: #7ec8e3;">TheCreatorsCalendar.com</a> and the <a href="https://www.youtube.com/@MikalShabbat" target="_blank" style="color: #7ec8e3;">Mikal Shabbat Scriptural Studies</a> YouTube channel.</p>
      </div>
    </details>
    
    <div class="settings-warning" style="margin-top: 12px; padding: 10px; background: rgba(255, 180, 0, 0.15); border: 1px solid rgba(255, 180, 0, 0.3); border-radius: 6px;">
      <p style="margin: 0; color: #ffb400;"><strong>⚠️ Precession &amp; Barley Warning</strong></p>
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.85);">While this implementation adjusts Spica's position for precession (~1° per 72 years), the constellations drift relative to the seasons over millennia. Barley must be ripe for Wave Sheaf on Day 16 (Lev 23:10-11). Around 2000 BC, the Virgo alignment occurs ~1 month earlier in spring; around 4000 AD, ~1 month later. This could place Passover too early (before barley ripens) in ancient dates, or too late in future dates.</p>
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
  
  // Create date as UTC
  const localAsUtc = Date.UTC(year, month - 1, day, hours, minutes);
  
  // Convert from local time at longitude to actual UTC
  return localTimeToUtc(new Date(localAsUtc), state.lon);
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
  
  // Adjust day if local time crosses midnight
  if (localHour >= 24) {
    day += 1;
    // Handle month/year rollover (simplified - assumes 30-day months for edge cases)
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
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
      day = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }
  }
  
  // Create date with correct components (use Date.UTC and setUTCFullYear for ancient dates)
  const result = new Date(Date.UTC(2000, month, day, 0, 0, 0));
  result.setUTCFullYear(year);
  return result;
}
