/**
 * EventsView - Historical events list and timeline
 * 
 * Integrates with historical-events.js for data and rendering
 */

const EventsView = {
  _unsubscribe: null,
  
  init() {
    console.log('[EventsView] init');
    // Subscribe to state changes
    this._unsubscribe = AppStore.subscribe((state) => {
      this._syncFiltersFromState(state);
    });
  },
  
  cleanup() {
    console.log('[EventsView] cleanup');
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  },
  
  _syncFiltersFromState(state) {
    // Sync filter UI elements with state (for URL changes, etc.)
    const searchInput = document.getElementById('events-search');
    const typeSelect = document.getElementById('events-type-filter');
    const eraSelect = document.getElementById('events-era-filter');
    
    if (searchInput && searchInput.value !== (state.ui.eventsSearch || '')) {
      searchInput.value = state.ui.eventsSearch || '';
    }
    if (typeSelect && typeSelect.value !== (state.ui.eventsType || 'all')) {
      typeSelect.value = state.ui.eventsType || 'all';
    }
    if (eraSelect && eraSelect.value !== (state.ui.eventsEra || 'all')) {
      eraSelect.value = state.ui.eventsEra || 'all';
    }
  },

  render(state, derived, container) {
    const profileName = window.PROFILES?.[state.context.profileId]?.name || 'Time-Tested';
    
    // Get initial filter values from state
    const eventsSearch = state.ui.eventsSearch || '';
    const eventsType = state.ui.eventsType || 'all';
    const eventsEra = state.ui.eventsEra || 'all';
    const eventsViewMode = state.ui.eventsViewMode || 'list';
    
    // Helper to mark selected option
    const sel = (val, target) => val === target ? 'selected' : '';
    
    container.innerHTML = `
      <div class="events-page">
        <div class="events-header">
          <div class="events-header-inner">
            <h2>📜 Historical Events</h2>
            <button class="close-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'calendar'})" aria-label="Close">✕</button>
          </div>
        </div>
        <div class="events-page-content">
          <div class="events-intro">
            <p>Explore key historical events across 7,000 years of biblical history. Events are displayed according to your current calendar profile, showing how different calendar interpretations affect the dating of historical events.</p>
            <div class="events-profile-context">
              <span class="events-profile-label">Current Profile:</span>
              <span id="events-profile-name" class="events-profile-value">${profileName}</span>
              <button class="events-profile-change-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'settings'})">Change</button>
            </div>
          </div>
          
          <div class="events-controls">
            <div class="events-filter-row">
              <div class="events-filter-group">
                <label for="events-type-filter">Type:</label>
                <select id="events-type-filter" onchange="EventsView.onFilterChange()">
                  <option value="all" ${sel(eventsType, 'all')}>All Events</option>
                  <option value="milestone" ${sel(eventsType, 'milestone')}>Milestones</option>
                  <option value="reign" ${sel(eventsType, 'reign')}>Reigns</option>
                  <option value="construction" ${sel(eventsType, 'construction')}>Construction</option>
                  <option value="feast" ${sel(eventsType, 'feast')}>Feasts</option>
                  <option value="death" ${sel(eventsType, 'death')}>Deaths</option>
                  <option value="conquest" ${sel(eventsType, 'conquest')}>Conquests</option>
                  <option value="prophecy" ${sel(eventsType, 'prophecy')}>Prophecies</option>
                  <option value="astronomical" ${sel(eventsType, 'astronomical')}>Astronomical</option>
                  <option value="destruction" ${sel(eventsType, 'destruction')}>Destructions</option>
                </select>
              </div>
              <div class="events-filter-group">
                <label for="events-era-filter">Era:</label>
                <select id="events-era-filter" onchange="EventsView.onFilterChange()">
                  <option value="all" ${sel(eventsEra, 'all')}>All Eras</option>
                  <option value="creation" ${sel(eventsEra, 'creation')}>Creation - Flood</option>
                  <option value="patriarchs" ${sel(eventsEra, 'patriarchs')}>Patriarchs</option>
                  <option value="exodus" ${sel(eventsEra, 'exodus')}>Exodus - Judges</option>
                  <option value="monarchy" ${sel(eventsEra, 'monarchy')}>United Monarchy</option>
                  <option value="divided" ${sel(eventsEra, 'divided')}>Divided Kingdom</option>
                  <option value="exile" ${sel(eventsEra, 'exile')}>Exile - Return</option>
                  <option value="second-temple" ${sel(eventsEra, 'second-temple')}>Second Temple</option>
                  <option value="roman" ${sel(eventsEra, 'roman')}>Roman Period</option>
                </select>
              </div>
              <div class="events-filter-group">
                <label for="events-search">Search:</label>
                <input type="text" id="events-search" placeholder="Search events..." 
                       value="${eventsSearch}" oninput="EventsView.onSearchInput(this.value)">
              </div>
            </div>
          </div>
          
          <div class="events-timeline-toggle">
            <button id="events-list-btn" class="events-view-btn ${eventsViewMode === 'list' ? 'active' : ''}" onclick="EventsView.setView('list')">List View</button>
            <button id="events-timeline-btn" class="events-view-btn ${eventsViewMode === 'timeline' ? 'active' : ''}" onclick="EventsView.setView('timeline')">Timeline View</button>
          </div>
          
          <div id="events-list-container" class="events-list-container" style="${eventsViewMode === 'list' ? '' : 'display:none'}">
            <div class="events-loading">Loading historical events...</div>
          </div>
          
          <div id="events-timeline-container" class="events-timeline-container" style="${eventsViewMode === 'timeline' ? '' : 'display:none'}">
            <div class="events-timeline-loading">Loading timeline...</div>
          </div>
        </div>
      </div>
      
      <!-- Event Detail Modal -->
      <div id="event-detail-overlay" class="event-detail-overlay">
        <div class="event-detail-modal">
          <div class="event-detail-header">
            <h3 id="event-detail-title">Event Title</h3>
            <button class="event-detail-close" onclick="EventsView.closeEventDetail()">✕</button>
          </div>
          <div id="event-detail-content" class="event-detail-content">
            <!-- Populated by JavaScript -->
          </div>
        </div>
      </div>
    `;
    
    // Load and render events
    this.loadAndRenderEvents(eventsViewMode);
  },
  
  async loadAndRenderEvents(viewMode) {
    // Use the existing loadHistoricalEvents from historical-events.js
    if (typeof loadHistoricalEvents === 'function') {
      await loadHistoricalEvents();
    }
    
    // Render based on view mode from state
    if (viewMode === 'timeline') {
      this.renderEventsTimeline();
    } else {
      this.renderEventsList();
    }
  },
  
  // Called when dropdown filters change
  onFilterChange() {
    const typeFilter = document.getElementById('events-type-filter')?.value || 'all';
    const eraFilter = document.getElementById('events-era-filter')?.value || 'all';
    const searchText = document.getElementById('events-search')?.value || '';
    
    AppStore.dispatch({
      type: 'SET_EVENTS_FILTER',
      eventsType: typeFilter,
      era: eraFilter,
      search: searchText || null
    });
    
    this.rerenderList();
  },
  
  // Called on search input (with debounce consideration)
  _searchTimeout: null,
  onSearchInput(value) {
    // Debounce search to avoid too many URL updates
    clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(() => {
      const typeFilter = document.getElementById('events-type-filter')?.value || 'all';
      const eraFilter = document.getElementById('events-era-filter')?.value || 'all';
      
      AppStore.dispatch({
        type: 'SET_EVENTS_FILTER',
        search: value || null,
        eventsType: typeFilter,
        era: eraFilter
      });
      
      this.rerenderList();
    }, 300);
  },
  
  rerenderList() {
    const state = AppStore.getState();
    const viewMode = state.ui.eventsViewMode || 'list';
    if (viewMode === 'timeline') {
      this.renderEventsTimeline();
    } else {
      this.renderEventsList();
    }
  },
  
  setView(view) {
    AppStore.dispatch({
      type: 'SET_EVENTS_FILTER',
      viewMode: view
    });
    
    const listBtn = document.getElementById('events-list-btn');
    const timelineBtn = document.getElementById('events-timeline-btn');
    const listContainer = document.getElementById('events-list-container');
    const timelineContainer = document.getElementById('events-timeline-container');
    
    if (view === 'list') {
      listBtn?.classList.add('active');
      timelineBtn?.classList.remove('active');
      if (listContainer) listContainer.style.display = 'block';
      if (timelineContainer) timelineContainer.style.display = 'none';
      this.renderEventsList();
    } else {
      listBtn?.classList.remove('active');
      timelineBtn?.classList.add('active');
      if (listContainer) listContainer.style.display = 'none';
      if (timelineContainer) timelineContainer.style.display = 'block';
      this.renderEventsTimeline();
    }
  },
  
  // Get filtered events based on current filter settings
  getFilteredEvents(events) {
    const typeFilter = document.getElementById('events-type-filter')?.value || 'all';
    const eraFilter = document.getElementById('events-era-filter')?.value || 'all';
    const searchText = (document.getElementById('events-search')?.value || '').toLowerCase().trim();
    
    return events.filter(event => {
      // Type filter
      if (typeFilter !== 'all' && event.type !== typeFilter) {
        return false;
      }
      
      // Era filter
      if (eraFilter !== 'all') {
        const eventEra = this.getEventEra(event);
        if (eventEra !== eraFilter) {
          return false;
        }
      }
      
      // Search filter
      if (searchText) {
        const searchableText = [
          event.title,
          event.description,
          ...(event.tags || []),
          ...(event.sources || []).map(s => s.ref)
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(searchText)) {
          return false;
        }
      }
      
      return true;
    });
  },
  
  // Determine era for an event
  getEventEra(event) {
    let year = null;
    
    // Check lunar.year first (biblical events), then gregorian.year, then anno_mundi
    if (event.dates?.lunar?.year !== undefined) {
      year = event.dates.lunar.year;
    } else if (event.dates?.gregorian?.year !== undefined) {
      year = event.dates.gregorian.year;
    } else if (event.dates?.anno_mundi?.year) {
      year = event.dates.anno_mundi.year - 4000;
    } else if (event.start?.lunar?.year !== undefined) {
      year = event.start.lunar.year;
    } else if (event.start?.gregorian?.year !== undefined) {
      year = event.start.gregorian.year;
    }
    
    if (year === null) return 'unknown';
    
    if (year <= -2300) return 'creation';
    if (year <= -1700) return 'patriarchs';
    if (year <= -1000) return 'exodus';
    if (year <= -930) return 'monarchy';
    if (year <= -586) return 'divided';
    if (year <= -400) return 'exile';
    if (year <= 70) return 'second-temple';
    return 'roman';
  },
  
  getEraDisplayName(era) {
    const names = {
      'creation': 'Creation to Flood',
      'patriarchs': 'Patriarchs',
      'exodus': 'Exodus to Judges',
      'monarchy': 'United Monarchy',
      'divided': 'Divided Kingdom',
      'exile': 'Exile & Return',
      'second-temple': 'Second Temple Period',
      'roman': 'Roman Period',
      'unknown': 'Date Unknown'
    };
    return names[era] || era;
  },
  
  getTypeIcon(type) {
    const icons = {
      'milestone': '🏛️',
      'reign': '👑',
      'construction': '🏗️',
      'feast': '🎺',
      'death': '⚰️',
      'birth': '👶',
      'conquest': '⚔️',
      'siege': '🛡️',
      'prophecy': '📜',
      'astronomical': '🌙',
      'destruction': '🔥',
      'ministry': '📖',
      'decree': '📋',
      'battle': '⚔️',
      'catastrophe': '🌊'
    };
    return icons[type] || '📌';
  },
  
  formatYear(year) {
    if (year === null || year === undefined) return '—';
    // JSON now uses astronomical years directly (-1445 = 1446 BC)
    if (typeof YearUtils !== 'undefined') {
      return YearUtils.format(year);
    }
    // Fallback: astronomical year numbering
    if (year <= 0) {
      return `${1 - year} BC`;
    } else {
      return `${year} AD`;
    }
  },
  
  formatLunarDate(lunar) {
    if (!lunar) return '—';
    
    const monthNames = [
      'Nisan', 'Iyyar', 'Sivan', 'Tammuz', 'Av', 'Elul',
      'Tishri', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar'
    ];
    
    const hasMonth = lunar.month !== null && lunar.month !== undefined;
    const hasDay = lunar.day !== null && lunar.day !== undefined;
    const hasYear = lunar.year !== null && lunar.year !== undefined;
    
    if (!hasMonth && !hasDay && !hasYear) return '—';
    
    const parts = [];
    if (hasMonth) {
      const monthName = monthNames[lunar.month - 1] || `Month ${lunar.month}`;
      parts.push(monthName);
    }
    if (hasDay) {
      parts.push(`Day ${lunar.day}`);
    }
    if (hasYear) {
      parts.push(this.formatYear(lunar.year));
    }
    
    return parts.length > 0 ? parts.join(', ') : '—';
  },
  
  formatGregorianDate(gregorian) {
    if (!gregorian) return '—';
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const hasYear = gregorian.year !== null && gregorian.year !== undefined;
    const hasMonth = gregorian.month !== null && gregorian.month !== undefined;
    const hasDay = gregorian.day !== null && gregorian.day !== undefined;
    
    if (!hasYear && !hasMonth && !hasDay) return '—';
    
    const parts = [];
    if (hasMonth) {
      parts.push(monthNames[gregorian.month - 1]);
    }
    if (hasDay) {
      parts.push(hasMonth ? `${gregorian.day},` : gregorian.day);
    }
    if (hasYear) {
      parts.push(this.formatYear(gregorian.year));
    }
    
    return parts.join(' ');
  },
  
  // Format a combined date from lunar and gregorian info
  // Returns { display: "Nisan 15, 1447 BC", lunarMonth, lunarDay, year }
  formatCombinedDate(dates) {
    if (!dates) return { display: '—' };
    
    const lunar = dates.lunar || {};
    const gregorian = dates.gregorian || {};
    
    const lunarMonthNames = [
      'Nisan', 'Iyyar', 'Sivan', 'Tammuz', 'Av', 'Elul',
      'Tishri', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar'
    ];
    
    const hasLunarMonth = lunar.month !== null && lunar.month !== undefined;
    const hasLunarDay = lunar.day !== null && lunar.day !== undefined;
    const hasYear = (lunar.year !== null && lunar.year !== undefined) || 
                   (gregorian.year !== null && gregorian.year !== undefined);
    
    // Use lunar year if available, otherwise gregorian
    const year = lunar.year ?? gregorian.year;
    const lunarMonth = hasLunarMonth ? lunar.month : null;
    const lunarDay = hasLunarDay ? lunar.day : null;
    
    const parts = [];
    
    if (hasLunarMonth) {
      parts.push(lunarMonthNames[lunar.month - 1] || `Month ${lunar.month}`);
    }
    if (hasLunarDay) {
      parts.push(lunar.day);
    }
    if (hasYear) {
      if (parts.length > 0) parts.push(',');
      parts.push(this.formatYear(year));
    }
    
    if (parts.length === 0) return { display: '—' };
    
    // Clean up comma placement
    let display = parts.join(' ').replace(' ,', ',');
    
    return { display, lunarMonth, lunarDay, year };
  },
  
  // Navigate to a specific date in the calendar
  navigateToDate(year, lunarMonth, lunarDay) {
    // Build the URL path for the calendar
    // Year from JSON is now in astronomical format (-1445 = 1446 BC)
    if (year !== null && year !== undefined) {
      const state = AppStore.getState();
      const profileSlug = state.context.profileId || 'time-tested';
      
      let url = `/${profileSlug}`;
      
      // Get location slug from coordinates (URL should always show pretty name)
      const locationSlug = URLRouter._getLocationSlug(state.context.location);
      url += '/' + locationSlug;
      
      // Year is already astronomical, just format for URL
      if (typeof YearUtils !== 'undefined') {
        url += '/' + YearUtils.formatForURL(year);
      } else {
        // Fallback: astronomical year numbering
        if (year <= 0) {
          url += '/' + (1 - year) + 'bc';
        } else {
          url += '/' + year;
        }
      }
      
      // Add lunar month and day if available
      if (lunarMonth) {
        url += '/' + lunarMonth;
        if (lunarDay) {
          url += '/' + lunarDay;
        }
      }
      
      // Navigate
      window.location.href = url;
    }
  },
  
  getEventSortKey(event) {
    // Check lunar.year first (biblical events), then gregorian, then anno_mundi
    if (event.dates?.lunar?.year !== undefined) {
      const year = event.dates.lunar.year;
      const month = event.dates.lunar.month || 1;
      const day = event.dates.lunar.day || 1;
      return year * 10000 + month * 100 + day;
    }
    if (event.dates?.gregorian?.year !== undefined) {
      const year = event.dates.gregorian.year;
      const month = event.dates.gregorian.month || 1;
      const day = event.dates.gregorian.day || 1;
      return year * 10000 + month * 100 + day;
    }
    if (event.start?.lunar?.year !== undefined) {
      const year = event.start.lunar.year;
      const month = event.start.lunar.month || 1;
      const day = event.start.lunar.day || 1;
      return year * 10000 + month * 100 + day;
    }
    if (event.start?.gregorian?.year !== undefined) {
      const year = event.start.gregorian.year;
      const month = event.start.gregorian.month || 1;
      const day = event.start.gregorian.day || 1;
      return year * 10000 + month * 100 + day;
    }
    if (event.dates?.anno_mundi?.year) {
      return (event.dates.anno_mundi.year - 4000) * 10000;
    }
    return 999999999;
  },
  
  renderEventCard(event) {
    const typeIcon = this.getTypeIcon(event.type);
    const dates = event.dates || event.start || {};
    const dateInfo = this.formatCombinedDate(dates);
    
    const tagsHtml = (event.tags || []).slice(0, 4).map(tag => 
      `<span class="event-tag">${tag}</span>`
    ).join('');
    
    // Build calendar link data
    const canNavigate = dateInfo.year !== null && dateInfo.year !== undefined;
    const calendarData = canNavigate ? 
      `data-year="${dateInfo.year}" data-month="${dateInfo.lunarMonth || ''}" data-day="${dateInfo.lunarDay || ''}"` : '';
    
    return `
      <div class="event-card" onclick="EventsView.openEventDetail('${event.id}')">
        <div class="event-card-header">
          <h4 class="event-card-title">${typeIcon} ${event.title}</h4>
          <span class="event-card-type">${event.type || 'event'}</span>
        </div>
        ${dateInfo.display !== '—' ? `
        <div class="event-card-date">
          <span class="event-date-value">${dateInfo.display}</span>
          ${canNavigate ? `
          <button class="event-calendar-btn" ${calendarData} 
                  onclick="event.stopPropagation(); EventsView.navigateToDate(${dateInfo.year}, ${dateInfo.lunarMonth || 'null'}, ${dateInfo.lunarDay || 'null'})"
                  title="View in calendar">📅</button>
          ` : ''}
        </div>
        ` : ''}
        <p class="event-card-desc">${event.description || ''}</p>
        ${tagsHtml ? `<div class="event-card-tags">${tagsHtml}</div>` : ''}
      </div>
    `;
  },
  
  async renderEventsList() {
    const container = document.getElementById('events-list-container');
    if (!container) return;
    
    // Try to use existing historicalEventsData or load it
    let data = window.historicalEventsData;
    if (!data && typeof loadHistoricalEvents === 'function') {
      data = await loadHistoricalEvents();
    }
    
    if (!data) {
      container.innerHTML = '<div class="events-loading">Failed to load events.</div>';
      return;
    }
    
    const allEvents = [...(data.events || [])];
    const filteredEvents = this.getFilteredEvents(allEvents);
    
    if (filteredEvents.length === 0) {
      container.innerHTML = '<div class="events-no-results">No events match your filters.</div>';
      return;
    }
    
    filteredEvents.sort((a, b) => this.getEventSortKey(a) - this.getEventSortKey(b));
    
    const eventsByEra = {};
    const eraOrder = ['creation', 'patriarchs', 'exodus', 'monarchy', 'divided', 'exile', 'second-temple', 'roman', 'unknown'];
    
    filteredEvents.forEach(event => {
      const era = this.getEventEra(event);
      if (!eventsByEra[era]) {
        eventsByEra[era] = [];
      }
      eventsByEra[era].push(event);
    });
    
    let html = '';
    
    eraOrder.forEach(era => {
      const events = eventsByEra[era];
      if (!events || events.length === 0) return;
      
      html += `
        <div class="events-era-group">
          <h3 class="events-era-header">
            ${this.getEraDisplayName(era)}
            <span class="events-era-count">${events.length}</span>
          </h3>
          ${events.map(e => this.renderEventCard(e)).join('')}
        </div>
      `;
    });
    
    container.innerHTML = html;
  },
  
  async renderEventsTimeline() {
    const container = document.getElementById('events-timeline-container');
    if (!container) return;
    
    let data = window.historicalEventsData;
    if (!data && typeof loadHistoricalEvents === 'function') {
      data = await loadHistoricalEvents();
    }
    
    if (!data) {
      container.innerHTML = '<div class="events-timeline-loading">Failed to load timeline.</div>';
      return;
    }
    
    const filteredEvents = this.getFilteredEvents(data.events || []);
    
    if (filteredEvents.length === 0) {
      container.innerHTML = '<div class="events-no-results">No events match your filters.</div>';
      return;
    }
    
    filteredEvents.sort((a, b) => this.getEventSortKey(a) - this.getEventSortKey(b));
    
    let html = `
      <style>
        .timeline-simple {
          position: relative;
          padding-left: 100px;
        }
        .timeline-simple::before {
          content: '';
          position: absolute;
          left: 80px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: rgba(126, 200, 227, 0.3);
        }
        .timeline-item {
          position: relative;
          padding: 12px 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .timeline-item:hover .timeline-content {
          background: rgba(126, 200, 227, 0.1);
        }
        .timeline-year {
          position: absolute;
          left: -100px;
          width: 80px;
          text-align: right;
          color: #d4a017;
          font-size: 0.85em;
          font-weight: 500;
        }
        .timeline-marker {
          position: absolute;
          left: -24px;
          width: 10px;
          height: 10px;
          background: #7ec8e3;
          border-radius: 50%;
          border: 2px solid #1a3a5c;
        }
        .timeline-content {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 8px;
          transition: background 0.2s;
        }
        .timeline-icon {
          font-size: 1.1em;
        }
        .timeline-title {
          color: #eee;
          font-size: 0.95em;
        }
      </style>
      <div class="timeline-simple">
    `;
    
    filteredEvents.forEach(event => {
      // Get year from lunar first, then gregorian
      const year = event.dates?.lunar?.year ?? event.dates?.gregorian?.year ?? 
                   event.start?.lunar?.year ?? event.start?.gregorian?.year;
      const yearDisplay = year !== undefined ? this.formatYear(year) : '—';
      const icon = this.getTypeIcon(event.type);
      
      html += `
        <div class="timeline-item" onclick="EventsView.openEventDetail('${event.id}')">
          <div class="timeline-year">${yearDisplay}</div>
          <div class="timeline-marker"></div>
          <div class="timeline-content">
            <span class="timeline-icon">${icon}</span>
            <span class="timeline-title">${event.title}</span>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
  },
  
  async openEventDetail(eventId) {
    let data = window.historicalEventsData;
    if (!data && typeof loadHistoricalEvents === 'function') {
      data = await loadHistoricalEvents();
    }
    
    const event = data?.events?.find(e => e.id === eventId);
    if (!event) {
      console.warn('Event not found:', eventId);
      return;
    }
    
    const overlay = document.getElementById('event-detail-overlay');
    const titleEl = document.getElementById('event-detail-title');
    const contentEl = document.getElementById('event-detail-content');
    
    if (!overlay || !titleEl || !contentEl) return;
    
    const typeIcon = this.getTypeIcon(event.type);
    titleEl.innerHTML = `${typeIcon} ${event.title}`;
    
    const dates = event.dates || event.start || {};
    const dateInfo = this.formatCombinedDate(dates);
    const canNavigate = dateInfo.year !== null && dateInfo.year !== undefined;
    
    let html = `
      <div class="event-detail-section">
        <div class="event-detail-type">${event.type || 'event'}</div>
        
        ${dateInfo.display !== '—' ? `
        <div class="event-detail-date-row">
          <span class="event-detail-date-value">${dateInfo.display}</span>
          ${canNavigate ? `
          <button class="event-calendar-btn large" 
                  onclick="EventsView.closeEventDetail(); EventsView.navigateToDate(${dateInfo.year}, ${dateInfo.lunarMonth || 'null'}, ${dateInfo.lunarDay || 'null'})"
                  title="View in calendar">📅 View in Calendar</button>
          ` : ''}
        </div>
        ` : ''}
        
        ${event.description ? `
        <div class="event-detail-description">
          <h4>Description</h4>
          <p>${event.description}</p>
        </div>
        ` : ''}
        
        ${event.sources && event.sources.length > 0 ? `
        <div class="event-detail-sources">
          <h4>Sources</h4>
          <ul>
            ${event.sources.map(s => `<li>${s.ref}${s.note ? ` - ${s.note}` : ''}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        ${event.tags && event.tags.length > 0 ? `
        <div class="event-detail-tags">
          ${event.tags.map(tag => `<span class="event-tag">${tag}</span>`).join('')}
        </div>
        ` : ''}
      </div>
    `;
    
    contentEl.innerHTML = html;
    overlay.classList.add('visible');
    
    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        this.closeEventDetail();
      }
    };
  },
  
  closeEventDetail() {
    const overlay = document.getElementById('event-detail-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
    }
  }
};

// Make available globally
window.EventsView = EventsView;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventsView;
}
