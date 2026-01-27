// Biblical Timeline Module
// Renders timeline using EventResolver for profile-aware date calculations
// Version: 11.0 - Uses EventResolver with v2 schema

let biblicalTimelineData = null;
let biblicalTimelineDataV2 = null;
let biblicalTimelineEventLookup = new Map();
let biblicalTimelineZoom = null;
let biblicalTimelinePan = 0;
let biblicalTimelineMinYear = null;
let biblicalTimelineMaxYear = null;
let biblicalTimelineUseV2 = true; // Use v2 data format with resolver

// Cache for resolved events - only recalculate when profile changes
let biblicalTimelineResolvedCache = null;
let biblicalTimelineCacheKey = null;

// LocalStorage keys for persisting state
const TIMELINE_STORAGE_KEY = 'biblicalTimelineState';

// Save timeline state to localStorage
function saveTimelineState() {
  const scrollContainer = document.getElementById('timeline-scroll-container');
  const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
  const state = {
    zoom: biblicalTimelineZoom,
    scrollTop: scrollTop
  };
  try {
    localStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // localStorage might be unavailable
  }
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

// Load and prepare timeline data
async function loadBiblicalTimelineData() {
  // Try v2 format first
  if (biblicalTimelineUseV2) {
    if (biblicalTimelineDataV2) return biblicalTimelineDataV2;
    
    try {
      const response = await fetch('/historical-events-v2.json');
      if (response.ok) {
        biblicalTimelineDataV2 = await response.json();
        return biblicalTimelineDataV2;
      }
    } catch (error) {
      console.warn('Failed to load v2 events, falling back to v1:', error);
    }
  }
  
  // Fallback to v1 format
  if (biblicalTimelineData) return biblicalTimelineData;
  
  try {
    const response = await fetch('/historical-events.json');
    biblicalTimelineData = await response.json();
    biblicalTimelineUseV2 = false;
    return biblicalTimelineData;
  } catch (error) {
    console.error('Failed to load historical events:', error);
    return null;
  }
}

// Get current calendar profile for event resolution
function getTimelineProfile() {
  // Read from actual calendar state variables
  if (typeof state !== 'undefined') {
    // Map calendar state to resolver profile format
    const moonPhaseToMonthStart = {
      'dark': 'conjunction',
      'crescent': 'crescent',
      'full': 'full'
    };
    const dayStartTimeToResolver = {
      'evening': 'sunset',
      'morning': 'sunrise'
    };
    const yearStartRuleToResolver = {
      'equinox': 'spring-equinox',
      '13daysBefore': 'spring-equinox',
      'virgoFeet': 'spring-equinox',
      'barley': 'barley'
    };
    
    return {
      monthStart: moonPhaseToMonthStart[state.moonPhase] || 'conjunction',
      dayStart: dayStartTimeToResolver[state.dayStartTime] || 'sunset',
      yearStart: yearStartRuleToResolver[state.yearStartRule] || 'spring-equinox',
      amEpoch: -4000
    };
  }
  return EventResolver.DEFAULT_PROFILE;
}

// Filter events based on current filter settings
function getFilteredTimelineEvents(events) {
  const typeFilter = document.getElementById('biblical-timeline-type-filter')?.value || 'all';
  const eraFilter = document.getElementById('biblical-timeline-era-filter')?.value || 'all';
  const searchText = (document.getElementById('biblical-timeline-search')?.value || '').toLowerCase().trim();
  
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

// Filter resolved events (for v2 format)
function filterResolvedEvents(events, data) {
  const typeFilter = document.getElementById('biblical-timeline-type-filter')?.value || 'all';
  const searchText = (document.getElementById('biblical-timeline-search')?.value || '').toLowerCase().trim();
  
  return events.filter(event => {
    // Skip events with no valid dates
    if (event.startJD === null) return false;
    
    // Type filter
    if (typeFilter !== 'all' && event.type !== typeFilter) {
      return false;
    }
    
    // Search filter
    if (searchText) {
      const searchableText = [
        event.title,
        ...(event.tags || [])
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(searchText)) {
        return false;
      }
    }
    
    return true;
  });
}

// Legacy event normalization (for v1 format fallback)
function normalizeEventsLegacy(events) {
  const normalized = [];
  
  events.forEach(event => {
    const startDate = getEventTimelineDate(event);
    if (!startDate) return;
    
    const startJD = EventResolver.gregorianToJulianDay(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth() + 1,
      startDate.getUTCDate()
    );
    
    let endJD = null;
    const endDate = getEventEndDate(event);
    if (endDate) {
      endJD = EventResolver.gregorianToJulianDay(
        endDate.getUTCFullYear(),
        endDate.getUTCMonth() + 1,
        endDate.getUTCDate()
      );
    }
    
    normalized.push({
      id: event.id,
      title: event.title,
      type: event.type,
      startJD,
      endJD,
      tags: event.tags,
      certainty: event.certainty,
      _original: event
    });
    
    // Handle durations array
    if (event.durations) {
      event.durations.forEach((dur, idx) => {
        if (dur.years) {
          const prophEndJD = startJD + (dur.years * 365.2422);
          normalized.push({
            id: `${event.id}-duration-${idx}`,
            title: `${dur.years} Years (${dur.prophecy || event.title})`,
            type: 'prophecy-duration',
            startJD,
            endJD: prophEndJD,
            _parentEvent: event.id
          });
        }
      });
    }
  });
  
  return normalized;
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
      const monthNames = ['Nisan', 'Iyyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 'Tishri', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar'];
      if (event.dates.lunar.month) {
        title += `\nLunar: ${monthNames[event.dates.lunar.month - 1]}`;
        if (event.dates.lunar.day) {
          title += ` ${event.dates.lunar.day}`;
        }
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

// Render ruler-style timeline with events stacked on right, connected by lines
async function renderBiblicalTimeline() {
  const container = document.getElementById('biblical-timeline-vis-container');
  if (!container) return;
  
  const data = await loadBiblicalTimelineData();
  if (!data) {
    container.innerHTML = '<div class="biblical-timeline-error">Failed to load events.</div>';
    return;
  }
  
  // Get calendar profile for resolution
  const profile = getTimelineProfile();
  
  // Create cache key from profile settings AND data content hash
  // Use JSON string length as a simple content hash - changes when any event changes
  const dataContentHash = JSON.stringify(data.events || []).length;
  const cacheKey = JSON.stringify(profile) + ':' + dataContentHash;
  
  // Use cached resolved events if profile and data haven't changed
  let resolvedEvents;
  if (biblicalTimelineResolvedCache && biblicalTimelineCacheKey === cacheKey) {
    // Use cached results
    resolvedEvents = biblicalTimelineResolvedCache;
  } else if (biblicalTimelineUseV2 && typeof EventResolver !== 'undefined' && data.meta?.version === '2.0') {
    // Resolve events and cache
    resolvedEvents = EventResolver.resolveAllEvents(data, profile);
    // Cache the results
    biblicalTimelineResolvedCache = resolvedEvents;
    biblicalTimelineCacheKey = cacheKey;
  } else {
    // Fallback: use old normalization for v1 data
    biblicalTimelineUseV2 = false;
    resolvedEvents = normalizeEventsLegacy(data.events || []);
    biblicalTimelineResolvedCache = resolvedEvents;
    biblicalTimelineCacheKey = cacheKey;
  }
  
  // Filter events (apply search/type/era filters) - apply fresh each time
  resolvedEvents = filterResolvedEvents([...resolvedEvents], data);
  
  if (resolvedEvents.length === 0) {
    container.innerHTML = '<div class="biblical-timeline-no-results">No events match your filters.</div>';
    return;
  }
  
  // Separate point events and duration events (use Math.abs for negative durations)
  const pointEvents = resolvedEvents.filter(e => !e.endJD || Math.abs(e.endJD - e.startJD) < 30);
  const durationEvents = resolvedEvents.filter(e => e.endJD && Math.abs(e.endJD - e.startJD) >= 30);
  
  // Sort by start date
  const allEvents = [...pointEvents, ...durationEvents]
    .filter(e => e.startJD !== null)
    .sort((a, b) => a.startJD - b.startJD);
  
  // Timeline range: 1500 BC to 2100 AD
  const minYear = -1500;
  const maxYear = 2100;
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
  
  // Calculate pixelPerYear to fit the full range in the available space
  // Base timeline is 3x the viewport height at minimum zoom, so there's always something to scroll
  // At zoom 1.0, the timeline is 3x the container height
  const minTimelineHeight = availableHeight * 3;
  const basePixelPerYear = minTimelineHeight / yearRange;
  
  // Initialize zoom if not set
  if (biblicalTimelineZoom === null) {
    biblicalTimelineZoom = 1.0;
  }
  
  // Apply zoom - zoom 1.0 is the base (3x viewport), higher zoom shows more detail
  const pixelPerYear = basePixelPerYear * biblicalTimelineZoom;
  const timelineHeight = minTimelineHeight * biblicalTimelineZoom;
  
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
  
  const isMajorEvent = (event) => {
    const majorTypes = ['milestone', 'biblical-event'];
    const majorTags = ['prophecy', 'resurrection', 'crucifixion', 'creation', 'flood', 'exodus'];
    
    // Check event type
    if (majorTypes.includes(event.type)) return true;
    
    // Check tags for major themes
    if (event.tags && event.tags.some(tag => majorTags.includes(tag))) return true;
    
    // Important deaths/births
    if (event.type === 'death' && event.tags && event.tags.includes('jesus')) return true;
    if (event.type === 'birth' && event.tags && (event.tags.includes('jesus') || event.tags.includes('david'))) return true;
    
    return false;
  };
  
  // Helper to check if event has duration (use Math.abs for negative durations)
  const hasDuration = (e) => e.endJD && Math.abs(e.endJD - e.startJD) >= 30;
  
  // Filter events by zoom level
  // Duration events are ALWAYS included (they render as bars, not clustered labels)
  let eventsToShow = allEvents;
  if (pixelPerYear < 5) {
    // Very zoomed out (< 5 px/year) - only major milestones + duration events
    eventsToShow = allEvents.filter(e => isMajorEvent(e) || hasDuration(e));
  } else if (pixelPerYear < 20) {
    // Medium zoom (5-20 px/year) - major events + high-certainty biblical events + duration events
    eventsToShow = allEvents.filter(e => {
      if (isMajorEvent(e)) return true;
      if (hasDuration(e)) return true;
      if (e.type === 'biblical-event' && e.certainty === 'high') return true;
      return false;
    });
  }
  // Fully zoomed in (>= 20 px/year) - show all events
  
  // Event Clustering: Group events based on available vertical space
  // Each event label is ~32px tall + 8px spacing = 40px slot
  // Calculate how many years fit in one event slot
  const eventHeight = 40; // Height of event label + spacing
  const yearsPerSlot = eventHeight / pixelPerYear; // How many years fit in one event slot
  
  const getOverarchingEvent = (events) => {
    // Priority: milestone > biblical-event > death > birth > feast > other
    const typePriority = { 'milestone': 1, 'biblical-event': 2, 'death': 3, 'birth': 4, 'feast': 5 };
    
    // Sort by priority and pick the first
    return events.sort((a, b) => {
      const aPriority = typePriority[a.type] || 10;
      const bPriority = typePriority[b.type] || 10;
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      // Prefer events with more tags (more significant)
      const aTags = a.tags?.length || 0;
      const bTags = b.tags?.length || 0;
      return bTags - aTags;
    })[0];
  };
  
  // Cluster POINT events that fall within the same slot
  // Duration events are NOT clustered - they render as bars, not labels
  if (yearsPerSlot > 1) {
    // Separate duration events (keep all) from point events (cluster)
    const durationEventsToKeep = eventsToShow.filter(e => hasDuration(e));
    const pointEventsToCluster = eventsToShow.filter(e => !hasDuration(e));
    
    // Cluster only point events by slot
    const eventsBySlot = new Map();
    
    // Helper to get year from JD (simplified)
    const jdToYear = (jd) => {
      // Approximate: JD 0 = Jan 1, 4713 BC, ~365.25 days/year
      return Math.floor((jd - 1721425.5) / 365.25);
    };
    
    pointEventsToCluster.forEach(event => {
      if (event.startJD === null) return;
      
      const eventYear = jdToYear(event.startJD);
      const slotIndex = Math.floor((eventYear - minYear) / yearsPerSlot);
      
      if (!eventsBySlot.has(slotIndex)) {
        eventsBySlot.set(slotIndex, []);
      }
      eventsBySlot.get(slotIndex).push(event);
    });
    
    // Pick overarching event from each slot for point events
    const clusteredPointEvents = [];
    eventsBySlot.forEach((slotEvents, slot) => {
      if (slotEvents.length === 1) {
        clusteredPointEvents.push(slotEvents[0]);
      } else {
        const overarching = getOverarchingEvent([...slotEvents]); // Clone to avoid mutation
        overarching._clusterCount = slotEvents.length;
        clusteredPointEvents.push(overarching);
      }
    });
    
    // Combine: all duration events + clustered point events
    eventsToShow = [...durationEventsToKeep, ...clusteredPointEvents];
  }
  // When yearsPerSlot <= 1, we have enough space for all events
  
  // Build HTML
  let html = '<div class="timeline-controls">';
  html += '<button class="timeline-zoom-btn" onclick="biblicalTimelineZoomIn()" title="Zoom In">+</button>';
  html += '<button class="timeline-zoom-btn" onclick="biblicalTimelineZoomOut()" title="Zoom Out">−</button>';
  html += '<button class="timeline-zoom-btn" onclick="biblicalTimelineResetZoom()" title="Reset Zoom">⌂</button>';
  html += '<span class="timeline-zoom-info">' + Math.round(pixelPerYear * 10) / 10 + ' px/year</span>';
  html += '</div>';
  
  // Calculate container height (available space minus controls ~45px)
  const containerHeight = availableHeight - 45;
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
  for (let year = minYear; year <= maxYear; year += labelInterval) {
    const yearPos = ((year - minYear) * pixelPerYear);
    let label = '';
    if (labelFormat === 'millennium' || labelFormat === 'century') {
      // For BC years: year 0 = 1 BC, year -1 = 2 BC, etc.
      const displayYear = year <= 0 ? (1 - year) : year;
      const era = year <= 0 ? 'BC' : 'AD';
      label = `<span class="year-num">${displayYear}</span><span class="year-era">${era}</span>`;
    } else if (labelFormat === 'decade') {
      // For decades, show the decade number
      const displayYear = year <= 0 ? (1 - year) : year;
      const decade = Math.floor(displayYear / 10) * 10;
      const era = year <= 0 ? 'BC' : 'AD';
      label = `<span class="year-num">${decade}s</span><span class="year-era">${era}</span>`;
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
      // Skip if already a major or medium tick
      if (year % labelInterval !== 0 && year % 50 !== 0) {
        const yearPos = ((year - minYear) * pixelPerYear);
        allTicks.push({ year, pos: yearPos, label: null, type: 'minor' });
      }
    }
  }
  
  // 1-year ticks (yearly) - only show unlabeled years when zoomed enough
  if (showYearTicks && labelInterval > 1) {
    for (let year = minYear; year <= maxYear; year += 1) {
      // Skip if already a larger tick
      if (year % labelInterval !== 0 && year % 10 !== 0) {
        const yearPos = ((year - minYear) * pixelPerYear);
        allTicks.push({ year, pos: yearPos, label: null, type: 'yearly' });
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
  
  // Render ticks
  allTicks.forEach(({ year, pos, label, type }) => {
    if (label) {
      html += `<div class="ruler-tick" style="top: ${pos}px;">
        <div class="ruler-tick-label">${label}</div>
        <div class="ruler-tick-line ${type}"></div>
      </div>`;
    } else {
      html += `<div class="ruler-tick" style="top: ${pos}px;">
        <div class="ruler-tick-line ${type}"></div>
      </div>`;
    }
  });
  html += '</div>';
  
  // Timeline axis line
  html += '<div class="timeline-axis-line"></div>';
  
  // Lunar calendar bars (alternating colors for lunar months and years)
  html += '<div class="lunar-bars-container">';
  
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
  
  html += '</div>'; // lunar-bars-container
  
  const eventLabelHeight = 40; // Height of each event label + spacing
  const usedSlots = new Set(); // Track which vertical slots are used
  
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
      // Point events: position at timeline pos, avoid overlaps
      let eventDisplayPos = eventTimelinePos;
      let slotIndex = Math.floor(eventDisplayPos / eventLabelHeight);
      let attempts = 0;
      while (usedSlots.has(slotIndex) && attempts < 50) {
        slotIndex++;
        eventDisplayPos = slotIndex * eventLabelHeight;
        attempts++;
      }
      usedSlots.add(slotIndex);
      
      pointEventsForStack.push({
        event: event,
        eventTimelinePos: eventTimelinePos,
        eventDisplayPos: eventDisplayPos,
        year: year,
        icon: icon,
        color: color,
        clusterCount: null
      });
    }
  });
  
  // Render duration events as 20px wide bars with lane assignment
  // Sort by duration (longest first) - this allows shorter events to fill gaps
  // resulting in a more compact lane layout
  durationEventsForLines.sort((a, b) => {
    if (b.height !== a.height) return b.height - a.height; // Longer durations first
    return a.startPos - b.startPos; // Then by start position
  });
  
  
  // Assign lanes - each lane tracks its end position and event count (for alternating colors)
  const lanes = []; // Array of { endPos, count } for each lane
  const barWidth = 10;
  const barGap = 1;
  
  // Alternating color palettes for duration bars
  const colorPalettes = [
    ['rgba(100, 149, 237, 0.8)', 'rgba(65, 105, 225, 0.8)'],   // Blues
    ['rgba(144, 238, 144, 0.8)', 'rgba(60, 179, 113, 0.8)'],   // Greens
    ['rgba(255, 182, 108, 0.8)', 'rgba(255, 140, 0, 0.8)'],    // Oranges
    ['rgba(221, 160, 221, 0.8)', 'rgba(186, 85, 211, 0.8)'],   // Purples
    ['rgba(240, 128, 128, 0.8)', 'rgba(205, 92, 92, 0.8)'],    // Reds
  ];
  
  // Tolerance for floating point comparison and minor date misalignments
  // Needs to be > 1 to handle lunar year calculation accumulation
  const TOLERANCE = 3;
  
  durationEventsForLines.forEach(durEvent => {
    // Find the BEST lane where this bar fits (least wasted space)
    // Track both startPos and endPos to allow events before OR after existing content
    // Events that end and start on the same date can share a column
    let bestLane = -1;
    let bestGap = Infinity;
    let fitType = null; // 'before' or 'after'
    
    for (let i = 0; i < lanes.length; i++) {
      // Can fit AFTER current content? (with tolerance for floating point)
      if (durEvent.startPos >= lanes[i].endPos - TOLERANCE) {
        const gap = Math.max(0, durEvent.startPos - lanes[i].endPos);
        if (gap < bestGap) {
          bestGap = gap;
          bestLane = i;
          fitType = 'after';
        }
      }
      // Can fit BEFORE current content? (with tolerance for floating point)
      if (durEvent.endPos <= lanes[i].startPos + TOLERANCE) {
        const gap = Math.max(0, lanes[i].startPos - durEvent.endPos);
        if (gap < bestGap) {
          bestGap = gap;
          bestLane = i;
          fitType = 'before';
        }
      }
    }
    
    if (bestLane !== -1) {
      durEvent.laneIndex = lanes[bestLane].count;
      if (fitType === 'after') {
        lanes[bestLane].endPos = Math.max(lanes[bestLane].endPos, durEvent.endPos);
      } else {
        lanes[bestLane].startPos = Math.min(lanes[bestLane].startPos, durEvent.startPos);
      }
      lanes[bestLane].count++;
      durEvent.lane = bestLane;
    } else {
      // No lane found, create new one
      durEvent.laneIndex = 0;
      durEvent.lane = lanes.length;
      lanes.push({ startPos: durEvent.startPos, endPos: durEvent.endPos, count: 1 });
    }
  });
  
  // Calculate total width needed for duration bars
  const durationBarsWidth = lanes.length * (barWidth + barGap);
  
  html += `<div class="duration-bars-container" style="width: ${durationBarsWidth}px;">`;
  durationEventsForLines.forEach((durEvent) => {
    const leftPos = durEvent.lane * (barWidth + barGap);
    // Text disabled for narrow 7px bars - tooltip provides info
    const showText = false;
    
    // Alternate colors within each lane
    const palette = colorPalettes[durEvent.lane % colorPalettes.length];
    const barColor = palette[durEvent.laneIndex % 2];
    
    // Get duration string from original event data if available
    let durationStr = durEvent.durationStr || '';
    if (!durationStr) {
      // Fallback: calculate from Julian Days (use absolute value)
      const durationDays = Math.abs(durEvent.endJD - durEvent.startJD);
      const durationYears = durationDays / 365.2422;
      if (durationYears >= 1) {
        durationStr = `${Math.round(durationYears * 10) / 10} years`;
      } else if (durationDays >= 30) {
        durationStr = `${Math.round(durationDays / 29.53)} months`;
      } else {
        durationStr = `${Math.round(durationDays)} days`;
      }
    }
    
    // Get end date for tooltip
    const endDate = jdToGregorian(durEvent.endJD);
    const endDateStr = `${formatYear(endDate.year)} ${monthNames[endDate.month - 1]} ${endDate.day}`;
    
    // Build tooltip: "Event Name\nStart → End (Duration)"
    const tooltip = `${durEvent.title}\n${durEvent.dateStr} → ${endDateStr}\nDuration: ${durationStr}`;
    
    html += `
      <div class="duration-event-bar" 
           style="top: ${durEvent.startPos}px; height: ${durEvent.height}px; left: ${leftPos}px; background-color: ${barColor};"
           data-event-id="${durEvent.id}"
           onclick="openEventDetail('${durEvent.id}')"
           title="${tooltip}">
        ${showText ? `<span class="duration-event-text">${durEvent.title}</span>` : ''}
      </div>
    `;
  });
  html += '</div>';
  
  // Events stack positioned after duration bars
  // Base left: 60px (45px ruler + 10px lunar + 5px axis) + duration bars width
  const eventsStackLeft = 60 + durationBarsWidth + 8; // 8px gap
  html += `<div class="timeline-events-stack" style="left: ${eventsStackLeft}px;">`;
  
  // Render point events in stack (single line: icon + title only)
  pointEventsForStack.forEach((pointEvent) => {
    const clusterBadge = pointEvent.clusterCount ? 
      `<span class="cluster-badge">+${pointEvent.clusterCount - 1}</span>` : '';
    
    html += `
      <div class="stacked-event" 
           style="top: ${pointEvent.eventDisplayPos}px; border-left-color: ${pointEvent.color};"
           data-event-id="${pointEvent.event.id}"
           data-event-timeline-pos="${pointEvent.eventTimelinePos}"
           data-event-display-pos="${pointEvent.eventDisplayPos}"
           data-event-color="${pointEvent.color}"
           title="${pointEvent.event.title} (${formatYear(pointEvent.year)})"
           onclick="openEventDetail('${pointEvent.event.id}')">
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
  
  const canvasWidth = eventsStackLeft - 55; // From axis line to events stack
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.cssText = `
    position: absolute;
    left: 55px;
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
    
    const eventX = canvasWidth;
    
    ctx.beginPath();
    ctx.moveTo(timelineX, adjustedTimelinePos);
    
    const controlX1 = canvasWidth * 0.3;
    const controlX2 = canvasWidth * 0.7;
    
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
    biblicalTimelineZoom = Math.max(1.0, Math.min(5000, biblicalTimelineZoom * zoomFactor));
    renderBiblicalTimeline();
    return;
  }
  
  // Get current scroll state
  const oldScrollTop = scrollContainer.scrollTop;
  const viewportHeight = scrollContainer.clientHeight;
  const oldContentHeight = scrollContent.clientHeight;
  
  // Calculate the center point as a ratio of total content
  const centerOffset = oldScrollTop + (viewportHeight / 2);
  const centerRatio = centerOffset / oldContentHeight;
  
  // Apply zoom
  const oldZoom = biblicalTimelineZoom;
  biblicalTimelineZoom = Math.max(1.0, Math.min(5000, biblicalTimelineZoom * zoomFactor));
  
  // If zoom didn't change, don't re-render
  if (biblicalTimelineZoom === oldZoom) return;
  
  // Re-render the timeline
  renderBiblicalTimeline();
  
  // After render, restore scroll position to keep center point
  requestAnimationFrame(() => {
    const newScrollContainer = document.getElementById('timeline-scroll-container');
    const newScrollContent = document.getElementById('biblical-timeline-scroll');
    if (newScrollContainer && newScrollContent) {
      const newContentHeight = newScrollContent.clientHeight;
      const newCenterOffset = centerRatio * newContentHeight;
      const newScrollTop = newCenterOffset - (viewportHeight / 2);
      newScrollContainer.scrollTop = Math.max(0, newScrollTop);
      // Save state after zoom
      saveTimelineState();
    }
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
  
  // Calculate where the mouse is pointing in the content
  const mouseOffsetInViewport = clientY - containerRect.top;
  const mouseOffsetInContent = oldScrollTop + mouseOffsetInViewport;
  const mouseRatio = mouseOffsetInContent / oldContentHeight;
  
  // Apply zoom
  const oldZoom = biblicalTimelineZoom;
  biblicalTimelineZoom = Math.max(1.0, Math.min(5000, biblicalTimelineZoom * zoomFactor));
  
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
      const newMouseOffsetInContent = mouseRatio * newContentHeight;
      const newScrollTop = newMouseOffsetInContent - mouseOffsetInViewport;
      newScrollContainer.scrollTop = Math.max(0, newScrollTop);
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
  
  // Restore saved state
  const savedState = loadTimelineState();
  if (savedState) {
    biblicalTimelineZoom = savedState.zoom || 1.0;
  }
  
  // Render timeline
  renderBiblicalTimeline();
  
  // Restore scroll position after render
  if (savedState && savedState.scrollTop) {
    requestAnimationFrame(() => {
      const scrollContainer = document.getElementById('timeline-scroll-container');
      if (scrollContainer) {
        scrollContainer.scrollTop = savedState.scrollTop;
      }
    });
  }
}

// Clear the resolved events cache (call when profile changes)
function invalidateBiblicalTimelineCache() {
  biblicalTimelineResolvedCache = null;
  biblicalTimelineCacheKey = null;
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
}
