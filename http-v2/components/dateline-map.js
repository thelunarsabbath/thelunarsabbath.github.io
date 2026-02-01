/**
 * DatelineMap Component
 * Shows the world map with dateline visualization, sun position, and location marker
 * 
 * Usage:
 *   const map = DatelineMap.create({
 *     moonEventDate: new Date(),
 *     lat: 31.77,
 *     lon: 35.21,
 *     moonPhase: 'full',
 *     dayStartTime: 'morning',
 *     dayStartAngle: -12,
 *     onLocationSelect: (lat, lon, citySlug) => { ... }
 *   });
 *   container.appendChild(map);
 */

const DatelineMap = {
  // Earth map image path
  IMAGE_PATH: '/assets/img/earth.png',
  
  /**
   * Create a dateline map element
   * @param {Object} options
   * @param {Date} options.moonEventDate - The moon event date for dateline calculation
   * @param {number} options.lat - Current latitude
   * @param {number} options.lon - Current longitude  
   * @param {string} options.moonPhase - 'full', 'dark', or 'crescent'
   * @param {string} options.dayStartTime - 'morning' or 'evening'
   * @param {number} options.dayStartAngle - Sun angle for day start (e.g., -12 for nautical dawn)
   * @param {Function} options.onLocationSelect - Callback(lat, lon, citySlug) when location selected
   * @param {boolean} options.showHint - Show "click to select" hint (default true)
   * @returns {HTMLElement} The map container element
   */
  create(options = {}) {
    const { 
      moonEventDate = new Date(),
      lat = 31.77, 
      lon = 35.21,
      moonPhase = 'full',
      dayStartTime = 'morning',
      dayStartAngle = -12,
      onLocationSelect = null,
      showHint = true 
    } = options;
    
    // Calculate dateline position
    const datelineLon = this.calculateDatelineLongitude(moonEventDate, moonPhase, dayStartAngle);
    const datelinePos = ((datelineLon + 180) / 360) * 100;
    
    // Calculate location marker position
    const locX = ((lon + 180) / 360) * 100;
    const locY = ((90 - lat) / 180) * 100;
    
    // Format display strings
    const dayStartEvent = this.getDayStartEventName(dayStartTime, dayStartAngle);
    const dayStartIcon = dayStartTime === 'evening' ? '🌅' : '☀';
    const moonLabel = this.getMoonLabel(moonPhase);
    const region = this.getDatelineCity(datelineLon);
    const lonStr = datelineLon >= 0 
      ? `${Math.abs(datelineLon).toFixed(1)}°E` 
      : `${Math.abs(datelineLon).toFixed(1)}°W`;
    
    // Format moon event date
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const moonDateStr = `${months[moonEventDate.getUTCMonth()]} ${moonEventDate.getUTCDate()}, ${moonEventDate.getUTCFullYear()}`;
    const utcHours = moonEventDate.getUTCHours();
    const utcMins = moonEventDate.getUTCMinutes();
    const utcTimeStr = `${String(utcHours).padStart(2,'0')}:${String(utcMins).padStart(2,'0')} UTC`;
    
    // Get location display
    const locationName = this.getLocationName(lat, lon);
    const coordStr = `${lat.toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
    
    // Create container
    const container = document.createElement('div');
    container.className = 'dateline-container';
    
    container.innerHTML = `
      <div class="dateline-label">${dayStartEvent} line at moment of ${moonLabel} — ${moonDateStr} — ${utcTimeStr}</div>
      <div class="dateline-map">
        <div class="dateline-map-bg">
          <img src="${this.IMAGE_PATH}" alt="World Map" draggable="false" loading="eager" decoding="sync">
        </div>
        <div class="dateline-marker" style="left: ${datelinePos}%">
          <span class="dateline-marker-icon">${dayStartIcon}</span>
          <span class="dateline-marker-label">${dayStartEvent.toUpperCase()}</span>
        </div>
        <div class="dateline-location-marker" style="left: ${locX}%; top: ${locY}%" title="${locationName}: ${coordStr}">
          <div class="dateline-location-pin"></div>
        </div>
      </div>
      <div class="dateline-cities">
        <span>180°W</span>
        <span>90°W</span>
        <span>0°</span>
        <span>90°E</span>
        <span>180°E</span>
      </div>
      <div class="dateline-info dateline-daystart">Day start line: ${lonStr} — ${region}</div>
      <div class="dateline-info dateline-location">Your location: ${locationName} (${coordStr})</div>
      ${showHint ? `<div class="dateline-click-hint">Click map to change location • First to reach ${dayStartEvent.toLowerCase()} after ${moonLabel} starts month first</div>` : ''}
    `;
    
    // Add click handler
    const mapEl = container.querySelector('.dateline-map');
    if (mapEl && onLocationSelect) {
      mapEl.style.cursor = 'crosshair';
      mapEl.addEventListener('click', (e) => {
        const result = this.handleClick(e, mapEl);
        if (result) {
          onLocationSelect(result.lat, result.lon, result.citySlug);
        }
      });
    }
    
    // Store reference for updates
    container._options = options;
    container._mapEl = mapEl;
    
    return container;
  },
  
  /**
   * Handle map click - convert to lat/lon and find nearest city
   */
  handleClick(e, mapEl) {
    const rect = mapEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to lat/lon
    const clickLon = (x / rect.width) * 360 - 180;
    const clickLat = 90 - (y / rect.height) * 180;
    
    // Find nearest city from URLRouter's city slugs
    const citySlug = this.findNearestCity(clickLat, clickLon);
    
    if (citySlug && typeof URLRouter !== 'undefined' && URLRouter.CITY_SLUGS[citySlug]) {
      const coords = URLRouter.CITY_SLUGS[citySlug];
      return { lat: coords.lat, lon: coords.lon, citySlug };
    }
    
    // No city found, return raw coordinates
    return { lat: clickLat, lon: clickLon, citySlug: null };
  },
  
  /**
   * Find the nearest city to given coordinates
   */
  findNearestCity(lat, lon) {
    if (typeof URLRouter === 'undefined' || !URLRouter.CITY_SLUGS) return null;
    
    let nearestSlug = null;
    let nearestDist = Infinity;
    
    for (const [slug, coords] of Object.entries(URLRouter.CITY_SLUGS)) {
      const dist = Math.sqrt(
        Math.pow(coords.lat - lat, 2) + 
        Math.pow(coords.lon - lon, 2)
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestSlug = slug;
      }
    }
    
    return nearestSlug;
  },
  
  /**
   * Update marker and info on an existing map
   */
  updateLocation(container, lat, lon) {
    const marker = container.querySelector('.dateline-location-marker');
    const locationInfo = container.querySelector('.dateline-location');
    
    if (marker) {
      const locX = ((lon + 180) / 360) * 100;
      const locY = ((90 - lat) / 180) * 100;
      marker.style.left = locX + '%';
      marker.style.top = locY + '%';
    }
    
    if (locationInfo) {
      const locationName = this.getLocationName(lat, lon);
      const coordStr = `${lat.toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
      locationInfo.textContent = `Your location: ${locationName} (${coordStr})`;
    }
  },
  
  /**
   * Calculate the dateline longitude based on moon event
   * This finds the longitude where sunrise/dawn is currently occurring
   */
  calculateDatelineLongitude(moonEventDate, moonPhase, dayStartAngle = -12) {
    const utcHours = moonEventDate.getUTCHours() + moonEventDate.getUTCMinutes() / 60 + 
                     moonEventDate.getUTCSeconds() / 3600;
    
    // At 12:00 UTC, the sun is directly over 0° longitude (solar noon)
    // sunNoonLon = longitude where it's currently solar noon
    const sunNoonLon = -((utcHours - 12) * 15);
    
    // Sunrise occurs ~6 hours before noon = 90° to the WEST of solar noon
    // (west because those locations have earlier local time)
    const sunriseLon = sunNoonLon - 90;
    
    // For dawn angles (negative = below horizon), dawn occurs BEFORE sunrise
    // Each degree below horizon = ~4 min earlier = 1° longitude further WEST
    // dayStartAngle < 0 means below horizon (e.g., -12 for nautical dawn)
    // So dawn is |dayStartAngle| degrees to the WEST of sunrise
    const dawnOffset = Math.abs(dayStartAngle);  // degrees of longitude
    
    let datelineLon = sunriseLon - dawnOffset;
    
    // Normalize to -180 to 180
    while (datelineLon > 180) datelineLon -= 360;
    while (datelineLon < -180) datelineLon += 360;
    
    return datelineLon;
  },
  
  /**
   * Get day start event name
   */
  getDayStartEventName(dayStartTime, dayStartAngle) {
    if (dayStartTime === 'evening') {
      if (dayStartAngle === 0) return 'Sunset';
      if (dayStartAngle === -6) return 'Civil Twilight';
      if (dayStartAngle === -12) return 'Nautical Twilight';
      if (dayStartAngle === -18) return 'Astronomical Twilight';
      return 'Evening';
    } else {
      if (dayStartAngle === 0) return 'Sunrise';
      if (dayStartAngle === -6) return 'Civil Dawn';
      if (dayStartAngle === -12) return 'Nautical Dawn';
      if (dayStartAngle === -18) return 'Astronomical Dawn';
      return 'Morning';
    }
  },
  
  /**
   * Get moon phase label
   */
  getMoonLabel(moonPhase) {
    switch (moonPhase) {
      case 'full': return 'Full Moon';
      case 'dark': return 'Dark Moon';
      case 'crescent': return 'Crescent Moon';
      default: return 'Moon';
    }
  },
  
  /**
   * Get region name for dateline longitude
   */
  getDatelineCity(lon) {
    // Simplified region lookup
    if (lon >= 100 || lon < -160) return 'Pacific / Date Line';
    if (lon >= 60) return 'China / Southeast Asia';
    if (lon >= 30) return 'Middle East / India';
    if (lon >= -30) return 'Europe / Africa';
    if (lon >= -90) return 'Atlantic / Americas';
    return 'Pacific / Americas';
  },
  
  /**
   * Get location name from coordinates
   */
  getLocationName(lat, lon) {
    if (typeof URLRouter !== 'undefined' && URLRouter.CITY_SLUGS) {
      for (const [slug, coords] of Object.entries(URLRouter.CITY_SLUGS)) {
        if (Math.abs(coords.lat - lat) < 1 && Math.abs(coords.lon - lon) < 1) {
          return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
      }
    }
    return 'Custom Location';
  },
  
  /**
   * Format coordinates for display
   */
  formatCoords(lat, lon) {
    const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
    const lonStr = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
    return `${latStr}, ${lonStr}`;
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DatelineMap;
}

// Make available globally
window.DatelineMap = DatelineMap;

// Expose cache for debugging/clearing
window.tzGuideCache = tzGuideCache;

/**
 * Get the biblical date (year, month, day) for a given timestamp and location
 * Uses ACTUAL astronomical calculations for sunrise/sunset at that location
 * 
 * @param {number} timestamp - UTC timestamp in ms
 * @param {number} latitude - Latitude in degrees
 * @param {number} longitude - Longitude in degrees (-180 to 180)
 * @param {Object} calendarData - { lunarMonths, year } from AppStore derived state
 * @param {Object} profile - { dayStartTime, dayStartAngle }
 * @param {Object} engine - The astronomy engine instance
 * @returns {Object} { year, month, day, label, dayStartOccurred }
 */
function getBiblicalDateForLocation(timestamp, latitude, longitude, calendarData, profile, engine) {
  if (!calendarData || !calendarData.lunarMonths || calendarData.lunarMonths.length === 0) {
    return null;
  }
  
  const { lunarMonths, year } = calendarData;
  const { dayStartTime, dayStartAngle } = profile;
  
  const viewTime = new Date(timestamp);
  
  // Calculate the local gregorian date at this longitude
  // Each 15° of longitude = 1 hour offset from UTC
  const localOffsetMs = (longitude / 15) * 60 * 60 * 1000;
  const localTime = new Date(timestamp + localOffsetMs);
  
  // Get the local calendar date (midnight)
  const localDate = new Date(Date.UTC(
    localTime.getUTCFullYear(),
    localTime.getUTCMonth(),
    localTime.getUTCDate()
  ));
  
  // Use astronomy engine to calculate ACTUAL day start time at this location
  let dayStartOccurred = false;
  
  if (engine && typeof engine.createObserver === 'function') {
    try {
      const observer = engine.createObserver(latitude, longitude, 0);
      
      // Search for sunrise/sunset on the local date
      const midnight = new Date(localDate.getTime());
      const direction = dayStartTime === 'evening' ? -1 : +1;
      
      // Start search from appropriate time
      let searchStart = midnight;
      if (dayStartTime === 'evening') {
        // For evening, search from noon for sunset
        searchStart = new Date(midnight.getTime() + 12 * 60 * 60 * 1000);
      }
      
      let dayStartResult;
      if (dayStartAngle === 0) {
        // Sunrise/sunset
        dayStartResult = engine.searchRiseSet('sun', observer, direction, searchStart, 1);
      } else {
        // Twilight (civil, nautical, astronomical)
        dayStartResult = engine.searchAltitude('sun', observer, direction, searchStart, 1, -dayStartAngle);
      }
      
      if (dayStartResult && dayStartResult.date) {
        const dayStartTimestamp = dayStartResult.date.getTime();
        dayStartOccurred = timestamp >= dayStartTimestamp;
      } else {
        // Fallback: approximate based on local time
        const localHour = localTime.getUTCHours() + localTime.getUTCMinutes() / 60;
        if (dayStartTime === 'evening') {
          dayStartOccurred = localHour >= 18;
        } else {
          dayStartOccurred = localHour >= 6;
        }
      }
    } catch (e) {
      // Fallback to approximation
      const localHour = localTime.getUTCHours() + localTime.getUTCMinutes() / 60;
      if (dayStartTime === 'evening') {
        dayStartOccurred = localHour >= 18;
      } else {
        dayStartOccurred = localHour >= 6;
      }
    }
  } else {
    // No engine available, use approximation
    const localHour = localTime.getUTCHours() + localTime.getUTCMinutes() / 60;
    if (dayStartTime === 'evening') {
      dayStartOccurred = localHour >= 18;
    } else {
      dayStartOccurred = localHour >= 6;
    }
  }
  
  // Determine the effective gregorian date for biblical date lookup
  // If day start hasn't occurred, we're still on the previous biblical day
  let effectiveDate;
  if (dayStartTime === 'evening') {
    // Evening start: after sunset = next biblical day, before sunset = current biblical day
    effectiveDate = dayStartOccurred ? new Date(localDate.getTime() + 24 * 60 * 60 * 1000) : localDate;
  } else {
    // Morning start: after sunrise = current biblical day, before sunrise = previous biblical day
    effectiveDate = dayStartOccurred ? localDate : new Date(localDate.getTime() - 24 * 60 * 60 * 1000);
  }
  
  // Find the biblical date by searching through lunar months
  for (let mi = 0; mi < lunarMonths.length; mi++) {
    const month = lunarMonths[mi];
    if (!month.days) continue;
    
    for (let di = 0; di < month.days.length; di++) {
      const day = month.days[di];
      if (!day.gregorianDate) continue;
      
      const dayDate = new Date(day.gregorianDate);
      if (dayDate.getUTCFullYear() === effectiveDate.getUTCFullYear() &&
          dayDate.getUTCMonth() === effectiveDate.getUTCMonth() &&
          dayDate.getUTCDate() === effectiveDate.getUTCDate()) {
        return {
          year: year,
          month: month.monthNumber,
          day: day.lunarDay,
          label: `${month.monthNumber}/${day.lunarDay}`,
          dayStartOccurred: dayStartOccurred
        };
      }
    }
  }
  
  return null;
}

/**
 * Calculate biblical date for a specific location at a given timestamp
 * Uses the calendar engine to generate location-specific calendar
 * 
 * @param {number} timestamp - UTC timestamp in ms
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Object} profile - { moonPhase, dayStartTime, dayStartAngle, yearStartRule }
 * @param {Object} engine - LunarCalendarEngine instance
 * @returns {Object|null} { year, month, day }
 */
function calculateBiblicalDateForLocation(timestamp, lat, lon, profile, engine) {
  if (!engine) return null;
  
  const viewDate = new Date(timestamp);
  const gregorianYear = viewDate.getUTCFullYear();
  const location = { lat, lon };
  
  try {
    // Generate calendar for this location
    // The engine uses the profile config (yearStartRule, etc.) set on it
    const calendar = engine.generateYear(gregorianYear, location);
    
    if (!calendar || !calendar.months || calendar.months.length === 0) {
      return null;
    }
    
    // Find which month/day the timestamp falls into
    // Calculate local time at this longitude
    const localOffsetMs = (lon / 15) * 60 * 60 * 1000;
    const localTime = new Date(timestamp + localOffsetMs);
    const localDate = new Date(Date.UTC(
      localTime.getUTCFullYear(),
      localTime.getUTCMonth(),
      localTime.getUTCDate()
    ));
    
    // Search through months to find matching gregorian date
    for (const month of calendar.months) {
      if (!month.days) continue;
      for (const day of month.days) {
        if (!day.gregorianDate) continue;
        const dayDate = new Date(day.gregorianDate);
        if (dayDate.getUTCFullYear() === localDate.getUTCFullYear() &&
            dayDate.getUTCMonth() === localDate.getUTCMonth() &&
            dayDate.getUTCDate() === localDate.getUTCDate()) {
          return {
            year: gregorianYear, // This is approximate - should be biblical year
            month: month.monthNumber,
            day: day.lunarDay
          };
        }
      }
    }
    
    // If not found in current year, try previous year
    const prevCalendar = engine.generateYear(gregorianYear - 1, location);
    if (prevCalendar && prevCalendar.months) {
      for (const month of prevCalendar.months) {
        if (!month.days) continue;
        for (const day of month.days) {
          if (!day.gregorianDate) continue;
          const dayDate = new Date(day.gregorianDate);
          if (dayDate.getUTCFullYear() === localDate.getUTCFullYear() &&
              dayDate.getUTCMonth() === localDate.getUTCMonth() &&
              dayDate.getUTCDate() === localDate.getUTCDate()) {
            return {
              year: gregorianYear - 1,
              month: month.monthNumber,
              day: day.lunarDay
            };
          }
        }
      }
    }
    
    return null;
  } catch (e) {
    console.warn('[TimezoneGuide] Error calculating date for location:', lat, lon, e);
    return null;
  }
}

// Unique ID counter for async timezone guides
let tzGuideCounter = 0;

// Cache for timezone guide calculations
// Key: JD rounded to 4 decimal places (~8.6 seconds precision)
// Value: { samples, html, config }
const tzGuideCache = {
  data: new Map(),
  maxSize: 50,  // Keep last 50 calculations
  
  getKey(jd, config) {
    // Round JD to 4 decimals and include config hash
    const jdKey = jd.toFixed(4);
    const configKey = `${config.moonPhase}-${config.dayStartTime}-${config.dayStartAngle}-${config.yearStartRule}`;
    return `${jdKey}:${configKey}`;
  },
  
  get(jd, config) {
    return this.data.get(this.getKey(jd, config));
  },
  
  set(jd, config, value) {
    const key = this.getKey(jd, config);
    // Evict oldest if at capacity
    if (this.data.size >= this.maxSize) {
      const firstKey = this.data.keys().next().value;
      this.data.delete(firstKey);
    }
    this.data.set(key, value);
  },
  
  clear() {
    this.data.clear();
  }
};

/**
 * Render the timezone guide showing biblical dates across the globe
 * Returns a placeholder immediately, then populates asynchronously
 * 
 * @param {Object} params - All required parameters
 * @returns {string} HTML for the timezone guide (placeholder initially)
 */
function renderTimezoneGuide(params) {
  const { timestamp, datelineLon, calendarData, profile, userLat, userLon, currentDay, engine } = params;
  
  if (!calendarData || !calendarData.lunarMonths || !currentDay) {
    return '';
  }
  
  // Generate unique ID for this guide
  const guideId = `tz-guide-${++tzGuideCounter}`;
  
  // Return placeholder immediately, compute async
  setTimeout(() => {
    computeTimezoneGuideAsync(guideId, params);
  }, 0);
  
  return `
    <div class="dateline-tz-guide" id="${guideId}">
      <div class="tz-guide-label">Biblical Date by Region:</div>
      <div class="tz-bands-container">
        <div class="tz-band tz-band-loading" style="left: 0%; width: 100%;">
          <span class="tz-band-label">Loading...</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Create an isolated calendar engine for timezone calculations
 * Each instance owns its own Virgo cache - no global state pollution
 * @param {Object} profile - Calendar profile config
 * @returns {LunarCalendarEngine}
 */
function createIsolatedCalendarEngine(profile) {
  // Get the stateless astronomy engine singleton
  const astroEngine = typeof getAstroEngine === 'function' ? getAstroEngine() : null;
  if (!astroEngine) {
    console.warn('[TZ Guide] No astro engine available');
    return null;
  }
  
  // Create fresh calendar engine - it owns its own _virgoCache
  const engine = new LunarCalendarEngine(astroEngine);
  engine.configure({
    moonPhase: profile.moonPhase || 'full',
    dayStartTime: profile.dayStartTime || 'morning',
    dayStartAngle: profile.dayStartAngle ?? 12,
    yearStartRule: profile.yearStartRule || 'virgoFeet'
  });
  
  return engine;
}

/**
 * Pure function: Calculate lunar date for a JD at a specific location
 * @param {number} jd - Julian Day
 * @param {Object} location - { lat, lon }
 * @param {Object} config - Calendar config (moonPhase, dayStartTime, etc.)
 * @returns {{ year, month, day } | null}
 */
function calcLunarDate(jd, location, config) {
  try {
    // Get astronomy engine
    const astroEngine = typeof getAstroEngine === 'function' ? getAstroEngine() : null;
    if (!astroEngine) return null;
    
    // Create isolated engine instance
    const engine = new LunarCalendarEngine(astroEngine);
    engine.configure(config);
    
    // Convert JD to Gregorian year
    const timestamp = (jd - 2440587.5) * 86400000;
    const gregYear = new Date(timestamp).getUTCFullYear();
    
    // Try current year and previous year (lunar years span two Gregorian years)
    for (const lunarYear of [gregYear, gregYear - 1]) {
      const calendar = engine.generateYear(lunarYear, location);
      
      // Find the day that contains this JD using proper sunrise-based boundaries
      for (let mi = 0; mi < calendar.months.length; mi++) {
        const month = calendar.months[mi];
        for (let di = 0; di < month.days.length; di++) {
          const day = month.days[di];
          const dayStartJD = day.jd;  // Sunrise JD (or sunset for evening start)
          
          // Get the next day's start JD to define the day boundary
          let nextDayStartJD;
          if (di + 1 < month.days.length) {
            nextDayStartJD = month.days[di + 1].jd;
          } else if (mi + 1 < calendar.months.length) {
            nextDayStartJD = calendar.months[mi + 1].days[0].jd;
          } else {
            // Last day of year - estimate next sunrise as ~24h later
            nextDayStartJD = dayStartJD + 1.0;
          }
          
          // Check if JD falls within this day (from this sunrise to next sunrise)
          if (jd >= dayStartJD && jd < nextDayStartJD) {
            return {
              year: calendar.year,
              month: month.monthNumber,
              day: day.lunarDay
            };
          }
        }
      }
    }
    
    return null;
  } catch (err) {
    console.warn(`[TZ Guide] calcLunarDate failed:`, err.message);
    return null;
  }
}

/**
 * Compute timezone guide data async and update the DOM
 * Creates ISOLATED engine instances - each owns its own cache
 * Results are cached by JD to avoid redundant calculations
 */
function computeTimezoneGuideAsync(guideId, params) {
  const { timestamp, datelineLon, calendarData, profile, userLat, userLon, currentDay } = params;
  const debug = params.debug || false;
  
  // Convert timestamp to JD (the universal reference point)
  const jd = (timestamp / 86400000) + 2440587.5;
  
  // Calendar config from profile
  const config = {
    moonPhase: profile.moonPhase || 'full',
    dayStartTime: profile.dayStartTime || 'morning',
    dayStartAngle: profile.dayStartAngle ?? 12,
    yearStartRule: profile.yearStartRule || 'virgoFeet'
  };
  
  // Check cache first (skip cache in debug mode)
  let samples;
  const cached = !debug && tzGuideCache.get(jd, config);
  
  if (cached) {
    // Use cached samples
    samples = cached.samples;
  } else {
    // Calculate lunar date for each of the 24 timezones (15° each)
    // Pure functional: calcLunarDate(JD, location, config) for each location
    samples = [];
    const sampleLat = userLat || 35;  // Use user's latitude for accuracy
    
    // Calculate for each 15° timezone band (24 samples)
    for (let lon = -180; lon < 180; lon += 15) {
      const centerLon = lon + 7.5;
      const location = { lat: sampleLat, lon: centerLon };
      
      // Pure function call - completely independent for each location
      // Uses sunrise-based day boundaries for accurate biblical date at this JD
      const date = calcLunarDate(jd, location, config);
      
      samples.push({
        lon: lon,
        width: 15,
        date: date || currentDay  // Fallback to current day if calculation fails
      });
    }
    
    // Store in cache
    tzGuideCache.set(jd, config, { samples });
  }
  
  // Build the final HTML and update the DOM
  const html = buildTimezoneGuideHtml(samples, userLat, userLon, currentDay, calendarData);
  
  const guideEl = document.getElementById(guideId);
  if (guideEl) {
    guideEl.innerHTML = html;
  }
}

/**
 * Build the HTML content for the timezone guide bands
 */
function buildTimezoneGuideHtml(samples, userLat, userLon, currentDay, calendarData) {
  
  // Merge adjacent samples with same date
  const mergedBands = [];
  let currentBand = null;
  
  for (const sample of samples) {
    const label = `${sample.date.year}-${sample.date.month}-${sample.date.day}`;
    if (!currentBand || currentBand.label !== label) {
      if (currentBand) mergedBands.push(currentBand);
      currentBand = {
        lon: sample.lon,
        width: sample.width,
        endLon: sample.lon + sample.width,
        date: sample.date,
        label: label
      };
    } else {
      currentBand.endLon = sample.lon + sample.width;
      currentBand.width = currentBand.endLon - currentBand.lon;
    }
  }
  if (currentBand) mergedBands.push(currentBand);
  
  // Normalize user longitude
  let normUserLon = userLon;
  while (normUserLon > 180) normUserLon -= 360;
  while (normUserLon < -180) normUserLon += 360;
  
  // Check if we have year or month boundaries
  const hasYearBoundary = mergedBands.some((b, i) => 
    i > 0 && b.date.year !== mergedBands[i-1].date.year
  );
  const hasMonthBoundary = mergedBands.some((b, i) => 
    i > 0 && (b.date.year !== mergedBands[i-1].date.year || b.date.month !== mergedBands[i-1].date.month)
  );
  
  // Generate HTML for bands
  let bandsHtml = '';
  for (let i = 0; i < mergedBands.length; i++) {
    const band = mergedBands[i];
    const leftPct = ((band.lon + 180) / 360) * 100;
    const widthPct = (band.width / 360) * 100;
    const isUserBand = normUserLon >= band.lon && normUserLon < band.endLon;
    
    // Format label based on what boundaries exist
    let displayLabel;
    if (hasYearBoundary) {
      displayLabel = `Y${band.date.year} M${band.date.month} D${band.date.day}`;
    } else if (hasMonthBoundary) {
      displayLabel = `M${band.date.month} D${band.date.day}`;
    } else {
      displayLabel = `D${band.date.day}`;
    }
    
    const bandClass = isUserBand ? 'tz-band tz-band-user' : 'tz-band';
    const tooltip = `Year ${band.date.year}, Month ${band.date.month}, Day ${band.date.day}`;
    
    // Color coding: year (blue/green), month (hue shift), day (light/dark)
    const yearClass = `tz-year-${band.date.year % 2}`;
    const monthClass = `tz-month-${band.date.month % 2}`;
    const dayClass = `tz-day-${band.date.day % 2}`;
    
    bandsHtml += `
      <div class="${bandClass} ${yearClass} ${monthClass} ${dayClass}" 
           data-year="${band.date.year}" data-month="${band.date.month}" data-day="${band.date.day}"
           style="left: ${leftPct}%; width: ${widthPct}%;" title="${tooltip}">
        <span class="tz-band-label">${displayLabel}</span>
      </div>
    `;
  }
  
  // Add note about boundaries
  let boundaryNote = '';
  if (hasYearBoundary) {
    boundaryNote = `<div class="tz-guide-note">⚠️ Year boundary: different locations have different year starts</div>`;
  } else if (hasMonthBoundary) {
    boundaryNote = `<div class="tz-guide-note">Month boundary: day start affects which month each region is in</div>`;
  }
  
  return `
    <div class="tz-guide-label">Biblical Date by Region:</div>
    <div class="tz-bands-container">
      ${bandsHtml}
    </div>
    ${boundaryNote}
  `;
}

/**
 * Get the previous biblical day from the calendar
 * Handles month and year boundary crossings
 * @param {Object} currentDay - { month, day, year }
 * @param {Object} calendarData - { lunarMonths, year }
 * @returns {Object|null} { month, day, year } or null
 */
function getPreviousBiblicalDay(currentDay, calendarData) {
  if (!currentDay || !calendarData || !calendarData.lunarMonths) return null;
  
  const { month, day, year } = currentDay;
  const { lunarMonths } = calendarData;
  
  if (day > 1) {
    // Same month, previous day
    return { month, day: day - 1, year };
  }
  
  // Day 1 of a month - go to previous month's last day
  if (month > 1) {
    // Find previous month in current calendar
    const prevMonth = lunarMonths.find(m => m.monthNumber === month - 1);
    if (prevMonth && prevMonth.days && prevMonth.days.length > 0) {
      const lastDay = prevMonth.days[prevMonth.days.length - 1];
      return { month: month - 1, day: lastDay.lunarDay, year };
    }
    // Fallback if month not found (shouldn't happen)
    return { month: month - 1, day: 30, year };
  }
  
  // Month 1 Day 1 - this is the start of the year
  // Previous day is last day of last month of PREVIOUS year
  // We don't have the previous year's calendar loaded, so we estimate
  // Previous year likely has 12 or 13 months, last month has 29-30 days
  // For year boundary display, show previous year with Month 12 or 13
  const prevYearMonthCount = 12; // Could be 13, but we don't know without the calendar
  return { month: prevYearMonthCount, day: 30, year: year - 1 };
}

/**
 * Convenience function to render dateline visualization HTML
 * Used by calendar-view.js for displaying day details
 * All state is gathered and passed to child functions (stateless design)
 * 
 * @param {Date} moonEventDate - The moon event date (or current view time for non-Day-1)
 * @param {Object} options - Override options (lat, lon, viewTime, etc.)
 * @returns {string} HTML string of the dateline visualization
 */
function renderDatelineVisualization(moonEventDate, options = {}) {
  // Gather all required state upfront
  let currentLat, currentLon, moonPhase, dayStartTime, dayStartAngle, calendarData, calendarEngine, yearStartRule;
  
  // Get calendar engine (LunarCalendarEngine) for generating per-location calendars
  if (typeof AppStore !== 'undefined' && typeof AppStore.getEngine === 'function') {
    calendarEngine = AppStore.getEngine();
  }
  
  if (typeof AppStore !== 'undefined') {
    const appState = AppStore.getState();
    const derived = AppStore.getDerived();
    const profile = window.PROFILES?.[appState.context?.profileId] || {};
    currentLat = appState.context?.location?.lat ?? 31.7683;
    currentLon = appState.context?.location?.lon ?? 35.2137;
    moonPhase = profile.moonPhase || 'full';
    dayStartTime = profile.dayStartTime || 'morning';
    dayStartAngle = profile.dayStartAngle ?? 12;
    yearStartRule = profile.yearStartRule || 'equinox';
    calendarData = {
      lunarMonths: derived.lunarMonths,
      year: derived.year
    };
  } else if (typeof state !== 'undefined') {
    currentLat = state.lat ?? 31.7683;
    currentLon = state.lon ?? 35.2137;
    moonPhase = state.moonPhase || 'full';
    dayStartTime = state.dayStartTime || 'morning';
    dayStartAngle = state.dayStartAngle ?? 12;
    yearStartRule = state.yearStartRule || 'equinox';
    calendarData = {
      lunarMonths: state.lunarMonths || [],
      year: state.year
    };
  } else {
    // Defaults
    currentLat = 31.7683;
    currentLon = 35.2137;
    moonPhase = 'full';
    dayStartTime = 'morning';
    dayStartAngle = 12;
    yearStartRule = 'equinox';
    calendarData = null;
  }
  
  const lat = options.lat ?? currentLat;
  const lon = options.lon ?? currentLon;
  
  // Create the DatelineMap element (passing all state)
  const mapEl = DatelineMap.create({
    moonEventDate: moonEventDate,
    lat: lat,
    lon: lon,
    moonPhase: moonPhase,
    dayStartTime: dayStartTime,
    dayStartAngle: dayStartAngle,
    showHint: false,  // Don't show click hint in day detail view
    onLocationSelect: null  // No location selection in day detail view
  });
  
  // Calculate dateline longitude - this is where day start is occurring
  const datelineLon = DatelineMap.calculateDatelineLongitude(moonEventDate, moonPhase, dayStartAngle);
  
  // Get current day from options (passed from calendar-view.js)
  // or derive from AppStore derived state
  let currentDay = options.currentDay || null;
  if (!currentDay && calendarData && calendarData.lunarMonths) {
    // Try to get current day from derived state
    if (typeof AppStore !== 'undefined') {
      const derived = AppStore.getDerived();
      if (derived.currentMonthIndex !== undefined && derived.currentLunarDay !== undefined) {
        const month = calendarData.lunarMonths[derived.currentMonthIndex];
        if (month) {
          currentDay = {
            month: month.monthNumber,
            day: derived.currentLunarDay,
            year: calendarData.year
          };
        }
      }
    }
  }
  
  // If still no currentDay, create a fallback
  if (!currentDay && calendarData && calendarData.lunarMonths && calendarData.lunarMonths.length > 0) {
    const firstMonth = calendarData.lunarMonths[0];
    if (firstMonth && firstMonth.days && firstMonth.days.length > 0) {
      currentDay = {
        month: firstMonth.monthNumber,
        day: 1,
        year: calendarData.year
      };
    }
  }
  
  // Add timezone guide showing biblical dates across the globe
  // Pass all required state to the stateless function
  const tzGuideHtml = renderTimezoneGuide({
    timestamp: moonEventDate.getTime(),
    datelineLon: datelineLon,
    calendarData: calendarData,
    profile: { dayStartTime, dayStartAngle, moonPhase, yearStartRule },
    userLat: lat,
    userLon: lon,
    currentDay: currentDay,
    engine: calendarEngine  // LunarCalendarEngine for generating per-location calendars
  });
  
  // Append timezone guide to the map HTML
  const mapHtml = mapEl.outerHTML;
  if (tzGuideHtml) {
    // Find the last </div> which closes dateline-container and insert before it
    const lastDivIndex = mapHtml.lastIndexOf('</div>');
    if (lastDivIndex !== -1) {
      return mapHtml.slice(0, lastDivIndex) + tzGuideHtml + mapHtml.slice(lastDivIndex);
    }
  }
  
  return mapHtml;
}

// Make renderDatelineVisualization available globally
window.renderDatelineVisualization = renderDatelineVisualization;
window.getBiblicalDateForLocation = getBiblicalDateForLocation;
