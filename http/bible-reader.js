// Bible Reader Module
// Parses KJV text and provides verse lookup functionality

// Cache version - increment this when kjv.txt format changes or is updated
const BIBLE_CACHE_VERSION = 1;
const BIBLE_CACHE_KEY = 'kjv_bible_cache';

let bibleData = null;
let bibleIndex = {}; // Index by "Book Chapter:Verse" for fast lookup

// Hebrew word annotations - words that have translation ambiguity
// These add emoji markers that show tooltips explaining the Hebrew
const HEBREW_ANNOTATIONS = {
  // Woman/Fire ambiguity: אִשָּׁה (ishah/woman) vs אִשֶּׁה (isheh/fire offering)
  'woman_fire': {
    emoji: '🔥',
    tooltip: "Hebrew Word Ambiguity: Woman or Fire? (See Zechariah 5:5-11)\n\nIn Hebrew, 'woman' (אִשָּׁה, ishah) and 'fire offering' (אִשֶּׁה, isheh) are spelled identically without vowel points—vowels were added later by tradition. The consonantal text allows for an alternate reading."
  },
  'lead_payload': {
    emoji: '☢️',
    tooltip: "A talent of lead weighs approximately 70 pounds (~32 kg). Combined with the ephah's cylindrical dimensions, this describes a heavy payload in a flying container—remarkably similar to modern missile specifications.\n\nNotably, uranium decays into lead. Lead is often used as shielding for radioactive materials. A 'talent of lead' covering a fire-bringing payload adds another dimension to this prophetic imagery."
  },
  'shinar_babylon': {
    emoji: '🏛️',
    tooltip: "Shinar is the ancient name for Babylon/Mesopotamia (Genesis 10:10, 11:2). The 'fire offering' is being carried to Babylon—connecting to prophecies of Babylon the Great's destruction by fire (Revelation 18)."
  }
};

// Verse-specific word annotations: { "Book Chapter:Verse": [{ word: "...", annotation: "key" }, ...] }
const VERSE_ANNOTATIONS = {
  // Zechariah 5:7 - woman in the ephah
  "Zechariah 5:7": [
    { word: "woman", annotation: "woman_fire" },
    { word: "talent of lead", annotation: "lead_payload" }
  ],
  // Zechariah 5:9 - women with wings
  "Zechariah 5:9": [
    { word: "two women", annotation: "woman_fire" }
  ],
  // Zechariah 5:11 - land of Shinar
  "Zechariah 5:11": [
    { word: "land of Shinar", annotation: "shinar_babylon" },
    { word: "woman", annotation: "woman_fire" }
  ],
  // Jeremiah 50:37 - upon her mighty men / upon her treasures
  "Jeremiah 50:37": [
    { word: "women", annotation: "woman_fire" }
  ],
  // Nahum 3:13 - thy people are women
  "Nahum 3:13": [
    { word: "women", annotation: "woman_fire" }
  ]
};

// Apply annotations to verse text
function applyVerseAnnotations(reference, text) {
  const annotations = VERSE_ANNOTATIONS[reference];
  if (!annotations) return text;
  
  let annotatedText = text;
  for (const ann of annotations) {
    const info = HEBREW_ANNOTATIONS[ann.annotation];
    if (!info) continue;
    
    // Create clickable emoji that shows tooltip
    const replacement = `${ann.word}<span class="hebrew-annotation" data-tooltip="${info.tooltip.replace(/"/g, '&quot;')}" onclick="showHebrewTooltip(event)">${info.emoji}</span>`;
    
    // Replace first occurrence (case-insensitive)
    const regex = new RegExp(`\\b${ann.word}\\b`, 'i');
    annotatedText = annotatedText.replace(regex, replacement);
  }
  
  return annotatedText;
}

// Show tooltip for Hebrew annotation
function showHebrewTooltip(event) {
  event.stopPropagation();
  const el = event.target;
  const tooltip = el.dataset.tooltip;
  
  // Remove any existing tooltip
  const existing = document.querySelector('.hebrew-tooltip');
  if (existing) existing.remove();
  
  // Create tooltip
  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'hebrew-tooltip';
  tooltipEl.innerHTML = tooltip.replace(/\n/g, '<br>');
  document.body.appendChild(tooltipEl);
  
  // Position tooltip above the emoji
  const rect = el.getBoundingClientRect();
  tooltipEl.style.left = Math.max(10, rect.left - 100) + 'px';
  tooltipEl.style.top = (rect.top - tooltipEl.offsetHeight - 10 + window.scrollY) + 'px';
  
  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', function closeTooltip() {
      tooltipEl.remove();
      document.removeEventListener('click', closeTooltip);
    }, { once: true });
  }, 10);
}

// Show/hide Bible loading dialog
function showBibleLoadingDialog() {
  const dialog = document.getElementById('bible-loading-dialog');
  if (dialog) dialog.classList.add('visible');
}

function hideBibleLoadingDialog() {
  const dialog = document.getElementById('bible-loading-dialog');
  if (dialog) dialog.classList.remove('visible');
}

