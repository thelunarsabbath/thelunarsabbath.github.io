// ============================================================================
// PRIESTLY DIVISIONS - Calculate which priestly course is serving
// ============================================================================
// 
// Three historical anchor points establish and validate the priestly cycle:
//
// 1. TEMPLE DEDICATION (959 BC) - Start of the cycle
//    The priestly cycle began at Solomon's Temple dedication during Tabernacles
//    (15th of 7th month, 959 BC). Course 1 (Jehoiarib) was the first to serve
//    after the dedication ceremonies. (1 Kings 8; 2 Chronicles 5-7; 1 Chr 24:7)
//
// 2. FIRST TEMPLE DESTRUCTION (587 BC) - Validation point
//    Jehoiarib may have been serving when the First Temple fell on the 9th of Av.
//    This provides an intermediate validation point for the cycle continuity.
//
// 3. SECOND TEMPLE DESTRUCTION (70 AD) - STRONGEST validation point
//    Historical testimony confirms Course 1 (Jehoiarib) was serving when the
//    Second Temple fell on the 9th of Av, 70 AD. This is the STRONGEST anchor
//    and serves as the primary validation invariant. Any calendar configuration
//    that fails to place Jehoiarib at this date should be flagged with a warning.
//
// For Saturday/continuous sabbath: weeks are always 7 days
// For Lunar sabbath: weeks follow the lunar month (4 weeks per ~29.53 day month)
// ============================================================================

// The year of the First Temple dedication (959 BC = astronomical year -958)
const TEMPLE_DEDICATION_YEAR = -958;

// The year of the First Temple destruction (587 BC = astronomical year -586)
// Some scholars date this to 586 BC, but 587 BC aligns with many chronologies
const FIRST_TEMPLE_DESTRUCTION_YEAR = -586;

// Priestly divisions data (will be loaded from JSON)
let PRIESTLY_DIVISIONS = null;
let priestlyDivisionsLoadPromise = null;

// Average synodic month length in days (high precision)
const SYNODIC_MONTH = 29.530588853;

// Load priestly divisions from JSON file
async function loadPriestlyDivisions() {
  if (PRIESTLY_DIVISIONS) return PRIESTLY_DIVISIONS;
  
  // If already loading, return the existing promise
  if (priestlyDivisionsLoadPromise) return priestlyDivisionsLoadPromise;
  
  priestlyDivisionsLoadPromise = (async () => {
    try {
      const response = await fetch('/priestly_divisions.json');
      if (!response.ok) throw new Error('Failed to load priestly divisions');
      PRIESTLY_DIVISIONS = await response.json();
      return PRIESTLY_DIVISIONS;
    } catch (err) {
      console.error('Error loading priestly divisions:', err);
      return null;
    }
  })();
  
  return priestlyDivisionsLoadPromise;
}

// Ensure divisions are loaded (call this before using getPriestlyCourse)
async function ensurePriestlyDivisionsLoaded() {
  if (!PRIESTLY_DIVISIONS) {
    await loadPriestlyDivisions();
  }
  return PRIESTLY_DIVISIONS;
}

// Calculate Julian Day Number from a date
// This uses the same algorithm as astronomy-engine-abstraction.js
function dateToJulianDay(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const h = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  
  // Julian calendar for dates before Oct 15, 1582
  // Gregorian calendar for dates on or after Oct 15, 1582
  let jdn;
  if (y < 1582 || (y === 1582 && (m < 10 || (m === 10 && d < 15)))) {
    jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
  } else {
    jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }
  return jdn + (h - 12) / 24;
}

