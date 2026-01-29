// Bible Reader Module
// Parses Bible translations and provides verse lookup functionality

// Translation configuration
// Note: Bible text is cached by Service Worker, not localStorage
const BIBLE_TRANSLATIONS = {
  kjv: {
    id: 'kjv',
    name: 'KJV',
    fullName: 'King James Version',
    file: '/kjv.txt',
    separator: '\t',  // Tab-separated
    skipLines: 2      // Header lines to skip
  },
  asv: {
    id: 'asv',
    name: 'ASV',
    fullName: 'American Standard Version',
    file: '/asv.txt',
    separator: ' ',   // Space-separated (first space after reference)
    skipLines: 4      // Header lines to skip (includes blank lines)
  }
};

// Translation data storage
let bibleTranslations = {};  // { kjv: [...], asv: [...] }
let bibleIndexes = {};       // { kjv: {...}, asv: {...} }
let currentTranslation = 'kjv';
let translationsLoading = {};  // Track which translations are currently loading

// Hebrew (WLC) data storage
let hebrewData = null;       // Array of { book, chapter, verse, text }
let hebrewIndex = {};        // Index by "Book Chapter:Verse"
let hebrewLoading = null;    // Promise while loading

// Book number to name mapping for WLC (Hebrew Bible order matches Protestant OT)
const BOOK_NUM_TO_NAME = {
  1: 'Genesis', 2: 'Exodus', 3: 'Leviticus', 4: 'Numbers', 5: 'Deuteronomy',
  6: 'Joshua', 7: 'Judges', 8: 'Ruth', 9: '1 Samuel', 10: '2 Samuel',
  11: '1 Kings', 12: '2 Kings', 13: '1 Chronicles', 14: '2 Chronicles',
  15: 'Ezra', 16: 'Nehemiah', 17: 'Esther', 18: 'Job', 19: 'Psalms',
  20: 'Proverbs', 21: 'Ecclesiastes', 22: 'Song of Solomon', 23: 'Isaiah',
  24: 'Jeremiah', 25: 'Lamentations', 26: 'Ezekiel', 27: 'Daniel',
  28: 'Hosea', 29: 'Joel', 30: 'Amos', 31: 'Obadiah', 32: 'Jonah',
  33: 'Micah', 34: 'Nahum', 35: 'Habakkuk', 36: 'Zephaniah', 37: 'Haggai',
  38: 'Zechariah', 39: 'Malachi'
};

// Reverse mapping: book name to number
const BOOK_NAME_TO_NUM = {};

// Normalize Strong's number - strip leading zeros and trailing letter suffixes
// H0550G -> H550, H08559 -> H8559, G0011 -> G11
function normalizeStrongsNum(strongsNum) {
  if (!strongsNum) return strongsNum;
  const match = strongsNum.match(/^([HG])0*(\d+)/i);
  if (match) {
    return match[1].toUpperCase() + match[2];
  }
  return strongsNum;
}

// KJV uses older transliterations of names - map them to modern equivalents
const KJV_NAME_VARIANTS = {
  // Matthew genealogy names
  'aram': 'ram',
  'judas': 'judah',
  'phares': 'perez',
  'zara': 'zerah',
  'thamar': 'tamar',
  'esrom': 'hezron',
  'aminadab': 'amminadab',
  'naasson': 'nahshon',
  'booz': 'boaz',
  'rachab': 'rahab',
  'obed': 'obed',
  'jesse': 'jesse',
  'roboam': 'rehoboam',
  'abia': 'abijah',
  'asa': 'asa',
  'josaphat': 'jehoshaphat',
  'joram': 'joram',
  'ozias': 'uzziah',
  'joatham': 'jotham',
  'achaz': 'ahaz',
  'ezekias': 'hezekiah',
  'manasses': 'manasseh',
  'amon': 'amon',
  'josias': 'josiah',
  'jechonias': 'jeconiah',
  'salathiel': 'shealtiel',
  'zorobabel': 'zerubbabel',
  'abiud': 'abiud',
  'eliakim': 'eliakim',
  'azor': 'azor',
  'sadoc': 'zadok',
  'achim': 'achim',
  'eliud': 'eliud',
  'eleazar': 'eleazar',
  'matthan': 'matthan',
  // Luke genealogy additions
  'elias': 'elijah',
  'eliseus': 'elisha',
  'esaias': 'isaiah',
  'jeremias': 'jeremiah',
  'jonas': 'jonah',
  'osee': 'hosea',
  'core': 'korah',
  'noe': 'noah',
  'sem': 'shem',
  'heber': 'eber',
  'saruch': 'serug',
  'nachor': 'nahor',
  'thara': 'terah',
  // Other common variants
  'moses': 'moses',
  'elijah': 'elijah',
  'timotheus': 'timothy',
  'silvanus': 'silas',
  'cephas': 'peter',
  'saul': 'paul',
};

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
for (const [num, name] of Object.entries(BOOK_NUM_TO_NAME)) {
  BOOK_NAME_TO_NUM[name] = parseInt(num);
}

// KJV Strong's data storage
let kjvStrongsData = null;
let kjvStrongsIndex = {};
let kjvStrongsLoading = null;

// Strong's Dictionaries - reference to global variables from strongs-*-dict.js
// Will be set when the scripts load
function getStrongsDict() {
  // Return combined lookup function that checks both Hebrew and Greek
  return {
    lookup: function(strongsNum) {
      if (!strongsNum) return null;
      if (strongsNum.startsWith('H') && typeof strongsHebrewDictionary !== 'undefined') {
        return strongsHebrewDictionary[strongsNum];
      }
      if (strongsNum.startsWith('G') && typeof strongsGreekDictionary !== 'undefined') {
        return strongsGreekDictionary[strongsNum];
      }
      return null;
    }
  };
}

// Get entry from Strong's dictionary (Hebrew or Greek)
function getStrongsEntry(strongsNum) {
  const dict = getStrongsDict();
  if (!dict) return null;
  // Normalize the Strong's number (strip leading zeros)
  const normalized = normalizeStrongsNum(strongsNum);
  return dict.lookup(normalized);
}

// Backwards-compatible getters
function getBibleData() {
  return bibleTranslations[currentTranslation] || null;
}

function getBibleIndex() {
  return bibleIndexes[currentTranslation] || {};
}

// Legacy compatibility - these are used throughout the codebase
let bibleData = null;  // Will be updated when translation changes
let bibleIndex = {};   // Will be updated when translation changes

// Sync legacy variables with current translation
function syncLegacyVariables() {
  bibleData = bibleTranslations[currentTranslation] || null;
  bibleIndex = bibleIndexes[currentTranslation] || {};
}

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