// Load Bible from cache or parse from source
async function loadBible() {
  // Try to load from cache first
  const cached = loadBibleFromCache();
  if (cached) {
    bibleData = cached.data;
    rebuildIndex();
    console.log(`Bible loaded from cache: ${bibleData.length} verses (v${cached.version})`);
    return true;
  }
  
  // Show loading dialog for fresh load
  showBibleLoadingDialog();
  
  // Parse from source file
  try {
    const response = await fetch('/kjv.txt');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    
    bibleData = parseBibleText(text);
    rebuildIndex();
    
    // Cache the parsed data
    saveBibleToCache(bibleData);
    
    // Hide loading dialog
    hideBibleLoadingDialog();
    
    console.log(`Bible parsed and cached: ${bibleData.length} verses (v${BIBLE_CACHE_VERSION})`);
    return true;
  } catch (err) {
    hideBibleLoadingDialog();
    console.warn('Bible not available:', err.message);
    return false;
  }
}

// Parse the KJV text file into structured data
function parseBibleText(text) {
  const data = [];
  const lines = text.split('\n');
  
  for (let i = 2; i < lines.length; i++) { // Skip header lines
    const line = lines[i].trim();
    if (!line) continue;
    
    const tabIndex = line.indexOf('\t');
    if (tabIndex === -1) continue;
    
    const reference = line.substring(0, tabIndex);
    const verseText = line.substring(tabIndex + 1);
    
    // Parse reference: "Book Chapter:Verse"
    const match = reference.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (!match) continue;
    
    const [, book, chapter, verse] = match;
    data.push({
      book: book,
      chapter: parseInt(chapter),
      verse: parseInt(verse),
      text: verseText,
      reference: reference
    });
  }
  
  return data;
}

// Rebuild the index from bibleData
function rebuildIndex() {
  bibleIndex = {};
  if (bibleData) {
    for (const entry of bibleData) {
      bibleIndex[entry.reference] = entry;
    }
  }
}

// Load Bible data from localStorage cache
function loadBibleFromCache() {
  try {
    const cached = localStorage.getItem(BIBLE_CACHE_KEY);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    
    // Check version
    if (parsed.version !== BIBLE_CACHE_VERSION) {
      console.log(`Bible cache version mismatch (cached: ${parsed.version}, current: ${BIBLE_CACHE_VERSION}), reparsing...`);
      localStorage.removeItem(BIBLE_CACHE_KEY);
      return null;
    }
    
    // Validate data
    if (!parsed.data || !Array.isArray(parsed.data) || parsed.data.length === 0) {
      console.log('Bible cache invalid, reparsing...');
      localStorage.removeItem(BIBLE_CACHE_KEY);
      return null;
    }
    
    return parsed;
  } catch (err) {
    console.warn('Failed to load Bible cache:', err.message);
    localStorage.removeItem(BIBLE_CACHE_KEY);
    return null;
  }
}

// Save Bible data to localStorage cache
function saveBibleToCache(data) {
  try {
    const cacheData = {
      version: BIBLE_CACHE_VERSION,
      timestamp: Date.now(),
      data: data
    };
    
    localStorage.setItem(BIBLE_CACHE_KEY, JSON.stringify(cacheData));
    console.log('Bible data cached successfully');
  } catch (err) {
    // localStorage might be full or disabled
    console.warn('Failed to cache Bible data:', err.message);
  }
}

// Clear the Bible cache (useful for forcing a refresh)
function clearBibleCache() {
  localStorage.removeItem(BIBLE_CACHE_KEY);
  console.log('Bible cache cleared');
}

// Parse a citation string into structured format
// Handles formats like:
// - "Genesis 1:1-6:8" (multi-chapter range)
// - "Exodus 30:11–16" (single chapter, en-dash)
// - "Genesis 21:1–34 + Numbers 29:1–6" (multiple citations)
function parseCitation(citationStr) {
  if (!citationStr) return [];
  
  // Split by + or ; for multiple citations
  const parts = citationStr.split(/\s*[+;]\s*/);
  const citations = [];
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    // Extract book and chapter:verses portion
    // Matches: "Book Chapter:VerseSpec" where VerseSpec can be complex
    const mainMatch = trimmed.match(/^(.+?)\s+(\d+):(.+)$/);
    
    if (mainMatch) {
      const [, book, chapter, verseSpec] = mainMatch;
      const chapterNum = parseInt(chapter);
      
      // Parse the verse specification which can be:
      // - Single verse: "14"
      // - Range: "4-5" or "4–5"
      // - Comma-separated: "4,14"
      // - Mixed: "4-5,14" or "4,5-6,14"
      // - Cross-chapter range: "4-27:5" (chapter:verse to chapter:verse)
      
      // First check for cross-chapter range like "1:1-6:8"
      const crossChapterMatch = verseSpec.match(/^(\d+)[–-](\d+):(\d+)$/);
      if (crossChapterMatch) {
        const [, startVerse, endChapter, endVerse] = crossChapterMatch;
        citations.push({
          book: book.trim(),
          startChapter: chapterNum,
          startVerse: parseInt(startVerse),
          endChapter: parseInt(endChapter),
          endVerse: parseInt(endVerse)
        });
        continue;
      }
      
      // Split by comma for multiple verse specs
      const verseSegments = verseSpec.split(/\s*,\s*/);
      
      for (const segment of verseSegments) {
        const segTrimmed = segment.trim();
        if (!segTrimmed) continue;
        
        // Check for range: "4-5" or "4–5"
        const rangeMatch = segTrimmed.match(/^(\d+)[–-](\d+)$/);
        if (rangeMatch) {
          const [, startVerse, endVerse] = rangeMatch;
          citations.push({
            book: book.trim(),
            startChapter: chapterNum,
            startVerse: parseInt(startVerse),
            endChapter: chapterNum,
            endVerse: parseInt(endVerse)
          });
        } else {
          // Single verse
          const verseNum = parseInt(segTrimmed);
          if (!isNaN(verseNum)) {
            citations.push({
              book: book.trim(),
              startChapter: chapterNum,
              startVerse: verseNum,
              endChapter: chapterNum,
              endVerse: verseNum
            });
          }
        }
      }
    } else {
      // Try chapter range format: "Book Chapter-Chapter" (e.g., "Revelation 17-18")
      const chapterRangeMatch = trimmed.match(/^(.+?)\s+(\d+)[–-](\d+)$/);
      if (chapterRangeMatch) {
        const [, book, startChapter, endChapter] = chapterRangeMatch;
        // Return full chapters from start to end
        citations.push({
          book: book.trim(),
          startChapter: parseInt(startChapter),
          startVerse: 1,
          endChapter: parseInt(endChapter),
          endVerse: 200 // Large number to get whole chapter
        });
      } else {
        // Try format without colon - just "Book Chapter" for whole chapter
        const wholeChapterMatch = trimmed.match(/^(.+?)\s+(\d+)$/);
        if (wholeChapterMatch) {
          const [, book, chapter] = wholeChapterMatch;
          // Return whole chapter (verses 1-200 to be safe)
          citations.push({
            book: book.trim(),
            startChapter: parseInt(chapter),
            startVerse: 1,
            endChapter: parseInt(chapter),
            endVerse: 200 // Large number to get whole chapter
          });
        }
      }
    }
  }
  
  return citations;
}

