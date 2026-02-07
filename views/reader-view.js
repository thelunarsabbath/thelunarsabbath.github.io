/**
 * ReaderView - Unified Reader for Bible, Symbols, and Time Tested Book
 * 
 * URL Structure:
 *   /reader/bible/kjv/Genesis/1     → Bible chapter
 *   /reader/symbols/tree            → Symbol study
 *   /reader/words/H2320             → Word study (lexical)
 *   /reader/numbers/666              → Number study (symbolic meaning of numbers)
 *   /reader/timetested/chapter-slug  → Time Tested book chapter
 * 
 * This view delegates to the appropriate renderer based on contentType.
 */

const ReaderView = {
  initialized: false,
  container: null,
  currentContentType: null,
  // Track what's currently rendered to avoid unnecessary re-renders
  _renderedContentType: null,
  _renderedSymbol: null,
  _renderedChapter: null,
  _renderedBibleKey: null,
  /** Cache of Time Tested chapter HTML by chapterId to avoid "Loading chapter..." on revisit */
  _chapterCache: new Map(),

  init() {
    console.log('[ReaderView] init');
    
    // Delegate to BibleView init if it exists
    if (typeof BibleView !== 'undefined' && BibleView.init) {
      BibleView.init();
    }
  },

  cleanup() {
    console.log('[ReaderView] cleanup');
    
    // Reset render tracking
    this._lastRenderKey = null;
    this._renderedContentType = null;
    this._renderedSymbol = null;
    this._renderedChapter = null;
    this._renderedBibleKey = null;
    
    // Delegate cleanup to sub-views
    if (typeof BibleView !== 'undefined' && BibleView.cleanup) {
      BibleView.cleanup();
    }
  },

  render(state, derived, container) {
    this.container = container;
    
    const params = state.content?.params || {};
    const contentType = params.contentType;
    
    // If no contentType specified, show landing page
    if (!contentType) {
      const landingKey = 'reader:landing';
      const uiKey = `${state.ui?.strongsId || ''}`;
      const fullKey = `${landingKey}:ui:${uiKey}`;
      
      if (this._lastRenderKey === fullKey && container.querySelector('.reader-landing-page')) {
        return; // Already rendered
      }
      this._lastRenderKey = fullKey;
      
      this.renderLandingPage(state, derived, container);
      return;
    }
    
    // Not landing page - remove landing page class and reset html/body height
    document.body.classList.remove('reader-landing');
    document.documentElement.style.removeProperty('height');
    document.body.style.removeProperty('height');
    
    // Build a key for the current content to detect if we need to re-render
    let currentKey;
    switch (contentType) {
      case 'bible':
        currentKey = `bible:${params.translation}:${params.book}:${params.chapter}:${params.verse || ''}`;
        break;
      case 'multiverse':
        currentKey = `multiverse:${(params.multiverse || '').replace(/"/g, '')}`;
        break;
      case 'symbols':
        currentKey = `symbols:${params.symbol || 'index'}`;
        break;
      case 'symbols-article':
        currentKey = `symbols-article:${params.article || 'index'}`;
        break;
      case 'words':
        currentKey = `words:${params.word || 'index'}`;
        break;
      case 'numbers':
        currentKey = `numbers:${params.number || 'index'}`;
        break;
      case 'timetested':
        currentKey = `timetested:${params.chapterId || 'index'}`;
        break;
      default:
        currentKey = 'unknown';
    }
    
    // Check if we need to re-render (content actually changed)
    // Also check if UI state changed (Strong's panel)
    const uiKey = `${state.ui?.strongsId || ''}`;
    const fullKey = `${currentKey}:ui:${uiKey}`;
    
    if (this._lastRenderKey === fullKey && container.querySelector('#bible-explorer-page')) {
      // Content hasn't changed, skip re-render to preserve scroll position
      return;
    }
    
    this._lastRenderKey = fullKey;
    
    console.log('[ReaderView] render contentType:', contentType, 'params:', params);
    
    // Track content type changes (but don't cleanup - we want Strong's panel to stay open)
    if (this.currentContentType !== contentType) {
      // Just track the change, don't call cleanup here
      // Cleanup only happens when leaving the reader view entirely (via ReaderView.cleanup)
      this.currentContentType = contentType;
    }
    
    switch (contentType) {
      case 'bible':
        this.renderBible(state, derived, container);
        // Sync the content selector after Bible view renders
        setTimeout(() => {
          if (typeof updateReaderContentSelector === 'function') {
            updateReaderContentSelector('bible');
          }
        }, 50);
        break;

      case 'multiverse':
        this.renderBible(state, derived, container);
        setTimeout(() => {
          if (typeof updateReaderContentSelector === 'function') {
            updateReaderContentSelector('bible');
          }
        }, 50);
        break;
        
      case 'symbols':
        this.renderSymbolInBibleFrame(state, derived, container, params.symbol);
        // Sync UI state (Strong's panel) for non-Bible content
        this.syncUIState(state.ui);
        setTimeout(() => {
          if (typeof updateReaderContentSelector === 'function') {
            updateReaderContentSelector('symbols');
          }
        }, 50);
        break;
        
      case 'symbols-article':
        this.renderSymbolArticleInBibleFrame(state, derived, container, params.article);
        break;
        
      case 'words':
        this.renderWordStudyInBibleFrame(state, derived, container, params.word);
        setTimeout(() => {
          if (typeof updateReaderContentSelector === 'function') {
            updateReaderContentSelector('words');
          }
        }, 50);
        break;
        
      case 'numbers':
        this.renderNumberStudyInBibleFrame(state, derived, container, params.number);
        setTimeout(() => {
          if (typeof updateReaderContentSelector === 'function') {
            updateReaderContentSelector('numbers');
          }
        }, 50);
        break;
        
      case 'timetested':
        this.renderTimeTestedInBibleFrame(state, derived, container, params.chapterId, params.section);
        // Sync UI state (Strong's panel) for non-Bible content
        this.syncUIState(state.ui);
        setTimeout(() => {
          if (typeof updateReaderContentSelector === 'function') {
            updateReaderContentSelector('timetested');
          }
        }, 50);
        break;
        
      case 'people':
        // Future: People studies - for now, show landing page
        this.renderLandingPage(state, derived, container);
        setTimeout(() => {
          if (typeof updateReaderContentSelector === 'function') {
            updateReaderContentSelector('people');
          }
        }, 50);
        break;
        
      default:
        this.renderBible(state, derived, container);
    }
  },

  /**
   * Render landing page for /reader showing all available content types
   * Uses same pattern as TutorialView - just set innerHTML, let CSS handle scrolling
   */
  renderLandingPage(state, derived, container) {
    // Add body class for CSS scrolling rules (same pattern as view-tutorial)
    document.body.classList.add('reader-landing');
    
    // Override html/body height constraint to allow body scrolling
    // This is necessary because base CSS sets html, body { height: 100% }
    document.documentElement.style.setProperty('height', 'auto', 'important');
    document.body.style.setProperty('height', 'auto', 'important');
    
    // Get counts for each content type
    const symbolCount = typeof SYMBOL_DICTIONARY !== 'undefined' ? Object.keys(SYMBOL_DICTIONARY).length : 0;
    const wordStudyCount = typeof WORD_STUDY_DICTIONARY !== 'undefined' ? Object.keys(WORD_STUDY_DICTIONARY).length : 0;
    const numberStudyFiles = ['GEMATRIA', '666', '7', '40', '12', '3', '6', '10', '70', '1000']; // Common ones
    const chapterCount = typeof TIME_TESTED_CHAPTERS !== 'undefined' ? TIME_TESTED_CHAPTERS.length : 0;
    
    // Render directly to container - CSS handles scrolling
    container.innerHTML = `
      <div class="reader-landing-page">
        <header class="reader-landing-header">
          <h1>📖 Reader</h1>
          <p class="reader-landing-subtitle">Explore Scripture through multiple lenses</p>
        </header>
        
        <div class="reader-content-grid">
          <!-- Bible -->
          <div class="reader-content-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'bible',translation:'kjv',book:'Genesis',chapter:1}})">
            <div class="reader-card-icon">📜</div>
            <h2>Bible</h2>
            <p>Read Scripture with interlinear data, Strong's numbers, and symbol highlighting. Multiple translations available.</p>
            <button class="reader-card-btn">
              Open Bible →
            </button>
          </div>
          
          <!-- Symbols -->
          <div class="reader-content-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols'}})">
            <div class="reader-card-icon">🔑</div>
            <h2>Symbol Studies</h2>
            <p>Discover the symbolic meaning of words in Scripture. Scripture declares it teaches through symbols—unlock the hidden language.</p>
            <div class="reader-card-meta">${symbolCount} symbols</div>
            <button class="reader-card-btn">
              Browse Symbols →
            </button>
          </div>
          
          <!-- Word Studies -->
          <div class="reader-content-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'words'}})">
            <div class="reader-card-icon">📚</div>
            <h2>Word Studies</h2>
            <p>Lexical and etymological studies of Hebrew/Greek words (Strong's). Understand the root meanings and usage patterns.</p>
            <div class="reader-card-meta">${wordStudyCount} studies</div>
            <button class="reader-card-btn">
              Browse Word Studies →
            </button>
          </div>
          
          <!-- Number Studies -->
          <div class="reader-content-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'numbers'}})">
            <div class="reader-card-icon">🔢</div>
            <h2>Number Studies</h2>
            <p>Symbolic meaning of numbers in Scripture—an extension of symbol studies. Explore gematria and numerical patterns.</p>
            <div class="reader-card-meta">Multiple studies</div>
            <button class="reader-card-btn">
              Browse Number Studies →
            </button>
          </div>
          
          <!-- Time Tested Tradition -->
          <div class="reader-content-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested'}})">
            <div class="reader-card-icon">📘</div>
            <h2>Time-Tested Tradition</h2>
            <p>The Renewed Biblical Calendar. A comprehensive study of biblical timekeeping, appointed times, and calendar principles.</p>
            <div class="reader-card-meta">${chapterCount} chapters</div>
            <button class="reader-card-btn">
              Read Book →
            </button>
          </div>
        </div>
        
        <section class="reader-landing-features">
          <h2>Features</h2>
          <ul class="reader-features-list">
            <li>📖 <strong>Interlinear Bible</strong> with Strong's numbers and original language text</li>
            <li>🔍 <strong>Symbol highlighting</strong> - words with symbolic meaning are automatically highlighted</li>
            <li>📚 <strong>Integrated studies</strong> - click symbols, Strong's numbers, or scripture references to explore</li>
            <li>🔢 <strong>Gematria calculator</strong> - explore numerical values of Hebrew and Greek words</li>
            <li>🔗 <strong>Cross-references</strong> - seamless navigation between Bible, symbols, words, and chapters</li>
          </ul>
        </section>
      </div>
    `;
    
    // Update title
    const titleEl = container.querySelector('#bible-chapter-title');
    if (titleEl) titleEl.textContent = 'Reader';
    this.hideChapterNav(container);
  },

  /**
   * Render Bible content - delegates to BibleView
   */
  renderBible(state, derived, container) {
    if (typeof BibleView !== 'undefined') {
      BibleView.render(state, derived, container);
    } else {
      container.innerHTML = '<div class="reader-error">Bible reader not available</div>';
    }
  },

  /**
   * Sync UI state (Strong's panel) with URL for non-Bible content
   */
  syncUIState(ui) {
    if (!ui) return;
    
    const currentStrongsOpen = document.getElementById('strongs-sidebar')?.classList.contains('open');
    
    // If URL has strongsId and panel isn't showing it, open it
    if (ui.strongsId && this._currentStrongsId !== ui.strongsId) {
      this._currentStrongsId = ui.strongsId;
      setTimeout(() => {
        if (typeof showStrongsPanel === 'function') {
          // Pass skipDispatch=true to prevent re-dispatching to AppStore (we're syncing FROM state)
          showStrongsPanel(ui.strongsId, '', '', null, true);
        }
      }, 100);
    } else if (!ui.strongsId && currentStrongsOpen) {
      // URL has no Strong's ID but panel is open - close it (skip dispatch)
      this._currentStrongsId = null;
      setTimeout(() => {
        if (typeof closeStrongsPanel === 'function') {
          closeStrongsPanel(true);
        }
      }, 100);
    }
  },

  /**
   * Render Symbol within the Bible frame (uses same header)
   */
  renderSymbolInBibleFrame(state, derived, container, symbolKey) {
    // First render the Bible structure if not already present
    const existingPage = container.querySelector('#bible-explorer-page');
    if (!existingPage) {
      if (typeof BibleView !== 'undefined') {
        BibleView.renderStructure(container);
      }
    }
    
    // Update the content selector
    setTimeout(() => {
      if (typeof updateReaderContentSelector === 'function') {
        updateReaderContentSelector('symbols');
      }
      // Update symbol selector if a symbol is selected
      if (symbolKey) {
        const symbolSelect = document.getElementById('symbol-select');
        if (symbolSelect) symbolSelect.value = symbolKey;
      }
    }, 50);
    
    // Render symbol content into the text area
    const textArea = container.querySelector('#bible-explorer-text');
    if (textArea) {
      if (!symbolKey) {
        textArea.innerHTML = this.buildSymbolIndexHTML();
      } else {
        const symbol = SYMBOL_DICTIONARY?.[symbolKey];
        if (symbol) {
          // Show loading state then load the full word study
          textArea.innerHTML = this.buildSymbolSummaryHTML(symbol, symbolKey);
          this.loadSymbolStudy(symbolKey, textArea);
          
          // Strong's panel only opens when user clicks a Strong's button
        } else {
          textArea.innerHTML = `<div class="reader-error">Symbol "${symbolKey}" not found</div>`;
        }
      }
    }
    
    // Update the chapter title
    const titleEl = container.querySelector('#bible-chapter-title');
    if (titleEl) {
      titleEl.textContent = symbolKey ? `Symbol: ${SYMBOL_DICTIONARY?.[symbolKey]?.name || symbolKey}` : 'Symbol Dictionary';
    }
    
    // Hide chapter navigation for symbols
    this.hideChapterNav(container);
  },

  /**
   * Render Symbol Article (like HOW-SCRIPTURE-TEACHES.md) within the Bible frame
   */
  renderSymbolArticleInBibleFrame(state, derived, container, articleName) {
    // First render the Bible structure if not already present
    const existingPage = container.querySelector('#bible-explorer-page');
    if (!existingPage) {
      if (typeof BibleView !== 'undefined') {
        BibleView.renderStructure(container);
      }
    }
    
    // Update the content selector to show symbols
    setTimeout(() => {
      if (typeof updateReaderContentSelector === 'function') {
        updateReaderContentSelector('symbols');
      }
    }, 50);
    
    // Render article content into the text area
    const textArea = container.querySelector('#bible-explorer-text');
    if (textArea) {
      // Show loading state
      const articleTitles = {
        'HOW-SCRIPTURE-TEACHES': 'How Scripture Teaches',
        'WHY-PARABLES': 'Why Parables?',
        'METHODOLOGY': 'Human Study Methodology',
        'AI-METHODOLOGY': 'AI-Assisted Study Methodology'
      };
      const displayTitle = articleTitles[articleName] || articleName;
      
      textArea.innerHTML = `
        <div class="reader-symbol-article">
          <nav class="reader-symbol-nav">
            <button class="symbol-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols'}})">
              ← Back to Symbol Dictionary
            </button>
          </nav>
          <div id="symbol-article-content" class="symbol-article-content">
            <div class="symbol-study-loading">Loading article...</div>
          </div>
        </div>
      `;
      
      this.loadSymbolArticle(articleName, textArea);
    }
    
    // Update the chapter title
    const titleEl = container.querySelector('#bible-chapter-title');
    if (titleEl) {
      const articleTitles = {
        'HOW-SCRIPTURE-TEACHES': 'How Scripture Teaches',
        'WHY-PARABLES': 'Why Parables?',
        'METHODOLOGY': 'Human Study Methodology',
        'AI-METHODOLOGY': 'AI-Assisted Study Methodology'
      };
      titleEl.textContent = articleTitles[articleName] || articleName;
    }
    
    // Hide chapter navigation
    this.hideChapterNav(container);
  },

  /**
   * Load and render a symbol article markdown file
   */
  async loadSymbolArticle(articleName, container) {
    const articleContainer = container.querySelector('#symbol-article-content');
    if (!articleContainer) return;
    
    try {
      // All symbol articles are now in /symbols/ folder
      const response = await fetch(`/symbols/${articleName}.md`);
      
      if (!response.ok) {
        throw new Error(`Article not found: ${articleName}`);
      }
      
      const markdown = await response.text();
      const html = this.renderMarkdown(markdown);
      
      articleContainer.innerHTML = `<div class="symbol-article-body">${html}</div>`;
      
      // Make scripture references clickable
      this.linkifyScriptureRefs(articleContainer);
      
      // Make symbol references interactive
      this.linkifySymbolRefs(articleContainer);
      
      // Intercept internal reader links (symbols-article, symbols) so they use SPA navigation
      this.linkifyReaderLinks(articleContainer);
      
    } catch (e) {
      console.error('[ReaderView] Error loading symbol article:', e);
      articleContainer.innerHTML = `<div class="reader-error">Could not load article: ${e.message}</div>`;
    }
  },

  /**
   * Render Word Study (lexical/etymological study of a Hebrew/Greek word) in the reader frame.
   * Distinct from symbol studies: word studies cover root, usage, translation; symbol studies cover what a term represents.
   */
  renderWordStudyInBibleFrame(state, derived, container, wordId) {
    const existingPage = container.querySelector('#bible-explorer-page');
    if (!existingPage && typeof BibleView !== 'undefined') {
      // Pass state with contentType: 'words' so selectors are hidden
      BibleView.renderStructure(container, { content: { params: { contentType: 'words' } } });
    } else if (existingPage && typeof BibleView !== 'undefined' && BibleView.syncSelectorVisibility) {
      // Sync selector visibility if structure already exists
      BibleView.syncSelectorVisibility({ content: { params: { contentType: 'words' } } });
    }
    const textArea = container.querySelector('#bible-explorer-text');
    if (!textArea) return;
    if (!wordId) {
      // Index: list all word studies (from WORD_STUDY_DICTIONARY if available)
      const studies = typeof WORD_STUDY_DICTIONARY !== 'undefined'
        ? Object.values(WORD_STUDY_DICTIONARY).filter((s, i, a) => a.findIndex(x => x.strongs === s.strongs) === i)
        : [];
      textArea.innerHTML = `
        <div class="reader-word-study-index">
          <nav class="reader-symbol-nav">
            <button class="symbol-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{}})">
              ← Back to Reader
            </button>
          </nav>
          <h1>📚 Word Studies</h1>
          <p class="word-study-index-intro">Lexical and etymological studies of Hebrew/Greek words (Strong's). Distinct from <strong>symbol studies</strong>, which ask what a term <em>represents</em> in Scripture.</p>
          <div class="word-study-index-list">
            ${studies.length ? studies.sort((a, b) => (a.strongs || '').localeCompare(b.strongs || '')).map(s => `
              <button class="word-study-index-item" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'words',word:'${s.strongs}'}})">
                <span class="word-study-strongs">${s.strongs}</span>
                <span class="word-study-lemma">${s.lemma || ''}</span>
                <span class="word-study-summary">${(s.summary || '').slice(0, 80)}…</span>
              </button>
            `).join('') : '<p>No word studies in dictionary yet. Word studies are opened from the Bible when you click a Strong\'s number that has an associated study.</p>'}
          </div>
        </div>
      `;
    } else {
      textArea.innerHTML = `
        <div class="reader-word-study">
          <nav class="reader-symbol-nav">
            <button class="symbol-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'words'}})">
              ← Back to Word Studies
            </button>
          </nav>
          <div id="word-study-content" class="word-study-content">
            <div class="symbol-study-loading">Loading word study...</div>
          </div>
        </div>
      `;
      this.loadWordStudy(wordId, textArea);
    }
    const titleEl = container.querySelector('#bible-chapter-title');
    if (titleEl) titleEl.textContent = wordId ? `Word: ${wordId}` : 'Word Studies';
    this.hideChapterNav(container);
  },

  async loadWordStudy(wordId, container) {
    const contentEl = container.querySelector('#word-study-content');
    if (!contentEl) return;
    try {
      const response = await fetch(`/words/${wordId}.md`);
      if (!response.ok) throw new Error(`Word study not found: ${wordId}`);
      const markdown = await response.text();
      const html = this.renderMarkdown(markdown);
      contentEl.innerHTML = `<div class="word-study-body">${html}</div>`;
      this.linkifyScriptureRefs(contentEl);
      this.linkifyReaderLinks(contentEl);
    } catch (e) {
      console.error('[ReaderView] Error loading word study:', e);
      contentEl.innerHTML = `<div class="reader-error">Could not load word study: ${e.message}</div>`;
    }
  },

  /**
   * Render number study in Bible frame (similar to word studies)
   */
  renderNumberStudyInBibleFrame(state, derived, container, numberId) {
    const existingPage = container.querySelector('#bible-explorer-page');
    if (!existingPage && typeof BibleView !== 'undefined') {
      // Pass state with contentType: 'numbers' so selectors are hidden
      BibleView.renderStructure(container, { content: { params: { contentType: 'numbers' } } });
    } else if (existingPage && typeof BibleView !== 'undefined' && BibleView.syncSelectorVisibility) {
      // Sync selector visibility if structure already exists
      BibleView.syncSelectorVisibility({ content: { params: { contentType: 'numbers' } } });
    }
    const textArea = container.querySelector('#bible-explorer-text');
    if (!textArea) return;
    
    if (!numberId) {
      // Index: list all number studies
      // We'll fetch the list dynamically, but for now show the landing page
      textArea.innerHTML = `
        <div class="reader-number-study-index">
          <nav class="reader-symbol-nav">
            <button class="symbol-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{}})">
              ← Back to Reader
            </button>
          </nav>
          <div id="number-study-content" class="number-study-content">
            <div class="symbol-study-loading">Loading number studies...</div>
          </div>
        </div>
      `;
      this.loadNumberStudy('index', textArea);
    } else {
      textArea.innerHTML = `
        <div class="reader-number-study">
          <nav class="reader-symbol-nav">
            <button class="symbol-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'numbers'}})">
              ← Back to Number Studies
            </button>
          </nav>
          <div id="number-study-content" class="number-study-content">
            <div class="symbol-study-loading">Loading number study...</div>
          </div>
        </div>
      `;
      this.loadNumberStudy(numberId, textArea);
    }
    const titleEl = container.querySelector('#bible-chapter-title');
    if (titleEl) titleEl.textContent = numberId && numberId !== 'index' ? `Number: ${numberId}` : 'Number Studies';
    this.hideChapterNav(container);
  },

  async loadNumberStudy(numberId, container) {
    const contentEl = container.querySelector('#number-study-content');
    if (!contentEl) return;
    try {
      // For index, load numbers/index.md, otherwise load numbers/{numberId}.md
      const filename = numberId === 'index' ? 'index.md' : `${numberId}.md`;
      const response = await fetch(`/numbers/${filename}`);
      if (!response.ok) throw new Error(`Number study not found: ${numberId}`);
      const markdown = await response.text();
      const html = this.renderMarkdown(markdown);
      // On index, put Available Number Studies at the top (dropdown in header; grid here)
      if (numberId === 'index') {
        const listHtml = this.getNumberStudyListHTML();
        contentEl.innerHTML = `<div class="number-study-list">${listHtml}</div><div class="number-study-body">${html}</div>`;
      } else {
        contentEl.innerHTML = `<div class="number-study-body">${html}</div>`;
      }
      this.linkifyScriptureRefs(contentEl);
      this.linkifyReaderLinks(contentEl);
    } catch (e) {
      console.error('[ReaderView] Error loading number study:', e);
      contentEl.innerHTML = `<div class="reader-error">Could not load number study: ${e.message}</div>`;
    }
  },

  getNumberStudyListHTML() {
    const knownNumbers = [
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '17', '18',
      '20', '24', '30', '31', '40', '42', '49', '50', '70', '71', '77', '80',
      '100', '120', '144', '153', '490', '666', '1000', 'GEMATRIA'
    ];
    return `
      <h2>Available Number Studies</h2>
      <div class="number-study-grid">
        ${knownNumbers.map(num => `
          <button class="number-study-item" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'numbers',number:'${num}'}})">
            <span class="number-study-value">${num}</span>
          </button>
        `).join('')}
      </div>
    `;
  },

  /**
   * Build summary HTML for a symbol (shown at top before full study)
   */
  buildSymbolSummaryHTML(symbol, symbolKey) {
    const prevNext = this.getSymbolPrevNext(symbolKey);
    
    return `
      <div class="reader-symbol-content-inline">
        <nav class="reader-symbol-nav">
          ${prevNext.prev ? `<button class="symbol-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols',symbol:'${prevNext.prev}'}})">◀ ${prevNext.prevName}</button>` : '<span></span>'}
          ${prevNext.next ? `<button class="symbol-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols',symbol:'${prevNext.next}'}})}">${prevNext.nextName} ▶</button>` : '<span></span>'}
        </nav>
        
        <header class="symbol-header">
          <h1>📖 ${symbol.name}</h1>
          <div class="symbol-meta-row">
            <span class="symbol-words"><strong>Words:</strong> ${symbol.words.join(', ')}</span>
            ${symbol.strongs ? `
            <span class="symbol-strongs-list">
              <strong>Strong's:</strong> 
              ${symbol.strongs.map(s => `<button class="symbol-strongs-btn" onclick="showStrongsPanel('${s}', '', '', event)">${s}</button>`).join(' ')}
            </span>
            ` : ''}
          </div>
        </header>
        
        <div id="symbol-study-content" class="symbol-study-content">
          <div class="symbol-study-loading">Loading word study...</div>
        </div>
      </div>
    `;
  },

  /**
   * Load and render the full symbol study markdown
   */
  async loadSymbolStudy(symbolKey, container) {
    const studyContainer = container.querySelector('#symbol-study-content');
    if (!studyContainer) return;
    
    try {
      // Symbol files are uppercase: /symbols/TREE.md
      const filename = symbolKey.toUpperCase() + '.md';
      const response = await fetch(`/symbols/${filename}`);
      
      if (!response.ok) {
        throw new Error(`Study not found: ${filename}`);
      }
      
      const markdown = await response.text();
      const html = this.renderMarkdown(markdown);
      
      studyContainer.innerHTML = `<div class="symbol-study-body">${html}</div>`;
      
      // Make scripture references clickable
      this.linkifyScriptureRefs(studyContainer);
      
      // Make symbol references interactive (links + tooltips)
      this.linkifySymbolRefs(studyContainer);
      
      // Intercept internal reader links so they use SPA navigation
      this.linkifyReaderLinks(studyContainer);
      
    } catch (e) {
      console.error('[ReaderView] Error loading symbol study:', e);
      // Show the basic symbol info as fallback
      const symbol = SYMBOL_DICTIONARY?.[symbolKey];
      if (symbol) {
        studyContainer.innerHTML = `
          <div class="symbol-fallback">
            <div class="meaning-block meaning-is">
              <div class="meaning-label">IS (What it represents):</div>
              <div class="meaning-value">${symbol.is}${symbol.is2 ? ' / ' + symbol.is2 : ''}</div>
            </div>
            ${symbol.does ? `
            <div class="meaning-block meaning-does">
              <div class="meaning-label">DOES (What it does):</div>
              <div class="meaning-value">${symbol.does}${symbol.does2 ? ' / ' + symbol.does2 : ''}</div>
            </div>
            ` : ''}
            <div class="meaning-block meaning-sentence">
              <div class="meaning-label">Full Meaning:</div>
              <p class="meaning-paragraph">${symbol.sentence}</p>
            </div>
            ${symbol.opposite ? `
            <div class="meaning-block meaning-opposite">
              <div class="meaning-label">Opposite:</div>
              <div class="meaning-value">${symbol.opposite}</div>
            </div>
            ` : ''}
          </div>
        `;
      } else {
        studyContainer.innerHTML = `<div class="reader-error">Could not load study: ${e.message}</div>`;
      }
    }
  },

  /**
   * Render markdown to HTML using marked.js library
   */
  renderMarkdown(markdown) {
    // Skip the first H1 title (we already show it in the header)
    let text = markdown.replace(/^# .+\n+/, '');
    
    // Use marked.js if available, fallback to basic rendering
    if (typeof marked !== 'undefined') {
      // Configure marked for our needs
      marked.setOptions({
        breaks: true,      // Convert \n to <br>
        gfm: true,         // GitHub Flavored Markdown (tables, code blocks, etc.)
        headerIds: true,   // Add IDs to headers for linking
        mangle: false      // Don't escape email addresses
      });
      
      // Parse with marked
      let html = marked.parse(text);
      
      // Post-process: wrap citation lines in blockquotes with <cite> so CSS (e.g. text-align: right) applies
      // 1) When quote and citation are on consecutive lines, marked puts them in one <p>; split so citation gets <cite>
      html = html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (match, content) => {
        const withCite = content.replace(
          /<p>([\s\S]*?)(?:\n|<br>\s*)([—–-]{1,2}\s*.+?)<\/p>/g,
          '<p>$1</p><p><cite>$2</cite></p>'
        );
        return '<blockquote>' + withCite + '</blockquote>';
      });
      // 2) Citation-only paragraph (e.g. blank line between quote and citation in markdown)
      html = html.replace(/<p>([—–-]{1,2}\s*.+?)<\/p>/g, '<p><cite>$1</cite></p>');
      
      // Add anchor IDs to blockquotes that contain scripture citations
      html = html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (match, content) => {
        // Look for scripture reference in citation
        const citationMatch = content.match(/[—–-]{1,2}\s*(\d?\s*[A-Za-z]+)\s+(\d+):(\d+)/);
        if (citationMatch) {
          const book = citationMatch[1].toLowerCase().replace(/\s+/g, '');
          const chapter = citationMatch[2];
          const verse = citationMatch[3];
          const anchor = `ref-${book}-${chapter}-${verse}`;
          return `<blockquote id="${anchor}">${content}</blockquote>`;
        }
        return match;
      });
      
      // Add class to tables for styling
      html = html.replace(/<table>/g, '<table class="md-table">');
      
      return html;
    }
    
    // Fallback: very basic markdown (if marked.js fails to load)
    console.warn('[ReaderView] marked.js not available, using basic fallback');
    text = text
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return `<p>${text}</p>`;
  },

  /**
   * Make scripture references clickable
   */
  linkifyScriptureRefs(container) {
    // Pattern for scripture references:
    // - "Isaiah 5:7" or "Romans 11:17-24" (chapter:verse or verse range)
    // - "Matthew 13" (chapter only)
    // - "Psalm 78:2" or "Psalms 78:2" (handles both singular/plural)
    const books = 'Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation';
    
    // Match: Book Chapter:Verse(-|–|—EndVerse)? OR Book Chapter (chapter only)
    const pattern = new RegExp(`\\b(${books})\\s+(\\d+)(?::(\\d+)(?:[-–—](\\d+))?)?\\b`, 'g');
    
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.match(pattern)) {
        textNodes.push(walker.currentNode);
      }
    }
    
    // Get current translation preference
    let translation = 'kjv';
    try {
      translation = localStorage.getItem('bible_translation_preference') || 'kjv';
    } catch (e) {}
    
    textNodes.forEach(node => {
      const span = document.createElement('span');
      // Reset lastIndex since we reuse the regex
      pattern.lastIndex = 0;
      span.innerHTML = node.nodeValue.replace(pattern, (match, book, chapter, verse, endVerse) => {
        // Build URL - if no verse, default to verse 1
        const targetVerse = verse || 1;
        const url = `/reader/bible/${translation}/${encodeURIComponent(book)}/${chapter}?verse=${targetVerse}`;
        // id matches book-scripture-index anchor format (ref-book-chapter-verse) for scroll-from-Bible
        const anchorId = 'ref-' + (book || '').toLowerCase().replace(/\s+/g, '-') + '-' + chapter + '-' + targetVerse;
        return `<a id="${anchorId}" href="${url}" class="scripture-ref" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'bible',translation:'${translation}',book:'${book}',chapter:${chapter},verse:${targetVerse}}}); return false;">${match}</a>`;
      });
      node.parentNode.replaceChild(span, node);
    });
  },

  /**
   * Make symbol references interactive with links and tooltips
   */
  linkifySymbolRefs(container) {
    if (typeof SYMBOL_DICTIONARY === 'undefined') return;
    
    // First, enhance existing symbol links (markdown links like [NAME](/symbols/name/))
    const symbolLinks = container.querySelectorAll('a[href*="/symbols/"]');
    symbolLinks.forEach(link => {
      // Extract symbol key from href
      const match = link.href.match(/\/symbols\/([a-z]+)\/?/i);
      if (match) {
        const symbolKey = match[1].toLowerCase();
        const symbol = SYMBOL_DICTIONARY[symbolKey];
        if (symbol) {
          // Add data attributes for tooltip
          link.classList.add('symbol-ref');
          link.dataset.symbolKey = symbolKey;
          link.dataset.symbolName = symbol.name;
          link.dataset.symbolMeaning = symbol.is2 || symbol.is;
          link.dataset.symbolSentence = symbol.sentence;
          
          // On click, open Strong's panel for this symbol (which shows symbol details)
          link.onclick = (e) => {
            e.preventDefault();
            if (symbol.strongs && symbol.strongs.length > 0 && typeof showStrongsPanel === 'function') {
              showStrongsPanel(symbol.strongs[0], '', '', e);
            } else {
              // Fallback to symbol page if no strongs number
              AppStore.dispatch({
                type: 'SET_VIEW',
                view: 'reader',
                params: { contentType: 'symbols', symbol: symbolKey }
              });
            }
          };
          
          // Add hover tooltip (first tap on mobile shows this, second tap triggers click)
          this.addSymbolTooltip(link, symbol);
        }
      }
    });
    
    // Also look for standalone symbol names in text (UPPERCASE symbol names)
    // Build pattern from known symbol names
    const symbolNames = Object.values(SYMBOL_DICTIONARY).map(s => s.name);
    if (symbolNames.length === 0) return;
    
    // Create a case-insensitive pattern that matches whole words
    // Match uppercase symbol names or capitalized (e.g., NAME, Name)
    const pattern = new RegExp(`\\b(${symbolNames.join('|')})\\b`, 'g');
    
    // Walk through text nodes
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode()) {
      // Skip if inside a link, code, or already processed element
      const parent = walker.currentNode.parentNode;
      if (parent && (
        parent.tagName === 'A' || 
        parent.tagName === 'CODE' ||
        parent.tagName === 'BUTTON' ||
        parent.classList?.contains('symbol-ref') ||
        parent.closest('a, code, button, .symbol-header, .symbol-nav-btn')
      )) {
        continue;
      }
      if (walker.currentNode.nodeValue.match(pattern)) {
        textNodes.push(walker.currentNode);
      }
    }
    
    textNodes.forEach(node => {
      const span = document.createElement('span');
      span.innerHTML = node.nodeValue.replace(pattern, (match) => {
        // Find the symbol by name (case-insensitive)
        const symbolKey = Object.keys(SYMBOL_DICTIONARY).find(
          k => SYMBOL_DICTIONARY[k].name.toUpperCase() === match.toUpperCase()
        );
        if (symbolKey) {
          const symbol = SYMBOL_DICTIONARY[symbolKey];
          // On click, open Strong's panel if available, otherwise go to symbol page
          const onclick = symbol.strongs && symbol.strongs.length > 0
            ? `if(typeof showStrongsPanel==='function'){showStrongsPanel('${symbol.strongs[0]}','','',event);}else{AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols',symbol:'${symbolKey}'}})} return false;`
            : `AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols',symbol:'${symbolKey}'}}); return false;`;
          return `<a href="/reader/symbols/${symbolKey}" 
            class="symbol-ref symbol-ref-inline" 
            data-symbol-key="${symbolKey}"
            data-symbol-name="${symbol.name}"
            data-symbol-meaning="${symbol.is2 || symbol.is}"
            data-symbol-sentence="${symbol.sentence.replace(/"/g, '&quot;')}"
            onclick="${onclick}"
          >${match}</a>`;
        }
        return match;
      });
      node.parentNode.replaceChild(span, node);
    });
    
    // Add tooltips to all newly created symbol refs
    container.querySelectorAll('.symbol-ref-inline').forEach(link => {
      const symbolKey = link.dataset.symbolKey;
      const symbol = SYMBOL_DICTIONARY[symbolKey];
      if (symbol) {
        this.addSymbolTooltip(link, symbol);
      }
    });
  },

  /**
   * Make internal reader links (symbols-article, symbols) use SPA navigation instead of full page load.
   * Fixes broken "See also" and other /reader/... links inside markdown content.
   */
  linkifyReaderLinks(container) {
    if (!container) return;
    const links = container.querySelectorAll('a[href*="/reader/symbols-article/"], a[href*="/reader/symbols/"], a[href*="/reader/words/"], a[href*="/reader/numbers/"]');
    links.forEach(link => {
      const href = link.getAttribute('href') || '';
      const articleMatch = href.match(/\/reader\/symbols-article\/([^/?#]+)/);
      const symbolMatch = href.match(/\/reader\/symbols\/([^/?#]+)/);
      const wordMatch = href.match(/\/reader\/words\/([^/?#]+)/);
      const numberMatch = href.match(/\/reader\/numbers\/([^/?#]+)/);
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (articleMatch) {
          AppStore.dispatch({
            type: 'SET_VIEW',
            view: 'reader',
            params: { contentType: 'symbols-article', article: articleMatch[1] }
          });
        } else if (symbolMatch) {
          AppStore.dispatch({
            type: 'SET_VIEW',
            view: 'reader',
            params: { contentType: 'symbols', symbol: symbolMatch[1].toLowerCase() }
          });
        } else if (wordMatch) {
          AppStore.dispatch({
            type: 'SET_VIEW',
            view: 'reader',
            params: { contentType: 'words', word: wordMatch[1].toUpperCase() }
          });
        } else if (numberMatch) {
          AppStore.dispatch({
            type: 'SET_VIEW',
            view: 'reader',
            params: { contentType: 'numbers', number: numberMatch[1].toUpperCase() }
          });
        }
      });
    });
  },

  /**
   * Add mouseover tooltip to a symbol reference
   */
  addSymbolTooltip(element, symbol) {
    // Create tooltip on hover
    element.addEventListener('mouseenter', (e) => {
      // Remove any existing tooltip
      const existing = document.querySelector('.symbol-tooltip');
      if (existing) existing.remove();
      
      // Create tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'symbol-tooltip';
      tooltip.innerHTML = `
        <div class="symbol-tooltip-header">${symbol.name}</div>
        <div class="symbol-tooltip-meaning">${symbol.is2 || symbol.is}</div>
        <div class="symbol-tooltip-sentence">${symbol.sentence}</div>
      `;
      document.body.appendChild(tooltip);
      
      // Position tooltip near the element
      const rect = element.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      let left = rect.left + window.scrollX;
      let top = rect.bottom + window.scrollY + 5;
      
      // Keep within viewport
      if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 10;
      }
      if (left < 10) left = 10;
      
      // If tooltip would go below viewport, show above
      if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - tooltipRect.height - 5;
      }
      
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
      tooltip.style.opacity = '1';
    });
    
    element.addEventListener('mouseleave', () => {
      const tooltip = document.querySelector('.symbol-tooltip');
      if (tooltip) {
        tooltip.remove();
      }
    });
  },

  /**
   * Render Time Tested within the Bible frame (uses same header)
   * @param {object} state - App state
   * @param {object} derived - Derived state
   * @param {Element} container - Container element
   * @param {string} chapterId - Chapter ID to load
   * @param {string} section - Optional section anchor to scroll to
   */
  renderTimeTestedInBibleFrame(state, derived, container, chapterId, section) {
    // First render the Bible structure if not already present
    const existingPage = container.querySelector('#bible-explorer-page');
    if (!existingPage) {
      if (typeof BibleView !== 'undefined') {
        BibleView.renderStructure(container);
      }
    }
    
    // Update the content selector
    setTimeout(() => {
      if (typeof updateReaderContentSelector === 'function') {
        updateReaderContentSelector('timetested');
        // updateReaderContentSelector calls populateTimeTestedDropdown(), so we need to set the value after it
      }
      // Set the chapter dropdown value after updateReaderContentSelector has populated it
      // Use a small delay to ensure the dropdown is fully rendered
      setTimeout(() => {
        const chapterSelect = document.getElementById('timetested-chapter-select');
        if (chapterSelect) {
          if (chapterId) {
            // Verify the option exists before setting
            const optionExists = Array.from(chapterSelect.options).some(opt => opt.value === chapterId);
            if (optionExists) {
              chapterSelect.value = chapterId;
            } else {
              console.warn(`Chapter ID "${chapterId}" not found in dropdown`);
            }
          } else {
            // Show Index as selected when viewing index
            chapterSelect.value = '';
          }
        }
      }, 10);
    }, 50);
    
    // Delegate to BookView for the actual content rendering
    const textArea = container.querySelector('#bible-explorer-text');
    if (textArea) {
      if (!chapterId) {
        // Show chapter index
        textArea.innerHTML = this.buildTimeTestedIndexHTML();
      } else if (chapterId === '__reviews__') {
        // Load AI Reviews page (separate section, not a chapter)
        textArea.innerHTML = `<div class="loading">Loading...</div>`;
        this.loadTimeTestedReviewsPage(textArea);
      } else {
        // Render the chapter: use cache if available so we don't show "Loading chapter..." on revisit
        if (this._chapterCache && this._chapterCache.has(chapterId)) {
          textArea.innerHTML = this._chapterCache.get(chapterId);
          this.linkifyScriptureRefs(textArea);
          this.linkifySymbolRefs(textArea);
          if (section) {
            setTimeout(() => this.scrollToSection(section, textArea), 100);
          }
          setTimeout(() => this.scrollToVerseAnchor(textArea), 150);
        } else if (typeof BookView !== 'undefined' && typeof BookView.loadAndRenderChapter === 'function') {
          BookView.loadAndRenderChapter(chapterId, textArea, section);
        } else {
          textArea.innerHTML = `<div class="loading">Loading chapter...</div>`;
          this.loadTimeTestedChapter(chapterId, textArea, section);
        }
      }
    }
    
    // Update the chapter title
    const titleEl = container.querySelector('#bible-chapter-title');
    if (titleEl) {
      if (chapterId === '__reviews__') {
        titleEl.textContent = 'AI Reviews';
      } else {
        const chapter = TIME_TESTED_CHAPTERS?.find(c => c.id === chapterId);
        titleEl.textContent = chapter ? chapter.title : 'Time-Tested Tradition';
      }
    }
    
    // Hide chapter navigation for TTT (or could add prev/next chapter)
    this.hideChapterNav(container);
  },

  /**
   * Hide Bible chapter navigation buttons
   */
  hideChapterNav(container) {
    const prevBtn = container.querySelector('#bible-prev-chapter');
    const nextBtn = container.querySelector('#bible-next-chapter');
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
  },

  /**
   * Show Bible chapter navigation buttons
   */
  showChapterNav(container) {
    const prevBtn = container.querySelector('#bible-prev-chapter');
    const nextBtn = container.querySelector('#bible-next-chapter');
    if (prevBtn) prevBtn.style.display = '';
    if (nextBtn) nextBtn.style.display = '';
  },

  /**
   * Build HTML for symbol index (within reader context)
   * Dynamically populated from SYMBOL_DICTIONARY
   */
  buildSymbolIndexHTML() {
    const symbols = Object.entries(SYMBOL_DICTIONARY || {}).sort((a, b) => 
      a[1].name.localeCompare(b[1].name)
    );
    const symbolCount = symbols.length;
    
    return `
      <div class="reader-symbol-index">
        <header class="symbol-index-header">
          <h1>🔑 Biblical Symbol Dictionary</h1>
          <p>Unlocking the Hidden Language of Scripture</p>
        </header>
        
        <section class="symbol-index-intro">
          <p>
            <strong>Scripture declares it teaches through symbols.</strong>
            God says: <em>"I have multiplied visions, and used similitudes"</em> (Hosea 12:10).
            Jesus spoke to the multitudes <strong>only</strong> in parables (Matthew 13:34).
          </p>
          <div class="symbol-intro-links">
            <button class="symbol-intro-link" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols-article',article:'HOW-SCRIPTURE-TEACHES'}})">
              📜 How Scripture Teaches
            </button>
            <button class="symbol-intro-link" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols-article',article:'WHY-PARABLES'}})">
              🧠 Why Parables?
            </button>
            <button class="symbol-intro-link" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols-article',article:'METHODOLOGY'}})">
              🔬 Human Study Guide
            </button>
            <button class="symbol-intro-link" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols-article',article:'AI-METHODOLOGY'}})">
              🤖 AI-Assisted Study
            </button>
          </div>
        </section>
        
        <section class="symbol-index-dictionary">
          <h2>Symbol Dictionary <span class="symbol-count">(${symbolCount} symbols)</span></h2>
          <div class="symbol-index-grid">
            ${symbols.map(([key, symbol]) => `
              <button class="symbol-index-item" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols',symbol:'${key}'}})">
                <div class="symbol-index-name">${symbol.name}</div>
                <div class="symbol-index-meaning">${symbol.is2 || symbol.is}</div>
              </button>
            `).join('')}
          </div>
        </section>
      </div>
    `;
  },

  /**
   * Build HTML for symbol content (displayed in Bible text area)
   */
  buildSymbolContentHTML(symbol, symbolKey) {
    const prevNext = this.getSymbolPrevNext(symbolKey);
    
    return `
      <div class="reader-symbol-content-inline">
        <nav class="reader-symbol-nav">
          ${prevNext.prev ? `<button class="symbol-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols',symbol:'${prevNext.prev}'}})">◀ ${prevNext.prevName}</button>` : '<span></span>'}
          ${prevNext.next ? `<button class="symbol-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols',symbol:'${prevNext.next}'}})>${prevNext.nextName} ▶</button>` : '<span></span>'}
        </nav>
        
        <header class="symbol-header">
          <h1>📖 ${symbol.name}</h1>
          <div class="symbol-words">
            <strong>Words:</strong> ${symbol.words.join(', ')}
          </div>
          ${symbol.strongs ? `
          <div class="symbol-strongs-list">
            <strong>Strong's:</strong> 
            ${symbol.strongs.map(s => `<button class="symbol-strongs-btn" onclick="showStrongsPanel('${s}', '', '', event)">${s}</button>`).join(' ')}
          </div>
          ` : ''}
        </header>
        
        <section class="symbol-meanings">
          <div class="meaning-block meaning-is">
            <div class="meaning-label">IS (What it represents):</div>
            <div class="meaning-value">${symbol.is}${symbol.is2 ? ' / ' + symbol.is2 : ''}</div>
          </div>
          
          ${symbol.does ? `
          <div class="meaning-block meaning-does">
            <div class="meaning-label">DOES (What it does):</div>
            <div class="meaning-value">${symbol.does}${symbol.does2 ? ' / ' + symbol.does2 : ''}</div>
          </div>
          ` : ''}
          
          <div class="meaning-block meaning-sentence">
            <div class="meaning-label">Full Meaning:</div>
            <p class="meaning-paragraph">${symbol.sentence}</p>
          </div>
          
          ${symbol.opposite ? `
          <div class="meaning-block meaning-opposite">
            <div class="meaning-label">Opposite:</div>
            <div class="meaning-value">${symbol.opposite}</div>
          </div>
          ` : ''}
        </section>
        
              </div>
    `;
  },

  /**
   * Build HTML for Time Tested index
   */
  buildTimeTestedIndexHTML() {
    const chapters = typeof TIME_TESTED_CHAPTERS !== 'undefined' ? TIME_TESTED_CHAPTERS : [];
    const mainChapters = chapters.filter(ch => ch.folder === 'chapters');
    const extraChapters = chapters.filter(ch => ch.folder === 'extra');
    
    return `
      <div class="reader-ttt-index">
        <header class="ttt-index-header">
          <div class="ttt-hero">
            <img src="/assets/img/TimeTestedBookFront.jpg" alt="Time-Tested Tradition Book Cover" class="ttt-hero-cover">
            <a class="ttt-hero-download" href="/media/time-tested-tradition.pdf" download onclick="trackBookDownload()">
              <span class="icon">📥</span>
              <span>Download PDF</span>
            </a>
          </div>

          <div class="ttt-reviews-compact">
            <div class="ttt-reviews-icons">
              <img class="ttt-review-icon" src="/assets/img/reviews/openai.png" alt="GPT-5.2" title="GPT-5.2">
              <img class="ttt-review-icon" src="/assets/img/reviews/xai.svg" alt="Grok" title="Grok">
              <img class="ttt-review-icon" src="/assets/img/reviews/anthropic.svg" alt="Claude" title="Claude">
            </div>
            <p class="ttt-reviews-summary">"Provocative and rigorous" · "Rigorous but dense" · "Ambitious biblical calendar revisionism demanding critical engagement"</p>
            <a class="ttt-reviews-link" href="#" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'__reviews__'}}); return false;">
              Read full AI reviews →
            </a>
          </div>
        </header>
        
        <div class="ttt-index-list">
          ${mainChapters.map(ch => `
            <button class="ttt-index-item" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'${ch.id}'}})">
              <div class="ttt-index-item-header">
                <span class="ttt-chapter-title">${ch.title}</span>
              </div>
              ${ch.summary ? `<div class="ttt-chapter-summary">${ch.summary}</div>` : ''}
            </button>
          `).join('')}
        </div>
        
        ${extraChapters.length > 0 ? `
          <h2 class="ttt-index-section-header">Extra Chapters</h2>
          <div class="ttt-index-list">
            ${extraChapters.map(ch => `
              <button class="ttt-index-item" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'${ch.id}'}})">
                <div class="ttt-index-item-header">
                  <span class="ttt-chapter-title">${ch.title}</span>
                </div>
                ${ch.summary ? `<div class="ttt-chapter-summary">${ch.summary}</div>` : ''}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Get prev/next chapter for navigation
   */
  getChapterPrevNext(currentId) {
    const chapters = typeof TIME_TESTED_CHAPTERS !== 'undefined' ? TIME_TESTED_CHAPTERS : [];
    const idx = chapters.findIndex(c => c.id === currentId);
    return {
      prev: idx > 0 ? chapters[idx - 1] : null,
      next: idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null
    };
  },

  /**
   * Load Time Tested chapter content
   * @param {string} chapterId - Chapter ID to load
   * @param {Element} container - Container to render into
   * @param {string} section - Optional section anchor to scroll to (e.g., "years-of-high-priests")
   */
  async loadTimeTestedChapter(chapterId, container, section) {
    try {
      // Check if this is an extra chapter (stored in /extra/ folder)
      const chapter = TIME_TESTED_CHAPTERS?.find(c => c.id === chapterId);
      const folder = chapter?.folder || 'chapters';
      const response = await fetch(`/${folder}/${chapterId}.md`);
      if (!response.ok) throw new Error('Chapter not found');
      const markdown = await response.text();
      
      // Use the full renderMarkdown function for better formatting
      const html = this.renderMarkdown(markdown);
      
      // Get chapter title and prev/next navigation
      const chapterTitle = chapter ? chapter.title : 'Chapter';
      const nav = this.getChapterPrevNext(chapterId);
      
      container.innerHTML = `
        <div class="ttt-chapter-content">
          <h2 class="ttt-chapter-heading">${chapterTitle}</h2>
          
          <article class="ttt-chapter-body">
            ${html}
          </article>
          
          <nav class="ttt-chapter-nav ttt-chapter-nav-bottom">
            ${nav.prev ? `<button class="ttt-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'${nav.prev.id}'}})">◀ ${nav.prev.title}</button>` : '<span></span>'}
            ${nav.next ? `<button class="ttt-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'${nav.next.id}'}})">${nav.next.title} ▶</button>` : '<span></span>'}
          </nav>
        </div>
      `;
      
      if (this._chapterCache) this._chapterCache.set(chapterId, container.innerHTML);
      
      // Make scripture references clickable (links to Bible reader)
      this.linkifyScriptureRefs(container);
      
      // Make symbol references interactive (links + tooltips)
      this.linkifySymbolRefs(container);
      
      // Scroll to section if specified
      if (section) {
        setTimeout(() => {
          this.scrollToSection(section, container);
        }, 100);
      }
      // Scroll to verse citation when opening from Bible book icon (e.g. #ref-genesis-10-8)
      setTimeout(() => this.scrollToVerseAnchor(container), 150);
      
    } catch (e) {
      container.innerHTML = `<div class="reader-error">Error loading chapter: ${e.message}</div>`;
    }
  },

  /**
   * Load the AI Reviews page (not a chapter; content from /extra/AI_REVIEWS_PAGE.md)
   */
  async loadTimeTestedReviewsPage(container) {
    try {
      const response = await fetch('/extra/AI_REVIEWS_PAGE.md');
      if (!response.ok) throw new Error('Reviews page not found');
      const markdown = await response.text();
      const html = this.renderMarkdown(markdown);
      const chapters = typeof TIME_TESTED_CHAPTERS !== 'undefined' ? TIME_TESTED_CHAPTERS : [];
      const lastChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;
      container.innerHTML = `
        <div class="ttt-chapter-content">
          <h2 class="ttt-chapter-heading">What Reviewers Say</h2>
          <article class="ttt-chapter-body">
            ${html}
          </article>
          <nav class="ttt-chapter-nav ttt-chapter-nav-bottom">
            ${lastChapter ? `<button class="ttt-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested',chapterId:'${lastChapter.id}'}})">◀ ${lastChapter.title}</button>` : '<span></span>'}
            <button class="ttt-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'timetested'}})">📚 Index</button>
          </nav>
        </div>
      `;
      this.linkifyScriptureRefs(container);
      this.linkifySymbolRefs(container);
    } catch (e) {
      container.innerHTML = `<div class="reader-error">Error loading reviews: ${e.message}</div>`;
    }
  },
  
  /**
   * Scroll to a section by ID within a container
   * Handles both exact ID match and heading text match
   * @param {string} sectionId - Section ID or heading slug
   * @param {Element} container - Container to search within
   */
  scrollToSection(sectionId, container) {
    // First try exact ID match
    let el = container.querySelector(`#${sectionId}`);
    
    // If not found, try to find a heading that matches the slug
    if (!el) {
      // Convert slug to regex pattern (e.g., "years-of-high-priests" -> /years\s+of\s+high\s+priests/i)
      const pattern = sectionId.replace(/-/g, '\\s+');
      const regex = new RegExp(pattern, 'i');
      
      // Search all headings
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      for (const heading of headings) {
        const text = heading.textContent.trim();
        // Also create a slug from the heading text
        const headingSlug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (headingSlug === sectionId || regex.test(text)) {
          el = heading;
          break;
        }
      }
    }
    
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Highlight briefly
      el.style.backgroundColor = 'rgba(212, 160, 23, 0.3)';
      setTimeout(() => {
        el.style.backgroundColor = '';
      }, 2000);
    }
  },

  /**
   * Scroll to verse citation anchor (e.g. #ref-genesis-1-14) when opening chapter from Bible book icon
   * @param {Element} container - Container to search within (e.g. #bible-explorer-text)
   */
  scrollToVerseAnchor(container) {
    const hash = window.location.hash;
    if (!hash || !container) return;
    const id = hash.slice(1);
    if (!id.startsWith('ref-')) return;
    const el = container.querySelector(`#${CSS.escape(id)}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },

  /**
   * Render Symbol word study (standalone - legacy)
   */
  renderSymbol(state, derived, container, symbolKey) {
    if (!symbolKey) {
      // Show symbol index
      this.renderSymbolIndex(container);
      return;
    }
    
    const symbol = SYMBOL_DICTIONARY?.[symbolKey];
    if (!symbol) {
      container.innerHTML = `<div class="reader-error">Symbol "${symbolKey}" not found</div>`;
      return;
    }
    
    // Strong's panel only opens when user clicks a Strong's button
    
    container.innerHTML = this.buildSymbolHTML(symbol, symbolKey);
    
    // Add click handlers for scripture links
    this.attachSymbolEventHandlers(container);
  },

  /**
   * Build HTML for a symbol word study
   */
  buildSymbolHTML(symbol, symbolKey) {
    const prevNext = this.getSymbolPrevNext(symbolKey);
    
    return `
      <div class="reader-symbol-view">
        <nav class="reader-symbol-nav">
          ${prevNext.prev ? `<button class="symbol-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols',symbol:'${prevNext.prev}'}})">◀ ${prevNext.prevName}</button>` : '<span class="symbol-nav-spacer"></span>'}
          <span class="symbol-nav-title">${symbol.name}</span>
          ${prevNext.next ? `<button class="symbol-nav-btn" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols',symbol:'${prevNext.next}'}})">▶ ${prevNext.nextName}</button>` : '<span class="symbol-nav-spacer"></span>'}
        </nav>
        
        <article class="reader-symbol-content">
          <header class="symbol-header">
            <h1>📖 ${symbol.name}</h1>
            <div class="symbol-words">
              <strong>Words:</strong> ${symbol.words.join(', ')}
            </div>
            ${symbol.strongs ? `
            <div class="symbol-strongs-list">
              <strong>Strong's:</strong> 
              ${symbol.strongs.map(s => `<button class="symbol-strongs-btn" onclick="showStrongsPanel('${s}', '', '', event)">${s}</button>`).join(' ')}
            </div>
            ` : ''}
          </header>
          
          <section class="symbol-meanings">
            <div class="meaning-block meaning-is">
              <div class="meaning-label">IS (What it represents):</div>
              <div class="meaning-value">${symbol.is}${symbol.is2 ? ' / ' + symbol.is2 : ''}</div>
            </div>
            
            ${symbol.does ? `
            <div class="meaning-block meaning-does">
              <div class="meaning-label">DOES (What it does):</div>
              <div class="meaning-value">${symbol.does}${symbol.does2 ? ' / ' + symbol.does2 : ''}</div>
            </div>
            ` : ''}
            
            <div class="meaning-block meaning-sentence">
              <div class="meaning-label">Full Meaning:</div>
              <p class="meaning-paragraph">${symbol.sentence}</p>
            </div>
            
            ${symbol.opposite ? `
            <div class="meaning-block meaning-opposite">
              <div class="meaning-label">Opposite:</div>
              <div class="meaning-value">${symbol.opposite}</div>
            </div>
            ` : ''}
          </section>
          
          ${symbol.link ? `
          <section class="symbol-full-study">
            <a href="${symbol.link}" class="full-study-link" target="_blank">
              📚 View Full Word Study (Markdown)
            </a>
          </section>
          ` : ''}
        </article>
      </div>
    `;
  },

  /**
   * Get previous and next symbols for navigation
   */
  getSymbolPrevNext(currentKey) {
    const keys = Object.keys(SYMBOL_DICTIONARY || {});
    const currentIndex = keys.indexOf(currentKey);
    
    return {
      prev: currentIndex > 0 ? keys[currentIndex - 1] : null,
      prevName: currentIndex > 0 ? SYMBOL_DICTIONARY[keys[currentIndex - 1]]?.name : null,
      next: currentIndex < keys.length - 1 ? keys[currentIndex + 1] : null,
      nextName: currentIndex < keys.length - 1 ? SYMBOL_DICTIONARY[keys[currentIndex + 1]]?.name : null
    };
  },

  /**
   * Render symbol index (list of all symbols)
   */
  renderSymbolIndex(container) {
    const symbols = Object.entries(SYMBOL_DICTIONARY || {});
    
    container.innerHTML = `
      <div class="reader-symbol-index">
        <header class="symbol-index-header">
          <h1>📖 Biblical Symbols</h1>
          <p>Understanding the symbolic language of Scripture</p>
        </header>
        
        <div class="symbol-index-grid">
          ${symbols.map(([key, symbol]) => `
            <button class="symbol-index-item" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'symbols',symbol:'${key}'}})">
              <div class="symbol-index-name">${symbol.name}</div>
              <div class="symbol-index-meaning">${symbol.is2 || symbol.is}</div>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Attach event handlers for symbol content (scripture links, etc.)
   */
  attachSymbolEventHandlers(container) {
    // Future: make scripture references clickable
  },

  /**
   * Render Time Tested book chapter - delegates to BookView
   */
  renderTimeTested(state, derived, container, chapterId) {
    // Create a modified state with the expected params for BookView
    const bookState = {
      ...state,
      content: {
        ...state.content,
        params: {
          ...state.content.params,
          chapterId: chapterId
        }
      }
    };
    
    if (typeof BookView !== 'undefined') {
      BookView.render(bookState, derived, container);
    } else {
      container.innerHTML = '<div class="reader-error">Book reader not available</div>';
    }
  }
};

// Register with ContentManager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof ContentManager !== 'undefined') {
    ContentManager.registerView('reader', ReaderView);
  }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReaderView;
}