// Load a specific translation from cache or parse from source
// translationId: 'kjv', 'asv', etc.
// showDialog: if true, shows loading dialog (use when user is waiting)
async function loadTranslation(translationId, showDialog = false) {
  const config = BIBLE_TRANSLATIONS[translationId];
  if (!config) {
    console.warn(`Unknown translation: ${translationId}`);
    return false;
  }
  
  // Already loaded?
  if (bibleTranslations[translationId]) {
    console.log(`${config.name} already loaded`);
    return true;
  }
  
  // Currently loading?
  if (translationsLoading[translationId]) {
    console.log(`${config.name} already loading, waiting...`);
    return translationsLoading[translationId];
  }
  
  // Show loading dialog only if requested
  if (showDialog) {
    showBibleLoadingDialog();
    updateLoadingDialogText(`Loading ${config.name}...`);
  }
  
  // Create loading promise
  translationsLoading[translationId] = (async () => {
    try {
      const response = await fetch(config.file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      
      const data = await parseBibleText(text, config);
      bibleTranslations[translationId] = data;
      rebuildTranslationIndex(translationId);
      syncLegacyVariables();
      
      if (showDialog) {
        hideBibleLoadingDialog();
      }
      
      console.log(`${config.name} loaded: ${data.length} verses`);
      return true;
    } catch (err) {
      if (showDialog) {
        hideBibleLoadingDialog();
      }
      console.warn(`${config.name} not available:`, err.message);
      return false;
    } finally {
      delete translationsLoading[translationId];
    }
  })();
  
  return translationsLoading[translationId];
}

// Load Bible (backwards compatible - loads KJV)
async function loadBible(showDialog = false) {
  return loadTranslation('kjv', showDialog);
}

// Load all translations in background (KJV first, then others)
async function loadAllTranslations() {
  // Load KJV first (primary translation)
  await loadTranslation('kjv', false);
  
  // Then load ASV, Hebrew, and Interlinear in background
  loadTranslation('asv', false).catch(err => 
    console.log('ASV loading deferred:', err.message)
  );
  
  loadHebrew().catch(err =>
    console.log('Hebrew loading deferred:', err.message)
  );
  
  loadInterlinear().catch(err =>
    console.log('OT Interlinear loading deferred:', err.message)
  );
  
  loadNTInterlinear().catch(err =>
    console.log('NT Interlinear loading deferred:', err.message)
  );
  
  loadTipnr().catch(err =>
    console.log('TIPNR loading deferred:', err.message)
  );
}

// Load Hebrew (WLC) text
async function loadHebrew() {
  // Already loaded?
  if (hebrewData) {
    return true;
  }
  
  // Currently loading?
  if (hebrewLoading) {
    return hebrewLoading;
  }
  
  // Load from file
  hebrewLoading = (async () => {
    try {
      const response = await fetch('/wlc/verses.txt');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      
      hebrewData = await parseHebrewText(text);
      rebuildHebrewIndex();
      
      console.log(`Hebrew loaded: ${hebrewData.length} verses`);
      return true;
    } catch (err) {
      console.warn('Hebrew not available:', err.message);
      return false;
    } finally {
      hebrewLoading = null;
    }
  })();
  
  return hebrewLoading;
}

// Parse WLC Hebrew text file
async function parseHebrewText(text) {
  const data = [];
  const lines = text.split('\n');
  const totalLines = lines.length;
  const CHUNK_SIZE = 2000;
  
  for (let i = 0; i < totalLines; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;  // Skip comments and empty lines
    
    // Format: book|chapter|verse|text|italics|strongs
    const parts = line.split('|');
    if (parts.length < 4) continue;
    
    const bookNum = parseInt(parts[0]);
    const chapter = parseInt(parts[1]);
    const verse = parseInt(parts[2]);
    const hebrewText = parts[3];
    
    // Get book name from number
    const bookName = BOOK_NUM_TO_NAME[bookNum];
    if (!bookName) continue;  // Unknown book number
    
    data.push({
      book: bookName,
      chapter: chapter,
      verse: verse,
      text: hebrewText,
      reference: `${bookName} ${chapter}:${verse}`
    });
    
    // Yield to main thread
    if (i % CHUNK_SIZE === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return data;
}

// Rebuild Hebrew index
function rebuildHebrewIndex() {
  hebrewIndex = {};
  if (hebrewData) {
    for (const entry of hebrewData) {
      hebrewIndex[entry.reference] = entry;
    }
  }
}

// Get Hebrew verse by reference
function getHebrewVerse(bookName, chapter, verse) {
  const reference = `${bookName} ${chapter}:${verse}`;
  return hebrewIndex[reference] || null;
}

// Check if Hebrew is available for a book (OT only)
function hasHebrewText(bookName) {
  return BOOK_NAME_TO_NUM.hasOwnProperty(bookName);
}

// ============================================================================
// INTERLINEAR DATA AND DISPLAY
// ============================================================================

// Interlinear data storage - contains Hebrew words and English words with BHSA IDs
let interlinearData = null;
let interlinearLoading = null;

// Load interlinear data
// NT interlinear data (Greek)
let ntInterlinearData = null;
let ntInterlinearLoading = null;

// TIPNR person/place data
let tipnrData = null;
let tipnrLoading = null;

async function loadTipnr() {
  if (tipnrData) return true;
  if (tipnrLoading) return tipnrLoading;
  
  tipnrLoading = (async () => {
    try {
      const response = await fetch('/data/tipnr.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      tipnrData = await response.json();
      console.log(`TIPNR data loaded: ${Object.keys(tipnrData).length} entries`);
      return true;
    } catch (err) {
      console.warn('TIPNR data not available:', err.message);
      return false;
    } finally {
      tipnrLoading = null;
    }
  })();
  
  return tipnrLoading;
}

// Book name abbreviation to full name mapping for TIPNR references
const TIPNR_BOOK_ABBREVS = {
  'Gen': 'Genesis', 'Exo': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers', 'Deu': 'Deuteronomy',
  'Jos': 'Joshua', 'Jdg': 'Judges', 'Rut': 'Ruth', 'Ruth': 'Ruth',
  '1Sa': '1 Samuel', '2Sa': '2 Samuel', '1Ki': '1 Kings', '2Ki': '2 Kings',
  '1Ch': '1 Chronicles', '2Ch': '2 Chronicles', 'Ezr': 'Ezra', 'Neh': 'Nehemiah',
  'Est': 'Esther', 'Job': 'Job', 'Psa': 'Psalms', 'Pro': 'Proverbs', 'Ecc': 'Ecclesiastes',
  'Sol': 'Song of Solomon', 'Isa': 'Isaiah', 'Jer': 'Jeremiah', 'Lam': 'Lamentations',
  'Eze': 'Ezekiel', 'Dan': 'Daniel', 'Hos': 'Hosea', 'Joe': 'Joel', 'Amo': 'Amos',
  'Oba': 'Obadiah', 'Jon': 'Jonah', 'Mic': 'Micah', 'Nah': 'Nahum', 'Hab': 'Habakkuk',
  'Zep': 'Zephaniah', 'Hag': 'Haggai', 'Zec': 'Zechariah', 'Mal': 'Malachi',
  'Mat': 'Matthew', 'Mar': 'Mark', 'Luk': 'Luke', 'Joh': 'John', 'Act': 'Acts',
  'Rom': 'Romans', '1Co': '1 Corinthians', '2Co': '2 Corinthians', 'Gal': 'Galatians',
  'Eph': 'Ephesians', 'Phi': 'Philippians', 'Col': 'Colossians',
  '1Th': '1 Thessalonians', '2Th': '2 Thessalonians', '1Ti': '1 Timothy', '2Ti': '2 Timothy',
  'Tit': 'Titus', 'Phm': 'Philemon', 'Heb': 'Hebrews', 'Jam': 'James',
  '1Pe': '1 Peter', '2Pe': '2 Peter', '1Jo': '1 John', '2Jo': '2 John', '3Jo': '3 John',
  'Jud': 'Jude', 'Rev': 'Revelation'
};

// Linkify scripture refs and Strong's numbers in person info text
// Cache for name to Strong's lookup
let nameToStrongsCache = null;

function buildNameToStrongsCache() {
  if (nameToStrongsCache || !tipnrData) return;
  
  nameToStrongsCache = new Map();
  for (const [strongsNum, info] of Object.entries(tipnrData)) {
    if (info.n) {
      // Store by lowercase name for case-insensitive matching
      const nameLower = info.n.toLowerCase();
      // Only store if not already present (prefer earlier/more common entries)
      if (!nameToStrongsCache.has(nameLower)) {
        nameToStrongsCache.set(nameLower, strongsNum);
      }
    }
  }
}

function getStrongsForName(name) {
  if (!nameToStrongsCache) buildNameToStrongsCache();
  if (!nameToStrongsCache) return null;
  return nameToStrongsCache.get(name.toLowerCase()) || null;
}

function linkifyPersonText(text) {
  if (!text) return '';
  
  // Build the name cache if needed
  buildNameToStrongsCache();
  
  // First, linkify Strong's number references like (H1234) or (G5678)
  text = text.replace(/\(([HG])(\d+)\)/g, (match, prefix, num) => {
    const strongsNum = prefix + num;
    return `(<a href="#" class="strongs-link" onclick="navigateToStrongs('${strongsNum}'); return false;">${strongsNum}</a>)`;
  });
  
  // Linkify scripture references like "Gen.1.1" or "Rut.4.19" or "Mat.1.1-16"
  text = text.replace(/\b([123]?[A-Z][a-z]{1,2})\.(\d+)\.(\d+)(?:-(\d+))?/g, (match, book, chapter, verse, endVerse) => {
    const fullBook = TIPNR_BOOK_ABBREVS[book];
    if (!fullBook) return match;
    
    const display = `${book} ${chapter}:${verse}${endVerse ? '-' + endVerse : ''}`;
    const escapedBook = fullBook.replace(/'/g, "\\'");
    return `<a href="#" class="scripture-link" onclick="goToScriptureFromSidebar('${escapedBook}', ${chapter}, ${verse}); return false;">${display}</a>`;
  });
  
  // Linkify person names with Strong's references like "Hezron (H2696)" - make the name clickable too
  // Track already-linked names to avoid double-linking
  const linkedNames = new Set();
  text = text.replace(/([A-Z][a-z]+)\s+\(<a href="#" class="strongs-link"/g, (match, name) => {
    linkedNames.add(name.toLowerCase());
    const strongsNum = getStrongsForName(name);
    if (strongsNum) {
      return `<a href="#" class="person-name-link" onclick="navigateToStrongs('${strongsNum}'); return false;">${name}</a> (<a href="#" class="strongs-link"`;
    }
    return match;
  });
  
  // Linkify standalone person names (capitalized words that match known names in TIPNR)
  // But avoid words that are already linked or common non-name words
  const skipWords = new Set(['Man', 'Woman', 'King', 'Priest', 'Prophet', 'Son', 'Father', 'Mother', 'Brother', 'Sister', 'Tribe', 'Apostle', 'The', 'And', 'From', 'Living', 'Time', 'First', 'Also', 'Called', 'Referred', 'Named']);
  
  text = text.replace(/\b([A-Z][a-z]{2,})\b(?![^<]*>)/g, (match, name) => {
    // Skip if already linked, is a skip word, or no Strong's found
    if (linkedNames.has(name.toLowerCase())) return match;
    if (skipWords.has(name)) return match;
    
    const strongsNum = getStrongsForName(name);
    if (strongsNum) {
      linkedNames.add(name.toLowerCase());
      return `<a href="#" class="person-name-link" onclick="navigateToStrongs('${strongsNum}'); return false;">${name}</a>`;
    }
    return match;
  });
  
  return text;
}

// Get person/place info for a Strong's number
// Falls back to Hebrew origin for Greek names
function getPersonInfo(strongsNum) {
  if (!tipnrData || !strongsNum) return null;
  
  // Direct lookup
  let info = tipnrData[strongsNum];
  if (info) return info;
  
  // For Greek numbers, try to find Hebrew origin from dictionary
  if (strongsNum.startsWith('G')) {
    const entry = getStrongsEntry(strongsNum);
    if (entry && entry.derivation) {
      // Extract Hebrew origin like "of Hebrew origin (H07410);"
      const match = entry.derivation.match(/H0*(\d+)/);
      if (match) {
        const hebrewNum = 'H' + match[1];
        info = tipnrData[hebrewNum];
        if (info) return info;
      }
    }
  }
  
  return null;
}

// Get ALL person entries matching a Strong's number (including suffixed variants like H8559G, H8559H, etc.)
function getAllPersonInfo(strongsNum) {
  if (!tipnrData || !strongsNum) return [];
  
  const results = [];
  const baseNum = strongsNum.replace(/[A-Z]$/, ''); // Strip trailing letter suffix
  
  // Direct lookup first
  if (tipnrData[strongsNum]) {
    results.push({ id: strongsNum, ...tipnrData[strongsNum] });
  }
  
  // Look for all entries with same base number plus letter suffix (A-Z)
  for (let i = 65; i <= 90; i++) { // A-Z
    const suffixedNum = baseNum + String.fromCharCode(i);
    if (suffixedNum !== strongsNum && tipnrData[suffixedNum]) {
      results.push({ id: suffixedNum, ...tipnrData[suffixedNum] });
    }
  }
  
  // For Greek numbers, also check Hebrew derivation
  if (strongsNum.startsWith('G') && results.length === 0) {
    const entry = getStrongsEntry(strongsNum);
    if (entry && entry.derivation) {
      const match = entry.derivation.match(/H0*(\d+)/);
      if (match) {
        const hebrewNum = 'H' + match[1];
        const hebrewResults = getAllPersonInfo(hebrewNum);
        results.push(...hebrewResults);
      }
    }
  }
  
  return results;
}

// Render person/place info HTML for all matching entries
function renderPersonInfoHtml(allPersonInfo) {
  if (!allPersonInfo || allPersonInfo.length === 0) return '';
  
  let html = '';
  
  for (const personInfo of allPersonInfo) {
    const typeLabel = personInfo.t === 'p' ? '👤 Person' : personInfo.t === 'l' ? '📍 Place' : '📜 Other';
    const nameLabel = personInfo.n ? ` - ${personInfo.n}` : '';
    const briefLabel = personInfo.b ? ` (${personInfo.b})` : '';
    
    html += `<div class="strongs-person-info">`;
    html += `<div class="person-info-header">${typeLabel}${nameLabel}${briefLabel}</div>`;
    if (personInfo.d) {
      html += `<div class="person-info-desc">${linkifyPersonText(personInfo.d)}</div>`;
    }
    if (personInfo.s) {
      html += `<div class="person-info-summary">${linkifyPersonText(personInfo.s)}</div>`;
    }
    if (personInfo.f && personInfo.f !== personInfo.b) {
      html += `<div class="person-info-extra">${linkifyPersonText(personInfo.f)}</div>`;
    }
    html += `</div>`;
  }
  
  return html;
}

async function loadInterlinear() {
  if (interlinearData) return true;
  if (interlinearLoading) return interlinearLoading;
  
  interlinearLoading = (async () => {
    try {
      const response = await fetch('/data/interlinear.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      interlinearData = await response.json();
      console.log(`OT Interlinear data loaded: ${Object.keys(interlinearData).length} verses`);
      return true;
    } catch (err) {
      console.warn('OT Interlinear data not available:', err.message);
      return false;
    } finally {
      interlinearLoading = null;
    }
  })();
  
  return interlinearLoading;
}

async function loadNTInterlinear() {
  if (ntInterlinearData) return true;
  if (ntInterlinearLoading) return ntInterlinearLoading;
  
  ntInterlinearLoading = (async () => {
    try {
      const response = await fetch('/data/nt-interlinear.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      ntInterlinearData = await response.json();
      console.log(`NT Interlinear data loaded: ${Object.keys(ntInterlinearData).length} verses`);
      return true;
    } catch (err) {
      console.warn('NT Interlinear data not available:', err.message);
      return false;
    } finally {
      ntInterlinearLoading = null;
    }
  })();
  
  return ntInterlinearLoading;
}

// NT book names
const NT_BOOKS = new Set([
  'Matthew', 'Mark', 'Luke', 'John', 'Acts',
  'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
  'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
  '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus',
  'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation'
]);

// Check if book is NT
function isNTBook(bookName) {
  return NT_BOOKS.has(bookName);
}

// Check if interlinear is available for a book
function hasInterlinear(bookName) {
  return hasHebrewText(bookName) || isNTBook(bookName);
}

// Get interlinear data for a verse (OT or NT)
function getInterlinearVerse(bookName, chapter, verse) {
  const ref = `${bookName} ${chapter}:${verse}`;
  
  if (isNTBook(bookName)) {
    return ntInterlinearData ? ntInterlinearData[ref] : null;
  } else {
    return interlinearData ? interlinearData[ref] : null;
  }
}

// Show interlinear display for a verse
async function showInterlinear(book, chapter, verse, event) {
  if (event) event.stopPropagation();
  
  const verseEl = document.getElementById(`verse-${verse}`);
  if (!verseEl) return;
  
  // Toggle off if already expanded
  const existing = verseEl.querySelector('.interlinear-display');
  if (existing) {
    existing.classList.remove('expanded');
    setTimeout(() => existing.remove(), 200);
    verseEl.classList.remove('interlinear-expanded');
    return;
  }
  
  // Collapse any other expanded interlinear
  document.querySelectorAll('.interlinear-display.expanded').forEach(el => {
    el.classList.remove('expanded');
    setTimeout(() => el.remove(), 200);
  });
  document.querySelectorAll('.bible-explorer-verse.interlinear-expanded').forEach(el => {
    el.classList.remove('interlinear-expanded');
  });
  
  const isNT = isNTBook(book);
  
  // Load appropriate data if needed
  if (isNT && !ntInterlinearData) {
    const placeholder = document.createElement('div');
    placeholder.className = 'interlinear-display';
    placeholder.innerHTML = '<div class="interlinear-loading">Loading Greek interlinear data...</div>';
    verseEl.appendChild(placeholder);
    verseEl.classList.add('interlinear-expanded');
    requestAnimationFrame(() => placeholder.classList.add('expanded'));
    
    await loadNTInterlinear();
    placeholder.remove();
  } else if (!isNT && !interlinearData) {
    const placeholder = document.createElement('div');
    placeholder.className = 'interlinear-display';
    placeholder.innerHTML = '<div class="interlinear-loading">Loading Hebrew interlinear data...</div>';
    verseEl.appendChild(placeholder);
    verseEl.classList.add('interlinear-expanded');
    requestAnimationFrame(() => placeholder.classList.add('expanded'));
    
    await loadInterlinear();
    placeholder.remove();
  }
  
  const data = getInterlinearVerse(book, chapter, verse);
  
  // Create interlinear element
  const interlinear = document.createElement('div');
  interlinear.className = 'interlinear-display';
  
  // Check for data - NT uses 'g' for Greek, OT uses 'h' for Hebrew
  const originalWords = isNT ? data?.g : data?.h;
  
  if (!data || !originalWords) {
    interlinear.innerHTML = '<div class="interlinear-error">Interlinear data not available for this verse.</div>';
  } else {
    let html = '';
    
    // Show ONLY the original language line (English is already in the verse text with clickable words)
    if (isNT) {
      // Greek interlinear - word-for-word with gloss below
      html += '<div class="interlinear-words-container">';
      for (let i = 0; i < originalWords.length; i++) {
        const word = originalWords[i];
        const engWord = data.e[i];
        const strongs = engWord?.s || '';
        const gloss = engWord?.g || engWord?.e || '';
        const escapedGloss = gloss.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        html += `<div class="il-word-block il-clickable" onclick="showStrongsPanel('${strongs}', '', '${escapedGloss}', event)">
          <span class="il-original">${word.g}</span>
          <span class="il-strongs">${strongs}</span>
          <span class="il-gloss">${gloss}</span>
        </div>`;
      }
      html += '</div>';
    } else {
      // Hebrew interlinear - word-for-word with gloss below (RTL)
      html += '<div class="interlinear-words-container il-hebrew">';
      for (let i = 0; i < originalWords.length; i++) {
        const word = originalWords[i];
        const engWord = data.e[i];
        const strongs = engWord?.s || '';
        const gloss = engWord?.g || engWord?.e || '';
        const escapedGloss = gloss.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        html += `<div class="il-word-block il-clickable" onclick="showStrongsPanel('${strongs}', '', '${escapedGloss}', event)">
          <span class="il-original">${word.h}</span>
          <span class="il-strongs">${strongs}</span>
          <span class="il-gloss">${gloss}</span>
        </div>`;
      }
      html += '</div>';
    }
    
    interlinear.innerHTML = html;
  }
  
  verseEl.appendChild(interlinear);
  verseEl.classList.add('interlinear-expanded');
  
  requestAnimationFrame(() => {
    interlinear.classList.add('expanded');
  });
}

// Highlight all words with matching BHSA ID
function highlightBhsa(bhsaId) {
  document.querySelectorAll(`.il-word[data-b="${bhsaId}"]`).forEach(el => {
    el.classList.add('il-highlight');
  });
}

// Remove BHSA highlighting
function unhighlightBhsa() {
  document.querySelectorAll('.il-word.il-highlight').forEach(el => {
    el.classList.remove('il-highlight');
  });
}


// ============================================================================
// STRONG'S VERSE SEARCH (Paginated)
// ============================================================================

// Search state
let verseSearchState = {
  strongsNum: null,
  verseRefs: null,      // Array of all verse references (keys of interlinearData)
  currentIndex: 0,      // Current position in scan
  results: [],          // Found verse references
  isSearching: false,
  isComplete: false,
  batchSize: 20         // Results per batch
};

// Start or continue searching for verses with a Strong's number
function searchVersesWithStrongs(strongsNum) {
  // Normalize Strong's number (strip leading zeros and suffixes)
  const normalizedNum = normalizeStrongsNum(strongsNum);
  
  // Determine which dataset to use based on Strong's prefix
  const isGreek = normalizedNum && normalizedNum.startsWith('G');
  const primaryData = isGreek ? ntInterlinearData : interlinearData;
  const secondaryData = isGreek ? interlinearData : ntInterlinearData;
  
  if (!primaryData) {
    console.warn(`${isGreek ? 'NT' : 'OT'} Interlinear data not loaded`);
    return;
  }
  
  // For Greek numbers, find Hebrew origin to search OT too
  // For Hebrew numbers, we'd need a reverse lookup (future enhancement)
  let relatedStrongs = null;
  if (isGreek) {
    const entry = getStrongsEntry(normalizedNum);
    if (entry && entry.derivation) {
      const match = entry.derivation.match(/H0*(\d+)/);
      if (match) {
        relatedStrongs = 'H' + match[1];
      }
    }
  }
  
  // Reset if searching for a different Strong's number
  if (verseSearchState.strongsNum !== normalizedNum) {
    // Build combined verse refs: primary testament first, then secondary if we have a related number
    let allRefs = Object.keys(primaryData);
    if (relatedStrongs && secondaryData) {
      allRefs = allRefs.concat(Object.keys(secondaryData));
    }
    
    verseSearchState = {
      strongsNum: normalizedNum,
      relatedStrongs: relatedStrongs,
      verseRefs: allRefs,
      currentIndex: 0,
      results: [],
      isSearching: false,
      isComplete: false,
      batchSize: 20,
      isGreek: isGreek,
      primaryCount: Object.keys(primaryData).length
    };
  }
  
  // Don't start if already searching or complete
  if (verseSearchState.isSearching || verseSearchState.isComplete) {
    return;
  }
  
  verseSearchState.isSearching = true;
  findNextBatch();
}

// Find next batch of matching verses
function findNextBatch() {
  const state = verseSearchState;
  if (!state.strongsNum || state.isComplete) {
    state.isSearching = false;
    return;
  }
  
  const startIndex = state.currentIndex;
  const endIndex = Math.min(startIndex + 500, state.verseRefs.length); // Scan 500 verses at a time
  let foundCount = 0;
  
  for (let i = startIndex; i < endIndex && foundCount < state.batchSize; i++) {
    const ref = state.verseRefs[i];
    
    // Determine which dataset and Strong's number to use based on position in refs
    const inSecondary = i >= state.primaryCount;
    const searchData = inSecondary 
      ? (state.isGreek ? interlinearData : ntInterlinearData)
      : (state.isGreek ? ntInterlinearData : interlinearData);
    const targetStrongs = inSecondary ? state.relatedStrongs : state.strongsNum;
    
    if (!targetStrongs) {
      state.currentIndex = i + 1;
      continue;
    }
    
    const data = searchData ? searchData[ref] : null;
    
    if (data && data.e) {
      // Collect all matching words in this verse
      const matchingWords = [];
      for (const word of data.e) {
        if (word.s === targetStrongs) {
          matchingWords.push(word.e.toLowerCase().replace(/[.,;:!?'"()]/g, ''));
        }
      }
      
      if (matchingWords.length > 0) {
        // Get the verse text from Bible data
        const verseText = getVerseText(ref);
        
        state.results.push({
          ref: ref,
          matchingWords: matchingWords,
          text: verseText || '(verse text not loaded)'
        });
        foundCount++;
      }
    }
    state.currentIndex = i + 1;
  }
  
  // Check if complete
  if (state.currentIndex >= state.verseRefs.length) {
    state.isComplete = true;
  }
  
  state.isSearching = false;
  
  // Update UI
  updateVerseSearchResults();
  
  // If we haven't found enough and not complete, continue searching
  if (foundCount < state.batchSize && !state.isComplete) {
    setTimeout(findNextBatch, 10);
  }
}

// Get verse text from current Bible translation
function getVerseText(ref) {
  // Parse reference like "Genesis 1:5"
  const match = ref.match(/^(.+)\s+(\d+):(\d+)$/);
  if (!match) return null;
  
  const book = match[1];
  const chapter = parseInt(match[2]);
  const verse = parseInt(match[3]);
  
  // Look up in current translation's index
  const index = getBibleIndex();
  if (!index) return null;
  
  const entry = index[ref];
  return entry ? entry.text : null;
}

// Highlight matching words in verse text
// Reverse mapping: modern name -> KJV name
const MODERN_TO_KJV_VARIANTS = Object.fromEntries(
  Object.entries(KJV_NAME_VARIANTS).map(([kjv, modern]) => [modern, kjv])
);

function highlightMatchingWords(text, matchingWords) {
  if (!text || !matchingWords || matchingWords.length === 0) return text;
  
  // Expand matching words to include KJV variants
  const expandedWords = [];
  for (const word of matchingWords) {
    if (!word) continue;
    expandedWords.push(word);
    // Add KJV variant if it exists (e.g., "ram" -> "aram")
    const kjvVariant = MODERN_TO_KJV_VARIANTS[word.toLowerCase()];
    if (kjvVariant && !expandedWords.includes(kjvVariant)) {
      expandedWords.push(kjvVariant);
    }
  }
  
  let result = text;
  
  for (const word of expandedWords) {
    if (!word) continue;
    // Escape regex special characters
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match word with optional punctuation
    const pattern = new RegExp(`(\\b${escaped}\\b)`, 'gi');
    result = result.replace(pattern, '<mark class="strongs-match">$1</mark>');
  }
  
  return result;
}

// Update the verse search results in the UI
function updateVerseSearchResults() {
  const container = document.getElementById('strongs-verse-results');
  if (!container) return;
  
  const state = verseSearchState;
  
  let html = `<div class="verse-search-header">
    <span class="verse-search-count">${state.results.length} verse${state.results.length !== 1 ? 's' : ''} found</span>
    ${state.isComplete ? '' : '<span class="verse-search-loading">searching...</span>'}
  </div>`;
  
  html += '<div class="verse-search-list">';
  
  for (const result of state.results) {
    const escapedRef = result.ref.replace(/'/g, "\\'");
    const abbrevRef = abbreviateRef(result.ref);
    const highlightedText = highlightMatchingWords(result.text, result.matchingWords);
    
    html += `<div class="verse-search-item" onclick="goToVerseFromSearch('${escapedRef}')">
      <span class="verse-search-ref">${abbrevRef}</span> ${highlightedText}
    </div>`;
  }
  
  html += '</div>';
  
  if (!state.isComplete) {
    html += '<div class="verse-search-more" id="verse-search-sentinel"></div>';
  }
  
  container.innerHTML = html;
  
  // Set up intersection observer for infinite scroll
  if (!state.isComplete) {
    const sentinel = document.getElementById('verse-search-sentinel');
    if (sentinel) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !state.isSearching && !state.isComplete) {
          findNextBatch();
        }
      }, { threshold: 0.1 });
      observer.observe(sentinel);
    }
  }
}

// Book name abbreviations
const BOOK_ABBREVIATIONS = {
  'Genesis': 'Gen', 'Exodus': 'Exod', 'Leviticus': 'Lev', 'Numbers': 'Num',
  'Deuteronomy': 'Deut', 'Joshua': 'Josh', 'Judges': 'Judg', 'Ruth': 'Ruth',
  '1 Samuel': '1 Sam', '2 Samuel': '2 Sam', '1 Kings': '1 Kgs', '2 Kings': '2 Kgs',
  '1 Chronicles': '1 Chr', '2 Chronicles': '2 Chr', 'Ezra': 'Ezra', 'Nehemiah': 'Neh',
  'Esther': 'Esth', 'Job': 'Job', 'Psalms': 'Ps', 'Proverbs': 'Prov',
  'Ecclesiastes': 'Eccl', 'Song of Solomon': 'Song', 'Isaiah': 'Isa', 'Jeremiah': 'Jer',
  'Lamentations': 'Lam', 'Ezekiel': 'Ezek', 'Daniel': 'Dan', 'Hosea': 'Hos',
  'Joel': 'Joel', 'Amos': 'Amos', 'Obadiah': 'Obad', 'Jonah': 'Jonah',
  'Micah': 'Mic', 'Nahum': 'Nah', 'Habakkuk': 'Hab', 'Zephaniah': 'Zeph',
  'Haggai': 'Hag', 'Zechariah': 'Zech', 'Malachi': 'Mal'
};

// Get abbreviated reference
function abbreviateRef(ref) {
  const match = ref.match(/^(.+)\s+(\d+:\d+)$/);
  if (!match) return ref;
  const abbrev = BOOK_ABBREVIATIONS[match[1]] || match[1];
  return `${abbrev} ${match[2]}`;
}

// Navigate to a verse from search results
function goToVerseFromSearch(ref) {
  // Parse reference like "Genesis 1:5"
  const match = ref.match(/^(.+)\s+(\d+):(\d+)$/);
  if (!match) return;
  
  const book = match[1];
  const chapter = parseInt(match[2]);
  const verse = parseInt(match[3]);
  
  // Close the Strong's panel
  closeStrongsPanel();
  
  // Navigate to the verse with highlighting
  openBibleExplorerTo(book, chapter, verse);
}

// Toggle verse search visibility
function toggleVerseSearch(strongsNum) {
  const container = document.getElementById('strongs-verse-results');
  const btn = document.getElementById('strongs-find-verses-btn');
  
  if (container.style.display === 'none' || !container.innerHTML) {
    container.style.display = 'block';
    btn.textContent = 'Hide verses';
    searchVersesWithStrongs(strongsNum);
  } else {
    container.style.display = 'none';
    btn.textContent = 'Find all verses →';
  }
}

// ============================================================================
// CONCEPT SEARCH - Find verses by English word, following Strong's numbers
// ============================================================================

// State for concept search
let conceptSearchState = {
  searchWord: null,
  strongsNumbers: [],  // All Strong's numbers found for the word
  currentStrongsIndex: 0,
  allResults: [],
  isSearching: false,
  isComplete: false
};

// Find all Strong's numbers that match an English word
function findStrongsForWord(word) {
  const normalizedWord = word.toLowerCase().trim();
  const strongsMatches = new Map(); // strongsNum -> { count, exactGlossMatch, fromGloss }
  const wordPattern = new RegExp(`\\b${normalizedWord}\\b`, 'i');
  
  // Helper to process interlinear data
  function processInterlinear(data) {
    for (const ref in data) {
      const verse = data[ref];
      if (verse.e) {
        for (const entry of verse.e) {
          if (!entry.s) continue;
          
          const eng = (entry.e || '').toLowerCase();
          const gloss = (entry.g || '').toLowerCase().trim();
          
          if (wordPattern.test(eng) || wordPattern.test(gloss)) {
            if (!strongsMatches.has(entry.s)) {
              strongsMatches.set(entry.s, { count: 0, exactGlossMatch: false, fromGloss: false });
            }
            const match = strongsMatches.get(entry.s);
            match.count++;
            
            if (wordPattern.test(gloss)) {
              match.fromGloss = true;
            }
            
            // Check for EXACT gloss match (gloss is exactly the search word)
            if (gloss === normalizedWord || gloss === normalizedWord + 's') {
              match.exactGlossMatch = true;
            }
          }
        }
      }
    }
  }
  
  // Search both testaments
  if (interlinearData) processInterlinear(interlinearData);
  if (ntInterlinearData) processInterlinear(ntInterlinearData);
  
  // Filter and score results
  const filteredResults = [];
  for (const [strongsNum, data] of strongsMatches) {
    const entry = getStrongsEntry(strongsNum);
    const def = entry ? (entry.strongs_def || '').toLowerCase() : '';
    const kjvDef = entry ? (entry.kjv_def || '').toLowerCase() : '';
    
    // Check if word appears in dictionary definition
    const defMatches = wordPattern.test(def);
    
    // Check for exact match in definition (word is THE primary meaning)
    const exactDefMatch = def.startsWith(normalizedWord + ',') || 
                          def.startsWith(normalizedWord + '.') ||
                          def.startsWith(normalizedWord + ';') ||
                          def.startsWith(normalizedWord + ' ') ||
                          def === normalizedWord ||
                          kjvDef.startsWith(normalizedWord);
    
    // Include if: gloss matches, OR definition contains the word, OR appears frequently (5+ times)
    if (data.fromGloss || defMatches || data.count >= 5) {
      // Calculate relevance score (higher = more relevant)
      let score = 0;
      if (data.exactGlossMatch) score += 1000;  // Exact gloss match in interlinear
      if (exactDefMatch) score += 500;           // Word is primary meaning in dictionary
      if (defMatches) score += 100;              // Word appears in definition
      if (data.fromGloss) score += 50;           // Word appears in some gloss
      score += Math.min(data.count, 100);        // Frequency (capped)
      
      filteredResults.push({
        strongsNum,
        count: data.count,
        score
      });
    }
  }
  
  // Sort by score (highest first)
  filteredResults.sort((a, b) => b.score - a.score);
  
  // Store the scored results for UI display
  conceptSearchState.scoredStrongs = filteredResults;
  
  return filteredResults.map(r => r.strongsNum);
}

// Get definition summary for a Strong's number
function getStrongsSummary(strongsNum) {
  const entry = getStrongsEntry(strongsNum);
  if (!entry) return strongsNum;
  
  const lemma = entry.lemma || '';
  const def = entry.strongs_def || entry.kjv_def || '';
  const shortDef = def.length > 50 ? def.substring(0, 50) + '...' : def;
  
  return `${strongsNum} ${lemma} - ${shortDef}`;
}

// Start a concept search
function startConceptSearch(word) {
  if (!word || word.trim().length < 2) {
    alert('Please enter a word with at least 2 characters');
    return;
  }
  
  const searchWord = word.trim().toLowerCase();
  
  // Show results container
  const resultsContainer = document.getElementById('concept-search-results');
  const divider = document.getElementById('search-divider');
  if (resultsContainer) {
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = '<div class="concept-search-loading">Searching for Strong\'s numbers...</div>';
  }
  if (divider) {
    divider.style.display = 'flex';
    initSearchDivider();
  }
  
  // Find all Strong's numbers (this may take a moment)
  setTimeout(() => {
    const strongsNumbers = findStrongsForWord(searchWord);
    
    if (strongsNumbers.length === 0) {
      if (resultsContainer) {
        resultsContainer.innerHTML = `<div class="concept-search-empty">No Strong's numbers found for "${word}"</div>`;
      }
      return;
    }
    
    // Initialize search state
    conceptSearchState = {
      searchWord: searchWord,
      strongsNumbers: strongsNumbers,
      currentStrongsIndex: 0,
      allResults: [],
      isSearching: false,
      isComplete: false
    };
    
    // Display Strong's numbers found
    displayConceptSearchResults();
    
  }, 10);
}

// Display concept search results - text matches first, then Strong's expansion
function displayConceptSearchResults() {
  const resultsContainer = document.getElementById('concept-search-results');
  if (!resultsContainer) return;
  
  const state = conceptSearchState;
  const searchWord = state.searchWord;
  
  let html = `<div class="concept-search-header">
    <strong>Search: "${searchWord}"</strong>
    <button class="concept-search-close" onclick="closeConceptSearch()">✕</button>
  </div>`;
  
  html += '<div id="concept-verse-results" class="concept-verse-results"><div class="concept-search-loading">Searching...</div></div>';
  
  // Strong's expansion section (collapsed by default)
  if (state.strongsNumbers.length > 0) {
    const scoredList = state.scoredStrongs || state.strongsNumbers.map(s => ({ strongsNum: s, score: 0 }));
    const checkedCount = Math.min(7, scoredList.length);
    
    html += `<details class="concept-strongs-section">
      <summary class="concept-strongs-summary">
        <span class="concept-expand-icon">▶</span>
        Expand by concept: ${state.strongsNumbers.length} Hebrew/Greek word(s) found
      </summary>
      <div class="concept-strongs-controls">
        <label class="concept-select-all">
          <input type="checkbox" onchange="toggleAllConceptStrongs(this.checked)" ${checkedCount === scoredList.length ? 'checked' : ''}> 
          Select all
        </label>
      </div>
      <div class="concept-strongs-list">`;
    
    scoredList.forEach((item, index) => {
      const sn = item.strongsNum;
      const entry = getStrongsEntry(sn);
      const lemma = entry?.lemma || '';
      const def = entry?.strongs_def || entry?.kjv_def || '';
      const shortDef = def.length > 50 ? def.substring(0, 50) + '...' : def;
      const isChecked = index < checkedCount;
      
      html += `<div class="concept-strongs-item">
        <label class="concept-strongs-checkbox">
          <input type="checkbox" value="${sn}" class="concept-strongs-cb" ${isChecked ? 'checked' : ''} onchange="updateConceptSelection()">
        </label>
        <span class="concept-strongs-num" onclick="showStrongsPanel('${sn}', '', '', event)">${sn}</span>
        <span class="concept-strongs-lemma">${lemma}</span>
        <span class="concept-strongs-def">${shortDef}</span>
      </div>`;
    });
    
    html += `</div>
      <button class="concept-find-all-btn" onclick="expandConceptSearch()">
        Include selected concepts in results →
      </button>
    </details>`;
  }
  
  resultsContainer.innerHTML = html;
  
  // Now run the text-based search immediately
  findTextMatchVerses();
}

// Find verses by plain text search only (primary results)
function findTextMatchVerses() {
  const state = conceptSearchState;
  const verseResultsContainer = document.getElementById('concept-verse-results');
  if (!verseResultsContainer) return;
  
  const searchWord = state.searchWord;
  if (!searchWord) return;
  
  const wordPattern = new RegExp(`\\b${searchWord}\\b`, 'i');
  
  setTimeout(() => {
    const allVerses = new Map();
    
    // Search all loaded translations
    for (const transId in bibleTranslations) {
      const transData = bibleTranslations[transId];
      if (transData && transData.length > 0) {
        for (const verse of transData) {
          if (verse.text && wordPattern.test(verse.text)) {
            const ref = `${verse.book} ${verse.chapter}:${verse.verse}`;
            if (!allVerses.has(ref)) {
              allVerses.set(ref, { words: [searchWord] });
            }
          }
        }
      }
    }
    
    // Convert to sorted array
    const results = Array.from(allVerses.entries())
      .map(([ref, data]) => ({
        ref,
        strongsNums: [],
        words: data.words,
        text: getVerseText(ref) || '',
        fromText: true
      }))
      .sort((a, b) => compareVerseRefs(a.ref, b.ref));
    
    state.allResults = results;
    state.textOnlyCount = results.length;
    displayConceptVerseResults(results, 0, 50);
    
  }, 10);
}

// Toggle all concept Strong's checkboxes
function toggleAllConceptStrongs(checked) {
  document.querySelectorAll('.concept-strongs-cb').forEach(cb => {
    cb.checked = checked;
  });
  updateConceptSelection();
}

// Update selection count (called when checkboxes change)
function updateConceptSelection() {
  const checkboxes = document.querySelectorAll('.concept-strongs-cb');
  const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
  const btn = document.querySelector('.concept-find-all-btn');
  if (btn) {
    btn.textContent = `Include ${checkedCount} selected concept(s) in results →`;
  }
  // Update "select all" checkbox state
  const selectAll = document.querySelector('.concept-select-all input');
  if (selectAll) {
    selectAll.checked = checkedCount === checkboxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
  }
}

// Get currently selected Strong's numbers from checkboxes
function getSelectedConceptStrongs() {
  const checkboxes = document.querySelectorAll('.concept-strongs-cb:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

// Expand search to include selected Strong's concept matches
function expandConceptSearch() {
  const state = conceptSearchState;
  const verseResultsContainer = document.getElementById('concept-verse-results');
  if (!verseResultsContainer) return;
  
  // Get selected Strong's numbers from checkboxes
  const selectedStrongs = getSelectedConceptStrongs();
  if (selectedStrongs.length === 0) {
    alert('Please select at least one concept to include');
    return;
  }
  
  verseResultsContainer.innerHTML = '<div class="concept-search-loading">Expanding search by concept...</div>';
  
  setTimeout(() => {
    const allVerses = new Map();
    const searchWord = state.searchWord;
    const wordPattern = searchWord ? new RegExp(`\\b${searchWord}\\b`, 'i') : null;
    
    // First, add all text matches (these are primary)
    if (wordPattern) {
      for (const transId in bibleTranslations) {
        const transData = bibleTranslations[transId];
        if (transData && transData.length > 0) {
          for (const verse of transData) {
            if (verse.text && wordPattern.test(verse.text)) {
              const ref = `${verse.book} ${verse.chapter}:${verse.verse}`;
              if (!allVerses.has(ref)) {
                allVerses.set(ref, { strongsNums: new Set(), words: [searchWord], fromText: true, fromConcept: false });
              }
            }
          }
        }
      }
    }
    
    // Then add Strong's concept matches (only for selected Strong's)
    if (selectedStrongs.length > 0) {
      // Search OT interlinear
      if (interlinearData) {
        for (const ref in interlinearData) {
          const verse = interlinearData[ref];
          if (verse.e) {
            for (const entry of verse.e) {
              if (entry.s && selectedStrongs.includes(entry.s)) {
                if (!allVerses.has(ref)) {
                  allVerses.set(ref, { strongsNums: new Set(), words: [], fromText: false, fromConcept: true });
                }
                allVerses.get(ref).strongsNums.add(entry.s);
                allVerses.get(ref).words.push(entry.e || entry.g || '');
                allVerses.get(ref).fromConcept = true;
              }
            }
          }
        }
      }
      
      // Search NT interlinear
      if (ntInterlinearData) {
        for (const ref in ntInterlinearData) {
          const verse = ntInterlinearData[ref];
          if (verse.e) {
            for (const entry of verse.e) {
              if (entry.s && selectedStrongs.includes(entry.s)) {
                if (!allVerses.has(ref)) {
                  allVerses.set(ref, { strongsNums: new Set(), words: [], fromText: false, fromConcept: true });
                }
                allVerses.get(ref).strongsNums.add(entry.s);
                allVerses.get(ref).words.push(entry.e || entry.g || '');
                allVerses.get(ref).fromConcept = true;
              }
            }
          }
        }
      }
    }
    
    // Convert to sorted array
    const results = Array.from(allVerses.entries())
      .map(([ref, data]) => ({
        ref,
        strongsNums: Array.from(data.strongsNums),
        words: data.words,
        text: getVerseText(ref) || '',
        fromText: data.fromText,
        fromConcept: data.fromConcept
      }))
      .sort((a, b) => compareVerseRefs(a.ref, b.ref));
    
    state.allResults = results;
    state.expanded = true;
    
    // Count concept-only additions
    const conceptOnlyCount = results.filter(r => r.fromConcept && !r.fromText).length;
    displayConceptVerseResults(results, 0, 50, conceptOnlyCount);
    
  }, 10);
}

// Legacy function
function findAllConceptVerses() {
  expandConceptSearch();
}

// Compare verse references for sorting
function compareVerseRefs(refA, refB) {
  const booksOrder = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
    '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther',
    'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
    'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
    'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
    '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians',
    '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
    'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'
  ];
  
  const parseRef = (ref) => {
    const match = ref.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (match) {
      return {
        book: match[1],
        chapter: parseInt(match[2]),
        verse: parseInt(match[3])
      };
    }
    return { book: ref, chapter: 0, verse: 0 };
  };
  
  const a = parseRef(refA);
  const b = parseRef(refB);
  
  const bookIndexA = booksOrder.indexOf(a.book);
  const bookIndexB = booksOrder.indexOf(b.book);
  
  if (bookIndexA !== bookIndexB) return bookIndexA - bookIndexB;
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  return a.verse - b.verse;
}

// Display verse results with pagination
function displayConceptVerseResults(results, startIndex, count, conceptOnlyCount = 0) {
  const container = document.getElementById('concept-verse-results');
  if (!container) return;
  
  const endIndex = Math.min(startIndex + count, results.length);
  const showing = results.slice(startIndex, endIndex);
  
  let countText = `Found ${results.length} verses`;
  if (conceptOnlyCount > 0) {
    countText += ` <span class="concept-only-note">(+${conceptOnlyCount} from concept expansion)</span>`;
  }
  let html = `<div class="concept-verse-count">${countText}</div>`;
  
  const searchWord = conceptSearchState.searchWord || '';
  
  for (const result of showing) {
    const abbrevRef = abbreviateReference(result.ref);
    const highlightedText = highlightConceptWords(result.text, result.words, searchWord);
    
    const strongsDisplay = result.strongsNums.length > 0 
      ? result.strongsNums.join(', ')
      : '';
    
    // Determine CSS class based on match type
    let itemClass = 'concept-verse-item';
    if (result.fromConcept && !result.fromText) {
      itemClass += ' from-concept-only';
    }
    
    html += `<div class="${itemClass}">
      <a href="#" class="concept-verse-ref" onclick="goToScriptureFromSidebar('${result.ref}'); return false;">${abbrevRef}</a>
      <span class="concept-verse-text">${highlightedText}</span>
      ${strongsDisplay ? `<span class="concept-verse-strongs">${strongsDisplay}</span>` : ''}
    </div>`;
  }
  
  if (endIndex < results.length) {
    html += `<div class="concept-load-more-sentinel" data-next-index="${endIndex}"></div>`;
    html += `<button class="concept-load-more-btn" onclick="loadMoreConceptVerses(${endIndex})">
      Load more (${results.length - endIndex} remaining)
    </button>`;
  }
  
  container.innerHTML = html;
  
  // Set up infinite scroll observer
  const sentinel = container.querySelector('.concept-load-more-sentinel');
  if (sentinel) {
    setupConceptScrollObserver(sentinel, endIndex);
  }
}

// Observer for infinite scroll
let conceptScrollObserver = null;

function setupConceptScrollObserver(sentinel, nextIndex) {
  // Clean up previous observer
  if (conceptScrollObserver) {
    conceptScrollObserver.disconnect();
  }
  
  conceptScrollObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        loadMoreConceptVerses(nextIndex);
      }
    }
  }, {
    root: document.getElementById('concept-search-results'),
    rootMargin: '100px',
    threshold: 0
  });
  
  conceptScrollObserver.observe(sentinel);
}

function loadMoreConceptVerses(startIndex) {
  // Disconnect observer to prevent double-loading
  if (conceptScrollObserver) {
    conceptScrollObserver.disconnect();
  }
  
  const results = conceptSearchState.allResults;
  if (!results || startIndex >= results.length) return;
  
  const container = document.getElementById('concept-verse-results');
  if (!container) return;
  
  // Remove the sentinel and load more button
  const sentinel = container.querySelector('.concept-load-more-sentinel');
  const loadMoreBtn = container.querySelector('.concept-load-more-btn');
  if (sentinel) sentinel.remove();
  if (loadMoreBtn) loadMoreBtn.remove();
  
  // Append new results
  const endIndex = Math.min(startIndex + 50, results.length);
  const showing = results.slice(startIndex, endIndex);
  const searchWord = conceptSearchState.searchWord || '';
  
  let html = '';
  for (const result of showing) {
    const abbrevRef = abbreviateReference(result.ref);
    const highlightedText = highlightConceptWords(result.text, result.words, searchWord);
    const strongsDisplay = result.strongsNums.length > 0 
      ? result.strongsNums.join(', ')
      : '';
    
    // Determine CSS class based on match type
    let itemClass = 'concept-verse-item';
    if (result.fromConcept && !result.fromText) {
      itemClass += ' from-concept-only';
    }
    
    html += `<div class="${itemClass}">
      <a href="#" class="concept-verse-ref" onclick="goToScriptureFromSidebar('${result.ref}'); return false;">${abbrevRef}</a>
      <span class="concept-verse-text">${highlightedText}</span>
      ${strongsDisplay ? `<span class="concept-verse-strongs">${strongsDisplay}</span>` : ''}
    </div>`;
  }
  
  if (endIndex < results.length) {
    html += `<div class="concept-load-more-sentinel" data-next-index="${endIndex}"></div>`;
    html += `<button class="concept-load-more-btn" onclick="loadMoreConceptVerses(${endIndex})">
      Load more (${results.length - endIndex} remaining)
    </button>`;
  }
  
  container.insertAdjacentHTML('beforeend', html);
  
  // Set up new observer for the new sentinel
  const newSentinel = container.querySelector('.concept-load-more-sentinel');
  if (newSentinel) {
    setupConceptScrollObserver(newSentinel, endIndex);
  }
}

// Highlight matching words in verse text - only highlight the search word, not common words
function highlightConceptWords(text, words, searchWord) {
  if (!text) return text;
  
  // Common words to never highlight
  const skipWords = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'for', 'with', 'by', 'from', 'on', 'at', 'is', 'be', 'it', 'that', 'which', 'as', 'was', 'were', 'are', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'shall', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'these', 'those', 'there', 'their', 'them', 'they', 'he', 'she', 'his', 'her', 'him', 'who', 'whom', 'whose', 'what', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'but', 'if', 'then', 'because', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'once', 'here', 'there', 'where', 'when', 'why', 'how', 'any', 'each', 'few', 'many', 'most', 'other', 'some', 'up', 'out', 'about', 'over', 'upon', 'unto']);
  
  let result = text;
  
  // First, highlight the actual search word if provided
  if (searchWord && searchWord.length > 1) {
    const searchRegex = new RegExp(`\\b(${searchWord})\\b`, 'gi');
    result = result.replace(searchRegex, '<mark>$1</mark>');
  }
  
  // Then highlight content words from the matching phrases (skip common words)
  if (words && words.length > 0) {
    for (const word of words) {
      if (word && word.trim()) {
        const wordParts = word.trim().split(/\s+/);
        for (const part of wordParts) {
          const cleanPart = part.replace(/[.,;:!?'"()]/g, '').toLowerCase();
          // Only highlight if it's not a common word and is at least 3 chars
          if (cleanPart.length >= 3 && !skipWords.has(cleanPart)) {
            const regex = new RegExp(`\\b(${cleanPart})\\b`, 'gi');
            result = result.replace(regex, '<mark>$1</mark>');
          }
        }
      }
    }
  }
  
  return result;
}

// Close concept search results
function closeConceptSearch() {
  const resultsContainer = document.getElementById('concept-search-results');
  const divider = document.getElementById('search-divider');
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
    resultsContainer.innerHTML = '';
  }
  if (divider) {
    divider.style.display = 'none';
  }
  conceptSearchState = {
    searchWord: null,
    strongsNumbers: [],
    currentStrongsIndex: 0,
    allResults: [],
    isSearching: false,
    isComplete: false
  };
}

// Initialize the draggable search divider
let searchDividerInitialized = false;

function initSearchDivider() {
  if (searchDividerInitialized) return;
  
  const divider = document.getElementById('search-divider');
  const searchResults = document.getElementById('concept-search-results');
  
  if (!divider || !searchResults) return;
  
  let isDragging = false;
  let startY = 0;
  let startHeight = 0;
  
  divider.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY = e.clientY;
    startHeight = searchResults.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaY = e.clientY - startY;
    const newHeight = startHeight + deltaY;
    
    // Constrain height between 100px and 80% of viewport
    const minHeight = 100;
    const maxHeight = window.innerHeight * 0.8;
    const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
    
    searchResults.style.height = constrainedHeight + 'px';
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
  
  // Touch support for mobile
  divider.addEventListener('touchstart', (e) => {
    isDragging = true;
    startY = e.touches[0].clientY;
    startHeight = searchResults.offsetHeight;
    e.preventDefault();
  });
  
  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    
    const deltaY = e.touches[0].clientY - startY;
    const newHeight = startHeight + deltaY;
    
    const minHeight = 100;
    const maxHeight = window.innerHeight * 0.8;
    const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
    
    searchResults.style.height = constrainedHeight + 'px';
  });
  
  document.addEventListener('touchend', () => {
    isDragging = false;
  });
  
  searchDividerInitialized = true;
}

// Abbreviate a verse reference
function abbreviateReference(ref) {
  const abbrevs = {
    'Genesis': 'Gen', 'Exodus': 'Exo', 'Leviticus': 'Lev', 'Numbers': 'Num', 'Deuteronomy': 'Deu',
    'Joshua': 'Jos', 'Judges': 'Jdg', 'Ruth': 'Rut', '1 Samuel': '1Sa', '2 Samuel': '2Sa',
    '1 Kings': '1Ki', '2 Kings': '2Ki', '1 Chronicles': '1Ch', '2 Chronicles': '2Ch',
    'Ezra': 'Ezr', 'Nehemiah': 'Neh', 'Esther': 'Est', 'Job': 'Job', 'Psalms': 'Psa',
    'Proverbs': 'Pro', 'Ecclesiastes': 'Ecc', 'Song of Solomon': 'Son', 'Isaiah': 'Isa',
    'Jeremiah': 'Jer', 'Lamentations': 'Lam', 'Ezekiel': 'Eze', 'Daniel': 'Dan',
    'Hosea': 'Hos', 'Joel': 'Joe', 'Amos': 'Amo', 'Obadiah': 'Oba', 'Jonah': 'Jon',
    'Micah': 'Mic', 'Nahum': 'Nah', 'Habakkuk': 'Hab', 'Zephaniah': 'Zep', 'Haggai': 'Hag',
    'Zechariah': 'Zec', 'Malachi': 'Mal', 'Matthew': 'Mat', 'Mark': 'Mar', 'Luke': 'Luk',
    'John': 'Joh', 'Acts': 'Act', 'Romans': 'Rom', '1 Corinthians': '1Co', '2 Corinthians': '2Co',
    'Galatians': 'Gal', 'Ephesians': 'Eph', 'Philippians': 'Php', 'Colossians': 'Col',
    '1 Thessalonians': '1Th', '2 Thessalonians': '2Th', '1 Timothy': '1Ti', '2 Timothy': '2Ti',
    'Titus': 'Tit', 'Philemon': 'Phm', 'Hebrews': 'Heb', 'James': 'Jam', '1 Peter': '1Pe',
    '2 Peter': '2Pe', '1 John': '1Jo', '2 John': '2Jo', '3 John': '3Jo', 'Jude': 'Jud', 'Revelation': 'Rev'
  };
  
  for (const [full, abbr] of Object.entries(abbrevs)) {
    if (ref.startsWith(full + ' ')) {
      return ref.replace(full + ' ', abbr + ' ');
    }
  }
  return ref;
}

// ============================================================================
// STRONG'S SLIDE-OUT PANEL
// ============================================================================

// Navigation history for Strong's panel
let strongsHistory = [];
let strongsHistoryIndex = -1;

// Linkify Strong's references in text (H#### or G####)
function linkifyStrongsRefs(text) {
  if (!text) return '';
  // Match H#### or G#### patterns, including those in parentheses like H1 (אָב)
  return text.replace(/\b([HG])(\d+)\b(\s*\([^)]+\))?/g, (match, prefix, num, parens) => {
    const strongsNum = `${prefix}${num}`;
    const display = parens ? `${strongsNum}${parens}` : strongsNum;
    return `<a href="#" class="strongs-link" onclick="navigateToStrongs('${strongsNum}', event)">${display}</a>`;
  });
}

// Expand Strong's references in derivation with their definitions inline
function expandDerivation(text) {
  if (!text) return '';
  
  // Match patterns like "the same as H8558" or "from H1234" or "of Hebrew origin (H085)"
  return text.replace(/\b([HG])(\d+)\b(\s*\([^)]+\))?/g, (match, prefix, num, parens) => {
    const strongsNum = `${prefix}${num}`;
    const entry = getStrongsEntry(strongsNum);
    
    if (entry) {
      // Get a brief definition
      const def = entry.strongs_def || entry.kjv_def || '';
      const lemma = entry.lemma || '';
      const briefDef = def.length > 100 ? def.substring(0, 100) + '...' : def;
      
      // Show: "H1234 (אָב) = father"
      const lemmaDisplay = lemma ? ` (${lemma})` : '';
      const defDisplay = briefDef ? ` = ${briefDef}` : '';
      
      return `<a href="#" class="strongs-link" onclick="navigateToStrongs('${strongsNum}', event)">${strongsNum}${lemmaDisplay}</a>${defDisplay}`;
    }
    
    // Fallback to just linking
    const display = parens ? `${strongsNum}${parens}` : strongsNum;
    return `<a href="#" class="strongs-link" onclick="navigateToStrongs('${strongsNum}', event)">${display}</a>`;
  });
}