// Get verses for a parsed citation
function getVersesForCitation(citation) {
  if (!bibleData) return [];
  
  const verses = [];
  let inRange = false;
  
  for (const entry of bibleData) {
    if (entry.book !== citation.book) {
      if (inRange) break; // We've passed the range
      continue;
    }
    
    // Check if this verse is within the range
    const isAfterStart = 
      entry.chapter > citation.startChapter ||
      (entry.chapter === citation.startChapter && entry.verse >= citation.startVerse);
    
    const isBeforeEnd =
      entry.chapter < citation.endChapter ||
      (entry.chapter === citation.endChapter && entry.verse <= citation.endVerse);
    
    if (isAfterStart && isBeforeEnd) {
      inRange = true;
      verses.push(entry);
    } else if (inRange) {
      break; // We've passed the end of the range
    }
  }
  
  return verses;
}

// Get all verses for a citation string (handles multiple citations)
function getVersesForCitationString(citationStr) {
  const citations = parseCitation(citationStr);
  const allVerses = [];
  
  for (const citation of citations) {
    const verses = getVersesForCitation(citation);
    if (allVerses.length > 0 && verses.length > 0) {
      // Add a separator between different citation ranges
      allVerses.push({ isSeparator: true, book: verses[0].book });
    }
    allVerses.push(...verses);
  }
  
  return allVerses;
}

// Format verses for display, grouped by chapter
function formatVersesForDisplay(verses, title = '') {
  if (!verses || verses.length === 0) {
    return '<div class="bible-reader-empty">No verses found for this citation.</div>';
  }
  
  let html = '<div class="bible-reader-content">';
  
  if (title) {
    html += `<div class="bible-reader-title">${title}</div>`;
  }
  
  let currentBook = '';
  let currentChapter = -1;
  
  for (const verse of verses) {
    if (verse.isSeparator) {
      // Add visual separator between citation ranges
      html += '<div class="bible-chapter-separator"></div>';
      currentChapter = -1;
      continue;
    }
    
    // New book header
    if (verse.book !== currentBook) {
      if (currentBook !== '') {
        html += '</div>'; // Close previous book
      }
      currentBook = verse.book;
      currentChapter = -1;
      html += `<div class="bible-book-section">`;
      html += `<div class="bible-book-name">${verse.book}</div>`;
    }
    
    // New chapter header - clickable to open in Bible Explorer
    if (verse.chapter !== currentChapter) {
      if (currentChapter !== -1) {
        html += '</div>'; // Close previous chapter
      }
      currentChapter = verse.chapter;
      const bookEncoded = encodeURIComponent(verse.book);
      html += `<div class="bible-chapter-section">`;
      html += `<div class="bible-chapter-header">
        <a href="/bible/${bookEncoded}/${verse.chapter}" 
           onclick="openBibleExplorerFromModal('${verse.book}', ${verse.chapter}); return false;" 
           class="bible-chapter-link" title="Read full chapter in Bible Explorer">
          Chapter ${verse.chapter} →
        </a>
      </div>`;
      html += '<div class="bible-chapter-text">';
    }
    
    // Verse with superscript verse number - clickable to open in Bible Explorer at that verse
    const bookEncoded = encodeURIComponent(verse.book);
    html += `<span class="bible-verse"><sup class="bible-verse-num">
      <a href="/bible/${bookEncoded}/${verse.chapter}?verse=${verse.verse}" 
         onclick="openBibleExplorerFromModal('${verse.book}', ${verse.chapter}, ${verse.verse}); return false;"
         title="Open ${verse.book} ${verse.chapter}:${verse.verse} in Bible Explorer">${verse.verse}</a>
    </sup>${verse.text} </span>`;
  }
  
  // Close remaining tags
  if (currentChapter !== -1) {
    html += '</div></div>'; // Close chapter text and section
  }
  if (currentBook !== '') {
    html += '</div>'; // Close book section
  }
  
  html += '</div>';
  return html;
}

