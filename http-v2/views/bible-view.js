// Bible View - Wraps bible-reader.js for the new architecture
// This view integrates the existing Bible explorer with the http-v2 app

const BibleView = {
  initialized: false,
  container: null,
  lastRenderedParams: null,

  init() {
    // Called when view becomes active
    console.log('[BibleView] init');
    
    // Subscribe to state changes to update history buttons
    if (typeof AppStore !== 'undefined' && !this._historySubscribed) {
      this._historySubscribed = true;
      AppStore.subscribe(() => {
        this.updateHistoryButtons();
      });
    }
  },

  cleanup() {
    // Called when view is deactivated
    console.log('[BibleView] cleanup');
    if (typeof closeStrongsPanel === 'function') closeStrongsPanel();
    if (typeof closeBibleReader === 'function') closeBibleReader();
    if (typeof closeConceptSearch === 'function') closeConceptSearch();
  },

  // Render the Bible Explorer UI structure
  render(state, derived, container) {
    this.container = container;
    
    // Extract Bible-specific params from state
    const { content, ui } = state;
    const params = content?.params || {};
    const { translation, book, chapter, verse } = params;
    
    // Check if we need a full re-render or just navigation update
    const paramsKey = `${book}-${chapter}-${verse}-${translation}`;
    const needsFullRender = !this.initialized || !container.querySelector('#bible-explorer-page');
    
    // Check if the content area has non-Bible content (switching back from Time-Tested/Symbols)
    const textArea = container.querySelector('#bible-explorer-text');
    const hasBibleContent = textArea && textArea.querySelector('.bible-explorer-chapter');
    const switchingBack = !hasBibleContent && book && chapter;
    
    if (needsFullRender) {
      this.renderStructure(container);
    }
    
    // Navigate if params changed OR if switching back to Bible from another content type
    if (this.lastRenderedParams !== paramsKey || switchingBack) {
      this.lastRenderedParams = paramsKey;
      console.log('[BibleView] Navigating to:', { translation, book, chapter, verse, switchingBack });
      
      // Reset restoration flags on navigation change
      this._interlinearRestored = false;
      
      // Wait for Bible data to be ready then navigate
      this.navigateWhenReady(translation, book, chapter, verse);
    }
    
    // Restore UI state from URL (Strong's panel, search)
    this.restoreUIState(ui);
  },
  
  // Restore UI state from URL parameters (syncs panel state with URL)
  restoreUIState(ui) {
    if (!ui) return;
    
    // Sync Strong's panel with URL state
    const currentStrongsOpen = document.getElementById('strongs-sidebar')?.classList.contains('open');
    const currentStrongsId = this._currentStrongsId;
    
    if (ui.strongsId && ui.strongsId !== currentStrongsId) {
      // URL has a Strong's ID different from what we're showing - open/update panel
      this._currentStrongsId = ui.strongsId;
      setTimeout(() => {
        if (typeof showStrongsPanel === 'function') {
          showStrongsPanel(ui.strongsId, '', '', null);
        }
      }, 100);
    } else if (!ui.strongsId && currentStrongsOpen) {
      // URL has no Strong's ID but panel is open - close it
      // Pass true to skip dispatch since we're syncing from URL
      this._currentStrongsId = null;
      setTimeout(() => {
        if (typeof closeStrongsPanel === 'function') {
          closeStrongsPanel(true);
        }
      }, 100);
    }
    
    // Restore search if specified in URL (only once per unique query)
    if (ui.searchQuery && ui.searchQuery !== this._lastSearchQuery) {
      this._lastSearchQuery = ui.searchQuery;
      setTimeout(() => {
        if (typeof startConceptSearch === 'function') {
          startConceptSearch(ui.searchQuery);
        }
      }, 200);
    }
    
    // Restore interlinear if specified in URL (only once per unique verse)
    if (ui.interlinearVerse && ui.interlinearVerse !== this._lastInterlinearVerse) {
      this._lastInterlinearVerse = ui.interlinearVerse;
      setTimeout(() => {
        const state = AppStore.getState();
        const params = state.content?.params || {};
        if (typeof showInterlinear === 'function' && params.book && params.chapter) {
          showInterlinear(params.book, params.chapter, ui.interlinearVerse, null);
        }
      }, 300);
    }
    
    // Update history button states
    this.updateHistoryButtons();
  },
  
  // Update back/forward button states
  // With browser history, we can't easily check if there's history,
  // so we keep buttons enabled. The browser handles no-op cases.
  updateHistoryButtons() {
    const backBtn = document.getElementById('bible-history-back');
    const fwdBtn = document.getElementById('bible-history-forward');
    
    if (backBtn) backBtn.disabled = false;
    if (fwdBtn) fwdBtn.disabled = false;
  },
  
  // Navigate to Bible location once data is loaded
  navigateWhenReady(translation, book, chapter, verse, retries = 0) {
    const maxRetries = 20;
    const retryDelay = 200;
    
    // Check if Bible data is loaded
    const isReady = typeof bibleExplorerState !== 'undefined' && 
                    bibleExplorerState.bookChapterCounts && 
                    Object.keys(bibleExplorerState.bookChapterCounts).length > 0;
    
    if (!isReady && retries < maxRetries) {
      setTimeout(() => this.navigateWhenReady(translation, book, chapter, verse, retries + 1), retryDelay);
      return;
    }
    
    if (!isReady) {
      console.warn('[BibleView] Bible data not loaded after retries');
    }
    
    // Set translation if specified
    if (translation && typeof switchTranslation === 'function') {
      switchTranslation(translation);
    }
    
    if (book && chapter) {
      if (typeof openBibleExplorerTo === 'function') {
        console.log('[BibleView] Calling openBibleExplorerTo:', book, chapter, verse);
        openBibleExplorerTo(book, parseInt(chapter), verse ? parseInt(verse) : null);
      }
    } else if (!book) {
      // Go to Bible home
      if (typeof goToBibleHome === 'function') {
        goToBibleHome();
      }
    }
  },

  renderStructure(container) {
    
    container.innerHTML = `
      <div id="bible-explorer-page" class="bible-explorer-page">
        <!-- Header -->
        <div class="bible-explorer-header">
          <div class="bible-explorer-header-inner">
            <!-- Home button -->
            <a href="/reader/bible" class="bible-home-link" onclick="goToBibleHome(); return false;" title="Bible Home">
              📖
            </a>
            
            <!-- Content type selector -->
            <select id="reader-content-select" class="bible-explorer-select reader-content-select" 
                    onchange="onReaderContentChange(this.value)" title="Select content type">
              <option value="bible">Bible</option>
              <option value="symbols">SYM</option>
              <option value="timetested">TTT</option>
            </select>
            
            <!-- Bible selectors (shown when content=bible) -->
            <span id="bible-selectors" class="reader-selector-group">
              <select id="bible-translation-select" class="bible-explorer-select bible-translation-select" 
                      onchange="onTranslationChange(this.value)" title="Select translation">
                <option value="kjv">KJV</option>
                <option value="asv">ASV</option>
              </select>
              
              <select id="bible-book-select" class="bible-explorer-select" 
                      onchange="selectBibleBook(this.value)" title="Select book">
                <option value="">Book</option>
              </select>
              
              <select id="bible-chapter-select" class="bible-explorer-select" 
                      onchange="selectBibleChapter(parseInt(this.value))" disabled title="Select chapter">
                <option value="">Ch.</option>
              </select>
            </span>
            
            <!-- Symbol selector (shown when content=symbols) -->
            <span id="symbol-selectors" class="reader-selector-group" style="display:none;">
              <select id="symbol-select" class="bible-explorer-select" 
                      onchange="onSymbolSelect(this.value)" title="Select symbol">
                <option value="">Symbol...</option>
              </select>
            </span>
            
            <!-- Time Tested selector (shown when content=timetested) -->
            <span id="timetested-selectors" class="reader-selector-group" style="display:none;">
              <select id="timetested-chapter-select" class="bible-explorer-select" 
                      onchange="onTimeTestedSelect(this.value)" title="Select chapter">
                <option value="">Chapter...</option>
              </select>
            </span>
            
            <!-- Search -->
            <div class="bible-explorer-search-inline">
              <input type="text" id="bible-explorer-search-input" 
                     placeholder="John 3:16 or 'faith'" 
                     onkeydown="if(event.key==='Enter') smartBibleSearch()">
              <button class="bible-explorer-search-btn" onclick="smartBibleSearch()" title="Search">🔍</button>
            </div>
          </div>
        </div>
        
        <!-- Body -->
        <div class="bible-explorer-body">
          <div class="bible-content-wrapper">
            <!-- Concept search results (hidden by default, appears at top) -->
            <div id="concept-search-results" class="concept-search-results" style="display: none;"></div>
            <div id="search-divider" class="search-divider" style="display: none;">
              <div class="search-divider-handle"></div>
            </div>
            
            <!-- Hidden element to track chapter title (for syncing with content) -->
            <span id="bible-chapter-title" style="display:none;">Select a book and chapter</span>
            
            <!-- Main text area -->
            <div id="bible-explorer-text" class="bible-explorer-text">
              <!-- Welcome content or chapter content rendered here -->
            </div>
            
            <!-- Bottom Chapter Navigation (compact) -->
            <div class="bible-chapter-nav bible-chapter-nav-bottom">
              <button class="bible-nav-btn" onclick="prevBibleChapter()" title="Previous chapter">◁ Prev</button>
              <button class="bible-nav-btn" onclick="nextBibleChapter()" title="Next chapter">Next ▷</button>
            </div>
          </div>
          
          <!-- Strong's Sidebar -->
          <div id="strongs-sidebar" class="strongs-sidebar">
            <div class="strongs-sidebar-header">
              <div class="strongs-nav-buttons">
                <button id="strongs-nav-back" class="strongs-nav-back" onclick="strongsGoBack()" disabled title="Back">◀</button>
                <button id="strongs-nav-forward" class="strongs-nav-forward" onclick="strongsGoForward()" disabled title="Forward">▶</button>
              </div>
              <span id="strongs-sidebar-title" class="strongs-sidebar-title"></span>
              <button class="strongs-sidebar-close" onclick="closeStrongsPanel()">✕</button>
            </div>
            <div id="strongs-sidebar-content" class="strongs-sidebar-content"></div>
            <div class="strongs-sidebar-resize"></div>
          </div>
        </div>
      </div>
      
      <!-- Bible Reader Modal (for quick citations) -->
      <div id="bible-reader-modal" class="bible-reader-modal">
        <div class="bible-reader-container">
          <div class="bible-reader-header">
            <span id="bible-reader-modal-title" class="bible-reader-title"></span>
            <button class="bible-reader-close" onclick="closeBibleReader()">✕</button>
          </div>
          <div class="bible-reader-body">
            <div id="bible-reader-text" class="bible-reader-content"></div>
          </div>
        </div>
      </div>
      
      <!-- Loading dialog -->
      <div id="bible-loading-dialog" class="bible-loading-dialog">
        <div class="bible-loading-content">
          <div class="bible-loading-spinner"></div>
          <div id="bible-loading-text" class="bible-loading-text">Loading Bible...</div>
        </div>
      </div>
    `;

    // Initialize after DOM is ready
    this.initialize();
  },

  // Initialize the Bible explorer
  initialize() {
    if (this.initialized) return;
    
    // Initialize Bible explorer from bible-reader.js
    if (typeof initBibleExplorer === 'function') {
      initBibleExplorer();
    }
    
    // Load all translations in background
    if (typeof loadAllTranslations === 'function') {
      loadAllTranslations();
    }
    
    this.initialized = true;
  }
};