// Get the reference date (15th of 7th month, 959 BC - Temple Dedication) for the current calendar settings
// Returns the Julian Day Number for when Course 1 (Jehoiarib) began serving
function getTempleDedicationReferenceJD(profile) {
  // We need to calculate when the 15th of the 7th month in 959 BC falls under the current calendar
  // This requires generating the lunar calendar for year 959 BC (astronomical year -958)
  
  // Create a temporary state-like object with the profile settings
  const tempState = {
    year: TEMPLE_DEDICATION_YEAR,
    lat: profile?.lat || 31.7683,  // Jerusalem
    lon: profile?.lon || 35.2137,
    moonPhase: profile?.moonPhase || state.moonPhase,
    dayStartTime: profile?.dayStartTime || state.dayStartTime,
    dayStartAngle: profile?.dayStartAngle || state.dayStartAngle,
    yearStartRule: profile?.yearStartRule || state.yearStartRule,
    crescentThreshold: profile?.crescentThreshold || state.crescentThreshold
  };
  
  // Get moon events for 959 BC using the current engine
  const engine = getAstroEngine();
  const moonEvents = findMoonEvents(TEMPLE_DEDICATION_YEAR, tempState.moonPhase);
  
  // Get year start point for 959 BC
  const yearStartPoint = getYearStartPoint(TEMPLE_DEDICATION_YEAR);
  
  // Find the first moon event on or after year start (this is Nisan)
  let nissanMoon = moonEvents.find(m => m >= yearStartPoint);
  if (!nissanMoon) nissanMoon = moonEvents[0];
  
  // Find the 7th moon event (Tishri/Ethanim) - index 6 since we start at 0
  const nissanIndex = moonEvents.findIndex(m => Math.abs(m.getTime() - nissanMoon.getTime()) < 1000);
  const tishriMoonIndex = nissanIndex + 6; // 7th month
  
  if (tishriMoonIndex >= moonEvents.length - 1) {
    console.error('Cannot find Tishri moon for 959 BC');
    return null;
  }
  
  const tishriMoon = moonEvents[tishriMoonIndex];
  
  // Calculate when Day 1 of Tishri starts based on the current settings
  const observerLon = tempState.lon;
  const tishriMoonLocalDate = getLocalDateFromUTC(tishriMoon, observerLon);
  
  let monthStartDate = new Date(tishriMoonLocalDate.getTime());
  
  // Apply the same day start logic as buildLunarMonths
  if ((tempState.moonPhase === 'dark' || tempState.moonPhase === 'full' || tempState.moonPhase === 'crescent') && 
      tempState.dayStartTime === 'evening') {
    const sunsetOnMoonDate = getSunsetTimestamp(tishriMoonLocalDate);
    const moonEventLocalTime = tishriMoon.getTime() + (observerLon / 15) * 60 * 60 * 1000;
    const sunsetLocalTime = sunsetOnMoonDate + (observerLon / 15) * 60 * 60 * 1000;
    
    if (moonEventLocalTime > sunsetLocalTime) {
      monthStartDate.setUTCDate(monthStartDate.getUTCDate() + 1);
    }
  } else if ((tempState.moonPhase === 'dark' || tempState.moonPhase === 'full' || tempState.moonPhase === 'crescent') && 
             tempState.dayStartTime === 'morning') {
    const sunriseOnMoonDate = getSunriseTimestamp(tishriMoonLocalDate);
    const moonEventLocalTime = tishriMoon.getTime() + (observerLon / 15) * 60 * 60 * 1000;
    const sunriseLocalTime = sunriseOnMoonDate + (observerLon / 15) * 60 * 60 * 1000;
    
    if (moonEventLocalTime >= sunriseLocalTime) {
      monthStartDate.setUTCDate(monthStartDate.getUTCDate() + 1);
    }
  } else {
    monthStartDate.setUTCDate(monthStartDate.getUTCDate() + 1);
  }
  
  // The 15th of Tishri is 14 days after Day 1 (Day 1 + 14 = Day 15)
  // This is the start of Tabernacles when the Temple was dedicated
  const tabernaclesStart = new Date(monthStartDate.getTime());
  tabernaclesStart.setUTCDate(tabernaclesStart.getUTCDate() + 14);
  
  return dateToJulianDay(tabernaclesStart);
}

// Check if a date is before the Temple dedication (959 BC)
function isBeforeTempleDedication(date) {
  const targetJD = dateToJulianDay(date);
  // Approximate JD for 959 BC - will be calculated more precisely per profile
  // 959 BC ≈ JD 1,355,000 (rough estimate)
  const approxDedicationJD = 1355000;
  return targetJD < approxDedicationJD;
}

// Cache for reference JD per profile configuration
const referenceJDCache = new Map();

function getCachedReferenceJD(profile) {
  // Create a cache key from the relevant profile settings
  const key = `${profile?.moonPhase || state.moonPhase}-${profile?.dayStartTime || state.dayStartTime}-${profile?.yearStartRule || state.yearStartRule}-${profile?.crescentThreshold || state.crescentThreshold}`;
  
  if (!referenceJDCache.has(key)) {
    const jd = getTempleDedicationReferenceJD(profile);
    referenceJDCache.set(key, jd);
  }
  
  return referenceJDCache.get(key);
}

// Calculate which week within a lunar month a given day falls into
// Returns 0, 1, 2, or 3 (for weeks 1-4)
function getLunarWeekIndex(lunarDay) {
  // Days 1-7 = week 0 (days 1-7, but Sabbath is day 8)
  // Actually for lunar sabbath: 1-7=week0, 8-14=week1, 15-21=week2, 22-29/30=week3
  // But sabbaths are on 8, 15, 22, 29 which are the LAST day of each week
  // So: days 2-8 = week 1, days 9-15 = week 2, days 16-22 = week 3, days 23-29/30 = week 4
  // But day 1 is new moon day, not part of a week in some interpretations
  
  // For our calculation purposes:
  // Week 1: days 1-8 (sabbath on 8)
  // Week 2: days 9-15 (sabbath on 15)
  // Week 3: days 16-22 (sabbath on 22)
  // Week 4: days 23-29/30 (sabbath on 29)
  
  if (lunarDay <= 8) return 0;
  if (lunarDay <= 15) return 1;
  if (lunarDay <= 22) return 2;
  return 3;  // 23-30
}