// Open Bible Explorer from the modal and close the modal
function openBibleExplorerFromModal(book, chapter, verse = null) {
  closeBibleReader();
  openBibleExplorerTo(book, chapter, verse);
}

// Open the Bible reader with a specific citation
function openBibleReader(citationStr, title = '') {
  if (!bibleData) {
    console.warn('Bible data not loaded');
    return;
  }
  
  const verses = getVersesForCitationString(citationStr);
  const displayTitle = title || citationStr;
  const html = formatVersesForDisplay(verses, displayTitle);
  
  // Update modal content
  const contentEl = document.getElementById('bible-reader-text');
  const titleEl = document.getElementById('bible-reader-modal-title');
  
  if (contentEl) {
    contentEl.innerHTML = html;
  }
  if (titleEl) {
    titleEl.textContent = displayTitle;
  }
  
  // Show the modal
  const modal = document.getElementById('bible-reader-modal');
  if (modal) {
    modal.classList.add('open');
    document.body.classList.add('bible-reader-open');
  }
}

// Close the Bible reader
function closeBibleReader() {
  const modal = document.getElementById('bible-reader-modal');
  if (modal) {
    modal.classList.remove('open');
    document.body.classList.remove('bible-reader-open');
  }
}

// Handle click on citation link
function handleCitationClick(event) {
  event.preventDefault();
  const citation = event.target.dataset.citation;
  const title = event.target.dataset.title || '';
  if (citation) {
    openBibleReader(citation, title);
  }
}

// Make a citation string clickable
function makeCitationClickable(citationStr, title = '') {
  return `<a href="#" class="bible-citation-link" data-citation="${citationStr}" data-title="${title}" onclick="handleCitationClick(event)">${citationStr}</a>`;
}