// Navigate to a Strong's entry (from link click)
function navigateToStrongs(strongsNum, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  // Add to history (truncate forward history if we're not at the end)
  if (strongsHistoryIndex < strongsHistory.length - 1) {
    strongsHistory = strongsHistory.slice(0, strongsHistoryIndex + 1);
  }
  strongsHistory.push(strongsNum);
  strongsHistoryIndex = strongsHistory.length - 1;
  
  updateStrongsPanelContent(strongsNum);
}

// Go back in Strong's history
function strongsGoBack() {
  if (strongsHistoryIndex > 0) {
    strongsHistoryIndex--;
    updateStrongsPanelContent(strongsHistory[strongsHistoryIndex], true);
  }
}

// Go forward in Strong's history
function strongsGoForward() {
  if (strongsHistoryIndex < strongsHistory.length - 1) {
    strongsHistoryIndex++;
    updateStrongsPanelContent(strongsHistory[strongsHistoryIndex], true);
  }
}

// Update Strong's panel content (without adding to history)
function updateStrongsPanelContent(strongsNum, isNavigation = false) {
  const sidebar = document.getElementById('strongs-sidebar');
  if (!sidebar) return;
  
  const entry = getStrongsEntry(strongsNum);
  
  // Update navigation buttons
  const backBtn = sidebar.querySelector('.strongs-nav-back');
  const fwdBtn = sidebar.querySelector('.strongs-nav-forward');
  if (backBtn) backBtn.disabled = strongsHistoryIndex <= 0;
  if (fwdBtn) fwdBtn.disabled = strongsHistoryIndex >= strongsHistory.length - 1;
  
  // Update title
  const titleEl = sidebar.querySelector('.strongs-sidebar-title');
  if (titleEl) titleEl.textContent = strongsNum;
  
  // Update content
  const contentEl = sidebar.querySelector('.strongs-sidebar-content');
  if (!contentEl) return;
  
  let html = '';
  
  if (entry) {
    html += `
      <div class="strongs-lemma">${entry.lemma || ''}</div>
      <div class="strongs-transliteration">${entry.xlit || ''} <span class="strongs-pronunciation">(${entry.pron || ''})</span></div>
      <div class="strongs-definition">${linkifyStrongsRefs(entry.strongs_def || '')}</div>
      ${entry.kjv_def ? `<div class="strongs-kjv-usage"><strong>KJV:</strong> ${linkifyStrongsRefs(entry.kjv_def)}</div>` : ''}
      ${entry.derivation ? `<div class="strongs-derivation"><strong>Derivation:</strong> ${expandDerivation(entry.derivation)}</div>` : ''}
    `;
  } else {
    html += `<div class="strongs-gloss">No definition available for ${strongsNum}</div>`;
  }
  
  // Add person/place info if available
  const allPersonInfo = getAllPersonInfo(strongsNum);
  if (allPersonInfo.length > 0) {
    html += renderPersonInfoHtml(allPersonInfo);
  }
  
  // Add verse search section
  html += `
    <div class="strongs-verse-search">
      <button id="strongs-find-verses-btn" class="strongs-find-verses-btn" onclick="toggleVerseSearch('${strongsNum}')">Find all verses →</button>
      <div id="strongs-verse-results" class="strongs-verse-results" style="display: none;"></div>
    </div>
  `;
  
  contentEl.innerHTML = html;
}

