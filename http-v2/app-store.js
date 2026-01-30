/**
 * AppStore - Central State Management
 * 
 * Single source of truth for the entire application.
 * All state changes flow through dispatch().
 * 
 * State Model:
 * - context: Shared context across all views (date, location, profile)
 * - content: Current view and view-specific params
 * - ui: Transient UI state (modals, pickers)
 */

const AppStore = {
  // ═══════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  _state: {
    // Context - shared across all views
    context: {
      today: null,              // Real current JD (ticks every minute)
      selectedDate: null,       // User-selected JD for viewing (legacy, for compatibility)
      selectedLunarDate: null,  // User-selected lunar date { year, month, day } - SOURCE OF TRUTH
      location: { lat: 31.7683, lon: 35.2137 },  // GPS coordinates (source of truth) - Default: Jerusalem
      profileId: 'timeTested'   // Active profile ID
    },
    
    // Content - which view is displayed
    content: {
      view: 'calendar',         // Current view name
      params: {}                // View-specific parameters
    },
    
    // UI - transient state
    ui: {
      strongsId: null,          // Open Strongs modal (e.g., 'H430')
      searchQuery: null,        // Search query string
      personId: null,           // Open person card
      interlinearVerse: null,   // Open interlinear for verse (e.g., 5)
      timelineEventId: null,    // Selected timeline event ID
      timelineDurationId: null, // Selected timeline duration ID
      eventsSearch: null,       // Events page search query
      eventsType: 'all',        // Events page type filter
      eventsEra: 'all',         // Events page era filter
      eventsViewMode: 'list',   // Events page view mode (list/timeline)
      menuOpen: false,          // Mobile menu state
      profilePickerOpen: false,
      locationPickerOpen: false,
      yearPickerOpen: false,
      monthPickerOpen: false,
      timePickerOpen: false
    },
    
    // Bible navigation history (for PWA/desktop where browser history may not work)
    bibleHistory: {
      entries: [],              // Array of {book, chapter, verse} entries
      index: -1                 // Current position in history
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // DERIVED STATE (computed from context)
  // ═══════════════════════════════════════════════════════════════════════
  
  _derived: {
    config: null,               // Resolved profile configuration
    lunarMonths: [],            // Generated calendar months for current year
    calendarLocation: null,     // Location used to generate current calendar
    currentMonthIndex: 0,       // Index of month containing selectedDate
    currentLunarDay: 1,         // Lunar day (1-30) for selectedDate
    todayMonthIndex: 0,         // Index of month containing today
    todayLunarDay: 1,           // Lunar day for today
    year: null                  // Gregorian year from selectedDate
  },
  
  _listeners: new Set(),
  _engine: null,                // LunarCalendarEngine instance
  _initialized: false,
  _urlSyncEnabled: false,       // Start disabled, enable after INIT_FROM_URL
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Get a read-only copy of the current state
   */
  getState() {
    return structuredClone(this._state);
  },
  
  /**
   * Get a read-only copy of derived state
   */
  getDerived() {
    return structuredClone(this._derived);
  },
  
  /**
   * Get today's date/time as a SET_GREGORIAN_DATETIME event
   * Uses LOCAL date (not UTC) since user cares about their local "today"
   */
  getTodayEvent() {
    const now = new Date();
    return {
      type: 'SET_GREGORIAN_DATETIME',
      year: now.getFullYear(),
      month: now.getMonth() + 1,  // 1-based
      day: now.getDate(),
      hours: now.getHours(),
      minutes: now.getMinutes()
    };
  },
  
  /**
   * Dispatch an event to update state
   * @param {Object} event - Event with type and payload
   */
  dispatch(event) {
    if (window.DEBUG_STORE) {
      console.log('[AppStore] dispatch:', event.type, event);
    }
    
    const changed = this._reduce(event);
    
    if (changed) {
      this._recomputeDerived();
      
      if (this._urlSyncEnabled) {
        this._syncURL(event);
      }
      
      this._notify();
    }
  },
  
  /**
   * Dispatch multiple events atomically (single recompute/notify)
   * @param {Array} events - Array of events
   */
  dispatchBatch(events) {
    console.log('[AppStore] dispatchBatch:', events.map(e => e.type));
    let anyChanged = false;
    
    for (const event of events) {
      console.log('[AppStore] batch reduce:', event.type);
      if (this._reduce(event)) {
        anyChanged = true;
      }
    }
    
    console.log('[AppStore] anyChanged:', anyChanged, 'urlSyncEnabled:', this._urlSyncEnabled);
    
    if (anyChanged) {
      this._recomputeDerived();
      if (this._urlSyncEnabled) {
        console.log('[AppStore] calling _syncURL');
        this._syncURL(events[events.length - 1]);
      }
      this._notify();
    }
  },
  
  /**
   * Subscribe to state changes
   * @param {Function} listener - Called with (state, derived) on changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },
  
  /**
   * Initialize the store
   * @param {Object} options - { astroEngine, profiles }
   */
  init(options = {}) {
    if (this._initialized) return;
    
    this._astroEngine = options.astroEngine || window.astroEngine;
    this._profiles = options.profiles || window.PROFILES || {};
    
    // Set today using UTC (calendar data is in UTC)
    this._state.context.today = this._dateToJulian(new Date());
    this._state.context.selectedDate = this._state.context.today;
    
    // Start clock tick (update "today" every minute)
    setInterval(() => {
      this.dispatch({ type: 'SET_TODAY', jd: this._dateToJulian(new Date()) });
    }, 60000);
    
    this._initialized = true;
    
    // Initial computation
    this._recomputeDerived();
    
    // Auto-detect user location (GPS > localStorage > IP) for empty URL
    this._initUserLocation();
  },
  
  /**
   * Detect user's location: GPS (if granted) > localStorage > IP geolocation
   * Only runs on empty/root URL - doesn't override URL-specified locations
   */
  async _initUserLocation() {
    // Check if URL explicitly specifies a location (has city slug or coords after profile)
    const parts = window.location.pathname.split('/').filter(Boolean);
    // parts[0] = profile, parts[1] = location (if present)
    // If we have at least 2 parts and parts[1] is a city or coords, don't override
    const hasUrlLocation = parts.length >= 2 && (
      URLRouter?.CITY_SLUGS?.[parts[1]] || 
      /^\d+\.\d+,-?\d+\.\d+$/.test(parts[1])
    );
    if (hasUrlLocation) {
      console.log('[AppStore] URL has explicit location, skipping auto-detect');
      return;
    }
    
    // Track if we're on root URL (need to update URL after location detected)
    const isRootURL = parts.length === 0;
    
    // Helper to set location and sync URL
    const setLocationAndSync = (lat, lon) => {
      this.dispatch({ type: 'SET_LOCATION', lat, lon });
      // For root URL, force URL update to reflect current state
      if (isRootURL && window.URLRouter) {
        // Wait for URL sync to be enabled, then replace URL
        setTimeout(() => {
          window.URLRouter.syncURL(this._state, this._derived, false); // replace, not push
          console.log('[AppStore] URL updated to reflect detected location');
        }, 100);
      }
    };
    
    // 1. Try GPS if user has previously granted permission
    const gpsLocation = await this._tryGPSLocation();
    if (gpsLocation) {
      console.log('[AppStore] Location from GPS:', gpsLocation.lat, gpsLocation.lon);
      setLocationAndSync(gpsLocation.lat, gpsLocation.lon);
      localStorage.setItem('userLocation', JSON.stringify(gpsLocation));
      localStorage.setItem('userLocationSource', 'gps');
      return;
    }
    
    // 2. Check localStorage for saved location (only if it was from GPS)
    const savedSource = localStorage.getItem('userLocationSource');
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation && savedSource === 'gps') {
      try {
        const loc = JSON.parse(savedLocation);
        if (loc.lat && loc.lon) {
          console.log('[AppStore] Location from localStorage (GPS):', loc.lat, loc.lon);
          setLocationAndSync(loc.lat, loc.lon);
          return;
        }
      } catch (e) {
        // Invalid saved location, continue to IP lookup
      }
    }
    
    // 3. Fall back to IP geolocation
    try {
      // Use ip-api.com (free, no API key needed, allows CORS)
      const response = await fetch('http://ip-api.com/json/?fields=lat,lon,city,country');
      if (response.ok) {
        const data = await response.json();
        if (data.lat && data.lon) {
          console.log('[AppStore] Location from IP:', data.city, data.country, data.lat, data.lon);
          setLocationAndSync(data.lat, data.lon);
          // Save for next time (but mark as IP-based)
          localStorage.setItem('userLocation', JSON.stringify({ lat: data.lat, lon: data.lon }));
          localStorage.setItem('userLocationSource', 'ip');
        }
      }
    } catch (e) {
      console.log('[AppStore] Could not get location from IP, using default');
      // For root URL, still sync to show default location in URL
      if (isRootURL && window.URLRouter) {
        setTimeout(() => {
          window.URLRouter.syncURL(this._state, this._derived, false);
        }, 100);
      }
    }
  },
  
  /**
   * Try to get GPS location (only if permission was previously granted)
   * Returns null if not available or permission not granted
   */
  async _tryGPSLocation() {
    if (!navigator.geolocation) return null;
    
    // Check if we have permission (without prompting)
    try {
      const permission = await navigator.permissions?.query({ name: 'geolocation' });
      if (permission?.state !== 'granted') {
        // Don't have permission, don't prompt on load
        return null;
      }
    } catch (e) {
      // permissions API not supported, try anyway but with short timeout
    }
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 3000); // 3s timeout
      
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeout);
          resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        (err) => {
          clearTimeout(timeout);
          console.log('[AppStore] GPS error:', err.message);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 } // 5 min cache OK
      );
    });
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // REDUCER - All state changes happen here
  // ═══════════════════════════════════════════════════════════════════════
  
  _reduce(event) {
    const s = this._state;
    
    switch (event.type) {
      // ─── Context Events ───
      case 'SET_TODAY':
        if (s.context.today === event.jd) return false;
        s.context.today = event.jd;
        return true;
        
      case 'SET_SELECTED_DATE':
        console.log('[AppStore] SET_SELECTED_DATE:', { 
          eventJd: event.jd, 
          currentJd: s.context.selectedDate,
          eventTime: event.time 
        });
        let changed = false;
        if (event.jd !== undefined && s.context.selectedDate !== event.jd) {
          s.context.selectedDate = event.jd;
          changed = true;
          console.log('[AppStore] selectedDate updated to:', event.jd);
        }
        // Optionally update time as well
        if (event.time !== undefined) {
          s.context.time = event.time;
          changed = true;
        }
        return changed;
        
      case 'SET_YEAR':
        // Update selectedDate to same month/day in new year
        // Note: Must use setUTCFullYear for negative years (Date.UTC doesn't handle them)
        const current = this._julianToGregorian(s.context.selectedDate);
        let newDate = new Date(Date.UTC(2000, current.month - 1, current.day, 12));
        newDate.setUTCFullYear(event.year);
        s.context.selectedDate = this._dateToJulian(newDate);
        return true;
        
      case 'SET_LUNAR_DATETIME':
        // Navigate to a specific lunar date (year, month, day) with optional time
        // selectedLunarDate is THE source of truth - selectedDate (JD) is computed from it
        const lunarYear = event.year;
        const lunarMonth = event.month ?? 1;  // 1-based (Nisan = 1)
        const lunarDay = event.day ?? 1;
        
        const newLunarDate = { year: lunarYear, month: lunarMonth, day: lunarDay };
        const oldLunarDate = s.context.selectedLunarDate;
        
        let lunarChanged = false;
        if (!oldLunarDate || 
            oldLunarDate.year !== lunarYear || 
            oldLunarDate.month !== lunarMonth || 
            oldLunarDate.day !== lunarDay) {
          s.context.selectedLunarDate = newLunarDate;
          lunarChanged = true;
          // selectedDate (JD) will be computed in _recomputeDerived after calendar generation
        }
        if (event.time !== undefined) {
          s.context.time = event.time;
          lunarChanged = true;
        }
        return lunarChanged;
        
      case 'SET_GREGORIAN_DATETIME':
        // Set date/time from Gregorian date (used for "Today" button only)
        // This is the ONE case where we start from Gregorian and compute lunar
        // Accepts: { date: Date } or { year, month, day, hours, minutes }
        let gregDate;
        if (event.date instanceof Date) {
          gregDate = event.date;
        } else if (event.year !== undefined) {
          let d = new Date(Date.UTC(2000, (event.month ?? 1) - 1, event.day ?? 1, event.hours ?? 12, event.minutes ?? 0));
          d.setUTCFullYear(event.year);  // Handle negative years properly
          gregDate = d;
        } else {
          return false;
        }
        
        const gregJD = this._dateToJulian(gregDate);
        let gregChanged = false;
        if (gregJD !== s.context.selectedDate) {
          s.context.selectedDate = gregJD;
          // Clear selectedLunarDate - it will be computed from JD in _recomputeDerived
          s.context.selectedLunarDate = null;
          gregChanged = true;
        }
        const currentTime = s.context.time || { hours: 12, minutes: 0 };
        if (event.time !== undefined) {
          if (currentTime.hours !== event.time.hours || 
              currentTime.minutes !== event.time.minutes) {
            s.context.time = event.time;
            gregChanged = true;
          }
        } else if (event.hours !== undefined || event.date instanceof Date) {
          // Extract time from the date or event
          const hours = event.hours ?? (event.date ? event.date.getHours() : 12);
          const minutes = event.minutes ?? (event.date ? event.date.getMinutes() : 0);
          if (currentTime.hours !== hours || currentTime.minutes !== minutes) {
            s.context.time = { hours, minutes };
            gregChanged = true;
          }
        }
        return gregChanged;
        
      case 'SET_TIME':
        s.context.time = event.time;
        return true;
        
      case 'SET_LOCATION': {
        // Accept coordinates: { location: {lat, lon} } or { lat, lon }
        const newLoc = event.location || { lat: event.lat, lon: event.lon };
        if (s.context.location.lat === newLoc.lat && 
            s.context.location.lon === newLoc.lon) return false;
        s.context.location = newLoc;
        return true;
      }
        
      case 'SET_PROFILE':
        if (s.context.profileId === event.profileId) return false;
        s.context.profileId = event.profileId;
        return true;
        
      case 'GO_TO_TODAY': {
        // Set date to today and time to current moment
        // Clear selectedLunarDate so the calendar uses today's JD
        const now = new Date();
        s.context.selectedDate = s.context.today;
        s.context.selectedLunarDate = null;  // Clear so JD-based lookup is used
        s.context.time = { hours: now.getHours(), minutes: now.getMinutes() };
        return true;
      }
      
      // ─── Content Events ───
      case 'SET_VIEW':
        s.content.view = event.view;
        // Replace params entirely when switching views (don't merge old params)
        s.content.params = event.params || {};
        return true;
        
      case 'UPDATE_VIEW_PARAMS':
        s.content.params = { ...s.content.params, ...event.params };
        return true;
      
      case 'SET_BIBLE_LOCATION': {
        // Update Bible location and add to history
        const newLoc = {
          translation: event.translation,
          book: event.book,
          chapter: event.chapter,
          verse: event.verse || null
        };
        
        // Update content params
        s.content.params = { ...s.content.params, ...newLoc };
        
        // Add to Bible history (unless navigating via back/forward)
        if (!event._fromHistory) {
          const h = s.bibleHistory;
          const current = h.entries[h.index];
          const isSame = current && 
            current.book === newLoc.book && 
            current.chapter === newLoc.chapter &&
            current.verse === newLoc.verse;
          
          if (!isSame) {
            // Truncate forward history
            if (h.index < h.entries.length - 1) {
              h.entries = h.entries.slice(0, h.index + 1);
            }
            h.entries.push(newLoc);
            h.index = h.entries.length - 1;
          }
        }
        
        // Update the lastRenderedParams in BibleView to prevent double navigation
        if (typeof BibleView !== 'undefined') {
          BibleView.lastRenderedParams = `${event.book}-${event.chapter}-${event.verse}-${event.translation}`;
        }
        return true;
      }
        
      case 'BIBLE_GO_BACK': {
        if (s.bibleHistory.index > 0) {
          s.bibleHistory.index--;
          const loc = s.bibleHistory.entries[s.bibleHistory.index];
          s.content.params = { ...s.content.params, ...loc };
          // Mark as from history to avoid re-adding
          if (typeof BibleView !== 'undefined') {
            BibleView.lastRenderedParams = null; // Force re-render
          }
          return true;
        }
        return false;
      }
        
      case 'BIBLE_GO_FORWARD': {
        if (s.bibleHistory.index < s.bibleHistory.entries.length - 1) {
          s.bibleHistory.index++;
          const loc = s.bibleHistory.entries[s.bibleHistory.index];
          s.content.params = { ...s.content.params, ...loc };
          if (typeof BibleView !== 'undefined') {
            BibleView.lastRenderedParams = null; // Force re-render
          }
          return true;
        }
        return false;
      }
        
      case 'PREV_MONTH':
        s.content.params.monthIndex = (s.content.params.monthIndex || this._derived.currentMonthIndex) - 1;
        return true;
        
      case 'NEXT_MONTH':
        s.content.params.monthIndex = (s.content.params.monthIndex || this._derived.currentMonthIndex) + 1;
        return true;
        
      case 'SELECT_DAY':
        s.content.params.selectedDay = event.lunarDay;
        return true;
      
      // ─── UI Events ───
      case 'OPEN_STRONGS':
      case 'SET_STRONGS_ID': {
        const newStrongsId = event.strongsId || null;
        if (s.ui.strongsId === newStrongsId) return false;
        s.ui.strongsId = newStrongsId;
        return true;
      }
        
      case 'CLOSE_STRONGS':
        if (s.ui.strongsId === null) return false;
        s.ui.strongsId = null;
        return true;
        
      case 'OPEN_SEARCH':
      case 'SET_SEARCH_QUERY': {
        const newQuery = event.searchQuery || event.query || null;
        if (s.ui.searchQuery === newQuery) return false;
        s.ui.searchQuery = newQuery;
        return true;
      }
        
      case 'CLOSE_SEARCH':
        if (s.ui.searchQuery === null) return false;
        s.ui.searchQuery = null;
        return true;
        
      case 'SET_INTERLINEAR_VERSE': {
        const newVerse = event.verse || null;
        if (s.ui.interlinearVerse === newVerse) return false;
        s.ui.interlinearVerse = newVerse;
        return true;
      }
        
      case 'SET_TIMELINE_EVENT': {
        const newEventId = event.eventId || null;
        if (s.ui.timelineEventId === newEventId && s.ui.timelineDurationId === null) return false;
        s.ui.timelineEventId = newEventId;
        s.ui.timelineDurationId = null; // Clear duration when selecting event
        return true;
      }
        
      case 'SET_TIMELINE_DURATION': {
        const newDurationId = event.durationId || null;
        if (s.ui.timelineDurationId === newDurationId && s.ui.timelineEventId === null) return false;
        s.ui.timelineDurationId = newDurationId;
        s.ui.timelineEventId = null; // Clear event when selecting duration
        return true;
      }
        
      case 'CLEAR_TIMELINE_SELECTION':
        if (s.ui.timelineEventId === null && s.ui.timelineDurationId === null) return false;
        s.ui.timelineEventId = null;
        s.ui.timelineDurationId = null;
        return true;
      
      // Events page filters
      case 'SET_EVENTS_FILTER': {
        let changed = false;
        if (event.search !== undefined && s.ui.eventsSearch !== event.search) {
          s.ui.eventsSearch = event.search || null;
          changed = true;
        }
        // Accept both 'eventsType' and 'type' for flexibility
        const newType = event.eventsType ?? event.filterType;
        if (newType !== undefined && s.ui.eventsType !== newType) {
          s.ui.eventsType = newType || 'all';
          changed = true;
        }
        if (event.era !== undefined && s.ui.eventsEra !== event.era) {
          s.ui.eventsEra = event.era || 'all';
          changed = true;
        }
        if (event.viewMode !== undefined && s.ui.eventsViewMode !== event.viewMode) {
          s.ui.eventsViewMode = event.viewMode || 'list';
          changed = true;
        }
        return changed;
      }
      
      case 'CLEAR_EVENTS_FILTER':
        if (s.ui.eventsSearch === null && s.ui.eventsType === 'all' && 
            s.ui.eventsEra === 'all' && s.ui.eventsViewMode === 'list') return false;
        s.ui.eventsSearch = null;
        s.ui.eventsType = 'all';
        s.ui.eventsEra = 'all';
        s.ui.eventsViewMode = 'list';
        return true;
        
      case 'OPEN_PERSON':
        s.ui.personId = event.personId;
        return true;
        
      case 'CLOSE_PERSON':
        if (s.ui.personId === null) return false;
        s.ui.personId = null;
        return true;
        
      case 'TOGGLE_MENU':
        s.ui.menuOpen = !s.ui.menuOpen;
        return true;
        
      case 'CLOSE_MENU':
        if (!s.ui.menuOpen) return false;
        s.ui.menuOpen = false;
        return true;
        
      case 'TOGGLE_PROFILE_PICKER':
        s.ui.profilePickerOpen = !s.ui.profilePickerOpen;
        return true;
        
      case 'CLOSE_PROFILE_PICKER':
        if (!s.ui.profilePickerOpen) return false;
        s.ui.profilePickerOpen = false;
        return true;
        
      case 'TOGGLE_LOCATION_PICKER':
        s.ui.locationPickerOpen = !s.ui.locationPickerOpen;
        return true;
        
      case 'CLOSE_ALL_PICKERS':
        let closedAny = false;
        if (s.ui.profilePickerOpen) { s.ui.profilePickerOpen = false; closedAny = true; }
        if (s.ui.locationPickerOpen) { s.ui.locationPickerOpen = false; closedAny = true; }
        if (s.ui.yearPickerOpen) { s.ui.yearPickerOpen = false; closedAny = true; }
        if (s.ui.monthPickerOpen) { s.ui.monthPickerOpen = false; closedAny = true; }
        if (s.ui.timePickerOpen) { s.ui.timePickerOpen = false; closedAny = true; }
        return closedAny;
      
      // ─── URL Events ───
      case 'INIT_FROM_URL':
      case 'URL_CHANGED': {
        console.log('[AppStore] INIT_FROM_URL: Starting, url =', event.url || window.location.href);
        console.log('[AppStore] INIT_FROM_URL: Current state.content.view =', s.content.view);
        
        // Disable URL sync during URL parsing to avoid loops
        this._urlSyncEnabled = false;
        const parsed = window.URLRouter?.parseURL(event.url || window.location);
        console.log('[AppStore] INIT_FROM_URL: Parsed result =', parsed ? { view: parsed.content.view, params: parsed.content.params } : 'null');
        
        if (parsed) {
          // Preserve 'today' - it's not in the URL
          const preservedToday = s.context.today;
          Object.assign(s.context, parsed.context);
          s.context.today = preservedToday;
          
          // Clear old params before assigning new view params
          s.content.view = parsed.content.view;
          s.content.params = parsed.content.params;
          
          Object.assign(s.ui, parsed.ui);
          
          // selectedLunarDate is now set directly by URLRouter - no pendingNavTarget needed
          console.log('[AppStore] INIT_FROM_URL: selectedLunarDate =', s.context.selectedLunarDate);
          console.log('[AppStore] INIT_FROM_URL: Set view to:', s.content.view);
        }
        // Enable URL sync now that we've loaded from URL
        // Use a short delay to ensure the current dispatch cycle completes
        setTimeout(() => { 
          this._urlSyncEnabled = true; 
          console.log('[AppStore] URL sync enabled');
        }, 50);
        return true;
      }
      
      // ─── Batch Context Update ───
      case 'SET_CONTEXT':
        let contextChanged = false;
        if (event.selectedDate !== undefined && s.context.selectedDate !== event.selectedDate) {
          s.context.selectedDate = event.selectedDate;
          contextChanged = true;
        }
        if (event.location !== undefined) {
          if (s.context.location.lat !== event.location.lat || 
              s.context.location.lon !== event.location.lon) {
            s.context.location = event.location;
            contextChanged = true;
          }
        }
        if (event.profileId !== undefined && s.context.profileId !== event.profileId) {
          s.context.profileId = event.profileId;
          contextChanged = true;
        }
        return contextChanged;
        
      default:
        console.warn('[AppStore] Unknown event type:', event.type);
        return false;
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // DERIVED STATE COMPUTATION
  // ═══════════════════════════════════════════════════════════════════════
  
  _recomputeDerived() {
    const { context } = this._state;
    
    // Get profile configuration
    const profile = this._profiles[context.profileId] || this._profiles.timeTested || {};
    this._derived.config = profile;
    
    // Only regenerate lunar months if we have an engine
    if (this._astroEngine && typeof LunarCalendarEngine !== 'undefined') {
      if (!this._engine) {
        this._engine = new LunarCalendarEngine(this._astroEngine);
      }
      
      // Configure engine with profile
      this._engine.configure({
        moonPhase: profile.moonPhase || 'full',
        dayStartTime: profile.dayStartTime || 'morning',
        dayStartAngle: profile.dayStartAngle || 12,
        yearStartRule: profile.yearStartRule || 'equinox',
        crescentThreshold: profile.crescentThreshold || 18
      });
      
      // Check if we need to regenerate the calendar
      // Regenerate if: year changed, location changed, or no calendar yet
      let needsRegenerate = true;
      const locationChanged = this._derived.calendarLocation && 
        (this._derived.calendarLocation.lat !== context.location.lat || 
         this._derived.calendarLocation.lon !== context.location.lon);
      
      if (locationChanged) {
        console.log('[AppStore] Location changed, regenerating calendar. Old:', this._derived.calendarLocation, 'New:', context.location);
      }
      
      if (this._derived.lunarMonths && this._derived.lunarMonths.length > 0 && this._derived.year !== null && !locationChanged) {
        // If we have selectedLunarDate, check if year matches
        if (context.selectedLunarDate) {
          needsRegenerate = context.selectedLunarDate.year !== this._derived.year;
        } else if (context.selectedDate !== null) {
          // For JD-based dates, check if within current calendar range
          const firstMonth = this._derived.lunarMonths[0];
          const lastMonth = this._derived.lunarMonths[this._derived.lunarMonths.length - 1];
          const firstDay = firstMonth?.days?.[0]?.gregorianDate;
          const lastDay = lastMonth?.days?.[lastMonth.days.length - 1]?.gregorianDate;
          
          if (firstDay && lastDay) {
            const firstJD = this._dateToJulian(firstDay);
            const lastJD = this._dateToJulian(lastDay);
            
            if (context.selectedDate >= firstJD && context.selectedDate <= lastJD) {
              needsRegenerate = false;
            }
          }
        }
      }
      
      // Generate lunar months if needed
      try {
        console.log('[AppStore] _recomputeDerived: needsRegenerate=', needsRegenerate, 'selectedLunarDate=', context.selectedLunarDate, 'selectedDate=', context.selectedDate);
        if (needsRegenerate) {
          let calendarYear;
          
          // Use selectedLunarDate.year directly if available (source of truth)
          if (context.selectedLunarDate?.year !== undefined) {
            calendarYear = context.selectedLunarDate.year;
            console.log('[AppStore] Using selectedLunarDate.year:', calendarYear);
          } else {
            // Fall back to extracting year from JD
            const gregDate = this._julianToGregorian(context.selectedDate);
            calendarYear = gregDate.year;
            console.log('[AppStore] Using year from JD:', calendarYear, 'greg=', gregDate);
          }
          
          console.log('[AppStore] Generating calendar for year', calendarYear, 'location=', context.location);
          let calendar = this._engine.generateYear(calendarYear, context.location);
          
          // Only check for calendar boundary issues when using JD-based navigation
          // (selectedLunarDate already specifies the exact year)
          if (!context.selectedLunarDate) {
            const firstDayOfCalendar = calendar.months?.[0]?.days?.[0]?.gregorianDate;
            console.log('[AppStore] Calendar boundary check: firstDay=', firstDayOfCalendar?.toISOString(), 'selectedDate=', context.selectedDate);
            if (firstDayOfCalendar) {
              const firstDayJD = this._dateToJulian(firstDayOfCalendar);
              console.log('[AppStore] firstDayJD=', firstDayJD, 'selectedDate=', context.selectedDate, 'isBefore=', context.selectedDate < firstDayJD);
              if (context.selectedDate < firstDayJD) {
                console.log('[AppStore] selectedDate is before calendar start, using previous year');
                calendarYear = calendarYear - 1;
                calendar = this._engine.generateYear(calendarYear, context.location);
              }
            }
          }
          
          this._derived.year = calendarYear;
          this._derived.lunarMonths = calendar.months || [];
          this._derived.calendarLocation = { ...context.location };  // Store location used for this calendar
          this._derived.yearStartUncertainty = calendar.yearStartUncertainty;
          this._derived.springEquinox = calendar.springEquinox;
        }
        
        // Find current month index and lunar day
        // Use selectedLunarDate directly if available (source of truth), else compute from JD
        if (context.selectedLunarDate) {
          // Direct lunar date - no conversion needed
          this._derived.currentMonthIndex = context.selectedLunarDate.month - 1;  // Convert 1-based to 0-based
          this._derived.currentLunarDay = context.selectedLunarDate.day;
        } else {
          // Fall back to JD-based lookup (for "Today" button, etc.)
          const selectedResult = this._findMonthAndDay(
            context.selectedDate, 
            this._derived.lunarMonths
          );
          this._derived.currentMonthIndex = selectedResult.monthIndex;
          this._derived.currentLunarDay = selectedResult.lunarDay;
        }
        
        // Find today's lunar date (for highlighting "today" in the calendar)
        const todayResult = this._findMonthAndDay(
          context.today,
          this._derived.lunarMonths
        );
        this._derived.todayMonthIndex = todayResult.monthIndex;
        this._derived.todayLunarDay = todayResult.lunarDay;
        
        // If we have selectedLunarDate, compute the JD for it now that calendar is generated
        // This ensures selectedDate (JD) is always in sync with the lunar date
        if (context.selectedLunarDate) {
          const { year, month, day } = context.selectedLunarDate;
          const monthIdx = month - 1;  // Convert 1-based to 0-based
          const targetMonth = this._derived.lunarMonths[monthIdx];
          
          if (targetMonth?.days) {
            const targetDay = targetMonth.days.find(d => d.lunarDay === day);
            if (targetDay?.gregorianDate) {
              // Compute JD from the lunar date's corresponding Gregorian date
              context.selectedDate = this._dateToJulian(targetDay.gregorianDate);
            }
          }
          
          // INVARIANT CHECK: derived state must match selectedLunarDate
          if (this._derived.currentMonthIndex !== monthIdx || 
              this._derived.currentLunarDay !== day) {
            console.error('[INVARIANT VIOLATION] Derived state does not match selectedLunarDate!', {
              selectedLunarDate: context.selectedLunarDate,
              derived: { 
                currentMonthIndex: this._derived.currentMonthIndex, 
                currentLunarDay: this._derived.currentLunarDay 
              },
              expected: { monthIndex: monthIdx, day }
            });
          }
        }
      } catch (e) {
        console.error('[AppStore] Error generating calendar:', e);
        this._derived.lunarMonths = [];
        this._derived.currentMonthIndex = 0;
        this._derived.todayMonthIndex = 0;
      }
    }
  },
  
  /**
   * Find month index and lunar day for a given Julian Day
   * Uses LunarCalendarEngine.findLunarDay for the lookup
   * @returns {{ monthIndex: number, lunarDay: number }}
   */
  _findMonthAndDay(jd, months) {
    if (!months || months.length === 0) {
      console.log('[AppStore] _findMonthAndDay: no months');
      return { monthIndex: 0, lunarDay: 1 };
    }
    if (!this._engine) {
      console.log('[AppStore] _findMonthAndDay: no engine');
      return { monthIndex: 0, lunarDay: 1 };
    }
    
    // Convert JD to Gregorian Date
    // Note: Must use setUTCFullYear for negative years (Date.UTC doesn't handle them)
    const greg = this._julianToGregorian(jd);
    let gregorianDate = new Date(Date.UTC(2000, greg.month - 1, greg.day, 12));
    gregorianDate.setUTCFullYear(greg.year);
    
    console.log('[AppStore] _findMonthAndDay:', { 
      jd, 
      gregorian: `${greg.year}-${greg.month}-${greg.day}`,
      monthsCount: months.length,
      firstMonthStart: months[0]?.days?.[0]?.gregorianDate?.toISOString(),
      lastMonthEnd: months[months.length-1]?.days?.slice(-1)[0]?.gregorianDate?.toISOString()
    });
    
    // Use engine's findLunarDay if calendar is available
    const calendar = { months };  // Minimal calendar object for findLunarDay
    const result = this._engine.findLunarDay(calendar, gregorianDate);
    
    console.log('[AppStore] findLunarDay result:', result);
    
    if (result) {
      // findLunarDay returns lunarMonth (1-based), convert to monthIndex (0-based)
      return { 
        monthIndex: result.lunarMonth - 1, 
        lunarDay: result.lunarDay 
      };
    }
    
    // Fallback: default to first month, first day
    console.log('[AppStore] _findMonthAndDay: falling back to default');
    return { monthIndex: 0, lunarDay: 1 };
  },
  
  /**
   * Convert a lunar date (year, month, day) to Julian Day
   * Generates the calendar for that year and looks up the specific day
   * @param {number} lunarYear - The lunar year
   * @param {number} lunarMonth - The lunar month (1-based)
   * @param {number} lunarDay - The lunar day (1-30)
   * @param {Object} context - Current context with location
   * @returns {number|null} Julian Day number or null if not found
   */
  _lunarDateToJD(lunarYear, lunarMonth, lunarDay, context) {
    if (!this._engine || !this._astroEngine) {
      console.warn('[AppStore] _lunarDateToJD: engine not available');
      return null;
    }
    
    // Generate calendar for the target year
    const calendar = this._engine.generateYear(lunarYear, context.location);
    if (!calendar?.months?.length) {
      console.warn('[AppStore] _lunarDateToJD: failed to generate calendar for year', lunarYear);
      return null;
    }
    
    // Find the target month (convert 1-based to 0-based index)
    const monthIndex = lunarMonth - 1;
    if (monthIndex < 0 || monthIndex >= calendar.months.length) {
      console.warn('[AppStore] _lunarDateToJD: month out of range', lunarMonth);
      return null;
    }
    
    const targetMonth = calendar.months[monthIndex];
    
    // Clamp day to valid range for this month
    const maxDay = targetMonth.days.length > 0 
      ? Math.max(...targetMonth.days.map(d => d.lunarDay))
      : 29;
    const clampedDay = Math.min(Math.max(1, lunarDay), maxDay);
    
    // Find the target day
    const targetDay = targetMonth.days.find(d => d.lunarDay === clampedDay);
    if (!targetDay?.gregorianDate) {
      // If exact day not found, use last day of month
      const lastDay = targetMonth.days[targetMonth.days.length - 1];
      if (lastDay?.gregorianDate) {
        return this._dateToJulian(lastDay.gregorianDate);
      }
      console.warn('[AppStore] _lunarDateToJD: day not found', lunarDay, 'clamped to', clampedDay);
      return null;
    }
    
    return this._dateToJulian(targetDay.gregorianDate);
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // URL SYNC
  // ═══════════════════════════════════════════════════════════════════════
  
  _syncURL(event) {
    console.log('[AppStore] _syncURL called, URLRouter exists:', !!window.URLRouter);
    
    if (!window.URLRouter) {
      console.error('[AppStore] URLRouter not found!');
      return;
    }
    
    // Determine if this should be a push or replace
    // Bible navigation should push to enable browser back/forward
    const pushEvents = ['SET_VIEW', 'SET_SELECTED_DATE', 'SET_PROFILE', 'SET_LOCATION', 'SELECT_DAY', 'SET_BIBLE_LOCATION'];
    const shouldPush = pushEvents.includes(event.type);
    
    console.log('[AppStore] calling URLRouter.syncURL, shouldPush:', shouldPush);
    
    try {
      // Pass both state and derived for URL building
      window.URLRouter.syncURL(this._state, this._derived, shouldPush);
    } catch (e) {
      console.error('[AppStore] syncURL error:', e);
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // NOTIFY LISTENERS
  // ═══════════════════════════════════════════════════════════════════════
  
  _notify() {
    const state = this.getState();
    const derived = this.getDerived();
    
    for (const listener of this._listeners) {
      try {
        listener(state, derived);
      } catch (e) {
        console.error('[AppStore] Listener error:', e);
      }
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // DATE UTILITIES
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Convert a Date to Julian Day using LOCAL time
   * Used for "today" since users care about their local date
   */
  _localDateToJulian(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const h = date.getHours();
    const min = date.getMinutes();
    const s = date.getSeconds();
    
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    
    // Gregorian calendar (modern dates only use local time for "today")
    const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + 
                Math.floor(yy / 4) - Math.floor(yy / 100) + 
                Math.floor(yy / 400) - 32045;
    
    // Add fractional day
    return jdn + (h - 12) / 24 + min / 1440 + s / 86400;
  },

  _dateToJulian(date) {
    // Convert JavaScript Date to Julian Day using UTC
    // Uses Julian calendar for dates before Oct 15, 1582, Gregorian after
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const h = date.getUTCHours();
    const min = date.getUTCMinutes();
    const s = date.getUTCSeconds();
    
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    
    let jdn;
    if (y < 1582 || (y === 1582 && (m < 10 || (m === 10 && d < 15)))) {
      // Julian calendar (no /100, /400 corrections)
      jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
    } else {
      // Gregorian calendar
      jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + 
            Math.floor(yy / 4) - Math.floor(yy / 100) + 
            Math.floor(yy / 400) - 32045;
    }
    
    // Add fractional day
    const jd = jdn + (h - 12) / 24 + min / 1440 + s / 86400;
    
    return jd;
  },
  
  _julianToGregorian(jd) {
    // Convert Julian Day to Gregorian date components
    const z = Math.floor(jd + 0.5);
    const f = (jd + 0.5) - z;
    
    let a = z;
    if (z >= 2299161) {
      const alpha = Math.floor((z - 1867216.25) / 36524.25);
      a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    
    const b = a + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const d = Math.floor(365.25 * c);
    const e = Math.floor((b - d) / 30.6001);
    
    const day = b - d - Math.floor(30.6001 * e);
    const month = (e < 14) ? e - 1 : e - 13;
    const year = (month > 2) ? c - 4716 : c - 4715;
    
    // Fractional day to time
    const fracDay = f;
    const hours = Math.floor(fracDay * 24);
    const minutes = Math.floor((fracDay * 24 - hours) * 60);
    
    return { year, month, day, hours, minutes };
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppStore;
}
