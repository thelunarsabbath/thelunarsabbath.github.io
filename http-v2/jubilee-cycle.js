// Jubilee and Sabbath Cycle Calculations
// Based on the cycle starting Spring 1406 BC at the Jordan River Crossing

// Reference point: Spring 1406 BC = astronomical year -1405
// This is Jubilee 51, Week 1, Year 1 (also the Jubilee year of the 50th Jubilee since Adam)
const JUBILEE_REFERENCE_YEAR = -1405;
const JUBILEE_REFERENCE_NUMBER = 51;

// Jubilee cycle is 49 years long
// Year 50 of one jubilee = Year 1 of the next jubilee (both are Jubilee years)
const JUBILEE_CYCLE_LENGTH = 49;
const SABBATH_CYCLE_LENGTH = 7;

/**
 * Calculate Jubilee cycle information for a given Gregorian year
 * 
 * The cycle works as follows:
 * - Every 7th year is a Sabbath Year (Year of Release)
 * - The 50th year is a Jubilee Year, which is also the 1st year of the next cycle
 * - No planting from fall of 6th year to fall of 7th year
 * - If 7th year is also 49th year, prohibition extends to fall of 50th year
 * 
 * Events are dated: Jubilee X, Week Y, Year Z
 * Example: Jordan crossing (1406 BC) = Jubilee 51, Week 1, Year 1
 * 
 * @param {number} gregorianYear - The Gregorian year (negative for BC, e.g., -1405 = 1406 BC)
 * @returns {Object} Jubilee cycle information
 */
function getJubileeInfo(gregorianYear) {
  // Calculate years since reference (can be negative for earlier years)
  const yearsSinceReference = gregorianYear - JUBILEE_REFERENCE_YEAR;
  
  // Calculate jubilee offset and year within jubilee
  let jubileeOffset, yearInJubilee;
  
  if (yearsSinceReference >= 0) {
    // Forward from reference
    jubileeOffset = Math.floor(yearsSinceReference / JUBILEE_CYCLE_LENGTH);
    yearInJubilee = (yearsSinceReference % JUBILEE_CYCLE_LENGTH) + 1;
  } else {
    // Backward from reference (handle negative modulo correctly)
    jubileeOffset = Math.floor(yearsSinceReference / JUBILEE_CYCLE_LENGTH);
    yearInJubilee = ((yearsSinceReference % JUBILEE_CYCLE_LENGTH) + JUBILEE_CYCLE_LENGTH) % JUBILEE_CYCLE_LENGTH + 1;
  }
  
  const jubileeNumber = JUBILEE_REFERENCE_NUMBER + jubileeOffset;
  
  // Calculate week and year within week
  const weekNumber = Math.ceil(yearInJubilee / SABBATH_CYCLE_LENGTH);
  const yearInWeek = ((yearInJubilee - 1) % SABBATH_CYCLE_LENGTH) + 1;
  
  // Determine special years
  const isSabbathYear = yearInWeek === SABBATH_CYCLE_LENGTH; // Year 7 of any week
  const isJubileeYear = yearInJubilee === 1; // Year 1 is also Year 50 of previous (Jubilee)
  
  // Calculate the actual Jubilee being celebrated (for Jubilee years)
  // When yearInJubilee === 1, we're in the Jubilee year that concludes the previous jubilee cycle
  const celebratingJubilee = isJubileeYear ? jubileeNumber - 1 : null;
  
  // Planting prohibition info
  // No planting from fall of 6th year to fall of 7th year
  // If 7th year is also 49th year (yearInJubilee === 49), extends to fall of 50th year
  let plantingProhibition = null;
  if (yearInWeek === 6) {
    plantingProhibition = 'begins_fall'; // Prohibition begins this fall
  } else if (isSabbathYear && yearInJubilee !== 49) {
    plantingProhibition = 'ends_fall'; // Prohibition ends this fall
  } else if (yearInJubilee === 49) {
    plantingProhibition = 'continues_to_jubilee'; // 49th year - continues through Jubilee
  } else if (isJubileeYear && yearInJubilee === 1) {
    // Check if previous year was 49th (i.e., this is year 50)
    plantingProhibition = 'ends_fall_jubilee'; // Prohibition ends this fall
  }
  
  return {
    gregorianYear,
    jubileeNumber,
    weekNumber,
    yearInWeek,
    yearInJubilee,
    isSabbathYear,
    isJubileeYear,
    celebratingJubilee,
    plantingProhibition,
    // Convenience: years until next special years
    yearsUntilNextSabbath: isSabbathYear ? 7 : (SABBATH_CYCLE_LENGTH - yearInWeek),
    yearsUntilNextJubilee: isJubileeYear ? 49 : (JUBILEE_CYCLE_LENGTH - yearInJubilee + 1)
  };
}

/**
 * Format the jubilee info for display
 * @param {Object} info - Result from getJubileeInfo
 * @returns {string} Formatted string like "Jubilee 51, Week 1, Year 1"
 */
function formatJubileeDisplay(info) {
  return `Jubilee ${info.jubileeNumber}, Week ${info.weekNumber}, Year ${info.yearInWeek}`;
}

/**
 * Get a short description of special year status
 * @param {Object} info - Result from getJubileeInfo
 * @returns {string|null} Description or null if not a special year
 */