// Map of book abbreviations to full names (matching KJV format)
const BOOK_NAME_MAP = {
  // Full names map to themselves
  'genesis': 'Genesis', 'exodus': 'Exodus', 'leviticus': 'Leviticus', 'numbers': 'Numbers', 'deuteronomy': 'Deuteronomy',
  'joshua': 'Joshua', 'judges': 'Judges', 'ruth': 'Ruth',
  '1 samuel': '1 Samuel', '2 samuel': '2 Samuel', '1 kings': '1 Kings', '2 kings': '2 Kings',
  '1 chronicles': '1 Chronicles', '2 chronicles': '2 Chronicles',
  'ezra': 'Ezra', 'nehemiah': 'Nehemiah', 'esther': 'Esther',
  'job': 'Job', 'psalms': 'Psalms', 'psalm': 'Psalms', 'proverbs': 'Proverbs', 'ecclesiastes': 'Ecclesiastes',
  'song of solomon': 'Song of Solomon', 'song of songs': 'Song of Solomon',
  'isaiah': 'Isaiah', 'jeremiah': 'Jeremiah', 'lamentations': 'Lamentations', 'ezekiel': 'Ezekiel', 'daniel': 'Daniel',
  'hosea': 'Hosea', 'joel': 'Joel', 'amos': 'Amos', 'obadiah': 'Obadiah', 'jonah': 'Jonah', 'micah': 'Micah',
  'nahum': 'Nahum', 'habakkuk': 'Habakkuk', 'zephaniah': 'Zephaniah', 'haggai': 'Haggai', 'zechariah': 'Zechariah', 'malachi': 'Malachi',
  'matthew': 'Matthew', 'mark': 'Mark', 'luke': 'Luke', 'john': 'John', 'acts': 'Acts', 'romans': 'Romans',
  '1 corinthians': '1 Corinthians', '2 corinthians': '2 Corinthians',
  'galatians': 'Galatians', 'ephesians': 'Ephesians', 'philippians': 'Philippians', 'colossians': 'Colossians',
  '1 thessalonians': '1 Thessalonians', '2 thessalonians': '2 Thessalonians',
  '1 timothy': '1 Timothy', '2 timothy': '2 Timothy', 'titus': 'Titus', 'philemon': 'Philemon',
  'hebrews': 'Hebrews', 'james': 'James',
  '1 peter': '1 Peter', '2 peter': '2 Peter', '1 john': '1 John', '2 john': '2 John', '3 john': '3 John',
  'jude': 'Jude', 'revelation': 'Revelation',
  // Common abbreviations
  'gen': 'Genesis', 'ge': 'Genesis',
  'exod': 'Exodus', 'exo': 'Exodus', 'ex': 'Exodus',
  'lev': 'Leviticus', 'le': 'Leviticus',
  'num': 'Numbers', 'nu': 'Numbers',
  'deut': 'Deuteronomy', 'de': 'Deuteronomy', 'dt': 'Deuteronomy',
  'josh': 'Joshua', 'jos': 'Joshua',
  'judg': 'Judges', 'jdg': 'Judges', 'jg': 'Judges',
  'ru': 'Ruth',
  '1 sam': '1 Samuel', '1sam': '1 Samuel', '1sa': '1 Samuel',
  '2 sam': '2 Samuel', '2sam': '2 Samuel', '2sa': '2 Samuel',
  '1 kgs': '1 Kings', '1kgs': '1 Kings', '1ki': '1 Kings',
  '2 kgs': '2 Kings', '2kgs': '2 Kings', '2ki': '2 Kings',
  '1 chr': '1 Chronicles', '1chr': '1 Chronicles', '1ch': '1 Chronicles',
  '2 chr': '2 Chronicles', '2chr': '2 Chronicles', '2ch': '2 Chronicles',
  'neh': 'Nehemiah', 'ne': 'Nehemiah',
  'est': 'Esther', 'es': 'Esther',
  'jb': 'Job',
  'psa': 'Psalms', 'ps': 'Psalms',
  'prov': 'Proverbs', 'pro': 'Proverbs', 'pr': 'Proverbs',
  'eccl': 'Ecclesiastes', 'ecc': 'Ecclesiastes', 'ec': 'Ecclesiastes',
  'song': 'Song of Solomon', 'sos': 'Song of Solomon', 'so': 'Song of Solomon',
  'isa': 'Isaiah', 'is': 'Isaiah',
  'jer': 'Jeremiah', 'je': 'Jeremiah',
  'lam': 'Lamentations', 'la': 'Lamentations',
  'ezek': 'Ezekiel', 'eze': 'Ezekiel', 'ez': 'Ezekiel',
  'dan': 'Daniel', 'da': 'Daniel',
  'hos': 'Hosea', 'ho': 'Hosea',
  'joe': 'Joel', 'jl': 'Joel',
  'am': 'Amos',
  'obad': 'Obadiah', 'ob': 'Obadiah',
  'jon': 'Jonah', 'jnh': 'Jonah',
  'mic': 'Micah', 'mi': 'Micah',
  'nah': 'Nahum', 'na': 'Nahum',
  'hab': 'Habakkuk',
  'zeph': 'Zephaniah', 'zep': 'Zephaniah',
  'hag': 'Haggai', 'hg': 'Haggai',
  'zech': 'Zechariah', 'zec': 'Zechariah',
  'mal': 'Malachi',
  'matt': 'Matthew', 'mat': 'Matthew', 'mt': 'Matthew',
  'mk': 'Mark', 'mr': 'Mark',
  'lk': 'Luke', 'lu': 'Luke',
  'jn': 'John', 'joh': 'John',
  'ac': 'Acts',
  'rom': 'Romans', 'ro': 'Romans',
  '1 cor': '1 Corinthians', '1cor': '1 Corinthians', '1co': '1 Corinthians',
  '2 cor': '2 Corinthians', '2cor': '2 Corinthians', '2co': '2 Corinthians',
  'gal': 'Galatians', 'ga': 'Galatians',
  'eph': 'Ephesians',
  'phil': 'Philippians', 'php': 'Philippians',
  'col': 'Colossians',
  '1 thess': '1 Thessalonians', '1thess': '1 Thessalonians', '1th': '1 Thessalonians',
  '2 thess': '2 Thessalonians', '2thess': '2 Thessalonians', '2th': '2 Thessalonians',
  '1 tim': '1 Timothy', '1tim': '1 Timothy', '1ti': '1 Timothy',
  '2 tim': '2 Timothy', '2tim': '2 Timothy', '2ti': '2 Timothy',
  'tit': 'Titus',
  'phlm': 'Philemon', 'phm': 'Philemon',
  'heb': 'Hebrews',
  'jas': 'James', 'jam': 'James',
  '1 pet': '1 Peter', '1pet': '1 Peter', '1pe': '1 Peter',
  '2 pet': '2 Peter', '2pet': '2 Peter', '2pe': '2 Peter',
  '1 jn': '1 John', '1jn': '1 John', '1jo': '1 John',
  '2 jn': '2 John', '2jn': '2 John', '2jo': '2 John',
  '3 jn': '3 John', '3jn': '3 John', '3jo': '3 John',
  'jud': 'Jude',
  'rev': 'Revelation', 're': 'Revelation'
};

// Normalize a book name to KJV format
function normalizeBookName(bookStr) {
  if (!bookStr) return bookStr;
  const cleaned = bookStr.replace(/\.$/, '').trim().toLowerCase();
  return BOOK_NAME_MAP[cleaned] || bookStr.trim();
}