// Show Strong's information slide-out for a word
function showStrongsPanel(strongsNum, englishWord, gloss, event) {
  if (event) event.stopPropagation();
  
  // Use the sidebar element from HTML
  const sidebar = document.getElementById('strongs-sidebar');
  if (!sidebar) return;
  
  const isNewPanel = !sidebar.classList.contains('open');
  
  if (isNewPanel) {
    // Reset history for new panel
    strongsHistory = [strongsNum];
    strongsHistoryIndex = 0;
    
    // Build sidebar content
    sidebar.innerHTML = `
      <div class="strongs-sidebar-resize" onmousedown="startStrongsResize(event)"></div>
      <div class="strongs-sidebar-header">
        <div class="strongs-nav-buttons">
          <button class="strongs-nav-back" onclick="strongsGoBack()" disabled title="Back">◀</button>
          <button class="strongs-nav-forward" onclick="strongsGoForward()" disabled title="Forward">▶</button>
        </div>
        <div class="strongs-sidebar-title">${strongsNum}</div>
        <button class="strongs-sidebar-close" onclick="closeStrongsPanel()">✕</button>
      </div>
      <div class="strongs-sidebar-content"></div>
    `;
    
    // Animate open
    requestAnimationFrame(() => {
      sidebar.classList.add('open');
    });
  } else {
    // Sidebar already open, add to history
    if (strongsHistoryIndex < strongsHistory.length - 1) {
      strongsHistory = strongsHistory.slice(0, strongsHistoryIndex + 1);
    }
    strongsHistory.push(strongsNum);
    strongsHistoryIndex = strongsHistory.length - 1;
  }
  
  // Update content
  const entry = getStrongsEntry(strongsNum);
  const personInfo = getPersonInfo(strongsNum);
  
  // Update title
  const titleEl = sidebar.querySelector('.strongs-sidebar-title');
  if (titleEl) titleEl.textContent = strongsNum;
  
  const contentEl = sidebar.querySelector('.strongs-sidebar-content');
  let html = '';
  
  if (englishWord) {
    html += `<div class="strongs-word-english">"${englishWord}"</div>`;
  }
  
  if (entry) {
    html += `
      <div class="strongs-lemma">${entry.lemma || ''}</div>
      <div class="strongs-transliteration">${entry.xlit || ''} <span class="strongs-pronunciation">(${entry.pron || ''})</span></div>
      <div class="strongs-definition">${linkifyStrongsRefs(entry.strongs_def || '')}</div>
      ${entry.kjv_def ? `<div class="strongs-kjv-usage"><strong>KJV:</strong> ${linkifyStrongsRefs(entry.kjv_def)}</div>` : ''}
      ${entry.derivation ? `<div class="strongs-derivation"><strong>Derivation:</strong> ${expandDerivation(entry.derivation)}</div>` : ''}
    `;
  } else {
    html += `<div class="strongs-gloss">${gloss || 'No definition available'}</div>`;
  }
  
  // Add person/place info if available (show all matching entries)
  const allPersonInfo = getAllPersonInfo(strongsNum);
  if (allPersonInfo.length > 0) {
    html += renderPersonInfoHtml(allPersonInfo);
  }
  
  // Add symbolic meaning if available for this Strong's number
  const symbol = (typeof lookupSymbolByStrongs === 'function') ? lookupSymbolByStrongs(strongsNum) : null;
  if (symbol) {
    html += `
      <div class="strongs-symbol-info">
        <div class="strongs-symbol-header">
          <span class="strongs-symbol-icon">📖</span>
          <span class="strongs-symbol-title">Symbolic Meaning</span>
        </div>
        <div class="strongs-symbol-meaning">
          <span class="strongs-symbol-label">IS:</span>
          <span class="strongs-symbol-value">${symbol.is}${symbol.is2 ? ' / ' + symbol.is2 : ''}</span>
        </div>
        ${symbol.does ? `
        <div class="strongs-symbol-meaning">
          <span class="strongs-symbol-label">DOES:</span>
          <span class="strongs-symbol-value">${symbol.does}${symbol.does2 ? ' / ' + symbol.does2 : ''}</span>
        </div>
        ` : ''}
        <div class="strongs-symbol-sentence">${symbol.sentence}</div>
        <a href="${symbol.link}" class="strongs-symbol-link">Full Word Study →</a>
      </div>
    `;
  }
  
  // Add verse search section
  html += `
    <div class="strongs-verse-search">
      <button id="strongs-find-verses-btn" class="strongs-find-verses-btn" onclick="toggleVerseSearch('${strongsNum}')">Find all verses →</button>
      <div id="strongs-verse-results" class="strongs-verse-results" style="display: none;"></div>
    </div>
  `;
  
  contentEl.innerHTML = html;
  
  // Reset verse search state for new Strong's number
  if (verseSearchState.strongsNum !== strongsNum) {
    verseSearchState = {
      strongsNum: null,
      verseRefs: null,
      currentIndex: 0,
      results: [],
      isSearching: false,
      isComplete: false,
      batchSize: 20
    };
  }
  
  // Update nav buttons
  const backBtn = sidebar.querySelector('.strongs-nav-back');
  const fwdBtn = sidebar.querySelector('.strongs-nav-forward');
  if (backBtn) backBtn.disabled = strongsHistoryIndex <= 0;
  if (fwdBtn) fwdBtn.disabled = strongsHistoryIndex >= strongsHistory.length - 1;
}

