/**
 * GlobalSearch - Global search functionality in top navigation
 * 
 * Supports:
 * - Strong's numbers (H1234, G5678) - opens Strong's panel
 * - Verse references (John 3:16, Gen 1:1) - navigates to verse
 * - Text search - searches Bible and shows results
 */

const GlobalSearch = {
  // State
  resultsHeight: 250,  // Default height in pixels
  isExpanded: false,   // Mobile expansion state
  currentQuery: null,
  cachedResults: new Map(),  // Cache recent searches for back navigation
  resizeStart: null,
  allMatchesCache: null,     // Cache all Bible matches for current query (for infinite scroll)
  allEventsCache: null,      // Cache all event matches for current query
  currentSearchData: null,   // Current search results data
  displayedCount: 0,         // Number of Bible results currently displayed
  displayedEventCount: 0,    // Number of event results currently displayed
  isLoadingMore: false,      // Loading more results flag
  _scrollHandler: null,      // Scroll handler reference for cleanup
  
  /**
   * Initialize global search
   */
  init() {
    // Load saved results height from localStorage
    try {
      const savedHeight = localStorage.getItem('globalSearchResultsHeight');
      if (savedHeight) {
        this.resultsHeight = Math.max(100, Math.min(parseInt(savedHeight), window.innerHeight * 0.8));
      }
    } catch (e) {}
    
    // Set up resize handle
    this.setupResizeHandle();
    
    // Set up keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Escape closes search results
      if (e.key === 'Escape') {
        const results = document.getElementById('global-search-results');
        if (results && results.classList.contains('open')) {
          this.close();
          e.preventDefault();
        }
      }
      // Ctrl/Cmd + K opens search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        this.toggle();
        e.preventDefault();
      }
    });
    
    // Close results when clicking outside
    document.addEventListener('click', (e) => {
      const searchContainer = document.getElementById('global-search-container');
      const resultsContainer = document.getElementById('global-search-results');
      if (!searchContainer?.contains(e.target) && !resultsContainer?.contains(e.target)) {
        // Don't close if clicking a result link
        if (!e.target.closest('.search-result-item')) {
          // Only close results, not the mobile expansion
        }
      }
    });
    
    // Subscribe to AppStore for state sync
    this.subscribeToStore();
    
    // Check initial state (for page load with ?q= in URL)
    this.checkInitialState();
  },
  
  /**
   * Toggle search expansion (mobile)
   */
  toggle() {
    const container = document.getElementById('global-search-container');
    const input = document.getElementById('global-search-input');
    
    if (window.innerWidth <= 600) {
      // Mobile: toggle expansion
      if (container.classList.contains('expanded')) {
        this.collapseInput();
      } else {
        this.expandInput();
      }
    } else {
      // Desktop: focus input
      if (input) {
        input.focus();
        input.select();
      }
    }
  },
  
  /**
   * Expand search input (mobile)
   */
  expandInput() {
    const container = document.getElementById('global-search-container');
    const input = document.getElementById('global-search-input');
    
    container?.classList.add('expanded');
    this.isExpanded = true;
    
    if (input) {
      input.focus();
    }
  },
  
  /**
   * Collapse search input (mobile)
   */
  collapseInput() {
    const container = document.getElementById('global-search-container');
    container?.classList.remove('expanded');
    this.isExpanded = false;
  },
  
  /**
   * Handle focus event
   */
  onFocus() {
    // On mobile, expand when focused
    if (window.innerWidth <= 600) {
      this.expandInput();
    }
    // Show hints if input is empty
    const input = document.getElementById('global-search-input');
    if (!input?.value.trim()) {
      this.showHints();
    }
  },
  
  onInput(value) {
    // Hide hints as soon as user starts typing
    if (value.trim()) {
      this.hideHints();
    } else {
      this.showHints();
    }
  },
  
  showHints() {
    const hints = document.getElementById('search-hints');
    if (hints) hints.style.display = 'block';
  },
  
  hideHints() {
    const hints = document.getElementById('search-hints');
    if (hints) hints.style.display = 'none';
  },
  
  useHint(query) {
    const input = document.getElementById('global-search-input');
    if (input) {
      input.value = query;
      input.focus();
    }
    this.hideHints();
    this.search(query);
  },
  
  /**
   * Handle blur event
   */
  onBlur(event) {
    // Small delay to allow clicks on hints/buttons/results
    setTimeout(() => {
      const container = document.getElementById('global-search-container');
      const input = document.getElementById('global-search-input');
      const results = document.getElementById('global-search-results');
      
      // Don't collapse if focus moved to results or hints
      if (results?.contains(document.activeElement)) return;
      if (container?.contains(document.activeElement)) return;
      
      // Hide hints
      this.hideHints();
      
      // On mobile, collapse if empty
      if (window.innerWidth <= 600 && !input?.value.trim()) {
        this.collapseInput();
      }
    }, 200);
  },
  
  /**
   * Main search function - dispatches to AppStore (unidirectional flow)
   * The actual search is triggered by the store subscriber when state changes
   */
  search(query) {
    if (!query || !query.trim()) return;
    
    query = query.trim();
    
    // Check for Strong's number (H1234, G5678) - navigate directly, don't use global search state
    const strongsMatch = query.match(/^([HGhg])0*(\d+)$/);
    if (strongsMatch) {
      const prefix = strongsMatch[1].toUpperCase();
      const num = strongsMatch[2];
      const strongsNum = prefix + num;
      this.navigateToStrongs(strongsNum);
      return;
    }
    
    // Check for verse reference (John 3:16, Gen 1:1) - navigate directly
    const verseRef = this.parseVerseReference(query);
    if (verseRef) {
      this.navigateToVerse(verseRef);
      return;
    }
    
    // Check for Gregorian date (1/15/2025, 2025-01-15, January 15, etc.) - navigate to calendar
    const dateRef = this.parseGregorianDate(query);
    if (dateRef) {
      this.navigateToDate(dateRef);
      return;
    }
    
    // Check for Hebrew/Lunar date (Nisan 1, 32 AD or Tishri 15, 2025) - navigate to calendar
    const lunarRef = this.parseLunarDate(query);
    if (lunarRef) {
      this.navigateToLunarDate(lunarRef);
      return;
    }
    
    // For text searches, dispatch to AppStore - the subscriber will trigger the actual search
    if (typeof AppStore !== 'undefined') {
      console.log('[GlobalSearch] Dispatching SET_GLOBAL_SEARCH:', query);
      AppStore.dispatch({ type: 'SET_GLOBAL_SEARCH', query: query });
    }
  },
  
  /**
   * Parse a Gregorian date from query
   * Supports many formats: MM/DD/YYYY, YYYY-MM-DD, Month DD YYYY, etc.
   * Returns { year, month, day } or null
   */
  parseGregorianDate(query) {
    // Strip periods from abbreviations (e.g., "Nov." → "Nov", "Jan." → "Jan")
    const q = query.trim().replace(/\./g, '');
    const currentYear = new Date().getFullYear();
    
    // Month names for parsing
    const monthNames = {
      'january': 1, 'jan': 1,
      'february': 2, 'feb': 2,
      'march': 3, 'mar': 3,
      'april': 4, 'apr': 4,
      'may': 5,
      'june': 6, 'jun': 6,
      'july': 7, 'jul': 7,
      'august': 8, 'aug': 8,
      'september': 9, 'sep': 9, 'sept': 9,
      'october': 10, 'oct': 10,
      'november': 11, 'nov': 11,
      'december': 12, 'dec': 12
    };
    
    let year, month, day;
    
    // ISO format: YYYY-MM-DD
    let match = q.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      year = parseInt(match[1]);
      month = parseInt(match[2]);
      day = parseInt(match[3]);
    }
    
    // US format: MM/DD/YYYY or M/D/YYYY or MM/DD/YY or M/D/YY
    if (!match) {
      match = q.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
      if (match) {
        month = parseInt(match[1]);
        day = parseInt(match[2]);
        if (match[3]) {
          year = parseInt(match[3]);
          if (year < 100) year += 2000; // 25 -> 2025
        } else {
          year = currentYear;
        }
      }
    }
    
    // European format: DD.MM.YYYY or DD-MM-YYYY
    if (!match) {
      match = q.match(/^(\d{1,2})[.\-](\d{1,2})[.\-](\d{2,4})$/);
      if (match) {
        day = parseInt(match[1]);
        month = parseInt(match[2]);
        year = parseInt(match[3]);
        if (year < 100) year += 2000;
      }
    }
    
    // Month DD, YYYY [BC/AD] or Month DD YYYY [BC/AD] (e.g., "March 11, 1446 BC" or "Jan 15 2025")
    if (!match) {
      match = q.match(/^([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{1,4})\s*(bc|ad|bce|ce)?)?$/i);
      if (match) {
        const monthStr = match[1].toLowerCase();
        if (monthNames[monthStr]) {
          month = monthNames[monthStr];
          day = parseInt(match[2]);
          year = match[3] ? parseInt(match[3]) : currentYear;
          const era = (match[4] || '').toLowerCase();
          if (era === 'bc' || era === 'bce') year = 1 - year; // 1446 BC → astronomical -1445
        }
      }
    }
    
    // DD Month YYYY [BC/AD] (e.g., "15 January 2025" or "15 Jan 1446 BC")
    if (!match || !month) {
      match = q.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{1,4})\s*(bc|ad|bce|ce)?)?$/i);
      if (match) {
        const monthStr = match[2].toLowerCase();
        if (monthNames[monthStr]) {
          day = parseInt(match[1]);
          month = monthNames[monthStr];
          year = match[3] ? parseInt(match[3]) : currentYear;
          const era = (match[4] || '').toLowerCase();
          if (era === 'bc' || era === 'bce') year = 1 - year;
        }
      }
    }
    
    // Validate the date
    if (year && month && day) {
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        // Basic validation - could be more strict but Date will handle edge cases
        const testDate = new Date(year, month - 1, day);
        if (testDate.getMonth() === month - 1 && testDate.getDate() === day) {
          return { year, month, day };
        }
      }
    }
    
    return null;
  },
  
  /**
   * Navigate to calendar on a specific date
   */
  navigateToDate(date) {
    // Close search completely and navigate to calendar for this date
    this.close();
    if (typeof AppStore !== 'undefined') {
      AppStore.dispatchBatch([
        {
          type: 'SET_GREGORIAN_DATETIME',
          year: date.year,
          month: date.month,
          day: date.day
        },
        {
          type: 'SET_VIEW',
          view: 'calendar'
        }
      ]);
    }
  },
  
  /**
   * Parse a Hebrew/Lunar date from query
   * Supports: "Nisan 1, 32 AD", "Tishri 15, 2025", "15 Nisan 32", etc.
   * Returns { year, month, day } or null (month is 1-based, Nisan = 1)
   */
  parseLunarDate(query) {
    const q = query.trim();
    
    // Hebrew month names (1-based index: Nisan/Abib = 1)
    const hebrewMonths = {
      'nisan': 1, 'nissan': 1, 'abib': 1, 'aviv': 1,
      'iyar': 2, 'iyyar': 2, 'ziv': 2,
      'sivan': 3,
      'tammuz': 4, 'tamuz': 4,
      'av': 5, 'ab': 5,
      'elul': 6,
      'tishri': 7, 'tishrei': 7, 'ethanim': 7,
      'cheshvan': 8, 'heshvan': 8, 'marcheshvan': 8, 'bul': 8,
      'kislev': 9,
      'tevet': 10, 'tebeth': 10,
      'shevat': 11, 'shvat': 11,
      'adar': 12,
      'adar i': 12, 'adar 1': 12,
      'adar ii': 13, 'adar 2': 13, 'veadar': 13
    };
    
    let year, month, day;
    
    // Pattern: Month Day, Year AD/BC or Month Day, Year
    // e.g., "Nisan 1, 32 AD", "Tishri 15, 2025", "Nisan 14, 32 ad"
    let match = q.match(/^([a-z]+(?:\s+[i12]+)?)\s+(\d{1,2})(?:,?\s+(\d+)\s*(ad|bc|bce|ce)?)?$/i);
    if (match) {
      const monthStr = match[1].toLowerCase();
      if (hebrewMonths[monthStr]) {
        month = hebrewMonths[monthStr];
        day = parseInt(match[2]);
        if (match[3]) {
          year = parseInt(match[3]);
          const era = (match[4] || '').toLowerCase();
          if (era === 'bc' || era === 'bce') {
            year = -year + 1; // 1 BC = year 0, 2 BC = year -1, etc.
          }
        } else {
          year = new Date().getFullYear(); // Default to current year
        }
      }
    }
    
    // Pattern: Day Month, Year or Day Month Year
    // e.g., "14 Nisan, 32 AD", "15 Tishri 2025"
    if (!month) {
      match = q.match(/^(\d{1,2})\s+([a-z]+(?:\s+[i12]+)?)(?:,?\s+(\d+)\s*(ad|bc|bce|ce)?)?$/i);
      if (match) {
        const monthStr = match[2].toLowerCase();
        if (hebrewMonths[monthStr]) {
          day = parseInt(match[1]);
          month = hebrewMonths[monthStr];
          if (match[3]) {
            year = parseInt(match[3]);
            const era = (match[4] || '').toLowerCase();
            if (era === 'bc' || era === 'bce') {
              year = -year + 1;
            }
          } else {
            year = new Date().getFullYear();
          }
        }
      }
    }
    
    // Validate
    if (year !== undefined && month && day) {
      if (day >= 1 && day <= 30) { // Hebrew months have max 30 days
        return { year, month, day };
      }
    }
    
    return null;
  },
  
  /**
   * Navigate to calendar on a specific lunar date
   */
  navigateToLunarDate(date) {
    this.close();
    
    // Navigate using AppStore - use SET_LUNAR_DATETIME then SET_VIEW
    if (typeof AppStore !== 'undefined') {
      AppStore.dispatchBatch([
        {
          type: 'SET_LUNAR_DATETIME',
          year: date.year,
          month: date.month,
          day: date.day
        },
        {
          type: 'SET_VIEW',
          view: 'calendar'
        }
      ]);
    }
  },
  
  // List of valid Bible book names for validation (canonical names from KJV)
  VALID_BOOKS: new Set([
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
    '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther',
    'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
    'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
    'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
    '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
    'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
    'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
    'Jude', 'Revelation'
  ]),
  
  /**
   * Parse a verse reference from query
   * Returns { book, chapter, verse } or null
   */
  parseVerseReference(query) {
    // Pattern: Book Chapter:Verse or Book Chapter
    // Book can be "1 John", "2 Kings", etc.
    const match = query.match(/^(\d?\s*[A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+)(?::(\d+))?$/);
    
    if (match) {
      const book = match[1].trim();
      const chapter = parseInt(match[2]);
      const verse = match[3] ? parseInt(match[3]) : null;
      
      // Normalize book name (handles abbreviations like "Gen", "Jn", etc.)
      let normalized = book;
      if (typeof normalizeBookName === 'function') {
        normalized = normalizeBookName(book);
      }
      
      // Verify it's a valid Bible book
      if (normalized && this.VALID_BOOKS.has(normalized)) {
        return { book: normalized, chapter, verse };
      }
    }
    
    return null;
  },
  
  /**
   * Navigate to Strong's panel
   */
  navigateToStrongs(strongsNum) {
    this.close();
    
    // Open Strong's panel
    if (typeof showStrongsPanel === 'function') {
      showStrongsPanel(strongsNum, '', '', null);
    } else if (typeof AppStore !== 'undefined') {
      AppStore.dispatch({ type: 'OPEN_STRONGS', strongsId: strongsNum });
    }
  },
  
  /**
   * Navigate to verse
   */
  navigateToVerse(ref) {
    this.close();
    
    // Navigate using AppStore
    if (typeof AppStore !== 'undefined') {
      const params = {
        contentType: 'bible',
        book: ref.book,
        chapter: ref.chapter
      };
      if (ref.verse) params.verse = ref.verse;
      
      AppStore.dispatch({
        type: 'SET_VIEW',
        view: 'reader',
        params
      });
    }
  },
  
  /**
   * Execute Bible text search (internal - called by subscriber when state changes)
   * This is the actual search execution, derived from state
   */
  async executeSearch(query) {
    console.log('[GlobalSearch] executeSearch called with:', query);
    
    // Check cache first
    if (this.cachedResults.has(query)) {
      console.log('[GlobalSearch] Using cached results for:', query);
      this.showResults(this.cachedResults.get(query));
      return;
    }
    
    // Show loading state
    this.showResultsContainer();
    const content = document.getElementById('search-results-content');
    if (content) {
      content.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-text-muted);">Searching...</div>';
    }
    
    // Check if Bible data is loaded, if not try to load it
    let bibleData = typeof getBibleData === 'function' ? getBibleData() : null;
    if (!bibleData || bibleData.length === 0) {
      if (content) {
        content.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-text-muted);">Loading Bible...</div>';
      }
      
      // Try to load Bible
      if (typeof loadBible === 'function') {
        try {
          await loadBible(false);
        } catch (e) {
          console.error('[GlobalSearch] Failed to load Bible:', e);
        }
      }
    }
    
    // Check if timeline events are loaded, if not wait for them
    let timelineEvents = typeof getTimelineResolvedEvents === 'function' ? getTimelineResolvedEvents() : [];
    if (timelineEvents.length === 0) {
      if (content) {
        content.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-text-muted);">Loading Timeline...</div>';
      }
      
      // Try to trigger timeline loading and wait for it
      try {
        await this.waitForTimelineEvents();
      } catch (e) {
        console.error('[GlobalSearch] Failed to load timeline events:', e);
      }
    }
    
    // Reset state for new search
    this.displayedCount = 0;
    this.displayedEventCount = 0;
    this.isLoadingMore = false;
    
    // Clear matches cache if query changed
    if (this.allMatchesCache?.query !== query) {
      this.allMatchesCache = null;
    }
    if (this.allEventsCache?.query !== query) {
      this.allEventsCache = null;
    }
    
    // Perform searches (first page of each)
    const bibleResults = this.performTextSearch(query, 0, 50);
    const eventResults = this.performEventSearch(query);
    
    // Combine results
    const combinedResults = {
      query: query,
      bible: bibleResults,
      events: eventResults,
      error: bibleResults.error && eventResults.events.length === 0 ? bibleResults.error : null
    };
    
    // Cache results
    if (!combinedResults.error) {
      this.cachedResults.set(query, combinedResults);
      // Limit cache size
      if (this.cachedResults.size > 20) {
        const firstKey = this.cachedResults.keys().next().value;
        this.cachedResults.delete(firstKey);
      }
    }
    
    this.showResults(combinedResults);
  },
  
  /**
   * Perform the actual text search - finds ALL matches, returns paginated
   */
  performTextSearch(query, offset = 0, limit = 50) {
    const wordPattern = new RegExp(`\\b${this.escapeRegex(query)}\\b`, 'gi');
    
    // Get Bible data - use getBibleData() function if available (preferred)
    // or fall back to direct variable access
    let transData = null;
    if (typeof getBibleData === 'function') {
      transData = getBibleData();
    } else if (typeof bibleTranslations !== 'undefined') {
      const translation = typeof currentTranslation !== 'undefined' ? currentTranslation : 'kjv';
      transData = bibleTranslations[translation];
    }
    
    // Debug: log what we found
    console.log('[GlobalSearch] Bible data status:', {
      getBibleDataExists: typeof getBibleData === 'function',
      dataLength: transData ? transData.length : 0
    });
    
    if (!transData || transData.length === 0) {
      console.warn('[GlobalSearch] No Bible data available for search');
      return {
        query: query,
        results: [],
        total: 0,
        hasMore: false,
        error: 'Bible not loaded yet. Please wait a moment and try again.'
      };
    }
    
    // Find ALL matches first (or use cached if available)
    let allMatches = this.allMatchesCache?.query === query ? this.allMatchesCache.matches : null;
    
    if (!allMatches) {
      allMatches = [];
      for (const verse of transData) {
        if (verse.text && wordPattern.test(verse.text)) {
          allMatches.push({
            ref: `${verse.book} ${verse.chapter}:${verse.verse}`,
            book: verse.book,
            chapter: verse.chapter,
            verse: verse.verse,
            text: verse.text
          });
        }
      }
      // Cache all matches for infinite scroll
      this.allMatchesCache = { query, matches: allMatches };
      console.log('[GlobalSearch] Found', allMatches.length, 'total matches for:', query);
    }
    
    // Return paginated results
    const results = allMatches.slice(offset, offset + limit);
    
    return {
      query: query,
      results: results,
      total: allMatches.length,
      hasMore: offset + limit < allMatches.length,
      offset: offset,
      limit: limit
    };
  },
  
  /**
   * Search timeline events
   */
  performEventSearch(query) {
    const searchLower = query.toLowerCase().trim();
    
    // Get resolved events from timeline cache
    let events = [];
    if (typeof getTimelineResolvedEvents === 'function') {
      events = getTimelineResolvedEvents() || [];
    }
    
    console.log('[GlobalSearch] Event data status:', {
      getTimelineResolvedEventsExists: typeof getTimelineResolvedEvents === 'function',
      eventsLength: events.length
    });
    
    if (events.length === 0) {
      return { events: [], total: 0 };
    }
    
    // Use cached if available
    if (this.allEventsCache?.query === query) {
      return {
        events: this.allEventsCache.events,
        total: this.allEventsCache.events.length
      };
    }
    
    // Search events by title, description, tags, id
    const matchingEvents = events.filter(event => {
      if (event.startJD === null) return false;
      
      const searchableText = [
        event.title || '',
        event.description || '',
        event.id || '',
        ...(event.tags || [])
      ].join(' ').toLowerCase();
      
      return searchableText.includes(searchLower);
    });
    
    // Sort by date (most recent first for now, or by relevance)
    matchingEvents.sort((a, b) => (b.startJD || 0) - (a.startJD || 0));
    
    // Cache all matching events
    this.allEventsCache = { query, events: matchingEvents };
    console.log('[GlobalSearch] Found', matchingEvents.length, 'matching events for:', query);
    
    return {
      events: matchingEvents,
      total: matchingEvents.length
    };
  },

  /**
   * Escape regex special characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },
  
  /**
   * Show results in the results region (handles combined Bible + Event results)
   */
  showResults(data, appendBible = false) {
    this.showResultsContainer();
    
    const content = document.getElementById('search-results-content');
    
    // Store current state for infinite scroll
    this.currentSearchData = data;
    
    // Handle error state
    if (data.error) {
      if (content) {
        content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--color-accent-gold);">${this.escapeHtml(data.error)}</div>`;
      }
      return;
    }
    
    // Calculate totals
    const bibleTotal = data.bible?.total || 0;
    const eventTotal = data.events?.total || 0;
    const totalResults = bibleTotal + eventTotal;
    
    // Update displayed counts
    if (appendBible) {
      this.displayedCount += data.bible?.results?.length || 0;
    } else {
      this.displayedCount = data.bible?.results?.length || 0;
      this.displayedEventCount = data.events?.events?.length || 0;
    }
    
    if (!content) return;
    
    if (totalResults === 0 && !appendBible) {
      content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--color-text-muted);">No results found for "${this.escapeHtml(data.query)}"</div>`;
      return;
    }
    
    // Build HTML
    let html = '';
    
    if (!appendBible) {
      // First render - show events first (usually fewer), then Bible results
      
      // Event results section (collapsible)
      if (data.events?.events?.length > 0) {
        html += `<div class="search-section search-events-section">
          <div class="search-section-header" onclick="GlobalSearch.toggleSection('events')" style="padding: 8px 12px; background: rgba(255,255,255,0.05); font-weight: 600; color: var(--color-accent-gold); border-bottom: 1px solid rgba(255,255,255,0.1); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
            <span>📅 Timeline Events (${eventTotal})</span>
            <span class="section-toggle" id="events-toggle">▼</span>
          </div>
          <div id="events-results-list" class="section-content">`;
        
        html += data.events.events.map(event => {
          const year = this.formatEventYear(event.startJD);
          const icon = this.getEventTypeIcon(event.type);
          return `
            <div class="search-result-item search-event-item" onclick="GlobalSearch.goToEvent('${event.id}')" style="border-left: 3px solid var(--color-accent-gold);">
              <div class="search-result-ref"><span style="margin-right: 6px;">${icon}</span>${this.escapeHtml(event.title || event.id)}</div>
              <div class="search-result-text" style="color: var(--color-text-muted); font-size: 0.85em;">${year}</div>
            </div>
          `;
        }).join('');
        
        html += `</div></div>`;
      }
      
      // Bible results section (collapsible)
      if (data.bible?.results?.length > 0) {
        html += `<div class="search-section search-bible-section">
          <div class="search-section-header" onclick="GlobalSearch.toggleSection('bible')" style="padding: 8px 12px; background: rgba(255,255,255,0.05); font-weight: 600; color: var(--color-text); border-bottom: 1px solid rgba(255,255,255,0.1); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
            <span>📖 Bible Verses (${bibleTotal})</span>
            <span class="section-toggle" id="bible-toggle">▼</span>
          </div>
          <div id="bible-results-list" class="section-content">`;
        
        html += this.buildBibleResultsHtml(data.bible.results, data.query);
        html += `</div></div>`;
      }
      
      content.innerHTML = html;
      this.setupInfiniteScroll(content);
    } else {
      // Appending more Bible results
      const bibleList = content.querySelector('#bible-results-list');
      if (bibleList) {
        // Remove loading/load more indicators
        const loadingIndicator = bibleList.querySelector('.search-loading-more');
        if (loadingIndicator) loadingIndicator.remove();
        const loadMoreBtn = bibleList.querySelector('.search-load-more');
        if (loadMoreBtn) loadMoreBtn.remove();
        
        // Append new results
        bibleList.insertAdjacentHTML('beforeend', this.buildBibleResultsHtml(data.bible.results, data.query));
      }
    }
    
    // Add "Load more" for Bible results if there are more
    if (data.bible?.hasMore) {
      const bibleList = content.querySelector('#bible-results-list');
      if (bibleList && !bibleList.querySelector('.search-load-more')) {
        bibleList.insertAdjacentHTML('beforeend', `
          <div class="search-load-more" style="text-align: center; padding: 15px; color: var(--color-text-muted); cursor: pointer;" onclick="GlobalSearch.loadMore()">
            Load more verses...
          </div>
        `);
      }
    }
  },
  
  /**
   * Abbreviate book names for compact display
   */
  abbreviateBook(book) {
    const abbrevs = {
      'Genesis': 'Gen', 'Exodus': 'Exod', 'Leviticus': 'Lev', 'Numbers': 'Num',
      'Deuteronomy': 'Deut', 'Joshua': 'Josh', 'Judges': 'Judg', 'Ruth': 'Ruth',
      '1 Samuel': '1 Sam', '2 Samuel': '2 Sam', '1 Kings': '1 Kgs', '2 Kings': '2 Kgs',
      '1 Chronicles': '1 Chr', '2 Chronicles': '2 Chr', 'Ezra': 'Ezra', 'Nehemiah': 'Neh',
      'Esther': 'Esth', 'Job': 'Job', 'Psalms': 'Ps', 'Proverbs': 'Prov',
      'Ecclesiastes': 'Eccl', 'Song of Solomon': 'Song', 'Isaiah': 'Isa', 'Jeremiah': 'Jer',
      'Lamentations': 'Lam', 'Ezekiel': 'Ezek', 'Daniel': 'Dan', 'Hosea': 'Hos',
      'Joel': 'Joel', 'Amos': 'Amos', 'Obadiah': 'Obad', 'Jonah': 'Jonah',
      'Micah': 'Mic', 'Nahum': 'Nah', 'Habakkuk': 'Hab', 'Zephaniah': 'Zeph',
      'Haggai': 'Hag', 'Zechariah': 'Zech', 'Malachi': 'Mal',
      'Matthew': 'Matt', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John',
      'Acts': 'Acts', 'Romans': 'Rom', '1 Corinthians': '1 Cor', '2 Corinthians': '2 Cor',
      'Galatians': 'Gal', 'Ephesians': 'Eph', 'Philippians': 'Phil', 'Colossians': 'Col',
      '1 Thessalonians': '1 Thess', '2 Thessalonians': '2 Thess', '1 Timothy': '1 Tim',
      '2 Timothy': '2 Tim', 'Titus': 'Titus', 'Philemon': 'Phlm', 'Hebrews': 'Heb',
      'James': 'Jas', '1 Peter': '1 Pet', '2 Peter': '2 Pet', '1 John': '1 John',
      '2 John': '2 John', '3 John': '3 John', 'Jude': 'Jude', 'Revelation': 'Rev'
    };
    return abbrevs[book] || book;
  },

  /**
   * Build HTML for Bible results
   */
  buildBibleResultsHtml(results, query) {
    return results.map(r => {
      const highlightedText = this.highlightMatches(r.text, query);
      const truncatedText = this.truncateText(highlightedText, 150);
      const abbrevRef = `${this.abbreviateBook(r.book)} ${r.chapter}:${r.verse}`;
      
      return `
        <div class="search-result-item search-result-inline" onclick="GlobalSearch.goToResult('${this.escapeHtml(r.book)}', ${r.chapter}, ${r.verse})">
          <span class="search-result-ref">${this.escapeHtml(abbrevRef)}</span>
          <span class="search-result-text">${truncatedText}</span>
        </div>
      `;
    }).join('');
  },
  
  /**
   * Format event year from Julian Day
   */
  formatEventYear(jd) {
    if (!jd) return '';
    // Use proper JD-to-Gregorian conversion if available
    if (typeof EventResolver !== 'undefined') {
      const greg = EventResolver.julianDayToGregorian(jd);
      return greg.year <= 0 ? `${1 - greg.year} BC` : `${greg.year} AD`;
    }
    // Fallback: approximate
    const year = Math.floor((jd - 1721425.5) / 365.25);
    if (year <= 0) return `${1 - year} BC`;
    return `${year} AD`;
  },
  
  /**
   * Get icon for event type
   */
  getEventTypeIcon(type) {
    const icons = {
      'reign': '👑',
      'birth': '👶',
      'death': '💀',
      'battle': '⚔️',
      'construction': '🏛️',
      'prophecy': '📜',
      'miracle': '✨',
      'covenant': '📜',
      'judgment': '⚖️',
      'exodus': '🚶',
      'conquest': '🗡️',
      'temple': '🏛️',
      'eclipse': '🌑',
      'astronomical': '🌟',
      'life': '👤'
    };
    return icons[type] || '📍';
  },
  
  /**
   * Setup infinite scroll on results container
   */
  setupInfiniteScroll(content) {
    // Remove old listener if any
    if (this._scrollHandler) {
      content.removeEventListener('scroll', this._scrollHandler);
    }
    
    this._scrollHandler = () => {
      if (this.isLoadingMore) return;
      if (!this.currentSearchData?.bible?.hasMore) return;
      
      // Check if scrolled near bottom
      const scrollBottom = content.scrollHeight - content.scrollTop - content.clientHeight;
      if (scrollBottom < 100) {
        this.loadMore();
      }
    };
    
    content.addEventListener('scroll', this._scrollHandler);
  },
  
  /**
   * Load more Bible search results
   */
  loadMore() {
    if (this.isLoadingMore) return;
    if (!this.currentSearchData?.bible?.hasMore) return;
    
    this.isLoadingMore = true;
    
    const bibleList = document.querySelector('#bible-results-list');
    
    // Remove "Load more" button, add loading indicator
    const loadMoreBtn = bibleList?.querySelector('.search-load-more');
    if (loadMoreBtn) loadMoreBtn.remove();
    
    if (bibleList) {
      bibleList.insertAdjacentHTML('beforeend', `
        <div class="search-loading-more" style="text-align: center; padding: 15px; color: var(--color-text-muted);">
          Loading more...
        </div>
      `);
    }
    
    // Fetch next page of Bible results
    const newOffset = this.displayedCount;
    const bibleResults = this.performTextSearch(this.currentSearchData.query, newOffset, 50);
    
    // Update current data with new Bible results
    const updatedData = {
      ...this.currentSearchData,
      bible: bibleResults
    };
    
    this.isLoadingMore = false;
    this.showResults(updatedData, true);
  },
  
  /**
   * Highlight search matches in text
   */
  highlightMatches(text, query) {
    const escaped = this.escapeRegex(query);
    const pattern = new RegExp(`(${escaped})`, 'gi');
    return text.replace(pattern, '<mark>$1</mark>');
  },
  
  /**
   * Truncate text around first match
   */
  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    
    // Find first mark
    const markIndex = text.indexOf('<mark>');
    if (markIndex === -1) {
      return text.substring(0, maxLength) + '...';
    }
    
    // Show context around match
    const start = Math.max(0, markIndex - 50);
    const end = Math.min(text.length, markIndex + maxLength - 50);
    
    let result = text.substring(start, end);
    if (start > 0) result = '...' + result;
    if (end < text.length) result = result + '...';
    
    return result;
  },
  
  /**
   * Escape HTML
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
  
  /**
   * Navigate to a Bible search result
   */
  goToResult(book, chapter, verse) {
    // Navigate to verse (keep search results open - user can close with X)
    if (typeof AppStore !== 'undefined') {
      AppStore.dispatch({
        type: 'SET_VIEW',
        view: 'reader',
        params: {
          contentType: 'bible',
          book: book,
          chapter: chapter,
          verse: verse
        }
      });
    }
  },
  
  /**
   * Navigate to a timeline event — focus + open details on desktop
   */
  goToEvent(eventId) {
    if (typeof AppStore !== 'undefined') {
      const state = AppStore.getState();
      const isOnTimeline = state.content?.view === 'timeline';
      const isMobile = window.innerWidth < 768;
      
      if (isOnTimeline) {
        // Already on timeline - always scroll to the event, even if already focused
        // Clear first to force state change if same event is re-clicked
        if (state.ui?.timelineFocusedEventId === eventId) {
          AppStore.dispatch({ type: 'SET_TIMELINE_FOCUSED_EVENT', eventId: null });
        }
        AppStore.dispatch({ type: 'SET_TIMELINE_FOCUSED_EVENT', eventId });
        if (!isMobile) {
          AppStore.dispatch({ type: 'SET_TIMELINE_EVENT', eventId });
        }
      } else {
        // Navigate via URL to avoid race with async timeline init
        const params = `focus=${encodeURIComponent(eventId)}${isMobile ? '' : '&event=' + encodeURIComponent(eventId)}`;
        const url = `/timeline?${params}`;
        history.pushState({}, '', url);
        AppStore.dispatch({ type: 'URL_CHANGED', url });
      }
    }
  },
  
  /**
   * Wait for timeline events to be loaded and resolved
   * Returns a promise that resolves when events are available
   */
  async waitForTimelineEvents(maxWaitMs = 10000) {
    // Use ResolvedEventsCache singleton — simple and direct
    if (typeof ResolvedEventsCache !== 'undefined') {
      const profile = (typeof getTimelineProfile === 'function') ? getTimelineProfile() :
                      (typeof EventResolver !== 'undefined' ? EventResolver.DEFAULT_PROFILE : null);
      // Sync check first
      let events = ResolvedEventsCache.getEvents(profile);
      if (events && events.length > 0) {
        console.log('[GlobalSearch] Timeline events from cache:', events.length);
        return events;
      }
      // Async load/compute
      events = await ResolvedEventsCache.getEventsAsync(profile);
      if (events && events.length > 0) {
        console.log('[GlobalSearch] Timeline events resolved:', events.length);
        return events;
      }
    }
    
    // Fallback: poll for events (legacy path)
    const startTime = Date.now();
    const pollInterval = 100;
    
    return new Promise((resolve, reject) => {
      const checkEvents = () => {
        if (typeof getTimelineResolvedEvents === 'function') {
          const events = getTimelineResolvedEvents();
          if (events && events.length > 0) {
            console.log('[GlobalSearch] Timeline events now available:', events.length);
            resolve(events);
            return;
          }
        }
        
        if (Date.now() - startTime > maxWaitMs) {
          console.warn('[GlobalSearch] Timeout waiting for timeline events');
          resolve([]); // Return empty rather than rejecting
          return;
        }
        
        setTimeout(checkEvents, pollInterval);
      };
      
      checkEvents();
    });
  },
  
  /**
   * Toggle a collapsible section (events or bible) - dispatches to AppStore
   */
  toggleSection(section) {
    if (typeof AppStore !== 'undefined') {
      const state = AppStore.getState();
      const currentCollapsed = state.ui?.globalSearchCollapsed?.[section] || false;
      AppStore.dispatch({
        type: 'SET_SEARCH_COLLAPSED',
        section: section,
        collapsed: !currentCollapsed
      });
    }
  },
  
  /**
   * Apply collapsed state from AppStore to the UI
   */
  applyCollapsedState(collapsedState) {
    ['events', 'bible'].forEach(section => {
      const listId = section === 'events' ? 'events-results-list' : 'bible-results-list';
      const toggleId = section + '-toggle';
      
      const list = document.getElementById(listId);
      const toggle = document.getElementById(toggleId);
      
      if (list && toggle) {
        const isCollapsed = collapsedState?.[section] || false;
        list.style.display = isCollapsed ? 'none' : '';
        toggle.textContent = isCollapsed ? '▶' : '▼';
      }
    });
  },
  
  /**
   * Show results container
   */
  showResultsContainer() {
    const container = document.getElementById('global-search-results');
    if (container) {
      container.classList.add('open');
      container.style.height = this.resultsHeight + 'px';
    }
  },
  
  /**
   * Close results - dispatches to AppStore (unidirectional flow)
   * The subscriber will handle hiding the results when state changes
   */
  closeResults() {
    if (typeof AppStore !== 'undefined') {
      AppStore.dispatch({ type: 'CLOSE_GLOBAL_SEARCH' });
    }
  },
  
  /**
   * Close search completely (close results + collapse mobile input)
   */
  close() {
    this.closeResults();
    this.hideHints();
    const input = document.getElementById('global-search-input');
    if (input) input.value = '';
    this.collapseInput();
  },
  
  /**
   * Check initial state from AppStore (for page load with ?q= param)
   * The URL router parses ?q= and sets state.ui.globalSearchQuery
   * We just need to check if there's a query in state on init
   */
  checkInitialState() {
    if (typeof AppStore === 'undefined') return;
    
    // Delay to let URL router parse and AppStore initialize
    setTimeout(() => {
      const state = AppStore.getState();
      const query = state.ui?.globalSearchQuery;
      const collapsedState = state.ui?.globalSearchCollapsed;
      
      console.log('[GlobalSearch] Checking initial state, query:', query, 'collapsed:', collapsedState);
      
      if (query && query !== this.currentQuery) {
        this.currentQuery = query;
        const input = document.getElementById('global-search-input');
        if (input) input.value = query;
        this.executeSearch(query);
        // Apply collapsed state after search renders
        setTimeout(() => this.applyCollapsedState(collapsedState), 100);
      }
    }, 500);
  },
  
  /**
   * Subscribe to AppStore changes - derives search results from state (unidirectional flow)
   */
  subscribeToStore() {
    if (typeof AppStore === 'undefined') return;
    
    AppStore.subscribe((state) => {
      const query = state.ui?.globalSearchQuery;
      const collapsedState = state.ui?.globalSearchCollapsed;
      const container = document.getElementById('global-search-container');
      const input = document.getElementById('global-search-input');
      const results = document.getElementById('global-search-results');
      
      console.log('[GlobalSearch] State changed, globalSearchQuery:', query, 'currentQuery:', this.currentQuery);
      
      // Toggle has-query class for desktop close button visibility
      if (container) {
        container.classList.toggle('has-query', !!query);
      }
      
      // Sync input value with state (state is source of truth)
      if (input && query !== null && input.value !== query) {
        input.value = query;
      }
      
      // Derive search results from state
      if (query && this.currentQuery !== query) {
        // Query changed - execute search
        this.currentQuery = query;
        this.executeSearch(query);
        // Apply collapsed state after search renders
        setTimeout(() => this.applyCollapsedState(collapsedState), 50);
      } else if (query && this.currentQuery === query) {
        // Same query but state changed - apply collapsed state
        this.applyCollapsedState(collapsedState);
      } else if (!query && this.currentQuery) {
        // Query cleared - close results and collapse input
        this.currentQuery = null;
        if (results?.classList.contains('open')) {
          results.classList.remove('open');
        }
        // Clear input and collapse mobile expansion
        if (input) {
          input.value = '';
        }
        this.collapseInput();
      }
    });
  },
  
  /**
   * Set up resize handle drag
   */
  setupResizeHandle() {
    const handle = document.getElementById('search-results-handle');
    if (!handle) return;
    
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.resizeStart = {
        y: e.clientY,
        height: this.resultsHeight
      };
      
      document.addEventListener('mousemove', this.onResizeMove);
      document.addEventListener('mouseup', this.onResizeEnd);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    });
    
    // Touch support
    handle.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      this.resizeStart = {
        y: touch.clientY,
        height: this.resultsHeight
      };
      
      document.addEventListener('touchmove', this.onResizeTouchMove);
      document.addEventListener('touchend', this.onResizeEnd);
    });
  },
  
  onResizeMove: function(e) {
    if (!GlobalSearch.resizeStart) return;
    
    const delta = e.clientY - GlobalSearch.resizeStart.y;
    const newHeight = Math.max(100, Math.min(
      GlobalSearch.resizeStart.height + delta,
      window.innerHeight * 0.8
    ));
    
    GlobalSearch.resultsHeight = newHeight;
    const container = document.getElementById('global-search-results');
    if (container) {
      container.style.height = newHeight + 'px';
    }
  },
  
  onResizeTouchMove: function(e) {
    if (!GlobalSearch.resizeStart) return;
    const touch = e.touches[0];
    GlobalSearch.onResizeMove({ clientY: touch.clientY });
  },
  
  onResizeEnd: function() {
    GlobalSearch.resizeStart = null;
    document.removeEventListener('mousemove', GlobalSearch.onResizeMove);
    document.removeEventListener('mouseup', GlobalSearch.onResizeEnd);
    document.removeEventListener('touchmove', GlobalSearch.onResizeTouchMove);
    document.removeEventListener('touchend', GlobalSearch.onResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Save height preference
    try {
      localStorage.setItem('globalSearchResultsHeight', String(GlobalSearch.resultsHeight));
    } catch (e) {}
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => GlobalSearch.init());
} else {
  GlobalSearch.init();
}

// Make available globally
window.GlobalSearch = GlobalSearch;