// Helper function to get welcome HTML (used by bible-reader.js)
function getBibleWelcomeHTML() {
  return `
    <div class="bible-explorer-welcome">
      <h2>Welcome to the Bible Explorer</h2>
      <p>Select a translation to begin reading, or use the search bar to find specific verses.</p>
      
      <div class="bible-translation-cards">
        <div class="bible-translation-card" onclick="selectTranslationAndStart('kjv')">
          <h3>King James Version</h3>
          <p>The classic 1611 translation with Strong's numbers for word study.</p>
          <span class="bible-translation-start">Start Reading →</span>
        </div>
        <div class="bible-translation-card" onclick="selectTranslationAndStart('asv')">
          <h3>American Standard Version</h3>
          <p>A literal 1901 translation known for accuracy.</p>
          <span class="bible-translation-start">Start Reading →</span>
        </div>
      </div>
      
      <div class="bible-quick-links">
        <h4>Quick Links</h4>
        <div class="bible-quick-link-grid">
          <a href="/reader/bible/kjv/Genesis/1" onclick="openBibleExplorerTo('Genesis', 1); return false;">Genesis 1</a>
          <a href="/reader/bible/kjv/Psalms/23" onclick="openBibleExplorerTo('Psalms', 23); return false;">Psalm 23</a>
          <a href="/reader/bible/kjv/John/1" onclick="openBibleExplorerTo('John', 1); return false;">John 1</a>
          <a href="/reader/bible/kjv/Revelation/1" onclick="openBibleExplorerTo('Revelation', 1); return false;">Revelation 1</a>
        </div>
      </div>
    </div>
  `;
}