// Close Strong's sidebar
function closeStrongsPanel() {
  const sidebar = document.getElementById('strongs-sidebar');
  if (sidebar) {
    sidebar.classList.remove('open', 'collapsed');
    sidebar.innerHTML = '';
  }
  // Reset history
  strongsHistory = [];
  strongsHistoryIndex = -1;
}

// Resize functionality for Strong's sidebar
let isResizing = false;

function startStrongsResize(event) {
  event.preventDefault();
  isResizing = true;
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';
  
  document.addEventListener('mousemove', doStrongsResize);
  document.addEventListener('mouseup', stopStrongsResize);
}

function doStrongsResize(event) {
  if (!isResizing) return;
  
  const sidebar = document.getElementById('strongs-sidebar');
  if (!sidebar) return;
  
  // Calculate new width from right edge of content wrapper
  const wrapper = sidebar.parentElement;
  if (!wrapper) return;
  
  const wrapperRect = wrapper.getBoundingClientRect();
  const newWidth = wrapperRect.right - event.clientX;
  const clampedWidth = Math.max(280, Math.min(newWidth, wrapperRect.width * 0.6));
  
  sidebar.style.width = clampedWidth + 'px';
}

function stopStrongsResize() {
  isResizing = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  
  // Save the width
  const sidebar = document.getElementById('strongs-sidebar');
  if (sidebar) {
    localStorage.setItem('strongs-sidebar-width', sidebar.style.width);
  }
  
  document.removeEventListener('mousemove', doStrongsResize);
  document.removeEventListener('mouseup', stopStrongsResize);
}

