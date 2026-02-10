// Cross-References Module
// Loads and provides lookup for Bible cross-references from OpenBible.info

// Cross-reference data storage
let crossRefData = null;
let crossRefLoading = false;
let crossRefLoadPromise = null;

// Book name abbreviation mappings (from cross_references.txt format to standard)
const CROSS_REF_BOOK_MAP = {
  'Gen': 'Genesis',
  'Exod': 'Exodus',
  'Lev': 'Leviticus',
  'Num': 'Numbers',
  'Deut': 'Deuteronomy',
  'Josh': 'Joshua',
  'Judg': 'Judges',
  'Ruth': 'Ruth',
  '1Sam': '1 Samuel',
  '2Sam': '2 Samuel',
  '1Kgs': '1 Kings',
  '2Kgs': '2 Kings',
  '1Chr': '1 Chronicles',
  '2Chr': '2 Chronicles',
  'Ezra': 'Ezra',
  'Neh': 'Nehemiah',
  'Esth': 'Esther',
  'Job': 'Job',
  'Ps': 'Psalms',
  'Prov': 'Proverbs',
  'Eccl': 'Ecclesiastes',
  'Song': 'Song of Solomon',
  'Isa': 'Isaiah',
  'Jer': 'Jeremiah',
  'Lam': 'Lamentations',
  'Ezek': 'Ezekiel',
  'Dan': 'Daniel',
  'Hos': 'Hosea',
  'Joel': 'Joel',
  'Amos': 'Amos',
  'Obad': 'Obadiah',
  'Jonah': 'Jonah',
  'Mic': 'Micah',
  'Nah': 'Nahum',
  'Hab': 'Habakkuk',
  'Zeph': 'Zephaniah',
  'Hag': 'Haggai',
  'Zech': 'Zechariah',
  'Mal': 'Malachi',
  'Matt': 'Matthew',
  'Mark': 'Mark',
  'Luke': 'Luke',
  'John': 'John',
  'Acts': 'Acts',
  'Rom': 'Romans',
  '1Cor': '1 Corinthians',
  '2Cor': '2 Corinthians',
  'Gal': 'Galatians',
  'Eph': 'Ephesians',
  'Phil': 'Philippians',
  'Col': 'Colossians',
  '1Thess': '1 Thessalonians',
  '2Thess': '2 Thessalonians',
  '1Tim': '1 Timothy',
  '2Tim': '2 Timothy',
  'Titus': 'Titus',
  'Phlm': 'Philemon',
  'Heb': 'Hebrews',
  'Jas': 'James',
  '1Pet': '1 Peter',
  '2Pet': '2 Peter',
  '1John': '1 John',
  '2John': '2 John',
  '3John': '3 John',
  'Jude': 'Jude',
  'Rev': 'Revelation'
};

// Reverse map: Standard name to abbreviation
const STANDARD_TO_ABBREV = {};
for (const [abbrev, standard] of Object.entries(CROSS_REF_BOOK_MAP)) {
  STANDARD_TO_ABBREV[standard] = abbrev;
  STANDARD_TO_ABBREV[standard.toLowerCase()] = abbrev;
}

// Parse a verse reference like "Gen.1.1" or "Prov.8.22-Prov.8.30"
function parseVerseRef(ref) {
  // Handle range format: Book.Ch.V-Book.Ch.V
  if (ref.includes('-')) {
    const parts = ref.split('-');
    const start = parseSimpleRef(parts[0]);
    const end = parseSimpleRef(parts[1]);
    if (start && end) {
      return {
        book: start.book,
        chapter: start.chapter,
        verseStart: start.verse,
        verseEnd: end.verse,
        isRange: true
      };
    }
  }
  
  const simple = parseSimpleRef(ref);
  if (simple) {
    return { 
      book: simple.book, 
      chapter: simple.chapter, 
      verseStart: simple.verse, 
      verseEnd: simple.verse, 
      isRange: false 
    };
  }
  return null;
}

