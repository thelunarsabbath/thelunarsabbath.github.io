/**
 * Timezone Utilities
 * 
 * Uses tz-lookup library for accurate offline timezone lookup from GPS coordinates.
 * Falls back to solar time if library not available.
 */

const TimezoneUtils = {
  
  /**
   * Get IANA timezone name from coordinates using tz-lookup
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {string|null} IANA timezone name or null
   */
  getTimezoneFromCoords(lat, lon) {
    // Use tz-lookup library if available
    if (typeof tzlookup === 'function') {
      try {
        return tzlookup(lat, lon);
      } catch (e) {
        console.warn('[Timezone] tz-lookup failed:', e);
      }
    }
    return null;
  },
  
  /**
   * Get current date/time at a specific location
   * Uses IANA timezone if available, falls back to solar time
   * @param {Object} location - { lat, lon }
   * @returns {Object} { year, month, day, hours, minutes, timezone, method }
   */
  getLocalTimeAtLocation(location) {
    const now = new Date();
    const lat = location?.lat || 0;
    const lon = location?.lon || 0;
    
    // Try to get IANA timezone using tz-lookup
    const ianaTimezone = this.getTimezoneFromCoords(lat, lon);
    
    if (ianaTimezone) {
      try {
        // Use Intl API to get proper local time in that timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: ianaTimezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        
        const parts = formatter.formatToParts(now);
        const getPart = (type) => {
          const part = parts.find(p => p.type === type);
          return part ? parseInt(part.value, 10) : 0;
        };
        
        return {
          year: getPart('year'),
          month: getPart('month'),
          day: getPart('day'),
          hours: getPart('hour'),
          minutes: getPart('minute'),
          timezone: ianaTimezone,
          method: 'iana'
        };
      } catch (e) {
        console.warn('[Timezone] Failed to use IANA timezone:', ianaTimezone, e);
      }
    }
    
    // Fallback to solar time based on longitude
    return this.getSolarTimeAtLocation(location);
  },
  
  /**
   * Get solar time at a location (based on longitude only)
   * @param {Object} location - { lat, lon }
   * @returns {Object} { year, month, day, hours, minutes, timezone, method }
   */
  getSolarTimeAtLocation(location) {
    const now = new Date();
    const lon = location?.lon || 0;
    
    // Solar time offset: 1 hour per 15 degrees of longitude
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const lonOffsetHours = lon / 15;
    
    // Calculate total minutes from midnight UTC
    const utcTotalMinutes = utcHours * 60 + utcMinutes;
    let localTotalMinutes = utcTotalMinutes + Math.round(lonOffsetHours * 60);
    
    // Calculate day offset and normalize
    let dayOffset = 0;
    if (localTotalMinutes >= 1440) {
      localTotalMinutes -= 1440;
      dayOffset = 1;
    } else if (localTotalMinutes < 0) {
      localTotalMinutes += 1440;
      dayOffset = -1;
    }
    
    const hours = Math.floor(localTotalMinutes / 60);
    const minutes = localTotalMinutes % 60;
    
    // Get the date accounting for day offset
    const utcDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + dayOffset
    ));
    
    // Format timezone offset string
    const offsetSign = lon >= 0 ? '+' : '';
    const offsetHours = Math.round(lonOffsetHours);
    const tzString = `UTC${offsetSign}${offsetHours} (solar)`;
    
    return {
      year: utcDate.getUTCFullYear(),
      month: utcDate.getUTCMonth() + 1,
      day: utcDate.getUTCDate(),
      hours: hours,
      minutes: minutes,
      timezone: tzString,
      method: 'solar'
    };
  },
  
  /**
   * Format timezone for display
   * @param {string} timezone - IANA timezone or solar offset
   * @returns {string} Human-readable timezone
   */
  formatTimezone(timezone) {
    if (!timezone) return '';
    
    // If it's an IANA timezone, extract the city name
    if (timezone.includes('/')) {
      const city = timezone.split('/').pop().replace(/_/g, ' ');
      return city;
    }
    
    return timezone;
  }
};

// Make available globally
window.TimezoneUtils = TimezoneUtils;
