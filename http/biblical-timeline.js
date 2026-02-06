// Biblical Timeline Module
// Renders timeline using EventResolver for profile-aware date calculations
// Version: 12.0 - Uses ResolvedEventsCache singleton for all data/caching

let biblicalTimelineEventLookup = new Map();
let biblicalTimelineZoom = null;
let biblicalTimelinePan = 0;
let biblicalTimelineMinYear = null;
let biblicalTimelineMaxYear = null;

// ============================================================================
// DATA ACCESS — All caching delegated to ResolvedEventsCache singleton
// ============================================================================

// Render lock to prevent concurrent renders
let renderInProgress = false;
let renderPending = false;

// Flag: true when the initial render pre-applied the URL search filter,
// so displaySearchResults() can skip the redundant re-render.
let _searchPreAppliedDuringRender = false;

/** Load raw event data (delegates to singleton). */
async function loadBiblicalTimelineData() {
  return ResolvedEventsCache.getData();
}

/** Get resolved events synchronously (delegates to singleton). */
function getResolvedEvents(data, profile) {
  const events = ResolvedEventsCache.getEvents(profile);
  return events || [];
}

/** Get resolved events, computing with progress if needed (delegates to singleton). */
async function getResolvedEventsWithProgress(data, profile) {
  // Progress callback — updates the loading bar UI
  const onProgress = (percent, message) => {
    const fill = document.querySelector('.timeline-progress-fill');
    const subtext = document.querySelector('.timeline-loading-subtext');
    if (fill) {
      fill.style.animation = 'none';
      fill.style.width = percent + '%';
    }
    if (subtext) {
      subtext.textContent = message || `${percent}% complete`;
    }
  };
  return ResolvedEventsCache.getEventsAsync(profile, onProgress);
}

/** Check if events are cached for this profile. */
function isTimelineCacheValid(data, profile) {
  return ResolvedEventsCache.isCached(profile);
}

/** Get cached resolved events (sync, for consumers like bible-events-loader). */
function getTimelineResolvedEvents() {
  const profile = (typeof getTimelineProfile === 'function') ? getTimelineProfile() : null;
  return profile ? (ResolvedEventsCache.getEvents(profile) || []) : [];
}

/** Pre-warm cache (delegates to singleton). */
async function preResolveTimelineInBackground(data, profile) {
  if (!profile && typeof getTimelineProfile === 'function') {
    profile = getTimelineProfile();
  }
  if (!profile) return;
  return ResolvedEventsCache.preload(profile);
}

/** Invalidate cache (delegates to singleton). */
function invalidateBiblicalTimelineCacheInternal() {
  const profile = (typeof getTimelineProfile === 'function') ? getTimelineProfile() : null;
  ResolvedEventsCache.invalidate(profile);
}

// Backward-compatible global exports
window.preResolveTimelineInBackground = preResolveTimelineInBackground;
window.isBackgroundResolutionInProgress = () => false; // No more background state
window.getBackgroundResolutionProgress = () => 100;
window.getTimelineResolvedEvents = getTimelineResolvedEvents;
window.loadBiblicalTimelineData = loadBiblicalTimelineData;
window.clearTimelineResolvedCaches = () => ResolvedEventsCache.invalidate();

// LocalStorage keys for persisting state
const TIMELINE_STORAGE_KEY = 'biblicalTimelineState';
const TIMELINE_FILTERS_KEY = 'biblicalTimelineFilters';

// Filter state - which event types to show
let timelineFilters = {
  births: true,
  deaths: true,
  biblical: true,
  historical: true,
  prophecy: true,
  dates: true  // Biblical-date events (specific verse date references)
};

// Markdown to HTML converter using marked.js library
function renderMarkdown(text, linkifyEvents = true) {
  if (!text) return '';
  
  let html;
  
  // Use marked.js if available
  if (typeof marked !== 'undefined') {
    try {
      marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false
      });
      html = marked.parse(text);
      html = html.replace(/<table>/g, '<table class="md-table">');
    } catch (e) {
      console.warn('[Timeline] marked.js error:', e);
      html = text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
    }
  } else {
    // Fallback to basic regex if marked.js not available
    html = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
  
  // Linkify event references if requested
  if (linkifyEvents) {
    // First handle [[event-id]] syntax
    html = linkifyEventRefs(html);
    // Then handle bare event IDs
    html = linkifyBareEventIds(html);
  }
  
  return html;
}

// Get event title by ID (pretty name)
function getEventTitle(eventId) {
  const event = biblicalTimelineEventLookup.get(eventId);
  return event ? event.title : eventId;
}

// Convert [[event-id]] references to clickable links with pretty names
function linkifyEventRefs(html) {
  return html.replace(/\[\[([a-z0-9-]+)\]\]/g, (match, eventId) => {
    const title = getEventTitle(eventId);
    return `<a href="#" onclick="openEventDetail('${eventId}'); return false;" class="event-ref-link" title="${eventId}">${title}</a>`;
  });
}

// Linkify bare event IDs in markdown (matches kebab-case IDs that exist in our data)
// Only processes text content, not inside HTML tags/attributes
function linkifyBareEventIds(html) {
  // Split HTML into text segments and tag segments
  // This ensures we don't match event IDs inside HTML attributes
  const parts = html.split(/(<[^>]+>)/g);
  
  return parts.map(part => {
    // If this part is an HTML tag (starts with <), leave it unchanged
    if (part.startsWith('<')) {
      return part;
    }
    
    // Process text content only
    // Pattern: word boundary + kebab-case ID + word boundary
    return part.replace(/\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/g, (match, eventId) => {
      // Check if this is a known event
      if (biblicalTimelineEventLookup.has(eventId)) {
        const title = getEventTitle(eventId);
        return `<a href="#" onclick="openEventDetail('${eventId}'); return false;" class="event-ref-link" title="${eventId}">${title}</a>`;
      }
      return match; // Not a known event, return unchanged
    });
  }).join('');
}

// Load and render markdown documentation for an event
async function loadEventDocumentation(docPath, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  try {
    const response = await fetch(docPath);
    if (!response.ok) {
      container.innerHTML = `<p style="color: #f44336;">Documentation not found: ${docPath}</p>`;
      return;
    }
    
    const markdown = await response.text();
    
    // Use marked.js for proper markdown rendering
    let html;
    if (typeof marked !== 'undefined') {
      try {
        marked.setOptions({
          breaks: true,
          gfm: true,
          headerIds: false
        });
        html = marked.parse(markdown);
        
        // Add class to tables for styling
        html = html.replace(/<table>/g, '<table class="md-table">');
      } catch (e) {
        console.warn('[Timeline] marked.js error:', e);
        html = `<pre>${markdown}</pre>`;
      }
    } else {
      // Fallback: show as preformatted text
      html = `<pre>${markdown}</pre>`;
    }
    
    // Post-process: Convert [[event-id]] references to clickable links with pretty names
    html = html.replace(/→ \[\[([a-z0-9-]+)\]\]/g, (match, eventId) => {
      const title = getEventTitle(eventId);
      return `<a href="#" onclick="openEventDetail('${eventId}'); return false;" class="event-ref-link event-ref-arrow" title="${eventId}">→ ${title}</a>`;
    });
    html = html.replace(/\[\[([a-z0-9-]+)\]\]/g, (match, eventId) => {
      const title = getEventTitle(eventId);
      return `<a href="#" onclick="openEventDetail('${eventId}'); return false;" class="event-ref-link" title="${eventId}">${title}</a>`;
    });
    
    // Also linkify bare event IDs (kebab-case) that match known events
    html = linkifyBareEventIds(html);
    
    // Set initial collapsed state (show first section only)
    container.innerHTML = html;
    container.style.maxHeight = '400px';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';
    
    // Add fade overlay
    const fade = document.createElement('div');
    fade.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; height: 60px; background: linear-gradient(transparent, #1a3a5c); pointer-events: none;';
    container.appendChild(fade);
    container.dataset.expanded = 'false';
    
  } catch (err) {
    container.innerHTML = `<p style="color: #f44336;">Error loading documentation: ${err.message}</p>`;
  }
}

// Toggle documentation expand/collapse
function toggleDocExpand(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const btn = container.parentElement.querySelector('.doc-expand-btn');
  
  if (container.dataset.expanded === 'false') {
    container.style.maxHeight = 'none';
    container.style.overflow = 'visible';
    // Remove fade overlay
    const fade = container.querySelector('div[style*="linear-gradient"]');
    if (fade) fade.remove();
    container.dataset.expanded = 'true';
    if (btn) btn.textContent = 'Collapse Document';
  } else {
    container.style.maxHeight = '400px';
    container.style.overflow = 'hidden';
    // Re-add fade overlay
    const fade = document.createElement('div');
    fade.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; height: 60px; background: linear-gradient(transparent, #1a3a5c); pointer-events: none;';
    container.appendChild(fade);
    container.dataset.expanded = 'false';
    if (btn) btn.textContent = 'Show Full Document';
  }
}

// Make functions globally available
window.loadEventDocumentation = loadEventDocumentation;
window.toggleDocExpand = toggleDocExpand;

/**
 * Build full derivation chain for an event
 * Follows relative references until reaching a "solid" anchor event
 * Returns array of chain links from current event to anchor
 * @param {object} event - The event to trace
 * @param {object} data - Full events data
 * @param {Array} resolved - Resolved events array
 * @returns {Array} Chain of derivation links
 */
function buildDerivationChain(event, data, resolved) {
  const chain = [];
  const visited = new Set();
  let currentEvent = event;
  
  while (currentEvent && !visited.has(currentEvent.id)) {
    visited.add(currentEvent.id);
    
    const start = currentEvent.start || currentEvent.dates;
    if (!start) break;
    
    // Check if this event has a solid/fixed date (anchor point)
    const isSolid = checkIfSolidDate(start, currentEvent);
    
    // Get resolved date for display: use explicit source data when available, otherwise derive from JD
    const resolvedEvent = resolved.find(e => e.id === currentEvent.id);
    let dateStr = '—';
    if (resolvedEvent?.startJD && typeof EventResolver !== 'undefined') {
      const hebrewMonths = ['', 'Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul',
                            'Tishri', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar II'];
      
      if (start.fixed?.gregorian) {
        // Fixed Gregorian date - use it directly
        const g = start.fixed.gregorian;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const yearStr = g.year > 0 ? `${g.year} AD` : `${1 - g.year} BC`;
        dateStr = `${monthNames[(g.month || 1) - 1]} ${g.day || 1}, ${yearStr}`;
      } else if (start.lunar?.year !== undefined && start.lunar?.month !== undefined && start.lunar?.day !== undefined) {
        // Explicit lunar date in source - use it directly (more accurate than reverse calculation)
        const monthName = hebrewMonths[start.lunar.month] || `Month ${start.lunar.month}`;
        const yearStr = start.lunar.year > 0 ? `${start.lunar.year} AD` : `${1 - start.lunar.year} BC`;
        dateStr = `${monthName}(${start.lunar.month}) ${start.lunar.day}, ${yearStr}`;
      } else if (resolvedEvent._lunarYear !== undefined && start.lunar?.month !== undefined) {
        // Chain-calculated lunar year with explicit month/day from source
        const lunarYear = resolvedEvent._lunarYear;
        const lunarMonth = start.lunar.month;
        const lunarDay = start.lunar.day || 1;
        const monthName = hebrewMonths[lunarMonth] || `Month ${lunarMonth}`;
        const yearStr = lunarYear > 0 ? `${lunarYear} AD` : `${1 - lunarYear} BC`;
        dateStr = `${monthName}(${lunarMonth}) ${lunarDay}, ${yearStr}`;
      } else {
        // No explicit date - derive from resolved JD
        const profile = (typeof getTimelineProfile === 'function') ? getTimelineProfile() : null;
        const lunar = profile ? EventResolver.julianDayToLunar(resolvedEvent.startJD, profile) : null;
        if (lunar) {
          // Prefer _lunarYear from chain calculation if available (more accurate)
          const displayYear = resolvedEvent._lunarYear !== undefined ? resolvedEvent._lunarYear : lunar.year;
          const monthName = hebrewMonths[lunar.month] || `Month ${lunar.month}`;
          const yearStr = displayYear > 0 ? `${displayYear} AD` : `${1 - displayYear} BC`;
          dateStr = `${monthName}(${lunar.month}) ${lunar.day}, ${yearStr}`;
        } else {
          const greg = EventResolver.julianDayToGregorian(resolvedEvent.startJD);
          const yearStr = greg.year > 0 ? `${greg.year} AD` : `${1 - greg.year} BC`;
          dateStr = yearStr;
        }
      }
    }
    
    // Determine what makes this event solid/anchor
    let solidReason = '';
    if (isSolid) {
      if (start.fixed?.gregorian) {
        solidReason = 'Fixed Gregorian date (astronomical/historical)';
      } else if (start.fixed?.julian_day) {
        solidReason = 'Fixed Julian Day number';
      } else if (start.lunar?.year !== undefined && start.lunar?.month !== undefined && start.lunar?.day !== undefined && !start.relative) {
        solidReason = 'Direct lunar date specification';
      } else if (start.gregorian?.year !== undefined && !start.relative) {
        solidReason = 'Direct Gregorian date';
      } else if (start.regal && !start.relative) {
        solidReason = 'Regal year (epoch-based)';
      } else if (start.anno_mundi?.year !== undefined && !start.relative) {
        solidReason = 'Anno Mundi (year from creation)';
      }
    }
    
    // Get offset info for next link
    let offsetStr = '';
    let offsetDirection = '';
    let nextEventId = null;
    
    if (start.relative) {
      nextEventId = start.relative.event;
      const offset = start.relative.offset || {};
      const parts = [];
      if (offset.years) parts.push(`${Math.abs(offset.years)} year${Math.abs(offset.years) !== 1 ? 's' : ''}`);
      if (offset.months) parts.push(`${Math.abs(offset.months)} month${Math.abs(offset.months) !== 1 ? 's' : ''}`);
      if (offset.weeks) parts.push(`${Math.abs(offset.weeks)} week${Math.abs(offset.weeks) !== 1 ? 's' : ''}`);
      if (offset.days) parts.push(`${Math.abs(offset.days)} day${Math.abs(offset.days) !== 1 ? 's' : ''}`);
      offsetStr = parts.join(', ') || 'same time';
      offsetDirection = (start.relative.direction === 'before' ? '↑ before' : '↓ after');
    } else if (start.priestly_cycle) {
      nextEventId = start.priestly_cycle.after_event;
      const courseName = typeof start.priestly_cycle.course === 'string' 
        ? start.priestly_cycle.course 
        : `Course ${start.priestly_cycle.course}`;
      offsetStr = `Next ${courseName} service`;
      offsetDirection = '↓ after';
    } else if (start.lunar_relative) {
      nextEventId = start.lunar_relative.event;
      const hebrewMonths = ['', 'Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 
                            'Tishri', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar'];
      const monthName = hebrewMonths[start.lunar_relative.month] || `Month ${start.lunar_relative.month}`;
      offsetStr = `${monthName} ${start.lunar_relative.day}`;
      offsetDirection = '→ same year';
    }
    
    // Add this event to the chain
    chain.push({
      eventId: currentEvent.id,
      title: currentEvent.title,
      icon: getTypeIcon(currentEvent.type),
      dateStr: dateStr,
      isSolid: isSolid,
      solidReason: solidReason,
      offsetStr: offsetStr,
      offsetDirection: offsetDirection,
      nextEventId: nextEventId
    });
    
    // If this is a solid anchor, stop
    if (isSolid) break;
    
    // Move to the next event in the chain
    if (nextEventId) {
      currentEvent = data?.events?.find(e => e.id === nextEventId);
    } else {
      break;
    }
  }
  
  return chain;
}

/**
 * Check if an event has a "solid" (fixed/absolute) date
 * Solid dates are anchor points that don't derive from other events
 */
function checkIfSolidDate(start, event) {
  if (!start) return false;
  
  // Fixed dates are always solid
  if (start.fixed?.gregorian || start.fixed?.julian_day) {
    return true;
  }
  
  // Direct Gregorian date without relative reference
  if (start.gregorian?.year !== undefined && !start.relative && !start.priestly_cycle && !start.lunar_relative) {
    return true;
  }
  
  // Direct lunar date with full year/month/day without relative reference
  if (start.lunar?.year !== undefined && 
      start.lunar?.month !== undefined && 
      start.lunar?.day !== undefined && 
      !start.relative && 
      !start.priestly_cycle && 
      !start.lunar_relative) {
    return true;
  }
  
  // Regal dates can be considered solid if they reference a known epoch
  if (start.regal && !start.relative) {
    return true;
  }
  
  // Anno Mundi (year from creation) is a system anchor
  if (start.anno_mundi?.year !== undefined && !start.relative && !start.lunar_relative) {
    return true;
  }
  
  return false;
}

// Load filter state from localStorage
function loadTimelineFilters() {
  try {
    const saved = localStorage.getItem(TIMELINE_FILTERS_KEY);
    if (saved) {
      timelineFilters = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load timeline filters:', e);
  }
}

// Save filter state to localStorage
function saveTimelineFilters() {
  try {
    localStorage.setItem(TIMELINE_FILTERS_KEY, JSON.stringify(timelineFilters));
  } catch (e) {
    console.warn('Failed to save timeline filters:', e);
  }
}

// Toggle a filter and re-render (preserve scroll position)
function toggleTimelineFilter(filterName) {
  // Save current scroll position before re-render
  const scrollContainer = document.getElementById('timeline-scroll-container');
  const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
  
  timelineFilters[filterName] = !timelineFilters[filterName];
  saveTimelineFilters();
  renderBiblicalTimeline();
  
  // Restore scroll position after re-render
  setTimeout(() => {
    const newScrollContainer = document.getElementById('timeline-scroll-container');
    if (newScrollContainer) {
      newScrollContainer.scrollTop = savedScrollTop;
    }
  }, 50);
}

// Make filter functions globally available
window.toggleTimelineFilter = toggleTimelineFilter;

// User action - dispatch search to AppStore (unidirectional flow)
// ONLY dispatches - no DOM manipulation. Render handles all UI updates.
function timelineSearchAndZoom() {
  const searchInput = document.getElementById('biblical-timeline-search');
  const searchText = (searchInput?.value || '').toLowerCase().trim();
  
  if (!searchText) {
    return;
  }
  
  // ONLY dispatch - render will handle UI
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_TIMELINE_SEARCH', search: searchText });
  }
}

// Cache for search results to speed up back/forward navigation
let searchResultsCache = {
  searchText: null,
  matchingEvents: null,
  matchingDurations: null,
  minYear: null,
  maxYear: null,
  centerYear: null,
  targetZoom: null
};

// Active search filter - used by filterResolvedEvents to show only search results
// These are Set objects containing event/duration IDs to show
// When null, no search filter is active (show all based on toggle filters)
let activeSearchResultIds = null;
let activeSearchDurationIds = null;

// State-driven render function (called by TimelineView.syncPanelFromState)
// NOTE: Does NOT update search input - that's done by syncPanelFromState
function showSearchResultsFromState(searchText) {
  if (!searchText) return;
  
  searchText = searchText.toLowerCase().trim();
  
  // Check cache first - if same search, use cached results
  console.log('[Search] Cache check:', {
    cacheText: searchResultsCache.searchText,
    inputText: searchText,
    hasEvents: !!searchResultsCache.matchingEvents,
    hasDurations: !!searchResultsCache.matchingDurations,
    match: searchResultsCache.searchText === searchText
  });
  
  if (searchResultsCache.searchText === searchText && 
      searchResultsCache.matchingEvents && 
      searchResultsCache.matchingDurations) {
    console.log('[Search] CACHE HIT - using cached results for:', searchText);
    showCachedSearchResults();
    return;
  }
  
  console.log('[Search] CACHE MISS - computing results for:', searchText);
  
  // Get all resolved events and raw durations
  const data = ResolvedEventsCache.getDataSync();
  const profile = (typeof getTimelineProfile === 'function') ? getTimelineProfile() : null;
  const allEvents = getResolvedEvents(data, profile);
  const allDurations = data?.durations || [];
  
  // Build event JD lookup map for duration year calculation
  const eventJDMap = {};
  (allEvents || []).forEach(e => {
    if (e.id && e.startJD) eventJDMap[e.id] = e.startJD;
  });
  
  // Filter events by search term (search in title, description, tags, id)
  const matchingEvents = (allEvents || []).filter(event => {
    if (event.startJD === null) return false;
    
    const searchableText = [
      event.title || '',
      event.description || '',
      event.id || '',
      ...(event.tags || [])
    ].join(' ').toLowerCase();
    
    return searchableText.includes(searchText);
  });
  
  // Filter durations by search term
  const matchingDurations = allDurations.filter(duration => {
    // Must have resolvable from/to events
    if (!eventJDMap[duration.from_event] && !eventJDMap[duration.to_event]) return false;
    
    const searchableText = [
      duration.title || '',
      duration.description || '',
      duration.id || '',
      ...(duration.tags || [])
    ].join(' ').toLowerCase();
    
    return searchableText.includes(searchText);
  });
  
  const totalMatches = matchingEvents.length + matchingDurations.length;
  
  if (totalMatches === 0) {
    alert(`No events or durations found matching "${searchText}"`);
    return;
  }
  
  // Find min and max years of matching events and durations
  let minYear = Infinity;
  let maxYear = -Infinity;
  
  matchingEvents.forEach(event => {
    if (event.startJD && typeof EventResolver !== 'undefined') {
      const greg = EventResolver.julianDayToGregorian(event.startJD);
      if (greg.year < minYear) minYear = greg.year;
      if (greg.year > maxYear) maxYear = greg.year;
    }
  });
  
  matchingDurations.forEach(duration => {
    if (typeof EventResolver !== 'undefined') {
      const fromJD = eventJDMap[duration.from_event];
      const toJD = eventJDMap[duration.to_event];
      if (fromJD) {
        const greg = EventResolver.julianDayToGregorian(fromJD);
        if (greg.year < minYear) minYear = greg.year;
        if (greg.year > maxYear) maxYear = greg.year;
      }
      if (toJD) {
        const greg = EventResolver.julianDayToGregorian(toJD);
        if (greg.year < minYear) minYear = greg.year;
        if (greg.year > maxYear) maxYear = greg.year;
      }
    }
  });
  
  if (minYear === Infinity || maxYear === -Infinity) {
    console.log('[Search] Could not determine year range');
    return;
  }
  
  // Add small margin (2% of range, minimum 1 year, maximum 5 years)
  const range = maxYear - minYear;
  const margin = Math.min(5, Math.max(1, Math.ceil(range * 0.02)));
  minYear -= margin;
  maxYear += margin;
  
  console.log('[Search] Zooming to year range:', minYear, 'to', maxYear, '(margin:', margin, ')');
  
  // Calculate zoom level to fit the year range
  const scrollContainer = document.getElementById('timeline-scroll-container');
  let targetZoom = biblicalTimelineZoom;
  
  if (minYear !== Infinity && maxYear !== -Infinity && scrollContainer) {
    const viewportHeight = scrollContainer.clientHeight;
    const yearRange = maxYear - minYear;
    targetZoom = viewportHeight / yearRange;
  }
  
  const centerYear = Math.round((minYear + maxYear) / 2);
  
  // Cache the results for fast back/forward
  searchResultsCache = {
    searchText,
    matchingEvents,
    matchingDurations,
    minYear,
    maxYear,
    centerYear,
    targetZoom
  };
  
  // Display the results
  displaySearchResults(false);
}

// Display search results from cache (called by showSearchResultsFromState or showCachedSearchResults)
function displaySearchResults(fromCache) {
  const { matchingEvents, matchingDurations, centerYear, targetZoom, searchText } = searchResultsCache;
  
  if (!matchingEvents || !matchingDurations) return;
  
  // Set the active search filter for renderBiblicalTimeline to use
  // This ensures only search result events are rendered with correct slot positions
  activeSearchResultIds = new Set(matchingEvents.map(e => e.id));
  activeSearchDurationIds = new Set(matchingDurations.map(d => d.id));
  
  // If the search filter was already pre-applied during the initial render,
  // skip the redundant re-render — just show the results panel + highlights.
  const wasPreApplied = _searchPreAppliedDuringRender;
  if (_searchPreAppliedDuringRender) {
    console.log('[Timeline] Skipping re-render — search was pre-applied during initial render');
    _searchPreAppliedDuringRender = false;
    fromCache = false; // Treat as fresh so highlights + scroll still apply
    // Fall through to show panel below
  }
  // Fresh search: apply zoom and re-render with search results only
  else if (!fromCache) {
    if (targetZoom) {
      // Clamp zoom to valid range (0.1 to 500)
      biblicalTimelineZoom = Math.max(0.1, Math.min(500, targetZoom));
    }
    // Re-render to show only search results with correct slot positions
    renderBiblicalTimeline();
  }
  // From cache (back navigation): just re-render with cached search filter
  // The search IDs are already set above, so render will use them
  else {
    renderBiblicalTimeline();
  }
  
  // Show results panel and scroll/highlight (use requestAnimationFrame for smooth transition)
  requestAnimationFrame(() => {
    // Show results in detail panel
    renderSearchResultsInternal(searchText, matchingEvents, matchingDurations, true);
    
    // Scroll to center the range (smooth scroll) - only if not from cache
    // Skip scroll if pre-applied from URL (URL already specifies position)
    if (!fromCache && !wasPreApplied && centerYear !== null) {
      scrollTimelineToYear(centerYear);
    }
    
    // Highlight matching events briefly (skip if from cache - already highlighted before)
    if (!fromCache) {
      matchingEvents.forEach(event => {
        const eventEl = document.querySelector(`[data-event-id="${event.id}"]`);
        if (eventEl) {
          eventEl.classList.add('search-highlight');
          setTimeout(() => eventEl.classList.remove('search-highlight'), 3000);
        }
      });
      
      matchingDurations.forEach(duration => {
        const durationEl = document.querySelector(`[data-duration-id="${duration.id}"]`);
        if (durationEl) {
          durationEl.classList.add('search-highlight');
          setTimeout(() => durationEl.classList.remove('search-highlight'), 3000);
        }
      });
    }
  });
}

// Show cached search results (fast path for back/forward navigation)
function showCachedSearchResults() {
  displaySearchResults(true);
}

// Render search results in the detail panel
function renderSearchResultsInternal(searchText, matchingEvents, matchingDurations, addHistory = true) {
  initDetailPanel();
  
  const totalMatches = matchingEvents.length + matchingDurations.length;
  
  // Build event JD lookup for duration year display
  const data = ResolvedEventsCache.getDataSync();
  const profile = (typeof getTimelineProfile === 'function') ? getTimelineProfile() : null;
  const allEvents = getResolvedEvents(data, profile) || [];
  const eventJDMap = {};
  allEvents.forEach(e => {
    if (e.id && e.startJD) eventJDMap[e.id] = e.startJD;
  });
  
  // Sort events by year
  matchingEvents.sort((a, b) => (a.startJD || 0) - (b.startJD || 0));
  
  let html = `
    <div class="detail-section" style="padding: 10px 15px; margin-bottom: 10px;">
      <div class="detail-label">Found ${totalMatches} result${totalMatches !== 1 ? 's' : ''}</div>
    </div>
  `;
  
  // Events list
  if (matchingEvents.length > 0) {
    html += `<div class="detail-section">
      <div class="detail-label" style="margin-bottom: 10px;">📅 Events (${matchingEvents.length})</div>
      <div class="search-results-list">`;
    
    matchingEvents.forEach(event => {
      // Get icon from event or default based on type
      const typeIcons = {
        birth: '👶', death: '💀', 'biblical-event': '📖', feast: '🎉',
        reign: '👑', battle: '⚔️', prophecy: '📜', astronomical: '🌟',
        construction: '🏛️', catastrophe: '🌊', miracle: '✨'
      };
      const icon = event.icon || typeIcons[event.type] || '📅';
      let yearDisplay = '';
      if (event.startJD && typeof EventResolver !== 'undefined') {
        const greg = EventResolver.julianDayToGregorian(event.startJD);
        yearDisplay = greg.year <= 0 ? `${1 - greg.year} BC` : `${greg.year} AD`;
      }
      html += `
        <div class="search-result-item" onclick="openEventDetail('${event.id}')">
          <span class="search-result-icon">${icon}</span>
          <span class="search-result-title">${event.title || event.id}</span>
          <span class="search-result-year">${yearDisplay}</span>
        </div>`;
    });
    
    html += `</div></div>`;
  }
  
  // Durations list
  if (matchingDurations.length > 0) {
    html += `<div class="detail-section">
      <div class="detail-label" style="margin-bottom: 10px;">🔗 Durations (${matchingDurations.length})</div>
      <div class="search-results-list">`;
    
    matchingDurations.forEach(duration => {
      // Show end date (to_event) since that's when the duration was declared/significant
      let yearDisplay = '';
      const toJD = eventJDMap[duration.to_event];
      if (toJD && typeof EventResolver !== 'undefined') {
        const greg = EventResolver.julianDayToGregorian(toJD);
        yearDisplay = greg.year <= 0 ? `${1 - greg.year} BC` : `${greg.year} AD`;
      }
      html += `
        <div class="search-result-item" onclick="openDurationDetail('${duration.id}')">
          <span class="search-result-icon">📏</span>
          <span class="search-result-title">${duration.title || duration.id}</span>
          <span class="search-result-year">${yearDisplay}</span>
        </div>`;
    });
    
    html += `</div></div>`;
  }
  
  // Show in panel
  showDetailPanel(html);
}

// User action - clear search and close panel (unidirectional flow)
// ONLY dispatches - no DOM manipulation. Render handles all UI updates.
function timelineClearSearch() {
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_TIMELINE_SEARCH', search: null });
  }
}

// Combined action - clear search AND close detail panel
function timelineClearAndClose() {
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatchBatch([
      { type: 'SET_TIMELINE_SEARCH', search: null },
      { type: 'SET_TIMELINE_EVENT', eventId: null },
      { type: 'SET_TIMELINE_DURATION', durationId: null }
    ]);
  }
}

// Close event detail panel only (keep search)
function timelineCloseEventDetail() {
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatchBatch([
      { type: 'SET_TIMELINE_EVENT', eventId: null },
      { type: 'SET_TIMELINE_DURATION', durationId: null }
    ]);
  }
}

// State-driven close panel (called by TimelineView.syncPanelFromState)
function closeDetailPanelFromState() {
  const panel = document.getElementById('detail-slideout-panel');
  if (panel) {
    panel.classList.remove('open');
  }
  document.body.classList.remove('detail-panel-open');
  highlightDurationBar(null);
  
  // Reset timeline width when panel closes
  const timeline = document.querySelector('.ruler-timeline-container');
  if (timeline) {
    timeline.style.width = '100%';
  }
  
  // Clear search filter and re-render to show all events with correct slots
  if (activeSearchResultIds !== null) {
    activeSearchResultIds = null;
    activeSearchDurationIds = null;
    renderBiblicalTimeline();
  }
}

// Make search functions globally available
window.timelineSearchAndZoom = timelineSearchAndZoom;
window.timelineClearSearch = timelineClearSearch;
window.timelineClearAndClose = timelineClearAndClose;
window.timelineCloseEventDetail = timelineCloseEventDetail;

// Calculate the center year from current scroll position
function getTimelineCenterYear() {
  const scrollContainer = document.getElementById('timeline-scroll-container');
  const scrollContent = document.getElementById('biblical-timeline-scroll');
  
  if (!scrollContainer || !scrollContent || biblicalTimelineMinYear === null || biblicalTimelineMaxYear === null) {
    return null;
  }
  
  const scrollTop = scrollContainer.scrollTop;
  const viewportHeight = scrollContainer.clientHeight;
  const contentHeight = scrollContent.clientHeight;
  
  // Calculate center position as ratio
  const centerOffset = scrollTop + (viewportHeight / 2);
  const centerRatio = centerOffset / contentHeight;
  
  // Convert ratio to year
  const yearRange = biblicalTimelineMaxYear - biblicalTimelineMinYear;
  const centerYear = Math.round(biblicalTimelineMinYear + (centerRatio * yearRange));
  
  return centerYear;
}

// Calculate scroll position from center year
function scrollToTimelineYear(year) {
  const scrollContainer = document.getElementById('timeline-scroll-container');
  const scrollContent = document.getElementById('biblical-timeline-scroll');
  
  if (!scrollContainer || !scrollContent || biblicalTimelineMinYear === null || biblicalTimelineMaxYear === null) {
    return;
  }
  
  const viewportHeight = scrollContainer.clientHeight;
  const contentHeight = scrollContent.clientHeight;
  const yearRange = biblicalTimelineMaxYear - biblicalTimelineMinYear;
  
  // Convert year to ratio
  const yearRatio = (year - biblicalTimelineMinYear) / yearRange;
  
  // Calculate scroll position to center this year
  const centerOffset = yearRatio * contentHeight;
  const scrollTop = centerOffset - (viewportHeight / 2);
  
  scrollContainer.scrollTop = Math.max(0, Math.min(scrollTop, contentHeight - viewportHeight));
}

// Debounce timer for URL updates
let timelineURLUpdateTimer = null;

// Save timeline state to localStorage (synchronous, no URL update)
function saveTimelineStateToLocalStorage() {
  const scrollContainer = document.getElementById('timeline-scroll-container');
  const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
  const centerYear = getTimelineCenterYear();
  
  const localState = {
    zoom: biblicalTimelineZoom,
    scrollTop: scrollTop,
    centerYear: centerYear
  };
  try {
    localStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(localState));
  } catch (e) {
    // localStorage might be unavailable
  }
  return { zoom: biblicalTimelineZoom, centerYear };
}

