// Historical Events Module
// Handles loading, rendering, and filtering of historical events

let historicalEventsData = null;
let currentEventView = 'list';
let selectedEventId = null;

// Load historical events data
async function loadHistoricalEvents() {
  if (historicalEventsData) return historicalEventsData;
  
  try {
    const response = await fetch('/historical-events.json');
    historicalEventsData = await response.json();
    return historicalEventsData;
  } catch (error) {
    console.error('Failed to load historical events:', error);
    return null;
  }
}

// Format year for display (handles BC/AD with astronomical year numbering)
// Astronomical: Year 1 = 1 AD, Year 0 = 1 BC, Year -1 = 2 BC, Year -17 = 18 BC
function formatYear(year) {
  if (year === null || year === undefined) return '—';
  if (year <= 0) {
    // Astronomical year 0 = 1 BC, year -1 = 2 BC, year -N = (N+1) BC
    return `${1 - year} BC`;
  } else {
    return `${year} AD`;
  }
}

// Format lunar date for display
function formatLunarDate(lunar) {
  if (!lunar) return '—';
  
  const monthNames = [
    'Nisan', 'Iyyar', 'Sivan', 'Tammuz', 'Av', 'Elul',
    'Tishri', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar'
  ];
  
  const hasMonth = lunar.month !== null && lunar.month !== undefined;
  const hasDay = lunar.day !== null && lunar.day !== undefined;
  const hasYear = lunar.year !== null && lunar.year !== undefined;
  const hasTime = lunar.time_of_day !== null && lunar.time_of_day !== undefined;
  
  if (!hasMonth && !hasDay && !hasYear) return '—';
  
  const parts = [];
  if (hasMonth) {
    const monthName = monthNames[lunar.month - 1] || `Month ${lunar.month}`;
    parts.push(monthName);
  }
  if (hasDay) {
    parts.push(`Day ${lunar.day}`);
  }
  if (hasTime) {
    // Format time of day (night, morning, evening, afternoon, etc.)
    const timeLabels = {
      'night': 'at night',
      'morning': 'in the morning',
      'evening': 'at evening',
      'afternoon': 'in the afternoon',
      'dawn': 'at dawn',
      'dusk': 'at dusk',
      'midnight': 'at midnight',
      'noon': 'at noon'
    };
    parts.push(timeLabels[lunar.time_of_day] || lunar.time_of_day);
  }
  if (hasYear) {
    parts.push(formatYear(lunar.year));
  }
  
  return parts.length > 0 ? parts.join(', ') : '—';
}

// Format Gregorian/Julian date for display
function formatGregorianDate(gregorian) {
  if (!gregorian) return '—';
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Check if we only have a year (most common case for historical events)
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
    parts.push(formatYear(gregorian.year));
  }
  
  // NASA convention: dates before 1582 are Julian calendar, no suffix needed
  return parts.join(' ');
}

// Determine era for an event based on its Gregorian year
function getEventEra(event) {
  let year = null;
  
  if (event.dates?.gregorian?.year !== undefined) {
    year = event.dates.gregorian.year;
  } else if (event.dates?.anno_mundi?.year) {
    // Rough conversion: AM 1 = ~4000 BC
    year = event.dates.anno_mundi.year - 4000;
  }
  
  if (year === null) return 'unknown';
  
  if (year <= -2300) return 'creation';        // Creation to Flood
  if (year <= -1700) return 'patriarchs';      // Abraham to Joseph
  if (year <= -1000) return 'exodus';          // Exodus to Judges
  if (year <= -930) return 'monarchy';         // United Monarchy
  if (year <= -586) return 'divided';          // Divided Kingdom
  if (year <= -400) return 'exile';            // Exile and Return
  if (year <= 70) return 'second-temple';      // Second Temple Period
  return 'roman';                               // Roman Period
}

// Get era display name
function getEraDisplayName(era) {
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
}

