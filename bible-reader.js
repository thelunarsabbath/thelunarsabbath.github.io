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
    jsonFile: '/kjv.json',  // Pre-processed: faster load (no runtime parsing)
    separator: '\t',
    skipLines: 2
  },
  asv: {
    id: 'asv',
    name: 'ASV',
    fullName: 'American Standard Version',
    file: '/asv.txt',
    jsonFile: '/asv.json',
    separator: ' ',
    skipLines: 4
  },
  lxx: {
    id: 'lxx',
    name: 'LXX',
    fullName: 'Septuagint (Brenton)',
    file: '/lxx.txt',
    jsonFile: '/lxx.json',
    separator: '\t',
    skipLines: 2
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

// ============================================
// GEMATRIA DATA AND FUNCTIONS
// ============================================

// Gematria data storage
let gematriaData = null;        // { hebrew: {...}, greek: {...} }
let gematriaIndex = null;       // { value: { hebrew: [...], greek: [...] }, ... }
let gematriaLoading = null;     // Promise while loading

// Load gematria data (lazy load on first use)
async function loadGematriaData() {
  if (gematriaData && gematriaIndex) return true;
  if (gematriaLoading) return gematriaLoading;
  
  gematriaLoading = (async () => {
    try {
      // Load both compact data and index
      const [compactRes, indexRes] = await Promise.all([
        fetch('/data/gematria-compact.json'),
        fetch('/data/gematria-index.json')
      ]);
      
      if (compactRes.ok) {
        gematriaData = await compactRes.json();
      }
      if (indexRes.ok) {
        gematriaIndex = await indexRes.json();
      }
      
      console.log('[Gematria] Loaded gematria data');
      return true;
    } catch (err) {
      console.warn('[Gematria] Failed to load gematria data:', err);
      return false;
    }
  })();
  
  return gematriaLoading;
}

// Get gematria value for a Strong's number
function getGematriaValue(strongsNum) {
  if (!gematriaData) return null;
  const normalized = normalizeStrongsNum(strongsNum);
  
  if (normalized.startsWith('H') && gematriaData.hebrew) {
    const entry = gematriaData.hebrew[normalized];
    return entry ? entry[1] : null;  // [lemma, value]
  }
  if (normalized.startsWith('G') && gematriaData.greek) {
    const entry = gematriaData.greek[normalized];
    return entry ? entry[1] : null;
  }
  return null;
}

// Get all words with the same gematria value
function getRelatedByGematria(strongsNum, limit = 20) {
  if (!gematriaIndex) return null;
  
  const value = getGematriaValue(strongsNum);
  if (!value) return null;
  
  const related = gematriaIndex[value];
  if (!related) return null;
  
  const normalized = normalizeStrongsNum(strongsNum);
  const isHebrew = normalized.startsWith('H');
  
  // Filter out the current word and limit results
  const hebrewWords = (related.hebrew || [])
    .filter(w => w.strongs !== normalized)
    .slice(0, limit);
  const greekWords = (related.greek || [])
    .filter(w => w.strongs !== normalized)
    .slice(0, limit);
  
  return {
    value: value,
    hebrew: hebrewWords,
    greek: greekWords,
    totalHebrew: (related.hebrew || []).length - (isHebrew ? 1 : 0),
    totalGreek: (related.greek || []).length - (!isHebrew ? 1 : 0)
  };
}

// Render gematria section HTML
function renderGematriaSection(strongsNum, expanded = false) {
  const value = getGematriaValue(strongsNum);
  if (!value) return '';
  
  const related = getRelatedByGematria(strongsNum);
  const hasRelated = related && (related.hebrew.length > 0 || related.greek.length > 0);
  
  let html = `
    <div class="strongs-gematria-section">
      <div class="strongs-gematria-header" onclick="AppStore.dispatch({type:'TOGGLE_GEMATRIA'})">
        <span class="strongs-gematria-icon">🔢</span>
        <span class="strongs-gematria-title">Gematria</span>
        <span class="strongs-gematria-value">${value}</span>
        ${hasRelated ? `<span class="strongs-gematria-expand">${expanded ? '▲' : '▼'}</span>` : ''}
      </div>
  `;
  
  if (hasRelated) {
    html += `<div class="strongs-gematria-related" id="gematria-related" style="display: ${expanded ? 'block' : 'none'};">`;
    
    // Hebrew words with same value
    if (related.hebrew.length > 0) {
      html += `<div class="strongs-gematria-group">
        <div class="strongs-gematria-group-title">Hebrew (${related.totalHebrew})</div>
        <div class="strongs-gematria-words">`;
      
      for (const word of related.hebrew) {
        const primaryWord = extractPrimaryWord(word.def);
        html += `<span class="strongs-gematria-word" data-strongs="${word.strongs}" onclick="navigateToStrongs('${word.strongs}', event)">${primaryWord}</span>`;
      }
      
      html += `</div></div>`;
    }
    
    // Greek words with same value
    if (related.greek.length > 0) {
      html += `<div class="strongs-gematria-group">
        <div class="strongs-gematria-group-title">Greek (${related.totalGreek})</div>
        <div class="strongs-gematria-words">`;
      
      for (const word of related.greek) {
        const primaryWord = extractPrimaryWord(word.def);
        html += `<span class="strongs-gematria-word" data-strongs="${word.strongs}" onclick="navigateToStrongs('${word.strongs}', event)">${primaryWord}</span>`;
      }
      
      html += `</div></div>`;
    }
    
    html += `</div>`;
  }
  
  html += `</div>`;
  return html;
}

// Extract a clean primary word/phrase from a Strong's definition
function extractPrimaryWord(def) {
  if (!def) return '(unknown)';
  
  // Clean up the definition
  let cleaned = def.trim();
  
  // Remove leading articles and common prefixes
  cleaned = cleaned.replace(/^(a |an |the |to |properly[,:]? ?|i\.e\.[,:]? ?)/i, '');
  
  // Get the first meaningful word/phrase (up to comma, semicolon, or parenthesis)
  const match = cleaned.match(/^([^,;(]+)/);
  if (match) {
    cleaned = match[1].trim();
  }
  
  // Remove trailing articles/prepositions
  cleaned = cleaned.replace(/\s+(of|the|a|an|in|to|for|by|as|or)$/i, '');
  
  // Limit length
  if (cleaned.length > 25) {
    cleaned = cleaned.substring(0, 22) + '...';
  }
  
  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  return cleaned || '(unknown)';
}

// Toggle gematria expanded state — dispatches to AppStore (unidirectional flow)
function toggleGematriaExpanded() {
  AppStore.dispatch({ type: 'TOGGLE_GEMATRIA' });
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
    tooltip: "Hebrew Word Ambiguity: Woman or Fire?\n\nIn Hebrew, 'woman' (אִשָּׁה, H802) and 'fire offering' (אִשָּׁה, H801) are spelled identically—same consonants, same vowel pointing. The distinction is purely contextual.",
    strongs: 'H802',
    wordStudy: '/reader/words/H802'
  },
  'lead_payload': {
    emoji: '☢️',
    tooltip: "A talent of lead weighs approximately 70 pounds (~32 kg). Combined with the ephah's cylindrical dimensions, this describes a heavy payload in a flying container—remarkably similar to modern missile specifications.\n\nNotably, uranium decays into lead. Lead is often used as shielding for radioactive materials. A 'talent of lead' covering a fire-bringing payload adds another dimension to this prophetic imagery."
  },
  'shinar_babylon': {
    emoji: '🏛️',
    tooltip: "Shinar is the ancient name for Babylon/Mesopotamia (Genesis 10:10, 11:2). The 'fire offering' is being carried to Babylon—connecting to prophecies of Babylon the Great's destruction by fire (Revelation 18)."
  },
  'evening_sacrifice': {
    emoji: '🐑',
    tooltip: "Evening = Evening Sacrifice?\n\n'Unclean until the even' is traditionally read as 'until sunset.' But what cleanses—the passage of time, or atonement?\n\nScripture teaches that sacrifice makes atonement (Lev 17:11). The evening lamb offering (~3pm) provided daily atonement. Being 'unclean until the even' means waiting for the sacrifice that cleanses—not merely waiting for darkness.\n\nThis also explains why Jesus died at the 9th hour (3pm)—the time of the evening sacrifice.",
    strongs: 'H6153',
    wordStudy: '/reader/symbols/EVENING'
  },
  'evening_morning_sacrifices': {
    emoji: '🐑',
    tooltip: "Days = Evening-Morning Sacrifices?\n\nThe Hebrew is עֶרֶב בֹּקֶר (erev boqer)—literally 'evening morning,' not 'days.' The LXX confirms this, translating it as 'evening and morning.'\n\nContext: The vision concerns the daily sacrifice being removed (v.11-13). The 2300 'evening-mornings' counts sacrifices, not days. Two sacrifices per day = 1150 days (~3.5 years of desecration).",
    strongs: 'H6153',
    wordStudy: '/reader/symbols/EVENING'
  },
  
  // ============================================================================
  // NUMBER ANNOTATIONS - Significant numbers with symbolic meaning
  // ============================================================================
  
  'number_276': {
    emoji: '🔢',
    tooltip: "276 = Strong's G276: ἀμετάθετος (ametathetos)\n\n'Unchangeable' or 'Immutable'\n\nThe number of souls saved in the shipwreck (276) matches G276 in Strong's Concordance—meaning 'unchangeable, immutable.' These souls were immutably secured by God's promise that none would be lost (Acts 27:22-24).\n\nThis 'coincidence' is a Hebrew literary device: the number itself encodes its meaning. God's promise to save all 276 was unchangeable.",
    strongs: 'G276',
    wordStudy: '/reader/words/G276'
  },
  'number_153': {
    emoji: '🐟',
    tooltip: "153 = The Complete Harvest\n\n153 is the 17th triangular number (1+2+3+...+17 = 153), connecting to VICTORY (17).\n\nMathematically unique: 153 = 1³ + 5³ + 3³\n\nAugustine noted ancient naturalists counted 153 species of fish—representing ALL nations gathered into Christ's net. The unbroken net (unlike Luke 5:6) shows none are lost from the complete catch.\n\nThis specific count was recorded for symbolic significance.",
    wordStudy: '/help#number-153'
  },
  'number_20_fathoms': {
    emoji: '⚓',
    tooltip: "20 = Expectancy / Redemptive Waiting\n\nIn Scripture, 20 represents periods of waiting before deliverance:\n• Jacob waited 20 years with Laban\n• Israel endured 20 years under Jabin\n• The ark remained 20 years at Kirjath-jearim\n\nSounding 20 fathoms: They are in a period of expectancy, not yet at rest.\n\n📖 See also: Combined with 15, these numbers form 2015 (G2015).",
    wordStudy: '/help#number-20'
  },
  'number_15_fathoms': {
    emoji: '⚓',
    tooltip: "15 = Rest / Gracious Rest\n\n15 = 5 (grace) × 3 (divine completeness)\n\nFeasts begin on the 15th:\n• Unleavened Bread (Lev 23:6)\n• Tabernacles (Lev 23:34)\n\nSounding 15 fathoms: Drawing closer to REST.\n\n📖 See also: Combined with 20, these numbers form 2015 (G2015).",
    wordStudy: '/help#number-15'
  },
  'number_2015_combined': {
    emoji: '✨',
    tooltip: "20 + 15 = G2015: ἐπιφάνεια (epiphaneia)\n\n'Appearing, Brightness, Manifestation'\n\nStrong's G2015 specifically refers to THE ADVENT OF CHRIST—His appearing!\n\nThe sequence of soundings (20 fathoms, then 15 fathoms) encodes 2015—pointing to Christ's glorious appearing as their salvation draws near.\n\nUsed in:\n• 2 Tim 1:10 — 'the appearing of our Saviour'\n• Titus 2:13 — 'the glorious appearing of...Jesus Christ'\n• 2 Thes 2:8 — 'the brightness of his coming'\n\nAs they approach land (salvation), the depths spell out: APPEARING OF CHRIST.",
    strongs: 'G2015',
    wordStudy: '/reader/words/G2015'
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
  ],
  
  // ============================================================================
  // EVENING SACRIFICE ANNOTATIONS - "unclean until the even"
  // In context of uncleanness, "even" likely refers to evening sacrifice (~3pm)
  // ============================================================================
  
  // Leviticus 11 - Animal carcass uncleanness
  "Leviticus 11:24": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 11:25": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 11:27": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 11:28": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 11:31": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 11:32": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 11:39": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 11:40": [{ word: "until the even", annotation: "evening_sacrifice" }],
  
  // Leviticus 14 - House uncleanness
  "Leviticus 14:46": [{ word: "until the even", annotation: "evening_sacrifice" }],
  
  // Leviticus 15 - Bodily discharge uncleanness
  "Leviticus 15:5": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 15:6": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 15:7": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 15:8": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 15:10": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 15:11": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 15:16": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 15:17": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 15:18": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 15:19": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 15:21": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 15:22": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 15:23": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Leviticus 15:27": [{ word: "until the even", annotation: "evening_sacrifice" }],
  
  // Leviticus 17 - Eating carrion
  "Leviticus 17:15": [{ word: "until the even", annotation: "evening_sacrifice" }],
  
  // Leviticus 22 - Priestly uncleanness
  "Leviticus 22:6": [{ word: "until even", annotation: "evening_sacrifice" }],
  
  // Numbers 19 - Red heifer purification
  "Numbers 19:7": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Numbers 19:8": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Numbers 19:10": [{ word: "until the even", annotation: "evening_sacrifice" }],
  "Numbers 19:21": [{ word: "until even", annotation: "evening_sacrifice" }],
  "Numbers 19:22": [{ word: "until even", annotation: "evening_sacrifice" }],
  
  // Daniel 8 - The 2300 "days" prophecy (Hebrew: evening-morning)
  "Daniel 8:14": [{ word: "days", annotation: "evening_morning_sacrifices" }],
  
  // ============================================================================
  // NUMBER ANNOTATIONS - Significant numbers in narrative
  // ============================================================================
  
  // Paul's Shipwreck - Acts 27
  "Acts 27:37": [{ word: "two hundred threescore and sixteen", annotation: "number_276" }],
  "Acts 27:28": [
    { word: "twenty fathoms", annotation: "number_20_fathoms" },
    { word: "fifteen fathoms", annotation: "number_15_fathoms" },
    { word: "sounded", annotation: "number_2015_combined" }
  ],
  
  // The 153 Fish - John 21
  "John 21:11": [{ word: "an hundred and fifty and three", annotation: "number_153" }]
};

// Apply annotations to verse text
function applyVerseAnnotations(reference, text) {
  const annotations = VERSE_ANNOTATIONS[reference];
  if (!annotations) return text;
  
  let annotatedText = text;
  for (const ann of annotations) {
    const info = HEBREW_ANNOTATIONS[ann.annotation];
    if (!info) continue;
    
    // Build data attributes for tooltip
    const dataAttrs = `data-tooltip="${info.tooltip.replace(/"/g, '&quot;')}"` +
      (info.strongs ? ` data-strongs="${info.strongs}"` : '') +
      (info.wordStudy ? ` data-wordstudy="${info.wordStudy}"` : '');
    
    // Create clickable emoji that shows tooltip
    const replacement = `${ann.word}<span class="hebrew-annotation" ${dataAttrs} onclick="showHebrewTooltip(event)">${info.emoji}</span>`;
    
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
  const strongs = el.dataset.strongs;
  const wordStudy = el.dataset.wordstudy;
  
  // Remove any existing tooltip
  const existing = document.querySelector('.hebrew-tooltip');
  if (existing) existing.remove();
  
  // Create tooltip
  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'hebrew-tooltip';
  
  // Build content
  let html = tooltip.replace(/\n/g, '<br>');
  
  // Add links if available
  if (strongs || wordStudy) {
    html += '<div class="hebrew-tooltip-links">';
    if (strongs) {
      html += `<button class="hebrew-tooltip-btn" onclick="event.stopPropagation(); showStrongsPanel('${strongs}', '', '', event)">📖 ${strongs}</button>`;
    }
    if (wordStudy) {
      html += `<button class="hebrew-tooltip-btn" onclick="event.stopPropagation(); openWordStudyInReader('${strongs}')">📚 Word Study</button>`;
    }
    html += '</div>';
  }
  
  tooltipEl.innerHTML = html;
  getBibleTooltipPortal().appendChild(tooltipEl);
  
  // Position tooltip above the emoji (viewport coords - portal is fixed)
  const rect = el.getBoundingClientRect();
  tooltipEl.style.left = Math.max(10, rect.left - 100) + 'px';
  tooltipEl.style.top = (rect.top - tooltipEl.offsetHeight - 10) + 'px';
  
  // Close on click outside (but not on buttons)
  setTimeout(() => {
    document.addEventListener('click', function closeTooltip(e) {
      if (!tooltipEl.contains(e.target)) {
        tooltipEl.remove();
        document.removeEventListener('click', closeTooltip);
      }
    });
  }, 10);
}

// Portal for tooltips/popups so they always paint on top of Bible content
function getBibleTooltipPortal() {
  return document.getElementById('bible-tooltip-portal') || document.body;
}

// Mobile: first tap = tooltip, second tap = Strong's panel. Desktop: hover = tooltip, click = panel.
function isBibleReaderMobile() {
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768;
}

let lastTappedStrongsKey = null;
let lastTappedStrongsWord = '';
let lastTappedStrongsGloss = '';

function handleStrongsWordClick(strongsNum, englishWord, gloss, event) {
  if (event) event.stopPropagation();
  if (isBibleReaderMobile()) {
    if (lastTappedStrongsKey === strongsNum) {
      lastTappedStrongsKey = null;
      lastTappedStrongsWord = '';
      lastTappedStrongsGloss = '';
      showStrongsPanel(strongsNum, englishWord, gloss, event);
      return;
    }
    lastTappedStrongsWord = englishWord || '';
    lastTappedStrongsGloss = gloss || '';
    showWordTooltip(event);
    lastTappedStrongsKey = strongsNum;
    return;
  }
  showStrongsPanel(strongsNum, englishWord, gloss, event);
}

// Show word tooltip on hover (definitions + symbol meaning)
function showWordTooltip(event) {
  const el = event.target;
  const def = el.dataset.def;
  const symbolMeaning = el.dataset.symbolMeaning;
  
  // Skip if no useful info to show
  if (!def && !symbolMeaning) return;
  
  // Remove any existing tooltip
  hideWordTooltip();
  
  // Create tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'word-hover-tooltip';
  tooltip.className = 'word-hover-tooltip';
  
  let html = '';
  
  // Show definition (synonyms) if available
  if (def) {
    html += `<div class="word-tooltip-def">${def}</div>`;
  }
  
  // Show symbol meaning if available
  if (symbolMeaning) {
    html += `<div class="word-tooltip-symbol">📖 ${symbolMeaning}</div>`;
  }
  
  tooltip.innerHTML = html;
  getBibleTooltipPortal().appendChild(tooltip);
  
  // Position tooltip below the word (viewport coords for position:fixed)
  const rect = el.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  let left = rect.left;
  let top = rect.bottom + 5;
  
  // Keep within viewport
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }
  if (left < 10) left = 10;
  if (top + tooltipRect.height > window.innerHeight - 10) {
    top = rect.top - tooltipRect.height - 5;
  }
  if (top < 10) top = 10;
  
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  tooltip.style.opacity = '1';

  // Click on tooltip = same as clicking the word: open Strong's panel
  tooltip.addEventListener('click', function onTooltipClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const key = isBibleReaderMobile() && lastTappedStrongsKey ? lastTappedStrongsKey : (el.dataset.strongs || null);
    const word = isBibleReaderMobile() && lastTappedStrongsKey ? lastTappedStrongsWord : ((el.textContent || '').trim());
    const gloss = isBibleReaderMobile() && lastTappedStrongsKey ? lastTappedStrongsGloss : (el.dataset.def || '');
    hideWordTooltip();
    if (key) showStrongsPanel(key, word, gloss, e);
  });
  
  // Hide tooltip when mouse leaves it (unless returning to the word)
  tooltip.addEventListener('mouseleave', function onTooltipLeave(e) {
    // Check if mouse is going back to a strongs-word or symbol-word
    if (e.relatedTarget && (e.relatedTarget.classList?.contains('strongs-word') || e.relatedTarget.classList?.contains('symbol-word'))) {
      return; // Mouse is going back to a word, that word's mouseenter will show new tooltip
    }
    hideWordTooltip();
  });
}