// Find and linkify scripture references in text
// Handles patterns like: "Rev 18:21", "Ezek 26:4-5,14", "Revelation 17-18", "1 Kings 8:1-11", "v. 14"
// contextCitation should be like "Ezekiel 26" (book + chapter) for "v. X" style references
function linkifyScriptureReferences(text, contextCitation = '') {
  if (!text) return text;
  
  // Book name patterns for regex (including numbered books)
  const bookPatterns = [
    // Full names
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
    '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther',
    'Job', 'Psalms?', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Song of Songs',
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
    'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
    'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
    '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
    'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
    'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
    'Jude', 'Revelation',
    // Common abbreviations
    'Gen', 'Exod?', 'Lev', 'Num', 'Deut',
    'Josh', 'Judg', 'Sam', 'Kgs', 'Chr', 'Neh', 'Est',
    'Psa?', 'Prov', 'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek?', 'Dan',
    'Hos', 'Obad', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal',
    'Matt?', 'Mk', 'Lk', 'Jn', 'Rom', 'Cor', 'Gal', 'Eph', 'Phil', 'Col',
    'Thess', 'Tim', 'Tit', 'Phlm', 'Heb', 'Jas', 'Pet', 'Rev'
  ];
  
  // Build regex pattern for book names (with optional numbers prefix)
  const bookPattern = bookPatterns.join('|');
  
  // Main pattern: Book Chapter:Verse(s) or Book Chapter-Chapter
  // Matches: "Rev 18:21", "Ezekiel 26:4-5,14", "Revelation 17-18", "1 Kings 8:1-11,65-66"
  const mainPattern = new RegExp(
    `((?:1|2|3|I{1,3})?\\s*(?:${bookPattern})\\.?)\\s*(\\d+)(?::(\\d+(?:[-–]\\d+)?(?:,\\s*\\d+(?:[-–]\\d+)?)*))?(?:[-–](\\d+)(?::(\\d+))?)?`,
    'gi'
  );
  
  // Pattern for "v. X" or "vv. X-Y" or "verse X" references (uses context book)
  const versePattern = /\b(vv?\.|verses?)\s*(\d+(?:[-–]\d+)?(?:,\s*\d+(?:[-–]\d+)?)*)/gi;
  
  // Pattern for parenthetical references like "(cf. v. 21)" or "(v. 12-19)"
  const cfPattern = /\(cf\.\s*(v\.|vv\.)\s*(\d+(?:[-–]\d+)?)\)/gi;
  
  // Replace main scripture references
  let result = text.replace(mainPattern, (match, book, chapter, verses, endChapter, endVerse) => {
    // Normalize book name to KJV format
    const normalizedBook = normalizeBookName(book);
    
    // Build the citation string in format the parser expects
    let citation = normalizedBook + ' ' + chapter;
    if (verses) {
      // Pass through the full verse spec (including commas)
      // Parser now handles: "4-5,14", "4,5,6", etc.
      citation += ':' + verses.replace(/–/g, '-');
    }
    if (endChapter) {
      citation += '-' + endChapter;
      if (endVerse) {
        citation += ':' + endVerse;
      }
    }
    return `<a href="#" class="bible-citation-link" data-citation="${citation}" onclick="handleCitationClick(event)">${match}</a>`;
  });
  
  // contextCitation should be like "Ezekiel 26" (book + chapter)
  // Replace verse-only references if we have a context citation
  if (contextCitation) {
    // Extract book and chapter from context citation
    const contextMatch = contextCitation.match(/^(.+?)\s+(\d+)$/);
    if (contextMatch) {
      const normalizedBook = normalizeBookName(contextMatch[1]);
      const contextChapter = contextMatch[2];
      
      result = result.replace(versePattern, (match, prefix, verses) => {
        // Pass through the full verse spec (including commas)
        const cleanVerses = verses.replace(/–/g, '-');
        const citation = normalizedBook + ' ' + contextChapter + ':' + cleanVerses;
        return `<a href="#" class="bible-citation-link" data-citation="${citation}" onclick="handleCitationClick(event)">${match}</a>`;
      });
      
      result = result.replace(cfPattern, (match, prefix, verses) => {
        const cleanVerses = verses.replace(/–/g, '-');
        const citation = normalizedBook + ' ' + contextChapter + ':' + cleanVerses;
        return `(cf. <a href="#" class="bible-citation-link" data-citation="${citation}" onclick="handleCitationClick(event)">${prefix} ${verses}</a>)`;
      });
    }
  }
  
  return result;
}

// ============================================================================
// KJV BIBLE EXPLORER
// ============================================================================

// Bible books organized by testament
const BIBLE_BOOKS = {
  ot: [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
    '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
    'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
    'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
    'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel',
    'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
    'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'
  ],
  nt: [
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
    '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
    'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
    'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
    'Jude', 'Revelation'
  ]
};

// Track current state
let bibleExplorerState = {
  currentBook: null,
  currentChapter: null,
  highlightedVerse: null,
  bookChapterCounts: {} // Cache of chapter counts per book
};

// Initialize Bible Explorer
function initBibleExplorer() {
  if (!bibleData) {
    loadBible().then(() => {
      buildBookChapterCounts();
      populateBibleBooks();
    });
  } else {
    buildBookChapterCounts();
    populateBibleBooks();
  }
}

// Build cache of chapter counts for each book
function buildBookChapterCounts() {
  if (!bibleData) return;
  
  bibleExplorerState.bookChapterCounts = {};
  
  for (const entry of bibleData) {
    if (!bibleExplorerState.bookChapterCounts[entry.book]) {
      bibleExplorerState.bookChapterCounts[entry.book] = 0;
    }
    if (entry.chapter > bibleExplorerState.bookChapterCounts[entry.book]) {
      bibleExplorerState.bookChapterCounts[entry.book] = entry.chapter;
    }
  }
}

// Populate book dropdown in header
function populateBibleBooks() {
  const bookSelect = document.getElementById('bible-book-select');
  if (!bookSelect) return;
  
  let html = '<option value="">Select Book</option>';
  html += '<optgroup label="Old Testament">';
  for (const book of BIBLE_BOOKS.ot) {
    const selected = bibleExplorerState.currentBook === book ? ' selected' : '';
    html += `<option value="${book}"${selected}>${book}</option>`;
  }
  html += '</optgroup>';
  html += '<optgroup label="New Testament">';
  for (const book of BIBLE_BOOKS.nt) {
    const selected = bibleExplorerState.currentBook === book ? ' selected' : '';
    html += `<option value="${book}"${selected}>${book}</option>`;
  }
  html += '</optgroup>';
  bookSelect.innerHTML = html;
}