// Calculate the priestly course for a given date
// 
// For Saturday sabbath: continuous 7-day weeks from reference point
// For Lunar sabbath: 4 weeks per lunar month
//
// Parameters:
//   date: JavaScript Date object for the target date
//   lunarDay: (optional) the lunar day of month (1-30) if known
//   lunarMonth: (optional) the lunar month (1-13) if known
//   profile: (optional) calendar profile settings to use
//
// Returns: { order: 1-24, course: "name", meaning: "description", weekInCycle: 1-24 }
// For dates before Temple dedication, returns: { beforeDedication: true, dedicationYear: -958 }
function getPriestlyCourse(date, lunarDay = null, lunarMonth = null, profile = null) {
  if (!PRIESTLY_DIVISIONS) {
    console.warn('Priestly divisions not loaded');
    return null;
  }
  
  const sabbathMode = profile?.sabbathMode || state.sabbathMode;
  const targetJD = dateToJulianDay(date);
  const referenceJD = getCachedReferenceJD(profile);
  
  if (referenceJD === null) {
    console.error('Could not calculate reference date for Temple dedication');
    return null;
  }
  
  // Check if this date is before the Temple dedication
  if (targetJD < referenceJD) {
    return {
      beforeDedication: true,
      dedicationYear: TEMPLE_DEDICATION_YEAR,
      message: 'Priestly Cycles Start at First Temple Dedication'
    };
  }
  
  let weekIndex;
  
  if (sabbathMode === 'lunar') {
    // Lunar sabbath calculation
    // Each lunar month has exactly 4 weeks (weeks 0-3), regardless of 29 or 30 days
    // The priestly cycle is continuous across months
    
    // If we have lunar month info and access to the current calendar, use exact counting
    if (lunarDay !== null && lunarMonth !== null && state.lunarMonths && state.lunarMonths.length > 0) {
      // Calculate weeks from the start of the current lunar year
      // This avoids cumulative error from calculating from 959 BC
      
      // Weeks before this month (each month has exactly 4 weeks)
      const weeksBeforeThisMonth = (lunarMonth - 1) * 4;
      
      // Week within this month
      const currentWeekInMonth = getLunarWeekIndex(lunarDay);
      
      // Total weeks from start of this lunar year
      const weeksFromYearStart = weeksBeforeThisMonth + currentWeekInMonth;
      
      // Now we need to know what course was serving at the start of this lunar year
      // Calculate the offset from reference (Temple Dedication, Tabernacles 959 BC) to the year start
      const yearStartDay = state.lunarMonths[0]?.days?.[0];
      if (yearStartDay) {
        const yearStartJD = dateToJulianDay(yearStartDay.gregorianDate);
        const deltaJD = yearStartJD - referenceJD;
        const deltaMonths = deltaJD / SYNODIC_MONTH;
        
        // Weeks from reference to year start
        // Reference is week 1 (index 1) of its month, year start is week 0 of month 1
        const referenceWeekInMonth = 1;
        const fullMonths = Math.round(deltaMonths);
        const weeksToYearStart = (fullMonths * 4) + (0 - referenceWeekInMonth);
        
        // Total weeks from reference
        const totalWeeks = weeksToYearStart + weeksFromYearStart;
        
        weekIndex = ((totalWeeks % 24) + 24) % 24;
      } else {
        // Fallback to approximate calculation
        const deltaJD = targetJD - referenceJD;
        const deltaMonths = deltaJD / SYNODIC_MONTH;
        const totalWeeks = Math.round(deltaMonths * 4);
        weekIndex = ((totalWeeks % 24) + 24) % 24;
      }
    } else if (lunarDay !== null) {
      // We know the lunar day but not the month - use approximate calculation
      const deltaJD = targetJD - referenceJD;
      const deltaMonths = deltaJD / SYNODIC_MONTH;
      const currentWeekInMonth = getLunarWeekIndex(lunarDay);
      const fullMonths = Math.round(deltaMonths);
      const referenceWeekInMonth = 1;
      const totalWeeks = (fullMonths * 4) + (currentWeekInMonth - referenceWeekInMonth);
      weekIndex = ((totalWeeks % 24) + 24) % 24;
    } else {
      // Approximate calculation when lunar day is not known
      const deltaJD = targetJD - referenceJD;
      const deltaMonths = deltaJD / SYNODIC_MONTH;
      const totalWeeks = Math.round(deltaMonths * 4);
      weekIndex = ((totalWeeks % 24) + 24) % 24;
    }
    
  } else {
    // Saturday/continuous sabbath calculation
    // Normalize both dates to the start of their respective Gregorian weeks
    // Week starts on Sunday (day 0) and ends on Saturday (day 6, the Sabbath)
    
    // Get day of week: (floor(JD + 1.5)) % 7 gives 0=Sunday, 1=Monday, ..., 6=Saturday
    const referenceWeekday = Math.floor(referenceJD + 1.5) % 7;
    const targetWeekday = Math.floor(targetJD + 1.5) % 7;
    
    // Normalize to start of week (Sunday)
    const referenceWeekStart = Math.floor(referenceJD) - referenceWeekday;
    const targetWeekStart = Math.floor(targetJD) - targetWeekday;
    
    // Calculate whole weeks between the two week starts
    const deltaWeeks = Math.round((targetWeekStart - referenceWeekStart) / 7);
    
    // Handle negative values with proper modular arithmetic
    weekIndex = ((deltaWeeks % 24) + 24) % 24;
  }
  
  // Get the course information
  const course = PRIESTLY_DIVISIONS[weekIndex];
  
  return {
    order: course.order,
    course: course.course,
    meaning: course.meaning,
    hebrew: course.hebrew,
    lineage: course.lineage,
    notes: course.notes || '',
    famous_people: course.famous_people || [],
    weekInCycle: weekIndex + 1  // 1-indexed week in the 24-week cycle
  };
}