// Parse a simple reference like "Gen.1.1"
function parseSimpleRef(ref) {
  const match = ref.match(/^(\d?[A-Za-z]+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  
  const abbrev = match[1];
  const chapter = parseInt(match[2]);
  const verse = parseInt(match[3]);
  const book = CROSS_REF_BOOK_MAP[abbrev] || abbrev;
  
  return { book, chapter, verse, abbrev };
}

// Format a parsed reference for display
function formatRef(parsed) {
  if (parsed.isRange && parsed.verseStart !== parsed.verseEnd) {
    return `${parsed.book} ${parsed.chapter}:${parsed.verseStart}-${parsed.verseEnd}`;
  }
  return `${parsed.book} ${parsed.chapter}:${parsed.verseStart}`;
}

// Create a lookup key from book, chapter, verse
function makeLookupKey(book, chapter, verse) {
  // Normalize book name to abbreviation
  const abbrev = STANDARD_TO_ABBREV[book] || STANDARD_TO_ABBREV[book.toLowerCase()] || book;
  return `${abbrev}.${chapter}.${verse}`;
}

// Load and parse cross-references
async function loadCrossReferences() {
  if (crossRefData) return crossRefData;
  if (crossRefLoading) return crossRefLoadPromise;
  
  crossRefLoading = true;
  crossRefLoadPromise = (async () => {
    try {
      console.log('[CrossRef] Loading cross-references...');
      const response = await fetch('/cross_references.txt');
      if (!response.ok) throw new Error('Failed to load cross-references');
      
      const text = await response.text();
      const lines = text.split('\n');
      
      // Parse into a map: fromVerse -> [{toRef, votes, parsed}]
      const data = new Map();
      
      for (let i = 1; i < lines.length; i++) { // Skip header
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split('\t');
        if (parts.length < 3) continue;
        
        const fromRef = parts[0];
        const toRef = parts[1];
        const votes = parseInt(parts[2]) || 0;
        
        // Only include positive-voted references
        if (votes < 1) continue;
        
        // Parse the destination reference
        const parsed = parseVerseRef(toRef);
        if (!parsed) continue;
        
        // Add to map
        if (!data.has(fromRef)) {
          data.set(fromRef, []);
        }
        data.get(fromRef).push({
          ref: toRef,
          votes,
          parsed,
          display: formatRef(parsed)
        });
      }
      
      // Sort each entry by votes (descending)
      for (const [key, refs] of data) {
        refs.sort((a, b) => b.votes - a.votes);
      }
      
      crossRefData = data;
      console.log(`[CrossRef] Loaded ${data.size} verses with cross-references`);
      return data;
    } catch (error) {
      console.error('[CrossRef] Error loading cross-references:', error);
      crossRefData = new Map();
      return crossRefData;
    } finally {
      crossRefLoading = false;
    }
  })();
  
  return crossRefLoadPromise;
}

// Get cross-references for a verse
async function getCrossReferences(book, chapter, verse) {
  const data = await loadCrossReferences();
  const key = makeLookupKey(book, chapter, verse);
  return data.get(key) || [];
}

// Synchronous version (returns empty if not loaded yet)
function getCrossReferencesSync(book, chapter, verse) {
  if (!crossRefData) return [];
  const key = makeLookupKey(book, chapter, verse);
  return crossRefData.get(key) || [];
}

// Check if cross-references exist for a verse (sync, for icon display)
function hasCrossReferences(book, chapter, verse) {
  if (!crossRefData) return false;
  const key = makeLookupKey(book, chapter, verse);
  return crossRefData.has(key);
}

// Show cross-references in the Strong's panel
async function showCrossRefPanel(book, chapter, verse, event) {
  if (event) event.stopPropagation();
  
  // Use the same sidebar as Strong's panel
  const sidebar = document.getElementById('strongs-sidebar');
  if (!sidebar) {
    console.error('[CrossRef] Sidebar element not found!');
    return;
  }
  
  console.log('[CrossRef] Opening panel for', book, chapter, verse);
  
  // Build sidebar content with loading state
  sidebar.innerHTML = `
    <div class="strongs-sidebar-resize" onmousedown="startStrongsResize(event)"></div>
    <div class="strongs-sidebar-header">
      <div class="strongs-sidebar-title">🔗 Cross References</div>
      <button class="strongs-sidebar-close" onclick="closeStrongsPanel()">✕</button>
    </div>
    <div class="strongs-sidebar-content">
      <div class="cross-ref-panel">
        <div class="cross-ref-source">
          <span class="cross-ref-verse">${book} ${chapter}:${verse}</span>
        </div>
        <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
          Loading cross-references...
        </div>
      </div>
    </div>
  `;
  
  try {
    const saved = localStorage.getItem('strongs-sidebar-width');
    if (saved) sidebar.style.width = saved;
  } catch (e) {}
  
  // Animate open
  requestAnimationFrame(() => {
    sidebar.classList.add('open');
  });
  
  // Ensure data is loaded
  await loadCrossReferences();
  
  const refs = getCrossReferencesSync(book, chapter, verse);
  const contentEl = sidebar.querySelector('.strongs-sidebar-content');
  
  if (refs.length === 0) {
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="cross-ref-panel">
          <div class="cross-ref-source">
            <span class="cross-ref-verse">${book} ${chapter}:${verse}</span>
          </div>
          <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
            No cross-references found
          </div>
        </div>
      `;
    }
    return;
  }
  
  // Build HTML for the panel
  const verseRef = `${book} ${chapter}:${verse}`;
  let html = `
    <div class="cross-ref-panel">
      <div class="cross-ref-source">
        <span class="cross-ref-verse">${verseRef}</span>
        <span class="cross-ref-count">${refs.length} reference${refs.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="cross-ref-list">
  `;
  
  // Show top references (limit to avoid overwhelming)
  const maxRefs = 25;
  const displayRefs = refs.slice(0, maxRefs);
  
  for (const ref of displayRefs) {
    const p = ref.parsed;
    // Get verse text preview using the global getVerseText function
    let verseText = '';
    if (typeof getVerseText === 'function') {
      const verseKey = `${p.book} ${p.chapter}:${p.verseStart}`;
      verseText = getVerseText(verseKey) || '';
      // Truncate long verses
      if (verseText.length > 150) {
        verseText = verseText.substring(0, 147) + '...';
      }
    }
    
    html += `
      <div class="cross-ref-item" data-book="${p.book}" data-chapter="${p.chapter}" data-verse="${p.verseStart}">
        <div class="cross-ref-ref">${ref.display}</div>
        ${verseText ? `<div class="cross-ref-text">${verseText}</div>` : ''}
      </div>
    `;
  }
  
  if (refs.length > maxRefs) {
    html += `<div class="cross-ref-more">...and ${refs.length - maxRefs} more</div>`;
  }
  
  html += `
      </div>
      <div class="cross-ref-attribution">
        Data from <a href="https://www.openbible.info/labs/cross-references/" target="_blank">OpenBible.info</a>
      </div>
    </div>
  `;
  
  // Update the panel content
  if (contentEl) {
    contentEl.innerHTML = html;
    console.log('[CrossRef] Panel rendered with', displayRefs.length, 'items');
  }
}

// Navigate to a cross-referenced verse
function navigateToCrossRef(book, chapter, verse) {
  console.log('[CrossRef] Navigating to:', book, chapter, verse);
  
  // Close the sidebar first
  const sidebar = document.getElementById('strongs-sidebar');
  if (sidebar) sidebar.classList.remove('open');
  
  // Get current translation
  const state = typeof AppStore !== 'undefined' ? AppStore.getState() : null;
  const translation = state?.content?.params?.translation || 'kjv';
  
  console.log('[CrossRef] Using translation:', translation);
  
  // Navigate using AppStore
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({
      type: 'SET_VIEW',
      view: 'reader',
      params: {
        contentType: 'bible',
        translation,
        book,
        chapter,
        verse
      }
    });
  } else {
    console.error('[CrossRef] AppStore not found!');
  }
}

// Expose functions globally for onclick handlers
if (typeof window !== 'undefined') {
  window.hasCrossReferences = hasCrossReferences;
  window.showCrossRefPanel = showCrossRefPanel;
  window.navigateToCrossRef = navigateToCrossRef;
  window.getCrossReferencesSync = getCrossReferencesSync;
  window.loadCrossReferences = loadCrossReferences;
  
  // Global click handler for cross-reference items (most reliable method)
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.cross-ref-item');
    if (item) {
      e.preventDefault();
      e.stopPropagation();
      const book = item.dataset.book;
      const chapter = parseInt(item.dataset.chapter);
      const verse = parseInt(item.dataset.verse);
      console.log('[CrossRef] Global handler - clicked:', book, chapter, verse);
      if (book && !isNaN(chapter) && !isNaN(verse)) {
        navigateToCrossRef(book, chapter, verse);
      }
    }
  }, true); // Use capture phase
  
  // Preload cross-references immediately so icons show correctly
  loadCrossReferences();
}