// Handle book dropdown change
function onBookSelectChange(book) {
  if (!book) return;
  selectBibleBook(book);
}

// Handle chapter dropdown change
function onChapterSelectChange(chapter) {
  if (!chapter) return;
  selectBibleChapter(parseInt(chapter));
}

// Update chapter dropdown for selected book
function updateChapterDropdown(book) {
  const chapterSelect = document.getElementById('bible-chapter-select');
  if (!chapterSelect) return;
  
  const chapterCount = bibleExplorerState.bookChapterCounts[book] || 0;
  
  if (chapterCount === 0) {
    chapterSelect.innerHTML = '<option value="">Ch.</option>';
    chapterSelect.disabled = true;
    return;
  }
  
  let html = '<option value="">Ch.</option>';
  for (let i = 1; i <= chapterCount; i++) {
    const selected = bibleExplorerState.currentChapter === i ? ' selected' : '';
    html += `<option value="${i}"${selected}>${i}</option>`;
  }
  chapterSelect.innerHTML = html;
  chapterSelect.disabled = false;
}

// Toggle testament expansion
function toggleTestament(testament) {
  const section = document.querySelector(`#${testament}-books`).parentElement;
  section.classList.toggle('collapsed');
}

// Switch between Books and Chapters tabs
function switchBibleNavTab(tab) {
  const booksPanel = document.getElementById('bible-books-panel');
  const chaptersPanel = document.getElementById('bible-chapters-panel');
  const tabs = document.querySelectorAll('.bible-nav-tab');
  
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector(`.bible-nav-tab[data-tab="${tab}"]`).classList.add('active');
  
  if (tab === 'books') {
    booksPanel.classList.add('active');
    chaptersPanel.classList.remove('active');
  } else {
    booksPanel.classList.remove('active');
    chaptersPanel.classList.add('active');
  }
}

// Select a book
function selectBibleBook(bookName) {
  bibleExplorerState.currentBook = bookName;
  
  // Update book dropdown selection
  const bookSelect = document.getElementById('bible-book-select');
  if (bookSelect) {
    bookSelect.value = bookName;
  }
  
  // Update chapter dropdown
  updateChapterDropdown(bookName);
  
  // Auto-select chapter 1 and display it
  selectBibleChapter(1);
}

// Populate chapter grid for selected book
function populateBibleChapters(bookName) {
  const grid = document.getElementById('bible-chapters-grid');
  const bookNameEl = document.getElementById('bible-current-book-name');
  
  if (!grid || !bookNameEl) return;
  
  bookNameEl.textContent = bookName;
  
  const chapterCount = bibleExplorerState.bookChapterCounts[bookName] || 1;
  
  let html = '';
  for (let i = 1; i <= chapterCount; i++) {
    const activeClass = bibleExplorerState.currentChapter === i ? ' active' : '';
    html += `<button class="bible-chapter-btn${activeClass}" onclick="selectBibleChapter(${i})">${i}</button>`;
  }
  grid.innerHTML = html;
}

// Select a chapter
function selectBibleChapter(chapter) {
  bibleExplorerState.currentChapter = chapter;
  bibleExplorerState.highlightedVerse = null;
  
  // Update chapter dropdown selection
  const chapterSelect = document.getElementById('bible-chapter-select');
  if (chapterSelect) {
    chapterSelect.value = chapter;
  }
  
  // Display the chapter
  displayBibleChapter(bibleExplorerState.currentBook, chapter);
  
  // Update navigation buttons
  updateChapterNavigation();
  
  // Update URL
  updateBibleExplorerURL(bibleExplorerState.currentBook, chapter, null);
}