// Get priestly course for a specific lunar calendar day object
// This is the main function to use from the calendar display
function getPriestlyCourseForDay(dayObj, month, profile = null) {
  if (!dayObj || !dayObj.gregorianDate) return null;
  
  return getPriestlyCourse(
    dayObj.gregorianDate,
    dayObj.lunarDay,
    month?.monthNumber || null,
    profile
  );
}

// Format the priestly course for display
function formatPriestlyCourse(courseInfo) {
  if (!courseInfo) return '';
  if (courseInfo.beforeDedication) return courseInfo.message;
  return `${courseInfo.course} (Course ${courseInfo.order})`;
}

// Format the priestly course with meaning
function formatPriestlyCourseWithMeaning(courseInfo) {
  if (!courseInfo) return '';
  if (courseInfo.beforeDedication) return courseInfo.message;
  return `${courseInfo.course} — "${courseInfo.meaning}"`;
}

// Get HTML display for priestly course (for day detail panel)
function getPriestlyCourseHtml(dayObj, month) {
  const courseInfo = getPriestlyCourseForDay(dayObj, month);
  if (!courseInfo) return '';
  
  // Handle dates before Temple dedication
  if (courseInfo.beforeDedication) {
    const dedicationYear = Math.abs(courseInfo.dedicationYear - 1); // Convert to BC year
    return `
      <div class="priestly-course-display before-dedication">
        <span class="priestly-course-icon">🏛️</span>
        <a href="#" onclick="navigateToDedicationDate(); return false;" class="priestly-dedication-link">
          ${courseInfo.message} (${dedicationYear} BC)
        </a>
      </div>
    `;
  }
  
  return `
    <div class="priestly-course-display">
      <span class="priestly-course-icon">👨‍🦳</span>
      <span class="priestly-course-name">${courseInfo.course}</span>
      <span class="priestly-course-order">(Course ${courseInfo.order})</span>
      <span class="priestly-course-meaning" title="${courseInfo.meaning}">"${courseInfo.meaning}"</span>
    </div>
  `;
}

// Navigate to the Temple Dedication date (Tabernacles 959 BC)
function navigateToDedicationDate() {
  state.year = TEMPLE_DEDICATION_YEAR;
  updateUI();
  generateCalendar();
  
  // Navigate to 7th month, day 15 (Tabernacles)
  if (state.lunarMonths.length >= 7) {
    state.currentMonthIndex = 6; // 7th month (0-indexed)
    state.highlightedLunarDay = 15;
    const month = state.lunarMonths[6];
    const dayObj = month.days.find(d => d.lunarDay === 15);
    if (dayObj) {
      state.selectedTimestamp = getSunriseTimestamp(dayObj.gregorianDate);
      renderMonth(month);
      updateMonthButtons();
      showDayDetail(dayObj, month);
    }
  }
  updateURL();
}

// Navigate to the Second Temple Destruction date (9th of Av, 70 AD)
function navigateToDestructionDate() {
  state.year = 70;
  updateUI();
  generateCalendar();
  
  // Navigate to 5th month (Av), day 9
  if (state.lunarMonths.length >= 5) {
    state.currentMonthIndex = 4; // 5th month (0-indexed)
    state.highlightedLunarDay = 9;
    const month = state.lunarMonths[4];
    const dayObj = month.days.find(d => d.lunarDay === 9);
    if (dayObj) {
      state.selectedTimestamp = getSunriseTimestamp(dayObj.gregorianDate);
      renderMonth(month);
      updateMonthButtons();
      showDayDetail(dayObj, month);
    }
  }
  updateURL();
}

// Navigate to the First Temple Destruction date (9th of Av, 587 BC)
function navigateToFirstDestructionDate() {
  state.year = FIRST_TEMPLE_DESTRUCTION_YEAR;
  updateUI();
  generateCalendar();
  
  // Navigate to 5th month (Av), day 9
  if (state.lunarMonths.length >= 5) {
    state.currentMonthIndex = 4; // 5th month (0-indexed)
    state.highlightedLunarDay = 9;
    const month = state.lunarMonths[4];
    const dayObj = month.days.find(d => d.lunarDay === 9);
    if (dayObj) {
      state.selectedTimestamp = getSunriseTimestamp(dayObj.gregorianDate);
      renderMonth(month);
      updateMonthButtons();
      showDayDetail(dayObj, month);
    }
  }
  updateURL();
}

