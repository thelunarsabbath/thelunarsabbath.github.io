/**
 * BookView - Display book chapters
 * 
 * Fetches static HTML from Jekyll-generated pages
 * and extracts the article content for SPA display.
 */

const BookView = {
  // Cache for loaded chapter content
  cache: new Map(),
  
  /**
   * Render the book view
   */
  async render(state, derived, container) {
    const { chapterId } = state.content.params;
    
    if (!chapterId) {
      // Show chapter list
      this.renderChapterList(container);
      return;
    }
    
    // Show loading state
    container.innerHTML = `
      <div class="book-view loading">
        <div class="loading-spinner"></div>
        <p>Loading chapter...</p>
      </div>
    `;
    
    try {
      // Fetch chapter content
      const html = await this.loadChapter(chapterId);
      this.renderChapter(container, chapterId, html);
    } catch (error) {
      container.innerHTML = `
        <div class="book-view error">
          <h2>Error Loading Chapter</h2>
          <p>${error.message}</p>
          <button onclick="AppStore.dispatch({type:'SET_VIEW',view:'book'})">
            Back to Book
          </button>
        </div>
      `;
    }
  },
  
  /**
   * Load chapter content from static HTML
   */
  async loadChapter(chapterId) {
    // Check cache first
    if (this.cache.has(chapterId)) {
      return this.cache.get(chapterId);
    }
    
    // Fetch from Jekyll-generated HTML
    const url = `/chapters/${chapterId}/`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Chapter not found: ${chapterId}`);
    }
    
    const fullHtml = await response.text();
    
    // Extract just the article content
    const parser = new DOMParser();
    const doc = parser.parseFromString(fullHtml, 'text/html');
    const article = doc.querySelector('article');
    
    if (!article) {
      throw new Error('Could not extract article content');
    }
    
    const html = article.innerHTML;
    
    // Cache for future use
    this.cache.set(chapterId, html);
    
    return html;
  },
  
  /**
   * Render chapter content
   */
  renderChapter(container, chapterId, html) {
    // Get chapter info
    const chapters = this.getChapterList();
    const currentIndex = chapters.findIndex(c => c.id === chapterId);
    const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
    const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;
    
    container.innerHTML = `
      <div class="book-view">
        <!-- Navigation -->
        <nav class="chapter-nav top">
          ${prevChapter ? `
            <button class="nav-prev" onclick="AppStore.dispatch({type:'SET_VIEW',view:'book',params:{chapterId:'${prevChapter.id}'}})">
              ← ${prevChapter.title}
            </button>
          ` : '<span></span>'}
          
          <button class="nav-toc" onclick="AppStore.dispatch({type:'SET_VIEW',view:'book'})">
            Table of Contents
          </button>
          
          ${nextChapter ? `
            <button class="nav-next" onclick="AppStore.dispatch({type:'SET_VIEW',view:'book',params:{chapterId:'${nextChapter.id}'}})">
              ${nextChapter.title} →
            </button>
          ` : '<span></span>'}
        </nav>
        
        <!-- Chapter Content -->
        <article class="chapter-content">
          ${html}
        </article>
        
        <!-- Bottom Navigation -->
        <nav class="chapter-nav bottom">
          ${prevChapter ? `
            <button class="nav-prev" onclick="AppStore.dispatch({type:'SET_VIEW',view:'book',params:{chapterId:'${prevChapter.id}'}})">
              ← Previous Chapter
            </button>
          ` : '<span></span>'}
          
          <button class="nav-toc" onclick="AppStore.dispatch({type:'SET_VIEW',view:'book'})">
            Table of Contents
          </button>
          
          ${nextChapter ? `
            <button class="nav-next" onclick="AppStore.dispatch({type:'SET_VIEW',view:'book',params:{chapterId:'${nextChapter.id}'}})">
              Next Chapter →
            </button>
          ` : '<span></span>'}
        </nav>
      </div>
    `;
    
    // Bind scripture links for SPA navigation
    this.bindScriptureLinks(container);
  },
  
  /**
   * Render chapter list (table of contents)
   */
  renderChapterList(container) {
    const chapters = this.getChapterList();
    
    container.innerHTML = `
      <div class="book-view toc">
        <header class="book-header">
          <h1>Lunar Sabbath</h1>
          <p class="book-subtitle">A Time-Tested Tradition</p>
        </header>
        
        <div class="chapter-list">
          ${chapters.map(ch => `
            <button class="chapter-item" 
                    onclick="AppStore.dispatch({type:'SET_VIEW',view:'book',params:{chapterId:'${ch.id}'}})">
              <span class="chapter-number">${ch.number}</span>
              <span class="chapter-title">${ch.title}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  },
  
  /**
   * Get list of chapters
   * TODO: Load from chapters.json
   */
  getChapterList() {
    return [
      { id: '01_Introduction', title: 'Introduction', number: 1 },
      { id: '02_Inherited_Lies', title: 'Inherited Lies', number: 2 },
      { id: '03_Principles_of_Evaluation', title: 'Principles of Evaluation', number: 3 },
      { id: '04_Alleged_Authority_of_Sanhedrin', title: 'Alleged Authority of Sanhedrin', number: 4 },
      { id: '05_Where_Does_the_Day_Start', title: 'Where Does the Day Start?', number: 5 },
      { id: '06_When_Does_the_Day_Start', title: 'When Does the Day Start?', number: 6 },
      { id: '07_When_Does_the_Month_Start', title: 'When Does the Month Start?', number: 7 },
      { id: '08_When_does_the_Year_Start', title: 'When Does the Year Start?', number: 8 },
      { id: '09_How_to_Observe_the_Signs', title: 'How to Observe the Signs', number: 9 },
      { id: '10_When_is_the_Sabbath', title: 'When is the Sabbath?', number: 10 },
      { id: '11_The_Day_of_Saturn', title: 'The Day of Saturn', number: 11 },
      { id: '12_32_AD_Resurrection', title: '32 AD Resurrection', number: 12 },
      { id: '13_Herod_the_Great', title: 'Herod the Great', number: 13 },
      { id: '14_Passion_Week_-_3_Days_&_3_Nights', title: 'Passion Week - 3 Days & 3 Nights', number: 14 },
      { id: '15_Solar_Only_Calendars', title: 'Solar Only Calendars', number: 15 },
      { id: '16_The_Path_to_Salvation', title: 'The Path to Salvation', number: 16 },
      { id: '17_Commands_to_Follow', title: 'Commands to Follow', number: 17 },
      { id: '18_Appointed_Times', title: 'Appointed Times', number: 18 },
      { id: '19_Miscellaneous_Commands', title: 'Miscellaneous Commands', number: 19 }
    ];
  },
  
  /**
   * Bind scripture links for SPA navigation
   */
  bindScriptureLinks(container) {
    container.querySelectorAll('.scripture-link, a[href^="/bible/"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Parse bible URL
        const url = new URL(link.href, window.location.origin);
        const parts = url.pathname.split('/').filter(Boolean);
        
        if (parts[0] === 'bible') {
          AppStore.dispatch({
            type: 'SET_VIEW',
            view: 'bible',
            params: {
              translation: parts[1] || 'kjv',
              book: decodeURIComponent(parts[2] || 'Genesis'),
              chapter: parseInt(parts[3]) || 1,
              verse: url.searchParams.get('verse') ? parseInt(url.searchParams.get('verse')) : null
            }
          });
        }
      });
    });
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookView;
}
