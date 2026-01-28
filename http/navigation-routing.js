// Navigation & Routing Functions
// Extracted from index.html for Phase 6 refactoring

// URL configuration constants
const PROFILE_CONFIGS = {
  'time-tested': {
    moonPhase: 'full',
    dayStartTime: 'morning',
    dayStartAngle: 12,
    sabbathMode: 'lunar',
    yearStartRule: 'equinox'
  },
  'ancient-traditional': {
    moonPhase: 'crescent',
    dayStartTime: 'evening',
    dayStartAngle: 0,
    sabbathMode: 'saturday',
    yearStartRule: '13daysBefore'  // "passover" rule - Day 15 on or after equinox
  },
  '119-ministries': {
    moonPhase: 'dark',
    dayStartTime: 'evening',
    dayStartAngle: 0,
    sabbathMode: 'saturday',
    yearStartRule: 'equinox'
  },
  'creators-calendar': {
    moonPhase: 'full',
    dayStartTime: 'evening',
    dayStartAngle: 0,
    sabbathMode: 'lunar',
    yearStartRule: 'virgoFeet'
  },
  'traditional-lunar': {
    moonPhase: 'crescent',
    dayStartTime: 'evening',
    dayStartAngle: 0,
    sabbathMode: 'lunar',
    yearStartRule: 'equinox'
  }
};

// URL to internal value mappings
const YEAR_START_URL_MAP = {
  'equinox': 'equinox',
  'passover': '13daysBefore',
  'lamb': '13daysBefore',
  'virgo': 'virgoFeet',
  'virgo-feet': 'virgoFeet',
  'creators': 'virgoFeet'
};
const YEAR_START_INTERNAL_TO_URL = {
  'equinox': 'equinox',
  '13daysBefore': 'passover',
  'virgoFeet': 'virgo'
};

// Crescent threshold URL mappings (18h is default, omitted from URL)
const CRESCENT_THRESHOLD_TO_URL = {
  12: 'opt',      // Optimistic (optical aids)
  15.5: 'min',    // Minimum naked-eye
  24: 'con'       // Conservative
};
const CRESCENT_THRESHOLD_FROM_URL = {
  'opt': 12,
  'min': 15.5,
  'con': 24
};

// Build COORDS_TO_SLUG from CITY_SLUGS (must be done after CITY_SLUGS is defined in index.html)
// CITY_SLUGS is defined in index.html before script tags, so it's available when this script loads
const COORDS_TO_SLUG = {};
if (typeof CITY_SLUGS !== 'undefined') {
  for (const [slug, coords] of Object.entries(CITY_SLUGS)) {
    COORDS_TO_SLUG[`${coords.lat},${coords.lon}`] = slug;
  }
}

// Get current profile slug based on state
function getCurrentProfileSlug() {
  for (const [slug, config] of Object.entries(PROFILE_CONFIGS)) {
    if (state.moonPhase === config.moonPhase &&
        state.dayStartTime === config.dayStartTime &&
        state.dayStartAngle === config.dayStartAngle &&
        state.sabbathMode === config.sabbathMode &&
        state.yearStartRule === config.yearStartRule) {
      return slug;
    }
  }
  return 'custom';
}

// Get location slug for URL
function getLocationSlug() {
  // Default to Jerusalem if location not set
  const lat = state.lat ?? 31.7683;
  const lon = state.lon ?? 35.2137;
  
  // Try exact match first
  const coordKey = `${lat},${lon}`;
  if (COORDS_TO_SLUG[coordKey]) {
    return COORDS_TO_SLUG[coordKey];
  }
  
  // Find closest city (no distance limit)
  const closest = getClosestCitySlug(lat, lon, Infinity);
  if (closest) {
    return closest;
  }
  
  // Ultimate fallback
  return 'jerusalem';
}

// Parse year from URL segment
// Supports: 2025, 32 (literal year 32 AD), -1445, 1446BC, 1446bc, 1446BCE, 1446bce
// Returns internal year representation (1 BC = 0, 2 BC = -1, etc.)
function parseYearFromURL(yearStr) {
  if (!yearStr) return null;
  
  // Check for BC/BCE suffix (case-insensitive)
  const bcMatch = yearStr.match(/^(\d+)(bc|bce)$/i);
  if (bcMatch) {
    const bcYear = parseInt(bcMatch[1]);
    // Convert BC to internal: 1 BC = 0, 2 BC = -1, 1446 BC = -1445
    return -(bcYear - 1);
  }
  
  // Check for AD/CE suffix (case-insensitive) - just strip the suffix
  const adMatch = yearStr.match(/^(\d+)(ad|ce)$/i);
  if (adMatch) {
    return parseInt(adMatch[1]);
  }
  
  // Check for negative year (already in internal format)
  if (/^-\d+$/.test(yearStr)) {
    return parseInt(yearStr);
  }
  
  // Positive integer - treat as literal year (32 = year 32 AD, not 1932)
  if (/^\d+$/.test(yearStr)) {
    return parseInt(yearStr);
  }
  
  return null;
}

