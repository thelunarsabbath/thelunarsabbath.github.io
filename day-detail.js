// Day Detail Panel Functions
// Extracted from index.html for Phase 4 refactoring

// Check if a day is a Sabbath based on current sabbath mode
function isSabbath(dayObj) {
  if (!dayObj) return false;
  const state = typeof AppStore !== 'undefined' ? AppStore.getState() : (window.state || {});
  const sabbathMode = state.sabbathMode || 'lunar';
  
  if (sabbathMode === 'lunar') {
    return [8, 15, 22, 29].includes(dayObj.lunarDay);
  }
  
  // For non-lunar sabbaths, check weekday
  const weekdayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const targetDay = weekdayMap[sabbathMode] ?? 6; // default to Saturday
  const weekday = dayObj.weekday !== undefined ? dayObj.weekday : dayObj.gregorianDate?.getUTCDay();
  return weekday === targetDay;
}

// Calculate Julian Day Number from Julian calendar date (year, month 0-indexed, day)
function julianCalendarToJDN(year, month, day) {
  // Convert 0-indexed month to 1-indexed
  const m = month + 1;
  const a = Math.floor((14 - m) / 12);
  const y = year + 4800 - a;
  const mm = m + 12 * a - 3;
  // Julian calendar formula
  return day + Math.floor((153 * mm + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}

// Calculate day of week from Julian Day Number (0 = Sunday, 6 = Saturday)
function jdnToWeekday(jdn) {
  return (jdn + 1) % 7;
}

// Get formatted date components (handles Julian calendar for pre-1582 dates)
// Note: Dates from _jdToDate() already have Julian calendar components stored,
// so we just use getFullYear/getMonth/getDate directly - no conversion needed.
function getFormattedDateParts(date) {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // For ancient dates, use UTC methods to avoid timezone issues
  // The astronomy engine's _jdToDate already stores Julian calendar values
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const isJulian = isBeforeGregorianReform(date);
  
  // Calculate weekday from Julian Day Number for correct result
  // (JavaScript's getUTCDay() uses proleptic Gregorian internally, which is wrong for Julian dates)
  let weekday;
  if (isJulian) {
    const jdn = julianCalendarToJDN(year, month, day);
    weekday = jdnToWeekday(jdn);
  } else {
    weekday = date.getUTCDay();
  }
  
  // Year string: only BC suffix, never AD
  const yearStr = year <= 0 ? `${Math.abs(year - 1)} BC` : `${year}`;
  
  return {
    year,
    yearStr,
    month,
    day,
    weekday,
    weekdayName: weekdays[weekday],
    monthName: months[month],
    shortMonthName: shortMonths[month],
    isJulian,
    calendarSuffix: isJulian ? ' (Julian)' : ''
  };
}

// Format a date for display in day detail panel: "Monday, January 1, 2025"
function formatDisplayDate(date) {
  const parts = getFormattedDateParts(date);
  return `${parts.weekdayName}, ${parts.monthName} ${parts.day}, ${parts.yearStr}${parts.calendarSuffix}`;
}

// Get ordinal suffix for numbers (1st, 2nd, 3rd, 4th, etc.)
function getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Refresh day detail panel if one is currently visible.
// Looks for both CalendarView's panel (id="day-detail") and standalone (id="day-detail-panel").
function refreshDayDetailIfVisible() {
  const panel = document.getElementById('day-detail') || document.getElementById('day-detail-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  
  // Fast path: just re-render the world clock section without rebuilding the entire panel
  const compareContainer = panel.querySelector('.day-detail-profile-compare');
  if (compareContainer && typeof CalendarView !== 'undefined' && CalendarView.populateWorldClock) {
    const state = AppStore.getState();
    const derived = AppStore.getDerived();
    CalendarView.populateWorldClock(panel.closest('.calendar-content') || panel.parentElement, derived, state.context);
    return;
  }
  
  // Fallback: full panel re-render via showDayDetail
  if (typeof AppStore === 'undefined') return;
  const derived = AppStore.getDerived();
  const months = derived.lunarMonths || derived.calendar?.months || [];
  const monthIdx = derived.currentMonthIndex || 0;
  const lunarDay = derived.currentLunarDay || null;
  
  if (lunarDay !== null && months[monthIdx]) {
    const month = months[monthIdx];
    const dayObj = month.days?.find(d => d.lunarDay === lunarDay);
    if (dayObj) {
      showDayDetail(dayObj, month);
    }
  }
}

// Close the day detail panel
function closeDayDetail() {
  document.getElementById('day-detail-panel').classList.add('hidden');
}

// Show the day detail panel with information about the selected day
function showDayDetail(dayObj, month) {
  const panel = document.getElementById('day-detail-panel');
  
  // Populate lunar date
  const ordinal = getOrdinalSuffix(month.monthNumber);
  const lunarDateStr = `Day ${dayObj.lunarDay} of the ${month.monthNumber}${ordinal} Month`;
  panel.querySelector('.day-detail-lunar').textContent = lunarDateStr;
  
  // Populate gregorian/julian date
  const gregDate = dayObj.gregorianDate;
  panel.querySelector('.day-detail-gregorian').textContent = formatDisplayDate(gregDate);
  
  // Populate feasts
  const feastsContainer = panel.querySelector('.day-detail-feasts');
  feastsContainer.innerHTML = '';
  
  if (dayObj.feasts && dayObj.feasts.length > 0) {
    for (const f of dayObj.feasts) {
      const feast = f.feast;
      const dayNum = f.dayNum;
      const nameText = dayNum ? `${feast.name} (Day ${dayNum})` : feast.name;
      
      // Check if this is a Renewed Moon feast and we have moon event data
      let basisHtml = '';
      let stellariumLink = ''; // Initialize for all feasts
      if (feast.name === 'Renewed Moon' && dayObj.lunarDay === 1 && month.moonEvent) {
        const moonEventTime = month.moonEvent;
        const signName = getMoonLabel();
        
        // Format moon event date in a friendly way
        const moonEventDate = new Date(moonEventTime);
        const moonParts = getFormattedDateParts(moonEventDate);
        const dayOfWeek = moonParts.weekdayName;
        const monthName = moonParts.shortMonthName;
        const dayNum = moonParts.day;
        const daySuffix = getOrdinalSuffix(dayNum);
        const year = moonParts.yearStr;
        
        // Format times in observer's local time (based on longitude), not browser timezone
        const moonLocalTime = utcToLocalTime(moonEventDate.getTime(), state.lon);
        const moonTimeStr = `${moonLocalTime.getUTCHours() % 12 || 12}:${String(moonLocalTime.getUTCMinutes()).padStart(2, '0')} ${moonLocalTime.getUTCHours() >= 12 ? 'PM' : 'AM'}`;
        
        const dayStartLabel = getDayStartLabel();
        
        // For dark/full moon mode with evening start, calculate margin to same-day sunset
        // This is the key margin that determines whether a 30th day was added to the prior month
        let sameDaySunset = null;
        let marginToSunsetMs = 0;
        let conjunctionAfterSunset = false;
        
        if ((state.moonPhase === 'dark' || state.moonPhase === 'full') && state.dayStartTime === 'evening') {
          sameDaySunset = getSunsetTimestamp(moonEventDate);
          const sameDaySunrise = getSunriseTimestamp(moonEventDate);
          marginToSunsetMs = sameDaySunset - moonEventTime.getTime();
          
          // Key insight: if the moon event is between midnight and sunrise (early morning),
          // it's actually part of the PREVIOUS evening's "day" in Hebrew calendar terms.
          const moonLocalTime = moonEventTime.getTime() + (state.lon / 15) * 60 * 60 * 1000;
          const sunriseLocalTime = sameDaySunrise + (state.lon / 15) * 60 * 60 * 1000;
          const sunsetLocalTime = sameDaySunset + (state.lon / 15) * 60 * 60 * 1000;
          
          const isBeforeSunrise = moonLocalTime < sunriseLocalTime;
          const isAfterSunset = moonLocalTime > sunsetLocalTime;
          
          // For early morning events (before sunrise), calculate margin from previous sunset
          if (isBeforeSunrise) {
            const prevDate = new Date(moonEventDate.getTime());
            prevDate.setUTCDate(prevDate.getUTCDate() - 1);
            const prevSunset = getSunsetTimestamp(prevDate);
            marginToSunsetMs = prevSunset - moonEventTime.getTime(); // Will be negative (after sunset)
            conjunctionAfterSunset = true;
          } else {
            conjunctionAfterSunset = isAfterSunset;
          }
        }
        
        // Get the day start time (sunset that starts Day 1)
        const dayStartTimestamp = getDayStartTime(dayObj.gregorianDate);
        const dayStartLocalTime = utcToLocalTime(dayStartTimestamp, state.lon);
        const dayStartStr = `${dayStartLocalTime.getUTCHours() % 12 || 12}:${String(dayStartLocalTime.getUTCMinutes()).padStart(2, '0')} ${dayStartLocalTime.getUTCHours() >= 12 ? 'PM' : 'AM'}`;
        
        // For the margin calculation (used for uncertainty warning), use the same-day sunset margin
        // This tells us how close the conjunction was to sunset on that day
        const marginMs = sameDaySunset !== null ? Math.abs(marginToSunsetMs) : Math.abs(dayStartTimestamp - moonEventTime.getTime());
        const marginMins = Math.round(marginMs / (1000 * 60));
        const marginHours = Math.floor(marginMins / 60);
        const marginMinsRemainder = marginMins % 60;
        
        let marginStr = '';
        if (marginHours > 0 && marginMinsRemainder > 0) {
          marginStr = `${marginHours} hour${marginHours > 1 ? 's' : ''} ${marginMinsRemainder} minute${marginMinsRemainder > 1 ? 's' : ''}`;
        } else if (marginHours > 0) {
          marginStr = `${marginHours} hour${marginHours > 1 ? 's' : ''}`;
        } else {
          marginStr = `${marginMinsRemainder} minute${marginMinsRemainder > 1 ? 's' : ''}`;
        }
        
        // Determine tense based on whether the date is past or future
        const now = new Date();
        const isPast = moonEventDate < now;
        const occurVerb = isPast ? 'occurred' : 'will occur';
        
        // Check if this is crescent + sunset mode (special case where crescent day IS Day 1)
        const isCrescentSunset = state.moonPhase === 'crescent' && 
                                 state.dayStartTime === 'evening' && 
                                 state.dayStartAngle === 0;
        
        // Get moon altitude at sunset for crescent mode
        let crescentAltitudeInfo = '';
        if (state.moonPhase === 'crescent') {
          // The moonEventTime is already the "forged" crescent event (conjunction + threshold hours)
          // Calculate the actual conjunction time
          const conjunctionDate = new Date(moonEventTime.getTime() - state.crescentThreshold * 60 * 60 * 1000);
          
          // For crescent visibility, we need to find the sunset when the crescent would be visible
          // This is the first sunset AFTER the conjunction
          let checkDate = new Date(conjunctionDate);
          let sightingData = getMoonAltitudeAtSunset(checkDate);
          
          // If the sunset on conjunction day is BEFORE the conjunction, check next day
          if (sightingData && sightingData.sunsetTime.getTime() < conjunctionDate.getTime()) {
            checkDate = new Date(conjunctionDate.getTime() + 24 * 60 * 60 * 1000);
            sightingData = getMoonAltitudeAtSunset(checkDate);
          }
          
          if (sightingData) {
            const altStr = sightingData.moonAltitude.toFixed(1);
            const elongStr = sightingData.elongation.toFixed(1);
            const sunsetFormatted = formatTimeInObserverTimezone(sightingData.sunsetTime);
            const sunsetDateStr = formatAncientDate(sightingData.sunsetTime);
            const conjTimeFormatted = formatTimeInObserverTimezone(conjunctionDate);
            const conjDateStr = formatAncientDate(conjunctionDate);
            
            // Determine visibility status
            let visibilityNote = '';
            if (sightingData.moonAltitude < 0) {
              visibilityNote = ' (below horizon - not visible)';
            } else if (sightingData.moonAltitude < 5) {
              visibilityNote = ' (very low - difficult to see)';
            } else if (sightingData.elongation < 7) {
              visibilityNote = ' (too close to sun - difficult to see)';
            } else if (sightingData.moonAltitude >= 5 && sightingData.elongation >= 7) {
              visibilityNote = ' (likely visible)';
            }
            
            crescentAltitudeInfo = ` Conjunction: ${conjDateStr} ${conjTimeFormatted.full}. Crescent check on ${sunsetDateStr} at sunset (${sunsetFormatted.time}): moon ${altStr}° altitude, ${elongStr}° from sun${visibilityNote}.`;
          }
        }
        
        // Generate Stellarium Web link for all moon phases
        // Use an appropriate viewing time based on moon phase and day start
        let stellariumDateTime;
        
        if (state.moonPhase === 'crescent') {
          // For crescent, use sunset time when you'd look for the crescent
          // Same logic as crescent altitude info: first sunset AFTER the conjunction
          const conjunctionForLink = new Date(moonEventTime.getTime() - state.crescentThreshold * 60 * 60 * 1000);
          let checkDateForLink = new Date(conjunctionForLink);
          let moonDataForLink = getMoonAltitudeAtSunset(checkDateForLink);
          
          // If sunset on conjunction day is before conjunction, check next day
          if (moonDataForLink && moonDataForLink.sunsetTime.getTime() < conjunctionForLink.getTime()) {
            checkDateForLink = new Date(conjunctionForLink.getTime() + 24 * 60 * 60 * 1000);
            moonDataForLink = getMoonAltitudeAtSunset(checkDateForLink);
          }
          
          if (moonDataForLink) {
            // Use the sunset time on the crescent sighting day
            stellariumDateTime = moonDataForLink.sunsetTime;
          } else {
            stellariumDateTime = moonEventDate;
          }
        } else if (state.moonPhase === 'full') {
          // For full moon, use early morning before sunrise when moon is visible in west
          // Get the day start time for Day 1
          const day1Date = dayObj.gregorianDate;
          const dayStartTs = getDayStartTime(day1Date);
          stellariumDateTime = new Date(dayStartTs);
        } else {
          // For dark moon (conjunction), use the moon event time
          // Note: dark moon isn't visible, but this shows the sky at that moment
          stellariumDateTime = moonEventDate;
        }
        
        const stellariumDate = stellariumDateTime.toISOString().split('.')[0] + 'Z';
        stellariumLink = `<a href="https://stellarium-web.org/?date=${stellariumDate}&lat=${state.lat}&lng=${state.lon}" target="_blank" rel="noopener" class="stellarium-link"><img src="https://stellarium-web.org/favicon.ico" alt="" onerror="this.style.display='none'">View in Stellarium</a>`;
        
        // Build explanation based on moon phase type and day start settings
        // Stellarium link is stored separately to put in header
        let explanationText = '';
        
        if ((state.moonPhase === 'dark' || state.moonPhase === 'full') && state.dayStartTime === 'evening') {
          // For dark/full moon with evening start, explain the margin to sunset
          const beforeAfterSunset = conjunctionAfterSunset ? 'after' : 'before';
          const moonLabel = state.moonPhase === 'dark' ? 'Dark Moon (conjunction)' : 'Full Moon';
          
          if (conjunctionAfterSunset) {
            // Conjunction was after sunset - a 30th day was added to the prior month
            explanationText = `The ${moonLabel} ${occurVerb} on ${dayOfWeek}, ${monthName} ${dayNum}${daySuffix}, ${year} at ${moonTimeStr}, ` +
              `which was ${marginStr} after sunset (${dayStartStr}). Since it occurred after sunset, ` +
              `the prior month had 30 days, and this month begins at the following evening's sunset.`;
          } else {
            // Conjunction was before sunset - month starts at this sunset
            explanationText = `The ${moonLabel} ${occurVerb} on ${dayOfWeek}, ${monthName} ${dayNum}${daySuffix}, ${year} at ${moonTimeStr}, ` +
              `which was ${marginStr} before sunset. The month begins at sunset (${dayStartStr}).`;
          }
        } else if (state.moonPhase === 'crescent') {
          if (isCrescentSunset) {
            explanationText = `The first visible Crescent Moon ${occurVerb} on ${dayOfWeek}, ${monthName} ${dayNum}${daySuffix}, ${year}. ` +
              `The month begins immediately at sunset following the sighting.${crescentAltitudeInfo}`;
          } else {
            explanationText = `The first visible Crescent Moon ${occurVerb} on ${dayOfWeek}, ${monthName} ${dayNum}${daySuffix}, ${year}. ` +
              `The month begins at the next ${dayStartLabel} (${dayStartStr}).${crescentAltitudeInfo}`;
          }
        } else {
          explanationText = `The ${signName} ${occurVerb} on ${dayOfWeek}, ${monthName} ${dayNum}${daySuffix}, ${year} at ${moonTimeStr}. ` +
            `The month begins at ${dayStartLabel} (${dayStartStr}).`;
        }
        
        // Check if the margin is within ΔT uncertainty for ancient dates
        let uncertaintyWarningHtml = '';
        const eventYear = moonEventDate.getUTCFullYear();
        const uncertaintyHours = AstroEngines.nasaEclipse.getDeltaTUncertainty(eventYear);
        const marginHoursValue = marginMins / 60;
        
        if (uncertaintyHours > 0 && marginHoursValue <= uncertaintyHours) {
          // Get the prior month's day count to determine which direction the error could go
          // Lunar months are always 29 or 30 days
          const currentMonthIdx = state.lunarMonths.findIndex(m => m.monthNumber === month.monthNumber);
          const priorMonth = currentMonthIdx > 0 ? state.lunarMonths[currentMonthIdx - 1] : null;
          const priorMonthDays = priorMonth ? priorMonth.daysInMonth : 29;
          
          let warningExplanation = '';
          if (state.moonPhase === 'dark' || state.moonPhase === 'full') {
            if (priorMonthDays === 29) {
              // Prior month has 29 days - only possible error is it should be 30
              warningExplanation = `If the actual ${getMoonLabel()} occurred later than calculated, ` +
                `it may have been after sunset, meaning the prior month would have had 30 days, ` +
                `and all dates in this month would be one day later than shown.`;
            } else {
              // Prior month has 30 days - only possible error is it should be 29
              warningExplanation = `If the actual ${getMoonLabel()} occurred earlier than calculated, ` +
                `it may have been before sunset, meaning the prior month would have had only 29 days, ` +
                `and all dates in this month would be one day earlier than shown.`;
            }
          } else if (state.moonPhase === 'crescent') {
            warningExplanation = `If the crescent was actually visible earlier or later than calculated, ` +
              `Day 1 could fall on the previous or next day, shifting all dates in this month.`;
          } else {
            warningExplanation = `The actual Day 1 could potentially fall on the previous or next day.`;
          }
          
          uncertaintyWarningHtml = `
            <div class="uncertainty-warning">
              <span class="warning-icon">⚠️</span>
              <strong>Date Uncertainty:</strong> The ${marginStr} margin between the ${getMoonLabel()} and sunset 
              is within the estimated ±${uncertaintyHours} hour uncertainty for astronomical calculations at this date. 
              ${warningExplanation}
            </div>
          `;
        }
        
        basisHtml = `
          <div class="feast-basis">
            ${explanationText}
          </div>
          ${uncertaintyWarningHtml}
        `;
      }
      
      // Generate dynamic description for Renewed Moon based on current moon phase setting
      const feastDescription = feast.name === 'Renewed Moon' 
        ? getRenewedMoonDescription() 
        : feast.description;
      
      // For Renewed Moon on Day 1, include the Stellarium link in the header
      const showStellarium = feast.name === 'Renewed Moon' && dayObj.lunarDay === 1 && stellariumLink;
      
      // Build feast chapter link if present
      let feastChapterLink = '';
      if (feast.chapter) {
        let chapterPath = feast.chapter;
        let section = null;
        const hashIdx = chapterPath.indexOf('#');
        if (hashIdx !== -1) {
          section = chapterPath.slice(hashIdx + 1);
          chapterPath = chapterPath.slice(0, hashIdx);
        }
        let chapterId = chapterPath.replace(/^\/chapters\//, '').replace(/\/$/, '');
        // Convert dashes to underscores and fix title case: "18-appointed-times" -> "18_Appointed_Times"
        chapterId = chapterId.split('-').map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)).join('_');
        const sectionParam = section ? `,section:'${section}'` : '';
        feastChapterLink = `<a href="#" class="day-detail-feast-link" onclick="event.preventDefault();AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'${chapterId}'${sectionParam}}})">Learn more &rarr;</a>`;
      }
      
      const item = document.createElement('div');
      item.className = 'day-detail-feast-item';
      item.innerHTML = `
        <div class="day-detail-feast-icon">${feast.icon}</div>
        <div class="day-detail-feast-info">
          <div class="day-detail-feast-header">
            <div class="day-detail-feast-name">${nameText}</div>
            ${showStellarium ? stellariumLink : ''}
          </div>
          <div class="day-detail-feast-desc">${feastDescription}</div>
          ${basisHtml}
          ${feastChapterLink}
        </div>
      `;
      feastsContainer.appendChild(item);
    }
  } else if (!dayObj.equinox) {
    feastsContainer.innerHTML = '<div class="day-detail-no-feast">No appointed times on this day</div>';
  }
  
  // Add equinox info if this day has the spring equinox
  if (dayObj.equinox) {
    const equinoxDate = dayObj.equinox.date;
    const eqParts = getFormattedDateParts(equinoxDate);
    const dayOfWeek = eqParts.weekdayName;
    const monthName = eqParts.monthName;
    const dayNum = eqParts.day;
    const daySuffix = getOrdinalSuffix(dayNum);
    const year = eqParts.yearStr;
    const timeStr = equinoxDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', minute: '2-digit', hour12: true 
    });
    
    const now = new Date();
    const isPast = equinoxDate < now;
    const verb = isPast ? 'occurred' : 'will occur';
    
    const item = document.createElement('div');
    item.className = 'day-detail-feast-item';
    item.innerHTML = `
      <div class="day-detail-feast-icon">☀️⚖️</div>
      <div class="day-detail-feast-info">
        <div class="day-detail-feast-name">Spring Equinox</div>
        <div class="day-detail-feast-desc">The moment when day and night are equal in length, marking the astronomical beginning of spring.</div>
        <div class="feast-basis">
          The Spring Equinox ${verb} on ${dayOfWeek}, ${monthName} ${dayNum}${daySuffix}, ${year} at ${timeStr}.
        </div>
        <a href="#" class="day-detail-feast-link" onclick="event.preventDefault();AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'08_When_does_the_Year_Start'}})">Learn more &rarr;</a>
      </div>
    `;
    feastsContainer.appendChild(item);
  }
  
  // Add blood moon (lunar eclipse) info if this day has one
  if (dayObj.isBloodMoon) {
    const bloodMoonDate = dayObj.gregorianDate;
    const bmParts = getFormattedDateParts(bloodMoonDate);
    const dayOfWeek = bmParts.weekdayName;
    const monthName = bmParts.monthName;
    const dayNum = bmParts.day;
    const daySuffix = getOrdinalSuffix(dayNum);
    const year = bmParts.yearStr;
    
    const now = new Date();
    const isPast = bloodMoonDate < now;
    const verb = isPast ? 'occurred' : 'will occur';
    
    // Get the exact eclipse time for Stellarium link
    const eclipseTime = AstroEngines.nasaEclipse.getLunarEclipseTime(dayObj.gregorianDate);
    let eclipseTimeStr = '';
    let stellariumBloodMoonLink = '';
    if (eclipseTime) {
      const eclipseFormatted = formatTimeInObserverTimezone(eclipseTime);
      eclipseTimeStr = ` at ${eclipseFormatted.full}`;
      const stellariumDate = eclipseTime.toISOString().split('.')[0] + 'Z';
      stellariumBloodMoonLink = `<a href="https://stellarium-web.org/?date=${stellariumDate}&lat=${state.lat}&lng=${state.lon}" target="_blank" rel="noopener" class="stellarium-link"><img src="https://stellarium-web.org/favicon.ico" alt="" onerror="this.style.display='none'">View in Stellarium</a>`;
    }
    
    const item = document.createElement('div');
    item.className = 'day-detail-feast-item';
    item.innerHTML = `
      <div class="day-detail-feast-icon blood-moon-icon">🌕</div>
      <div class="day-detail-feast-info">
        <div class="day-detail-feast-header">
          <div class="day-detail-feast-name" style="color: #ff6b6b;">Blood Moon (Total Lunar Eclipse)</div>
          ${stellariumBloodMoonLink}
        </div>
        <div class="day-detail-feast-desc">A total lunar eclipse occurs when the Earth passes between the Sun and Moon, 
          casting Earth's shadow on the lunar surface. The Moon appears deep red due to sunlight filtered through Earth's atmosphere.</div>
        <div class="feast-basis">
          A total lunar eclipse ${verb} on ${dayOfWeek}, ${monthName} ${dayNum}${daySuffix}, ${year}${eclipseTimeStr}. 
          In Scripture, blood moons are often associated with significant prophetic events (Joel 2:31, Acts 2:20, Revelation 6:12).
        </div>
      </div>
    `;
    feastsContainer.appendChild(item);
  }
  
  // Add uncertainty warning for any uncertain day
  if (dayObj.isUncertain && month.dateUncertainty) {
    const item = document.createElement('div');
    item.className = 'day-detail-feast-item';
    
    const prob = month.dateUncertaintyProbability || 0;
    let warningText = '';
    if (month.dateUncertainty === '-') {
      if (dayObj.lunarDay === 30) {
        warningText = `There is a ~${prob}% probability this Day 30 does not exist. The margin between this month's ${getMoonLabel()} and sunset 
          is within the estimated uncertainty for astronomical calculations at this ancient date. 
          If the ${getMoonLabel()} actually occurred before sunset, the prior month would have only 29 days, 
          and all dates in this month would be one day earlier than shown.`;
      } else {
        warningText = `There is a ~${prob}% probability this date is one day earlier than shown. The ${getMoonLabel()} occurred very close to sunset, 
          and if it was actually before sunset, the prior month would have only 29 days instead of 30.`;
      }
    } else if (month.dateUncertainty === '+') {
      warningText = `There is a ~${prob}% probability this date is one day later than shown. The ${getMoonLabel()} occurred very close to sunset, 
        and if it was actually after sunset, the prior month would have 30 days instead of 29.`;
    }
    
    item.innerHTML = `
      <div class="day-detail-feast-icon">⚠️</div>
      <div class="day-detail-feast-info">
        <div class="day-detail-feast-name">Date Uncertainty: ~${prob}% chance dates are ${month.dateUncertainty === '-' ? 'earlier' : 'later'}</div>
        <div class="uncertainty-warning" style="margin-top: 0.5rem;">
          ${warningText}
        </div>
      </div>
    `;
    feastsContainer.appendChild(item);
  }
  
  // Add year start explanation for 1st day of 1st month, or 13th month explanation
  if (dayObj.lunarDay === 1 && (month.monthNumber === 1 || month.monthNumber === 13)) {
    const item = document.createElement('div');
    item.className = 'day-detail-feast-item day-detail-year-info';
    
    const totalMonths = state.lunarMonths.length;
    const has13thMonth = totalMonths === 13;
    const moonLabel = getMoonLabel();
    
    // Get spring equinox for this lunar year
    const springEquinox = getAstroEngine().getSeasons(state.year).mar_equinox.date;
    const seqParts = getFormattedDateParts(springEquinox);
    const equinoxDateStr = `${seqParts.weekdayName}, ${seqParts.monthName} ${seqParts.day}${getOrdinalSuffix(seqParts.day)}, ${seqParts.yearStr}${seqParts.calendarSuffix}`;
    
    // Check if we're in crescent + sunset mode
    const isCrescentSunset = state.moonPhase === 'crescent' && 
                             state.dayStartTime === 'evening' && 
                             state.dayStartAngle === 0;
    
    // Calculate time from equinox to month start (day 1 day-start)
    // For crescent+sunset, use the moon event time (crescent sighting = sunset)
    let day1StartTs;
    if (isCrescentSunset && month.moonEvent) {
      day1StartTs = month.moonEvent.getTime();
    } else {
      day1StartTs = getDayStartTime(dayObj.gregorianDate);
    }
    const diffMs = day1StartTs - springEquinox.getTime();
    const diffTotalHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.floor(Math.abs(diffTotalHours) / 24);
    const diffHours = Math.round(Math.abs(diffTotalHours) % 24);
    
    let timingStr = '';
    if (diffDays > 0 && diffHours > 0) {
      timingStr = `${diffDays} day${diffDays !== 1 ? 's' : ''} and ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    } else if (diffDays > 0) {
      timingStr = `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else {
      timingStr = `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    }
    const beforeAfter = diffMs >= 0 ? 'after' : 'before';
    
    if (month.monthNumber === 1) {
      // Positive reason: explain why year CAN start here using current moon phase setting
      const dayStartLabel = getDayStartLabel();
      const day1StartDate = new Date(day1StartTs);
      const day1StartStr = day1StartDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const day1Parts = getFormattedDateParts(day1StartDate);
      const day1DateStr = `${day1Parts.weekdayName}, ${day1Parts.monthName} ${day1Parts.day}${getOrdinalSuffix(day1Parts.day)}`;
      
      let yearMonthInfo = '';
      let virgoExplanationHtml = '';
      
      // For Virgo rule, use shared methodology function
      if (state.yearStartRule === 'virgoFeet') {
        const virgoCalc = getVirgoCalculation(state.year);
        if (virgoCalc) {
          // Use the shared methodology function with calculation details
          virgoExplanationHtml = getVirgoMethodologyHtml({ 
            showCalculation: true, 
            virgoCalc: virgoCalc 
          });
          yearMonthInfo = ''; // Content is in virgoExplanationHtml
        } else {
          yearMonthInfo = `Day 1 begins at ${dayStartLabel} (${day1DateStr} at ${day1StartStr}). Using Moon Under Virgo's Feet rule.`;
        }
      } else if (state.yearStartRule === '14daysBefore') {
        // Passover rule - use shared function
        virgoExplanationHtml = getPassoverMethodologyHtml({
          showCalculation: true,
          equinoxDate: equinoxDateStr,
          day1Date: `${day1DateStr} at ${day1StartStr}`,
          timingStr: timingStr,
          beforeAfter: beforeAfter
        });
        yearMonthInfo = ''; // Content is in virgoExplanationHtml
      } else if (state.yearStartRule === '1dayBefore') {
        yearMonthInfo = `Using Equinox −1 day rule. First new moon on or after (equinox − 1 day). Spring equinox: ${equinoxDateStr}. Day 1 begins ${timingStr} ${beforeAfter} equinox.`;
      } else {
        // Equinox rule - use shared function
        virgoExplanationHtml = getEquinoxMethodologyHtml({
          showCalculation: true,
          equinoxDate: equinoxDateStr,
          day1Date: `${day1DateStr} at ${day1StartStr}`,
          timingStr: timingStr,
          beforeAfter: beforeAfter
        });
        yearMonthInfo = ''; // Content is in virgoExplanationHtml
      }
      
      // Determine icon based on rule
      let ruleIcon = '📅';
      if (state.yearStartRule === 'virgoFeet') ruleIcon = '♍';
      else if (state.yearStartRule === '14daysBefore') ruleIcon = '🐑';
      else if (state.yearStartRule === '1dayBefore') ruleIcon = '⚖️−1';
      else ruleIcon = '⚖️';
      
      item.innerHTML = `
        <div class="day-detail-feast-icon">${ruleIcon}</div>
        <div class="day-detail-feast-info">
          <div class="day-detail-feast-name">Lunar Year ${state.year} Begins</div>
          <div class="day-detail-feast-desc">${yearMonthInfo}</div>
          ${virgoExplanationHtml}
        </div>
      `;
      feastsContainer.appendChild(item);
      
      // Add click handler for equinox link
      const equinoxLink = item.querySelector('.equinox-link');
      if (equinoxLink) {
        equinoxLink.addEventListener('click', (e) => {
          e.preventDefault();
          jumpToEquinoxDate(springEquinox);
        });
      }
    } else if (month.monthNumber === 13) {
      // Explain why 13th month exists: its day-start is BEFORE the next year's start point
      const nextEquinox = getAstroEngine().getSeasons(state.year + 1).mar_equinox.date;
      const neqParts = getFormattedDateParts(nextEquinox);
      const nextEquinoxDateStr = `${neqParts.weekdayName}, ${neqParts.monthName} ${neqParts.day}${getOrdinalSuffix(neqParts.day)}, ${neqParts.yearStr}${neqParts.calendarSuffix}`;
      
      // Get the 13th month's moon event (crescent/full/dark)
      const month13MoonEvent = month.moonEvent;
      let moonEventStr = '';
      let dayStartStr = '';
      let timingExplanation = '';
      
      if (month13MoonEvent) {
        const moonParts = getFormattedDateParts(month13MoonEvent);
        const moonTimeStr = month13MoonEvent.toLocaleTimeString('en-US', { 
          hour: 'numeric', minute: '2-digit', hour12: true 
        });
        moonEventStr = `${moonParts.weekdayName}, ${moonParts.monthName} ${moonParts.day}${getOrdinalSuffix(moonParts.day)}, ${moonParts.yearStr} at ${moonTimeStr}`;
        
        // Check if we're in crescent + sunset mode
        const isCrescentSunset = state.moonPhase === 'crescent' && 
                                 state.dayStartTime === 'evening' && 
                                 state.dayStartAngle === 0;
        
        // Calculate when Day 1 starts (day-start time)
        // For crescent+sunset, the month starts at the crescent sighting time (which IS sunset)
        let dayStartTimestamp;
        if (isCrescentSunset) {
          dayStartTimestamp = month13MoonEvent.getTime();
        } else {
          dayStartTimestamp = getDayStartTime(dayObj.gregorianDate);
        }
        const dayStartDate = new Date(dayStartTimestamp);
        const dayStartLabel = getDayStartLabel();
        const dsTimeStr = dayStartDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', minute: '2-digit', hour12: true 
        });
        const dsParts = getFormattedDateParts(dayStartDate);
        dayStartStr = `${dsParts.weekdayName}, ${dsParts.monthName} ${dsParts.day}${getOrdinalSuffix(dsParts.day)} at ${dsTimeStr}`;
        
        // Calculate time from 13th month day-start to next equinox
        const diffToEquinoxMs = nextEquinox.getTime() - dayStartTimestamp;
        const diffToEquinoxHours = diffToEquinoxMs / (1000 * 60 * 60);
        const diffDays = Math.floor(diffToEquinoxHours / 24);
        const diffHours = Math.round(diffToEquinoxHours % 24);
        
        let diffStr = '';
        if (diffDays > 0 && diffHours > 0) {
          diffStr = `${diffDays} day${diffDays !== 1 ? 's' : ''} and ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
        } else if (diffDays > 0) {
          diffStr = `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
        } else {
          diffStr = `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
        }
        
        timingExplanation = `The ${moonLabel} for this month was sighted on ${moonEventStr}. ` +
          `Day 1 begins at ${dayStartLabel} (${dayStartStr}), which is ${diffStr} before the ` +
          `<a href="#" class="equinox-link" data-equinox-date="${nextEquinox.toISOString()}">Spring Equinox (${nextEquinoxDateStr})</a>. ` +
          `Since this day-start falls before the equinox, this qualifies as the 13th month of the current year rather than the 1st month of the next year.`;
      }
      
      item.innerHTML = `
        <div class="day-detail-feast-icon">📅</div>
        <div class="day-detail-feast-info">
          <div class="day-detail-feast-name">13th Month (Intercalary)</div>
          <div class="day-detail-feast-desc">${timingExplanation}</div>
        </div>
      `;
      feastsContainer.appendChild(item);
      
      // Add click handler for equinox link
      const equinoxLink = item.querySelector('.equinox-link');
      if (equinoxLink) {
        equinoxLink.addEventListener('click', (e) => {
          e.preventDefault();
          jumpToEquinoxDate(nextEquinox);
        });
      }
    }
  }
  
  // Populate bible events (historical events that occurred on this lunar date)
  // Pass the Gregorian year to filter conditional events (Sabbath/Jubilee year specific)
  const bibleEventsContainer = panel.querySelector('.day-detail-bible-events');
  const gregorianYear = dayObj.gregorianDate.getUTCFullYear();
  const bibleEvents = getBibleEvents(month.monthNumber, dayObj.lunarDay, gregorianYear);
  
  if (bibleEvents && bibleEvents.length > 0) {
    let eventsHtml = `
      <div class="bible-events-section">
        <div class="bible-events-header">📜 Biblical Events on This Date</div>
        <div class="bible-events-list">
    `;
    
    for (const event of bibleEvents) {
      // Make scripture verses clickable using the bible reader (handle undefined)
      const verse = event.verse || '';
      const verseLink = verse && typeof makeCitationClickable === 'function' 
        ? makeCitationClickable(verse, event.title)
        : verse;
      
      // Determine if viewing original year or anniversary
      let conditionBadge = '';
      let eventClass = '';
      const eventYear = event.originalYear;
      
      if (eventYear !== null && eventYear !== undefined) {
        const lunarMonth = month.monthNumber;
        const lunarDay = dayObj.lunarDay;
        const yearDisplay = event.yearStr || (eventYear <= 0 ? `${1 - eventYear} BC` : `${eventYear} AD`);
        
        if (gregorianYear === eventYear) {
          // Viewing the actual historical year
          conditionBadge = `<span class="event-condition-badge historical-event-badge" title="This is the year this event originally occurred">🏛️ Original Event</span>`;
          eventClass = ' historical-event';
        } else {
          // Viewing anniversary - add calendar link to original year
          const calendarLink = `<a href="#" class="event-year-calendar-link" onclick="navigateToCalendarDate(${eventYear}, ${lunarMonth}, ${lunarDay}); return false;" title="View this date in ${yearDisplay}">📅</a>`;
          conditionBadge = `<span class="event-condition-badge anniversary-event-badge" title="Anniversary of event from ${yearDisplay}">${calendarLink} Anniversary</span>`;
          eventClass = ' anniversary-event';
        }
      }
      
      // Extract context citation (book + chapter) from verse reference for "v. X" style references
      // e.g., "Ezekiel 26:1-14" -> "Ezekiel 26"
      let contextCitation = '';
      if (event.verse) {
        const citationMatch = event.verse.match(/^(.+?\s+\d+)/);
        if (citationMatch) {
          contextCitation = citationMatch[1];
        }
      }
      
      // Linkify scripture references in description (handle undefined)
      const description = event.description || '';
      const linkedDescription = description && typeof linkifyScriptureReferences === 'function'
        ? linkifyScriptureReferences(description, contextCitation)
        : description;
      
      // Add scripture quote if present (with linkified references)
      let quoteHtml = '';
      if (event.quote) {
        const linkedQuote = typeof linkifyScriptureReferences === 'function'
          ? linkifyScriptureReferences(event.quote, contextCitation)
          : event.quote;
        quoteHtml = `<blockquote class="bible-event-quote">"${linkedQuote}"</blockquote>`;
      }
      
      // Add book chapter link if present
      let bookLinkHtml = '';
      if (event.bookChapter) {
        // Extract chapter ID from path like "/chapters/13_Herod_the_Great/" or "/chapters/extra/e03_Herods_Appointment/"
        let articlePath = event.bookChapter;
        let section = null;
        
        // Extract section anchor if present
        const hashIdx = articlePath.indexOf('#');
        if (hashIdx !== -1) {
          section = articlePath.slice(hashIdx + 1);
          articlePath = articlePath.slice(0, hashIdx);
        }
        
        let chapterId = articlePath
          .replace(/^\/chapters\//, '')  // Remove /chapters/ prefix
          .replace(/\/$/, '');           // Remove trailing slash
        
        // Build the AppStore dispatch params
        const sectionParam = section ? `,section:'${section}'` : '';
        bookLinkHtml = `<div class="bible-event-book-link"><a href="#" onclick="event.preventDefault();event.stopPropagation();AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'${chapterId}'${sectionParam}}})">📖 Read more in the book chapter</a></div>`;
      }
      
      // Add expandable details section if present
      let detailsHtml = '';
      if (event.details && event.details.length > 0) {
        const detailsId = `details-${month.monthNumber}-${dayObj.lunarDay}-${event.title.replace(/[^a-z0-9]/gi, '')}`;
        const detailsTitle = event.detailsTitle || 'More Details';
        let detailsContent = '';
        for (const detail of event.details) {
          // Linkify scripture references in the detail text
          const linkedText = typeof linkifyScriptureReferences === 'function'
            ? linkifyScriptureReferences(detail.text, contextCitation)
            : detail.text;
          detailsContent += `
            <div class="bible-event-detail-item">
              <div class="bible-event-detail-heading">${detail.heading}</div>
              <div class="bible-event-detail-text">${linkedText}</div>
            </div>
          `;
        }
        detailsHtml = `
          <details class="bible-event-details">
            <summary class="bible-event-details-toggle">${detailsTitle}</summary>
            <div class="bible-event-details-content">
              ${detailsContent}
            </div>
          </details>
        `;
      }
      
      // Add image if present
      let imageHtml = '';
      if (event.image) {
        imageHtml = `<div class="bible-event-image"><img src="${event.image}" alt="${event.title}" onclick="window.open('${event.image}', '_blank')"></div>`;
      }
      
      // Only show description div if there's content
      const descriptionHtml = linkedDescription 
        ? `<div class="bible-event-description">${linkedDescription}</div>` 
        : '';
      
      // Only show verse div if there's content
      const verseHtml = verseLink 
        ? `<div class="bible-event-verse">${verseLink}</div>` 
        : '';
      
      // Build timeline link if this event has a historical event ID
      let timelineLinkHtml = '';
      const historicalEventId = event._historicalEvent?.id;
      if (historicalEventId) {
        timelineLinkHtml = `<a href="#" class="bible-event-timeline-link" onclick="viewEventOnTimeline('${historicalEventId}'); return false;" title="View on Timeline">📊</a>`;
      }
      
      // Build display title with icon and year (for anniversary events)
      let displayTitle = event.title || 'Untitled Event';
      
      // Prepend icon if present and not already in title
      if (event.icon && !displayTitle.startsWith(event.icon)) {
        displayTitle = `${event.icon} ${displayTitle}`;
      }
      
      // Add year if available and not already in title
      if (event.yearStr && !displayTitle.includes(event.yearStr)) {
        displayTitle = `${displayTitle} (${event.yearStr})`;
      }
      
      eventsHtml += `
        <div class="bible-event-item${eventClass}">
          ${conditionBadge}
          <div class="bible-event-title-row">
            <div class="bible-event-title">${displayTitle}</div>
            ${timelineLinkHtml}
          </div>
          ${descriptionHtml}
          ${quoteHtml}
          ${imageHtml}
          ${detailsHtml}
          ${verseHtml}
          ${bookLinkHtml}
        </div>
      `;
    }
    
    eventsHtml += '</div></div>';
    bibleEventsContainer.innerHTML = eventsHtml;
  } else {
    bibleEventsContainer.innerHTML = '';
  }
  
  // Populate Torah portion for Sabbath days
  const torahContainer = panel.querySelector('.day-detail-torah-portion');
  if (torahContainer && typeof getTorahPortionForSabbath === 'function' && isSabbath(dayObj)) {
    const portionInfo = getTorahPortionForSabbath(dayObj, month, state.sabbathMode);
    if (portionInfo && (portionInfo.portion || portionInfo.holidayReplacement)) {
      torahContainer.innerHTML = formatTorahPortionDisplay(portionInfo);
    } else {
      torahContainer.innerHTML = '';
    }
  } else if (torahContainer) {
    torahContainer.innerHTML = '';
  }
  
  // Populate astronomical times in header (to the right of date info)
  const astroTimesContainer = panel.querySelector('.day-detail-astro-times');
  const astroTimes = getAstronomicalTimes(dayObj.gregorianDate);
  if (astroTimes) {
    astroTimesContainer.innerHTML = `
      <div class="astro-times-title">☀️ Astronomical Times</div>
      <div class="astro-times-row">
        <div class="astro-times-group">
          <div class="astro-time"><span class="astro-label">Daybreak:</span> <span class="astro-value">${astroTimes.firstLight}</span></div>
          <div class="astro-time"><span class="astro-label">Sunrise:</span> <span class="astro-value">${astroTimes.sunrise}</span></div>
        </div>
        <div class="astro-times-group">
          <div class="astro-time"><span class="astro-label">Sunset:</span> <span class="astro-value">${astroTimes.sunset}</span></div>
          <div class="astro-time"><span class="astro-label">Twilight:</span> <span class="astro-value">${astroTimes.nauticalTwilight}</span></div>
        </div>
      </div>
    `;
  } else {
    astroTimesContainer.innerHTML = '';
  }
  
  // Populate additional info
  const infoContainer = panel.querySelector('.day-detail-info');
  let infoHtml = '';
  
  if (isSabbath(dayObj)) {
    const sabbathLabel = state.sabbathMode === 'lunar' ? 'Lunar Sabbath' : 
                         state.sabbathMode === 'saturday' ? 'Shabbat' :
                         state.sabbathMode === 'sunday' ? 'Lord\'s Day' :
                         state.sabbathMode === 'friday' ? 'Jumu\'ah' : 
                         'Rest Day';
    infoHtml += `<div class="day-detail-sabbath">🕯️ ${sabbathLabel}</div>`;
  }
  
  if (dayObj.moonPhase && dayObj.lunarDay !== 1) {
    infoHtml += `<div>Moon phase: ${dayObj.moonPhase}</div>`;
  }
  
  infoContainer.innerHTML = infoHtml;
  
  // Populate priestly course display (in header, under Gregorian date)
  const priestlyContainer = panel.querySelector('.day-detail-priestly-course');
  if (priestlyContainer && typeof getPriestlyCourseForDay === 'function') {
    // Skip Day 1 for lunar sabbath (Day 1 is New Moon day, not part of a week)
    const skipPriestlyCourse = dayObj.lunarDay === 1 && state.sabbathMode === 'lunar';
    
    if (!skipPriestlyCourse) {
      const courseInfo = getPriestlyCourseForDay(dayObj, month);
      if (courseInfo) {
        // Handle dates before Temple dedication
        if (courseInfo.beforeDedication) {
          const dedicationYear = Math.abs(courseInfo.dedicationYear - 1); // Convert to BC year
          priestlyContainer.innerHTML = `
            <span class="priestly-course-subtle before-dedication">
              <span class="priestly-course-clickable" onclick="navigateToDedicationDate()" title="Navigate to Temple Dedication">
                🏛️ Before priestly cycle (est. ${dedicationYear} BC)
              </span>
            </span>
          `;
        } else {
          // Check if this course has extra info (notes or famous_people)
          const hasExtraInfo = (courseInfo.notes && courseInfo.notes.trim()) || 
                              (courseInfo.famous_people && courseInfo.famous_people.length > 0);
          
          let infoIconHtml = '';
          if (hasExtraInfo) {
            // Build popup content
            let popupContent = '';
            if (courseInfo.notes && courseInfo.notes.trim()) {
              popupContent += `<div class="priestly-popup-notes">${courseInfo.notes}</div>`;
            }
            if (courseInfo.famous_people && courseInfo.famous_people.length > 0) {
              popupContent += `<div class="priestly-popup-famous"><strong>Notable figures:</strong><ul>`;
              for (const person of courseInfo.famous_people) {
                popupContent += `<li><strong>${person.name}</strong>: ${person.notes}</li>`;
              }
              popupContent += `</ul></div>`;
            }
            // Escape quotes for HTML attribute
            const escapedContent = popupContent.replace(/"/g, '&quot;');
            infoIconHtml = `<span class="priestly-info-trigger" data-popup="${escapedContent}">ⓘ</span>`;
          }
          
          priestlyContainer.innerHTML = `
            <span class="priestly-course-subtle">
              <button class="priestly-nav-btn" onclick="jumpToPriestlyCourse(${courseInfo.order}, -1)" title="Previous time ${courseInfo.course} served">◀</button>
              ${infoIconHtml}<span class="priestly-course-clickable" onclick="showPriestlyPage()" title="View all priestly divisions">${courseInfo.course} (${courseInfo.order}) — ${courseInfo.meaning}</span>
              <button class="priestly-nav-btn" onclick="jumpToPriestlyCourse(${courseInfo.order}, 1)" title="Next time ${courseInfo.course} serves">▶</button>
            </span>
          `;
        }
      } else {
        priestlyContainer.innerHTML = '';
      }
    } else {
      priestlyContainer.innerHTML = '';
    }
  }
  
  // Populate dateline visualization for Day 1
  const datelineContainer = panel.querySelector('.day-detail-dateline');
  if (dayObj.lunarDay === 1 && month.moonEvent) {
    const datelineHtml = renderDatelineVisualization(month.moonEvent);
    datelineContainer.innerHTML = datelineHtml;
  } else {
    datelineContainer.innerHTML = '';
  }
  
  // Populate profile comparison section (World Clock style)
  const compareContainer = panel.querySelector('.day-detail-profile-compare');
  // Get the selected Julian Day from AppStore
  const selectedJD = (typeof AppStore !== 'undefined') ? AppStore.getState()?.context?.selectedDate : null;
  
  const entries = getWorldClockEntries();
  
  if (entries.length > 0) {
    let compareHtml = `
      <div class="profile-compare-header">
        <span class="profile-compare-title">📅 This Moment on Other Calendars</span>
        <button class="world-clock-add-btn" onclick="showAddWorldClockModal()" title="Add Calendar">+</button>
      </div>`;
    compareHtml += `<div class="profile-compare-grid">`;
    
    let hasResults = false;
    entries.forEach((entry, index) => {
      const profile = window.PROFILES?.[entry.profileId];
      if (!profile) return;
      
      // Create a temp profile with the entry's location
      const coords = URLRouter.CITY_SLUGS?.[entry.locationSlug];
      if (!coords) return;
      
      const tempProfile = {
        ...profile,
        lat: coords.lat,
        lon: coords.lon
      };
      
      const lunarDayInfo = (typeof getLunarDayForJD === 'function' && selectedJD) 
        ? getLunarDayForJD(selectedJD, tempProfile) : null;
      if (!lunarDayInfo) return;
      
      hasResults = true;
      
      // Check if this is the current view
      const appState = typeof AppStore !== 'undefined' ? AppStore.getState() : {};
      const currentLocSlug = (typeof URLRouter !== 'undefined' && URLRouter._getLocationSlug) 
        ? URLRouter._getLocationSlug(appState.context?.location || {}) : 'jerusalem';
      const isCurrent = entry.profileId === (appState.context?.profileId || 'timeTested') && 
                        entry.locationSlug === currentLocSlug;
      
      // Get feast icons for this lunar day/month
      const feastIcons = getFeastIconsForLunarDay(lunarDayInfo.month, lunarDayInfo.day);
      const feastHtml = feastIcons.length > 0 ? `<div class="profile-compare-feasts">${feastIcons.join('')}</div>` : '';
      
      // Get local time for this location
      const localTime = getLocalTimeForLocation(coords.lat, coords.lon);
      
      // Get priestly course for this calendar
      // Skip Day 1 for lunar sabbath (New Moon day isn't part of a week)
      let priestlyHtml = '';
      if (typeof getPriestlyCourse === 'function' && PRIESTLY_DIVISIONS) {
        const skipPriestly = lunarDayInfo.day === 1 && (profile.sabbathMode === 'lunar');
        if (!skipPriestly) {
          const courseInfo = getPriestlyCourse(
            new Date(checkTimestamp),
            lunarDayInfo.day,
            lunarDayInfo.month,
            { ...tempProfile, sabbathMode: profile.sabbathMode || 'lunar' }
          );
          if (courseInfo && !courseInfo.beforeDedication && courseInfo.course) {
            priestlyHtml = `<span class="priest-icon">👨‍🦳</span><span title="${courseInfo.meaning || ''}">${courseInfo.course}</span>`;
          }
        }
      }
      
      compareHtml += `
        <div class="profile-compare-item${isCurrent ? ' current' : ''}" onclick="navigateToWorldClockEntry('${entry.profileId}', '${entry.locationSlug}')">
          <button class="world-clock-remove-btn" onclick="event.stopPropagation(); removeWorldClockEntryAndRefresh(${index})" title="Remove">×</button>
          <span class="profile-compare-name">${renderProfileIcon(profile)} ${profile.name}</span>
          <span class="profile-compare-day">Day ${lunarDayInfo.day} of Month ${lunarDayInfo.month}</span>
          <span class="profile-compare-location">${entry.locationName || formatCitySlug(entry.locationSlug)} · ${localTime}</span>
          ${priestlyHtml ? `<span class="profile-compare-priest">${priestlyHtml}</span>` : ''}
          ${feastHtml}
        </div>
      `;
    });
    
    compareHtml += `</div>`;
    
    if (hasResults) {
      compareContainer.innerHTML = compareHtml;
    } else {
      compareContainer.innerHTML = '';
    }
  } else {
    compareContainer.innerHTML = '';
  }
  
  // Show the panel (reset both inline style and class)
  panel.style.display = '';  // Reset any inline display:none from settings page
  panel.classList.remove('hidden');
}

// Date Jump Popup functions
function toggleDateJump() {
  const overlay = document.getElementById('date-jump-overlay');
  const popup = document.getElementById('date-jump-popup');
  const isOpen = overlay.classList.contains('open');
  
  if (!isOpen) {
    // Opening - sync the datetime input
    const gotoDate = document.getElementById('goto-date').value;
    const datetimeInput = document.getElementById('jump-datetime');
    const ancientDisplay = document.getElementById('jump-ancient-display');
    const ancientDateText = document.getElementById('jump-ancient-date');
    
    if (gotoDate) {
      // Modern date - show datetime picker
      datetimeInput.value = gotoDate;
      datetimeInput.style.display = 'block';
      ancientDisplay.style.display = 'none';
    } else if (state.selectedTimestamp) {
      // Ancient date - show text display instead
      const date = new Date(state.selectedTimestamp);
      const dateStr = formatDisplayDate(date);
      ancientDateText.textContent = dateStr;
      datetimeInput.style.display = 'none';
      ancientDisplay.style.display = 'block';
    }
  }
  
  overlay.classList.toggle('open');
  popup.style.display = isOpen ? 'none' : 'block';
}

function executeJumpToDate() {
  const datetime = document.getElementById('jump-datetime').value;
  if (!datetime) {
    alert('Please enter a date');
    return;
  }
  document.getElementById('goto-date').value = datetime;
  jumpToDate();
  toggleDateJump();
}

function jumpToTodayFromPopup() {
  toggleDateJump();
  jumpToToday();
}

function addDaysFromPopup(direction) {
  const datetime = document.getElementById('jump-datetime').value;
  const days = parseInt(document.getElementById('jump-days').value) || 1;
  
  // For ancient dates, datetime input will be empty, use selectedTimestamp
  let utcTimestamp;
  if (datetime) {
    utcTimestamp = parseDatetimeLocal(datetime);
  } else if (state.selectedTimestamp) {
    utcTimestamp = state.selectedTimestamp;
  } else {
    alert('Please select a date first');
    return;
  }
  const newTimestamp = utcTimestamp + (direction * days * 24 * 60 * 60 * 1000);
  
  const formattedDate = formatLocalDatetime(newTimestamp);
  if (formattedDate) {
    // Modern date - update datetime input
    document.getElementById('jump-datetime').value = formattedDate;
    document.getElementById('jump-datetime').style.display = 'block';
    document.getElementById('jump-ancient-display').style.display = 'none';
  } else {
    // Ancient date - update text display
    const date = new Date(newTimestamp);
    document.getElementById('jump-ancient-date').textContent = formatDisplayDate(date);
    document.getElementById('jump-datetime').style.display = 'none';
    document.getElementById('jump-ancient-display').style.display = 'block';
  }
  
  document.getElementById('goto-date').value = formattedDate;
  state.selectedTimestamp = newTimestamp;
  jumpToDate();
}

// Jump to a specific equinox date and highlight that day
function jumpToEquinoxDate(equinoxDate) {
  const targetDate = new Date(equinoxDate);
  
  // Find this date in the current lunar months
  for (let m = 0; m < state.lunarMonths.length; m++) {
    const month = state.lunarMonths[m];
    for (let d = 0; d < month.days.length; d++) {
      const day = month.days[d];
      // Check if equinox falls on this day
      if (day.equinox && day.equinox.date.toDateString() === targetDate.toDateString()) {
        state.currentMonthIndex = m;
        state.highlightedLunarDay = day.lunarDay;
        state.selectedTimestamp = getSunriseTimestamp(day.gregorianDate);
        document.getElementById('goto-date').value = formatLocalDatetime(state.selectedTimestamp);
        renderMonth(state.lunarMonths[state.currentMonthIndex]);
        updateMonthButtons();
        updateURL();
        showDayDetail(day, month);
        return;
      }
    }
  }
  
  // If not found in current year's months, the equinox might be in a different year
  // Navigate to that year first
  const equinoxYear = targetDate.getFullYear();
  if (equinoxYear !== state.year) {
    state.year = equinoxYear;
    updateUI();
    generateCalendar();
    // Try again after regenerating
    jumpToEquinoxDate(equinoxDate);
  }
}

// Priestly info popup handling
let currentPriestlyPopup = null;

function showPriestlyInfoPopup(trigger) {
  hidePriestlyInfoPopup();
  
  const content = trigger.dataset.popup;
  if (!content) return;
  
  const popup = document.createElement('div');
  popup.className = 'priestly-info-popup';
  popup.innerHTML = content;
  document.body.appendChild(popup);
  
  // Position the popup near the trigger
  const triggerRect = trigger.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();
  
  // Position below the trigger by default
  let top = triggerRect.bottom + 8;
  let left = triggerRect.left - 20;
  
  // Adjust if popup goes off screen
  if (left + popupRect.width > window.innerWidth - 10) {
    left = window.innerWidth - popupRect.width - 10;
  }
  if (left < 10) left = 10;
  
  // If popup would go below screen, show above
  if (top + popupRect.height > window.innerHeight - 10) {
    top = triggerRect.top - popupRect.height - 8;
    // Move the arrow to point up
    popup.style.setProperty('--arrow-top', 'auto');
    popup.style.setProperty('--arrow-bottom', '-8px');
  }
  
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
  
  currentPriestlyPopup = popup;
}

function hidePriestlyInfoPopup() {
  if (currentPriestlyPopup) {
    currentPriestlyPopup.remove();
    currentPriestlyPopup = null;
  }
}

// Event delegation for priestly info triggers
document.addEventListener('mouseover', (e) => {
  const trigger = e.target.closest('.priestly-info-trigger');
  if (trigger) {
    showPriestlyInfoPopup(trigger);
  }
});

document.addEventListener('mouseout', (e) => {
  const trigger = e.target.closest('.priestly-info-trigger');
  if (trigger && currentPriestlyPopup) {
    // Only hide if not moving to the popup itself
    const related = e.relatedTarget;
    if (!related || !related.closest('.priestly-info-popup')) {
      hidePriestlyInfoPopup();
    }
  }
});

// Allow hovering over the popup itself
document.addEventListener('mouseover', (e) => {
  if (e.target.closest('.priestly-info-popup')) {
    // Keep popup visible
  }
});

document.addEventListener('mouseout', (e) => {
  if (e.target.closest('.priestly-info-popup')) {
    const related = e.relatedTarget;
    if (!related || (!related.closest('.priestly-info-popup') && !related.closest('.priestly-info-trigger'))) {
      hidePriestlyInfoPopup();
    }
  }
});

// Touch support for mobile
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('.priestly-info-trigger');
  if (trigger) {
    e.preventDefault();
    e.stopPropagation();
    if (currentPriestlyPopup) {
      hidePriestlyInfoPopup();
    } else {
      showPriestlyInfoPopup(trigger);
    }
  } else if (currentPriestlyPopup && !e.target.closest('.priestly-info-popup')) {
    hidePriestlyInfoPopup();
  }
});

// View an event on the timeline (navigates to timeline view and opens event detail)
function viewEventOnTimeline(eventId) {
  if (typeof AppStore !== 'undefined') {
    // Switch to timeline view
    AppStore.dispatch({ type: 'SET_VIEW', view: 'timeline' });
    // Then set the event to show (after view is set, so timeline state isn't cleared)
    AppStore.dispatch({ type: 'SET_TIMELINE_EVENT', eventId: eventId });
  }
}
window.viewEventOnTimeline = viewEventOnTimeline;

// Navigate to a specific calendar date from day detail (for historical events)
function navigateToCalendarDate(year, lunarMonth, lunarDay) {
  // Set the calendar year and regenerate
  state.year = year;
  
  if (typeof generateCalendar === 'function') {
    generateCalendar();
  }
  
  // Navigate to the specific lunar month and day
  const monthIndex = lunarMonth - 1;
  if (state.lunarMonths && monthIndex >= 0 && monthIndex < state.lunarMonths.length) {
    state.currentMonthIndex = monthIndex;
    state.highlightedLunarDay = lunarDay;
    
    // Find the day object and show detail
    const month = state.lunarMonths[monthIndex];
    const dayObj = month.days.find(d => d.lunarDay === lunarDay);
    if (dayObj) {
      state.selectedTimestamp = typeof getSunriseTimestamp === 'function' 
        ? getSunriseTimestamp(dayObj.gregorianDate) 
        : dayObj.gregorianDate.getTime();
      if (typeof showDayDetail === 'function') {
        showDayDetail(dayObj, month);
      }
    }
    
    // Render the month and update UI
    if (typeof renderMonth === 'function') {
      renderMonth(month);
    }
    if (typeof updateMonthButtons === 'function') {
      updateMonthButtons();
    }
  }
  
  // Update URL
  if (typeof updatePathURL === 'function') {
    updatePathURL();
  }
}

// Expose navigateToCalendarDate globally
window.navigateToCalendarDate = navigateToCalendarDate;
