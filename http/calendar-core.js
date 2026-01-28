// Calendar Core Functions
// Extracted from index.html for Phase 3 refactoring

// Gregorian calendar reform date: October 15, 1582
// Before this date, use Julian calendar (following NASA/Stellarium convention)
const GREGORIAN_REFORM_DATE = new Date(1582, 9, 15); // Oct 15, 1582

// Check if a date is before the Gregorian reform
function isBeforeGregorianReform(date) {
  return date < GREGORIAN_REFORM_DATE;
}

// Format year for display (handles BC years)
function formatYear(year) {
  if (year <= 0) {
    // Astronomical year 0 = 1 BC, -1 = 2 BC, etc.
    return Math.abs(year - 1) + ' BC';
  }
  return String(year);  // No "AD" suffix for positive years
}

// Format short date: "Jan 15"
function formatShortDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Use UTC methods - dates from _jdToDate already have correct calendar components stored
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

// Format full date: "January 15, 2025" or "January 15, 1 BC (Julian)"
function formatFullDate(date) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Use UTC methods - dates from _jdToDate already have correct calendar components stored
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const isJulian = isBeforeGregorianReform(date);
  const calendarSuffix = isJulian ? ' (Julian)' : '';
  
  // Format year: only show BC suffix, never AD
  const yearStr = year <= 0 ? `${Math.abs(year - 1)} BC` : `${year}`;
  
  return `${months[month]} ${day}, ${yearStr}${calendarSuffix}`;
}

// Render Jubilee cycle indicator for the calendar header
function renderJubileeIndicator(lunarYearStart) {
  // Get jubilee info for the lunar year
  const info = getJubileeInfo(lunarYearStart);
  
  // Build display text
  let displayText = formatJubileeDisplay(info);
  
  // Add special year indicators
  let specialClass = '';
  let specialIcon = '';
  let titleText = `Jubilee Cycle: ${displayText}`;
  
  if (info.isJubileeYear) {
    specialClass = ' jubilee-year';
    specialIcon = '🎺 ';
    titleText += ` - Jubilee Year (${info.celebratingJubilee}th Jubilee since Adam)`;
  } else if (info.isSabbathYear) {
    specialClass = ' sabbath-year';
    specialIcon = '🌾 ';
    titleText += ' - Sabbath Year (Year of Release)';
  }
  
  // Add planting prohibition info to title
  const prohibition = getPlantingProhibitionDescription(info);
  if (prohibition) {
    titleText += `\n${prohibition}`;
  }
  
  return `
    <div class="jubilee-indicator${specialClass}" title="${titleText}">
      <span class="jubilee-text">${specialIcon}${displayText}</span>
      <a href="#" class="jubilee-info-link" onclick="event.preventDefault(); event.stopPropagation(); showJubileeModal();" title="Learn about the Jubilee and Sabbath Year cycles">ⓘ</a>
    </div>
  `;
}

// Update the top nav profile selector
function updateTopNavProfile() {
  const moonEl = document.getElementById('top-nav-profile-moon');
  const nameEl = document.getElementById('top-nav-profile-name');
  if (!moonEl || !nameEl) return;
  
  moonEl.textContent = getMoonIcon();
  nameEl.textContent = getCurrentProfileName();
}

// Get event icon for a day cell (📰 for historical, 📜 for biblical, or custom icons)
function getDayEventIcon(monthNumber, lunarDay, gregorianYear) {
  // Only check if getBibleEvents is available
  if (typeof getBibleEvents !== 'function') return '';
  
  const events = getBibleEvents(monthNumber, lunarDay, gregorianYear);
  if (!events || events.length === 0) return '';
  
  // Collect all unique custom icons from events
  const customIcons = [];
  const seenIcons = new Set();
  const titles = [];
  
  for (const event of events) {
    if (event.icon && !seenIcons.has(event.icon)) {
      seenIcons.add(event.icon);
      customIcons.push(event.icon);
      if (event.title) titles.push(event.title.replace(/^[^\w\s]+\s*/, '')); // Remove leading emoji from title
    }
  }
  
  if (customIcons.length > 0) {
    const title = titles.length > 0 ? titles.join(' • ') : 'Events on this date';
    return `<div class="day-event-icon" title="${title}">${customIcons.join('')}</div>`;
  }
  
  // Fall back to generic icons if no custom icons
  // Check if any events are historical (year-specific)
  const hasHistorical = events.some(e => e.condition && e.condition.startsWith('year_'));
  // Check if any events are biblical (no condition, cycle-based, or moon phase)
  const hasBiblical = events.some(e => 
    !e.condition || 
    e.condition === 'sabbath_year' || 
    e.condition === 'jubilee_year' || 
    e.condition === 'sabbath_or_jubilee' ||
    (e.condition && e.condition.startsWith('moonPhase_'))
  );
  
  // Build icon string with both if applicable
  let icons = [];
  if (hasHistorical) icons.push('📰');
  if (hasBiblical) icons.push('📜');
  
  if (icons.length === 0) return '';
  
  const title = hasHistorical && hasBiblical 
    ? 'Historical and Biblical events on this date' 
    : hasHistorical 
      ? 'Historical event on this date' 
      : 'Biblical event on this date';
  
  return `<div class="day-event-icon" title="${title}">${icons.join('')}</div>`;
}

// Get current view time (UTC)
function getViewTime() {
  if (!state.viewTime) {
    return new Date();  // Current UTC time
  }
  return new Date(state.viewTime);
}

// Update time display in header
function updateTimeDisplay() {
  const timeDisplay = document.getElementById('header-time-display');
  if (!timeDisplay) return;
  
  // Get local time at the current location
  const localTime = getLocalTimeForLocation(state.lat, state.lon);
  timeDisplay.innerHTML = `<span>${localTime}</span><span class="dropdown-arrow">▼</span>`;
}