// Render verse text with clickable Strong's words (for OT)
// Keeps original KJV text but makes words clickable
// Also highlights words that have symbolic meanings
function renderVerseWithStrongs(bookName, chapter, verseNum, plainText) {
  const isNT = isNTBook(bookName);
  const isOT = hasHebrewText(bookName);
  
  // Build Strong's lookup map if we have interlinear data
  const wordMap = new Map();
  let hasStrongsData = false;
  
  if ((isNT && ntInterlinearData) || (isOT && interlinearData)) {
    const ref = `${bookName} ${chapter}:${verseNum}`;
    const data = isNT ? ntInterlinearData[ref] : interlinearData[ref];
    
    if (data && data.e && data.e.length > 0) {
      hasStrongsData = true;
      for (const entry of data.e) {
        // Split multi-word entries and map each word
        const words = entry.e.split(/\s+/);
        for (const w of words) {
          const normalized = w.toLowerCase().replace(/[.,;:!?'"()]/g, '');
          if (normalized && !wordMap.has(normalized)) {
            wordMap.set(normalized, entry);
          }
        }
      }
    }
  }
  
  // Split KJV text into words and wrap clickable ones
  // Preserve original spacing and punctuation
  const result = plainText.replace(/(\S+)/g, (match) => {
    let normalized = match.toLowerCase().replace(/[.,;:!?'"()]/g, '');
    
    // Check for Strong's data
    let entry = wordMap.get(normalized);
    if (!entry && KJV_NAME_VARIANTS[normalized]) {
      entry = wordMap.get(KJV_NAME_VARIANTS[normalized]);
    }
    
    // Check for symbol data
    const symbol = (typeof lookupSymbolByWord === 'function') ? lookupSymbolByWord(normalized) : null;
    
    // Build classes and click handler based on what data we have
    const classes = [];
    let onclick = '';
    
    if (entry) {
      classes.push('strongs-word');
      const escapedWord = match.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const escapedGloss = (entry.g || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      onclick = `showStrongsPanel('${entry.s}', '${escapedWord}', '${escapedGloss}', event)`;
    }
    
    if (symbol) {
      classes.push('symbol-word');
      // If we already have a Strong's click, make symbol accessible via right-click or add indicator
      if (!entry) {
        // No Strong's data, symbol click is primary
        const symbolKey = Object.keys(SYMBOL_DICTIONARY).find(k => SYMBOL_DICTIONARY[k] === symbol) || '';
        onclick = `showSymbolPanel('${symbolKey}', '${normalized}', event)`;
      }
    }
    
    if (classes.length > 0) {
      const dataAttrs = [];
      if (entry) dataAttrs.push(`data-strongs="${entry.s}"`);
      if (symbol) dataAttrs.push(`data-symbol="${symbol.name}"`);
      
      return `<span class="${classes.join(' ')}" ${dataAttrs.join(' ')} onclick="${onclick}">${match}</span>`;
    }
    
    return match;
  });
  
  return result;
}

// Apply symbol highlighting to text (for verses without interlinear data)
function applySymbolHighlighting(text) {
  if (!text || typeof lookupSymbolByWord !== 'function') return text;
  
  return text.replace(/(\S+)/g, (match) => {
    // Skip if already wrapped in a span (from annotations)
    if (match.includes('<span') || match.includes('</span>')) return match;
    
    const normalized = match.toLowerCase().replace(/[.,;:!?'"()]/g, '');
    const symbol = lookupSymbolByWord(normalized);
    
    if (symbol) {
      const symbolKey = Object.keys(SYMBOL_DICTIONARY).find(k => SYMBOL_DICTIONARY[k] === symbol) || '';
      return `<span class="symbol-word" data-symbol="${symbol.name}" onclick="showSymbolPanel('${symbolKey}', '${normalized}', event)">${match}</span>`;
    }
    
    return match;
  });
}

// Show book reference popup when clicking the book icon
function showBookRefPopup(book, chapter, verse, event) {
  if (event) event.stopPropagation();
  
  const bookRefs = getBookReferences(book, chapter, verse);
  if (!bookRefs || bookRefs.length === 0) return;
  
  // Create or get popup
  let popup = document.getElementById('book-ref-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'book-ref-popup';
    popup.className = 'book-ref-popup';
    document.body.appendChild(popup);
  }
  
  // Build popup content
  let html = `<div class="book-ref-popup-header">
    <span>Referenced in:</span>
    <button class="book-ref-popup-close" onclick="closeBookRefPopup()">×</button>
  </div>
  <div class="book-ref-popup-content">`;
  
  // Group by chapter to avoid duplicates
  const seen = new Set();
  for (const ref of bookRefs) {
    const key = `${ref.chapter}-${ref.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    
    const url = getChapterUrl(ref.chapter, ref.anchor);
    html += `<a href="${url}" class="book-ref-link" onclick="closeBookRefPopup()">
      <span class="book-ref-chapter">Chapter ${parseInt(ref.chapter)}</span>
      <span class="book-ref-title">${ref.title}</span>
    </a>`;
  }
  
  html += '</div>';
  popup.innerHTML = html;
  popup.classList.add('visible');
  
  // Position near the clicked icon
  if (event && event.target) {
    const rect = event.target.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 5;
    
    // Keep within viewport
    const popupWidth = 280;
    if (left + popupWidth > window.innerWidth) {
      left = window.innerWidth - popupWidth - 10;
    }
    
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }
}

function closeBookRefPopup() {
  const popup = document.getElementById('book-ref-popup');
  if (popup) {
    popup.classList.remove('visible');
  }
}

// Close popup when clicking outside
document.addEventListener('click', (e) => {
  const popup = document.getElementById('book-ref-popup');
  if (popup && popup.classList.contains('visible')) {
    if (!popup.contains(e.target) && !e.target.classList.contains('verse-book-ref')) {
      closeBookRefPopup();
    }
  }
});

// Normalize book name variations to standard names
function normalizeBookName(book) {
  const normalizations = {
    'Psalm': 'Psalms',
    'Song of Songs': 'Song of Solomon',
    'Canticles': 'Song of Solomon'
  };
  return normalizations[book] || book;
}

// Parse Bible text file into structured data (async to avoid blocking UI)
// config: translation config object with separator and skipLines
async function parseBibleText(text, config = BIBLE_TRANSLATIONS.kjv) {
  const data = [];
  const lines = text.split('\n');
  const totalLines = lines.length;
  const skipLines = config.skipLines || 2;
  const useTabSeparator = config.separator === '\t';
  
  // Process in chunks to yield to main thread
  const CHUNK_SIZE = 2000;
  
  for (let i = skipLines; i < totalLines; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    let reference, verseText;
    
    if (useTabSeparator) {
      // Tab-separated (KJV format)
      const tabIndex = line.indexOf('\t');
      if (tabIndex === -1) continue;
      reference = line.substring(0, tabIndex);
      verseText = line.substring(tabIndex + 1);
    } else {
      // Space-separated (ASV format) - find the verse reference pattern
      const match = line.match(/^(.+?\s+\d+:\d+)\s+(.+)$/);
      if (!match) continue;
      reference = match[1];
      verseText = match[2];
    }
    
    // Parse reference: "Book Chapter:Verse"
    const refMatch = reference.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (!refMatch) continue;
    
    let [, book, chapter, verse] = refMatch;
    
    // Normalize book names (handle variations like "Psalm" vs "Psalms")
    book = normalizeBookName(book);
    
    data.push({
      book: book,
      chapter: parseInt(chapter),
      verse: parseInt(verse),
      text: verseText,
      reference: `${book} ${chapter}:${verse}`
    });
    
    // Yield to main thread every CHUNK_SIZE lines to keep UI responsive
    if ((i - skipLines) % CHUNK_SIZE === 0 && i > skipLines) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return data;
}

// Rebuild index for a specific translation
function rebuildTranslationIndex(translationId) {
  bibleIndexes[translationId] = {};
  const data = bibleTranslations[translationId];
  if (data) {
    for (const entry of data) {
      bibleIndexes[translationId][entry.reference] = entry;
    }
  }
}

// Rebuild the index from bibleData (backwards compatible)
function rebuildIndex() {
  rebuildTranslationIndex(currentTranslation);
  syncLegacyVariables();
}

// Update loading dialog text
function updateLoadingDialogText(text) {
  const dialog = document.getElementById('bible-loading-dialog');
  if (dialog) {
    const msgEl = dialog.querySelector('.bible-loading-text');
    if (msgEl) msgEl.textContent = text;
  }
}

// Switch to a different translation
async function switchTranslation(translationId) {
  const config = BIBLE_TRANSLATIONS[translationId];
  if (!config) {
    console.warn(`Unknown translation: ${translationId}`);
    return false;
  }
  
  // Load if not already loaded
  if (!bibleTranslations[translationId]) {
    await loadTranslation(translationId, true);
  }
  
  if (!bibleTranslations[translationId]) {
    console.warn(`Failed to load ${config.name}`);
    return false;
  }
  
  // Switch current translation
  currentTranslation = translationId;
  syncLegacyVariables();
  
  // Save preference
  try {
    localStorage.setItem('bible_translation_preference', translationId);
  } catch (e) {}
  
  // Update UI
  updateTranslationUI();
  
  // Rebuild chapter counts and redisplay current chapter
  buildBookChapterCounts();
  if (bibleExplorerState.currentBook && bibleExplorerState.currentChapter) {
    displayBibleChapter(bibleExplorerState.currentBook, bibleExplorerState.currentChapter, bibleExplorerState.highlightedVerse);
  }
  
  return true;
}

// Update UI to reflect current translation
function updateTranslationUI() {
  const config = BIBLE_TRANSLATIONS[currentTranslation];
  if (!config) return;
  
  // Update translation dropdown
  const translationSelect = document.getElementById('bible-translation-select');
  if (translationSelect) {
    translationSelect.value = currentTranslation;
  }
}

// Get saved translation preference
function getSavedTranslationPreference() {
  try {
    return localStorage.getItem('bible_translation_preference') || 'kjv';
  } catch (e) {
    return 'kjv';
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
      const trans = currentTranslation || 'kjv';
      html += `<div class="bible-chapter-section">`;
      html += `<div class="bible-chapter-header">
        <a href="/bible/${trans}/${bookEncoded}/${verse.chapter}" 
           onclick="openBibleExplorerFromModal('${verse.book}', ${verse.chapter}); return false;" 
           class="bible-chapter-link" title="Read full chapter in Bible Explorer">
          Chapter ${verse.chapter} →
        </a>
      </div>`;
      html += '<div class="bible-chapter-text">';
    }
    
    // Verse with superscript verse number - clickable to open in Bible Explorer at that verse
    const bookEncoded = encodeURIComponent(verse.book);
    const trans = currentTranslation || 'kjv';
    html += `<span class="bible-verse"><sup class="bible-verse-num">
      <a href="/bible/${trans}/${bookEncoded}/${verse.chapter}?verse=${verse.verse}" 
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
async function openBibleReader(citationStr, title = '') {
  // If Bible not loaded yet, load it first (with dialog since user is waiting)
  if (!bibleData) {
    await loadBible(true);
    if (!bibleData) {
      console.warn('Bible data could not be loaded');
      return;
    }
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

// Build a proper Bible URL from a citation string like "Genesis 1:5" or "Ezekiel 26:4-5"
function buildBibleUrl(citation, translation = null) {
  // Parse citation: "Book Chapter:Verse" or "Book Chapter"
  const match = citation.match(/^(.+?)\s+(\d+)(?::(\d+))?/);
  if (!match) return '/bible/kjv/';
  
  const book = match[1];
  const chapter = match[2];
  const verse = match[3];
  const trans = translation || currentTranslation || 'kjv';
  
  const bookEncoded = encodeURIComponent(book);
  let url = `/bible/${trans}/${bookEncoded}/${chapter}`;
  if (verse) {
    url += `?verse=${verse}`;
  }
  return url;
}

// Make a citation string clickable with proper URL
function makeCitationClickable(citationStr, title = '') {
  const url = buildBibleUrl(citationStr);
  return `<a href="${url}" class="bible-citation-link" data-citation="${citationStr}" data-title="${title}" onclick="handleCitationClick(event)">${citationStr}</a>`;
}

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
    const url = buildBibleUrl(citation);
    return `<a href="${url}" class="bible-citation-link" data-citation="${citation}" onclick="handleCitationClick(event)">${match}</a>`;
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
        const url = buildBibleUrl(citation);
        return `<a href="${url}" class="bible-citation-link" data-citation="${citation}" onclick="handleCitationClick(event)">${match}</a>`;
      });
      
      result = result.replace(cfPattern, (match, prefix, verses) => {
        const cleanVerses = verses.replace(/–/g, '-');
        const citation = normalizedBook + ' ' + contextChapter + ':' + cleanVerses;
        const url = buildBibleUrl(citation);
        return `(cf. <a href="${url}" class="bible-citation-link" data-citation="${citation}" onclick="handleCitationClick(event)">${prefix} ${verses}</a>)`;
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
  bookChapterCounts: {}, // Cache of chapter counts per book
  // Navigation history
  history: [],
  historyIndex: -1
};

// Navigate to a Bible location and push to history
function navigateToBibleLocation(book, chapter, verse = null, addToHistory = true) {
  const normalizedBook = normalizeBookName(book);
  
  // Don't add duplicate entries
  const current = bibleExplorerState.history[bibleExplorerState.historyIndex];
  const isSameLocation = current && 
    current.book === normalizedBook && 
    current.chapter === chapter;
  
  if (addToHistory && !isSameLocation) {
    // Truncate forward history if we're not at the end
    if (bibleExplorerState.historyIndex < bibleExplorerState.history.length - 1) {
      bibleExplorerState.history = bibleExplorerState.history.slice(0, bibleExplorerState.historyIndex + 1);
    }
    // Add to history
    bibleExplorerState.history.push({ book: normalizedBook, chapter, verse });
    bibleExplorerState.historyIndex = bibleExplorerState.history.length - 1;
  }
  
  // Navigate
  if (bibleExplorerState.bookChapterCounts[normalizedBook]) {
    selectBibleBook(normalizedBook);
    populateBibleChapters(normalizedBook);
    bibleExplorerState.currentChapter = chapter;
    displayBibleChapter(normalizedBook, chapter, verse);
    updateChapterNavigation();
    updateBibleHistoryButtons();
  }
}

// Go back in Bible history
function bibleGoBack() {
  if (bibleExplorerState.historyIndex > 0) {
    bibleExplorerState.historyIndex--;
    const loc = bibleExplorerState.history[bibleExplorerState.historyIndex];
    navigateToBibleLocation(loc.book, loc.chapter, loc.verse, false);
  }
}

// Go forward in Bible history
function bibleGoForward() {
  if (bibleExplorerState.historyIndex < bibleExplorerState.history.length - 1) {
    bibleExplorerState.historyIndex++;
    const loc = bibleExplorerState.history[bibleExplorerState.historyIndex];
    navigateToBibleLocation(loc.book, loc.chapter, loc.verse, false);
  }
}

// Update back/forward button states
function updateBibleHistoryButtons() {
  const backBtn = document.getElementById('bible-history-back');
  const fwdBtn = document.getElementById('bible-history-forward');
  if (backBtn) backBtn.disabled = bibleExplorerState.historyIndex <= 0;
  if (fwdBtn) fwdBtn.disabled = bibleExplorerState.historyIndex >= bibleExplorerState.history.length - 1;
}

// Handle scripture link click from Strong's sidebar
// Can be called with (book, chapter, verse) OR with just a reference string like "Genesis 1:5"
function goToScriptureFromSidebar(bookOrRef, chapter, verse) {
  // If called with a single reference string, parse it
  if (chapter === undefined) {
    const match = bookOrRef.match(/^(.+)\s+(\d+):(\d+)$/);
    if (!match) return;
    const book = match[1];
    chapter = parseInt(match[2]);
    verse = parseInt(match[3]);
    navigateToBibleLocation(book, chapter, verse, true);
  } else {
    navigateToBibleLocation(bookOrRef, chapter, verse, true);
  }
}

// Initialize Bible Explorer
function initBibleExplorer() {
  // Restore saved translation preference
  const savedTranslation = getSavedTranslationPreference();
  if (savedTranslation && BIBLE_TRANSLATIONS[savedTranslation]) {
    currentTranslation = savedTranslation;
  }
  
  // Populate translation dropdown
  populateTranslationDropdown();
  
  if (!bibleData) {
    // User is actively waiting, so show loading dialog
    loadTranslation(currentTranslation, true).then(() => {
      buildBookChapterCounts();
      populateBibleBooks();
      updateTranslationUI();
    });
  } else {
    buildBookChapterCounts();
    populateBibleBooks();
    updateTranslationUI();
  }
}

// Populate translation dropdown
function populateTranslationDropdown() {
  const translationSelect = document.getElementById('bible-translation-select');
  if (!translationSelect) return;
  
  let html = '';
  for (const [id, config] of Object.entries(BIBLE_TRANSLATIONS)) {
    const selected = id === currentTranslation ? ' selected' : '';
    html += `<option value="${id}"${selected}>${config.name}</option>`;
  }
  translationSelect.innerHTML = html;
}

// Handle translation dropdown change
function onTranslationChange(translationId) {
  if (!translationId || translationId === currentTranslation) return;
  switchTranslation(translationId);
}

// Select a translation from the welcome screen and open Genesis 1
async function selectTranslationAndStart(translationId) {
  if (!translationId) return;
  
  // Switch to the selected translation
  await switchTranslation(translationId);
  
  // Open Genesis 1 to start reading
  openBibleExplorerTo('Genesis', 1);
}

// Go to Bible home page (translation selector)
function goToBibleHome() {
  // Clear current book/chapter state
  bibleExplorerState.currentBook = null;
  bibleExplorerState.currentChapter = null;
  bibleExplorerState.highlightedVerse = null;
  
  // Reset dropdowns
  const bookSelect = document.getElementById('bible-book-select');
  const chapterSelect = document.getElementById('bible-chapter-select');
  if (bookSelect) bookSelect.value = '';
  if (chapterSelect) {
    chapterSelect.innerHTML = '<option value="">Ch.</option>';
    chapterSelect.disabled = true;
  }
  
  // Show welcome screen
  const textContainer = document.getElementById('bible-explorer-text');
  if (textContainer) {
    // Restore welcome content
    textContainer.innerHTML = getBibleWelcomeHTML();
  }
  
  // Update chapter title
  const titleEl = document.getElementById('bible-chapter-title');
  if (titleEl) titleEl.textContent = 'Select a book to begin';
  
  // Disable navigation buttons
  const prevBtn = document.getElementById('bible-prev-chapter');
  const nextBtn = document.getElementById('bible-next-chapter');
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
  
  // Update URL
  window.history.replaceState({}, '', `/bible/${currentTranslation}/`);
}

// Get the Bible welcome HTML
function getBibleWelcomeHTML() {
  return `
    <div class="bible-explorer-welcome">
      <div class="bible-welcome-icon">📖</div>
      <h3>Welcome to the Bible</h3>
      <p>Choose a translation to begin reading, or select a book and chapter from the dropdowns above.</p>
      
      <div class="bible-translation-cards">
        <div class="bible-translation-card" onclick="selectTranslationAndStart('kjv')">
          <div class="translation-card-icon">👑</div>
          <div class="translation-card-content">
            <h4>King James Version</h4>
            <span class="translation-card-year">1611</span>
            <p>The classic English translation beloved for its majestic, poetic language. Features formal, archaic English ("thee," "thou," "hath") that has shaped English literature for over 400 years.</p>
            <div class="translation-card-traits">
              <span class="trait">Traditional</span>
              <span class="trait">Literary</span>
              <span class="trait">Formal</span>
            </div>
          </div>
        </div>
        
        <div class="bible-translation-card" onclick="selectTranslationAndStart('asv')">
          <div class="translation-card-icon">📜</div>
          <div class="translation-card-content">
            <h4>American Standard Version</h4>
            <span class="translation-card-year">1901</span>
            <p>A highly literal translation valued for accuracy and consistency. Uses "Jehovah" for God's name and modernizes some archaic KJV expressions while maintaining formal language.</p>
            <div class="translation-card-traits">
              <span class="trait">Literal</span>
              <span class="trait">Accurate</span>
              <span class="trait">Study</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="bible-quick-links">
        <span class="bible-quick-label">Quick Start:</span>
        <button onclick="openBibleExplorerTo('Genesis', 1)">Genesis 1</button>
        <button onclick="openBibleExplorerTo('Psalms', 23)">Psalm 23</button>
        <button onclick="openBibleExplorerTo('John', 1)">John 1</button>
        <button onclick="openBibleExplorerTo('Revelation', 1)">Revelation 1</button>
      </div>
    </div>
  `;
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
function selectBibleChapter(chapter, addToHistory = true) {
  const book = bibleExplorerState.currentBook;
  
  // Add to history if this is a user-initiated navigation
  if (addToHistory && book) {
    const current = bibleExplorerState.history[bibleExplorerState.historyIndex];
    const isSame = current && current.book === book && current.chapter === chapter;
    if (!isSame) {
      if (bibleExplorerState.historyIndex < bibleExplorerState.history.length - 1) {
        bibleExplorerState.history = bibleExplorerState.history.slice(0, bibleExplorerState.historyIndex + 1);
      }
      bibleExplorerState.history.push({ book, chapter, verse: null });
      bibleExplorerState.historyIndex = bibleExplorerState.history.length - 1;
    }
  }
  
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
  updateBibleHistoryButtons();
  
  // Update URL
  updateBibleExplorerURL(bibleExplorerState.currentBook, chapter, null);
}

// Display a chapter
async function displayBibleChapter(bookName, chapter, highlightVerse = null) {
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
  
  // Ensure interlinear data is loaded for this testament
  const isNT = isNTBook(bookName);
  if (isNT && !ntInterlinearData) {
    await loadNTInterlinear();
  } else if (!isNT && hasHebrewText(bookName) && !interlinearData) {
    await loadInterlinear();
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
    const hasOriginalLang = hasInterlinear(bookName);
    const origLangClass = hasOriginalLang ? ' has-hebrew' : '';  // Reuse class for both Hebrew and Greek
    
    // Use Strong's clickable words if interlinear data is loaded for this testament
    const hasInterlinearData = isNT ? ntInterlinearData : interlinearData;
    let verseText;
    if (hasOriginalLang && hasInterlinearData) {
      verseText = renderVerseWithStrongs(bookName, chapter, verse.verse, verse.text);
    } else {
      // Apply symbol highlighting even without interlinear data
      verseText = applySymbolHighlighting(applyVerseAnnotations(reference, verse.text));
    }
    
    const interlinearTitle = isNTBook(bookName) ? 'Click to show interlinear Greek' : 'Click to show interlinear Hebrew';
    
    // Check if this verse is referenced in the book
    const bookRefs = (typeof getBookReferences === 'function') ? getBookReferences(bookName, chapter, verse.verse) : null;
    const bookRefHtml = bookRefs && bookRefs.length > 0 
      ? `<span class="verse-book-ref" onclick="showBookRefPopup('${bookName}', ${chapter}, ${verse.verse}, event)" title="Referenced in A Time Tested Tradition">📖</span>`
      : `<span class="verse-book-ref-spacer"></span>`;
    
    html += `<div class="bible-explorer-verse${highlighted}${origLangClass}" id="verse-${verse.verse}">
      ${bookRefHtml}<span class="bible-verse-number${hasOriginalLang ? ' clickable-hebrew' : ''}" onclick="${hasOriginalLang ? `showInterlinear('${bookName}', ${chapter}, ${verse.verse}, event)` : `copyVerseReference('${bookName}', ${chapter}, ${verse.verse})`}" title="${hasOriginalLang ? interlinearTitle : 'Click to copy reference'}">${verse.verse}</span>
      <span class="bible-verse-text">${verseText}</span>
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
    selectBibleChapter(newChapter, true);
    
    // Update chapter grid if visible
    document.querySelectorAll('.bible-chapter-btn').forEach(el => {
      el.classList.remove('active');
      if (parseInt(el.textContent) === newChapter) {
        el.classList.add('active');
      }
    });
  }
}

// Smart search - handles both verse references and concept searches
function smartBibleSearch() {
  const input = document.getElementById('bible-explorer-search-input');
  if (!input) return;
  
  const searchText = input.value.trim();
  if (!searchText) return;
  
  // Check if it's a Strong's number (H1234, G5678, H03068, etc.)
  const strongsMatch = searchText.match(/^([HGhg])0*(\d+)$/);
  if (strongsMatch) {
    const prefix = strongsMatch[1].toUpperCase();
    const num = strongsMatch[2];
    const strongsNum = prefix + num;
    showStrongsPanel(strongsNum, '', '', null);
    input.value = '';
    return;
  }
  
  // Try to parse as a verse citation first
  const parsed = parseSearchCitation(searchText);
  
  if (parsed.book) {
    // It looks like a verse reference - try to navigate
    const normalizedBook = normalizeBookName(parsed.book);
    
    // Verify book exists
    if (bibleExplorerState.bookChapterCounts[normalizedBook]) {
      // Valid book - navigate to it
      selectBibleBook(normalizedBook);
      
      if (parsed.chapter) {
        populateBibleChapters(normalizedBook);
        bibleExplorerState.currentChapter = parsed.chapter;
        displayBibleChapter(normalizedBook, parsed.chapter, parsed.verse);
        updateChapterNavigation();
        
        document.querySelectorAll('.bible-chapter-btn').forEach(el => {
          el.classList.remove('active');
          if (parseInt(el.textContent) === parsed.chapter) {
            el.classList.add('active');
          }
        });
      }
      
      input.value = '';
      return;
    }
  }
  
  // Not a valid verse reference - treat as concept search
  if (searchText.length >= 2) {
    startConceptSearch(searchText);
  } else {
    alert('Enter a verse (e.g., "John 3:16") or a word to search (2+ characters)');
  }
}

// Legacy function - now redirects to smart search
function jumpToVerse() {
  smartBibleSearch();
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
  let url = `/bible/${currentTranslation}/${bookEncoded}/${chapter}`;
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

// Toggle Hebrew interlinear display below a verse
async function showHebrewVerse(book, chapter, verse, event) {
  if (event) {
    event.stopPropagation();
  }
  
  const verseEl = document.getElementById(`verse-${verse}`);
  if (!verseEl) return;
  
  // Check if already expanded - if so, collapse it
  const existingInterlinear = verseEl.querySelector('.hebrew-interlinear');
  if (existingInterlinear) {
    existingInterlinear.classList.remove('expanded');
    setTimeout(() => existingInterlinear.remove(), 200);
    verseEl.classList.remove('hebrew-expanded');
    return;
  }
  
  // Collapse any other expanded verses
  document.querySelectorAll('.hebrew-interlinear.expanded').forEach(el => {
    el.classList.remove('expanded');
    setTimeout(() => el.remove(), 200);
  });
  document.querySelectorAll('.bible-explorer-verse.hebrew-expanded').forEach(el => {
    el.classList.remove('hebrew-expanded');
  });
  
  const reference = `${book} ${chapter}:${verse}`;
  
  // Check if this book has interlinear available
  if (!hasInterlinear(book)) {
    showHebrewInterlinear(verseEl, null, 'Interlinear text is not available for this book.');
    return;
  }
  
  // Load Hebrew if not already loaded
  if (!hebrewData) {
    showHebrewInterlinear(verseEl, null, 'Loading Hebrew text...');
    const loaded = await loadHebrew();
    if (loaded) {
      // Re-render with actual data
      const existing = verseEl.querySelector('.hebrew-interlinear');
      if (existing) existing.remove();
      const hebrewVerse = getHebrewVerse(book, chapter, verse);
      showHebrewInterlinear(verseEl, hebrewVerse ? hebrewVerse.text : null, 
        hebrewVerse ? null : 'Hebrew text not found.');
    }
    return;
  }
  
  // Get the Hebrew verse
  const hebrewVerse = getHebrewVerse(book, chapter, verse);
  
  if (hebrewVerse) {
    showHebrewInterlinear(verseEl, hebrewVerse.text, null);
  } else {
    showHebrewInterlinear(verseEl, null, 'Hebrew text not found for this verse.');
  }
}

// Show Hebrew interlinear below a verse element
function showHebrewInterlinear(verseEl, hebrewText, errorMessage) {
  // Remove any existing interlinear in this verse
  const existing = verseEl.querySelector('.hebrew-interlinear');
  if (existing) existing.remove();
  
  // Create interlinear element
  const interlinear = document.createElement('div');
  interlinear.className = 'hebrew-interlinear';
  
  if (errorMessage) {
    interlinear.innerHTML = `<div class="hebrew-interlinear-error">${errorMessage}</div>`;
  } else {
    interlinear.innerHTML = `
      <div class="hebrew-interlinear-text" dir="rtl">${hebrewText}</div>
    `;
  }
  
  verseEl.appendChild(interlinear);
  verseEl.classList.add('hebrew-expanded');
  
  // Animate in
  requestAnimationFrame(() => {
    interlinear.classList.add('expanded');
  });
}
