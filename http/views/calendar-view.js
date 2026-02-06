/**
 * CalendarView - Main calendar display
 * 
 * Renders calendar HTML that matches the structure expected by styles.css.
 * Uses global utility functions (getJubileeInfo, formatJubileeDisplay, etc.)
 * All logic should be in AppStore or utility modules, not here.
 */

const CalendarView = {
  // Track if resize listener has been added
  _resizeListenerAdded: false,
  _lastWasMobile: null,
  
  // Month name constants (should be moved to a constants module)
  MONTH_NAMES: [
    '1st Month', '2nd Month', '3rd Month', '4th Month', '5th Month', '6th Month',
    '7th Month', '8th Month', '9th Month', '10th Month', '11th Month', '12th Month', '13th Month'
  ],
  
  WEEKDAY_NAMES: ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.'],
  
  SCRIPTURES: [
    { text: "This month shall be unto you the beginning of months...", ref: "Exodus 12:2" },
    { text: "In the second month, on the fourteenth day...", ref: "Numbers 9:11" },
    { text: "In the third month, when the children of Israel were gone forth...", ref: "Exodus 19:1" },
    { text: "Thus saith the LORD; I remember thee...", ref: "Jeremiah 2:2" },
    { text: "How doth the city sit solitary...", ref: "Lamentations 1:1" },
    { text: "I will search Jerusalem with candles...", ref: "Zephaniah 1:12" },
    { text: "Blow the trumpet in Zion, sanctify a fast...", ref: "Joel 2:15" },
    { text: "Seek the LORD while he may be found...", ref: "Isaiah 55:6" },
    { text: "Not by might, nor by power, but by my spirit...", ref: "Zechariah 4:6" },
    { text: "Arise, shine; for thy light is come...", ref: "Isaiah 60:1" },
    { text: "He appointed the moon for seasons; the sun knows its going down.", ref: "Psalms 104:19" },
    { text: "The wilderness and the solitary place shall be glad...", ref: "Isaiah 35:1" },
    { text: "For, lo, the winter is past, the rain is over and gone...", ref: "Song 2:11" }
  ],

  init() {},
  cleanup() {},

  render(state, derived, container) {
    const { context, content } = state;
    const { lunarMonths, currentMonthIndex, currentLunarDay, year } = derived;
    
    
    // Everything derived from selectedDate (JD) - the single source of truth
    const monthIndex = currentMonthIndex;
    const selectedDay = currentLunarDay;
    const month = lunarMonths?.[monthIndex];
    
    
    if (!month || !lunarMonths || lunarMonths.length === 0) {
      container.innerHTML = `
        <div class="calendar-app">
          <div class="month-calendar" style="padding: 40px; text-align: center;">
            <div class="loading-spinner" style="margin: 0 auto 20px;"></div>
            <p style="color: #7ec8e3;">Loading calendar data...</p>
            <p style="color: #888; font-size: 0.9em;">Year: ${this.formatYear(year)}</p>
          </div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.renderCalendar(state, derived, month, monthIndex, selectedDay);
    this.attachEventListeners(container, month);
    
    // Populate world clock section after main render (non-blocking)
    if (selectedDay) {
      const _derived = derived;
      const _context = state.context;
      requestAnimationFrame(() => {
        this.populateWorldClock(container, _derived, _context);
      });
    }
    
    // If date calculator is open (restored from URL), compute the result preview
    if (state.ui.calcOpen) {
      requestAnimationFrame(() => this.computeDateCalc());
    }
    
    // Update left panel with feast list and priestly cycles
    const profile = derived.config || {};
    this.updateLeftPanel(lunarMonths, profile);
    
    // Sync panel open/close state with app state
    this.syncPanelState(state);
    
    // Set up resize listener (once) to close sidebar when entering mobile mode
    this.setupResizeListener();
  },
  
  setupResizeListener() {
    if (this._resizeListenerAdded) return;
    this._resizeListenerAdded = true;
    this._lastWasMobile = this.isMobileMode();
    
    window.addEventListener('resize', () => {
      const isMobile = this.isMobileMode();
      // Close sidebars when transitioning from desktop to mobile
      if (isMobile && !this._lastWasMobile) {
        this.closeFeastSidebar();
        this.closePriestlyPanel();
      }
      this._lastWasMobile = isMobile;
    });
  },

  renderCalendar(state, derived, month, monthIndex, selectedDay) {
    const { context, content } = state;
    const { lunarMonths, year } = derived;
    const profile = window.PROFILES?.[context.profileId] || {};
    const sabbathMode = profile.sabbathMode || 'lunar';
    
    // Get data for rendering
    const day1 = month.days.find(d => d.lunarDay === 1);
    const day2 = month.days.find(d => d.lunarDay === 2);
    const day2Weekday = day2?.weekday || 0;
    
    // Weekday labels shifted to start from Day 2's weekday
    const shiftedWeekdays = [];
    for (let i = 0; i < 7; i++) {
      shiftedWeekdays.push(this.WEEKDAY_NAMES[(day2Weekday + i) % 7]);
    }
    
    // Sabbath column (for lunar: always column 7)
    const sabbathColumnIndex = sabbathMode === 'lunar' ? 6 : this.getSabbathColumn(day2Weekday, sabbathMode);
    
    // Today check - use derived values from AppStore (single source of truth)
    const todayMonthIndex = derived.todayMonthIndex;
    const todayLunarDay = derived.todayLunarDay;
    const isThisMonthToday = (monthIndex === todayMonthIndex);
    
    // Calculate current time progress for today's cell (0-100%)
    const timeProgress = isThisMonthToday ? this.calculateTimeProgress(month, todayLunarDay, profile, context.location) : null;
    
    // Calculate selected time progress for the selected day (0-100%)
    // Use getLocalTime() to convert UTC time to local display time
    const localTime = AppStore.getLocalTime();
    const selectedTimeProgress = this.calculateSelectedTimeProgress(month, selectedDay, profile, context.location, localTime);
    
    // Display year from first month
    const firstDay1 = lunarMonths[0]?.days?.find(d => d.lunarDay === 1);
    const displayYear = firstDay1?.gregorianDate.getUTCFullYear() || year;
    
    // Jubilee info
    const jubileeInfo = typeof getJubileeInfo === 'function' ? getJubileeInfo(displayYear) : null;
    const jubileeDisplay = jubileeInfo && typeof formatJubileeDisplay === 'function' 
      ? formatJubileeDisplay(jubileeInfo) : `Year ${displayYear}`;
    
    // Scripture
    const scripture = this.SCRIPTURES[(month.monthNumber - 1) % this.SCRIPTURES.length];
    
    // Calculate daylight gradient (using original logic from calendar-core.js)
    const dayCycleGradient = this.calculateDaylightGradient(day1, profile.dayStartTime || 'morning');
    
    return `
      <div class="calendar-app">
        <div class="month-calendar">
          <div class="calendar-header">
            <!-- Header Row 2: Jubilee label + Datetime/Location controls -->
            <div class="header-row-2">
              <span class="jubilee-text">${jubileeDisplay}</span>
              <div class="header-controls">
                <div class="header-dropdown datetime" data-action="datetime-picker">
                  <span>${this.formatYear(displayYear)} · Month ${month.monthNumber} · ${this.formatTime(context)}</span>
                  <span class="dropdown-arrow">▼</span>
                </div>
                <span class="header-separator">|</span>
                <div class="header-dropdown location" data-action="location-picker">
                  <span>${this.getLocationName(context.location)}</span>
                  <span class="dropdown-arrow">▼</span>
                </div>
              </div>
            </div>
            
            <!-- Day 1 box -->
            ${(() => {
              const day1Icons = day1 ? this.getDayIconsHtml(day1) : { feastIcons: '', eventIcons: '' };
              const isDay1Today = isThisMonthToday && todayLunarDay === 1;
              const isDay1Selected = selectedDay === 1;
              const day1TimeIndicator = (isDay1Today && timeProgress !== null) 
                ? `<div class="time-indicator time-indicator-now" style="left: ${timeProgress}%"></div>` 
                : '';
              const day1SelectedIndicator = (isDay1Selected && selectedTimeProgress !== null)
                ? `<div class="time-indicator time-indicator-selected" style="left: ${selectedTimeProgress}%"></div>`
                : '';
              return `
              <div class="new-moon-box day-cell new-moon${isDay1Selected ? ' highlighted' : ''}${isDay1Today ? ' today' : ''}${day1?.feasts?.length > 0 ? ' feast' : ''}${day1?.events?.length > 0 ? ' has-events' : ''}" 
                   data-lunar-day="1"
                   title="${day1?.jd != null ? 'JD ' + Math.floor(day1.jd) + ' · ' + day1.weekdayName : ''}">
                ${day1TimeIndicator}
                ${day1SelectedIndicator}
                <div class="gregorian">${day1 ? this.formatShortDate(day1.gregorianDate) : ''}<span class="day-year">${day1 ? this.formatYear(day1.gregorianDate.getUTCFullYear()) : ''}</span></div>
                <div class="moon-phase">${this.getMoonIcon(profile.moonPhase)}</div>
                <div class="lunar-day">1</div>
                ${day1Icons.eventIcons ? `<div class="day-icons-left">${day1Icons.eventIcons}</div>` : ''}
                ${day1Icons.feastIcons ? `<div class="day-icons-right">${day1Icons.feastIcons}</div>` : ''}
              </div>`;
            })()}
          </div>
          
          <!-- Week Header -->
          <div class="week-header">
            ${[0,1,2,3,4,5,6].map(i => {
              // Day number (1-7), Sabbath column shows "S"
              const dayNum = sabbathColumnIndex === -1 ? i + 1 : ((i - sabbathColumnIndex - 1 + 7) % 7) + 1;
              const isSabbath = i === sabbathColumnIndex;
              const dayLabel = isSabbath ? 'S' : dayNum;
              return `<div class="day-label${isSabbath ? ' sabbath-header' : ''}"><span class="weekday-name">${shiftedWeekdays[i]}</span><span class="day-num">${dayLabel}</span></div>`;
            }).join('')}
          </div>
          
          <!-- Daylight Indicator -->
          <div class="day-cycle-bar" style="background: ${dayCycleGradient.gradient}; background-size: calc(100% / 7) 100%;" title="Day/night cycle (~${dayCycleGradient.percent}% daylight)"></div>
          
          <!-- Calendar Grid -->
          <div class="calendar-grid">
            ${this.renderDays(month, selectedDay, sabbathMode, sabbathColumnIndex, isThisMonthToday, todayLunarDay, profile, context.location, selectedTimeProgress)}
          </div>
          
          <!-- Month Buttons -->
          <div id="month-buttons" class="month-buttons-container">
            ${this.renderMonthButtons(lunarMonths.length, monthIndex)}
          </div>
        </div>
        
        <!-- Day Detail -->
        ${selectedDay ? this.renderDayDetail(month, selectedDay, profile, context.location) : ''}
      </div>
    `;
  },

  renderDays(month, selectedDay, sabbathMode, sabbathColumnIndex, isThisMonthToday, todayLunarDay, profile, location, selectedTimeProgress) {
    const weeks = [[2,3,4,5,6,7,8], [9,10,11,12,13,14,15], [16,17,18,19,20,21,22], [23,24,25,26,27,28,29]];
    let html = '';
    
    // Calculate current time progress for today's cell
    const timeProgress = isThisMonthToday ? this.calculateTimeProgress(month, todayLunarDay, profile, location) : null;
    
    for (const week of weeks) {
      for (const lunarDay of week) {
        const day = month.days.find(d => d.lunarDay === lunarDay);
        if (!day) {
          html += '<div class="day-cell empty"></div>';
          continue;
        }
        
        const isSabbath = this.isSabbath(lunarDay, day, sabbathMode);
        const isToday = isThisMonthToday && lunarDay === todayLunarDay;
        const isSelected = lunarDay === selectedDay;
        const hasFeasts = day.feasts && day.feasts.length > 0;
        const hasEvents = day.events && day.events.length > 0;
        
        let classes = ['day-cell'];
        if (isSabbath) classes.push('sabbath');
        if (isToday) classes.push('today');
        if (isSelected) classes.push('highlighted');
        if (hasFeasts) classes.push('feast');
        if (hasEvents) classes.push('has-events');
        
        // Build feast/event icons (separated)
        const dayIcons = this.getDayIconsHtml(day);
        
        // Time indicator for today's cell (current time - NOW)
        const timeIndicator = (isToday && timeProgress !== null) 
          ? `<div class="time-indicator time-indicator-now" style="left: ${timeProgress}%"></div>` 
          : '';
        
        // Selected time indicator for the selected day
        const selectedIndicator = (isSelected && selectedTimeProgress !== null)
          ? `<div class="time-indicator time-indicator-selected" style="left: ${selectedTimeProgress}%"></div>`
          : '';
        
        html += `
          <div class="${classes.join(' ')}" data-lunar-day="${lunarDay}" title="JD ${day.jd != null ? Math.floor(day.jd) : '?'} · ${day.weekdayName || ''}">
            ${timeIndicator}
            ${selectedIndicator}
            <div class="gregorian">${this.formatShortDate(day.gregorianDate)}</div>
            <div class="moon-phase">${this.getMoonIconForDay(day, lunarDay, profile, location)}</div>
            <div class="lunar-day">${lunarDay}</div>
            ${dayIcons.eventIcons ? `<div class="day-icons-left">${dayIcons.eventIcons}</div>` : ''}
            ${dayIcons.feastIcons ? `<div class="day-icons-right">${dayIcons.feastIcons}</div>` : ''}
          </div>
        `;
      }
    }
    
    // Day 30 - always show space even if month doesn't have 30 days
    const day30 = month.days.find(d => d.lunarDay === 30);
    if (day30) {
      const isToday30 = isThisMonthToday && todayLunarDay === 30;
      const isSelected30 = selectedDay === 30;
      const hasFeasts30 = day30.feasts && day30.feasts.length > 0;
      const hasEvents30 = day30.events && day30.events.length > 0;
      
      let classes30 = ['day-cell'];
      if (isToday30) classes30.push('today');
      if (isSelected30) classes30.push('highlighted');
      if (hasFeasts30) classes30.push('feast');
      if (hasEvents30) classes30.push('has-events');
      
      const dayIcons30 = this.getDayIconsHtml(day30);
      
      // Time indicator for day 30 if it's today (NOW)
      const timeIndicator30 = (isToday30 && timeProgress !== null) 
        ? `<div class="time-indicator time-indicator-now" style="left: ${timeProgress}%"></div>` 
        : '';
      
      // Selected time indicator for day 30 if it's selected
      const selectedIndicator30 = (isSelected30 && selectedTimeProgress !== null)
        ? `<div class="time-indicator time-indicator-selected" style="left: ${selectedTimeProgress}%"></div>`
        : '';
      
      html += `
        <div class="${classes30.join(' ')}" data-lunar-day="30" title="JD ${day30.jd != null ? Math.floor(day30.jd) : '?'} · ${day30.weekdayName || ''}">
          ${timeIndicator30}
          ${selectedIndicator30}
          <div class="gregorian">${this.formatShortDate(day30.gregorianDate)}</div>
          <div class="moon-phase">${this.getMoonIconForDay(day30, 30, profile, location)}</div>
          <div class="lunar-day">30</div>
          ${dayIcons30.eventIcons ? `<div class="day-icons-left">${dayIcons30.eventIcons}</div>` : ''}
          ${dayIcons30.feastIcons ? `<div class="day-icons-right">${dayIcons30.feastIcons}</div>` : ''}
        </div>
      `;
    } else {
      // Empty placeholder for day 30 when month only has 29 days
      html += `<div class="day-cell empty day-30-placeholder"></div>`;
    }
    
    // Navigation + Profile name row
    const profileName = profile.name || 'Time-Tested';
    html += `
      <div class="month-nav-cell nav-group">
        <span class="nav-arrow year-nav" data-action="prev-year" title="Previous Year">⏮</span>
        <span class="nav-arrow month-nav" data-action="prev-month" title="Previous Month">◀</span>
      </div>
      <div class="profile-nav-cell span-4">
        <div class="profile-display" data-action="profile-editor" title="Edit Profile Settings">
          <span class="profile-icon">${profile.icon || '🌕'}</span>
          <span class="profile-name">${profileName}</span>
        </div>
        <button class="feast-toggle-btn" data-action="toggle-feasts" title="Show Appointed Times">
          🎉 <span class="feast-btn-label">Feasts</span>
        </button>
        <button class="priestly-toggle-btn" data-action="toggle-priestly" title="Show Priestly Courses">
          👨‍🦳
        </button>
      </div>
      <div class="month-nav-cell nav-group">
        <span class="nav-arrow month-nav" data-action="next-month" title="Next Month">▶</span>
        <span class="nav-arrow year-nav" data-action="next-year" title="Next Year">⏭</span>
      </div>
    `;
    
    return html;
  },

  renderMonthButtons(monthCount, currentIndex) {
    let html = '';
    // Only render buttons for actual months in this year (12 or 13)
    for (let i = 0; i < monthCount; i++) {
      const isActive = i === currentIndex;
      html += `<button class="month-btn${isActive ? ' active' : ''}" data-month="${i}">${i + 1}</button>`;
    }
    return html;
  },
  
  renderFeastList(months) {
    if (!months || months.length === 0) return '<div class="feast-list-empty">No calendar data</div>';
    
    // Get FEASTS array
    const feasts = typeof getAllFeasts === 'function' ? getAllFeasts() : (typeof FEASTS !== 'undefined' ? FEASTS : []);
    if (!feasts || feasts.length === 0) return '<div class="feast-list-empty">Feast data not loaded</div>';
    
    // Track shown feasts for multi-month handling
    const shownFeasts = new Set();
    const feastEntries = [];
    
    for (const feast of feasts) {
      // Skip continuation entries and Renewed Moon (too many)
      if (feast.name === 'Renewed Moon') continue;
      if (feast.continuesNextMonth === undefined && shownFeasts.has(feast.name)) continue;
      
      const month = months.find(m => m.monthNumber === feast.month);
      if (!month) continue;
      
      const day = month.days.find(d => d.lunarDay === feast.day);
      if (!day) continue;
      
      let dateStr;
      
      // Handle Hanukkah spanning two months
      if (feast.name === 'Hanukkah' && feast.continuesNextMonth) {
        shownFeasts.add('Hanukkah');
        dateStr = this.formatShortDate(day.gregorianDate);
      } else if (feast.name === 'Hanukkah' && !feast.continuesNextMonth) {
        continue; // Skip continuation entry
      } else {
        dateStr = this.formatShortDate(day.gregorianDate);
      }
      
      const monthIdx = months.findIndex(m => m.monthNumber === feast.month);
      
      feastEntries.push({
        feast,
        monthIdx,
        dayIdx: feast.day,
        dateStr,
        sortDate: day.gregorianDate
      });
    }
    
    // Sort by Gregorian date
    feastEntries.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
    
    // Build list items
    return feastEntries.map(entry => `
      <div class="feast-list-item" data-month="${entry.monthIdx}" data-day="${entry.dayIdx}">
        <span class="feast-icon">${entry.feast.icon}</span>
        <div class="feast-info">
          <div class="feast-name">${entry.feast.shortName || entry.feast.name}</div>
          <div class="feast-date">${entry.dateStr}</div>
        </div>
      </div>
    `).join('');
  },

  renderPriestlyCycleList(months, profile) {
    if (!months || months.length === 0) return '';
    if (typeof getPriestlyCourseForDay !== 'function') return '';
    if (typeof PRIESTLY_DIVISIONS === 'undefined' || !PRIESTLY_DIVISIONS) return '';
    
    const sabbathMode = profile?.sabbathMode || 'lunar';
    const entries = [];
    
    // For each month, find the priestly courses for each week
    for (let mi = 0; mi < months.length; mi++) {
      const month = months[mi];
      
      if (sabbathMode === 'lunar') {
        // Lunar sabbath: weeks are days 2-8, 9-15, 16-22, 23-29/30
        const weekStarts = [2, 9, 16, 23];
        for (const weekStart of weekStarts) {
          const dayObj = month.days.find(d => d.lunarDay === weekStart);
          if (!dayObj) continue;
          
          const courseInfo = getPriestlyCourseForDay(dayObj, month, profile);
          if (!courseInfo || courseInfo.beforeDedication) continue;
          
          // Find the sabbath (end of this week)
          const sabbathDay = weekStart === 2 ? 8 : weekStart === 9 ? 15 : weekStart === 16 ? 22 : 29;
          const sabbathObj = month.days.find(d => d.lunarDay === sabbathDay);
          
          entries.push({
            monthIdx: mi,
            monthNumber: month.monthNumber,
            weekStart,
            sabbathDay,
            startDate: dayObj.gregorianDate,
            endDate: sabbathObj ? sabbathObj.gregorianDate : dayObj.gregorianDate,
            course: courseInfo.course,
            order: courseInfo.order,
            meaning: courseInfo.meaning,
            hebrew: courseInfo.hebrew
          });
        }
      } else {
        // Saturday sabbath - check start of each week
        for (let d = 0; d < month.days.length; d++) {
          const dayObj = month.days[d];
          const weekday = Math.floor((dayObj.jd || 0) + 1.5) % 7;
          
          // Only process Sunday (start of week)
          if (weekday !== 0) continue;
          
          const courseInfo = getPriestlyCourseForDay(dayObj, month, profile);
          if (!courseInfo || courseInfo.beforeDedication) continue;
          
          // Find Saturday (end of week)
          const saturdayIdx = d + 6;
          const sabbathObj = saturdayIdx < month.days.length ? month.days[saturdayIdx] : null;
          
          entries.push({
            monthIdx: mi,
            monthNumber: month.monthNumber,
            weekStart: dayObj.lunarDay,
            sabbathDay: sabbathObj ? sabbathObj.lunarDay : dayObj.lunarDay,
            startDate: dayObj.gregorianDate,
            endDate: sabbathObj ? sabbathObj.gregorianDate : dayObj.gregorianDate,
            course: courseInfo.course,
            order: courseInfo.order,
            meaning: courseInfo.meaning,
            hebrew: courseInfo.hebrew
          });
        }
      }
    }
    
    if (entries.length === 0) return '<div class="priestly-list-empty">No priestly data available</div>';
    
    // Build HTML - list of courses for the year
    return entries.map(entry => `
      <div class="priestly-list-item" 
           data-month="${entry.monthIdx}" 
           data-day="${entry.weekStart}">
        <span class="priestly-order">${entry.order}</span>
        <div class="priestly-info">
          <div class="priestly-name">${entry.course}</div>
          <div class="priestly-dates">Month ${entry.monthNumber}: Days ${entry.weekStart}-${entry.sabbathDay}</div>
        </div>
      </div>
    `).join('');
  },

  renderDayDetail(month, lunarDay, profile, location) {
    const day = month.days.find(d => d.lunarDay === lunarDay);
    if (!day) return '';
    
    const weekday = day.weekdayName || ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day.weekday];
    
    // Get astronomical times for this day
    let astroTimesHtml = '';
    if (typeof getAstronomicalTimes === 'function' && day.gregorianDate) {
      const astroTimes = getAstronomicalTimes(day.gregorianDate, location);
      if (astroTimes) {
        astroTimesHtml = `
          <div class="day-detail-astro-times">
            <div class="astro-times-title">☀️ Sun & 🌙 Moon</div>
            <div class="astro-times-row">
              <div class="astro-times-group">
                <div class="astro-time"><span class="astro-label">Dark ends:</span> <span class="astro-value">${astroTimes.morningDark}</span></div>
                <div class="astro-time"><span class="astro-label">Dawn:</span> <span class="astro-value">${astroTimes.firstLight}</span></div>
                <div class="astro-time"><span class="astro-label">Sunrise:</span> <span class="astro-value">${astroTimes.sunrise}</span></div>
                <div class="astro-time"><span class="astro-label">Moonset:</span> <span class="astro-value">${astroTimes.moonset}</span></div>
              </div>
              <div class="astro-times-group">
                <div class="astro-time"><span class="astro-label">Sunset:</span> <span class="astro-value">${astroTimes.sunset}</span></div>
                <div class="astro-time"><span class="astro-label">Twilight:</span> <span class="astro-value">${astroTimes.civilTwilight}</span></div>
                <div class="astro-time"><span class="astro-label">Dark:</span> <span class="astro-value">${astroTimes.nauticalTwilight}</span></div>
                <div class="astro-time"><span class="astro-label">Moonrise:</span> <span class="astro-value">${astroTimes.moonrise}</span></div>
              </div>
            </div>
          </div>
        `;
      }
    }
    
    // Render priestly course
    let priestlyHtml = '';
    if (typeof getPriestlyCourseForDay === 'function') {
      // Skip Day 1 for lunar sabbath (Day 1 is New Moon day, not part of a week)
      const isNewMoonDay = day.lunarDay === 1 && (profile.sabbathMode === 'lunar');
      if (isNewMoonDay) {
        priestlyHtml = `
          <div class="day-detail-priestly new-moon-note">
            <span class="priestly-icon">🌑</span>
            <span class="priestly-note">Renewed Moon Day — outside the weekly priestly cycle</span>
          </div>
        `;
      } else {
        const courseInfo = getPriestlyCourseForDay(day, month);
        if (courseInfo && !courseInfo.beforeDedication) {
          priestlyHtml = `
            <div class="day-detail-priestly" onclick="CalendarView.openPriestlyPanel()" style="cursor: pointer;" title="View all priestly courses">
              <span class="priestly-icon">👨‍🦳</span>
              <span class="priestly-course">${courseInfo.course}</span>
              <span class="priestly-order">(${courseInfo.order})</span>
              <span class="priestly-meaning">— ${courseInfo.meaning}</span>
            </div>
          `;
        } else if (courseInfo && courseInfo.beforeDedication) {
          const dedicationYear = Math.abs(courseInfo.dedicationYear - 1);
          priestlyHtml = `
            <div class="day-detail-priestly before-dedication">
              <span class="priestly-icon">🏛️</span>
              <span class="priestly-note">Before priestly cycle (est. ${dedicationYear} BC)</span>
            </div>
          `;
        }
      }
    }
    
    // Render year start or 13th month explanation (Day 1 of Month 1 or 13)
    let yearInfoHtml = '';
    if (day.lunarDay === 1 && (month.monthNumber === 1 || month.monthNumber === 13)) {
      yearInfoHtml = this.renderYearStartInfo(day, month, profile);
    }
    
    // Render dateline visualization showing biblical date by timezone
    // For Day 1: shows where month starts first globally (at moon event time)
    // For other days: shows day boundaries at the current state time
    let datelineHtml = '';
    if (typeof renderDatelineVisualization === 'function') {
      try {
        let vizTime, sectionTitle;
        if (day.lunarDay === 1 && month.moonEvent) {
          // Day 1: use moon event time to show where month starts first
          vizTime = month.moonEvent;
          sectionTitle = '🌍 Month Start Line';
        } else {
          // Other days: use the current state time (from URL ?t=HHMM)
          // This shows the global state at the selected time
          const appState = AppStore.getState();
          const stateTime = appState?.context?.time || { hours: 12, minutes: 0 };
          const dayDate = day.gregorianDate || new Date();
          vizTime = new Date(
            dayDate.getFullYear(),
            dayDate.getMonth(),
            dayDate.getDate(),
            stateTime.hours,
            stateTime.minutes,
            0
          );
          sectionTitle = '🌍 Biblical Date by Region';
        }
        
        // Pass the current biblical day for the timezone guide
        // Get year from derived state
        const derived = AppStore.getDerived();
        const currentDay = {
          month: month.monthNumber,
          day: day.lunarDay,
          year: derived.year
        };
        
        datelineHtml = `
          <div class="day-detail-section day-detail-dateline">
            <div class="section-title">${sectionTitle}</div>
            ${renderDatelineVisualization(vizTime, { currentDay })}
          </div>
        `;
      } catch (e) {
        console.warn('[CalendarView] Error rendering dateline visualization:', e);
      }
    }
    
    // Render feasts/appointed times
    let feastsHtml = '';
    if (day.feasts && day.feasts.length > 0) {
      feastsHtml = `
        <div class="day-detail-section day-detail-feasts">
          <div class="section-title">Appointed Times</div>
          ${day.feasts.map(f => this.renderFeastItem(f, day, month)).join('')}
        </div>
      `;
    }
    
    // Render Bible events
    let eventsHtml = '';
    if (day.events && day.events.length > 0) {
      try {
        const eventItems = day.events.map(e => this.renderEventItem(e)).join('');
        eventsHtml = `
          <div class="day-detail-section day-detail-events">
            <div class="section-title">📜 Biblical Events on This Date</div>
            <div class="bible-events-list">
              ${eventItems}
            </div>
          </div>
        `;
      } catch (err) {
        console.error('[CalendarView] Error rendering events:', err);
      }
    }
    
    // Render Torah portion if this is a Sabbath
    let torahHtml = '';
    const sabbathMode = profile.sabbathMode || 'lunar';
    if (typeof getTorahPortionForSabbath === 'function') {
      const portionInfo = getTorahPortionForSabbath(day, month, sabbathMode);
      if (portionInfo && (portionInfo.portion || portionInfo.holidayReplacement)) {
        torahHtml = this.renderTorahPortion(portionInfo);
      }
    }
    
    // Show message if no feasts, events, or Torah
    let noItemsHtml = '';
    const hasContent = (day.feasts && day.feasts.length > 0) || 
                       (day.events && day.events.length > 0) || 
                       torahHtml;
    if (!hasContent) {
      noItemsHtml = '<div class="day-detail-no-items">No appointed times or events on this day</div>';
    }
    
    return `
      <div id="day-detail" class="day-detail-panel">
        <div class="day-detail-header">
          <div class="day-detail-date-info">
            <h2>Day ${lunarDay} of the ${this.getOrdinal(month.monthNumber)} Month</h2>
            <div class="day-detail-date-row">
              <div class="day-detail-date header-dropdown" data-action="date-picker" title="Click to go to a specific date">
                <span>${weekday}, ${this.formatFullDate(day.gregorianDate)}</span>
                <span class="dropdown-arrow">▼</span>
              </div>
              <div class="date-calc-toggle" onclick="CalendarView.toggleDateCalculator()" title="Date Calculator">
                <span class="date-calc-icon">🧮</span>
                <span class="date-calc-label">Date Calc</span>
              </div>
            </div>
            ${priestlyHtml}
            ${this.renderDateCalculatorPanel()}
          </div>
          ${astroTimesHtml}
        </div>
        <div class="day-detail-body">
          ${yearInfoHtml}
          <div class="day-detail-profile-compare"></div>
          ${feastsHtml}
          ${torahHtml}
          ${eventsHtml}
          ${noItemsHtml}
          ${datelineHtml}
        </div>
      </div>
    `;
  },
  
  /**
   * Render year start explanation for Month 1 or 13th month explanation for Month 13
   */
  renderYearStartInfo(day, month, profile) {
    const state = AppStore.getState();
    const derived = AppStore.getDerived();
    const lunarMonths = derived.lunarMonths || [];
    const year = derived.year;
    const yearStartRule = profile.yearStartRule || 'equinox';
    
    // Get spring equinox
    let springEquinox;
    try {
      springEquinox = getAstroEngine().getSeasons(year).mar_equinox.date;
    } catch (e) {
      return '';
    }
    
    const eqParts = typeof getFormattedDateParts === 'function' 
      ? getFormattedDateParts(springEquinox)
      : { weekdayName: springEquinox.toLocaleDateString('en-US', {weekday: 'long'}),
          monthName: springEquinox.toLocaleDateString('en-US', {month: 'long'}),
          day: springEquinox.getUTCDate(),
          yearStr: String(springEquinox.getUTCFullYear()) };
    const equinoxDateStr = `${eqParts.weekdayName}, ${eqParts.monthName} ${eqParts.day}${this.getOrdinal(eqParts.day).slice(-2)}, ${eqParts.yearStr}`;
    
    // Get day start info
    const dayStartLabel = profile.dayStartTime === 'evening' ? 'sunset' : 
      (typeof getDayStartLabel === 'function' ? getDayStartLabel() : 'sunrise');
    
    let day1StartTs;
    if (typeof getDayStartTime === 'function') {
      day1StartTs = getDayStartTime(day.gregorianDate);
    } else {
      day1StartTs = day.gregorianDate.getTime();
    }
    
    const day1StartDate = new Date(day1StartTs);
    const day1StartStr = day1StartDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const day1Parts = typeof getFormattedDateParts === 'function'
      ? getFormattedDateParts(day1StartDate)
      : { weekdayName: day1StartDate.toLocaleDateString('en-US', {weekday: 'long'}),
          monthName: day1StartDate.toLocaleDateString('en-US', {month: 'long'}),
          day: day1StartDate.getUTCDate() };
    const day1DateStr = `${day1Parts.weekdayName}, ${day1Parts.monthName} ${day1Parts.day}${this.getOrdinal(day1Parts.day).slice(-2)}`;
    
    // Calculate timing difference
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
      // Year start explanation
      let methodologyHtml = '';
      let ruleIcon = '📅';
      
      if (yearStartRule === 'virgoFeet') {
        ruleIcon = '♍';
        if (typeof getVirgoMethodologyHtml === 'function') {
          // Get Virgo calculation from engine instance (no global state)
          const engine = typeof AppStore !== 'undefined' ? AppStore.getEngine() : null;
          const location = state.context?.location;
          const virgoCalc = engine && location ? engine.getVirgoCalculation(year, location) : null;
          if (virgoCalc) {
            methodologyHtml = getVirgoMethodologyHtml({ showCalculation: true, virgoCalc });
          }
        }
        if (!methodologyHtml) {
          methodologyHtml = `<p>Using Moon Under Virgo's Feet rule. Day 1 begins at ${dayStartLabel} (${day1DateStr} at ${day1StartStr}).</p>`;
        }
      } else if (yearStartRule === '13daysBefore') {
        ruleIcon = '🐑';
        if (typeof getPassoverMethodologyHtml === 'function') {
          methodologyHtml = getPassoverMethodologyHtml({
            showCalculation: true,
            equinoxDate: equinoxDateStr,
            day1Date: `${day1DateStr} at ${day1StartStr}`,
            timingStr,
            beforeAfter
          });
        } else {
          methodologyHtml = `<p>Using Passover after Equinox rule. Spring equinox: ${equinoxDateStr}. Day 1 begins ${timingStr} ${beforeAfter} equinox.</p>`;
        }
      } else {
        ruleIcon = '⚖️';
        if (typeof getEquinoxMethodologyHtml === 'function') {
          methodologyHtml = getEquinoxMethodologyHtml({
            showCalculation: true,
            equinoxDate: equinoxDateStr,
            day1Date: `${day1DateStr} at ${day1StartStr}`,
            timingStr,
            beforeAfter
          });
        } else {
          methodologyHtml = `<p>Using Renewed Moon after Equinox rule. Spring equinox: ${equinoxDateStr}. Day 1 begins ${timingStr} ${beforeAfter} equinox.</p>`;
        }
      }
      
      return `
        <div class="day-detail-section day-detail-year-info">
          <div class="section-title">${ruleIcon} Lunar Year ${year} Begins</div>
          <div class="year-info-content">
            ${methodologyHtml}
          </div>
        </div>
      `;
    } else if (month.monthNumber === 13) {
      // 13th month explanation
      let nextEquinox;
      try {
        nextEquinox = getAstroEngine().getSeasons(year + 1).mar_equinox.date;
      } catch (e) {
        return '';
      }
      
      const neqParts = typeof getFormattedDateParts === 'function'
        ? getFormattedDateParts(nextEquinox)
        : { weekdayName: nextEquinox.toLocaleDateString('en-US', {weekday: 'long'}),
            monthName: nextEquinox.toLocaleDateString('en-US', {month: 'long'}),
            day: nextEquinox.getUTCDate(),
            yearStr: String(nextEquinox.getUTCFullYear()) };
      const nextEquinoxDateStr = `${neqParts.weekdayName}, ${neqParts.monthName} ${neqParts.day}${this.getOrdinal(neqParts.day).slice(-2)}, ${neqParts.yearStr}`;
      
      const diffToNextMs = nextEquinox.getTime() - day1StartTs;
      const diffToNextHours = diffToNextMs / (1000 * 60 * 60);
      const diffToNextDays = Math.floor(diffToNextHours / 24);
      
      const explanationText = `This 13th month (intercalary month) is added to keep the calendar aligned with the seasons. ` +
        `Day 1 begins at ${dayStartLabel} on ${day1DateStr}, which is ${diffToNextDays} days before the next spring equinox (${nextEquinoxDateStr}). ` +
        `Since this day-start falls before the equinox, this qualifies as the 13th month of the current year rather than the 1st month of the next year.`;
      
      return `
        <div class="day-detail-section day-detail-year-info">
          <div class="section-title">📅 13th Month (Intercalary)</div>
          <div class="year-info-content">
            <p>${explanationText}</p>
          </div>
        </div>
      `;
    }
    
    return '';
  },

  renderFeastItem(feastEntry, day, month) {
    const { feast, dayNum } = feastEntry;
    const nameText = dayNum ? `${feast.name} (Day ${dayNum})` : feast.name;
    
    // Build links - can have chapter link, symbol link, or both
    let linksHtml = '';
    if (feast.chapter) {
      // Convert feast chapter path to AppStore dispatch
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
      linksHtml += `<a href="#" class="feast-link" onclick="event.preventDefault();AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'${chapterId}'${sectionParam}}})">Learn more →</a>`;
    }
    if (feast.symbol) {
      // Extract symbol key from path like '/symbols/TREE'
      const symbolKey = feast.symbol.replace('/symbols/', '').toLowerCase();
      linksHtml += `<button class="feast-symbol-link" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols',symbol:'${symbolKey}'}})">📖 Symbol Study</button>`;
    }
    
    // Add Stellarium link and detailed explanation for Renewed Moon on Day 1
    let stellariumHtml = '';
    let basisHtml = '';
    
    if (feast.name === 'Renewed Moon' && day && day.lunarDay === 1 && month && month.moonEvent) {
      const state = AppStore.getState();
      const profile = window.PROFILES?.[state.context?.profileId] || {};
      const location = state.context?.location || { lat: 31.7683, lon: 35.2137 };
      const moonPhase = profile.moonPhase || 'full';
      const dayStartTime = profile.dayStartTime || 'morning';
      
      // Get moon event details
      const moonEventTime = month.moonEvent;
      const moonEventDate = new Date(moonEventTime);
      
      // Convert to JD for calendar system handling
      const moonJD = (moonEventDate.getTime() / 86400000) + 2440587.5;
      const GREGORIAN_START_JD = 2299161; // Oct 15, 1582
      const useJulianCal = moonJD < GREGORIAN_START_JD;
      
      // Convert JD to appropriate calendar (Julian for ancient, Gregorian for modern)
      let calYear, calMonth, calDay;
      if (useJulianCal && typeof EventResolver !== 'undefined' && EventResolver.julianDayToJulianCalendar) {
        const julian = EventResolver.julianDayToJulianCalendar(moonJD);
        calYear = julian.year;
        calMonth = julian.month;
        calDay = julian.day;
      } else {
        calYear = moonEventDate.getUTCFullYear();
        calMonth = moonEventDate.getUTCMonth() + 1;
        calDay = moonEventDate.getUTCDate();
      }
      
      // Format moon event date/time
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const moonParts = typeof getFormattedDateParts === 'function' 
        ? getFormattedDateParts(moonEventDate)
        : { weekdayName: weekdays[moonEventDate.getUTCDay()],
            shortMonthName: monthNames[calMonth - 1],
            day: calDay,
            yearStr: this.formatYear(calYear) };
      // Override with Julian calendar values for ancient dates
      if (useJulianCal) {
        moonParts.shortMonthName = monthNames[calMonth - 1];
        moonParts.day = calDay;
        moonParts.yearStr = this.formatYear(calYear);
      }
      const dayOfWeek = moonParts.weekdayName;
      const monthName = moonParts.shortMonthName;
      const dayNum2 = moonParts.day;
      const daySuffix = this.getOrdinal(dayNum2).slice(-2);
      const year = moonParts.yearStr;
      
      // Format time in observer's local time
      let moonTimeStr = '';
      if (typeof utcToLocalTime === 'function') {
        const moonLocalTime = utcToLocalTime(moonEventDate.getTime(), location.lon);
        moonTimeStr = `${moonLocalTime.getUTCHours() % 12 || 12}:${String(moonLocalTime.getUTCMinutes()).padStart(2, '0')} ${moonLocalTime.getUTCHours() >= 12 ? 'PM' : 'AM'}`;
      } else {
        moonTimeStr = moonEventDate.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
      }
      
      // Get day start label and time
      let dayStartLabel = 'sunrise';
      if (dayStartTime === 'evening') dayStartLabel = 'sunset';
      else if (typeof getDayStartLabel === 'function') dayStartLabel = getDayStartLabel();
      
      let dayStartStr = '';
      if (typeof getDayStartTime === 'function') {
        const dayStartTs = getDayStartTime(day.gregorianDate);
        if (typeof utcToLocalTime === 'function') {
          const dayStartLocalTime = utcToLocalTime(dayStartTs, location.lon);
          dayStartStr = `${dayStartLocalTime.getUTCHours() % 12 || 12}:${String(dayStartLocalTime.getUTCMinutes()).padStart(2, '0')} ${dayStartLocalTime.getUTCHours() >= 12 ? 'PM' : 'AM'}`;
        }
      }
      
      // Get moon phase label
      let signName = moonPhase === 'crescent' ? 'First Visible Crescent' : 
                     moonPhase === 'full' ? 'Full Moon' : 'Dark Moon (conjunction)';
      if (typeof getMoonLabel === 'function') signName = getMoonLabel();
      
      // Determine tense
      const isPast = moonEventDate < new Date();
      const occurVerb = isPast ? 'occurred' : 'will occur';
      
      // Build explanation text based on moon phase
      let explanationText = '';
      if (moonPhase === 'dark' || moonPhase === 'full') {
        explanationText = `The ${signName} ${occurVerb} on ${dayOfWeek}, ${monthName} ${dayNum2}${daySuffix}, ${year} at ${moonTimeStr}. ` +
          `The month begins at ${dayStartLabel}${dayStartStr ? ` (${dayStartStr})` : ''}.`;
      } else if (moonPhase === 'crescent') {
        explanationText = `The first visible Crescent Moon ${occurVerb} on ${dayOfWeek}, ${monthName} ${dayNum2}${daySuffix}, ${year}. ` +
          `The month begins at ${dayStartLabel}${dayStartStr ? ` (${dayStartStr})` : ''}.`;
      } else {
        explanationText = `The ${signName} ${occurVerb} on ${dayOfWeek}, ${monthName} ${dayNum2}${daySuffix}, ${year} at ${moonTimeStr}. ` +
          `The month begins at ${dayStartLabel}${dayStartStr ? ` (${dayStartStr})` : ''}.`;
      }
      
      basisHtml = `<div class="feast-basis">${explanationText}</div>`;
      
      // Stellarium link
      const stellariumDate = moonEventDate.toISOString().split('.')[0] + 'Z';
      const stellariumUrl = `https://stellarium-web.org/?date=${stellariumDate}&lat=${location.lat}&lng=${location.lon}`;
      
      stellariumHtml = `
        <a href="${stellariumUrl}" target="_blank" rel="noopener" class="stellarium-link">
          🔭 View in Stellarium
        </a>
      `;
    }
    
    // Use dynamic description for Renewed Moon
    let description = feast.description || '';
    if (feast.name === 'Renewed Moon' && typeof getRenewedMoonDescription === 'function') {
      description = getRenewedMoonDescription();
    }
    
    return `
      <div class="day-detail-feast-item">
        <div class="feast-icon">${feast.icon}</div>
        <div class="feast-info">
          <div class="feast-header">
            <div class="feast-name">${nameText}</div>
            ${stellariumHtml}
          </div>
          <div class="feast-desc">${description}</div>
          ${basisHtml}
          ${linksHtml}
        </div>
      </div>
    `;
  },
  
  // Convert basic markdown to HTML and linkify scripture references
  linkifyText(text, contextCitation = '') {
    if (!text) return text;
    
    // First, handle basic markdown formatting
    // Bold and italic with asterisks (handle nested: ***text*** = bold+italic)
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Bold and italic with underscores
    text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    text = text.replace(/\b_([^_]+)_\b/g, '<em>$1</em>');
    
    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Then linkify scripture references
    if (typeof linkifyScriptureReferences === 'function') {
      return linkifyScriptureReferences(text, contextCitation);
    }
    return text;
  },
  
  renderEventItem(event) {
    // Get context citation for "v. X" style references
    let contextCitation = '';
    if (event.verse) {
      const citationMatch = event.verse.match(/^(.+?\s+\d+)/);
      if (citationMatch) {
        contextCitation = citationMatch[1];
      }
    }
    
    // Make verse clickable if present
    let verseHtml = '';
    if (event.verse) {
      const bibleLink = this.parseCitationToLink(event.verse);
      if (bibleLink) {
        verseHtml = `<a href="${bibleLink}" class="event-verse-link">${event.verse}</a>`;
      } else {
        verseHtml = `<span class="event-verse">${event.verse}</span>`;
      }
    }
    
    // Linkify description
    const linkedDesc = this.linkifyText(event.description || '', contextCitation);
    const descHtml = linkedDesc ? `<div class="event-desc">${linkedDesc}</div>` : '';
    
    // Render quote if present (with linkified references)
    const linkedQuote = this.linkifyText(event.quote || '', contextCitation);
    const quoteHtml = linkedQuote ? `<blockquote class="event-quote">"${linkedQuote}"</blockquote>` : '';
    
    // Render details if present (handles both heading/text and title/content formats)
    let detailsHtml = '';
    if (event.details && event.details.length > 0) {
      detailsHtml = `
        <div class="event-details">
          ${event.detailsTitle ? `<div class="event-details-title">${event.detailsTitle}</div>` : ''}
          <ul class="event-details-list">
            ${event.details.map(d => {
              const title = d.heading || d.title || '';
              const content = this.linkifyText(d.text || d.content || '', contextCitation);
              return `<li><strong>${title}:</strong> ${content}</li>`;
            }).join('')}
          </ul>
        </div>
      `;
    }
    
    // Render image if present
    let imageHtml = '';
    if (event.image) {
      imageHtml = `
        <div class="event-image">
          <img src="${event.image}" alt="${event.title || 'Event image'}" onclick="window.open('${event.image}', '_blank')" title="Click to view full size">
        </div>
      `;
    }
    
    // Render anniversary badge and link if event has an original year
    // Check for explicit originalYear or parse from condition (e.g., "year_-958")
    let eventOriginalYear = event.originalYear;
    if (eventOriginalYear === undefined && event.condition && event.condition.startsWith('year_')) {
      eventOriginalYear = parseInt(event.condition.substring(5));
    }
    
    let anniversaryBadgeHtml = '';
    let anniversaryLinkHtml = '';
    if (eventOriginalYear !== undefined && eventOriginalYear !== null && !isNaN(eventOriginalYear)) {
      // Build calendar link to the original date
      const yearStr = eventOriginalYear < 0 
        ? `${Math.abs(eventOriginalYear)}bc` 
        : eventOriginalYear === 0 
          ? '1bc'
          : `${eventOriginalYear}`;
      const eventMonth = event.month || 1;
      const eventDay = event.day || 1;
      
      // Get location slug for URL
      let locationSlug = 'jerusalem';
      try {
        const state = AppStore.getState();
        if (state.context?.location && typeof URLRouter !== 'undefined') {
          locationSlug = URLRouter._getLocationSlug(state.context.location);
        }
      } catch (e) {}
      
      const calendarUrl = `/${locationSlug}/${yearStr}/${eventMonth}/${eventDay}`;
      const displayYear = eventOriginalYear < 0 
        ? `${Math.abs(eventOriginalYear)} BC`
        : eventOriginalYear === 0 
          ? '1 BC'
          : `${eventOriginalYear} AD`;
      
      // Calendar icon link (clickable date badge)
      anniversaryBadgeHtml = `<a href="${calendarUrl}" class="event-year-badge" title="View this date in ${displayYear}">📅 ${displayYear}</a>`;
      
      // Remove anniversaryLinkHtml (no longer needed in links section)
      anniversaryLinkHtml = '';
    }
    
    // Remove leading emoji from title if it matches the icon
    let displayTitle = event.title || '';
    const eventIcon = event.icon || '📜';
    if (displayTitle.startsWith(eventIcon)) {
      displayTitle = displayTitle.slice(eventIcon.length).trim();
    }
    
    // Build historical info section if event has precise historical data
    let historicalInfoHtml = '';
    if (event.historicalDate || event.historicalLocation) {
      let infoLines = [];
      
      // Make date clickable - navigate to that date in calendar
      if (event.historicalDate && eventOriginalYear !== undefined) {
        const yearStr = eventOriginalYear < 0 
          ? `${Math.abs(eventOriginalYear)}bc` 
          : eventOriginalYear === 0 
            ? '1bc'
            : `${eventOriginalYear}`;
        const eventMonth = event.month || 1;
        const eventDay = event.day || 1;
        
        // Get location slug for URL
        let locationSlug = 'jerusalem';
        try {
          const state = AppStore.getState();
          if (state.context?.location && typeof URLRouter !== 'undefined') {
            locationSlug = URLRouter._getLocationSlug(state.context.location);
          }
        } catch (e) {}
        
        const calendarUrl = `/${locationSlug}/${yearStr}/${eventMonth}/${eventDay}`;
        infoLines.push(`<a href="${calendarUrl}" class="event-historical-date" title="Navigate to this date in the calendar">📅 ${event.historicalDate}</a>`);
      } else if (event.historicalDate) {
        infoLines.push(`<div class="event-historical-date">📅 ${event.historicalDate}</div>`);
      }
      
      // Make location clickable - open in Google Maps or set as calendar location
      if (event.historicalLocation && event.historicalLocation.name) {
        const mapsUrl = `https://www.google.com/maps?q=${event.historicalLocation.lat},${event.historicalLocation.lon}`;
        infoLines.push(`<a href="${mapsUrl}" target="_blank" rel="noopener" class="event-historical-location" title="View ${event.historicalLocation.name} on Google Maps">📍 ${event.historicalLocation.name} (${event.historicalLocation.lat}°N, ${event.historicalLocation.lon}°E)</a>`);
      }
      historicalInfoHtml = `<div class="event-historical-info">${infoLines.join('')}</div>`;
    }
    
    // Build Stellarium link if event has stellariumDateTime and historicalLocation
    let stellariumHtml = '';
    if (event.stellariumDateTime && event.historicalLocation) {
      const stellariumUrl = `https://stellarium-web.org/?date=${event.stellariumDateTime}&lat=${event.historicalLocation.lat}&lng=${event.historicalLocation.lon}`;
      stellariumHtml = `
        <a href="${stellariumUrl}" target="_blank" rel="noopener" class="stellarium-link event-stellarium-link" title="View the sky at ${event.historicalLocation.name} on this historical date">
          🔭 View in Stellarium (${event.historicalLocation.name})
        </a>
      `;
    }
    
    // Build timeline link for title area - use the event's historical ID
    let titleTimelineLinkHtml = '';
    const eventId = event._historicalEvent?.id;
    if (eventId) {
      titleTimelineLinkHtml = `<a href="#" class="event-title-link event-timeline-link" onclick="event.preventDefault(); viewEventOnTimeline('${eventId}')" title="View on Timeline"><img src="/assets/img/timeline_icon.png" alt="Timeline" class="event-title-icon"></a>`;
    }
    
    // Build book chapter link if present
    let bookChapterLinkHtml = '';
    if (event.bookChapter) {
      let articlePath = event.bookChapter;
      let section = null;
      const hashIdx = articlePath.indexOf('#');
      if (hashIdx !== -1) {
        section = articlePath.slice(hashIdx + 1);
        articlePath = articlePath.slice(0, hashIdx);
      }
      let chapterId = articlePath.replace(/^\/chapters\//, '').replace(/\/$/, '');
      const sectionParam = section ? `,section:'${section}'` : '';
      bookChapterLinkHtml = `<a href="#" class="event-link" onclick="event.preventDefault();event.stopPropagation();AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'${chapterId}'${sectionParam}}})">Learn more →</a>`;
    }
    
    // Build title links container (right-justified: calendar + timeline)
    const titleLinksHtml = (anniversaryBadgeHtml || titleTimelineLinkHtml) 
      ? `<span class="event-title-links">${anniversaryBadgeHtml}${titleTimelineLinkHtml}</span>`
      : '';
    
    return `
      <div class="bible-event-item">
        <div class="event-icon">${eventIcon}</div>
        <div class="event-info">
          <div class="event-title-row">
            <span class="event-title">${displayTitle}</span>
            ${titleLinksHtml}
          </div>
          ${verseHtml}
          ${descHtml}
          ${historicalInfoHtml}
          ${quoteHtml}
          ${imageHtml}
          ${detailsHtml}
          <div class="event-links">
            ${stellariumHtml}
            ${bookChapterLinkHtml}
          </div>
        </div>
      </div>
    `;
  },
  
  // Parse citation like "Genesis 1:1-6:8" to get bible link
  parseCitationToLink(citation) {
    if (!citation) return null;
    // Match patterns like "Genesis 1:1" or "Exodus 12:1-15:26"
    const match = citation.match(/^(\d?\s*[A-Za-z]+)\s+(\d+):(\d+)/);
    if (match) {
      const book = match[1].trim();
      const chapter = match[2];
      const verse = match[3];
      // Get saved translation preference or default to 'kjv'
      let translation = 'kjv';
      try {
        translation = localStorage.getItem('bible_translation_preference') || 'kjv';
      } catch (e) {}
      return `/reader/bible/${translation}/${encodeURIComponent(book)}/${chapter}?verse=${verse}`;
    }
    return null;
  },
  
  renderTorahPortion(portionInfo) {
    if (!portionInfo) return '';
    
    let content = '';
    
    if (portionInfo.holidayReplacement) {
      // Holiday replacement reading
      const hr = portionInfo.holidayReplacement;
      const bibleLink = this.parseCitationToLink(hr.citation);
      const citationHtml = bibleLink 
        ? `<a href="${bibleLink}" class="torah-citation-link">${hr.citation}</a>`
        : `<div class="torah-citation">${hr.citation || ''}</div>`;
      content = `
        <div class="torah-portion-item torah-holiday-replacement">
          <div class="torah-icon">🎺</div>
          <div class="torah-info">
            <div class="torah-name">${hr.name}</div>
            ${citationHtml}
            <div class="torah-summary">${hr.summary || ''}</div>
            <div class="torah-note">Special holiday reading (replaces regular portion)</div>
          </div>
        </div>
      `;
    } else if (portionInfo.portion) {
      const p = portionInfo.portion;
      const bibleLink = this.parseCitationToLink(p.citation);
      const citationHtml = bibleLink 
        ? `<a href="${bibleLink}" class="torah-citation-link">${p.citation} →</a>`
        : `<div class="torah-citation">${p.citation || ''}</div>`;
      content = `
        <div class="torah-portion-item">
          <div class="torah-icon">📖</div>
          <div class="torah-info">
            <div class="torah-name">
              <span class="torah-hebrew">${p.parashah || ''}</span>
              ${p.meaning ? `<span class="torah-meaning">(${p.meaning})</span>` : ''}
            </div>
            ${citationHtml}
            <div class="torah-summary">${p.summary || ''}</div>
          </div>
        </div>
      `;
      
      // Add maftir addition if present
      if (portionInfo.maftirAddition) {
        const ma = portionInfo.maftirAddition;
        const maftirLink = this.parseCitationToLink(ma.citation);
        const maftirCitationHtml = maftirLink 
          ? `<a href="${maftirLink}" class="torah-citation-link">${ma.citation} →</a>`
          : `<div class="torah-citation">${ma.citation || ''}</div>`;
        content += `
          <div class="torah-portion-item torah-maftir-addition">
            <div class="torah-icon">📜</div>
            <div class="torah-info">
              <div class="torah-name">${ma.name} <span class="maftir-label">(Special Maftir)</span></div>
              ${maftirCitationHtml}
              <div class="torah-summary">${ma.summary || ''}</div>
            </div>
          </div>
        `;
      }
    }
    
    return `
      <div class="day-detail-section day-detail-torah">
        <div class="section-title">📖 Torah Portion for This Sabbath</div>
        ${content}
      </div>
    `;
  },
  
  showDatePicker(e, trigger) {
    e.stopPropagation();
    this.closePickers();
    
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    
    const picker = document.createElement('div');
    picker.className = 'date-picker';
    picker.onclick = (e) => e.stopPropagation();
    
    // Get current date from state
    const state = AppStore.getState();
    const derived = AppStore.getDerived();
    const currentMonth = derived.lunarMonths?.[derived.currentMonthIndex];
    const currentDay = currentMonth?.days?.find(d => d.lunarDay === derived.currentLunarDay);
    
    let year = new Date().getFullYear();
    let month = new Date().getMonth() + 1;
    let day = new Date().getDate();
    let isBC = false;
    
    if (currentDay?.gregorianDate) {
      year = Math.abs(currentDay.gregorianDate.getUTCFullYear());
      month = currentDay.gregorianDate.getUTCMonth() + 1;
      day = currentDay.gregorianDate.getUTCDate();
      isBC = currentDay.gregorianDate.getUTCFullYear() <= 0;
      if (isBC) year = 1 - currentDay.gregorianDate.getUTCFullYear(); // Convert to BC year
    }
    
    picker.innerHTML = `
      <div class="dp-row">
        <div class="dp-col dp-col-yr"><button class="dp-btn" data-field="year" data-dir="1">▲</button><input type="text" class="dp-input" value="${year}" data-field="year" inputmode="numeric"><button class="dp-btn" data-field="year" data-dir="-1">▼</button></div>
        <span class="dp-sep">–</span>
        <div class="dp-col dp-col-md"><button class="dp-btn" data-field="month" data-dir="1">▲</button><input type="text" class="dp-input" value="${month}" data-field="month" inputmode="numeric"><button class="dp-btn" data-field="month" data-dir="-1">▼</button></div>
        <span class="dp-sep">–</span>
        <div class="dp-col dp-col-md"><button class="dp-btn" data-field="day" data-dir="1">▲</button><input type="text" class="dp-input" value="${day}" data-field="day" inputmode="numeric"><button class="dp-btn" data-field="day" data-dir="-1">▼</button></div>
        <button class="dp-era" data-bc="${isBC}">${isBC ? 'BC' : 'AD'}</button>
      </div>
    `;
    
    // Position below trigger, or above if would go off screen
    const rect = trigger.getBoundingClientRect();
    const pickerHeight = 120; // approximate height
    const spaceBelow = window.innerHeight - rect.bottom;
    
    if (spaceBelow >= pickerHeight || spaceBelow > rect.top) {
      // Position below
      picker.style.top = (rect.bottom + 5) + 'px';
    } else {
      // Position above
      picker.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
    }
    picker.style.left = rect.left + 'px';
    
    overlay.appendChild(picker);
    document.body.appendChild(overlay);
    
    const closePicker = () => {
      overlay.remove();
    };
    
    overlay.onclick = closePicker;
    
    // State for the picker
    let pickerYear = year;
    let pickerMonth = month;
    let pickerDay = day;
    let pickerIsBC = isBC;
    
    const yearInput = picker.querySelector('[data-field="year"].dp-input');
    const monthInput = picker.querySelector('[data-field="month"].dp-input');
    const dayInput = picker.querySelector('[data-field="day"].dp-input');
    const eraBtn = picker.querySelector('.dp-era');
    
    const updateInputs = () => {
      yearInput.value = pickerYear;
      monthInput.value = pickerMonth;
      dayInput.value = pickerDay;
      eraBtn.textContent = pickerIsBC ? 'BC' : 'AD';
      eraBtn.dataset.bc = pickerIsBC;
    };
    
    const dispatchDate = () => {
      let astroYear = pickerYear;
      if (pickerIsBC) astroYear = 1 - pickerYear;
      AppStore.dispatch({
        type: 'SET_GREGORIAN_DATETIME',
        year: astroYear,
        month: pickerMonth,
        day: pickerDay
      });
    };
    
    // Spinner buttons (up/down arrows)
    picker.querySelectorAll('.dp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.field;
        const delta = parseInt(btn.dataset.dir);
        
        if (field === 'year') {
          pickerYear = Math.max(1, pickerYear + delta);
        } else if (field === 'month') {
          pickerMonth += delta;
          if (pickerMonth < 1) { pickerMonth = 12; pickerYear = Math.max(1, pickerYear - 1); }
          if (pickerMonth > 12) { pickerMonth = 1; pickerYear++; }
        } else if (field === 'day') {
          const daysInMonth = new Date(pickerYear, pickerMonth, 0).getDate();
          pickerDay += delta;
          if (pickerDay < 1) { pickerDay = 31; pickerMonth--; if (pickerMonth < 1) { pickerMonth = 12; pickerYear = Math.max(1, pickerYear - 1); } }
          if (pickerDay > daysInMonth) { pickerDay = 1; pickerMonth++; if (pickerMonth > 12) { pickerMonth = 1; pickerYear++; } }
        }
        
        updateInputs();
        dispatchDate();
      });
    });
    
    // Input changes
    const applyInputs = () => {
      const y = parseInt(yearInput.value);
      const m = parseInt(monthInput.value);
      const d = parseInt(dayInput.value);
      
      if (!isNaN(y) && y >= 1) pickerYear = y;
      if (!isNaN(m) && m >= 1 && m <= 12) pickerMonth = m;
      if (!isNaN(d) && d >= 1 && d <= 31) pickerDay = d;
      
      updateInputs();
      dispatchDate();
    };
    
    [yearInput, monthInput, dayInput].forEach(input => {
      input.addEventListener('change', applyInputs);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          applyInputs();
          closePicker();
        }
      });
    });
    
    // Era toggle
    eraBtn.addEventListener('click', () => {
      pickerIsBC = !pickerIsBC;
      updateInputs();
      dispatchDate();
    });
  },

  attachEventListeners(container, month) {
    // Day cell clicks - find the day and set selectedDate to its JD
    container.querySelectorAll('[data-lunar-day]').forEach(el => {
      el.addEventListener('click', () => {
        const lunarDay = parseInt(el.dataset.lunarDay);
        const derived = AppStore.getDerived();
        // Use SET_LUNAR_DATE with current year/month and clicked day
        AppStore.dispatch({ 
          type: 'SET_LUNAR_DATETIME', 
          year: derived.year,
          month: (derived.currentMonthIndex ?? 0) + 1,
          day: lunarDay 
        });
      });
    });
    
    // Month buttons - navigate to first day of that month
    container.querySelectorAll('[data-month]').forEach(el => {
      el.addEventListener('click', () => {
        const monthIdx = parseInt(el.dataset.month);
        const derived = AppStore.getDerived();
        // Use SET_LUNAR_DATE with current year and target month
        AppStore.dispatch({ 
          type: 'SET_LUNAR_DATETIME', 
          year: derived.year,
          month: monthIdx + 1,
          day: 1 
        });
      });
    });
    
    // Navigation and pickers
    container.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', (e) => {
        const action = el.dataset.action;
        if (action === 'prev-month') this.navigateMonth(-1);
        else if (action === 'next-month') this.navigateMonth(1);
        else if (action === 'prev-year') this.navigateYear(-1);
        else if (action === 'next-year') this.navigateYear(1);
        else if (action === 'datetime-picker') this.showDatetimePicker(e, el);
        else if (action === 'location-picker') this.showLocationPicker(e, el);
        else if (action === 'date-picker') this.showDatePicker(e, el);
        else if (action === 'profile-editor') this.showProfileEditor(e);
        else if (action === 'toggle-feasts') this.toggleFeastSidebar();
        else if (action === 'toggle-priestly') this.togglePriestlyPanel();
        else if (action === 'show-priestly') this.showPriestlyView();
      });
    });
    
  },
  
  toggleFeastSidebar() {
    AppStore.dispatch({ type: 'TOGGLE_FEASTS_PANEL' });
  },
  
  showPriestlyView() {
    // Navigate to the priestly view
    AppStore.dispatch({ type: 'SET_VIEW', view: 'priestly' });
  },
  
  openPriestlyPanel() {
    AppStore.dispatch({ type: 'OPEN_PRIESTLY_PANEL' });
  },
  
  closePriestlyPanel() {
    AppStore.dispatch({ type: 'CLOSE_PRIESTLY_PANEL' });
  },
  
  togglePriestlyPanel() {
    AppStore.dispatch({ type: 'TOGGLE_PRIESTLY_PANEL' });
  },
  
  closeFeastSidebar() {
    AppStore.dispatch({ type: 'CLOSE_FEASTS_PANEL' });
  },
  
  isMobileMode() {
    return window.innerWidth < 900;
  },
  
  // Sync panel DOM state with app state
  syncPanelState(state) {
    const ui = state?.ui || AppStore.getState().ui;
    
    // Sync feasts panel
    const leftPanel = document.getElementById('left-panel');
    if (leftPanel) {
      if (ui.feastsPanel) {
        leftPanel.classList.remove('collapsed');
        leftPanel.classList.add('open');
      } else {
        leftPanel.classList.add('collapsed');
        leftPanel.classList.remove('open');
      }
    }
    
    // Sync priestly panel
    const priestlyPanel = document.getElementById('priestly-panel');
    if (priestlyPanel) {
      if (ui.priestlyPanel) {
        priestlyPanel.classList.remove('collapsed');
        priestlyPanel.classList.add('open');
      } else {
        priestlyPanel.classList.add('collapsed');
        priestlyPanel.classList.remove('open');
      }
    }
  },
  
  updateLeftPanel(lunarMonths, profile) {
    const leftPanelContent = document.getElementById('left-panel-content');
    if (leftPanelContent && lunarMonths) {
      // Feasts only (priestly is now separate panel)
      const feastsHtml = this.renderFeastList(lunarMonths);
      
      leftPanelContent.innerHTML = `
        <div class="left-panel-content-area">
          ${feastsHtml}
        </div>
      `;
      
      // Attach click handlers for feast items
      leftPanelContent.querySelectorAll('.feast-list-item').forEach(el => {
        el.addEventListener('click', () => {
          const monthIdx = parseInt(el.dataset.month);
          const lunarDay = parseInt(el.dataset.day);
          const derived = AppStore.getDerived();
          
          // Close sidebar on mobile after selection
          if (this.isMobileMode()) {
            this.closeFeastSidebar();
          }
          
          AppStore.dispatch({ 
            type: 'SET_LUNAR_DATETIME', 
            year: derived.year,
            month: monthIdx + 1,
            day: lunarDay 
          });
        });
      });
    }
    
    // Update priestly panel separately
    this.updatePriestlyPanel(lunarMonths, profile);
  },
  
  updatePriestlyPanel(lunarMonths, profile) {
    const priestlyPanelContent = document.getElementById('priestly-panel-content');
    if (priestlyPanelContent && lunarMonths) {
      const priestlyHtml = this.renderPriestlyCycleList(lunarMonths, profile);
      
      priestlyPanelContent.innerHTML = `
        <div class="priestly-panel-content-area">
          ${priestlyHtml}
        </div>
      `;
      
      // Attach click handlers for priestly items
      priestlyPanelContent.querySelectorAll('.priestly-list-item').forEach(el => {
        el.addEventListener('click', () => {
          const monthIdx = parseInt(el.dataset.month);
          const lunarDay = parseInt(el.dataset.day);
          const derived = AppStore.getDerived();
          
          // Close sidebar on mobile after selection
          if (this.isMobileMode()) {
            this.closePriestlyPanel();
          }
          
          AppStore.dispatch({ 
            type: 'SET_LUNAR_DATETIME', 
            year: derived.year,
            month: monthIdx + 1,
            day: lunarDay 
          });
        });
      });
    }
  },
  
  showDatetimePicker(e, trigger) {
    e.stopPropagation();
    this.closePickers();
    
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    
    const picker = document.createElement('div');
    picker.className = 'datetime-picker';
    picker.onclick = (e) => e.stopPropagation();
    
    picker.innerHTML = `
      <div class="datetime-section year-section">
        <div class="year-row">
          <button class="year-arrow-btn" data-delta="-1">◀</button>
          <div class="year-display-container">
            <span class="year-display"></span>
            <input type="text" class="year-input" inputmode="numeric">
          </div>
          <button class="year-arrow-btn" data-delta="1">▶</button>
          <button class="era-toggle"></button>
        </div>
      </div>
      <div class="datetime-section month-section">
        <div class="month-grid"></div>
      </div>
      <div class="datetime-section time-section">
        <div class="time-row">
          <button class="time-arrow-btn" data-field="hours" data-delta="-1">◀</button>
          <span class="time-display hours-display"></span>
          <button class="time-arrow-btn" data-field="hours" data-delta="1">▶</button>
          <span class="time-sep">:</span>
          <button class="time-arrow-btn" data-field="minutes" data-delta="-1">◀</button>
          <span class="time-display minutes-display"></span>
          <button class="time-arrow-btn" data-field="minutes" data-delta="1">▶</button>
          <button class="ampm-toggle"></button>
        </div>
      </div>
    `;
    
    // Position below trigger
    const rect = trigger.getBoundingClientRect();
    picker.style.top = (rect.bottom + 5) + 'px';
    picker.style.left = rect.left + 'px';
    
    overlay.appendChild(picker);
    document.body.appendChild(overlay);
    
    const yearDisplay = picker.querySelector('.year-display');
    const yearInput = picker.querySelector('.year-input');
    const eraToggle = picker.querySelector('.era-toggle');
    const monthGrid = picker.querySelector('.month-grid');
    const hoursDisplay = picker.querySelector('.hours-display');
    const minutesDisplay = picker.querySelector('.minutes-display');
    const ampmToggle = picker.querySelector('.ampm-toggle');
    
    // Render function - updates from state
    const renderPicker = () => {
      const state = AppStore.getState();
      const derived = AppStore.getDerived();
      
      // Year
      const currentYear = derived.year;
      const display = typeof YearUtils !== 'undefined' 
        ? YearUtils.toDisplay(currentYear)
        : { year: currentYear <= 0 ? 1 - currentYear : currentYear, isBC: currentYear <= 0 };
      yearDisplay.textContent = display.year;
      yearInput.value = display.year;
      eraToggle.textContent = display.isBC ? 'BC' : 'AD';
      eraToggle.dataset.bc = display.isBC;
      
      // Month grid
      const currentMonthIdx = derived.currentMonthIndex ?? 0;
      const monthCount = derived.lunarMonths?.length || 12;
      let monthHtml = '';
      for (let i = 0; i < monthCount; i++) {
        const isActive = i === currentMonthIdx;
        monthHtml += `<button class="month-btn${isActive ? ' active' : ''}" data-month-idx="${i}">${i + 1}</button>`;
      }
      monthGrid.innerHTML = monthHtml;
      
      // Re-attach month click handlers
      monthGrid.querySelectorAll('.month-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const monthIdx = parseInt(btn.dataset.monthIdx);
          this.goToMonth(monthIdx);
        });
      });
      
      // Time - display in local time at selected location
      const currentTime = AppStore.getLocalTime();
      let hours12 = currentTime.hours % 12;
      if (hours12 === 0) hours12 = 12;
      const isPM = currentTime.hours >= 12;
      hoursDisplay.textContent = hours12;
      minutesDisplay.textContent = String(currentTime.minutes).padStart(2, '0');
      ampmToggle.textContent = isPM ? 'PM' : 'AM';
      ampmToggle.dataset.pm = isPM;
    };
    
    renderPicker();
    const unsubscribe = AppStore.subscribe(renderPicker);
    overlay._unsubscribe = unsubscribe;
    
    const closePicker = () => {
      unsubscribe();
      overlay.remove();
    };
    
    overlay.onclick = closePicker;
    
    // Year display click to edit
    yearDisplay.addEventListener('click', () => {
      yearDisplay.style.display = 'none';
      yearInput.style.display = 'block';
      yearInput.focus();
      yearInput.select();
    });
    
    const applyYearInput = () => {
      const val = parseInt(yearInput.value);
      if (!isNaN(val) && val >= 1 && val <= 9999) {
        const derived = AppStore.getDerived();
        const currentDisplay = typeof YearUtils !== 'undefined'
          ? YearUtils.toDisplay(derived.year)
          : { isBC: derived.year <= 0 };
        const internalYear = typeof YearUtils !== 'undefined'
          ? YearUtils.toInternal(val, currentDisplay.isBC)
          : (currentDisplay.isBC ? 1 - val : val);
        this.goToYear(internalYear);
      }
      yearInput.style.display = 'none';
      yearDisplay.style.display = 'block';
    };
    
    yearInput.addEventListener('blur', applyYearInput);
    yearInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyYearInput();
      else if (e.key === 'Escape') {
        yearInput.style.display = 'none';
        yearDisplay.style.display = 'block';
      }
    });
    
    // Year arrows
    picker.querySelectorAll('.year-arrow-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const derived = AppStore.getDerived();
        const delta = parseInt(btn.dataset.delta);
        this.goToYear(derived.year + delta);
      });
    });
    
    // Era toggle
    eraToggle.addEventListener('click', () => {
      const derived = AppStore.getDerived();
      const currentYear = derived.year;
      const display = typeof YearUtils !== 'undefined'
        ? YearUtils.toDisplay(currentYear)
        : { year: currentYear <= 0 ? 1 - currentYear : currentYear, isBC: currentYear <= 0 };
      const newInternal = typeof YearUtils !== 'undefined'
        ? YearUtils.toInternal(display.year, !display.isBC)
        : (display.isBC ? display.year : 1 - display.year);
      this.goToYear(newInternal);
    });
    
    // Time arrows
    picker.querySelectorAll('.time-arrow-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const state = AppStore.getState();
        const derived = AppStore.getDerived();
        const currentTime = AppStore.getLocalTime();
        const field = btn.dataset.field;
        const delta = parseInt(btn.dataset.delta);
        
        let hours = currentTime.hours;
        let minutes = currentTime.minutes;
        
        if (field === 'hours') {
          hours = (hours + delta + 24) % 24;
        } else {
          minutes = (minutes + delta + 60) % 60;
        }
        
        AppStore.dispatch({ 
          type: 'SET_LUNAR_DATETIME', 
          year: derived.year,
          month: (derived.currentMonthIndex ?? 0) + 1,
          day: derived.currentLunarDay ?? 1,
          time: { hours, minutes } 
        });
      });
    });
    
    // AM/PM toggle
    ampmToggle.addEventListener('click', () => {
      const state = AppStore.getState();
      const derived = AppStore.getDerived();
      const currentTime = AppStore.getLocalTime();
      let hours = currentTime.hours;
      
      // Toggle AM/PM by adding/subtracting 12 hours
      if (hours >= 12) {
        hours -= 12;
      } else {
        hours += 12;
      }
      
      AppStore.dispatch({ 
        type: 'SET_LUNAR_DATETIME', 
        year: derived.year,
        month: (derived.currentMonthIndex ?? 0) + 1,
        day: derived.currentLunarDay ?? 1,
        time: { hours, minutes: currentTime.minutes } 
      });
    });
  },
  
  showYearPicker(e, trigger) {
    e.stopPropagation();
    this.closePickers();
    
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    
    const picker = document.createElement('div');
    picker.className = 'year-picker';
    picker.onclick = (e) => e.stopPropagation();
    
    picker.innerHTML = `
      <div class="year-picker-row">
        <button class="year-arrow-btn" data-delta="-1" title="Earlier">◀</button>
        <div class="year-display-container">
          <span class="year-display" title="Click to enter year"></span>
          <input type="text" class="year-input" inputmode="numeric" pattern="[0-9]*">
        </div>
        <button class="year-arrow-btn" data-delta="1" title="Later">▶</button>
        <button class="era-toggle" title="Click to toggle AD/BC"></button>
      </div>
    `;
    
    const rect = trigger.getBoundingClientRect();
    picker.style.top = (rect.bottom + 5) + 'px';
    picker.style.left = rect.left + 'px';
    
    overlay.appendChild(picker);
    document.body.appendChild(overlay);
    
    const yearDisplay = picker.querySelector('.year-display');
    const yearInput = picker.querySelector('.year-input');
    const eraToggle = picker.querySelector('.era-toggle');
    
    // Render function - updates picker from state
    const renderYearPicker = () => {
      const derived = AppStore.getDerived();
      const currentYear = derived.year; // Internal astronomical year
      // Use YearUtils to convert to display
      const display = typeof YearUtils !== 'undefined' 
        ? YearUtils.toDisplay(currentYear)
        : { year: currentYear <= 0 ? 1 - currentYear : currentYear, isBC: currentYear <= 0 };
      
      yearDisplay.textContent = display.year;
      yearInput.value = display.year;
      eraToggle.textContent = display.isBC ? 'BC' : 'AD';
    };
    
    renderYearPicker();
    const unsubscribe = AppStore.subscribe(renderYearPicker);
    overlay._unsubscribe = unsubscribe;
    
    const closePicker = () => {
      unsubscribe();
      overlay.remove();
    };
    
    overlay.onclick = closePicker;
    
    // Click display to show input
    yearDisplay.addEventListener('click', () => {
      yearDisplay.style.display = 'none';
      yearInput.style.display = 'block';
      yearInput.focus();
      yearInput.select();
    });
    
    // Input handler - dispatch on enter/blur
    const applyInput = () => {
      const val = parseInt(yearInput.value);
      if (!isNaN(val) && val >= 1 && val <= 9999) {
        const derived = AppStore.getDerived();
        // Determine current era from internal year
        const currentDisplay = typeof YearUtils !== 'undefined'
          ? YearUtils.toDisplay(derived.year)
          : { isBC: derived.year <= 0 };
        // Convert display year to internal
        const internalYear = typeof YearUtils !== 'undefined'
          ? YearUtils.toInternal(val, currentDisplay.isBC)
          : (currentDisplay.isBC ? 1 - val : val);
        this.goToYear(internalYear);
      }
      yearInput.style.display = 'none';
      yearDisplay.style.display = 'block';
    };
    
    yearInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyInput();
      else if (e.key === 'Escape') {
        yearInput.style.display = 'none';
        yearDisplay.style.display = 'block';
      }
    });
    yearInput.addEventListener('blur', applyInput);
    
    // Era toggle - dispatch only
    eraToggle.addEventListener('click', () => {
      const derived = AppStore.getDerived();
      const currentYear = derived.year; // Internal astronomical
      // Get current display
      const display = typeof YearUtils !== 'undefined'
        ? YearUtils.toDisplay(currentYear)
        : { year: currentYear <= 0 ? 1 - currentYear : currentYear, isBC: currentYear <= 0 };
      // Toggle era: convert same display year to opposite era
      const newInternal = typeof YearUtils !== 'undefined'
        ? YearUtils.toInternal(display.year, !display.isBC)
        : (display.isBC ? display.year : 1 - display.year);
      this.goToYear(newInternal);
    });
    
    // Arrow buttons - dispatch only
    picker.querySelectorAll('[data-delta]').forEach(btn => {
      btn.addEventListener('click', () => {
        const derived = AppStore.getDerived();
        const delta = parseInt(btn.dataset.delta);
        // Move year in the display direction (earlier = smaller display year)
        const newYear = derived.year + delta;
        this.goToYear(newYear);
      });
    });
  },
  
  showMonthPicker(e, trigger) {
    e.stopPropagation();
    this.closePickers();
    
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    
    const picker = document.createElement('div');
    picker.className = 'month-picker';
    picker.onclick = (e) => e.stopPropagation();
    
    picker.innerHTML = '<div class="picker-grid month-grid"></div>';
    
    const rect = trigger.getBoundingClientRect();
    picker.style.top = (rect.bottom + 5) + 'px';
    picker.style.left = rect.left + 'px';
    
    overlay.appendChild(picker);
    document.body.appendChild(overlay);
    
    const grid = picker.querySelector('.month-grid');
    
    // Render function
    const renderMonthPicker = () => {
      const derived = AppStore.getDerived();
      const currentMonthIdx = derived.currentMonthIndex;
      const monthCount = derived.lunarMonths?.length || 12;
      
      let html = '';
      for (let i = 0; i < monthCount; i++) {
        const isActive = i === currentMonthIdx;
        html += `<button class="picker-btn${isActive ? ' active' : ''}" data-month-idx="${i}">${i + 1}</button>`;
      }
      grid.innerHTML = html;
      
      // Re-attach event listeners
      grid.querySelectorAll('[data-month-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          const monthIdx = parseInt(btn.dataset.monthIdx);
          this.goToMonth(monthIdx);
        });
      });
    };
    
    renderMonthPicker();
    const unsubscribe = AppStore.subscribe(renderMonthPicker);
    overlay._unsubscribe = unsubscribe;
    
    overlay.onclick = () => {
      unsubscribe();
      overlay.remove();
    };
  },
  
  showTimePicker(e, trigger) {
    e.stopPropagation();
    this.closePickers();
    
    const state = AppStore.getState();
    const currentTime = AppStore.getLocalTime();
    // Convert 24h to 12h format
    let hours12 = currentTime.hours % 12;
    if (hours12 === 0) hours12 = 12;
    const isPM = currentTime.hours >= 12;
    
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    
    const picker = document.createElement('div');
    picker.className = 'time-picker';
    picker.onclick = (e) => e.stopPropagation();
    
    picker.innerHTML = `
      <div class="time-picker-spinners">
        <div class="time-spinner">
          <button class="spinner-up" data-field="hours">▲</button>
          <input type="text" class="spinner-input hours-input" value="${hours12}" inputmode="numeric">
          <button class="spinner-down" data-field="hours">▼</button>
        </div>
        <span class="time-sep">:</span>
        <div class="time-spinner">
          <button class="spinner-up" data-field="minutes">▲</button>
          <input type="text" class="spinner-input minutes-input" value="${String(currentTime.minutes).padStart(2, '0')}" inputmode="numeric">
          <button class="spinner-down" data-field="minutes">▼</button>
        </div>
        <button class="ampm-toggle" data-pm="${isPM}">${isPM ? 'PM' : 'AM'}</button>
      </div>
    `;
    
    const rect = trigger.getBoundingClientRect();
    picker.style.top = (rect.bottom + 5) + 'px';
    picker.style.left = rect.left + 'px';
    
    overlay.appendChild(picker);
    document.body.appendChild(overlay);
    
    const hoursInput = picker.querySelector('.hours-input');
    const minutesInput = picker.querySelector('.minutes-input');
    const ampmToggle = picker.querySelector('.ampm-toggle');
    
    // Local state for picker
    let pickerHours12 = hours12;
    let pickerMinutes = currentTime.minutes;
    let pickerIsPM = isPM;
    
    const updateInputs = () => {
      hoursInput.value = pickerHours12;
      minutesInput.value = String(pickerMinutes).padStart(2, '0');
      ampmToggle.textContent = pickerIsPM ? 'PM' : 'AM';
      ampmToggle.dataset.pm = pickerIsPM;
    };
    
    const dispatchTime = () => {
      const derived = AppStore.getDerived();
      // Convert 12h to 24h
      let hours24 = pickerHours12;
      if (pickerIsPM && pickerHours12 !== 12) hours24 = pickerHours12 + 12;
      if (!pickerIsPM && pickerHours12 === 12) hours24 = 0;
      
      AppStore.dispatch({ 
        type: 'SET_LUNAR_DATETIME', 
        year: derived.year,
        month: (derived.currentMonthIndex ?? 0) + 1,
        day: derived.currentLunarDay ?? 1,
        time: { hours: hours24, minutes: pickerMinutes } 
      });
    };
    
    const closePicker = () => {
      overlay.remove();
    };
    
    overlay.onclick = closePicker;
    
    // Spinner buttons
    picker.querySelectorAll('.spinner-up, .spinner-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.field;
        const delta = btn.classList.contains('spinner-up') ? 1 : -1;
        
        if (field === 'hours') {
          pickerHours12 += delta;
          if (pickerHours12 > 12) pickerHours12 = 1;
          if (pickerHours12 < 1) pickerHours12 = 12;
        } else {
          pickerMinutes = (pickerMinutes + delta + 60) % 60;
        }
        
        updateInputs();
        dispatchTime();
      });
    });
    
    // Input changes
    const applyInputs = () => {
      const h = parseInt(hoursInput.value);
      const m = parseInt(minutesInput.value);
      
      if (!isNaN(h) && h >= 1 && h <= 12) pickerHours12 = h;
      if (!isNaN(m) && m >= 0 && m <= 59) pickerMinutes = m;
      
      updateInputs();
      dispatchTime();
    };
    
    [hoursInput, minutesInput].forEach(input => {
      input.addEventListener('change', applyInputs);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          applyInputs();
          closePicker();
        }
      });
    });
    
    // AM/PM toggle
    ampmToggle.addEventListener('click', () => {
      pickerIsPM = !pickerIsPM;
      updateInputs();
      dispatchTime();
    });
  },
  
  showLocationPicker(e, trigger) {
    e.stopPropagation();
    this.closePickers();

    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    
    const picker = document.createElement('div');
    picker.className = 'location-picker';
    picker.onclick = (e) => e.stopPropagation();
    
    // Static structure - content will be rendered reactively
    picker.innerHTML = `
      <div class="location-picker-header">
        <h3>Select Location</h3>
        <button class="picker-close-btn" title="Close">✕</button>
      </div>
      <div class="location-picker-controls">
        <button class="location-gps-btn">📍 Use My Location</button>
        <select class="location-select"></select>
      </div>
      <div class="location-map-slot"></div>
    `;
    
    // Position so picker stays fully on screen (especially on mobile)
    const rect = trigger.getBoundingClientRect();
    const pickerHeight = 400;
    const gap = 10;
    const isNarrow = window.innerWidth < 600;
    const pickerWidthPx = Math.min(500, window.innerWidth * 0.9);
    
    if (isNarrow) {
      // Mobile/narrow: center horizontally, fit vertically with scroll
      picker.style.left = gap + 'px';
      picker.style.right = gap + 'px';
      picker.style.width = 'auto';
      picker.style.maxHeight = (window.innerHeight - gap * 2) + 'px';
      picker.style.overflowY = 'auto';
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow >= pickerHeight * 0.5 || spaceBelow > rect.top) {
        picker.style.top = (rect.bottom + 5) + 'px';
        picker.style.bottom = 'auto';
      } else {
        picker.style.bottom = gap + 'px';
        picker.style.top = 'auto';
      }
    } else {
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow >= pickerHeight || spaceBelow > rect.top) {
        picker.style.top = (rect.bottom + 5) + 'px';
        picker.style.bottom = 'auto';
      } else {
        picker.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
        picker.style.top = 'auto';
      }
      const leftPreferred = rect.left - 150;
      const leftClamped = Math.max(gap, Math.min(leftPreferred, window.innerWidth - pickerWidthPx - gap));
      picker.style.left = leftClamped + 'px';
    }
    
    overlay.appendChild(picker);
    document.body.appendChild(overlay);
    
    // Render function - called on state changes
    const renderPickerContent = () => {
      const state = AppStore.getState();
      const derived = AppStore.getDerived();
      const currentLoc = state.context.location;
      const profile = window.PROFILES?.[state.context.profileId] || {};
      
      // Get moon event date
      let moonEventDate = new Date();
      if (derived.calendar?.months?.[derived.currentMonthIndex]) {
        moonEventDate = derived.calendar.months[derived.currentMonthIndex].moonEvent;
      }
      
      // Update dropdown
      this.renderLocationDropdown(picker.querySelector('.location-select'), currentLoc);
      
      // Update or create map
      const mapSlot = picker.querySelector('.location-map-slot');
      if (!mapSlot.firstChild) {
        // Create map on first render
        const mapComponent = DatelineMap.create({
          moonEventDate,
          lat: currentLoc.lat,
          lon: currentLoc.lon,
          moonPhase: profile.moonPhase || 'full',
          dayStartTime: profile.dayStartTime || 'morning',
          dayStartAngle: profile.dayStartAngle || -12,
          onLocationSelect: (lat, lon, citySlug) => {
            // Only dispatch - state change triggers re-render
            AppStore.dispatch({ type: 'SET_LOCATION', location: { lat, lon } });
          }
        });
        mapSlot.appendChild(mapComponent);
      } else {
        // Update existing map
        DatelineMap.updateLocation(mapSlot.firstChild, currentLoc.lat, currentLoc.lon);
      }
    };
    
    // Initial render
    renderPickerContent();
    
    // Subscribe to state changes
    const unsubscribe = AppStore.subscribe(() => {
      renderPickerContent();
    });
    
    // Store unsubscribe for cleanup
    overlay._unsubscribe = unsubscribe;
    
    // Close handler
    const closePicker = () => {
      unsubscribe();
      overlay.remove();
    };
    
    overlay.onclick = closePicker;
    picker.querySelector('.picker-close-btn').addEventListener('click', closePicker);
    
    // GPS button - only dispatches event
    picker.querySelector('.location-gps-btn').addEventListener('click', () => {
      const btn = picker.querySelector('.location-gps-btn');
      btn.textContent = '📍 Locating...';
      btn.disabled = true;
      
      if (!navigator.geolocation) {
        alert('Geolocation not supported');
        btn.textContent = '📍 Use My Location';
        btn.disabled = false;
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Only dispatch - state change triggers re-render
          AppStore.dispatch({ type: 'SET_LOCATION', location: { lat: pos.coords.latitude, lon: pos.coords.longitude } });
          btn.textContent = '📍 Use My Location';
          btn.disabled = false;
        },
        (err) => {
          alert('Could not get location: ' + err.message);
          btn.textContent = '📍 Use My Location';
          btn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
    
    // City select - only dispatches event
    picker.querySelector('.location-select').addEventListener('change', (e) => {
      const slug = e.target.value;
      if (!slug) return;
      const coords = URLRouter.CITY_SLUGS[slug];
      if (coords) {
        // Only dispatch - state change triggers re-render
        AppStore.dispatch({ type: 'SET_LOCATION', location: { lat: coords.lat, lon: coords.lon } });
      }
    });
  },
  
  renderLocationDropdown(select, currentLoc) {
    const DROPDOWN_CITIES = {
      'Biblical': ['jerusalem', 'bethlehem', 'nazareth', 'jericho', 'hebron', 'cairo', 'alexandria'],
      'Middle East': ['tel-aviv', 'dubai', 'amman', 'baghdad', 'tehran', 'riyadh', 'istanbul', 'damascus', 'beirut'],
      'Americas': ['new-york', 'los-angeles', 'chicago', 'houston', 'denver', 'miami', 'seattle', 'toronto', 'mexico-city', 'sao-paulo'],
      'Europe': ['london', 'paris', 'berlin', 'rome', 'madrid', 'amsterdam', 'moscow', 'athens', 'zurich'],
      'Asia': ['tokyo', 'beijing', 'shanghai', 'hong-kong', 'singapore', 'mumbai', 'delhi', 'seoul', 'bangkok'],
      'Africa': ['johannesburg', 'lagos', 'nairobi', 'cairo', 'cape-town'],
      'Oceania': ['sydney', 'melbourne', 'auckland', 'perth']
    };
    
    const currentSlug = DatelineMap.findNearestCity(currentLoc.lat, currentLoc.lon);
    const isInDropdownList = Object.values(DROPDOWN_CITIES).flat().includes(currentSlug);
    
    let html = '';
    
    // Add current city if not in curated list
    if (currentSlug && !isInDropdownList) {
      html += `<optgroup label="Current Location">`;
      html += `<option value="${currentSlug}" selected>${this.formatCitySlug(currentSlug)}</option>`;
      html += `</optgroup>`;
    }
    
    for (const [region, cities] of Object.entries(DROPDOWN_CITIES)) {
      html += `<optgroup label="${region}">`;
      for (const slug of cities) {
        const selected = slug === currentSlug ? ' selected' : '';
        html += `<option value="${slug}"${selected}>${this.formatCitySlug(slug)}</option>`;
      }
      html += '</optgroup>';
    }
    
    select.innerHTML = html;
  },
  
  closePickers() {
    document.querySelectorAll('.picker-overlay').forEach(el => {
      // Call unsubscribe if it exists (for reactive pickers)
      if (el._unsubscribe) el._unsubscribe();
      el.remove();
    });
  },
  
  showProfileEditor(e) {
    e.stopPropagation();
    
    // Remove existing if present
    const existingOverlay = document.querySelector('.settings-page-overlay');
    const existingPage = document.querySelector('.settings-page');
    if (existingOverlay) existingOverlay.remove();
    if (existingPage) existingPage.remove();
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'settings-page-overlay visible';
    
    // Create settings page
    const page = document.createElement('div');
    page.className = 'settings-page visible';
    
    const state = AppStore.getState();
    const profileId = state.context.profileId;
    const profile = window.PROFILES?.[profileId] || {};
    
    page.innerHTML = `
      <div class="settings-page-header">
        <h2>Profiles</h2>
        <button class="close-btn" aria-label="Close">✕</button>
      </div>
      
      <div class="settings-section">
        <h3>Profile</h3>
        <p class="settings-description">Select a preset or customize settings below.</p>
        <div class="profile-row">
          <select class="profile-select"></select>
          <button class="profile-icon-btn clone-btn" title="Clone as new profile">+</button>
          <button class="profile-icon-btn edit-btn" title="Rename profile" disabled>✏️</button>
          <button class="profile-icon-btn delete-btn" title="Delete profile" disabled>🗑️</button>
        </div>
      </div>
      
      <div class="settings-section">
        <h3>Month Starts At</h3>
        <p class="settings-description">Choose which lunar phase marks the beginning of each month.</p>
        <div class="settings-options moon-phase-options">
          <button class="settings-option-btn" data-phase="full">
            <span class="option-icon">🌕</span>
            <span class="option-label">Full Moon</span>
          </button>
          <button class="settings-option-btn" data-phase="dark">
            <span class="option-icon">🌑</span>
            <span class="option-label">Dark Moon</span>
          </button>
          <button class="settings-option-btn" data-phase="crescent">
            <span class="option-icon">🌒</span>
            <span class="option-label">Crescent</span>
          </button>
        </div>
      </div>
      
      <div class="settings-section">
        <h3>Day Starts At</h3>
        <p class="settings-description">Choose when each day begins.</p>
        <div class="settings-options day-start-options" style="margin-bottom: 15px;">
          <button class="settings-option-btn" data-daystart="evening">
            <span class="option-icon">🌅</span>
            <span class="option-label">Evening</span>
          </button>
          <button class="settings-option-btn" data-daystart="morning">
            <span class="option-icon">🌄</span>
            <span class="option-label">Morning</span>
          </button>
        </div>
        <p class="settings-description">Sun position below horizon:</p>
        <div class="settings-options twilight-options">
          <button class="settings-option-btn" data-angle="0">
            <span class="option-label">0° Horizon</span>
            <span class="option-hint">Sun at horizon</span>
          </button>
          <button class="settings-option-btn" data-angle="6">
            <span class="option-label">6° Civil</span>
            <span class="option-hint">Bright stars visible</span>
          </button>
          <button class="settings-option-btn" data-angle="12">
            <span class="option-label">12° Nautical</span>
            <span class="option-hint">Most stars visible</span>
          </button>
          <button class="settings-option-btn" data-angle="18">
            <span class="option-label">18° Astronomical</span>
            <span class="option-hint">Fully dark</span>
          </button>
        </div>
      </div>
      
      <div class="settings-section">
        <h3>Year Starts At</h3>
        <p class="settings-description">Choose the rule for determining the first month of the year.</p>
        <div class="settings-options yearstart-options">
          <button class="settings-option-btn" data-yearstart="equinox">
            <span class="option-icon">🌕</span>
            <span class="option-label">Renewed Moon after Equinox</span>
            <span class="option-hint">Month 1 starts after spring equinox</span>
          </button>
          <button class="settings-option-btn" data-yearstart="13daysBefore">
            <span class="option-icon">🐑</span>
            <span class="option-label">Passover after Equinox</span>
            <span class="option-hint">Day 15 (Unleavened) on or after equinox</span>
          </button>
          <button class="settings-option-btn" data-yearstart="virgoFeet">
            <span class="option-icon">♍</span>
            <span class="option-label">Moon Under Virgo's Feet</span>
            <span class="option-hint">Full moon below Spica (Rev 12:1)</span>
          </button>
        </div>
        <details class="settings-details">
          <summary class="settings-details-toggle">📚 Understanding Year Start Rules</summary>
          <div class="settings-details-content">
            <h4>Renewed Moon after Equinox</h4>
            <p>The most common interpretation: the new year begins with the first lunar month (full/new moon) that occurs after the spring equinox. This ensures the year always starts in spring.</p>
            
            <h4>Passover after Equinox</h4>
            <p>Based on the requirement that Passover (Day 14-15) must occur on or after the spring equinox. This can result in a month starting up to 13 days before the equinox.</p>
            
            <h4>Moon Under Virgo's Feet (Rev 12:1)</h4>
            <p>Based on Revelation 12:1 describing "a woman clothed with the sun, with the moon under her feet." This astronomical sign occurs when the full moon appears below the star Spica in Virgo near the spring equinox.</p>
          </div>
        </details>
      </div>
      
      <div class="settings-section">
        <h3>Sabbath Day</h3>
        <p class="settings-description">Choose how the Sabbath day is determined and highlighted.</p>
        <div class="settings-options sabbath-options">
          <button class="settings-option-btn" data-sabbath="lunar">
            <span class="option-icon">🌕</span>
            <span class="option-label">Lunar Sabbath</span>
            <span class="option-hint">Days 8, 15, 22, 29 of each month</span>
          </button>
          <button class="settings-option-btn" data-sabbath="saturday">
            <span class="option-icon">🪐</span>
            <span class="option-label">Saturday</span>
            <span class="option-hint">Fixed weekly Sabbath</span>
          </button>
          <button class="settings-option-btn" data-sabbath="sunday">
            <span class="option-icon">☀️</span>
            <span class="option-label">Sunday</span>
            <span class="option-hint">Christian day of rest</span>
          </button>
        </div>
        <details class="settings-details">
          <summary class="settings-details-toggle">📚 Understanding Sabbath Traditions</summary>
          <div class="settings-details-content">
            <h4>Lunar Sabbath</h4>
            <p>The Sabbath falls on days 8, 15, 22, and 29 of each lunar month, always tied to the moon's cycle. The 1st day (New Moon) and the 30th day (when present) are considered separate holy days.</p>
            
            <h4>Saturday (7th Day)</h4>
            <p>The traditional Jewish and Seventh-day Adventist interpretation: a continuous 7-day cycle since creation, with Saturday as the unchanging weekly Sabbath.</p>
            
            <h4>Sunday (Lord's Day)</h4>
            <p>The Christian tradition of observing the first day of the week in commemoration of Christ's resurrection.</p>
          </div>
        </details>
      </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(page);
    
    // Render function - updates UI from state
    const renderProfileEditor = () => {
      const state = AppStore.getState();
      const currentProfileId = state.context.profileId;
      const currentProfile = window.PROFILES?.[currentProfileId] || {};
      
      // Update profile dropdown
      const select = page.querySelector('.profile-select');
      select.innerHTML = '';
      for (const [id, p] of Object.entries(window.PROFILES || {})) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${p.icon || '🌕'} ${p.name}`;
        if (id === currentProfileId) opt.selected = true;
        select.appendChild(opt);
      }
      
      // Enable/disable edit/delete for custom profiles
      const isPreset = !currentProfileId.startsWith('custom_');
      page.querySelector('.edit-btn').disabled = isPreset;
      page.querySelector('.delete-btn').disabled = isPreset;
      
      // Gray out settings for preset profiles
      page.querySelectorAll('.settings-section').forEach((section, idx) => {
        // Skip the first section (profile selector)
        if (idx > 0) {
          section.classList.toggle('disabled', isPreset);
        }
      });
      page.querySelectorAll('.settings-option-btn').forEach(btn => {
        btn.disabled = isPreset;
      });
      
      // Update moon phase buttons
      page.querySelectorAll('.moon-phase-options .settings-option-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.phase === currentProfile.moonPhase);
      });
      
      // Update day start buttons
      page.querySelectorAll('.day-start-options .settings-option-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.daystart === currentProfile.dayStartTime);
      });
      
      // Update twilight buttons
      page.querySelectorAll('.twilight-options .settings-option-btn').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.angle) === currentProfile.dayStartAngle);
      });
      
      // Update year start buttons
      page.querySelectorAll('.yearstart-options .settings-option-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.yearstart === currentProfile.yearStartRule);
      });
      
      // Update sabbath buttons
      page.querySelectorAll('.sabbath-options .settings-option-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.sabbath === currentProfile.sabbathMode);
      });
    };
    
    renderProfileEditor();
    const unsubscribe = AppStore.subscribe(renderProfileEditor);
    
    const closePage = () => {
      unsubscribe();
      overlay.remove();
      page.remove();
    };
    
    // Close handlers
    overlay.onclick = closePage;
    page.querySelector('.close-btn').onclick = closePage;
    
    // Profile select change
    page.querySelector('.profile-select').addEventListener('change', (e) => {
      AppStore.dispatch({ type: 'SET_PROFILE', profileId: e.target.value });
    });
    
    // Moon phase buttons
    page.querySelectorAll('.moon-phase-options .settings-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.updateProfileSetting('moonPhase', btn.dataset.phase);
      });
    });
    
    // Day start buttons
    page.querySelectorAll('.day-start-options .settings-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.updateProfileSetting('dayStartTime', btn.dataset.daystart);
      });
    });
    
    // Twilight buttons
    page.querySelectorAll('.twilight-options .settings-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.updateProfileSetting('dayStartAngle', parseInt(btn.dataset.angle));
      });
    });
    
    // Year start buttons
    page.querySelectorAll('.yearstart-options .settings-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.updateProfileSetting('yearStartRule', btn.dataset.yearstart);
      });
    });
    
    // Sabbath buttons
    page.querySelectorAll('.sabbath-options .settings-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.updateProfileSetting('sabbathMode', btn.dataset.sabbath);
      });
    });
    
    // Clone button
    page.querySelector('.clone-btn').addEventListener('click', () => {
      this.showProfileNameModal('create', closePage);
    });
    
    // Edit button
    page.querySelector('.edit-btn').addEventListener('click', () => {
      const state = AppStore.getState();
      const profile = window.PROFILES?.[state.context.profileId];
      if (profile) {
        this.showProfileNameModal('edit', closePage, profile.name);
      }
    });
    
    // Delete button
    page.querySelector('.delete-btn').addEventListener('click', () => {
      const state = AppStore.getState();
      const profileId = state.context.profileId;
      if (window.PRESET_PROFILES?.[profileId]) return;
      
      if (confirm('Delete this profile?')) {
        delete window.PROFILES[profileId];
        if (typeof saveCustomProfiles === 'function') saveCustomProfiles();
        AppStore.dispatch({ type: 'SET_PROFILE', profileId: 'timeTested' });
      }
    });
  },
  
  updateProfileSetting(key, value) {
    const state = AppStore.getState();
    const profileId = state.context.profileId;
    
    // Can't modify preset profiles directly - clone first
    if (window.PRESET_PROFILES?.[profileId]) {
      alert('Clone this profile to customize settings.');
      return;
    }
    
    if (window.PROFILES?.[profileId]) {
      window.PROFILES[profileId][key] = value;
      if (typeof saveCustomProfiles === 'function') saveCustomProfiles();
      // Trigger re-render by dispatching a no-op or force recompute
      AppStore.dispatch({ type: 'SET_PROFILE', profileId });
    }
  },
  
  showProfileNameModal(mode, onClose, currentName = '') {
    // Remove existing modal if present
    const existing = document.querySelector('.profile-modal-overlay');
    if (existing) {
      existing.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'profile-modal-overlay visible';
    
    const modal = document.createElement('div');
    modal.className = 'profile-modal';
    modal.innerHTML = `
      <h3>${mode === 'edit' ? 'Rename Profile' : 'Create New Profile'}</h3>
      <input type="text" class="profile-modal-input" placeholder="Enter profile name" value="${currentName}">
      <div class="profile-modal-error"></div>
      <div class="profile-modal-buttons">
        <button class="profile-modal-btn cancel">Cancel</button>
        <button class="profile-modal-btn save">${mode === 'edit' ? 'Save' : 'Create'}</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const input = modal.querySelector('.profile-modal-input');
    const error = modal.querySelector('.profile-modal-error');
    
    input.focus();
    input.select();
    
    const closeModal = () => overlay.remove();
    
    const save = () => {
      const name = input.value.trim();
      if (!name) {
        error.textContent = 'Please enter a profile name.';
        return;
      }
      
      // Check for unique name
      const existingId = Object.entries(window.PROFILES || {}).find(([id, p]) => 
        p.name.toLowerCase() === name.toLowerCase() && 
        (mode !== 'edit' || id !== AppStore.getState().context.profileId)
      );
      if (existingId) {
        error.textContent = 'A profile with this name already exists.';
        return;
      }
      
      if (mode === 'edit') {
        const profileId = AppStore.getState().context.profileId;
        if (window.PROFILES?.[profileId]) {
          window.PROFILES[profileId].name = name;
          if (typeof saveCustomProfiles === 'function') saveCustomProfiles();
          AppStore.dispatch({ type: 'SET_PROFILE', profileId });
        }
      } else {
        // Create new profile (clone current)
        const state = AppStore.getState();
        const sourceProfile = window.PROFILES?.[state.context.profileId] || {};
        const newId = 'custom_' + Date.now();
        
        window.PROFILES[newId] = {
          ...sourceProfile,
          name,
          icon: sourceProfile.icon || '🌕'
        };
        
        if (typeof saveCustomProfiles === 'function') saveCustomProfiles();
        AppStore.dispatch({ type: 'SET_PROFILE', profileId: newId });
      }
      
      closeModal();
    };
    
    modal.querySelector('.cancel').onclick = closeModal;
    modal.querySelector('.save').onclick = save;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      else if (e.key === 'Escape') closeModal();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  },
  
  goToYear(year) {
    // Navigate to same month/day in target year (clamped if needed)
    const derived = AppStore.getDerived();
    const month = (derived.currentMonthIndex ?? 0) + 1;
    const day = derived.currentLunarDay ?? 1;
    AppStore.dispatch({ type: 'SET_LUNAR_DATETIME', year, month, day });
  },
  
  goToMonth(monthIdx) {
    const derived = AppStore.getDerived();
    AppStore.dispatch({ 
      type: 'SET_LUNAR_DATETIME', 
      year: derived.year,
      month: monthIdx + 1,
      day: 1 
    });
  },

  // Navigation - all navigation uses SET_LUNAR_DATE
  navigateMonth(delta) {
    const derived = AppStore.getDerived();
    const currentMonthIdx = derived.currentMonthIndex ?? 0;
    const monthCount = derived.lunarMonths?.length || 12;
    const newMonthIdx = currentMonthIdx + delta;
    
    if (newMonthIdx >= 0 && newMonthIdx < monthCount) {
      // Navigate to first day of target month in same year
      AppStore.dispatch({ 
        type: 'SET_LUNAR_DATETIME', 
        year: derived.year,
        month: newMonthIdx + 1,
        day: 1 
      });
    } else if (newMonthIdx < 0) {
      // Previous year, last month
      this.navigateYear(-1, 'last');
    } else {
      // Next year, first month
      this.navigateYear(1, 'first');
    }
  },

  navigateYear(delta, targetMonth = 'first') {
    const derived = AppStore.getDerived();
    const newYear = derived.year + delta;
    
    // Determine which month/day to navigate to
    let month, day;
    if (targetMonth === 'last') {
      // Go to last month, day 1 (used when going back from month 1)
      // Use special value -1 to indicate "last month" - AppStore will determine actual month count
      month = -1;  // Sentinel for "last month of year"
      day = 1;
    } else if (targetMonth === 'first') {
      // Go to first month, day 1 (used when going forward past last month)
      month = 1;
      day = 1;
    } else {
      // Keep same month/day (for direct year picker navigation)
      month = (derived.currentMonthIndex ?? 0) + 1;
      day = derived.currentLunarDay ?? 1;
    }
    
    AppStore.dispatch({ type: 'SET_LUNAR_DATETIME', year: newYear, month, day });
  },

  // Helpers
  
  /**
   * Calculate current time progress through the biblical day (0-100%)
   * Used to position the time indicator line on today's cell
   * @param {Object} month - Current month object
   * @param {number} todayLunarDay - Lunar day number for today
   * @param {Object} profile - Profile configuration
   * @param {Object} location - { lat, lon }
   * @returns {number|null} - Percentage (0-100) or null if can't calculate
   */
  calculateTimeProgress(month, todayLunarDay, profile, location) {
    const day = month?.days?.find(d => d.lunarDay === todayLunarDay);
    if (!day?.gregorianDate) return null;
    
    const dayStartTime = profile.dayStartTime || 'morning';
    
    try {
      const now = Date.now();
      let dayStartTs, dayEndTs;
      
      if (dayStartTime === 'morning') {
        // Day starts at first light, ends at next first light
        if (typeof getAstronomicalTimes === 'function') {
          const todayAstro = getAstronomicalTimes(day.gregorianDate, location);
          
          // Get tomorrow's date for end of day
          const tomorrowDate = new Date(day.gregorianDate.getTime());
          tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
          const tomorrowAstro = getAstronomicalTimes(tomorrowDate, location);
          
          dayStartTs = todayAstro?.firstLightTs;
          dayEndTs = tomorrowAstro?.firstLightTs;
        }
      } else {
        // Day starts at sunset, ends at next sunset
        if (typeof getSunsetTimestamp === 'function') {
          // Get yesterday's sunset (start of today's biblical day)
          const yesterdayDate = new Date(day.gregorianDate.getTime());
          yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
          dayStartTs = getSunsetTimestamp(yesterdayDate);
          dayEndTs = getSunsetTimestamp(day.gregorianDate);
        }
      }
      
      if (!dayStartTs || !dayEndTs) {
        // Fallback: assume 24-hour day starting at 6am or 6pm
        const baseHour = dayStartTime === 'morning' ? 6 : 18;
        const dayDate = new Date(day.gregorianDate.getTime());
        dayDate.setUTCHours(baseHour, 0, 0, 0);
        dayStartTs = dayDate.getTime();
        dayEndTs = dayStartTs + 24 * 60 * 60 * 1000;
      }
      
      // Calculate progress as percentage
      const totalDuration = dayEndTs - dayStartTs;
      const elapsed = now - dayStartTs;
      
      if (totalDuration <= 0) return null;
      
      const progress = (elapsed / totalDuration) * 100;
      
      // Clamp to 0-100 range
      return Math.max(0, Math.min(100, progress));
    } catch (e) {
      console.warn('Could not calculate time progress:', e);
      return null;
    }
  },

  /**
   * Calculate selected time progress through the biblical day (0-100%)
   * Shows where the user-selected time falls within the day
   * @param {Object} month - Current month object
   * @param {number} selectedDay - Selected lunar day number
   * @param {Object} profile - Profile configuration
   * @param {Object} location - { lat, lon }
   * @param {Object} time - Selected time { hours, minutes } in LOCAL time at location
   * @returns {number|null} - Percentage (0-100) or null if can't calculate
   */
  calculateSelectedTimeProgress(month, selectedDay, profile, location, time) {
    if (!time) return null;
    
    const day = month?.days?.find(d => d.lunarDay === selectedDay);
    if (!day?.gregorianDate) return null;
    
    const dayStartTime = profile.dayStartTime || 'morning';
    const { hours, minutes } = time;
    
    try {
      // Create a timestamp for the selected time on this day
      // The time is in LOCAL solar time at the location, so we need to convert to UTC
      // Longitude determines UTC offset: 15° = 1 hour
      const locationOffsetHours = location.lon / 15;
      const selectedDate = new Date(day.gregorianDate.getTime());
      // Set the UTC hours adjusted for location offset
      // If local time is 14:00 at Jerusalem (lon ~35°, offset ~2.33h), UTC is ~11:40
      const utcHours = hours - locationOffsetHours;
      selectedDate.setUTCHours(0, 0, 0, 0);
      const selectedTs = selectedDate.getTime() + (utcHours * 60 + minutes) * 60 * 1000;
      
      let dayStartTs, dayEndTs;
      
      if (dayStartTime === 'morning') {
        // Day starts at first light, ends at next first light
        if (typeof getAstronomicalTimes === 'function') {
          const todayAstro = getAstronomicalTimes(day.gregorianDate, location);
          
          // Get tomorrow's date for end of day
          const tomorrowDate = new Date(day.gregorianDate.getTime());
          tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
          const tomorrowAstro = getAstronomicalTimes(tomorrowDate, location);
          
          dayStartTs = todayAstro?.firstLightTs;
          dayEndTs = tomorrowAstro?.firstLightTs;
        }
      } else {
        // Day starts at sunset, ends at next sunset
        if (typeof getSunsetTimestamp === 'function') {
          // Get yesterday's sunset (start of today's biblical day)
          const yesterdayDate = new Date(day.gregorianDate.getTime());
          yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
          dayStartTs = getSunsetTimestamp(yesterdayDate);
          dayEndTs = getSunsetTimestamp(day.gregorianDate);
        }
      }
      
      if (!dayStartTs || !dayEndTs) {
        // Fallback: assume 24-hour day starting at 6am or 6pm
        const baseHour = dayStartTime === 'morning' ? 6 : 18;
        const dayDate = new Date(day.gregorianDate.getTime());
        dayDate.setUTCHours(baseHour, 0, 0, 0);
        dayStartTs = dayDate.getTime();
        dayEndTs = dayStartTs + 24 * 60 * 60 * 1000;
      }
      
      // Calculate progress as percentage
      const totalDuration = dayEndTs - dayStartTs;
      const elapsed = selectedTs - dayStartTs;
      
      if (totalDuration <= 0) return null;
      
      const progress = (elapsed / totalDuration) * 100;
      
      // Clamp to 0-100 range
      return Math.max(0, Math.min(100, progress));
    } catch (e) {
      console.warn('Could not calculate selected time progress:', e);
      return null;
    }
  },

  /**
   * Calculate daylight gradient for the day-cycle-bar
   * Uses getSunriseTimestamp/getSunsetTimestamp from astronomy-utils.js
   */
  calculateDaylightGradient(day1, dayStartTime) {
    let daylightHours = 12; // default
    
    if (day1?.gregorianDate && typeof getSunriseTimestamp === 'function' && typeof getSunsetTimestamp === 'function') {
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
    
    // Clamp to reasonable range (6-18 hours)
    daylightHours = Math.max(6, Math.min(18, daylightHours));
    
    // Convert to percentages
    const twilightHours = 1.5;
    const nightHours = 24 - daylightHours;
    const twi = (twilightHours / 24) * 100;
    const day = (daylightHours / 24) * 100;
    const night = (nightHours / 24) * 100;
    
    const offset = 1;
    const twilight = twi * 2;
    
    let gradient;
    if (dayStartTime === 'evening') {
      const duskEnd = twilight - offset;
      const dawnStart = night - twilight + offset;
      const dawnEnd = night + twilight - offset;
      gradient = `repeating-linear-gradient(90deg, 
        #7ab3d4 0%, 
        #0d1a2d ${duskEnd}%, 
        #0d1a2d ${dawnStart}%, 
        #7ab3d4 ${dawnEnd}%, 
        #7ab3d4 100%)`;
    } else {
      const dawnEnd = twilight - offset;
      const duskStart = day - twilight + offset;
      const duskEnd = day + twilight - offset;
      gradient = `repeating-linear-gradient(90deg, 
        #0d1a2d 0%, 
        #7ab3d4 ${dawnEnd}%, 
        #7ab3d4 ${duskStart}%, 
        #0d1a2d ${duskEnd}%, 
        #0d1a2d 100%)`;
    }
    
    return { gradient, percent: Math.round(day) };
  },

  formatYear(year) {
    // Use YearUtils for standardized conversion
    // Internal astronomical year → display string
    if (typeof YearUtils !== 'undefined') {
      return YearUtils.format(year);
    }
    // Fallback: astronomical year numbering (AD is implicit, only show BC)
    if (year <= 0) return (1 - year) + ' BC';
    return String(year);
  },

  formatShortDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
  },

  formatFullDate(date) {
    // NASA convention: dates before 1582 are Julian calendar, no suffix needed
    // (can add tooltip elsewhere if explanation needed)
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const year = date.getUTCFullYear();
    const yearStr = this.formatYear(year);
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${yearStr}`;
  },

  formatTime(context) {
    // Time is stored as UTC, display in local time at current location
    const localTime = AppStore.getLocalTime();
    if (localTime) {
      const { hours, minutes } = localTime;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h = hours % 12 || 12;
      return `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;
    }
    return '12:00 PM';
  },

  getLocationName(location) {
    // Find nearest city name from coordinates
    if (location && typeof location === 'object') {
      // Use URLRouter's city lookup if available
      if (typeof URLRouter !== 'undefined' && URLRouter._getLocationSlug) {
        const slug = URLRouter._getLocationSlug(location);
        return this.formatCitySlug(slug);
      }
      // Use DatelineMap as fallback
      if (typeof DatelineMap !== 'undefined') {
        const slug = DatelineMap.findNearestCity(location.lat, location.lon);
        if (slug) {
          return this.formatCitySlug(slug);
        }
      }
      return `${location.lat.toFixed(1)}°, ${location.lon.toFixed(1)}°`;
    }
    return 'Jerusalem';
  },
  
  formatCitySlug(slug) {
    // Convert "new-york" to "New York"
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  },
  
  getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  },

  getMoonIcon(phase) {
    return phase === 'full' ? '🌕' : phase === 'dark' ? '🌑' : '🌒';
  },

  /**
   * Get feast and event icons for a day cell (separated)
   * @param {Object} day - Day object with feasts and events arrays
   * @returns {Object} { feastIcons: string, eventIcons: string }
   */
  getDayIconsHtml(day) {
    if (!day) return { feastIcons: '', eventIcons: '' };
    
    // Get feast icons (unique only) - goes bottom right
    let feastIcons = '';
    if (day.feasts && day.feasts.length > 0) {
      const icons = [...new Set(day.feasts.map(f => f.feast.icon))];
      feastIcons = icons.join('');
    }
    
    // Get event icons (unique only) - goes bottom left
    let eventIcons = '';
    if (day.events && day.events.length > 0) {
      const icons = day.events
        .filter(e => e.icon)
        .map(e => e.icon);
      if (icons.length > 0) {
        eventIcons = [...new Set(icons)].join('');
      } else {
        eventIcons = '📜'; // Default event marker
      }
    }
    
    return { feastIcons, eventIcons };
  },

  /**
   * Get feast/event icons for a day cell (legacy - returns combined string)
   * @param {Object} day - Day object with feasts and events arrays
   * @returns {string} Combined icons or empty string
   * @deprecated Use getDayIconsHtml instead
   */
  getDayIcons(day) {
    const { feastIcons, eventIcons } = this.getDayIconsHtml(day);
    const icons = [];
    if (eventIcons) icons.push(eventIcons);
    if (feastIcons) icons.push(feastIcons);
    return icons.join('');
  },

  /**
   * Get moon icon for a day - only shows icon if a quarter phase actually occurs on that day
   * Quarter phases: new (0°), first quarter (90°), full (180°), last quarter (270°)
   * @param {Object} day - Day object with gregorianDate
   * @param {number} lunarDay - Lunar day number (1-30)
   * @param {Object} profile - Profile config with moonPhase, dayStartTime, dayStartAngle
   * @param {Object} location - { lat, lon }
   * @returns {string} Moon emoji or empty string
   */
  getMoonIconForDay(day, lunarDay, profile, location) {
    // Day 1 always shows the defining moon phase
    if (lunarDay === 1) return this.getMoonIcon(profile.moonPhase);
    
    if (!day?.gregorianDate) return '';
    
    try {
      // Get the elongation at day start and day end
      const elongStart = this.getElongationForDate(day.gregorianDate, profile, location);
      
      // Get next day's date for end of lunar day
      const nextDate = new Date(day.gregorianDate.getTime());
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const elongEnd = this.getElongationForDate(nextDate, profile, location);
      
      if (elongStart === null || elongEnd === null) return '';
      
      // Only show icons for full, new, and half moons (first/last quarter)
      const quarters = [
        { angle: 0, icon: '🌑' },    // New Moon
        { angle: 90, icon: '🌓' },   // First Quarter
        { angle: 180, icon: '🌕' },  // Full Moon
        { angle: 270, icon: '🌗' }   // Last Quarter
      ];
      
      for (const quarter of quarters) {
        if (this.phaseOccursDuringDay(elongStart, elongEnd, quarter.angle)) {
          return quarter.icon;
        }
      }
      
      return ''; // No quarter phase on this day
    } catch (err) {
      console.warn('Error calculating moon phase:', err);
      return '';
    }
  },

  /**
   * Get moon-sun elongation angle for a date
   * Uses Swiss Ephemeris if available, falls back to Astronomy Engine
   * @param {Date} date 
   * @param {Object} profile 
   * @param {Object} location 
   * @returns {number|null} Elongation in degrees (0-360)
   */
  getElongationForDate(date, profile, location) {
    // Try Swiss Ephemeris first
    if (window.AstroEngines?.swissEphemeris?.isLoaded && 
        window.AstroEngines.swissEphemeris._dateToJD &&
        window.AstroEngines.swissEphemeris._getMoonSunElongation) {
      const jd = window.AstroEngines.swissEphemeris._dateToJD(date);
      const elongation = window.AstroEngines.swissEphemeris._getMoonSunElongation(jd);
      if (elongation !== null) return elongation;
    }
    
    // Fallback to Astronomy Engine's MoonPhase
    if (typeof Astronomy !== 'undefined' && Astronomy.MoonPhase) {
      try {
        return Astronomy.MoonPhase(date);
      } catch (e) {
        return null;
      }
    }
    
    return null;
  },

  /**
   * Check if a phase angle is crossed between two elongation values
   * @param {number} elongStart - Elongation at start of day
   * @param {number} elongEnd - Elongation at end of day
   * @param {number} targetAngle - Target phase angle (0, 90, 180, 270)
   * @returns {boolean}
   */
  phaseOccursDuringDay(elongStart, elongEnd, targetAngle) {
    // Elongation increases over time (~12° per day)
    // Handle the 360°→0° wraparound for new moon
    
    if (targetAngle === 0) {
      // New moon: elongation wraps from ~350+ to ~10-
      if (elongStart > 300 && elongEnd < elongStart) {
        if (elongEnd < 60) return true;
      }
      if (elongStart > 350 && elongEnd < 60) return true;
    } else {
      // For other phases (90, 180, 270): check if targetAngle is between start and end
      if (elongStart <= targetAngle && elongEnd >= targetAngle) return true;
      
      // Edge case: day spans the 360→0 boundary but target is not 0
      if (elongStart > elongEnd) {
        if (elongStart <= targetAngle || elongEnd >= targetAngle) return true;
      }
    }
    
    return false;
  },

  isSabbath(lunarDay, day, sabbathMode) {
    if (sabbathMode === 'lunar') return [8, 15, 22, 29].includes(lunarDay);
    const map = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    return day?.weekday === map[sabbathMode];
  },

  getSabbathColumn(day2Weekday, sabbathMode) {
    const map = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const sabbathWeekday = map[sabbathMode];
    for (let col = 0; col < 7; col++) {
      if ((day2Weekday + col) % 7 === sabbathWeekday) return col;
    }
    return 6;
  },

  isToday(day, todayYear, todayMonth, todayDate) {
    if (!day?.gregorianDate) return false;
    return day.gregorianDate.getUTCFullYear() === todayYear &&
           day.gregorianDate.getUTCMonth() === todayMonth &&
           day.gregorianDate.getUTCDate() === todayDate;
  },

  /**
   * Convert a JavaScript Date to Julian Day number
   * Delegates to AppStore's method to avoid duplication
   */
  dateToJD(date) {
    return AppStore._dateToJulian(date);
  },

  /**
   * Populate the world clock section showing the same moment on different calendars
   */
  populateWorldClock(container, derived, context) {
    const compareContainer = container.querySelector('.day-detail-profile-compare');
    if (!compareContainer) return;
    
    // Get world clock entries
    if (typeof getWorldClockEntries !== 'function') {
      compareContainer.innerHTML = '';
      return;
    }
    
    const entries = getWorldClockEntries();
    if (!entries || entries.length === 0) {
      compareContainer.innerHTML = '';
      return;
    }
    
    // Get the selected Julian Day
    const selectedJD = derived.currentJD || AppStore.getState()?.context?.selectedDate;
    if (!selectedJD) {
      compareContainer.innerHTML = '';
      return;
    }
    
    let compareHtml = `
      <div class="profile-compare-header">
        <span class="profile-compare-title">📅 This Moment on Other Calendars</span>
        <button class="world-clock-add-btn" onclick="showAddWorldClockModal()" title="Add Calendar">+</button>
      </div>
      <div class="profile-compare-grid">`;
    
    let hasResults = false;
    const currentProfileId = context?.profileId || 'timeTested';
    const currentLocationSlug = (typeof URLRouter !== 'undefined' && URLRouter._getLocationSlug && context?.location)
      ? URLRouter._getLocationSlug(context.location) : 'jerusalem';
    
    entries.forEach((entry, index) => {
      const profile = window.PROFILES?.[entry.profileId];
      if (!profile) return;
      
      // Get coordinates for this entry's location
      const coords = (typeof URLRouter !== 'undefined') ? URLRouter.CITY_SLUGS?.[entry.locationSlug] : null;
      if (!coords) return;
      
      // Create a temp profile with the entry's location
      const tempProfile = {
        ...profile,
        lat: coords.lat,
        lon: coords.lon
      };
      
      // Get lunar day info for this profile/location combination
      let lunarDayInfo;
      if (typeof getLunarDayForJD === 'function') {
        lunarDayInfo = getLunarDayForJD(selectedJD, tempProfile);
      } else if (typeof getLunarDayForTimestamp === 'function') {
        const viewDate = AppStore._julianToDate ? AppStore._julianToDate(selectedJD) : new Date();
        lunarDayInfo = getLunarDayForTimestamp(viewDate.getTime(), tempProfile);
      }
      if (!lunarDayInfo) return;
      
      hasResults = true;
      
      // Check if this is the current view
      const isCurrent = entry.profileId === currentProfileId && 
                        entry.locationSlug === currentLocationSlug;
      
      // Get feast icons for this lunar day/month
      let feastHtml = '';
      if (typeof getFeastIconsForLunarDay === 'function') {
        const feastIcons = getFeastIconsForLunarDay(lunarDayInfo.month, lunarDayInfo.day);
        feastHtml = feastIcons.length > 0 ? `<div class="profile-compare-feasts">${feastIcons.join('')}</div>` : '';
      }
      
      // Get local time for this location
      let localTime = '';
      if (typeof getLocalTimeForLocation === 'function') {
        localTime = getLocalTimeForLocation(coords.lat, coords.lon);
      }
      
      // Get priestly course for this calendar
      let priestlyHtml = '';
      if (typeof getPriestlyCourse === 'function' && window.PRIESTLY_DIVISIONS) {
        // Skip Day 1 for lunar sabbath (New Moon day isn't part of a week)
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
      
      // Render profile icon
      let iconHtml = '';
      if (typeof renderProfileIcon === 'function') {
        iconHtml = renderProfileIcon(profile);
      } else if (profile.icon) {
        iconHtml = profile.icon;
      }
      
      compareHtml += `
        <div class="profile-compare-item${isCurrent ? ' current' : ''}" onclick="navigateToWorldClockEntry('${entry.profileId}', '${entry.locationSlug}')">
          <button class="world-clock-remove-btn" onclick="event.stopPropagation(); removeWorldClockEntryAndRefresh(${index})" title="Remove">×</button>
          <span class="profile-compare-name">${iconHtml} ${profile.name}</span>
          <span class="profile-compare-day">Day ${lunarDayInfo.day} of Month ${lunarDayInfo.month}</span>
          <span class="profile-compare-location">${entry.locationName || this.formatCitySlug(entry.locationSlug)}${localTime ? ' · ' + localTime : ''}</span>
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
    
  },

  /**
   * Format city slug for display (e.g., "new-york" -> "New York")
   */
  formatCitySlug(slug) {
    if (typeof formatCitySlug === 'function') {
      return formatCitySlug(slug);
    }
    return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  },

  // ═══════════════════════════════════════════════════════════════════
  // DATE CALCULATOR
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Render the date calculator panel (toggle is rendered inline next to the date).
   * All state is read from AppStore.getState().ui for URL persistence.
   */
  renderDateCalculatorPanel() {
    const state = AppStore.getState();
    const ui = state.ui;
    const profile = window.PROFILES?.[state.context.profileId] || {};
    const calcMode = ui.calcMode || ((profile.sabbathMode || 'lunar') === 'lunar' ? 'lunar' : 'gregorian');
    const isLunar = calcMode === 'lunar';
    const isOpen = ui.calcOpen;
    const dir = ui.calcDir || 'add';
    const dirLabel = dir === 'sub' ? '− Sub' : '+ Add';
    return `
      <div class="date-calc-panel" id="date-calc-panel" style="display: ${isOpen ? 'block' : 'none'}">
        <div class="date-calc-row">
          <div class="date-calc-mode-toggle" id="date-calc-mode-toggle">
            <button class="date-calc-mode-btn ${isLunar ? 'active' : ''}" data-mode="lunar" onclick="CalendarView.setCalcMode('lunar')">Lunar</button>
            <button class="date-calc-mode-btn ${!isLunar ? 'active' : ''}" data-mode="gregorian" onclick="CalendarView.setCalcMode('gregorian')">Greg</button>
          </div>
          <span class="date-calc-lbl">Yr</span><span class="date-calc-lbl">Mo</span><span class="date-calc-lbl">Wk</span><span class="date-calc-lbl">Dy</span>
        </div>
        <div class="date-calc-row">
          <div class="date-calc-mode-toggle" id="date-calc-dir-toggle">
            <button class="date-calc-mode-btn ${dir === 'add' ? 'active' : ''}" data-dir="add" onclick="CalendarView.setCalcDir('add')">Add</button>
            <button class="date-calc-mode-btn ${dir === 'sub' ? 'active' : ''}" data-dir="sub" onclick="CalendarView.setCalcDir('sub')">Sub</button>
          </div>
          <input type="number" class="date-calc-input" id="date-calc-years" min="0" value="${ui.calcYears || 0}" oninput="CalendarView.onCalcInput()">
          <input type="number" class="date-calc-input" id="date-calc-months" min="0" value="${ui.calcMonths || 0}" oninput="CalendarView.onCalcInput()">
          <input type="number" class="date-calc-input" id="date-calc-weeks" min="0" value="${ui.calcWeeks || 0}" oninput="CalendarView.onCalcInput()">
          <input type="number" class="date-calc-input" id="date-calc-days" min="0" value="${ui.calcDays || 0}" oninput="CalendarView.onCalcInput()">
        </div>
        <div class="date-calc-result" id="date-calc-result"></div>
      </div>
    `;
  },

  toggleDateCalculator() {
    const ui = AppStore.getState().ui;
    AppStore.dispatch({ type: 'SET_CALC_STATE', calcOpen: !ui.calcOpen });
    // After state update, toggle DOM visibility directly (avoids full re-render)
    const panel = document.getElementById('date-calc-panel');
    if (panel) {
      panel.style.display = !ui.calcOpen ? 'block' : 'none';
      if (!ui.calcOpen) this.computeDateCalc();
    }
  },

  setCalcDir(dir) {
    AppStore.dispatch({ type: 'SET_CALC_STATE', calcDir: dir });
    // Update only the Add/Sub toggle (second toggle in the panel)
    const toggle = document.getElementById('date-calc-dir-toggle');
    if (toggle) {
      toggle.querySelectorAll('.date-calc-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dir === dir);
      });
    }
    this.computeDateCalc();
  },

  setCalcMode(mode) {
    AppStore.dispatch({ type: 'SET_CALC_STATE', calcMode: mode });
    // Update only the Lunar/Greg toggle (first toggle in the panel)
    const toggle = document.getElementById('date-calc-mode-toggle');
    if (toggle) {
      toggle.querySelectorAll('.date-calc-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
    }
    this.computeDateCalc();
  },

  /** Read current input values from DOM — sync to state silently (replaceState, no re-render) */
  onCalcInput() {
    this._syncCalcInputsToState();
    // Update URL via replaceState (no history entry, no re-render)
    if (window.URLRouter && AppStore._derived) {
      const url = URLRouter.buildURL(AppStore.getState(), AppStore._derived);
      const currentURL = window.location.pathname + window.location.search;
      if (url !== currentURL) {
        history.replaceState({}, '', url);
      }
    }
    this.computeDateCalc();
  },

  /** Sync current DOM input values to AppStore (called before navigation) */
  _syncCalcInputsToState() {
    const years = parseInt(document.getElementById('date-calc-years')?.value) || 0;
    const months = parseInt(document.getElementById('date-calc-months')?.value) || 0;
    const weeks = parseInt(document.getElementById('date-calc-weeks')?.value) || 0;
    const days = parseInt(document.getElementById('date-calc-days')?.value) || 0;
    // Use silentUpdate to avoid triggering re-render
    AppStore.silentUpdate({ ui: { calcYears: years, calcMonths: months, calcWeeks: weeks, calcDays: days } });
  },

  _getCalcMode() {
    const ui = AppStore.getState().ui;
    if (ui.calcMode) return ui.calcMode;
    const state = AppStore.getState();
    const profile = window.PROFILES?.[state.context.profileId] || {};
    return (profile.sabbathMode || 'lunar') === 'lunar' ? 'lunar' : 'gregorian';
  },

  /**
   * Resolve a JD to a lunar date { year, month, day } using the engine.
   * Generates the calendar for the appropriate year.
   */
  _resolveLunarDate(jd) {
    if (!AppStore._engine) return null;
    const state = AppStore.getState();
    const location = state.context.location;

    // Get approximate year from JD using engine's conversion
    const calDate = AppStore._engine.jdToDisplayDate(jd);
    const approxYear = calDate.year;

    // Try approxYear and approxYear-1 (dates before equinox belong to previous biblical year)
    for (const year of [approxYear, approxYear - 1]) {
      try {
        const calendar = AppStore._engine.generateYear(year, location);
        if (!calendar || !calendar.months) continue;
        const jdFloor = Math.floor(jd);
        for (const month of calendar.months) {
          if (!month.days || month.days.length === 0) continue;
          for (const day of month.days) {
            if (day.jd != null && Math.floor(day.jd) === jdFloor) {
              return { year, month: month.monthNumber, day: day.lunarDay, jd: day.jd, daysInMonth: month.days.length };
            }
          }
        }
      } catch (e) {
        // generateYear may fail for extreme years
      }
    }
    return null;
  },

  /**
   * Get info about a specific lunar date (year, month, day).
   * Returns { jd, daysInMonth, monthCount } or null.
   */
  _getLunarDateInfo(year, month, day) {
    if (!AppStore._engine) return null;
    const state = AppStore.getState();
    const location = state.context.location;
    try {
      const calendar = AppStore._engine.generateYear(year, location);
      if (!calendar || !calendar.months) return null;
      const monthCount = calendar.months.length;
      const clampedMonth = Math.min(month, monthCount);
      const monthData = calendar.months[clampedMonth - 1];
      if (!monthData || !monthData.days) return null;
      const daysInMonth = monthData.days.length;
      const clampedDay = Math.min(day, daysInMonth);
      const dayData = monthData.days.find(d => d.lunarDay === clampedDay);
      return {
        year, month: clampedMonth, day: clampedDay,
        jd: dayData?.jd || null,
        daysInMonth,
        monthCount
      };
    } catch (e) {
      return null;
    }
  },

  /**
   * Compute the date calculator result.
   * Lunar mode: 4-stage JD pipeline with snapping (years, months, weeks, days).
   * Gregorian mode: standard JS Date arithmetic, then resolve to lunar date.
   */
  computeDateCalc() {
    const resultEl = document.getElementById('date-calc-result');
    if (!resultEl) return;

    const derived = AppStore.getDerived();
    const ui = AppStore.getState().ui;
    const calcMode = this._getCalcMode();

    // Read inputs from DOM (avoids dispatch/re-render on keystroke)
    const sign = (ui.calcDir || 'add') === 'sub' ? -1 : 1;
    const years = (parseInt(document.getElementById('date-calc-years')?.value) || 0) * sign;
    const months = (parseInt(document.getElementById('date-calc-months')?.value) || 0) * sign;
    const weeks = (parseInt(document.getElementById('date-calc-weeks')?.value) || 0) * sign;
    const days = (parseInt(document.getElementById('date-calc-days')?.value) || 0) * sign;

    if (years === 0 && months === 0 && weeks === 0 && days === 0) {
      resultEl.innerHTML = '<span class="date-calc-hint">Enter values above</span>';
      return;
    }

    if (calcMode === 'gregorian') {
      this._computeGregorianCalc(resultEl, derived, years, months, weeks, days);
    } else {
      this._computeLunarCalc(resultEl, derived, years, months, weeks, days);
    }
  },

  /**
   * Gregorian mode: standard calendar arithmetic via JS Date, then resolve to lunar date.
   */
  _computeGregorianCalc(resultEl, derived, years, months, weeks, days) {
    // Get the Gregorian date of the currently selected day
    const startMonth = (derived.currentMonthIndex ?? 0) + 1;
    const startDay = derived.currentLunarDay ?? 1;
    const startInfo = this._getLunarDateInfo(derived.year, startMonth, startDay);
    if (!startInfo || !startInfo.jd) {
      resultEl.innerHTML = '<span class="date-calc-error">Cannot compute</span>';
      return;
    }

    // Convert JD to Gregorian components, then to a JS Date for arithmetic
    const greg = AppStore._julianToGregorian(startInfo.jd);
    if (!greg) {
      resultEl.innerHTML = '<span class="date-calc-error">Cannot compute</span>';
      return;
    }
    const startDate = new Date(Date.UTC(2000, greg.month - 1, greg.day, 12, 0, 0));
    startDate.setUTCFullYear(greg.year);

    // Stage 1 & 2: Add years and months via Date (handles variable month lengths, leap years)
    startDate.setUTCFullYear(startDate.getUTCFullYear() + years);
    startDate.setUTCMonth(startDate.getUTCMonth() + months);

    // Stage 3 & 4: Add weeks and days
    startDate.setUTCDate(startDate.getUTCDate() + weeks * 7 + days);

    // Convert result back to JD and resolve to lunar date
    const resultJD = AppStore._dateToJulian(startDate);
    if (!resultJD) {
      resultEl.innerHTML = '<span class="date-calc-error">Cannot compute</span>';
      return;
    }

    const resolved = this._resolveLunarDate(resultJD);
    if (!resolved) {
      resultEl.innerHTML = '<span class="date-calc-error">Date out of range</span>';
      return;
    }

    const yearStr = resolved.year < 0 ? `${Math.abs(resolved.year) + 1} BC` : `${resolved.year} AD`;
    const gregStr = this._getCalcGregorianStr(resolved.year, resolved.month, resolved.day);
    resultEl.innerHTML = `
      <a class="date-calc-go" onclick="CalendarView.navigateToCalcResult(${resolved.year}, ${resolved.month}, ${resolved.day})">
        Day ${resolved.day} of Month ${resolved.month}, ${yearStr}
        <span class="date-calc-greg">${gregStr || ''} →</span>
      </a>
    `;
  },

  /**
   * Lunar mode: 4-stage JD pipeline with snapping.
   */
  _computeLunarCalc(resultEl, derived, years, months, weeks, days) {
    const state = AppStore.getState();
    const profile = window.PROFILES?.[state.context.profileId] || {};
    const sabbathMode = profile.sabbathMode || 'lunar';

    const startYear = derived.year;
    const startMonth = (derived.currentMonthIndex ?? 0) + 1;
    const startDay = derived.currentLunarDay ?? 1;

    const startInfo = this._getLunarDateInfo(startYear, startMonth, startDay);
    if (!startInfo || !startInfo.jd) {
      resultEl.innerHTML = '<span class="date-calc-error">Cannot compute</span>';
      return;
    }

    let currentJD = startInfo.jd;
    let currentYear = startInfo.year;
    let currentMonth = startInfo.month;
    let currentDay = startInfo.day;

    // Stage 1: Add years — direct lookup, snap to same month/day
    if (years !== 0) {
      const targetYear = currentYear + years;
      const info = this._getLunarDateInfo(targetYear, currentMonth, currentDay);
      if (info && info.jd) {
        currentJD = info.jd; currentYear = info.year;
        currentMonth = info.month; currentDay = info.day;
      } else {
        resultEl.innerHTML = '<span class="date-calc-error">Year out of range</span>';
        return;
      }
    }

    // Stage 2: Add months — jump by months*29.53, snap to same day
    if (months !== 0) {
      const jumpJD = currentJD + months * 29.53;
      const resolved = this._resolveLunarDate(jumpJD);
      if (resolved) {
        const info = this._getLunarDateInfo(resolved.year, resolved.month, currentDay);
        if (info && info.jd) {
          currentJD = info.jd; currentYear = info.year;
          currentMonth = info.month; currentDay = info.day;
        }
      } else {
        resultEl.innerHTML = '<span class="date-calc-error">Month out of range</span>';
        return;
      }
    }

    // Stage 3: Add weeks
    if (weeks !== 0) {
      if (sabbathMode === 'lunar') {
        // Lunar weeks: 4 weeks = 1 month, snap to same position in week block
        const startPos = (currentDay >= 2 && currentDay <= 29) ? (currentDay - 2) % 7 : 0;
        const absWeeks = Math.abs(weeks);
        const weekSign = weeks > 0 ? 1 : -1;
        const extraMonths = Math.floor(absWeeks / 4) * weekSign;
        const remainWeeks = (absWeeks % 4) * weekSign;

        const jumpJD = currentJD + extraMonths * 29.53 + remainWeeks * 7;
        const resolved = this._resolveLunarDate(jumpJD);
        if (resolved && resolved.day >= 2 && resolved.day <= 29) {
          const landedPos = (resolved.day - 2) % 7;
          let adjustment = (startPos - landedPos + 7) % 7;
          if (adjustment > 3) adjustment -= 7;
          let snappedDay = resolved.day + adjustment;

          if (snappedDay > 29) {
            const nextInfo = this._getLunarDateInfo(resolved.year, resolved.month + 1, snappedDay - 28 + 1);
            if (nextInfo && nextInfo.jd) {
              currentJD = nextInfo.jd; currentYear = nextInfo.year;
              currentMonth = nextInfo.month; currentDay = nextInfo.day;
            }
          } else if (snappedDay < 2) {
            const prevInfo = this._getLunarDateInfo(resolved.year, resolved.month - 1, 29 + (snappedDay - 1));
            if (prevInfo && prevInfo.jd) {
              currentJD = prevInfo.jd; currentYear = prevInfo.year;
              currentMonth = prevInfo.month; currentDay = prevInfo.day;
            }
          } else {
            const info = this._getLunarDateInfo(resolved.year, resolved.month, snappedDay);
            if (info && info.jd) {
              currentJD = info.jd; currentYear = info.year;
              currentMonth = info.month; currentDay = info.day;
            }
          }
        } else if (resolved) {
          currentJD = resolved.jd; currentYear = resolved.year;
          currentMonth = resolved.month; currentDay = resolved.day;
        }
      } else {
        // Saturday mode: weeks are 7 calendar days
        currentJD = currentJD + weeks * 7;
        const resolved = this._resolveLunarDate(currentJD);
        if (resolved) {
          currentYear = resolved.year; currentMonth = resolved.month;
          currentDay = resolved.day; currentJD = resolved.jd;
        }
      }
    }

    // Stage 4: Add days — exact JD arithmetic
    if (days !== 0) {
      currentJD = currentJD + days;
      const resolved = this._resolveLunarDate(currentJD);
      if (resolved) {
        currentYear = resolved.year; currentMonth = resolved.month;
        currentDay = resolved.day; currentJD = resolved.jd;
      }
    }

    // Format result
    const yearStr = currentYear < 0 ? `${Math.abs(currentYear) + 1} BC` : `${currentYear} AD`;
    const gregStr = this._getCalcGregorianStr(currentYear, currentMonth, currentDay);
    resultEl.innerHTML = `
      <a class="date-calc-go" onclick="CalendarView.navigateToCalcResult(${currentYear}, ${currentMonth}, ${currentDay})">
        Day ${currentDay} of Month ${currentMonth}, ${yearStr}
        <span class="date-calc-greg">${gregStr || ''} →</span>
      </a>
    `;
  },

  /**
   * Get a formatted Gregorian date string for a lunar date, for the calculator result preview.
   */
  _getCalcGregorianStr(year, month, day) {
    const info = this._getLunarDateInfo(year, month, day);
    if (!info || !info.jd) return '';
    // Look up the actual day data to get gregorianDate
    try {
      const state = AppStore.getState();
      const location = state.context.location;
      const calendar = AppStore._engine.generateYear(year, location);
      if (!calendar || !calendar.months) return '';
      const clampedMonth = Math.min(month, calendar.months.length);
      const monthData = calendar.months[clampedMonth - 1];
      if (!monthData || !monthData.days) return '';
      const clampedDay = Math.min(day, monthData.days.length);
      const dayData = monthData.days.find(d => d.lunarDay === clampedDay);
      if (!dayData || !dayData.gregorianDate) return '';
      return this.formatFullDate(dayData.gregorianDate);
    } catch (e) {
      return '';
    }
  },

  navigateToCalcResult(year, month, day) {
    // Sync current input values to state so they appear in the URL
    this._syncCalcInputsToState();
    AppStore.dispatch({ type: 'SET_LUNAR_DATETIME', year, month, day });
  }
};

window.CalendarView = CalendarView;
if (typeof module !== 'undefined' && module.exports) module.exports = CalendarView;