// Find moon events (full, dark, or crescent) for a given year
function findMoonEvents(year, phaseType) {
  const engine = getAstroEngine();
  const events = [];
  
  // Create dates with proper year handling for ancient dates
  // JavaScript Date constructor doesn't handle negative years correctly
  let searchDate = new Date(Date.UTC(2000, 11, 1));
  searchDate.setUTCFullYear(year - 1);
  
  let endDate = new Date(Date.UTC(2000, 5, 1));
  endDate.setUTCFullYear(year + 1); // Search through May of next year to cover full lunar year
  
  // Moon phase angles: 0 = new/dark, 90 = first quarter, 180 = full, 270 = last quarter
  let targetPhase;
  if (phaseType === 'full') {
    targetPhase = 180;
  } else if (phaseType === 'dark') {
    targetPhase = 0;
  } else if (phaseType === 'crescent') {
    targetPhase = 0; // We'll find conjunction then calculate first visibility
  }
  
  while (searchDate < endDate) {
    const result = engine.searchMoonPhase(targetPhase, searchDate, 40);
    if (result) {
      let eventDate = result.date;
      
      // For crescent, add offset to conjunction to create a "forged conjunction" time
      // This represents when the crescent becomes visible, treated as if it were the conjunction
      // The rest of the algorithm (before/after sunset check) works the same as dark moon
      // - 12h: Optimistic (perfect conditions + optical aids)
      // - 15.5h: Minimum viable (naked-eye record)
      // - 18h: Typical (standard naked-eye visibility)
      // - 24h: Conservative (easily visible to anyone)
      if (phaseType === 'crescent') {
        const conjunction = result.date;
        const crescentOffsetHours = state.crescentThreshold;
        eventDate = new Date(conjunction.getTime() + crescentOffsetHours * 60 * 60 * 1000);
      }
      
      events.push(eventDate);
      searchDate = new Date(result.date.getTime() + 20 * 24 * 60 * 60 * 1000);
    } else break;
  }
  return events;
}

