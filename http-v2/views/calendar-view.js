/**
 * CalendarView - Main calendar display
 * 
 * Renders calendar HTML that matches the structure expected by styles.css.
 * Uses global utility functions (getJubileeInfo, formatJubileeDisplay, etc.)
 * All logic should be in AppStore or utility modules, not here.
 */

const CalendarView = {
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
    
    console.log('[CalendarView] render: lunarMonths=', lunarMonths?.length, 'monthIndex=', currentMonthIndex, 'day=', currentLunarDay, 'year=', year);
    
    // Everything derived from selectedDate (JD) - the single source of truth
    const monthIndex = currentMonthIndex;
    const selectedDay = currentLunarDay;
    const month = lunarMonths?.[monthIndex];
    
    console.log('[CalendarView] render: month=', month ? 'exists' : 'null/undefined');
    
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
    
    // Today check
    const now = new Date();
    const todayYear = now.getUTCFullYear();
    const todayMonth = now.getUTCMonth();
    const todayDate = now.getUTCDate();
    
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
            <!-- Row 1: Jubilee Indicator -->
            <div class="header-row-1">
              <span class="jubilee-text">${jubileeDisplay}</span>
            </div>
            
            <!-- Row 2: Year | Month | Time | Location -->
            <div class="header-row-2">
              <div class="header-dropdown year" data-action="year-picker">
                <span>${this.formatYear(displayYear)}</span>
                <span class="dropdown-arrow">▼</span>
              </div>
              <span class="header-separator">|</span>
              <div class="header-dropdown month" data-action="month-picker">
                <span>Month ${month.monthNumber}</span>
                <span class="dropdown-arrow">▼</span>
              </div>
              <span class="header-separator">|</span>
              <div class="header-dropdown time" data-action="time-picker">
                <span>${this.formatTime(context)}</span>
                <span class="dropdown-arrow">▼</span>
              </div>
              <span class="header-separator">|</span>
              <div class="header-dropdown location" data-action="location-picker">
                <span>${this.getLocationName(context.location)}</span>
                <span class="dropdown-arrow">▼</span>
              </div>
            </div>
            
            <!-- Day 1 box spans both rows -->
            <div class="new-moon-box day-cell new-moon${selectedDay === 1 ? ' highlighted' : ''}${this.isToday(day1, todayYear, todayMonth, todayDate) ? ' today' : ''}" 
                 data-lunar-day="1">
              <div class="gregorian">${day1 ? this.formatShortDate(day1.gregorianDate) : ''}<span class="day-year">${day1 ? this.formatYear(day1.gregorianDate.getUTCFullYear()) : ''}</span></div>
              <div class="moon-phase">${this.getMoonIcon(profile.moonPhase)}</div>
              <div class="lunar-day">1</div>
            </div>
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
            ${this.renderDays(month, selectedDay, sabbathMode, sabbathColumnIndex, todayYear, todayMonth, todayDate, profile, context.location)}
          </div>
          
          <!-- Month Buttons -->
          <div id="month-buttons" class="month-buttons-container">
            ${this.renderMonthButtons(lunarMonths.length, monthIndex)}
          </div>
        </div>
        
        <!-- Day Detail -->
        ${selectedDay ? this.renderDayDetail(month, selectedDay, profile) : ''}
      </div>
    `;
  },

  renderDays(month, selectedDay, sabbathMode, sabbathColumnIndex, todayYear, todayMonth, todayDate, profile, location) {
    const weeks = [[2,3,4,5,6,7,8], [9,10,11,12,13,14,15], [16,17,18,19,20,21,22], [23,24,25,26,27,28,29]];
    let html = '';
    
    for (const week of weeks) {
      for (const lunarDay of week) {
        const day = month.days.find(d => d.lunarDay === lunarDay);
        if (!day) {
          html += '<div class="day-cell empty"></div>';
          continue;
        }
        
        const isSabbath = this.isSabbath(lunarDay, day, sabbathMode);
        const isToday = this.isToday(day, todayYear, todayMonth, todayDate);
        const isSelected = lunarDay === selectedDay;
        
        let classes = ['day-cell'];
        if (isSabbath) classes.push('sabbath');
        if (isToday) classes.push('today');
        if (isSelected) classes.push('highlighted');
        
        html += `
          <div class="${classes.join(' ')}" data-lunar-day="${lunarDay}">
            <div class="gregorian">${this.formatShortDate(day.gregorianDate)}</div>
            <div class="moon-phase">${this.getMoonIconForDay(day, lunarDay, profile, location)}</div>
            <div class="lunar-day">${lunarDay}</div>
          </div>
        `;
      }
    }
    
    // Day 30 - always show space even if month doesn't have 30 days
    const day30 = month.days.find(d => d.lunarDay === 30);
    if (day30) {
      const isToday30 = this.isToday(day30, todayYear, todayMonth, todayDate);
      const isSelected30 = selectedDay === 30;
      let classes30 = ['day-cell'];
      if (isToday30) classes30.push('today');
      if (isSelected30) classes30.push('highlighted');
      
      html += `
        <div class="${classes30.join(' ')}" data-lunar-day="30">
          <div class="gregorian">${this.formatShortDate(day30.gregorianDate)}</div>
          <div class="moon-phase">${this.getMoonIconForDay(day30, 30, profile, location)}</div>
          <div class="lunar-day">30</div>
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
      <div class="profile-display span-4" data-action="profile-editor" title="Edit Profile Settings">
        <span class="profile-icon">${profile.icon || '🌕'}</span>
        <span class="profile-name">${profileName}</span>
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
    for (let i = 0; i < Math.min(monthCount, 13); i++) {
      const isActive = i === currentIndex;
      html += `<button class="month-btn${isActive ? ' active' : ''}" data-month="${i}">${i + 1}</button>`;
    }
    return html;
  },

  renderDayDetail(month, lunarDay, profile) {
    const day = month.days.find(d => d.lunarDay === lunarDay);
    if (!day) return '';
    
    const weekday = day.weekdayName || ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day.weekday];
    
    return `
      <div id="day-detail" class="day-detail-panel">
        <div class="day-detail-header">
          <h2>Day ${lunarDay} of the ${this.getOrdinal(month.monthNumber)} Month</h2>
          <div class="day-detail-date">${weekday}, ${this.formatFullDate(day.gregorianDate)}</div>
        </div>
      </div>
    `;
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
        console.log('[CalendarView] data-action clicked:', action);
        if (action === 'prev-month') this.navigateMonth(-1);
        else if (action === 'next-month') this.navigateMonth(1);
        else if (action === 'prev-year') this.navigateYear(-1);
        else if (action === 'next-year') this.navigateYear(1);
        else if (action === 'year-picker') this.showYearPicker(e, el);
        else if (action === 'month-picker') this.showMonthPicker(e, el);
        else if (action === 'time-picker') this.showTimePicker(e, el);
        else if (action === 'location-picker') this.showLocationPicker(e, el);
        else if (action === 'profile-editor') this.showProfileEditor(e);
      });
    });
  },
  
  showYearPicker(e, trigger) {
    console.log('[CalendarView] showYearPicker called');
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
    console.log('[CalendarView] showYearPicker: overlay appended to body, overlay in DOM:', document.body.contains(overlay));
    console.log('[CalendarView] showYearPicker: overlay style:', window.getComputedStyle(overlay).display, window.getComputedStyle(overlay).visibility);
    
    const yearDisplay = picker.querySelector('.year-display');
    const yearInput = picker.querySelector('.year-input');
    const eraToggle = picker.querySelector('.era-toggle');
    
    // Render function - updates picker from state
    const renderYearPicker = () => {
      const derived = AppStore.getDerived();
      const currentYear = derived.year; // Internal astronomical year
      console.log('[CalendarView] renderYearPicker: derived.year =', currentYear);
      // Use YearUtils to convert to display
      const display = typeof YearUtils !== 'undefined' 
        ? YearUtils.toDisplay(currentYear)
        : { year: currentYear <= 0 ? 1 - currentYear : currentYear, isBC: currentYear <= 0 };
      
      console.log('[CalendarView] renderYearPicker: display =', display);
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
    
    picker.innerHTML = '<div class="picker-header">Select Month</div><div class="picker-grid month-grid"></div>';
    
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
    
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    
    const picker = document.createElement('div');
    picker.className = 'time-picker';
    picker.onclick = (e) => e.stopPropagation();
    
    picker.innerHTML = `
      <div class="time-picker-row">
        <div class="time-spinner">
          <button class="spinner-btn" data-field="hours" data-delta="1">▲</button>
          <input type="text" class="time-input hours-input" maxlength="2">
          <button class="spinner-btn" data-field="hours" data-delta="-1">▼</button>
        </div>
        <span class="time-separator">:</span>
        <div class="time-spinner">
          <button class="spinner-btn" data-field="minutes" data-delta="1">▲</button>
          <input type="text" class="time-input minutes-input" maxlength="2">
          <button class="spinner-btn" data-field="minutes" data-delta="-1">▼</button>
        </div>
      </div>
    `;
    
    const rect = trigger.getBoundingClientRect();
    picker.style.top = (rect.bottom + 5) + 'px';
    picker.style.left = rect.left + 'px';
    
    overlay.appendChild(picker);
    document.body.appendChild(overlay);
    
    const hoursInput = picker.querySelector('.hours-input');
    const minutesInput = picker.querySelector('.minutes-input');
    
    // Render function
    const renderTimePicker = () => {
      const state = AppStore.getState();
      const currentTime = state.context.time || { hours: 12, minutes: 0 };
      hoursInput.value = String(currentTime.hours).padStart(2, '0');
      minutesInput.value = String(currentTime.minutes).padStart(2, '0');
    };
    
    renderTimePicker();
    const unsubscribe = AppStore.subscribe(renderTimePicker);
    overlay._unsubscribe = unsubscribe;
    
    const closePicker = () => {
      unsubscribe();
      overlay.remove();
    };
    
    overlay.onclick = closePicker;
    
    // Spinner buttons - dispatch immediately
    picker.querySelectorAll('.spinner-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const state = AppStore.getState();
        const derived = AppStore.getDerived();
        const currentTime = state.context.time || { hours: 12, minutes: 0 };
        const field = btn.dataset.field;
        const delta = parseInt(btn.dataset.delta);
        
        let hours = currentTime.hours;
        let minutes = currentTime.minutes;
        
        if (field === 'hours') {
          hours = (hours + delta + 24) % 24;
        } else {
          minutes = (minutes + delta + 60) % 60;
        }
        
        // Use SET_LUNAR_DATETIME with current date and new time
        AppStore.dispatch({ 
          type: 'SET_LUNAR_DATETIME', 
          year: derived.year,
          month: (derived.currentMonthIndex ?? 0) + 1,
          day: derived.currentLunarDay ?? 1,
          time: { hours, minutes } 
        });
      });
    });
    
    // Input blur - dispatch
    const dispatchFromInputs = () => {
      const derived = AppStore.getDerived();
      const hours = (parseInt(hoursInput.value) || 0) % 24;
      const minutes = (parseInt(minutesInput.value) || 0) % 60;
      AppStore.dispatch({ 
        type: 'SET_LUNAR_DATETIME', 
        year: derived.year,
        month: (derived.currentMonthIndex ?? 0) + 1,
        day: derived.currentLunarDay ?? 1,
        time: { hours, minutes } 
      });
    };
    
    hoursInput.addEventListener('blur', dispatchFromInputs);
    minutesInput.addEventListener('blur', dispatchFromInputs);
    hoursInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') dispatchFromInputs(); });
    minutesInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') dispatchFromInputs(); });
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
    
    // Center the picker on screen
    picker.style.top = '50%';
    picker.style.left = '50%';
    picker.style.transform = 'translate(-50%, -50%)';
    
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
      // Note: we don't know the new year's month count yet, use 12 as safe default
      // _lunarDateToJD will clamp if needed
      month = 12;
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
    // Fallback: astronomical year numbering
    if (year <= 0) return (1 - year) + ' BC';
    return year + ' AD';
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
    // Time is user-set, stored in context.time as { hours, minutes }
    if (context.time) {
      const { hours, minutes } = context.time;
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
  }
};

window.CalendarView = CalendarView;
if (typeof module !== 'undefined' && module.exports) module.exports = CalendarView;