// Update URL with current timeline zoom/position state (debounced)
// Uses replaceState directly to avoid triggering AppStore notifications
function updateTimelinePositionURL() {
  if (typeof URLRouter === 'undefined') return;
  
  const centerYear = getTimelineCenterYear();
  
  // Update URL directly using replaceState to avoid AppStore dispatch cycle
  // This prevents the scroll jump that happens when dispatch triggers re-render
  try {
    const url = new URL(window.location.href);
    
    if (biblicalTimelineZoom !== null && biblicalTimelineZoom !== 1.0) {
      url.searchParams.set('zoom', Math.round(biblicalTimelineZoom * 100) / 100);
    } else {
      url.searchParams.delete('zoom');
    }
    
    if (centerYear !== null) {
      url.searchParams.set('year', centerYear);
    } else {
      url.searchParams.delete('year');
    }
    
    // Use replaceState to update URL without triggering navigation
    window.history.replaceState(window.history.state, '', url.toString());
    
    // Also update AppStore state silently (without triggering notify)
    if (typeof AppStore !== 'undefined' && AppStore._state) {
      AppStore._state.ui.timelineZoom = biblicalTimelineZoom;
      AppStore._state.ui.timelineCenterYear = centerYear;
    }
  } catch (e) {
    console.warn('[Timeline] Error updating URL:', e);
  }
}

// Save timeline state - immediate localStorage, debounced URL
function saveTimelineState() {
  // Save to localStorage immediately
  saveTimelineStateToLocalStorage();
  
  // Debounce URL updates to avoid excessive dispatches during zoom/scroll
  if (timelineURLUpdateTimer) {
    clearTimeout(timelineURLUpdateTimer);
  }
  timelineURLUpdateTimer = setTimeout(() => {
    updateTimelinePositionURL();
  }, 500);
}

// Load timeline state from localStorage
function loadTimelineState() {
  try {
    const saved = localStorage.getItem(TIMELINE_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    // localStorage might be unavailable
  }
  return null;
}

// Convert Gregorian year to Date for timeline
// Handles BC years (negative) and accounts for Julian calendar before 1582
function gregorianYearToDate(year, month = 1, day = 1) {
  // JavaScript Date has quirks with years < 100:
  // - Date.UTC(32, 0, 1) might be interpreted incorrectly
  // - We must use setUTCFullYear() to force the correct year
  
  // Create date in UTC to avoid timezone issues
  // Use year 2000 as temporary, then set correct year
  const date = new Date(Date.UTC(2000, month - 1, day, 12, 0, 0));
  
  // Always use setUTCFullYear to ensure correct year (handles all cases)
  date.setUTCFullYear(year);
  
  return date;
}

// Convert lunar date to approximate Gregorian date
// This is approximate since lunar months don't align perfectly with solar months
function lunarToGregorianDate(lunar, referenceYear) {
  if (!lunar || referenceYear === null || referenceYear === undefined) {
    return null;
  }
  
  // Use the reference year and approximate month/day
  // Lunar months are roughly 29.5 days, so we approximate
  const month = lunar.month || 1;
  const day = lunar.day || 1;
  
  // Approximate: assume lunar month 1 starts around March/April (Nisan)
  // This is a rough approximation - actual conversion would require full calendar calculation
  let gregMonth = month + 2; // Approximate offset
  if (gregMonth > 12) {
    gregMonth -= 12;
  }
  
  return gregorianYearToDate(referenceYear, gregMonth, Math.min(day, 30));
}

// Get event date for timeline (prefer Gregorian, fallback to lunar conversion)
function getEventTimelineDate(event) {
  // Prefer Gregorian date if available
  if (event.dates?.gregorian?.year !== undefined) {
    const year = event.dates.gregorian.year;
    const month = event.dates.gregorian.month || 1;
    const day = event.dates.gregorian.day || 1;
    return gregorianYearToDate(year, month, day);
  }
  
  // Try Anno Mundi conversion (rough: AM 1 ≈ 4000 BC)
  if (event.dates?.anno_mundi?.year) {
    const amYear = event.dates.anno_mundi.year;
    const approxYear = amYear - 4000;
    const month = event.dates.anno_mundi.month || 1;
    const day = event.dates.anno_mundi.day || 1;
    return gregorianYearToDate(approxYear, month, day);
  }
  
  // Try lunar date with year
  if (event.dates?.lunar?.year) {
    return lunarToGregorianDate(event.dates.lunar, event.dates.lunar.year);
  }
  
  return null;
}

// Get event end date (for range events)
function getEventEndDate(event) {
  // Check if event has explicit end date
  if (event.dates?.gregorian?.end_year) {
    const year = event.dates.gregorian.end_year;
    const month = event.dates.gregorian.end_month || 12;
    const day = event.dates.gregorian.end_day || 31;
    return gregorianYearToDate(year, month, day);
  }
  
  // Check if event has duration object (years, months, weeks, days)
  if (event.duration) {
    const startDate = getEventTimelineDate(event);
    if (!startDate) return null;
    
    let endDate = new Date(startDate.getTime());
    
    if (event.duration.years) {
      endDate.setUTCFullYear(endDate.getUTCFullYear() + event.duration.years);
    }
    if (event.duration.months) {
      endDate.setUTCMonth(endDate.getUTCMonth() + event.duration.months);
    }
    if (event.duration.weeks) {
      endDate.setUTCDate(endDate.getUTCDate() + event.duration.weeks * 7);
    }
    if (event.duration.days) {
      endDate.setUTCDate(endDate.getUTCDate() + event.duration.days);
    }
    
    return endDate;
  }
  
  // Check if event has durations array (multiple prophecy durations)
  if (event.durations && event.durations.length > 0) {
    const startDate = getEventTimelineDate(event);
    if (!startDate) return null;
    
    // Use the longest duration for display
    const longestDuration = event.durations.reduce((max, d) => 
      (d.years || 0) > (max.years || 0) ? d : max, event.durations[0]);
    
    let endDate = new Date(startDate.getTime());
    if (longestDuration.years) {
      endDate.setUTCFullYear(endDate.getUTCFullYear() + longestDuration.years);
    }
    
    return endDate;
  }
  
  // Legacy: For reign events with duration_years
  if (event.type === 'reign' && event.dates?.gregorian?.year && event.duration_years) {
    const startYear = event.dates.gregorian.year;
    const endYear = startYear + event.duration_years;
    return gregorianYearToDate(endYear, 12, 31);
  }
  
  return null;
}

// Format year for display (astronomical year numbering)
// Year 1 = 1 AD, Year 0 = 1 BC, Year -1 = 2 BC, Year -2025 = 2026 BC
function formatYear(year) {
  if (year === null || year === undefined) return '—';
  if (year <= 0) {
    // Astronomical: year 0 = 1 BC, year -1 = 2 BC, year -N = (N+1) BC
    return `${1 - year} BC`;
  } else {
    return `${year} AD`;
  }
}

// Get era group for event (matches getEventEra from historical-events.js)
function getEventEraGroup(event) {
  let year = null;
  
  if (event.dates?.gregorian?.year !== undefined) {
    year = event.dates.gregorian.year;
  } else if (event.dates?.anno_mundi?.year) {
    // Rough conversion: AM 1 = ~4000 BC
    year = event.dates.anno_mundi.year - 4000;
  }
  
  if (year === null) return 'Unknown';
  
  if (year <= -2300) return 'Creation to Flood';        // Creation to Flood
  if (year <= -1700) return 'Patriarchs';              // Abraham to Joseph
  if (year <= -1000) return 'Exodus to Judges';        // Exodus to Judges
  if (year <= -930) return 'United Monarchy';           // United Monarchy
  if (year <= -586) return 'Divided Kingdom';          // Divided Kingdom
  if (year <= -400) return 'Exile & Return';           // Exile and Return
  if (year <= 70) return 'Second Temple Period';       // Second Temple Period
  return 'Roman Period';                                 // Roman Period
}

// Get type icon
function getTypeIcon(type) {
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
    'catastrophe': '🌊',
    'life': '👤' // Person icon for life spans
  };
  return icons[type] || '📌';
}

// Get event color based on type
function getEventColor(type) {
  const colors = {
    'milestone': '#7ec8e3',
    'reign': '#d4a017',
    'construction': '#4caf50',
    'feast': '#ff9800',
    'death': '#9e9e9e',
    'birth': '#e91e63',
    'conquest': '#f44336',
    'siege': '#ff5722',
    'prophecy': '#9c27b0',
    'astronomical': '#2196f3',
    'destruction': '#d32f2f',
    'ministry': '#00bcd4',
    'decree': '#607d8b',
    'battle': '#e53935',
    'catastrophe': '#795548',
    'life': '#9c27b0' // Purple for life spans
  };
  return colors[type] || '#7ec8e3';
}

// Load and prepare timeline data (delegates to ResolvedEventsCache singleton)
async function loadBiblicalTimelineData() {
  return ResolvedEventsCache.getData();
}

// Get current calendar profile for event resolution
function getTimelineProfile() {
  // Try AppStore first (preferred approach)
  if (typeof AppStore !== 'undefined') {
    const appState = AppStore.getState();
    const profileId = appState.context?.profileId || 'timeTested';
    const profile = window.PROFILES?.[profileId] || {};
    
    // Return profile settings directly - event-resolver expects these field names
    return {
      moonPhase: profile.moonPhase || 'full',
      dayStartTime: profile.dayStartTime || 'morning',
      dayStartAngle: profile.dayStartAngle ?? 12,
      yearStartRule: profile.yearStartRule || 'equinox',
      crescentThreshold: profile.crescentThreshold ?? 18,
      lat: appState.context?.location?.lat || 31.7683,
      lon: appState.context?.location?.lon || 35.2137,
      amEpoch: -4000
    };
  }
  
  // Fallback: read from global state variables
  if (typeof state !== 'undefined') {
    return {
      moonPhase: state.moonPhase || 'full',
      dayStartTime: state.dayStartTime || 'morning',
      dayStartAngle: state.dayStartAngle ?? 12,
      yearStartRule: state.yearStartRule || 'equinox',
      crescentThreshold: state.crescentThreshold ?? 18,
      lat: state.lat || 31.7683,
      lon: state.lon || 35.2137,
      amEpoch: -4000
    };
  }
  
  return EventResolver.DEFAULT_PROFILE;
}

// Filter events based on current filter settings
function getFilteredTimelineEvents(events) {
  const typeFilter = document.getElementById('biblical-timeline-type-filter')?.value || 'all';
  const eraFilter = document.getElementById('biblical-timeline-era-filter')?.value || 'all';
  // Get search from state (unidirectional flow)
  const searchText = getTimelineSearchFromState().toLowerCase().trim();
  
  return events.filter(event => {
    // Type filter
    if (typeFilter !== 'all' && event.type !== typeFilter) {
      return false;
    }
    
    // Era filter
    if (eraFilter !== 'all') {
      const eventEra = getEventEraGroup(event);
      const eraMap = {
        'creation': 'Creation to Flood',
        'patriarchs': 'Patriarchs',
        'exodus': 'Exodus to Judges',
        'monarchy': 'United Monarchy',
        'divided': 'Divided Kingdom',
        'exile': 'Exile & Return',
        'second-temple': 'Second Temple Period',
        'roman': 'Roman Period'
      };
      if (eventEra !== eraMap[eraFilter]) {
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
}

// Get current timeline search from state
function getTimelineSearchFromState() {
  if (typeof AppStore !== 'undefined') {
    const state = AppStore.getState();
    return state?.ui?.timelineSearch || '';
  }
  return '';
}

// Filter resolved events (for v2 format)
function filterResolvedEvents(events, data) {
  const typeFilter = document.getElementById('biblical-timeline-type-filter')?.value || 'all';
  
  // Get selected event/duration from state - these should ALWAYS be shown
  let selectedEventId = null;
  let selectedDurationId = null;
  if (typeof AppStore !== 'undefined') {
    const state = AppStore.getState();
    selectedEventId = state?.ui?.timelineEventId;
    selectedDurationId = state?.ui?.timelineDurationId;
  }
  
  // Include selected duration's endpoints
  const durationEndpointIds = new Set();
  if (selectedDurationId && data?.durations) {
    const selectedDur = data.durations.find(d => d.id === selectedDurationId);
    if (selectedDur) {
      if (selectedDur.from_event) durationEndpointIds.add(selectedDur.from_event);
      if (selectedDur.to_event) durationEndpointIds.add(selectedDur.to_event);
    }
  }
  
  // Load filters on first call
  loadTimelineFilters();
  
  return events.filter(event => {
    // Skip events with no valid dates
    if (event.startJD === null) return false;
    
    // ALWAYS show selected event (top priority)
    if (selectedEventId && event.id === selectedEventId) return true;
    
    // ALWAYS show duration endpoints (from/to events of selected duration)
    if (durationEndpointIds.has(event.id)) return true;
    
    // If search filter is active, ONLY show search result events
    // This ensures correct slot positions for just the search results
    if (activeSearchResultIds !== null) {
      return activeSearchResultIds.has(event.id);
    }
    
    // Apply toggle button filters
    const eventType = event.type || '';
    const eventTags = event.tags || [];
    
    // Birth filter (includes conception events)
    if (!timelineFilters.births && (eventType === 'birth' || eventType === 'conception')) return false;
    
    // Death filter
    if (!timelineFilters.deaths && eventType === 'death') return false;
    
    // Biblical events filter (biblical-event, feast, creation, catastrophe)
    if (!timelineFilters.biblical) {
      const biblicalTypes = ['biblical-event', 'feast', 'creation', 'catastrophe'];
      if (biblicalTypes.includes(eventType)) return false;
    }
    
    // Biblical-date events filter (specific verse date references)
    if (!timelineFilters.dates) {
      if (eventType === 'biblical-date') return false;
    }
    
    // Historical events filter (conquest, decree, construction, destruction, reign, astronomical, battle)
    if (!timelineFilters.historical) {
      const historicalTypes = ['conquest', 'decree', 'construction', 'destruction', 'reign', 'historical', 'astronomical', 'battle', 'milestone'];
      if (historicalTypes.includes(eventType)) return false;
    }
    
    // Prophecy filter
    if (!timelineFilters.prophecy) {
      if (eventType === 'prophecy' || eventType === 'prophecy-duration') return false;
      if (eventTags.includes('prophecy')) return false;
    }
    
    // Type dropdown filter (from table view)
    if (typeFilter !== 'all' && event.type !== typeFilter) {
      return false;
    }
    
    // NOTE: Search filtering is handled via CSS visibility toggle in displaySearchResults()
    // This allows back/forward navigation without re-rendering the timeline
    
    return true;
  });
}


// Convert events to vis.js timeline items
function convertEventsToTimelineItems(events) {
  const items = [];
  const groups = new Map();
  
  // First pass: create groups with better height management
  events.forEach(event => {
    const era = getEventEraGroup(event);
    if (!groups.has(era)) {
      const groupId = `era-${era.replace(/\s+/g, '-').toLowerCase()}`;
      groups.set(era, {
        id: groupId,
        content: era,
        order: getEraOrder(era),
        // Use auto height to accommodate stacked items
        heightMode: 'auto'
      });
    }
  });
  
  // Second pass: create items
  events.forEach((event, index) => {
    const startDate = getEventTimelineDate(event);
    if (!startDate) return; // Skip events without dates
    
    const endDate = getEventEndDate(event);
    const era = getEventEraGroup(event);
    const groupId = `era-${era.replace(/\s+/g, '-').toLowerCase()}`;
    
    // Use 'point' type for single-day events to reduce overlapping
    // Only use 'range' for events with actual duration (reigns, constructions, etc.)
    const hasDuration = endDate && (endDate.getTime() - startDate.getTime()) > (1000 * 60 * 60 * 24 * 30); // More than 30 days
    // Determine item type: use range for events with duration (reigns, constructions, lives)
    const itemType = (hasDuration && (event.type === 'reign' || event.type === 'construction' || event.type === 'life')) ? 'range' : 'point';
    
    // Build content - for point items, show only icon (text appears in tooltip)
    // For range items, show icon + title
    const icon = getTypeIcon(event.type);
    let content = itemType === 'point' ? icon : `${icon} ${event.title}`;
    
    // Add date info to tooltip
    let title = event.title;
    if (event.dates?.gregorian) {
      const year = event.dates.gregorian.year;
      title += `\n${formatYear(year)}`;
      if (event.dates.gregorian.month) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        title += ` ${monthNames[event.dates.gregorian.month - 1]}`;
        if (event.dates.gregorian.day) {
          title += ` ${event.dates.gregorian.day}`;
        }
      }
    }
    if (event.dates?.lunar) {
      if (event.dates.lunar.month) {
        const lunarYear = event.dates.lunar.year || '';
        title += `\nLunar: ${lunarYear}/${event.dates.lunar.month}/${event.dates.lunar.day || 1}`;
      }
    }
    if (event.description) {
      title += `\n\n${event.description.substring(0, 200)}${event.description.length > 200 ? '...' : ''}`;
    }
    
    const item = {
      id: event.id || `event-${index}`,
      content: content,
      start: startDate,
      end: endDate && hasDuration ? endDate : undefined,
      group: groupId,
      type: itemType,
      className: `timeline-event-${event.type || 'default'}`,
      title: title,
      style: itemType === 'point' 
        ? `background-color: ${getEventColor(event.type)}; border-color: ${getEventColor(event.type)}; color: white;`
        : `background-color: ${getEventColor(event.type)}; border-color: ${getEventColor(event.type)}; color: white;`,
      // Store event ID for lookup (vis.js DataSet may not preserve custom objects)
      eventId: event.id || `event-${index}`
    };
    
    items.push(item);
  });
  
  // Convert groups map to array and sort by order
  const groupsArray = Array.from(groups.values()).sort((a, b) => a.order - b.order);
  
  return { items, groups: groupsArray };
}

// Get era order for sorting
function getEraOrder(era) {
  const order = {
    'Creation to Flood': 1,
    'Patriarchs': 2,
    'Exodus to Judges': 3,
    'United Monarchy': 4,
    'Divided Kingdom': 5,
    'Exile & Return': 6,
    'Second Temple Period': 7,
    'Roman Period': 8,
    'Unknown': 9
  };
  return order[era] || 99;
}

// Debug mode - set to true to show diagnostic table instead of rendering timeline
const TIMELINE_DEBUG_MODE = false;
let currentTimelineTab = 'graph'; // 'table', 'graph', or 'durations' - default to graph

// Function to switch timeline tabs
function switchTimelineTab(tab) {
  currentTimelineTab = tab;
  renderBiblicalTimeline();
}

// =====================================================
// SLIDE-OUT DETAIL PANEL SYSTEM
// Replaces modal popups with a slide-out panel from the right
// Includes navigation history for PWA back/forward
// =====================================================

// NOTE: Detail panel navigation is now handled by browser history via URL
// The old manual detailPanelHistory has been removed in favor of unidirectional flow

// Panel width preference key
const PANEL_WIDTH_KEY = 'timeline_panel_width';
const DEFAULT_PANEL_WIDTH = 50; // percent
const MIN_PANEL_WIDTH = 20; // percent
const MAX_PANEL_WIDTH = 80; // percent

// Get/set panel width
function getPanelWidth() {
  const stored = localStorage.getItem(PANEL_WIDTH_KEY);
  return stored ? parseFloat(stored) : DEFAULT_PANEL_WIDTH;
}

function setPanelWidth(percent) {
  const clamped = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, percent));
  localStorage.setItem(PANEL_WIDTH_KEY, clamped.toString());
  applyPanelWidth(clamped);
  return clamped;
}

function applyPanelWidth(percent) {
  const panel = document.getElementById('detail-slideout-panel');
  const timeline = document.querySelector('.ruler-timeline-container');
  
  if (panel) {
    panel.style.width = percent + '%';
  }
  if (timeline && document.body.classList.contains('detail-panel-open')) {
    timeline.style.width = (100 - percent) + '%';
  }
}

// Initialize resize handle drag behavior
function initResizeHandle() {
  const handle = document.getElementById('detail-resize-handle');
  if (!handle) return;
  
  let isDragging = false;
  let startX, startWidth;
  
  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startWidth = getPanelWidth();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const timelinePage = document.getElementById('biblical-timeline-page') ||
                         document.querySelector('.biblical-timeline-page');
    if (!timelinePage) return;
    
    const containerWidth = timelinePage.offsetWidth;
    const deltaX = startX - e.clientX; // Moving left = bigger panel
    const deltaPercent = (deltaX / containerWidth) * 100;
    const newWidth = startWidth + deltaPercent;
    
    setPanelWidth(newWidth);
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
  
  // Touch support for mobile
  handle.addEventListener('touchstart', (e) => {
    isDragging = true;
    startX = e.touches[0].clientX;
    startWidth = getPanelWidth();
    e.preventDefault();
  }, { passive: false });
  
  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    
    const timelinePage = document.getElementById('biblical-timeline-page') ||
                         document.querySelector('.biblical-timeline-page');
    if (!timelinePage) return;
    
    const containerWidth = timelinePage.offsetWidth;
    const deltaX = startX - e.touches[0].clientX;
    const deltaPercent = (deltaX / containerWidth) * 100;
    const newWidth = startWidth + deltaPercent;
    
    setPanelWidth(newWidth);
  }, { passive: true });
  
  document.addEventListener('touchend', () => {
    isDragging = false;
  });
  
  // Apply stored width on init
  applyPanelWidth(getPanelWidth());
}

