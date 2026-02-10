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

// Translation data storage — legacy globals, now backed by Bible API proxies (defined below)
// bibleTranslations and bibleIndexes are defined after Bible API is available.
let currentTranslation = 'kjv';
let translationsLoading = {};  // Track which translations are currently loading

// Hebrew (WLC) — now managed by Bible API (bible.js)
// Legacy stubs for any code that still checks these
let hebrewData = null;
let hebrewIndex = {};
let hebrewLoading = null;

// BOOK_NUM_TO_NAME and BOOK_NAME_TO_NUM are now defined in bible.js (loaded first).
// They're available as globals: BOOK_NUM_TO_NAME, BOOK_NAME_TO_NUM

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

// BOOK_NAME_MAP, BOOK_NUM_TO_NAME, BOOK_NAME_TO_NUM are now defined in bible.js (loaded first).
// They're available as globals and used by normalizeBookName() in bible.js.

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
// CONSONANTAL ROOT INDEX
// ============================================

// Maps consonantal forms (vowels stripped) → array of Strong's numbers
// Built lazily from strongsHebrewDictionary on first use
let consonantalRootIndex = null;

function buildConsonantalRootIndex() {
  if (consonantalRootIndex) return;
  if (typeof strongsHebrewDictionary === 'undefined') return;
  consonantalRootIndex = {};
  for (const [key, entry] of Object.entries(strongsHebrewDictionary)) {
    if (!key.startsWith('H') || !entry.lemma) continue;
    const consonants = stripAllDiacritics(entry.lemma.replace(/[\u05BE\/]/g, ''));
    if (consonants.length < 2) continue;
    if (!consonantalRootIndex[consonants]) consonantalRootIndex[consonants] = [];
    consonantalRootIndex[consonants].push(key);
  }
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
      <div class="strongs-gematria-header${hasRelated ? ' strongs-gematria-clickable' : ''}"${hasRelated ? ` onclick="AppStore.dispatch({type:'TOGGLE_GEMATRIA'})"` : ''}>
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

// ─── Legacy compatibility layer ──────────────────────────────────────────────
// These globals are read by many functions throughout bible-reader.js.
// They now derive from the Bible API instead of local arrays.
// TODO: Remove these once all access is migrated to Bible.getVerse/getChapter.

let bibleData = null;  // Legacy: used by displayBibleChapter filter, buildBookChapterCounts
let bibleIndex = {};   // Legacy: used by showInterlinear for cross-translation comparison

// Proxy objects that delegate to Bible API internals
// bibleTranslations[id] and bibleIndexes[id] are read in several places
let bibleTranslations = new Proxy({}, {
  get(target, prop) {
    if (typeof prop === 'string' && Bible.isLoaded(prop)) {
      // Return a truthy marker — actual verse data comes from Bible.getVerse/getChapter
      return true;
    }
    return undefined;
  }
});
let bibleIndexes = new Proxy({}, {
  get(target, prop) {
    if (typeof prop === 'string' && Bible.isLoaded(prop)) {
      // Return a proxy that resolves verse lookups via Bible API
      return new Proxy({}, {
        get(_, ref) {
          if (typeof ref !== 'string') return undefined;
          const m = ref.match(/^(.+?)\s+(\d+):(\d+)$/);
          if (!m) return undefined;
          return Bible.getVerse(prop, m[1], parseInt(m[2]), parseInt(m[3]));
        }
      });
    }
    return undefined;
  }
});

function getBibleData() {
  return bibleData;
}

function getBibleIndex() {
  return bibleIndex;
}

// Sync legacy globals. During Phase 1 transition, bibleData is set to a
// marker object so truthiness checks pass. Actual data access is migrated
// in Phase 2 to use Bible.getChapter / Bible.getVerse directly.
let _legacyTranslation = null;  // track which translation bibleData was built for

function syncLegacyVariables() {
  if (!Bible.isLoaded(currentTranslation)) {
    bibleData = null;
    bibleIndex = {};
    _legacyTranslation = null;
    return;
  }

  // Mark as loaded (truthiness) — actual data access uses Bible API
  if (_legacyTranslation !== currentTranslation) {
    // Set bibleData to a non-null marker so `if (!bibleData)` checks pass.
    // Functions that iterate bibleData (displayBibleChapter, buildBookChapterCounts)
    // are updated in Phase 2 to use Bible API. Until then, set a real array.
    bibleData = { _loaded: true, length: 31102 };
    bibleIndex = bibleIndexes[currentTranslation] || {};
    _legacyTranslation = currentTranslation;
  }
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
  
  // Look up morphology context from morphhb data so the Strong's panel can show parsing info
  _setMorphContextFromVerse(strongsNum, event);
  
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

// Look up morphhb data for the verse containing the clicked word and set currentMorphContext.
// This enables the Strong's panel to show Hebrew parsing even when opened from the main text.
function _setMorphContextFromVerse(strongsNum, event) {
  currentMorphContext = null;
  if (!strongsNum || !event || !morphhbData) return;
  
  // Find the verse element containing the clicked word
  const el = event.target;
  const verseEl = el?.closest('.bible-explorer-verse');
  if (!verseEl) return;
  
  // Get book/chapter/verse — multiverse view stores them as data attributes,
  // chapter view uses bibleExplorerState + the element's id
  let book, chapter, verse;
  if (verseEl.dataset.book) {
    book = verseEl.dataset.book;
    chapter = parseInt(verseEl.dataset.chapter);
    verse = parseInt(verseEl.dataset.verse);
  } else {
    book = bibleExplorerState.currentBook;
    chapter = bibleExplorerState.currentChapter;
    const verseId = verseEl.id; // "verse-7"
    verse = verseId ? parseInt(verseId.replace('verse-', '')) : null;
  }
  if (!book || !chapter || !verse) return;
  
  // Only OT has morphhb data
  if (typeof isNTBook === 'function' && isNTBook(book)) return;
  
  const words = getMorphhbVerse(book, chapter, verse);
  if (!words || words.length === 0) return;
  
  // Find the word whose lemma resolves to this Strong's number
  // Strip trailing variant letter for matching (e.g., H1254a → H1254)
  const baseStrongs = strongsNum.replace(/[a-z]$/, '');
  for (const [hebrewText, lemma, morphCode] of words) {
    const lang = getMorphhbLang(morphCode);
    const sn = typeof primaryStrongsFromLemma === 'function' ? primaryStrongsFromLemma(lemma, lang) : null;
    if (sn === strongsNum || sn === baseStrongs || (sn && sn.replace(/[a-z]$/, '') === baseStrongs)) {
      currentMorphContext = { hebrewText, morphCode, lemma };
      return;
    }
  }
}

// Show word tooltip on hover (definitions + symbol meaning + name substitution info)
function showWordTooltip(event) {
  const el = event.target.closest('.strongs-word, .name-sub') || event.target;
  const def = el.dataset.def;
  const symbolMeaning = el.dataset.symbolMeaning;
  const originalName = el.dataset.original;
  
  // Skip if no useful info to show
  if (!def && !symbolMeaning && !originalName) return;
  
  // Remove any existing tooltip
  hideWordTooltip();
  
  // Create tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'word-hover-tooltip';
  tooltip.className = 'word-hover-tooltip';
  
  let html = '';
  
  // Show original name if this is a name substitution
  if (originalName) {
    html += `<div class="word-tooltip-original">Original: <strong>${originalName}</strong> <span class="word-tooltip-settings" onclick="event.stopPropagation(); AppStore.dispatch({type:'SET_VIEW', view:'settings'})" title="Name Settings">⚙</span></div>`;
  }
  
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

// ── MorphHB hover tooltip for interlinear Hebrew words ──

function showMorphTooltip(el, event) {
  hideMorphTooltip(); // Remove any existing
  
  const strongs = el.dataset.strongs || '';
  const morphDesc = el.dataset.morphDesc || '';
  
  if (!strongs && !morphDesc) return;
  
  const tooltip = document.createElement('div');
  tooltip.id = 'morph-hover-tooltip';
  tooltip.className = 'morph-hover-tooltip';
  
  let html = '';
  const entry = strongs ? getStrongsEntry(strongs) : null;
  
  // Strong's number + root word
  if (strongs) {
    const rootWord = entry ? (entry.lemma || '') : '';
    html += `<div class="morph-tip-strongs"><strong>${strongs}</strong>${rootWord ? ' — ' + rootWord : ''}</div>`;
  }
  
  // Strong's definition (short)
  if (entry) {
    const def = entry.strongs_def || '';
    if (def) {
      const shortDef = def.length > 120 ? def.substring(0, 120) + '...' : def;
      html += `<div class="morph-tip-def">${shortDef}</div>`;
    }
    // KJV usage (alternatives)
    if (entry.kjv_def) {
      const kjvShort = entry.kjv_def.length > 100 ? entry.kjv_def.substring(0, 100) + '...' : entry.kjv_def;
      html += `<div class="morph-tip-kjv"><strong>KJV:</strong> ${kjvShort}</div>`;
    }
  }
  
  // Morphology description + grammar help
  if (morphDesc) {
    const morphCode = el.dataset.morphCode || '';
    const decoded = morphCode && typeof decodeMorphology === 'function' ? decodeMorphology(morphCode) : null;
    const helpNote = decoded && typeof getMorphHelp === 'function' ? getMorphHelp(decoded) : '';
    html += `<div class="morph-tip-desc">${morphDesc}${helpNote ? `<span class="morph-tip-help"> (${helpNote})</span>` : ''}</div>`;
  }
  
  // Symbol meaning if available — pass the English gloss for word-based matching too
  if (strongs || el) {
    const glossText = el.querySelector('.il-gloss')?.textContent || '';
    const symbol = typeof getSymbolForStrongsEntry === 'function' ? getSymbolForStrongsEntry(strongs, entry, glossText) : null;
    if (symbol) {
      html += `<div class="morph-tip-symbol">📖 <strong>${symbol.is}${symbol.is2 ? ' / ' + symbol.is2 : ''}</strong>`;
      if (symbol.does) {
        html += ` — ${symbol.does}${symbol.does2 ? ' / ' + symbol.does2 : ''}`;
      }
      html += `</div>`;
    }
  }
  
  // Tap hint on mobile
  if (isBibleReaderMobile()) {
    html += `<div class="morph-tip-hint">Tap again for full details</div>`;
  }
  
  tooltip.innerHTML = html;
  document.body.appendChild(tooltip);
  
  // Position using absolute coords (scrollY offset) so tooltip scrolls with page on mobile
  const rect = el.getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();
  let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
  let top = rect.top + window.scrollY - tipRect.height - 8;
  
  // Keep on screen horizontally
  if (left < 8) left = 8;
  if (left + tipRect.width > window.innerWidth - 8) left = window.innerWidth - tipRect.width - 8;
  // Flip below if too high
  if (top < window.scrollY + 8) top = rect.bottom + window.scrollY + 8;
  
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  
  // On mobile: tap tooltip to open Strong's panel
  tooltip.addEventListener('click', function(e) {
    e.stopPropagation();
    hideMorphTooltip();
    if (typeof showStrongsPanelFromMorphhb === 'function') {
      showStrongsPanelFromMorphhb(el, e);
    }
  });
}

function hideMorphTooltip() {
  const tooltip = document.getElementById('morph-hover-tooltip');
  if (tooltip) tooltip.remove();
}

// Close morph tooltip when tapping outside (mobile) and reset two-tap state
document.addEventListener('click', function(e) {
  const tooltip = document.getElementById('morph-hover-tooltip');
  if (!tooltip && !lastTappedInterlinearEl) return;
  // Don't close if tapping the tooltip itself or an interlinear word block
  if (e.target.closest('.il-word-block')) return;
  if (tooltip && tooltip.contains(e.target)) return;
  hideMorphTooltip();
  lastTappedInterlinearEl = null;
}, true);

// Tap to expand/collapse overflowed gloss text in root connections
document.addEventListener('click', function(e) {
  const glossEl = e.target.closest('.root-connection-gloss');
  if (glossEl) {
    glossEl.classList.toggle('expanded');
  }
}, false);

// Track which interlinear word was last tapped (mobile two-tap pattern)
let lastTappedInterlinearEl = null;

// Handle interlinear word tap: mobile = two-tap (tooltip then panel), desktop = direct panel open
function handleInterlinearTap(el, event) {
  if (event) event.stopPropagation();
  
  if (isBibleReaderMobile()) {
    // Second tap on same element → open Strong's panel
    if (lastTappedInterlinearEl === el) {
      lastTappedInterlinearEl = null;
      showStrongsPanelFromMorphhb(el, event);
      return;
    }
    // First tap → show tooltip
    lastTappedInterlinearEl = el;
    showMorphTooltip(el, event);
    return;
  }
  
  // Desktop: click opens panel directly (hover already showed tooltip)
  showStrongsPanelFromMorphhb(el, event);
}

// Open Strong's panel with morphology context from a morphhb interlinear word block
function showStrongsPanelFromMorphhb(el, event) {
  if (event) event.stopPropagation();
  hideMorphTooltip();
  lastTappedInterlinearEl = null;
  
  const strongs = el.dataset.strongs || '';
  const gloss = (el.querySelector('.il-gloss')?.textContent || '').trim();
  const morphCode = el.dataset.morphCode || '';
  const lemma = el.dataset.lemma || '';
  const hebrew = el.dataset.hebrew || '';
  
  if (!strongs) return;
  
  // Store morph context for the parsing panel
  currentMorphContext = {
    hebrewText: hebrew,
    morphCode: morphCode,
    lemma: lemma
  };
  
  // Highlight this word in the interlinear
  highlightInterlinearWord(strongs);
  
  showStrongsPanel(strongs, gloss, gloss, event);
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

// ─── Loading pipeline: delegates to Bible API (bible.js) ─────────────────────
// The Bible API manages blobs, indexes, and decompression.
// These wrapper functions maintain backwards compatibility with the rest of bible-reader.js.

async function loadTranslation(translationId, showDialog = false) {
  // Map old config ids to Bible API ids
  const apiId = _mapTranslationId(translationId);
  if (!apiId) {
    console.warn(`Unknown translation: ${translationId}`);
    return false;
  }

  if (Bible.isLoaded(apiId)) {
    syncLegacyVariables();
    return true;
  }

  if (showDialog) {
    showBibleLoadingDialog();
    updateLoadingDialogText(`Loading...`);
  }

  const ok = await Bible.loadTranslation(apiId);

  if (ok) {
    syncLegacyVariables();
  }

  if (showDialog) {
    hideBibleLoadingDialog();
  }

  return ok;
}

// Map old BIBLE_TRANSLATIONS ids to new Bible API ids
function _mapTranslationId(id) {
  const lower = (id || '').toLowerCase();
  // The new Bible API uses the same ids (kjv, asv, lxx)
  if (Bible.getTranslation(lower)) return lower;
  // Also check old config
  if (BIBLE_TRANSLATIONS[lower]) return lower;
  return null;
}

// Load Bible (backwards compatible - loads KJV)
async function loadBible(showDialog = false) {
  return loadTranslation('kjv', showDialog);
}

// Load all translations in background (KJV first, then others)
async function loadAllTranslations() {
  // Load primary translation via Bible API
  await loadTranslation(currentTranslation, false);

  // Background-load translations within user's loadCount threshold
  const { order, loadCount } = Bible.getOrderedTranslations();
  const toLoad = order.slice(0, loadCount).filter(id => id !== currentTranslation);
  for (const id of toLoad) {
    Bible.loadTranslation(id).then(() => syncLegacyVariables()).catch(() => {});
  }

  // Also load extra data not managed by Bible API
  loadHebrew().catch(err =>
    console.log('Hebrew loading deferred:', err.message)
  );

  loadMorphhb().catch(err =>
    console.log('MorphHB loading deferred:', err.message)
  );

  loadNTInterlinear().catch(err =>
    console.log('NT Interlinear loading deferred:', err.message)
  );

  loadTipnr().catch(err =>
    console.log('TIPNR loading deferred:', err.message)
  );
}

// Load Hebrew (WLC) text — now delegates to Bible API
async function loadHebrew() {
  if (Bible.isLoaded('wlc')) return true;
  return Bible.loadTranslation('wlc');
}

// Get Hebrew verse by reference — delegates to Bible API
function getHebrewVerse(bookName, chapter, verse) {
  return Bible.getVerse('wlc', bookName, chapter, verse);
}

// Check if Hebrew is available for a book (OT only)
function hasHebrewText(bookName) {
  return BOOK_NAME_TO_NUM.hasOwnProperty(bookName);
}

// ============================================================================
// INTERLINEAR DATA AND DISPLAY
// ============================================================================

// MorphHB data storage - Hebrew words with morphology and Strong's (replaces interlinear.json for OT)
let morphhbData = null;
let morphhbLoading = null;

// Current morphology context (set when clicking a word from interlinear, cleared on panel nav)
let currentMorphContext = null;

// BDB Lexicon data (lazy-loaded on first Strong's panel open)
let bdbData = null;
let bdbLoading = null;

async function loadBDB() {
  if (bdbData) return true;
  if (bdbLoading) return bdbLoading;
  
  bdbLoading = (async () => {
    try {
      const response = await fetch('/data/bdb-ai.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      bdbData = await response.json();
      console.log(`BDB lexicon loaded: ${Object.keys(bdbData).length} entries`);
      // Also load raw BDB in background for verification view
      loadBDBRaw();
      // If user prefers original BDB, preload formatted data
      if (getBDBViewMode() === 'original') loadBDBFormatted();
      return true;
    } catch (err) {
      console.warn('BDB lexicon not available:', err.message);
      return false;
    } finally {
      bdbLoading = null;
    }
  })();
  
  return bdbLoading;
}

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

async function loadMorphhb() {
  if (morphhbData) return true;
  if (morphhbLoading) return morphhbLoading;
  
  morphhbLoading = (async () => {
    try {
      const response = await fetch('/data/morphhb.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      morphhbData = await response.json();
      const bookCount = Object.keys(morphhbData).length;
      console.log(`MorphHB data loaded: ${bookCount} OT books`);
      return true;
    } catch (err) {
      console.warn('MorphHB data not available:', err.message);
      return false;
    } finally {
      morphhbLoading = null;
    }
  })();
  
  return morphhbLoading;
}

// Get morphhb word data for a verse: returns array of [hebrewText, lemma, morphCode] or null
function getMorphhbVerse(bookName, chapter, verse) {
  if (!morphhbData) return null;
  const book = morphhbData[bookName];
  if (!book) return null;
  const ch = book[chapter];
  if (!ch) return null;
  return ch[verse] || null;
}

// Get the language code for a morphhb word's morph code ('H' or 'A')
function getMorphhbLang(morphCode) {
  return (morphCode && morphCode[0] === 'A') ? 'A' : 'H';
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

// Derive a subject pronoun from Hebrew verb morphology.
// Finite verbs (perfect, imperfect, etc.) encode person/gender/number → "he", "she", "they", etc.
// Participles, infinitives, and non-verbs return '' (no pronoun needed).
function getVerbPronoun(decoded) {
  if (!decoded || !decoded.parts) return '';
  // Find the main verb part (role 'word' or the only part)
  const verb = decoded.parts.find(p => p.posCode === 'V' && p.role !== 'prefix') || 
               decoded.parts.find(p => p.posCode === 'V');
  if (!verb) return '';
  // Only finite verbs have a subject pronoun (not participles/infinitives)
  const tc = verb.typeCode;
  if (!tc || tc === 'r' || tc === 's' || tc === 'a' || tc === 'c') return ''; // participle/infinitive
  
  const person = verb.person;
  const gender = verb.gender;
  const number = verb.number;
  if (!person) return '';
  
  if (person === '1st') {
    return number === 'Plural' ? 'we ' : 'I ';
  } else if (person === '2nd') {
    if (number === 'Plural') return 'you ';
    return gender === 'Feminine' ? 'you(f) ' : 'you ';
  } else if (person === '3rd') {
    if (number === 'Plural') return 'they ';
    return gender === 'Feminine' ? 'she ' : 'he ';
  }
  return '';
}

// Check if interlinear is available for a book
function hasInterlinear(bookName) {
  return hasHebrewText(bookName) || isNTBook(bookName);
}

// Get interlinear data for a verse (NT only — OT uses getMorphhbVerse directly)
function getInterlinearVerse(bookName, chapter, verse) {
  if (isNTBook(bookName)) {
    const ref = `${bookName} ${chapter}:${verse}`;
    return ntInterlinearData ? ntInterlinearData[ref] : null;
  }
  return null;
}

// Build a map of Strong's number → queue of English phrases from a Strong's-tagged verse text.
// In KJV tagged format, ALL text between two Strong's tags belongs to the tag at the END.
// e.g. "and to bring in{H935}" → H935 maps to "bring in" (strip leading conjunctions/punctuation).
// Returns a Map: strongsNum → [phrase1, phrase2, ...] consumed as a queue.
function buildStrongsGlossMap(strongsText) {
  const map = new Map();
  if (!strongsText) return map;
  
  // Strip morphology tags {(H####)} first so they don't interfere
  const cleaned = strongsText.replace(/\{\([HG]\d+\)\}/g, '');
  
  // Split on Strong's tags, capturing the tag content
  const parts = cleaned.split(/\{([HG]\d+)\}/);
  // parts alternates: [text0, tag0, text1, tag1, text2, tag2, ...]
  
  for (let i = 1; i < parts.length; i += 2) {
    const strongsNum = parts[i];
    const textBefore = parts[i - 1] || '';
    
    // Clean the phrase: strip leading punctuation and common function words
    // that typically come from Hebrew prefixes or absorbed prepositions
    let phrase = textBefore
      .replace(/\{[^}]*\}/g, '')           // strip any remaining brace tags
      .replace(/^[\s.,;:!?'"()\[\]]+/, '') // strip leading punctuation
      .trim();
    // If there's a clause boundary (;:) keep only text AFTER it — that's closer to the tag
    if (/[;:]/.test(phrase)) {
      phrase = phrase.replace(/^.*[;:]/, '').trim();
    }
    // Strip leading function words (conjunctions, prepositions, articles, pronouns)
    // These come from Hebrew prefixes or absorbed grammar — the Hebrew morphology
    // provides these more accurately via getPrefixMeanings().
    // BUT: if stripping would empty the phrase, keep it — the function word IS the translation.
    const beforeStrip = phrase;
    // Strip: conjunctions, prepositions, articles, pronouns (handled by Hebrew prefixes/suffixes)
    // Keep: auxiliary verbs (shall, was, are, is, be, have, hath) — they encode Hebrew verb
    // tense/voice/aspect. Keep: "not" — semantically critical.
    const funcWords = /^\s*(?:and|or|but|for|to|that|which|upon|unto|in|on|with|from|by|of|at|into|the|a|an|he|she|it|I|we|ye|they|me|my|thy|his|her|our|their|thee|him|them|us|its)\s+/i;
    while (funcWords.test(phrase)) {
      phrase = phrase.replace(funcWords, '');
    }
    phrase = phrase.trim();
    // If stripping emptied the phrase, the function word(s) ARE the translation
    if (!phrase) phrase = beforeStrip;
    
    if (!phrase) continue;
    if (!map.has(strongsNum)) map.set(strongsNum, []);
    map.get(strongsNum).push(phrase);
  }
  return map;
}

// Get the best Strong's-tagged verse text for gloss derivation.
// Prefers the user's current translation, then falls back to any loaded tagged translation.
function getStrongsTaggedVerse(book, chapter, verse) {
  // Try current translation first
  const v = Bible.getVerse(currentTranslation, book, chapter, verse);
  if (v && v.strongsText) return v.strongsText;
  
  // Fall back to any loaded translation that has Strong's tags
  const fallbacks = ['kjv', 'asv'];
  for (const tid of fallbacks) {
    if (tid === currentTranslation) continue;
    if (!Bible.isLoaded(tid)) continue;
    const fv = Bible.getVerse(tid, book, chapter, verse);
    if (fv && fv.strongsText) return fv.strongsText;
  }
  return null;
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
    // Use replace — closing interlinear removes the ?il= param without adding a history entry
    if (typeof AppStore !== 'undefined') {
      AppStore.dispatch({ type: 'SET_INTERLINEAR_VERSE', verse: null, replace: true });
    }
    return;
  }
  
  // Collapse any other expanded interlinear (immediate removal — no animation delay)
  document.querySelectorAll('.interlinear-display').forEach(el => {
    el.remove();
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
  } else if (!isNT && !morphhbData) {
    const placeholder = document.createElement('div');
    placeholder.className = 'interlinear-display';
    placeholder.innerHTML = '<div class="interlinear-loading">Loading Hebrew interlinear data...</div>';
    verseEl.appendChild(placeholder);
    verseEl.classList.add('interlinear-expanded');
    requestAnimationFrame(() => placeholder.classList.add('expanded'));
    
    await loadMorphhb();
    placeholder.remove();
  }
  
  // Get data — OT from morphhb, NT from nt-interlinear
  const ntData = isNT ? getInterlinearVerse(book, chapter, verse) : null;
  const otWords = !isNT ? getMorphhbVerse(book, chapter, verse) : null;
  
  // Create interlinear element
  const interlinear = document.createElement('div');
  interlinear.className = 'interlinear-display';
  
  const ref = `${book} ${chapter}:${verse}`;
  let html = '';

  // ── Tabbed layout: Translations | Hebrew/Greek ──
  const hasOTInterlinear = !isNT && otWords && otWords.length > 0;
  const hasNTInterlinear = isNT && ntData && ntData.g;
  const hasInterlinearWords = hasOTInterlinear || hasNTInterlinear;
  const langLabel = isNT ? 'Greek' : 'Hebrew';
  const showVowels = getVowelPointingSetting();

  // Check for translation patches on this verse
  const hasPatches = typeof TranslationPatches !== 'undefined' && TranslationPatches.hasPatchesForVerse && TranslationPatches.hasPatchesForVerse(ref);

  // ── Translation patch note (above tabs) ──
  if (hasPatches && TranslationPatches.getInterlinearNote) {
    const patchNote = TranslationPatches.getInterlinearNote(ref);
    if (patchNote) html += patchNote;
  }

  // Default to translations tab when patches exist
  const defaultTab = hasPatches ? 'translations' : 'hebrew';

  // Tab bar (vowel toggle moved inside Hebrew pane)
  html += '<div class="il-tabs">';
  html += `<button class="il-tab${defaultTab === 'hebrew' ? ' active' : ''}" data-tab="hebrew" onclick="switchInterlinearTab(this, 'hebrew')">${langLabel}</button>`;
  html += `<button class="il-tab${defaultTab === 'translations' ? ' active' : ''}" data-tab="translations" onclick="switchInterlinearTab(this, 'translations')">Translations</button>`;
  html += '</div>';

  // ── Hebrew/Greek tab pane ──
  html += `<div class="il-tab-pane il-pane-hebrew${defaultTab === 'hebrew' ? ' active' : ''}">`;
  // Vowel toggle inside the Hebrew pane (OT only)
  if (!isNT) {
    html += `<div class="il-vowel-toggle-container"><label class="il-vowel-toggle-inline"><input type="checkbox" ${showVowels ? 'checked' : ''} onchange="toggleVowelPointing(this)"> Vowels</label></div>`;
  }

  // Word-for-word interlinear
  if (hasOTInterlinear) {
    // ── OT: MorphHB word-for-word with morphology ──
    // Build gloss map from the user's preferred translation (or any loaded tagged translation)
    const taggedText = getStrongsTaggedVerse(book, chapter, verse);
    const glossMap = buildStrongsGlossMap(taggedText);
    // Track consumption index per Strong's number (queue approach for duplicate numbers)
    const glossIdx = new Map();
    
    html += '<div class="interlinear-words-container il-hebrew">';
    for (let i = 0; i < otWords.length; i++) {
      const [hebrewText, lemma, morphCode] = otWords[i];
      const lang = getMorphhbLang(morphCode);
      const strongsNum = typeof primaryStrongsFromLemma === 'function' ? primaryStrongsFromLemma(lemma, lang) : '';
      
      // Get English gloss: prefer the actual translation word, fall back to dictionary
      // MorphHB has variant suffixes (H5921a) but KJV tags use base numbers (H5921)
      let gloss = '';
      const baseStrongs = strongsNum ? strongsNum.replace(/[a-z]$/, '') : '';
      const glossKey = glossMap.has(strongsNum) ? strongsNum : (glossMap.has(baseStrongs) ? baseStrongs : '');
      if (glossKey) {
        const words = glossMap.get(glossKey);
        const idx = glossIdx.get(glossKey) || 0;
        if (idx < words.length) {
          gloss = words[idx];
          glossIdx.set(glossKey, idx + 1);
        } else {
          // All queue entries consumed; reuse the first
          gloss = words[0];
        }
      }
      // Fall back to dictionary gloss if no translation match
      if (!gloss && strongsNum && typeof getWordGloss === 'function') {
        gloss = getWordGloss(lemma, lang, typeof strongsHebrewDictionary !== 'undefined' ? strongsHebrewDictionary : {});
      }
      
      const decoded = typeof decodeMorphology === 'function' ? decodeMorphology(morphCode) : null;
      const morphDesc = decoded ? decoded.description : '';
      
      // Get Hebrew prefix meanings (derived from morphology, not English)
      const prefixes = typeof getPrefixMeanings === 'function' ? getPrefixMeanings(lemma) : [];
      const prefixLabel = prefixes.length > 0 ? prefixes.join('+') + '+' : '';
      
      // Derive subject pronoun from verb morphology (he/she/they/I/we/you)
      const verbPronoun = getVerbPronoun(decoded);
      
      // Display Hebrew text: color prefix letters differently to match the blue gloss prefix
      // The "/" in morphhb text separates prefix from root (e.g. "בְּ/רֵאשִׁית")
      const hebrewParts = hebrewText.split('/');
      let displayHebrew;
      if (hebrewParts.length > 1) {
        // Last part is the root, everything before is prefix
        const prefixHebrew = hebrewParts.slice(0, -1).join('');
        const rootHebrew = hebrewParts[hebrewParts.length - 1];
        displayHebrew = `<span class="il-hebrew-prefix">${prefixHebrew}</span>${rootHebrew}`;
      } else {
        displayHebrew = hebrewText;
      }
      
      // Build display gloss: Hebrew-derived prefixes + verb pronoun + English root word
      let displayGloss = gloss || '—';
      if (verbPronoun || prefixLabel) {
        const prefix = prefixLabel ? `<span class="il-prefix">${prefixLabel}</span>` : '';
        const pronoun = verbPronoun ? `<span class="il-prefix">${verbPronoun}</span>` : '';
        displayGloss = prefix + pronoun + (gloss || '—');
      }
      
      // Escape for HTML attributes (use plain text for data attributes, not HTML)
      const plainHebrew = hebrewText.replace(/\//g, '');
      const escapedGloss = gloss.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const escapedMorphDesc = morphDesc.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const escapedHebrew = plainHebrew.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const escapedMorphCode = (morphCode || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const escapedLemma = (lemma || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      
      // Apply vowel stripping at render time if preference is off
      const renderedHebrew = showVowels ? displayHebrew : displayHebrew.replace(HEBREW_DIACRITICS_RE, '');
      
      html += `<div class="il-word-block il-clickable"
        data-strongs="${strongsNum || ''}"
        data-morph-desc="${escapedMorphDesc}"
        data-morph-code="${escapedMorphCode}"
        data-lemma="${escapedLemma}"
        data-hebrew="${escapedHebrew}"
        onclick="handleInterlinearTap(this, event)"
        onmouseenter="if(!isBibleReaderMobile())showMorphTooltip(this, event)"
        onmouseleave="if(!isBibleReaderMobile())hideMorphTooltip()">
        <span class="il-original" data-voweled="${displayHebrew.replace(/"/g, '&quot;')}">${renderedHebrew}</span>
        <span class="il-gloss">${displayGloss}</span>
      </div>`;
    }
    html += '</div>';
  } else if (hasNTInterlinear) {
    // ── NT: existing interlinear format ──
    const originalWords = ntData.g;
    html += '<div class="interlinear-words-container">';
    for (let i = 0; i < originalWords.length; i++) {
      const word = originalWords[i];
      const engWord = ntData.e[i];
      const strongs = engWord?.s || '';
      const gloss = engWord?.g || engWord?.e || '';
      const escapedGloss = gloss.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const originalText = word.g;
      html += `<div class="il-word-block il-clickable" onclick="showStrongsPanel('${strongs}', '${escapedGloss}', '${escapedGloss}', event)">
        <span class="il-original">${originalText}</span>
        <span class="il-gloss">${gloss}</span>
      </div>`;
    }
    html += '</div>';
  } else {
    html += '<div class="interlinear-no-data">Word-for-word interlinear data not available for this verse.</div>';
  }

  // NT: Greek source text inside the Hebrew/Greek pane
  if (isNT) {
    const greekVerse = Bible.isLoaded('greek_nt') ? Bible.getVerse('greek_nt', book, chapter, verse) : null;
    html += `<div class="interlinear-source-text" id="il-greek-${book.replace(/\s/g,'-')}-${chapter}-${verse}">
      <div class="il-source-header"><span class="il-source-label">Greek NT</span></div>
      <div class="il-source-text-content">${greekVerse ? greekVerse.text : '<span style="color:var(--text-tertiary);font-style:italic;">Loading Greek NT...</span>'}</div>
    </div>`;
    if (!greekVerse) setTimeout(() => loadAndShowGreekNT(book, chapter, verse), 0);
  }

  html += '</div>'; // close Hebrew/Greek tab pane

  // ── Translations tab pane ──
  html += `<div class="il-tab-pane il-pane-translations${defaultTab === 'translations' ? ' active' : ''}">`;
  
  const { visible: visibleTranslations, hidden: hiddenTranslations, notLoaded: notLoadedTranslations } = Bible.getOrderedTranslations();
  const primaryIds = visibleTranslations.map(t => t.id);
  const moreIds = [...hiddenTranslations, ...notLoadedTranslations].map(t => t.id).filter(id => id !== currentTranslation);

  html += '<div class="interlinear-translations">';
  for (const tid of primaryIds) {
    if (tid === currentTranslation) continue;
    if (isNT && tid === 'lxx') continue;
    const otherVerse = Bible.getVerse(tid, book, chapter, verse);
    if (!otherVerse) continue;
    const reg = Bible.getTranslation(tid);
    const isGreekTrans = tid === 'lxx';
    // Highlight patched phrases in comparison translations
    let compText = otherVerse.text;
    if (typeof TranslationPatches !== 'undefined' && TranslationPatches.highlightComparison) {
      compText = TranslationPatches.highlightComparison(ref, compText, tid);
    }
    html += `<div class="interlinear-trans-row${isGreekTrans ? ' interlinear-trans-greek' : ''}">
      <span class="interlinear-trans-label">${reg ? reg.name : tid.toUpperCase()}</span>
      <span class="interlinear-trans-text">${compText}</span>
    </div>`;
  }
  if (moreIds.length > 0) {
    html += `<div class="interlinear-more-section">
      <button class="interlinear-more-btn" onclick="expandMoreTranslations(this, '${book.replace(/'/g, "\\'")}', ${chapter}, ${verse})">+ ${moreIds.length} more translations</button>
      <div class="interlinear-more-content" data-translation-ids="${moreIds.join(',')}">
        <div class="interlinear-more-loading" style="display:none;">Loading translations...</div>
      </div>
    </div>`;
  }
  html += '</div>';
  html += '</div>'; // close translations tab pane

  interlinear.innerHTML = html;
  
  verseEl.appendChild(interlinear);
  verseEl.classList.add('interlinear-expanded');
  
  requestAnimationFrame(() => {
    interlinear.classList.add('expanded');
  });
  
  // Dispatch to AppStore for URL sync only when in chapter view (not multiverse)
  // Only update interlinear state — do NOT update verse param, as that triggers
  // a full chapter re-render which destroys the interlinear we just created.
  const isMultiverse = typeof verseElOrId === 'string' && verseElOrId.startsWith('mv-');
  if (!isMultiverse && typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_INTERLINEAR_VERSE', verse: verse, replace: false });
  }
}

// Highlight all words with matching BHSA ID
// Expand "more translations" — load all unloaded translations and show verses
async function expandMoreTranslations(btnEl, book, chapter, verse) {
  const section = btnEl.parentElement;
  const content = section.querySelector('.interlinear-more-content');
  const ids = (content.dataset.translationIds || '').split(',').filter(Boolean);

  // Toggle if already expanded
  if (section.classList.contains('expanded')) {
    section.classList.remove('expanded');
    btnEl.textContent = `+ ${ids.length} more translations`;
    return;
  }

  section.classList.add('expanded');
  btnEl.textContent = 'Hide extra translations';

  // Show loading indicator
  const loadingEl = content.querySelector('.interlinear-more-loading');
  if (loadingEl) loadingEl.style.display = 'block';

  // Load all unloaded translations in parallel
  const unloaded = ids.filter(id => !Bible.isLoaded(id));
  if (unloaded.length > 0) {
    await Promise.all(unloaded.map(id => Bible.loadTranslation(id).catch(() => {})));
  }

  if (loadingEl) loadingEl.style.display = 'none';

  // Build rows for all translations
  const moreReference = `${book} ${chapter}:${verse}`;
  let rowsHtml = '';
  for (const tid of ids) {
    const v = Bible.getVerse(tid, book, chapter, verse);
    const reg = Bible.getTranslation(tid);
    const label = reg ? reg.name : tid.toUpperCase();
    if (v) {
      // Highlight patched phrases in comparison translations
      let compText = v.text;
      if (typeof TranslationPatches !== 'undefined' && TranslationPatches.highlightComparison) {
        compText = TranslationPatches.highlightComparison(moreReference, compText, tid);
      }
      rowsHtml += `<div class="interlinear-trans-row">
        <span class="interlinear-trans-label">${label}</span>
        <span class="interlinear-trans-text">${compText}</span>
      </div>`;
    } else {
      rowsHtml += `<div class="interlinear-trans-row interlinear-trans-unloaded">
        <span class="interlinear-trans-label">${label}</span>
        <span class="interlinear-trans-text" style="color:var(--text-tertiary);font-style:italic;">Not available</span>
      </div>`;
    }
  }

  // Replace loading with rows (keep the loading div for re-use)
  const existing = content.querySelectorAll('.interlinear-trans-row');
  existing.forEach(el => el.remove());
  content.insertAdjacentHTML('beforeend', rowsHtml);
}

// Toggle the interlinear original section expand/collapse
function toggleInterlinearOriginal(btnEl) {
  const section = btnEl.parentElement;
  section.classList.toggle('expanded');
  const isNT = section.querySelector('.interlinear-words-container:not(.il-hebrew)') !== null;
  const lang = isNT ? 'Greek' : 'Hebrew';
  btnEl.textContent = section.classList.contains('expanded') ? `Hide ${lang} interlinear` : `${lang} interlinear`;
}

// Switch between interlinear tabs (Hebrew/Greek vs Translations)
function switchInterlinearTab(btnEl, tabName) {
  const display = btnEl.closest('.interlinear-display');
  if (!display) return;
  
  // Update tab buttons
  display.querySelectorAll('.il-tab').forEach(t => t.classList.remove('active'));
  btnEl.classList.add('active');
  
  // Update tab panes
  display.querySelectorAll('.il-tab-pane').forEach(p => p.classList.remove('active'));
  const targetPane = display.querySelector(`.il-pane-${tabName}`);
  if (targetPane) targetPane.classList.add('active');
}

// Highlight the Hebrew word in interlinear that matches the open Strong's panel
function highlightInterlinearWord(strongsNum) {
  // Remove previous highlights
  document.querySelectorAll('.il-word-block.il-word-active').forEach(el => el.classList.remove('il-word-active'));
  if (!strongsNum) return;
  // Find and highlight the matching word block
  document.querySelectorAll('.il-word-block').forEach(el => {
    if (el.dataset.strongs === strongsNum) {
      el.classList.add('il-word-active');
    }
  });
}

// Regex to strip Hebrew vowel pointing and cantillation marks
const HEBREW_DIACRITICS_RE = /[\u0591-\u05AF\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;

// Get saved vowel pointing preference (defaults to true / vowels shown)
function getVowelPointingSetting() {
  try {
    const saved = localStorage.getItem('hebrew_vowel_pointing');
    return saved === null ? true : saved === 'true';
  } catch (e) { return true; }
}

// Toggle vowel pointing on interlinear Hebrew word blocks and save preference
function toggleVowelPointing(checkbox) {
  const showVowels = checkbox.checked;
  
  // Save preference
  try { localStorage.setItem('hebrew_vowel_pointing', String(showVowels)); } catch (e) {}
  
  // Apply to all visible interlinear word blocks
  const interlinearDisplay = checkbox.closest('.interlinear-display');
  if (!interlinearDisplay) return;
  
  interlinearDisplay.querySelectorAll('.il-original').forEach(el => {
    const voweled = el.dataset.voweled || el.innerHTML;
    el.innerHTML = showVowels ? voweled : voweled.replace(HEBREW_DIACRITICS_RE, '');
  });
}

// Load WLC and show in interlinear panel
async function loadAndShowWLC(book, chapter, verse) {
  if (!Bible.isLoaded('wlc')) {
    await Bible.loadTranslation('wlc');
  }
  const v = Bible.getVerse('wlc', book, chapter, verse);
  const el = document.getElementById(`il-wlc-${book.replace(/\s/g, '-')}-${chapter}-${verse}`);
  if (v && el) {
    const textEl = el.querySelector('.il-source-text-content');
    if (textEl) textEl.textContent = v.text;
  }
}

// Load Greek NT and show in interlinear panel
async function loadAndShowGreekNT(book, chapter, verse) {
  if (!Bible.isLoaded('greek_nt')) {
    await Bible.loadTranslation('greek_nt');
  }
  const v = Bible.getVerse('greek_nt', book, chapter, verse);
  const el = document.getElementById(`il-greek-${book.replace(/\s/g, '-')}-${chapter}-${verse}`);
  if (v && el) {
    const textEl = el.querySelector('.il-source-text-content');
    if (textEl) textEl.textContent = v.text;
  }
}

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
  verseRefs: null,      // Array of all verse references
  currentIndex: 0,      // Current position in scan
  results: [],          // Found verse references
  isSearching: false,
  isComplete: false,
  batchSize: 20         // Results per batch
};

// Build flat array of "Book Ch:V" references from morphhb data
function buildMorphhbVerseRefs() {
  if (!morphhbData) return [];
  const refs = [];
  for (const bookName of Object.keys(morphhbData)) {
    const book = morphhbData[bookName];
    for (let ch = 1; ch < book.length; ch++) {
      if (!book[ch]) continue;
      for (let v = 1; v < book[ch].length; v++) {
        if (book[ch][v]) refs.push(`${bookName} ${ch}:${v}`);
      }
    }
  }
  return refs;
}

// Check if a morphhb verse contains a given Strong's number
// Returns array of matching glosses (for word highlighting), or empty array
function searchMorphhbVerse(bookName, chapter, verse, targetStrongs) {
  const words = getMorphhbVerse(bookName, chapter, verse);
  if (!words) return [];
  const matches = [];
  for (const [hebrewText, lemma, morphCode] of words) {
    const lang = getMorphhbLang(morphCode);
    const sn = typeof primaryStrongsFromLemma === 'function' ? primaryStrongsFromLemma(lemma, lang) : null;
    if (sn === targetStrongs) {
      // Get gloss for word highlighting in the result
      const gloss = (typeof getWordGloss === 'function')
        ? getWordGloss(lemma, lang, typeof strongsHebrewDictionary !== 'undefined' ? strongsHebrewDictionary : {})
        : '';
      matches.push(gloss.toLowerCase().replace(/[.,;:!?'"()]/g, '') || hebrewText);
    }
  }
  return matches;
}

// Start or continue searching for verses with a Strong's number
function searchVersesWithStrongs(strongsNum) {
  // Normalize Strong's number (strip leading zeros and suffixes)
  const normalizedNum = normalizeStrongsNum(strongsNum);
  
  // Determine which dataset to use based on Strong's prefix
  const isGreek = normalizedNum && normalizedNum.startsWith('G');
  
  if (isGreek && !ntInterlinearData) {
    console.warn('NT Interlinear data not loaded');
    return;
  }
  if (!isGreek && !morphhbData) {
    console.warn('MorphHB data not loaded');
    return;
  }
  
  // For Greek numbers, find Hebrew origin to search OT too
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
    // Build combined verse refs: primary testament first, then secondary
    let primaryRefs, secondaryRefs = [];
    if (isGreek) {
      primaryRefs = Object.keys(ntInterlinearData);
      if (relatedStrongs && morphhbData) secondaryRefs = buildMorphhbVerseRefs();
    } else {
      primaryRefs = buildMorphhbVerseRefs();
      // Future: could add NT secondary for Hebrew→Greek cross-refs
    }
    
    verseSearchState = {
      strongsNum: normalizedNum,
      relatedStrongs: relatedStrongs,
      verseRefs: primaryRefs.concat(secondaryRefs),
      currentIndex: 0,
      results: [],
      isSearching: false,
      isComplete: false,
      batchSize: 20,
      isGreek: isGreek,
      primaryCount: primaryRefs.length
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
  const endIndex = Math.min(startIndex + 500, state.verseRefs.length);
  let foundCount = 0;
  
  for (let i = startIndex; i < endIndex && foundCount < state.batchSize; i++) {
    const ref = state.verseRefs[i];
    const inSecondary = i >= state.primaryCount;
    const targetStrongs = inSecondary ? state.relatedStrongs : state.strongsNum;
    
    if (!targetStrongs) {
      state.currentIndex = i + 1;
      continue;
    }
    
    // Parse the reference to determine search method
    const refMatch = ref.match(/^(.+)\s+(\d+):(\d+)$/);
    if (!refMatch) { state.currentIndex = i + 1; continue; }
    const [, bookName, chStr, vStr] = refMatch;
    const ch = parseInt(chStr, 10);
    const v = parseInt(vStr, 10);
    const isNTRef = isNTBook(bookName);
    
    let matchingWords = [];
    
    if (isNTRef) {
      // Search NT interlinear data
      const data = ntInterlinearData ? ntInterlinearData[ref] : null;
      if (data && data.e) {
        for (const word of data.e) {
          if (word.s === targetStrongs) {
            matchingWords.push(word.e.toLowerCase().replace(/[.,;:!?'"()]/g, ''));
          }
        }
      }
    } else {
      // Search morphhb data
      matchingWords = searchMorphhbVerse(bookName, ch, v, targetStrongs);
    }
    
    if (matchingWords.length > 0) {
      const verseData = getVerseData(ref);
      state.results.push({
        ref: ref,
        matchingWords: matchingWords,
        targetStrongs: targetStrongs,
        text: verseData ? verseData.text : '(verse text not loaded)',
        strongsText: verseData ? verseData.strongsText : null
      });
      foundCount++;
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
// Returns { text, strongsText } — strongsText has inline {H####} tags for highlighting
function getVerseData(ref) {
  const match = ref.match(/^(.+)\s+(\d+):(\d+)$/);
  if (!match) return null;
  const v = Bible.getVerse(currentTranslation, match[1], parseInt(match[2]), parseInt(match[3]));
  return v || null;
}

// Legacy wrapper (returns plain text only)
function getVerseText(ref) {
  const d = getVerseData(ref);
  return d ? d.text : null;
}

// Highlight words in verse text that are tagged with the target Strong's number.
// Uses the Strong's-tagged text (e.g., "God{H430} created{H1254}") for precise matching.
// Falls back to gloss-based matching if no tagged text is available.
function highlightMatchingWords(text, matchingWords, strongsText, targetStrongs) {
  if (!text) return text;
  
  // Preferred: use Strong's tagged text for precise word highlighting
  if (strongsText && targetStrongs) {
    const highlighted = highlightFromStrongsText(strongsText, targetStrongs);
    if (highlighted) return highlighted;
  }
  
  // Fallback: gloss-based matching (for translations without Strong's tags)
  if (!matchingWords || matchingWords.length === 0) return text;
  
  const expandedWords = [];
  for (const word of matchingWords) {
    if (!word) continue;
    expandedWords.push(word);
    const kjvVariant = MODERN_TO_KJV_VARIANTS ? MODERN_TO_KJV_VARIANTS[word.toLowerCase()] : null;
    if (kjvVariant && !expandedWords.includes(kjvVariant)) {
      expandedWords.push(kjvVariant);
    }
  }
  
  let result = text;
  for (const word of expandedWords) {
    if (!word) continue;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(\\b${escaped})`, 'gi');
    result = result.replace(pattern, '<mark class="strongs-match">$1</mark>');
  }
  return result;
}

// Reverse mapping: modern name -> KJV name
const MODERN_TO_KJV_VARIANTS = Object.fromEntries(
  Object.entries(KJV_NAME_VARIANTS).map(([kjv, modern]) => [modern, kjv])
);

// Produce highlighted HTML from Strong's-tagged text.
// Input: "God{H430} created{H1254}{(H8804)}{H853} the heaven{H8064}"
// With target H430 → "**God** created the heaven" (God wrapped in <mark>)
function highlightFromStrongsText(strongsText, targetStrongs) {
  if (!strongsText || !targetStrongs) return null;
  
  const normalized = normalizeStrongsNum(targetStrongs);
  if (!normalized) return null;
  
  // Find all tag clusters: text followed by one or more {H####} or {(H####)} tags
  // We scan for sequences of tags and identify the text chunk preceding them
  const tagPattern = /(\{\(?[HG]\d+\)?\})/g;
  
  // Build a map of character ranges that should be highlighted
  const highlights = new Set(); // set of character positions to highlight
  
  // Collect all tags with their positions
  let prevTagEnd = 0;
  const tags = [];
  let m;
  while ((m = tagPattern.exec(strongsText)) !== null) {
    tags.push({ start: m.index, end: m.index + m[0].length, tag: m[0] });
  }
  
  if (tags.length === 0) return null; // no tags found
  
  // Group consecutive tags (no text between them) and find the text word before each group
  let i = 0;
  while (i < tags.length) {
    // Find the start of this tag group
    const groupStart = tags[i].start;
    
    // Collect all consecutive tags (no text gap between them)
    let groupEnd = tags[i].end;
    const groupTags = [tags[i].tag];
    while (i + 1 < tags.length && tags[i + 1].start === groupEnd) {
      i++;
      groupEnd = tags[i].end;
      groupTags.push(tags[i].tag);
    }
    
    // Check if any tag in this group matches the target Strong's number
    const isMatch = groupTags.some(t => {
      const numMatch = t.match(/[HG]\d+/);
      if (!numMatch) return false;
      return normalizeStrongsNum(numMatch[0]) === normalized;
    });
    
    if (isMatch) {
      // Find the text word before this tag group
      // The word is the text between the previous tag group end and this tag group start
      const textBefore = strongsText.slice(prevTagEnd, groupStart);
      // The word is the last word-like chunk (trim leading spaces/punctuation)
      const wordMatch = textBefore.match(/(\S+)\s*$/);
      if (wordMatch) {
        const wordStart = prevTagEnd + textBefore.lastIndexOf(wordMatch[1]);
        const wordEnd = wordStart + wordMatch[1].length;
        for (let c = wordStart; c < wordEnd; c++) highlights.add(c);
      }
    }
    
    prevTagEnd = groupEnd;
    i++;
  }
  
  if (highlights.size === 0) return null;
  
  // Build the output: strip all tags and wrap highlighted ranges in <mark>
  let output = '';
  let inHighlight = false;
  let ti = 0; // tag index
  
  for (let pos = 0; pos < strongsText.length; ) {
    // Check if we're at a tag - skip it
    if (ti < tags.length && pos === tags[ti].start) {
      pos = tags[ti].end;
      ti++;
      continue;
    }
    
    const ch = strongsText[pos];
    const shouldHighlight = highlights.has(pos);
    
    if (shouldHighlight && !inHighlight) {
      output += '<mark class="strongs-match">';
      inHighlight = true;
    } else if (!shouldHighlight && inHighlight) {
      output += '</mark>';
      inHighlight = false;
    }
    
    // Escape HTML entities
    if (ch === '<') output += '&lt;';
    else if (ch === '>') output += '&gt;';
    else if (ch === '&') output += '&amp;';
    else output += ch;
    
    pos++;
  }
  
  if (inHighlight) output += '</mark>';
  
  return output;
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
    const highlightedText = highlightMatchingWords(result.text, result.matchingWords, result.strongsText, result.targetStrongs);
    
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

// BOOK_ABBREVIATIONS is now defined in bible.js (loaded first).
// Available as a global: BOOK_ABBREVIATIONS

// Get abbreviated reference
function abbreviateRef(ref) {
  if (typeof Bible !== 'undefined' && Bible.abbreviateRef) {
    return Bible.abbreviateRef(ref);
  }
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

// Populate the global search bar with a Strong's number and trigger a search.
// Keeps the Strong's panel open so it acts as a quick "find all verses" link.
function searchStrongsInGlobal(strongsNum) {
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_GLOBAL_SEARCH', query: strongsNum });
  }
  // Expand the search input (for mobile)
  if (typeof GlobalSearch !== 'undefined' && GlobalSearch.expandInput) {
    GlobalSearch.expandInput();
  }
}

// Toggle verse search visibility (legacy — now replaced by searchStrongsInGlobal)
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
// Searches Strong's dictionaries directly (for both OT and NT) plus NT interlinear
function findStrongsForWord(word) {
  const normalizedWord = word.toLowerCase().trim();
  const strongsMatches = new Map(); // strongsNum -> { count, exactGlossMatch, fromGloss }
  const wordPattern = new RegExp(`\\b${normalizedWord}\\b`, 'i');
  
  // Helper to process NT interlinear data (still used for Greek)
  function processNTInterlinear(data) {
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
            if (wordPattern.test(gloss)) match.fromGloss = true;
            if (gloss === normalizedWord || gloss === normalizedWord + 's') match.exactGlossMatch = true;
          }
        }
      }
    }
  }
  
  // Search Strong's dictionaries directly for definitions matching the word
  function processDictionary(dict, prefix) {
    if (!dict) return;
    for (const key of Object.keys(dict)) {
      if (!key.startsWith(prefix)) continue;
      const entry = dict[key];
      if (!entry) continue;
      const kjvDef = (entry.kjv_def || '').toLowerCase();
      const strongsDef = (entry.strongs_def || '').toLowerCase();
      if (wordPattern.test(kjvDef) || wordPattern.test(strongsDef)) {
        if (!strongsMatches.has(key)) {
          strongsMatches.set(key, { count: 0, exactGlossMatch: false, fromGloss: false });
        }
        const match = strongsMatches.get(key);
        match.fromGloss = true;
        // Check derived gloss (first meaning)
        const gloss = (typeof extractGloss === 'function' ? extractGloss(entry) : '').toLowerCase();
        if (gloss === normalizedWord || gloss === normalizedWord + 's') {
          match.exactGlossMatch = true;
          match.count += 10; // Boost exact gloss matches
        } else {
          match.count += 1;
        }
      }
    }
  }
  
  // Search Hebrew dictionary
  if (typeof strongsHebrewDictionary !== 'undefined') processDictionary(strongsHebrewDictionary, 'H');
  // Search Greek dictionary
  if (typeof strongsGreekDictionary !== 'undefined') processDictionary(strongsGreekDictionary, 'G');
  // Also search NT interlinear for frequency/usage data
  if (ntInterlinearData) processNTInterlinear(ntInterlinearData);
  
  // Filter and score results
  const filteredResults = [];
  for (const [strongsNum, data] of strongsMatches) {
    const entry = getStrongsEntry(strongsNum);
    const def = entry ? (entry.strongs_def || '').toLowerCase() : '';
    const kjvDef = entry ? (entry.kjv_def || '').toLowerCase() : '';
    
    const defMatches = wordPattern.test(def);
    const exactDefMatch = def.startsWith(normalizedWord + ',') || 
                          def.startsWith(normalizedWord + '.') ||
                          def.startsWith(normalizedWord + ';') ||
                          def.startsWith(normalizedWord + ' ') ||
                          def === normalizedWord ||
                          kjvDef.startsWith(normalizedWord);
    
    if (data.fromGloss || defMatches || data.count >= 5) {
      let score = 0;
      if (data.exactGlossMatch) score += 1000;
      if (exactDefMatch) score += 500;
      if (defMatches) score += 100;
      if (data.fromGloss) score += 50;
      score += Math.min(data.count, 100);
      
      filteredResults.push({
        strongsNum,
        count: data.count,
        score
      });
    }
  }
  
  filteredResults.sort((a, b) => b.score - a.score);
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
    // Use Bible API for text search
    const searchResults = Bible.searchText(currentTranslation, wordPattern);

    // Convert to the format conceptSearchState expects
    const results = searchResults
      .map(r => ({
        ref: r.ref,
        strongsNums: [],
        words: [searchWord],
        text: r.text || '',
        fromText: true
      }))
      .sort((a, b) => Bible.compareRefs(a.ref, b.ref));
    
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
    
    // First, add all text matches from current translation via Bible API
    if (wordPattern) {
      const textResults = Bible.searchText(currentTranslation, wordPattern);
      for (const r of textResults) {
        if (!allVerses.has(r.ref)) {
          allVerses.set(r.ref, { strongsNums: new Set(), words: [searchWord], fromText: true, fromConcept: false, text: r.text });
        }
      }
    }
    
    // Then add Strong's concept matches (only for selected Strong's)
    if (selectedStrongs.length > 0) {
      // Search OT via morphhb
      if (morphhbData) {
        for (const bookName of Object.keys(morphhbData)) {
          const book = morphhbData[bookName];
          for (let ch = 1; ch < book.length; ch++) {
            if (!book[ch]) continue;
            for (let v = 1; v < book[ch].length; v++) {
              const words = book[ch][v];
              if (!words) continue;
              for (const [hebrewText, lemma, morphCode] of words) {
                const lang = getMorphhbLang(morphCode);
                const sn = typeof primaryStrongsFromLemma === 'function' ? primaryStrongsFromLemma(lemma, lang) : null;
                if (sn && selectedStrongs.includes(sn)) {
                  const ref = `${bookName} ${ch}:${v}`;
                  if (!allVerses.has(ref)) {
                    allVerses.set(ref, { strongsNums: new Set(), words: [], fromText: false, fromConcept: true });
                  }
                  const gloss = typeof getWordGloss === 'function'
                    ? getWordGloss(lemma, lang, typeof strongsHebrewDictionary !== 'undefined' ? strongsHebrewDictionary : {})
                    : '';
                  allVerses.get(ref).strongsNums.add(sn);
                  allVerses.get(ref).words.push(gloss || hebrewText);
                  allVerses.get(ref).fromConcept = true;
                }
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
      .sort((a, b) => Bible.compareRefs(a.ref, b.ref));

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

  // Use Bible API for text search
  const apiResults = Bible.searchText(currentTranslation, regex);

  // Convert to the format regexSearchState expects (add matchCount)
  const results = apiResults.map(r => ({
    ref: r.ref,
    text: r.text,
    matches: r.matches || [],
    matchCount: (r.matches || []).length
  }));

  const endTime = performance.now();
  const searchTime = Math.round(endTime - startTime);

  // Sort by book order
  results.sort((a, b) => Bible.compareRefs(a.ref, b.ref));
  
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

// Single source of truth: find symbol for a Strong's entry.
// Three reliable matching paths only:
//   1. Direct Strong's match — word's number is explicitly in a symbol's strongs array
//   2. Forward derivation — word derives FROM a symbol word
//   3. English word match — the actual translation word (passed by caller) matches a symbol word
// Removed: reverse derivation scan (inverted logic) and KJV def word scan (too many false positives)
function getSymbolForStrongsEntry(strongsNum, entry, englishWord) {
  // 1. Direct Strong's number match (curated association)
  let symbol = (typeof lookupSymbolByStrongs === 'function') ? lookupSymbolByStrongs(strongsNum) : null;
  if (symbol) return symbol;

  // 2. Forward derivation: this word derives FROM a symbol word
  if (entry && entry.derivation && typeof lookupSymbolByStrongs === 'function') {
    const derivationMatch = entry.derivation.match(/H\d+|G\d+/g);
    if (derivationMatch) {
      for (const derivedStrongs of derivationMatch) {
        symbol = lookupSymbolByStrongs(derivedStrongs);
        if (symbol) return symbol;
      }
    }
  }

  // 3. English word match — only the actual translation word passed by caller
  if (englishWord && typeof lookupSymbolByWord === 'function') {
    const w = String(englishWord).toLowerCase().replace(/[.,;:!?'"()]/g, '').trim();
    if (w.length > 1) {
      symbol = lookupSymbolByWord(w);
      if (symbol) return symbol;
    }
  }

  return null;
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
  
  // Clear morph context — it was specific to the originally tapped interlinear word
  currentMorphContext = null;
  
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

// Render Hebrew Parsing section for the Strong's sidebar
// Uses currentMorphContext (set when clicking from interlinear or main text, cleared on panel navigation)
function renderMorphParsingHtml() {
  if (!currentMorphContext) return '';
  const { hebrewText, morphCode, lemma } = currentMorphContext;
  if (!morphCode || typeof decodeMorphology !== 'function') return '';
  
  const decoded = decodeMorphology(morphCode);
  if (!decoded || !decoded.parts || decoded.parts.length === 0) return '';
  
  const lang = getMorphhbLang(morphCode);
  const prefixMeanings = typeof getPrefixMeanings === 'function' ? getPrefixMeanings(lemma) : [];
  
  // Get the root word from the dictionary for comparison with inflected form
  const strongsNum = typeof primaryStrongsFromLemma === 'function' ? primaryStrongsFromLemma(lemma, lang) : null;
  const rootWord = (strongsNum && typeof getRootWord === 'function')
    ? getRootWord(strongsNum, typeof strongsHebrewDictionary !== 'undefined' ? strongsHebrewDictionary : {})
    : '';
  
  let html = '<div class="strongs-morph-parsing">';
  html += '<div class="morph-parsing-header">Hebrew Parsing</div>';
  
  // Inflected form vs root form
  if (hebrewText) {
    html += `<div class="morph-parsing-row"><span class="morph-label">Form in text</span><span class="morph-value morph-hebrew">${hebrewText}</span></div>`;
  }
  if (rootWord && rootWord !== hebrewText) {
    html += `<div class="morph-parsing-row"><span class="morph-label">Root</span><span class="morph-value morph-hebrew">${rootWord}</span></div>`;
  }
  
  // Breakdown of each part (prefixes + root + suffixes)
  const hebrewParts = hebrewText ? hebrewText.split('/') : [];
  let prefixIdx = 0;
  
  for (let i = 0; i < decoded.parts.length; i++) {
    const part = decoded.parts[i];
    const partHebrew = hebrewParts[i] || '';
    const role = part.role || 'word';
    
    // Build the detail line
    let detail = part.partOfSpeech || '';
    const extras = [];
    if (part.type) extras.push(part.type);
    if (part.stem) extras.push(part.stem);
    if (part.person) extras.push(part.person + ' person');
    if (part.gender) extras.push(part.gender.toLowerCase());
    if (part.number) extras.push(part.number.toLowerCase());
    if (part.state) extras.push(part.state.toLowerCase());
    if (extras.length > 0) detail += ': ' + extras.join(', ');
    
    // Prefix meaning
    let meaning = '';
    if (role === 'prefix' && prefixIdx < prefixMeanings.length) {
      meaning = ` "${prefixMeanings[prefixIdx]}"`;
      prefixIdx++;
    }
    
    const roleClass = role === 'prefix' ? 'morph-role-prefix' : role === 'suffix' ? 'morph-role-suffix' : 'morph-role-root';
    const roleLabel = role === 'prefix' ? 'Prefix' : role === 'suffix' ? 'Suffix' : decoded.parts.length > 1 ? 'Root' : '';
    
    html += `<div class="morph-parsing-part ${roleClass}">`;
    if (partHebrew) {
      html += `<span class="morph-part-hebrew">${partHebrew}</span>`;
    }
    if (roleLabel) {
      html += `<span class="morph-part-role">${roleLabel}</span>`;
    }
    html += `<span class="morph-part-detail">${detail}${meaning}</span>`;
    
    // Grammar help text for this part
    if (role !== 'prefix' && typeof getMorphPartHelp === 'function') {
      const help = getMorphPartHelp(part, lang);
      if (help.stem || help.type) {
        let helpHtml = '';
        if (help.stem) helpHtml += `<div>${help.stem}</div>`;
        if (help.type) helpHtml += `<div>${help.type}</div>`;
        html += `<div class="morph-part-help">${helpHtml}</div>`;
      }
    }
    
    html += '</div>';
  }
  
  html += '</div>';
  return html;
}

// Render Consonantal Root Connections section for the Strong's sidebar
// Shows all Strong's entries that share the same consonantal skeleton
function renderConsonantalRootSection(strongsNum) {
  if (!strongsNum || !strongsNum.startsWith('H')) return '';
  
  // Build the index lazily on first use
  buildConsonantalRootIndex();
  if (!consonantalRootIndex) return '';
  
  // Get the lemma for this Strong's number
  const entry = getStrongsEntry(strongsNum);
  if (!entry || !entry.lemma) return '';
  
  // Also use the interlinear Hebrew form if available (from currentMorphContext)
  let consonants = stripAllDiacritics(entry.lemma.replace(/[\u05BE\/]/g, ''));
  
  // Try morph context form too — the inflected form in the text may differ from the lemma
  let contextConsonants = null;
  if (currentMorphContext && currentMorphContext.hebrewText) {
    contextConsonants = stripAllDiacritics(currentMorphContext.hebrewText.replace(/[\u05BE\/]/g, ''));
  }
  
  // Look up matches — try the lemma's consonants first, then the context form
  let matches = consonantalRootIndex[consonants] || [];
  let displayConsonants = consonants;
  
  // If context form yields more matches, prefer it
  if (contextConsonants && contextConsonants !== consonants) {
    const contextMatches = consonantalRootIndex[contextConsonants] || [];
    if (contextMatches.length > matches.length) {
      matches = contextMatches;
      displayConsonants = contextConsonants;
    }
  }
  
  // Only show when there are multiple readings (the interesting cases)
  if (matches.length < 2) return '';
  
  let html = '<div class="strongs-root-connections">';
  html += '<div class="root-connections-header">Root Connections</div>';
  html += `<div class="root-connections-consonants">Consonants: <span class="root-consonants-hebrew">${displayConsonants}</span> <span class="root-connections-note">(without vowel marks)</span></div>`;
  html += '<div class="root-connections-subtitle">These consonants can be read as:</div>';
  html += '<div class="root-connections-list">';
  
  for (const matchNum of matches) {
    const matchEntry = getStrongsEntry(matchNum);
    if (!matchEntry) continue;
    
    const isCurrent = matchNum === strongsNum;
    const gloss = matchEntry.strongs_def
      ? matchEntry.strongs_def.replace(/<[^>]*>/g, '').substring(0, 80)
      : '';
    
    html += `<div class="root-connection-entry${isCurrent ? ' root-connection-current' : ''}" title="${matchNum}">`;
    if (isCurrent) {
      // Current entry: lemma + gloss + [current] marker on right (no Strong's num — it's in the pane title)
      html += `<span class="root-connection-lemma">${matchEntry.lemma || ''}</span>`;
      html += `<span class="root-connection-gloss">${gloss}</span>`;
      html += `<span class="root-connection-marker">current</span>`;
    } else {
      // Other entries: clickable link, Strong's number right-justified (hidden on mobile)
      html += `<a href="#" class="root-connection-link" onclick="navigateToStrongs('${matchNum}', event)">`;
      html += `<span class="root-connection-lemma">${matchEntry.lemma || ''}</span>`;
      html += `<span class="root-connection-gloss">${gloss}</span>`;
      html += `<span class="root-connection-num">${matchNum}</span>`;
      html += '</a>';
    }
    html += '</div>';
  }
  
  html += '</div>';
  html += '<div class="root-connections-footer">The vowel pointing (added ~600–900 AD) selects one reading. The consonantal text allows other interpretations.</div>';
  html += '</div>';
  return html;
}

// Render a single ref chip (verse + stem badge + translation + Strong's links)
// skipStem: true when rendering inside a stem section (stem is already in the header)
function renderBDBRef(ref, skipStem) {
  if (!ref) return '';
  const parts = [];
  if (ref.verse) {
    const escaped = ref.verse.replace(/'/g, "\\'");
    parts.push(`<span class="bdb-verse-ref" onclick="navigateToBDBVerse('${escaped}', event)">${ref.verse}</span>`);
  }
  if (ref.stem && !skipStem) parts.push(`<span class="bdb-stem-badge">${ref.stem}</span>`);
  if (ref.translation) parts.push(`<span class="bdb-trans-word">"${ref.translation}"</span>`);
  if (ref.strongs && ref.strongs.length) {
    for (const sn of ref.strongs) {
      if (sn !== bdbCurrentStrongs) {
        parts.push(`<span class="bdb-strongs-link" onclick="navigateToStrongs('${sn}', event)">${sn}</span>`);
      }
    }
  }
  return parts.length ? `<span class="bdb-ref-chip">${parts.join(' ')}</span>` : '';
}

// Track which Strong's entry the BDB section is currently showing (to avoid self-links)
let bdbCurrentStrongs = '';

// Navigate to a verse from BDB ref
function navigateToBDBVerse(verseRef, event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }
  const match = verseRef.match(/^(\d?\s?[A-Za-z]+)\s+(\d+):(\d+)/);
  if (!match) return;
  // Map abbreviations to full book names
  const abbrevMap = {
    'Gen': 'Genesis', 'Exod': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers',
    'Deut': 'Deuteronomy', 'Josh': 'Joshua', 'Judg': 'Judges', 'Ruth': 'Ruth',
    '1Sam': '1 Samuel', '2Sam': '2 Samuel', '1Kgs': '1 Kings', '1Kin': '1 Kings',
    '2Kgs': '2 Kings', '2Kin': '2 Kings', '1Chr': '1 Chronicles', '2Chr': '2 Chronicles',
    'Ezra': 'Ezra', 'Neh': 'Nehemiah', 'Esth': 'Esther', 'Est': 'Esther',
    'Job': 'Job', 'Psa': 'Psalms', 'Prov': 'Proverbs', 'Pro': 'Proverbs',
    'Eccl': 'Ecclesiastes', 'Song': 'Song of Solomon', 'Isa': 'Isaiah',
    'Jer': 'Jeremiah', 'Lam': 'Lamentations', 'Ezek': 'Ezekiel', 'Eze': 'Ezekiel',
    'Dan': 'Daniel', 'Hos': 'Hosea', 'Joel': 'Joel', 'Amos': 'Amos',
    'Obad': 'Obadiah', 'Jon': 'Jonah', 'Jonah': 'Jonah', 'Mic': 'Micah',
    'Nah': 'Nahum', 'Hab': 'Habakkuk', 'Zeph': 'Zephaniah', 'Hag': 'Haggai',
    'Zech': 'Zechariah', 'Mal': 'Malachi',
    'Matt': 'Matthew', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John',
    'Acts': 'Acts', 'Rom': 'Romans', '1Cor': '1 Corinthians', '2Cor': '2 Corinthians',
    'Gal': 'Galatians', 'Eph': 'Ephesians', 'Phil': 'Philippians', 'Col': 'Colossians',
    '1Thess': '1 Thessalonians', '2Thess': '2 Thessalonians', '1Tim': '1 Timothy',
    '2Tim': '2 Timothy', 'Tit': 'Titus', 'Phlm': 'Philemon', 'Heb': 'Hebrews',
    'Jas': 'James', '1Pet': '1 Peter', '2Pet': '2 Peter', '1John': '1 John',
    '2John': '2 John', '3John': '3 John', 'Jude': 'Jude', 'Rev': 'Revelation'
  };
  const bookAbbr = match[1].trim();
  const book = abbrevMap[bookAbbr] || bookAbbr;
  const chapter = parseInt(match[2]);
  const verse = parseInt(match[3]);
  closeStrongsPanel();
  if (typeof openBibleExplorerTo === 'function') {
    openBibleExplorerTo(book, chapter, verse);
  }
}

// Verse tooltip for BDB scripture references — shows verse text on hover
let _verseTooltipTimer = null;

function showVerseTooltip(el, event) {
  // Clear any pending hide
  if (_verseTooltipTimer) { clearTimeout(_verseTooltipTimer); _verseTooltipTimer = null; }
  
  const ref = el.dataset.ref;
  if (!ref) return;
  
  // Parse the reference to get normalized book + chapter:verse
  const match = ref.match(/^(\d?\s?[A-Za-z][A-Za-z ]*)\s+(\d+):(\d+)/);
  if (!match) return;
  
  // Reuse the BDB abbreviation map
  const abbrevMap = {
    'Gen': 'Genesis', 'Exod': 'Exodus', 'Exo': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers',
    'Deut': 'Deuteronomy', 'Josh': 'Joshua', 'Judg': 'Judges', 'Ruth': 'Ruth',
    '1Sam': '1 Samuel', '2Sam': '2 Samuel', '1Kgs': '1 Kings', '1Kin': '1 Kings',
    '2Kgs': '2 Kings', '2Kin': '2 Kings', '1Chr': '1 Chronicles', '2Chr': '2 Chronicles',
    'Ezra': 'Ezra', 'Neh': 'Nehemiah', 'Esth': 'Esther', 'Est': 'Esther',
    'Job': 'Job', 'Psa': 'Psalms', 'Ps': 'Psalms', 'Prov': 'Proverbs', 'Pro': 'Proverbs',
    'Eccl': 'Ecclesiastes', 'Song': 'Song of Solomon', 'Isa': 'Isaiah', 'Is': 'Isaiah',
    'Jer': 'Jeremiah', 'Lam': 'Lamentations', 'Ezek': 'Ezekiel', 'Eze': 'Ezekiel',
    'Dan': 'Daniel', 'Hos': 'Hosea', 'Joel': 'Joel', 'Amos': 'Amos',
    'Obad': 'Obadiah', 'Jon': 'Jonah', 'Jonah': 'Jonah', 'Mic': 'Micah',
    'Nah': 'Nahum', 'Hab': 'Habakkuk', 'Zeph': 'Zephaniah', 'Hag': 'Haggai',
    'Zech': 'Zechariah', 'Mal': 'Malachi',
    'Matt': 'Matthew', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John',
    'Acts': 'Acts', 'Rom': 'Romans', '1Cor': '1 Corinthians', '2Cor': '2 Corinthians',
    'Gal': 'Galatians', 'Eph': 'Ephesians', 'Phil': 'Philippians', 'Col': 'Colossians',
    '1Thess': '1 Thessalonians', '2Thess': '2 Thessalonians', '1Tim': '1 Timothy',
    '2Tim': '2 Timothy', 'Tit': 'Titus', 'Phlm': 'Philemon', 'Heb': 'Hebrews',
    'Jas': 'James', '1Pet': '1 Peter', '2Pet': '2 Peter', '1John': '1 John',
    '2John': '2 John', '3John': '3 John', 'Jude': 'Jude', 'Rev': 'Revelation'
  };
  
  const bookAbbr = match[1].trim();
  const book = abbrevMap[bookAbbr] || bookAbbr;
  const chapter = parseInt(match[2]);
  const verse = parseInt(match[3]);
  const fullRef = `${book} ${chapter}:${verse}`;
  
  // Remove any existing verse tooltip
  hideVerseTooltip(true);
  
  // Try to get verse text
  let verseText = null;
  if (typeof getVerseText === 'function') {
    verseText = getVerseText(fullRef);
  }
  if (!verseText && typeof Bible !== 'undefined') {
    const trans = (typeof currentTranslation !== 'undefined') ? currentTranslation : 'kjv';
    const v = Bible.getVerse(trans, book, chapter, verse);
    if (v) verseText = v.text;
  }
  
  // Create tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'verse-hover-tooltip';
  tooltip.className = 'verse-hover-tooltip';
  
  let html = `<div class="verse-tooltip-ref">${escapeHtml(fullRef)}</div>`;
  if (verseText) {
    html += `<div class="verse-tooltip-text">${escapeHtml(verseText)}</div>`;
  } else {
    html += `<div class="verse-tooltip-text verse-tooltip-unavailable">Verse text not loaded</div>`;
  }
  
  tooltip.innerHTML = html;
  getBibleTooltipPortal().appendChild(tooltip);
  
  // Position tooltip below the reference (viewport coords for position:fixed)
  const rect = el.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  let left = rect.left;
  let top = rect.bottom + 5;
  
  // Keep within viewport
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }
  if (left < 10) left = 10;
  // If it would go below viewport, show above instead
  if (top + tooltipRect.height > window.innerHeight - 10) {
    top = rect.top - tooltipRect.height - 5;
  }
  if (top < 10) top = 10;
  
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  tooltip.style.opacity = '1';
  
  // Click tooltip to navigate
  tooltip.addEventListener('click', function(e) {
    e.stopPropagation();
    hideVerseTooltip(true);
    navigateToBDBVerse(ref, e);
  });
  
  // Keep tooltip visible while mouse is on it
  tooltip.addEventListener('mouseenter', function() {
    if (_verseTooltipTimer) { clearTimeout(_verseTooltipTimer); _verseTooltipTimer = null; }
  });
  tooltip.addEventListener('mouseleave', function() {
    hideVerseTooltip(true);
  });
}

function hideVerseTooltip(immediate) {
  if (_verseTooltipTimer) { clearTimeout(_verseTooltipTimer); _verseTooltipTimer = null; }
  if (immediate) {
    const tooltip = document.getElementById('verse-hover-tooltip');
    if (tooltip) tooltip.remove();
  } else {
    // Small delay so mouse can move to the tooltip
    _verseTooltipTimer = setTimeout(() => {
      const tooltip = document.getElementById('verse-hover-tooltip');
      if (tooltip) tooltip.remove();
    }, 150);
  }
}

// BDB view mode: 'ai' or 'original' — persisted in localStorage
function getBDBViewMode() {
  try { return localStorage.getItem('bdb-view-mode') || 'ai'; } catch (e) { return 'ai'; }
}

function setBDBViewMode(mode) {
  try { localStorage.setItem('bdb-view-mode', mode); } catch (e) {}
}

// Toggle between AI Summary and Original BDB views
function toggleBDBView(strongsNum) {
  const section = document.querySelector('.strongs-bdb-section');
  if (!section) return;
  
  const currentMode = getBDBViewMode();
  const newMode = currentMode === 'ai' ? 'original' : 'ai';
  setBDBViewMode(newMode);
  
  if (newMode === 'original') {
    // Load formatted data if not loaded yet
    if (!bdbFormattedData) {
      const toggleLink = section.querySelector('.bdb-view-toggle');
      if (toggleLink) toggleLink.textContent = 'Loading...';
      loadBDBFormatted().then(ok => {
        if (ok) {
          swapBDBContent(section, strongsNum, 'original');
        } else {
          setBDBViewMode('ai');
          if (toggleLink) toggleLink.textContent = 'Show Original BDB';
        }
      });
    } else {
      swapBDBContent(section, strongsNum, 'original');
    }
  } else {
    swapBDBContent(section, strongsNum, 'ai');
  }
}

// Swap the BDB section content between AI and original views
function swapBDBContent(section, strongsNum, mode) {
  const bodyEl = section.querySelector('.bdb-body');
  const toggleLink = section.querySelector('.bdb-view-toggle');
  if (!bodyEl) return;
  
  if (mode === 'original') {
    bodyEl.innerHTML = renderBDBOriginalContent(strongsNum);
    if (toggleLink) toggleLink.textContent = 'Show AI Summary';
  } else {
    bodyEl.innerHTML = renderBDBAIContent(strongsNum);
    if (toggleLink) toggleLink.textContent = 'Show Original BDB';
  }
}

// Render BDB lexicon section — wrapper with toggle
function renderBDBSection(strongsNum) {
  if (!bdbData || !strongsNum) return '';
  
  const entry = bdbData[strongsNum];
  const baseNum = strongsNum.replace(/[a-z]$/, '');
  const e = entry || bdbData[baseNum];
  if (!e) return '';
  
  // If it's a raw string (old format), fall back to simple display
  if (typeof e === 'string') {
    return `<div class="strongs-bdb-section"><div class="bdb-header">BDB Lexicon</div><div class="bdb-content-raw">${e.substring(0, 800).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div></div>`;
  }
  
  bdbCurrentStrongs = strongsNum;
  
  const viewMode = getBDBViewMode();
  const escaped = strongsNum.replace(/'/g, "\\'");
  // Actual displayed mode: only show original if data is loaded
  const showOriginal = viewMode === 'original' && bdbFormattedData;
  
  let html = '<div class="strongs-bdb-section">';
  html += '<div class="bdb-header-row">';
  html += '<div class="bdb-header">Hebrew Lexicon</div>';
  html += `<span class="bdb-view-toggle" onclick="toggleBDBView('${escaped}')">${showOriginal ? 'Show AI Summary' : 'Show Original BDB'}</span>`;
  html += '</div>';
  
  // Body container — render the active view
  html += '<div class="bdb-body">';
  if (showOriginal) {
    html += renderBDBOriginalContent(strongsNum);
  } else {
    html += renderBDBAIContent(strongsNum);
  }
  html += '</div>';
  
  html += '</div>';
  return html;
}

// Render AI summary content (the existing bdb-ai.json content)
function renderBDBAIContent(strongsNum) {
  if (!bdbData || !strongsNum) return '';
  
  const entry = bdbData[strongsNum];
  const baseNum = strongsNum.replace(/[a-z]$/, '');
  const e = entry || bdbData[baseNum];
  if (!e || typeof e === 'string') return '';
  
  // Determine the current stem from morph context (for auto-expanding relevant section)
  let activeStem = null;
  if (currentMorphContext && currentMorphContext.morphCode) {
    const decoded = typeof decodeMorphology === 'function' ? decodeMorphology(currentMorphContext.morphCode) : null;
    if (decoded && decoded.parts) {
      const verbPart = decoded.parts.find(p => p.posCode === 'V' && p.role !== 'prefix');
      if (verbPart && verbPart.stem) activeStem = verbPart.stem;
    }
  }
  
  let html = '';
  
  // Stems (for verbs) — active stem first and expanded, others behind "See all stems"
  if (e.stems && e.stems.length > 0) {
    // Sort: active stem first, then rest in original order
    const sortedStems = activeStem
      ? [
          ...e.stems.filter(s => s.stem === activeStem),
          ...e.stems.filter(s => s.stem !== activeStem)
        ]
      : e.stems;
    
    const activeEntry = activeStem ? sortedStems[0] : null;
    const otherStems = activeStem ? sortedStems.slice(1) : sortedStems;
    
    html += '<div class="bdb-stems">';
    
    // Render active stem (or first stem if no context) — always visible
    const firstStem = activeEntry || sortedStems[0];
    if (firstStem) {
      html += '<div class="bdb-sense bdb-sense-active">';
      html += `<div class="bdb-sense-head"><span class="bdb-stem-badge">${firstStem.stem}</span> <span class="bdb-sense-meaning">${firstStem.meaning || ''}</span></div>`;
      if (firstStem.detail) html += `<div class="bdb-sense-detail">${firstStem.detail}</div>`;
      if (firstStem.refs && firstStem.refs.length) {
        html += `<div class="bdb-refs">${firstStem.refs.map(r => renderBDBRef(r, true)).join('')}</div>`;
      }
      html += '</div>';
    }
    
    // Other stems behind expandable
    const stemsToHide = activeEntry ? otherStems : sortedStems.slice(1);
    if (stemsToHide.length > 0) {
      html += `<div class="bdb-other-stems-toggle" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')"><span class="bdb-chevron">›</span> See all ${e.stems.length} stems</div>`;
      html += '<div class="bdb-other-stems">';
      for (const s of stemsToHide) {
        html += '<div class="bdb-sense">';
        html += `<div class="bdb-sense-head"><span class="bdb-stem-badge">${s.stem}</span> <span class="bdb-sense-meaning">${s.meaning || ''}</span></div>`;
        if (s.detail) html += `<div class="bdb-sense-detail">${s.detail}</div>`;
        if (s.refs && s.refs.length) {
          html += `<div class="bdb-refs">${s.refs.map(r => renderBDBRef(r, true)).join('')}</div>`;
        }
        html += '</div>';
      }
      html += '</div>';
    }
    
    html += '</div>';
  }
  
  // Senses (for nouns/particles)
  if (e.senses && e.senses.length > 0) {
    html += '<div class="bdb-senses">';
    html += '<div class="bdb-sub-header">Senses</div>';
    for (const s of e.senses) {
      html += '<div class="bdb-sense">';
      html += `<div class="bdb-sense-head"><span class="bdb-sense-num">${s.number}.</span> <span class="bdb-sense-meaning">${s.meaning || ''}</span></div>`;
      if (s.detail) html += `<div class="bdb-sense-detail">${s.detail}</div>`;
      if (s.refs && s.refs.length) {
        html += `<div class="bdb-refs">${s.refs.map(renderBDBRef).join('')}</div>`;
      }
      html += '</div>';
    }
    html += '</div>';
  }
  
  // Callout boxes
  if (e.keyDistinction) {
    html += `<div class="bdb-callout bdb-callout-distinction"><div class="bdb-callout-label">Key Distinction</div>${e.keyDistinction}</div>`;
  }
  if (e.translationNote) {
    html += `<div class="bdb-callout bdb-callout-translation"><div class="bdb-callout-label">Translation Note</div>${e.translationNote}</div>`;
  }
  if (e.insight) {
    html += `<div class="bdb-callout bdb-callout-insight"><div class="bdb-callout-label">Insight</div>${e.insight}</div>`;
  }
  if (e.rootNote) {
    html += `<div class="bdb-callout bdb-callout-root"><div class="bdb-callout-label">Consonantal Root</div>${e.rootNote}</div>`;
  }
  
  // Evidence (expandable)
  if (e.evidence && e.evidence.length > 0) {
    html += `<button class="bdb-evidence-btn" onclick="this.nextElementSibling.classList.toggle('open');this.textContent=this.nextElementSibling.classList.contains('open')?'Hide evidence':'Show evidence'">Show evidence</button>`;
    html += '<div class="bdb-evidence">';
    for (const ev of e.evidence) {
      html += '<div class="bdb-evidence-point">';
      html += `<div class="bdb-evidence-text">${ev.point || ''}</div>`;
      if (ev.refs && ev.refs.length) {
        html += `<div class="bdb-refs">${ev.refs.map(renderBDBRef).join('')}</div>`;
      }
      html += '</div>';
    }
    html += '</div>';
  }
  
  // Key verses
  if (e.keyVerses && e.keyVerses.length > 0) {
    html += '<div class="bdb-key-verses">';
    html += '<div class="bdb-kv-label">Key Verses</div>';
    for (const kv of e.keyVerses) {
      const escaped = (kv.verse || '').replace(/'/g, "\\'");
      html += `<div class="bdb-kv-item"><span class="bdb-verse-ref" onclick="navigateToBDBVerse('${escaped}', event)">${kv.verse}</span>`;
      if (kv.note) html += ` <span class="bdb-kv-note">${kv.note}</span>`;
      html += '</div>';
    }
    html += '</div>';
  }
  
  // Attribution
  html += '<div class="bdb-attribution">Based on Brown-Driver-Briggs (1906). Enhanced with modern analysis.</div>';
  
  return html;
}

// Render formatted original BDB content (from bdb-formatted.json)
function renderBDBOriginalContent(strongsNum) {
  const baseNum = strongsNum.replace(/[a-z]$/, '');
  const e = bdbFormattedData ? (bdbFormattedData[strongsNum] || bdbFormattedData[baseNum]) : null;
  
  // Fall back to raw text display if formatted data unavailable
  if (!e) {
    const rawBdb = bdbRawData ? (bdbRawData[strongsNum] || bdbRawData[baseNum]) : null;
    if (rawBdb) {
      return `<div class="bdb-original-content">${formatRawBDB(rawBdb)}</div><div class="bdb-attribution">Brown-Driver-Briggs Hebrew Lexicon (1906)</div>`;
    }
    return '<div class="bdb-original-empty">Original BDB entry not available for this word.</div>';
  }
  
  let html = '<div class="bdb-original-content">';
  
  // Intro / etymology
  if (e.intro) {
    html += `<div class="bdb-original-intro">${escapeHtml(e.intro)}</div>`;
  }
  
  // Sections (stems or General)
  if (e.sections && e.sections.length > 0) {
    for (const sec of e.sections) {
      html += '<div class="bdb-original-section">';
      if (sec.label && sec.label !== 'General') {
        html += `<div class="bdb-original-section-label"><span class="bdb-stem-badge">${escapeHtml(sec.label)}</span></div>`;
      }
      if (sec.text) {
        html += `<div class="bdb-original-section-text">${formatOriginalBDBText(sec.text)}</div>`;
      }
      // Verse reference chips
      if (sec.verses && sec.verses.length > 0) {
        html += '<div class="bdb-refs bdb-original-refs">';
        for (const v of sec.verses) {
          const escaped = v.replace(/'/g, "\\'");
          html += `<span class="bdb-verse-ref" onclick="navigateToBDBVerse('${escaped}', event)">${escapeHtml(v)}</span> `;
        }
        html += '</div>';
      }
      html += '</div>';
    }
  }
  
  html += '</div>';
  html += '<div class="bdb-attribution">Brown-Driver-Briggs Hebrew Lexicon (1906). Text preserved verbatim; structure added for readability.</div>';
  
  return html;
}

// Format original BDB text with minimal markup (highlight stems, verse refs, linkify scripture)
function formatOriginalBDBText(text) {
  if (!text) return '';
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Highlight stem labels
  html = html.replace(/\b(Qal|Niph[`']?al|Pi[`']?el|Pu[`']?al|Hiph[`']?il|Hoph[`']?al|Hithpa[`']?el|Pe[`']?al|Pa[`']?el|Aph[`']?el)\b/g,
    '<span class="bdb-stem-badge">$1</span>');
  // Highlight grammatical forms
  html = html.replace(/\b(Perfect|Imperfect|Imperative|Infinitive|Participle)\b/g,
    '<span class="bdb-form-label">$1</span>');
  // Linkify scripture references (Gen 1:1, Exodus 20:3, 1Sam 9:1, etc.)
  html = linkifyBDBScriptureRefs(html);
  html = html.replace(/\n/g, '<br>');
  return html;
}

// Format raw BDB text for display (formatting only, no rewriting)
function formatRawBDB(text) {
  if (!text) return '';
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Highlight stem labels
  html = html.replace(/\b(Qal|Niph[`']?al|Pi[`']?el|Pu[`']?al|Hiph[`']?il|Hoph[`']?al|Hithpa[`']?el|Pe[`']?al|Pa[`']?el|Aph[`']?el)\b/g,
    '<span class="bdb-stem-badge">$1</span>');
  // Highlight grammatical forms
  html = html.replace(/\b(Perfect|Imperfect|Imperative|Infinitive|Participle)\b/g,
    '<span class="bdb-form-label">$1</span>');
  // Linkify scripture references
  html = linkifyBDBScriptureRefs(html);
  html = html.replace(/\n/g, '<br>');
  return html;
}

// Linkify scripture references in BDB text (both formatted and raw)
// Wraps references like "Gen 1:1", "Exodus 20:3", "1Sam 9:1" in clickable/hoverable spans
function linkifyBDBScriptureRefs(html) {
  // Book name patterns (abbreviated and full, with optional numbers prefix)
  const bookNames = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
    '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther',
    'Job', 'Psalms?', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
    'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
    'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
    '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
    'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
    'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
    'Jude', 'Revelation',
    // Common BDB abbreviations
    'Gen', 'Exod?', 'Lev', 'Num', 'Deut',
    'Josh', 'Judg', 'Sam', 'Kgs', 'Kin', 'Chr', 'Neh', 'Esth?',
    'Psa?', 'Prov?', 'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek?', 'Eze', 'Dan',
    'Hos', 'Obad', 'Jon', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal',
    'Matt?', 'Mk', 'Lk', 'Jn', 'Rom', 'Cor', 'Gal', 'Eph', 'Phil', 'Col',
    'Thess', 'Tim', 'Tit', 'Phlm', 'Heb', 'Jas', 'Pet', 'Rev'
  ];
  const bookPattern = bookNames.join('|');
  // Match: "Book Chapter:Verse" with optional verse ranges/lists
  // e.g. "Gen 1:1", "Exodus 20:3-5", "1Sam 9:1,3", "Ps 119:1"
  const refPattern = new RegExp(
    `((?:1|2|3|I{1,3})?\\s*(?:${bookPattern})\\.?)\\s+(\\d+):(\\d+(?:[-–,]\\s*\\d+)*)`,
    'g'
  );
  return html.replace(refPattern, (match, book, chapter, verses) => {
    const ref = match.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const escaped = ref.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `<span class="bdb-verse-ref" data-ref="${escaped}" onclick="navigateToBDBVerse('${escaped}', event)" onmouseenter="showVerseTooltip(this, event)" onmouseleave="hideVerseTooltip()">${match}</span>`;
  });
}

// Raw BDB data (loaded alongside AI data for verification)
let bdbRawData = null;

async function loadBDBRaw() {
  if (bdbRawData) return;
  try {
    const response = await fetch('/data/bdb.json');
    if (response.ok) bdbRawData = await response.json();
  } catch (e) {}
}

// Formatted BDB data (structured original text, lazy-loaded on demand)
let bdbFormattedData = null;
let bdbFormattedLoading = null;

async function loadBDBFormatted() {
  if (bdbFormattedData) return true;
  if (bdbFormattedLoading) return bdbFormattedLoading;
  
  bdbFormattedLoading = (async () => {
    try {
      const response = await fetch('/data/bdb-formatted.json.gz');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // Decompress gzipped data using DecompressionStream API
      const ds = new DecompressionStream('gzip');
      const decompressed = response.body.pipeThrough(ds);
      const text = await new Response(decompressed).text();
      bdbFormattedData = JSON.parse(text);
      console.log(`BDB formatted lexicon loaded: ${Object.keys(bdbFormattedData).length} entries`);
      return true;
    } catch (err) {
      console.warn('BDB formatted lexicon not available:', err.message);
      return false;
    } finally {
      bdbFormattedLoading = null;
    }
  })();
  
  return bdbFormattedLoading;
}

// Update Strong's panel content (without adding to history)
function updateStrongsPanelContent(strongsNum, isNavigation = false) {
  const sidebar = document.getElementById('strongs-sidebar');
  if (!sidebar) return;
  
  // Clear morph context when navigating within the panel (it was specific to the tapped word)
  if (isNavigation) currentMorphContext = null;
  
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
  
  // Add Hebrew morphology parsing (from interlinear click or main text click)
  html += renderMorphParsingHtml();
  
  // Add consonantal root connections (Hebrew words sharing the same consonants)
  html += renderConsonantalRootSection(strongsNum);
  
  // Add BDB lexicon section (if loaded)
  html += renderBDBSection(strongsNum);
  
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
  
  // Add verse search link — populates the global search bar with this Strong's number
  html += `
    <div class="strongs-verse-search">
      <button id="strongs-find-verses-btn" class="strongs-find-verses-btn" onclick="searchStrongsInGlobal('${strongsNum}')">Find all verses →</button>
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
  
  // Load BDB data if not loaded, then inject section
  if (!bdbData) {
    loadBDB().then(() => {
      if (contentEl.querySelector('.strongs-bdb-section')) return;
      const bdbHtml = renderBDBSection(strongsNum);
      if (bdbHtml) {
        const insertBefore = contentEl.querySelector('.person-info-section, .strongs-symbol-info, .strongs-word-study, .strongs-gematria-section, .strongs-verse-search');
        if (insertBefore) {
          insertBefore.insertAdjacentHTML('beforebegin', bdbHtml);
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
  
  // Add Hebrew morphology parsing (from interlinear click or main text click)
  html += renderMorphParsingHtml();
  
  // Add consonantal root connections (Hebrew words sharing the same consonants)
  html += renderConsonantalRootSection(strongsNum);
  
  // Add BDB lexicon section (if loaded)
  html += renderBDBSection(strongsNum);
  
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
  
  // Add verse search link — populates the global search bar with this Strong's number
  html += `
    <div class="strongs-verse-search">
      <button id="strongs-find-verses-btn" class="strongs-find-verses-btn" onclick="searchStrongsInGlobal('${strongsNum}')">Find all verses →</button>
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
  
  // Load BDB data if not loaded, then inject section
  if (!bdbData) {
    loadBDB().then(() => {
      if (contentEl.querySelector('.strongs-bdb-section')) return;
      const bdbHtml = renderBDBSection(strongsNum);
      if (bdbHtml) {
        // Insert before person info or symbolic meaning
        const insertBefore = contentEl.querySelector('.strongs-symbol-info, .person-info-section, .strongs-word-study, .strongs-gematria-section, .strongs-verse-search');
        if (insertBefore) {
          insertBefore.insertAdjacentHTML('beforebegin', bdbHtml);
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
  // Push to history when first opening the panel so mobile back button closes it.
  // Navigation within the already-open panel uses replace (default) to avoid polluting history.
  if (!skipDispatch && typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_STRONGS_ID', strongsId: strongsNum, replace: !isNewPanel });
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
  // Clear interlinear word highlight
  highlightInterlinearWord(null);
  // Reset history
  strongsHistory = [];
  strongsHistoryIndex = -1;
  
  // Update state to remove strongsId from URL (unless called from URL sync)
  // Use replace — closing the panel removes the ?strongs= param without adding a new history entry.
  // The back button already handles this via the pushed entry from when the panel opened.
  if (!skipDispatch && typeof AppStore !== 'undefined') {
    AppStore.dispatch({ type: 'SET_STRONGS_ID', strongsId: null, replace: true });
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

// Render verse text with inline Strong's tags: word{H####} / word{G####}
// Parses tags and wraps words in clickable spans — works for ANY translation with Strong's tags.
// Also applies symbol highlighting for words matching the symbol dictionary.
// Handles translation patch markers: extracts indexed PUA markers first, then applies
// CSS classes + data-patch-idx to elements that fall within patched character ranges.
function renderInlineStrongs(taggedText, reference) {
  if (!taggedText) return '';

  // ── Extract indexed patch markers (if any) to get clean text + patch ranges ──
  let text = taggedText;
  let patchRanges = null;
  let patchInfo = null;

  if (typeof TranslationPatches !== 'undefined') {
    const extracted = TranslationPatches.extractMarkers(taggedText);
    if (extracted.patchRanges.length > 0) {
      text = extracted.cleanText;
      patchRanges = extracted.patchRanges;
      patchInfo = TranslationPatches.getPatchRegionInfo(reference);
    }
  }

  // Helper: get the patch index at a character position (-1 if not in any patch)
  function getPatchIdx(charPos) {
    if (!patchRanges) return -1;
    for (const r of patchRanges) {
      if (charPos >= r.start && charPos < r.end) return r.patchIdx;
    }
    return -1;
  }

  // Helper: render plain text with patch-awareness — splits at range boundaries
  // and wraps patched segments in styled spans with data-patch-idx
  function renderPlain(plainText, textPos) {
    if (!plainText) return '';
    if (!patchInfo) return _renderPlainSegment(plainText, reference);

    // Check if the entire segment is uniformly in/out of the same patch
    const startIdx = getPatchIdx(textPos);
    const endIdx = getPatchIdx(textPos + plainText.length - 1);
    if (startIdx === endIdx) {
      const html = _renderPlainSegment(plainText, reference);
      if (startIdx >= 0) {
        return `<span class="${patchInfo.patchClass}"${patchInfo.verseAttr} data-patch-idx="${startIdx}">${html}</span>`;
      }
      return html;
    }

    // Mixed — split at patch range boundaries
    let result = '';
    let i = 0;
    while (i < plainText.length) {
      const curIdx = getPatchIdx(textPos + i);
      let j = i + 1;
      while (j < plainText.length && getPatchIdx(textPos + j) === curIdx) j++;
      const segment = plainText.slice(i, j);
      const html = _renderPlainSegment(segment, reference);
      if (curIdx >= 0) {
        result += `<span class="${patchInfo.patchClass}"${patchInfo.verseAttr} data-patch-idx="${curIdx}">${html}</span>`;
      } else {
        result += html;
      }
      i = j;
    }
    return result;
  }

  // ── Main parser: iterate through Strong's tags ──
  let result = '';
  let pos = 0;
  const len = text.length;

  while (pos < len) {
    const braceIdx = text.indexOf('{', pos);
    if (braceIdx === -1) {
      // No more tags — rest is plain text
      result += renderPlain(text.slice(pos), pos);
      break;
    }

    const closeBrace = text.indexOf('}', braceIdx);
    if (closeBrace === -1) {
      result += renderPlain(text.slice(pos), pos);
      break;
    }

    const tagContent = text.slice(braceIdx + 1, closeBrace);

    // Skip morphology codes like (H8804)
    if (tagContent.startsWith('(')) {
      // Include any text before this brace as plain, skip the tag
      if (braceIdx > pos) {
        result += renderPlain(text.slice(pos, braceIdx), pos);
      }
      pos = closeBrace + 1;
      continue;
    }

    // Valid Strong's tag: H#### or G####
    const strongsMatch = tagContent.match(/^([HG]\d+)$/);
    if (!strongsMatch) {
      // Not a Strong's tag — include as plain text
      result += renderPlain(text.slice(pos, closeBrace + 1), pos);
      pos = closeBrace + 1;
      continue;
    }

    const strongsNum = strongsMatch[1];

    // Find the word before the tag by scanning back from braceIdx
    // The word is the text segment between the previous tag/start and this brace
    const textBefore = text.slice(pos, braceIdx);

    // Split into "leading text" + "word" (the last whitespace-delimited token is the word)
    const lastSpaceIdx = textBefore.lastIndexOf(' ');
    const lastNewlineIdx = textBefore.lastIndexOf('\n');
    const splitIdx = Math.max(lastSpaceIdx, lastNewlineIdx);

    let leadingText, word;
    if (splitIdx === -1) {
      leadingText = '';
      word = textBefore;
    } else {
      leadingText = textBefore.slice(0, splitIdx + 1);
      word = textBefore.slice(splitIdx + 1);
    }

    // Check for name substitution BEFORE rendering leading text
    // (divine name H3068 needs "the " stripped from leading text)
    let displayWord = word;
    let nameSub = null;
    if (word && typeof getNameSubstitution === 'function') {
      nameSub = getNameSubstitution(strongsNum, word);
      if (nameSub) {
        displayWord = nameSub;
        // For divine name (H3068/H3069), strip trailing "the " from leading text
        // so we don't get "the Yahweh" — the replacement already includes the full form
        if ((strongsNum === 'H3068' || strongsNum === 'H3069') && leadingText && /\bthe\s$/.test(leadingText)) {
          leadingText = leadingText.replace(/\bthe\s$/, '');
        }
      }
    }

    // Render leading text as plain (with patch awareness)
    if (leadingText) {
      result += renderPlain(leadingText, pos);
    }

    // Render the Strong's-tagged word
    if (word) {
      const normalized = word.toLowerCase().replace(/[.,;:!?'"()]/g, '');
      const symbol = (typeof lookupSymbolByWord === 'function') ? lookupSymbolByWord(normalized) : null;

      const classes = ['strongs-word'];
      const dataAttrs = [`data-strongs="${strongsNum}"`];

      // Add patch class and data attributes if word is inside a patched range
      const wordPos = pos + (leadingText ? leadingText.length : 0);
      const wordPatchIdx = patchInfo ? getPatchIdx(wordPos) : -1;
      if (wordPatchIdx >= 0) {
        classes.push(patchInfo.patchClass);
        if (patchInfo.verseAttr) {
          dataAttrs.push(patchInfo.verseAttr.trim());
        }
        dataAttrs.push(`data-patch-idx="${wordPatchIdx}"`);
      }

      // Look up Strong's definition
      const strongsEntry = (typeof getStrongsEntry === 'function') ? getStrongsEntry(strongsNum) : null;
      const realDef = strongsEntry?.strongs_def || strongsEntry?.kjv_def || '';
      dataAttrs.push(`data-def="${realDef.replace(/"/g, '&quot;')}"`);

      // Name substitution: add original word and name-sub class
      if (nameSub) {
        classes.push('name-sub');
        dataAttrs.push(`data-original="${word.replace(/"/g, '&quot;')}"`);
      }

      const escapedWord = word.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const escapedGloss = (strongsEntry?.translit || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      let onclick = `handleStrongsWordClick('${strongsNum}', '${escapedWord}', '${escapedGloss}', event)`;

      if (symbol) {
        classes.push('symbol-word');
        dataAttrs.push(`data-symbol="${symbol.name}"`);
        dataAttrs.push(`data-symbol-meaning="${(symbol.is2 || symbol.is || '').replace(/"/g, '&quot;')}"`);
      }

      result += `<span class="${classes.join(' ')}" ${dataAttrs.join(' ')} onclick="${onclick}" onmouseenter="showWordTooltip(event)" onmouseleave="hideWordTooltip(event)">${displayWord}</span>`;
    }

    // Check for consecutive tags on the same word (e.g. word{H1254}{H853})
    pos = closeBrace + 1;

    // Skip consecutive Strong's tags that apply to the same word position
    while (pos < len && text[pos] === '{') {
      const nextClose = text.indexOf('}', pos);
      if (nextClose === -1) break;
      pos = nextClose + 1;
    }
  }

  return result;
}

// Helper: render a plain text segment with symbol highlighting, verse annotations, and name substitution
// Note: translation patches are applied at the verse level BEFORE entering renderInlineStrongs(),
// so this function just handles symbol/annotation/name processing on the already-patched text.
function _renderPlainSegment(text, reference) {
  if (!text) return '';
  let html;
  if (reference) {
    html = applySymbolHighlighting(applyVerseAnnotations(reference, text));
  } else {
    html = applySymbolHighlighting(text);
  }
  // Apply regex-based name substitution (for non-Strong's translations)
  // This runs AFTER symbol/annotation HTML is built, and only touches text content (not tags)
  if (typeof applyNamePreferencesHTML === 'function') {
    html = applyNamePreferencesHTML(html);
  }
  return html;
}

// Render verse text with clickable Strong's words — LEGACY
// Uses NT interlinear data for word matching. OT uses inline tags via renderInlineStrongs().
// Kept as fallback for non-tagged translations.
function renderVerseWithStrongs(bookName, chapter, verseNum, plainText) {
  const isNT = isNTBook(bookName);
  
  // Build Strong's lookup map from NT interlinear data (OT path not applicable — uses inline tags)
  const wordMap = new Map();
  let hasStrongsData = false;
  
  if (isNT && ntInterlinearData) {
    const ref = `${bookName} ${chapter}:${verseNum}`;
    const data = ntInterlinearData[ref];
    
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

// normalizeBookName — delegates to Bible API (comprehensive abbreviation + variant handling)
// This first definition is overridden by the one below, but kept for safety during transition.
function normalizeBookName(book) {
  if (typeof Bible !== 'undefined' && Bible.normalizeBookName) {
    return Bible.normalizeBookName(book);
  }
  // Minimal fallback
  const normalizations = { 'Psalm': 'Psalms', 'Song of Songs': 'Song of Solomon', 'Canticles': 'Song of Solomon' };
  return normalizations[book] || book;
}

// parseBibleText, rebuildTranslationIndex, rebuildIndex — REMOVED
// Bible API (bible.js) handles parsing and indexing internally.
// These stubs exist only if any old code still calls them.
async function parseBibleText() { return []; }
function rebuildTranslationIndex() {}
function rebuildIndex() { syncLegacyVariables(); }

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
  // Normalize to canonical id via Bible API
  const id = (translationId || '').toLowerCase();
  const reg = Bible.getTranslation(id);
  // Fallback: check old config
  const config = reg || BIBLE_TRANSLATIONS[id];
  if (!config) {
    console.warn(`Unknown translation: ${translationId}`);
    return false;
  }
  const canonicalId = reg ? reg.id : config.id;

  // Load via Bible API if not yet loaded
  if (!Bible.isLoaded(canonicalId)) {
    await Bible.loadTranslation(canonicalId);
  }

  if (!Bible.isLoaded(canonicalId)) {
    console.warn(`Failed to load ${canonicalId}`);
    return false;
  }

  // Switch current translation
  currentTranslation = canonicalId;
  _legacyTranslation = null; // force re-sync
  syncLegacyVariables();
  
  // Save preference
  try {
    localStorage.setItem('bible_translation_preference', canonicalId);
  } catch (e) {}
  
  // Update UI
  updateTranslationUI();
  
  // Rebuild chapter counts and redisplay current chapter (skip when in multiverse — state-driven re-render will refresh multiverse content)
  buildBookChapterCounts();
  const state = typeof AppStore !== 'undefined' ? AppStore.getState() : null;
  const isMultiverse = state?.content?.params?.contentType === 'multiverse';
  if (!isMultiverse && bibleExplorerState.currentBook && bibleExplorerState.currentChapter) {
    displayBibleChapter(bibleExplorerState.currentBook, bibleExplorerState.currentChapter, bibleExplorerState.highlightedVerse);
  }
  
  return true;
}

// Update UI to reflect current translation
function updateTranslationUI() {
  const config = Bible.getTranslation(currentTranslation) || BIBLE_TRANSLATIONS[currentTranslation];
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
// translationId: optional; when set, use that translation's verses (avoids race with global bibleData when toggling KJV/ASV)
function buildMultiverseHTML(citationStr, translationId) {
  const trans = translationId || (typeof currentTranslation !== 'undefined' && currentTranslation) || 'kjv';
  if (!Bible.isLoaded(trans)) return '<div class="bible-explorer-welcome"><p>Bible data not loaded.</p></div>';
  // Use Bible API for verse resolution
  const verses = Bible.getVersesForCitation(trans, citationStr);
  if (!verses || verses.length === 0) {
    return '<div class="bible-explorer-welcome"><p>No verses found for this reference.</p></div>';
  }
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
    const hasOrigLangData = (isNT ? ntInterlinearData : morphhbData);
    const hasOriginalLang = hasInterlinear(bookName);
    const origLangClass = hasOriginalLang ? ' has-hebrew' : '';
    // Apply translation patches to the raw text before rendering
    let patchedStrongsText = verse.strongsText;
    let patchedPlainText = verse.text;
    if (typeof TranslationPatches !== 'undefined' && TranslationPatches.applyPatches) {
      if (patchedStrongsText) {
        patchedStrongsText = TranslationPatches.applyPatches(reference, patchedStrongsText, trans);
      }
      if (patchedPlainText) {
        patchedPlainText = TranslationPatches.applyPatches(reference, patchedPlainText, trans);
      }
    }

    let verseText;
    if (patchedStrongsText) {
      // Translation has inline Strong's tags — render as clickable links
      verseText = renderInlineStrongs(patchedStrongsText, reference);
    } else if (hasOriginalLang && hasOrigLangData && trans === 'kjv') {
      // Legacy fallback: KJV interlinear word matching (NT only — OT uses inline tags)
      const kjvVerse = Bible.getVerse('kjv', bookName, chapter, verse.verse);
      const kjvText = kjvVerse ? kjvVerse.text : verse.text;
      verseText = renderVerseWithStrongs(bookName, chapter, verse.verse, kjvText);
    } else {
      let plainHtml = applySymbolHighlighting(applyVerseAnnotations(reference, patchedPlainText));
      if (typeof applyNamePreferencesHTML === 'function') {
        plainHtml = applyNamePreferencesHTML(plainHtml);
      }
      verseText = plainHtml;
    }
    // Convert patch markers to styled spans (after all rendering pipelines)
    if (typeof TranslationPatches !== 'undefined' && TranslationPatches.applyPatchMarkers) {
      verseText = TranslationPatches.applyPatchMarkers(verseText, reference);
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
// translationId: optional; when set, use that translation's data instead of global bibleData (for multiverse so requested translation wins)
// getVersesForCitation — now delegates to Bible API
function getVersesForCitation(citation, translationId) {
  const trans = translationId || currentTranslation || 'kjv';
  if (!Bible.isLoaded(trans)) return [];
  // Build citation string from structured citation object
  let citationStr = citation.book + ' ' + citation.startChapter + ':' + citation.startVerse;
  if (citation.endChapter !== citation.startChapter || citation.endVerse !== citation.startVerse) {
    if (citation.endChapter !== citation.startChapter) {
      citationStr = citation.book + ' ' + citation.startChapter + ':' + citation.startVerse + '-' + citation.endChapter + ':' + citation.endVerse;
    } else {
      citationStr += '-' + citation.endVerse;
    }
  }
  return Bible.getVersesForCitation(trans, citationStr);
}

// getVersesForCitationString — now delegates to Bible API
function getVersesForCitationString(citationStr, translationId) {
  const trans = translationId || currentTranslation || 'kjv';
  if (!Bible.isLoaded(trans)) return [];
  return Bible.getVersesForCitation(trans, citationStr);
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
  if (!Bible.isLoaded(currentTranslation)) {
    await loadTranslation(currentTranslation, true);
    if (!Bible.isLoaded(currentTranslation)) {
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

// Normalize a book name — delegates to Bible API for comprehensive handling
function normalizeBookName(bookStr) {
  if (typeof Bible !== 'undefined' && Bible.normalizeBookName) {
    return Bible.normalizeBookName(bookStr);
  }
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

// Clear chapter cache and re-render when name preferences change
window.addEventListener('namePreferencesChanged', () => {
  chapterHTMLCache.clear();
  // Re-render current chapter if we're viewing one
  if (bibleExplorerState.currentBook && bibleExplorerState.currentChapter) {
    displayBibleChapter(bibleExplorerState.currentBook, bibleExplorerState.currentChapter, bibleExplorerState.highlightedVerse);
  }
});

// Clear chapter cache when translation patches change (accept/reject)
window.addEventListener('patchesChanged', () => {
  chapterHTMLCache.clear();
});

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
  if (savedTranslation && (Bible.getTranslation(savedTranslation) || BIBLE_TRANSLATIONS[savedTranslation])) {
    currentTranslation = savedTranslation;
  }

  // Populate translation dropdown
  populateTranslationDropdown();

  if (!Bible.isLoaded(currentTranslation)) {
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
    syncLegacyVariables();
    buildBookChapterCounts();
    populateBibleBooks();
    updateTranslationUI();
  }
}

// Populate translation dropdown
function populateTranslationDropdown() {
  const translationSelect = document.getElementById('bible-translation-select');
  if (!translationSelect) return;

  // Use user-ordered translations from Bible API
  const { visible, hidden } = Bible.getOrderedTranslations();
  let html = '';
  for (const reg of visible) {
    const selected = reg.id === currentTranslation ? ' selected' : '';
    html += `<option value="${reg.id}"${selected}>${reg.name}</option>`;
  }
  if (hidden.length > 0) {
    html += '<optgroup label="More">';
    for (const reg of hidden) {
      const selected = reg.id === currentTranslation ? ' selected' : '';
      html += `<option value="${reg.id}"${selected}>${reg.name}</option>`;
    }
    html += '</optgroup>';
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

  // Navigate via URL: /reader/bible/translationId → shows book index
  if (typeof AppStore !== 'undefined') {
    AppStore.dispatch({
      type: 'SET_VIEW',
      view: 'reader',
      params: { contentType: 'bible', translation: translationId }
    });
  }
}

// Show the book index page (all 66 books with descriptions)
function goToBookIndex() {
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

  // Show book index
  const textContainer = document.getElementById('bible-explorer-text');
  if (textContainer) {
    textContainer.innerHTML = buildBookIndexHTML();
  }

  const titleEl = document.getElementById('bible-chapter-title');
  if (titleEl) titleEl.textContent = 'Select a book';
}

// Build HTML for the book index page
function buildBookIndexHTML() {
  const trans = Bible.getTranslation(currentTranslation);
  const transName = trans ? trans.fullName : currentTranslation.toUpperCase();
  const descriptions = (typeof BOOK_DESCRIPTIONS !== 'undefined') ? BOOK_DESCRIPTIONS : {};

  const otBooks = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
    '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
    'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
    'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
    'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel',
    'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
    'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'
  ];
  const ntBooks = [
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
    '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
    'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
    'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
    'Jude', 'Revelation'
  ];

  function buildCard(book) {
    const info = descriptions[book] || {};
    const chapters = info.chapters || Bible.getChapterCount(book) || '?';
    const desc = info.description || '';
    const category = info.category || '';
    const categoryBadge = category ? `<span class="book-card-category">${category}</span>` : '';
    return `<div class="bible-book-card" onclick="AppStore.dispatch({type:'SET_VIEW',view:'reader',params:{contentType:'bible',translation:'${currentTranslation}',book:'${book.replace(/'/g, "\\'")}',chapter:1}})">
      <div class="book-card-header">
        <span class="book-card-name">${book}</span>
        <span class="book-card-chapters">${chapters} ch.</span>
      </div>
      ${categoryBadge}
      <p class="book-card-desc">${desc}</p>
    </div>`;
  }

  // Check if current translation is OT-only or NT-only
  const isLXX = currentTranslation === 'lxx';

  let html = `<div class="bible-book-index">
    <div class="book-index-header">
      <h2>${transName}</h2>
      <p>Select a book to begin reading</p>
    </div>`;

  // Old Testament
  if (!isLXX || true) { // LXX has OT
    html += `<div class="book-index-section">
      <h3 class="book-index-section-title">Old Testament</h3>
      <div class="book-index-grid">
        ${otBooks.map(buildCard).join('')}
      </div>
    </div>`;
  }

  // New Testament (skip for LXX)
  if (!isLXX) {
    html += `<div class="book-index-section">
      <h3 class="book-index-section-title">New Testament</h3>
      <div class="book-index-grid">
        ${ntBooks.map(buildCard).join('')}
      </div>
    </div>`;
  }

  html += '</div>';
  return html;
}

// Go to Bible home page — show book index if a translation is loaded, else translation picker
function goToBibleHome() {
  // Always show the translation picker (URL-driven: /reader/bible with no translation)
  bibleExplorerState.currentBook = null;
  bibleExplorerState.currentChapter = null;
  bibleExplorerState.highlightedVerse = null;

  const bookSelect = document.getElementById('bible-book-select');
  const chapterSelect = document.getElementById('bible-chapter-select');
  if (bookSelect) bookSelect.value = '';
  if (chapterSelect) {
    chapterSelect.innerHTML = '<option value="">Ch.</option>';
    chapterSelect.disabled = true;
  }

  const textContainer = document.getElementById('bible-explorer-text');
  if (textContainer) {
    textContainer.innerHTML = getBibleWelcomeHTML();
  }

  const titleEl = document.getElementById('bible-chapter-title');
  if (titleEl) titleEl.textContent = 'Select a translation';
  
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
  // Generate translation cards in user-preferred order
  const { visible, hidden } = Bible.getOrderedTranslations();
  const translations = [...visible, ...hidden];
  let cardsHTML = '';

  if (translations.length > 0) {
    for (const t of translations) {
      const yearStr = t.year ? `<span class="translation-card-year">${t.year}</span>` : '';
      const traits = [];
      if (t.hasStrongs) traits.push("Strong's");
      if (t.id === 'lxx') traits.push('OT Only');
      const traitsHTML = traits.length > 0
        ? `<div class="translation-card-traits">${traits.map(tr => `<span class="trait">${tr}</span>`).join('')}</div>`
        : '';
      cardsHTML += `
        <div class="bible-translation-card" onclick="selectTranslationAndStart('${t.id}')">
          <div class="translation-card-content">
            <h4>${t.fullName} ${yearStr}</h4>
            <p>${t.description || ''}</p>
            ${traitsHTML}
          </div>
        </div>`;
    }
  } else {
    cardsHTML = `
      <div class="bible-translation-card" onclick="selectTranslationAndStart('kjv')">
        <div class="translation-card-content"><h4>King James Version</h4><p>The classic 1611 translation.</p></div>
      </div>
      <div class="bible-translation-card" onclick="selectTranslationAndStart('asv')">
        <div class="translation-card-content"><h4>American Standard Version</h4><p>A literal 1901 translation.</p></div>
      </div>
      <div class="bible-translation-card" onclick="selectTranslationAndStart('lxx')">
        <div class="translation-card-content"><h4>Septuagint (LXX)</h4><p>Greek OT translation.</p></div>
      </div>`;
  }

  return `
    <div class="bible-explorer-welcome">
      <div class="bible-welcome-icon">📖</div>
      <h3>Welcome to the Bible</h3>
      <p>Choose a translation to begin reading, or select a book and chapter from the dropdowns above.</p>
      <div class="bible-translation-cards">
        ${cardsHTML}
      </div>
    </div>
  `;
}

// Build cache of chapter counts for each book
function buildBookChapterCounts() {
  if (!Bible.isLoaded(currentTranslation)) return;

  // Use Bible API for chapter counts — O(1) per book instead of O(31K) iteration
  bibleExplorerState.bookChapterCounts = Bible.getBookChapterCounts();
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
  const hasInterlinearData = useInterlinear && (isNT ? ntInterlinearData : morphhbData);
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

    // Apply translation patches to the raw text before rendering
    let patchedStrongsText = verse.strongsText;
    let patchedPlainText = verse.text;
    if (typeof TranslationPatches !== 'undefined' && TranslationPatches.applyPatches) {
      const trans = currentTranslation || 'kjv';
      if (patchedStrongsText) {
        patchedStrongsText = TranslationPatches.applyPatches(reference, patchedStrongsText, trans);
      }
      if (patchedPlainText) {
        patchedPlainText = TranslationPatches.applyPatches(reference, patchedPlainText, trans);
      }
    }

    let verseText;
    if (patchedStrongsText) {
      // Translation has inline Strong's tags — render them as clickable links
      verseText = renderInlineStrongs(patchedStrongsText, reference);
    } else if (hasOriginalLang && hasInterlinearData) {
      // Fallback: KJV-style interlinear word matching (legacy path)
      verseText = renderVerseWithStrongs(bookName, chapter, verse.verse, verse.text);
    } else {
      let plainHtml = applySymbolHighlighting(applyVerseAnnotations(reference, patchedPlainText));
      // Apply name preferences (regex path for non-Strong's translations)
      if (typeof applyNamePreferencesHTML === 'function') {
        plainHtml = applyNamePreferencesHTML(plainHtml);
      }
      verseText = plainHtml;
    }
    // Convert patch markers to styled spans (after all rendering pipelines)
    if (typeof TranslationPatches !== 'undefined' && TranslationPatches.applyPatchMarkers) {
      verseText = TranslationPatches.applyPatchMarkers(verseText, reference);
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
    const interlinearBtn = `<span class="verse-interlinear-ref" onclick="showInterlinear('${bookName.replace(/'/g, "\\'")}', ${chapter}, ${verse.verse}, event)" title="${interlinearTitle}">☰</span>`;
    const verseNumSpan = `<span class="bible-verse-number" onclick="copyVerseReference('${bookName}', ${chapter}, ${verse.verse})" title="Click to copy reference">${verse.verse}</span>`;
    html += `<div class="bible-explorer-verse${origLangClass}" id="verse-${verse.verse}">
      <div class="verse-meta">${bookRefHtml}${crossRefHtml}${timelineHtml}${interlinearBtn}${verseNumSpan}</div>
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
  
  if (!textContainer || !Bible.isLoaded(currentTranslation)) return;

  // Update title
  if (titleEl) {
    titleEl.textContent = `${bookName} ${chapter}`;
  }

  // Get verses for this chapter via Bible API
  const verses = Bible.getChapter(currentTranslation, bookName, chapter);
  
  if (verses.length === 0) {
    textContainer.innerHTML = '<div class="bible-explorer-welcome"><p>No verses found for this chapter.</p></div>';
    return;
  }
  
  // Check cache first - key is translation:book:chapter
  const cacheKey = `${currentTranslation}:${bookName}:${chapter}`;
  let html = chapterHTMLCache.get(cacheKey);
  const isNT = isNTBook(bookName);
  const hasInterlinearData = isNT ? ntInterlinearData : morphhbData;
  const needsInterlinear = (isNT && !ntInterlinearData) || (!isNT && hasHebrewText(bookName) && !morphhbData);
  
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
      const loadPromise = isNT ? loadNTInterlinear() : loadMorphhb();
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
// Display always respects URL/state: when the callback runs it reads state.content.params.translation and uses that.
function openBibleExplorerTo(book, chapter, verse = null) {
  const normalizedBook = normalizeBookName(book);
  
  // Navigate to Bible Explorer if not already there
  if (typeof navigateTo === 'function') {
    navigateTo('bible-explorer');
  }
  
  // No delay when already initialized (book in counts); 200ms only to wait for init
  const delay = bibleExplorerState.bookChapterCounts && bibleExplorerState.bookChapterCounts[normalizedBook] ? 0 : 200;
  setTimeout(async () => {
    if (!bibleExplorerState.bookChapterCounts[normalizedBook]) return;
    
    // State/URL is source of truth: use whatever translation the URL says (avoids stale display when toggling ASV/KJV)
    const state = typeof AppStore !== 'undefined' ? AppStore.getState() : null;
    const trans = state?.content?.params?.translation || currentTranslation || 'kjv';
    if (trans && currentTranslation !== trans && typeof switchTranslation === 'function') {
      await switchTranslation(trans);
    }
    
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
    
    const cacheKey = `${trans}:${normalizedBook}:${chapter}`;
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

// Copy verse reference to clipboard and update URL to focus this verse
function copyVerseReference(book, chapter, verse) {
  const reference = `${book} ${chapter}:${verse}`;
  
  // Update URL verse param directly (replaceState) — NOT via AppStore dispatch
  // which would trigger a full re-render and destroy the interlinear display.
  try {
    const url = new URL(window.location);
    url.searchParams.set('verse', verse);
    window.history.replaceState({}, '', url);
    // Also update AppStore state silently so it stays in sync
    if (typeof AppStore !== 'undefined') {
      const s = AppStore.getState();
      if (s.content?.params) s.content.params.verse = verse;
    }
    bibleExplorerState.highlightedVerse = verse;
  } catch (e) {}
  
  // Update visual highlight: remove old, apply new (persistent, not temporary)
  document.querySelectorAll('.bible-explorer-verse.highlighted').forEach(el => el.classList.remove('highlighted'));
  const verseEl = document.getElementById(`verse-${verse}`);
  if (verseEl) verseEl.classList.add('highlighted');
  
  // Copy to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(reference).catch(() => {});
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
  // For 'words', 'people', 'verse-studies', and 'symbols-article', hide all selectors (numbers has its own dropdown)
  const hideAllSelectors = ['words', 'people', 'symbols-article', 'verse-studies'].includes(contentType);
  const bibleSelectors = document.getElementById('bible-selectors');
  const symbolSelectors = document.getElementById('symbol-selectors');
  const ttSelectors = document.getElementById('timetested-selectors');
  const numberSelectors = document.getElementById('number-selectors');
  const classicsSelectors = document.getElementById('classics-selectors');
  
  if (bibleSelectors) bibleSelectors.style.display = (contentType === 'bible' && !hideAllSelectors) ? '' : 'none';
  if (symbolSelectors) symbolSelectors.style.display = (contentType === 'symbols' && !hideAllSelectors) ? '' : 'none';
  if (ttSelectors) ttSelectors.style.display = (contentType === 'timetested' && !hideAllSelectors) ? '' : 'none';
  if (numberSelectors) numberSelectors.style.display = (contentType === 'numbers') ? '' : 'none';
  if (classicsSelectors) classicsSelectors.style.display = (contentType === 'philo' || contentType === 'josephus') ? '' : 'none';
  
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
  
  // Populate classics dropdowns
  if (contentType === 'philo' || contentType === 'josephus') {
    populateClassicsDropdowns(contentType);
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

// ═══════════════════════════════════════════════════════════════════════
// CLASSICS (Philo & Josephus) — header dropdown handlers
// ═══════════════════════════════════════════════════════════════════════

/**
 * Populate the classics work and section dropdowns from Classics data.
 * Called from updateReaderContentSelector when contentType is philo or josephus.
 */
function populateClassicsDropdowns(contentType) {
  if (typeof Classics === 'undefined') return;
  const authorId = contentType; // 'philo' or 'josephus'
  const state = typeof AppStore !== 'undefined' ? AppStore.getState() : {};
  const params = state?.content?.params || {};

  // --- Work dropdown ---
  const workSelect = document.getElementById('classics-work-select');
  if (workSelect) {
    const works = Classics.getWorks(authorId);
    let html = `<option value="">📚 ${authorId === 'philo' ? 'Philo' : 'Josephus'} — All Works</option>`;
    for (const work of works) {
      const slug = Classics.getWorkSlug(work);
      html += `<option value="${slug}"${slug === params.work ? ' selected' : ''}>${work}</option>`;
    }
    workSelect.innerHTML = html;
  }

  // --- Section / location dropdown (context-sensitive) ---
  const sectionInput = document.getElementById('classics-section-input');
  if (!sectionInput) return;

  if (!params.work) {
    sectionInput.style.display = 'none';
    return;
  }
  sectionInput.style.display = '';

  // Set placeholder based on author type
  if (authorId === 'philo') {
    sectionInput.placeholder = 'Go to §...';
  } else {
    sectionInput.placeholder = params.book ? 'e.g. ' + params.book + '.1.1' : 'e.g. 1.1.1';
  }
}

/**
 * Handle work selection from classics dropdown — navigates to that work
 */
function onClassicsWorkChange(workSlug) {
  if (typeof AppStore === 'undefined') return;
  const state = AppStore.getState();
  const contentType = state?.content?.params?.contentType;
  if (!contentType) return;

  if (!workSlug) {
    // Go to author index
    AppStore.dispatch({ type: 'SET_VIEW', view: 'reader', params: { contentType } });
    return;
  }

  const params = { contentType, work: workSlug };
  // For Josephus, default to book 1
  if (contentType === 'josephus' && typeof Classics !== 'undefined') {
    const workName = Classics.getWorkBySlug(contentType, workSlug);
    if (workName) {
      const sections = Classics.getSectionList(contentType, workName);
      if (sections.length > 0) {
        const firstBook = parseInt(sections[0].split('|')[1]);
        params.book = firstBook;
      }
    }
  }
  AppStore.dispatch({ type: 'SET_VIEW', view: 'reader', params });
}

/**
 * Handle section jump from classics dropdown — scrolls to anchor within the page
 */
// Show/hide footnote tooltip on hover/tap
function showFootnoteTooltip(event) {
  event.stopPropagation();
  hideFootnoteTooltip();
  const el = event.target.closest('.has-footnote');
  if (!el) return;
  const text = el.dataset.footnote;
  if (!text) return;

  const tooltip = document.createElement('div');
  tooltip.className = 'footnote-tooltip';
  tooltip.textContent = text;
  document.body.appendChild(tooltip);

  const rect = el.getBoundingClientRect();
  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 5;
  if (left + 320 > window.innerWidth) left = window.innerWidth - 330;
  if (left < 10) left = 10;
  if (top + 150 > window.innerHeight + window.scrollY) {
    top = rect.top + window.scrollY - tooltip.offsetHeight - 5;
  }
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  tooltip.style.opacity = '1';
}

function hideFootnoteTooltip() {
  document.querySelectorAll('.footnote-tooltip').forEach(el => el.remove());
}

// Close footnote tooltip on click outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.has-footnote') && !e.target.closest('.footnote-tooltip')) {
    hideFootnoteTooltip();
  }
});

/**
 * Handle section jump from classics dropdown.
 * Always dispatches through AppStore so history entries are created (back/forward works).
 */
function onClassicsSectionJump(value) {
  if (!value || typeof AppStore === 'undefined') return;
  const state = AppStore.getState();
  const params = state?.content?.params || {};
  const contentType = params.contentType;

  if (contentType === 'philo') {
    AppStore.dispatch({ type: 'SET_VIEW', view: 'reader', params: { contentType: 'philo', work: params.work, section: value } });
  } else if (contentType === 'josephus') {
    const parts = value.split('.');
    if (parts.length === 3) {
      const [b, c, s] = parts.map(Number);
      AppStore.dispatch({ type: 'SET_VIEW', view: 'reader', params: { contentType: 'josephus', work: params.work, book: b, chapter: c, section: s } });
    } else {
      // Just a book number — navigate to that book
      const b = parseInt(value);
      AppStore.dispatch({ type: 'SET_VIEW', view: 'reader', params: { contentType: 'josephus', work: params.work, book: b } });
    }
  }
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