function getSpecialYearDescription(info) {
  if (info.isJubileeYear) {
    return `Jubilee Year (${info.celebratingJubilee}th Jubilee)`;
  }
  if (info.isSabbathYear) {
    return 'Sabbath Year (Year of Release)';
  }
  return null;
}

/**
 * Get detailed information about the planting prohibition
 * @param {Object} info - Result from getJubileeInfo
 * @returns {string|null} Description or null if no current prohibition
 */
function getPlantingProhibitionDescription(info) {
  switch (info.plantingProhibition) {
    case 'begins_fall':
      return 'Planting prohibition begins this fall (6th year)';
    case 'ends_fall':
      return 'Sabbath Year - no planting until this fall';
    case 'continues_to_jubilee':
      return 'Sabbath Year (49th) - no planting continues through Jubilee';
    case 'ends_fall_jubilee':
      return 'Jubilee Year - no planting until this fall';
    default:
      return null;
  }
}

/**
 * Check if a given year falls within the planting prohibition period
 * This is more complex as it depends on the season (fall to fall)
 * @param {Object} info - Result from getJubileeInfo
 * @returns {boolean} True if planting is prohibited at some point during this year
 */
function hasPlantingProhibition(info) {
  // Prohibition applies during:
  // - 6th year (fall): prohibition begins
  // - 7th year (all year until fall)
  // - If 49th year, also through 50th (1st) year
  return info.yearInWeek === 6 || 
         info.isSabbathYear || 
         (info.isJubileeYear && info.yearInJubilee === 1);
}

/**
 * Get the Gregorian year range for a specific jubilee
 * @param {number} jubileeNumber - The jubilee number (e.g., 51)
 * @returns {Object} Start and end years
 */
function getJubileeYearRange(jubileeNumber) {
  const offset = jubileeNumber - JUBILEE_REFERENCE_NUMBER;
  const startYear = JUBILEE_REFERENCE_YEAR + (offset * JUBILEE_CYCLE_LENGTH);
  const endYear = startYear + JUBILEE_CYCLE_LENGTH - 1;
  
  return {
    jubileeNumber,
    startYear, // Year 1 of this jubilee cycle
    endYear,   // Year 49 of this jubilee cycle
    jubileeYear: startYear // Year 1 is the Jubilee year (also year 50 of previous)
  };
}

/**
 * Find all Sabbath years within a range
 * @param {number} startYear - Start of range (Gregorian)
 * @param {number} endYear - End of range (Gregorian)
 * @returns {Array} Array of years that are Sabbath years
 */
function getSabbathYearsInRange(startYear, endYear) {
  const sabbathYears = [];
  for (let year = startYear; year <= endYear; year++) {
    const info = getJubileeInfo(year);
    if (info.isSabbathYear) {
      sabbathYears.push(year);
    }
  }
  return sabbathYears;
}

/**
 * Find all Jubilee years within a range
 * @param {number} startYear - Start of range (Gregorian)
 * @param {number} endYear - End of range (Gregorian)
 * @returns {Array} Array of years that are Jubilee years
 */
function getJubileeYearsInRange(startYear, endYear) {
  const jubileeYears = [];
  for (let year = startYear; year <= endYear; year++) {
    const info = getJubileeInfo(year);
    if (info.isJubileeYear) {
      jubileeYears.push({
        year,
        jubileeNumber: info.celebratingJubilee
      });
    }
  }
  return jubileeYears;
}

/**
 * Get scriptural references for Jubilee and Sabbath years
 * @returns {Object} Object with scripture references
 */
function getJubileeScriptureReferences() {
  return {
    jubilee: [
      { ref: 'Leviticus 25:8-13', text: 'The Jubilee Year commandment' },
      { ref: 'Leviticus 25:10', text: 'Proclaim liberty throughout the land' },
      { ref: 'Isaiah 61:1-2', text: 'The year of the Lord\'s favor' },
      { ref: 'Luke 4:18-19', text: 'Yeshua reads Isaiah in Nazareth' }
    ],
    sabbathYear: [
      { ref: 'Leviticus 25:1-7', text: 'The Sabbath Year for the land' },
      { ref: 'Deuteronomy 15:1-3', text: 'Release of debts' },
      { ref: 'Deuteronomy 15:9', text: 'The year of release warning' },
      { ref: 'Deuteronomy 31:10-13', text: 'Reading Torah at Sukkot' }
    ],
    dayOfAtonement: [
      { ref: 'Leviticus 25:9', text: 'Jubilee trumpet on Day of Atonement' },
      { ref: 'Leviticus 16', text: 'Day of Atonement observance' }
    ]
  };
}

// Export for use in other modules (if using ES modules)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getJubileeInfo,
    formatJubileeDisplay,
    getSpecialYearDescription,
    getPlantingProhibitionDescription,
    hasPlantingProhibition,
    getJubileeYearRange,
    getSabbathYearsInRange,
    getJubileeYearsInRange,
    getJubileeScriptureReferences,
    JUBILEE_REFERENCE_YEAR,
    JUBILEE_REFERENCE_NUMBER,
    JUBILEE_CYCLE_LENGTH,
    SABBATH_CYCLE_LENGTH
  };
}