// Inject timeline styles early (called on first render, before any interactions)
function injectTimelineStyles() {
  if (document.getElementById('detail-slideout-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'detail-slideout-styles';
  style.textContent = `
    /* Detail panel positioned within timeline page */
    .detail-slideout {
      position: absolute;
      top: 0;
      bottom: 0;
      right: -600px;
      width: 500px;
      background: #1a1a2e;
      border-left: 1px solid rgba(126, 200, 227, 0.2);
      transition: right 0.3s ease;
      display: flex;
      flex-direction: row;
      overflow: hidden;
      z-index: 9500;
      color: #e0e0e0;
    }
    .detail-slideout.open {
      right: 0;
    }
    
    .detail-resize-handle {
      width: 6px;
      cursor: ew-resize;
      background: linear-gradient(180deg, rgba(126, 200, 227, 0.2), rgba(126, 200, 227, 0.4), rgba(126, 200, 227, 0.2));
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .detail-resize-handle:hover {
      background: linear-gradient(180deg, rgba(126, 200, 227, 0.4), rgba(126, 200, 227, 0.6), rgba(126, 200, 227, 0.4));
    }
    
    .detail-slideout-content {
      flex: 1;
      overflow-y: auto;
      padding: 48px 20px 20px 20px;  /* Extra top padding for close button */
      color: #e0e0e0;
    }
    
    .detail-close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      color: #e0e0e0;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .detail-close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
    }
    
    /* Mobile: full screen overlay */
    @media (max-width: 768px) {
      .detail-slideout {
        position: absolute;
        top: 0;
        right: 0;
        left: 0;
        bottom: 0;
        width: 100% !important;
        border-left: none;
        transition: transform 0.3s ease;
        transform: translateX(100%);
        flex-direction: column;
      }
      .detail-slideout.open {
        transform: translateX(0);
      }
      .detail-resize-handle {
        display: none;
      }
    }
    
    /* Event hover tooltip (mobile) - positioned inside scroll content */
    .event-hover-tooltip {
      position: absolute;
      z-index: 9000;
      background: linear-gradient(180deg, #1a3a5c 0%, #0d2840 100%);
      border: 1px solid rgba(126, 200, 227, 0.4);
      border-radius: 10px;
      padding: 12px 16px;
      max-width: 280px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      animation: tooltipFadeIn 0.2s ease-out;
      pointer-events: none; /* Don't block touches on events below */
    }
    @keyframes tooltipFadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .tooltip-title {
      color: #7ec8e3;
      font-size: 1.1em;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .tooltip-date {
      color: #6bc46b;
      font-size: 0.9em;
      margin-bottom: 8px;
    }
    .tooltip-desc {
      color: #ccc;
      font-size: 0.85em;
      line-height: 1.4;
    }
    .tooltip-link {
      display: block;
      color: #7ec8e3;
      font-size: 0.85em;
      margin-top: 10px;
      text-decoration: none;
      pointer-events: auto;
      cursor: pointer;
      padding: 6px 10px;
      background: rgba(126, 200, 227, 0.15);
      border-radius: 4px;
      text-align: center;
      transition: background 0.2s;
    }
    .tooltip-link:hover {
      background: rgba(126, 200, 227, 0.3);
    }
    
    /* Detail panel sections and content styling */
    .detail-title {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0 0 20px 0;
      color: #7ec8e3;
      font-size: 1.4em;
    }
    .detail-title-icon {
      font-size: 1.2em;
    }
    .detail-section {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .detail-section h4 {
      color: #7ec8e3;
      margin: 0 0 10px 0;
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .detail-section p {
      margin: 0;
      line-height: 1.6;
      color: #ccc;
    }
    .detail-date-row {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }
    .detail-date-item {
      flex: 1;
      min-width: 120px;
    }
    .detail-date-label {
      color: #888;
      font-size: 0.8em;
      margin-bottom: 4px;
    }
    .detail-date-value {
      color: #7ec8e3;
      font-size: 1em;
    }
    .source-item {
      background: rgba(20, 40, 60, 0.5);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .source-ref {
      color: #d4a017;
      font-weight: 500;
      margin-bottom: 6px;
    }
    .source-quote {
      color: #aaa;
      font-style: italic;
      line-height: 1.5;
    }
    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tag-item {
      background: rgba(126, 200, 227, 0.15);
      color: #7ec8e3;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.85em;
    }
    
    /* Search results styling */
    .timeline-search-results {
      padding: 10px;
    }
    .search-results-header {
      color: #7ec8e3;
      margin-bottom: 15px;
      font-size: 1.1em;
    }
    .search-result-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: rgba(20, 40, 60, 0.5);
      border-radius: 6px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .search-result-item:hover {
      background: rgba(126, 200, 227, 0.2);
    }
    .search-result-icon {
      font-size: 1.2em;
      flex-shrink: 0;
    }
    .search-result-title {
      flex: 1;
      color: #e0e0e0;
    }
    .search-result-year {
      color: #7ec8e3;
      font-size: 0.9em;
      white-space: nowrap;
    }
    
    /* Lunar date link styling */
    .lunar-date-link {
      color: #6bc46b;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s;
      padding: 4px 8px;
      border-radius: 4px;
      background: rgba(107, 196, 107, 0.1);
      display: inline-block;
    }
    .lunar-date-link:hover {
      background: rgba(107, 196, 107, 0.2);
      color: #8fd68f;
    }
    
    /* Detail source styling */
    .detail-source-item {
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .detail-source-item:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .detail-source-ref {
      font-size: 0.9em;
      color: #888;
      margin-bottom: 5px;
    }
    .detail-source-quote {
      font-style: italic;
      border-left: 3px solid #7ec8e3;
      padding-left: 15px;
      margin: 8px 0;
      color: #c0c0c0;
    }
    .detail-source-quote strong {
      color: #7ec8e3;
      font-style: normal;
    }
    
    /* Collapsible description */
    .detail-description-wrapper {
      position: relative;
    }
    .detail-description-wrapper.truncated {
      cursor: pointer;
    }
    .detail-description-text {
      max-height: 100px;
      overflow: hidden;
    }
    .detail-description-wrapper.expanded .detail-description-text {
      max-height: none;
      -webkit-mask-image: none;
      mask-image: none;
    }
    .detail-description-wrapper.truncated .detail-description-text {
      -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
      mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
    }
    .detail-expand-chevron {
      display: none;
      justify-content: center;
      padding: 4px 0;
      color: #7ec8e3;
      font-size: 12px;
      opacity: 0.7;
    }
    .detail-description-wrapper.truncated .detail-expand-chevron {
      display: flex;
    }
    
    /* Prev/Next navigation */
    .detail-nav-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid rgba(126, 200, 227, 0.2);
    }
    .detail-prev-next {
      display: flex;
      gap: 12px;
      justify-content: space-between;
    }
    .detail-nav-event {
      flex: 1;
      background: rgba(126, 200, 227, 0.1);
      border: 1px solid rgba(126, 200, 227, 0.2);
      border-radius: 8px;
      padding: 12px;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }
    .detail-nav-event:hover {
      background: rgba(126, 200, 227, 0.2);
      border-color: rgba(126, 200, 227, 0.4);
    }
    .detail-nav-placeholder {
      background: transparent;
      border: none;
      cursor: default;
    }
    .detail-nav-label {
      font-size: 0.75em;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .detail-nav-event-info {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #7ec8e3;
      font-weight: 500;
    }
    .detail-nav-year {
      font-size: 0.85em;
      color: #6bc46b;
      margin-top: 4px;
    }
    
    /* Event links in details */
    .detail-event-link {
      background: rgba(126, 200, 227, 0.1);
      border: 1px solid rgba(126, 200, 227, 0.3);
      border-radius: 6px;
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .detail-event-link:hover {
      background: rgba(126, 200, 227, 0.2);
    }
  `;
  document.head.appendChild(style);
}

// Initialize the slide-out panel (creates as sibling of vis-container to survive re-renders)
function initDetailPanel() {
  // Ensure styles are injected first
  injectTimelineStyles();
  
  if (document.getElementById('detail-slideout-panel')) return;
  
  // Find the timeline page wrapper - panel should be sibling of vis container
  const timelinePage = document.getElementById('biblical-timeline-page') ||
                       document.querySelector('.biblical-timeline-page');
  
  if (!timelinePage) {
    console.warn('[DetailPanel] Timeline page not found, deferring panel creation');
    return;
  }
  
  const panel = document.createElement('div');
  panel.id = 'detail-slideout-panel';
  panel.className = 'detail-slideout';
  panel.innerHTML = `
    <button class="detail-close-btn" onclick="timelineCloseEventDetail()" title="Close">&times;</button>
    <div class="detail-resize-handle" id="detail-resize-handle"></div>
    <div class="detail-slideout-content" id="detail-slideout-content"></div>
  `;
  timelinePage.appendChild(panel);
  
  // Initialize resize handle
  initResizeHandle();
  
  // Styles already injected by injectTimelineStyles()
  // No need to add styles here anymore
}

// Additional CSS injected in injectTimelineStyles():
// - .detail-description-wrapper, .detail-expand-chevron (collapsible description)
// - .detail-nav-section, .detail-prev-next, .detail-nav-event (prev/next navigation)
// See injectTimelineStyles() for full CSS

// This placeholder function ensures CSS needed for descriptions is applied
function ensureDescriptionStyles() {
  // All styles are now in injectTimelineStyles() - this is a no-op
  // Kept for backwards compatibility
}

// CSS for detail panel, tooltips, etc. is now injected by injectTimelineStyles()

// NOTE: Manual history navigation removed - use browser back/forward buttons instead
// Navigation is now handled through URL state changes

// User action - close detail panel (unidirectional flow)
// ONLY dispatches - no DOM manipulation. Render handles all UI updates.
function closeDetailPanel() {
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_TIMELINE_SEARCH', search: null });
  }
}

// Navigate to calendar from timeline event detail
function navigateToCalendarFromTimeline(year, lunarMonth, lunarDay) {
  // Close the detail panel
  closeDetailPanel();
  
  // Use AppStore if available for proper navigation
  if (typeof AppStore !== 'undefined') {
    // Set the lunar date and navigate to calendar
    AppStore.dispatch({
      type: 'SET_LUNAR_DATETIME',
      year: year,
      month: lunarMonth,
      day: lunarDay
    });
    AppStore.dispatch({
      type: 'SET_VIEW',
      view: 'calendar'
    });
    return;
  }
  
  // Fallback: Legacy state-based navigation
  // Set calendar state
  state.year = year;
  
  // Generate calendar for the target year first
  if (typeof generateCalendar === 'function') {
    generateCalendar();
  }
  
  // Set the lunar month and day
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
  
  // Push calendar URL to history and navigate
  if (typeof buildPathURL === 'function') {
    const calendarURL = buildPathURL();
    window.history.pushState({ view: 'calendar' }, '', calendarURL);
  }
  if (typeof navigateTo === 'function') {
    navigateTo('calendar');
  }
}

// Open the panel with content
function showDetailPanel(html) {
  initDetailPanel();
  const panel = document.getElementById('detail-slideout-panel');
  const content = document.getElementById('detail-slideout-content');
  if (content) content.innerHTML = html;
  if (panel) panel.classList.add('open');
  document.body.classList.add('detail-panel-open');
  
  // Apply stored panel width (desktop only)
  if (window.innerWidth > 768) {
    applyPanelWidth(getPanelWidth());
  }
}

// Make functions globally available
window.initDetailPanel = initDetailPanel;
window.closeDetailPanel = closeDetailPanel;
window.navigateToCalendarFromTimeline = navigateToCalendarFromTimeline;

// =====================================================
// DURATION DETAIL (uses slide-out panel)
// =====================================================

// Helper to highlight selected duration bar
function highlightDurationBar(durationId) {
  // Remove previous selection
  document.querySelectorAll('.duration-event-bar.selected').forEach(el => {
    el.classList.remove('selected');
  });
  // Add selection to current
  if (durationId) {
    const bar = document.querySelector(`.duration-event-bar[data-duration-id="${durationId}"]`);
    if (bar) {
      bar.classList.add('selected');
    }
  }
}

// Internal function - builds and shows duration content
async function openDurationDetailInternal(durationId, addHistory = true) {
  const durations = window._timelineDurations || [];
  const duration = durations.find(d => d.id === durationId);
  
  if (!duration) {
    console.warn('Duration not found:', durationId);
    return;
  }
  
  // Highlight the selected duration bar
  highlightDurationBar(durationId);
  
  // Load events data to get pretty names
  const data = await loadBiblicalTimelineData();
  const events = data?.events || [];
  
  // Get resolved events (uses cache)
  const profile = (typeof getTimelineProfile === 'function') ? getTimelineProfile() : null;
  const resolvedEvents = getResolvedEvents(data, profile);
  
  const getEventInfo = (eventId) => {
    const event = events.find(e => e.id === eventId);
    const resolved = resolvedEvents.find(e => e.id === eventId);
    let dateStr = '';
    
    if (resolved?.startJD && typeof EventResolver !== 'undefined') {
      const greg = EventResolver.julianDayToGregorian(resolved.startJD);
      const year = greg.year;
      // Astronomical year: 0 = 1 BC, -1 = 2 BC, -N = (N+1) BC
      dateStr = year > 0 ? `${year} AD` : `${1 - year} BC`;
    }
    
    if (event) {
      return { title: event.title, icon: getTypeIcon(event.type), found: true, date: dateStr };
    }
    return { title: eventId, icon: '📍', found: false, date: dateStr };
  };
  
  const fromEventInfo = getEventInfo(duration.from_event);
  const toEventInfo = getEventInfo(duration.to_event);
  
  // Format claimed duration
  let claimedStr = '';
  if (duration.claimed) {
    if (duration.claimed.value !== undefined) {
      claimedStr = `${duration.claimed.value} ${duration.claimed.unit || 'years'}`;
    } else {
      const parts = [];
      if (duration.claimed.years !== undefined) parts.push(`${duration.claimed.years} years`);
      if (duration.claimed.months !== undefined) parts.push(`${duration.claimed.months} months`);
      if (duration.claimed.days !== undefined) parts.push(`${duration.claimed.days} days`);
      claimedStr = parts.join(', ') || 'unknown';
    }
  }
  
  const sourceIcon = duration.source?.type === 'scripture' ? '📖' : 
                     duration.source?.type === 'historical' ? '📜' : '📋';
  
  let html = `
    <h2 class="detail-title">
      <span class="detail-title-icon">⏱️</span>
      ${duration.title || duration.id}
    </h2>
    
    <div class="detail-section">
      <h4>Duration Claim</h4>
      <div class="detail-claimed">${claimedStr}</div>
    </div>
    
    <div class="detail-section">
      <h4>Connects Events</h4>
      <div class="detail-events-row">
        <div class="detail-event-link" onclick="openDurationDetail_openEvent('${duration.from_event}')" style="flex-direction: column; align-items: flex-start;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>${fromEventInfo.icon}</span>
            <span>${fromEventInfo.title}</span>
          </div>
          ${fromEventInfo.date ? `<div style="font-size: 0.85em; color: #6bc46b; margin-top: 4px;">${fromEventInfo.date}</div>` : ''}
        </div>
        <span class="detail-arrow">→</span>
        <div class="detail-event-link" onclick="openDurationDetail_openEvent('${duration.to_event}')" style="flex-direction: column; align-items: flex-start;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>${toEventInfo.icon}</span>
            <span>${toEventInfo.title}</span>
          </div>
          ${toEventInfo.date ? `<div style="font-size: 0.85em; color: #6bc46b; margin-top: 4px;">${toEventInfo.date}</div>` : ''}
        </div>
      </div>
    </div>
    
    <div class="detail-section">
      <h4>Sources</h4>
      ${duration.sources && duration.sources.length > 0 ? 
        duration.sources.map(src => {
          const srcIcon = src.type === 'scripture' ? '📖' : src.type === 'historical' ? '📜' : '📋';
          const refHtml = src.type === 'scripture' && src.ref
            ? `<a href="#" class="scripture-link" onclick="if(typeof openBibleReader==='function'){openBibleReader('${src.ref.replace(/'/g, "\\'")}');} return false;">${src.ref}</a>`
            : (src.ref || 'Unknown');
          return `
            <div class="detail-source-item">
              <div class="detail-source-ref">${srcIcon} ${refHtml}</div>
              ${src.quote ? `<div class="detail-source-quote">${renderMarkdown(src.quote)}</div>` : ''}
            </div>
          `;
        }).join('') :
        `<div class="detail-source-item">
          <div class="detail-source-ref">${sourceIcon} ${duration.source?.ref || 'Unknown'}</div>
          ${duration.source?.quote ? `<div class="detail-source-quote">${renderMarkdown(duration.source.quote)}</div>` : ''}
        </div>`
      }
    </div>
  `;
  
  if (duration.notes) {
    html += `
      <div class="detail-section">
        <h4>Notes</h4>
        <p class="detail-notes">${duration.notes}</p>
      </div>
    `;
  }
  
  if (duration.validates) {
    html += `
      <div class="detail-section">
        <h4>Validation</h4>
        <p>✅ This duration provides independent validation</p>
      </div>
    `;
  }
  
  if (duration.doc) {
    html += `
      <div class="detail-section">
        <h4>Documentation</h4>
        <div id="detail-doc-content" class="detail-doc-content">Loading...</div>
      </div>
    `;
  }
  
  showDetailPanel(html);
  
  // Scroll timeline to center on the "from" event's year
  const fromResolved = resolvedEvents.find(e => e.id === duration.from_event);
  if (fromResolved?.startJD && typeof EventResolver !== 'undefined') {
    const fromGreg = EventResolver.julianDayToGregorian(fromResolved.startJD);
    setTimeout(() => {
      scrollTimelineToYear(fromGreg.year);
    }, 100); // Small delay to let panel animate open
  }
  
  // Load documentation async (if doc file exists)
  if (duration.doc) {
    try {
      const response = await fetch('/' + duration.doc);
      const docEl = document.getElementById('detail-doc-content');
      if (response.ok) {
        const markdown = await response.text();
        let docHtml;
        
        // Use marked.js if available
        if (typeof marked !== 'undefined') {
          marked.setOptions({ breaks: true, gfm: true, headerIds: false });
          docHtml = marked.parse(markdown);
          docHtml = docHtml.replace(/<table>/g, '<table class="md-table">');
        } else {
          // Fallback
          docHtml = `<pre>${markdown}</pre>`;
        }
        
        // Convert event references with pretty names
        docHtml = docHtml.replace(/\[\[([a-z0-9-]+)\]\]/g, (match, eventId) => {
          const title = getEventTitle(eventId);
          return `<a href="#" onclick="openEventDetail('${eventId}'); return false;" class="event-ref-link" title="${eventId}">${title}</a>`;
        });
        
        // Also linkify bare event IDs
        docHtml = linkifyBareEventIds(docHtml);
        
        if (docEl) docEl.innerHTML = docHtml;
      } else {
        // Doc file not found - show placeholder
        if (docEl) docEl.innerHTML = '<em style="color: #888;">Documentation not yet available</em>';
      }
    } catch (err) {
      const docEl = document.getElementById('detail-doc-content');
      if (docEl) docEl.innerHTML = '<em>Error loading documentation</em>';
    }
  }
}

// Helper for opening event from duration detail (adds to history)
function openDurationDetail_openEvent(eventId) {
  openEventDetail(eventId);
}

// Public function - dispatches to AppStore (unidirectional flow)
function openDurationDetail(durationId) {
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_TIMELINE_DURATION', durationId: durationId });
  } else {
    // Fallback for direct calls
    showDurationDetailFromState(durationId);
  }
}

// State-driven render function (called by TimelineView)
async function showDurationDetailFromState(durationId) {
  // Clear search filter when viewing a duration (so duration endpoints can be shown)
  const needsRerender = activeSearchResultIds !== null;
  if (needsRerender) {
    activeSearchResultIds = null;
    activeSearchDurationIds = null;
    renderBiblicalTimeline();
  }
  
  await openDurationDetailInternal(durationId, false);
}

// Close - just close the panel and reset URL
function closeDurationDetail() {
  closeDetailPanel();
  updateTimelineURL(null, null);
}

// =====================================================
// EVENT DETAIL (uses slide-out panel)
// =====================================================

// Internal function - builds and shows event content in slide-out
async function openEventDetailInternal(eventId, addHistory = true) {
  // Load event data
  const data = await loadBiblicalTimelineData();
  const event = data?.events?.find(e => e.id === eventId);
  
  if (!event) {
    console.warn('Event not found:', eventId);
    // Notify user and clear the invalid event from URL/state
    console.log(`[Timeline] Unknown event "${eventId}" — clearing from URL`);
    if (typeof AppStore !== 'undefined') {
      AppStore.dispatch({ type: 'CLEAR_TIMELINE_SELECTION' });
    }
    return;
  }
  
  // Clear duration highlight when viewing an event
  highlightDurationBar(null);
  
  const icon = getTypeIcon(event.type);
  
  // Format dates
  let lunarDateStr = '—';
  let gregorianDateStr = '';
  let hasFixedGregorian = false;
  let reckoningExplanation = '';
  
  // Support both v1 (event.dates) and v2 (event.start) formats
  const eventLunar = event.start?.lunar || event.dates?.lunar;
  const eventRegal = event.start?.regal || event.dates?.regal;
  const eventFixed = event.start?.fixed || event.dates?.fixed;
  
  // Determine reckoning explanation (check dates from original event definition)
  if (eventRegal?.epoch) {
    const epoch = data?.epochs?.[eventRegal.epoch];
    if (epoch?.reckoning) {
      const reckoningMap = {
        'spring-to-spring': 'Spring-to-Spring (Nisan New Year)',
        'fall-to-fall': 'Fall-to-Fall (Tishri New Year)',
        'accession-year': 'Accession-Year Reckoning',
        'exact-date': 'Exact Historical Date'
      };
      reckoningExplanation = reckoningMap[epoch.reckoning] || epoch.reckoning;
    }
  } else if (eventLunar) {
    // All lunar dates use the religious calendar (Nisan New Year)
    reckoningExplanation = 'Religious Calendar (Nisan New Year)';
  }
  
  // Track if source lunar has year - we'll need resolved year if not
  let sourceLunarHasYear = eventLunar?.year !== undefined;
  
  // Check if this is a pre-flood event (year-only precision - no scriptural month/day data)
  const isPreFlood = event.tags?.includes('pre-flood');
  
  if (eventLunar && !isPreFlood) {
    const l = eventLunar;
    // Astronomical year: 0 = 1 BC, -1 = 2 BC, -N = (N+1) BC
    const yearStr = l.year !== undefined ? (l.year > 0 ? l.year + ' AD' : (1 - l.year) + ' BC') : '';
    // Hebrew month names
    const hebrewMonths = ['', 'Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 
                          'Tishri', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar II'];
    const monthName = hebrewMonths[l.month] || `Month ${l.month}`;
    // Format as "Tishri(7) 10, 29 AD" - unambiguous with month name and number
    // Year will be added later from resolved date if not in source
    lunarDateStr = yearStr 
      ? `${monthName}(${l.month}) ${l.day || 1}, ${yearStr}` 
      : `${monthName}(${l.month}) ${l.day || 1}`;
  }
  
  // Check for fixed Gregorian date (astronomically verified)
  if (eventFixed?.gregorian) {
    hasFixedGregorian = true;
    const g = eventFixed.gregorian;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // Astronomical year: 0 = 1 BC, -1 = 2 BC, -N = (N+1) BC
    gregorianDateStr = `${monthNames[(g.month || 1) - 1]} ${g.day || 1}, ${g.year > 0 ? g.year + ' AD' : (1 - g.year) + ' BC'}`;
    reckoningExplanation = eventFixed.source || 'Astronomically/Historically Fixed';
  }
  
  // Get resolved dates if available
  const profile = (typeof getTimelineProfile === 'function') ? getTimelineProfile() : null;
  let resolvedStartJD = null;
  let resolvedGregorian = null;
  let resolvedLunar = null;
  let resolved = []; // All resolved events for reference lookups
  
  // Get resolved events (uses cache)
  resolved = getResolvedEvents(data, profile);
  
  const resolvedEvent = resolved.find(e => e.id === eventId);
  if (resolvedEvent) {
    resolvedStartJD = resolvedEvent.startJD;
    if (resolvedStartJD && typeof EventResolver !== 'undefined') {
      resolvedGregorian = EventResolver.julianDayToGregorian(resolvedStartJD);
      resolvedLunar = EventResolver.julianDayToLunar(resolvedStartJD, profile);
      
      // If no lunar date in source, use resolved lunar entirely
      if (lunarDateStr === '—' && resolvedLunar) {
        // Prefer _lunarYear from chain calculation (more accurate than julianDayToLunar)
        const displayYear = resolvedEvent._lunarYear !== undefined ? resolvedEvent._lunarYear : resolvedLunar.year;
        // Astronomical year: 0 = 1 BC, -1 = 2 BC, -N = (N+1) BC
        const yearStr = displayYear > 0 ? displayYear + ' AD' : (1 - displayYear) + ' BC';
        
        // For pre-flood events, only show year (no scriptural month/day data)
        if (isPreFlood) {
          lunarDateStr = yearStr;
        } else {
          // Hebrew month names
          const hebrewMonths = ['', 'Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 
                                'Tishri', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar II'];
          const monthName = hebrewMonths[resolvedLunar.month] || `Month ${resolvedLunar.month}`;
          // Format as "Tishri(7) 10, 29 AD"
          lunarDateStr = `${monthName}(${resolvedLunar.month}) ${resolvedLunar.day}, ${yearStr}`;
        }
      }
      // If source lunar had month/day but no year, append the resolved year
      else if (!sourceLunarHasYear && resolvedLunar && lunarDateStr !== '—') {
        // Prefer _lunarYear from chain calculation (more accurate than julianDayToLunar)
        const displayYear = resolvedEvent._lunarYear !== undefined ? resolvedEvent._lunarYear : resolvedLunar.year;
        // Astronomical year: 0 = 1 BC, -1 = 2 BC, -N = (N+1) BC
        const yearStr = displayYear > 0 ? displayYear + ' AD' : (1 - displayYear) + ' BC';
        lunarDateStr = `${lunarDateStr}, ${yearStr}`;
      }
    }
  }
  
  // Build clickable lunar date (navigates to calendar)
  // For pre-flood events, just display year without calendar link (no scriptural month/day)
  let lunarDateHtml = lunarDateStr;
  if (lunarDateStr !== '—' && resolvedGregorian && !isPreFlood) {
    const l = eventLunar || resolvedLunar || {};
    const lunarMonth = l.month || 1;
    const lunarDay = l.day || 1;
    const calYear = resolvedGregorian.year;
    lunarDateHtml = `<a href="#" class="lunar-date-link" onclick="navigateToCalendarFromTimeline(${calYear}, ${lunarMonth}, ${lunarDay}); return false;" title="View in Calendar">📅 ${lunarDateStr}</a>`;
  }
  
  // Build HTML
  let html = `
    <h2 class="detail-title">
      <span class="detail-title-icon">${icon}</span>
      ${event.title}
    </h2>
    
    <div class="detail-section">
      <h4>Date</h4>
      <div class="detail-date-row">
        <div class="detail-date-item">
          <div class="detail-date-label">Hebrew Calendar</div>
          <div class="detail-date-value">${lunarDateHtml}</div>
        </div>
        ${hasFixedGregorian ? `
        <div class="detail-date-item">
          <div class="detail-date-label">Fixed Gregorian</div>
          <div class="detail-date-value">${gregorianDateStr}</div>
        </div>
        ` : ''}
      </div>
      ${reckoningExplanation ? `
      <div class="detail-reckoning-note" style="font-size: 0.85em; color: #888; margin-top: 8px; font-style: italic;">
        📐 ${reckoningExplanation}
      </div>
      ` : ''}
    </div>
  `;
  
  // Find previous and next events chronologically (needed early for layout)
  const sortedEvents = resolved
    .filter(e => e.startJD != null)
    .sort((a, b) => a.startJD - b.startJD);
  
  const currentIndex = sortedEvents.findIndex(e => e.id === eventId);
  const prevEvent = currentIndex > 0 ? sortedEvents[currentIndex - 1] : null;
  const nextEvent = currentIndex < sortedEvents.length - 1 ? sortedEvents[currentIndex + 1] : null;
  
  // Helper to get nav info for an event
  const getEventNavInfo = (ev) => {
    if (!ev) return null;
    const evData = data?.events?.find(e => e.id === ev.id);
    const evIcon = evData ? getTypeIcon(evData.type) : '📍';
    const evTitle = evData?.title || ev.id;
    let evYear = '';
    if (ev.startJD && typeof EventResolver !== 'undefined') {
      const greg = EventResolver.julianDayToGregorian(ev.startJD);
      // Astronomical year: 0 = 1 BC, -1 = 2 BC, -N = (N+1) BC
      evYear = greg.year > 0 ? `${greg.year} AD` : `${1 - greg.year} BC`;
    }
    return { id: ev.id, icon: evIcon, title: evTitle, year: evYear };
  };
  
  // Description with max-height, text fade, and chevron indicator
  if (event.description) {
    const descId = `desc-${eventId}`;
    html += `
      <div class="detail-section">
        <h4>Description</h4>
        <div class="detail-description-wrapper" id="${descId}" onclick="toggleDescriptionExpand('${descId}')">
          <div class="detail-description-text">
            <span class="detail-notes">${renderMarkdown(event.description)}</span>
          </div>
          <div class="detail-expand-chevron">▾</div>
        </div>
      </div>
    `;
  }
  
  // Prev/next navigation (right after description for consistent position)
  if (prevEvent || nextEvent) {
    const prevInfo = getEventNavInfo(prevEvent);
    const nextInfo = getEventNavInfo(nextEvent);
    
    html += `
      <div class="detail-section detail-nav-section" style="margin-top: 0; padding-top: 15px; border-top: none;">
        <div class="detail-prev-next">
          ${prevInfo ? `
            <div class="detail-nav-event detail-prev-event" onclick="openEventDetail('${prevInfo.id}')">
              <div class="detail-nav-label">◀ Previous</div>
              <div class="detail-nav-event-info">
                <span>${prevInfo.icon}</span>
                <span>${prevInfo.title}</span>
              </div>
              <div class="detail-nav-year">${prevInfo.year}</div>
            </div>
          ` : '<div class="detail-nav-event detail-nav-placeholder"></div>'}
          ${nextInfo ? `
            <div class="detail-nav-event detail-next-event" onclick="openEventDetail('${nextInfo.id}')">
              <div class="detail-nav-label">Next ▶</div>
              <div class="detail-nav-event-info">
                <span>${nextInfo.icon}</span>
                <span>${nextInfo.title}</span>
              </div>
              <div class="detail-nav-year">${nextInfo.year}</div>
            </div>
          ` : '<div class="detail-nav-event detail-nav-placeholder"></div>'}
        </div>
      </div>
    `;
  }
  
  // Show full derivation chain if relative (support both event.start and event.dates)
  const startSpec = event.start || event.dates;
  if (startSpec?.relative || startSpec?.priestly_cycle || startSpec?.lunar_relative) {
    // Build the full derivation chain
    const chain = buildDerivationChain(event, data, resolved);
    
    if (chain.length > 0) {
      html += `
        <div class="detail-section">
          <h4>Derivation Chain</h4>
          <div class="derivation-chain" style="display: flex; flex-direction: column; gap: 8px;">
      `;
      
      chain.forEach((link, idx) => {
        const isLast = idx === chain.length - 1;
        const isSolid = link.isSolid;
        const safeEventId = (link.eventId || '').replace(/'/g, "\\'");
        const safeTitle = (link.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        
        html += `
          <div class="derivation-chain-item" style="display: flex; align-items: center; gap: 8px; padding: 8px; background: ${isSolid ? 'rgba(107, 196, 107, 0.15)' : 'rgba(126, 200, 227, 0.08)'}; border-radius: 6px; border-left: 3px solid ${isSolid ? '#6bc46b' : '#7ec8e3'};">
            <div class="derivation-event" onclick="openEventDetail('${safeEventId}')" style="cursor: pointer; flex: 1;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>${link.icon}</span>
                <span style="font-weight: ${isSolid ? '600' : '400'};">${safeTitle}</span>
                ${isSolid ? '<span style="font-size: 0.75em; background: #6bc46b; color: #000; padding: 2px 6px; border-radius: 3px; margin-left: 6px;">ANCHOR</span>' : ''}
              </div>
              <div style="font-size: 0.85em; color: #6bc46b; margin-top: 4px;">${link.dateStr}</div>
              ${link.solidReason ? `<div style="font-size: 0.75em; color: #888; margin-top: 2px;">${(link.solidReason || '').replace(/</g, '&lt;')}</div>` : ''}
            </div>
            ${!isLast ? `
              <div class="derivation-offset" style="text-align: center; min-width: 80px; padding: 4px 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                <div style="font-size: 0.8em; color: #888;">${link.offsetDirection}</div>
                <div style="font-size: 0.9em; color: #d4a017;">${(link.offsetStr || '').replace(/</g, '&lt;')}</div>
              </div>
            ` : ''}
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    }
  }
  
  // Show sources
  if (event.sources && event.sources.length > 0) {
    html += `
      <div class="detail-section">
        <h4>Sources</h4>
        ${event.sources.map(src => {
          const srcIcon = src.type === 'scripture' ? '📖' : src.type === 'historical' ? '📜' : '📋';
          const refHtml = src.type === 'scripture' && src.ref
            ? `<a href="#" class="scripture-link" onclick="if(typeof openBibleReader==='function'){openBibleReader('${src.ref.replace(/'/g, "\\'")}');} return false;">${src.ref}</a>`
            : (src.ref || 'Unknown');
          return `
            <div class="detail-source-item">
              <div class="detail-source-ref">${srcIcon} ${refHtml}</div>
              ${src.quote ? `<div class="detail-source-quote">${renderMarkdown(src.quote)}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  
  // Show image if present
  if (event.image) {
    html += `
      <div class="detail-section">
        <h4>Visualization</h4>
        <div class="detail-image-container">
          <img src="${event.image}" alt="${event.title}" class="detail-event-image" onclick="window.open('${event.image}', '_blank')" style="max-width: 100%; border-radius: 8px; cursor: pointer;">
        </div>
      </div>
    `;
  }
  
  // Show documentation link if present (external markdown file)
  if (event.doc) {
    const docId = `doc-${eventId}`;
    html += `
      <div class="detail-section">
        <h4>📐 Chronological Verification</h4>
        <div id="${docId}" class="event-documentation" style="color: #ccc; line-height: 1.7;">
          <p style="color: #888; font-style: italic;">Loading documentation...</p>
        </div>
        <button onclick="toggleDocExpand('${docId}')" class="doc-expand-btn" style="margin-top: 10px; padding: 8px 16px; background: rgba(126, 200, 227, 0.1); border: 1px solid rgba(126, 200, 227, 0.3); border-radius: 6px; color: #7ec8e3; cursor: pointer;">
          Show Full Document
        </button>
      </div>
    `;
    // Documentation will be loaded after DOM insertion (see below)
  }
  
  // Show related events if present
  if (event.related_events && event.related_events.length > 0) {
    html += `
      <div class="detail-section">
        <h4>🔗 Related Events</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${event.related_events.map(eventRef => {
            const refEvent = data?.events?.find(e => e.id === eventRef);
            const refTitle = refEvent?.title || eventRef;
            const refIcon = refEvent ? getTypeIcon(refEvent.type) : '📍';
            return `
              <a href="#" onclick="openEventDetail('${eventRef}'); return false;" 
                 style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; background: rgba(212, 160, 23, 0.1); border: 1px solid rgba(212, 160, 23, 0.3); border-radius: 6px; text-decoration: none; color: #d4a017; font-size: 0.85em; transition: background 0.2s;"
                 onmouseover="this.style.background='rgba(212, 160, 23, 0.2)'" 
                 onmouseout="this.style.background='rgba(212, 160, 23, 0.1)'">
                ${refIcon} ${refTitle}
              </a>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  // Show links if present (both internal event links and external URLs)
  if (event.links && event.links.length > 0) {
    // Separate internal event links from external URLs
    const eventLinks = event.links.filter(l => l.event);
    const externalLinks = event.links.filter(l => l.url);
    
    // Internal event links
    if (eventLinks.length > 0) {
      html += `
        <div class="detail-section">
          <h4>Related Events</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${eventLinks.map(link => `
              <a href="#" onclick="openEventDetail('${link.event}'); return false;" 
                 style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; background: rgba(126, 200, 227, 0.1); border: 1px solid rgba(126, 200, 227, 0.3); border-radius: 6px; text-decoration: none; color: #7ec8e3; font-size: 0.9em; transition: background 0.2s;"
                 onmouseover="this.style.background='rgba(126, 200, 227, 0.2)'" 
                 onmouseout="this.style.background='rgba(126, 200, 227, 0.1)'">
                ${link.icon || '📍'} ${link.label}
              </a>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // External URLs
    if (externalLinks.length > 0) {
      html += `
        <div class="detail-section">
          <h4>External Links</h4>
          <div class="detail-links-container" style="display: flex; flex-direction: column; gap: 10px;">
            ${externalLinks.map(link => `
              <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="detail-external-link" style="display: flex; align-items: center; gap: 10px; padding: 12px; background: rgba(126, 200, 227, 0.1); border: 1px solid rgba(126, 200, 227, 0.3); border-radius: 8px; text-decoration: none; color: #7ec8e3; transition: background 0.2s;">
                <span style="font-size: 1.5em;">${link.icon || '🔗'}</span>
                <div style="flex: 1;">
                  <div style="font-weight: 500;">${link.label}</div>
                  ${link.notes ? `<div style="font-size: 0.85em; color: #888; margin-top: 2px;">${link.notes}</div>` : ''}
                </div>
                <span style="color: #888;">↗</span>
              </a>
            `).join('')}
          </div>
        </div>
      `;
    }
  }
  
  // Show related durations (this event is a from or to endpoint)
  const durations = data?.durations || [];
  const relatedDurations = durations.filter(d => d.from_event === eventId || d.to_event === eventId);
  
  if (relatedDurations.length > 0) {
    // Separate into "from this event" and "to this event"
    const fromThis = relatedDurations.filter(d => d.from_event === eventId);
    const toThis = relatedDurations.filter(d => d.to_event === eventId);
    
    html += `
      <div class="detail-section">
        <h4>⏱️ Related Durations (${relatedDurations.length})</h4>
        <div class="related-durations-list">
    `;
    
    // Durations starting FROM this event
    if (fromThis.length > 0) {
      html += `<div class="duration-group-label" style="font-size: 0.85em; color: #7ec8e3; margin: 8px 0 4px 0;">From this event →</div>`;
      fromThis.forEach(dur => {
        const toEvent = data?.events?.find(e => e.id === dur.to_event);
        const toTitle = toEvent?.title || dur.to_event;
        const toIcon = toEvent ? getTypeIcon(toEvent.type) : '📍';
        
        let claimedStr = '';
        if (dur.claimed) {
          const parts = [];
          if (dur.claimed.years !== undefined) parts.push(`${dur.claimed.years} years`);
          if (dur.claimed.months !== undefined) parts.push(`${dur.claimed.months} months`);
          if (dur.claimed.days !== undefined) parts.push(`${dur.claimed.days} days`);
          claimedStr = parts.join(', ');
        }
        
        const sourceRef = dur.source?.ref || '';
        const sourceIcon = dur.source?.type === 'scripture' ? '📖' : dur.source?.type === 'historical' ? '📜' : '';
        
        html += `
          <div class="detail-duration-item" onclick="openDurationDetail('${dur.id}')" style="cursor: pointer; padding: 10px; margin: 4px 0; background: rgba(107, 196, 107, 0.08); border-left: 3px solid #6bc46b; border-radius: 0 6px 6px 0;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="color: #6bc46b; font-weight: 600;">+${claimedStr}</span>
              <span style="color: #888;">→</span>
              <span class="event-ref-link" onclick="event.stopPropagation(); openEventDetail('${dur.to_event}')" style="display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">${toIcon} ${toTitle}</span>
            </div>
            <div style="font-size: 0.85em; color: #aaa; margin-top: 4px;">${dur.title}</div>
            ${sourceRef ? `<div style="font-size: 0.8em; color: #888; margin-top: 2px;">${sourceIcon} ${sourceRef}</div>` : ''}
          </div>
        `;
      });
    }
    
    // Durations ending AT this event
    if (toThis.length > 0) {
      html += `<div class="duration-group-label" style="font-size: 0.85em; color: #7ec8e3; margin: 12px 0 4px 0;">← To this event</div>`;
      toThis.forEach(dur => {
        const fromEvent = data?.events?.find(e => e.id === dur.from_event);
        const fromTitle = fromEvent?.title || dur.from_event;
        const fromIcon = fromEvent ? getTypeIcon(fromEvent.type) : '📍';
        
        let claimedStr = '';
        if (dur.claimed) {
          const parts = [];
          if (dur.claimed.years !== undefined) parts.push(`${dur.claimed.years} years`);
          if (dur.claimed.months !== undefined) parts.push(`${dur.claimed.months} months`);
          if (dur.claimed.days !== undefined) parts.push(`${dur.claimed.days} days`);
          claimedStr = parts.join(', ');
        }
        
        const sourceRef = dur.source?.ref || '';
        const sourceIcon = dur.source?.type === 'scripture' ? '📖' : dur.source?.type === 'historical' ? '📜' : '';
        
        html += `
          <div class="detail-duration-item" onclick="openDurationDetail('${dur.id}')" style="cursor: pointer; padding: 10px; margin: 4px 0; background: rgba(212, 160, 23, 0.08); border-left: 3px solid #d4a017; border-radius: 0 6px 6px 0;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="event-ref-link" onclick="event.stopPropagation(); openEventDetail('${dur.from_event}')" style="display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">${fromIcon} ${fromTitle}</span>
              <span style="color: #888;">→</span>
              <span style="color: #d4a017; font-weight: 600;">+${claimedStr}</span>
            </div>
            <div style="font-size: 0.85em; color: #aaa; margin-top: 4px;">${dur.title}</div>
            ${sourceRef ? `<div style="font-size: 0.8em; color: #888; margin-top: 2px;">${sourceIcon} ${sourceRef}</div>` : ''}
          </div>
        `;
      });
    }
    
    html += `
        </div>
      </div>
    `;
  }
  
  // Notes
  if (event.start?.notes) {
    html += `
      <div class="detail-section">
        <h4>Notes</h4>
        <p class="detail-notes">${event.start.notes}</p>
      </div>
    `;
  }
  
  showDetailPanel(html);
  
  // Load documentation after DOM is ready
  if (event.doc) {
    const docId = `doc-${eventId}`;
    loadEventDocumentation(event.doc, docId);
  }
  
  // Check if description is truncated and add class if so
  requestAnimationFrame(() => {
    const descWrapper = document.getElementById(`desc-${eventId}`);
    if (descWrapper) {
      const textEl = descWrapper.querySelector('.detail-description-text');
      if (textEl && textEl.scrollHeight > textEl.clientHeight) {
        descWrapper.classList.add('truncated');
      }
    }
  });
  
  // Scroll timeline to center on this event's year
  if (resolvedGregorian) {
    setTimeout(() => {
      scrollTimelineToYear(resolvedGregorian.year);
    }, 100); // Small delay to let panel animate open
  }
}

// Update URL to reflect currently open event/duration
function updateTimelineURL(type, id) {
  // Use AppStore if available for proper URL sync
  if (typeof AppStore !== 'undefined') {
    if (type === 'event') {
      AppStore.dispatch({ type: 'SET_TIMELINE_EVENT', eventId: id });
    } else if (type === 'duration') {
      AppStore.dispatch({ type: 'SET_TIMELINE_DURATION', durationId: id });
    } else {
      // Clear selection
      AppStore.dispatch({ type: 'CLEAR_TIMELINE_SELECTION' });
    }
    return;
  }
  
  // Fallback: Legacy URL handling
  if (typeof getCurrentProfileSlug !== 'function') return;
  
  const profile = getCurrentProfileSlug();
  let newURL;
  
  if (type && id) {
    newURL = `/${profile}/biblical-timeline/${type}/${id}/`;
  } else {
    newURL = `/${profile}/biblical-timeline/`;
  }
  
  // Use replaceState to update URL without adding to history
  // (the detail panel has its own forward/back navigation)
  window.history.replaceState({ view: 'biblical-timeline', [type + 'Id']: id }, '', newURL);
}

// Public function - dispatches to AppStore (unidirectional flow)
// Actual rendering happens via TimelineView.syncPanelFromState
function openEventDetail(eventId) {
  console.log('[Timeline] openEventDetail called with eventId:', eventId, 'AppStore defined:', typeof AppStore !== 'undefined');
  if (typeof AppStore !== 'undefined') {
    console.log('[Timeline] Dispatching SET_TIMELINE_EVENT');
    AppStore.dispatch({ type: 'SET_TIMELINE_EVENT', eventId: eventId });
  } else {
    // Fallback for direct calls
    console.log('[Timeline] AppStore not defined, falling back to showEventDetailFromState');
    showEventDetailFromState(eventId);
  }
}

// State-driven render function (called by TimelineView)
async function showEventDetailFromState(eventId) {
  console.log('[Timeline] showEventDetailFromState called with eventId:', eventId);
  
  // Validate: check if event exists in data before doing any work
  const data = ResolvedEventsCache.getDataSync();
  if (data && !data.events?.find(e => e.id === eventId)) {
    console.warn(`[Timeline] Unknown event "${eventId}" — clearing from state`);
    if (typeof AppStore !== 'undefined') {
      AppStore.dispatch({ type: 'CLEAR_TIMELINE_SELECTION' });
    }
    return;
  }
  
  // Clear search filter when viewing an event (so selected event can be shown)
  const hadSearchFilter = activeSearchResultIds !== null;
  if (hadSearchFilter) {
    activeSearchResultIds = null;
    activeSearchDurationIds = null;
  }
  
  // Only re-render if the selected event isn't already visible on the timeline
  // This avoids unnecessary double-renders when navigating back to a previous state
  const eventEl = document.querySelector(`[data-event-id="${eventId}"]`);
  if (!eventEl && document.getElementById('timeline-scroll-container')) {
    // Event not visible but timeline exists - need to re-render to show it
    renderBiblicalTimeline();
  }
  
  await openEventDetailInternal(eventId, false);
  
  // Apply hover/focus highlighting to the selected event (same as mouse-over)
  // Use setTimeout to ensure DOM is ready after any re-render
  setTimeout(() => {
    if (typeof handleEventHoverEnter === 'function') {
      handleEventHoverEnter(eventId);
    }
  }, 100);
}

// Scroll the timeline to center on a specific year with animation
function scrollTimelineToYear(year, accountForSearchPanel = false) {
  const scrollContainer = document.getElementById('timeline-scroll-container');
  if (!scrollContainer) return;
  
  // Calculate position based on timeline range
  const minYear = biblicalTimelineMinYear || -4050;
  const maxYear = biblicalTimelineMaxYear || 3500;
  const yearRange = maxYear - minYear + 1;
  
  // Get the timeline wrapper to find its height
  const wrapper = scrollContainer.querySelector('.ruler-timeline-wrapper');
  if (!wrapper) return;
  
  const timelineHeight = wrapper.offsetHeight;
  const pixelPerYear = timelineHeight / yearRange;
  
  // Calculate the position for this year
  const yearPos = (year - minYear) * pixelPerYear;
  
  // Calculate scroll position to center the year in the viewport
  const containerHeight = scrollContainer.clientHeight;
  
  // Account for search results panel if open (overlays top of viewport)
  let searchPanelOffset = 0;
  if (accountForSearchPanel) {
    const searchResults = document.getElementById('global-search-results');
    if (searchResults && searchResults.classList.contains('open')) {
      // Search panel covers top of viewport, so we need to scroll further
      // to center the event in the visible area below the panel
      searchPanelOffset = searchResults.offsetHeight / 2;
    }
  }
  
  // Center in viewport, then offset down by half the search panel height
  const targetScroll = yearPos - (containerHeight / 2) + searchPanelOffset;
  
  // Clamp to valid scroll range
  const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
  const finalScroll = Math.max(0, Math.min(maxScroll, targetScroll));
  
  // Animate the scroll
  scrollContainer.scrollTo({
    top: finalScroll,
    behavior: 'smooth'
  });
}

// Toggle description expand/collapse
function toggleDescriptionExpand(descId) {
  const descEl = document.getElementById(descId);
  if (!descEl) return;
  // Only expand if truncated
  if (descEl.classList.contains('truncated')) {
    descEl.classList.remove('truncated');
    descEl.classList.add('expanded');
  }
}

// Show Jubilee year info in a popup/detail panel
function showJubileeInfo(astronomicalYear, jubileeNumber) {
  const JORDAN_YEAR = -1405; // 1406 BC
  const yearsSinceJordan = astronomicalYear - JORDAN_YEAR;
  const displayYear = astronomicalYear <= 0 ? (1 - astronomicalYear) + ' BC' : astronomicalYear + ' AD';
  const jordanDisplayYear = '1406 BC';
  
  // Calculate previous and next Jubilees
  const prevJubilee = astronomicalYear - 49;
  const nextJubilee = astronomicalYear + 49;
  const prevDisplay = prevJubilee <= 0 ? (1 - prevJubilee) + ' BC' : prevJubilee + ' AD';
  const nextDisplay = nextJubilee <= 0 ? (1 - nextJubilee) + ' BC' : nextJubilee + ' AD';
  
  // Known significant Jubilee events
  const jubileeEvents = {
    17: { event: "Josiah's 18th Year", description: "Book of the Law found, Great Passover reformation" },
    18: { event: "Ezekiel 40 Vision", description: "Temple vision on 10th of Nisan, 25th year of captivity" },
  };
  
  const knownEvent = jubileeEvents[jubileeNumber];
  
  let content = `
    <div style="padding: 20px; color: white;">
      <h2 style="color: #ffd700; margin-bottom: 15px;">🎺 Jubilee ${jubileeNumber}</h2>
      <div style="margin-bottom: 15px;">
        <div style="color: #888;">Year</div>
        <div style="font-size: 1.3em;">${displayYear}</div>
      </div>
      <div style="margin-bottom: 15px;">
        <div style="color: #888;">Years from Jordan Crossing (${jordanDisplayYear})</div>
        <div>${yearsSinceJordan} years = ${jubileeNumber - 1} × 49</div>
      </div>
      ${knownEvent ? `
      <div style="margin-bottom: 15px; padding: 10px; background: rgba(255, 215, 0, 0.1); border-left: 3px solid #ffd700; border-radius: 4px;">
        <div style="color: #ffd700; font-weight: bold;">${knownEvent.event}</div>
        <div style="color: #ccc; font-size: 0.9em;">${knownEvent.description}</div>
      </div>
      ` : ''}
      <div style="margin-bottom: 15px;">
        <div style="color: #888;">Jubilee Cycle</div>
        <div style="display: flex; gap: 20px;">
          <div><span style="color: #666;">← Previous:</span> ${prevDisplay} (Jubilee ${jubileeNumber - 1})</div>
          <div><span style="color: #666;">→ Next:</span> ${nextDisplay} (Jubilee ${jubileeNumber + 1})</div>
        </div>
      </div>
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #333;">
        <div style="color: #888; font-size: 0.85em;">
          <strong>Leviticus 25:10</strong>: "And ye shall hallow the fiftieth year, and proclaim liberty throughout all the land unto all the inhabitants thereof: it shall be a jubilee unto you."
        </div>
      </div>
    </div>
  `;
  
  // Use the existing detail slideout
  const slideout = document.querySelector('.timeline-detail-slideout');
  if (slideout) {
    slideout.innerHTML = `
      <button class="timeline-detail-close" onclick="closeTimelineDetail()">×</button>
      ${content}
    `;
    slideout.classList.add('open');
  }
}

// Make functions globally available
window.openEventDetail = openEventDetail;
window.scrollTimelineToYear = scrollTimelineToYear;
window.openDurationDetail = openDurationDetail;
window.closeDurationDetail = closeDurationDetail;
window.openDurationDetail_openEvent = openDurationDetail_openEvent;
window.toggleDescriptionExpand = toggleDescriptionExpand;
window.showJubileeInfo = showJubileeInfo;

// State-driven render functions (called by TimelineView)
window.showEventDetailFromState = showEventDetailFromState;
window.showDurationDetailFromState = showDurationDetailFromState;
window.showSearchResultsFromState = showSearchResultsFromState;
window.closeDetailPanelFromState = closeDetailPanelFromState;

// Focus on a timeline event (scroll to it and highlight) without opening details
// This dispatches to AppStore - actual rendering is handled by state subscriber
window.focusTimelineEvent = function(eventId) {
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({
      type: 'SET_TIMELINE_FOCUSED_EVENT',
      eventId: eventId
    });
  }
};