// Jump to the next/previous time this priestly course serves
// Course serves every 24 weeks (24 courses in rotation)
// direction: 1 for forward, -1 for backward
// Jumps to the FIRST day of the week when this course serves
function jumpToPriestlyCourse(courseOrder, direction) {
  if (!state.lunarMonths || state.lunarMonths.length === 0) return;
  
  const currentMonth = state.lunarMonths[state.currentMonthIndex];
  const currentDay = currentMonth.days.find(d => d.lunarDay === state.highlightedLunarDay);
  if (!currentDay) return;
  
  // For lunar sabbath: jump forward/backward ~24 weeks (6 months)
  // For Saturday sabbath: jump forward/backward 24 * 7 = 168 days
  
  if (state.sabbathMode === 'lunar') {
    // Jump by approximately 6 months (24 weeks / 4 weeks per month)
    let targetMonthIndex = state.currentMonthIndex + (direction * 6);
    let targetYear = state.year;
    
    // Handle year rollover (forward)
    while (targetMonthIndex >= state.lunarMonths.length) {
      targetMonthIndex -= state.lunarMonths.length;
      targetYear++;
    }
    
    // Handle year rollover (backward)
    while (targetMonthIndex < 0) {
      targetYear--;
      // Need to regenerate calendar to know how many months in previous year
      state.year = targetYear;
      updateUI();
      generateCalendar();
      targetMonthIndex += state.lunarMonths.length;
    }
    
    // If we changed year going forward
    if (targetYear !== state.year) {
      state.year = targetYear;
      updateUI();
      generateCalendar();
    }
    
    // Get the current week in month to find the equivalent week
    const currentWeekInMonth = getLunarWeekIndex(currentDay.lunarDay);
    const targetMonth = state.lunarMonths[targetMonthIndex];
    
    // Jump to the FIRST day of the equivalent week
    // Week 0 (days 2-8): first day is 2
    // Week 1 (days 9-15): first day is 9
    // Week 2 (days 16-22): first day is 16
    // Week 3 (days 23-29/30): first day is 23
    let targetLunarDay;
    if (currentWeekInMonth === 0) targetLunarDay = 2;
    else if (currentWeekInMonth === 1) targetLunarDay = 9;
    else if (currentWeekInMonth === 2) targetLunarDay = 16;
    else targetLunarDay = 23;
    
    // Ensure day exists in target month
    targetLunarDay = Math.min(targetLunarDay, targetMonth.daysInMonth);
    
    state.currentMonthIndex = targetMonthIndex;
    state.highlightedLunarDay = targetLunarDay;
    
    const targetDayObj = targetMonth.days.find(d => d.lunarDay === targetLunarDay);
    if (targetDayObj) {
      state.selectedTimestamp = getSunriseTimestamp(targetDayObj.gregorianDate);
      document.getElementById('goto-date').value = formatLocalDatetime(state.selectedTimestamp);
      renderMonth(targetMonth);
      updateMonthButtons();
      showDayDetail(targetDayObj, targetMonth);
      updateURL();
    }
  } else {
    // Saturday sabbath: jump forward/backward 168 days (24 weeks)
    // First, find the start of the current week (Sunday)
    const currentJD = dateToJulianDay(currentDay.gregorianDate);
    const currentWeekday = Math.floor(currentJD + 1.5) % 7; // 0=Sunday
    const currentWeekStartJD = Math.floor(currentJD) - currentWeekday;
    
    // Jump 24 weeks in the specified direction, landing on Sunday (first day of week)
    const targetWeekStartJD = currentWeekStartJD + (direction * 24 * 7);
    
    // Convert back to timestamp
    // JD to Unix timestamp: (JD - 2440587.5) * 86400000
    const targetTimestamp = (targetWeekStartJD - 2440587.5) * 86400000;
    const targetDate = new Date(targetTimestamp);
    
    // Navigate to this date
    const targetYear = targetDate.getUTCFullYear();
    const targetMonth = targetDate.getUTCMonth();
    const targetDay = targetDate.getUTCDate();
    
    navigateToTimestamp(targetTimestamp, targetYear, targetMonth, targetDay);
  }
}

// Navigate to the priestly divisions page
function showPriestlyPage() {
  navigateTo('priestly');
}