// Update loading dialog text
function updateLoadingDialogText(text) {
  const el = document.getElementById('bible-loading-text');
  if (el) el.textContent = text;
}

// Bridge functions for chapter navigation
function prevBibleChapter() {
  if (typeof navigateBibleChapter === 'function') {
    navigateBibleChapter(-1);
  }
}

function nextBibleChapter() {
  if (typeof navigateBibleChapter === 'function') {
    navigateBibleChapter(1);
  }
}

// Use browser history for back/forward - this works reliably across all content types
// The popstate event handler in url-router.js will update app state when URL changes
// NOTE: These functions are also defined in bible-reader.js - ensure only one is loaded
// or they should be identical

// Check if back/forward is available
function canBibleGoBack() {
  // Browser history doesn't expose length reliably, so we always return true
  // The browser will handle the no-op case
  return true;
}

function canBibleGoForward() {
  if (typeof AppStore !== 'undefined') {
    const h = AppStore.getState().bibleHistory;
    return h && h.index < h.entries.length - 1;
  }
  return false;
}

// Override updateBibleExplorerURL to sync with AppStore
(function() {
  // Wait for bible-reader.js to define the original function
  const checkAndOverride = () => {
    if (typeof window.updateBibleExplorerURL === 'function' && !window._bibleUrlOverridden) {
      const originalUpdateURL = window.updateBibleExplorerURL;
      window.updateBibleExplorerURL = function(book, chapter, verse = null) {
        // Call original to update history
        originalUpdateURL(book, chapter, verse);
        
        // Also update AppStore
        if (typeof AppStore !== 'undefined') {
          const translation = window.currentTranslation || 'kjv';
          AppStore.dispatch({
            type: 'SET_BIBLE_LOCATION',
            translation: translation,
            book: book,
            chapter: chapter,
            verse: verse
          });
        }
      };
      window._bibleUrlOverridden = true;
    }
    
    // Override showStrongsPanel to update URL
    if (typeof window.showStrongsPanel === 'function' && !window._strongsUrlOverridden) {
      const originalShowStrongs = window.showStrongsPanel;
      window.showStrongsPanel = function(strongsNum, englishWord, gloss, event) {
        originalShowStrongs(strongsNum, englishWord, gloss, event);
        // Update URL with Strong's number
        if (typeof AppStore !== 'undefined') {
          AppStore.dispatch({ type: 'SET_STRONGS_ID', strongsId: strongsNum });
        }
      };
      window._strongsUrlOverridden = true;
    }
    
    // Override closeStrongsPanel to clear URL
    if (typeof window.closeStrongsPanel === 'function' && !window._strongsCloseOverridden) {
      const originalCloseStrongs = window.closeStrongsPanel;
      window.closeStrongsPanel = function() {
        originalCloseStrongs();
        // Clear Strong's from URL
        if (typeof AppStore !== 'undefined') {
          AppStore.dispatch({ type: 'SET_STRONGS_ID', strongsId: null });
        }
      };
      window._strongsCloseOverridden = true;
    }
    
    // Override startConceptSearch to update URL
    if (typeof window.startConceptSearch === 'function' && !window._searchUrlOverridden) {
      const originalSearch = window.startConceptSearch;
      window.startConceptSearch = function(word) {
        originalSearch(word);
        // Update URL with search query
        if (typeof AppStore !== 'undefined') {
          AppStore.dispatch({ type: 'SET_SEARCH_QUERY', searchQuery: word });
        }
      };
      window._searchUrlOverridden = true;
    }
    
    // Override closeConceptSearch to clear URL
    if (typeof window.closeConceptSearch === 'function' && !window._searchCloseOverridden) {
      const originalCloseSearch = window.closeConceptSearch;
      window.closeConceptSearch = function() {
        originalCloseSearch();
        // Clear search from URL
        if (typeof AppStore !== 'undefined') {
          AppStore.dispatch({ type: 'SET_SEARCH_QUERY', searchQuery: null });
        }
      };
      window._searchCloseOverridden = true;
    }
    
    // Override showInterlinear to track open state in URL
    if (typeof window.showInterlinear === 'function' && !window._interlinearOverridden) {
      const originalShowInterlinear = window.showInterlinear;
      window.showInterlinear = async function(book, chapter, verse, event) {
        await originalShowInterlinear(book, chapter, verse, event);
        // Check if interlinear is now expanded (toggle behavior)
        const verseEl = document.getElementById(`verse-${verse}`);
        const isExpanded = verseEl && verseEl.classList.contains('interlinear-expanded');
        if (typeof AppStore !== 'undefined') {
          AppStore.dispatch({ 
            type: 'SET_INTERLINEAR_VERSE', 
            verse: isExpanded ? verse : null 
          });
        }
      };
      window._interlinearOverridden = true;
    }
  };
  
  // Check immediately and after delays
  checkAndOverride();
  setTimeout(checkAndOverride, 500);
  setTimeout(checkAndOverride, 1000);
  setTimeout(checkAndOverride, 2000);
})();