// State-driven focus handler - called when timelineFocusedEventId changes
window.focusTimelineEventFromState = async function(eventId) {
  if (!eventId) return;
  
  // Check if event already has a slot (DOM element exists)
  const wrapper = document.getElementById('biblical-timeline-scroll');
  let eventEl = wrapper?.querySelector(`[data-event-id="${eventId}"]`);
  
  // Only re-render if the focused event doesn't have a visible slot
  if (!eventEl) {
    // Re-render timeline so slot allocation gives priority to focused event
    await renderBiblicalTimeline();
    // Re-query after render
    eventEl = wrapper?.querySelector(`[data-event-id="${eventId}"]`);
  }
  
  // Get the event's resolved data to find its year
  const events = getTimelineResolvedEvents();
  const event = events.find(e => e.id === eventId);
  
  if (event && event.startJD) {
    // Convert Julian Day to year
    const year = Math.floor((event.startJD - 1721425.5) / 365.25);
    
    // Scroll timeline to center on this event's year
    // Account for search results panel if open
    scrollTimelineToYear(year, true);
    
    // Apply focus highlighting and show tooltip
    setTimeout(() => {
      // Clear any existing tooltip first
      hideEventTooltip();
      
      // Apply focus highlighting
      if (typeof handleEventHoverEnter === 'function') {
        handleEventHoverEnter(eventId);
      }
      
      // Force show tooltip (even on desktop) since user explicitly navigated here
      const focusedEl = wrapper?.querySelector(`[data-event-id="${eventId}"]`);
      if (focusedEl) {
        showEventTooltip(eventId, focusedEl);
      }
    }, 300);
  }
};

// Sync timeline zoom and position from state (for back/forward navigation)
// This is called when state changes to update the view without full re-render
window.syncTimelineZoomAndPosition = function(targetZoom, targetYear) {
  const scrollContainer = document.getElementById('timeline-scroll-container');
  if (!scrollContainer) return;
  
  // Clamp zoom to valid range (0.1 to 500)
  const clampedZoom = targetZoom !== null ? Math.max(0.1, Math.min(500, targetZoom)) : null;
  const zoomChanged = clampedZoom !== null && clampedZoom !== biblicalTimelineZoom;
  const yearChanged = targetYear !== null;
  
  if (zoomChanged) {
    // Apply zoom and re-render
    biblicalTimelineZoom = clampedZoom;
    renderBiblicalTimeline();
    
    // After render, scroll to year if provided
    if (yearChanged) {
      requestAnimationFrame(() => {
        scrollTimelineToYear(targetYear);
      });
    }
  } else if (yearChanged) {
    // Just scroll - no zoom change
    scrollTimelineToYear(targetYear);
  }
};

// Render ruler-style timeline with events stacked on right, connected by lines
async function renderBiblicalTimeline() {
  const container = document.getElementById('biblical-timeline-vis-container');
  if (!container) return;
  
  // Prevent concurrent renders - queue a pending render instead
  if (renderInProgress) {
    console.log('[renderBiblicalTimeline] Render already in progress, queuing pending render');
    renderPending = true;
    return;
  }
  
  renderInProgress = true;
  renderPending = false;
  
  try {
    await renderBiblicalTimelineInternal(container);
  } finally {
    renderInProgress = false;
    
    // If a render was requested while we were rendering, do it now
    if (renderPending) {
      console.log('[renderBiblicalTimeline] Processing pending render');
      renderPending = false;
      setTimeout(() => renderBiblicalTimeline(), 50);
    }
  }
}