// Build lunar months from moon events
function buildLunarMonths(nissanMoon, allMoonEvents, springEquinox, nextYearStartPoint) {
  const months = [];
  
  // Use fuzzy timestamp comparison (within 1 second) to handle potential Date object differences
  let startIdx = allMoonEvents.findIndex(m => Math.abs(m.getTime() - nissanMoon.getTime()) < 1000);
  if (startIdx === -1) startIdx = allMoonEvents.findIndex(m => m >= nissanMoon);
  if (startIdx === -1) startIdx = 0; // Final fallback to first event
  
  // Get observer's longitude for local time calculation
  const observerLon = parseFloat(document.getElementById('lon-input')?.value) || 35.2137;
  
  
  for (let m = 0; m < 13 && (startIdx + m) < allMoonEvents.length - 1; m++) {
    const moonEvent = allMoonEvents[startIdx + m];
    
    // Stop if this moon event is after the next year's start point (belongs to next year)
    if (moonEvent >= nextYearStartPoint) break;
    
    const nextMoonEvent = allMoonEvents[startIdx + m + 1];
    
    // Calculate local date of moon event based on observer's longitude
    const moonEventLocalDate = getLocalDateFromUTC(moonEvent, observerLon);
    
    // Determine when Day 1 starts based on day start settings
    // General rule: Day 1 starts at the NEXT day start after the moon event
    let monthStartDate = new Date(moonEventLocalDate.getTime());
    
    // For dark/full/crescent moon with evening day start, check if moon event is before or after sunset
    if ((state.moonPhase === 'dark' || state.moonPhase === 'full' || state.moonPhase === 'crescent') && state.dayStartTime === 'evening') {
      // Get sunset time on the moon event's local date
      const sunsetOnMoonDate = getSunsetTimestamp(moonEventLocalDate);
      
      // Convert times to local for comparison
      const moonEventLocalTime = moonEvent.getTime() + (observerLon / 15) * 60 * 60 * 1000;
      const sunsetLocalTime = sunsetOnMoonDate + (observerLon / 15) * 60 * 60 * 1000;
      
      // Day 1 starts at the NEXT sunset after the moon event
      // - If moon event is AFTER sunset on its calendar date → next sunset is tomorrow → add 1 day
      // - Otherwise (before sunset, including early morning before sunrise) → next sunset is today → add 0 days
      if (moonEventLocalTime > sunsetLocalTime) {
        // Moon event is AFTER sunset - Day 1 starts at next day's sunset
        monthStartDate.setUTCDate(monthStartDate.getUTCDate() + 1);
      }
      // If moon event is before sunset (including early morning), Day 1 starts at same day's sunset (add 0 days)
    } else if ((state.moonPhase === 'dark' || state.moonPhase === 'full' || state.moonPhase === 'crescent') && state.dayStartTime === 'morning') {
      // For morning day start, check if moon event is before or after sunrise
      const sunriseOnMoonDate = getSunriseTimestamp(moonEventLocalDate);
      
      // Convert moon event to local time at observer's longitude for comparison
      const moonEventLocalTime = moonEvent.getTime() + (observerLon / 15) * 60 * 60 * 1000;
      const sunriseLocalTime = sunriseOnMoonDate + (observerLon / 15) * 60 * 60 * 1000;
      
      if (moonEventLocalTime >= sunriseLocalTime) {
        // Moon event is AT or AFTER sunrise - Day 1 starts at next sunrise (add 1 day)
        monthStartDate.setUTCDate(monthStartDate.getUTCDate() + 1);
      }
      // If moon event is BEFORE sunrise, Day 1 starts at same day's sunrise (add 0 days)
    } else {
      // For other modes, just add 1 day
      monthStartDate.setUTCDate(monthStartDate.getUTCDate() + 1);
    }
    
    // Same logic for next month start
    const nextMoonEventLocalDate = getLocalDateFromUTC(nextMoonEvent, observerLon);
    let nextMonthStart = new Date(nextMoonEventLocalDate.getTime());
    
    if ((state.moonPhase === 'dark' || state.moonPhase === 'full' || state.moonPhase === 'crescent') && state.dayStartTime === 'evening') {
      const sunsetOnNextMoonDate = getSunsetTimestamp(nextMoonEventLocalDate);
      const nextMoonEventLocalTime = nextMoonEvent.getTime() + (observerLon / 15) * 60 * 60 * 1000;
      const nextSunsetLocalTime = sunsetOnNextMoonDate + (observerLon / 15) * 60 * 60 * 1000;
      
      // Day 1 starts at the NEXT sunset after the moon event
      if (nextMoonEventLocalTime > nextSunsetLocalTime) {
        // Moon event is AFTER sunset - Day 1 starts at next day's sunset
        nextMonthStart.setUTCDate(nextMonthStart.getUTCDate() + 1);
      }
      // If moon event is before sunset, Day 1 starts at same day's sunset (add 0 days)
    } else if ((state.moonPhase === 'dark' || state.moonPhase === 'full' || state.moonPhase === 'crescent') && state.dayStartTime === 'morning') {
      // For morning day start, check if moon event is before or after sunrise
      const sunriseOnNextMoonDate = getSunriseTimestamp(nextMoonEventLocalDate);
      const nextMoonEventLocalTime = nextMoonEvent.getTime() + (observerLon / 15) * 60 * 60 * 1000;
      const nextSunriseLocalTime = sunriseOnNextMoonDate + (observerLon / 15) * 60 * 60 * 1000;
      
      if (nextMoonEventLocalTime >= nextSunriseLocalTime) {
        // Moon event is AT or AFTER sunrise - add 1 day
        nextMonthStart.setUTCDate(nextMonthStart.getUTCDate() + 1);
      }
      // If moon event is BEFORE sunrise, starts at same day's sunrise (add 0 days)
    } else {
      nextMonthStart.setUTCDate(nextMonthStart.getUTCDate() + 1);
    }
    
    const daysInMonth = Math.round((nextMonthStart - monthStartDate) / (24 * 60 * 60 * 1000));
    
    // Calculate date uncertainty for this month
    // ΔT uncertainty affects the calculated time of the moon event (conjunction, full, or forged crescent).
    // If the moon event is close to the day boundary (sunset for evening start, sunrise for morning start),
    // the uncertainty could shift whether Day 1 starts on this date or the next.
    // Direction: '+' means dates could be 1 day later, '-' means 1 day earlier
    let dateUncertainty = null; // null, '+', or '-'
    let dateUncertaintyProbability = 0; // Probability that dates are wrong (0-100%)
    
    const eventYear = moonEvent.getUTCFullYear();
    const uncertaintyHours = AstroEngines.nasaEclipse.getDeltaTUncertainty(eventYear);
    
    if (uncertaintyHours > 0) {
      const moonEventLocalTime = moonEvent.getTime() + (observerLon / 15) * 60 * 60 * 1000;
      
      // Get the day boundary time based on day start setting
      let boundaryTime, boundaryLocalTime;
      if (state.dayStartTime === 'evening') {
        boundaryTime = getSunsetTimestamp(moonEventLocalDate);
      } else {
        boundaryTime = getSunriseTimestamp(moonEventLocalDate);
      }
      
      if (boundaryTime != null) {
        boundaryLocalTime = boundaryTime + (observerLon / 15) * 60 * 60 * 1000;
        const marginMs = Math.abs(moonEventLocalTime - boundaryLocalTime);
        const marginHours = marginMs / (1000 * 60 * 60);
        
        if (marginHours <= uncertaintyHours) {
          // Calculate probability that the date is wrong
          // If margin is M and uncertainty is ±U, probability = (U - M) / (2U)
          dateUncertaintyProbability = Math.round(((uncertaintyHours - marginHours) / (2 * uncertaintyHours)) * 100);
          
          // Moon event after boundary - prior month has 30 days
          // If moon event was actually earlier, prior month would have 29 days
          // So dates in THIS month could be 1 day earlier (-)
          if (moonEventLocalTime >= boundaryLocalTime) {
            dateUncertainty = '-';
          } else {
            // Moon event before boundary - prior month has 29 days  
            // If moon event was actually later, prior month would have 30 days
            // So dates in THIS month could be 1 day later (+)
            dateUncertainty = '+';
          }
        }
      }
    }
    
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(monthStartDate.getTime());
      dayDate.setUTCDate(dayDate.getUTCDate() + d - 1);
      
      const isSabbath = [8, 15, 22, 29].includes(d);
      const isNewMoon = d === 1;
      // Day 30 with '+' is impossible (can't add days), so only show uncertainty for days 1-29 with '+', or all days with '-'
      const isUncertain = dateUncertainty !== null && (dateUncertainty === '-' || d < 30);
      
      // Find all feasts for this day (some days have multiple)
      let feasts = [];
      for (const f of FEASTS) {
        if (f.month === (m + 1)) {
          if (f.endDay) {
            if (d >= f.day && d <= f.endDay) {
              const dayNum = f.startDayNum ? (f.startDayNum + d - f.day) : (d - f.day + 1);
              feasts.push({ feast: f, dayNum });
            }
          } else if (d === f.day) {
            feasts.push({ feast: f, dayNum: null });
          }
        }
      }
      // For backwards compatibility
      const feast = feasts.length > 0 ? feasts[0].feast : null;
      const feastDayNum = feasts.length > 0 ? feasts[0].dayNum : null;
      
      // Calculate moon phase for this day
      // For Day 1, force the icon based on mode (since Day 1 IS the phase by definition)
      // For other days, calculate from astronomical position
      let moonPhase = '';
      if (d === 1) {
        // Day 1 always shows the mode-defining phase
        if (state.moonPhase === 'full') moonPhase = '🌕';
        else if (state.moonPhase === 'dark') moonPhase = '🌑';
        else if (state.moonPhase === 'crescent') moonPhase = '🌒';
      } else {
        moonPhase = getMoonPhaseIconForDate(dayDate);
      }
      
      // Check if spring equinox falls on this day
      const dayStart = dayDate.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      let equinox = null;
      if (springEquinox && springEquinox.getTime() >= dayStart && springEquinox.getTime() < dayEnd) {
        equinox = { type: 'spring', date: springEquinox };
      } else if (state.nextSpringEquinox && state.nextSpringEquinox.getTime() >= dayStart && state.nextSpringEquinox.getTime() < dayEnd) {
        equinox = { type: 'spring', date: state.nextSpringEquinox };
      }
      
      // Check if there's a lunar eclipse (blood moon) - only on days with a full moon icon
      // For Day 1 in full moon mode, check against the month's moon event date
      let isBloodMoon = false;
      if (moonPhase === '🌕') {
        const checkDate = (d === 1 && moonEvent) ? moonEvent : dayDate;
        isBloodMoon = AstroEngines.nasaEclipse.hasLunarEclipse(checkDate);
      }
      
      days.push({
        lunarDay: d,
        gregorianDate: dayDate,
        isSabbath,
        isNewMoon,
        isUncertain,  // True if this day (Day 30) might not exist due to ΔT uncertainty
        feast,
        feastDayNum,
        feasts,  // Array of all feasts for this day
        moonPhase,
        equinox,  // Spring equinox if it falls on this day
        isBloodMoon  // True if there's a lunar eclipse on this day
      });
    }
    
    months.push({
      monthNumber: m + 1,
      name: MONTH_NAMES[m] || `Month ${m + 1}`,
      startDate: monthStartDate,
      moonEvent: moonEvent,
      daysInMonth,
      dateUncertainty,  // '+', '-', or null - direction dates could be off
      dateUncertaintyProbability,  // 0-100% probability that dates are wrong
      days
    });
  }
  
  return months;
}

