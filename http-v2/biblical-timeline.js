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
const TIMELINE_FILTERS_KEY = 'biblicalTimelineFilters';

// Filter state - which event types to show
let timelineFilters = {
  births: true,
  deaths: true,
  biblical: true,
  historical: true,
  prophecy: true
};

// Simple markdown to HTML converter for descriptions and quotes
function renderMarkdown(text) {
  if (!text) return '';
  return text
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    // Line breaks
    .replace(/\n/g, '<br>');
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
  
  // Load filters on first call
  loadTimelineFilters();
  
  return events.filter(event => {
    // Skip events with no valid dates
    if (event.startJD === null) return false;
    
    // Apply toggle button filters
    const eventType = event.type || '';
    const eventTags = event.tags || [];
    
    // Birth filter
    if (!timelineFilters.births && eventType === 'birth') return false;
    
    // Death filter
    if (!timelineFilters.deaths && eventType === 'death') return false;
    
    // Biblical events filter (biblical-event, feast, creation, catastrophe)
    if (!timelineFilters.biblical) {
      const biblicalTypes = ['biblical-event', 'feast', 'creation', 'catastrophe'];
      if (biblicalTypes.includes(eventType)) return false;
    }
    
    // Historical events filter (conquest, decree, construction, destruction, reign)
    if (!timelineFilters.historical) {
      const historicalTypes = ['conquest', 'decree', 'construction', 'destruction', 'reign', 'historical'];
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

// Debug mode - set to true to show diagnostic table instead of rendering timeline
const TIMELINE_DEBUG_MODE = true;
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

// Navigation history for the detail panel
const detailPanelHistory = {
  stack: [],      // Array of { type: 'event'|'duration', id: string }
  currentIndex: -1
};

// Initialize the slide-out panel (call once on page load)
function initDetailPanel() {
  if (document.getElementById('detail-slideout-panel')) return;
  
  const panel = document.createElement('div');
  panel.id = 'detail-slideout-panel';
  panel.className = 'detail-slideout';
  panel.innerHTML = `
    <div class="detail-slideout-header">
      <div class="detail-nav-buttons">
        <button class="detail-nav-btn" id="detail-nav-back" onclick="navigateDetailHistory(-1)" title="Back" disabled>◀</button>
        <button class="detail-nav-btn" id="detail-nav-forward" onclick="navigateDetailHistory(1)" title="Forward" disabled>▶</button>
      </div>
      <button class="detail-close-btn" onclick="closeDetailPanel()">×</button>
    </div>
    <div class="detail-slideout-content" id="detail-slideout-content"></div>
  `;
  document.body.appendChild(panel);
  
  // Add styles
  if (!document.getElementById('detail-slideout-styles')) {
    const style = document.createElement('style');
    style.id = 'detail-slideout-styles';
    style.textContent = `
      .detail-slideout {
        position: fixed;
        top: 56px; /* Below main nav */
        right: -100%;
        width: 50%;
        max-width: calc(100% - 280px - 60px); /* Don't cover sidebar (280px) or ruler (60px) */
        height: calc(100vh - 56px);
        background: #1a1a2e;
        border-left: 2px solid rgba(126, 200, 227, 0.3);
        z-index: 900; /* Below sidebar (1000) */
        transition: right 0.3s ease;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .detail-slideout.open {
        right: 280px; /* Account for sidebar width */
      }
      
      /* When sidebar is hidden (mobile or collapsed) */
      @media (max-width: 1023px) {
        .detail-slideout.open {
          right: 0;
        }
        .detail-slideout {
          max-width: calc(100% - 60px);
          z-index: 9000;
        }
      }
      
      /* Mobile: slide out covers events but not ruler, adjust for smaller nav */
      @media (max-width: 768px) {
        .detail-slideout {
          top: 48px;
          height: calc(100vh - 48px);
          width: calc(100% - 60px);
          left: auto;
          right: -100%;
        }
        .detail-slideout.open {
          right: 0;
        }
      }
      
      .detail-slideout-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid rgba(126, 200, 227, 0.2);
        flex-shrink: 0;
      }
      
      .detail-nav-buttons {
        display: flex;
        gap: 8px;
      }
      
      .detail-nav-btn {
        background: rgba(126, 200, 227, 0.2);
        border: 1px solid rgba(126, 200, 227, 0.3);
        color: #7ec8e3;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      .detail-nav-btn:hover:not(:disabled) {
        background: rgba(126, 200, 227, 0.3);
      }
      .detail-nav-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      
      .detail-close-btn {
        background: none;
        border: none;
        color: #7ec8e3;
        font-size: 28px;
        cursor: pointer;
        padding: 0 5px;
        line-height: 1;
      }
      .detail-close-btn:hover {
        color: #ff6b6b;
      }
      
      .detail-slideout-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        color: #e0e0e0;
      }
      
      /* When panel is open, adjust main content on desktop only */
      @media (min-width: 769px) {
        body.detail-panel-open .ruler-timeline-container {
          width: 50%;
        }
      }
      /* On mobile, timeline stays full width and panel overlays */
      
      /* Detail content styles */
      .detail-title {
        font-size: 1.5em;
        color: #7ec8e3;
        margin: 0 0 20px 0;
        display: flex;
        align-items: center;
        gap: 10px;
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
      
      .detail-claimed {
        font-size: 1.4em;
        color: #6bc46b;
        font-weight: bold;
      }
      
      .detail-events-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
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
      .detail-arrow {
        color: #7ec8e3;
        font-size: 1.3em;
      }
      
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
      
      .detail-notes {
        font-size: 0.95em;
        line-height: 1.6;
        color: #b0b0b0;
      }
      .detail-notes strong {
        color: #7ec8e3;
      }
      
      /* Collapsible description box */
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
      /* Text fade using CSS mask - only when truncated */
      .detail-description-wrapper.truncated .detail-description-text {
        -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
        mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
      }
      /* Centered chevron indicator - only shown when truncated */
      .detail-expand-chevron {
        display: none;
        justify-content: center;
        padding: 4px 0;
        color: #7ec8e3;
        font-size: 12px;
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      .detail-description-wrapper.truncated .detail-expand-chevron {
        display: flex;
      }
      .detail-description-wrapper.truncated:hover .detail-expand-chevron {
        opacity: 1;
      }
      .detail-description-wrapper.expanded .detail-expand-chevron {
        display: none;
      }
      
      /* Prev/Next Event Navigation */
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
      .detail-prev-event .detail-nav-label {
        text-align: left;
      }
      .detail-next-event .detail-nav-label {
        text-align: right;
      }
      .detail-nav-event-info {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #7ec8e3;
        font-weight: 500;
      }
      .detail-next-event .detail-nav-event-info {
        justify-content: flex-end;
      }
      .detail-nav-year {
        font-size: 0.85em;
        color: #6bc46b;
        margin-top: 4px;
      }
      .detail-next-event .detail-nav-year {
        text-align: right;
      }
      
      .detail-doc-content {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        padding: 15px;
        margin-top: 10px;
        line-height: 1.6;
      }
      .detail-doc-content h1, .detail-doc-content h2, .detail-doc-content h3 {
        color: #7ec8e3;
        margin-top: 15px;
      }
      .detail-doc-content blockquote {
        border-left: 3px solid #7ec8e3;
        padding-left: 15px;
        margin: 10px 0;
        color: #c0c0c0;
        font-style: italic;
      }
      
      /* Date display */
      .detail-date-row {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
      }
      .detail-date-item {
        flex: 1;
        min-width: 150px;
      }
      .detail-date-label {
        font-size: 0.8em;
        color: #888;
        text-transform: uppercase;
      }
      .detail-date-value {
        font-size: 1.1em;
        color: #e0e0e0;
      }
      .lunar-calendar-link {
        text-decoration: none;
        cursor: pointer;
        opacity: 0.8;
        transition: opacity 0.2s;
      }
      .lunar-calendar-link:hover {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }
}

// Navigate through detail history
function navigateDetailHistory(direction) {
  const newIndex = detailPanelHistory.currentIndex + direction;
  if (newIndex < 0 || newIndex >= detailPanelHistory.stack.length) return;
  
  detailPanelHistory.currentIndex = newIndex;
  const item = detailPanelHistory.stack[newIndex];
  
  // Open without adding to history
  if (item.type === 'event') {
    openEventDetailInternal(item.id, false);
  } else if (item.type === 'duration') {
    openDurationDetailInternal(item.id, false);
  }
  
  updateNavButtons();
}

// Update nav button states
function updateNavButtons() {
  const backBtn = document.getElementById('detail-nav-back');
  const forwardBtn = document.getElementById('detail-nav-forward');
  if (backBtn) backBtn.disabled = detailPanelHistory.currentIndex <= 0;
  if (forwardBtn) forwardBtn.disabled = detailPanelHistory.currentIndex >= detailPanelHistory.stack.length - 1;
}

// Close the detail panel
function closeDetailPanel() {
  const panel = document.getElementById('detail-slideout-panel');
  if (panel) {
    panel.classList.remove('open');
    document.body.classList.remove('detail-panel-open');
  }
  // Clear duration highlight
  highlightDurationBar(null);
  // Reset URL to just the timeline
  updateTimelineURL(null, null);
}

// Navigate to calendar from timeline event detail
function navigateToCalendarFromTimeline(year, lunarMonth, lunarDay) {
  // Close the detail panel
  closeDetailPanel();
  
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
  updateNavButtons();
}

// Add item to history (truncate forward history if navigating from middle)
function addToDetailHistory(type, id) {
  // Remove any forward history
  detailPanelHistory.stack = detailPanelHistory.stack.slice(0, detailPanelHistory.currentIndex + 1);
  // Add new item
  detailPanelHistory.stack.push({ type, id });
  detailPanelHistory.currentIndex = detailPanelHistory.stack.length - 1;
  updateNavButtons();
}

// Make functions globally available
window.initDetailPanel = initDetailPanel;
window.closeDetailPanel = closeDetailPanel;
window.navigateDetailHistory = navigateDetailHistory;
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
  
  if (addHistory) {
    addToDetailHistory('duration', durationId);
  }
  
  // Load events data to get pretty names
  const data = await loadBiblicalTimelineData();
  const events = data?.events || [];
  
  // Resolve events to get dates
  const profile = (typeof getTimelineProfile === 'function') ? getTimelineProfile() : null;
  let resolvedEvents = [];
  if (typeof EventResolver !== 'undefined' && profile) {
    try {
      resolvedEvents = EventResolver.resolveAllEvents(data, profile);
    } catch (e) {
      console.warn('Error resolving events:', e);
    }
  }
  
  const getEventInfo = (eventId) => {
    const event = events.find(e => e.id === eventId);
    const resolved = resolvedEvents.find(e => e.id === eventId);
    let dateStr = '';
    
    if (resolved?.startJD && typeof EventResolver !== 'undefined') {
      const greg = EventResolver.julianDayToGregorian(resolved.startJD);
      const year = greg.year;
      dateStr = year > 0 ? `${year} AD` : `${Math.abs(year)} BC`;
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
          return `
            <div class="detail-source-item">
              <div class="detail-source-ref">${srcIcon} ${src.ref || 'Unknown'}</div>
              ${src.quote ? `<div class="detail-source-quote">"${renderMarkdown(src.quote)}"</div>` : ''}
            </div>
          `;
        }).join('') :
        `<div class="detail-source-item">
          <div class="detail-source-ref">${sourceIcon} ${duration.source?.ref || 'Unknown'}</div>
          ${duration.source?.quote ? `<div class="detail-source-quote">"${renderMarkdown(duration.source.quote)}"</div>` : ''}
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
  
  // Load documentation async
  if (duration.doc) {
    try {
      const response = await fetch('/' + duration.doc);
      if (response.ok) {
        const markdown = await response.text();
        let docHtml = markdown
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br>');
        const docEl = document.getElementById('detail-doc-content');
        if (docEl) docEl.innerHTML = '<p>' + docHtml + '</p>';
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

// Public function - opens duration and adds to history
async function openDurationDetail(durationId) {
  await openDurationDetailInternal(durationId, true);
  updateTimelineURL('duration', durationId);
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
    return;
  }
  
  // Clear duration highlight when viewing an event
  highlightDurationBar(null);
  
  if (addHistory) {
    addToDetailHistory('event', eventId);
  }
  
  const icon = getTypeIcon(event.type);
  
  // Format dates
  let lunarDateStr = '—';
  let gregorianDateStr = '—';
  
  if (event.start?.lunar) {
    const l = event.start.lunar;
    const monthNames = ['Nisan', 'Iyyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 'Tishri', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar'];
    const monthName = monthNames[(l.month - 1) % 12] || `Month ${l.month}`;
    lunarDateStr = l.day ? `${monthName} ${l.day}` : monthName;
    if (l.year) {
      lunarDateStr += `, ${l.year > 0 ? l.year + ' AD' : Math.abs(l.year) + ' BC'}`;
    }
  }
  
  // Get resolved dates if available
  const profile = (typeof getTimelineProfile === 'function') ? getTimelineProfile() : null;
  let resolvedStartJD = null;
  let resolvedGregorian = null;
  let resolved = []; // All resolved events for reference lookups
  
  if (typeof EventResolver !== 'undefined' && profile) {
    try {
      resolved = EventResolver.resolveAllEvents(data, profile);
      const resolvedEvent = resolved.find(e => e.id === eventId);
      if (resolvedEvent) {
        resolvedStartJD = resolvedEvent.startJD;
        if (resolvedStartJD) {
          resolvedGregorian = EventResolver.julianDayToGregorian(resolvedStartJD);
          const year = resolvedGregorian.year;
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          gregorianDateStr = `${monthNames[resolvedGregorian.month - 1]} ${resolvedGregorian.day}, ${year > 0 ? year + ' AD' : Math.abs(year) + ' BC'}`;
        }
      }
    } catch (e) {
      console.warn('Error resolving event:', e);
    }
  }
  
  // Build calendar link for lunar date
  let lunarCalendarLink = '';
  if (event.start?.lunar && resolvedGregorian) {
    const l = event.start.lunar;
    const lunarMonth = l.month || 1;
    const lunarDay = l.day || 1;
    const calYear = resolvedGregorian.year;
    lunarCalendarLink = `<a href="#" class="lunar-calendar-link" onclick="navigateToCalendarFromTimeline(${calYear}, ${lunarMonth}, ${lunarDay}); return false;" title="View in Calendar">📅</a> `;
  }
  
  // Build HTML
  let html = `
    <h2 class="detail-title">
      <span class="detail-title-icon">${icon}</span>
      ${event.title}
    </h2>
    
    <div class="detail-section">
      <h4>Dates</h4>
      <div class="detail-date-row">
        <div class="detail-date-item">
          <div class="detail-date-label">Lunar</div>
          <div class="detail-date-value">${lunarCalendarLink}${lunarDateStr}</div>
        </div>
        <div class="detail-date-item">
          <div class="detail-date-label">Gregorian</div>
          <div class="detail-date-value">${gregorianDateStr}</div>
        </div>
      </div>
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
      evYear = greg.year > 0 ? `${greg.year} AD` : `${Math.abs(greg.year)} BC`;
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
  
  // Show derivation if relative
  if (event.start?.relative) {
    const rel = event.start.relative;
    const refEvent = data?.events?.find(e => e.id === rel.event);
    const refTitle = refEvent?.title || rel.event;
    const refIcon = refEvent ? getTypeIcon(refEvent.type) : '📍';
    
    // Get date of reference event
    let refDateStr = '';
    const refResolved = resolved.find(e => e.id === rel.event);
    if (refResolved?.startJD && typeof EventResolver !== 'undefined') {
      const refGreg = EventResolver.julianDayToGregorian(refResolved.startJD);
      refDateStr = refGreg.year > 0 ? `${refGreg.year} AD` : `${Math.abs(refGreg.year)} BC`;
    }
    
    let offsetStr = '';
    if (rel.offset) {
      const parts = [];
      if (rel.offset.years) parts.push(`${rel.offset.years} years`);
      if (rel.offset.months) parts.push(`${rel.offset.months} months`);
      if (rel.offset.days) parts.push(`${rel.offset.days} days`);
      offsetStr = parts.join(', ');
    }
    const direction = rel.direction || 'after';
    
    html += `
      <div class="detail-section">
        <h4>Derived From</h4>
        <div class="detail-events-row">
          <div class="detail-event-link" onclick="openEventDetail('${rel.event}')" style="flex-direction: column; align-items: flex-start;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span>${refIcon}</span>
              <span>${refTitle}</span>
            </div>
            ${refDateStr ? `<div style="font-size: 0.85em; color: #6bc46b; margin-top: 4px;">${refDateStr}</div>` : ''}
          </div>
          <span class="detail-arrow">${direction === 'before' ? '←' : '→'}</span>
          <span>${offsetStr} ${direction}</span>
        </div>
      </div>
    `;
  }
  
  // Show sources
  if (event.sources && event.sources.length > 0) {
    html += `
      <div class="detail-section">
        <h4>Sources</h4>
        ${event.sources.map(src => {
          const srcIcon = src.type === 'scripture' ? '📖' : src.type === 'historical' ? '📜' : '📋';
          return `
            <div class="detail-source-item">
              <div class="detail-source-ref">${srcIcon} ${src.ref || 'Unknown'}</div>
              ${src.quote ? `<div class="detail-source-quote">"${renderMarkdown(src.quote)}"</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  
  // Show related durations
  const durations = data?.durations || [];
  const relatedDurations = durations.filter(d => d.from_event === eventId || d.to_event === eventId);
  
  if (relatedDurations.length > 0) {
    html += `
      <div class="detail-section">
        <h4>Related Durations</h4>
        ${relatedDurations.map(dur => {
          const isFrom = dur.from_event === eventId;
          const otherEventId = isFrom ? dur.to_event : dur.from_event;
          const otherEvent = data?.events?.find(e => e.id === otherEventId);
          const otherTitle = otherEvent?.title || otherEventId;
          const otherIcon = otherEvent ? getTypeIcon(otherEvent.type) : '📍';
          
          let claimedStr = '';
          if (dur.claimed) {
            if (dur.claimed.years !== undefined) claimedStr = `${dur.claimed.years} years`;
            else if (dur.claimed.months !== undefined) claimedStr = `${dur.claimed.months} months`;
            else if (dur.claimed.days !== undefined) claimedStr = `${dur.claimed.days} days`;
          }
          
          return `
            <div class="detail-duration-item" onclick="openDurationDetail('${dur.id}')" style="cursor: pointer; padding: 8px; margin: 4px 0; background: rgba(255,255,255,0.03); border-radius: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span>⏱️</span>
                <span style="color: #6bc46b; font-weight: bold;">${claimedStr}</span>
                <span class="detail-arrow">${isFrom ? '→' : '←'}</span>
                <span>${otherIcon} ${otherTitle}</span>
              </div>
              <div style="font-size: 0.85em; color: #888; margin-top: 4px;">${dur.title}</div>
            </div>
          `;
        }).join('')}
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
  // Use AppStore if available (http-v2)
  if (typeof AppStore !== 'undefined') {
    if (type === 'event') {
      AppStore.dispatch({ type: 'SET_TIMELINE_EVENT', eventId: id });
    } else if (type === 'duration') {
      AppStore.dispatch({ type: 'SET_TIMELINE_DURATION', durationId: id });
    } else {
      AppStore.dispatch({ type: 'CLEAR_TIMELINE_SELECTION' });
    }
    return;
  }
  
  // Fallback for http/ (old behavior)
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

// Public function - opens event and adds to history
async function openEventDetail(eventId) {
  await openEventDetailInternal(eventId, true);
  updateTimelineURL('event', eventId);
}

// Scroll the timeline to center on a specific year with animation
function scrollTimelineToYear(year) {
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
  const targetScroll = yearPos - (containerHeight / 2);
  
  // Clamp to valid scroll range
  const maxScroll = scrollContainer.scrollHeight - containerHeight;
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

// Make functions globally available
window.openEventDetail = openEventDetail;
window.scrollTimelineToYear = scrollTimelineToYear;
window.openDurationDetail = openDurationDetail;
window.closeDurationDetail = closeDurationDetail;
window.openDurationDetail_openEvent = openDurationDetail_openEvent;
window.toggleDescriptionExpand = toggleDescriptionExpand;

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
  
  // TABBED DEBUG MODE: Show tabs for table, graph, and durations
  // Graph tab uses the existing timeline rendering (skips debug mode)
  if (TIMELINE_DEBUG_MODE && currentTimelineTab !== 'graph') {
    // Show loading message first
    container.innerHTML = '<div style="padding: 20px; color: white;">Loading debug data...</div>';
    
    // Use setTimeout to allow the UI to update before processing
    setTimeout(() => {
      try {
        let resolvedEvents;
        try {
          resolvedEvents = EventResolver.resolveAllEvents(data, profile);
        } catch (resolveErr) {
          container.innerHTML = `<div style="padding: 20px; color: #ff6b6b;">
            <h3>Error resolving events:</h3>
            <pre>${resolveErr.message}\n${resolveErr.stack}</pre>
          </div>`;
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
          
          // If we have a FIXED Gregorian date, calculate lunar from it
          if (fixed?.gregorian) {
            const greg = fixed.gregorian;
            const jd = gregorianToJD(greg);
            const approxLunar = jdToApproxLunar(jd, greg.year);
            if (approxLunar) {
              return { 
                month: approxLunar.month, 
                day: approxLunar.day, 
                year: approxLunar.year, 
                source: `=lunar(${greg.month}/${greg.day}/${greg.year > 0 ? greg.year : (1-greg.year)+'BC'})`
              };
            }
          }
          
          // If we have a reference, resolve it and apply offset
          if (refId && eventsById[refId]) {
            const refLunar = resolveLunarDate(eventsById[refId], false, new Set(visited));
            if (refLunar) {
              let { month, day, year } = refLunar;
              
              // Build formula string
              const offset = relative?.offset || {};
              const direction = relative?.direction;
              let formula = `=${refId}`;
              
              // Apply offsets
              let yearsOffset = offset.years || 0;
              let monthsOffset = offset.months || 0;
              let daysOffset = offset.days || 0;
              
              if (direction === 'before') {
                yearsOffset = -yearsOffset;
                monthsOffset = -monthsOffset;
                daysOffset = -daysOffset;
              }
              
              // Build formula string
              if (yearsOffset) formula += (yearsOffset > 0 ? `+${yearsOffset}y` : `${yearsOffset}y`);
              if (monthsOffset) formula += (monthsOffset > 0 ? `+${monthsOffset}m` : `${monthsOffset}m`);
              if (daysOffset) formula += (daysOffset > 0 ? `+${daysOffset}d` : `${daysOffset}d`);
              
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
            return {
              month: lunar.month ?? 1,
              day: lunar.day ?? 1,
              year: lunar.year ?? greg?.year ?? null,
              source: lunar.year !== undefined ? 'stipulated' : '=G.Y(JD)'
            };
          }
          
          // Last resort: derive from resolved JD
          const jd = isEnd ? event.resolved?.endJD : event.resolved?.startJD;
          if (jd && isFinite(jd) && greg) {
            const approxLunar = jdToApproxLunar(jd, greg.year);
            if (approxLunar) {
              return {
                month: approxLunar.month,
                day: approxLunar.day,
                year: approxLunar.year,
                source: '=lunar(JD)'
              };
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
              <button id="exportCsvBtn" style="padding: 8px 16px; background: #4a9eff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Export CSV
              </button>
            </div>
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
  
  // DEBUG: Log unresolved events
  const unresolvedEvents = resolvedEvents.filter(e => e.startJD === null);
  if (unresolvedEvents.length > 0) {
    console.log('UNRESOLVED EVENTS (' + unresolvedEvents.length + '):', unresolvedEvents.map(e => e.id));
  }
  
  // DEBUG: Check specific pre-flood events (check both filtered and full cache)
  const preFloodDeaths = ['methuselah-death', 'lamech-death', 'noah-death', 'jared-death', 'enoch-translation', 'methuselah-birth', 'lamech-birth'];
  console.log('=== PRE-FLOOD EVENT DEBUG ===');
  console.log('Filtered resolvedEvents count:', resolvedEvents.length);
  console.log('Full cache count:', biblicalTimelineResolvedCache?.length || 0);
  
  preFloodDeaths.forEach(id => {
    const eventFiltered = resolvedEvents.find(e => e.id === id);
    const eventFull = biblicalTimelineResolvedCache?.find(e => e.id === id);
    
    if (eventFull) {
      const year = eventFull.startJD ? Math.floor((eventFull.startJD - 1721425.5) / 365.25) : 'null';
      console.log(`${id}: startJD=${eventFull.startJD}, year=${year}, inFiltered=${!!eventFiltered}`);
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
  // =====================================================
  const RULER_WIDTH = 35;
  const LUNAR_BARS_WIDTH = 10; // 5px years + 5px months
  const AXIS_LINE_WIDTH = 2;
  const DURATION_GAP = 8;
  
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
    const majorTypes = ['milestone', 'creation', 'catastrophe'];
    const highTypes = ['biblical-event'];
    const majorTags = ['prophecy', 'resurrection', 'crucifixion', 'creation', 'flood', 'exodus', 'patriarch'];
    
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
  
  // Build HTML - with tab navigation and filter toggles (z-index higher than slideout so filters stay visible)
  let html = '<div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 10px; background: #1a1a2e; flex-wrap: wrap; gap: 8px; position: relative; z-index: 9500;">';
  html += '<div style="display: flex; align-items: center; gap: 4px;">';
  html += '<button onclick="switchTimelineTab(\'table\')" style="padding: 6px 12px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;">📊 Table</button>';
  html += '<button style="padding: 6px 12px; background: #4a9eff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">📈 Graph</button>';
  html += '<button onclick="switchTimelineTab(\'durations\')" style="padding: 6px 12px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;">🔗 Durations</button>';
  html += '</div>';
  
  // Zoom level indicator in top bar
  html += '<span style="color: #666; font-size: 0.75em;">' + Math.round(pixelPerYear * 10) / 10 + ' px/yr</span>';
  html += '</div>';
  
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
    }
  });
  
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
  });
  
  // =====================================================
  // DURATION BARS - Render ONLY from explicit durations array
  // These are the documented testimonies/evidence between events
  // =====================================================
  
  // Build event Julian Day lookup from ALL resolved events
  // Store raw JD values - scaling happens at render time
  const eventJulianDays = {};
  const allResolvedEvents = biblicalTimelineResolvedCache || [];
  
  allResolvedEvents.forEach(event => {
    if (event.startJD !== null) {
      eventJulianDays[event.id] = event.startJD;
    }
  });
  
  // Reuse existing jdToPixelPos function defined above for timeline rendering
  // No need to redefine - it's already available in this scope
  
  // Process durations array into renderable bars
  const durationBars = [];
  const barWidth = 8;
  const barGap = 2;
  
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
      const yearStr = year > 0 ? `${year} AD` : `${Math.abs(year)} BC`;
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
    
    html += `
      <div class="stacked-event" 
           style="top: ${pointEvent.eventDisplayPos}px; left: ${eventLeft}px; border-left-color: ${pointEvent.color};"
           data-event-id="${pointEvent.event.id}"
           data-event-timeline-pos="${pointEvent.eventTimelinePos}"
           data-event-display-pos="${pointEvent.eventDisplayPos}"
           data-event-color="${pointEvent.color}"
           data-event-left="${eventLeft}"
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
    biblicalTimelineZoom = Math.max(0.1, Math.min(5000, biblicalTimelineZoom * zoomFactor));
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
  
  // Apply zoom - allow zooming out to 0.1 (very zoomed out) and in to 5000 (day-level)
  const oldZoom = biblicalTimelineZoom;
  biblicalTimelineZoom = Math.max(0.1, Math.min(5000, biblicalTimelineZoom * zoomFactor));
  
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
  
  // Apply zoom - allow zooming out to 0.1 (very zoomed out) and in to 5000 (day-level)
  const oldZoom = biblicalTimelineZoom;
  biblicalTimelineZoom = Math.max(0.1, Math.min(5000, biblicalTimelineZoom * zoomFactor));
  
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
