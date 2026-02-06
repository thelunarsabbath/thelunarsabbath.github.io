// Bible Events Loader
// Indexes resolved timeline events by lunar month/day for calendar day detail display
// Uses ResolvedEventsCache singleton for resolved event data

let bibleEventsByMonthDay = null;

// Load bible events from resolved timeline events
// Uses getResolvedEvents() which already has all dates calculated
async function loadBibleEvents() {
  bibleEventsByMonthDay = {};
  let totalEvents = 0;
  
  console.log('[BibleEvents] loadBibleEvents starting...');
  
  // Get resolved events from ResolvedEventsCache singleton
  let resolvedEvents = [];
  if (typeof ResolvedEventsCache !== 'undefined') {
    const profile = (typeof getTimelineProfile === 'function') ? getTimelineProfile() : 
                    (typeof EventResolver !== 'undefined' ? EventResolver.DEFAULT_PROFILE : null);
    resolvedEvents = ResolvedEventsCache.getEvents(profile);
    if (!resolvedEvents) {
      resolvedEvents = await ResolvedEventsCache.getEventsAsync(profile);
    }
    console.log('[BibleEvents] Got', resolvedEvents?.length || 0, 'events from ResolvedEventsCache');
  }
  
  if (!resolvedEvents || resolvedEvents.length === 0) {
    console.warn('[BibleEvents] No resolved events available for calendar display');
    return false;
  }
  
  // Event types that should NOT show on calendar (chronology markers, not scriptural events)
  const excludeEventTypes = new Set([
    'reign',          // "King X begins to reign" - floods Nisan 1 with every king
    'accession',      // Accession year markers
    'coregency',      // Coregency markers
    'duration',       // Duration markers (not point events)
    'synchronism',    // Chronological synchronisms
    'chronological',  // Pure chronology markers
    'chronology'      // Chronology reference points
  ]);
  
  // Tags that explicitly exclude from calendar
  const excludeTags = new Set([
    'hide-from-calendar',
    'chronology-only'
  ]);
  
  // Debug counters
  let noLunarDate = 0;
  let excludedByType = 0;
  let excludedByTag = 0;
  
  // Index events by lunar month/day for calendar lookup
  // INCLUDE any event with a specific date UNLESS explicitly excluded
  for (const event of resolvedEvents) {
    // Get lunar date from resolved event
    // Timeline resolver uses: _lunarMonth, _lunarDay, _lunarYear (or source.start.lunar)
    // Historical-events.js uses: dates.lunar.month, dates.lunar.day
    const lunarMonth = event._lunarMonth ?? event.dates?.lunar?.month ?? event.source?.start?.lunar?.month;
    const lunarDay = event._lunarDay ?? event.dates?.lunar?.day ?? event.source?.start?.lunar?.day;
    const lunarYear = event._lunarYear ?? event.dates?.lunar?.year ?? event.resolved?.startGregorian?.year;
    
    // Only include events that have resolved lunar month AND day
    if (!lunarMonth || !lunarDay) {
      noLunarDate++;
      continue;
    }
    
    // Skip events explicitly excluded by type (chronology markers)
    if (excludeEventTypes.has(event.type)) {
      excludedByType++;
      continue;
    }
    
    // Skip events explicitly excluded by flag or tag
    if (event.hideFromCalendar === true) continue;
    if (event.tags?.some(t => excludeTags.has(t))) {
      excludedByTag++;
      continue;
    }
    
    const key = `${lunarMonth}-${lunarDay}`;
    if (!bibleEventsByMonthDay[key]) {
      bibleEventsByMonthDay[key] = [];
    }
    
    // Get the year for display
    const originalYear = lunarYear ?? event.resolved?.startGregorian?.year;
    
    // Format year string
    let yearStr = null;
    if (originalYear !== undefined && originalYear !== null) {
      yearStr = originalYear <= 0 
        ? `${1 - originalYear} BC`  // Astronomical year 0 = 1 BC, -1 = 2 BC
        : `${originalYear} AD`;
    }
    
    // Build scripture verse references
    const scriptureRefs = event.sources
      ?.filter(s => s.type === 'scripture')
      .map(s => s.ref)
      .join('; ') || '';
    
    // Get first scripture quote if available
    const scriptureQuote = event.sources
      ?.find(s => s.type === 'scripture' && s.quote)?.quote || '';
    
    // Create calendar event entry
    const calendarEvent = {
      month: lunarMonth,
      day: lunarDay,
      title: event.title,
      description: event.description,
      verse: scriptureRefs,
      quote: scriptureQuote,
      bookChapter: event.article,
      icon: event.icon,
      image: event.image,
      // Expandable details section
      details: event.details,
      detailsTitle: event.detailsTitle,
      // No condition - show as anniversary every year
      condition: null,
      // Store original year for anniversary display
      originalYear: originalYear,
      yearStr: yearStr,
      // Pass through original event for rich data access (id, etc.)
      _historicalEvent: event
    };
    
    // Check for duplicates by event ID
    const duplicateIndex = bibleEventsByMonthDay[key].findIndex(e => 
      e._historicalEvent?.id === event.id
    );
    
    if (duplicateIndex >= 0) {
      // Replace with newer version
      bibleEventsByMonthDay[key][duplicateIndex] = calendarEvent;
    } else {
      bibleEventsByMonthDay[key].push(calendarEvent);
      totalEvents++;
    }
  }
  
  console.log(`[BibleEvents] Indexed ${totalEvents} events by date from ${resolvedEvents.length} resolved events`);
  console.log(`[BibleEvents] Filtered: ${noLunarDate} no lunar date, ${excludedByType} excluded by type, ${excludedByTag} excluded by tag`);
  
  // Log sample of what we indexed (for debugging)
  const sampleKeys = Object.keys(bibleEventsByMonthDay).slice(0, 5);
  console.log('[BibleEvents] Sample indexed dates:', sampleKeys.map(k => `${k}: ${bibleEventsByMonthDay[k].length} events`));
  
  return totalEvents > 0;
}

// Get bible events for a specific lunar month and day
// All resolved events are shown as anniversaries on their date
function getBibleEvents(month, day, gregorianYear = null) {
  if (!bibleEventsByMonthDay) return [];
  const key = `${month}-${day}`;
  return bibleEventsByMonthDay[key] || [];
}

// Export for browser
if (typeof window !== 'undefined') {
  window.loadBibleEvents = loadBibleEvents;
  window.getBibleEvents = getBibleEvents;
}