// Internal render function (called by renderBiblicalTimeline with lock held)
async function renderBiblicalTimelineInternal(container) {
  // Inject styles early (before any UI interactions)
  injectTimelineStyles();
  
  // Get calendar profile for resolution
  const profile = getTimelineProfile();
  
  // Try synchronous cache first (instant — no loading spinner)
  let needsCalculation = !ResolvedEventsCache.isCached(profile);
  
  if (needsCalculation) {
    // Show progress bar while computing
    container.innerHTML = `
      <div class="timeline-loading-container">
        <div class="timeline-loading-text">Loading timeline...</div>
        <div class="timeline-progress-bar">
          <div class="timeline-progress-fill" style="width: 0%"></div>
        </div>
        <div class="timeline-loading-subtext">Preparing...</div>
      </div>
    `;
    // Allow UI to paint before heavy calculation
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));
  }
  
  // Load raw data (for durations, epochs, etc. — needed even with cached events)
  const data = await loadBiblicalTimelineData();
  if (!data) {
    container.innerHTML = '<div class="biblical-timeline-error">Failed to load events.</div>';
    return;
  }
  
  // TABBED DEBUG MODE: Show tabs for table, graph, and durations
  // Graph tab uses the existing timeline rendering (skips debug mode)
  if (TIMELINE_DEBUG_MODE && currentTimelineTab !== 'graph') {
    // Show loading message first
    container.innerHTML = '<div style="padding: 20px; color: white;">Loading debug data...</div>';
    
    // Use setTimeout to allow the UI to update before processing
    setTimeout(() => {
      try {
        // Get resolved events (uses cache)
        const resolvedEvents = getResolvedEvents(data, profile);
        if (!resolvedEvents || resolvedEvents.length === 0) {
          container.innerHTML = '<div style="padding: 20px; color: #ff6b6b;">No events resolved.</div>';
          return;
        }
        
        // Abraham's birth in JD (1951 BC = year -1950)
        const abrahamBirthJD = EventResolver.gregorianToJulianDay(-1950, 1, 1);
        
        // Convert JD to year for display (shows both BC/AD and years relative to Abraham)
        const jdToYear = (jd) => {
          if (jd === null || jd === undefined || !isFinite(jd)) return 'INVALID';
          try {
            const greg = EventResolver.julianDayToGregorian(jd);
            const bcad = greg.year <= 0 ? `${1 - greg.year} BC` : `${greg.year} AD`;
            
            // Calculate years relative to Abraham
            const yearsFromAbraham = Math.round((jd - abrahamBirthJD) / 365.25);
            let relAbraham = '';
            if (yearsFromAbraham < 0) {
              relAbraham = ` (${-yearsFromAbraham} yr before Abe)`;
            } else if (yearsFromAbraham > 0) {
              relAbraham = ` (${yearsFromAbraham} yr after Abe)`;
            }
            
            return bcad + relAbraham;
          } catch (e) {
            return 'ERROR';
          }
        };
        
        // Format year as BC/AD string
        const formatYear = (y) => {
          if (y === null || y === undefined) return '?';
          return y <= 0 ? `${1 - y} BC` : `${y} AD`;
        };
        
        // Build a map of resolved events for looking up references
        const eventsById = {};
        for (const e of resolvedEvents) {
          eventsById[e.id] = e;
        }
        
        // Approximate lunar date from Julian Day
        // This is a rough calculation - proper lunar dates require the calendar profile
        const jdToApproxLunar = (jd, gregorianYear) => {
          if (!jd || !isFinite(jd)) return null;
          
          // Approximate year start (Nisan 1) for this gregorian year
          // Spring equinox is around March 20-21
          const yearStartGreg = { year: gregorianYear, month: 3, day: 20 };
          const yearStartJD = gregorianToJD(yearStartGreg);
          
          // If before spring equinox, we're in the previous biblical year
          let biblicalYear = gregorianYear;
          let startJD = yearStartJD;
          if (jd < yearStartJD) {
            biblicalYear = gregorianYear - 1;
            startJD = gregorianToJD({ year: biblicalYear, month: 3, day: 20 });
          }
          
          // Days since year start
          const daysSinceYearStart = jd - startJD;
          
          // Approximate month (29.5 day synodic month)
          const monthFloat = daysSinceYearStart / 29.5;
          let month = Math.floor(monthFloat) + 1; // 1-indexed
          
          // Day within month
          const dayInMonth = Math.round((monthFloat - Math.floor(monthFloat)) * 29.5) + 1;
          let day = Math.max(1, Math.min(30, dayInMonth));
          
          // Handle negative months (before Nisan)
          if (month < 1) {
            month += 13;
            biblicalYear--;
          }
          // Handle months > 13
          while (month > 13) {
            month -= 13;
            biblicalYear++;
          }
          
          return { month, day, year: biblicalYear };
        };
        
        // Helper: Gregorian to JD (simplified)
        const gregorianToJD = (g) => {
          const y = g.year;
          const m = g.month;
          const d = g.day;
          const a = Math.floor((14 - m) / 12);
          const y2 = y + 4800 - a;
          const m2 = m + 12 * a - 3;
          return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
        };
        
        // Resolve lunar date through reference chain
        // Returns { month, day, year, source: 'stipulated'|'=formula' }
        const resolveLunarDate = (event, isEnd = false, visited = new Set()) => {
          if (!event || visited.has(event.id)) return null;
          visited.add(event.id);
          
          const dateSpec = isEnd ? event.source?.end : event.source?.start;
          if (!dateSpec) return null;
          
          const lunar = dateSpec.lunar || {};
          const relative = dateSpec.relative;
          const refId = relative?.event || dateSpec?.event;
          const fixed = dateSpec.fixed;
          
          // If we have direct lunar values, use them
          if (lunar.month !== undefined && lunar.day !== undefined && lunar.year !== undefined) {
            return { month: lunar.month, day: lunar.day, year: lunar.year, source: 'stipulated' };
          }
          
          // If source has month/day but no year, check for _lunarYear from chain calculation
          if (lunar.month !== undefined && lunar.day !== undefined && event._lunarYear !== undefined) {
            return { month: lunar.month, day: lunar.day, year: event._lunarYear, source: '=chain' };
          }
          
          // If we have a priestly_cycle reference, show appropriate formula
          if (dateSpec.priestly_cycle) {
            const cycle = dateSpec.priestly_cycle;
            const courseName = cycle.course || 'Abijah';
            const afterEvent = cycle.after_event || '?';
            // Use resolved JD for the lunar date
            const jd = isEnd ? event.resolved?.endJD : event.resolved?.startJD;
            if (jd && isFinite(jd) && typeof EventResolver !== 'undefined' && profile) {
              const lunar = EventResolver.julianDayToLunar(jd, profile);
              if (lunar) {
                return {
                  month: lunar.month,
                  day: lunar.day,
                  year: lunar.year,
                  source: `=firstCourse(${courseName}, ${afterEvent})`
                };
              }
            }
          }
          
          // If we have a FIXED Gregorian date, calculate lunar from it
          if (fixed?.gregorian) {
            const greg = fixed.gregorian;
            const jd = gregorianToJD(greg);
            // Use EventResolver's julianDayToLunar with proper profile
            if (typeof EventResolver !== 'undefined' && profile) {
              const lunar = EventResolver.julianDayToLunar(jd, profile);
              if (lunar) {
                return { 
                  month: lunar.month, 
                  day: lunar.day, 
                  year: lunar.year, 
                  source: `=lunar(${greg.month}/${greg.day}/${greg.year > 0 ? greg.year : (1-greg.year)+'BC'})`
                };
              }
            }
            // Fallback to approximate if resolver not available
            const approxLunar = jdToApproxLunar(jd, greg.year);
            if (approxLunar) {
              return { 
                month: approxLunar.month, 
                day: approxLunar.day, 
                year: approxLunar.year, 
                source: `=lunar(${greg.month}/${greg.day}/${greg.year > 0 ? greg.year : (1-greg.year)+'BC'}) approx`
              };
            }
          }
          
          // If we have a reference, resolve it and apply offset
          if (refId && eventsById[refId]) {
            const offset = relative?.offset || {};
            const direction = relative?.direction;
            let yearsOffset = offset.years || 0;
            let monthsOffset = offset.months || 0;
            let daysOffset = offset.days || 0;
            
            if (direction === 'before') {
              yearsOffset = -yearsOffset;
              monthsOffset = -monthsOffset;
              daysOffset = -daysOffset;
            }
            
            // Build formula string for display
            let formula = `=${refId}`;
            if (yearsOffset) formula += (yearsOffset > 0 ? `+${yearsOffset}y` : `${yearsOffset}y`);
            if (monthsOffset) formula += (monthsOffset > 0 ? `+${monthsOffset}m` : `${monthsOffset}m`);
            if (daysOffset) formula += (daysOffset > 0 ? `+${daysOffset}d` : `${daysOffset}d`);
            
            // For day offsets (like 280 days), use resolved JD for accuracy
            // Simple 30-day arithmetic is too inaccurate for large day offsets
            if (Math.abs(daysOffset) > 30) {
              const jd = isEnd ? event.resolved?.endJD : event.resolved?.startJD;
              if (jd && isFinite(jd) && typeof EventResolver !== 'undefined' && profile) {
                const lunarFromJD = EventResolver.julianDayToLunar(jd, profile);
                if (lunarFromJD) {
                  // Prefer _lunarYear from chain calculation (more accurate)
                  return { month: lunarFromJD.month, day: lunarFromJD.day, year: event._lunarYear ?? lunarFromJD.year, source: formula };
                }
              }
            }
            
            // For year/month offsets, use simple arithmetic (more accurate for these)
            const refLunar = resolveLunarDate(eventsById[refId], false, new Set(visited));
            if (refLunar) {
              let { month, day, year } = refLunar;
              
              // Apply year offset
              year = (year || 0) + yearsOffset;
              
              // Apply month offset
              month = (month || 1) + monthsOffset;
              while (month > 13) { month -= 13; year++; }
              while (month < 1) { month += 13; year--; }
              
              // Apply day offset (simplified - assumes 30 day months)
              day = (day || 1) + daysOffset;
              while (day > 30) { day -= 30; month++; }
              while (day < 1) { day += 30; month--; }
              // Re-normalize month
              while (month > 13) { month -= 13; year++; }
              while (month < 1) { month += 13; year--; }
              
              // Override with any explicitly specified values
              if (lunar.month !== undefined) month = lunar.month;
              if (lunar.day !== undefined) day = lunar.day;
              if (lunar.year !== undefined) { year = lunar.year; formula = 'stipulated'; }
              
              return { month, day, year, source: formula };
            }
          }
          
          // Partial lunar data - try to fill in from gregorian year
          const greg = isEnd ? event.resolved?.endGregorian : event.resolved?.startGregorian;
          if (lunar.month !== undefined || lunar.day !== undefined) {
            // Prefer _lunarYear from chain calculation
            const displayYear = event._lunarYear ?? lunar.year ?? greg?.year ?? null;
            return {
              month: lunar.month ?? 1,
              day: lunar.day ?? 1,
              year: displayYear,
              source: event._lunarYear !== undefined ? '=chain' : (lunar.year !== undefined ? 'stipulated' : '=G.Y(JD)')
            };
          }
          
          // Last resort: derive from resolved JD using proper astronomy engine
          const jd = isEnd ? event.resolved?.endJD : event.resolved?.startJD;
          if (jd && isFinite(jd)) {
            // Use EventResolver's julianDayToLunar with proper profile
            if (typeof EventResolver !== 'undefined' && profile) {
              const lunarFromJD = EventResolver.julianDayToLunar(jd, profile);
              if (lunarFromJD) {
                // Prefer _lunarYear from chain calculation (more accurate)
                return {
                  month: lunarFromJD.month,
                  day: lunarFromJD.day,
                  year: event._lunarYear ?? lunarFromJD.year,
                  source: event._lunarYear !== undefined ? '=chain' : '=lunar(JD)'
                };
              }
            }
            // Fallback to approximate if resolver not available
            if (greg) {
              const approxLunar = jdToApproxLunar(jd, greg.year);
              if (approxLunar) {
                return {
                  month: approxLunar.month,
                  day: approxLunar.day,
                  year: approxLunar.year,
                  source: '=lunar(JD) approx'
                };
              }
            }
          }
          
          return null;
        };
        
        // Format year for display
        const formatYearDisplay = (y) => {
          if (y === null || y === undefined) return '-';
          return y <= 0 ? `${1 - y} BC` : `${y} AD`;
        };
        
        // Render cell with source indicator
        // White = stipulated, Blue = calculated
        const renderValue = (value, isCalc = false) => {
          if (value === null || value === undefined) return '-';
          const color = isCalc ? '#6bf' : '#fff';
          return `<span style="color: ${color};">${value}</span>`;
        };
        
        // Build diagnostic table
        // Build CSV data for export
        const csvRows = [['ID', 'Source', 'L.M', 'L.D', 'L.Y', 'JD', 'G.M', 'G.D', 'G.Y', 'Status']];
        
        // Tab styles
        const tabStyle = (isActive) => `
          padding: 10px 20px; 
          background: ${isActive ? '#4a9eff' : '#333'}; 
          color: white; 
          border: none; 
          border-radius: 4px 4px 0 0; 
          cursor: pointer;
          margin-right: 4px;
          font-weight: ${isActive ? 'bold' : 'normal'};
        `;
        
        let html = `
          <div style="padding: 20px; color: white; font-family: monospace; font-size: 11px; overflow-x: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div>
                <button id="tabTableBtn" style="${tabStyle(currentTimelineTab === 'table')}">📊 Events Table</button>
                <button id="tabGraphBtn" style="${tabStyle(currentTimelineTab === 'graph')}">📈 Timeline Graph</button>
                <button id="tabDurationsBtn" style="${tabStyle(currentTimelineTab === 'durations')}">🔗 Durations</button>
              </div>
              <div>
                <button id="testAsyncBtn" style="padding: 8px 16px; background: #9c27b0; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">
                  🧪 Test Async
                </button>
                <button id="exportCsvBtn" style="padding: 8px 16px; background: #4a9eff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                  Export CSV
                </button>
              </div>
            </div>
            <div id="testAsyncResult" style="display: none; padding: 10px; margin-bottom: 10px; border-radius: 4px;"></div>
            <div id="tabContent">
        `;
        
        // === EVENTS TABLE TAB ===
        if (currentTimelineTab === 'table') {
          html += `
            <h3>Events: ${resolvedEvents.length} resolved</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr style="background: rgba(255,255,255,0.15); text-align: center;">
                  <th style="padding: 4px; border: 1px solid #444;" rowspan="2">ID</th>
                  <th style="padding: 4px; border: 1px solid #444;" rowspan="2">Source</th>
                  <th style="padding: 4px; border: 1px solid #444;" colspan="3">Lunar (Resolved)</th>
                  <th style="padding: 4px; border: 1px solid #444;" rowspan="2">JD</th>
                  <th style="padding: 4px; border: 1px solid #444;" colspan="3">Gregorian (Calc)</th>
                  <th style="padding: 4px; border: 1px solid #444;" rowspan="2">⚠️</th>
                </tr>
                <tr style="background: rgba(255,255,255,0.1); text-align: center; font-size: 10px;">
                  <th style="padding: 3px; border: 1px solid #444;">M</th>
                  <th style="padding: 3px; border: 1px solid #444;">D</th>
                  <th style="padding: 3px; border: 1px solid #444;">Year</th>
                  <th style="padding: 3px; border: 1px solid #444;">M</th>
                  <th style="padding: 3px; border: 1px solid #444;">D</th>
                  <th style="padding: 3px; border: 1px solid #444;">Year</th>
                </tr>
              </thead>
              <tfoot>
                <tr style="background: rgba(255,255,255,0.05);">
                  <td colspan="10" style="padding: 8px; border: 1px solid #444; font-size: 10px;">
                    <b style="color:#fff">White</b> = stipulated | 
                    <b style="color:#6bf">Blue</b> = calculated from chain | 
                    <b style="color:#ffa500">Orange</b> = =lunar(JD) fallback - NEEDS REVIEW
                  </td>
                </tr>
              </tfoot>
              <tbody>
          `;
          
          resolvedEvents.forEach(e => {
          // Use new structure: e.resolved.startJD, etc.
          const startJD = e.resolved?.startJD ?? e.startJD;
          const endJD = e.resolved?.endJD ?? e.endJD;
          const durationDays = e.resolved?.durationDays ?? ((startJD !== null && endJD !== null) ? (endJD - startJD) : null);
          const durationYears = durationDays !== null ? (durationDays / 365.25).toFixed(2) : null;
          
          // Check for issues
          const issues = [];
          if (startJD === null || startJD === undefined) issues.push('NO START');
          if (!isFinite(startJD)) issues.push('START INF');
          if (startJD !== null && (startJD < 0 || startJD > 3000000)) issues.push('START RANGE');
          if (endJD !== null && !isFinite(endJD)) issues.push('END INF');
          if (endJD !== null && (endJD < 0 || endJD > 3000000)) issues.push('END RANGE');
          if (durationDays !== null && Math.abs(durationDays) > 1000000) issues.push('DUR EXTREME');
          if (durationDays !== null && durationDays < 0) issues.push('NEG DUR');
          
          const hasIssue = issues.length > 0;
          const rowStyle = hasIssue ? 'background: rgba(255,0,0,0.2);' : '';
          
          // Resolve lunar date through reference chain
          const lunar = resolveLunarDate(e, false);
          const isCalc = lunar?.source && lunar.source !== 'stipulated';
          const needsReview = lunar?.source === '=lunar(JD)'; // Fallback - needs review
          
          // Get gregorian from resolved
          const greg = e.resolved?.startGregorian;
          const jd = e.resolved?.startJD;
          
          // Build CSV row
          csvRows.push([
            e.id || '?',
            lunar?.source || '-',
            lunar?.month ?? '',
            lunar?.day ?? '',
            lunar?.year ?? '',
            jd && isFinite(jd) ? Math.round(jd) : '',
            greg?.month ?? '',
            greg?.day ?? '',
            greg?.year ?? '',
            issues.length > 0 ? issues.join('; ') : (needsReview ? 'REVIEW' : 'OK')
          ]);
          
          // Render row - highlight rows needing review
          const reviewRowStyle = needsReview ? 'background: rgba(255,165,0,0.15);' : '';
          
          // Render source cell
          let sourceDisplay;
          if (lunar?.source === 'stipulated') {
            sourceDisplay = '<span style="color:#6f6">direct</span>';
          } else if (needsReview) {
            sourceDisplay = `<span style="color:#ffa500;font-weight:bold;font-size:9px;">${lunar?.source || '-'}</span>`;
          } else {
            sourceDisplay = `<span style="color:#888;font-size:9px;">${lunar?.source || '-'}</span>`;
          }
          
          // Color for lunar values based on source type
          const lunarColor = needsReview ? '#ffa500' : (isCalc ? '#6bf' : '#fff');
          
            html += `
              <tr style="${rowStyle}${reviewRowStyle}">
                <td style="padding: 3px; border: 1px solid #444; font-size: 9px;">${e.id || '?'}</td>
                <td style="padding: 3px; border: 1px solid #444; font-size: 9px;">${sourceDisplay}</td>
                <td style="padding: 3px; border: 1px solid #444; text-align: center; color: ${lunarColor};">${lunar?.month ?? '-'}</td>
                <td style="padding: 3px; border: 1px solid #444; text-align: center; color: ${lunarColor};">${lunar?.day ?? '-'}</td>
                <td style="padding: 3px; border: 1px solid #444; text-align: center; color: ${lunarColor};">${lunar?.year !== null ? formatYearDisplay(lunar?.year) : '-'}</td>
                <td style="padding: 3px; border: 1px solid #444; text-align: center; font-size: 9px;">${jd && isFinite(jd) ? Math.round(jd) : '-'}</td>
                <td style="padding: 3px; border: 1px solid #444; text-align: center; color: #6bf;">${greg?.month ?? '-'}</td>
                <td style="padding: 3px; border: 1px solid #444; text-align: center; color: #6bf;">${greg?.day ?? '-'}</td>
                <td style="padding: 3px; border: 1px solid #444; text-align: center; color: #6bf;">${greg ? formatYearDisplay(greg.year) : '-'}</td>
                <td style="padding: 3px; border: 1px solid #444; text-align: center; color: ${hasIssue ? '#ff6b6b' : (needsReview ? '#ffa500' : '#6bff6b')};">${issues.length > 0 ? '⚠️' : (needsReview ? '⚠️' : '✓')}</td>
              </tr>
            `;
          });
          
          html += `
                </tbody>
              </table>
          `;
        }
        
        // === DURATIONS TABLE TAB ===
        if (currentTimelineTab === 'durations') {
          const durations = data.durations || [];
          
          html += `
            <h3>Durations: ${durations.length} records</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr style="background: rgba(255,255,255,0.15); text-align: center;">
                  <th style="padding: 4px; border: 1px solid #444;">ID</th>
                  <th style="padding: 4px; border: 1px solid #444;">From Event</th>
                  <th style="padding: 4px; border: 1px solid #444;">To Event</th>
                  <th style="padding: 4px; border: 1px solid #444;">Claimed</th>
                  <th style="padding: 4px; border: 1px solid #444;">Actual</th>
                  <th style="padding: 4px; border: 1px solid #444;">Source</th>
                  <th style="padding: 4px; border: 1px solid #444;">⚠️</th>
                </tr>
              </thead>
              <tbody>
          `;
          
          durations.forEach(dur => {
            const fromEvent = eventsById[dur.from_event];
            const toEvent = eventsById[dur.to_event];
            const fromJD = fromEvent?.resolved?.startJD;
            const toJD = toEvent?.resolved?.startJD;
            
            // Calculate actual difference
            let actualYears = null;
            let actualDays = null;
            if (fromJD && toJD && isFinite(fromJD) && isFinite(toJD)) {
              actualDays = toJD - fromJD;
              actualYears = (actualDays / 365.25).toFixed(1);
            }
            
            // Format claimed
            const claimed = dur.claimed || {};
            let claimedStr = '';
            if (claimed.years !== undefined) claimedStr += claimed.years + 'y ';
            if (claimed.months !== undefined) claimedStr += claimed.months + 'm ';
            if (claimed.days !== undefined) claimedStr += claimed.days + 'd';
            if (!claimedStr) claimedStr = '-';
            
            // Check if claimed matches actual
            const claimedYears = claimed.years || 0;
            const tolerance = claimed.approximate ? 5 : 1;
            const matches = actualYears !== null && Math.abs(parseFloat(actualYears) - claimedYears) < tolerance;
            
            // Missing events
            const missingFrom = !fromEvent;
            const missingTo = !toEvent;
            
            const rowStyle = missingFrom || missingTo ? 'background: rgba(255,0,0,0.2);' : 
                            (!matches && actualYears !== null ? 'background: rgba(255,165,0,0.2);' : '');
            
            html += `
              <tr style="${rowStyle}">
                <td style="padding: 3px; border: 1px solid #444; font-size: 9px;">${dur.id || '?'}</td>
                <td style="padding: 3px; border: 1px solid #444; font-size: 9px; color: ${missingFrom ? '#ff6b6b' : '#6bf'};">${dur.from_event || '-'}</td>
                <td style="padding: 3px; border: 1px solid #444; font-size: 9px; color: ${missingTo ? '#ff6b6b' : '#6bf'};">${dur.to_event || '-'}</td>
                <td style="padding: 3px; border: 1px solid #444; text-align: center;">${claimedStr}</td>
                <td style="padding: 3px; border: 1px solid #444; text-align: center; color: ${matches ? '#6bff6b' : '#ffa500'};">${actualYears !== null ? actualYears + 'y' : '-'}</td>
                <td style="padding: 3px; border: 1px solid #444; font-size: 9px;">${dur.source?.ref || '-'}</td>
                <td style="padding: 3px; border: 1px solid #444; text-align: center; color: ${matches ? '#6bff6b' : '#ffa500'};">${missingFrom || missingTo ? '❌' : (matches ? '✓' : '⚠️')}</td>
              </tr>
            `;
          });
          
          html += `
              </tbody>
            </table>
            <p style="margin-top: 10px; font-size: 10px;">
              <b style="color:#6bff6b">Green ✓</b> = claimed matches actual | 
              <b style="color:#ffa500">Orange ⚠️</b> = mismatch | 
              <b style="color:#ff6b6b">Red ❌</b> = missing event
            </p>
          `;
        }
        
        html += `
            </div>
          </div>
        `;
        
        container.innerHTML = html;
        
        // Attach tab handlers
        const tabTableBtn = document.getElementById('tabTableBtn');
        const tabGraphBtn = document.getElementById('tabGraphBtn');
        const tabDurationsBtn = document.getElementById('tabDurationsBtn');
        
        if (tabTableBtn) {
          tabTableBtn.onclick = () => { currentTimelineTab = 'table'; renderBiblicalTimeline(); };
        }
        if (tabGraphBtn) {
          tabGraphBtn.onclick = () => { currentTimelineTab = 'graph'; renderBiblicalTimeline(); };
        }
        if (tabDurationsBtn) {
          tabDurationsBtn.onclick = () => { currentTimelineTab = 'durations'; renderBiblicalTimeline(); };
        }
        
        // Attach async test handler
        const testAsyncBtn = document.getElementById('testAsyncBtn');
        if (testAsyncBtn) {
          testAsyncBtn.onclick = async () => {
            const resultDiv = document.getElementById('testAsyncResult');
            if (resultDiv) {
              resultDiv.style.display = 'block';
              resultDiv.style.background = '#333';
              resultDiv.innerHTML = '⏳ Running async vs sync comparison test...';
            }
            
            try {
              const result = await testAsyncResolver();
              if (resultDiv) {
                if (result.success) {
                  resultDiv.style.background = '#1b5e20';
                  resultDiv.innerHTML = `✓ PASS: Async and sync produce identical results!<br>
                    Sync: ${result.syncCount} events | Async: ${result.asyncCount} events | Progress updates: ${result.progressUpdates}`;
                } else {
                  resultDiv.style.background = '#b71c1c';
                  resultDiv.innerHTML = `✗ FAIL: ${result.errors?.length || 0} differences found.<br>
                    Check browser console for details.`;
                }
              }
            } catch (e) {
              if (resultDiv) {
                resultDiv.style.background = '#b71c1c';
                resultDiv.innerHTML = `✗ ERROR: ${e.message}`;
              }
            }
          };
        }
        
        // Attach CSV export handler
        const exportBtn = document.getElementById('exportCsvBtn');
        if (exportBtn) {
          exportBtn.onclick = () => {
            // Convert to CSV string
            const csvContent = csvRows.map(row => 
              row.map(cell => {
                // Quote cells that contain commas or quotes
                const str = String(cell);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                  return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
              }).join(',')
            ).join('\n');
            
            // Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'biblical-timeline-events.csv';
            link.click();
          };
        }
      } catch (err) {
        container.innerHTML = `<div style="padding: 20px; color: #ff6b6b;">
          <h3>Debug Error:</h3>
          <pre>${err.message}\n${err.stack}</pre>
        </div>`;
      }
    }, 100);
    return;
  }
  
  // Get resolved events via singleton (cached or computed with progress)
  let resolvedEvents;
  if (needsCalculation) {
    resolvedEvents = await getResolvedEventsWithProgress(data, profile);
  } else {
    resolvedEvents = getResolvedEvents(data, profile);
  }
  
  // Pre-apply URL search filter during initial render to avoid a second render cycle.
  // When the URL has ?q=..., syncPanelFromState would normally trigger showSearchResultsFromState
  // which calls renderBiblicalTimeline() again. By pre-computing the search filter here,
  // the first render already shows filtered results and the second render is skipped.
  _searchPreAppliedDuringRender = false;
  if (typeof AppStore !== 'undefined') {
    const _urlState = AppStore.getState();
    const _urlSearch = _urlState?.ui?.timelineSearch;
    if (_urlSearch && !activeSearchResultIds) {
      const searchText = _urlSearch.toLowerCase().trim();
      const allEvents = resolvedEvents;
      const allDurations = data?.durations || [];
      
      // Build event JD lookup for durations
      const eventJDMap = {};
      (allEvents || []).forEach(e => { if (e.id && e.startJD) eventJDMap[e.id] = e.startJD; });
      
      // Filter events by search term
      const matchingEvents = (allEvents || []).filter(event => {
        if (event.startJD === null) return false;
        const searchable = [event.title || '', event.description || '', event.id || '', ...(event.tags || [])].join(' ').toLowerCase();
        return searchable.includes(searchText);
      });
      
      // Filter durations by search term
      const matchingDurations = allDurations.filter(duration => {
        if (!eventJDMap[duration.from_event] && !eventJDMap[duration.to_event]) return false;
        const searchable = [duration.title || '', duration.description || '', duration.id || '', ...(duration.tags || [])].join(' ').toLowerCase();
        return searchable.includes(searchText);
      });
      
      if (matchingEvents.length + matchingDurations.length > 0) {
        // Set the search filter so filterResolvedEvents uses it
        activeSearchResultIds = new Set(matchingEvents.map(e => e.id));
        activeSearchDurationIds = new Set(matchingDurations.map(d => d.id));
        
        // Populate searchResultsCache so showSearchResultsFromState hits cache
        let minYear = Infinity, maxYear = -Infinity;
        matchingEvents.forEach(event => {
          if (event.startJD && typeof EventResolver !== 'undefined') {
            const greg = EventResolver.julianDayToGregorian(event.startJD);
            if (greg.year < minYear) minYear = greg.year;
            if (greg.year > maxYear) maxYear = greg.year;
          }
        });
        matchingDurations.forEach(duration => {
          if (typeof EventResolver !== 'undefined') {
            const fromJD = eventJDMap[duration.from_event];
            const toJD = eventJDMap[duration.to_event];
            if (fromJD) { const g = EventResolver.julianDayToGregorian(fromJD); if (g.year < minYear) minYear = g.year; if (g.year > maxYear) maxYear = g.year; }
            if (toJD) { const g = EventResolver.julianDayToGregorian(toJD); if (g.year < minYear) minYear = g.year; if (g.year > maxYear) maxYear = g.year; }
          }
        });
        
        const range = maxYear - minYear;
        const margin = Math.min(5, Math.max(1, Math.ceil(range * 0.02)));
        if (minYear !== Infinity) minYear -= margin;
        if (maxYear !== -Infinity) maxYear += margin;
        
        const scrollContainer = document.getElementById('timeline-scroll-container');
        let targetZoom = biblicalTimelineZoom;
        if (minYear !== Infinity && maxYear !== -Infinity && scrollContainer) {
          targetZoom = scrollContainer.clientHeight / (maxYear - minYear);
        }
        const centerYear = Math.round((minYear + maxYear) / 2);
        
        searchResultsCache = { searchText, matchingEvents, matchingDurations, minYear, maxYear, centerYear, targetZoom };
        _searchPreAppliedDuringRender = true;
        
        // Use URL zoom/year if explicitly set (user-specified takes priority)
        const urlZoom = _urlState?.ui?.timelineZoom;
        const urlYear = _urlState?.ui?.timelineCenterYear;
        if (urlZoom != null) biblicalTimelineZoom = urlZoom;
        if (urlYear == null && centerYear != null) {
          // No explicit year in URL, use search center
        }
        
        console.log(`[Timeline] Pre-applied URL search filter: "${searchText}" → ${matchingEvents.length} events, ${matchingDurations.length} durations`);
      }
    }
  }
  
  // Filter events (apply search/type/era filters) - apply fresh each time
  resolvedEvents = filterResolvedEvents([...resolvedEvents], data);
  
  if (resolvedEvents.length === 0) {
    container.innerHTML = '<div class="biblical-timeline-no-results">No events match your filters.</div>';
    return;
  }
  
  // DEBUG: Log unresolved events
  const unresolvedEvents = resolvedEvents.filter(e => e.startJD === null);
  if (unresolvedEvents.length > 0) {
    console.log('UNRESOLVED EVENTS (' + unresolvedEvents.length + '):', unresolvedEvents.map(e => e.id));
  }
  
  // DEBUG: Check specific temple/monarchy events
  const templeEvents = ['bur-sagale-eclipse', 'battle-of-qarqar', 'jehu-tribute', 'rehoboam-reign', 'ahab-reign', 'jehu-reign', 'david-reign', 'solomon-reign', 'solomon-temple-construction'];
  console.log('=== TEMPLE CHRONOLOGY EVENT DEBUG ===');
  console.log('Historical filter:', timelineFilters.historical);
  templeEvents.forEach(id => {
    const eventFiltered = resolvedEvents.find(e => e.id === id);
    const eventFull = getTimelineResolvedEvents()?.find(e => e.id === id);
    
    if (eventFull) {
      const year = eventFull.startJD ? Math.floor((eventFull.startJD - 1721425.5) / 365.25) : 'null';
      console.log(`${id}: startJD=${eventFull.startJD}, year=${year}, inFiltered=${!!eventFiltered}, type=${eventFull.type}`);
    } else {
      console.log(`${id}: NOT FOUND in cache`);
    }
  });
  
  // DEBUG: Check specific pre-flood events (check both filtered and full cache)
  const preFloodDeaths = ['methuselah-death', 'lamech-death', 'noah-death', 'jared-death', 'enoch-translation', 'methuselah-birth', 'lamech-birth'];
  console.log('=== PRE-FLOOD EVENT DEBUG ===');
  console.log('Filtered resolvedEvents count:', resolvedEvents.length);
  console.log('Full cache count:', getTimelineResolvedEvents()?.length || 0);
  
  preFloodDeaths.forEach(id => {
    const eventFiltered = resolvedEvents.find(e => e.id === id);
    const eventFull = getTimelineResolvedEvents()?.find(e => e.id === id);
    
    if (eventFull) {
      const year = eventFull.startJD ? Math.floor((eventFull.startJD - 1721425.5) / 365.25) : 'null';
      console.log(`${id}: startJD=${eventFull.startJD}, year=${year}, inFiltered=${!!eventFiltered}`);
    } else {
      console.log(`${id}: NOT FOUND in full cache`);
    }
  });
  
  // DEBUG: Check Yeshua/John birth events
  const birthEvents = ['john-baptist-conception', 'john-baptist-birth', 'yeshua-conception', 'yeshua-birth'];
  console.log('=== YESHUA/JOHN BIRTH EVENTS DEBUG ===');
  birthEvents.forEach(id => {
    const eventFiltered = resolvedEvents.find(e => e.id === id);
    const eventFull = getTimelineResolvedEvents()?.find(e => e.id === id);
    
    if (eventFull) {
      const year = eventFull.startJD ? Math.floor((eventFull.startJD - 1721425.5) / 365.25) : 'null';
      console.log(`${id}: startJD=${eventFull.startJD}, year=${year}, type=${eventFull.type}, inFiltered=${!!eventFiltered}`);
    } else {
      console.log(`${id}: NOT FOUND in full cache`);
    }
  });
  
  // Separate point events and duration events (use Math.abs for negative durations)
  const pointEvents = resolvedEvents.filter(e => !e.endJD || Math.abs(e.endJD - e.startJD) < 30);
  const durationEvents = resolvedEvents.filter(e => e.endJD && Math.abs(e.endJD - e.startJD) >= 30);
  
  // Sort by start date
  const allEvents = [...pointEvents, ...durationEvents]
    .filter(e => e.startJD !== null)
    .sort((a, b) => a.startJD - b.startJD);
  
  // Timeline range: 4050 BC to 3500 AD (covers Creation through prophetic future)
  const minYear = -4050;
  const maxYear = 3500;
  const yearRange = maxYear - minYear + 1;
  
  // Calculate Julian Day range (use EventResolver if available, else inline calculation)
  const gregorianToJD = (typeof EventResolver !== 'undefined') 
    ? EventResolver.gregorianToJulianDay 
    : (y, m, d) => {
        if (m <= 2) { y -= 1; m += 12; }
        const A = Math.floor(y / 100);
        const B = 2 - A + Math.floor(A / 4);
        return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
      };
  const minJD = gregorianToJD(minYear, 1, 1);
  const maxJD = gregorianToJD(maxYear, 12, 31);
  
  // Store range for zoom/pan
  biblicalTimelineMinYear = minYear;
  biblicalTimelineMaxYear = maxYear;
  
  // Get available height for timeline
  // Use viewport height minus header (~50px) and controls (~50px)
  const viewportHeight = window.innerHeight;
  const availableHeight = Math.max(400, viewportHeight - 100);
  // Container height is available height minus controls bar (~45px)
  const containerHeight = availableHeight - 45;
  
  // =====================================================
  // LAYOUT CONSTANTS - used throughout rendering
  // All positions derive from these values
  // Reduce dimensions on narrow mobile screens
  // =====================================================
  const isMobileNarrowLayout = window.innerWidth <= 480;
  const RULER_WIDTH = isMobileNarrowLayout ? 38 : 45; // +10px gap between year labels and axis
  const LUNAR_BARS_WIDTH = isMobileNarrowLayout ? 6 : 10; // years + months
  const AXIS_LINE_WIDTH = 2;
  const DURATION_GAP = isMobileNarrowLayout ? 4 : 8;
  
  // Calculate pixelPerYear to fit the full range in the available space
  // Base timeline is 3x the container height at zoom 1.0, so there's always something to scroll
  const minTimelineHeight = containerHeight * 3;
  const basePixelPerYear = minTimelineHeight / yearRange;
  
  // Initialize zoom if not set
  if (biblicalTimelineZoom === null) {
    biblicalTimelineZoom = 1.0;
  }
  
  // Apply zoom - zoom 1.0 is the base (3x container), higher zoom shows more detail
  // Ensure timeline is always at least as tall as the container (so it fills the screen)
  const rawTimelineHeight = minTimelineHeight * biblicalTimelineZoom;
  const timelineHeight = Math.max(rawTimelineHeight, containerHeight);
  // Recalculate pixelPerYear based on actual timeline height to keep positions consistent
  const pixelPerYear = timelineHeight / yearRange;
  
  console.log('Timeline sizing:', { viewportHeight, availableHeight, containerHeight, timelineHeight, pixelPerYear, zoom: biblicalTimelineZoom });
  
  // Determine label interval to show labels approximately every 100 pixels
  // Calculate years needed for ~100 pixel spacing
  const targetLabelSpacing = 100; // pixels
  const yearsFor100px = targetLabelSpacing / pixelPerYear;
  
  // Round to nice intervals: 1, 5, 10, 25, 50, 100, 250, 500, 1000
  const niceIntervals = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
  let labelInterval = niceIntervals.find(i => i >= yearsFor100px) || 1000;
  
  // Determine label format based on interval
  let labelFormat = 'year';
  if (labelInterval >= 1000) {
    labelFormat = 'millennium';
  } else if (labelInterval >= 100) {
    labelFormat = 'century';
  } else if (labelInterval >= 10) {
    labelFormat = 'decade';
  }
  
  // Event Classification System:
  // Events are classified by importance/type to show/hide based on zoom level
  // 
  // MAJOR EVENTS (always shown when zoomed out):
  //   - Type: "milestone" (e.g., Creation, Exodus, Crucifixion)
  //   - Type: "biblical-event" (significant biblical occurrences)
  //   - Tags: "prophecy", "resurrection", "crucifixion", "creation", "flood", "exodus"
  //   - Important deaths/births: Jesus' death/birth, David's birth
  //
  // DETAIL EVENTS (shown only when zoomed in):
  //   - All other events (reigns, constructions, minor biblical events, etc.)
  //
  // Zoom Thresholds:
  //   - < 5 px/year: Only major milestones (very zoomed out)
  //   - 5-20 px/year: Major events + high-certainty biblical events (medium zoom)
  //   - >= 20 px/year: All events (zoomed in)
  
  // Event priority system - uses "priority" field from JSON
  // Priority levels: 1 = highest (always show), 2 = high, 3 = medium, 4 = low (only when zoomed in)
  // Events without priority field get auto-assigned based on type/tags
  const getEventPriority = (event) => {
    // If event has explicit priority, use it
    if (event.priority !== undefined) return event.priority;
    
    // Auto-assign priority based on type and tags
    const majorTypes = ['milestone', 'creation', 'catastrophe', 'astronomical', 'battle', 'reign'];
    const highTypes = ['biblical-event'];
    const majorTags = ['prophecy', 'resurrection', 'crucifixion', 'creation', 'flood', 'exodus', 'patriarch', 'genealogy', 'pre-flood', 'chronology-anchor', 'astronomical', 'assyrian', 'yeshua', 'jesus', 'john-baptist', 'nativity', 'annunciation'];
    
    if (majorTypes.includes(event.type)) return 1;
    if (event.tags && event.tags.some(tag => majorTags.includes(tag))) return 1;
    if (highTypes.includes(event.type)) return 2;
    if (event.type === 'birth' || event.type === 'death') return 3;
    return 4;
  };
  
  const isMajorEvent = (event) => {
    return getEventPriority(event) <= 2;
  };
  
  // Helper to check if event has duration (use Math.abs for negative durations)
  const hasDuration = (e) => e.endJD && Math.abs(e.endJD - e.startJD) >= 30;
  
  // BEST-EFFORT PRIORITY-BASED SLOT ALLOCATION
  // Never hide an event just because of zoom level - try to show ALL events
  // If space is tight, higher priority events get slots first, lower priority may be displaced
  
  // Each event label is ~32px tall + 8px spacing = 40px slot (24px + 6px on narrow mobile)
  // Use isMobileNarrowLayout from layout constants above
  const eventHeight = isMobileNarrowLayout ? 30 : 40;
  const yearsPerSlot = eventHeight / pixelPerYear;
  
  // Max slots an event can be displaced from its natural position before being hidden
  // At low zoom, allow more displacement; at high zoom, less needed
  const maxDisplacementSlots = Math.max(2, Math.ceil(10 / yearsPerSlot));
  
  // Helper to get year from JD
  const jdToYear = (jd) => Math.floor((jd - 1721425.5) / 365.25);
  
  // Separate duration events (always shown as bars) from point events (need slot allocation)
  const durationEventsToKeep = allEvents.filter(e => hasDuration(e));
  const pointEventsForAlloc = allEvents.filter(e => !hasDuration(e) && e.startJD !== null);
  
  // Get selected/focused event ID from state - these events MUST always be shown
  let selectedEventIdForSlots = null;
  let focusedEventIdForSlots = null;
  if (typeof AppStore !== 'undefined') {
    const state = AppStore.getState();
    selectedEventIdForSlots = state?.ui?.timelineEventId;
    focusedEventIdForSlots = state?.ui?.timelineFocusedEventId;
  }
  
  // Helper to check if event is selected or focused
  const isPriorityEvent = (eventId) => {
    return eventId === selectedEventIdForSlots || eventId === focusedEventIdForSlots;
  };
  
  // Sort point events by priority (highest priority = lowest number = first)
  // Selected/focused events get absolute priority (0)
  const sortedPointEvents = [...pointEventsForAlloc].sort((a, b) => {
    // Selected/focused events always come first
    if (isPriorityEvent(a.id)) return -1;
    if (isPriorityEvent(b.id)) return 1;
    
    const aPri = getEventPriority(a);
    const bPri = getEventPriority(b);
    if (aPri !== bPri) return aPri - bPri;
    // Secondary sort by date for determinism
    return (a.startJD || 0) - (b.startJD || 0);
  });
  
  // Slot allocation: map from slotIndex -> { event, priority }
  const allocatedSlots = new Map();
  const eventsWithSlots = []; // Events that got a slot
  
  sortedPointEvents.forEach(event => {
    const eventYear = jdToYear(event.startJD);
    const naturalSlot = Math.floor((eventYear - minYear) / yearsPerSlot);
    const eventPriority = getEventPriority(event);
    
    // Try to find a slot: natural slot first, then adjacent slots up to maxDisplacement
    let assignedSlot = null;
    
    for (let offset = 0; offset <= maxDisplacementSlots; offset++) {
      // Try both directions: natural, +1, -1, +2, -2, etc.
      const slotsToTry = offset === 0 ? [naturalSlot] : [naturalSlot + offset, naturalSlot - offset];
      
      for (const trySlot of slotsToTry) {
        if (trySlot < 0) continue; // Skip negative slots
        
        const existing = allocatedSlots.get(trySlot);
        
        if (!existing) {
          // Slot is free - take it
          assignedSlot = trySlot;
          break;
        } else if (eventPriority < existing.priority) {
          // Current event has higher priority - evict the existing one
          // The evicted event will try to find another slot in a later pass (or be hidden)
          assignedSlot = trySlot;
          break;
        }
        // Slot taken by higher or equal priority - try next slot
      }
      
      if (assignedSlot !== null) break;
    }
    
    // If no slot found within normal range, but this is the selected/focused event, force a slot
    if (assignedSlot === null && isPriorityEvent(event.id)) {
      // Selected/focused event MUST be shown - find any free slot or create one
      for (let off = maxDisplacementSlots + 1; off <= maxDisplacementSlots * 4; off++) {
        for (const trySlot of [naturalSlot + off, naturalSlot - off]) {
          if (trySlot >= 0 && !allocatedSlots.has(trySlot)) {
            assignedSlot = trySlot;
            break;
          }
        }
        if (assignedSlot !== null) break;
      }
      // Last resort: just use the natural slot and evict whoever is there
      if (assignedSlot === null) {
        assignedSlot = naturalSlot;
      }
    }
    
    if (assignedSlot !== null) {
      // Check if we're evicting someone
      const evicted = allocatedSlots.get(assignedSlot);
      if (evicted) {
        // Remove evicted event from our results (it will try to get another slot)
        const evictIdx = eventsWithSlots.findIndex(e => e.event.id === evicted.event.id);
        if (evictIdx >= 0) {
          // Try to reallocate evicted event to a different slot
          const evictedEvent = eventsWithSlots[evictIdx].event;
          eventsWithSlots.splice(evictIdx, 1);
          
          // Simple reallocation: find nearest free slot
          const evictedYear = jdToYear(evictedEvent.startJD);
          const evictedNatural = Math.floor((evictedYear - minYear) / yearsPerSlot);
          for (let off = 1; off <= maxDisplacementSlots * 2; off++) {
            for (const tryS of [evictedNatural + off, evictedNatural - off]) {
              if (tryS >= 0 && !allocatedSlots.has(tryS) && tryS !== assignedSlot) {
                allocatedSlots.set(tryS, { event: evictedEvent, priority: evicted.priority });
                eventsWithSlots.push({ event: evictedEvent, slot: tryS, displaced: Math.abs(tryS - evictedNatural) });
                break;
              }
            }
            if (eventsWithSlots.find(e => e.event.id === evictedEvent.id)) break;
          }
        }
      }
      
      allocatedSlots.set(assignedSlot, { event, priority: eventPriority });
      eventsWithSlots.push({ event, slot: assignedSlot, displaced: Math.abs(assignedSlot - naturalSlot) });
    }
    // If no slot found within displacement limit, event is hidden (will show when zoomed in)
  });
  
  // Extract just the events for rendering
  let eventsToShow = [...durationEventsToKeep, ...eventsWithSlots.map(e => e.event)];
  
  // Timeline header removed - using global search in main header
  // Detail panel has its own close button
  let html = '';
  
  // Zoom and filter controls - fixed bottom left
  html += `<div class="timeline-controls-panel">
    <div class="timeline-zoom-controls">
      <button class="timeline-zoom-btn" onclick="biblicalTimelineZoomIn()" title="Zoom In">+</button>
      <button class="timeline-zoom-btn" onclick="biblicalTimelineZoomOut()" title="Zoom Out">−</button>
      <button class="timeline-zoom-btn" onclick="biblicalTimelineResetZoom()" title="Reset Zoom">⌂</button>
    </div>
    <div class="timeline-filter-controls">
      <button class="timeline-filter-btn ${timelineFilters.births ? 'active' : ''}" onclick="toggleTimelineFilter('births')" title="Births">👶</button>
      <button class="timeline-filter-btn ${timelineFilters.deaths ? 'active' : ''}" onclick="toggleTimelineFilter('deaths')" title="Deaths">💀</button>
      <button class="timeline-filter-btn ${timelineFilters.biblical ? 'active' : ''}" onclick="toggleTimelineFilter('biblical')" title="Biblical">📖</button>
      <button class="timeline-filter-btn ${timelineFilters.historical ? 'active' : ''}" onclick="toggleTimelineFilter('historical')" title="Historical">📜</button>
      <button class="timeline-filter-btn ${timelineFilters.prophecy ? 'active' : ''}" onclick="toggleTimelineFilter('prophecy')" title="Prophecy">🔮</button>
      <button class="timeline-filter-btn ${timelineFilters.dates ? 'active' : ''}" onclick="toggleTimelineFilter('dates')" title="Date References">📅</button>
    </div>
  </div>`;
  
  // containerHeight already calculated above
  html += '<div class="ruler-timeline-container" id="timeline-scroll-container" style="height: ' + containerHeight + 'px;">';
  html += '<div class="ruler-timeline-wrapper" id="biblical-timeline-scroll" style="height: ' + timelineHeight + 'px;">';
  
  // Timeline ruler on the left with multi-level tick marks
  html += '<div class="timeline-ruler">';
  
  // Determine which tick levels to show based on zoom (minimum spacing for visibility)
  const showMinorTicks = pixelPerYear >= 1;      // 10-year ticks when >= 1 px/year
  const showMediumTicks = pixelPerYear >= 0.2;   // 50-year ticks when >= 0.2 px/year
  const showYearTicks = pixelPerYear >= 10;      // 1-year ticks when >= 10 px/year
  const showMonthTicks = pixelPerYear >= 120;    // Monthly ticks when >= 120 px/year
  const showWeekTicks = pixelPerYear >= 520;     // Weekly ticks when >= 520 px/year
  const showDayTicks = pixelPerYear >= 1825;     // Daily ticks when >= 5 px/day (1825 px/year)
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Generate all tick marks
  const allTicks = [];
  
  // Major ticks (labeled - based on labelInterval)
  // Format: year number on top, BC/AD below, tick centered between
  // Astronomical year: 1 AD = 1, 1 BC = 0, 2 BC = -1, etc.
  // Start at nearest round multiple of labelInterval for clean numbers
  const majorStartYear = Math.ceil(minYear / labelInterval) * labelInterval;
  for (let year = majorStartYear; year <= maxYear; year += labelInterval) {
    const yearPos = ((year - minYear) * pixelPerYear);
    let label = '';
    if (labelFormat === 'millennium' || labelFormat === 'century') {
      // For BC years: year 0 = 1 BC, year -1 = 2 BC, etc.
      const displayYear = year <= 0 ? (1 - year) : year;
      const era = year <= 0 ? 'BC' : 'AD';
      label = `<span class="year-num">${displayYear}</span><span class="year-era">${era}</span>`;
    } else if (labelFormat === 'decade') {
      // For decades, show the decade number (no "s" suffix)
      const displayYear = year <= 0 ? (1 - year) : year;
      const decade = Math.floor(displayYear / 10) * 10;
      const era = year <= 0 ? 'BC' : 'AD';
      label = `<span class="year-num">${decade}</span><span class="year-era">${era}</span>`;
    } else {
      // For BC years: year 0 = 1 BC, year -1 = 2 BC, etc.
      const displayYear = year <= 0 ? (1 - year) : year;
      const era = year <= 0 ? 'BC' : 'AD';
      label = `<span class="year-num">${displayYear}</span><span class="year-era">${era}</span>`;
    }
    allTicks.push({ year, pos: yearPos, label, type: 'major' });
  }
  
  // 50-year ticks (medium)
  if (showMediumTicks && labelInterval > 50) {
    for (let year = Math.ceil(minYear / 50) * 50; year <= maxYear; year += 50) {
      // Skip if already a major tick
      if (year % labelInterval !== 0) {
        const yearPos = ((year - minYear) * pixelPerYear);
        allTicks.push({ year, pos: yearPos, label: null, type: 'medium' });
      }
    }
  }
  
  // 10-year ticks (minor)
  if (showMinorTicks && labelInterval > 10) {
    for (let year = Math.ceil(minYear / 10) * 10; year <= maxYear; year += 10) {
      // Skip if already a major tick
      if (year % labelInterval !== 0) {
        // Also skip if already a medium tick (only when medium ticks are shown)
        const isMediumTick = showMediumTicks && labelInterval > 50 && year % 50 === 0;
        if (!isMediumTick) {
          const yearPos = ((year - minYear) * pixelPerYear);
          allTicks.push({ year, pos: yearPos, label: null, type: 'minor' });
        }
      }
    }
  }
  
  // 1-year ticks (yearly) - only show unlabeled years when zoomed enough
  if (showYearTicks && labelInterval > 1) {
    for (let year = minYear; year <= maxYear; year += 1) {
      // Skip if already a major tick
      if (year % labelInterval !== 0) {
        // Skip if already a minor tick (10-year intervals, only when minor ticks are shown)
        const isMinorTick = showMinorTicks && labelInterval > 10 && year % 10 === 0;
        if (!isMinorTick) {
          const yearPos = ((year - minYear) * pixelPerYear);
          allTicks.push({ year, pos: yearPos, label: null, type: 'yearly' });
        }
      }
    }
  }
  
  // Gregorian monthly ticks removed - lunar months shown on left side instead
  
  // Weekly ticks - only for very zoomed in view
  if (showWeekTicks && !showDayTicks) {
    const visibleYears = Math.ceil(containerHeight / pixelPerYear) + 2;
    const startYear = Math.max(minYear, Math.floor(minYear));
    const endYear = Math.min(maxYear, startYear + visibleYears + 10);
    
    for (let year = startYear; year <= endYear; year++) {
      for (let week = 1; week <= 52; week++) {
        const weekFraction = (week - 1) / 52;
        const weekPos = ((year - minYear) + weekFraction) * pixelPerYear;
        // Skip weeks that align with month starts (approximately)
        const monthEquiv = Math.floor(weekFraction * 12) + 1;
        const monthStart = (monthEquiv - 1) / 12;
        if (Math.abs(weekFraction - monthStart) < 0.02) continue;
        allTicks.push({ year, pos: weekPos, label: null, type: 'week' });
      }
    }
  }
  
  // Daily ticks - only for extremely zoomed in view (5px/day)
  if (showDayTicks) {
    const visibleYears = Math.ceil(containerHeight / pixelPerYear) + 1;
    const startYear = Math.max(minYear, Math.floor(minYear));
    const endYear = Math.min(maxYear, startYear + visibleYears + 2);
    
    for (let year = startYear; year <= endYear; year++) {
      const daysInYear = 365; // Simplified
      for (let day = 1; day <= daysInYear; day++) {
        const dayFraction = (day - 1) / daysInYear;
        const dayPos = ((year - minYear) + dayFraction) * pixelPerYear;
        // Skip days that align with month starts or week starts
        const isMonthStart = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335].includes(day);
        const isWeekStart = day % 7 === 1;
        if (isMonthStart) continue;
        allTicks.push({ year, pos: dayPos, label: null, type: isWeekStart ? 'week' : 'day' });
      }
    }
  }
  
  // Sort by position
  allTicks.sort((a, b) => a.pos - b.pos);
  
  // Axis line position - ticks should end exactly here
  const axisLinePosForRuler = RULER_WIDTH - 2; // 33px
  
  // Tick line widths by type (extending left from axis line)
  const tickWidths = { major: 8, medium: 6, minor: 4, yearly: 2, week: 3, day: 2, month: 4 };
  
  // Render ticks with explicit positioning to end at axis line
  allTicks.forEach(({ year, pos, label, type }) => {
    const tickWidth = tickWidths[type] || 4;
    const tickLeft = axisLinePosForRuler - tickWidth;
    
    if (label) {
      html += `<div class="ruler-tick" style="top: ${pos}px;">
        <div class="ruler-tick-label">${label}</div>
        <div class="ruler-tick-line ${type}" style="position: absolute; left: ${tickLeft}px; width: ${tickWidth}px;"></div>
      </div>`;
    } else {
      html += `<div class="ruler-tick" style="top: ${pos}px;">
        <div class="ruler-tick-line ${type}" style="position: absolute; left: ${tickLeft}px; width: ${tickWidth}px;"></div>
      </div>`;
    }
  });
  
  // === YEAR BARS AND SABBATH/JUBILEE MARKERS ===
  // Regular years: alternating gray shades
  // Sabbath years: every 7th year from Jordan crossing (1406 BC) - green
  // Jubilee years: every 49th year (7 × 7) from Jordan crossing - gold
  // These appear as colored bars ON the baseline (centered on axis line)
  const JORDAN_CROSSING_YEAR = -1405; // 1406 BC in astronomical years (0 = 1 BC)
  
  const isSabbathYear = (astronomicalYear) => {
    // Years since Jordan crossing
    const yearsSinceJordan = astronomicalYear - JORDAN_CROSSING_YEAR;
    if (yearsSinceJordan < 0) return false; // Before Jordan crossing
    // Sabbath year is every 7th year (year 7, 14, 21, etc.)
    return yearsSinceJordan > 0 && yearsSinceJordan % 7 === 0;
  };
  
  const isJubileeYear = (astronomicalYear) => {
    // Years since Jordan crossing
    const yearsSinceJordan = astronomicalYear - JORDAN_CROSSING_YEAR;
    if (yearsSinceJordan < 0) return false; // Before Jordan crossing
    // Jubilee year is every 49th year (year 49, 98, 147, etc.)
    return yearsSinceJordan > 0 && yearsSinceJordan % 49 === 0;
  };
  
  const getJubileeNumber = (astronomicalYear) => {
    const yearsSinceJordan = astronomicalYear - JORDAN_CROSSING_YEAR;
    return Math.floor(yearsSinceJordan / 49) + 1;
  };
  
  // Format year for display
  const formatYearForTooltip = (year) => {
    return year <= 0 ? (1 - year) + ' BC' : year + ' AD';
  };
  
  // Show year bars when zoomed in enough to see individual years
  const showYearBars = pixelPerYear >= 3;         // Show year bars when >= 3 px/year
  const showJubileeMarkers = pixelPerYear >= 0.5;  // Show Jubilees when >= 0.5 px/year
  const showSabbathMarkers = pixelPerYear >= 2;   // Show Sabbaths when >= 2 px/year
  
  // Position year bars centered on the axis line (baseline)
  const yearBarWidth = 6;
  const yearBarLeft = axisLinePosForRuler - (yearBarWidth / 2); // Center on axis
  
  if (showYearBars || showJubileeMarkers || showSabbathMarkers) {
    html += `<div class="year-bars-container" style="position: absolute; left: ${yearBarLeft}px; top: 0; width: ${yearBarWidth + 4}px; height: 100%; pointer-events: auto;">`;
    
    // Iterate through visible years
    for (let year = Math.floor(minYear); year <= Math.ceil(maxYear); year++) {
      const isJubilee = isJubileeYear(year);
      const isSabbath = isSabbathYear(year);
      const yearPos = ((year - minYear) * pixelPerYear);
      const barHeight = Math.max(pixelPerYear, 1); // At least 1px tall
      const displayYear = formatYearForTooltip(year);
      
      if (isJubilee && showJubileeMarkers) {
        // Jubilee year - gold/amber bar, wider
        const jubNum = getJubileeNumber(year);
        html += `<div class="jubilee-year-marker" 
          style="position: absolute; top: ${yearPos}px; left: -2px; width: ${yearBarWidth + 4}px; height: ${barHeight}px;"
          title="🎺 Jubilee ${jubNum} - ${displayYear}"
          onclick="showJubileeInfo(${year}, ${jubNum})"></div>`;
      } else if (isSabbath && showSabbathMarkers) {
        // Sabbath year - green bar
        html += `<div class="sabbath-year-marker" 
          style="position: absolute; top: ${yearPos}px; left: 0; width: ${yearBarWidth}px; height: ${barHeight}px;"
          title="🌿 Sabbath Year - ${displayYear}"></div>`;
      } else if (showYearBars) {
        // Regular year - alternating gray shades
        const isOdd = Math.abs(year) % 2 === 1;
        const grayClass = isOdd ? 'odd' : 'even';
        html += `<div class="year-bar ${grayClass}" 
          style="position: absolute; top: ${yearPos}px; left: 0; width: ${yearBarWidth}px; height: ${barHeight}px;"
          title="${displayYear}"></div>`;
      }
    }
    
    html += '</div>';
  }
  
  html += '</div>';
  
  // Only show lunar bars when zoomed in enough (pixelPerYear >= 5)
  const showLunarBarsContainer = pixelPerYear >= 5;
  html += `<div class="timeline-axis-line" style="left: ${axisLinePosForRuler}px;"></div>`;
  
  // Lunar calendar bars (alternating colors for lunar months and years)
  // Only render the container when zoomed in enough
  if (showLunarBarsContainer) {
    html += '<div class="lunar-bars-container">';
  }
  
  // Lunar month constants (high precision)
  const SYNODIC_MONTH = 29.53059; // days (average lunar month)
  const DAYS_PER_YEAR = 365.2422; // Gregorian year in days
  
  // Metonic cycle: 19 years with 7 leap years (13 months instead of 12)
  // Leap years in the 19-year cycle: 3, 6, 8, 11, 14, 17, 19 (1-indexed)
  // This keeps lunar calendar aligned with solar seasons
  const METONIC_CYCLE = 19;
  const LEAP_YEARS_IN_CYCLE = [3, 6, 8, 11, 14, 17, 19]; // 1-indexed within cycle
  
  const isLunarLeapYear = (lunarYearNum) => {
    // Get position in 19-year cycle (1-19)
    const cyclePos = ((lunarYearNum % METONIC_CYCLE) + METONIC_CYCLE) % METONIC_CYCLE + 1;
    return LEAP_YEARS_IN_CYCLE.includes(cyclePos);
  };
  
  const monthsInLunarYear = (lunarYearNum) => isLunarLeapYear(lunarYearNum) ? 13 : 12;
  
  // Show lunar years earlier (40+ px/year), months later (120+ px/year)
  const showLunarYears = pixelPerYear >= 40;
  const showLunarMonths = pixelPerYear >= 120;
  
  if (showLunarMonths || showLunarYears) {
    const startDays = minYear * DAYS_PER_YEAR;
    const endDays = maxYear * DAYS_PER_YEAR;
    
    // Epoch: Lunar year 1 starts around spring (approximation)
    // Using day 91 (April 1) as simplified epoch
    const lunarEpochOffset = 91;
    
    // Build a lookup of lunar year start days
    // Start from a reference point and calculate forward/backward
    const lunarYearStarts = new Map(); // lunarYearIndex -> startDayFromEpoch
    
    // Calculate lunar year boundaries
    // Reference: lunar year 0 starts at epoch
    const getLunarYearStart = (yearIndex) => {
      if (lunarYearStarts.has(yearIndex)) return lunarYearStarts.get(yearIndex);
      
      let days = 0;
      if (yearIndex >= 0) {
        for (let y = 0; y < yearIndex; y++) {
          days += monthsInLunarYear(y) * SYNODIC_MONTH;
        }
      } else {
        for (let y = -1; y >= yearIndex; y--) {
          days -= monthsInLunarYear(y) * SYNODIC_MONTH;
        }
      }
      lunarYearStarts.set(yearIndex, days);
      return days;
    };
    
    // Find which lunar year contains a given day offset from epoch
    const findLunarYearForDay = (dayFromEpoch) => {
      // Estimate based on average year length (~365.25 * 12/12.368 ≈ 354.4)
      let estimate = Math.floor(dayFromEpoch / 354.4);
      
      // Refine
      while (getLunarYearStart(estimate + 1) <= dayFromEpoch) estimate++;
      while (getLunarYearStart(estimate) > dayFromEpoch) estimate--;
      
      return estimate;
    };
    
    // Find starting lunar year
    const startDayFromEpoch = startDays - lunarEpochOffset;
    let startLunarYear = findLunarYearForDay(startDayFromEpoch);
    
    if (showLunarMonths) {
      // Generate lunar month bars (no labels, just alternating colors)
      let lunarYear = startLunarYear;
      let yearStartDay = getLunarYearStart(lunarYear);
      let monthInYear = 0;
      let totalMonthIndex = 0;
      
      // Find first month
      while (lunarEpochOffset + yearStartDay + (monthInYear + 1) * SYNODIC_MONTH < startDays) {
        monthInYear++;
        if (monthInYear >= monthsInLunarYear(lunarYear)) {
          lunarYear++;
          yearStartDay = getLunarYearStart(lunarYear);
          monthInYear = 0;
        }
      }
      
      // Generate months
      while (true) {
        const monthStartDays = lunarEpochOffset + yearStartDay + monthInYear * SYNODIC_MONTH;
        const monthEndDays = monthStartDays + SYNODIC_MONTH;
        
        if (monthStartDays > endDays) break;
        
        const startYearFrac = monthStartDays / DAYS_PER_YEAR;
        const endYearFrac = monthEndDays / DAYS_PER_YEAR;
        
        const topPos = Math.max(0, (startYearFrac - minYear) * pixelPerYear);
        const bottomPos = Math.min(timelineHeight, (endYearFrac - minYear) * pixelPerYear);
        const height = bottomPos - topPos;
        
        // Use totalMonthIndex for continuous alternation across year boundaries
        const monthIsOdd = totalMonthIndex % 2 === 1;
        
        if (height > 0 && topPos < timelineHeight) {
          html += `<div class="lunar-month-bar ${monthIsOdd ? 'odd' : 'even'}" style="top: ${topPos}px; height: ${height}px;"></div>`;
        }
        
        // Move to next month
        monthInYear++;
        totalMonthIndex++;
        if (monthInYear >= monthsInLunarYear(lunarYear)) {
          lunarYear++;
          yearStartDay = getLunarYearStart(lunarYear);
          monthInYear = 0;
        }
      }
    }
    
    if (showLunarYears) {
      // Generate lunar year bars (aligned with month boundaries by definition)
      let lunarYear = startLunarYear;
      let yearCount = 0;
      const maxYears = 500; // Safety limit
      
      while (yearCount < maxYears) {
        const yearStartDays = lunarEpochOffset + getLunarYearStart(lunarYear);
        const yearEndDays = lunarEpochOffset + getLunarYearStart(lunarYear + 1);
        
        if (yearStartDays > endDays) break;
        
        const startYearFrac = yearStartDays / DAYS_PER_YEAR;
        const endYearFrac = yearEndDays / DAYS_PER_YEAR;
        
        const topPos = Math.max(0, (startYearFrac - minYear) * pixelPerYear);
        const bottomPos = Math.min(timelineHeight, (endYearFrac - minYear) * pixelPerYear);
        const height = bottomPos - topPos;
        
        const yearIsOdd = Math.abs(lunarYear) % 2 === 1;
        
        if (height > 0 && topPos < timelineHeight) {
          html += `<div class="lunar-year-bar ${yearIsOdd ? 'odd' : 'even'}" style="top: ${topPos}px; height: ${height}px;"></div>`;
        }
        
        lunarYear++;
        yearCount++;
      }
    }
  }
  
  if (showLunarBarsContainer) {
    html += '</div>'; // lunar-bars-container
  }
  
  const eventLabelHeight = 32; // Actual height of event label element
  const minEventGap = 8; // Minimum gap between events
  
  // Convert Julian Day to pixel position
  const jdToPixelPos = (jd) => {
    return ((jd - minJD) / (maxJD - minJD)) * timelineHeight;
  };
  
  // Julian Day to Gregorian (fallback if EventResolver not available)
  const jdToGregorian = (typeof EventResolver !== 'undefined')
    ? EventResolver.julianDayToGregorian
    : (jd) => {
        const Z = Math.floor(jd + 0.5);
        const F = (jd + 0.5) - Z;
        let A = Z < 2299161 ? Z : Z + 1 + Math.floor((Z - 1867216.25) / 36524.25) - Math.floor(Math.floor((Z - 1867216.25) / 36524.25) / 4);
        const B = A + 1524;
        const C = Math.floor((B - 122.1) / 365.25);
        const D = Math.floor(365.25 * C);
        const E = Math.floor((B - D) / 30.6001);
        const day = B - D - Math.floor(30.6001 * E) + F;
        const month = E < 14 ? E - 1 : E - 13;
        const year = month > 2 ? C - 4716 : C - 4715;
        return { year, month, day: Math.floor(day) };
      };
  
  // Separate duration events for bar rendering, point events for stack
  const durationEventsForLines = [];
  const pointEventsForStack = [];
  // monthNames already declared above for tick labels
  
  // First pass: collect all point events with their natural positions
  const pendingPointEvents = [];
  
  // Process events using resolved Julian Day positions
  eventsToShow.forEach((event) => {
    if (event.startJD === null) return;
    
    const eventTimelinePos = jdToPixelPos(event.startJD);
    
    // Get display date from resolved event
    const startDate = jdToGregorian(event.startJD);
    const year = startDate.year;
    const dateStr = `${formatYear(year)} ${monthNames[startDate.month - 1]} ${startDate.day}`;
    
    const icon = getTypeIcon(event.type);
    const color = getEventColor(event.type);
    
    // Check if this is a duration event (has endJD more than 30 days from start)
    const isDuration = event.endJD && Math.abs(event.endJD - event.startJD) >= 30;
    
    if (isDuration) {
      // Duration events: render as vertical bars on timeline
      const endTimelinePos = jdToPixelPos(event.endJD);
      
      // Handle negative durations (endJD < startJD means duration goes backward)
      const isNegativeDuration = event.endJD < event.startJD;
      const barStartPos = isNegativeDuration ? endTimelinePos : eventTimelinePos;
      const barEndPos = isNegativeDuration ? eventTimelinePos : endTimelinePos;
      const durationHeight = Math.abs(endTimelinePos - eventTimelinePos);
      
      // Format duration string from event data
      let durationStr = '';
      if (event.duration) {
        const dur = event.duration;
        const unitLabels = {
          'days': 'days',
          'weeks': 'weeks',
          'lunar_weeks': 'lunar weeks',
          'months': 'months',
          'solar_years': 'solar years',
          'lunar_years': 'lunar years',
          'regal_years': 'regal years'
        };
        const unit = unitLabels[dur.unit] || dur.unit || 'years';
        // Use absolute value for display
        durationStr = `${Math.abs(dur.value)} ${unit}`;
        if (dur.reckoning) {
          durationStr += ` (${dur.reckoning})`;
        }
      }
      
      durationEventsForLines.push({
        id: event.id,
        startPos: barStartPos,
        endPos: barEndPos,
        startJD: isNegativeDuration ? event.endJD : event.startJD,
        endJD: isNegativeDuration ? event.startJD : event.endJD,
        height: durationHeight,
        color: color,
        title: event.title,
        dateStr: dateStr,
        durationStr: durationStr,
        eventIndex: durationEventsForLines.length
      });
    } else {
      // Collect point events for smart positioning
      pendingPointEvents.push({
        event: event,
        eventTimelinePos: eventTimelinePos,
        year: year,
        icon: icon,
        color: color
      });
      
      // Debug: log yeshua/john events
      if (event.id && (event.id.includes('yeshua') || event.id.includes('john-baptist'))) {
        console.log(`[Render] Added to pendingPointEvents: ${event.id}, pos=${eventTimelinePos}, year=${year}`);
      }
    }
  });
  
  // Debug: Check if yeshua/john events are in pendingPointEvents
  const yeshuaJohnPending = pendingPointEvents.filter(pe => 
    pe.event.id && (pe.event.id.includes('yeshua') || pe.event.id.includes('john-baptist'))
  );
  console.log('[Render] Yeshua/John events in pendingPointEvents:', yeshuaJohnPending.length, 
    yeshuaJohnPending.map(pe => pe.event.id));
  
  // Smart positioning: sort by timeline position, then resolve overlaps
  pendingPointEvents.sort((a, b) => a.eventTimelinePos - b.eventTimelinePos);
  
  let lastEventBottom = -Infinity; // Track bottom edge of last placed event
  
  pendingPointEvents.forEach((pe) => {
    // Event is centered on displayPos, so top edge is displayPos - height/2
    let displayPos = pe.eventTimelinePos;
    const topEdge = displayPos - (eventLabelHeight / 2);
    
    // Check if natural position overlaps with previous event
    if (topEdge < lastEventBottom + minEventGap) {
      // Overlap detected - push down just enough to clear
      displayPos = lastEventBottom + minEventGap + (eventLabelHeight / 2);
    }
    
    // Update last event bottom edge
    lastEventBottom = displayPos + (eventLabelHeight / 2);
    
    pointEventsForStack.push({
      event: pe.event,
      eventTimelinePos: pe.eventTimelinePos,
      eventDisplayPos: displayPos,
      year: pe.year,
      icon: pe.icon,
      color: pe.color,
      clusterCount: null
    });
    
    // Debug: log yeshua/john events
    if (pe.event.id && (pe.event.id.includes('yeshua') || pe.event.id.includes('john-baptist'))) {
      console.log(`[Render] Added to pointEventsForStack: ${pe.event.id}, displayPos=${displayPos}`);
    }
  });
  
  // Debug: Check if yeshua/john events are in pointEventsForStack
  const yeshuaJohnStack = pointEventsForStack.filter(pe => 
    pe.event.id && (pe.event.id.includes('yeshua') || pe.event.id.includes('john-baptist'))
  );
  console.log('[Render] Yeshua/John events in pointEventsForStack:', yeshuaJohnStack.length,
    yeshuaJohnStack.map(pe => `${pe.event.id}@${pe.eventDisplayPos}`));
  
  // =====================================================
  // DURATION BARS - Render ONLY from explicit durations array
  // These are the documented testimonies/evidence between events
  // =====================================================
  
  // Build event Julian Day lookup from ALL resolved events
  // Store raw JD values - scaling happens at render time
  const eventJulianDays = {};
  const allResolvedEvents = getTimelineResolvedEvents() || [];
  
  allResolvedEvents.forEach(event => {
    if (event.startJD !== null) {
      eventJulianDays[event.id] = event.startJD;
    }
  });
  
  // Reuse existing jdToPixelPos function defined above for timeline rendering
  // No need to redefine - it's already available in this scope
  
  // Process durations array into renderable bars
  const durationBars = [];
  // Reduce bar width and gap on narrow mobile screens (reuse isMobileNarrowLayout from above)
  const barWidth = isMobileNarrowLayout ? 4 : 8;
  const barGap = isMobileNarrowLayout ? 1 : 2;
  
  // Create lookup map for event ID -> title and date
  const eventLookup = {};
  allResolvedEvents.forEach(event => {
    const startDate = jdToGregorian(event.startJD);
    const dateStr = event.startJD ? `${formatYear(startDate.year)} ${monthNames[startDate.month - 1]} ${startDate.day}` : '';
    eventLookup[event.id] = {
      title: event.title || event.id,
      date: dateStr
    };
  });
  
  // DEBUG: Log JD-based positions for key events
  console.log('=== EVENT POSITIONS DEBUG (JD-based) ===');
  console.log(`minJD=${minJD.toFixed(2)}, maxJD=${maxJD.toFixed(2)}, timelineHeight=${timelineHeight}`);
  const keyEvents = ['methuselah-birth', 'methuselah-death', 'lamech-birth', 'lamech-death', 'noah-birth', 'noah-death', 'flood-begins', 'waters-dried-up', 'earth-dried'];
  keyEvents.forEach(id => {
    const jd = eventJulianDays[id];
    if (jd !== undefined) {
      const year = Math.floor((jd - 1721425.5) / 365.25);
      // Astronomical year: 0 = 1 BC, -1 = 2 BC, -N = (N+1) BC
      const yearStr = year > 0 ? `${year} AD` : `${1 - year} BC`;
      const pos = jdToPixelPos(jd);
      console.log(`${id}: JD=${jd.toFixed(2)}, year=${yearStr}, pixelPos=${pos.toFixed(2)}`);
    } else {
      console.log(`${id}: NOT FOUND`);
    }
  });
  
  if (data.durations && data.durations.length > 0) {
    // DEBUG: Check lifespan durations AND short durations
    const debugDurations = data.durations.filter(d => 
      d.id.includes('lifespan') || 
      d.id.includes('waters-dried') || 
      d.id.includes('earth-dried') ||
      d.id.includes('flood')
    );
    console.log('=== DURATIONS DEBUG (JD-based) ===');
    debugDurations.forEach(dur => {
      const fromJD = eventJulianDays[dur.from_event];
      const toJD = eventJulianDays[dur.to_event];
      if (fromJD !== undefined && toJD !== undefined) {
        const fromPos = jdToPixelPos(fromJD);
        const toPos = jdToPixelPos(toJD);
        const height = Math.abs(toPos - fromPos);
        const daysDiff = Math.abs(toJD - fromJD);
        console.log(`${dur.id}: ${daysDiff.toFixed(1)} days, height=${height.toFixed(2)}px`);
      } else {
        console.log(`${dur.id}: fromJD=${fromJD !== undefined ? 'OK' : 'MISSING'}, toJD=${toJD !== undefined ? 'OK' : 'MISSING'}`);
      }
    });
    
    data.durations.forEach(dur => {
      const fromJD = eventJulianDays[dur.from_event];
      const toJD = eventJulianDays[dur.to_event];
      
      if (fromJD !== undefined && toJD !== undefined) {
        // Convert JD to pixel positions at render time
        const fromPos = jdToPixelPos(fromJD);
        const toPos = jdToPixelPos(toJD);
        const startPos = Math.min(fromPos, toPos);
        const endPos = Math.max(fromPos, toPos);
        const height = endPos - startPos;
        
        // Include all durations with any height (minimum 0.1px)
        if (height >= 0.1) {
          durationBars.push({
            id: dur.id,
            title: dur.title || dur.id,
            startPos: startPos,
            endPos: endPos,
            height: height,
            fromEvent: dur.from_event,
            toEvent: dur.to_event,
            claimed: dur.claimed,
            source: dur.source,
            doc: dur.doc,
            notes: dur.notes,
            validates: dur.validates,
            isScripture: dur.source?.type === 'scripture'
          });
        }
      }
    });
  }
  
  // Store durations globally for the detail function
  window._timelineDurations = data.durations || [];
  
  // Sort by start position for better lane packing of consecutive durations
  durationBars.sort((a, b) => a.startPos - b.startPos);
  
  // Assign lanes using interval scheduling - each lane tracks occupied segments
  const lanes = []; // Each lane is an array of {start, end} segments
  const TOLERANCE = 5; // Tolerance for "touching" durations (end of one = start of next)
  
  durationBars.forEach(bar => {
    let assignedLane = -1;
    
    // Find first lane where this bar doesn't overlap with any segment
    for (let i = 0; i < lanes.length; i++) {
      const laneSegments = lanes[i];
      let canFit = true;
      
      for (const seg of laneSegments) {
        // Check for overlap (with tolerance for adjacent segments)
        const overlaps = !(bar.endPos <= seg.start + TOLERANCE || bar.startPos >= seg.end - TOLERANCE);
        if (overlaps) {
          canFit = false;
          break;
        }
      }
      
      if (canFit) {
        assignedLane = i;
        break;
      }
    }
    
    if (assignedLane === -1) {
      // Create new lane
      assignedLane = lanes.length;
      lanes.push([]);
    }
    
    // Add this bar's segment to the lane
    lanes[assignedLane].push({ start: bar.startPos, end: bar.endPos });
    bar.lane = assignedLane;
    bar.laneIndex = lanes[assignedLane].length - 1;
  });
  
  const durationBarsWidth = Math.max(20, lanes.length * (barWidth + barGap));
  
  // Rainbow color palette for duration bars - each lane gets a distinct color
  const rainbowColors = [
    'rgba(231, 76, 60, 0.85)',   // Red
    'rgba(230, 126, 34, 0.85)',  // Orange
    'rgba(241, 196, 15, 0.85)',  // Yellow
    'rgba(46, 204, 113, 0.85)',  // Green
    'rgba(26, 188, 156, 0.85)',  // Teal
    'rgba(52, 152, 219, 0.85)',  // Blue
    'rgba(155, 89, 182, 0.85)',  // Purple
    'rgba(233, 30, 99, 0.85)',   // Pink
    'rgba(0, 188, 212, 0.85)',   // Cyan
    'rgba(139, 195, 74, 0.85)',  // Light Green
    'rgba(255, 152, 0, 0.85)',   // Amber
    'rgba(121, 85, 72, 0.85)',   // Brown
  ];
  
  // Position duration bars after axis line + lunar bars (if shown)
  const durationBarsLeftPos = axisLinePosForRuler + AXIS_LINE_WIDTH + (showLunarBarsContainer ? LUNAR_BARS_WIDTH : 0);
  html += `<div class="duration-bars-container" style="left: ${durationBarsLeftPos}px; width: ${durationBarsWidth}px;">`;
  durationBars.forEach(bar => {
    const leftPos = bar.lane * (barWidth + barGap);
    // Each lane gets a different color from the rainbow palette
    const barColor = rainbowColors[bar.lane % rainbowColors.length];
    
    // Format claimed duration for tooltip
    let claimedStr = '';
    if (bar.claimed) {
      // Handle both {years: N} and {value: N, unit: 'years'} formats
      if (bar.claimed.value !== undefined) {
        claimedStr = `${bar.claimed.value} ${bar.claimed.unit || 'years'}`;
      } else {
        // Old format: {years: N, months: M, days: D}
        const parts = [];
        if (bar.claimed.years !== undefined) parts.push(`${bar.claimed.years} years`);
        if (bar.claimed.months !== undefined) parts.push(`${bar.claimed.months} months`);
        if (bar.claimed.days !== undefined) parts.push(`${bar.claimed.days} days`);
        claimedStr = parts.join(', ') || 'unknown';
      }
    }
    
    // Get source quote for tooltip (truncate if too long)
    const sourceQuote = bar.source?.quote ? 
      (bar.source.quote.length > 100 ? bar.source.quote.substring(0, 100) + '...' : bar.source.quote) : '';
    const sourceRef = bar.source?.ref || 'Unknown source';
    
    // Look up human-friendly event titles and dates
    const fromInfo = eventLookup[bar.fromEvent] || { title: bar.fromEvent, date: '' };
    const toInfo = eventLookup[bar.toEvent] || { title: bar.toEvent, date: '' };
    
    // Use &#10; for line breaks in HTML title attribute
    const tooltip = `${bar.title}&#10;━━━━━━━━━━━━━━━━&#10;From: ${fromInfo.title}&#10;  (${fromInfo.date})&#10;To: ${toInfo.title}&#10;  (${toInfo.date})&#10;Duration: ${claimedStr}&#10;━━━━━━━━━━━━━━━━&#10;Source: ${sourceRef}&#10;Click for full documentation`;
    
    // Ensure minimum display height of 3px for very short durations
    const displayHeight = Math.max(3, bar.height);
    
    html += `
      <div class="duration-event-bar" 
           style="top: ${bar.startPos}px; height: ${displayHeight}px; left: ${leftPos}px; background-color: ${barColor}; cursor: pointer;"
           title="${tooltip}"
           data-duration-id="${bar.id}"
           onclick="openDurationDetail('${bar.id}')">
      </div>
    `;
  });
  html += '</div>';
  
  console.log('Duration bars rendered:', durationBars.length, 'from', data.durations?.length || 0, 'durations');
  
  // Calculate positions using layout constants (defined at top of function)
  const showLunarBars = pixelPerYear >= 5; // Only show lunar bars when reasonably zoomed in
  const axisLineLeft = RULER_WIDTH; // Axis always at ruler edge
  const durationBarsLeft = axisLineLeft + AXIS_LINE_WIDTH + (showLunarBars ? LUNAR_BARS_WIDTH : 0);
  const eventsStackLeft = durationBarsLeft + durationBarsWidth + DURATION_GAP;
  
  // Store layout for use by line drawing functions
  window._timelineLayout = {
    axisLineLeft,
    durationBarsLeft,
    eventsStackLeft,
    timelineHeight
  };
  
  // Base position for events (right after axis line with small gap)
  const minEventsLeft = durationBarsLeft + DURATION_GAP;
  
  html += `<div class="timeline-events-stack" style="left: 0;">`;
  
  // Render point events - position each based on overlapping durations
  pointEventsForStack.forEach((pointEvent) => {
    const clusterBadge = pointEvent.clusterCount ? 
      `<span class="cluster-badge">+${pointEvent.clusterCount - 1}</span>` : '';
    
    // Find max lane of duration bars that overlap this event's vertical position
    // Event height is ~32px centered on eventDisplayPos
    const eventTop = pointEvent.eventDisplayPos - 16;
    const eventBottom = pointEvent.eventDisplayPos + 16;
    
    let maxOverlappingLane = -1;
    durationBars.forEach(bar => {
      // Check if this bar overlaps vertically with the event
      const barTop = bar.startPos;
      const barBottom = bar.endPos;
      const overlaps = !(eventBottom < barTop || eventTop > barBottom);
      if (overlaps && bar.lane > maxOverlappingLane) {
        maxOverlappingLane = bar.lane;
      }
    });
    
    // Calculate left position: after the rightmost overlapping duration bar
    let eventLeft;
    if (maxOverlappingLane >= 0) {
      // Position after the overlapping bars
      eventLeft = durationBarsLeft + ((maxOverlappingLane + 1) * (barWidth + barGap)) + DURATION_GAP;
    } else {
      // No overlapping bars - position right after the axis/lunar bars
      eventLeft = minEventsLeft;
    }
    
    // Build tooltip with lunar date
    const hebrewMonths = ['', 'Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 
                          'Tishri', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar II'];
    
    // Get lunar date - check both old format (dates.lunar) and new format (source.start.lunar)
    let lunarStr = '';
    const lunarData = pointEvent.event.dates?.lunar || pointEvent.event.source?.start?.lunar;
    if (lunarData?.month) {
      const monthName = hebrewMonths[lunarData.month] || `Month ${lunarData.month}`;
      // Prefer _lunarYear from chain calculation, then source data, then empty
      const displayYear = pointEvent.event._lunarYear !== undefined ? pointEvent.event._lunarYear : lunarData.year;
      // Astronomical year: 0 = 1 BC, -1 = 2 BC, -N = (N+1) BC
      const lunarYearStr = displayYear !== undefined ? (displayYear <= 0 ? `${1 - displayYear} BC` : `${displayYear} AD`) : '';
      lunarStr = `${monthName}(${lunarData.month}) ${lunarData.day || 1}${lunarYearStr ? ', ' + lunarYearStr : ''}`;
    }
    
    let eventTooltip = pointEvent.event.title;
    if (lunarStr) eventTooltip += `&#10;🌙 ${lunarStr}`;
    
    html += `
      <div class="stacked-event" 
           style="top: ${pointEvent.eventDisplayPos}px; left: ${eventLeft}px; border-left-color: ${pointEvent.color};"
           data-event-id="${pointEvent.event.id}"
           data-event-timeline-pos="${pointEvent.eventTimelinePos}"
           data-event-display-pos="${pointEvent.eventDisplayPos}"
           data-event-color="${pointEvent.color}"
           data-event-left="${eventLeft}"
           title="${eventTooltip}"
           onclick="handleEventClick('${pointEvent.event.id}', event)"
           ontouchend="handleEventTouchEnd('${pointEvent.event.id}', event)"
           onmouseenter="handleEventHoverEnter('${pointEvent.event.id}')"
           onmouseleave="handleEventHoverLeave()">
        <span class="stacked-event-icon">${pointEvent.icon}</span>
        <span class="stacked-event-title">${pointEvent.event.title}</span>
        ${clusterBadge}
      </div>
    `;
  });
  html += '</div>';
  
  html += '</div>'; // ruler-timeline-wrapper
  html += '</div>'; // ruler-timeline-container
  
  container.innerHTML = html;
  
  // Store event lookup
  biblicalTimelineEventLookup.clear();
  resolvedEvents.forEach(event => {
    biblicalTimelineEventLookup.set(event.id, event);
  });
  
  // Draw connecting lines from point events to timeline
  setTimeout(() => {
    drawEventConnectingLines(eventsStackLeft, timelineHeight);
    setupCanvasScrollHandler(eventsStackLeft, timelineHeight);
  }, 50);
  
  // Set up drag-to-pan (only once)
  setupTimelineDragHandlers();
  
  // Timeline fully rendered
}