// Display a chapter
function displayBibleChapter(bookName, chapter, highlightVerse = null) {
  const textContainer = document.getElementById('bible-explorer-text');
  const titleEl = document.getElementById('bible-chapter-title');
  
  if (!textContainer || !bibleData) return;
  
  // Update title
  if (titleEl) {
    titleEl.textContent = `${bookName} ${chapter}`;
  }
  
  // Get verses for this chapter
  const verses = bibleData.filter(v => v.book === bookName && v.chapter === chapter);
  
  if (verses.length === 0) {
    textContainer.innerHTML = '<div class="bible-explorer-welcome"><p>No verses found for this chapter.</p></div>';
    return;
  }
  
  // Build chapter HTML
  let html = '<div class="bible-explorer-chapter">';
  html += `<div class="bible-explorer-chapter-header">
    <h2>${bookName}</h2>
    <div class="chapter-subtitle">Chapter ${chapter}</div>
  </div>`;
  
  for (const verse of verses) {
    const highlighted = highlightVerse && verse.verse === highlightVerse ? ' highlighted' : '';
    const reference = `${bookName} ${chapter}:${verse.verse}`;
    const annotatedText = applyVerseAnnotations(reference, verse.text);
    html += `<div class="bible-explorer-verse${highlighted}" id="verse-${verse.verse}">
      <span class="bible-verse-number" onclick="copyVerseReference('${bookName}', ${chapter}, ${verse.verse})" title="Click to copy reference">${verse.verse}</span>
      <span class="bible-verse-text">${annotatedText}</span>
    </div>`;
  }
  
  html += '</div>';
  textContainer.innerHTML = html;
  
  // Scroll to highlighted verse if specified
  if (highlightVerse) {
    setTimeout(() => {
      const verseEl = document.getElementById(`verse-${highlightVerse}`);
      if (verseEl) {
        verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  } else {
    textContainer.scrollTop = 0;
  }
  
  // Update state
  bibleExplorerState.currentBook = bookName;
  bibleExplorerState.currentChapter = chapter;
  bibleExplorerState.highlightedVerse = highlightVerse;
}

// Update chapter navigation buttons
function updateChapterNavigation() {
  const prevBtn = document.getElementById('bible-prev-chapter');
  const nextBtn = document.getElementById('bible-next-chapter');
  
  if (!prevBtn || !nextBtn) return;
  
  const maxChapter = bibleExplorerState.bookChapterCounts[bibleExplorerState.currentBook] || 1;
  
  prevBtn.disabled = bibleExplorerState.currentChapter <= 1;
  nextBtn.disabled = bibleExplorerState.currentChapter >= maxChapter;
}

// Navigate to previous/next chapter
function navigateBibleChapter(direction) {
  const newChapter = bibleExplorerState.currentChapter + direction;
  const maxChapter = bibleExplorerState.bookChapterCounts[bibleExplorerState.currentBook] || 1;
  
  if (newChapter >= 1 && newChapter <= maxChapter) {
    selectBibleChapter(newChapter);
    
    // Update chapter grid if visible
    document.querySelectorAll('.bible-chapter-btn').forEach(el => {
      el.classList.remove('active');
      if (parseInt(el.textContent) === newChapter) {
        el.classList.add('active');
      }
    });
  }
}

// Jump to a verse from the search box
function jumpToVerse() {
  const input = document.getElementById('bible-explorer-search-input');
  if (!input) return;
  
  const searchText = input.value.trim();
  if (!searchText) return;
  
  // Parse the citation
  const parsed = parseSearchCitation(searchText);
  
  if (parsed.book) {
    // Normalize book name
    const normalizedBook = normalizeBookName(parsed.book);
    
    // Verify book exists
    if (!bibleExplorerState.bookChapterCounts[normalizedBook]) {
      alert(`Book "${parsed.book}" not found`);
      return;
    }
    
    // Update sidebar selection
    selectBibleBook(normalizedBook);
    
    if (parsed.chapter) {
      // Populate chapters and select
      populateBibleChapters(normalizedBook);
      bibleExplorerState.currentChapter = parsed.chapter;
      
      // Display with optional verse highlight
      displayBibleChapter(normalizedBook, parsed.chapter, parsed.verse);
      updateChapterNavigation();
      
      // Update chapter grid
      document.querySelectorAll('.bible-chapter-btn').forEach(el => {
        el.classList.remove('active');
        if (parseInt(el.textContent) === parsed.chapter) {
          el.classList.add('active');
        }
      });
    }
    
    // Clear input
    input.value = '';
  } else {
    alert('Could not parse citation. Try formats like "John 3:16" or "Genesis 1"');
  }
}

// Parse a search citation string
function parseSearchCitation(str) {
  // Pattern: Book Chapter:Verse or Book Chapter
  const match = str.match(/^(.+?)\s+(\d+)(?::(\d+))?/);
  
  if (match) {
    return {
      book: match[1].trim(),
      chapter: parseInt(match[2]),
      verse: match[3] ? parseInt(match[3]) : null
    };
  }
  
  // Just a book name
  const bookOnly = str.match(/^([A-Za-z0-9\s]+)/);
  if (bookOnly) {
    return {
      book: bookOnly[1].trim(),
      chapter: 1,
      verse: null
    };
  }
  
  return { book: null, chapter: null, verse: null };
}

// Open Bible Explorer to a specific location
function openBibleExplorerTo(book, chapter, verse = null) {
  const normalizedBook = normalizeBookName(book);
  
  // Navigate to Bible Explorer if not already there
  if (typeof navigateTo === 'function') {
    navigateTo('bible-explorer');
  }
  
  // Wait for initialization then navigate
  setTimeout(() => {
    if (bibleExplorerState.bookChapterCounts[normalizedBook]) {
      selectBibleBook(normalizedBook);
      populateBibleChapters(normalizedBook);
      bibleExplorerState.currentChapter = chapter;
      displayBibleChapter(normalizedBook, chapter, verse);
      updateChapterNavigation();
      
      // Update UI
      document.querySelectorAll('.bible-chapter-btn').forEach(el => {
        el.classList.remove('active');
        if (parseInt(el.textContent) === chapter) {
          el.classList.add('active');
        }
      });
      
      // Update URL
      updateBibleExplorerURL(normalizedBook, chapter, verse);
    }
  }, 200);
}

// Update browser URL for Bible Explorer
function updateBibleExplorerURL(book, chapter, verse = null) {
  const bookEncoded = encodeURIComponent(book);
  let url = `/bible/${bookEncoded}/${chapter}`;
  if (verse) {
    url += `?verse=${verse}`;
  }
  window.history.replaceState({}, '', url);
}

// Copy verse reference to clipboard
function copyVerseReference(book, chapter, verse) {
  const reference = `${book} ${chapter}:${verse}`;
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(reference).then(() => {
      // Brief visual feedback
      const verseEl = document.getElementById(`verse-${verse}`);
      if (verseEl) {
        verseEl.classList.add('highlighted');
        setTimeout(() => {
          if (!bibleExplorerState.highlightedVerse || bibleExplorerState.highlightedVerse !== verse) {
            verseEl.classList.remove('highlighted');
          }
        }, 1000);
      }
    });
  }
}
