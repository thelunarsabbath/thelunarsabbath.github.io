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

// Preload the map image immediately to prevent blur on re-render
const _mapImagePreload = new Image();
_mapImagePreload.src = '/assets/img/earth.png';

const DatelineMap = {
  // Earth map image path
  IMAGE_PATH: '/assets/img/earth.png',
  
  // Cached preloaded image
  _preloadedImage: _mapImagePreload,
  
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
    
    // Calculate dateline position - where the day-start event is occurring right now
    const datelineLon = this.calculateDatelineLongitude(moonEventDate, moonPhase, Math.abs(dayStartAngle), dayStartTime, lat);
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
    
    // Calculate sun and moon positions for map overlay using astronomy engine
    const sunMoonPos = this.calculateSunMoonPositions(moonEventDate);
    const sunX = ((sunMoonPos.sunLon + 180) / 360) * 100;
    const sunY = ((90 - sunMoonPos.sunLat) / 180) * 100;
    const moonX = ((sunMoonPos.moonLon + 180) / 360) * 100;
    const moonY = ((90 - sunMoonPos.moonLat) / 180) * 100;
    // Use actual phase based on day of month, not just the month start phase
    const moonEmoji = this.getMoonPhaseEmoji(sunMoonPos.actualPhase);
    
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
        <div class="celestial-marker sun-marker" style="left: ${sunX}%; top: ${sunY}%;" title="Sub-solar point (solar noon)">☀️</div>
        <div class="celestial-marker moon-marker" style="left: ${moonX}%; top: ${moonY}%;" title="Moon position">${moonEmoji}</div>
      </div>
      <div class="dateline-cities">
        <span>180°W</span>
        <span>90°W</span>
        <span>0°</span>
        <span>90°E</span>
        <span>180°E</span>
      </div>
      ${this.renderDayNightBar(moonEventDate, lat, moonPhase)}
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
   * Calculate the dateline longitude for the given moment
   * This finds the longitude where the day-start event (sunrise/dawn) is occurring RIGHT NOW
   * Uses actual astronomy calculations for accuracy
   * 
   * @param {Date} currentTime - The current time (not moon event, but NOW)
   * @param {string} moonPhase - Not used, kept for API compatibility
   * @param {number} dayStartAngle - Degrees below horizon (0=sunrise, 12=nautical dawn)
   * @param {string} dayStartTime - 'morning' or 'evening'
   * @param {number} lat - Reference latitude for calculations
   */
  calculateDatelineLongitude(currentTime, moonPhase, dayStartAngle = 12, dayStartTime = 'morning', lat = 35) {
    // Use the astronomy engine to find where the day-start event is occurring right now
    const engine = typeof getAstroEngine === 'function' ? getAstroEngine() : null;
    
    if (!engine || !engine.getEquator || !engine.getHorizon) {
      // Fallback to simple calculation if engine not available
      return this._calculateDatelineLongitudeFallback(currentTime, dayStartAngle, dayStartTime);
    }
    
    // Target altitude: negative for below horizon (dawn), 0 for sunrise
    const targetAltitude = -dayStartAngle;
    
    // Start with the approximate calculation
    const approxLon = this._calculateDatelineLongitudeFallback(currentTime, dayStartAngle, dayStartTime);
    
    // Binary search to find the longitude where sun altitude matches target
    // The sun's altitude at any moment depends on longitude (local hour angle)
    let bestLon = approxLon;
    let bestDiff = Infinity;
    
    // Helper to get sun altitude at a longitude
    const getSunAltitude = (lon) => {
      try {
        const observer = engine.createObserver(lat, lon, 0);
        const sunEquator = engine.getEquator('sun', currentTime, observer);
        if (!sunEquator) return null;
        const horizon = engine.getHorizon(currentTime, observer, sunEquator.ra, sunEquator.dec);
        return horizon ? horizon.altitude : null;
      } catch (e) {
        return null;
      }
    };
    
    // For morning, we want where sun is RISING through target altitude
    // For evening, we want where sun is SETTING through target altitude
    // The rising side is to the EAST of the setting side
    
    // Coarse search: 5° increments around approximate position
    for (let offset = -45; offset <= 45; offset += 5) {
      let testLon = approxLon + offset;
      while (testLon > 180) testLon -= 360;
      while (testLon < -180) testLon += 360;
      
      const alt = getSunAltitude(testLon);
      if (alt !== null) {
        const diff = Math.abs(alt - targetAltitude);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestLon = testLon;
        }
      }
    }
    
    // Fine search: 1° increments around best position
    if (bestDiff < 15) {
      const coarseBest = bestLon;
      for (let offset = -6; offset <= 6; offset += 1) {
        let testLon = coarseBest + offset;
        while (testLon > 180) testLon -= 360;
        while (testLon < -180) testLon += 360;
        
        const alt = getSunAltitude(testLon);
        if (alt !== null) {
          const diff = Math.abs(alt - targetAltitude);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestLon = testLon;
          }
        }
      }
    }
    
    // Very fine search: 0.25° increments
    if (bestDiff < 5) {
      const fineBest = bestLon;
      for (let offset = -1.5; offset <= 1.5; offset += 0.25) {
        let testLon = fineBest + offset;
        while (testLon > 180) testLon -= 360;
        while (testLon < -180) testLon += 360;
        
        const alt = getSunAltitude(testLon);
        if (alt !== null) {
          const diff = Math.abs(alt - targetAltitude);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestLon = testLon;
          }
        }
      }
    }
    
    // If we didn't find a good match, return the fallback
    if (bestDiff > 10) {
      return approxLon;
    }
    
    return bestLon;
  },
  
  /**
   * Fallback dateline calculation when astronomy engine not available
   * Uses simple approximation: 15° per hour, sunrise ~6h before noon
   */
  _calculateDatelineLongitudeFallback(currentTime, dayStartAngle, dayStartTime = 'morning') {
    const utcHours = currentTime.getUTCHours() + currentTime.getUTCMinutes() / 60 + 
                     currentTime.getUTCSeconds() / 3600;
    
    // At 12:00 UTC, the sun is directly over 0° longitude (solar noon)
    // sunNoonLon = longitude where it's currently solar noon
    const sunNoonLon = -((utcHours - 12) * 15);
    
    let datelineLon;
    
    if (dayStartTime === 'morning') {
      // Sunrise occurs ~6 hours before noon = 90° to the WEST of solar noon
      const sunriseLon = sunNoonLon - 90;
      
      // Dawn offset: each degree below horizon ≈ 4 min ≈ 1° longitude further west
      const dawnOffset = Math.abs(dayStartAngle);
      datelineLon = sunriseLon - dawnOffset;
    } else {
      // Sunset occurs ~6 hours after noon = 90° to the EAST of solar noon
      const sunsetLon = sunNoonLon + 90;
      
      // Twilight offset: further east for later twilight angles
      const twilightOffset = Math.abs(dayStartAngle);
      datelineLon = sunsetLon + twilightOffset;
    }
    
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
   * Render a day/night bar showing global illumination
   * Shows smooth gradient from day to night based on sun position
   * Sun icon marks sub-solar point, Moon icon marks sub-lunar point with current phase
   * @param {Date} currentTime - The current time to visualize
   * @param {number} lat - Reference latitude
   * @param {string} moonPhase - Current moon phase for icon ('full', 'dark', 'crescent', etc.)
   * @returns {string} HTML for the day/night bar
   */
  renderDayNightBar(currentTime, lat = 0, moonPhase = 'full') {
    // Calculate sub-solar longitude (where sun is directly overhead)
    const utcHours = currentTime.getUTCHours() + currentTime.getUTCMinutes() / 60 + 
                     currentTime.getUTCSeconds() / 3600;
    
    // At 12:00 UTC, sub-solar point is at 0° longitude
    // Sub-solar point moves westward at 15°/hour as Earth rotates
    let subSolarLon = (12 - utcHours) * 15;
    // Normalize to -180 to 180
    while (subSolarLon > 180) subSolarLon -= 360;
    while (subSolarLon < -180) subSolarLon += 360;
    
    // Convert longitude to bar percentage (0% = -180°, 100% = +180°)
    const lonToPct = (lon) => {
      let normLon = lon;
      while (normLon > 180) normLon -= 360;
      while (normLon < -180) normLon += 360;
      return ((normLon + 180) / 360) * 100;
    };
    
    // Calculate angular distance from sub-solar point (0-180)
    const getAngularDist = (lon) => {
      let diff = lon - subSolarLon;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      return Math.abs(diff);
    };
    
    // Build gradient: day in center of sun, night opposite
    // Sample every 2° for smooth gradient
    const stops = [];
    for (let lon = -180; lon <= 180; lon += 2) {
      const pct = lonToPct(lon);
      const dist = getAngularDist(lon);
      
      // Brightness based on distance from sub-solar point
      // 0° = directly under sun (full day)
      // 90° = sunset/sunrise (horizon)
      // 108° = end of astronomical twilight
      // 180° = midnight (full night)
      let brightness;
      if (dist <= 90) {
        // Daytime: smooth cosine falloff from 1.0 to 0.3
        brightness = 0.3 + 0.7 * Math.cos(dist * Math.PI / 180);
      } else if (dist <= 108) {
        // Twilight: 0.3 down to 0
        const twilightProg = (dist - 90) / 18;
        brightness = 0.3 * (1 - twilightProg);
      } else {
        // Night
        brightness = 0;
      }
      
      // Interpolate between night color and day color
      const nightR = 10, nightG = 22, nightB = 40;   // #0a1628
      const dayR = 135, dayG = 206, dayB = 235;      // #87CEEB
      
      const r = Math.round(nightR + (dayR - nightR) * brightness);
      const g = Math.round(nightG + (dayG - nightG) * brightness);
      const b = Math.round(nightB + (dayB - nightB) * brightness);
      
      stops.push(`rgb(${r},${g},${b}) ${pct.toFixed(1)}%`);
    }
    
    const gradient = `linear-gradient(to right, ${stops.join(', ')})`;
    
    return `
      <div class="day-night-bar" style="background: ${gradient};" title="Day/night illumination by longitude"></div>
    `;
  },
  
  /**
   * Calculate sun and moon positions on the map using astronomy engine
   * @param {Date} currentTime - Current time
   * @returns {{ sunLon, sunLat, moonLon, moonLat, actualPhase }}
   */
  calculateSunMoonPositions(currentTime) {
    const utcHours = currentTime.getUTCHours() + currentTime.getUTCMinutes() / 60 + 
                     currentTime.getUTCSeconds() / 3600;
    
    // Get astronomy engine
    const engine = typeof getAstroEngine === 'function' ? getAstroEngine() : null;
    const observer = engine?.createObserver?.(0, 0, 0); // Observer at 0,0 for geocentric view
    
    // Sub-solar point: convert sun's RA to longitude
    // At any moment, the sub-solar longitude is where local solar noon is occurring
    // This is simply: longitude = (12 - UTC_hours) * 15
    let sunLon = (12 - utcHours) * 15;
    while (sunLon > 180) sunLon -= 360;
    while (sunLon < -180) sunLon += 360;
    
    // Sun's latitude = declination
    let sunLat = 0;
    if (engine && observer) {
      const sunPos = engine.getEquator('sun', currentTime, observer);
      if (sunPos) {
        sunLat = sunPos.dec || 0;
      }
    } else {
      // Fallback: approximate using day of year
      const dayOfYear = Math.floor((currentTime - new Date(currentTime.getUTCFullYear(), 0, 0)) / 86400000);
      sunLat = 23.44 * Math.sin((dayOfYear - 80) * 2 * Math.PI / 365);
    }
    
    // Moon position from astronomy engine
    let moonLon = sunLon; // Default to sun position
    let moonLat = 0;
    let moonLonOffset = 0;
    
    if (engine && observer) {
      const moonPos = engine.getEquator('moon', currentTime, observer);
      if (moonPos) {
        // Moon's RA (in hours) tells us its position relative to the sun
        // Convert RA to longitude: subtract current sidereal time
        // Simplified: moon longitude = sun longitude + (moon_RA - sun_RA) * 15
        const sunPos = engine.getEquator('sun', currentTime, observer);
        if (sunPos) {
          // RA difference in hours, convert to degrees
          const raDiff = (moonPos.ra - sunPos.ra) * 15;
          moonLon = sunLon + raDiff;
          while (moonLon > 180) moonLon -= 360;
          while (moonLon < -180) moonLon += 360;
          
          moonLat = moonPos.dec || 0;
          
          // Calculate moon phase from elongation (angle from sun)
          moonLonOffset = raDiff;
          while (moonLonOffset < 0) moonLonOffset += 360;
          while (moonLonOffset >= 360) moonLonOffset -= 360;
        }
      }
    }
    
    // Determine actual phase name for emoji display based on elongation
    let actualPhase;
    if (moonLonOffset < 22.5 || moonLonOffset >= 337.5) {
      actualPhase = 'new';
    } else if (moonLonOffset < 67.5) {
      actualPhase = 'waxing_crescent';
    } else if (moonLonOffset < 112.5) {
      actualPhase = 'first_quarter';
    } else if (moonLonOffset < 157.5) {
      actualPhase = 'waxing_gibbous';
    } else if (moonLonOffset < 202.5) {
      actualPhase = 'full';
    } else if (moonLonOffset < 247.5) {
      actualPhase = 'waning_gibbous';
    } else if (moonLonOffset < 292.5) {
      actualPhase = 'last_quarter';
    } else {
      actualPhase = 'waning_crescent';
    }
    
    return { sunLon, sunLat, moonLon, moonLat: Math.max(-60, Math.min(60, moonLat)), actualPhase };
  },
  
  /**
   * Get moon phase emoji
   */
  getMoonPhaseEmoji(moonPhase) {
    switch (moonPhase) {
      case 'new':
      case 'dark':
        return '🌑';
      case 'crescent':
      case 'waxing_crescent':
        return '🌒';
      case 'first_quarter':
        return '🌓';
      case 'waxing_gibbous':
        return '🌔';
      case 'full':
        return '🌕';
      case 'waning_gibbous':
        return '🌖';
      case 'last_quarter':
        return '🌗';
      case 'waning_crescent':
      case 'waning':
        return '🌘';
      default:
        return '🌙';
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
// Key: JD rounded to 4 decimal places (~8.6 seconds precision) + dateline position
// Value: { samples, html, config }
const tzGuideCache = {
  data: new Map(),
  maxSize: 50,  // Keep last 50 calculations
  
  getKey(jd, config, datelineLonKey = '') {
    // Round JD to 4 decimals and include config hash and dateline position
    const jdKey = jd.toFixed(4);
    const configKey = `${config.moonPhase}-${config.dayStartTime}-${config.dayStartAngle}-${config.yearStartRule}`;
    return `${jdKey}:${configKey}:${datelineLonKey}`;
  },
  
  get(jd, config, datelineLonKey = '') {
    return this.data.get(this.getKey(jd, config, datelineLonKey));
  },
  
  set(jd, config, value, datelineLonKey = '') {
    const key = this.getKey(jd, config, datelineLonKey);
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

// Expose cache for debugging/clearing
window.tzGuideCache = tzGuideCache;

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
  
  // Wait for image to load before starting calculations
  // This prevents blur during the calculation phase
  requestAnimationFrame(() => {
    const guideEl = document.getElementById(guideId);
    if (!guideEl) return;
    
    // Find the map image in the same container
    const container = guideEl.closest('.dateline-container');
    const mapImg = container?.querySelector('.dateline-map-bg img');
    
    if (mapImg && !mapImg.complete) {
      // Image not loaded yet - wait for it
      mapImg.onload = () => {
        // Small delay to ensure paint is complete
        requestAnimationFrame(() => {
          computeTimezoneGuideAsync(guideId, params);
        });
      };
      // Fallback in case onload doesn't fire (image already cached)
      setTimeout(() => {
        if (document.getElementById(guideId)?.querySelector('.tz-band-loading')) {
          computeTimezoneGuideAsync(guideId, params);
        }
      }, 100);
    } else {
      // Image already loaded or no image found - compute immediately
      computeTimezoneGuideAsync(guideId, params);
    }
  });
  
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

// Shared calendar engine for timezone calculations (reuses calendar cache)
let _sharedTzEngine = null;
let _sharedTzEngineConfig = null;

function getSharedTzEngine(config) {
  const configKey = JSON.stringify(config);
  
  // Reuse existing engine if config matches
  if (_sharedTzEngine && _sharedTzEngineConfig === configKey) {
    return _sharedTzEngine;
  }
  
  // Create new engine with this config
  const astroEngine = typeof getAstroEngine === 'function' ? getAstroEngine() : null;
  if (!astroEngine) return null;
  
  _sharedTzEngine = new LunarCalendarEngine(astroEngine);
  _sharedTzEngine.configure(config);
  _sharedTzEngineConfig = configKey;
  
  return _sharedTzEngine;
}

/**
 * Calculate lunar date for a JD at a specific longitude
 * 
 * Simple approach: use the passed-in currentDay as the base,
 * then adjust ±1 based on whether first light has occurred at this longitude.
 * 
 * @param {number} jd - Julian Day (current moment)
 * @param {Object} location - { lat, lon } for day boundary calculation
 * @param {Object} config - Calendar config (moonPhase, dayStartTime, etc.)
 * @param {Object} currentDay - The user's current biblical day { year, month, day }
 * @param {number} userLon - The user's longitude (reference point)
 * @returns {{ year, month, day } | null}
 */
function calcLunarDate(jd, location, config, currentDay, userLon) {
  if (!currentDay) return null;
  
  // Calculate how many hours offset this longitude is from the user's longitude
  // Earth rotates 360° in 24 hours = 15° per hour
  // East = earlier sunrise, West = later sunrise
  const lonDiff = location.lon - (userLon || 0);
  const hoursOffset = lonDiff / 15; // Hours difference in local solar time
  
  // Convert JD to local solar time at both locations
  const timestamp = (jd - 2440587.5) * 86400000;
  const utcDate = new Date(timestamp);
  const utcHours = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60;
  
  // Local solar time at target location (approximate)
  const targetLocalHours = (utcHours + location.lon / 15 + 24) % 24;
  
  // Local solar time at user location
  const userLocalHours = (utcHours + (userLon || 0) / 15 + 24) % 24;
  
  // Day boundary time (first light) - approximate as hours after midnight
  // For morning start with dayStartAngle, first light is before sunrise
  // Sunrise is ~6 AM local solar time, first light is earlier
  const firstLightHour = 6 - (config.dayStartAngle || 12) / 15; // ~5 AM for nautical dawn
  
  // Determine if each location has crossed first light
  const targetPastFirstLight = targetLocalHours >= firstLightHour;
  const userPastFirstLight = userLocalHours >= firstLightHour;
  
  // If user is past first light but target isn't, target is one day behind
  // If target is past first light but user isn't, target is one day ahead
  let dayOffset = 0;
  if (userPastFirstLight && !targetPastFirstLight) {
    dayOffset = -1; // Target is still on previous day
  } else if (!userPastFirstLight && targetPastFirstLight) {
    dayOffset = 1; // Target is already on next day
  }
  
  // Apply the offset to the current day
  if (dayOffset === 0) {
    return { ...currentDay };
  }
  
  // Simple day offset (doesn't handle month boundaries perfectly, but good enough for display)
  let newDay = currentDay.day + dayOffset;
  let newMonth = currentDay.month;
  let newYear = currentDay.year;
  
  if (newDay < 1) {
    newMonth--;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    newDay = 30; // Approximate - some months have 29 days
  } else if (newDay > 30) {
    newMonth++;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    newDay = 1;
  }
  
  return { year: newYear, month: newMonth, day: newDay };
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
  
  // Use user's latitude for astronomy calculations
  const sampleLat = userLat || 35;
  
  // TEMPORARILY DISABLE CACHE for debugging
  // Check cache first (skip cache in debug mode)
  // Key by JD and config only - bands are at fixed intervals now
  let samples;
  const cached = !debug && tzGuideCache.get(jd, config, '');
  
  if (cached) {
    // Use cached samples
    samples = cached.samples;
  } else {
    // Calculate lunar date for each of the 24 timezones (15° each)
    // Sample at FIXED intervals from -180° to +180° for accurate transition detection
    samples = [];
    
    // Calculate for each 15° timezone band at fixed intervals
    for (let i = 0; i < 24; i++) {
      // Band starts at -180° + (i * 15°)
      const bandStart = -180 + (i * 15);
      const centerLon = bandStart + 7.5;
      
      const location = { lat: sampleLat, lon: centerLon };
      
      // Calculate the biblical date at this longitude
      // Uses the user's currentDay as reference, adjusts based on first light
      const date = calcLunarDate(jd, location, config, currentDay, userLon);
      
      samples.push({
        lon: bandStart,
        width: 15,
        date: date || currentDay  // Fallback to current day if calculation fails
      });
    }
    
    // Store in cache
    tzGuideCache.set(jd, config, { samples }, '');
  }
  
  // Find actual day transitions from samples
  // This gives us the real longitude where the date changes
  const transitions = findDateTransitions(samples, jd, sampleLat, config, currentDay, userLon);
  
  // Build the final HTML and update the DOM
  const html = buildTimezoneGuideHtml(samples, userLat, userLon, currentDay, calendarData, transitions);
  
  const guideEl = document.getElementById(guideId);
  if (guideEl) {
    guideEl.innerHTML = html;
    // Note: We do NOT update the map line position here.
    // The map line shows where daybreak IS happening right now (real-time sun position).
    // The bands show what date each region is experiencing (based on whether day-start occurred).
    // These are calculated independently - if they align, our logic is validated.
  }
}

/**
 * Find longitude positions where the date transitions
 * Uses binary search to refine the exact transition point
 * @param {Array} samples - Array of { lon, width, date } objects
 * @param {number} jd - Julian Day for calculations
 * @param {number} lat - Latitude for calculations
 * @param {Object} config - Calendar config
 * @param {Object} currentDay - The user's current biblical day
 * @param {number} userLon - The user's longitude
 * @returns {Array} Array of { lon, fromDate, toDate } transition points
 */
function findDateTransitions(samples, jd, lat, config, currentDay, userLon) {
  const transitions = [];
  
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    // Previous sample (wrap around)
    const prevSample = samples[(i - 1 + samples.length) % samples.length];
    
    // Check if date changed
    if (sample.date.day !== prevSample.date.day ||
        sample.date.month !== prevSample.date.month ||
        sample.date.year !== prevSample.date.year) {
      
      // Refine the transition point with binary search
      // The transition is somewhere between prevSample center and sample center
      const prevCenter = prevSample.lon + prevSample.width / 2;
      const currCenter = sample.lon + sample.width / 2;
      
      // Handle wraparound at ±180°
      let searchStart = prevCenter;
      let searchEnd = currCenter;
      if (searchEnd < searchStart) {
        searchEnd += 360; // Handle wraparound
      }
      
      // Binary search to find exact transition point (to ~1° precision)
      let refinedLon = sample.lon; // Default to band boundary
      for (let iter = 0; iter < 5; iter++) { // 5 iterations = ~0.5° precision
        const midLon = (searchStart + searchEnd) / 2;
        let normMidLon = midLon;
        while (normMidLon > 180) normMidLon -= 360;
        while (normMidLon < -180) normMidLon += 360;
        
        const midDate = calcLunarDate(jd, { lat, lon: normMidLon }, config, currentDay, userLon);
        
        if (midDate && midDate.day === prevSample.date.day && 
            midDate.month === prevSample.date.month && 
            midDate.year === prevSample.date.year) {
          // Mid point is still on old date, transition is after mid
          searchStart = midLon;
        } else {
          // Mid point is on new date, transition is before mid
          searchEnd = midLon;
        }
        
        refinedLon = (searchStart + searchEnd) / 2;
      }
      
      // Normalize the refined longitude
      while (refinedLon > 180) refinedLon -= 360;
      while (refinedLon < -180) refinedLon += 360;
      
      transitions.push({
        lon: refinedLon,
        fromDate: prevSample.date,
        toDate: sample.date
      });
    }
  }
  
  return transitions;
}


/**
 * Build the HTML content for the timezone guide bands
 * @param {Array} samples - Array of { lon, width, date } objects
 * @param {number} userLat - User's latitude
 * @param {number} userLon - User's longitude
 * @param {Object} currentDay - Current day { year, month, day }
 * @param {Object} calendarData - Calendar data
 * @param {Array} transitions - Array of { lon, fromDate, toDate } transition points
 */
function buildTimezoneGuideHtml(samples, userLat, userLon, currentDay, calendarData, transitions = []) {
  
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
  
  // Draw transition markers at the actual day boundaries
  // These are computed from real astronomy data
  let transitionMarkersHtml = '';
  for (const transition of transitions) {
    const transitionPct = ((transition.lon + 180) / 360) * 100;
    const transitionLabel = `${transition.fromDate.day}→${transition.toDate.day}`;
    transitionMarkersHtml += `
      <div class="tz-dateline-marker" style="left: ${transitionPct}%;" title="Day boundary: ${transitionLabel}"></div>
    `;
  }
  
  return `
    <div class="tz-guide-label">Biblical Date by Region:</div>
    <div class="tz-bands-container">
      ${bandsHtml}
      ${transitionMarkersHtml}
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
  
  // Get current day from options (passed from calendar-view.js)
  // or derive from AppStore derived state - needed for moon position calculation
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
  
  // Calculate dateline longitude - this is where day start is occurring right now
  const datelineLon = DatelineMap.calculateDatelineLongitude(moonEventDate, moonPhase, Math.abs(dayStartAngle), dayStartTime, lat);
  
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