function hideWordTooltip(event) {
  // If mouse is moving to the tooltip, don't hide it
  if (event && event.relatedTarget) {
    const tooltip = document.getElementById('word-hover-tooltip');
    if (tooltip && (tooltip === event.relatedTarget || tooltip.contains(event.relatedTarget))) {
      return; // Mouse is moving to tooltip, keep it visible
    }
  }
  lastTappedStrongsKey = null;
  lastTappedStrongsWord = '';
  lastTappedStrongsGloss = '';
  const tooltip = document.getElementById('word-hover-tooltip');
  if (tooltip) tooltip.remove();
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
  
  // Show loading dialog only if requested and we still don't have it (avoid flash on back)
  if (showDialog) {
    if (bibleTranslations[translationId]) {
      return true;
    }
    showBibleLoadingDialog();
    updateLoadingDialogText(`Loading ${config.name}...`);
  }
  
  // Create loading promise
  translationsLoading[translationId] = (async () => {
    try {
      let data;
      if (config.jsonFile) {
        if (showDialog) updateLoadingDialogText(`Downloading ${config.name}...`);
        const response = await fetch(config.jsonFile);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const raw = await response.json();
        // Pre-processed JSON: array of { book, chapter, verse, text }; add reference
        data = raw.map((v) => ({
          book: v.book,
          chapter: v.chapter,
          verse: v.verse,
          text: v.text,
          reference: `${v.book} ${v.chapter}:${v.verse}`
        }));
        bibleTranslations[translationId] = data;
      } else {
        if (showDialog) updateLoadingDialogText(`Downloading ${config.name}...`);
        const response = await fetch(config.file);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (showDialog) updateLoadingDialogText(`Parsing ${config.name}...`);
        data = await parseBibleText(text, config);
        bibleTranslations[translationId] = data;
      }

      if (showDialog) updateLoadingDialogText(`Building index...`);
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
  
  // Then load ASV, LXX, Hebrew, and Interlinear in background
  loadTranslation('asv', false).catch(err => 
    console.log('ASV loading deferred:', err.message)
  );
  
  loadTranslation('lxx', false).catch(err => 
    console.log('LXX loading deferred:', err.message)
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
    if (personInfo.meaning) {
      html += `<div class="person-info-meaning"><strong>Meaning:</strong> ${personInfo.meaning}</div>`;
    }
    if (personInfo.significance) {
      html += `<div class="person-info-significance"><strong>Significance:</strong> ${linkifyPersonText(personInfo.significance)}</div>`;
    }
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
// verseElOrId: optional - for multiverse use unique id (e.g. 'mv-Dan-9-23') or pass element
async function showInterlinear(book, chapter, verse, event, verseElOrId) {
  if (event) event.stopPropagation();
  
  let verseEl;
  if (verseElOrId) {
    verseEl = typeof verseElOrId === 'string' ? document.getElementById(verseElOrId) : verseElOrId;
  } else {
    verseEl = document.getElementById(`verse-${verse}`);
  }
  if (!verseEl) return;
  
  // Toggle off if already expanded
  const existing = verseEl.querySelector('.interlinear-display');
  if (existing) {
    existing.classList.remove('expanded');
    setTimeout(() => existing.remove(), 200);
    verseEl.classList.remove('interlinear-expanded');
    // Dispatch to AppStore for URL sync (unidirectional flow)
    if (typeof AppStore !== 'undefined') {
      AppStore.dispatch({ type: 'SET_INTERLINEAR_VERSE', verse: null });
    }
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
    
    // Add translation comparison section FIRST (above the interlinear)
    const ref = `${book} ${chapter}:${verse}`;
    html += '<div class="interlinear-translations">';
    
    // Only show translations OTHER than the current one
    // KJV
    if (currentTranslation !== 'kjv') {
      const kjvVerse = bibleIndexes['kjv']?.[ref];
      if (kjvVerse) {
        html += `<div class="interlinear-trans-row">
          <span class="interlinear-trans-label">KJV</span>
          <span class="interlinear-trans-text">${kjvVerse.text}</span>
        </div>`;
      }
    }
    
    // ASV
    if (currentTranslation !== 'asv') {
      const asvVerse = bibleIndexes['asv']?.[ref];
      if (asvVerse) {
        html += `<div class="interlinear-trans-row">
          <span class="interlinear-trans-label">ASV</span>
          <span class="interlinear-trans-text">${asvVerse.text}</span>
        </div>`;
      }
    }
    
    // LXX (Septuagint) for OT verses only
    if (!isNT && currentTranslation !== 'lxx') {
      const lxxVerse = bibleIndexes['lxx']?.[ref];
      if (lxxVerse) {
        html += `<div class="interlinear-trans-row interlinear-trans-greek">
          <span class="interlinear-trans-label">LXX</span>
          <span class="interlinear-trans-text">${lxxVerse.text}</span>
        </div>`;
      }
    }
    
    html += '</div>';
    
    // Build the word-for-word interlinear section
    const langClass = isNT ? '' : 'il-hebrew';
    html += `<div class="interlinear-words-container ${langClass}">`;
    for (let i = 0; i < originalWords.length; i++) {
      const word = originalWords[i];
      const engWord = data.e[i];
      const strongs = engWord?.s || '';
      const gloss = engWord?.g || engWord?.e || '';
      const escapedGloss = gloss.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const originalText = isNT ? word.g : word.h;
      html += `<div class="il-word-block il-clickable" onclick="showStrongsPanel('${strongs}', '${escapedGloss}', '${escapedGloss}', event)">
        <span class="il-original">${originalText}</span>
        <span class="il-gloss">${gloss}</span>
      </div>`;
    }
    html += '</div>';
    
    interlinear.innerHTML = html;
  }
  
  verseEl.appendChild(interlinear);
  verseEl.classList.add('interlinear-expanded');
  
  requestAnimationFrame(() => {
    interlinear.classList.add('expanded');
  });
  
  // Dispatch to AppStore for URL sync only when in chapter view (not multiverse)
  const isMultiverse = typeof verseElOrId === 'string' && verseElOrId.startsWith('mv-');
  if (!isMultiverse && typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_INTERLINEAR_VERSE', verse: verse });
  }
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
// skipDispatch: if true, don't dispatch to AppStore (used when syncing FROM state)
function startConceptSearch(word, skipDispatch = false) {
  if (!word || word.trim().length < 2) {
    alert('Please enter a word with at least 2 characters');
    return;
  }
  
  const searchWord = word.trim().toLowerCase();
  
  // Dispatch to AppStore for URL sync (unidirectional flow)
  if (!skipDispatch && typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_SEARCH_QUERY', searchQuery: word.trim() });
  }
  
  // Check if user might be trying to use regex (starts with / but incomplete)
  const looksLikeIncompleteRegex = word.trim().startsWith('/') && !word.trim().match(/^\/.*\/[gimsuy]*$/);
  
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
  
  // If it looks like an incomplete regex, show a helpful hint
  if (looksLikeIncompleteRegex) {
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="concept-search-header">
          <strong>Did you mean to use regex?</strong>
          <div class="search-header-actions">
            <a href="/help#search-section" class="search-help-link" title="Search help" onclick="AppStore.dispatch({type:'SET_VIEW',view:'help'}); return false;">?</a>
            <button class="concept-search-close" onclick="closeConceptSearch()">✕</button>
          </div>
        </div>
        <div class="regex-hint">
          <p>It looks like you're trying a regex search. Regex patterns need a closing slash:</p>
          <div class="regex-hint-example">
            <code>${escapeHtml(word)}<strong>/</strong></code>
            <span>← Add closing slash</span>
          </div>
          <p>Examples:</p>
          <ul>
            <li><code>/hot/</code> — finds "hot" anywhere</li>
            <li><code>/\\bhot\\b/</code> — finds "hot" as whole word only</li>
            <li><code>/(?=.*hot)(?=.*cold)/</code> — finds verses with BOTH words</li>
          </ul>
          <a href="/help#search-section" class="regex-hint-link" onclick="AppStore.dispatch({type:'SET_VIEW',view:'help'}); return false;">
            Learn more about regex search →
          </a>
        </div>`;
    }
    return;
  }
  
  // Find all Strong's numbers (this may take a moment)
  setTimeout(() => {
    const strongsNumbers = findStrongsForWord(searchWord);
    
    if (strongsNumbers.length === 0) {
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="concept-search-header">
            <strong>Search: "${escapeHtml(word)}"</strong>
            <div class="search-header-actions">
              <a href="/help#search-section" class="search-help-link" title="Search help" onclick="AppStore.dispatch({type:'SET_VIEW',view:'help'}); return false;">?</a>
              <button class="concept-search-close" onclick="closeConceptSearch()">✕</button>
            </div>
          </div>
          <div class="concept-search-empty">
            No results found for "<strong>${escapeHtml(word)}</strong>"
            <p class="search-empty-tips">
              Try a different spelling, or use <a href="/help#search-section" onclick="AppStore.dispatch({type:'SET_VIEW',view:'help'}); return false;">regex search</a> for advanced patterns.
            </p>
          </div>`;
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
    <div class="search-header-actions">
      <a href="/help#search-section" class="search-help-link" title="Search help" onclick="AppStore.dispatch({type:'SET_VIEW',view:'help'}); return false;">?</a>
      <button class="concept-search-close" onclick="closeConceptSearch()">✕</button>
    </div>
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
// Searches the currently selected translation
function findTextMatchVerses() {
  const state = conceptSearchState;
  const verseResultsContainer = document.getElementById('concept-verse-results');
  if (!verseResultsContainer) return;
  
  const searchWord = state.searchWord;
  if (!searchWord) return;
  
  const wordPattern = new RegExp(`\\b${searchWord}\\b`, 'i');
  
  setTimeout(() => {
    const allVerses = new Map();
    
    // Search current translation only
    const transData = bibleTranslations[currentTranslation];
    if (transData && transData.length > 0) {
      for (const verse of transData) {
        if (verse.text && wordPattern.test(verse.text)) {
          const ref = `${verse.book} ${verse.chapter}:${verse.verse}`;
          if (!allVerses.has(ref)) {
            allVerses.set(ref, { words: [searchWord], text: verse.text });
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
        text: data.text || '',
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
    
    // First, add all text matches from current translation (these are primary)
    if (wordPattern) {
      const transData = bibleTranslations[currentTranslation];
      if (transData && transData.length > 0) {
        for (const verse of transData) {
          if (verse.text && wordPattern.test(verse.text)) {
            const ref = `${verse.book} ${verse.chapter}:${verse.verse}`;
            if (!allVerses.has(ref)) {
              allVerses.set(ref, { strongsNums: new Set(), words: [searchWord], fromText: true, fromConcept: false, text: verse.text });
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
        text: data.text || getVerseText(ref) || '',
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
// skipDispatch: if true, don't dispatch to AppStore (used when syncing FROM state)
function closeConceptSearch(skipDispatch = false) {
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
  
  // Dispatch to AppStore for URL sync (unidirectional flow)
  if (!skipDispatch && typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_SEARCH_QUERY', searchQuery: null });
  }
}

// ============================================================================
// REGEX SEARCH - Find verses using JavaScript regular expressions
// ============================================================================

// State for regex search
let regexSearchState = {
  pattern: null,
  regex: null,
  results: [],
  isComplete: false
};

/**
 * Start a regex search across all Bible verses
 * @param {string} pattern - The regex pattern (without delimiters)
 * @param {string} flags - Regex flags (default: 'i' for case-insensitive)
 */
function startRegexSearch(pattern, flags = 'i') {
  // Show results container
  const resultsContainer = document.getElementById('concept-search-results');
  const divider = document.getElementById('search-divider');
  if (resultsContainer) {
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = '<div class="concept-search-loading">Compiling regex...</div>';
  }
  if (divider) {
    divider.style.display = 'flex';
    initSearchDivider();
  }
  
  // Try to compile the regex
  let regex;
  try {
    regex = new RegExp(pattern, flags);
  } catch (e) {
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="concept-search-header">
          <strong>Regex Error</strong>
          <div class="search-header-actions">
            <a href="/help#search-section" class="search-help-link" title="Search help" onclick="AppStore.dispatch({type:'SET_VIEW',view:'help'}); return false;">?</a>
            <button class="concept-search-close" onclick="closeConceptSearch()">✕</button>
          </div>
        </div>
        <div class="regex-error">
          <p>Invalid regular expression:</p>
          <code>/${pattern}/${flags}</code>
          <p class="regex-error-msg">${escapeHtml(e.message)}</p>
        </div>`;
    }
    return;
  }
  
  // Initialize state
  regexSearchState = {
    pattern: pattern,
    flags: flags,
    regex: regex,
    results: [],
    isComplete: false
  };
  
  // Update loading message
  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div class="concept-search-header">
        <strong>Regex: <code>/${escapeHtml(pattern)}/${flags}</code></strong>
        <div class="search-header-actions">
          <a href="/help#search-section" class="search-help-link" title="Search help" onclick="AppStore.dispatch({type:'SET_VIEW',view:'help'}); return false;">?</a>
          <button class="concept-search-close" onclick="closeConceptSearch()">✕</button>
        </div>
      </div>
      <div id="concept-verse-results" class="concept-verse-results">
        <div class="concept-search-loading">Searching...</div>
      </div>`;
  }
  
  // Run the search asynchronously to avoid blocking UI
  setTimeout(() => executeRegexSearch(), 10);
}

/**
 * Execute the regex search across all verses
 */
function executeRegexSearch() {
  const state = regexSearchState;
  const regex = state.regex;
  
  if (!regex) return;
  
  const startTime = performance.now();
  const results = [];
  
  // Search current translation
  const transData = bibleTranslations[currentTranslation];
  if (transData && transData.length > 0) {
    for (const verse of transData) {
      if (verse.text && regex.test(verse.text)) {
        const ref = `${verse.book} ${verse.chapter}:${verse.verse}`;
        
        // Find all matches for highlighting
        const matches = verse.text.match(new RegExp(state.pattern, state.flags + 'g')) || [];
        
        results.push({
          ref,
          text: verse.text,
          matches: matches,
          matchCount: matches.length
        });
      }
    }
  }
  
  const endTime = performance.now();
  const searchTime = Math.round(endTime - startTime);
  
  // Sort by book order
  results.sort((a, b) => compareVerseRefs(a.ref, b.ref));
  
  state.results = results;
  state.isComplete = true;
  state.searchTime = searchTime;
  
  // Display results
  displayRegexResults(results, 0, 50, searchTime);
}

/**
 * Display regex search results with pagination
 */
function displayRegexResults(results, startIndex, count, searchTime) {
  const container = document.getElementById('concept-verse-results');
  if (!container) return;
  
  const state = regexSearchState;
  const endIndex = Math.min(startIndex + count, results.length);
  const showing = results.slice(startIndex, endIndex);
  
  let html = `<div class="concept-verse-count">
    Found ${results.length} verse${results.length !== 1 ? 's' : ''} 
    <span class="regex-time">(${searchTime}ms)</span>
  </div>`;
  
  for (const result of showing) {
    const abbrevRef = abbreviateReference(result.ref);
    const highlightedText = highlightRegexMatches(result.text, state.regex);
    
    html += `<div class="concept-verse-item regex-result">
      <a href="#" class="concept-verse-ref" onclick="goToScriptureFromSidebar('${result.ref}'); return false;">${abbrevRef}</a>
      <span class="concept-verse-text">${highlightedText}</span>
      ${result.matchCount > 1 ? `<span class="regex-match-count">${result.matchCount} matches</span>` : ''}
    </div>`;
  }
  
  if (endIndex < results.length) {
    html += `<div class="concept-load-more-sentinel" data-next-index="${endIndex}" data-search-type="regex"></div>`;
    html += `<button class="concept-load-more-btn" onclick="loadMoreRegexResults(${endIndex})">
      Load more (${results.length - endIndex} remaining)
    </button>`;
  }
  
  container.innerHTML = html;
  
  // Set up infinite scroll observer
  const sentinel = container.querySelector('.concept-load-more-sentinel');
  if (sentinel) {
    setupRegexScrollObserver(sentinel, endIndex);
  }
}

/**
 * Load more regex results (pagination)
 */
function loadMoreRegexResults(startIndex) {
  // Disconnect observer to prevent double-loading
  if (regexScrollObserver) {
    regexScrollObserver.disconnect();
  }
  
  const results = regexSearchState.results;
  if (!results || startIndex >= results.length) return;
  
  const container = document.getElementById('concept-verse-results');
  if (!container) return;
  
  // Remove the sentinel and load more button
  const sentinel = container.querySelector('.concept-load-more-sentinel');
  const loadMoreBtn = container.querySelector('.concept-load-more-btn');
  if (sentinel) sentinel.remove();
  if (loadMoreBtn) loadMoreBtn.remove();
  
  // Append new results
  const state = regexSearchState;
  const endIndex = Math.min(startIndex + 50, results.length);
  const showing = results.slice(startIndex, endIndex);
  
  let html = '';
  for (const result of showing) {
    const abbrevRef = abbreviateReference(result.ref);
    const highlightedText = highlightRegexMatches(result.text, state.regex);
    
    html += `<div class="concept-verse-item regex-result">
      <a href="#" class="concept-verse-ref" onclick="goToScriptureFromSidebar('${result.ref}'); return false;">${abbrevRef}</a>
      <span class="concept-verse-text">${highlightedText}</span>
      ${result.matchCount > 1 ? `<span class="regex-match-count">${result.matchCount} matches</span>` : ''}
    </div>`;
  }
  
  if (endIndex < results.length) {
    html += `<div class="concept-load-more-sentinel" data-next-index="${endIndex}" data-search-type="regex"></div>`;
    html += `<button class="concept-load-more-btn" onclick="loadMoreRegexResults(${endIndex})">
      Load more (${results.length - endIndex} remaining)
    </button>`;
  }
  
  container.insertAdjacentHTML('beforeend', html);
  
  // Set up new observer for the new sentinel
  const newSentinel = container.querySelector('.concept-load-more-sentinel');
  if (newSentinel) {
    setupRegexScrollObserver(newSentinel, endIndex);
  }
}

// Observer for regex infinite scroll
let regexScrollObserver = null;

function setupRegexScrollObserver(sentinel, nextIndex) {
  // Clean up previous observer
  if (regexScrollObserver) {
    regexScrollObserver.disconnect();
  }
  
  regexScrollObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        loadMoreRegexResults(nextIndex);
      }
    }
  }, {
    root: document.getElementById('concept-search-results'),
    rootMargin: '100px',
    threshold: 0
  });
  
  regexScrollObserver.observe(sentinel);
}

/**
 * Highlight regex matches in text
 */
function highlightRegexMatches(text, regex) {
  if (!text || !regex) return text;
  
  // Escape HTML first, then apply highlights
  let escaped = escapeHtml(text);
  
  // Create a global version of the regex for replacement
  const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  
  // Highlight matches - need to be careful with HTML escaping
  // We'll use a placeholder approach to avoid issues
  const matches = [];
  let match;
  while ((match = globalRegex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0]
    });
    // Prevent infinite loop for zero-length matches
    if (match[0].length === 0) globalRegex.lastIndex++;
  }
  
  // Apply highlights in reverse order to preserve indices
  if (matches.length > 0) {
    let result = text;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      result = result.slice(0, m.start) + 
               '<mark>' + escapeHtml(m.text) + '</mark>' + 
               result.slice(m.end);
    }
    return result;
  }
  
  return escaped;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

// Single source of truth: find symbol for a Strong's entry so panel always shows symbol when associated
function getSymbolForStrongsEntry(strongsNum, entry, englishWord) {
  let symbol = (typeof lookupSymbolByStrongs === 'function') ? lookupSymbolByStrongs(strongsNum) : null;

  if (!symbol && typeof SYMBOL_DICTIONARY !== 'undefined' && typeof getStrongsEntry === 'function') {
    for (const [symbolKey, sym] of Object.entries(SYMBOL_DICTIONARY)) {
      if (sym.strongs) {
        for (const symStrongs of sym.strongs) {
          const symEntry = getStrongsEntry(symStrongs);
          if (symEntry && symEntry.derivation) {
            const normalized = normalizeStrongsNum(strongsNum);
            if (symEntry.derivation.includes(normalized) || symEntry.derivation.includes(strongsNum)) {
              symbol = sym;
              break;
            }
          }
        }
        if (symbol) break;
      }
    }
  }

  if (!symbol && entry && entry.derivation && typeof lookupSymbolByStrongs === 'function') {
    const derivationMatch = entry.derivation.match(/H\d+|G\d+/g);
    if (derivationMatch) {
      for (const derivedStrongs of derivationMatch) {
        symbol = lookupSymbolByStrongs(derivedStrongs);
        if (symbol) break;
      }
    }
  }

  if (!symbol && typeof lookupSymbolByWord !== 'function') return symbol;

  // Collect all candidate words (passed word, lemma, KJV def words) and try each + variations
  const candidates = new Set();
  if (englishWord) {
    const w = String(englishWord).toLowerCase().replace(/[.,;:!?'"()]/g, '');
    if (w.length > 1) candidates.add(w);
  }
  if (entry && entry.lemma) {
    const w = String(entry.lemma).toLowerCase().replace(/[.,;:!?'"()]/g, '');
    if (w.length > 1) candidates.add(w);
  }
  if (entry && entry.kjv_def) {
    const kjvDefLower = entry.kjv_def.toLowerCase();
    const words = kjvDefLower.replace(/[^\w\s-]/g, ' ').split(/[\s-]+/).filter(w => w.length > 2);
    words.forEach(w => candidates.add(w));
  }

  for (const word of candidates) {
    symbol = lookupSymbolByWord(word);
    if (symbol) return symbol;
    const base = word.replace(/(ful|less|ly|ing|ed|s)$/, '');
    if (base.length > 2 && base !== word) {
      symbol = lookupSymbolByWord(base);
      if (symbol) return symbol;
    }
    if (word.endsWith('s') && word.length > 3) {
      symbol = lookupSymbolByWord(word.slice(0, -1));
      if (symbol) return symbol;
    }
    if (!word.endsWith('s') && word.length > 2) {
      symbol = lookupSymbolByWord(word + 's');
      if (symbol) return symbol;
    }
  }
  return symbol;
}

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
// Uses AppStore for unidirectional flow - URL updates and browser back works
function navigateToStrongs(strongsNum, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  // Dispatch to AppStore - this updates state, which triggers URL update
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_STRONGS_ID', strongsId: strongsNum });
  } else {
    // Fallback for when AppStore isn't available (shouldn't happen)
    updateStrongsPanelContent(strongsNum);
  }
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
  
  // Use same symbol lookup as main panel so symbol always shows when associated
  const symbol = getSymbolForStrongsEntry(strongsNum, entry, null);
  if (symbol) {
    const symbolKey = Object.keys(SYMBOL_DICTIONARY || {}).find(k => SYMBOL_DICTIONARY[k] === symbol) || '';
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
        <button class="strongs-symbol-link" onclick="openSymbolStudyInReader('${symbolKey}')">Full Symbol Study →</button>
      </div>
    `;
  }
  
  // Add word study if available for this Strong's number
  const wordStudy = (typeof lookupWordStudy === 'function') ? lookupWordStudy(strongsNum) : null;
  if (wordStudy) {
    html += renderWordStudyHtml(wordStudy);
  }
  
  // Add gematria section (if data is loaded) — derive expanded state from AppStore
  const gematriaExp1 = typeof AppStore !== 'undefined' ? AppStore.getState().ui.gematriaExpanded : false;
  if (gematriaData) {
    html += renderGematriaSection(strongsNum, gematriaExp1);
  }
  
  // Add verse search section
  html += `
    <div class="strongs-verse-search">
      <button id="strongs-find-verses-btn" class="strongs-find-verses-btn" onclick="toggleVerseSearch('${strongsNum}')">Find all verses →</button>
      <div id="strongs-verse-results" class="strongs-verse-results" style="display: none;"></div>
    </div>
  `;
  
  contentEl.innerHTML = html;
  
  // Load gematria data if not loaded, then update section
  if (!gematriaData) {
    loadGematriaData().then(() => {
      // Guard: check if gematria section already exists (avoid duplicate)
      if (contentEl.querySelector('.strongs-gematria-section')) return;
      
      const gematriaSection = renderGematriaSection(strongsNum, gematriaExp1);
      if (gematriaSection) {
        const verseSearch = contentEl.querySelector('.strongs-verse-search');
        if (verseSearch) {
          verseSearch.insertAdjacentHTML('beforebegin', gematriaSection);
        }
      }
    });
  }
}

// Show Strong's information slide-out for a word
// skipDispatch: if true, don't dispatch to AppStore (used when syncing FROM state)
function showStrongsPanel(strongsNum, englishWord, gloss, event, skipDispatch = false) {
  if (event) event.stopPropagation();
  
  // Use the sidebar element from HTML
  const sidebar = document.getElementById('strongs-sidebar');
  if (!sidebar) return;
  
  const isNewPanel = !sidebar.classList.contains('open');
  
  if (isNewPanel) {
    // Reset history for new panel
    strongsHistory = [strongsNum];
    strongsHistoryIndex = 0;
    
    // Build sidebar content (no back/forward here — use top header)
    sidebar.innerHTML = `
      <div class="strongs-sidebar-resize" onmousedown="startStrongsResize(event)"></div>
      <div class="strongs-sidebar-header">
        <div class="strongs-sidebar-title">${strongsNum}</div>
        <button class="strongs-sidebar-close" onclick="closeStrongsPanel()">✕</button>
      </div>
      <div class="strongs-sidebar-content"></div>
    `;
    
    // Restore user's saved width if any
    try {
      const saved = localStorage.getItem('strongs-sidebar-width');
      if (saved) sidebar.style.width = saved;
    } catch (e) {}
    
    // Animate open (body class raises stacking context so overlay is above word/hebrew tooltips)
    requestAnimationFrame(() => {
      sidebar.classList.add('open');
      document.body.classList.add('strongs-sidebar-open');
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
  
  // Add symbolic meaning when this Strong's is associated with a symbol (same logic for all entry paths)
  const symbol = getSymbolForStrongsEntry(strongsNum, entry, englishWord);
  if (symbol) {
    const symbolKey = Object.keys(SYMBOL_DICTIONARY || {}).find(k => SYMBOL_DICTIONARY[k] === symbol) || '';
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
        <button class="strongs-symbol-link" onclick="openSymbolStudyInReader('${symbolKey}')">Full Symbol Study →</button>
      </div>
    `;
  }
  
  // Add person/place info if available (show all matching entries)
  const allPersonInfo = getAllPersonInfo(strongsNum);
  if (allPersonInfo.length > 0) {
    html += renderPersonInfoHtml(allPersonInfo);
  }
  
  // Add word study if available for this Strong's number
  const wordStudy = (typeof lookupWordStudy === 'function') ? lookupWordStudy(strongsNum) : null;
  if (wordStudy) {
    html += renderWordStudyHtml(wordStudy);
  }
  
  // Add gematria section (if data is loaded) — derive expanded state from AppStore
  const gematriaExp2 = typeof AppStore !== 'undefined' ? AppStore.getState().ui.gematriaExpanded : false;
  if (gematriaData) {
    html += renderGematriaSection(strongsNum, gematriaExp2);
  }
  
  // Add verse search section
  html += `
    <div class="strongs-verse-search">
      <button id="strongs-find-verses-btn" class="strongs-find-verses-btn" onclick="toggleVerseSearch('${strongsNum}')">Find all verses →</button>
      <div id="strongs-verse-results" class="strongs-verse-results" style="display: none;"></div>
    </div>
  `;
  
  contentEl.innerHTML = html;
  
  // Load gematria data if not loaded, then update section
  if (!gematriaData) {
    loadGematriaData().then(() => {
      // Guard: check if gematria section already exists (avoid duplicate)
      if (contentEl.querySelector('.strongs-gematria-section')) return;
      
      const gematriaSection = renderGematriaSection(strongsNum, gematriaExp2);
      if (gematriaSection) {
        const verseSearch = contentEl.querySelector('.strongs-verse-search');
        if (verseSearch) {
          verseSearch.insertAdjacentHTML('beforebegin', gematriaSection);
        }
      }
    });
  }
  
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
  
  // Dispatch to AppStore for URL sync (unidirectional flow)
  if (!skipDispatch && typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_STRONGS_ID', strongsId: strongsNum });
  }
}

// Close Strong's sidebar
function closeStrongsPanel(skipDispatch = false) {
  const sidebar = document.getElementById('strongs-sidebar');
  if (sidebar) {
    sidebar.classList.remove('open', 'collapsed');
    sidebar.innerHTML = '';
    document.body.classList.remove('strongs-sidebar-open');
  }
  // Reset history
  strongsHistory = [];
  strongsHistoryIndex = -1;
  
  // Update state to remove strongsId from URL (unless called from URL sync)
  if (!skipDispatch && typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_STRONGS_ID', strongsId: null });
  }
}

// Resize functionality for Strong's sidebar
let isResizing = false;

function startStrongsResize(event) {
  event.preventDefault();
  isResizing = true;
  const sidebar = document.getElementById('strongs-sidebar');
  if (sidebar) sidebar.classList.add('resizing');
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
  const sidebar = document.getElementById('strongs-sidebar');
  if (sidebar) {
    sidebar.classList.remove('resizing');
    localStorage.setItem('strongs-sidebar-width', sidebar.style.width);
  }
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  
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
      onclick = `handleStrongsWordClick('${entry.s}', '${escapedWord}', '${escapedGloss}', event)`;
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
      if (entry) {
        dataAttrs.push(`data-strongs="${entry.s}"`);
        // Look up actual Strong's definition from dictionary
        const strongsEntry = getStrongsEntry(entry.s);
        const realDef = strongsEntry?.strongs_def || strongsEntry?.kjv_def || '';
        dataAttrs.push(`data-def="${realDef.replace(/"/g, '&quot;')}"`);
      }
      if (symbol) {
        dataAttrs.push(`data-symbol="${symbol.name}"`);
        dataAttrs.push(`data-symbol-meaning="${(symbol.is2 || symbol.is || '').replace(/"/g, '&quot;')}"`);
      }
      
      return `<span class="${classes.join(' ')}" ${dataAttrs.join(' ')} onclick="${onclick}" onmouseenter="showWordTooltip(event)" onmouseleave="hideWordTooltip(event)">${match}</span>`;
    }
    
    return match;
  });
  
  return result;
}

// Apply symbol highlighting to text (for verses without interlinear data)
function applySymbolHighlighting(text) {
  if (!text || typeof lookupSymbolByWord !== 'function') return text;
  
  let result = text;
  
  // First pass: Match multi-word phrases (longest first)
  if (typeof getMultiWordSymbolPhrases === 'function') {
    const multiWordPhrases = getMultiWordSymbolPhrases();
    for (const { phrase, symbol, key } of multiWordPhrases) {
      // Create case-insensitive regex for the phrase, matching word boundaries
      const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b(${escapedPhrase})\\b`, 'gi');
      result = result.replace(regex, (match) => {
        // Skip if already wrapped
        if (match.includes('<span') || match.includes('</span>')) return match;
        return `<span class="symbol-word" data-symbol="${symbol.name}" onclick="showSymbolPanel('${key}', '${phrase}', event)">${match}</span>`;
      });
    }
  }
  
  // Second pass: Match single words (that aren't already wrapped)
  result = result.replace(/(\S+)/g, (match) => {
    // Skip if already wrapped in a span (from multi-word pass or annotations)
    if (match.includes('<span') || match.includes('</span>')) return match;
    
    const normalized = match.toLowerCase().replace(/[.,;:!?'"()]/g, '');
    const symbol = lookupSymbolByWord(normalized);
    
    if (symbol) {
      const symbolKey = Object.keys(SYMBOL_DICTIONARY).find(k => SYMBOL_DICTIONARY[k] === symbol) || '';
      return `<span class="symbol-word" data-symbol="${symbol.name}" onclick="showSymbolPanel('${symbolKey}', '${normalized}', event)">${match}</span>`;
    }
    
    return match;
  });
  
  return result;
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
    getBibleTooltipPortal().appendChild(popup);
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
  
  // Position near the clicked icon first so it drops down in place (no sliding across screen)
  if (event && event.target) {
    const rect = event.target.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 5;
    const popupWidth = 280;
    if (left + popupWidth > window.innerWidth - 10) {
      left = window.innerWidth - popupWidth - 10;
    }
    if (left < 10) left = 10;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }
  popup.classList.add('visible');
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
  
  // Yield to main thread occasionally so UI stays responsive (fewer yields = faster total parse)
  const CHUNK_SIZE = 8000;
  
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
  // Normalize to canonical id so we always hit the same cache key (e.g. 'KJV' -> 'kjv')
  const id = (translationId || '').toLowerCase();
  let config = BIBLE_TRANSLATIONS[id];
  if (!config) {
    config = Object.values(BIBLE_TRANSLATIONS).find(c => c.name === (translationId || '').toUpperCase() || c.id === id);
  }
  if (!config) {
    console.warn(`Unknown translation: ${translationId}`);
    return false;
  }
  const canonicalId = config.id;
  
  // Sync so we see latest cache (e.g. from loadAllTranslations or previous load)
  syncLegacyVariables();
  
  // Load if not in cache; never show overlay when switching/back (only initBibleExplorer shows it)
  if (!bibleTranslations[canonicalId]) {
    await loadTranslation(canonicalId, false);
  }
  
  if (!bibleTranslations[canonicalId]) {
    console.warn(`Failed to load ${config.name}`);
    return false;
  }
  
  // Switch current translation
  currentTranslation = canonicalId;
  syncLegacyVariables();
  
  // Save preference
  try {
    localStorage.setItem('bible_translation_preference', canonicalId);
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
          book: (typeof normalizeBookName === 'function' ? normalizeBookName(book.trim()) : book.trim()),
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
            book: (typeof normalizeBookName === 'function' ? normalizeBookName(book.trim()) : book.trim()),
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
              book: (typeof normalizeBookName === 'function' ? normalizeBookName(book.trim()) : book.trim()),
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
          book: (typeof normalizeBookName === 'function' ? normalizeBookName(book.trim()) : book.trim()),
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
            book: (typeof normalizeBookName === 'function' ? normalizeBookName(book.trim()) : book.trim()),
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

// Check if a citation string contains multiple references (for routing to multiverse view)
function isMultiVerseCitation(citationStr) {
  if (!citationStr || typeof citationStr !== 'string') return false;
  const parsed = parseCitation(citationStr);
  return parsed.length > 1;
}

// Build HTML for multiverse view: selected verses with Strongs, symbols, and verse numbers that link to full chapter
function buildMultiverseHTML(citationStr) {
  if (!bibleData) return '<div class="bible-explorer-welcome"><p>Bible data not loaded.</p></div>';
  const verses = getVersesForCitationString(citationStr);
  if (!verses || verses.length === 0) {
    return '<div class="bible-explorer-welcome"><p>No verses found for this reference.</p></div>';
  }
  const trans = (typeof currentTranslation !== 'undefined' && currentTranslation) || 'kjv';
  let html = '<div class="bible-explorer-chapter bible-multiverse">';
  html += `<div class="bible-explorer-chapter-header">
    <h2>Multi-verse</h2>
    <div class="chapter-subtitle">${escapeHtml(citationStr)}</div>
  </div>`;
  let currentBook = '';
  let currentChapter = -1;
  for (const verse of verses) {
    if (verse.isSeparator) {
      html += '<div class="bible-chapter-separator"></div>';
      currentChapter = -1;
      continue;
    }
    const bookName = verse.book;
    const chapter = verse.chapter;
    if (bookName !== currentBook || chapter !== currentChapter) {
      if (currentBook !== '') html += '</div>';
      currentBook = bookName;
      currentChapter = chapter;
      html += `<div class="bible-multiverse-section">`;
      html += `<div class="bible-multiverse-section-header">${escapeHtml(bookName)} ${chapter}</div>`;
      html += '<div class="bible-multiverse-verses">';
    }
    const reference = `${bookName} ${chapter}:${verse.verse}`;
    const isNT = isNTBook(bookName);
    const hasInterlinearData = (isNT ? ntInterlinearData : interlinearData);
    const hasOriginalLang = hasInterlinear(bookName);
    const origLangClass = hasOriginalLang ? ' has-hebrew' : '';
    let verseText;
    if (hasOriginalLang && hasInterlinearData) {
      verseText = renderVerseWithStrongs(bookName, chapter, verse.verse, verse.text);
    } else {
      verseText = applySymbolHighlighting(applyVerseAnnotations(reference, verse.text));
    }
    const bookRefs = (typeof getBookReferences === 'function') ? getBookReferences(bookName, chapter, verse.verse) : null;
    const bookRefHtml = bookRefs && bookRefs.length > 0
      ? `<span class="verse-book-ref" onclick="showBookRefPopup('${bookName}', ${chapter}, ${verse.verse}, event)" title="Referenced in A Time Tested Tradition">📖</span>`
      : `<span class="verse-book-ref-spacer"></span>`;
    const hasCrossRefs = (typeof hasCrossReferences === 'function') ? hasCrossReferences(bookName, chapter, verse.verse) : false;
    const crossRefHtml = hasCrossRefs
      ? `<span class="verse-cross-ref" onclick="showCrossRefPanel('${bookName}', ${chapter}, ${verse.verse}, event)" title="Cross References">🔗</span>`
      : `<span class="verse-cross-ref-spacer"></span>`;
    const tlData = (typeof getVerseTimelineEvents === 'function') ? getVerseTimelineEvents(bookName, chapter, verse.verse) : null;
    let timelineHtml;
    if (tlData && tlData.events.length > 0) {
      const ev = tlData.events[0];
      const title = (ev.title || '').replace(/📅\s*/g, '');
      const dateStr = (typeof _formatEventDate === 'function' && tlData.date) ? _formatEventDate(tlData.date) : '';
      const tipText = dateStr ? `${title} — ${dateStr}` : title;
      timelineHtml = `<span class="verse-timeline-ref" data-tip="${(tipText || '').replace(/"/g, '&quot;')}" onclick="navigateToVerseEvent('${ev.id}', event)"><img src="/assets/img/timeline_icon.png" alt="Timeline" class="verse-timeline-icon"></span>`;
    } else {
      timelineHtml = `<span class="verse-timeline-ref-spacer"></span>`;
    }
    const mvVerseId = 'mv-' + (bookName.replace(/\s+/g, '-')) + '-' + chapter + '-' + verse.verse;
    const interlinearTitle = hasOriginalLang ? (isNT ? 'Compare translations / Greek interlinear' : 'Compare translations / Hebrew interlinear') : 'Compare translations';
    const interlinearBtn = `<span class="verse-interlinear-ref" onclick="showInterlinear('${bookName.replace(/'/g, "\\'")}', ${chapter}, ${verse.verse}, event, '${mvVerseId}')" title="${interlinearTitle}">☰</span>`;
    const verseNumSpan = `<span class="bible-verse-number${hasOriginalLang ? ' clickable-hebrew' : ''}" onclick="goToChapterFromMultiverse('${bookName.replace(/'/g, "\\'")}', ${chapter}, ${verse.verse})" title="Open ${bookName} ${chapter}:${verse.verse}">${verse.verse}</span>`;
    html += `<div class="bible-explorer-verse${origLangClass}" id="${mvVerseId}" data-book="${escapeHtml(bookName)}" data-chapter="${chapter}" data-verse="${verse.verse}">
      <div class="verse-meta">${bookRefHtml}${crossRefHtml}${timelineHtml}${interlinearBtn}${verseNumSpan}</div>
      <span class="bible-verse-text">${verseText}</span>
    </div>`;
  }
  if (currentBook !== '') html += '</div></div>';
  html += '</div>';
  return html;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Navigate from multiverse verse number to full chapter view at that verse
function goToChapterFromMultiverse(bookName, chapter, verse) {
  if (typeof AppStore !== 'undefined') {
    const translation = (typeof currentTranslation !== 'undefined' && currentTranslation) || 'kjv';
    AppStore.dispatch({
      type: 'SET_VIEW',
      view: 'reader',
      params: { contentType: 'bible', translation, book: bookName, chapter, verse }
    });
  }
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

// Handle click on citation link — navigate via SPA router (single verse → chapter; multi → multiverse)
function handleCitationClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const el = event.target.closest('[data-citation]');
  const citation = el?.dataset.citation;
  if (!citation) return;
  
  if (typeof isMultiVerseCitation === 'function' && isMultiVerseCitation(citation)) {
    if (typeof AppStore !== 'undefined') {
      const translation = (typeof currentTranslation !== 'undefined' && currentTranslation) || 'kjv';
      AppStore.dispatch({
        type: 'SET_VIEW',
        view: 'reader',
        params: { contentType: 'multiverse', multiverse: citation, translation }
      });
    }
    return;
  }
  
  // Single reference: go to chapter/verse
  const match = citation.match(/^(.+?)\s+(\d+)(?::(\d+))?/);
  if (!match) return;
  
  const book = (typeof normalizeBookName === 'function' ? normalizeBookName(match[1]) : match[1]);
  const chapter = parseInt(match[2]);
  const verse = match[3] ? parseInt(match[3]) : undefined;
  const translation = (typeof currentTranslation !== 'undefined' && currentTranslation) || 'kjv';
  
  if (typeof AppStore !== 'undefined') {
    const params = { contentType: 'bible', translation, book, chapter };
    if (verse) params.verse = verse;
    AppStore.dispatch({ type: 'SET_VIEW', view: 'reader', params });
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

// Make a citation string clickable (single ref → chapter URL; multi ref → handleCitationClick opens multiverse)
function makeCitationClickable(citationStr, title = '') {
  const url = buildBibleUrl(citationStr);
  const citationEscaped = (citationStr || '').replace(/"/g, '&quot;');
  const titleEscaped = (title || '').replace(/"/g, '&quot;');
  return `<a href="${url}" class="bible-citation-link" data-citation="${citationEscaped}" data-title="${titleEscaped}" onclick="handleCitationClick(event)">${escapeHtml(citationStr)}</a>`;
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

// Cache for rendered chapter HTML to avoid re-generating on back navigation
// Key format: "translation:book:chapter" -> HTML string
const chapterHTMLCache = new Map();

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
  
  // Sync from cache so we don't reload or show "Downloading..." if already loaded
  syncLegacyVariables();
  
  // Populate translation dropdown
  populateTranslationDropdown();
  
  if (!bibleData) {
    // Only show loading dialog when user is actually viewing Bible; else load in background
    const state = typeof AppStore !== 'undefined' ? AppStore.getState() : {};
    const contentType = state?.content?.params?.contentType || 'bible';
    const showDialog = contentType === 'bible';
    loadTranslation(currentTranslation, showDialog).then(() => {
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
  
  // Dispatch to AppStore to update URL (unidirectional flow)
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({
      type: 'UPDATE_VIEW_PARAMS',
      params: { translation: translationId }
    });
  }
  
  // Also call switchTranslation directly to update local state and re-render
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
        
        <div class="bible-translation-card" onclick="selectTranslationAndStart('lxx')">
          <div class="translation-card-icon">🏛️</div>
          <div class="translation-card-content">
            <h4>Septuagint (LXX)</h4>
            <span class="translation-card-year">~250 BC</span>
            <p>The ancient Greek translation of the Hebrew scriptures, quoted extensively by New Testament authors. Brenton's English translation includes the deuterocanonical books.</p>
            <div class="translation-card-traits">
              <span class="trait">Ancient</span>
              <span class="trait">Greek OT</span>
              <span class="trait">Apostolic</span>
            </div>
          </div>
        </div>
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
  // Update state FIRST (state before render)
  bibleExplorerState.currentBook = bookName;
  bibleExplorerState.currentChapter = 1;  // Reset to chapter 1 when changing books
  
  // Update book dropdown selection
  const bookSelect = document.getElementById('bible-book-select');
  if (bookSelect) {
    bookSelect.value = bookName;
  }
  
  // Update chapter dropdown (now uses currentChapter = 1)
  updateChapterDropdown(bookName);
  
  // Display chapter 1
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

// Build chapter HTML (sync, for LCP: call with useInterlinear=false to paint immediately)
function buildChapterHTML(bookName, chapter, verses, useInterlinear) {
  const isNT = isNTBook(bookName);
  const hasInterlinearData = useInterlinear && (isNT ? ntInterlinearData : interlinearData);
  const hasOriginalLang = hasInterlinear(bookName);
  const origLangClass = hasOriginalLang ? ' has-hebrew' : '';
  const interlinearTitle = isNTBook(bookName) ? 'Click to show interlinear Greek' : 'Click to show interlinear Hebrew';
  let html = '<div class="bible-explorer-chapter">';
  html += `<div class="bible-explorer-chapter-header">
    <h2>${bookName}</h2>
    <div class="chapter-subtitle">Chapter ${chapter}</div>
  </div>`;
  for (const verse of verses) {
    const reference = `${bookName} ${chapter}:${verse.verse}`;
    let verseText;
    if (hasOriginalLang && hasInterlinearData) {
      verseText = renderVerseWithStrongs(bookName, chapter, verse.verse, verse.text);
    } else {
      verseText = applySymbolHighlighting(applyVerseAnnotations(reference, verse.text));
    }
    const bookRefs = (typeof getBookReferences === 'function') ? getBookReferences(bookName, chapter, verse.verse) : null;
    const bookRefHtml = bookRefs && bookRefs.length > 0
      ? `<span class="verse-book-ref" onclick="showBookRefPopup('${bookName}', ${chapter}, ${verse.verse}, event)" title="Referenced in A Time Tested Tradition">📖</span>`
      : `<span class="verse-book-ref-spacer"></span>`;
    const hasCrossRefs = (typeof hasCrossReferences === 'function') ? hasCrossReferences(bookName, chapter, verse.verse) : false;
    const crossRefHtml = hasCrossRefs
      ? `<span class="verse-cross-ref" onclick="showCrossRefPanel('${bookName}', ${chapter}, ${verse.verse}, event)" title="Cross References">🔗</span>`
      : `<span class="verse-cross-ref-spacer"></span>`;
    const tlData = (typeof getVerseTimelineEvents === 'function') ? getVerseTimelineEvents(bookName, chapter, verse.verse) : null;
    let timelineHtml;
    if (tlData && tlData.events.length > 0) {
      const ev = tlData.events[0];
      const title = (ev.title || '').replace(/📅\s*/g, '');
      const dateStr = (typeof _formatEventDate === 'function' && tlData.date) ? _formatEventDate(tlData.date) : '';
      const tipText = dateStr ? `${title} — ${dateStr}` : title;
      timelineHtml = `<span class="verse-timeline-ref" data-tip="${tipText.replace(/"/g, '&quot;')}" onclick="navigateToVerseEvent('${ev.id}', event)"><img src="/assets/img/timeline_icon.png" alt="Timeline" class="verse-timeline-icon"></span>`;
    } else {
      timelineHtml = `<span class="verse-timeline-ref-spacer"></span>`;
    }
    const verseNumSpan = `<span class="bible-verse-number${hasOriginalLang ? ' clickable-hebrew' : ''}" onclick="${hasOriginalLang ? `showInterlinear('${bookName}', ${chapter}, ${verse.verse}, event)` : `copyVerseReference('${bookName}', ${chapter}, ${verse.verse})`}" title="${hasOriginalLang ? interlinearTitle : 'Click to copy reference'}">${verse.verse}</span>`;
    html += `<div class="bible-explorer-verse${origLangClass}" id="verse-${verse.verse}">
      <div class="verse-meta">${bookRefHtml}${crossRefHtml}${timelineHtml}${verseNumSpan}</div>
      <span class="bible-verse-text">${verseText}</span>
    </div>`;
  }
  html += `
    <div class="bible-chapter-nav bible-chapter-nav-in-content">
      <button type="button" id="bible-prev-chapter" class="bible-nav-btn" onclick="prevBibleChapter()" title="Previous chapter">◁ Prev</button>
      <button type="button" id="bible-next-chapter" class="bible-nav-btn" onclick="nextBibleChapter()" title="Next chapter">Next ▷</button>
    </div>
  </div>`;
  return html;
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
  
  // Check cache first - key is translation:book:chapter
  const cacheKey = `${currentTranslation}:${bookName}:${chapter}`;
  let html = chapterHTMLCache.get(cacheKey);
  const isNT = isNTBook(bookName);
  const hasInterlinearData = isNT ? ntInterlinearData : interlinearData;
  const needsInterlinear = (isNT && !ntInterlinearData) || (!isNT && hasHebrewText(bookName) && !interlinearData);
  
  if (!html) {
    // Paint immediately for LCP: build with or without Strong's based on what we have (do not await interlinear)
    html = buildChapterHTML(bookName, chapter, verses, !!hasInterlinearData);
    textContainer.innerHTML = html;
    // If interlinear is needed but not loaded, load in background and re-render when ready
    if (needsInterlinear) {
      if (highlightVerse) {
        const verseEl = document.getElementById(`verse-${highlightVerse}`);
        if (verseEl) verseEl.classList.add('highlighted');
      }
      if (typeof updateChapterNavigation === 'function') updateChapterNavigation();
      if (highlightVerse) {
        setTimeout(() => {
          const verseEl = document.getElementById(`verse-${highlightVerse}`);
          if (verseEl) verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        textContainer.scrollTop = 0;
      }
      bibleExplorerState.currentBook = bookName;
      bibleExplorerState.currentChapter = chapter;
      bibleExplorerState.highlightedVerse = highlightVerse;
      const loadPromise = isNT ? loadNTInterlinear() : loadInterlinear();
      loadPromise.then(() => {
        if (bibleExplorerState.currentBook !== bookName || bibleExplorerState.currentChapter !== chapter) return;
        const fullHtml = buildChapterHTML(bookName, chapter, verses, true);
        chapterHTMLCache.set(cacheKey, fullHtml);
        const el = document.getElementById('bible-explorer-text');
        if (el) el.innerHTML = fullHtml;
        if (highlightVerse) {
          const verseEl = document.getElementById(`verse-${highlightVerse}`);
          if (verseEl) verseEl.classList.add('highlighted');
        }
        if (typeof updateChapterNavigation === 'function') updateChapterNavigation();
      }).catch(() => {});
      return;
    }
    chapterHTMLCache.set(cacheKey, html);
  } else {
    textContainer.innerHTML = html;
  }
  
  // Apply verse highlighting after inserting HTML (since highlight can change without re-render)
  if (highlightVerse) {
    const verseEl = document.getElementById(`verse-${highlightVerse}`);
    if (verseEl) {
      verseEl.classList.add('highlighted');
    }
  }
  
  // Update prev/next button states
  if (typeof updateChapterNavigation === 'function') {
    updateChapterNavigation();
  }
  
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

// Smart search - handles verse references, regex patterns, and concept searches
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
  
  // Check if it's a regex pattern: /pattern/ or /pattern/flags
  const regexMatch = searchText.match(/^\/(.+)\/([gimsuy]*)$/);
  if (regexMatch) {
    const pattern = regexMatch[1];
    const flags = regexMatch[2] || 'i'; // Default to case-insensitive
    startRegexSearch(pattern, flags);
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
    alert('Enter a verse (e.g., "John 3:16"), a word, or a regex (e.g., "/pattern/i")');
  }
}

// Legacy function - now redirects to smart search
function jumpToVerse() {
  smartBibleSearch();
}

// Toggle search expansion on mobile, or search if already expanded
function toggleOrSearch() {
  const container = document.getElementById('bible-search-container');
  const input = document.getElementById('bible-explorer-search-input');
  if (!container || !input) {
    smartBibleSearch();
    return;
  }
  
  // Check if we're on a small screen where search collapses
  const isCollapsible = window.innerWidth <= 480;
  
  if (!isCollapsible) {
    // On larger screens, just search
    smartBibleSearch();
    return;
  }
  
  // On small screens, toggle expansion
  if (container.classList.contains('expanded')) {
    // Already expanded - do the search
    if (input.value.trim()) {
      smartBibleSearch();
    } else {
      // Empty search, collapse it
      container.classList.remove('expanded');
    }
  } else {
    // Expand the search
    container.classList.add('expanded');
    input.focus();
  }
}

// Collapse search if empty when losing focus
function collapseSearchIfEmpty() {
  const container = document.getElementById('bible-search-container');
  const input = document.getElementById('bible-explorer-search-input');
  if (!container || !input) return;
  
  // Small delay to allow click on button to register
  setTimeout(() => {
    if (!input.value.trim() && window.innerWidth <= 480) {
      container.classList.remove('expanded');
    }
  }, 200);
}

// Parse a search citation string
// Only returns a book if a chapter number is also present
// (e.g., "John 3" or "John 3:16" is a citation, but "John" alone is a text search)
function parseSearchCitation(str) {
  // Pattern: Book Chapter:Verse or Book Chapter
  // Requires at least a chapter number to be considered a scripture citation
  const match = str.match(/^(.+?)\s+(\d+)(?::(\d+))?/);
  
  if (match) {
    return {
      book: match[1].trim(),
      chapter: parseInt(match[2]),
      verse: match[3] ? parseInt(match[3]) : null
    };
  }
  
  // Just a book name without chapter = treat as text search, not citation
  // This way "John" does a text search, but "John 1" goes to John chapter 1
  return { book: null, chapter: null, verse: null };
}

// Open Bible Explorer to a specific location (URL/content-driven: set selectors and content directly)
function openBibleExplorerTo(book, chapter, verse = null) {
  const normalizedBook = normalizeBookName(book);
  
  // Navigate to Bible Explorer if not already there
  if (typeof navigateTo === 'function') {
    navigateTo('bible-explorer');
  }
  
  // No delay when already initialized (book in counts); 200ms only to wait for init
  const delay = bibleExplorerState.bookChapterCounts && bibleExplorerState.bookChapterCounts[normalizedBook] ? 0 : 200;
  setTimeout(() => {
    if (!bibleExplorerState.bookChapterCounts[normalizedBook]) return;
    
    // Set state first so dropdowns reflect URL
    bibleExplorerState.currentBook = normalizedBook;
    bibleExplorerState.currentChapter = chapter;
    bibleExplorerState.highlightedVerse = verse;
    
    // Ensure book dropdown is populated and selected to match URL
    populateBibleBooks();
    const bookSelect = document.getElementById('bible-book-select');
    if (bookSelect) bookSelect.value = normalizedBook;
    
    // Populate and set chapter dropdown (uses currentChapter for selected)
    updateChapterDropdown(normalizedBook);
    const chapterSelect = document.getElementById('bible-chapter-select');
    if (chapterSelect) {
      chapterSelect.value = String(chapter);
      chapterSelect.disabled = false;
    }
    
    // Push this location to history so in-view back/forward work
    const current = bibleExplorerState.history[bibleExplorerState.historyIndex];
    const isSame = current && current.book === normalizedBook && current.chapter === chapter;
    if (!isSame) {
      if (bibleExplorerState.historyIndex < bibleExplorerState.history.length - 1) {
        bibleExplorerState.history = bibleExplorerState.history.slice(0, bibleExplorerState.historyIndex + 1);
      }
      bibleExplorerState.history.push({ book: normalizedBook, chapter, verse: null });
      bibleExplorerState.historyIndex = bibleExplorerState.history.length - 1;
    }
    
    // Show chapter content (cache hit = instant; no cache = build then store)
    const cacheKey = `${currentTranslation}:${normalizedBook}:${chapter}`;
    const cachedHtml = chapterHTMLCache.get(cacheKey);
    if (cachedHtml) {
      const textContainer = document.getElementById('bible-explorer-text');
      const titleEl = document.getElementById('bible-chapter-title');
      if (textContainer) textContainer.innerHTML = cachedHtml;
      if (titleEl) titleEl.textContent = `${normalizedBook} ${chapter}`;
      if (verse) {
        const verseEl = document.getElementById(`verse-${verse}`);
        if (verseEl) verseEl.classList.add('highlighted');
      }
      if (typeof updateChapterNavigation === 'function') updateChapterNavigation();
      if (verse) {
        setTimeout(() => {
          const verseEl = document.getElementById(`verse-${verse}`);
          if (verseEl) verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        if (textContainer) textContainer.scrollTop = 0;
      }
    } else {
      displayBibleChapter(normalizedBook, chapter, verse);
    }
    updateChapterNavigation();
    populateBibleChapters(normalizedBook);
    document.querySelectorAll('.bible-chapter-btn').forEach(el => {
      el.classList.remove('active');
      if (parseInt(el.textContent) === chapter) el.classList.add('active');
    });
    if (typeof updateBibleHistoryButtons === 'function') updateBibleHistoryButtons();
    
    updateBibleExplorerURL(normalizedBook, chapter, verse);
  }, delay);
}

// Update browser URL for Bible Explorer - dispatches to AppStore for proper data flow
function updateBibleExplorerURL(book, chapter, verse = null) {
  // Dispatch to AppStore for URL sync (unidirectional flow)
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({
      type: 'SET_BIBLE_LOCATION',
      translation: currentTranslation || 'kjv',
      book: book,
      chapter: chapter,
      verse: verse
    });
  } else {
    // Fallback for direct use without AppStore
    const bookEncoded = encodeURIComponent(book);
    let url = `/bible/${currentTranslation}/${bookEncoded}/${chapter}`;
    if (verse) {
      url += `?verse=${verse}`;
    }
    window.history.replaceState({}, '', url);
  }
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

// ═══════════════════════════════════════════════════════════════════════════
// READER CONTENT SELECTOR FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update the reader content selector dropdown and show/hide appropriate selector groups
 * @param {string} contentType - 'bible', 'symbols', 'words', 'numbers', 'timetested', or 'people'
 */
function updateReaderContentSelector(contentType) {
  // Update dropdown value
  const contentSelect = document.getElementById('reader-content-select');
  if (contentSelect) {
    contentSelect.value = contentType;
  }
  
  // Show/hide selector groups
  // For 'words', 'people', and 'symbols-article', hide all selectors (numbers has its own dropdown)
  const hideAllSelectors = ['words', 'people', 'symbols-article'].includes(contentType);
  const bibleSelectors = document.getElementById('bible-selectors');
  const symbolSelectors = document.getElementById('symbol-selectors');
  const ttSelectors = document.getElementById('timetested-selectors');
  const numberSelectors = document.getElementById('number-selectors');
  
  if (bibleSelectors) bibleSelectors.style.display = (contentType === 'bible' && !hideAllSelectors) ? '' : 'none';
  if (symbolSelectors) symbolSelectors.style.display = (contentType === 'symbols' && !hideAllSelectors) ? '' : 'none';
  if (ttSelectors) ttSelectors.style.display = (contentType === 'timetested' && !hideAllSelectors) ? '' : 'none';
  if (numberSelectors) numberSelectors.style.display = (contentType === 'numbers') ? '' : 'none';
  
  // Populate symbol dropdown if switching to symbols
  if (contentType === 'symbols') {
    populateSymbolDropdown();
  }
  
  // Populate Time Tested dropdown if switching to timetested
  if (contentType === 'timetested') {
    populateTimeTestedDropdown();
  }
  
  // Populate and sync number dropdown when content is numbers
  if (contentType === 'numbers') {
    populateNumberDropdown();
    const numberSelect = document.getElementById('number-select');
    const state = typeof AppStore !== 'undefined' ? AppStore.getState() : {};
    const currentNumber = state?.content?.params?.number;
    if (numberSelect) {
      numberSelect.value = currentNumber || '';
    }
  }
}

/**
 * Handle content type change from the dropdown
 * @param {string} value - 'bible', 'symbols', 'words', 'numbers', 'timetested', or 'people'
 */
function onReaderContentChange(value) {
  if (!value) return;
  
  // Navigate to the selected content type
  if (typeof AppStore !== 'undefined') {
    const params = { contentType: value };
    // For content types without selectors, go to their index/landing page
    AppStore.dispatch({ type: 'SET_VIEW', view: 'reader', params });
  }
}

/**
 * Handle symbol selection from dropdown
 * @param {string} symbolKey - the symbol key to navigate to
 */
function onSymbolSelect(symbolKey) {
  if (!symbolKey) return;
  
  if (typeof AppStore !== 'undefined') {
    // Special value for index page (no symbol selected)
    if (symbolKey === '__index__') {
      AppStore.dispatch({
        type: 'SET_VIEW',
        view: 'reader',
        params: { contentType: 'symbols' }
      });
    } else {
      AppStore.dispatch({
        type: 'SET_VIEW',
        view: 'reader',
        params: { contentType: 'symbols', symbol: symbolKey }
      });
    }
  }
}

/**
 * Handle Time Tested chapter selection from dropdown
 * @param {string} chapterId - the chapter ID to navigate to (empty string shows index)
 */
function onTimeTestedSelect(chapterId) {
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({
      type: 'SET_VIEW',
      view: 'reader',
      params: { contentType: 'timetested', chapterId: chapterId || null }
    });
  }
}

/**
 * Handle number study selection from dropdown
 * @param {string} numberId - the number study ID (empty string shows index)
 */
function onNumberSelect(numberId) {
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({
      type: 'SET_VIEW',
      view: 'reader',
      params: { contentType: 'numbers', number: numberId || null }
    });
  }
}

/**
 * Populate the number study dropdown (Index + available number studies)
 */
function populateNumberDropdown() {
  const select = document.getElementById('number-select');
  if (!select) return;
  
  const knownNumbers = [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '17', '18',
    '20', '24', '30', '31', '40', '42', '49', '50', '70', '71', '77', '80',
    '100', '120', '144', '153', '490', '666', '1000', 'GEMATRIA'
  ];
  
  let html = '<option value="">📚 Index</option>';
  html += '<optgroup label="Number studies">';
  for (const num of knownNumbers) {
    html += `<option value="${num}">${num}</option>`;
  }
  html += '</optgroup>';
  select.innerHTML = html;
}

/**
 * Populate the symbol dropdown with available symbols
 */
function populateSymbolDropdown() {
  const select = document.getElementById('symbol-select');
  if (!select) return;
  
  // Get symbols from dictionary
  const symbols = typeof SYMBOL_DICTIONARY !== 'undefined' ? Object.entries(SYMBOL_DICTIONARY) : [];
  
  let html = '<option value="">Symbol...</option>';
  html += '<option value="__index__">📚 Symbol Index</option>';
  html += '<optgroup label="───────────">';
  for (const [key, symbol] of symbols) {
    html += `<option value="${key}">${symbol.name}</option>`;
  }
  html += '</optgroup>';
  select.innerHTML = html;
}

/**
 * Populate the Time Tested chapter dropdown
 * Index is first; Chapters in an optgroup; Reviews in a separate optgroup.
 */
function populateTimeTestedDropdown() {
  const select = document.getElementById('timetested-chapter-select');
  if (!select) return;
  
  const chapters = typeof TIME_TESTED_CHAPTERS !== 'undefined' ? TIME_TESTED_CHAPTERS : [];
  const mainChapters = chapters.filter(ch => ch.folder === 'chapters');
  const extraChapters = chapters.filter(ch => ch.folder === 'extra');
  
  let html = '<option value="">📚 Index</option>';
  html += '<optgroup label="Chapters">';
  for (const ch of mainChapters) {
    html += `<option value="${ch.id}">${ch.title}</option>`;
  }
  if (extraChapters.length > 0) {
    for (const ch of extraChapters) {
      html += `<option value="${ch.id}">${ch.title}</option>`;
    }
  }
  html += '</optgroup>';
  html += '<optgroup label="Reviews">';
  html += '<option value="__reviews__">⭐ AI Reviews</option>';
  html += '</optgroup>';
  select.innerHTML = html;
}
