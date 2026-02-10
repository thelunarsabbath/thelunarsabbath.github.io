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
  
  /**
   * Toggle a search filter on/off and re-execute search
   */
  toggleFilter(filter) {
    if (typeof AppStore !== 'undefined') {
      AppStore.dispatch({ type: 'TOGGLE_SEARCH_FILTER', filter });
      // Sync filter bar UI immediately
      this.syncFilterBar();
      // Clear cache and re-execute if we have a query
      if (this.currentQuery) {
        this.cachedResults.delete(this.currentQuery);
        this.allMatchesCache = null;
        this.allEventsCache = null;
        this.executeSearch(this.currentQuery);
      }
    }
  },
  
  /**
   * Sync filter bar button states from AppStore
   */
  syncFilterBar() {
    if (typeof AppStore === 'undefined') return;
    const filters = AppStore.getState().ui?.globalSearchFilters || {};
    document.querySelectorAll('.search-filter-btn[data-filter]').forEach(btn => {
      const filter = btn.dataset.filter;
      btn.classList.toggle('active', !!filters[filter]);
    });
  },
  
  /**
   * Get current filter state
   */
  _getFilters() {
    if (typeof AppStore !== 'undefined') {
      return AppStore.getState().ui?.globalSearchFilters || {};
    }
    return { events: true, bible: true, studies: true, strongs: true };
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
    
    // Strong's numbers (H1234, G5678) — open the Research Panel AND search for all verses
    const strongsMatch = query.match(/^([HGhg])0*(\d+)$/);
    if (strongsMatch) {
      const strongsNum = strongsMatch[1].toUpperCase() + strongsMatch[2];
      // Open research panel only if not already showing this strongs entry
      const panel = document.getElementById('research-panel');
      const alreadyOpen = panel && panel.classList.contains('open');
      if (!alreadyOpen && typeof showStrongsPanel === 'function') {
        showStrongsPanel(strongsNum, '', '', null);
      }
    }
    
    // Check for multi-verse reference (e.g. "Jer 52:12-13; 2 Kings 25:8-9") - open multiverse view
    // Check for Bible citation — use Bible API for comprehensive parsing
    // Handles: "Gen 1:1", "Gen 1:1-3", "Gen 1:1; John 3:16", "Gen 1:1 John 3:16",
    // "Rev 17-18", "Ps 23", "I Cor 13:4 II Tim 3:16", etc.
    if (typeof Bible !== 'undefined') {
      const normalized = Bible.normalizeCitation(query);
      if (normalized) {
        // Multi-verse (multiple references): navigate to multiverse view
        if (Bible.isMultiVerseCitation(query)) {
          this.navigateToMultiverse(normalized);
          return;
        }
        // Single reference: try to parse as a verse/chapter
        const parsed = Bible.parseRef(normalized);
        if (parsed) {
          this.navigateToVerse(parsed);
          return;
        }
        // Chapter range like "Rev 17-18" — parseRef doesn't handle these,
        // but the citation parser does. If it resolves to verses, navigate.
        const trans = Bible.getDefaultTranslation();
        if (Bible.isLoaded(trans)) {
          const verses = Bible.getVersesForCitation(trans, normalized);
          const real = verses.filter(v => !v.isSeparator);
          if (real.length > 0) {
            // Single range = navigate to first chapter; multi-range = multiverse
            if (real.length === 1) {
              this.navigateToVerse({ book: real[0].book, chapter: real[0].chapter, verse: real[0].verse });
            } else {
              this.navigateToMultiverse(normalized);
            }
            return;
          }
        }
      }
    }
    
    // Check for classics citation (Philo/Josephus) — e.g. "Antiquities 18.2.2", "On the Creation 42"
    if (typeof Classics !== 'undefined') {
      const classicsParsed = Classics.parseCitation(query);
      if (classicsParsed) {
        this.navigateToClassics(classicsParsed);
        return;
      }
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
        const testDate = new Date(2000, month - 1, day);
        testDate.setFullYear(year);
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
      const translation = typeof Bible !== 'undefined' 
        ? Bible.getDefaultTranslation() 
        : 'kjv';
      const params = {
        contentType: 'bible',
        translation,
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
   * Navigate to multiverse view (multiple verse references on one page)
   */
  navigateToMultiverse(citationStr) {
    this.close();
    if (typeof AppStore !== 'undefined') {
      AppStore.dispatch({
        type: 'SET_VIEW',
        view: 'reader',
        params: { contentType: 'multiverse', multiverse: citationStr }
      });
    }
  },

  /**
   * Navigate to a classics passage (Philo or Josephus)
   * @param {Object} parsed - Result from Classics.parseCitation()
   */
  navigateToClassics(parsed) {
    this.close();
    if (typeof AppStore === 'undefined' || typeof Classics === 'undefined') return;
    const slug = Classics.getWorkSlug(parsed.work);
    if (parsed.author === 'philo') {
      AppStore.dispatch({
        type: 'SET_VIEW',
        view: 'reader',
        params: { contentType: 'philo', work: slug, section: String(parsed.section) }
      });
    } else if (parsed.author === 'josephus') {
      AppStore.dispatch({
        type: 'SET_VIEW',
        view: 'reader',
        params: { contentType: 'josephus', work: slug, book: parsed.book, chapter: parsed.chapter, section: parsed.section }
      });
    }
  },
  
  /**
   * Execute Bible text search (internal - called by subscriber when state changes)
   * This is the actual search execution, derived from state
   */
  async executeSearch(query) {
    console.log('[GlobalSearch] executeSearch called with:', query);
    
    // Sync filter bar UI
    this.syncFilterBar();
    const filters = this._getFilters();
    
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
    
    // Ensure Bible data is loaded (needed for Bible and Strongs searches)
    const state = typeof AppStore !== 'undefined' ? AppStore.getState() : null;
    const translation = state?.content?.params?.translation || (typeof currentTranslation !== 'undefined' ? currentTranslation : 'kjv');
    if ((filters.bible || filters.strongs) && !Bible.isLoaded(translation)) {
      if (content) {
        content.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-text-muted);">Loading Bible...</div>';
      }
      try {
        await Bible.loadTranslation(translation);
      } catch (e) {
        console.error('[GlobalSearch] Failed to load Bible:', e);
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
    
    // Perform instant searches based on active filters
    const bibleResults = filters.bible ? this.performTextSearch(query, 0, 50) : { results: [], total: 0, hasMore: false };
    const studiesResults = filters.studies ? this.performStudiesSearch(query) : { results: [], total: 0 };
    const strongsResults = filters.strongs ? this.performStrongsSearch(query) : { results: [], total: 0 };
    
    // Check if timeline events are already available (sync — instant if cached)
    let timelineEvents = filters.events && typeof getTimelineResolvedEvents === 'function' ? getTimelineResolvedEvents() : [];
    
    // Determine if any instant results exist (across all active filters)
    const hasInstantResults = bibleResults.total > 0 || studiesResults.total > 0 || strongsResults.total > 0;
    
    if (timelineEvents.length > 0 || !filters.events) {
      // Timeline already loaded or events filter off — show everything at once
      const eventResults = filters.events ? this.performEventSearch(query) : { events: [], total: 0 };
      const combinedResults = {
        query, bible: bibleResults, events: eventResults,
        studies: studiesResults, strongs: strongsResults,
        error: null
      };
      this._cacheResult(query, combinedResults);
      this.showResults(combinedResults);
    } else {
      // Show instant results NOW, load timeline in background
      const partialResults = {
        query, bible: bibleResults, events: { events: [], total: 0 },
        studies: studiesResults, strongs: strongsResults,
        _timelinePending: true, error: null
      };
      this.showResults(partialResults);
      
      // Load timeline async and insert results when ready
      this._searchGeneration = (this._searchGeneration || 0) + 1;
      this._loadTimelineAndInsert(query, this._searchGeneration);
    }
  },
  
  /**
   * Load timeline events in background and insert into existing search results.
   * Uses a generation counter to avoid stale updates if user starts a new search.
   * @private
   */
  async _loadTimelineAndInsert(query, generation) {
    try {
      await this.waitForTimelineEvents();
    } catch (e) {
      console.error('[GlobalSearch] Timeline load failed:', e);
    }
    
    // Bail if a newer search has started
    if (this._searchGeneration !== generation) return;
    if (this.currentQuery !== query) return;
    
    // Perform event search now that timeline is loaded
    const eventResults = this.performEventSearch(query);
    const content = document.getElementById('search-results-content');
    
    // Remove the "loading timeline" placeholder
    const placeholder = document.getElementById('timeline-pending-placeholder');
    if (placeholder) placeholder.remove();
    
    if (eventResults.events.length > 0 && content) {
      const eventsHtml = this._buildEventsSectionHtml(eventResults);
      
      // Insert events at the top of results (before studies/strongs/bible)
      const firstSection = content.querySelector('.search-section');
      if (firstSection) {
        firstSection.insertAdjacentHTML('beforebegin', eventsHtml);
      } else {
        // No other sections — replace content entirely
        content.innerHTML = eventsHtml;
      }
      
      this.displayedEventCount = eventResults.events.length;
    } else if (!content?.querySelector('.search-section') && content) {
      // No events AND no other results — show "no results"
      content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--color-text-muted);">No results found for "${this.escapeHtml(query)}"</div>`;
    }
    
    // Apply collapsed state from AppStore
    const state = typeof AppStore !== 'undefined' ? AppStore.getState() : null;
    this.applyCollapsedState(state?.ui?.globalSearchCollapsed);
    
    // Update cache with complete results (so back-navigation shows full results)
    const cached = this.cachedResults.get(query);
    if (cached) {
      cached.events = eventResults;
      delete cached._timelinePending;
    } else {
      const filters = this._getFilters();
      const combinedResults = {
        query: query,
        bible: filters.bible ? this.performTextSearch(query, 0, 50) : { results: [], total: 0, hasMore: false },
        events: eventResults,
        studies: filters.studies ? this.performStudiesSearch(query) : { results: [], total: 0 },
        strongs: filters.strongs ? this.performStrongsSearch(query) : { results: [], total: 0 },
        error: null
      };
      this._cacheResult(query, combinedResults);
    }
  },
  
  /**
   * Build HTML for the timeline events section (used by incremental insert).
   * @private
   */
  _buildEventsSectionHtml(eventResults) {
    const eventTotal = eventResults.total || 0;
    let html = `<div class="search-section search-events-section">
      <div class="search-section-header" onclick="GlobalSearch.toggleSection('events')" style="padding: 8px 12px; background: var(--surface-hover); font-weight: 600; color: var(--accent-gold); border-bottom: 1px solid var(--border-subtle); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>📅 Timeline Events (${eventTotal})</span>
        <span class="section-toggle" id="events-toggle">▼</span>
      </div>
      <div id="events-results-list" class="section-content">`;
    
    html += eventResults.events.map(event => {
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
    return html;
  },
  
  /**
   * Build HTML for the studies section (symbols, word studies, numbers).
   * @private
   */
  _buildStudiesSectionHtml(studiesResults) {
    const total = studiesResults.total || 0;
    let html = `<div class="search-section search-studies-section">
      <div class="search-section-header" onclick="GlobalSearch.toggleSection('studies')" style="padding: 8px 12px; background: var(--surface-hover); font-weight: 600; color: var(--accent-gold); border-bottom: 1px solid var(--border-subtle); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>📚 Studies (${total})</span>
        <span class="section-toggle" id="studies-toggle">▼</span>
      </div>
      <div id="studies-results-list" class="section-content">`;
    
    html += studiesResults.results.map(study => {
      const escapedLink = this.escapeHtml(study.link || '');
      return `
        <div class="search-result-item search-study-item" onclick="GlobalSearch.goToStudy('${escapedLink}')" style="border-left: 3px solid var(--color-accent-gold);">
          <div class="search-result-ref"><span style="margin-right: 6px;">${study.icon}</span>${this.escapeHtml(study.title)}<span style="margin-left: 8px; font-size: 0.7em; color: var(--text-tertiary); text-transform: uppercase;">${study.type}</span></div>
          <div class="search-result-text" style="color: var(--color-text-muted); font-size: 0.85em;">${this.escapeHtml(study.description)}</div>
        </div>
      `;
    }).join('');
    
    html += `</div></div>`;
    return html;
  },
  
  /**
   * Build HTML for the Strong's dictionary section.
   * @private
   */
  _buildStrongsSectionHtml(strongsResults) {
    const total = strongsResults.total || 0;
    let html = `<div class="search-section search-strongs-section">
      <div class="search-section-header" onclick="GlobalSearch.toggleSection('strongs')" style="padding: 8px 12px; background: var(--surface-hover); font-weight: 600; color: var(--accent-gold); border-bottom: 1px solid var(--border-subtle); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>📗 Strong's Dictionary (${total})</span>
        <span class="section-toggle" id="strongs-toggle">▼</span>
      </div>
      <div id="strongs-results-list" class="section-content">`;
    
    html += strongsResults.results.map(entry => {
      const langBadge = entry.lang === 'Hebrew' ? 'H' : 'G';
      const defText = entry.definition ? entry.definition.replace(/^\{|\}$/g, '') : '';
      const shortDef = defText.length > 100 ? defText.slice(0, 100) + '...' : defText;
      return `
        <div class="search-result-item search-strongs-item" onclick="GlobalSearch.goToStrongs('${this.escapeHtml(entry.id)}')" style="border-left: 3px solid var(--accent-primary-strong);">
          <div class="search-result-ref"><span style="font-weight: 700; margin-right: 6px;">${entry.id}</span><span style="font-family: serif;">${entry.lemma}</span> <span style="color: var(--text-tertiary); font-style: italic;">${this.escapeHtml(entry.xlit)}</span></div>
          <div class="search-result-text" style="color: var(--color-text-muted); font-size: 0.85em;">${this.escapeHtml(shortDef)}</div>
        </div>
      `;
    }).join('');
    
    html += `</div></div>`;
    return html;
  },
  
  /**
   * Navigate to a study page (symbol, word, or number)
   */
  goToStudy(link) {
    if (!link) return;
    if (typeof AppStore !== 'undefined') {
      AppStore.dispatch({ type: 'URL_CHANGED', url: link });
    }
  },
  
  /**
   * Navigate to Strong's entry (open research panel)
   */
  goToStrongs(strongsId) {
    if (!strongsId) return;
    if (typeof showStrongsPanel === 'function') {
      showStrongsPanel(strongsId, '', '', null);
    }
  },
  
  /**
   * Cache a search result with LRU eviction.
   * @private
   */
  _cacheResult(query, result) {
    this.cachedResults.set(query, result);
    if (this.cachedResults.size > 20) {
      const firstKey = this.cachedResults.keys().next().value;
      this.cachedResults.delete(firstKey);
    }
  },
  
  // ─── Available number studies (derived from /numbers/*.md files) ────────────
  _numberStudies: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18,20,24,30,31,40,42,49,50,70,71,77,80,100,120,144,153,490,666,1000],
  
  /**
   * Search symbol, word, and number studies
   * @returns {{ results: Array, total: number }}
   */
  performStudiesSearch(query) {
    const results = [];
    const searchLower = query.toLowerCase().trim();
    const wordPattern = new RegExp(`\\b${this.escapeRegex(query)}\\b`, 'i');
    const strongsMatch = query.match(/^([HGhg])0*(\d+)$/);
    const strongsNum = strongsMatch ? strongsMatch[1].toUpperCase() + strongsMatch[2] : null;
    
    // Search SYMBOL_DICTIONARY
    if (typeof SYMBOL_DICTIONARY !== 'undefined') {
      for (const [key, sym] of Object.entries(SYMBOL_DICTIONARY)) {
        let matched = false;
        // Match by name or trigger words
        if (sym.name && sym.name.toLowerCase().includes(searchLower)) matched = true;
        if (!matched && sym.words?.some(w => w.toLowerCase().includes(searchLower))) matched = true;
        // Match by Strong's number
        if (!matched && strongsNum && sym.strongs?.includes(strongsNum)) matched = true;
        // Match by description (broader search)
        if (!matched && sym.sentence && wordPattern.test(sym.sentence)) matched = true;
        
        if (matched) {
          results.push({
            type: 'symbol',
            id: key,
            title: sym.name,
            description: sym.sentence || [sym.is, sym.is2].filter(Boolean).join(' — '),
            link: sym.link,
            icon: '🔣'
          });
        }
      }
    }
    
    // Search WORD_STUDY_DICTIONARY
    if (typeof WORD_STUDY_DICTIONARY !== 'undefined') {
      for (const [key, ws] of Object.entries(WORD_STUDY_DICTIONARY)) {
        let matched = false;
        // Match by Strong's number
        if (strongsNum && ws.strongs === strongsNum) matched = true;
        // Match by lemma or transliteration
        if (!matched && ws.transliteration && wordPattern.test(ws.transliteration)) matched = true;
        // Match by summary
        if (!matched && ws.summary && wordPattern.test(ws.summary)) matched = true;
        // Match by root meaning
        if (!matched && ws.rootMeaning && wordPattern.test(ws.rootMeaning)) matched = true;
        
        if (matched) {
          results.push({
            type: 'word',
            id: key,
            title: `${ws.strongs} (${ws.lemma}, ${ws.transliteration})`,
            description: ws.summary ? (ws.summary.length > 120 ? ws.summary.slice(0, 120) + '...' : ws.summary) : '',
            link: ws.link,
            icon: '📖'
          });
        }
      }
    }
    
    // Search number studies (match numeric queries)
    const numericMatch = query.match(/^\d+$/);
    if (numericMatch) {
      const num = parseInt(numericMatch[0]);
      if (this._numberStudies.includes(num)) {
        results.push({
          type: 'number',
          id: String(num),
          title: `Number Study: ${num}`,
          description: 'Explore the biblical significance and symbolism of this number',
          link: `/reader/numbers/${num}`,
          icon: '🔢'
        });
      }
    }
    
    return { results, total: results.length };
  },
  
  /**
   * Search Strong's Hebrew and Greek dictionaries
   * @returns {{ results: Array, total: number }}
   */
  performStrongsSearch(query) {
    const results = [];
    const searchLower = query.toLowerCase().trim();
    const wordPattern = new RegExp(`\\b${this.escapeRegex(query)}\\b`, 'i');
    const strongsMatch = query.match(/^([HGhg])0*(\d+)$/);
    const MAX_RESULTS = 25;
    
    // Direct Strong's number lookup
    if (strongsMatch) {
      const prefix = strongsMatch[1].toUpperCase();
      const num = strongsMatch[2];
      const key = prefix + num;
      const dict = prefix === 'H' 
        ? (typeof strongsHebrewDictionary !== 'undefined' ? strongsHebrewDictionary : null)
        : (typeof strongsGreekDictionary !== 'undefined' ? strongsGreekDictionary : null);
      if (dict && dict[key]) {
        const entry = dict[key];
        results.push({
          id: key,
          lang: prefix === 'H' ? 'Hebrew' : 'Greek',
          lemma: entry.lemma || '',
          xlit: entry.xlit || entry.translit || '',
          definition: entry.strongs_def || '',
          kjvDef: entry.kjv_def || ''
        });
      }
      return { results, total: results.length };
    }
    
    // Text search across both dictionaries (search definitions)
    const searchDictionary = (dict, lang, prefix) => {
      if (!dict) return;
      for (const [key, entry] of Object.entries(dict)) {
        if (results.length >= MAX_RESULTS) break;
        const def = (entry.strongs_def || '') + ' ' + (entry.kjv_def || '');
        if (wordPattern.test(def)) {
          results.push({
            id: key,
            lang,
            lemma: entry.lemma || '',
            xlit: entry.xlit || entry.translit || '',
            definition: entry.strongs_def || '',
            kjvDef: entry.kjv_def || ''
          });
        }
      }
    };
    
    if (typeof strongsHebrewDictionary !== 'undefined') {
      searchDictionary(strongsHebrewDictionary, 'Hebrew', 'H');
    }
    if (typeof strongsGreekDictionary !== 'undefined') {
      searchDictionary(strongsGreekDictionary, 'Greek', 'G');
    }
    
    return { results, total: results.length };
  },
  
  /**
   * Perform the actual text search - finds ALL matches, returns paginated
   */
  performTextSearch(query, offset = 0, limit = 50) {
    const wordPattern = new RegExp(`\\b${this.escapeRegex(query)}\\b`, 'gi');
    const state = typeof AppStore !== 'undefined' ? AppStore.getState() : null;
    const translation = state?.content?.params?.translation || (typeof currentTranslation !== 'undefined' ? currentTranslation : 'kjv');

    if (!Bible.isLoaded(translation)) {
      return {
        query,
        results: [],
        total: 0,
        hasMore: false,
        error: 'Bible not loaded yet. Please wait a moment and try again.'
      };
    }

    // Use cached matches for pagination, or run a new search
    let allMatches = this.allMatchesCache?.query === query ? this.allMatchesCache.matches : null;

    if (!allMatches) {
      // Detect Strong's number queries (H1234, G5678) — search tagged text for the Strong's tag
      const strongsMatch = query.match(/^([HGhg])0*(\d+)$/);
      let apiResults;
      if (strongsMatch && typeof Bible.searchStrongs === 'function') {
        const strongsNum = strongsMatch[1].toUpperCase() + strongsMatch[2];
        apiResults = Bible.searchStrongs(translation, strongsNum);
      } else {
        apiResults = Bible.searchText(translation, wordPattern);
      }
      allMatches = apiResults.map(r => {
        const m = r.ref.match(/^(.+?)\s+(\d+):(\d+)$/);
        return {
          ref: r.ref,
          book: m ? m[1] : '',
          chapter: m ? parseInt(m[2]) : 0,
          verse: m ? parseInt(m[3]) : 0,
          text: r.text
        };
      });
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
    
    // Search events by title, description, tags, id — use word boundary matching
    const wordPattern = new RegExp(`\\b${this.escapeRegex(query)}\\b`, 'i');
    const matchingEvents = events.filter(event => {
      if (event.startJD === null) return false;
      
      const searchableText = [
        event.title || '',
        event.description || '',
        event.id || '',
        ...(event.tags || [])
      ].join(' ');
      
      return wordPattern.test(searchableText);
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
    const studiesTotal = data.studies?.total || 0;
    const strongsTotal = data.strongs?.total || 0;
    const totalResults = bibleTotal + eventTotal + studiesTotal + strongsTotal;
    
    // Update displayed counts
    if (appendBible) {
      this.displayedCount += data.bible?.results?.length || 0;
    } else {
      this.displayedCount = data.bible?.results?.length || 0;
      this.displayedEventCount = data.events?.events?.length || 0;
    }
    
    if (!content) return;
    
    if (totalResults === 0 && !appendBible) {
      if (data._timelinePending) {
        // No instant results but timeline is still loading — show placeholder
        content.innerHTML = '<div id="timeline-pending-placeholder" style="text-align: center; padding: 20px; color: var(--color-text-muted);">Searching timeline events...</div>';
      } else {
        content.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--color-text-muted);">No results found for "${this.escapeHtml(data.query)}"</div>`;
      }
      return;
    }
    
    // Build HTML
    let html = '';
    
    if (!appendBible) {
      // First render - show events first (usually fewer), then Bible results
      
      // Event results section (collapsible)
      if (data.events?.events?.length > 0) {
        html += `<div class="search-section search-events-section">
          <div class="search-section-header" onclick="GlobalSearch.toggleSection('events')" style="padding: 8px 12px; background: var(--surface-hover); font-weight: 600; color: var(--accent-gold); border-bottom: 1px solid var(--border-subtle); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
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
      
      // Timeline loading placeholder (events still loading in background)
      if (data._timelinePending && (!data.events?.events?.length)) {
        html += `<div id="timeline-pending-placeholder" style="padding: 8px 12px; color: var(--color-text-muted); font-size: 0.85em; text-align: center; border-bottom: 1px solid var(--border-subtle);">Loading timeline events...</div>`;
      }
      
      // Studies results section (symbols, word studies, numbers — collapsible)
      if (data.studies?.results?.length > 0) {
        html += this._buildStudiesSectionHtml(data.studies);
      }
      
      // Strong's dictionary results section (collapsible)
      if (data.strongs?.results?.length > 0) {
        html += this._buildStrongsSectionHtml(data.strongs);
      }
      
      // Bible results section (collapsible)
      if (data.bible?.results?.length > 0) {
        html += `<div class="search-section search-bible-section">
          <div class="search-section-header" onclick="GlobalSearch.toggleSection('bible')" style="padding: 8px 12px; background: var(--surface-hover); font-weight: 600; color: var(--text-primary); border-bottom: 1px solid var(--border-subtle); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
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
    if (typeof AppStore === 'undefined') return;
    
    // Preserve current translation so navigateWhenReady doesn't fall back to bible home
    const state = AppStore.getState();
    const translation = state.content?.params?.translation || 'kjv';
    
    // On mobile: close the research panel so the bible verse is visible
    // (no room for side-by-side; user can tap a word to re-open strongs)
    if (window.innerWidth <= 768 && typeof closeStrongsPanel === 'function') {
      closeStrongsPanel();
    }
    
    AppStore.dispatch({
      type: 'SET_VIEW',
      view: 'reader',
      params: {
        contentType: 'bible',
        translation: translation,
        book: book,
        chapter: chapter,
        verse: verse
      },
      preserveStrongs: window.innerWidth > 768  // Desktop: keep panel; Mobile: already closed above
    });
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
      // Async load/compute — pass onProgress so resolveAllEventsAsync is used (yields to event loop)
      events = await ResolvedEventsCache.getEventsAsync(profile, () => {});
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
    ['events', 'bible', 'studies', 'strongs'].forEach(section => {
      const listId = section + '-results-list';
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
      // Sync filter bar buttons with current state
      this.syncFilterBar();
      // On mobile, if the research panel is also open, scroll to top so both are visible
      // (search results sit above the research panel in the DOM)
      if (window.innerWidth <= 768 && document.body.classList.contains('research-panel-open')) {
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      }
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
      
      if (query) {
        const input = document.getElementById('global-search-input');
        if (input) input.value = query;
        
        // Check if results are already visible (subscriber may have handled it)
        const resultsContainer = document.getElementById('global-search-results');
        const alreadyOpen = resultsContainer?.classList.contains('open');
        
        if (!alreadyOpen || this.currentQuery !== query) {
          // Results not visible yet or query changed — execute search
          this.currentQuery = query;
          this.executeSearch(query);
          // Apply collapsed state after search renders
          setTimeout(() => this.applyCollapsedState(collapsedState), 100);
        } else {
          // Results already open — just apply collapsed state
          this.applyCollapsedState(collapsedState);
        }
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
      
      document.addEventListener('touchmove', this.onResizeTouchMove, { passive: false });
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
    e.preventDefault(); // Prevent body scroll during resize drag
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