// Get sort key for an event (for chronological ordering)
function getEventSortKey(event) {
  if (event.dates?.gregorian?.year !== undefined) {
    // Use Gregorian year as primary, with month/day for secondary
    const year = event.dates.gregorian.year;
    const month = event.dates.gregorian.month || 1;
    const day = event.dates.gregorian.day || 1;
    return year * 10000 + month * 100 + day;
  }
  if (event.dates?.anno_mundi?.year) {
    return (event.dates.anno_mundi.year - 4000) * 10000;
  }
  if (event.dates?.lunar?.year) {
    return event.dates.lunar.year * 10000 + (event.dates.lunar.month || 1) * 100;
  }
  return 999999999; // Unknown dates go to end
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
    'catastrophe': '🌊'
  };
  return icons[type] || '📌';
}

// Render event card HTML
function renderEventCard(event) {
  const typeIcon = getTypeIcon(event.type);
  const lunarDate = formatLunarDate(event.dates?.lunar);
  const gregorianDate = formatGregorianDate(event.dates?.gregorian);
  
  // Build tags HTML
  const tagsHtml = (event.tags || []).slice(0, 4).map(tag => 
    `<span class="event-tag">${tag}</span>`
  ).join('');
  
  return `
    <div class="event-card" onclick="openEventDetail('${event.id}')">
      <div class="event-card-header">
        <h4 class="event-card-title">${typeIcon} ${event.title}</h4>
        <span class="event-card-type">${event.type || 'event'}</span>
      </div>
      <div class="event-card-dates">
        ${lunarDate !== '—' ? `
        <div class="event-date-item">
          <span class="event-date-label">Lunar:</span>
          <span class="event-date-value">${lunarDate}</span>
        </div>
        ` : ''}
        ${gregorianDate !== '—' ? `
        <div class="event-date-item">
          <span class="event-date-label">Gregorian:</span>
          <span class="event-date-value">${gregorianDate}</span>
        </div>
        ` : ''}
      </div>
      <p class="event-card-desc">${event.description || ''}</p>
      ${tagsHtml ? `<div class="event-card-tags">${tagsHtml}</div>` : ''}
    </div>
  `;
}

// Filter events based on current filter settings
function getFilteredEvents(events) {
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
      const eventEra = getEventEra(event);
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
}