// Calculate all service dates for a given course in the current year
function getServiceDatesForCourse(courseOrder) {
  if (!state.lunarMonths || state.lunarMonths.length === 0) return [];
  
  const serviceDates = [];
  
  // Iterate through all days in all months and find when this course serves
  for (let m = 0; m < state.lunarMonths.length; m++) {
    const month = state.lunarMonths[m];
    
    // For lunar sabbath, check each week (days 2-8, 9-15, 16-22, 23-29/30)
    // For Saturday sabbath, check each day
    
    if (state.sabbathMode === 'lunar') {
      // Check each week in the month
      const weekStarts = [2, 9, 16, 23];
      for (const weekStart of weekStarts) {
        const dayObj = month.days.find(d => d.lunarDay === weekStart);
        if (!dayObj) continue;
        
        const courseInfo = getPriestlyCourseForDay(dayObj, month);
        if (courseInfo && !courseInfo.beforeDedication && courseInfo.order === courseOrder) {
          // Find the sabbath (end of this week)
          const sabbathDay = weekStart === 2 ? 8 : weekStart === 9 ? 15 : weekStart === 16 ? 22 : 29;
          const sabbathObj = month.days.find(d => d.lunarDay === sabbathDay);
          
          serviceDates.push({
            monthNumber: month.monthNumber,
            monthName: month.name,
            startDay: weekStart,
            endDay: sabbathDay,
            startDate: dayObj.gregorianDate,
            endDate: sabbathObj ? sabbathObj.gregorianDate : dayObj.gregorianDate,
            dayObj: dayObj,
            month: month
          });
        }
      }
    } else {
      // Saturday sabbath - check every 7 days starting from first day
      for (let d = 0; d < month.days.length; d++) {
        const dayObj = month.days[d];
        const courseInfo = getPriestlyCourseForDay(dayObj, month);
        
        if (courseInfo && !courseInfo.beforeDedication && courseInfo.order === courseOrder) {
          // Check if this is the start of a week (Sunday)
          const weekday = Math.floor(dateToJulianDay(dayObj.gregorianDate) + 1.5) % 7;
          if (weekday === 0) { // Sunday = start of week
            // Find Saturday (end of week)
            const saturdayIdx = d + 6;
            const sabbathObj = saturdayIdx < month.days.length ? month.days[saturdayIdx] : null;
            
            serviceDates.push({
              monthNumber: month.monthNumber,
              monthName: month.name,
              startDay: dayObj.lunarDay,
              endDay: sabbathObj ? sabbathObj.lunarDay : dayObj.lunarDay,
              startDate: dayObj.gregorianDate,
              endDate: sabbathObj ? sabbathObj.gregorianDate : dayObj.gregorianDate,
              dayObj: dayObj,
              month: month
            });
          }
        }
      }
    }
  }
  
  return serviceDates;
}

// Calculate the Julian Day for 9th of Av for a given year under current calendar settings
function getNinthOfAvJD(year, profile) {
  // Create a temporary state-like object with the profile settings
  const tempState = {
    year: year,
    lat: profile?.lat || 31.7683,  // Jerusalem
    lon: profile?.lon || 35.2137,
    moonPhase: profile?.moonPhase || state.moonPhase,
    dayStartTime: profile?.dayStartTime || state.dayStartTime,
    dayStartAngle: profile?.dayStartAngle || state.dayStartAngle,
    yearStartRule: profile?.yearStartRule || state.yearStartRule,
    crescentThreshold: profile?.crescentThreshold || state.crescentThreshold
  };
  
  // Get moon events for the specified year
  const moonEvents = findMoonEvents(year, tempState.moonPhase);
  
  // Get year start point
  const yearStartPoint = getYearStartPoint(year);
  
  // Find the first moon event on or after year start (this is Nisan)
  let nissanMoon = moonEvents.find(m => m >= yearStartPoint);
  if (!nissanMoon) nissanMoon = moonEvents[0];
  
  // Find the 5th moon event (Av) - index 4 since we start at 0
  const nissanIndex = moonEvents.findIndex(m => Math.abs(m.getTime() - nissanMoon.getTime()) < 1000);
  const avMoonIndex = nissanIndex + 4; // 5th month
  
  if (avMoonIndex >= moonEvents.length - 1) {
    console.error(`Cannot find Av moon for year ${year}`);
    return null;
  }
  
  const avMoon = moonEvents[avMoonIndex];
  
  // Calculate when Day 1 of Av starts based on the current settings
  const observerLon = tempState.lon;
  const avMoonLocalDate = getLocalDateFromUTC(avMoon, observerLon);
  
  let monthStartDate = new Date(avMoonLocalDate.getTime());
  
  // Apply the same day start logic as buildLunarMonths
  if ((tempState.moonPhase === 'dark' || tempState.moonPhase === 'full' || tempState.moonPhase === 'crescent') && 
      tempState.dayStartTime === 'evening') {
    const sunsetOnMoonDate = getSunsetTimestamp(avMoonLocalDate);
    const moonEventLocalTime = avMoon.getTime() + (observerLon / 15) * 60 * 60 * 1000;
    const sunsetLocalTime = sunsetOnMoonDate + (observerLon / 15) * 60 * 60 * 1000;
    
    if (moonEventLocalTime > sunsetLocalTime) {
      monthStartDate.setUTCDate(monthStartDate.getUTCDate() + 1);
    }
  } else if ((tempState.moonPhase === 'dark' || tempState.moonPhase === 'full' || tempState.moonPhase === 'crescent') && 
             tempState.dayStartTime === 'morning') {
    const sunriseOnMoonDate = getSunriseTimestamp(avMoonLocalDate);
    const moonEventLocalTime = avMoon.getTime() + (observerLon / 15) * 60 * 60 * 1000;
    const sunriseLocalTime = sunriseOnMoonDate + (observerLon / 15) * 60 * 60 * 1000;
    
    if (moonEventLocalTime >= sunriseLocalTime) {
      monthStartDate.setUTCDate(monthStartDate.getUTCDate() + 1);
    }
  } else {
    monthStartDate.setUTCDate(monthStartDate.getUTCDate() + 1);
  }
  
  // The 9th of Av is 8 days after Day 1 (Day 1 + 8 = Day 9)
  const ninthOfAv = new Date(monthStartDate.getTime());
  ninthOfAv.setUTCDate(ninthOfAv.getUTCDate() + 8);
  
  return dateToJulianDay(ninthOfAv);
}