// Draw connecting lines from point events to timeline
// Uses viewport-sized canvas that only draws visible events
function drawEventConnectingLines(eventsStackLeft, timelineHeight) {
  const scrollContainer = document.getElementById('timeline-scroll-container');
  const wrapper = document.getElementById('biblical-timeline-scroll');
  if (!wrapper || !scrollContainer) return;
  
  // Remove existing canvas if any
  const existingCanvas = wrapper.querySelector('.event-lines-canvas');
  if (existingCanvas) existingCanvas.remove();
  
  // Get all stacked events
  const stackedEvents = document.querySelectorAll('.stacked-event');
  if (stackedEvents.length === 0) return;
  
  // Get viewport dimensions
  const viewportHeight = scrollContainer.clientHeight;
  const scrollTop = scrollContainer.scrollTop;
  const viewportBottom = scrollTop + viewportHeight;
  
  // Create viewport-sized canvas (with some buffer)
  const canvasHeight = Math.min(viewportHeight + 200, timelineHeight);
  const canvasTop = Math.max(0, scrollTop - 100);
  
  const canvas = document.createElement('canvas');
  canvas.className = 'event-lines-canvas';
  
  // Get layout from stored values (set during render)
  const layout = window._timelineLayout || { axisLineLeft: 35, eventsStackLeft: 100 };
  const canvasLeft = layout.axisLineLeft + 2; // Start just after axis line
  // Use full width to cover all possible event positions
  const canvasWidth = layout.eventsStackLeft - canvasLeft + 50;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.cssText = `
    position: absolute;
    left: ${canvasLeft}px;
    top: ${canvasTop}px;
    width: ${canvasWidth}px;
    height: ${canvasHeight}px;
    pointer-events: none;
    z-index: 1;
    background-color: transparent;
  `;
  
  wrapper.appendChild(canvas);
  
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const timelineX = 0;
  
  // Only draw lines for events in or near the viewport
  stackedEvents.forEach(eventEl => {
    const timelinePos = parseFloat(eventEl.dataset.eventTimelinePos);
    const displayPos = parseFloat(eventEl.dataset.eventDisplayPos);
    const eventLeft = parseFloat(eventEl.dataset.eventLeft) || layout.eventsStackLeft;
    const color = eventEl.dataset.eventColor || 'rgba(126, 200, 227, 0.5)';
    
    if (isNaN(timelinePos) || isNaN(displayPos)) return;
    
    // Skip events outside visible range (with buffer)
    const minPos = Math.min(timelinePos, displayPos);
    const maxPos = Math.max(timelinePos, displayPos);
    if (maxPos < scrollTop - 100 || minPos > viewportBottom + 100) return;
    
    // Adjust positions relative to canvas top
    const adjustedTimelinePos = timelinePos - canvasTop;
    const adjustedDisplayPos = displayPos - canvasTop;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    
    // Calculate event X position relative to canvas
    const eventX = eventLeft - canvasLeft;
    
    ctx.beginPath();
    ctx.moveTo(timelineX, adjustedTimelinePos);
    
    const controlX1 = eventX * 0.3;
    const controlX2 = eventX * 0.7;
    
    ctx.bezierCurveTo(
      controlX1, adjustedTimelinePos,
      controlX2, adjustedDisplayPos,
      eventX, adjustedDisplayPos
    );
    ctx.stroke();
  });
  
  ctx.globalAlpha = 1.0;
}