// Generate calendar for the current year
function generateCalendar(options = {}) {
  const preserveSelection = options.preserveMonth || false;
  const preserveMonthIndex = options.preserveMonthIndex || false;
  
  // Save the selected UTC timestamp before regenerating
  const savedTimestamp = state.selectedTimestamp;
  
  // Save the current month index for year changes
  const savedMonthIndex = state.currentMonthIndex;
  
  // State is source of truth - update UI inputs to match state
  const yearInput = document.getElementById('year-input');
  const latInput = document.getElementById('lat-input');
  const lonInput = document.getElementById('lon-input');
  const moonPhaseSelect = document.getElementById('moon-phase-select');
  
  // Update year input to match state (state is source of truth)
  if (yearInput) {
    yearInput.value = state.year;
  }
  if (latInput && lonInput) {
    latInput.value = state.lat ?? 31.7683;
    lonInput.value = state.lon ?? 35.2137;
  }
  if (moonPhaseSelect) {
    moonPhaseSelect.value = state.moonPhase;
  }
  
  if (!preserveSelection && !preserveMonthIndex) {
    state.currentMonthIndex = 0;
    state.highlightedLunarDay = 1;  // Default to day 1
    state.selectedTimestamp = null;
  }
  
  // Save settings to localStorage
  saveState();
  
  // Update all UI to match state
  updateUI();
  
  const engine = getAstroEngine();
  const springEquinox = engine.getSeasons(state.year).mar_equinox.date;
  const nextSpringEquinox = engine.getSeasons(state.year + 1).mar_equinox.date;
  const moonEvents = findMoonEvents(state.year, state.moonPhase);
  
  // Get year start point based on yearStartRule setting
  const yearStartPoint = getYearStartPoint(state.year);
  const nextYearStartPoint = getYearStartPoint(state.year + 1);
  
  // Find first moon event on or after the year start point
  // The resulting month's Day 1 must start after the year start point
  let nissanMoon = moonEvents.find(m => m >= yearStartPoint);
  if (!nissanMoon) nissanMoon = moonEvents[0];
  
  // Calculate year-start uncertainty
  // If the Nisan moon is close to the year start point, ΔT uncertainty could cause
  // a different moon to be selected, shifting all months by ~29-30 days
  const yearStartMarginMs = nissanMoon.getTime() - yearStartPoint.getTime();
  const yearStartMarginHours = yearStartMarginMs / (1000 * 60 * 60);
  const deltaTUncertaintyHours = AstroEngines.nasaEclipse.getDeltaTUncertainty(state.year);
  
  let yearStartUncertainty = null;
  if (deltaTUncertaintyHours > 0 && yearStartMarginHours <= deltaTUncertaintyHours) {
    // The Nisan moon is close enough to the year start that it could be uncertain
    // If the moon shifts earlier due to ΔT error, it could fall BEFORE the year start point
    // In that case, the NEXT moon would be Nisan instead, so our year is "1 month ahead"
    // Probability: (U - M) / (2U) where U = uncertainty, M = margin
    const probability = Math.round(((deltaTUncertaintyHours - yearStartMarginHours) / (2 * deltaTUncertaintyHours)) * 100);
    if (probability > 0) {
      yearStartUncertainty = {
        direction: 'ahead',  // Our dates are potentially 1 month ahead of reality
        probability: probability,
        marginHours: yearStartMarginHours
      };
    }
  }
  
  // Store equinoxes and year start points in state for use in day details
  state.springEquinox = springEquinox;
  state.nextSpringEquinox = nextSpringEquinox;
  state.yearStartPoint = yearStartPoint;
  state.nextYearStartPoint = nextYearStartPoint;
  state.yearStartUncertainty = yearStartUncertainty;
  
  state.lunarMonths = buildLunarMonths(nissanMoon, moonEvents, springEquinox, nextYearStartPoint);
  
  // Guard against empty months array
  if (state.lunarMonths.length === 0) {
    console.error('No lunar months generated - check moon event data');
    console.error('nissanMoon:', nissanMoon);
    console.error('moonEvents count:', moonEvents.length);
    console.error('yearStartPoint:', yearStartPoint);
    console.error('nextYearStartPoint:', nextYearStartPoint);
    return;
  }
  
  // If preserving selection, find which lunar day contains the saved UTC timestamp
  if (preserveSelection && savedTimestamp) {
    const savedMoment = new Date(savedTimestamp);
    let found = false;
    
    for (let m = 0; m < state.lunarMonths.length && !found; m++) {
      const month = state.lunarMonths[m];
      for (let d = 0; d < month.days.length; d++) {
        const day = month.days[d];
        const dayStart = day.gregorianDate.getTime();
        // Day ends at start of next day (24 hours later)
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        
        if (savedTimestamp >= dayStart && savedTimestamp < dayEnd) {
          state.currentMonthIndex = m;
          state.highlightedLunarDay = day.lunarDay;
          // Update the goto-date input to show local time at new location
          document.getElementById('goto-date').value = formatLocalDatetime(savedTimestamp);
          found = true;
          break;
        }
      }
    }
    // If timestamp not found in lunar months, just stay on month 0
    if (!found) {
      state.currentMonthIndex = 0;
      state.highlightedLunarDay = 1;  // Default to day 1
    }
  }
  
  // If preserving month index (for year changes), restore the saved month index
  // Only fall back to month 12 if we were on month 13 and new year doesn't have it
  if (preserveMonthIndex) {
    const maxMonthIndex = state.lunarMonths.length - 1;
    if (savedMonthIndex <= maxMonthIndex) {
      // Can keep the same month
      state.currentMonthIndex = savedMonthIndex;
    } else {
      // Was on month 13 (index 12) but new year only has 12 months
      // Fall back to month 12 (index 11)
      state.currentMonthIndex = maxMonthIndex;
    }
    state.highlightedLunarDay = 1;  // Default to day 1 of the preserved month
    state.selectedTimestamp = null;
  }
  
  renderMonthButtons();
  renderMonth(state.lunarMonths[state.currentMonthIndex]);
  renderFeastTable(state.lunarMonths);
  
  // Show day detail panel if a day is highlighted
  if (state.highlightedLunarDay) {
    const month = state.lunarMonths[state.currentMonthIndex];
    const dayObj = month.days.find(d => d.lunarDay === state.highlightedLunarDay);
    if (dayObj) {
      showDayDetail(dayObj, month);
    }
  }
}

// Navigate calendar to a specific timestamp (UTC)
function navigateToTimestamp(utcTimestamp, targetYear, targetMonth, targetDay) {
  // Determine which lunar year this date belongs to
  const springEquinox = getAstroEngine().getSeasons(targetYear).mar_equinox.date;
  const lunarYear = utcTimestamp < springEquinox.getTime() ? targetYear - 1 : targetYear;
  
  // Update state year
  state.year = lunarYear;
  
  // Update UI
  updateUI();
  
  // Generate calendar for this lunar year
  generateCalendar();
  
  // Find the target date in the generated months
  for (let m = 0; m < state.lunarMonths.length; m++) {
    const month = state.lunarMonths[m];
    for (let d = 0; d < month.days.length; d++) {
      const day = month.days[d];
      const gd = day.gregorianDate;
      if (gd.getFullYear() === targetYear && 
          gd.getMonth() === targetMonth && 
          gd.getDate() === targetDay) {
        state.currentMonthIndex = m;
        state.highlightedLunarDay = day.lunarDay;
        state.selectedTimestamp = utcTimestamp;  // Update selectedTimestamp
        renderMonth(state.lunarMonths[state.currentMonthIndex]);
        showDayDetail(day, month);  // Show day detail with updated timestamp
        updateURL();
        return;
      }
    }
  }
  
  // If not found, just render the first month
  state.currentMonthIndex = 0;
  state.highlightedLunarDay = 1;
  if (state.lunarMonths.length > 0) {
    renderMonth(state.lunarMonths[0]);
  }
  updateURL();
}