// Calculate the Julian Day for 9th of Av, 70 AD under current calendar settings
function getTempleDestructionJD(profile) {
  return getNinthOfAvJD(70, profile);
}

// Calculate the Julian Day for 9th of Av, 587 BC under current calendar settings
function getFirstTempleDestructionJD(profile) {
  return getNinthOfAvJD(FIRST_TEMPLE_DESTRUCTION_YEAR, profile);
}

// Helper function to calculate what course would be serving at a given JD
function getCourseAtJD(targetJD, referenceJD) {
  const deltaJD = targetJD - referenceJD;
  const deltaMonths = deltaJD / SYNODIC_MONTH;
  
  // The reference is at week index 1 of its month (15th of 7th month)
  // For 9th of Av, that's also week index 1 (days 9-15)
  const referenceWeekInMonth = 1;
  const targetWeekInMonth = 1; // 9th is in days 9-15 = week index 1
  
  const fullMonths = Math.round(deltaMonths);
  const totalWeeks = (fullMonths * 4) + (targetWeekInMonth - referenceWeekInMonth);
  
  return ((totalWeeks % 24) + 24) % 24;
}

// Validate that Jehoiarib is serving at a specific 9th of Av date
function validateJehoiaribAtNinthOfAv(year, yearLabel, profile) {
  const ninthOfAvJD = getNinthOfAvJD(year, profile);
  if (!ninthOfAvJD) return { valid: true, error: `Could not calculate ${yearLabel} date` };
  
  const referenceJD = getCachedReferenceJD(profile);
  if (!referenceJD) return { valid: true, error: 'Could not calculate reference date' };
  
  const weekIndex = getCourseAtJD(ninthOfAvJD, referenceJD);
  
  // Week index 0 = Course 1 (Jehoiarib)
  if (weekIndex === 0) {
    return { valid: true, year: year, yearLabel: yearLabel };
  }
  
  const course = PRIESTLY_DIVISIONS ? PRIESTLY_DIVISIONS[weekIndex] : null;
  return {
    valid: false,
    year: year,
    yearLabel: yearLabel,
    actualCourse: course?.course || 'Unknown',
    order: weekIndex + 1,
    expectedCourse: 'Jehoiarib',
    expectedOrder: 1
  };
}

// Validate that the priestly cycle correctly places Jehoiarib at both Temple Destructions
// These are the historical anchor points - tradition holds Course 1 was serving when both Temples fell
// Returns an object with validation results for each event
function validateTempleDestructionCourses(profile) {
  return {
    firstTemple: validateJehoiaribAtNinthOfAv(FIRST_TEMPLE_DESTRUCTION_YEAR, '587 BC (First Temple)', profile),
    secondTemple: validateJehoiaribAtNinthOfAv(70, '70 AD (Second Temple)', profile)
  };
}

// Legacy function name for backwards compatibility
function validateTempleDestructionCourse(profile) {
  return validateJehoiaribAtNinthOfAv(70, '70 AD', profile);
}

// Get an info message about Jehoiarib tradition vs calculated cycle
function getPriestlyCycleWarning() {
  const validations = validateTempleDestructionCourses();
  const discrepancies = [];
  
  // Check First Temple destruction (587 BC)
  if (validations.firstTemple && !validations.firstTemple.error && !validations.firstTemple.valid) {
    discrepancies.push(`First Temple Destruction (9th of Av, 587 BC): Tradition claims Jehoiarib (Course 1), but calculation shows ${validations.firstTemple.actualCourse} (Course ${validations.firstTemple.order}).`);
  }
  
  // Check Second Temple destruction (70 AD)
  if (validations.secondTemple && !validations.secondTemple.error && !validations.secondTemple.valid) {
    discrepancies.push(`Second Temple Destruction (9th of Av, 70 AD): Tradition claims Jehoiarib (Course 1), but calculation shows ${validations.secondTemple.actualCourse} (Course ${validations.secondTemple.order}).`);
  }
  
  if (discrepancies.length === 0) {
    return null;
  }
  
  return `Note: The Talmudic tradition that Jehoiarib was serving when the Temple(s) fell does not align with this calendar's calculations. This tradition comes from sources with known internal contradictions and may not be a reliable anchor:\n• ${discrepancies.join('\n• ')}`;
}

