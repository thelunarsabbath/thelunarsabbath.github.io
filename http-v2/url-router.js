/**
 * URLRouter - Bidirectional URL ↔ State Synchronization
 * 
 * URL Structure:
 *   /{profile}/{location}/{date}/{view}/{view-params}?{ui-params}
 * 
 * Examples:
 *   /time-tested/jerusalem/2025-01-29/calendar
 *   /time-tested/jerusalem/2025-01-29/bible/kjv/Genesis/1?strongs=H430
 *   /time-tested/jerusalem/2025-01-29/timeline
 */

const URLRouter = {
  
  // ═══════════════════════════════════════════════════════════════════════
  // CITY SLUGS - Location name to coordinates mapping
  // ═══════════════════════════════════════════════════════════════════════
  
  CITY_SLUGS: {
    // Biblical / Middle East
    'jerusalem': { lat: 31.7683, lon: 35.2137 },
    'bethlehem': { lat: 31.7054, lon: 35.2024 },
    'nazareth': { lat: 32.6996, lon: 35.3035 },
    'jericho': { lat: 31.8500, lon: 35.4500 },
    'hebron': { lat: 31.5326, lon: 35.0998 },
    'ramses': { lat: 30.7879, lon: 31.8332 },
    'goshen': { lat: 30.7833, lon: 31.5000 },
    'wilderness-of-sin': { lat: 29.1500, lon: 33.4000 },
    'cairo': { lat: 30.0444, lon: 31.2357 },
    'baghdad': { lat: 33.3152, lon: 44.3661 },
    'damascus': { lat: 33.5138, lon: 36.2765 },
    'amman': { lat: 31.9454, lon: 35.9284 },
    'beirut': { lat: 33.8938, lon: 35.5018 },
    'tel-aviv': { lat: 32.0853, lon: 34.7818 },
    'alexandria': { lat: 31.2001, lon: 29.9187 },
    'mt-sinai-saudi': { lat: 28.5653, lon: 35.4058 },
    'mecca': { lat: 21.4225, lon: 39.8262 },
    'medina': { lat: 24.5247, lon: 39.5692 },
    'riyadh': { lat: 24.7136, lon: 46.6753 },
    'istanbul': { lat: 41.0082, lon: 28.9784 },
    'tehran': { lat: 35.6892, lon: 51.3890 },
    'dubai': { lat: 25.2048, lon: 55.2708 },
    // North America
    'new-york': { lat: 40.7128, lon: -74.006 },
    'los-angeles': { lat: 34.0522, lon: -118.2437 },
    'chicago': { lat: 41.8781, lon: -87.6298 },
    'houston': { lat: 29.7604, lon: -95.3698 },
    'phoenix': { lat: 33.4484, lon: -112.074 },
    'philadelphia': { lat: 39.9526, lon: -75.1652 },
    'san-antonio': { lat: 29.4241, lon: -98.4936 },
    'san-diego': { lat: 32.7157, lon: -117.1611 },
    'dallas': { lat: 32.7767, lon: -96.7970 },
    'san-jose': { lat: 37.3382, lon: -121.8863 },
    'austin': { lat: 30.2672, lon: -97.7431 },
    'jacksonville': { lat: 30.3322, lon: -81.6557 },
    'fort-worth': { lat: 32.7555, lon: -97.3308 },
    'columbus': { lat: 39.9612, lon: -82.9988 },
    'charlotte': { lat: 35.2271, lon: -80.8431 },
    'san-francisco': { lat: 37.7749, lon: -122.4194 },
    'indianapolis': { lat: 39.7684, lon: -86.1581 },
    'seattle': { lat: 47.6062, lon: -122.3321 },
    'denver': { lat: 39.7392, lon: -104.9903 },
    'washington-dc': { lat: 38.9072, lon: -77.0369 },
    'boston': { lat: 42.3601, lon: -71.0589 },
    'nashville': { lat: 36.1627, lon: -86.7816 },
    'detroit': { lat: 42.3314, lon: -83.0458 },
    'portland': { lat: 45.5152, lon: -122.6784 },
    'las-vegas': { lat: 36.1699, lon: -115.1398 },
    'memphis': { lat: 35.1495, lon: -90.0490 },
    'louisville': { lat: 38.2527, lon: -85.7585 },
    'baltimore': { lat: 39.2904, lon: -76.6122 },
    'milwaukee': { lat: 43.0389, lon: -87.9065 },
    'albuquerque': { lat: 35.0844, lon: -106.6504 },
    'tucson': { lat: 32.2226, lon: -110.9747 },
    'atlanta': { lat: 33.749, lon: -84.388 },
    'miami': { lat: 25.7617, lon: -80.1918 },
    'minneapolis': { lat: 44.9778, lon: -93.2650 },
    'salt-lake-city': { lat: 40.7608, lon: -111.8910 },
    'anchorage': { lat: 61.2181, lon: -149.9003 },
    'honolulu': { lat: 21.3069, lon: -157.8583 },
    'toronto': { lat: 43.6532, lon: -79.3832 },
    'vancouver': { lat: 49.2827, lon: -123.1207 },
    'montreal': { lat: 45.5017, lon: -73.5673 },
    'mexico-city': { lat: 19.4326, lon: -99.1332 },
    // Europe
    'london': { lat: 51.5074, lon: -0.1278 },
    'paris': { lat: 48.8566, lon: 2.3522 },
    'berlin': { lat: 52.52, lon: 13.405 },
    'madrid': { lat: 40.4168, lon: -3.7038 },
    'rome': { lat: 41.9028, lon: 12.4964 },
    'vienna': { lat: 48.2082, lon: 16.3738 },
    'amsterdam': { lat: 52.3676, lon: 4.9041 },
    'brussels': { lat: 50.8503, lon: 4.3517 },
    'stockholm': { lat: 59.3293, lon: 18.0686 },
    'oslo': { lat: 59.9139, lon: 10.7522 },
    'copenhagen': { lat: 55.6761, lon: 12.5683 },
    'helsinki': { lat: 60.1699, lon: 24.9384 },
    'dublin': { lat: 53.3498, lon: -6.2603 },
    'lisbon': { lat: 38.7223, lon: -9.1393 },
    'barcelona': { lat: 41.3851, lon: 2.1734 },
    'munich': { lat: 48.1351, lon: 11.5820 },
    'milan': { lat: 45.4642, lon: 9.1900 },
    'zurich': { lat: 47.3769, lon: 8.5417 },
    'geneva': { lat: 46.2044, lon: 6.1432 },
    'moscow': { lat: 55.7558, lon: 37.6173 },
    'saint-petersburg': { lat: 59.9311, lon: 30.3609 },
    'kiev': { lat: 50.4501, lon: 30.5234 },
    'warsaw': { lat: 52.2297, lon: 21.0122 },
    'prague': { lat: 50.0755, lon: 14.4378 },
    'budapest': { lat: 47.4979, lon: 19.0402 },
    'bucharest': { lat: 44.4268, lon: 26.1025 },
    'athens': { lat: 37.9838, lon: 23.7275 },
    // Asia
    'tokyo': { lat: 35.6762, lon: 139.6503 },
    'osaka': { lat: 34.6937, lon: 135.5023 },
    'seoul': { lat: 37.5665, lon: 126.9780 },
    'beijing': { lat: 39.9042, lon: 116.4074 },
    'shanghai': { lat: 31.2304, lon: 121.4737 },
    'hong-kong': { lat: 22.3193, lon: 114.1694 },
    'taipei': { lat: 25.0330, lon: 121.5654 },
    'singapore': { lat: 1.3521, lon: 103.8198 },
    'bangkok': { lat: 13.7563, lon: 100.5018 },
    'kuala-lumpur': { lat: 3.1390, lon: 101.6869 },
    'jakarta': { lat: -6.2088, lon: 106.8456 },
    'manila': { lat: 14.5995, lon: 120.9842 },
    'hanoi': { lat: 21.0285, lon: 105.8542 },
    'ho-chi-minh': { lat: 10.8231, lon: 106.6297 },
    'mumbai': { lat: 19.0760, lon: 72.8777 },
    'new-delhi': { lat: 28.6139, lon: 77.209 },
    'delhi': { lat: 28.6139, lon: 77.209 },
    'bangalore': { lat: 12.9716, lon: 77.5946 },
    'kolkata': { lat: 22.5726, lon: 88.3639 },
    'chennai': { lat: 13.0827, lon: 80.2707 },
    'karachi': { lat: 24.8607, lon: 67.0011 },
    'lahore': { lat: 31.5204, lon: 74.3587 },
    'dhaka': { lat: 23.8103, lon: 90.4125 },
    // Oceania
    'sydney': { lat: -33.8688, lon: 151.2093 },
    'melbourne': { lat: -37.8136, lon: 144.9631 },
    'brisbane': { lat: -27.4698, lon: 153.0251 },
    'perth': { lat: -31.9505, lon: 115.8605 },
    'auckland': { lat: -36.8485, lon: 174.7633 },
    'wellington': { lat: -41.2865, lon: 174.7762 },
    // South America
    'sao-paulo': { lat: -23.5505, lon: -46.6333 },
    'rio-de-janeiro': { lat: -22.9068, lon: -43.1729 },
    'buenos-aires': { lat: -34.6037, lon: -58.3816 },
    'bogota': { lat: 4.7110, lon: -74.0721 },
    'lima': { lat: -12.0464, lon: -77.0428 },
    'santiago': { lat: -33.4489, lon: -70.6693 },
    'caracas': { lat: 10.4806, lon: -66.9036 },
    // Africa
    'johannesburg': { lat: -26.2041, lon: 28.0473 },
    'cape-town': { lat: -33.9249, lon: 18.4241 },
    'lagos': { lat: 6.5244, lon: 3.3792 },
    'nairobi': { lat: -1.2921, lon: 36.8219 },
    'addis-ababa': { lat: 9.0320, lon: 38.7469 },
    'casablanca': { lat: 33.5731, lon: -7.5898 },
    'tunis': { lat: 36.8065, lon: 10.1815 },
    'algiers': { lat: 36.7538, lon: 3.0588 },
    'accra': { lat: 5.6037, lon: -0.1870 },
    'dakar': { lat: 14.7167, lon: -17.4677 }
  },
  
  // Reverse lookup
  COORDS_TO_SLUG: {},
  
  // ═══════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════
  
  init() {
    // Build reverse lookup
    for (const [slug, coords] of Object.entries(this.CITY_SLUGS)) {
      this.COORDS_TO_SLUG[`${coords.lat},${coords.lon}`] = slug;
    }
    
    // Listen for browser navigation
    window.addEventListener('popstate', () => {
      AppStore.dispatch({ type: 'URL_CHANGED', url: window.location });
    });
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // URL → STATE (Parsing)
  // ═══════════════════════════════════════════════════════════════════════
  
  // Known view names for URL parsing
  VIEW_NAMES: ['calendar', 'bible', 'timeline', 'book', 'events', 'priestly', 'sabbath-tester', 'settings', 'tutorial', 'feasts'],
  
  /**
   * Parse URL into state
   * @param {Location|URL|string} url - URL to parse
   * @returns {Object} Parsed state { context, content, ui }
   */
  parseURL(url) {
    if (typeof url === 'string') {
      url = new URL(url, window.location.origin);
    }
    
    const pathname = url.pathname;
    const searchParams = url.searchParams || new URLSearchParams(url.search);
    
    // Split path into segments
    const parts = pathname.split('/').filter(Boolean);
    
    // Default state
    const result = {
      context: {
        profileId: 'timeTested',
        location: { lat: 31.7683, lon: 35.2137 },  // Jerusalem coordinates
        selectedDate: this._todayJD()
      },
      content: {
        view: 'calendar',
        params: {}
      },
      ui: {
        strongsId: null,
        searchQuery: null,
        personId: null,
        interlinearVerse: null,
        timelineEventId: null,
        timelineDurationId: null,
        eventsSearch: null,
        eventsType: 'all',
        eventsEra: 'all',
        eventsViewMode: 'list'
      }
    };
    
    // No path segments - use defaults (calendar)
    if (parts.length === 0) {
      console.log('[URLRouter] parseURL: No path segments, defaulting to calendar');
      return result;
    }
    
    let idx = 0;
    
    console.log('[URLRouter] parseURL: parts =', parts, 'first part =', parts[idx], 'in VIEW_NAMES?', this.VIEW_NAMES.includes(parts[idx]));
    
    // Check if first segment is a known view name (simple URL like /bible)
    if (this.VIEW_NAMES.includes(parts[idx])) {
      result.content.view = parts[idx];
      idx++;
      // Parse remaining as view params
      result.content.params = this._parseViewParams(result.content.view, parts.slice(idx));
      // Parse query params
      this._parseQueryParams(searchParams, result);
      console.log('[URLRouter] parseURL: Matched view name, returning view =', result.content.view);
      return result;
    }
    
    // Otherwise, try full format: /{profile}/{location}/{date}/{view}/{params}
    
    // Parse profile (first segment)
    if (parts[idx] && !this._isDateString(parts[idx]) && !this.CITY_SLUGS[parts[idx]]) {
      result.context.profileId = this._parseProfileSlug(parts[idx]);
      idx++;
    }
    
    // Parse location (second segment) - convert slug to coordinates
    if (parts[idx] && this.CITY_SLUGS[parts[idx]]) {
      const coords = this.CITY_SLUGS[parts[idx]];
      result.context.location = { lat: coords.lat, lon: coords.lon };
      idx++;
    } else if (parts[idx] && parts[idx].includes(',')) {
      // Custom coordinates in URL: "31.77,35.21" - store as-is
      const [lat, lon] = parts[idx].split(',').map(parseFloat);
      if (!isNaN(lat) && !isNaN(lon)) {
        result.context.location = { lat, lon };
        idx++;
      }
    }
    
    // Parse year (third segment) - supports 2026, 123BC, 123bc formats
    // URL is ALWAYS lunar dates: /profile/location/year/month/day
    if (parts[idx] && /^-?\d+(bc)?$/i.test(parts[idx])) {
      const year = this._parseYearFromURL(parts[idx]);
      idx++;
      
      // Parse lunar month and day - defaults to Nisan 1 (month 1, day 1)
      let lunarMonth = 1;  // Default: Nisan
      let lunarDay = 1;    // Default: Day 1
      
      // Parse lunar month (fourth segment, optional) - 1-based in URL
      if (parts[idx] && /^\d+$/.test(parts[idx]) && !this.VIEW_NAMES.includes(parts[idx])) {
        lunarMonth = parseInt(parts[idx]);
        idx++;
        
        // Parse lunar day (fifth segment, optional)
        if (parts[idx] && /^\d+$/.test(parts[idx]) && !this.VIEW_NAMES.includes(parts[idx])) {
          lunarDay = parseInt(parts[idx]);
          idx++;
        }
      }
      
      // Set selectedLunarDate directly - this is THE source of truth
      // No Gregorian/JD conversion here - everything is lunar
      result.context.selectedLunarDate = { year, month: lunarMonth, day: lunarDay };
      
      // selectedDate (JD) will be computed by AppStore from the lunar date
      // after the calendar is generated - don't set it here
    }
    
    // Parse view (next segment) - optional for calendar
    if (parts[idx]) {
      // Check if it's a known view
      if (this.VIEW_NAMES.includes(parts[idx])) {
        result.content.view = parts[idx].toLowerCase();
        idx++;
        // Parse view-specific params
        const remainingParts = parts.slice(idx);
        Object.assign(result.content.params, this._parseViewParams(result.content.view, remainingParts));
      } else {
        // Unknown segment after date = calendar view
        result.content.view = 'calendar';
      }
    } else {
      // Only profile/location/year[/month[/day]] = calendar view
      result.content.view = 'calendar';
    }
    
    // Parse query params (UI state)
    this._parseQueryParams(searchParams, result);
    
    return result;
  },
  
  /**
   * Parse query parameters into result state
   */
  _parseQueryParams(searchParams, result) {
    if (searchParams.get('strongs')) {
      result.ui.strongsId = searchParams.get('strongs');
    }
    if (searchParams.get('search')) {
      result.ui.searchQuery = searchParams.get('search');
    }
    if (searchParams.get('person')) {
      result.ui.personId = searchParams.get('person');
    }
    if (searchParams.get('verse')) {
      result.content.params.verse = parseInt(searchParams.get('verse'));
    }
    if (searchParams.get('il')) {
      result.ui.interlinearVerse = parseInt(searchParams.get('il'));
    }
    if (searchParams.get('event')) {
      result.ui.timelineEventId = searchParams.get('event');
    }
    if (searchParams.get('duration')) {
      result.ui.timelineDurationId = searchParams.get('duration');
    }
    // Events page filters
    if (searchParams.get('eq')) {
      result.ui.eventsSearch = searchParams.get('eq');
    }
    if (searchParams.get('et')) {
      result.ui.eventsType = searchParams.get('et');
    }
    if (searchParams.get('ee')) {
      result.ui.eventsEra = searchParams.get('ee');
    }
    if (searchParams.get('ev')) {
      result.ui.eventsViewMode = searchParams.get('ev');
    }
  },
  
  /**
   * Parse view-specific URL parameters
   */
  _parseViewParams(view, parts) {
    const params = {};
    
    switch (view) {
      case 'calendar':
        // /calendar/3/15 → month 3, day 15
        if (parts[0]) params.monthIndex = parseInt(parts[0]);
        if (parts[1]) params.selectedDay = parseInt(parts[1]);
        break;
        
      case 'bible':
        // /bible/kjv/Genesis/1/5 → KJV, Genesis, Chapter 1, Verse 5
        if (parts[0]) params.translation = parts[0];
        if (parts[1]) params.book = decodeURIComponent(parts[1]);
        if (parts[2]) params.chapter = parseInt(parts[2]);
        if (parts[3]) params.verse = parseInt(parts[3]);
        break;
        
      case 'book':
        // /book/01_Introduction
        if (parts[0]) params.chapterId = parts[0];
        break;
        
      case 'timeline':
        // event or duration ID from query params
        break;
        
      case 'events':
        if (parts[0]) params.eventId = parts[0];
        break;
        
      case 'priestly':
        // No additional params
        break;
        
      case 'sabbath-tester':
        // No additional params
        break;
        
      case 'settings':
        if (parts[0]) params.tab = parts[0];
        break;
        
      case 'tutorial':
        // No additional params
        break;
    }
    
    return params;
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // STATE → URL (Building)
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Build URL from state
   * Uses simple URLs like /bible/kjv/Genesis/1 for most views
   * Calendar view uses full context: /time-tested/jerusalem/2025-01-29/calendar
   * @param {Object} state - Current app state
   * @returns {string} URL path with query string
   */
  buildURL(state, derived) {
    const { context, content, ui } = state;
    
    let path = '';
    
    // Calendar shows: /profile/location/year/month/day (always include month/day)
    if (content.view === 'calendar') {
      path = '/' + this._getProfileSlug(context.profileId);
      path += '/' + this._getLocationSlug(context.location);
      
      // Use selectedLunarDate directly if available (source of truth)
      // This avoids JD round-trip conversion issues
      if (context.selectedLunarDate) {
        path += '/' + this._formatYearForURL(context.selectedLunarDate.year);
        path += '/' + context.selectedLunarDate.month;  // Already 1-based
        path += '/' + context.selectedLunarDate.day;
      } else {
        // Fall back to derived state for JD-based dates (Today button, etc.)
        const year = derived?.year ?? this._julianToGregorian(context.selectedDate).year;
        path += '/' + this._formatYearForURL(year);
        const monthIndex = derived?.currentMonthIndex ?? 0;
        const lunarDay = derived?.currentLunarDay ?? 1;
        path += '/' + (monthIndex + 1);  // Convert 0-based to 1-based for URL
        path += '/' + lunarDay;
      }
    } 
    // Other views use simple URLs
    else {
      path = '/' + content.view;
      path += this._buildViewParams(content.view, content.params);
    }
    
    // Query params (UI state)
    const params = new URLSearchParams();
    if (ui.strongsId) params.set('strongs', ui.strongsId);
    if (ui.searchQuery) params.set('search', ui.searchQuery);
    if (ui.personId) params.set('person', ui.personId);
    if (content.params.verse && content.view === 'bible') {
      params.set('verse', content.params.verse);
    }
    if (ui.interlinearVerse && content.view === 'bible') {
      params.set('il', ui.interlinearVerse);
    }
    if (ui.timelineEventId && content.view === 'timeline') {
      params.set('event', ui.timelineEventId);
    }
    if (ui.timelineDurationId && content.view === 'timeline') {
      params.set('duration', ui.timelineDurationId);
    }
    // Events page filters
    if (content.view === 'events') {
      if (ui.eventsSearch) params.set('eq', ui.eventsSearch);
      if (ui.eventsType && ui.eventsType !== 'all') params.set('et', ui.eventsType);
      if (ui.eventsEra && ui.eventsEra !== 'all') params.set('ee', ui.eventsEra);
      if (ui.eventsViewMode && ui.eventsViewMode !== 'list') params.set('ev', ui.eventsViewMode);
    }
    
    const queryString = params.toString();
    return path + (queryString ? '?' + queryString : '');
  },
  
  /**
   * Build view-specific URL path segments
   */
  _buildViewParams(view, params) {
    switch (view) {
      case 'calendar':
        // Calendar params are handled in buildURL directly
        return '';
        
      case 'bible':
        let biblePath = '';
        if (params.translation) biblePath += '/' + params.translation;
        if (params.book) biblePath += '/' + encodeURIComponent(params.book);
        if (params.chapter) biblePath += '/' + params.chapter;
        // verse goes in query params
        return biblePath;
        
      case 'book':
        if (params.chapterId) return '/' + params.chapterId;
        return '';
        
      case 'events':
        if (params.eventId) return '/' + params.eventId;
        return '';
        
      case 'settings':
        if (params.tab) return '/' + params.tab;
        return '';
        
      default:
        return '';
    }
  },
  
  /**
   * Sync URL with current state
   * @param {Object} state - Current state
   * @param {boolean} push - Use pushState (true) or replaceState (false)
   */
  syncURL(state, derived, push = true) {
    try {
      const newURL = this.buildURL(state, derived);
      const currentURL = window.location.pathname + window.location.search;
      
      console.log('[URLRouter] syncURL:', { newURL, currentURL, push, view: state.content.view });
      
      if (newURL !== currentURL) {
        if (push) {
          history.pushState({}, '', newURL);
        } else {
          history.replaceState({}, '', newURL);
        }
        console.log('[URLRouter] URL updated to:', newURL);
      }
    } catch (e) {
      console.error('[URLRouter] syncURL error:', e);
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  _parseProfileSlug(slug) {
    // Map URL slugs to profile IDs
    const mapping = {
      'time-tested': 'timeTested',
      'timetested': 'timeTested',
      'ancient': 'ancientTraditional',
      'ancient-traditional': 'ancientTraditional',
      '119': 'ministries119',
      '119-ministries': 'ministries119',
      'creators': 'creatorsCalendar',
      'creators-calendar': 'creatorsCalendar',
      'traditional-lunar': 'traditionalLunar',
      'lunar': 'traditionalLunar'
    };
    return mapping[slug.toLowerCase()] || slug;
  },
  
  _getProfileSlug(profileId) {
    // Map profile IDs to URL slugs
    const mapping = {
      'timeTested': 'time-tested',
      'ancientTraditional': 'ancient',
      'ministries119': '119-ministries',
      'creatorsCalendar': 'creators-calendar',
      'traditionalLunar': 'traditional-lunar'
    };
    return mapping[profileId] || profileId;
  },
  
  _getLocationSlug(location) {
    // ALWAYS find the nearest city - URL should always show a pretty name
    if (!location || typeof location.lat !== 'number' || typeof location.lon !== 'number') {
      return 'jerusalem';  // Default fallback
    }
    
    let nearestSlug = 'jerusalem';  // Ultimate fallback
    let nearestDistance = Infinity;
    
    for (const [slug, coords] of Object.entries(this.CITY_SLUGS)) {
      const distance = this._haversineDistance(location.lat, location.lon, coords.lat, coords.lon);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestSlug = slug;
      }
    }
    
    return nearestSlug;
  },
  
  _haversineDistance(lat1, lon1, lat2, lon2) {
    // Calculate distance in km between two points
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },
  
  _findNearestCity(lat, lon, maxDistanceKm) {
    let nearestCity = null;
    let nearestDistance = Infinity;
    
    for (const [slug, coords] of Object.entries(this.CITY_SLUGS)) {
      const distance = this._haversineDistance(lat, lon, coords.lat, coords.lon);
      if (distance < nearestDistance && distance <= maxDistanceKm) {
        nearestDistance = distance;
        nearestCity = { slug, lat: coords.lat, lon: coords.lon };
      }
    }
    
    return nearestCity;
  },
  
  _isDateString(str) {
    // Check if string looks like a date: YYYY-MM-DD or YYYY
    return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(str);
  },
  
  _parseYearFromURL(str) {
    // Use YearUtils for standardized conversion
    // URL: "1446bc" → internal: -1445 (astronomical)
    if (typeof YearUtils !== 'undefined') {
      return YearUtils.parseFromURL(str);
    }
    // Fallback if YearUtils not loaded
    const upper = str.toUpperCase();
    if (upper.endsWith('BC')) {
      const displayYear = parseInt(upper.replace('BC', ''));
      return 1 - displayYear; // Astronomical: 1446 BC = -1445
    }
    return parseInt(str);
  },
  
  _formatYearForURL(year) {
    // Use YearUtils for standardized conversion
    // Internal: -1445 → URL: "1446bc"
    if (typeof YearUtils !== 'undefined') {
      return YearUtils.formatForURL(year);
    }
    // Fallback if YearUtils not loaded
    if (year <= 0) {
      const displayYear = 1 - year; // Astronomical: -1445 → 1446 BC
      return displayYear + 'bc';
    }
    return String(year);
  },
  
  _parseDateToJD(dateStr) {
    // Parse YYYY-MM-DD or YYYY to Julian Day
    const parts = dateStr.split('-').map(p => parseInt(p));
    const year = parts[0];
    const month = parts[1] || 1;
    const day = parts[2] || 1;
    
    // Gregorian to JD
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    
    let jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + 
             Math.floor(y / 4) - Math.floor(y / 100) + 
             Math.floor(y / 400) - 32045;
    
    // Add noon (0.5) to get midday
    return jd + 0.5;
  },
  
  _formatDateForURL(jd) {
    // Convert JD to YYYY-MM-DD
    const date = this._julianToGregorian(jd);
    const year = date.year;
    const month = String(date.month).padStart(2, '0');
    const day = String(date.day).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  _todayJD() {
    // Delegate to AppStore's method to avoid duplication
    if (typeof AppStore !== 'undefined' && AppStore._dateToJulian) {
      return AppStore._dateToJulian(new Date());
    }
    // Fallback for initialization before AppStore is ready
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    const d = now.getUTCDate();
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    let jd = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + 
             Math.floor(yy / 4) - Math.floor(yy / 100) + 
             Math.floor(yy / 400) - 32045;
    return jd + 0.5;
  },
  
  _dateToJD(date) {
    // Delegate to AppStore's method to avoid duplication
    if (typeof AppStore !== 'undefined' && AppStore._dateToJulian) {
      return AppStore._dateToJulian(date);
    }
    // Fallback - handles both Julian (pre-1582) and Gregorian calendars
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    let jdn;
    if (y < 1582 || (y === 1582 && (m < 10 || (m === 10 && d < 15)))) {
      // Julian calendar
      jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
    } else {
      // Gregorian calendar
      jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + 
            Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
    }
    return jdn + 0.5;
  },
  
  _julianToGregorian(jd) {
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
    
    return { year, month, day };
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // NAVIGATION HELPERS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Navigate to a specific view
   * @param {string} view - View name
   * @param {Object} params - View parameters
   */
  navigateTo(view, params = {}) {
    AppStore.dispatch({ type: 'SET_VIEW', view, params });
  },
  
  /**
   * Navigate to a specific date
   * @param {number} jd - Julian Day
   */
  navigateToDate(jd) {
    AppStore.dispatch({ type: 'SET_SELECTED_DATE', jd });
  },
  
  /**
   * Navigate to today
   */
  navigateToToday() {
    AppStore.dispatch(AppStore.getTodayEvent());
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = URLRouter;
}

// Make available globally
window.URLRouter = URLRouter;
