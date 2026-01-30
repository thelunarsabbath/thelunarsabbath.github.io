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
          <img src="${this.IMAGE_PATH}" alt="World Map" draggable="false">
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
   */
  calculateDatelineLongitude(moonEventDate, moonPhase, dayStartAngle = -12) {
    // Simplified calculation - the actual logic depends on the profile settings
    // This places the day start line based on when the sun reaches the specified angle
    const utcHours = moonEventDate.getUTCHours() + moonEventDate.getUTCMinutes() / 60;
    
    // At 12:00 UTC, the sun is at 0° longitude
    // For each hour before/after, the sun moves 15° west/east
    const sunLon = -((utcHours - 12) * 15);
    
    // The day start line is where the sun angle equals dayStartAngle
    // For morning (nautical dawn at -12°), this is roughly 90° west of the sun
    // This is a simplified approximation
    const offset = dayStartAngle < 0 ? -90 : 0;  // dawn is ~6 hours before noon
    
    let datelineLon = sunLon + offset;
    
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