// Redraw canvas on scroll (debounced)
let canvasScrollTimeout = null;
let saveStateTimeout = null;
function setupCanvasScrollHandler(eventsStackLeft, timelineHeight) {
  const scrollContainer = document.getElementById('timeline-scroll-container');
  if (!scrollContainer) return;
  
  // Remove old handler if exists
  if (scrollContainer._canvasScrollHandler) {
    scrollContainer.removeEventListener('scroll', scrollContainer._canvasScrollHandler);
  }
  
  // Create new handler
  scrollContainer._canvasScrollHandler = () => {
    if (canvasScrollTimeout) clearTimeout(canvasScrollTimeout);
    canvasScrollTimeout = setTimeout(() => {
      drawEventConnectingLines(eventsStackLeft, timelineHeight);
    }, 50);
    
    // Also save state on scroll (debounced)
    if (saveStateTimeout) clearTimeout(saveStateTimeout);
    saveStateTimeout = setTimeout(() => {
      saveTimelineState();
    }, 300);
  };
  
  scrollContainer.addEventListener('scroll', scrollContainer._canvasScrollHandler);
}

// =====================================================
// EVENT HOVER FOCUS MODE
// =====================================================

let currentHoveredEventId = null;
let hoverFocusTimeout = null;
let lastInputWasTouch = false; // Track actual input type, not device capability
let lastTouchTime = 0; // Timestamp of last touch event

// Detect actual touch input - use timestamp to ignore synthetic mouse events after touch
document.addEventListener('touchstart', () => { 
  lastInputWasTouch = true; 
  lastTouchTime = Date.now();
}, { passive: true });

document.addEventListener('mousedown', () => { 
  // Only count as mouse if it's been >500ms since last touch
  // (synthetic mouse events fire within ~300ms of touch)
  if (Date.now() - lastTouchTime > 500) {
    lastInputWasTouch = false;
  }
}, { passive: true });

// Find all events related to a given event via durations
function findRelatedEvents(eventId) {
  const data = ResolvedEventsCache.getDataSync();
  if (!data) {
    console.log('[findRelatedEvents] No data available');
    return { events: [], durations: [] };
  }
  
  const durations = data.durations || [];
  const relatedEventIds = new Set();
  const relatedDurationIds = new Set();
  
  // Find durations that reference this event
  durations.forEach(dur => {
    if (dur.from_event === eventId || dur.to_event === eventId) {
      relatedDurationIds.add(dur.id);
      if (dur.from_event && dur.from_event !== eventId) relatedEventIds.add(dur.from_event);
      if (dur.to_event && dur.to_event !== eventId) relatedEventIds.add(dur.to_event);
    }
  });
  
  // Also check for events that derive from this one (relative dates)
  const events = data.events || [];
  events.forEach(ev => {
    const startSpec = ev.start || ev.dates;
    if (startSpec?.relative?.event === eventId) {
      relatedEventIds.add(ev.id);
    }
    // Check if this event is the derivation source
    if (ev.id === eventId && startSpec?.relative?.event) {
      relatedEventIds.add(startSpec.relative.event);
    }
  });
  
  console.log(`[findRelatedEvents] For "${eventId}": found ${relatedEventIds.size} related events, ${relatedDurationIds.size} durations`);
  if (relatedEventIds.size > 0) {
    console.log('  Related events:', Array.from(relatedEventIds));
  }
  if (relatedDurationIds.size > 0) {
    console.log('  Related durations:', Array.from(relatedDurationIds));
  }
  
  return {
    events: Array.from(relatedEventIds),
    durations: Array.from(relatedDurationIds)
  };
}