// Render the priestly divisions table
function renderPriestlyTable() {
  const tbody = document.getElementById('priestly-table-body');
  if (!tbody || !PRIESTLY_DIVISIONS) return;
  
  // Check for discrepancy note about Jehoiarib tradition
  const note = getPriestlyCycleWarning();
  const warningContainer = document.getElementById('priestly-warning');
  if (warningContainer) {
    if (note) {
      warningContainer.innerHTML = `<div class="priestly-warning-message priestly-info-message">ℹ️ ${note}</div>`;
      warningContainer.style.display = 'block';
    } else {
      warningContainer.style.display = 'none';
    }
  }
  
  let html = '';
  
  for (const division of PRIESTLY_DIVISIONS) {
    const serviceDates = getServiceDatesForCourse(division.order);
    
    // Format service dates - Gregorian shown only on hover
    let datesHtml = '';
    if (serviceDates.length === 0) {
      datesHtml = '<span style="color: #666;">—</span>';
    } else {
      datesHtml = '<div class="course-dates-list">' + serviceDates.map(sd => {
        const startStr = formatShortDate(sd.startDate);
        return `<a class="course-date-link" onclick="jumpToPriestlyServiceDate(${sd.month.monthNumber - 1}, ${sd.startDay})" title="${startStr}">${sd.monthName} ${sd.startDay}-${sd.endDay}</a>`;
      }).join('') + '</div>';
    }
    
    // Check if there's additional info to show (notes or famous people)
    const hasInfo = division.notes || (division.famous_people && division.famous_people.length > 0);
    const infoIndicator = hasInfo ? ` <span class="course-notes-indicator" onclick="togglePriestlyDetails(${division.order})" title="Click for more info">ⓘ</span>` : '';
    
    // Build details row content
    let detailsHtml = '';
    if (hasInfo) {
      detailsHtml = '<div class="course-details-content">';
      if (division.notes) {
        detailsHtml += `<p class="course-detail-notes">${division.notes}</p>`;
      }
      if (division.famous_people && division.famous_people.length > 0) {
        detailsHtml += '<div class="course-famous-people"><strong>Notable Members:</strong><ul>';
        for (const person of division.famous_people) {
          detailsHtml += `<li><strong>${person.name}</strong> — ${person.notes}</li>`;
        }
        detailsHtml += '</ul></div>';
      }
      detailsHtml += '</div>';
    }
    
    // Format lineage under name
    const lineageHtml = division.lineage ? `<div class="course-lineage">of ${division.lineage}</div>` : '';
    
    html += `
      <tr class="course-row" data-order="${division.order}">
        <td class="course-order">${division.order}</td>
        <td class="course-name">${division.course}${infoIndicator}${lineageHtml}</td>
        <td class="course-meaning">${division.meaning}</td>
        <td class="course-dates">${datesHtml}</td>
      </tr>
      ${hasInfo ? `<tr class="course-details-row" data-order="${division.order}" style="display: none;"><td colspan="4">${detailsHtml}</td></tr>` : ''}
    `;
  }
  
  tbody.innerHTML = html;
}

// Toggle the details row for a priestly division
function togglePriestlyDetails(order) {
  const detailsRow = document.querySelector(`.course-details-row[data-order="${order}"]`);
  if (detailsRow) {
    const isVisible = detailsRow.style.display !== 'none';
    detailsRow.style.display = isVisible ? 'none' : 'table-row';
    
    // Toggle the indicator style
    const indicator = document.querySelector(`.course-row[data-order="${order}"] .course-notes-indicator`);
    if (indicator) {
      indicator.classList.toggle('active', !isVisible);
    }
  }
}

// Jump to a specific priestly service date
function jumpToPriestlyServiceDate(monthIndex, lunarDay) {
  // Hide priestly page
  const priestlyPage = document.getElementById('priestly-page');
  priestlyPage.style.display = 'none';
  
  // Show calendar
  const calendarOutput = document.getElementById('calendar-output');
  const dayDetailPanel = document.getElementById('day-detail-panel');
  calendarOutput.style.display = '';
  dayDetailPanel.style.display = '';
  
  // Navigate to the date
  if (monthIndex >= 0 && monthIndex < state.lunarMonths.length) {
    state.currentMonthIndex = monthIndex;
    state.highlightedLunarDay = lunarDay;
    
    const month = state.lunarMonths[monthIndex];
    const dayObj = month.days.find(d => d.lunarDay === lunarDay);
    if (dayObj) {
      state.selectedTimestamp = getSunriseTimestamp(dayObj.gregorianDate);
      document.getElementById('goto-date').value = formatLocalDatetime(state.selectedTimestamp);
      renderMonth(month);
      updateMonthButtons();
      showDayDetail(dayObj, month);
      updateURL();
    }
  }
}

// Note: Priestly divisions are loaded in the main DOMContentLoaded handler
// in index.html via loadPriestlyDivisions()