// Format year for URL (reverse of parseYearFromURL)
function formatYearForURL(year) {
  if (year <= 0) {
    // Convert internal to BC: 0 = 1BC, -1 = 2BC, -1445 = 1446BC
    const bcYear = Math.abs(year - 1);
    return `${bcYear}bc`;
  }
  return year.toString();
}

// Build SEO-friendly URL from current state
function buildPathURL(options = {}) {
  const profile = getCurrentProfileSlug();
  const locationSlug = getLocationSlug();
  
  // Build segments - always include profile, year, and location for clear SEO URLs
  const segments = [];
  
  // Profile always included (explicit is better for SEO/analytics)
  segments.push(profile);
  
  // For custom profiles, encode settings in path segments
  // Format: /custom/moon/[threshold?]/dayStart/sabbath/yearStart/year/location/
  if (profile === 'custom') {
    // Moon phase: full, dark, crescent
    segments.push(state.moonPhase);
    
    // Crescent threshold (only if crescent and non-default)
    if (state.moonPhase === 'crescent' && state.crescentThreshold !== 18) {
      const thresholdSlug = CRESCENT_THRESHOLD_TO_URL[state.crescentThreshold];
      if (thresholdSlug) {
        segments.push(thresholdSlug);
      }
    }
    
    // Day start time: morning, evening
    segments.push(state.dayStartTime);
    
    // Sabbath mode: lunar, saturday, etc.
    segments.push(state.sabbathMode);
    
    // Year start rule: equinox, passover
    segments.push(YEAR_START_INTERNAL_TO_URL[state.yearStartRule] || 'equinox');
  }
  
  // Year always included (use BC format for negative years)
  segments.push(formatYearForURL(state.year));
  
  // Month (lunar month number, 1-indexed) - always include
  const monthNum = (state.currentMonthIndex || 0) + 1;
  segments.push(monthNum.toString());
  
  // Day (lunar day) - always include, default to 1
  const lunarDay = state.highlightedLunarDay || 1;
  segments.push(lunarDay.toString());
  
  // Location always included (explicit is better for SEO/analytics)
  segments.push(locationSlug);
  
  // Build path
  let path = '/' + segments.join('/');
  if (!path.endsWith('/')) {
    path += '/';
  }
  
  // Query params (only for time or dayStartAngle which isn't in path)
  const params = new URLSearchParams();
  
  // dayStartAngle is not easily encodable in path, keep as query param for custom
  if (profile === 'custom' && state.dayStartAngle !== 0) {
    params.set('angle', state.dayStartAngle);
  }
  
  // Time parameter if specific time is set
  if (options.includeTime && state.selectedTimestamp) {
    const d = new Date(state.selectedTimestamp);
    params.set('time', `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
  }
  
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

// Update browser URL without reload
function updatePathURL() {
  const newURL = buildPathURL();
  if (window.location.pathname + window.location.search !== newURL) {
    window.history.replaceState({}, '', newURL);
  }
}

// Update URL (wrapper for updatePathURL)
function updateURL() {
  updatePathURL();
}

// Navigate with path URL and push to history
function navigateToPathURL(options = {}) {
  const newURL = buildPathURL(options);
  window.history.pushState({}, '', newURL);
}

// Update URL with view parameter
function updateURLWithView(view) {
  let newURL;
  if (view === 'sabbath-tester') {
    newURL = '/sabbath-tester/';
  } else if (view === 'feasts') {
    // Build feasts URL with profile/year/location
    const profile = getCurrentProfileSlug();
    const location = getLocationSlug();
    newURL = `/feasts/${profile}/${state.year}/${location}/`;
  } else if (view === 'priestly') {
    // Build priestly URL with profile/year/priestly
    const profile = getCurrentProfileSlug();
    const yearStr = formatYearForURL(state.year);
    newURL = `/${profile}/${yearStr}/priestly/`;
  } else if (view === 'events') {
    // Build events URL with profile/events
    const profile = getCurrentProfileSlug();
    newURL = `/${profile}/events/`;
  } else if (view === 'biblical-timeline') {
    // Build biblical timeline URL with profile/biblical-timeline
    const profile = getCurrentProfileSlug();
    newURL = `/${profile}/biblical-timeline/`;
  } else {
    // Calendar view - use standard path URL
    newURL = buildPathURL();
  }
  
  // Use pushState for navigation views so back button works
  window.history.pushState({ view: view }, '', newURL);
}

// Convert Julian date to Gregorian date
// Julian calendar lags behind Gregorian by a growing number of days
function julianToGregorian(year, month, day) {
  // Calculate Julian Day Number for Julian calendar date
  let a = Math.floor((14 - month) / 12);
  let y = year + 4800 - a;
  let m = month + 12 * a - 3;
  
  // Julian calendar JDN formula
  let jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  
  // Convert JDN back to Gregorian calendar
  let b = jdn + 32044;
  let c = Math.floor((4 * b + 3) / 146097);
  let d = b - Math.floor(146097 * c / 4);
  let e = Math.floor((4 * d + 3) / 1461);
  let f = d - Math.floor(1461 * e / 4);
  let g = Math.floor((5 * f + 2) / 153);
  
  let gregDay = f - Math.floor((153 * g + 2) / 5) + 1;
  let gregMonth = g + 3 - 12 * Math.floor(g / 10);
  let gregYear = 100 * c + e - 4800 + Math.floor(g / 10);
  
  return { year: gregYear, month: gregMonth, day: gregDay };
}

// Parse SEO-friendly URL path into state
function parsePathURL() {
  const path = window.location.pathname;
  let segments = path.split('/').filter(s => s.length > 0);
  const params = new URLSearchParams(window.location.search);
  
  // Check for special views first
  if (segments[0] === 'about') {
    return { view: 'about' };
  }
  if (segments[0] === 'sabbath-tester') {
    return { view: 'sabbath-tester' };
  }
  if (segments[0] === 'feasts') {
    return { view: 'feasts', segments: segments.slice(1) };
  }
  if (segments[0] === 'biblical-timeline') {
    // Handle standalone biblical-timeline URL with optional event/duration
    const result = { view: 'biblical-timeline', profile: 'time-tested' };
    // Check for /biblical-timeline/event/id or /biblical-timeline/duration/id
    if (segments.length >= 3) {
      if (segments[1] === 'event') {
        result.eventId = segments[2];
      } else if (segments[1] === 'duration') {
        result.durationId = segments[2];
      }
    }
    return result;
  }
  
  // Check if the last segment is "priestly", "events", or "biblical-timeline" - these can be appended to any calendar URL
  const hasPriestlyView = segments[segments.length - 1] === 'priestly';
  const hasEventsView = segments[segments.length - 1] === 'events';
  
  // Check for biblical-timeline with optional event/duration deep link
  // Format: .../biblical-timeline/ or .../biblical-timeline/event/id or .../biblical-timeline/duration/id
  let hasBiblicalTimelineView = false;
  let timelineEventId = null;
  let timelineDurationId = null;
  
  const btIndex = segments.indexOf('biblical-timeline');
  if (btIndex !== -1) {
    hasBiblicalTimelineView = true;
    // Check for event/duration after biblical-timeline
    if (segments.length > btIndex + 2) {
      if (segments[btIndex + 1] === 'event') {
        timelineEventId = segments[btIndex + 2];
      } else if (segments[btIndex + 1] === 'duration') {
        timelineDurationId = segments[btIndex + 2];
      }
    }
    // Remove biblical-timeline and any sub-paths from segments
    segments = segments.slice(0, btIndex);
  }
  
  if (hasPriestlyView) {
    segments = segments.slice(0, -1); // Remove 'priestly' from segments for normal parsing
  }
  if (hasEventsView) {
    segments = segments.slice(0, -1); // Remove 'events' from segments for normal parsing
  }
  
  // Handle Gregorian date lookup: /gregorian/year/month/day/
  // Only valid for 1582 and later (Gregorian calendar start)
  if (segments[0] === 'gregorian') {
    const result = {
      view: 'gregorian-lookup',
      profile: 'time-tested',
      gregorianYear: null,
      gregorianMonth: null,
      gregorianDay: null
    };
    
    if (segments.length >= 2) {
      const parsedYear = parseYearFromURL(segments[1]);
      if (parsedYear !== null) result.gregorianYear = parsedYear;
    }
    if (segments.length >= 3) {
      const month = parseInt(segments[2]);
      if (month >= 1 && month <= 12) result.gregorianMonth = month;
    }
    if (segments.length >= 4) {
      const day = parseInt(segments[3]);
      if (day >= 1 && day <= 31) result.gregorianDay = day;
    }
    
    // If year is before Gregorian calendar (1582), redirect to Julian
    if (result.gregorianYear !== null && result.gregorianYear < 1582) {
      result.view = 'redirect-to-julian';
    }
    
    return result;
  }
  
  // Handle Julian date lookup: /julian/year/month/day/
  // Julian dates are converted to Gregorian internally but URL stays Julian
  if (segments[0] === 'julian') {
    const result = {
      view: 'julian-lookup',
      profile: 'time-tested',
      julianYear: null,
      julianMonth: null,
      julianDay: null
    };
    
    if (segments.length >= 2) {
      const parsedYear = parseYearFromURL(segments[1]);
      if (parsedYear !== null) result.julianYear = parsedYear;
    }
    if (segments.length >= 3) {
      const month = parseInt(segments[2]);
      if (month >= 1 && month <= 12) result.julianMonth = month;
    }
    if (segments.length >= 4) {
      const day = parseInt(segments[3]);
      if (day >= 1 && day <= 31) result.julianDay = day;
    }
    
    return result;
  }
  
  // Default state
  const result = {
    profile: 'time-tested',
    year: new Date().getFullYear(),
    month: null,
    day: null,
    location: 'jerusalem',
    view: 'calendar',
    needsRedirect: false
  };
  
  if (segments.length === 0) {
    // Root URL - redirect to canonical
    result.needsRedirect = true;
    return result;
  }
  
  let segmentIndex = 0;
  
  // First segment MUST be a profile name
  const first = segments[0];
  if (PROFILE_CONFIGS[first]) {
    result.profile = first;
    segmentIndex++;
  } else if (first === 'custom') {
    result.profile = 'custom';
    segmentIndex++;
    
    // For custom profiles, parse path segments:
    // /custom/moon/[threshold?]/dayStart/sabbath/yearStart/year/location/
    
    // Parse moon phase: full, dark, crescent
    if (segmentIndex < segments.length) {
      const moonSeg = segments[segmentIndex];
      if (moonSeg === 'full' || moonSeg === 'dark' || moonSeg === 'crescent') {
        result.moonPhase = moonSeg;
        segmentIndex++;
        
        // If crescent, check for threshold: opt, min, con
        if (moonSeg === 'crescent' && segmentIndex < segments.length) {
          const thresholdSeg = segments[segmentIndex];
          if (CRESCENT_THRESHOLD_FROM_URL[thresholdSeg] !== undefined) {
            result.crescentThreshold = CRESCENT_THRESHOLD_FROM_URL[thresholdSeg];
            segmentIndex++;
          }
          // else: default 18h, don't consume segment
        }
      }
    }
    
    // Parse dayStart: morning, evening
    if (segmentIndex < segments.length) {
      const dayStartSeg = segments[segmentIndex];
      if (dayStartSeg === 'morning' || dayStartSeg === 'evening') {
        result.dayStartTime = dayStartSeg;
        segmentIndex++;
      }
    }
    
    // Parse sabbath: lunar, saturday, sunday, friday, none
    if (segmentIndex < segments.length) {
      const sabbathSeg = segments[segmentIndex];
      if (['lunar', 'saturday', 'sunday', 'friday', 'none'].includes(sabbathSeg)) {
        result.sabbathMode = sabbathSeg;
        segmentIndex++;
      }
    }
    
    // Parse yearStart: equinox, passover
    if (segmentIndex < segments.length) {
      const yearStartSeg = segments[segmentIndex];
      if (yearStartSeg === 'equinox' || yearStartSeg === 'passover') {
        result.yearStartRule = YEAR_START_URL_MAP[yearStartSeg] || yearStartSeg;
        segmentIndex++;
      }
    }
  } else {
    // Not a valid profile - redirect to canonical URL with defaults
    result.needsRedirect = true;
    return result;
  }
  
  // Next segment: year (required)
  // Supports: 2025, 32, -1445, 1446BC, 1446bc
  if (segmentIndex < segments.length) {
    const yearStr = segments[segmentIndex];
    const parsedYear = parseYearFromURL(yearStr);
    if (parsedYear !== null) {
      result.year = parsedYear;
      segmentIndex++;
    }
  }
  
  // Parse remaining segments: could be month, day, or location
  // Format: .../year/[month/[day/]]location/
  const remaining = segments.slice(segmentIndex);
  
  if (remaining.length === 1) {
    // Just location
    result.location = remaining[0];
  } else if (remaining.length === 2) {
    // month + location
    if (/^\d+$/.test(remaining[0]) && parseInt(remaining[0]) >= 1 && parseInt(remaining[0]) <= 13) {
      result.month = parseInt(remaining[0]);
    }
    result.location = remaining[1];
  } else if (remaining.length >= 3) {
    // month + day + location
    if (/^\d+$/.test(remaining[0]) && parseInt(remaining[0]) >= 1 && parseInt(remaining[0]) <= 13) {
      result.month = parseInt(remaining[0]);
    }
    if (/^\d+$/.test(remaining[1]) && parseInt(remaining[1]) >= 1 && parseInt(remaining[1]) <= 30) {
      result.day = parseInt(remaining[1]);
    }
    result.location = remaining[2];
  }
  
  // Validate location - if not recognized, flag for redirect
  if (result.location && !CITY_SLUGS[result.location] && !/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(result.location)) {
    result.needsRedirect = true;
  }
  
  // Parse query params (dayStartAngle still uses query param)
  if (params.has('angle')) result.dayStartAngle = parseInt(params.get('angle'));
  if (params.has('threshold')) result.crescentThreshold = parseInt(params.get('threshold'));
  if (params.has('time')) result.time = params.get('time');
  
  // Add priestly view flag if URL ended with /priestly/
  if (hasPriestlyView) {
    result.view = 'priestly';
  }
  
  // Add events view flag if URL ended with /events/
  if (hasEventsView) {
    result.view = 'events';
  }
  
  // Add biblical timeline view flag if URL ended with /biblical-timeline/
  if (hasBiblicalTimelineView) {
    result.view = 'biblical-timeline';
    if (timelineEventId) {
      result.timelineEventId = timelineEventId;
    }
    if (timelineDurationId) {
      result.timelineDurationId = timelineDurationId;
    }
  }
  
  return result;
}

// Apply parsed URL state to app state
function applyURLState(urlState) {
  let needsRegenerate = false;
  
  // Apply profile settings
  if (urlState.profile && PROFILE_CONFIGS[urlState.profile]) {
    const config = PROFILE_CONFIGS[urlState.profile];
    if (state.moonPhase !== config.moonPhase) {
      state.moonPhase = config.moonPhase;
      needsRegenerate = true;
    }
    if (state.dayStartTime !== config.dayStartTime) {
      state.dayStartTime = config.dayStartTime;
      needsRegenerate = true;
    }
    if (state.dayStartAngle !== config.dayStartAngle) {
      state.dayStartAngle = config.dayStartAngle;
      needsRegenerate = true;
    }
    if (state.sabbathMode !== config.sabbathMode) {
      state.sabbathMode = config.sabbathMode;
      needsRegenerate = true;
    }
    if (state.yearStartRule !== config.yearStartRule) {
      state.yearStartRule = config.yearStartRule;
      needsRegenerate = true;
    }
  }
  
  // Apply custom settings from query params
  if (urlState.moonPhase) { state.moonPhase = urlState.moonPhase; needsRegenerate = true; }
  if (urlState.dayStartTime) { state.dayStartTime = urlState.dayStartTime; needsRegenerate = true; }
  if (urlState.dayStartAngle !== undefined) { state.dayStartAngle = urlState.dayStartAngle; needsRegenerate = true; }
  if (urlState.sabbathMode) { state.sabbathMode = urlState.sabbathMode; needsRegenerate = true; }
  if (urlState.yearStartRule) { state.yearStartRule = urlState.yearStartRule; needsRegenerate = true; }
  if (urlState.crescentThreshold !== undefined) { state.crescentThreshold = urlState.crescentThreshold; needsRegenerate = true; }
  
  // Apply year (use !== null check since year 0 = 1 BC is valid)
  if (urlState.year !== null && urlState.year !== undefined && urlState.year !== state.year) {
    state.year = urlState.year;
    needsRegenerate = true;
  }
  
  // Apply location
  if (urlState.location) {
    let lat, lon;
    if (CITY_SLUGS[urlState.location]) {
      lat = CITY_SLUGS[urlState.location].lat;
      lon = CITY_SLUGS[urlState.location].lon;
    } else if (/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(urlState.location)) {
      // Custom coordinates
      const [latStr, lonStr] = urlState.location.split(',');
      lat = parseFloat(latStr);
      lon = parseFloat(lonStr);
    }
    if (lat !== undefined && lon !== undefined && (lat !== state.lat || lon !== state.lon)) {
      state.lat = lat;
      state.lon = lon;
      needsRegenerate = true;
    }
  }
  
  return { needsRegenerate, month: urlState.month, day: urlState.day, view: urlState.view };
}

// Load state from URL (supports both path-based and legacy query params)
function loadFromURL() {
  // Parse the new path-based URL
  const urlState = parsePathURL();
  
  // Handle special views
  if (urlState.view === 'about') {
    showAboutModal();
    return;
  }
  
  if (urlState.view === 'sabbath-tester') {
    const sabbathTesterPage = document.getElementById('sabbath-tester-page');
    const calendarOutput = document.getElementById('calendar-output');
    const dayDetailPanel = document.getElementById('day-detail-panel');
    calendarOutput.style.display = 'none';
    dayDetailPanel.style.display = 'none';
    sabbathTesterPage.style.display = 'block';
    renderSabbathTester();
    return;
  }
  
  if (urlState.view === 'feasts') {
    toggleExportModal(true);
    return;
  }
  
  if (urlState.view === 'priestly') {
    // Apply URL state first, then show priestly page
    const { needsRegenerate } = applyURLState(urlState);
    if (needsRegenerate) {
      generateCalendar();
    }
    navigateTo('priestly');
    return;
  }
  
  if (urlState.view === 'events') {
    // Apply URL state first (for profile settings), then show events page
    const { needsRegenerate } = applyURLState(urlState);
    if (needsRegenerate) {
      generateCalendar();
    }
    navigateTo('events');
    return;
  }
  
  if (urlState.view === 'biblical-timeline') {
    // Apply URL state first (for profile settings), then show biblical timeline page
    const { needsRegenerate } = applyURLState(urlState);
    if (needsRegenerate) {
      generateCalendar();
    }
    navigateTo('biblical-timeline');
    
    // Open specific event or duration if specified in URL
    if (urlState.timelineEventId) {
      setTimeout(() => {
        if (typeof openEventDetail === 'function') {
          openEventDetail(urlState.timelineEventId);
        }
      }, 500); // Allow timeline to initialize first
    } else if (urlState.timelineDurationId) {
      setTimeout(() => {
        if (typeof openDurationDetail === 'function') {
          openDurationDetail(urlState.timelineDurationId);
        }
      }, 500);
    }
    return;
  }
  
  // Handle Gregorian date lookup - find lunar date and redirect
  if (urlState.view === 'gregorian-lookup') {
    handleGregorianLookup(urlState);
    return;
  }
  
  // Redirect pre-Gregorian dates to Julian URL
  if (urlState.view === 'redirect-to-julian') {
    const yearStr = formatYearForURL(urlState.gregorianYear);
    const month = urlState.gregorianMonth || 1;
    const day = urlState.gregorianDay || 1;
    window.location.replace(`/julian/${yearStr}/${month}/${day}/`);
    return;
  }
  
  // Handle Julian date lookup - convert to Gregorian internally
  if (urlState.view === 'julian-lookup') {
    handleJulianLookup(urlState);
    return;
  }
  
  // If URL needs redirect to canonical format, do it after calendar loads
  if (urlState.needsRedirect) {
    // Will redirect to canonical URL after initial load
    setTimeout(() => {
      const canonicalURL = buildPathURL();
      window.history.replaceState({}, '', canonicalURL);
    }, 100);
  }
  
  // Apply URL state to app state
  const { needsRegenerate, month, day, view } = applyURLState(urlState);
  
  // Regenerate if settings changed
  if (needsRegenerate) {
    updateUI();
    generateCalendar();
  }
  
  // Apply month after calendar generation
  if (month !== null && month !== undefined) {
    const monthIndex = month - 1; // Convert to 0-indexed
    if (monthIndex >= 0 && monthIndex < state.lunarMonths.length) {
      state.currentMonthIndex = monthIndex;
    }
  }
  
  // Apply day - default to 1 if not specified
  const effectiveDay = (day !== null && day !== undefined) ? day : 1;
  state.highlightedLunarDay = effectiveDay;
  const monthData = state.lunarMonths[state.currentMonthIndex];
  const dayObj = monthData?.days.find(d => d.lunarDay === effectiveDay);
  if (dayObj) {
    state.selectedTimestamp = getSunriseTimestamp(dayObj.gregorianDate);
    const gotoDate = document.getElementById('goto-date');
    if (gotoDate) gotoDate.value = formatLocalDatetime(state.selectedTimestamp);
    showDayDetail(dayObj, monthData);
  }
  
  // Re-render
  renderMonth(state.lunarMonths[state.currentMonthIndex]);
  updateMonthButtons();
}

// Handle Gregorian date lookup - find lunar date and redirect
async function handleGregorianLookup(urlState) {
  const { gregorianYear, gregorianMonth, gregorianDay } = urlState;
  
  // Default to today if not specified
  const now = new Date();
  const year = gregorianYear !== null ? gregorianYear : now.getFullYear();
  const month = gregorianMonth !== null ? gregorianMonth : (now.getMonth() + 1);
  const day = gregorianDay !== null ? gregorianDay : now.getDate();
  
  // Set state to the year containing this Gregorian date
  state.year = year;
  
  // Generate calendar for this year
  updateUI();
  await generateCalendar();
  
  // Find the Gregorian date in the lunar calendar
  const targetDate = new Date(year, month - 1, day, 12, 0, 0);
  const targetDateStr = targetDate.toISOString().split('T')[0];
  
  let foundMonth = null;
  let foundDay = null;
  
  for (let m = 0; m < state.lunarMonths.length; m++) {
    const lunarMonth = state.lunarMonths[m];
    for (let d = 0; d < lunarMonth.days.length; d++) {
      const lunarDay = lunarMonth.days[d];
      if (lunarDay.gregorianDate.toISOString().split('T')[0] === targetDateStr) {
        foundMonth = m;
        foundDay = lunarDay.lunarDay;
        break;
      }
    }
    if (foundMonth !== null) break;
  }
  
  if (foundMonth !== null) {
    state.currentMonthIndex = foundMonth;
    state.highlightedLunarDay = foundDay;
    
    // Show the day
    const lunarMonth = state.lunarMonths[foundMonth];
    const dayObj = lunarMonth.days.find(d => d.lunarDay === foundDay);
    if (dayObj) {
      renderMonth(lunarMonth);
      showDayDetail(dayObj, lunarMonth);
    }
  }
  
  // Redirect to canonical lunar URL
  const canonicalURL = buildPathURL();
  window.history.replaceState({}, '', canonicalURL);
}

// Handle Julian date lookup - convert to Gregorian and find lunar date
async function handleJulianLookup(urlState) {
  const { julianYear, julianMonth, julianDay } = urlState;
  
  // Default to today if not specified (in Julian)
  const now = new Date();
  const year = julianYear !== null ? julianYear : now.getFullYear();
  const month = julianMonth !== null ? julianMonth : (now.getMonth() + 1);
  const day = julianDay !== null ? julianDay : now.getDate();
  
  // Convert Julian to Gregorian
  const greg = julianToGregorian(year, month, day);
  
  // Set state to the year containing this Gregorian date
  state.year = greg.year;
  
  // Generate calendar for this year
  updateUI();
  await generateCalendar();
  
  // Find the Gregorian date in the lunar calendar
  const targetDate = new Date(greg.year, greg.month - 1, greg.day, 12, 0, 0);
  const targetDateStr = targetDate.toISOString().split('T')[0];
  
  let foundMonth = null;
  let foundDay = null;
  
  for (let m = 0; m < state.lunarMonths.length; m++) {
    const lunarMonth = state.lunarMonths[m];
    for (let d = 0; d < lunarMonth.days.length; d++) {
      const lunarDay = lunarMonth.days[d];
      if (lunarDay.gregorianDate.toISOString().split('T')[0] === targetDateStr) {
        foundMonth = m;
        foundDay = lunarDay.lunarDay;
        break;
      }
    }
    if (foundMonth !== null) break;
  }
  
  if (foundMonth !== null) {
    state.currentMonthIndex = foundMonth;
    state.highlightedLunarDay = foundDay;
    
    // Show the day
    const lunarMonth = state.lunarMonths[foundMonth];
    const dayObj = lunarMonth.days.find(d => d.lunarDay === foundDay);
    if (dayObj) {
      renderMonth(lunarMonth);
      showDayDetail(dayObj, lunarMonth);
    }
  }
  
  // Redirect to canonical lunar URL (but keep Julian in URL)
  const canonicalURL = buildPathURL();
  window.history.replaceState({}, '', canonicalURL);
}

// Navigate to a pending date after calendar regeneration
function navigateToPendingDate() {
  if (!state.pendingNavigationDate) return;
  
  const targetDateStr = state.pendingNavigationDate.toISOString().split('T')[0];
  state.pendingNavigationDate = null; // Clear the pending navigation
  
  // Find this Gregorian date in the new calendar
  for (let m = 0; m < state.lunarMonths.length; m++) {
    const month = state.lunarMonths[m];
    for (let d = 0; d < month.days.length; d++) {
      const day = month.days[d];
      if (day.gregorianDate.toISOString().split('T')[0] === targetDateStr) {
        state.currentMonthIndex = m;
        state.highlightedLunarDay = day.lunarDay;
        renderMonth(month);
        showDayDetail(day, month);
        return;
      }
    }
  }
}

// Navigate to a specific page/view
function navigateTo(page) {
  // Close the menu if it's open (don't toggle)
  const menu = document.getElementById('nav-menu');
  const overlay = document.getElementById('nav-menu-overlay');
  if (menu.classList.contains('open')) {
    menu.classList.remove('open');
    overlay.classList.remove('open');
  }
  
  const calendarOutput = document.getElementById('calendar-output');
  const dayDetailPanel = document.getElementById('day-detail-panel');
  const settingsPage = document.getElementById('settings-page');
  const settingsOverlay = document.getElementById('settings-page-overlay');
  const exportPage = document.getElementById('export-page');
  const sabbathTesterPage = document.getElementById('sabbath-tester-page');
  const priestlyPage = document.getElementById('priestly-page');
  const eventsPage = document.getElementById('events-page');
  const biblicalTimelinePage = document.getElementById('biblical-timeline-page');
  
  // Hide all pages and reset body state
  document.documentElement.classList.remove('feasts-open');
  document.body.classList.remove('feasts-open');
  document.body.classList.remove('sabbath-tester-open');
  document.body.classList.remove('events-open');
  document.body.classList.remove('biblical-timeline-open');
  document.body.style.overflow = ''; // Restore scrolling
  
  // Close settings slide-in
  settingsPage.classList.remove('visible');
  settingsOverlay.classList.remove('visible');
  
  // Hide export page, sabbath tester, priestly page, events page, and biblical timeline page
  exportPage.style.display = 'none';
  sabbathTesterPage.style.display = 'none';
  if (priestlyPage) priestlyPage.style.display = 'none';
  if (eventsPage) eventsPage.style.display = 'none';
  if (biblicalTimelinePage) {
    biblicalTimelinePage.style.display = 'none';
    // Cleanup timeline when navigating away
    if (typeof cleanupBiblicalTimeline === 'function') {
      cleanupBiblicalTimeline();
    }
    // Close the detail slideout panel if open
    if (typeof closeDetailPanel === 'function') {
      closeDetailPanel();
    }
  }
  
  switch(page) {
    case 'calendar':
      calendarOutput.style.display = 'block';
      if (state.highlightedLunarDay !== null) {
        dayDetailPanel.classList.remove('hidden');
        dayDetailPanel.style.display = '';
        refreshDayDetailIfVisible();
      }
      updateURL();
      break;
    case 'feasts':
      document.documentElement.classList.add('feasts-open');
      document.body.classList.add('feasts-open');
      calendarOutput.style.display = 'none';
      dayDetailPanel.style.display = 'none';
      exportPage.style.display = 'block';
      exportPage.scrollTop = 0;
      updateExportTable();
      updateURLWithView('feasts');
      break;
    case 'settings':
      // Show calendar in background, open settings slide-in
      calendarOutput.style.display = 'block';
      if (state.highlightedLunarDay !== null) {
        dayDetailPanel.classList.remove('hidden');
        dayDetailPanel.style.display = '';
      }
      // Open settings directly (don't use toggleSettings which would close if already visible)
      settingsPage.classList.add('visible');
      settingsOverlay.classList.add('visible');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      
      // Initialize editing profile to current active profile
      editingProfileId = state.selectedProfile || 'timeTested';
      
      // Update dropdown to show current profile
      const select = document.getElementById('profile-select');
      if (select) select.value = editingProfileId;
      
      // Update settings page state
      updateSettingsPageState();
      displayProfileSettings(editingProfileId);
      break;
    case 'sabbath-tester':
      document.body.classList.add('sabbath-tester-open');
      calendarOutput.style.display = 'none';
      dayDetailPanel.style.display = 'none';
      sabbathTesterPage.style.display = 'block';
      renderSabbathTester();
      updateURLWithView('sabbath-tester');
      break;
    case 'priestly':
      const priestlyPage = document.getElementById('priestly-page');
      calendarOutput.style.display = 'none';
      dayDetailPanel.style.display = 'none';
      priestlyPage.style.display = 'block';
      if (typeof renderPriestlyTable === 'function') {
        const yearSpan = document.getElementById('priestly-year');
        const profileSpan = document.getElementById('priestly-profile');
        if (yearSpan) yearSpan.textContent = formatYear(state.year);
        if (profileSpan) profileSpan.textContent = getCurrentProfileName();
        renderPriestlyTable();
      }
      updateURLWithView('priestly');
      break;
    case 'events':
      const eventsPage = document.getElementById('events-page');
      document.body.classList.add('events-open');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      calendarOutput.style.display = 'none';
      dayDetailPanel.style.display = 'none';
      eventsPage.style.display = 'block';
      eventsPage.scrollTop = 0;
      if (typeof initEventsPage === 'function') {
        initEventsPage();
      }
      updateURLWithView('events');
      break;
    case 'biblical-timeline':
      const biblicalTimelinePage = document.getElementById('biblical-timeline-page');
      document.body.classList.add('biblical-timeline-open');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      calendarOutput.style.display = 'none';
      dayDetailPanel.style.display = 'none';
      biblicalTimelinePage.style.display = 'block';
      biblicalTimelinePage.scrollTop = 0;
      // Cleanup other pages that might have resources
      if (typeof cleanupBiblicalTimeline === 'function') {
        // Re-initialize to ensure fresh state
        setTimeout(() => {
          if (typeof initBiblicalTimelinePage === 'function') {
            initBiblicalTimelinePage();
          }
        }, 100);
      } else if (typeof initBiblicalTimelinePage === 'function') {
        initBiblicalTimelinePage();
      }
      updateURLWithView('biblical-timeline');
      break;
  }
}

// Navigate to a world clock entry
function navigateToWorldClockEntry(profileId, locationSlug) {
  const profile = PROFILES[profileId] || PRESET_PROFILES[profileId];
  const coords = CITY_SLUGS[locationSlug];
  if (!profile || !coords) return;
  
  // Apply profile
  state.moonPhase = profile.moonPhase;
  state.dayStartTime = profile.dayStartTime;
  state.dayStartAngle = profile.dayStartAngle;
  state.yearStartRule = profile.yearStartRule;
  state.crescentThreshold = profile.crescentThreshold ?? 18;
  state.sabbathMode = profile.sabbathMode;
  state.selectedProfile = profileId;
  
  // Apply location
  state.lat = coords.lat;
  state.lon = coords.lon;
  
  // Regenerate and navigate
  saveState();
  regenerateCalendarPreservingScroll();
}