// Render the events list
async function renderEventsList() {
  const container = document.getElementById('events-list-container');
  if (!container) return;
  
  const data = await loadHistoricalEvents();
  if (!data) {
    container.innerHTML = '<div class="events-loading">Failed to load events.</div>';
    return;
  }
  
  // Combine events and recurring events
  const allEvents = [...(data.events || [])];
  
  // Filter events
  const filteredEvents = getFilteredEvents(allEvents);
  
  if (filteredEvents.length === 0) {
    container.innerHTML = '<div class="events-no-results">No events match your filters.</div>';
    return;
  }
  
  // Sort chronologically
  filteredEvents.sort((a, b) => getEventSortKey(a) - getEventSortKey(b));
  
  // Group by era
  const eventsByEra = {};
  const eraOrder = ['creation', 'patriarchs', 'exodus', 'monarchy', 'divided', 'exile', 'second-temple', 'roman', 'unknown'];
  
  filteredEvents.forEach(event => {
    const era = getEventEra(event);
    if (!eventsByEra[era]) {
      eventsByEra[era] = [];
    }
    eventsByEra[era].push(event);
  });
  
  // Build HTML
  let html = '';
  
  eraOrder.forEach(era => {
    const events = eventsByEra[era];
    if (!events || events.length === 0) return;
    
    html += `
      <div class="events-era-group">
        <h3 class="events-era-header">
          ${getEraDisplayName(era)}
          <span class="events-era-count">${events.length}</span>
        </h3>
        ${events.map(renderEventCard).join('')}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Filter events (called on filter change)
function filterEvents() {
  renderEventsList();
}

// Set events view (list or timeline)
function setEventsView(view) {
  currentEventView = view;
  
  const listBtn = document.getElementById('events-list-btn');
  const timelineBtn = document.getElementById('events-timeline-btn');
  const listContainer = document.getElementById('events-list-container');
  const timelineContainer = document.getElementById('events-timeline-container');
  
  if (view === 'list') {
    listBtn?.classList.add('active');
    timelineBtn?.classList.remove('active');
    if (listContainer) listContainer.style.display = 'block';
    if (timelineContainer) timelineContainer.style.display = 'none';
  } else {
    listBtn?.classList.remove('active');
    timelineBtn?.classList.add('active');
    if (listContainer) listContainer.style.display = 'none';
    if (timelineContainer) timelineContainer.style.display = 'block';
    renderEventsTimeline();
  }
}

// Render timeline view (simplified for now)
async function renderEventsTimeline() {
  const container = document.getElementById('events-timeline-container');
  if (!container) return;
  
  const data = await loadHistoricalEvents();
  if (!data) {
    container.innerHTML = '<div class="events-timeline-loading">Failed to load timeline.</div>';
    return;
  }
  
  // Filter events
  const filteredEvents = getFilteredEvents(data.events || []);
  
  if (filteredEvents.length === 0) {
    container.innerHTML = '<div class="events-no-results">No events match your filters.</div>';
    return;
  }
  
  // Sort chronologically
  filteredEvents.sort((a, b) => getEventSortKey(a) - getEventSortKey(b));
  
  // Simple timeline representation for now
  let html = '<div class="timeline-simple">';
  
  filteredEvents.forEach(event => {
    const year = event.dates?.gregorian?.year;
    const yearDisplay = year !== undefined ? formatYear(year) : '—';
    const icon = getTypeIcon(event.type);
    
    html += `
      <div class="timeline-item" onclick="openEventDetail('${event.id}')">
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
  
  // Add simple timeline styles inline for now
  html = `
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
  ` + html;
  
  container.innerHTML = html;
}

// Load v2 historical events data
let historicalEventsDataV2 = null;
async function loadHistoricalEventsV2() {
  if (historicalEventsDataV2) return historicalEventsDataV2;
  
  try {
    const response = await fetch('/historical-events-v2.json');
    historicalEventsDataV2 = await response.json();
    return historicalEventsDataV2;
  } catch (error) {
    console.error('Failed to load historical events v2:', error);
    return null;
  }
}

// Helper to convert Julian Day to date
// Uses Julian calendar for dates before 1582, Gregorian after
function jdToGregorianLocal(jd, forceJulian = false) {
  // Use EventResolver if available
  if (typeof EventResolver !== 'undefined') {
    // Use Julian calendar for ancient dates (before Oct 15, 1582 = JD 2299161)
    const useJulian = forceJulian || jd < 2299161;
    if (useJulian && EventResolver.julianDayToJulianCalendar) {
      const result = EventResolver.julianDayToJulianCalendar(jd);
      result.isJulian = true;
      return result;
    }
    if (EventResolver.julianDayToGregorian) {
      return EventResolver.julianDayToGregorian(jd);
    }
  }
  
  // Fallback calculation
  const Z = Math.floor(jd + 0.5);
  const F = (jd + 0.5) - Z;
  
  // Use Julian calendar for ancient dates
  let A;
  const useJulian = forceJulian || jd < 2299161;
  if (useJulian) {
    A = Z; // No Gregorian correction
  } else {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  
  const day = B - D - Math.floor(30.6001 * E);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  
  // Return astronomical year numbering
  return { year, month, day, isJulian: useJulian };
}

// Helper to normalize event data from v1 or v2 format
function normalizeEventForDisplay(event, data, isV2 = false) {
  if (!event) return null;
  
  // For v2 format, convert start/end to dates format for compatibility
  if (isV2 || event.start) {
    let lunar = event.start?.lunar || {};
    let gregorian = event.start?.gregorian || event.start?.fixed?.gregorian || {};
    const regal = event.start?.regal;
    
    // Try to resolve dates using EventResolver
    let resolvedStartJD = null;
    let resolvedEndJD = null;
    
    if (typeof EventResolver !== 'undefined' && data) {
      try {
        const profile = (typeof getTimelineProfile === 'function') ? getTimelineProfile() : EventResolver.DEFAULT_PROFILE;
        const resolved = EventResolver.resolveEvent(event, profile, data.epochs || {}, {
          allEvents: data.events || [],
          resolvedEvents: new Map(),
          resolutionStack: []
        });
        
        if (resolved) {
          resolvedStartJD = resolved.startJD;
          resolvedEndJD = resolved.endJD;
          
          // Always compute full Gregorian date from resolved JD
          if (resolvedStartJD) {
            const startGreg = jdToGregorianLocal(resolvedStartJD);
            gregorian = { 
              year: startGreg.year, 
              month: startGreg.month, 
              day: startGreg.day,
              isJulian: startGreg.isJulian
            };
            
            // Also compute lunar date from JD if we have the resolver
            if (typeof EventResolver !== 'undefined' && EventResolver.julianDayToLunar) {
              const lunarDate = EventResolver.julianDayToLunar(resolvedStartJD, profile);
              if (lunarDate) {
                lunar = {
                  year: lunarDate.year,
                  month: lunarDate.month,
                  day: lunarDate.day,
                  ...lunar // Preserve any extra fields like time_of_day
                };
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not resolve event dates:', err);
      }
    }
    
    return {
      ...event,
      dates: {
        lunar: lunar,
        gregorian: gregorian,
        regal: regal ? { reign: regal.epoch, year: regal.year } : null
      },
      resolvedStartJD,
      resolvedEndJD,
      _isV2: true,
      _data: data
    };
  }
  
  // v1 format - already has dates
  return { ...event, _isV2: false, _data: data };
}

// Open event detail modal
async function openEventDetail(eventId) {
  // Try v1 data first
  const dataV1 = await loadHistoricalEvents();
  let event = dataV1?.events?.find(e => e.id === eventId);
  let data = dataV1;
  let isV2 = false;
  
  // If not found in v1, try v2
  if (!event) {
    const dataV2 = await loadHistoricalEventsV2();
    event = dataV2?.events?.find(e => e.id === eventId);
    data = dataV2;
    isV2 = true;
    
    // If still not found, check if this is a prophecy ID (format: parent-event-id-prophecy-id)
    // Try to find parent event that has this prophecy
    if (!event && dataV2?.events) {
      for (const e of dataV2.events) {
        if (e.prophecies) {
          const prophecy = e.prophecies.find(p => `${e.id}-${p.id}` === eventId);
          if (prophecy) {
            // Found the parent event - use it but note the prophecy
            event = e;
            event._selectedProphecy = prophecy;
            break;
          }
        }
      }
    }
  }
  
  if (!event) {
    console.warn('Event not found:', eventId);
    return;
  }
  
  // Normalize event data
  const normalizedEvent = normalizeEventForDisplay(event, data, isV2);
  
  selectedEventId = eventId;
  
  // Populate modal
  document.getElementById('event-detail-title').textContent = normalizedEvent.title;
  
  // Display Lunar date(s) - for lunar year durations, the lunar date is preserved
  let lunarStr = formatLunarDate(normalizedEvent.dates?.lunar);
  const dur = normalizedEvent.duration;
  const isLunarDuration = dur && (dur.unit === 'lunar_years' || dur.unit === 'months' || dur.unit === 'lunar_weeks');
  const isRegalDuration = dur && dur.unit === 'regal_years';
  
  if (dur && normalizedEvent.resolvedEndJD && normalizedEvent.resolvedStartJD) {
    const unitLabels = {
      'days': 'days', 'weeks': 'weeks', 'lunar_weeks': 'lunar weeks',
      'months': 'months', 'solar_years': 'solar years',
      'lunar_years': 'lunar years', 'regal_years': 'regal years'
    };
    const unitStr = unitLabels[dur.unit] || dur.unit || 'years';
    
    if (isRegalDuration && (dur.reckoning === 'spring-to-spring' || dur.reckoning === 'fall-to-fall')) {
      // For regal years: start Nisan 1, end Adar 29/30 (last day before next Nisan 1)
      const startLunar = formatLunarDate(normalizedEvent.dates?.lunar) || 'Nisan 1';
      const endLunar = dur.reckoning === 'spring-to-spring' ? 'Adar 29' : 'Elul 29';
      // Add years from resolved dates
      const startGreg = normalizedEvent.dates?.gregorian || (normalizedEvent.resolvedStartJD ? jdToGregorianLocal(normalizedEvent.resolvedStartJD) : null);
      const endGreg = normalizedEvent.resolvedEndJD ? jdToGregorianLocal(normalizedEvent.resolvedEndJD) : null;
      const startYearStr = startGreg ? `, ${formatYear(startGreg.year)}` : '';
      const endYearStr = endGreg ? `, ${formatYear(endGreg.year)}` : '';
      lunarStr = `${startLunar}${startYearStr} → ${endLunar}${endYearStr} (${dur.value} ${unitStr})`;
    } else if (isLunarDuration) {
      // For lunar durations, convert resolved JDs to actual lunar dates
      const profile = (typeof getTimelineProfile === 'function') ? getTimelineProfile() : EventResolver.DEFAULT_PROFILE;
      
      let startLunarDate = null;
      let endLunarDate = null;
      
      // Convert JDs to lunar dates using EventResolver
      if (typeof EventResolver !== 'undefined' && EventResolver.julianDayToLunar) {
        if (normalizedEvent.resolvedStartJD) {
          startLunarDate = EventResolver.julianDayToLunar(normalizedEvent.resolvedStartJD, profile);
        }
        if (normalizedEvent.resolvedEndJD) {
          endLunarDate = EventResolver.julianDayToLunar(normalizedEvent.resolvedEndJD, profile);
        }
      }
      
      // Format the lunar dates
      const startLunarStr = startLunarDate 
        ? formatLunarDate({ month: startLunarDate.month, day: startLunarDate.day, year: startLunarDate.year })
        : formatLunarDate(normalizedEvent.dates?.lunar);
      const endLunarStr = endLunarDate
        ? formatLunarDate({ month: endLunarDate.month, day: endLunarDate.day, year: endLunarDate.year })
        : startLunarStr;
      
      lunarStr = `${startLunarStr} → ${endLunarStr} (${dur.value} ${unitStr})`;
    } else {
      lunarStr += ` + ${dur.value} ${unitStr}`;
    }
    if (dur.reckoning) lunarStr += ` [${dur.reckoning}]`;
  }
  document.getElementById('event-detail-lunar').textContent = lunarStr;
  
  // Display Gregorian date(s) - calculated from profile settings
  let gregorianStr = '';
  let startGreg = null;
  let endGreg = null;
  
  if (normalizedEvent.resolvedStartJD) {
    startGreg = jdToGregorianLocal(normalizedEvent.resolvedStartJD);
    gregorianStr = formatGregorianDate(startGreg);
  } else {
    gregorianStr = formatGregorianDate(normalizedEvent.dates?.gregorian);
  }
  
  if (normalizedEvent.resolvedEndJD && normalizedEvent.resolvedStartJD) {
    endGreg = jdToGregorianLocal(normalizedEvent.resolvedEndJD);
    const endDateStr = formatGregorianDate(endGreg);
    // Always show end date for duration events (even if formatted string looks similar)
    if (dur) {
      gregorianStr += ` → ${endDateStr}`;
    } else if (endDateStr && endDateStr !== gregorianStr) {
      gregorianStr += ` → ${endDateStr}`;
    }
  }
  
  document.getElementById('event-detail-gregorian').textContent = gregorianStr;
  document.getElementById('event-detail-desc').textContent = normalizedEvent.description || '';
  
  // Regal year
  const regalRow = document.getElementById('event-detail-regal-row');
  if (normalizedEvent.dates?.regal) {
    const epochKey = normalizedEvent.dates.regal.reign;
    const epoch = data.epochs?.[epochKey];
    const epochName = epoch?.name || epochKey;
    document.getElementById('event-detail-regal').textContent = 
      `Year ${normalizedEvent.dates.regal.year} of ${epochName}`;
    regalRow.style.display = 'flex';
  } else {
    regalRow.style.display = 'none';
  }
  
  // Sources - make scripture references clickable
  const sourcesList = document.getElementById('event-detail-sources-list');
  if (normalizedEvent.sources && normalizedEvent.sources.length > 0) {
    sourcesList.innerHTML = normalizedEvent.sources.map(source => {
      const typeClass = source.type === 'historical' ? 'historical' : 
                       source.type === 'astronomical' ? 'astronomical' : '';
      // Make scripture references clickable links
      if (source.type === 'scripture' && typeof openBibleReader === 'function') {
        const escapedRef = source.ref.replace(/'/g, "\\'");
        return `<li class="${typeClass}"><a href="#" class="scripture-link" onclick="openBibleReader('${escapedRef}', '${normalizedEvent.title.replace(/'/g, "\\'")}'); return false;">${source.ref}</a>${source.quote ? `<div class="source-quote">"${source.quote}"</div>` : ''}</li>`;
      }
      return `<li class="${typeClass}">${source.ref}${source.quote ? `<div class="source-quote">"${source.quote}"</div>` : ''}</li>`;
    }).join('');
  } else {
    sourcesList.innerHTML = '<li>No sources listed</li>';
  }
  
  // Article link
  const articleLink = document.getElementById('event-detail-article-link');
  if (normalizedEvent.article) {
    articleLink.href = normalizedEvent.article;
    articleLink.style.display = 'flex';
  } else {
    articleLink.style.display = 'none';
  }
  
  // Validation section (show if event has both lunar and gregorian dates)
  const validationSection = document.getElementById('event-detail-validation');
  const validationContent = document.getElementById('event-detail-validation-content');
  
  const hasLunar = normalizedEvent.dates?.lunar?.month || normalizedEvent.dates?.lunar?.day;
  const hasGregorian = normalizedEvent.dates?.gregorian?.year;
  
  if (normalizedEvent.validation || (hasLunar && hasGregorian)) {
    validationSection.style.display = 'block';
    
    let validationHtml = '';
    
    if (normalizedEvent.validation?.priestly_course) {
      validationHtml += `
        <div style="color: #4caf50; margin-bottom: 8px;">
          ✓ Priestly Course: ${normalizedEvent.validation.priestly_name} (Course ${normalizedEvent.validation.priestly_course})
        </div>
      `;
    }
    
    if (hasLunar && hasGregorian) {
      validationHtml += `
        <div style="color: #888; font-size: 0.9em;">
          This event has both lunar and Gregorian dates specified. 
          Your calendar profile can be validated against this historical anchor point.
        </div>
      `;
    }
    
    validationContent.innerHTML = validationHtml || '<div style="color: #888;">No validation data</div>';
  } else {
    validationSection.style.display = 'none';
  }
  
  // Show modal
  document.getElementById('event-detail-overlay').classList.add('visible');
}

// Close event detail modal
function closeEventDetail(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('event-detail-overlay').classList.remove('visible');
  selectedEventId = null;
}

// Navigate to event date on calendar
async function navigateToEventDate() {
  if (!selectedEventId) return;
  
  // Try v1 data first
  let data = await loadHistoricalEvents();
  let event = data?.events?.find(e => e.id === selectedEventId);
  
  // If not found in v1, try v2
  if (!event) {
    data = await loadHistoricalEventsV2();
    event = data?.events?.find(e => e.id === selectedEventId);
  }
  
  if (!event) return;
  
  // Normalize for compatibility
  const normalizedEvent = normalizeEventForDisplay(event, data, !!event.start);
  
  // Close modal
  closeEventDetail();
  
  // Get year from event
  let year = null;
  if (normalizedEvent.dates?.gregorian?.year !== undefined) {
    year = normalizedEvent.dates.gregorian.year;
  }
  
  if (year !== null) {
    // Navigate to calendar with this year
    state.year = year;
    generateCalendar();
    
    // If we have a lunar month/day, navigate to that specific day
    if (event.dates?.lunar?.month) {
      const monthIndex = event.dates.lunar.month - 1;
      const lunarDay = event.dates?.lunar?.day || 1;
      
      if (monthIndex >= 0 && monthIndex < state.lunarMonths?.length) {
        // Use similar logic to jumpToFeast
        state.currentMonthIndex = monthIndex;
        state.highlightedLunarDay = lunarDay;
        
        // Find the day object and show detail
        const month = state.lunarMonths[monthIndex];
        const dayObj = month.days.find(d => d.lunarDay === lunarDay);
        if (dayObj) {
          state.selectedTimestamp = getSunriseTimestamp(dayObj.gregorianDate);
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
    }
    
    // Push the calendar URL to history BEFORE navigateTo so back button returns to events
    // (navigateTo uses replaceState, so we need to push first)
    if (typeof buildPathURL === 'function') {
      const calendarURL = buildPathURL();
      window.history.pushState({ view: 'calendar' }, '', calendarURL);
    }
    navigateTo('calendar');
  } else {
    // No year - but if we have lunar month/day, navigate to that month/day in current calendar
    const lunarMonth = normalizedEvent.dates?.lunar?.month || event.start?.lunar?.month;
    const lunarDay = normalizedEvent.dates?.lunar?.day || event.start?.lunar?.day || 1;
    
    if (lunarMonth && state.lunarMonths?.length) {
      const monthIndex = lunarMonth - 1;
      
      if (monthIndex >= 0 && monthIndex < state.lunarMonths.length) {
        state.currentMonthIndex = monthIndex;
        state.highlightedLunarDay = lunarDay;
        
        // Find the day object and show detail
        const month = state.lunarMonths[monthIndex];
        const dayObj = month.days.find(d => d.lunarDay === lunarDay);
        if (dayObj) {
          state.selectedTimestamp = getSunriseTimestamp(dayObj.gregorianDate);
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
    }
    
    // Push state and navigate
    if (typeof buildPathURL === 'function') {
      const calendarURL = buildPathURL();
      window.history.pushState({ view: 'calendar' }, '', calendarURL);
    }
    navigateTo('calendar');
  }
}

// Initialize events page
function initEventsPage() {
  // Update profile name display
  const profileNameEl = document.getElementById('events-profile-name');
  if (profileNameEl && typeof getCurrentProfileName === 'function') {
    profileNameEl.textContent = getCurrentProfileName();
  }
  
  // Render events list
  renderEventsList();
}

// Export for use in navigation
if (typeof window !== 'undefined') {
  window.loadHistoricalEvents = loadHistoricalEvents;
  window.loadHistoricalEventsV2 = loadHistoricalEventsV2;
  window.renderEventsList = renderEventsList;
  window.filterEvents = filterEvents;
  window.setEventsView = setEventsView;
  window.openEventDetail = openEventDetail;
  window.closeEventDetail = closeEventDetail;
  window.navigateToEventDate = navigateToEventDate;
  window.initEventsPage = initEventsPage;
}