// Update month button active states
function updateMonthButtons() {
  const buttons = document.querySelectorAll('.month-btn');
  buttons.forEach((btn, i) => {
    btn.classList.toggle('active', i === state.currentMonthIndex);
  });
}

// Render month navigation buttons
function renderMonthButtons() {
  const container = document.getElementById('month-buttons');
  container.innerHTML = '';
  
  const has13Months = state.lunarMonths.length >= 13;
  
  // Month buttons 1-12 (always show)
  for (let i = 0; i < 12; i++) {
    const btn = document.createElement('button');
    btn.className = 'month-btn' + (i === state.currentMonthIndex ? ' active' : '');
    if (i >= state.lunarMonths.length) {
      btn.classList.add('disabled');
      btn.disabled = true;
    }
    btn.textContent = i + 1;
    btn.onclick = () => selectMonth(i);
    container.appendChild(btn);
  }
  
  // Month 13 button - only show if year has 13 months (no calendar icon, just the number)
  if (has13Months) {
    const btn13 = document.createElement('button');
    btn13.className = 'month-btn' + (12 === state.currentMonthIndex ? ' active' : '');
    btn13.textContent = '13';
    btn13.title = 'Intercalary 13th month';
    btn13.onclick = () => selectMonth(12);
    container.appendChild(btn13);
  }
}