// Show tooltip with event summary
function showEventTooltip(eventId, anchorEl) {
  // Remove any existing tooltip
  hideEventTooltip();
  
  // Get event data from cache
  const event = getTimelineResolvedEvents()?.find(e => e.id === eventId);
  if (!event) return;
  
  // Format the date
  let dateStr = '';
  if (event.startJD && typeof EventResolver !== 'undefined') {
    const greg = EventResolver.julianDayToGregorian(event.startJD);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const yearStr = greg.year <= 0 ? `${1 - greg.year} BC` : `${greg.year} AD`;
    dateStr = `${monthNames[greg.month - 1]} ${greg.day}, ${yearStr}`;
  }
  
  // Get brief description (first sentence or first 100 chars)
  let briefDesc = '';
  if (event.description) {
    const firstSentence = event.description.split(/[.!?]/)[0];
    briefDesc = firstSentence.length > 120 ? firstSentence.substring(0, 117) + '...' : firstSentence;
  }
  
  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.id = 'event-hover-tooltip';
  tooltip.className = 'event-hover-tooltip';
  tooltip.innerHTML = `
    <div class="tooltip-title">${event.title || eventId}</div>
    <div class="tooltip-date">${dateStr}</div>
    ${briefDesc ? `<div class="tooltip-desc">${briefDesc}</div>` : ''}
    <a href="#" class="tooltip-link" onclick="hideEventTooltip(); openEventDetail('${eventId}'); return false;">View Details →</a>
  `;
  
  // Position tooltip inside the scroll content so it scrolls with timeline
  const scrollContent = document.getElementById('biblical-timeline-scroll');
  if (scrollContent && anchorEl) {
    // Get anchor position relative to scroll content
    const anchorRect = anchorEl.getBoundingClientRect();
    const contentRect = scrollContent.getBoundingClientRect();
    
    // Calculate position relative to scroll content (not viewport)
    const relativeTop = anchorRect.top - contentRect.top + anchorEl.offsetHeight + 8;
    const relativeLeft = anchorRect.left - contentRect.left;
    
    // Position inside the scroll content with absolute positioning
    tooltip.style.position = 'absolute';
    tooltip.style.left = `${Math.max(10, Math.min(relativeLeft, scrollContent.offsetWidth - 290))}px`;
    tooltip.style.top = `${relativeTop}px`;
    
    scrollContent.appendChild(tooltip);
  } else {
    // Fallback to body if scroll content not found
    document.body.appendChild(tooltip);
  }
}

// Hide the event tooltip
function hideEventTooltip() {
  const tooltip = document.getElementById('event-hover-tooltip');
  if (tooltip) tooltip.remove();
}

// Handle mouse enter on an event
function handleEventHoverEnter(eventId) {
  // Clear any pending timeout
  if (hoverFocusTimeout) {
    clearTimeout(hoverFocusTimeout);
    hoverFocusTimeout = null;
  }
  
  currentHoveredEventId = eventId;
  
  const wrapper = document.getElementById('biblical-timeline-scroll');
  if (!wrapper) return;
  
  // Clear previous focus classes before applying new ones
  wrapper.querySelectorAll('.event-focused').forEach(el => el.classList.remove('event-focused'));
  wrapper.querySelectorAll('.event-related').forEach(el => el.classList.remove('event-related'));
  wrapper.querySelectorAll('.duration-related').forEach(el => el.classList.remove('duration-related'));
  
  // Find related events and durations
  const related = findRelatedEvents(eventId);
  
  // Add focus mode class to wrapper
  wrapper.classList.add('timeline-focus-mode');
  
  // Mark the focused event and show tooltip
  const focusedEl = wrapper.querySelector(`[data-event-id="${eventId}"]`);
  if (focusedEl) {
    focusedEl.classList.add('event-focused');
    // Show tooltip on mobile (touch device) only
    if (lastInputWasTouch || (Date.now() - lastTouchTime < 1000)) {
      showEventTooltip(eventId, focusedEl);
    }
  }
  
  // Mark related events
  let foundRelatedEvents = 0;
  related.events.forEach(relId => {
    const relEl = wrapper.querySelector(`[data-event-id="${relId}"]`);
    if (relEl) {
      relEl.classList.add('event-related');
      foundRelatedEvents++;
    } else {
      console.log(`[handleEventHoverEnter] Related event NOT in DOM: "${relId}"`);
    }
  });
  
  // Mark related duration bars
  let foundRelatedDurations = 0;
  related.durations.forEach(durId => {
    const durEl = wrapper.querySelector(`[data-duration-id="${durId}"]`);
    if (durEl) {
      durEl.classList.add('duration-related');
      foundRelatedDurations++;
    } else {
      console.log(`[handleEventHoverEnter] Related duration NOT in DOM: "${durId}"`);
    }
  });
  
  console.log(`[handleEventHoverEnter] Highlighted ${foundRelatedEvents}/${related.events.length} events, ${foundRelatedDurations}/${related.durations.length} durations`);
  
  // Redraw connecting lines with highlight
  redrawLinesWithHighlight(eventId, related.events);
}

// Handle mouse leave on an event
// Focus is now "sticky" - it persists until user hovers a new event or clicks elsewhere
function handleEventHoverLeave() {
  // Do nothing - focus remains until user hovers a different event or clicks away
  // This reduces visual clutter by keeping focus locked
}

// Clear all focus mode styling
function clearEventHoverFocus() {
  currentHoveredEventId = null;
  
  // Hide tooltip
  hideEventTooltip();
  
  const wrapper = document.getElementById('biblical-timeline-scroll');
  if (!wrapper) return;
  
  // Remove focus mode
  wrapper.classList.remove('timeline-focus-mode');
  
  // Remove all focused/related classes
  wrapper.querySelectorAll('.event-focused').forEach(el => el.classList.remove('event-focused'));
  wrapper.querySelectorAll('.event-related').forEach(el => el.classList.remove('event-related'));
  wrapper.querySelectorAll('.duration-related').forEach(el => el.classList.remove('duration-related'));
  
  // Redraw lines normally
  const layout = window._timelineLayout || { axisLineLeft: 35, eventsStackLeft: 100 };
  const timelineHeight = wrapper.offsetHeight;
  drawEventConnectingLines(layout.eventsStackLeft, timelineHeight);
}

// Redraw connecting lines with specific events highlighted
function redrawLinesWithHighlight(focusedEventId, relatedEventIds) {
  const scrollContainer = document.getElementById('timeline-scroll-container');
  const wrapper = document.getElementById('biblical-timeline-scroll');
  if (!wrapper || !scrollContainer) return;
  
  // Remove existing canvas
  const existingCanvas = wrapper.querySelector('.event-lines-canvas');
  if (existingCanvas) existingCanvas.remove();
  
  const stackedEvents = document.querySelectorAll('.stacked-event');
  if (stackedEvents.length === 0) return;
  
  const viewportHeight = scrollContainer.clientHeight;
  const scrollTop = scrollContainer.scrollTop;
  const viewportBottom = scrollTop + viewportHeight;
  const timelineHeight = wrapper.offsetHeight;
  
  const canvasHeight = Math.min(viewportHeight + 200, timelineHeight);
  const canvasTop = Math.max(0, scrollTop - 100);
  
  const canvas = document.createElement('canvas');
  canvas.className = 'event-lines-canvas';
  
  const layout = window._timelineLayout || { axisLineLeft: 35, eventsStackLeft: 100 };
  const canvasLeft = layout.axisLineLeft + 2;
  const canvasWidth = layout.eventsStackLeft - canvasLeft + 50;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.cssText = `
    position: absolute;
    left: ${canvasLeft}px;
    top: ${canvasTop}px;
    width: ${canvasWidth}px;
    height: ${canvasHeight}px;
    pointer-events: none;
    z-index: 1;
    background-color: transparent;
  `;
  
  wrapper.appendChild(canvas);
  
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const timelineX = 0;
  
  const highlightedIds = new Set([focusedEventId, ...relatedEventIds]);
  
  // Draw non-highlighted lines first (very faint)
  stackedEvents.forEach(eventEl => {
    const eventId = eventEl.dataset.eventId;
    if (highlightedIds.has(eventId)) return; // Skip, will draw later
    
    const timelinePos = parseFloat(eventEl.dataset.eventTimelinePos);
    const displayPos = parseFloat(eventEl.dataset.eventDisplayPos);
    const eventLeft = parseFloat(eventEl.dataset.eventLeft) || layout.eventsStackLeft;
    
    if (isNaN(timelinePos) || isNaN(displayPos)) return;
    
    const minPos = Math.min(timelinePos, displayPos);
    const maxPos = Math.max(timelinePos, displayPos);
    if (maxPos < scrollTop - 100 || minPos > viewportBottom + 100) return;
    
    const adjustedTimelinePos = timelinePos - canvasTop;
    const adjustedDisplayPos = displayPos - canvasTop;
    const eventX = eventLeft - canvasLeft;
    
    ctx.strokeStyle = 'rgba(126, 200, 227, 0.15)';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    
    ctx.beginPath();
    ctx.moveTo(timelineX, adjustedTimelinePos);
    ctx.bezierCurveTo(
      eventX * 0.3, adjustedTimelinePos,
      eventX * 0.7, adjustedDisplayPos,
      eventX, adjustedDisplayPos
    );
    ctx.stroke();
  });
  
  // Draw highlighted lines on top (bright)
  stackedEvents.forEach(eventEl => {
    const eventId = eventEl.dataset.eventId;
    if (!highlightedIds.has(eventId)) return;
    
    const timelinePos = parseFloat(eventEl.dataset.eventTimelinePos);
    const displayPos = parseFloat(eventEl.dataset.eventDisplayPos);
    const eventLeft = parseFloat(eventEl.dataset.eventLeft) || layout.eventsStackLeft;
    const color = eventEl.dataset.eventColor || 'rgba(126, 200, 227, 0.5)';
    
    if (isNaN(timelinePos) || isNaN(displayPos)) return;
    
    const minPos = Math.min(timelinePos, displayPos);
    const maxPos = Math.max(timelinePos, displayPos);
    if (maxPos < scrollTop - 100 || minPos > viewportBottom + 100) return;
    
    const adjustedTimelinePos = timelinePos - canvasTop;
    const adjustedDisplayPos = displayPos - canvasTop;
    const eventX = eventLeft - canvasLeft;
    
    // Use different style for focused vs related
    const isFocused = eventId === focusedEventId;
    ctx.strokeStyle = isFocused ? '#7ec8e3' : '#d4a017';
    ctx.lineWidth = isFocused ? 3 : 2;
    ctx.globalAlpha = 1;
    
    ctx.beginPath();
    ctx.moveTo(timelineX, adjustedTimelinePos);
    ctx.bezierCurveTo(
      eventX * 0.3, adjustedTimelinePos,
      eventX * 0.7, adjustedDisplayPos,
      eventX, adjustedDisplayPos
    );
    ctx.stroke();
    
    // Add glow effect for focused event
    if (isFocused) {
      ctx.strokeStyle = 'rgba(126, 200, 227, 0.3)';
      ctx.lineWidth = 6;
      ctx.stroke();
    }
  });
  
  ctx.globalAlpha = 1.0;
}

// Track if touch was handled (to prevent click from also firing)
let touchHandledForEvent = null;

// Handle touch end on event - implements tap-to-focus, tap-again-to-open
function handleEventTouchEnd(eventId, evt) {
  console.log(`[handleEventTouchEnd] eventId=${eventId}, currentHoveredEventId=${currentHoveredEventId}`);
  
  // Mark that we handled this touch (so click can be ignored)
  touchHandledForEvent = eventId;
  
  // Prevent default to stop the synthetic click
  evt.preventDefault();
  
  if (currentHoveredEventId === eventId) {
    // Already focused - open the detail (hide tooltip first)
    console.log('[handleEventTouchEnd] Already focused, opening detail');
    hideEventTooltip();
    openEventDetail(eventId);
  } else {
    // Not focused - focus this event (will show tooltip)
    console.log('[handleEventTouchEnd] Focusing event');
    handleEventHoverEnter(eventId);
  }
}

// Handle event click - for mouse only (touch handled by touchend)
function handleEventClick(eventId, evt) {
  console.log(`[handleEventClick] eventId=${eventId}, touchHandledForEvent=${touchHandledForEvent}`);
  
  // If touch already handled this, ignore the click
  if (touchHandledForEvent === eventId) {
    console.log('[handleEventClick] Ignoring - already handled by touch');
    touchHandledForEvent = null;
    evt.preventDefault();
    return;
  }
  touchHandledForEvent = null;
  
  // Mouse click: always open directly
  console.log('[handleEventClick] Mouse: opening detail directly');
  openEventDetail(eventId);
}

// Make hover and click functions globally available
window.handleEventClick = handleEventClick;
window.handleEventTouchEnd = handleEventTouchEnd;
window.handleEventHoverEnter = handleEventHoverEnter;
window.handleEventHoverLeave = handleEventHoverLeave;
window.clearEventHoverFocus = clearEventHoverFocus;

// Global drag state
let timelineDragState = {
  isDragging: false,
  startY: 0,
  startScrollTop: 0,
  documentHandlersAdded: false
};

function setupTimelineDragHandlers() {
  const scrollContainer = document.getElementById('timeline-scroll-container');
  if (!scrollContainer) return;
  
  // Only set up document-level handlers once
  if (!timelineDragState.documentHandlersAdded) {
    timelineDragState.documentHandlersAdded = true;
    
    document.addEventListener('mousemove', (e) => {
      if (!timelineDragState.isDragging) return;
      const sc = document.getElementById('timeline-scroll-container');
      if (!sc) return;
      const deltaY = e.clientY - timelineDragState.startY;
      sc.scrollTop = timelineDragState.startScrollTop - deltaY;
    });
    
    document.addEventListener('mouseup', () => {
      if (timelineDragState.isDragging) {
        timelineDragState.isDragging = false;
        const sc = document.getElementById('timeline-scroll-container');
        if (sc) sc.style.cursor = 'grab';
        // Save state after drag ends
        saveTimelineState();
      }
    });
  }
  
  // Set cursor
  scrollContainer.style.cursor = 'grab';
  
  // Use event delegation for mousedown on the container
  scrollContainer.onmousedown = (e) => {
    if (e.target.closest('.stacked-event') || e.target.closest('.duration-event-bar')) return;
    timelineDragState.isDragging = true;
    timelineDragState.startY = e.clientY;
    timelineDragState.startScrollTop = scrollContainer.scrollTop;
    scrollContainer.style.cursor = 'grabbing';
    e.preventDefault();
  };
  
  // Click handler to clear focus when clicking empty space (not on events or durations)
  scrollContainer.onclick = (e) => {
    // If click is on a stacked event or duration bar, don't clear focus
    // (the event's own onclick or the hover will handle it)
    if (e.target.closest('.stacked-event') || e.target.closest('.duration-event-bar')) return;
    
    // Clear focus mode when clicking empty timeline space
    clearEventHoverFocus();
  };
  
  // Touch support
  scrollContainer.ontouchstart = (e) => {
    if (e.target.closest('.stacked-event') || e.target.closest('.duration-event-bar')) return;
    timelineDragState.isDragging = true;
    timelineDragState.startY = e.touches[0].clientY;
    timelineDragState.startScrollTop = scrollContainer.scrollTop;
  };
  
  scrollContainer.ontouchmove = (e) => {
    if (!timelineDragState.isDragging) return;
    const deltaY = e.touches[0].clientY - timelineDragState.startY;
    scrollContainer.scrollTop = timelineDragState.startScrollTop - deltaY;
  };
  
  scrollContainer.ontouchend = () => {
    timelineDragState.isDragging = false;
  };
  
  // Mouse wheel - zoom with ctrl/cmd, centered on mouse position
  scrollContainer.onwheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.5 : (1 / 1.5);
      zoomTimelineAtPoint(zoomFactor, e.clientY, scrollContainer);
    }
  };
}

// Zoom functions - dynamic zoom up to day-level detail
function biblicalTimelineZoomIn() {
  zoomTimelineWithCenter(1.5);
}

function biblicalTimelineZoomOut() {
  zoomTimelineWithCenter(1 / 1.5);
}

function zoomTimelineWithCenter(zoomFactor) {
  const scrollContainer = document.getElementById('timeline-scroll-container');
  const scrollContent = document.getElementById('biblical-timeline-scroll');
  
  if (!scrollContainer || !scrollContent) {
    // Fallback if elements not found
    biblicalTimelineZoom = Math.max(0.1, Math.min(500, (biblicalTimelineZoom || 1.0) * zoomFactor));
    renderBiblicalTimeline();
    return;
  }
  
  // Get current scroll state
  const oldScrollTop = scrollContainer.scrollTop;
  const viewportHeight = scrollContainer.clientHeight;
  const oldContentHeight = scrollContent.clientHeight;
  
  // Guard against invalid content height
  if (!oldContentHeight || oldContentHeight <= 0) {
    console.warn('[Zoom] Invalid content height, skipping zoom');
    return;
  }
  
  // Calculate center year instead of ratio to avoid precision issues at extreme zoom
  const centerYear = getTimelineCenterYear();
  
  // Apply zoom - limit to 500 to avoid browser rendering issues with multi-million pixel heights
  const oldZoom = biblicalTimelineZoom || 1.0;
  biblicalTimelineZoom = Math.max(0.1, Math.min(500, oldZoom * zoomFactor));
  
  // If zoom didn't change, don't re-render
  if (biblicalTimelineZoom === oldZoom) return;
  
  // Re-render the timeline
  renderBiblicalTimeline();
  
  // After render, restore scroll position to keep center year visible
  requestAnimationFrame(() => {
    if (centerYear !== null) {
      scrollToTimelineYear(centerYear);
    }
    // Save state after zoom
    saveTimelineState();
  });
}

function zoomTimelineAtPoint(zoomFactor, clientY, container) {
  const scrollContent = document.getElementById('biblical-timeline-scroll');
  
  if (!container || !scrollContent) {
    zoomTimelineWithCenter(zoomFactor);
    return;
  }
  
  // Get current scroll state
  const oldScrollTop = container.scrollTop;
  const containerRect = container.getBoundingClientRect();
  const oldContentHeight = scrollContent.clientHeight;
  
  // Guard against invalid content height
  if (!oldContentHeight || oldContentHeight <= 0) {
    console.warn('[Zoom] Invalid content height, skipping zoom');
    return;
  }
  
  // Calculate where the mouse is pointing in terms of year
  // This is more stable than pixel ratios at extreme zoom levels
  const mouseOffsetInViewport = clientY - containerRect.top;
  const mouseOffsetInContent = oldScrollTop + mouseOffsetInViewport;
  
  // Convert mouse position to year
  const yearRange = (biblicalTimelineMaxYear || 3500) - (biblicalTimelineMinYear || -4050);
  const mouseYear = (biblicalTimelineMinYear || -4050) + (mouseOffsetInContent / oldContentHeight) * yearRange;
  
  // Apply zoom - limit to 500 to avoid browser rendering issues with multi-million pixel heights
  const oldZoom = biblicalTimelineZoom || 1.0;
  biblicalTimelineZoom = Math.max(0.1, Math.min(500, oldZoom * zoomFactor));
  
  // If zoom didn't change, don't re-render
  if (biblicalTimelineZoom === oldZoom) return;
  
  // Re-render the timeline
  renderBiblicalTimeline();
  
  // After render, restore scroll position to keep mouse point stationary
  requestAnimationFrame(() => {
    const newScrollContainer = document.getElementById('timeline-scroll-container');
    const newScrollContent = document.getElementById('biblical-timeline-scroll');
    if (newScrollContainer && newScrollContent) {
      const newContentHeight = newScrollContent.clientHeight;
      
      // Convert year back to pixel position in new timeline
      const newMouseOffsetInContent = ((mouseYear - (biblicalTimelineMinYear || -4050)) / yearRange) * newContentHeight;
      const newScrollTop = newMouseOffsetInContent - mouseOffsetInViewport;
      
      // Clamp scroll position to valid range
      const maxScroll = newContentHeight - newScrollContainer.clientHeight;
      newScrollContainer.scrollTop = Math.max(0, Math.min(newScrollTop, maxScroll));
      
      // Save state after zoom
      saveTimelineState();
    }
  });
}

function biblicalTimelineResetZoom() {
  // Reset to zoom 1.0 (fits all years in viewport)
  biblicalTimelineZoom = 1.0;
  biblicalTimelinePan = 0;
  renderBiblicalTimeline();
  // Save reset state
  requestAnimationFrame(() => saveTimelineState());
}

// Filter timeline (called on filter change)
function filterBiblicalTimeline() {
  renderBiblicalTimeline();
}

// Initialize biblical timeline page
function initBiblicalTimelinePage() {
  // Update profile name display
  const profileNameEl = document.getElementById('biblical-timeline-profile-name');
  if (profileNameEl && typeof getCurrentProfileName === 'function') {
    profileNameEl.textContent = getCurrentProfileName();
  }
  
  // Priority 1: Check URL state for zoom and center year (via AppStore)
  let zoomFromURL = null;
  let centerYearFromURL = null;
  if (typeof AppStore !== 'undefined') {
    const state = AppStore.getState();
    if (state?.ui?.timelineZoom) {
      zoomFromURL = state.ui.timelineZoom;
    }
    if (state?.ui?.timelineCenterYear) {
      centerYearFromURL = state.ui.timelineCenterYear;
    }
  }
  
  // Priority 2: Restore saved state from localStorage
  const savedState = loadTimelineState();
  
  if (zoomFromURL !== null) {
    // Use zoom from URL (clamped to valid range)
    biblicalTimelineZoom = Math.max(0.1, Math.min(500, zoomFromURL));
  } else if (savedState) {
    // Use saved zoom (clamped to valid range)
    biblicalTimelineZoom = Math.max(0.1, Math.min(500, savedState.zoom || 1.0));
  }
  
  // Render timeline
  renderBiblicalTimeline();
  
  // Restore scroll position after render
  requestAnimationFrame(() => {
    if (centerYearFromURL !== null) {
      // Priority 1: Use center year from URL
      scrollToTimelineYear(centerYearFromURL);
    } else if (savedState && savedState.centerYear) {
      // Priority 2: Use center year from localStorage
      scrollToTimelineYear(savedState.centerYear);
    } else if (savedState && savedState.scrollTop) {
      // Priority 3: Fall back to raw scroll position
      const scrollContainer = document.getElementById('timeline-scroll-container');
      if (scrollContainer) {
        scrollContainer.scrollTop = savedState.scrollTop;
      }
    }
  });
}

// Clear the resolved events cache (call when profile changes)
function invalidateBiblicalTimelineCache() {
  invalidateBiblicalTimelineCacheInternal();
}

// Cleanup on page hide
function cleanupBiblicalTimeline() {
  // Clear event lookup
  biblicalTimelineEventLookup.clear();
  // Clear resolved events cache
  invalidateBiblicalTimelineCache();
  // Reset drag state
  if (typeof timelineDragState !== 'undefined') {
    timelineDragState.isDragging = false;
    timelineDragState.initialized = false;
  }
  // Reset zoom/pan to initial state
  biblicalTimelineZoom = null; // Will auto-calculate on next render
  biblicalTimelinePan = 0;
}

/**
 * Test function to verify async resolver produces same results as sync resolver.
 * Call from browser console: testAsyncResolver()
 */
async function testAsyncResolver() {
  console.log('=== Testing Async vs Sync Resolver ===');
  
  const data = await loadBiblicalTimelineData();
  if (!data) {
    console.error('Failed to load timeline data');
    return { success: false, error: 'Failed to load data' };
  }
  
  const profile = getTimelineProfile();
  console.log('Profile:', profile);
  console.log('Events to resolve:', data.events?.length || 0);
  
  // Clear cache to force fresh resolution
  ResolvedEventsCache.invalidate();
  
  // Run sync version
  console.time('Sync resolution');
  const syncResult = EventResolver.resolveAllEvents(data, profile);
  console.timeEnd('Sync resolution');
  console.log('Sync result count:', syncResult.length);
  
  // Clear cache again
  ResolvedEventsCache.invalidate();
  
  // Run async version
  let progressUpdates = 0;
  console.time('Async resolution');
  const asyncResult = await EventResolver.resolveAllEventsAsync(data, profile, (percent, msg) => {
    progressUpdates++;
  });
  console.timeEnd('Async resolution');
  console.log('Async result count:', asyncResult.length);
  console.log('Progress updates received:', progressUpdates);
  
  // Compare results
  const errors = [];
  
  if (syncResult.length !== asyncResult.length) {
    errors.push(`Length mismatch: sync=${syncResult.length}, async=${asyncResult.length}`);
  }
  
  // Compare each event
  const maxCheck = Math.min(syncResult.length, asyncResult.length);
  for (let i = 0; i < maxCheck; i++) {
    const s = syncResult[i];
    const a = asyncResult[i];
    
    if (s.id !== a.id) {
      errors.push(`Event ${i}: ID mismatch - sync=${s.id}, async=${a.id}`);
    }
    if (s.startJD !== a.startJD) {
      errors.push(`Event ${s.id}: startJD mismatch - sync=${s.startJD}, async=${a.startJD}`);
    }
    if (s.endJD !== a.endJD) {
      errors.push(`Event ${s.id}: endJD mismatch - sync=${s.endJD}, async=${a.endJD}`);
    }
    if (s.title !== a.title) {
      errors.push(`Event ${s.id}: title mismatch`);
    }
  }
  
  // Report results
  if (errors.length === 0) {
    console.log('%c✓ PASS: Async and sync resolvers produce identical results!', 'color: green; font-weight: bold');
    return { success: true, syncCount: syncResult.length, asyncCount: asyncResult.length, progressUpdates };
  } else {
    console.error('%c✗ FAIL: Differences found:', 'color: red; font-weight: bold');
    errors.slice(0, 20).forEach(e => console.error('  -', e));
    if (errors.length > 20) {
      console.error(`  ... and ${errors.length - 20} more errors`);
    }
    return { success: false, errors, syncCount: syncResult.length, asyncCount: asyncResult.length };
  }
}

// Export for use in navigation
if (typeof window !== 'undefined') {
  window.renderBiblicalTimeline = renderBiblicalTimeline;
  window.filterBiblicalTimeline = filterBiblicalTimeline;
  window.initBiblicalTimelinePage = initBiblicalTimelinePage;
  window.cleanupBiblicalTimeline = cleanupBiblicalTimeline;
  window.invalidateBiblicalTimelineCache = invalidateBiblicalTimelineCache;
  window.biblicalTimelineZoomIn = biblicalTimelineZoomIn;
  window.biblicalTimelineZoomOut = biblicalTimelineZoomOut;
  window.biblicalTimelineResetZoom = biblicalTimelineResetZoom;
  window.testAsyncResolver = testAsyncResolver;
}

// ============================================================================
// PROFILE CHANGE HANDLING
// When profile changes, we need to re-resolve events and rebuild indices
// ============================================================================

let _lastProfileHash = null;

/**
 * Handle profile change - clear RAM cache and trigger re-resolution
 * This ensures events are resolved with the correct calendar settings
 */
async function handleProfileChange(newProfile) {
  const newHash = ResolvedEventsCache.profileKey(newProfile);
  
  // Skip if profile hash hasn't actually changed
  if (_lastProfileHash === newHash) {
    console.log('[ProfileChange] Profile hash unchanged, skipping re-resolution');
    return;
  }
  
  console.log(`[ProfileChange] Profile changed: ${_lastProfileHash} -> ${newHash}`);
  _lastProfileHash = newHash;
  
  // Clear RAM cache to force re-resolution
  ResolvedEventsCache.invalidate();
  
  // Trigger background re-resolution with the new profile
  // This will either load from localStorage cache (if exists for this profile)
  // or resolve fresh and save to localStorage
  if (typeof preResolveTimelineInBackground === 'function') {
    console.log('[ProfileChange] Starting re-resolution for new profile...');
    await preResolveTimelineInBackground(null, newProfile);
    
    // Rebuild bible events index after resolution
    if (typeof loadBibleEvents === 'function') {
      console.log('[ProfileChange] Rebuilding bible events index...');
      await loadBibleEvents();
    }
    
    // Dispatch refresh to update any visible views
    if (typeof AppStore !== 'undefined') {
      AppStore.dispatch({ type: 'REFRESH' });
    }
    
    console.log('[ProfileChange] Profile change handling complete');
  }
}

/**
 * Subscribe to AppStore to detect profile changes
 * Called once when the module loads
 */
function subscribeToProfileChanges() {
  if (typeof AppStore === 'undefined') {
    console.log('[ProfileChange] AppStore not available, retrying...');
    setTimeout(subscribeToProfileChanges, 100);
    return;
  }
  
  // Get initial profile hash
  const state = AppStore.getState();
  const profileId = state.context?.profileId || 'timeTested';
  const profiles = window.PROFILES || window.PRESET_PROFILES || {};
  const profile = profiles[profileId];
  if (profile) {
    _lastProfileHash = ResolvedEventsCache.profileKey(profile);
    console.log('[ProfileChange] Initial profile hash:', _lastProfileHash);
  }
  
  // Subscribe to state changes
  AppStore.subscribe((state, derived) => {
    // Get current profile
    const profileId = state.context?.profileId || 'timeTested';
    const profiles = window.PROFILES || window.PRESET_PROFILES || {};
    const profile = profiles[profileId];
    
    if (profile) {
      const newHash = ResolvedEventsCache.profileKey(profile);
      if (_lastProfileHash !== newHash) {
        // Profile changed - handle async
        handleProfileChange(profile);
      }
    }
  });
  
  console.log('[ProfileChange] Subscribed to AppStore for profile changes');
}

// Start listening for profile changes once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', subscribeToProfileChanges);
} else {
  // DOM already ready - wait a tick for AppStore to initialize
  setTimeout(subscribeToProfileChanges, 50);
}

// Export profile change handler
window.handleProfileChange = handleProfileChange;
