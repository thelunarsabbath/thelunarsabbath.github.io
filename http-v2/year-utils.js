/**
 * Year Utilities - Standardized BC/AD year handling
 * 
 * CONVENTIONS:
 * - User-facing (UI, JSON, URLs): BC years are positive numbers with "BC" label
 *   e.g., "1446 BC", URL: "1446bc"
 * 
 * - Internal (astronomical year numbering): 
 *   Year 1 AD = 1
 *   Year 1 BC = 0
 *   Year 2 BC = -1
 *   Year N BC = 1 - N = -(N-1)
 * 
 * Examples:
 *   1446 BC (display) = -1445 (internal)
 *   1 BC (display) = 0 (internal)
 *   1 AD (display) = 1 (internal)
 *   2025 AD (display) = 2025 (internal)
 */

const YearUtils = {
  
  // ═══════════════════════════════════════════════════════════════════════
  // CONVERSION FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Convert display year to internal astronomical year
   * @param {number} displayYear - The year number (always positive)
   * @param {boolean} isBC - True if BC, false if AD
   * @returns {number} Internal astronomical year
   */
  toInternal(displayYear, isBC) {
    if (isBC) {
      // BC year N → internal 1 - N
      // 1446 BC → 1 - 1446 = -1445
      // 1 BC → 1 - 1 = 0
      return 1 - displayYear;
    }
    // AD year is same as internal
    return displayYear;
  },
  
  /**
   * Convert internal astronomical year to display year
   * @param {number} internalYear - Internal astronomical year
   * @returns {{ year: number, isBC: boolean }} Display year and era
   */
  toDisplay(internalYear) {
    if (internalYear <= 0) {
      // Internal Y (Y <= 0) → BC year = 1 - Y
      // -1445 → 1 - (-1445) = 1446 BC
      // 0 → 1 - 0 = 1 BC
      return { year: 1 - internalYear, isBC: true };
    }
    return { year: internalYear, isBC: false };
  },
  
  /**
   * Format internal year for display
   * @param {number} internalYear - Internal astronomical year
   * @returns {string} Formatted year string like "1446 BC" or "2025 AD"
   */
  format(internalYear) {
    const { year, isBC } = this.toDisplay(internalYear);
    return isBC ? `${year} BC` : `${year} AD`;
  },
  
  /**
   * Format internal year for URL
   * @param {number} internalYear - Internal astronomical year
   * @returns {string} URL-safe year like "1446bc" or "2025"
   */
  formatForURL(internalYear) {
    const { year, isBC } = this.toDisplay(internalYear);
    return isBC ? `${year}bc` : String(year);
  },
  
  /**
   * Parse year from URL
   * @param {string} urlYear - Year from URL like "1446bc" or "2025"
   * @returns {number} Internal astronomical year
   */
  parseFromURL(urlYear) {
    const upper = urlYear.toUpperCase();
    if (upper.endsWith('BC')) {
      const displayYear = parseInt(upper.replace('BC', ''));
      return this.toInternal(displayYear, true);
    }
    return parseInt(urlYear); // AD year
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // ARITHMETIC (operates on internal years)
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Add years to an internal year
   * @param {number} internalYear - Starting internal year
   * @param {number} delta - Years to add (positive = forward, negative = backward)
   * @returns {number} New internal year
   */
  addYears(internalYear, delta) {
    return internalYear + delta;
  },
  
  /**
   * Add years using display values (for UI operations)
   * Takes display year, adds delta, returns display result
   * @param {number} displayYear - Starting display year (positive)
   * @param {boolean} isBC - True if starting year is BC
   * @param {number} delta - Years to add (positive = forward in time)
   * @returns {{ year: number, isBC: boolean }} New display year
   */
  addYearsDisplay(displayYear, isBC, delta) {
    const internal = this.toInternal(displayYear, isBC);
    const newInternal = internal + delta;
    return this.toDisplay(newInternal);
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // DATA CONVERSION (for JSON loading)
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Convert a year from the legacy JSON format (negative = BC) to internal
   * Legacy format: -1446 means 1446 BC (simple negation, WRONG)
   * @param {number} legacyYear - Year from legacy JSON
   * @returns {number} Internal astronomical year
   */
  fromLegacyJSON(legacyYear) {
    if (legacyYear < 0) {
      // Legacy: -1446 = 1446 BC display
      // Convert: 1446 BC = -1445 internal
      const displayYear = Math.abs(legacyYear);
      return this.toInternal(displayYear, true);
    }
    return legacyYear;
  },
  
  /**
   * Convert internal year to legacy JSON format
   * @param {number} internalYear - Internal astronomical year
   * @returns {number} Legacy format year
   */
  toLegacyJSON(internalYear) {
    const { year, isBC } = this.toDisplay(internalYear);
    return isBC ? -year : year;
  }
};

// Export for module systems and make globally available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YearUtils;
}
window.YearUtils = YearUtils;