// Render a month calendar view
function renderMonth(month) {
  const scripture = SCRIPTURES[month.monthNumber % SCRIPTURES.length];
  
  const container = document.getElementById('calendar-output');
  
  // Get today's date for comparison at the state location
  // Use the same method as jumpToToday() for consistency
  const nowUtc = new Date();
  const localDateAtLocation = utcToLocalTime(nowUtc.getTime(), state.lon);
  const todayYear = localDateAtLocation.getUTCFullYear();
  const todayMonth = localDateAtLocation.getUTCMonth();
  const todayDay = localDateAtLocation.getUTCDate();
  
  // Day 1 is New Moon shown in header
  // Days 2-8 form the first week, 9-15 second week, etc.
  // Sabbath (days 8, 15, 22, 29) is always in the rightmost column
  
  // Find Day 2's Gregorian weekday to determine the weekday labels
  const day2 = month.days.find(d => d.lunarDay === 2);
  const day2Weekday = day2 ? getCorrectWeekday(day2.gregorianDate) : 0;
  
  // Generate weekday labels starting from Day 2's weekday
  const weekdayNames = ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.'];
  const shiftedWeekdays = [];
  for (let i = 0; i < 7; i++) {
    shiftedWeekdays.push(weekdayNames[(day2Weekday + i) % 7]);
  }
  
  // Determine which column header should be highlighted as Sabbath
  // For lunar sabbath: always column 7 (days 8, 15, 22, 29)
  // For weekday sabbaths: find which column corresponds to that weekday
  let sabbathColumnIndex = -1;
  if (state.sabbathMode === 'lunar') {
    sabbathColumnIndex = 6; // Column 7 (0-indexed)
  } else if (['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(state.sabbathMode)) {
    // Find which column has the sabbath weekday
    const sabbathWeekdayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const sabbathWeekday = sabbathWeekdayMap[state.sabbathMode];
    // Day 2's weekday is in column 0, so find which column has the sabbath weekday
    for (let col = 0; col < 7; col++) {
      if ((day2Weekday + col) % 7 === sabbathWeekday) {
        sabbathColumnIndex = col;
        break;
      }
    }
  }
  
  // Generate day labels (Day 1 through Day 7)
  // For fixed weekday sabbaths, the sabbath column is always "Day 7"
  // For lunar sabbath, column 6 is always "Day 7"
  const getDayLabel = (colIndex) => {
    if (sabbathColumnIndex === -1) return colIndex + 1; // No sabbath mode
    // Calculate day number so sabbath column is always Day 7
    return ((colIndex - sabbathColumnIndex - 1 + 7) % 7) + 1;
  };
  
  // Get Day 1 info for header
  const day1 = month.days.find(d => d.lunarDay === 1);
  const day1UncertaintySuffix = (day1 && day1.isUncertain) ? month.dateUncertainty : '';
  const day1Date = day1 ? formatShortDate(day1.gregorianDate) + day1UncertaintySuffix : '';
  const day1Year = day1 ? formatYear(day1.gregorianDate.getUTCFullYear()) : '';
  const day1Weekday = day1 ? weekdayNames[getCorrectWeekday(day1.gregorianDate)] : '';
  
  // Check for feasts and equinox on day 1
  let day1FeastIcons = '';
  if (day1) {
    const icons = [];
    if (day1.feasts && day1.feasts.length > 0) {
      icons.push(...new Set(day1.feasts.map(f => f.feast.icon)));
    }
    if (day1.equinox) {
      icons.push('☀️⚖️');
    }
    if (icons.length > 0) {
      day1FeastIcons = `<div class="feast-icons">${icons.join('')}</div>`;
    }
  }
  
  // Check for ΔT uncertainty warning on Day 1 (use the already-calculated flag)
  const day1UncertaintyIndicator = (day1 && day1.isUncertain) ? 'uncertain' : '';
  
  // Blood moon styling for Day 1
  const day1BloodMoonClass = (day1 && day1.isBloodMoon) ? ' blood-moon' : '';
  
  // Check if Day 1 is today (compare using local date methods for consistency with jumpToToday)
  const day1IsToday = day1 && 
    day1.gregorianDate.getFullYear() === todayYear && 
    day1.gregorianDate.getMonth() === todayMonth && 
    day1.gregorianDate.getDate() === todayDay;
  
  // Get event icon for Day 1
  const day1EventIcon = day1 ? getDayEventIcon(month.monthNumber, 1, day1.gregorianDate.getUTCFullYear()) : '';
  
  // Calculate daylight percentage for day cycle bar based on Day 1's sunrise/sunset
  let daylightHours = 12; // default if we can't calculate
  let dayCycleGradient = '';
  if (day1 && day1.gregorianDate) {
    try {
      const sunriseTs = getSunriseTimestamp(day1.gregorianDate);
      const sunsetTs = getSunsetTimestamp(day1.gregorianDate);
      if (sunriseTs != null && sunsetTs != null && !isNaN(sunriseTs) && !isNaN(sunsetTs)) {
        const hours = (sunsetTs - sunriseTs) / (1000 * 60 * 60);
        if (hours > 0 && hours < 24) {
          daylightHours = hours;
        }
      }
    } catch (e) {
      console.warn('Could not calculate daylight hours:', e);
    }
  }
  
  // Clamp daylight hours to reasonable range (6-18 hours covers all latitudes/seasons)
  daylightHours = Math.max(6, Math.min(18, daylightHours));
  
  // Convert hours to percentages of 24-hour day
  const twilightHours = 1.5;
  const nightHours = 24 - daylightHours;
  
  const twi = (twilightHours / 24) * 100;  // ~6.25%
  const day = (daylightHours / 24) * 100;
  const night = (nightHours / 24) * 100;
  
  // Generate gradient based on day start time
  // Twilight transitions (~1.5hr) occur AT sunrise and sunset, not during day/night
  // Add small offset (1%) to make gradient start visible at edge
  const offset = 1;
  const twilight = twi * 2; // Full transition width (dawn or dusk)
  
  if (state.dayStartTime === 'evening') {
    // Evening start: 0% = sunset
    // Day just ended, dusk transition starts immediately
    const duskEnd = twilight - offset;
    const dawnStart = night - twilight + offset;
    const dawnEnd = night + twilight - offset;
    
    dayCycleGradient = `repeating-linear-gradient(90deg, 
      #7ab3d4 0%, 
      #0d1a2d ${duskEnd}%, 
      #0d1a2d ${dawnStart}%, 
      #7ab3d4 ${dawnEnd}%, 
      #7ab3d4 100%)`;
  } else {
    // Morning start: 0% = first light (dawn)
    // Night just ended, dawn transition starts immediately
    const dawnEnd = twilight - offset;
    const duskStart = day - twilight + offset;
    const duskEnd = day + twilight - offset;
    
    dayCycleGradient = `repeating-linear-gradient(90deg, 
      #0d1a2d 0%, 
      #7ab3d4 ${dawnEnd}%, 
      #7ab3d4 ${duskStart}%, 
      #0d1a2d ${duskEnd}%, 
      #0d1a2d 100%)`;
  }
  
  const daylightPercent = Math.round(day);
  
  // Get the year the lunar year started (from first month's day 1)
  const firstMonth = state.lunarMonths[0];
  const firstDay1 = firstMonth ? firstMonth.days.find(d => d.lunarDay === 1) : null;
  const lunarYearStart = firstDay1 ? firstDay1.gregorianDate.getUTCFullYear() : state.year;
  const displayYear = formatYear(lunarYearStart);
  
  // Sync state.year with actual lunar year start (fixes URL/display mismatch)
  if (lunarYearStart !== state.year) {
    state.year = lunarYearStart;
  }
  
  // Update the top nav profile selector
  updateTopNavProfile();
  
  let html = `
    <div class="month-calendar">
      <div class="calendar-header">
        <!-- Row 1: Jubilee Indicator -->
        <div class="header-row-1">
          ${renderJubileeIndicator(lunarYearStart)}
        </div>
        
        <!-- Row 2: Year | Month | Time | Location -->
        <div class="header-row-2">
          <div class="header-dropdown year" onclick="toggleYearPicker(event)" title="Change year">
            <span>${displayYear}</span>
            <span class="dropdown-arrow">▼</span>
          </div>
          <span class="header-separator">|</span>
          <div class="header-dropdown month" onclick="toggleMonthPicker(event)" title="Change month">
            <span>${month.name}</span>
            <span class="dropdown-arrow">▼</span>
          </div>
          <span class="header-separator">|</span>
          <div class="header-dropdown time" id="header-time-display" onclick="showTimePicker(event)" title="Set date time"></div>
          <span class="header-separator">|</span>
          <div class="header-dropdown location" onclick="openLocationPicker()" title="Change location">
            <span>${getCurrentLocationName()}</span>
            <span class="dropdown-arrow">▼</span>
          </div>
        </div>
        
        <div class="new-moon-box day-cell new-moon${state.highlightedLunarDay === 1 ? ' highlighted' : ''}${day1 && day1.feasts && day1.feasts.length > 0 ? ' feast' : ''}${day1 && isSabbath(day1) ? ' sabbath' : ''}${day1UncertaintyIndicator ? ' date-uncertain' : ''}${day1IsToday ? ' today' : ''}" data-date="${day1 ? day1.gregorianDate.toISOString().split('T')[0] : ''}" data-lunar-day="1" title="${day1 && day1.isBloodMoon ? '🔴 Blood Moon (Lunar Eclipse)' : ''}">
          <div class="gregorian">${day1Date}<span class="day-year">${day1Year}</span></div>
          <div class="moon-phase${day1BloodMoonClass}">${day1 ? day1.moonPhase : ''}</div>
          <div class="lunar-day">1</div>
          ${day1FeastIcons}
          ${day1EventIcon}
        </div>
      </div>
      ${state.yearStartUncertainty ? `
      <div class="year-uncertainty-banner" title="The first moon of the year is close to the year start boundary. ΔT uncertainty of ${Math.round(AstroEngines.nasaEclipse.getDeltaTUncertainty(state.year))} hours means this could be the wrong year.">
        ⚠️ ${state.yearStartUncertainty.probability}% chance 1 month ${state.yearStartUncertainty.direction}
      </div>
      ` : ''}
      <div class="week-header">
        <div class="day-label${sabbathColumnIndex === 0 ? ' sabbath-header' : ''}"><div class="day-name">Day ${getDayLabel(0)}</div><div class="weekday">${shiftedWeekdays[0]}</div></div>
        <div class="day-label${sabbathColumnIndex === 1 ? ' sabbath-header' : ''}"><div class="day-name">Day ${getDayLabel(1)}</div><div class="weekday">${shiftedWeekdays[1]}</div></div>
        <div class="day-label${sabbathColumnIndex === 2 ? ' sabbath-header' : ''}"><div class="day-name">Day ${getDayLabel(2)}</div><div class="weekday">${shiftedWeekdays[2]}</div></div>
        <div class="day-label${sabbathColumnIndex === 3 ? ' sabbath-header' : ''}"><div class="day-name">Day ${getDayLabel(3)}</div><div class="weekday">${shiftedWeekdays[3]}</div></div>
        <div class="day-label${sabbathColumnIndex === 4 ? ' sabbath-header' : ''}"><div class="day-name">Day ${getDayLabel(4)}</div><div class="weekday">${shiftedWeekdays[4]}</div></div>
        <div class="day-label${sabbathColumnIndex === 5 ? ' sabbath-header' : ''}"><div class="day-name">Day ${getDayLabel(5)}</div><div class="weekday">${shiftedWeekdays[5]}</div></div>
        <div class="day-label${sabbathColumnIndex === 6 ? ' sabbath-header' : ''}"><div class="day-name">Day ${getDayLabel(6)}</div><div class="weekday">${shiftedWeekdays[6]}</div></div>
      </div>
      
      <div class="day-cycle-bar" style="background: ${dayCycleGradient}; background-size: calc(100% / 7) 100%;" title="Day/night cycle (~${daylightPercent}% daylight): Each column shows ${state.dayStartTime === 'evening' ? 'sunset → night → day → sunset' : 'dawn → day → night → dawn'}"></div>
      
      <div class="calendar-grid">
  `;
  
  // Build rows by lunar week structure: 2-8, 9-15, 16-22, 23-29
  // The last row (day 30 + scripture) is handled separately
  const lunarWeeks = [
    [2, 3, 4, 5, 6, 7, 8],
    [9, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22],
    [23, 24, 25, 26, 27, 28, 29]
  ];
  
  for (const week of lunarWeeks) {
    for (const lunarDay of week) {
      const day = month.days.find(d => d.lunarDay === lunarDay);
      
      if (!day) {
        // Day doesn't exist in this month
        html += `<div class="day-cell empty"></div>`;
        continue;
      }
      
      let classes = ['day-cell'];
      // Determine if this day is a sabbath based on sabbathMode
      const isSabbathDay = isSabbath(day);
      if (isSabbathDay) classes.push('sabbath');
      if (day.isNewMoon) classes.push('new-moon');
      if (day.feasts && day.feasts.length > 0) classes.push('feast');
      if (day.lunarDay === state.highlightedLunarDay) classes.push('highlighted');
      if (day.isUncertain) classes.push('date-uncertain');
      
      // Check if this day is today (compare using local date methods for consistency)
      if (day.gregorianDate.getFullYear() === todayYear && 
          day.gregorianDate.getMonth() === todayMonth && 
          day.gregorianDate.getDate() === todayDay) {
        classes.push('today');
      }
      
      let feastLabel = '';
      const icons = [];
      if (day.feasts && day.feasts.length > 0) {
        // Show icons for feasts (unique icons only)
        icons.push(...new Set(day.feasts.map(f => f.feast.icon)));
      }
      // Add equinox icon if applicable
      if (day.equinox) {
        icons.push('☀️⚖️');
      }
      if (icons.length > 0) {
        feastLabel = `<div class="feast-icons">${icons.join('')}</div>`;
      }
      
      // Format date for data attribute (YYYY-MM-DD)
      const dateStr = day.gregorianDate.toISOString().split('T')[0];
      let titleText = day.feasts && day.feasts.length > 0 
        ? day.feasts.map(f => f.feast.name + ': ' + f.feast.description).join(' | ')
        : '';
      
      // Add uncertainty suffix to date display
      const uncertaintySuffix = day.isUncertain ? month.dateUncertainty : '';
      if (day.isUncertain) {
        const prob = month.dateUncertaintyProbability || 0;
        titleText = (titleText ? titleText + ' | ' : '') + 
          `~${prob}% chance date is 1 day ${month.dateUncertainty === '+' ? 'later' : 'earlier'}`;
      }
      
      const isHighlighted = day.lunarDay === state.highlightedLunarDay;
      const bloodMoonClass = day.isBloodMoon ? ' blood-moon' : '';
      // Use red full moon emoji for blood moon, or add title
      const bloodMoonTitle = day.isBloodMoon ? ' | 🔴 Blood Moon (Lunar Eclipse)' : '';
      
      // Get event icon for this day
      const gregorianYear = day.gregorianDate.getUTCFullYear();
      const eventIcon = getDayEventIcon(month.monthNumber, day.lunarDay, gregorianYear);
      
      html += `
        <div class="${classes.join(' ')}" data-date="${dateStr}" title="${titleText}${bloodMoonTitle}">
          <div class="gregorian">${formatShortDate(day.gregorianDate)}${uncertaintySuffix}</div>
          <div class="moon-phase${bloodMoonClass}">${day.moonPhase}</div>
          <div class="lunar-day">${day.lunarDay}</div>
          ${feastLabel}
          ${eventIcon}
        </div>
      `;
    }
  }
  
  // Last row: Day 30 (or spacer) + Prev + Scripture quote + Next
  // Layout: [Day30/spacer][Prev][Quote span-4][Next]
  const day30 = month.days.find(d => d.lunarDay === 30);
  const isFirstMonth = state.currentMonthIndex === 0;
  const isLastMonth = state.currentMonthIndex >= state.lunarMonths.length - 1;
  
  if (day30) {
    // Day 30 exists
    let classes = ['day-cell'];
    if (day30.feasts && day30.feasts.length > 0) classes.push('feast');
    if (day30.lunarDay === state.highlightedLunarDay) classes.push('highlighted');
    // Day 30 with '-' means it might not exist (only show uncertainty for '-' direction)
    const day30Uncertain = day30.isUncertain && month.dateUncertainty === '-';
    if (day30Uncertain) classes.push('date-uncertain');
    // Check if Day 30 is today (compare using local date methods for consistency)
    if (day30.gregorianDate.getFullYear() === todayYear && 
        day30.gregorianDate.getMonth() === todayMonth && 
        day30.gregorianDate.getDate() === todayDay) {
      classes.push('today');
    }
    
    let feastLabel = '';
    const icons = [];
    if (day30.feasts && day30.feasts.length > 0) {
      icons.push(...new Set(day30.feasts.map(f => f.feast.icon)));
    }
    if (day30.equinox) {
      icons.push('☀️⚖️');
    }
    if (icons.length > 0) {
      feastLabel = `<div class="feast-icons">${icons.join('')}</div>`;
    }
    
    const dateStr = day30.gregorianDate.toISOString().split('T')[0];
    let titleText = day30.feasts && day30.feasts.length > 0 
      ? day30.feasts.map(f => f.feast.name + ': ' + f.feast.description).join(' | ')
      : '';
    if (day30Uncertain) {
      const prob = month.dateUncertaintyProbability || 0;
      titleText = (titleText ? titleText + ' | ' : '') + `~${prob}% chance this Day 30 does not exist`;
    }
    const isHighlighted30 = day30.lunarDay === state.highlightedLunarDay;
    
    // Day 30 with '-' shows the suffix, Day 30 with '+' doesn't exist scenario so no suffix
    const day30Suffix = day30Uncertain ? '-' : '';
    
    // Blood moon styling for Day 30
    const bloodMoonClass30 = day30.isBloodMoon ? ' blood-moon' : '';
    const bloodMoonTitle30 = day30.isBloodMoon ? ' | 🔴 Blood Moon (Lunar Eclipse)' : '';
    
    // Get event icon for Day 30
    const day30EventIcon = getDayEventIcon(month.monthNumber, 30, day30.gregorianDate.getUTCFullYear());
    
    html += `
      <div class="${classes.join(' ')}" data-date="${dateStr}" title="${titleText}${bloodMoonTitle30}">
        <div class="gregorian">${formatShortDate(day30.gregorianDate)}${day30Suffix}</div>
        <div class="moon-phase${bloodMoonClass30}">${day30.moonPhase}</div>
        <div class="lunar-day">${day30.lunarDay}</div>
        ${feastLabel}
        ${day30EventIcon}
      </div>
    `;
  } else {
    // No day 30 - use empty height-setter cell
    html += `<div class="day-cell empty quote-row-spacer"></div>`;
  }
  
  // Navigation buttons - prev year and month
  html += `
    <div class="month-nav-cell nav-group">
      <span class="nav-arrow year-nav" onclick="navigateYear(-1); event.stopPropagation();" title="Previous Year">⏮</span>
      <span class="nav-arrow month-nav" onclick="navigateMonth(-1); event.stopPropagation();" title="${isFirstMonth ? 'Previous Year' : 'Previous Month'}">◀</span>
    </div>
  `;
  
  // Scripture quote (span 4 columns)
  html += `
    <div class="scripture-quote span-4">
      "${scripture.text}" <span class="reference">${scripture.ref}</span>
    </div>
  `;
  
  // Navigation buttons - next month and year
  html += `
    <div class="month-nav-cell nav-group">
      <span class="nav-arrow month-nav" onclick="navigateMonth(1); event.stopPropagation();" title="${isLastMonth ? 'Next Year' : 'Next Month'}">▶</span>
      <span class="nav-arrow year-nav" onclick="navigateYear(1); event.stopPropagation();" title="Next Year">⏭</span>
    </div>
  `;
  
  html += `
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Update map editability based on current profile
  updateMapEditability();
  
  // Refresh time display since it was regenerated with the header
  updateTimeDisplay();
}

// Render feast table
function renderFeastTable(months) {
  const tbody = document.getElementById('feast-tbody');
  tbody.innerHTML = '';
  
  // Track which feasts we've already shown (for multi-month feasts like Hanukkah)
  const shownFeasts = new Set();
  
  // Collect all feast entries first
  const feastEntries = [];
  
  for (const feast of FEASTS) {
    // Skip if this is a continuation entry we've already handled
    if (feast.continuesNextMonth === undefined && shownFeasts.has(feast.name)) continue;
    
    const month = months.find(m => m.monthNumber === feast.month);
    if (!month) continue;
    
    const day = month.days.find(d => d.lunarDay === feast.day);
    if (!day) continue;
    
    let dateStr, gregDate;
    
    // Handle Hanukkah spanning two months
    if (feast.name === 'Hanukkah' && feast.continuesNextMonth) {
      shownFeasts.add('Hanukkah');
      const nextMonth = months.find(m => m.monthNumber === feast.month + 1);
      dateStr = `Month ${feast.month} day 25 - Month ${feast.month + 1} day 2`;
      
      const endDay = nextMonth ? nextMonth.days.find(d => d.lunarDay === 2) : null;
      gregDate = endDay 
        ? `${formatShortDate(day.gregorianDate)} - ${formatShortDate(endDay.gregorianDate)}`
        : formatFullDate(day.gregorianDate) + ' (8 days)';
    } else if (feast.name === 'Hanukkah' && !feast.continuesNextMonth) {
      // Skip the continuation entry in table
      continue;
    } else {
      dateStr = feast.endDay 
        ? `Month ${feast.month} days ${feast.day}-${feast.endDay}`
        : `Month ${feast.month} day ${feast.day}`;
      
      gregDate = formatFullDate(day.gregorianDate);
      if (feast.endDay) {
        const endDay = month.days.find(d => d.lunarDay === feast.endDay);
        if (endDay) gregDate = `${formatShortDate(day.gregorianDate)} - ${formatShortDate(endDay.gregorianDate)}`;
      }
    }
    
    const monthIdx = months.findIndex(m => m.monthNumber === feast.month);
    const dayIdx = feast.day;
    
    feastEntries.push({
      feast,
      day,
      dateStr,
      gregDate,
      monthIdx,
      dayIdx,
      sortDate: day.gregorianDate
    });
  }
  
  // Sort by Gregorian date
  feastEntries.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
  
  // Render sorted entries
  for (const entry of feastEntries) {
    // Use dynamic description for Renewed Moon based on current moon phase setting
    const description = entry.feast.name === 'Renewed Moon' 
      ? getRenewedMoonDescription() 
      : entry.feast.description;
    
    tbody.innerHTML += `
      <tr>
        <td><a href="#" class="feast-jump" data-month="${entry.monthIdx}" data-day="${entry.dayIdx}" style="color: inherit; text-decoration: none;"><strong>${entry.feast.name}</strong></a></td>
        <td><a href="#" class="feast-jump" data-month="${entry.monthIdx}" data-day="${entry.dayIdx}" style="color: inherit; text-decoration: none;">
          <div>${entry.dateStr}</div>
          <div style="color: #666; font-size: 0.9em;">${entry.gregDate}</div>
        </a></td>
        <td><a href="${entry.feast.chapter}" style="color: #2c5282;">${description} →</a></td>
      </tr>
    `;
  }
}

// Jump to a specific feast
function jumpToFeast(monthIdx, lunarDay) {
  if (monthIdx >= 0 && monthIdx < state.lunarMonths.length) {
    state.currentMonthIndex = monthIdx;
    state.highlightedLunarDay = lunarDay;
    // Store timestamp for the feast day (sunrise)
    const month = state.lunarMonths[monthIdx];
    const dayObj = month.days.find(d => d.lunarDay === lunarDay);
    if (dayObj) {
      state.selectedTimestamp = getSunriseTimestamp(dayObj.gregorianDate);
      document.getElementById('goto-date').value = formatLocalDatetime(state.selectedTimestamp);
      showDayDetail(dayObj, month);
    }
    renderMonth(month);
    updateMonthButtons();
    updateURL();
    // Navigate to calendar view
    navigateTo('calendar');
    // Scroll to calendar after navigation
    setTimeout(() => {
      document.querySelector('.month-calendar')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }
}
