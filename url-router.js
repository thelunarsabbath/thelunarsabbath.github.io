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

  // Option C: human-readable multiverse slugs
  // One path segment per reference: Book.Chapter.VerseSpec (spaces→hyphen, comma→dot, abbrev OK)
  // e.g. Jer.52.12-13 / 2-Kings.25.8-9  or  Jer.52.12.15.19-21 for 12,15,19-21
  _encodeMultiverseSegments(citation) {
    // Delegate to Bible API — normalizes abbreviations and produces canonical URL segments
    if (typeof Bible !== 'undefined' && Bible.citationToUrlSegments) {
      return Bible.citationToUrlSegments(citation);
    }
    // Fallback if Bible API not loaded yet
    if (!citation || typeof citation !== 'string') return [];
    const refs = citation.split(/\s*[+;]\s*/).map(s => s.trim()).filter(Boolean);
    const segments = [];
    for (const ref of refs) {
      const match = ref.match(/^(.+?)\s+(\d+):(.+)$/);
      if (!match) continue;
      const [, book, chapter, verseSpec] = match;
      const bookSlug = book.trim().replace(/\s+/g, '-');
      const verseSlug = verseSpec.replace(/,/g, '.').replace(/\s+/g, '');
      segments.push(bookSlug + '.' + chapter + '.' + verseSlug);
    }
    return segments;
  },
  _decodeMultiverse(segments) {
    // Delegate to Bible API — normalizes book names on decode
    if (typeof Bible !== 'undefined' && Bible.urlSegmentsToCitation) {
      return Bible.urlSegmentsToCitation(segments);
    }
    // Fallback if Bible API not loaded yet
    if (!Array.isArray(segments) || segments.length === 0) return '';
    const refs = [];
    for (const segment of segments) {
      const parts = segment.split('.');
      if (parts.length < 2) continue;
      const verseParts = [];
      while (parts.length > 2 && /^\d+(-\d+)?$/.test(parts[parts.length - 1])) {
        verseParts.unshift(parts.pop());
      }
      if (parts.length === 0 || verseParts.length === 0) continue;
      const chapter = parts.pop();
      if (!/^\d+$/.test(chapter)) continue;
      const book = parts.join(' ').replace(/-/g, ' ');
      const verseSpec = verseParts.join(',');
      refs.push(book + ' ' + chapter + ':' + verseSpec);
    }
    return refs.join('; ');
  },
  
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
    
    // Listen for browser navigation (pass href so parseURL gets a string and parses consistently)
    window.addEventListener('popstate', (event) => {
      AppStore.dispatch({ type: 'URL_CHANGED', url: window.location.href });
      
      // Restore scroll position from history state — but NOT if the URL targets a specific verse,
      // because the verse-scroll in openBibleExplorerTo should take priority
      const hasVerseTarget = new URLSearchParams(window.location.search).has('verse');
      if (!hasVerseTarget && event.state && event.state.scrollTop !== undefined) {
        setTimeout(() => {
          const textArea = document.getElementById('bible-explorer-text');
          if (textArea) {
            textArea.scrollTop = event.state.scrollTop;
          }
          // Restore Strong's sidebar scroll position too
          if (event.state.strongsScrollTop !== undefined) {
            const strongsSidebar = document.querySelector('#strongs-sidebar .strongs-sidebar-content');
            if (strongsSidebar) {
              strongsSidebar.scrollTop = event.state.strongsScrollTop;
            }
          }
        }, 300); // Wait for content to render
      }
    });
    
    // Save scroll position before navigating away
    window.addEventListener('beforeunload', () => {
      this.saveScrollPosition();
    });
  },
  
  // Save current scroll position to history state (both reader pane and Strong's sidebar)
  saveScrollPosition() {
    const textArea = document.getElementById('bible-explorer-text');
    if (textArea) {
      const scrollTop = textArea.scrollTop;
      const strongsSidebar = document.querySelector('#strongs-sidebar .strongs-sidebar-content');
      const strongsScrollTop = strongsSidebar ? strongsSidebar.scrollTop : 0;
      const state = { ...history.state, scrollTop, strongsScrollTop };
      history.replaceState(state, '', window.location.href);
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // URL → STATE (Parsing)
  // ═══════════════════════════════════════════════════════════════════════
  
  // Known view names for URL parsing
  VIEW_NAMES: ['calendar', 'reader', 'bible', 'timeline', 'book', 'symbols', 'priestly', 'sabbath-tester', 'settings', 'tutorial', 'help', 'feasts', 'events', 'blog'],
  
  /**
   * Parse URL into state
   * @param {Location|URL|string} url - URL to parse
   * @returns {Object} Parsed state { context, content, ui }
   */
  parseURL(url) {
    if (!url) url = window.location;
    if (typeof url === 'object' && url.href !== undefined) {
      url = url.href;
    }
    if (typeof url === 'string') {
      url = new URL(url, window.location.origin);
    }
    
    const pathname = url.pathname;
    const searchParams = url.searchParams || new URLSearchParams(url.search || '');
    
    // Split path into segments
    const parts = pathname.split('/').filter(Boolean);
    
    // Get saved profile preference (default to timeTested)
    let defaultProfileId = 'timeTested';
    try {
      const savedProfile = localStorage.getItem('defaultCalendarProfile');
      if (savedProfile && window.PROFILES?.[savedProfile]) {
        defaultProfileId = savedProfile;
      }
    } catch (e) {}
    
    // Default state
    const result = {
      context: {
        profileId: defaultProfileId,
        location: { lat: 31.7683, lon: 35.2137 },  // Jerusalem coordinates
        selectedDate: this._todayJD()
      },
      content: {
        view: 'calendar',
        params: {}
      },
      ui: {
        strongsId: null,
        gematriaExpanded: false,
        searchQuery: null,
        personId: null,
        interlinearVerse: null,
        timelineEventId: null,
        timelineDurationId: null,
        timelineFocusedEventId: null,
        timelineZoom: null,
        timelineCenterYear: null,
        timelineSearch: null,
        eventsSearch: null,
        eventsType: 'all',
        eventsEra: 'all',
        eventsViewMode: 'list',
        globalSearchQuery: null,
        globalSearchCollapsed: { events: false, bible: false }
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
      // Apply view redirects (e.g. /priestly → calendar with panel open)
      this._applyViewRedirects(result);
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
    
    // Apply view redirects (e.g. /priestly → calendar with panel open)
    this._applyViewRedirects(result);
    
    return result;
  },
  
  /**
   * Parse query parameters into result state
   */
  _parseQueryParams(searchParams, result) {
    if (searchParams.get('strongs')) {
      result.ui.strongsId = searchParams.get('strongs');
    }
    if (searchParams.get('gematria')) {
      result.ui.gematriaExpanded = searchParams.get('gematria') === '1';
    }
    // Global search query
    if (searchParams.get('q')) {
      result.ui.globalSearchQuery = searchParams.get('q');
    }
    // Global search collapsed sections (e.g., "events" or "events,bible")
    if (searchParams.get('collapsed')) {
      const collapsedSections = searchParams.get('collapsed').split(',');
      result.ui.globalSearchCollapsed = {
        events: collapsedSections.includes('events'),
        bible: collapsedSections.includes('bible')
      };
    }
    // Parse 'search' param based on view context
    if (searchParams.get('search')) {
      if (result.content.view === 'timeline') {
        result.ui.timelineSearch = searchParams.get('search');
      } else if (result.content.view === 'reader') {
        result.ui.searchQuery = searchParams.get('search');
      }
      // For other views, ignore 'search' param
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
    // Timeline-specific params (only parse on timeline view)
    if (result.content.view === 'timeline') {
      if (searchParams.get('event')) {
        result.ui.timelineEventId = searchParams.get('event');
      }
      if (searchParams.get('duration')) {
        result.ui.timelineDurationId = searchParams.get('duration');
      }
      if (searchParams.get('focus')) {
        result.ui.timelineFocusedEventId = searchParams.get('focus');
      }
      if (searchParams.get('zoom')) {
        const zoom = parseFloat(searchParams.get('zoom'));
        if (!isNaN(zoom) && zoom > 0) {
          result.ui.timelineZoom = zoom;
        }
      }
      if (searchParams.get('year')) {
        const year = parseInt(searchParams.get('year'));
        if (!isNaN(year)) {
          result.ui.timelineCenterYear = year;
        }
      }
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
    // Calendar panel state (only on calendar view)
    if (searchParams.get('panel')) {
      const panel = searchParams.get('panel');
      if (panel === 'feasts') {
        result.ui.feastsPanel = true;
      } else if (panel === 'priestly') {
        result.ui.priestlyPanel = true;
      }
    }
    // Time for calendar view (format: HHMM in local time, e.g., 1430 for 2:30 PM)
    // URL time is displayed in local time, convert to UTC for storage
    if (searchParams.get('t')) {
      const timeStr = searchParams.get('t');
      if (timeStr.length === 4) {
        const hours = parseInt(timeStr.substring(0, 2));
        const minutes = parseInt(timeStr.substring(2, 4));
        if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
          const localTime = { hours, minutes };
          // Convert local time to UTC using location from URL (or default)
          const location = result.context.location || { lat: 31.7683, lon: 35.2137 };
          if (typeof AppStore !== 'undefined' && AppStore.localToUtc) {
            const now = new Date(); // Approximate date for timezone calc
            result.context.utcTime = AppStore.localToUtc(localTime, now, location);
          } else {
            // Fallback: store as-is if AppStore not available yet
            result.context.utcTime = localTime;
          }
        }
      }
    }
    // Date calculator state (calendar view)
    // Format: ?calc=add.lunar.3mo.7wk or ?calc=sub.greg.2yr.1mo.5dy
    if (searchParams.get('calc')) {
      const parts = searchParams.get('calc').split('.');
      result.ui.calcOpen = true;
      result.ui.calcDir = parts[0] === 'sub' ? 'sub' : 'add';
      result.ui.calcMode = parts[1] === 'greg' ? 'gregorian' : 'lunar';
      for (let i = 2; i < parts.length; i++) {
        const match = parts[i].match(/^(\d+)(yr|mo|wk|dy)$/);
        if (match) {
          const val = parseInt(match[1]) || 0;
          if (match[2] === 'yr') result.ui.calcYears = val;
          else if (match[2] === 'mo') result.ui.calcMonths = val;
          else if (match[2] === 'wk') result.ui.calcWeeks = val;
          else if (match[2] === 'dy') result.ui.calcDays = val;
        }
      }
    }
  },
  
  /**
   * Redirect shortcut views to their canonical view + UI state.
   * e.g. /priestly → calendar with priestly panel open
   */
  _applyViewRedirects(result) {
    if (result.content.view === 'priestly') {
      result.content.view = 'calendar';
      result.content.params = {};
      result.ui.priestlyPanel = true;
    } else if (result.content.view === 'feasts') {
      result.content.view = 'calendar';
      result.content.params = {};
      result.ui.feastsPanel = true;
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
        // Check if first part is a valid translation or a book name
        const knownTranslations = typeof Bible !== 'undefined'
          ? Bible.getTranslations().map(t => t.id)
          : ['kjv', 'asv', 'akjv', 'ylt', 'dbt', 'drb', 'jps', 'slt', 'wbt', 'lxx'];
        let partIndex = 0;

        if (parts[0] && knownTranslations.includes(parts[0].toLowerCase())) {
          params.translation = parts[0].toLowerCase();
          partIndex = 1;
        }
        // No localStorage fallback — URL is source of truth
        
        if (parts[partIndex]) params.book = decodeURIComponent(parts[partIndex]);
        if (parts[partIndex + 1]) params.chapter = parseInt(parts[partIndex + 1]);
        if (parts[partIndex + 2]) params.verse = parseInt(parts[partIndex + 2]);
        break;
        
      case 'book':
        // /book/01_Introduction (legacy, redirects to reader)
        if (parts[0]) params.chapterId = parts[0];
        break;
      
      case 'symbols':
        // /symbols/tree (legacy, redirects to reader)
        if (parts[0]) params.symbol = parts[0].toLowerCase();
        break;
      
      case 'reader':
        // /reader/bible/kjv/Genesis/1
        // /reader/symbols/tree
        // /reader/timetested/chapter-slug
        if (!parts[0]) break;
        
        const contentType = parts[0].toLowerCase();
        params.contentType = contentType;
        
        if (contentType === 'bible') {
          // Parse bible params: /reader/bible/kjv/Genesis/1
          // URL is source of truth — no localStorage fallback for translation.
          // /reader/bible → translation picker (no translation set)
          // /reader/bible/kjv → book index (translation set, no book)
          // /reader/bible/kjv/Genesis/1 → chapter view
          const bibleParts = parts.slice(1).filter(Boolean);
          const knownTranslationsReader = typeof Bible !== 'undefined'
            ? Bible.getTranslations().map(t => t.id)
            : ['kjv', 'asv', 'akjv', 'ylt', 'dbt', 'drb', 'jps', 'slt', 'wbt', 'lxx'];
          let bibleIdx = 0;

          if (bibleParts.length > 0 && knownTranslationsReader.includes(bibleParts[0].toLowerCase())) {
            params.translation = bibleParts[0].toLowerCase();
            bibleIdx = 1;
          }
          // If first part is not a known translation but there are parts (book/chapter),
          // use the configured default translation instead of showing the picker
          if (!params.translation && bibleParts.length > 0) {
            params.translation = typeof Bible !== 'undefined'
              ? Bible.getDefaultTranslation()
              : 'kjv';
          }

          if (bibleParts[bibleIdx]) params.book = decodeURIComponent(bibleParts[bibleIdx]);
          if (bibleParts[bibleIdx + 1]) params.chapter = parseInt(bibleParts[bibleIdx + 1]);
          if (bibleParts[bibleIdx + 2]) params.verse = parseInt(bibleParts[bibleIdx + 2]);
        } else if (contentType === 'symbols') {
          // Parse symbol: /reader/symbols/tree
          if (parts[1]) params.symbol = parts[1].toLowerCase();
        } else if (contentType === 'symbols-article') {
          // Parse symbol article: /reader/symbols-article/HOW-SCRIPTURE-TEACHES
          if (parts[1]) params.article = parts[1];
        } else if (contentType === 'words') {
          // Parse word study: /reader/words/H2320
          if (parts[1]) params.word = parts[1].toUpperCase();
        } else if (contentType === 'numbers') {
          // Parse number study: /reader/numbers/666 or /reader/numbers/GEMATRIA
          if (parts[1]) params.number = parts[1].toUpperCase();
        } else if (contentType === 'verse-studies') {
          // Parse verse study: /reader/verse-studies/DANIEL-9
          if (parts[1]) params.study = parts[1];
        } else if (contentType === 'timetested') {
          // Parse book chapter: /reader/timetested/chapter-slug
          if (parts[1]) params.chapterId = parts[1];
        } else if (contentType === 'philo') {
          // Parse philo: /reader/philo/{work-slug}/{section}
          if (parts[1]) params.work = parts[1]; // work slug
          if (parts[2]) params.section = parts[2];
        } else if (contentType === 'josephus') {
          // Parse josephus: /reader/josephus/{work-slug}/{book}/{chapter}/{section}
          if (parts[1]) params.work = parts[1]; // work slug
          if (parts[2]) params.book = parseInt(parts[2]);
          if (parts[3]) params.chapter = parseInt(parts[3]);
          if (parts[4]) params.section = parseInt(parts[4]);
        } else if (contentType === 'multiverse') {
          // Parse multiverse: /reader/multiverse/kjv/Dan.9.23/Daniel.12.11 (translation then ref segments)
          const knownTranslations = typeof Bible !== 'undefined'
            ? Bible.getTranslations().map(t => t.id)
            : ['kjv', 'asv', 'akjv', 'ylt', 'dbt', 'drb', 'jps', 'slt', 'wbt', 'lxx'];
          let multiverseParts = parts.slice(1).filter(Boolean);
          if (multiverseParts[0] && knownTranslations.includes(multiverseParts[0].toLowerCase())) {
            params.translation = multiverseParts[0].toLowerCase();
            multiverseParts = multiverseParts.slice(1);
          }
          if (multiverseParts.length) {
            if (multiverseParts.length === 1 && (multiverseParts[0].includes('%') || !multiverseParts[0].includes('.'))) {
              params.multiverse = decodeURIComponent(multiverseParts[0]);
            } else {
              params.multiverse = this._decodeMultiverse(multiverseParts);
            }
          }
        }
        break;
        
      case 'timeline':
        // event or duration ID from query params
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
        
      case 'blog':
        // Optional post ID: /blog/v100-major-refactor
        if (parts[0]) params.postId = parts[0];
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
    if (ui.gematriaExpanded) params.set('gematria', '1');
    // Global search query (appears on any view when results are open)
    if (ui.globalSearchQuery) {
      params.set('q', ui.globalSearchQuery);
      // Also save collapsed state if any sections are collapsed
      const collapsedSections = [];
      if (ui.globalSearchCollapsed?.events) collapsedSections.push('events');
      if (ui.globalSearchCollapsed?.bible) collapsedSections.push('bible');
      if (collapsedSections.length > 0) {
        params.set('collapsed', collapsedSections.join(','));
      }
    }
    // searchQuery is for reader/bible view only - don't serialize on other views
    if (ui.searchQuery && content.view === 'reader') {
      params.set('search', ui.searchQuery);
    }
    if (ui.personId) params.set('person', ui.personId);
    // Add time to URL for calendar view (format: HHMM in local time)
    // Convert UTC time to local time for URL display
    if (content.view === 'calendar' && context.utcTime) {
      const localTime = typeof AppStore !== 'undefined' && AppStore.getLocalTime 
        ? AppStore.getLocalTime() 
        : context.utcTime;
      const h = String(localTime.hours).padStart(2, '0');
      const m = String(localTime.minutes).padStart(2, '0');
      params.set('t', `${h}${m}`);
    }
    // Calendar panel state
    if (content.view === 'calendar') {
      if (ui.feastsPanel) params.set('panel', 'feasts');
      else if (ui.priestlyPanel) params.set('panel', 'priestly');
      // Date calculator state: ?calc=add.lunar.3mo.7wk
      if (ui.calcOpen) {
        const dir = ui.calcDir || 'add';
        const mode = (ui.calcMode === 'gregorian') ? 'greg' : 'lunar';
        let calc = `${dir}.${mode}`;
        if (ui.calcYears) calc += `.${ui.calcYears}yr`;
        if (ui.calcMonths) calc += `.${ui.calcMonths}mo`;
        if (ui.calcWeeks) calc += `.${ui.calcWeeks}wk`;
        if (ui.calcDays) calc += `.${ui.calcDays}dy`;
        params.set('calc', calc);
      }
    }
    // Add verse to query params for bible content (both 'bible' view and 'reader' view with bible content)
    const isBibleContent = content.view === 'bible' || 
      (content.view === 'reader' && content.params?.contentType === 'bible');
    if (content.params.verse && isBibleContent) {
      params.set('verse', content.params.verse);
    }
    if (ui.interlinearVerse && isBibleContent) {
      params.set('il', ui.interlinearVerse);
    }
    // Timeline params - event/duration/search are mutually exclusive for detail panel
    // Focused event can exist alongside others (it's just highlighting)
    if (content.view === 'timeline') {
      if (ui.timelineFocusedEventId) {
        params.set('focus', ui.timelineFocusedEventId);
      }
      if (ui.timelineEventId) {
        params.set('event', ui.timelineEventId);
        // Don't serialize search or duration - they should be null if event is set
      } else if (ui.timelineDurationId) {
        params.set('duration', ui.timelineDurationId);
        // Don't serialize search or event - they should be null if duration is set
      } else if (ui.timelineSearch) {
        params.set('search', ui.timelineSearch);
        // Don't serialize event or duration - they should be null if search is set
      }
      
      // Zoom and center year are independent of selection
      if (ui.timelineZoom) {
        params.set('zoom', Math.round(ui.timelineZoom * 100) / 100);
      }
      if (ui.timelineCenterYear !== null && ui.timelineCenterYear !== undefined) {
        params.set('year', ui.timelineCenterYear);
      }
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
      
      case 'symbols':
        if (params.symbol) return '/' + params.symbol;
        return '';
      
      case 'reader':
        // Build path based on content type
        // If no contentType, return empty string (just /reader)
        if (!params.contentType) {
          return '';
        }
        
        const contentType = params.contentType;
        let readerPath = '/' + contentType;
        
        if (contentType === 'bible') {
          if (params.translation) readerPath += '/' + params.translation;
          if (params.book) readerPath += '/' + encodeURIComponent(params.book);
          if (params.chapter) readerPath += '/' + params.chapter;
        } else if (contentType === 'symbols') {
          if (params.symbol) readerPath += '/' + params.symbol;
        } else if (contentType === 'symbols-article') {
          if (params.article) readerPath += '/' + params.article;
        } else if (contentType === 'words') {
          if (params.word) readerPath += '/' + params.word;
        } else if (contentType === 'numbers') {
          if (params.number) readerPath += '/' + params.number;
        } else if (contentType === 'verse-studies') {
          if (params.study) readerPath += '/' + params.study;
        } else if (contentType === 'timetested') {
          if (params.chapterId) readerPath += '/' + params.chapterId;
        } else if (contentType === 'philo') {
          if (params.work) readerPath += '/' + params.work;
          if (params.section) readerPath += '/' + params.section;
        } else if (contentType === 'josephus') {
          if (params.work) readerPath += '/' + params.work;
          if (params.book != null) readerPath += '/' + params.book;
          if (params.chapter != null) readerPath += '/' + params.chapter;
          if (params.section != null) readerPath += '/' + params.section;
        } else if (contentType === 'multiverse') {
          readerPath += '/' + (params.translation || 'kjv');
          const segments = this._encodeMultiverseSegments(params.multiverse);
          for (const seg of segments) readerPath += '/' + seg;
        }
        return readerPath;
        
      case 'settings':
        if (params.tab) return '/' + params.tab;
        return '';
      
      case 'blog':
        if (params.postId) return '/' + params.postId;
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
        // Check if this is just URL normalization (adding default params like translation)
        // If the URLs are logically equivalent, use replaceState to avoid back-button loops
        let shouldPush = push;
        if (push && this._isUrlNormalization(currentURL, newURL)) {
          console.log('[URLRouter] Detected URL normalization, using replaceState');
          shouldPush = false;
        }
        
        if (shouldPush) {
          // Save scroll position of current page before pushing new entry
          this.saveScrollPosition();
          history.pushState({}, '', newURL);
          // Add to navigation history for back/forward buttons
          AppStore.dispatch({ type: 'NAV_PUSH', url: newURL });
        } else {
          // For replace, preserve scroll in current state (both panes)
          const textArea = document.getElementById('bible-explorer-text');
          const scrollTop = textArea ? textArea.scrollTop : 0;
          const strongsSidebar = document.querySelector('#strongs-sidebar .strongs-sidebar-content');
          const strongsScrollTop = strongsSidebar ? strongsSidebar.scrollTop : 0;
          history.replaceState({ scrollTop, strongsScrollTop }, '', newURL);
        }
        console.log('[URLRouter] URL updated to:', newURL);
      }
    } catch (e) {
      console.error('[URLRouter] syncURL error:', e);
    }
  },
  
  /**
   * Check if URL change is just normalization (adding defaults like translation).
   * Returns true ONLY when the path changed but the query string is identical,
   * and the parsed state resolves to the same book/chapter/verse/contentType.
   * This prevents back-button loops when e.g. /bible/Genesis/1 normalizes to /bible/kjv/Genesis/1.
   * Any query-param change (strongs, il, verse, gematria, etc.) is a real state change, not normalization.
   */
  _isUrlNormalization(currentURL, newURL) {
    try {
      const curUrl = new URL(currentURL, window.location.origin);
      const newUrl = new URL(newURL, window.location.origin);
      
      // If query strings differ at all, it's NOT normalization
      if (curUrl.search !== newUrl.search) return false;
      
      // If paths are identical, URLs are the same (no change at all)
      if (curUrl.pathname === newUrl.pathname) return false;
      
      // Paths differ but query strings are the same — check if it's just adding translation
      const currentParsed = this.parseURL(curUrl);
      const newParsed = this.parseURL(newUrl);
      
      if (!currentParsed || !newParsed) return false;
      if (currentParsed.content.view !== newParsed.content.view) return false;
      
      const view = currentParsed.content.view;
      if (view === 'bible' || view === 'reader') {
        const cp = currentParsed.content.params;
        const np = newParsed.content.params;
        
        // Same destination, just path format changed (e.g., translation added)
        if (cp.book === np.book && 
            cp.chapter === np.chapter && 
            cp.verse === np.verse &&
            cp.contentType === np.contentType) {
          // For classics, section/work changes are real navigation
          if (cp.contentType === 'philo' || cp.contentType === 'josephus') {
            if (cp.section !== np.section || cp.work !== np.work) return false;
          }
          return true;
        }
      }
      
      return false;
    } catch (e) {
      console.error('[URLRouter] _isUrlNormalization error:', e);
      return false;
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
      '119-equinox': 'ministries119Equinox',
      'creators': 'creatorsCalendar',
      'creators-calendar': 'creatorsCalendar',
      'traditional-lunar': 'traditionalLunar',
      'lunar': 'traditionalLunar',
      'traditional-saturday': 'traditionalSaturday',
      'modern-jewish': 'modernJewish',
      'modern-jewish-calendar': 'modernJewish'
    };
    return mapping[slug.toLowerCase()] || slug;
  },
  
  _getProfileSlug(profileId) {
    // Map profile IDs to URL slugs
    const mapping = {
      'timeTested': 'time-tested',
      'ancientTraditional': 'ancient',
      'ministries119': '119-ministries',
      'ministries119Equinox': '119-equinox',
      'creatorsCalendar': 'creators-calendar',
      'traditionalLunar': 'traditional-lunar',
      'traditionalSaturday': 'traditional-saturday',
      'modernJewish': 'modern-jewish'
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
