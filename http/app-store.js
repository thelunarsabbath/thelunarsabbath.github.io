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
      utcTime: { hours: 12, minutes: 0 },  // Time in UTC (internal representation)
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
      gematriaExpanded: false,  // Whether gematria related-words section is expanded
      searchQuery: null,        // Search query string
      personId: null,           // Open person card
      interlinearVerse: null,   // Open interlinear for verse (e.g., 5)
      timelineEventId: null,    // Selected timeline event ID (opens detail panel)
      timelineDurationId: null, // Selected timeline duration ID
      timelineFocusedEventId: null, // Focused/highlighted event (no detail panel)
      timelineZoom: null,       // Timeline zoom level (null = default from localStorage)
      timelineCenterYear: null, // Timeline center year for scroll position
      timelineSearch: null,     // Timeline search query
      eventsSearch: null,       // Events page search query
      eventsType: 'all',        // Events page type filter
      eventsEra: 'all',         // Events page era filter
      eventsViewMode: 'list',   // Events page view mode (list/timeline)
      menuOpen: false,          // Mobile menu state
      profilePickerOpen: false,
      locationPickerOpen: false,
      yearPickerOpen: false,
      monthPickerOpen: false,
      timePickerOpen: false,
      feastsPanel: false,       // Feasts slideout panel state
      priestlyPanel: false,     // Priestly cycles slideout panel state
      globalSearchQuery: null,  // Global search query (in top nav)
      globalSearchCollapsed: { events: false, bible: false }  // Collapsed sections in search results
    },
    
    // Bible navigation history (for PWA/desktop where browser history may not work)
    bibleHistory: {
      entries: [],              // Array of {book, chapter, verse} entries
      index: -1                 // Current position in history
    },
    
    // App navigation history (for back/forward buttons)
    navHistory: {
      entries: [],              // Array of URL strings
      index: -1,                // Current position in history
      isNavigating: false       // True when navigating via back/forward (prevents adding to history)
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
   * Get the calendar engine instance (for generating calendars at different locations)
   */
  getEngine() {
    return this._engine;
  },
  
  /**
   * Get a read-only copy of derived state
   */
  getDerived() {
    return structuredClone(this._derived);
  },
  
  /**
   * Silently update state without notifying subscribers
   * Used for syncing state with direct DOM updates (like Bible navigation)
   */
  silentUpdate(updates) {
    if (updates.view !== undefined) {
      this._state.content.view = updates.view;
    }
    if (updates.params !== undefined) {
      this._state.content.params = updates.params;
    }
    if (updates.ui !== undefined) {
      Object.assign(this._state.ui, updates.ui);
    }
  },
  
  /**
   * Convert UTC time to local time at a given location
   * @param {Object} utcTime - { hours, minutes } in UTC
   * @param {Date} date - The date for timezone calculation (DST varies by date)
   * @param {Object} location - { lat, lon }
   * @returns {Object} { hours, minutes } in local time
   */
  utcToLocal(utcTime, date, location) {
    if (!location) return utcTime;
    
    const tz = typeof TimezoneUtils !== 'undefined' 
      ? TimezoneUtils.getTimezoneFromCoords(location.lat, location.lon)
      : null;
    
    if (tz) {
      // Create a UTC date with the specified time
      const utcDate = new Date(Date.UTC(
        date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
        utcTime.hours, utcTime.minutes, 0
      ));
      
      // Format in the target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      
      const parts = formatter.formatToParts(utcDate);
      const getPart = (type) => {
        const part = parts.find(p => p.type === type);
        return part ? parseInt(part.value, 10) : 0;
      };
      
      return { hours: getPart('hour'), minutes: getPart('minute') };
    }
    
    // Fallback: solar time offset
    const offsetHours = location.lon / 15;
    let hours = utcTime.hours + offsetHours;
    let minutes = utcTime.minutes;
    
    // Handle day overflow
    if (hours >= 24) hours -= 24;
    if (hours < 0) hours += 24;
    
    return { hours: Math.floor(hours), minutes };
  },
  
  /**
   * Convert local time at a location to UTC
   * @param {Object} localTime - { hours, minutes } in local time
   * @param {Date} date - The date for timezone calculation
   * @param {Object} location - { lat, lon }
   * @returns {Object} { hours, minutes } in UTC
   */
  localToUtc(localTime, date, location) {
    if (!location) return localTime;
    
    const tz = typeof TimezoneUtils !== 'undefined'
      ? TimezoneUtils.getTimezoneFromCoords(location.lat, location.lon)
      : null;
    
    if (tz) {
      // Create a date string in local time format
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(localTime.hours).padStart(2, '0');
      const minutes = String(localTime.minutes).padStart(2, '0');
      
      // Parse as if in the target timezone by using toLocaleString trick
      // Create date assuming local browser time
      const localDateStr = `${year}-${month}-${day}T${hours}:${minutes}:00`;
      const tempDate = new Date(localDateStr);
      
      // Get the offset between the target timezone and browser local
      const targetFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      
      // Format browser's "now" in target timezone to get offset
      const nowInTarget = targetFormatter.format(new Date());
      const nowLocal = new Date().toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      
      // Calculate offset by comparing UTC times
      const browserOffset = -new Date().getTimezoneOffset(); // in minutes, positive = east
      const targetDate = new Date(tempDate.getTime());
      
      // Get UTC time by formatting in UTC
      const utcFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      
      // We need to find what UTC time corresponds to localTime in the target timezone
      // Try: create date at local time, then find its representation in target TZ
      // If they match, we found the right UTC
      
      // Simpler approach: use the browser's timezone conversion
      // Create a date at the local time, get its UTC
      const utcMs = tempDate.getTime();
      const utcDate = new Date(utcMs);
      
      // But this assumes browser local = target TZ, which is wrong
      // Need to adjust for the difference
      
      // Get current offset of target timezone
      const testDate = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));
      const inTarget = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(testDate);
      const targetHourAt12UTC = parseInt(inTarget.find(p => p.type === 'hour').value, 10);
      const targetOffsetHours = targetHourAt12UTC - 12; // offset from UTC
      
      // Convert local to UTC by subtracting offset
      let utcHours = localTime.hours - targetOffsetHours;
      if (utcHours >= 24) utcHours -= 24;
      if (utcHours < 0) utcHours += 24;
      
      return { hours: utcHours, minutes: localTime.minutes };
    }
    
    // Fallback: solar time offset (reverse)
    const offsetHours = location.lon / 15;
    let hours = localTime.hours - offsetHours;
    
    if (hours >= 24) hours -= 24;
    if (hours < 0) hours += 24;
    
    return { hours: Math.floor(hours), minutes: localTime.minutes };
  },
  
  /**
   * Get local time for display based on stored UTC time
   * @returns {Object} { hours, minutes } in local time at current location
   */
  getLocalTime() {
    const state = this._state;
    const utcTime = state.context.utcTime || { hours: 12, minutes: 0 };
    const location = state.context.location;
    const selectedDate = state.context.selectedDate;
    
    if (!selectedDate) return utcTime;
    
    const gregDate = this._julianToGregorian(selectedDate);
    const date = new Date(Date.UTC(gregDate.year, gregDate.month - 1, gregDate.day, 12, 0, 0));
    
    return this.utcToLocal(utcTime, date, location);
  },
  
  /**
   * Get the current date/time at the user's location
   * Uses IANA timezone lookup for accurate civil time, falls back to solar time
   * Accounts for biblical day boundaries (first light for morning, sunset for evening)
   * @param {Object} location - { lat, lon } coordinates
   * @returns {{ year, month, day, hours, minutes, timezone, biblicalDay }} - Local date/time at location
   */
  _getDateAtLocation(location) {
    const now = new Date(); // Current time for astronomical calculations
    
    // Use TimezoneUtils if available for proper IANA timezone lookup
    let localTime;
    if (typeof TimezoneUtils !== 'undefined') {
      localTime = TimezoneUtils.getLocalTimeAtLocation(location);
    } else {
      // Fallback to simple solar time calculation
      const lon = location?.lon || 0;
      const utcHours = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();
      const lonOffsetHours = lon / 15;
      
      const utcTotalMinutes = utcHours * 60 + utcMinutes;
      let localTotalMinutes = utcTotalMinutes + Math.round(lonOffsetHours * 60);
      
      let dayOffset = 0;
      if (localTotalMinutes >= 1440) {
        localTotalMinutes -= 1440;
        dayOffset = 1;
      } else if (localTotalMinutes < 0) {
        localTotalMinutes += 1440;
        dayOffset = -1;
      }
      
      const utcDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + dayOffset
      ));
      
      localTime = {
        year: utcDate.getUTCFullYear(),
        month: utcDate.getUTCMonth() + 1,
        day: utcDate.getUTCDate(),
        hours: Math.floor(localTotalMinutes / 60),
        minutes: localTotalMinutes % 60,
        timezone: `UTC${lon >= 0 ? '+' : ''}${Math.round(lonOffsetHours)} (solar)`
      };
    }
    
    const year = localTime.year;
    const month = localTime.month;
    const day = localTime.day;
    const hours = localTime.hours;
    const minutes = localTime.minutes;
    const timezone = localTime.timezone;
    
    // Biblical day adjustment based on profile settings
    // The Gregorian day (year, month, day) represents the calendar day
    // But the biblical day may not have started yet (before first light)
    // or may have already ended (after sunset for evening mode)
    let biblicalYear = year;
    let biblicalMonth = month;
    let biblicalDay = day;
    
    // Get the current profile's day start setting
    const profile = this._profiles[this._state.context.profileId] || this._profiles.timeTested || {};
    const dayStartTime = profile.dayStartTime || 'morning';
    
    // Use astronomy functions if available
    if (typeof getAstronomicalTimes === 'function') {
      const currentDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const astroTimes = getAstronomicalTimes(currentDate, location);
      
      if (astroTimes) {
        const nowMs = now.getTime();
        
        if (dayStartTime === 'morning') {
          // Day starts at first light (civil dawn)
          // If current time is before first light, we're still in the previous biblical day
          if (astroTimes.firstLightTs && nowMs < astroTimes.firstLightTs) {
            // Still in the previous biblical day
            const prevDay = new Date(Date.UTC(year, month - 1, day - 1));
            biblicalYear = prevDay.getUTCFullYear();
            biblicalMonth = prevDay.getUTCMonth() + 1;
            biblicalDay = prevDay.getUTCDate();
          }
        } else if (dayStartTime === 'evening') {
          // Day starts at sunset
          // If current time is after sunset, we're in the next biblical day
          if (astroTimes.sunsetTs && nowMs >= astroTimes.sunsetTs) {
            // Already in the next biblical day
            const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
            biblicalYear = nextDay.getUTCFullYear();
            biblicalMonth = nextDay.getUTCMonth() + 1;
            biblicalDay = nextDay.getUTCDate();
          }
        }
      }
    }
    
    return { 
      year, month, day, hours, minutes,
      // Biblical day (accounting for dawn/sunset boundary)
      biblicalYear, biblicalMonth, biblicalDay
    };
  },
  
  /**
   * Get Julian Day for "today" at the configured location
   * This is the source of truth for calendar "today" highlighting
   * Uses biblical day boundary (first light for morning, sunset for evening)
   */
  _getTodayJD() {
    const location = this._state.context.location;
    const dateAtLoc = this._getDateAtLocation(location);
    
    // Use biblical day (accounts for dawn/sunset boundary) instead of Gregorian day
    const date = new Date(Date.UTC(
      dateAtLoc.biblicalYear, 
      dateAtLoc.biblicalMonth - 1, 
      dateAtLoc.biblicalDay, 
      12, 0, 0
    ));
    return this._dateToJulian(date);
  },
  
  /**
   * Get today's date/time as a SET_GREGORIAN_DATETIME event
   * Uses LOCAL time at the SELECTED LOCATION (not browser's local time)
   * Uses biblical day boundary (first light for morning, sunset for evening)
   */
  getTodayEvent() {
    const dateAtLoc = this._getDateAtLocation(this._state.context.location);
    
    return {
      type: 'SET_GREGORIAN_DATETIME',
      // Use biblical day (accounts for dawn/sunset boundary)
      year: dateAtLoc.biblicalYear,
      month: dateAtLoc.biblicalMonth,
      day: dateAtLoc.biblicalDay,
      hours: dateAtLoc.hours,
      minutes: dateAtLoc.minutes
    };
  },
  
  /**
   * Dispatch an event to update state
   * @param {Object} event - Event with type and payload
   */
  // Track if we're in a dispatch cycle (to prevent duplicate history entries)
  _isDispatching: false,
  
  isDispatching() {
    return this._isDispatching;
  },
  
  // UI-only event types that don't require calendar recomputation
  _uiOnlyEvents: new Set([
    'SET_TIMELINE_EVENT',
    'SET_TIMELINE_DURATION', 
    'SET_TIMELINE_FOCUSED_EVENT',
    'CLEAR_TIMELINE_SELECTION',
    'SET_TIMELINE_ZOOM',
    'SET_TIMELINE_CENTER_YEAR',
    'SET_TIMELINE_SEARCH',
    'SET_EVENTS_FILTER',
    'CLEAR_EVENTS_FILTER',
    'TOGGLE_MENU',
    'CLOSE_MENU',
    'TOGGLE_PROFILE_PICKER',
    'CLOSE_PROFILE_PICKER',
    'TOGGLE_LOCATION_PICKER',
    'CLOSE_ALL_PICKERS',
    'OPEN_STRONGS',
    'SET_STRONGS_ID',
    'CLOSE_STRONGS',
    'TOGGLE_GEMATRIA',
    'OPEN_SEARCH',
    'SET_SEARCH_QUERY',
    'CLOSE_SEARCH',
    'SET_INTERLINEAR_VERSE',
    'OPEN_PERSON',
    'CLOSE_PERSON',
    'NAV_PUSH',
    'SET_GLOBAL_SEARCH',
    'CLOSE_GLOBAL_SEARCH',
    'SET_SEARCH_COLLAPSED'
  ]),
  
  dispatch(event) {
    if (window.DEBUG_STORE) {
      console.log('[AppStore] dispatch:', event.type, event);
    }
    
    this._isDispatching = true;
    const changed = this._reduce(event);
    
    if (changed) {
      // Skip expensive calendar recomputation for UI-only state changes
      if (!this._uiOnlyEvents.has(event.type)) {
        this._recomputeDerived();
      }
      
      if (this._urlSyncEnabled) {
        this._syncURL(event);
      }
      
      this._notify();
    }
    this._isDispatching = false;
  },
  
  /**
   * Dispatch multiple events atomically (single recompute/notify)
   * @param {Array} events - Array of events
   */
  dispatchBatch(events) {
    console.log('[AppStore] dispatchBatch:', events.map(e => e.type));
    this._isDispatching = true;
    let anyChanged = false;
    let needsDerivedRecompute = false;
    
    for (const event of events) {
      console.log('[AppStore] batch reduce:', event.type);
      if (this._reduce(event)) {
        anyChanged = true;
        // Check if any event requires derived recomputation
        if (!this._uiOnlyEvents.has(event.type)) {
          needsDerivedRecompute = true;
        }
      }
    }
    
    console.log('[AppStore] anyChanged:', anyChanged, 'urlSyncEnabled:', this._urlSyncEnabled);
    
    if (anyChanged) {
      // Only recompute derived state if needed
      if (needsDerivedRecompute) {
        this._recomputeDerived();
      }
      if (this._urlSyncEnabled) {
        console.log('[AppStore] calling _syncURL');
        this._syncURL(events[events.length - 1]);
      }
      this._notify();
    }
    this._isDispatching = false;
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
    
    // STEP 1: Parse URL FIRST - before generating any calendar
    // This tells us what location, profile, and date we actually need
    const parsed = window.URLRouter?.parseURL(window.location);
    if (parsed) {
      console.log('[AppStore] init: Parsed URL before generating calendar:', {
        view: parsed.content.view,
        location: parsed.context.location,
        lunarDate: parsed.context.selectedLunarDate
      });
      
      // Apply URL context (location, profile, etc.)
      Object.assign(this._state.context, parsed.context);
      this._state.content.view = parsed.content.view;
      this._state.content.params = parsed.content.params;
      Object.assign(this._state.ui, parsed.ui);
      console.log('[AppStore] init: Applied parsed.ui, timelineEventId is now:', this._state.ui.timelineEventId);
    }
    
    // STEP 2: Now set "today" based on the actual location (from URL or default)
    this._state.context.today = this._getTodayJD();
    
    // STEP 3: If URL specified a lunar date, convert it to JD
    // Otherwise use today as the selected date
    if (this._state.context.selectedLunarDate) {
      const { year, month, day } = this._state.context.selectedLunarDate;
      console.log('[AppStore] init: URL has lunar date, computing JD for:', { year, month, day });
      const jd = this._lunarDateToJD(year, month, day, this._state.context);
      if (jd !== null) {
        console.log('[AppStore] init: Computed JD:', jd);
        this._state.context.selectedDate = jd;
        this._state.context.selectedLunarDate = null;  // JD is now source of truth
      } else {
        // Fallback to today if can't resolve lunar date
        console.log('[AppStore] init: Could not compute JD, falling back to today');
        this._state.context.selectedDate = this._state.context.today;
      }
    } else if (this._state.context.selectedDate === null) {
      // No lunar date and no selectedDate - use today
      this._state.context.selectedDate = this._state.context.today;
    }
    
    // Start clock tick (update "today" every minute)
    setInterval(() => {
      this.dispatch({ type: 'SET_TODAY', jd: this._getTodayJD() });
    }, 60000);
    
    this._initialized = true;
    
    // STEP 4: Now generate calendar with correct location/date
    this._recomputeDerived();
    
    // Auto-detect user location (GPS > localStorage > IP) for empty URL
    this._initUserLocation();
    
    // URL sync will be enabled after INIT_FROM_URL dispatch in index.html
    console.log('[AppStore] init complete');
  },
  
  /**
   * Detect user's location: GPS (if granted) > localStorage > IP geolocation
   * Only runs on empty/root URL - doesn't override URL-specified locations
   * Respects user's location preference (GPS, city, or manual)
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
    
    // Get user's location preference
    const locationMethod = localStorage.getItem('userLocationMethod') || 'gps';
    
    // 1. If preference is GPS, try GPS first (if user has previously granted permission)
    if (locationMethod === 'gps') {
      const gpsLocation = await this._tryGPSLocation();
      if (gpsLocation) {
        console.log('[AppStore] Location from GPS:', gpsLocation.lat, gpsLocation.lon);
        setLocationAndSync(gpsLocation.lat, gpsLocation.lon);
        localStorage.setItem('userLocation', JSON.stringify(gpsLocation));
        localStorage.setItem('userLocationSource', 'gps');
        return;
      }
    }
    
    // 2. If preference is map (or city/manual from old settings), use saved location
    if (locationMethod === 'map' || locationMethod === 'city' || locationMethod === 'manual') {
      const savedLocation = localStorage.getItem('userLocation');
      if (savedLocation) {
        try {
          const loc = JSON.parse(savedLocation);
          if (loc.lat && loc.lon) {
            console.log('[AppStore] Location from saved map/city/manual:', loc.lat, loc.lon);
            setLocationAndSync(loc.lat, loc.lon);
            return;
          }
        } catch (e) {
          // Invalid saved location, continue to fallback
        }
      }
    }
    
    // 4. Fallback: Check localStorage for saved location (from GPS or user selection)
    const savedSource = localStorage.getItem('userLocationSource');
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation && (savedSource === 'gps' || savedSource === 'user')) {
      try {
        const loc = JSON.parse(savedLocation);
        if (loc.lat && loc.lon) {
          console.log('[AppStore] Location from localStorage:', savedSource, loc.lat, loc.lon);
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
        // Optionally update time as well (event.time is local, convert to UTC)
        if (event.time !== undefined) {
          const gregDate = this._julianToGregorian(s.context.selectedDate);
          const date = new Date(Date.UTC(gregDate.year, gregDate.month - 1, gregDate.day, 12, 0, 0));
          s.context.utcTime = this.localToUtc(event.time, date, s.context.location);
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
          // event.time is local, convert to UTC
          // Use current date for conversion (lunar date not yet resolved to Gregorian)
          const now = new Date();
          s.context.utcTime = this.localToUtc(event.time, now, s.context.location);
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
        // Handle time - convert local time to UTC for storage
        const currentUtcTime = s.context.utcTime || { hours: 12, minutes: 0 };
        if (event.time !== undefined) {
          // event.time is local, convert to UTC
          const newUtcTime = this.localToUtc(event.time, gregDate, s.context.location);
          if (currentUtcTime.hours !== newUtcTime.hours || 
              currentUtcTime.minutes !== newUtcTime.minutes) {
            s.context.utcTime = newUtcTime;
            gregChanged = true;
          }
        } else if (event.hours !== undefined || event.date instanceof Date) {
          // Extract time from the date or event (assumed local)
          const hours = event.hours ?? (event.date ? event.date.getHours() : 12);
          const minutes = event.minutes ?? (event.date ? event.date.getMinutes() : 0);
          const localTime = { hours, minutes };
          const newUtcTime = this.localToUtc(localTime, gregDate, s.context.location);
          if (currentUtcTime.hours !== newUtcTime.hours || currentUtcTime.minutes !== newUtcTime.minutes) {
            s.context.utcTime = newUtcTime;
            gregChanged = true;
          }
        }
        return gregChanged;
        
      case 'SET_TIME':
        // event.time is local, convert to UTC
        const setTimeGreg = this._julianToGregorian(s.context.selectedDate);
        const setTimeDate = new Date(Date.UTC(setTimeGreg.year, setTimeGreg.month - 1, setTimeGreg.day, 12, 0, 0));
        s.context.utcTime = this.localToUtc(event.time, setTimeDate, s.context.location);
        return true;
        
      case 'SET_LOCATION': {
        // Accept coordinates: { location: {lat, lon} } or { lat, lon }
        const newLoc = event.location || { lat: event.lat, lon: event.lon };
        if (s.context.location.lat === newLoc.lat && 
            s.context.location.lon === newLoc.lon) return false;
        
        // UTC time stays unchanged - the same absolute moment
        // Display will automatically show correct local time via getLocalTime()
        
        s.context.location = newLoc;
        // Clear lunar date so it re-resolves from the unchanged JD at the new location
        s.context.selectedLunarDate = null;
        // Recalculate "today" for the new location (different timezone = different day)
        s.context.today = this._getTodayJD();
        // Save to localStorage so it persists across sessions/navigations
        try {
          localStorage.setItem('userLocation', JSON.stringify(newLoc));
          localStorage.setItem('userLocationSource', 'user');
        } catch (e) {}
        return true;
      }
        
      case 'SET_PROFILE': {
        let changed = false;
        if (event.profileId && s.context.profileId !== event.profileId) {
          s.context.profileId = event.profileId;
          changed = true;
        }
        // Optional: update location in the same atomic dispatch
        const newLoc = event.location || (event.lat != null ? { lat: event.lat, lon: event.lon } : null);
        if (newLoc && (s.context.location.lat !== newLoc.lat || s.context.location.lon !== newLoc.lon)) {
          s.context.location = newLoc;
          // Same cleanup as SET_LOCATION: clear lunar date so it re-resolves
          // from the unchanged JD at the new location, and recalculate "today"
          s.context.selectedLunarDate = null;
          s.context.today = this._getTodayJD();
          try {
            localStorage.setItem('userLocation', JSON.stringify(newLoc));
            localStorage.setItem('userLocationSource', 'user');
          } catch (e) {}
          changed = true;
        }
        return changed;
      }
        
      case 'REFRESH':
        // Force recomputation of derived state (e.g., after data loads)
        return true;
      
      case 'REPOPULATE_DAY_DATA':
        // Repopulate day data (feasts, events) without regenerating calendar
        // Used after loadBibleEvents() completes
        if (this._derived.lunarMonths && this._derived.lunarMonths.length > 0) {
          this._populateDayData(this._derived.lunarMonths);
        }
        return true;
        
      case 'SET_ASTRO_ENGINE':
        // Update astronomy engine after async load completes
        if (event.payload) {
          const profile = this._profiles[s.context.profileId] || this._profiles.timeTested || {};
          _engine = new LunarCalendarEngine(event.payload);
          _engine.configure({
            moonPhase: profile.moonPhase || 'full',
            dayStartTime: profile.dayStartTime || 'morning',
            dayStartAngle: profile.dayStartAngle ?? 12,
            yearStartRule: profile.yearStartRule || 'virgoFeet'
          });
          console.log('[AppStore] Astronomy engine updated');
        }
        return true;
        
      case 'GO_TO_TODAY': {
        // Set date to today and time to current moment
        // Store UTC time directly - display will convert to local
        const now = new Date();
        s.context.selectedDate = s.context.today;
        s.context.selectedLunarDate = null;  // Clear so JD-based lookup is used
        
        // Store current time in UTC
        s.context.utcTime = { 
          hours: now.getUTCHours(), 
          minutes: now.getUTCMinutes() 
        };
        return true;
      }
      
      // ─── Content Events ───
      case 'SET_VIEW':
        s.content.view = event.view;
        // Replace params entirely when switching views (don't merge old params)
        s.content.params = event.params || {};
        // Clear Strong's panel unless explicitly preserved
        if (!event.preserveStrongs) {
          s.ui.strongsId = null;
        }
        // Clear view-specific state when leaving views
        // Timeline state
        if (event.view !== 'timeline') {
          s.ui.timelineEventId = null;
          s.ui.timelineDurationId = null;
          s.ui.timelineFocusedEventId = null;
          s.ui.timelineSearch = null;
          s.ui.timelineZoom = null;
          s.ui.timelineCenterYear = null;
        }
        // Events page state
        if (event.view !== 'events') {
          s.ui.eventsSearch = null;
          s.ui.eventsType = 'all';
          s.ui.eventsEra = 'all';
          s.ui.eventsViewMode = 'list';
        }
        // Reader-specific state
        if (event.view !== 'reader') {
          s.ui.interlinearVerse = null;
        }
        // Calendar panel state
        if (event.view !== 'calendar') {
          s.ui.feastsPanel = false;
          s.ui.priestlyPanel = false;
        }
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
        s.ui.gematriaExpanded = false; // Reset when Strong's number changes
        return true;
      }
        
      case 'CLOSE_STRONGS':
        if (s.ui.strongsId === null) return false;
        s.ui.strongsId = null;
        s.ui.gematriaExpanded = false;
        return true;
      
      case 'TOGGLE_GEMATRIA':
        s.ui.gematriaExpanded = !s.ui.gematriaExpanded;
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
        if (s.ui.timelineEventId === newEventId && s.ui.timelineDurationId === null && s.ui.timelineSearch === null) return false;
        s.ui.timelineEventId = newEventId;
        s.ui.timelineDurationId = null; // Clear duration when selecting event
        s.ui.timelineSearch = null;     // Clear search when selecting event (mutually exclusive)
        return true;
      }
        
      case 'SET_TIMELINE_DURATION': {
        const newDurationId = event.durationId || null;
        if (s.ui.timelineDurationId === newDurationId && s.ui.timelineEventId === null && s.ui.timelineSearch === null) return false;
        s.ui.timelineDurationId = newDurationId;
        s.ui.timelineEventId = null;    // Clear event when selecting duration
        s.ui.timelineSearch = null;     // Clear search when selecting duration (mutually exclusive)
        return true;
      }
      
      case 'SET_TIMELINE_FOCUSED_EVENT': {
        const newEventId = event.eventId || null;
        if (s.ui.timelineFocusedEventId === newEventId) return false;
        s.ui.timelineFocusedEventId = newEventId;
        // Don't clear detail panel state - this is independent
        return true;
      }
        
      case 'CLEAR_TIMELINE_SELECTION':
        if (s.ui.timelineEventId === null && s.ui.timelineDurationId === null) return false;
        s.ui.timelineEventId = null;
        s.ui.timelineDurationId = null;
        // NOTE: Does not clear search - use SET_TIMELINE_SEARCH for that
        return true;
        
      case 'SET_TIMELINE_ZOOM': {
        const newZoom = event.zoom;
        if (s.ui.timelineZoom === newZoom) return false;
        s.ui.timelineZoom = newZoom;
        return true;
      }
        
      case 'SET_TIMELINE_CENTER_YEAR': {
        const newYear = event.year;
        if (s.ui.timelineCenterYear === newYear) return false;
        s.ui.timelineCenterYear = newYear;
        return true;
      }
      
      case 'SET_TIMELINE_SEARCH': {
        const newSearch = event.search || null;
        if (s.ui.timelineSearch === newSearch && s.ui.timelineEventId === null && s.ui.timelineDurationId === null) return false;
        s.ui.timelineSearch = newSearch;
        s.ui.timelineEventId = null;    // Clear event when searching (mutually exclusive)
        s.ui.timelineDurationId = null; // Clear duration when searching (mutually exclusive)
        return true;
      }
      
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
      
      // ─── Navigation History ───
      case 'NAV_PUSH': {
        // Add current URL to history (called when navigating normally)
        if (s.navHistory.isNavigating) {
          s.navHistory.isNavigating = false;
          return false; // Don't add to history when navigating via back/forward
        }
        const url = event.url || window.location.pathname + window.location.search;
        // Don't add duplicate consecutive entries
        if (s.navHistory.entries[s.navHistory.index] === url) return false;
        // Truncate forward history when adding new entry
        s.navHistory.entries = s.navHistory.entries.slice(0, s.navHistory.index + 1);
        s.navHistory.entries.push(url);
        s.navHistory.index = s.navHistory.entries.length - 1;
        // Limit history size
        if (s.navHistory.entries.length > 50) {
          s.navHistory.entries.shift();
          s.navHistory.index--;
        }
        return true;
      }
      
      case 'NAV_BACK': {
        if (s.navHistory.index <= 0) return false;
        s.navHistory.index--;
        s.navHistory.isNavigating = true;
        // Navigate to the URL using setTimeout to avoid recursion
        const backUrl = s.navHistory.entries[s.navHistory.index];
        if (backUrl) {
          setTimeout(() => {
            window.history.pushState({}, '', backUrl);
            AppStore.dispatch({ type: 'INIT_FROM_URL', url: new URL(backUrl, window.location.origin) });
          }, 0);
        }
        return true;
      }
      
      case 'NAV_FORWARD': {
        if (s.navHistory.index >= s.navHistory.entries.length - 1) return false;
        s.navHistory.index++;
        s.navHistory.isNavigating = true;
        // Navigate to the URL using setTimeout to avoid recursion
        const fwdUrl = s.navHistory.entries[s.navHistory.index];
        if (fwdUrl) {
          setTimeout(() => {
            window.history.pushState({}, '', fwdUrl);
            AppStore.dispatch({ type: 'INIT_FROM_URL', url: new URL(fwdUrl, window.location.origin) });
          }, 0);
        }
        return true;
      }
        
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
        
      // ─── Calendar Panel Actions ───
      case 'TOGGLE_FEASTS_PANEL':
        // Close priestly panel when opening feasts
        if (!s.ui.feastsPanel) s.ui.priestlyPanel = false;
        s.ui.feastsPanel = !s.ui.feastsPanel;
        return true;
        
      case 'OPEN_FEASTS_PANEL':
        if (s.ui.feastsPanel) return false;
        s.ui.feastsPanel = true;
        s.ui.priestlyPanel = false; // Close priestly
        return true;
        
      case 'CLOSE_FEASTS_PANEL':
        if (!s.ui.feastsPanel) return false;
        s.ui.feastsPanel = false;
        return true;
        
      case 'TOGGLE_PRIESTLY_PANEL':
        // Close feasts panel when opening priestly
        if (!s.ui.priestlyPanel) s.ui.feastsPanel = false;
        s.ui.priestlyPanel = !s.ui.priestlyPanel;
        return true;
        
      case 'OPEN_PRIESTLY_PANEL':
        if (s.ui.priestlyPanel) return false;
        s.ui.priestlyPanel = true;
        s.ui.feastsPanel = false; // Close feasts
        return true;
        
      case 'CLOSE_PRIESTLY_PANEL':
        if (!s.ui.priestlyPanel) return false;
        s.ui.priestlyPanel = false;
        return true;
      
      // ─── Global Search Actions ───
      case 'SET_GLOBAL_SEARCH':
        if (s.ui.globalSearchQuery === event.query) return false;
        s.ui.globalSearchQuery = event.query;
        return true;
        
      case 'CLOSE_GLOBAL_SEARCH':
        if (s.ui.globalSearchQuery === null) return false;
        s.ui.globalSearchQuery = null;
        return true;
      
      case 'SET_SEARCH_COLLAPSED': {
        const section = event.section; // 'events' or 'bible'
        const collapsed = event.collapsed;
        if (s.ui.globalSearchCollapsed[section] === collapsed) return false;
        s.ui.globalSearchCollapsed = { ...s.ui.globalSearchCollapsed, [section]: collapsed };
        return true;
      }
      
      // ─── URL Events ───
      case 'INIT_FROM_URL':
        // Initial URL was already parsed in init() - just enable URL sync
        console.log('[AppStore] INIT_FROM_URL: URL was parsed in init(), enabling sync');
        setTimeout(() => { 
          this._urlSyncEnabled = true; 
          console.log('[AppStore] URL sync enabled');
        }, 50);
        return true;
        
      case 'URL_CHANGED': {
        // Browser navigation (back/forward) or programmatic URL change
        console.log('[AppStore] URL_CHANGED: url =', event.url || window.location.href);
        
        // Disable URL sync during parsing to avoid loops
        this._urlSyncEnabled = false;
        const parsed = window.URLRouter?.parseURL(event.url || window.location);
        
        if (parsed) {
          // Check if location is changing
          const locationChanged = parsed.context.location && (
            s.context.location.lat !== parsed.context.location.lat ||
            s.context.location.lon !== parsed.context.location.lon
          );
          
          // If URL specifies a lunar date, convert to JD
          if (parsed.context.selectedLunarDate && parsed.context.location) {
            console.log('[AppStore] URL_CHANGED: URL has lunar date, computing JD');
            s.context.location = parsed.context.location;
            s.context.today = this._getTodayJD();
            
            const { year, month, day } = parsed.context.selectedLunarDate;
            const jd = this._lunarDateToJD(year, month, day, s.context);
            
            if (jd !== null) {
              s.context.selectedDate = jd;
              s.context.selectedLunarDate = null;
            } else {
              s.context.selectedLunarDate = parsed.context.selectedLunarDate;
            }
          } else if (locationChanged) {
            // Location changed but no lunar date - keep JD, clear lunar date
            console.log('[AppStore] URL_CHANGED: Location changed, keeping JD:', s.context.selectedDate);
            s.context.location = parsed.context.location;
            s.context.today = this._getTodayJD();
            s.context.selectedLunarDate = null;
          } else {
            // No lunar date, no location change - just apply parsed context
            Object.assign(s.context, parsed.context);
            s.context.today = this._getTodayJD();
          }
          
          s.content.view = parsed.content.view;
          s.content.params = parsed.content.params;
          Object.assign(s.ui, parsed.ui);
          
          console.log('[AppStore] URL_CHANGED: view =', s.content.view, 'selectedDate =', s.context.selectedDate);
        }
        
        setTimeout(() => { 
          this._urlSyncEnabled = true; 
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
    const oldConfig = this._derived.config;  // Save old config BEFORE updating
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
        dayStartAngle: profile.dayStartAngle ?? 12,
        yearStartRule: profile.yearStartRule || 'equinox',
        crescentThreshold: profile.crescentThreshold ?? 18
      });
      
      // Check if we need to regenerate the calendar
      // Regenerate if: year changed, location changed, profile/config changed, or no calendar yet
      let needsRegenerate = true;
      
      // Detect location change - calendar depends on location for:
      // - Virgo rule (sunrise time affects moon RA comparison)
      // - Day boundaries (sunrise/sunset times)
      // - Month boundaries (when day starts at different locations)
      const locationChanged = this._derived.calendarLocation && (
        Math.abs(this._derived.calendarLocation.lat - context.location.lat) > 0.001 ||
        Math.abs(this._derived.calendarLocation.lon - context.location.lon) > 0.001
      );
      
      // Check if profile settings affecting calendar have changed (compare old vs new)
      const configChanged = oldConfig && (
        oldConfig.moonPhase !== profile.moonPhase ||
        oldConfig.yearStartRule !== profile.yearStartRule ||
        oldConfig.dayStartTime !== profile.dayStartTime ||
        oldConfig.dayStartAngle !== profile.dayStartAngle
      );
      
      // Force regeneration if location or config changed
      if (locationChanged) {
        console.log('[AppStore] Location changed, FORCING calendar regeneration.');
        console.log('[AppStore]   Old location:', this._derived.calendarLocation);
        console.log('[AppStore]   New location:', context.location);
        needsRegenerate = true;
        
        // When location changes, keep the JD (absolute moment in time).
        // Clear selectedLunarDate so it gets re-resolved from JD in the new calendar.
        // The same JD may be a different lunar date at a different location.
        if (context.selectedLunarDate) {
          console.log('[AppStore] Location changed - clearing selectedLunarDate, keeping JD:', context.selectedDate);
          context.selectedLunarDate = null;
        }
      }
      if (configChanged) {
        console.log('[AppStore] Profile config changed, FORCING calendar regeneration.');
        console.log('[AppStore]   Old config:', oldConfig);
        console.log('[AppStore]   New yearStartRule:', profile.yearStartRule);
        needsRegenerate = true;
        
        // Similarly, clear selectedLunarDate when config changes - re-resolve from JD
        if (context.selectedLunarDate) {
          console.log('[AppStore] Config changed - clearing selectedLunarDate, keeping JD:', context.selectedDate);
          context.selectedLunarDate = null;
        }
      }
      
      // Only skip regeneration if we have a valid calendar AND nothing changed
      if (this._derived.lunarMonths && this._derived.lunarMonths.length > 0 && this._derived.year !== null && !locationChanged && !configChanged) {
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
          
          // Populate feasts and events only when calendar is regenerated
          this._populateDayData(this._derived.lunarMonths);
        }
        
        // Handle month = -1 (sentinel for "last month of year")
        // This is used when navigating backwards from month 1 to the previous year's last month
        if (context.selectedLunarDate && context.selectedLunarDate.month === -1) {
          const lastMonthNum = this._derived.lunarMonths.length;
          console.log('[AppStore] Month -1 requested, resolving to last month:', lastMonthNum);
          context.selectedLunarDate = {
            year: context.selectedLunarDate.year,
            month: lastMonthNum,
            day: context.selectedLunarDate.day || 1
          };
        }
        
        // Handle month 13 redirect: if requested month exceeds actual month count,
        // redirect to month 1 of the next year
        if (context.selectedLunarDate && 
            context.selectedLunarDate.month > this._derived.lunarMonths.length) {
          console.log('[AppStore] Month', context.selectedLunarDate.month, 'exceeds available months', 
                      this._derived.lunarMonths.length, '- redirecting to next year month 1');
          // Update to next year, month 1
          context.selectedLunarDate = {
            year: context.selectedLunarDate.year + 1,
            month: 1,
            day: context.selectedLunarDate.day || 1
          };
          // Regenerate calendar for the new year
          const newCalendar = this._engine.generateYear(context.selectedLunarDate.year, context.location);
          this._derived.year = context.selectedLunarDate.year;
          this._derived.lunarMonths = newCalendar.months || [];
          this._derived.calendarLocation = { ...context.location };
          this._derived.yearStartUncertainty = newCalendar.yearStartUncertainty;
          this._derived.springEquinox = newCalendar.springEquinox;
          // Re-populate day data for new calendar
          this._populateDayData(this._derived.lunarMonths);
          
          // Update URL to reflect the corrected date (use replaceState, not push)
          if (window.URLRouter) {
            setTimeout(() => {
              window.URLRouter.syncURL(this._state, this._derived, false);
              console.log('[AppStore] URL updated after month overflow redirect');
            }, 0);
          }
        }
        
        // Find current month index and lunar day
        // Use selectedLunarDate directly if available (source of truth), else compute from JD
        if (context.selectedLunarDate) {
          // Direct lunar date - no conversion needed
          this._derived.currentMonthIndex = context.selectedLunarDate.month - 1;  // Convert 1-based to 0-based
          this._derived.currentLunarDay = context.selectedLunarDate.day;
        } else {
          // Fall back to JD-based lookup (for "Today" button, location changes, etc.)
          const selectedResult = this._findMonthAndDay(
            context.selectedDate, 
            this._derived.lunarMonths
          );
          this._derived.currentMonthIndex = selectedResult.monthIndex;
          this._derived.currentLunarDay = selectedResult.lunarDay;
          
          // Sync selectedLunarDate to match the resolved position
          // This ensures URL always has accurate lunar date
          context.selectedLunarDate = {
            year: this._derived.year,
            month: selectedResult.monthIndex + 1,  // Convert 0-based to 1-based
            day: selectedResult.lunarDay
          };
          console.log('[AppStore] Resolved lunar date from JD:', context.selectedLunarDate);
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
    // But respect explicit replace flag from event
    let shouldPush;
    if (event.replace === true) {
      shouldPush = false;  // Explicit replace requested
    } else if (event.replace === false) {
      shouldPush = true;   // Explicit push requested
    } else {
      // Default behavior based on event type
      // These events should create browser history entries (enable back/forward)
      const pushEvents = [
        'SET_VIEW', 'SET_SELECTED_DATE', 'SET_PROFILE', 'SET_LOCATION', 
        'SELECT_DAY', 'SET_BIBLE_LOCATION', 'SET_GREGORIAN_DATETIME',
        'SET_TIMELINE_EVENT', 'SET_TIMELINE_DURATION', 'SET_TIMELINE_SEARCH',
        'SET_TIMELINE_FOCUSED_EVENT', 'SET_GLOBAL_SEARCH', 'CLOSE_GLOBAL_SEARCH'
      ];
      // Panel state uses replaceState (updates URL but doesn't create history entry)
      // This way sharing a URL preserves panel state, but toggling doesn't pollute history
      shouldPush = pushEvents.includes(event.type);
    }
    
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
  },
  
  /**
   * Populate feasts and events on each day object
   * Called after calendar generation
   * @param {Array} months - Array of lunar months from calendar engine
   */
  _populateDayData(months) {
    if (!months || months.length === 0) return;
    
    // Check if feast functions are available
    const hasFeastsModule = typeof getFeastsForDay === 'function';
    const hasEventsModule = typeof getBibleEvents === 'function';
    
    for (const month of months) {
      if (!month.days) continue;
      
      for (const day of month.days) {
        // Populate feasts
        if (hasFeastsModule) {
          day.feasts = getFeastsForDay(month.monthNumber, day.lunarDay);
        } else {
          day.feasts = [];
        }
        
        // Populate Bible events
        if (hasEventsModule) {
          const gregorianYear = day.gregorianDate?.getUTCFullYear();
          day.events = getBibleEvents(month.monthNumber, day.lunarDay, gregorianYear);
        } else {
          day.events = [];
        }
      }
    }
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppStore;
}
