/**
 * WorldMap Component
 * A reusable clickable world map for location selection
 * 
 * Usage:
 *   const map = WorldMap.create({
 *     lat: 31.77,
 *     lon: 35.21,
 *     onLocationSelect: (lat, lon, citySlug) => { ... }
 *   });
 *   container.appendChild(map);
 */

const WorldMap = {
  // Earth map image path
  IMAGE_PATH: '/assets/img/earth.png',
  
  /**
   * Create a world map element
   * @param {Object} options
   * @param {number} options.lat - Current latitude
   * @param {number} options.lon - Current longitude
   * @param {Function} options.onLocationSelect - Callback(lat, lon, citySlug) when location selected
   * @param {boolean} options.showHint - Show "click to select" hint (default true)
   * @returns {HTMLElement} The map container element
   */
  create(options = {}) {
    const { 
      lat = 31.77, 
      lon = 35.21, 
      onLocationSelect = null,
      showHint = true 
    } = options;
    
    // Calculate marker position
    const markerX = ((lon + 180) / 360) * 100;
    const markerY = ((90 - lat) / 180) * 100;
    
    // Create container
    const container = document.createElement('div');
    container.className = 'world-map-container';
    
    container.innerHTML = `
      <div class="world-map">
        <img src="${this.IMAGE_PATH}" alt="World Map" draggable="false">
        <div class="world-map-marker" style="left: ${markerX}%; top: ${markerY}%">📍</div>
      </div>
      ${showHint ? '<div class="world-map-hint">Click map to select location</div>' : ''}
    `;
    
    // Add click handler
    const mapEl = container.querySelector('.world-map');
    if (mapEl && onLocationSelect) {
      mapEl.addEventListener('click', (e) => {
        const result = this.handleClick(e, mapEl);
        if (result) {
          onLocationSelect(result.lat, result.lon, result.citySlug);
        }
      });
    }
    
    return container;
  },
  
  /**
   * Handle map click - convert to lat/lon and find nearest city
   * @param {MouseEvent} e - Click event
   * @param {HTMLElement} mapEl - The map element
   * @returns {Object|null} { lat, lon, citySlug } or null
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
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {string|null} City slug or null
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
   * Update marker position on an existing map
   * @param {HTMLElement} container - The map container
   * @param {number} lat - New latitude
   * @param {number} lon - New longitude
   */
  updateMarker(container, lat, lon) {
    const marker = container.querySelector('.world-map-marker');
    if (marker) {
      const markerX = ((lon + 180) / 360) * 100;
      const markerY = ((90 - lat) / 180) * 100;
      marker.style.left = markerX + '%';
      marker.style.top = markerY + '%';
    }
  },
  
  /**
   * Format coordinates for display
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {string} Formatted string like "31.77°N, 35.21°E"
   */
  formatCoords(lat, lon) {
    const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
    const lonStr = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
    return `${latStr}, ${lonStr}`;
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorldMap;
}

// Make available globally
window.WorldMap = WorldMap;
