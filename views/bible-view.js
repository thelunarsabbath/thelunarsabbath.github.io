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
    if (this._mobileHeightCleanup && typeof this._mobileHeightCleanup === 'function') {
      this._mobileHeightCleanup();
      this._mobileHeightCleanup = null;
    }
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
    const { translation, book, chapter, verse, contentType, multiverse } = params;
    
    const isMultiverse = contentType === 'multiverse' && multiverse;
    const paramsKey = isMultiverse
      ? `multiverse:${translation || 'kjv'}:${multiverse}`
      : `${book}-${chapter}-${verse}-${translation}`;
    const needsFullRender = !this.initialized || !container.querySelector('#bible-explorer-page');
    
    // Check if the content area has non-Bible content (switching back from Time-Tested/Symbols)
    const textArea = container.querySelector('#bible-explorer-text');
    const hasBibleContent = textArea && textArea.querySelector('.bible-explorer-chapter');
    const switchingBack = !hasBibleContent && book && chapter && !isMultiverse;
    
    if (needsFullRender) {
      this.renderStructure(container, state);
    } else {
      this.applyMobileReaderHeight();
    }
    // Always sync selector visibility (handles multiverse hide, content type switching, etc.)
    this.syncSelectorVisibility(state);
    
    if (isMultiverse) {
      if (this.lastRenderedParams !== paramsKey) {
        this.lastRenderedParams = paramsKey;
        console.log('[BibleView] Rendering multiverse:', multiverse);
        this.renderMultiverseContent(multiverse, translation || 'kjv');
      }
    } else {
      // Navigate if params changed OR if switching back to Bible from another content type
      if (this.lastRenderedParams !== paramsKey || switchingBack) {
        this.lastRenderedParams = paramsKey;
        console.log('[BibleView] Navigating to:', { translation, book, chapter, verse, switchingBack });
        
        // Reset restoration flags on navigation change
        this._interlinearRestored = false;
        
        // Wait for Bible data to be ready then navigate
        this.navigateWhenReady(translation, book, chapter, verse);
      }
    }
    
    // Restore UI state from URL (Strong's panel, search)
    this.restoreUIState(ui);
  },

  // Render multiverse view (verses from citation string) in #bible-explorer-text
  async renderMultiverseContent(citationStr, translation) {
    const textContainer = document.getElementById('bible-explorer-text');
    if (!textContainer) return;
    const requestedTranslation = translation || 'kjv';
    // Ensure Bible data is loaded
    const isReady = typeof bibleExplorerState !== 'undefined' &&
                    bibleExplorerState.bookChapterCounts &&
                    Object.keys(bibleExplorerState.bookChapterCounts).length > 0;
    if (!isReady) {
      if (typeof loadBible === 'function') {
        textContainer.innerHTML = '<div class="bible-explorer-welcome"><p>Loading Bible...</p></div>';
        await loadBible(false);
      }
    }
    if (requestedTranslation && typeof switchTranslation === 'function') {
      await switchTranslation(requestedTranslation);
    }
    // Only skip if we're no longer in multiverse or the citation changed
    const state = typeof AppStore !== 'undefined' ? AppStore.getState() : null;
    const p = state?.content?.params || {};
    if (p.contentType !== 'multiverse') return;
    const stateCitation = (p.multiverse || '').trim();
    const citationNorm = (citationStr || '').trim();
    if (stateCitation !== citationNorm) return;
    // Use the translation we were invoked with (from state at render time)
    if (typeof buildMultiverseHTML === 'function') {
      textContainer.innerHTML = buildMultiverseHTML(citationStr, requestedTranslation);
    } else {
      textContainer.innerHTML = '<div class="bible-explorer-welcome"><p>Multi-verse view not available.</p></div>';
    }
    // Keep dropdown in sync with what we rendered (state is source of truth)
    if (typeof updateTranslationUI === 'function') updateTranslationUI();
  },
  
  // Restore UI state from URL parameters (syncs panel state with URL)
  // This follows unidirectional flow: state -> UI, not UI -> state
  restoreUIState(ui) {
    if (!ui) return;
    
    // Sync Strong's panel with URL state
    const sidebar = document.getElementById('strongs-sidebar');
    const currentStrongsOpen = sidebar?.classList.contains('open');
    
    if (ui.strongsId && ui.strongsId !== this._currentStrongsId) {
      // URL has a Strong's ID different from what we're showing - open/update panel
      this._currentStrongsId = ui.strongsId;
      // Use requestAnimationFrame for proper DOM timing instead of arbitrary setTimeout
      requestAnimationFrame(() => {
        if (typeof showStrongsPanel === 'function') {
          // Pass skipDispatch=true to prevent re-dispatching to AppStore (we're syncing FROM state)
          showStrongsPanel(ui.strongsId, '', '', null, true);
        }
      });
    } else if (!ui.strongsId && currentStrongsOpen) {
      // URL has no Strong's ID but panel is open - close it
      this._currentStrongsId = null;
      requestAnimationFrame(() => {
        if (typeof closeStrongsPanel === 'function') {
          closeStrongsPanel(true); // skipDispatch=true since we're syncing from URL
        }
      });
    }
    
    // Sync search state
    if (ui.searchQuery !== this._lastSearchQuery) {
      this._lastSearchQuery = ui.searchQuery;
      if (ui.searchQuery) {
        // Need to show search results - but wait for interlinear data to be loaded first
        // Search requires interlinear data to find Strong's numbers
        const performSearch = async () => {
          // Ensure both OT and NT interlinear data are loaded before searching
          try {
            if (typeof loadInterlinear === 'function') {
              await loadInterlinear();
            }
            if (typeof loadNTInterlinear === 'function') {
              await loadNTInterlinear();
            }
          } catch (err) {
            console.warn('Failed to load interlinear data for search:', err);
          }
          
          // Small delay to ensure DOM is ready
          requestAnimationFrame(() => {
            if (typeof startConceptSearch === 'function') {
              startConceptSearch(ui.searchQuery, true);
            }
          });
        };
        
        performSearch();
      } else {
        // Need to close search if open - skipDispatch=true since we're syncing FROM state
        const resultsContainer = document.getElementById('concept-search-results');
        if (resultsContainer && resultsContainer.style.display !== 'none') {
          requestAnimationFrame(() => {
            if (typeof closeConceptSearch === 'function') {
              closeConceptSearch(true);
            }
          });
        }
      }
    }
    
    // Sync interlinear state
    if (ui.interlinearVerse !== this._lastInterlinearVerse) {
      const prevVerse = this._lastInterlinearVerse;
      this._lastInterlinearVerse = ui.interlinearVerse;
      
      requestAnimationFrame(() => {
        const state = AppStore.getState();
        const params = state.content?.params || {};
        
        if (ui.interlinearVerse && params.book && params.chapter) {
          // Need to show interlinear for this verse
          const verseEl = document.getElementById(`verse-${ui.interlinearVerse}`);
          const isAlreadyExpanded = verseEl?.classList.contains('interlinear-expanded');
          if (!isAlreadyExpanded && typeof showInterlinear === 'function') {
            showInterlinear(params.book, params.chapter, ui.interlinearVerse, null);
          }
        } else if (prevVerse) {
          // Need to collapse previous interlinear
          const prevVerseEl = document.getElementById(`verse-${prevVerse}`);
          const existing = prevVerseEl?.querySelector('.interlinear-display');
          if (existing) {
            existing.classList.remove('expanded');
            setTimeout(() => existing.remove(), 200);
            prevVerseEl.classList.remove('interlinear-expanded');
          }
        }
      });
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
  
  // Sync selector visibility from state (when page structure already exists)
  syncSelectorVisibility(state) {
    const contentType = state?.content?.params?.contentType || 'bible';
    const displayContentType = (contentType === 'multiverse') ? 'bible' : contentType;
    
    // Update content type dropdown (multiverse displays as Bible)
    const contentSelect = document.getElementById('reader-content-select');
    if (contentSelect) {
      contentSelect.value = displayContentType;
    }
    
    // Show/hide selector groups (multiverse shows Bible selectors e.g. translation)
    const hideAllSelectors = ['words', 'numbers', 'people', 'symbols-article', 'philo', 'josephus'].includes(displayContentType);
    const bibleSelectors = document.getElementById('bible-selectors');
    const symbolSelectors = document.getElementById('symbol-selectors');
    const ttSelectors = document.getElementById('timetested-selectors');
    
    const classicsSelectors = document.getElementById('classics-selectors');
    
    if (bibleSelectors) bibleSelectors.style.display = ((contentType === 'bible' || contentType === 'multiverse') && !hideAllSelectors) ? '' : 'none';
    if (symbolSelectors) symbolSelectors.style.display = (contentType === 'symbols' && !hideAllSelectors) ? '' : 'none';
    if (ttSelectors) ttSelectors.style.display = (contentType === 'timetested' && !hideAllSelectors) ? '' : 'none';
    if (classicsSelectors) classicsSelectors.style.display = (contentType === 'philo' || contentType === 'josephus') ? '' : 'none';

    // In multiverse mode, hide book/chapter selectors (translation still active)
    const isMultiverse = contentType === 'multiverse';
    const bookSelect = document.getElementById('bible-book-select');
    const chapterSelect = document.getElementById('bible-chapter-select');
    if (bookSelect) bookSelect.style.display = isMultiverse ? 'none' : '';
    if (chapterSelect) chapterSelect.style.display = isMultiverse ? 'none' : '';
  },
  
  // Navigate to Bible location once data is loaded
  async navigateWhenReady(translation, book, chapter, verse, retries = 0) {
    // No translation → show translation picker immediately (no data needed)
    if (!translation) {
      if (typeof goToBibleHome === 'function') {
        goToBibleHome();
      }
      return;
    }

    // Load translation if needed
    if (translation && typeof switchTranslation === 'function') {
      await switchTranslation(translation);
    }

    // Translation set but no book → show book index
    if (!book) {
      if (typeof goToBookIndex === 'function') {
        goToBookIndex();
      }
      return;
    }

    // Wait for Bible data to be ready (needed for chapter display)
    const maxRetries = 20;
    const retryDelay = 200;
    const isReady = typeof bibleExplorerState !== 'undefined' &&
                    bibleExplorerState.bookChapterCounts &&
                    Object.keys(bibleExplorerState.bookChapterCounts).length > 0;

    if (!isReady && retries < maxRetries) {
      setTimeout(() => this.navigateWhenReady(translation, book, chapter, verse, retries + 1), retryDelay);
      return;
    }

    // Navigate to book/chapter
    if (book && chapter) {
      if (typeof openBibleExplorerTo === 'function') {
        console.log('[BibleView] Calling openBibleExplorerTo:', book, chapter, verse);
        openBibleExplorerTo(book, parseInt(chapter), verse ? parseInt(verse) : null);
      }
    }
  },

  // Render the reader structure with correct state from the start (unidirectional data flow)
  renderStructure(container, state = null) {
    // Get contentType from state - this determines which selectors are visible
    const contentType = state?.content?.params?.contentType || 'bible';
    // Multiverse uses Bible selectors (e.g. translation) and shows as Bible in dropdown
    const displayContentType = (contentType === 'multiverse') ? 'bible' : contentType;
    
    // Build content type dropdown with correct selection
    const contentTypeOptions = [
      { value: 'bible', label: 'Bible' },
      { value: 'symbols', label: 'Symbols' },
      { value: 'words', label: 'Words' },
      { value: 'numbers', label: 'Numbers' },
      { value: 'timetested', label: 'Time Tested Tradition' },
      { value: 'philo', label: 'Philo' },
      { value: 'josephus', label: 'Josephus' },
      { value: 'people', label: 'People' } // Future: People studies
    ].map(opt => `<option value="${opt.value}"${opt.value === displayContentType ? ' selected' : ''}>${opt.label}</option>`).join('');
    
    // Selector visibility based on contentType (multiverse shows Bible selectors for translation)
    const hideAllSelectors = ['words', 'people', 'symbols-article', 'philo', 'josephus'].includes(displayContentType);
    const bibleDisplay = ((contentType === 'bible' || contentType === 'multiverse') && !hideAllSelectors) ? '' : 'display:none;';
    const symbolsDisplay = (contentType === 'symbols' && !hideAllSelectors) ? '' : 'display:none;';
    const ttDisplay = (contentType === 'timetested' && !hideAllSelectors) ? '' : 'display:none;';
    const numbersDisplay = (contentType === 'numbers') ? '' : 'display:none;';
    const classicsDisplay = (contentType === 'philo' || contentType === 'josephus') ? '' : 'display:none;';
    
    container.innerHTML = `
      <div id="bible-explorer-page" class="bible-explorer-page">
        <!-- Header -->
        <div class="bible-explorer-header">
          <div class="bible-explorer-header-inner">
            <!-- Content type selector -->
            <select id="reader-content-select" class="bible-explorer-select reader-content-select" 
                    onchange="onReaderContentChange(this.value)" title="Select content type">
              ${contentTypeOptions}
            </select>
            
            <!-- Bible selectors (shown when content=bible) -->
            <span id="bible-selectors" class="reader-selector-group" style="${bibleDisplay}">
              <select id="bible-translation-select" class="bible-explorer-select bible-translation-select" 
                      onchange="onTranslationChange(this.value)" title="Select translation">
                ${(() => {
                  const ord = (typeof Bible !== 'undefined') ? Bible.getOrderedTranslations() : { visible: [{id:'kjv',name:'KJV'},{id:'asv',name:'ASV'},{id:'lxx',name:'LXX'}], hidden: [] };
                  const trans = state?.content?.params?.translation || 'kjv';
                  let opts = ord.visible.map(t => `<option value="${t.id}"${t.id === trans ? ' selected' : ''}>${t.name}</option>`).join('');
                  if (ord.hidden.length > 0) {
                    opts += '<optgroup label="More">' + ord.hidden.map(t => `<option value="${t.id}"${t.id === trans ? ' selected' : ''}>${t.name}</option>`).join('') + '</optgroup>';
                  }
                  return opts;
                })()}
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
            <span id="symbol-selectors" class="reader-selector-group" style="${symbolsDisplay}">
              <select id="symbol-select" class="bible-explorer-select" 
                      onchange="onSymbolSelect(this.value)" title="Select symbol">
                <option value="">Symbol...</option>
              </select>
            </span>
            
            <!-- Time Tested selector (shown when content=timetested) -->
            <span id="timetested-selectors" class="reader-selector-group" style="${ttDisplay}">
              <select id="timetested-chapter-select" class="bible-explorer-select" 
                      onchange="onTimeTestedSelect(this.value)" title="Select chapter">
                <option value="">📚 Index</option>
              </select>
            </span>
            
            <!-- Number selector (shown when content=numbers) -->
            <span id="number-selectors" class="reader-selector-group" style="${numbersDisplay}">
              <select id="number-select" class="bible-explorer-select" 
                      onchange="onNumberSelect(this.value)" title="Select number study">
                <option value="">📚 Index</option>
              </select>
            </span>
            
            <!-- Classics selectors (shown when content=philo or content=josephus) -->
            <span id="classics-selectors" class="reader-selector-group" style="${classicsDisplay}">
              <select id="classics-work-select" class="bible-explorer-select"
                      onchange="onClassicsWorkChange(this.value)" title="Select work">
                <option value="">Work...</option>
              </select>
              <input id="classics-section-input" class="bible-explorer-select classics-section-input"
                     type="text" placeholder="Go to..." title="Jump to section (e.g. 3.2.1)"
                     onkeydown="if(event.key==='Enter'){onClassicsSectionJump(this.value);this.value='';}"
                     style="width:80px;">
            </span>
          </div>
        </div>
        
        <!-- Body -->
        <div class="bible-explorer-body">
          <div class="bible-content-wrapper">
            <!-- Hidden element to track chapter title (for syncing with content) -->
            <span id="bible-chapter-title" style="display:none;">Select a book and chapter</span>
            
            <!-- Main text area (prev/next nav is rendered inside content when viewing a chapter) -->
            <div id="bible-explorer-text" class="bible-explorer-text">
              <!-- Welcome content or chapter content rendered here -->
            </div>
          </div>
          
          <!-- Strong's Sidebar (back/forward use top header; width user-resizable) -->
          <div id="strongs-sidebar" class="strongs-sidebar">
            <div class="strongs-sidebar-resize" onmousedown="startStrongsResize(event)"></div>
            <div class="strongs-sidebar-header">
              <span id="strongs-sidebar-title" class="strongs-sidebar-title"></span>
              <button class="strongs-sidebar-close" onclick="closeStrongsPanel()">✕</button>
            </div>
            <div id="strongs-sidebar-content" class="strongs-sidebar-content"></div>
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
    this.applyMobileReaderHeight();
    this._mobileHeightCleanup = this.setupMobileHeightListener();
  },

  /**
   * On mobile, set reader height to viewport minus nav so we don't get a symmetric gap at the bottom.
   * (Content was effectively 100vh while nav sits on top, so bottom gap = nav height.)
   */
  applyMobileReaderHeight() {
    const page = document.getElementById('bible-explorer-page');
    const contentArea = document.getElementById('content-area');
    if (!page || !contentArea) return;
    const isMobile = window.innerWidth <= 768;
    const nav = document.getElementById('top-nav');
    const navHeight = nav ? nav.offsetHeight : 56;
    const availableHeight = window.innerHeight - navHeight;
    if (isMobile && availableHeight > 0) {
      contentArea.style.height = availableHeight + 'px';
      contentArea.style.minHeight = availableHeight + 'px';
      contentArea.style.maxHeight = availableHeight + 'px';
      page.style.height = availableHeight + 'px';
      page.style.minHeight = '0';
      page.style.maxHeight = availableHeight + 'px';
    } else {
      contentArea.style.height = '';
      contentArea.style.minHeight = '';
      contentArea.style.maxHeight = '';
      page.style.height = '';
      page.style.minHeight = '';
      page.style.maxHeight = '';
    }
  },

  setupMobileHeightListener() {
    const onResize = () => {
      if (this.container && this.container.querySelector('#bible-explorer-page')) {
        this.applyMobileReaderHeight();
      }
    };
    window.addEventListener('resize', onResize);
    if (typeof window.visualViewport !== 'undefined') {
      window.visualViewport.addEventListener('resize', onResize);
    }
    return () => {
      window.removeEventListener('resize', onResize);
      if (typeof window.visualViewport !== 'undefined') {
        window.visualViewport.removeEventListener('resize', onResize);
      }
    };
  }
};

// Helper function to get welcome HTML (used by bible-reader.js)
function getBibleWelcomeHTML() {
  // Generate translation cards in user-preferred order
  const { visible, hidden } = (typeof Bible !== 'undefined') ? Bible.getOrderedTranslations() : { visible: [], hidden: [] };
  const translations = [...visible, ...hidden];
  let cardsHTML = '';

  if (translations.length > 0) {
    for (const t of translations) {
      const strongsBadge = t.hasStrongs ? '<span class="translation-badge">Strong\'s</span>' : '';
      const yearStr = t.year ? ` (${t.year})` : '';
      cardsHTML += `
        <div class="bible-translation-card" onclick="selectTranslationAndStart('${t.id}')">
          <h3>${t.fullName}${yearStr} ${strongsBadge}</h3>
          <p>${t.description || ''}</p>
          <span class="bible-translation-start">Start Reading →</span>
        </div>`;
    }
  } else {
    // Fallback if Bible API not loaded
    cardsHTML = `
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
      <div class="bible-translation-card" onclick="selectTranslationAndStart('lxx')">
        <h3>Septuagint (LXX)</h3>
        <p>Ancient Greek OT translation quoted by NT authors.</p>
        <span class="bible-translation-start">Start Reading →</span>
      </div>`;
  }

  return `
    <div class="bible-explorer-welcome">
      <h2>Welcome to the Bible Explorer</h2>
      <p>Select a translation to begin reading, or use the search bar to find specific verses.</p>
      <div class="bible-translation-cards">
        ${cardsHTML}
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

// NOTE: All reader functions (showStrongsPanel, closeStrongsPanel, startConceptSearch,
// closeConceptSearch, showInterlinear, updateBibleExplorerURL) now dispatch to AppStore
// directly in bible-reader.js. No monkey-patching needed.
