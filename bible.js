/**
 * Bible Data Subsystem
 *
 * Standalone module that manages Bible translation data with:
 * - One contiguous string blob per translation (no object-per-verse fragmentation)
 * - Shared index: INDEX[book][chapter][verse][translationColIdx] = [startOffset, endOffset]
 * - Unified API for point lookups, chapter retrieval, citation resolution, and search
 *
 * Designed for memory efficiency, extensibility, and separation from UI concerns.
 */

// ─── Book Names & Abbreviations ──────────────────────────────────────────────
// Single source of truth for all book name normalization, abbreviation resolution,
// and book ordering. All code should use Bible.normalizeBookName() and Bible.BOOK_ORDER.

const BOOK_ORDER = [
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
];

// Book number (1-66) to name
const BOOK_NUM_TO_NAME = {};
BOOK_ORDER.forEach((name, i) => { BOOK_NUM_TO_NAME[i + 1] = name; });

// Book name to number
const BOOK_NAME_TO_NUM = {};
BOOK_ORDER.forEach((name, i) => { BOOK_NAME_TO_NUM[name] = i + 1; });

// Book index (0-based) for sorting
const BOOK_ORDER_INDEX = {};
BOOK_ORDER.forEach((name, i) => { BOOK_ORDER_INDEX[name] = i; });

// Comprehensive map: lowercase input → canonical name
// Includes full names, common abbreviations, and variant spellings
const BOOK_NAME_MAP = {
  // Full names (lowercase → canonical)
  'genesis': 'Genesis', 'exodus': 'Exodus', 'leviticus': 'Leviticus', 'numbers': 'Numbers', 'deuteronomy': 'Deuteronomy',
  'joshua': 'Joshua', 'judges': 'Judges', 'ruth': 'Ruth',
  '1 samuel': '1 Samuel', '2 samuel': '2 Samuel', '1 kings': '1 Kings', '2 kings': '2 Kings',
  '1 chronicles': '1 Chronicles', '2 chronicles': '2 Chronicles',
  'ezra': 'Ezra', 'nehemiah': 'Nehemiah', 'esther': 'Esther',
  'job': 'Job', 'psalms': 'Psalms', 'psalm': 'Psalms', 'proverbs': 'Proverbs', 'ecclesiastes': 'Ecclesiastes',
  'song of solomon': 'Song of Solomon', 'song of songs': 'Song of Solomon', 'canticles': 'Song of Solomon',
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
  'jude': 'Jude', 'revelation': 'Revelation', 'revelations': 'Revelation',
  // Common abbreviations — covers SBL, OSIS, Logos, Paratext, and informal usage
  // Roman numeral prefixes (I/II/III) are normalized to 1/2/3 in normalizeBookName()
  // so "i sam" becomes "1 sam" before lookup — no need to enumerate every Roman numeral form here.
  //
  // Genesis
  'gen': 'Genesis', 'ge': 'Genesis', 'gn': 'Genesis',
  // Exodus
  'exod': 'Exodus', 'exo': 'Exodus', 'ex': 'Exodus',
  // Leviticus
  'lev': 'Leviticus', 'le': 'Leviticus', 'lv': 'Leviticus',
  // Numbers
  'num': 'Numbers', 'nu': 'Numbers', 'nm': 'Numbers',
  // Deuteronomy
  'deut': 'Deuteronomy', 'de': 'Deuteronomy', 'dt': 'Deuteronomy',
  // Joshua
  'josh': 'Joshua', 'jos': 'Joshua', 'jsh': 'Joshua',
  // Judges
  'judg': 'Judges', 'jdg': 'Judges', 'jg': 'Judges', 'jdgs': 'Judges',
  // Ruth
  'ru': 'Ruth', 'rth': 'Ruth', 'rut': 'Ruth',
  // 1-2 Samuel (Roman numeral forms handled by normalizer: "I Sam" → "1 sam")
  '1 sam': '1 Samuel', '1sam': '1 Samuel', '1sa': '1 Samuel', '1 sa': '1 Samuel',
  '2 sam': '2 Samuel', '2sam': '2 Samuel', '2sa': '2 Samuel', '2 sa': '2 Samuel',
  // 1-2 Kings
  '1 kgs': '1 Kings', '1kgs': '1 Kings', '1ki': '1 Kings', '1 ki': '1 Kings',
  '2 kgs': '2 Kings', '2kgs': '2 Kings', '2ki': '2 Kings', '2 ki': '2 Kings',
  // 1-2 Chronicles
  '1 chr': '1 Chronicles', '1chr': '1 Chronicles', '1ch': '1 Chronicles', '1 ch': '1 Chronicles',
  '2 chr': '2 Chronicles', '2chr': '2 Chronicles', '2ch': '2 Chronicles', '2 ch': '2 Chronicles',
  // Ezra
  'ezr': 'Ezra',
  // Nehemiah
  'neh': 'Nehemiah', 'ne': 'Nehemiah',
  // Esther
  'est': 'Esther', 'esth': 'Esther', 'es': 'Esther',
  // Job
  'jb': 'Job',
  // Psalms
  'psa': 'Psalms', 'ps': 'Psalms', 'pss': 'Psalms',
  // Proverbs
  'prov': 'Proverbs', 'pro': 'Proverbs', 'pr': 'Proverbs', 'prv': 'Proverbs',
  // Ecclesiastes
  'eccl': 'Ecclesiastes', 'ecc': 'Ecclesiastes', 'ec': 'Ecclesiastes',
  'eccles': 'Ecclesiastes', 'qoh': 'Ecclesiastes', 'qoheleth': 'Ecclesiastes',
  // Song of Solomon
  'song': 'Song of Solomon', 'sos': 'Song of Solomon', 'so': 'Song of Solomon',
  'cant': 'Song of Solomon', 'ss': 'Song of Solomon',
  // Isaiah
  'isa': 'Isaiah', 'is': 'Isaiah',
  // Jeremiah
  'jer': 'Jeremiah', 'je': 'Jeremiah',
  // Lamentations
  'lam': 'Lamentations', 'la': 'Lamentations',
  // Ezekiel
  'ezek': 'Ezekiel', 'eze': 'Ezekiel', 'ez': 'Ezekiel',
  // Daniel
  'dan': 'Daniel', 'da': 'Daniel', 'dn': 'Daniel',
  // Hosea
  'hos': 'Hosea', 'ho': 'Hosea',
  // Joel
  'joe': 'Joel', 'jl': 'Joel',
  // Amos
  'am': 'Amos',
  // Obadiah
  'obad': 'Obadiah', 'ob': 'Obadiah',
  // Jonah
  'jon': 'Jonah', 'jnh': 'Jonah',
  // Micah
  'mic': 'Micah', 'mi': 'Micah',
  // Nahum
  'nah': 'Nahum', 'na': 'Nahum',
  // Habakkuk
  'hab': 'Habakkuk',
  // Zephaniah
  'zeph': 'Zephaniah', 'zep': 'Zephaniah',
  // Haggai
  'hag': 'Haggai', 'hg': 'Haggai',
  // Zechariah
  'zech': 'Zechariah', 'zec': 'Zechariah',
  // Malachi
  'mal': 'Malachi',
  // Matthew
  'matt': 'Matthew', 'mat': 'Matthew', 'mt': 'Matthew',
  // Mark
  'mk': 'Mark', 'mr': 'Mark', 'mrk': 'Mark',
  // Luke
  'lk': 'Luke', 'lu': 'Luke',
  // John
  'jn': 'John', 'joh': 'John',
  // Acts
  'ac': 'Acts', 'act': 'Acts',
  // Romans
  'rom': 'Romans', 'ro': 'Romans', 'rm': 'Romans',
  // 1-2 Corinthians
  '1 cor': '1 Corinthians', '1cor': '1 Corinthians', '1co': '1 Corinthians',
  '2 cor': '2 Corinthians', '2cor': '2 Corinthians', '2co': '2 Corinthians',
  // Galatians
  'gal': 'Galatians', 'ga': 'Galatians',
  // Ephesians
  'eph': 'Ephesians',
  // Philippians
  'phil': 'Philippians', 'php': 'Philippians', 'pp': 'Philippians',
  // Colossians
  'col': 'Colossians',
  // 1-2 Thessalonians
  '1 thess': '1 Thessalonians', '1thess': '1 Thessalonians', '1th': '1 Thessalonians',
  '2 thess': '2 Thessalonians', '2thess': '2 Thessalonians', '2th': '2 Thessalonians',
  // 1-2 Timothy
  '1 tim': '1 Timothy', '1tim': '1 Timothy', '1ti': '1 Timothy',
  '2 tim': '2 Timothy', '2tim': '2 Timothy', '2ti': '2 Timothy',
  // Titus
  'tit': 'Titus',
  // Philemon
  'phlm': 'Philemon', 'phm': 'Philemon', 'philem': 'Philemon',
  // Hebrews
  'heb': 'Hebrews',
  // James
  'jas': 'James', 'jam': 'James', 'jms': 'James',
  // 1-2 Peter
  '1 pet': '1 Peter', '1pet': '1 Peter', '1pe': '1 Peter',
  '2 pet': '2 Peter', '2pet': '2 Peter', '2pe': '2 Peter',
  // 1-3 John
  '1 jn': '1 John', '1jn': '1 John', '1jo': '1 John',
  '2 jn': '2 John', '2jn': '2 John', '2jo': '2 John',
  '3 jn': '3 John', '3jn': '3 John', '3jo': '3 John',
  // Jude
  'jude': 'Jude', 'jud': 'Jude', 'jd': 'Jude',
  // Revelation
  'rev': 'Revelation', 're': 'Revelation', 'apoc': 'Revelation', 'apocalypse': 'Revelation'
};

/**
 * Normalize any book name string to canonical form.
 * Handles abbreviations, case variations, trailing periods, and Roman numeral prefixes.
 * @param {string} bookStr - e.g. "Gen", "gen.", "1 Cor", "II Kings", "Psalm", "Revelations"
 * @returns {string} Canonical name, e.g. "Genesis", "1 Corinthians", "2 Kings", "Psalms", "Revelation"
 */
function normalizeBookName(bookStr) {
  if (!bookStr) return bookStr;
  let cleaned = bookStr.replace(/\.$/, '').trim().toLowerCase();

  // Normalize Roman numeral prefixes: "i " → "1 ", "ii " → "2 ", "iii " → "3 "
  // Handles: "I Cor", "II Kings", "III John", "i sam", "ii chr"
  cleaned = cleaned
    .replace(/^iii\s+/, '3 ')
    .replace(/^ii\s+/, '2 ')
    .replace(/^i\s+/, '1 ');

  return BOOK_NAME_MAP[cleaned] || bookStr.trim();
}

// Canonical name → standard abbreviation (for compact display)
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
  'Haggai': 'Hag', 'Zechariah': 'Zech', 'Malachi': 'Mal',
  'Matthew': 'Matt', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John',
  'Acts': 'Acts', 'Romans': 'Rom',
  '1 Corinthians': '1 Cor', '2 Corinthians': '2 Cor',
  'Galatians': 'Gal', 'Ephesians': 'Eph', 'Philippians': 'Phil', 'Colossians': 'Col',
  '1 Thessalonians': '1 Thess', '2 Thessalonians': '2 Thess',
  '1 Timothy': '1 Tim', '2 Timothy': '2 Tim', 'Titus': 'Titus', 'Philemon': 'Phlm',
  'Hebrews': 'Heb', 'James': 'Jas',
  '1 Peter': '1 Pet', '2 Peter': '2 Pet',
  '1 John': '1 Jn', '2 John': '2 Jn', '3 John': '3 Jn',
  'Jude': 'Jude', 'Revelation': 'Rev'
};

/**
 * Abbreviate a canonical book name to its standard short form.
 * @param {string} bookName - Canonical name, e.g. "Genesis"
 * @returns {string} Abbreviated form, e.g. "Gen"
 */
function abbreviateBookName(bookName) {
  return BOOK_ABBREVIATIONS[bookName] || bookName;
}

/**
 * Abbreviate a full reference string (e.g. "Genesis 1:1" → "Gen 1:1").
 * @param {string} ref - e.g. "Genesis 1:1" or "1 Corinthians 13:4"
 * @returns {string} e.g. "Gen 1:1" or "1 Cor 13:4"
 */
function abbreviateRef(ref) {
  if (!ref) return ref;
  const match = ref.match(/^(.+?)\s+(\d+.*)$/);
  if (!match) return ref;
  return abbreviateBookName(match[1]) + ' ' + match[2];
}

/**
 * Parse a reference string into its components.
 * @param {string} ref - e.g. "Genesis 1:1", "Gen 1:1", "1 Cor 13:4-7"
 * @returns {{ book: string, chapter: number, verse: number|null, endVerse: number|null }|null}
 */
function parseRef(ref) {
  if (!ref) return null;
  const m = ref.match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–—]\s*(\d+))?)?$/);
  if (!m) return null;
  return {
    book: normalizeBookName(m[1]),
    chapter: parseInt(m[2]),
    verse: m[3] ? parseInt(m[3]) : null,
    endVerse: m[4] ? parseInt(m[4]) : null
  };
}

/**
 * Build a canonical reference string from components.
 * @param {string} book - Canonical book name
 * @param {number} chapter
 * @param {number} [verse]
 * @param {number} [endVerse]
 * @returns {string}
 */
function buildRef(book, chapter, verse, endVerse) {
  let ref = `${book} ${chapter}`;
  if (verse != null) {
    ref += `:${verse}`;
    if (endVerse != null && endVerse !== verse) {
      ref += `-${endVerse}`;
    }
  }
  return ref;
}

// ─── URL Segment Encoding ────────────────────────────────────────────────────
// Converts between canonical citation strings and URL path segments.
// Only handles the citation portion (e.g. "Genesis.1.1/John.3.16"),
// not the full URL path (the app/router owns the /reader/multiverse/kjv prefix).
//
// URL format: Book.Chapter.VerseSpec segments separated by /
//   "Genesis 1:1; John 3:16-18" → ["Genesis.1.1", "John.3.16-18"]
//   "Genesis 1:4,14"            → ["Genesis.1.4.14"]  (commas become dots)
//   "1 Corinthians 13:4-7"      → ["1-Corinthians.13.4-7"]  (spaces in book → hyphens)

/**
 * Encode a citation string into URL path segments.
 * Input is normalized first (abbreviations resolved, etc.).
 * @param {string} citationStr - e.g. "Gen 1:1; Jn 3:16"
 * @returns {string[]} URL segments, e.g. ["Genesis.1.1", "John.3.16"]
 */
function citationToUrlSegments(citationStr) {
  if (!citationStr) return [];
  const normalized = normalizeCitation(citationStr);
  const refs = normalized.split(/\s*;\s*/).filter(Boolean);
  const segments = [];

  for (const ref of refs) {
    // Try: Book Chapter:VerseSpec (verse spec can include ranges, commas)
    const verseMatch = ref.match(/^(.+?)\s+(\d+):(.+)$/);
    if (verseMatch) {
      const book = verseMatch[1].replace(/\s+/g, '-');
      const chapter = verseMatch[2];
      // "Genesis 1:4,14" → "Genesis.1.4.14", "Genesis 1:4-7" → "Genesis.1.4-7"
      const versePart = verseMatch[3].replace(/,\s*/g, '.');
      segments.push(`${book}.${chapter}.${versePart}`);
      continue;
    }

    // Try: Book Chapter-Chapter (chapter range, no verse)
    const chapterRangeMatch = ref.match(/^(.+?)\s+(\d+)-(\d+)$/);
    if (chapterRangeMatch) {
      const book = chapterRangeMatch[1].replace(/\s+/g, '-');
      segments.push(`${book}.${chapterRangeMatch[2]}-${chapterRangeMatch[3]}`);
      continue;
    }

    // Try: Book Chapter (whole chapter)
    const wholeChapterMatch = ref.match(/^(.+?)\s+(\d+)$/);
    if (wholeChapterMatch) {
      const book = wholeChapterMatch[1].replace(/\s+/g, '-');
      segments.push(`${book}.${wholeChapterMatch[2]}`);
      continue;
    }
  }

  return segments;
}

/**
 * Decode URL path segments back into a canonical citation string.
 * Normalizes book names via normalizeBookName().
 * @param {string[]} segments - e.g. ["Genesis.1.1", "John.3.16"]
 * @returns {string} Canonical citation string, e.g. "Genesis 1:1; John 3:16"
 */
function urlSegmentsToCitation(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return '';
  const refs = [];

  for (const segment of segments) {
    if (!segment) continue;
    const parts = segment.split('.');
    if (parts.length < 2) continue;

    // Pop trailing verse parts (digits or digit-ranges)
    const verseParts = [];
    while (parts.length > 2 && /^\d+(-\d+)?$/.test(parts[parts.length - 1])) {
      verseParts.unshift(parts.pop());
    }

    // Last remaining numeric part is the chapter
    const chapter = parts.pop();
    if (!/^\d+(-\d+)?$/.test(chapter)) continue;

    // Everything left is the book name (hyphens → spaces)
    const rawBook = parts.join(' ').replace(/-/g, ' ');
    const book = normalizeBookName(rawBook);
    const verseSpec = verseParts.join(',');

    if (verseSpec) {
      refs.push(`${book} ${chapter}:${verseSpec}`);
    } else {
      refs.push(`${book} ${chapter}`);
    }
  }

  return refs.join('; ');
}

/**
 * Normalize a citation string: resolve all abbreviations, Roman numerals,
 * variant spellings, and formatting to canonical form.
 * Input:  "Gen. 1:1-3; I Cor 13:4-7 + Apoc 21:1-4"
 * Output: "Genesis 1:1-3; 1 Corinthians 13:4-7; Revelation 21:1-4"
 * @param {string} citationStr - Messy citation string
 * @returns {string} Normalized citation string with canonical book names
 */
function normalizeCitation(citationStr) {
  if (!citationStr) return '';

  // Pre-process: split space/tab-separated citations (same logic as _parseCitation)
  const tabNorm2 = citationStr.replace(/\t/g, ' ');
  let preprocessed = tabNorm2.replace(
    /(:\d+(?:-\d+)?(?:,\s*\d+(?:-\d+)?)*)\s+((?:(?:III|II|I|[123])\s+)?[A-Za-z])/g,
    '$1; $2'
  );
  preprocessed = preprocessed.replace(
    /(\d+(?:-\d+)?)\s+((?:(?:III|II|I|[123])\s+)?[A-Za-z][A-Za-z .]+?\s+\d)/g,
    (match, digits, rest) => {
      const bookCandidate = rest.replace(/\s+\d$/, '').trim();
      const resolved = normalizeBookName(bookCandidate);
      if (resolved !== bookCandidate || BOOK_NAME_MAP[bookCandidate.toLowerCase()]) {
        return digits + '; ' + rest;
      }
      return match;
    }
  );

  // Split on + or ; delimiters
  const parts = preprocessed.split(/\s*[+;]\s*/);
  const normalized = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Try to match: Book Chapter:VerseSpec
    const mainMatch = trimmed.match(/^(.+?)\s+(\d+):(.+)$/);
    if (mainMatch) {
      const book = normalizeBookName(mainMatch[1]);
      normalized.push(`${book} ${mainMatch[2]}:${mainMatch[3].replace(/[–—]/g, '-')}`);
      continue;
    }

    // Try: Book Chapter-Chapter (chapter range)
    const chapterRangeMatch = trimmed.match(/^(.+?)\s+(\d+)\s*[–—-]\s*(\d+)$/);
    if (chapterRangeMatch) {
      const book = normalizeBookName(chapterRangeMatch[1]);
      normalized.push(`${book} ${chapterRangeMatch[2]}-${chapterRangeMatch[3]}`);
      continue;
    }

    // Try: Book Chapter (whole chapter)
    const wholeChapterMatch = trimmed.match(/^(.+?)\s+(\d+)$/);
    if (wholeChapterMatch) {
      const book = normalizeBookName(wholeChapterMatch[1]);
      normalized.push(`${book} ${wholeChapterMatch[2]}`);
      continue;
    }

    // Fallback: pass through
    normalized.push(trimmed);
  }

  return normalized.join('; ');
}

// ─── Registry ────────────────────────────────────────────────────────────────

// ─── Book Descriptions ───────────────────────────────────────────────────────

const BOOK_DESCRIPTIONS = {
  // ── Torah / Pentateuch ──
  'Genesis':          { chapters: 50, category: 'Law', description: 'The book of beginnings: creation, the fall, the flood, and the patriarchs Abraham, Isaac, Jacob, and Joseph. Establishes God\'s covenant promises and the origins of Israel.' },
  'Exodus':           { chapters: 40, category: 'Law', description: 'Israel\'s deliverance from Egypt, the giving of the Law at Sinai, and the construction of the Tabernacle. Contains the Passover, the Ten Commandments, and the covenant code.' },
  'Leviticus':        { chapters: 27, category: 'Law', description: 'Instructions for holiness, sacrificial offerings, priesthood, appointed feasts, and ceremonial purity. The manual for approaching a holy God through the Levitical system.' },
  'Numbers':          { chapters: 36, category: 'Law', description: 'Israel\'s wilderness wanderings from Sinai to the plains of Moab. Census records, rebellion, judgment, and preparation for entering the promised land.' },
  'Deuteronomy':      { chapters: 34, category: 'Law', description: 'Moses\' farewell addresses restating the Law for the new generation. Contains the Shema, blessings and curses, and the covenant renewal before entering Canaan.' },
  // ── Historical Books ──
  'Joshua':           { chapters: 24, category: 'History', description: 'The conquest and division of the promised land under Joshua\'s leadership. Israel crosses the Jordan, takes Jericho, and settles the tribal territories.' },
  'Judges':           { chapters: 21, category: 'History', description: 'A cycle of apostasy, oppression, and deliverance through judges like Deborah, Gideon, and Samson. Israel\'s repeated failure without faithful leadership.' },
  'Ruth':             { chapters: 4,  category: 'History', description: 'A Moabite woman\'s loyalty to her mother-in-law Naomi leads to her redemption by Boaz. A story of faithfulness, provision, and the lineage of David.' },
  '1 Samuel':         { chapters: 31, category: 'History', description: 'The transition from judges to monarchy. Samuel anoints Saul as first king, then David. Chronicles the rise of David and Saul\'s decline.' },
  '2 Samuel':         { chapters: 24, category: 'History', description: 'David\'s reign as king of Israel: his triumphs, the Davidic covenant, and his failures including Bathsheba. The consequences of sin within the royal house.' },
  '1 Kings':          { chapters: 22, category: 'History', description: 'Solomon\'s wisdom and temple construction, followed by the kingdom\'s division. Elijah confronts Baal worship in the northern kingdom of Israel.' },
  '2 Kings':          { chapters: 25, category: 'History', description: 'The decline and fall of both kingdoms. Elisha\'s ministry, Assyria\'s conquest of Israel (722 BC), and Babylon\'s destruction of Judah and the temple (586 BC).' },
  '1 Chronicles':     { chapters: 29, category: 'History', description: 'Genealogies from Adam to David, then David\'s reign with emphasis on temple worship preparations. A priestly perspective on Israel\'s history.' },
  '2 Chronicles':     { chapters: 36, category: 'History', description: 'Solomon\'s temple and the kings of Judah from Rehoboam to the Babylonian exile. Emphasizes faithfulness to the temple, the priesthood, and the Law.' },
  'Ezra':             { chapters: 10, category: 'History', description: 'The return from Babylonian exile under Zerubbabel and Ezra. Rebuilding the temple and restoring the Law. Confronts the crisis of intermarriage.' },
  'Nehemiah':         { chapters: 13, category: 'History', description: 'Nehemiah rebuilds Jerusalem\'s walls despite opposition. Public reading of the Law, national confession, and covenant renewal after the exile.' },
  'Esther':           { chapters: 10, category: 'History', description: 'A Jewish queen in Persia saves her people from genocide plotted by Haman. The origin of the feast of Purim. God\'s providence works behind the scenes.' },
  // ── Wisdom / Poetry ──
  'Job':              { chapters: 42, category: 'Wisdom', description: 'A righteous man\'s suffering and his dialogue with friends who insist suffering equals guilt. God speaks from the whirlwind, revealing wisdom beyond human comprehension.' },
  'Psalms':           { chapters: 150, category: 'Wisdom', description: 'Israel\'s hymnal: 150 songs of praise, lament, thanksgiving, and prophecy. Covers the full range of human experience before God, from despair to exaltation.' },
  'Proverbs':         { chapters: 31, category: 'Wisdom', description: 'Practical wisdom for daily life: relationships, work, speech, and the fear of the Lord. Contrasts the way of wisdom with the way of folly.' },
  'Ecclesiastes':     { chapters: 12, category: 'Wisdom', description: 'The Preacher explores meaning "under the sun" and finds all earthly pursues are vanity. Concludes: fear God and keep His commandments.' },
  'Song of Solomon':  { chapters: 8,  category: 'Wisdom', description: 'A poetic celebration of love between a bride and bridegroom. Read as both human romance and an allegory of God\'s love for His people.' },
  // ── Major Prophets ──
  'Isaiah':           { chapters: 66, category: 'Major Prophet', description: 'Judgment and redemption on a cosmic scale. Contains messianic prophecies (the virgin birth, suffering servant, new heavens and earth) and visions of Israel\'s restoration.' },
  'Jeremiah':         { chapters: 52, category: 'Major Prophet', description: 'The weeping prophet warns Judah of coming judgment by Babylon. Proclaims the new covenant and witnesses Jerusalem\'s destruction, yet offers hope of restoration.' },
  'Lamentations':     { chapters: 5,  category: 'Major Prophet', description: 'Five poetic laments mourning Jerusalem\'s destruction by Babylon. Raw grief, yet affirms God\'s faithfulness: "His mercies are new every morning."' },
  'Ezekiel':          { chapters: 48, category: 'Major Prophet', description: 'Visions from exile in Babylon: the throne-chariot, the valley of dry bones, and the future temple. Declares God\'s glory will return to a restored Israel.' },
  'Daniel':           { chapters: 12, category: 'Major Prophet', description: 'Faithfulness in Babylonian captivity (the fiery furnace, the lions\' den) and apocalyptic visions of world empires, the Ancient of Days, and the end times.' },
  // ── Minor Prophets ──
  'Hosea':            { chapters: 14, category: 'Minor Prophet', description: 'God commands Hosea to marry an unfaithful wife as a living parable of Israel\'s spiritual adultery. Despite betrayal, God\'s love pursues and restores.' },
  'Joel':             { chapters: 3,  category: 'Minor Prophet', description: 'A locust plague foreshadows the Day of the Lord. Calls for repentance and promises the outpouring of God\'s Spirit on all flesh.' },
  'Amos':             { chapters: 9,  category: 'Minor Prophet', description: 'A shepherd-prophet denounces social injustice and religious hypocrisy in prosperous Israel. God demands justice, not empty ritual.' },
  'Obadiah':          { chapters: 1,  category: 'Minor Prophet', description: 'The shortest OT book: judgment against Edom for pride and violence against brother Jacob. The day of the Lord approaches all nations.' },
  'Jonah':            { chapters: 4,  category: 'Minor Prophet', description: 'A reluctant prophet flees God\'s call to preach to Nineveh, is swallowed by a great fish, and learns that God\'s mercy extends to all nations.' },
  'Micah':            { chapters: 7,  category: 'Minor Prophet', description: 'Judgment on corruption and false prophets, yet hope for a ruler from Bethlehem. "What does the Lord require? To do justly, love mercy, walk humbly."' },
  'Nahum':            { chapters: 3,  category: 'Minor Prophet', description: 'Prophecy of Nineveh\'s destruction, fulfilling the judgment Jonah warned of. God is slow to anger but will not leave the guilty unpunished.' },
  'Habakkuk':         { chapters: 3,  category: 'Minor Prophet', description: 'A prophet questions why God allows injustice, then why He would use wicked Babylon as judgment. God answers: "The just shall live by faith."' },
  'Zephaniah':        { chapters: 3,  category: 'Minor Prophet', description: 'The coming Day of the Lord will purge Judah and the nations. After judgment, a humble remnant will be restored and God will rejoice over them with singing.' },
  'Haggai':           { chapters: 2,  category: 'Minor Prophet', description: 'After the exile, the people neglect the temple to build their own houses. Haggai calls them to rebuild, promising God\'s glory will fill it.' },
  'Zechariah':        { chapters: 14, category: 'Minor Prophet', description: 'Apocalyptic visions of Israel\'s future: the Branch, the pierced one, living waters from Jerusalem, and the Lord\'s feet on the Mount of Olives.' },
  'Malachi':          { chapters: 4,  category: 'Minor Prophet', description: 'The final OT prophet rebukes corrupt priests and faithless people. Promises Elijah will come before the great Day of the Lord. Then 400 years of silence.' },
  // ── Gospels ──
  'Matthew':          { chapters: 28, category: 'Gospel', description: 'Jesus as the promised King of Israel, descended from Abraham and David. The Sermon on the Mount, parables of the kingdom, and the Great Commission.' },
  'Mark':             { chapters: 16, category: 'Gospel', description: 'The shortest Gospel: Jesus as the suffering servant, always in action. Emphasizes His deeds, miracles, and the road to the cross. Written for urgency.' },
  'Luke':             { chapters: 24, category: 'Gospel', description: 'A careful historical account for Theophilus. Jesus as the Son of Man who came to seek and save the lost. Rich in parables, prayer, and compassion for outsiders.' },
  'John':             { chapters: 21, category: 'Gospel', description: 'Jesus as the divine Word made flesh. Seven signs, seven "I AM" statements, and the Upper Room discourse. "These are written that you might believe."' },
  // ── Church History ──
  'Acts':             { chapters: 28, category: 'History', description: 'The birth and spread of the early church from Jerusalem to Rome. The Spirit\'s outpouring at Pentecost, Peter\'s and Paul\'s ministries, and the gospel\'s advance to the nations.' },
  // ── Pauline Epistles ──
  'Romans':           { chapters: 16, category: 'Epistle', description: 'Paul\'s systematic theology of salvation: all have sinned, justification by faith, freedom from the law, life in the Spirit, and God\'s plan for Israel and the nations.' },
  '1 Corinthians':    { chapters: 16, category: 'Epistle', description: 'Paul addresses divisions, immorality, lawsuits, marriage, spiritual gifts, and resurrection in the troubled Corinthian church. Contains the love chapter (13).' },
  '2 Corinthians':    { chapters: 13, category: 'Epistle', description: 'Paul defends his apostleship, describes the new covenant ministry, and speaks of strength made perfect in weakness. The most personal of his letters.' },
  'Galatians':        { chapters: 6,  category: 'Epistle', description: 'A passionate defense of justification by faith alone, not works of the law. "If righteousness comes through the law, then Christ died in vain."' },
  'Ephesians':        { chapters: 6,  category: 'Epistle', description: 'God\'s eternal purpose in Christ: chosen before the foundation of the world, united as one body, and equipped with the whole armor of God.' },
  'Philippians':      { chapters: 4,  category: 'Epistle', description: 'A letter of joy from prison. Christ\'s humility and exaltation, pressing toward the goal, and the peace of God that surpasses understanding.' },
  'Colossians':       { chapters: 4,  category: 'Epistle', description: 'The supremacy and sufficiency of Christ over all creation, philosophy, and legalism. "In Him all the fullness of the Godhead dwells bodily."' },
  '1 Thessalonians':  { chapters: 5,  category: 'Epistle', description: 'Encouragement to a young church: faith, love, holiness, and hope in Christ\'s return. The dead in Christ will rise first, then the living will be caught up.' },
  '2 Thessalonians':  { chapters: 3,  category: 'Epistle', description: 'Corrects misunderstandings about the Day of the Lord. The man of lawlessness must be revealed first. Stand firm and keep working.' },
  '1 Timothy':        { chapters: 6,  category: 'Epistle', description: 'Paul instructs his young delegate on church order: qualifications for overseers and deacons, false teaching, prayer, and godliness with contentment.' },
  '2 Timothy':        { chapters: 4,  category: 'Epistle', description: 'Paul\'s final letter, written facing death. Charges Timothy to guard the faith, endure suffering, preach the word, and finish the race.' },
  'Titus':            { chapters: 3,  category: 'Epistle', description: 'Instructions for establishing order in the churches of Crete: appoint elders, teach sound doctrine, and live as people zealous for good works.' },
  'Philemon':         { chapters: 1,  category: 'Epistle', description: 'A personal appeal to Philemon to receive back his runaway slave Onesimus as a brother in Christ. A case study in forgiveness and reconciliation.' },
  // ── General Epistles ──
  'Hebrews':          { chapters: 13, category: 'Epistle', description: 'Christ is superior to angels, Moses, and the Levitical priesthood. The old covenant gives way to the new. A hall of faith (ch. 11) and a call to endure.' },
  'James':            { chapters: 5,  category: 'Epistle', description: 'Practical wisdom for living faith: taming the tongue, caring for the poor, patience in trials. "Faith without works is dead."' },
  '1 Peter':          { chapters: 5,  category: 'Epistle', description: 'Hope for suffering believers: a living hope through resurrection, holy conduct in a hostile world, and sharing in Christ\'s sufferings before sharing His glory.' },
  '2 Peter':          { chapters: 3,  category: 'Epistle', description: 'Warns against false teachers and scoffers who deny the Lord\'s return. God is patient, not wanting any to perish. The day of the Lord will come.' },
  '1 John':           { chapters: 5,  category: 'Epistle', description: 'Tests of genuine faith: walking in the light, loving one another, and believing Jesus came in the flesh. "God is love" and "God is light."' },
  '2 John':           { chapters: 1,  category: 'Epistle', description: 'A brief letter urging believers to walk in truth and love, and to reject false teachers who deny Christ came in the flesh.' },
  '3 John':           { chapters: 1,  category: 'Epistle', description: 'Commends Gaius for hospitality to traveling teachers and rebukes Diotrephes for refusing them. A snapshot of early church dynamics.' },
  'Jude':             { chapters: 1,  category: 'Epistle', description: 'Contend for the faith against false teachers who have crept in. References fallen angels, Sodom, and Balaam. Ends with a magnificent doxology.' },
  // ── Apocalyptic ──
  'Revelation':       { chapters: 22, category: 'Prophecy', description: 'The unveiling of Jesus Christ in glory. Letters to seven churches, seals, trumpets, bowls, the fall of Babylon, and the new heaven and earth where God dwells with His people.' }
};

const BIBLE_REGISTRY = [
  {
    id: 'kjv',
    name: 'KJV',
    fullName: 'King James Version',
    year: 1611,
    language: 'en',
    hasStrongs: true,
    searchable: true,
    isSourceText: false,
    rtl: false,
    description: 'The classic English translation. Formal equivalence (word-for-word). '
      + 'Contains Strong\'s numbers for word study. Archaic language (thee/thou).',
    copyright: 'Public Domain',
    file: '/bibles/kjv_strongs.txt'
  },
  {
    id: 'asv',
    name: 'ASV',
    fullName: 'American Standard Version',
    year: 1901,
    language: 'en',
    hasStrongs: true,
    searchable: true,
    isSourceText: false,
    rtl: false,
    description: 'Highly literal revision of the KJV. Formal equivalence. '
      + 'Known for accuracy and consistency. Contains Strong\'s numbers.',
    copyright: 'Public Domain',
    file: '/bibles/asv_strongs.txt'
  },
  {
    id: 'akjv',
    name: 'AKJV',
    fullName: 'American King James Version',
    year: 1999,
    language: 'en',
    hasStrongs: true,
    searchable: true,
    isSourceText: false,
    rtl: false,
    description: 'KJV with archaic words updated to modern English. '
      + 'Same verse structure, modernized vocabulary. Contains Strong\'s numbers.',
    copyright: 'Public Domain',
    file: '/bibles/akjv_strongs.txt'
  },
  {
    id: 'ylt',
    name: 'YLT',
    fullName: "Young's Literal Translation",
    year: 1862,
    language: 'en',
    hasStrongs: false,
    searchable: true,
    isSourceText: false,
    rtl: false,
    description: 'Extremely literal, preserving Hebrew/Greek verb tenses. '
      + 'Reads unusually but reveals original structure.',
    copyright: 'Public Domain',
    file: '/bibles/ylt.txt'
  },
  {
    id: 'dbt',
    name: 'DBT',
    fullName: 'Darby Bible Translation',
    year: 1890,
    language: 'en',
    hasStrongs: false,
    searchable: true,
    isSourceText: false,
    rtl: false,
    description: 'Highly literal by John Nelson Darby. Formal equivalence. '
      + 'Valued for precise rendering of Greek tenses.',
    copyright: 'Public Domain',
    file: '/bibles/dbt.txt'
  },
  {
    id: 'drb',
    name: 'DRB',
    fullName: 'Douay-Rheims Bible',
    year: 1899,
    language: 'en',
    hasStrongs: false,
    searchable: true,
    isSourceText: false,
    rtl: false,
    description: 'Catholic English translation from the Latin Vulgate. '
      + 'Formal equivalence. Includes deuterocanonical books.',
    copyright: 'Public Domain',
    file: '/bibles/drb.txt'
  },
  {
    id: 'jps',
    name: 'JPS',
    fullName: 'JPS Tanakh 1917 / Weymouth NT',
    year: 1917,
    language: 'en',
    hasStrongs: false,
    searchable: true,
    isSourceText: false,
    rtl: false,
    description: 'Jewish Publication Society OT (formal equivalence, Jewish perspective) '
      + 'combined with Weymouth NT (readable, slightly interpretive).',
    copyright: 'Public Domain',
    file: '/bibles/jps.txt'
  },
  {
    id: 'slt',
    name: 'SLT',
    fullName: "Smith's Literal Translation",
    year: 1876,
    language: 'en',
    hasStrongs: false,
    searchable: true,
    isSourceText: false,
    rtl: false,
    description: 'Very literal, preserves Hebrew verb forms (e.g. "God will say" for future). '
      + 'Useful for seeing the original tense system.',
    copyright: 'Public Domain',
    file: '/bibles/slt.txt'
  },
  {
    id: 'wbt',
    name: 'WBT',
    fullName: 'Webster Bible Translation',
    year: 1833,
    language: 'en',
    hasStrongs: false,
    searchable: true,
    isSourceText: false,
    rtl: false,
    description: "Noah Webster's revision of the KJV. Modernized some archaic words "
      + 'while preserving KJV style. Formal equivalence.',
    copyright: 'Public Domain',
    file: '/bibles/wbt.txt'
  },
  {
    id: 'lxx',
    name: 'LXX',
    fullName: 'Septuagint (Brenton English)',
    year: 1851,
    language: 'en',
    hasStrongs: false,
    searchable: true,
    isSourceText: false,
    rtl: false,
    description: 'English translation of the Greek Old Testament (Septuagint). '
      + 'The OT text quoted by NT authors. OT only — no NT books.',
    copyright: 'Public Domain',
    file: '/bibles/lxx.txt'
  },
  {
    id: 'wlc',
    name: 'WLC',
    fullName: 'Westminster Leningrad Codex',
    year: 1008,
    language: 'he',
    hasStrongs: false,
    searchable: false,
    isSourceText: true,
    rtl: true,
    description: 'Hebrew OT source text (consonants, vowels, cantillation marks). '
      + 'Based on the Leningrad Codex (Firkovich B19A). OT only.',
    copyright: 'Public Domain',
    file: '/bibles/wlc.txt'
  },
  {
    id: 'greek_nt',
    name: 'Greek NT',
    fullName: 'Greek New Testament',
    year: null,
    language: 'el',
    hasStrongs: false,
    searchable: false,
    isSourceText: true,
    rtl: false,
    description: 'Greek NT source text reconstructed from interlinear data. NT only.',
    copyright: 'Public Domain',
    file: '/bibles/greek_nt.txt'
  }
];

// ─── Bible API ───────────────────────────────────────────────────────────────

const Bible = {
  /** @type {Object<string, string>} translationId → contiguous text blob */
  _blobs: {},

  /** @type {Object<string, Object>} translationId → { offsets: Map<string, [start, end]> } */
  _indexes: {},

  /** @type {Object<string, Promise>} translationId → loading promise */
  _loading: {},

  /** @type {string[]} Canonical book order for sorting */
  _bookOrder: null,

  /** @type {Object<string, Object>} translationId → registry entry (for quick lookup) */
  _registryMap: null,

  // ── Initialization ──

  /**
   * Build internal lookup maps from BIBLE_REGISTRY.
   * Called automatically on first use.
   */
  _ensureInit() {
    if (this._registryMap) return;
    this._registryMap = {};
    for (const entry of BIBLE_REGISTRY) {
      this._registryMap[entry.id] = entry;
    }
  },

  // ── Registry queries ──

  /** Get all registered translations. */
  getTranslations() {
    this._ensureInit();
    return BIBLE_REGISTRY;
  },

  /** Get registry entry for a single translation. */
  getTranslation(id) {
    this._ensureInit();
    return this._registryMap[id] || null;
  },

  /** Get only searchable (English) translations. */
  getSearchableTranslations() {
    return BIBLE_REGISTRY.filter(t => t.searchable !== false);
  },

  /** Get source text translations (Hebrew, Greek). */
  getSourceTexts() {
    return BIBLE_REGISTRY.filter(t => t.isSourceText === true);
  },

  /** Check if a translation has Strong's data. */
  hasStrongs(translationId) {
    this._ensureInit();
    const reg = this._registryMap[translationId];
    return reg ? reg.hasStrongs === true : false;
  },

  // ── Loading ──

  /** Check if a translation is loaded into memory. */
  isLoaded(translationId) {
    return !!this._blobs[translationId];
  },

  /** Get list of currently loaded translation IDs. */
  getLoadedTranslations() {
    return Object.keys(this._blobs);
  },

  /**
   * Fetch a Bible text file, preferring .gz (compressed) with fallback to raw .txt.
   * Uses DecompressionStream when available (all modern browsers).
   * In Node.js (tests), falls back directly to raw .txt.
   * @private
   * @param {string} filePath - e.g. "/bibles/kjv_strongs.txt"
   * @returns {Promise<string>} decompressed text content
   */
  async _fetchAndDecompress(filePath) {
    // Try .gz first (smaller cache footprint)
    const gzPath = filePath + '.gz';
    const hasDecompress = typeof DecompressionStream !== 'undefined';

    if (hasDecompress) {
      try {
        const response = await fetch(gzPath);
        if (response.ok) {
          const ds = new DecompressionStream('gzip');
          const decompressed = response.body.pipeThrough(ds);
          return await new Response(decompressed).text();
        }
      } catch (e) {
        // .gz not available or decompression failed — fall through to raw
      }
    }

    // Fallback: fetch raw .txt
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${filePath}`);
    return await response.text();
  },

  /**
   * Load a translation into memory.
   * Fetches the .gz file (compressed, smaller cache) with fallback to raw .txt.
   * Stores as blob, builds the offset index.
   * @param {string} translationId
   * @returns {Promise<boolean>} true if loaded successfully
   */
  async loadTranslation(translationId) {
    this._ensureInit();
    if (this._blobs[translationId]) return true;
    if (this._loading[translationId]) return this._loading[translationId];

    const reg = this._registryMap[translationId];
    if (!reg) {
      console.warn(`[Bible] Unknown translation: ${translationId}`);
      return false;
    }

    this._loading[translationId] = (async () => {
      try {
        const text = await this._fetchAndDecompress(reg.file);
        this._parseAndStore(translationId, text);
        console.log(`[Bible] ${reg.name} loaded: ${Object.keys(this._indexes[translationId]).length} verses`);
        return true;
      } catch (err) {
        console.warn(`[Bible] Failed to load ${reg.name}:`, err.message);
        return false;
      } finally {
        delete this._loading[translationId];
      }
    })();

    return this._loading[translationId];
  },

  /**
   * Parse a standardized .txt file and store as blob + offset index.
   * Format: Line1=ID, Line2=FullName, Line3+= "BookName Ch:V\tText"
   * @private
   */
  _parseAndStore(translationId, rawText) {
    // We store the raw text as the blob (we'll slice from it).
    // Build an index: ref → [start, end] character offsets into the blob.
    const offsets = {};  // "Genesis 1:1" → [startChar, endChar]
    const bookChapters = {};  // "Genesis" → Set of chapter numbers

    // Walk the text line by line without splitting (avoid 31K string allocations)
    let pos = 0;
    let lineNum = 0;
    const len = rawText.length;

    while (pos < len) {
      const nlIdx = rawText.indexOf('\n', pos);
      const lineEnd = nlIdx === -1 ? len : nlIdx;
      lineNum++;

      // Skip header lines (first 2 lines: ID and FullName)
      if (lineNum > 2) {
        const tabIdx = rawText.indexOf('\t', pos);
        if (tabIdx !== -1 && tabIdx < lineEnd) {
          const ref = rawText.slice(pos, tabIdx);
          const textStart = tabIdx + 1;
          const textEnd = lineEnd;
          offsets[ref] = [textStart, textEnd];

          // Track book/chapter structure
          const spaceBeforeChapter = ref.lastIndexOf(' ');
          if (spaceBeforeChapter > 0) {
            const book = ref.slice(0, spaceBeforeChapter);
            const chVerse = ref.slice(spaceBeforeChapter + 1);
            const colonIdx = chVerse.indexOf(':');
            if (colonIdx > 0) {
              const ch = parseInt(chVerse.slice(0, colonIdx));
              if (!bookChapters[book]) bookChapters[book] = new Set();
              bookChapters[book].add(ch);
            }
          }
        }
      }

      pos = lineEnd + 1;
    }

    this._blobs[translationId] = rawText;
    this._indexes[translationId] = offsets;

    // Store book/chapter metadata if this is the first full Bible loaded
    if (!this._bookChapters && Object.keys(bookChapters).length > 60) {
      this._bookChapters = {};
      for (const [book, chapters] of Object.entries(bookChapters)) {
        this._bookChapters[book] = Math.max(...chapters);
      }
    }
  },

  // ── Point lookups ──

  /**
   * Get a single verse.
   * @param {string} translationId
   * @param {string} book - e.g. "Genesis"
   * @param {number} chapter
   * @param {number} verse
   * @returns {{ text: string, strongsText: string|null, ref: string }|null}
   */
  getVerse(translationId, book, chapter, verse) {
    const blob = this._blobs[translationId];
    const index = this._indexes[translationId];
    if (!blob || !index) return null;

    const ref = `${book} ${chapter}:${verse}`;
    const offsets = index[ref];
    if (!offsets) return null;

    const rawText = blob.slice(offsets[0], offsets[1]);
    const reg = this._registryMap[translationId];
    const hasStrongsData = reg && reg.hasStrongs;

    return {
      text: hasStrongsData ? this._stripStrongsTags(rawText) : rawText,
      strongsText: hasStrongsData ? rawText : null,
      ref
    };
  },

  /**
   * Get all verses in a chapter.
   * @param {string} translationId
   * @param {string} book
   * @param {number} chapter
   * @returns {Array<{ verse: number, text: string, strongsText: string|null, ref: string }>}
   */
  getChapter(translationId, book, chapter) {
    const blob = this._blobs[translationId];
    const index = this._indexes[translationId];
    if (!blob || !index) return [];

    const reg = this._registryMap[translationId];
    const hasStrongsData = reg && reg.hasStrongs;
    const prefix = `${book} ${chapter}:`;
    const verses = [];

    // Iterate through possible verse numbers (1-200 to be safe)
    for (let v = 1; v <= 200; v++) {
      const ref = `${prefix}${v}`;
      const offsets = index[ref];
      if (!offsets) {
        if (v > 1) break; // Past the last verse
        continue;
      }
      const rawText = blob.slice(offsets[0], offsets[1]);
      verses.push({
        verse: v,
        text: hasStrongsData ? this._stripStrongsTags(rawText) : rawText,
        strongsText: hasStrongsData ? rawText : null,
        ref
      });
    }

    return verses;
  },

  /**
   * Get a verse across all loaded translations.
   * @param {string} book
   * @param {number} chapter
   * @param {number} verse
   * @param {{ englishOnly?: boolean }} options
   * @returns {Object<string, { text: string, strongsText: string|null }>}
   */
  getVerseAllTranslations(book, chapter, verse, options = {}) {
    const result = {};
    for (const id of Object.keys(this._blobs)) {
      if (options.englishOnly) {
        const reg = this._registryMap[id];
        if (reg && reg.isSourceText) continue;
      }
      const v = this.getVerse(id, book, chapter, verse);
      if (v) result[id] = v;
    }
    return result;
  },

  // ── Metadata ──

  /**
   * Get ordered list of book names (always returns canonical 66-book order).
   */
  getBooks() {
    return [...BOOK_ORDER];
  },

  /**
   * Get the number of chapters in a book.
   * @param {string} book
   * @returns {number}
   */
  getChapterCount(book) {
    return this._bookChapters ? (this._bookChapters[book] || 0) : 0;
  },

  /**
   * Get all books with their chapter counts.
   * @returns {Object<string, number>}
   */
  getBookChapterCounts() {
    return this._bookChapters ? { ...this._bookChapters } : {};
  },

  // ── Citation resolution ──

  /**
   * Parse a citation string and return verses.
   * Handles: "Genesis 1:1", "John 3:16-18", "Genesis 1:1; John 3:16"
   * @param {string} translationId
   * @param {string} citationStr
   * @returns {Array<{ book: string, chapter: number, verse: number, text: string, strongsText: string|null, ref: string, isSeparator?: boolean }>}
   */
  getVersesForCitation(translationId, citationStr) {
    const citations = this._parseCitation(citationStr);
    const allVerses = [];

    for (const citation of citations) {
      const verses = this._resolveRange(translationId, citation);
      if (allVerses.length > 0 && verses.length > 0) {
        allVerses.push({ isSeparator: true });
      }
      allVerses.push(...verses);
    }

    return allVerses;
  },

  /**
   * Parse a citation string into structured ranges.
   * Handles: "Gen 1:1", "Genesis 1:1-3", "Genesis 1:4,14", "Genesis 1:4-5,14",
   * "Genesis 1:1-6:8" (cross-chapter), "Revelation 17-18" (chapter range),
   * "Genesis 1" (whole chapter), "Gen 1:1; John 3:16" (multiple with ; or +)
   * @private
   */
  _parseCitation(citationStr) {
    if (!citationStr) return [];

    // Pre-process: split space/tab-separated citations that have no ; or + delimiter.
    // Two passes:
    //   Pass 1: After a verse reference (:\d+...) followed by a new book name — always safe to split.
    //   Pass 2: After a chapter number/range followed by what resolves to a known book name.
    const tabNorm = citationStr.replace(/\t/g, ' ');

    // Pass 1: split after colon-verse patterns (e.g. ":16 John" → ":16; John")
    let normalized = tabNorm.replace(
      /(:\d+(?:-\d+)?(?:,\s*\d+(?:-\d+)?)*)\s+((?:(?:III|II|I|[123])\s+)?[A-Za-z])/g,
      '$1; $2'
    );

    // Pass 2: split after chapter/chapter-range when followed by a known book name.
    // Walk the string and look for patterns: "digits(-digits)? space BookName"
    // Only split if the trailing word(s) resolve to a canonical book via normalizeBookName.
    normalized = normalized.replace(
      /(\d+(?:-\d+)?)\s+((?:(?:III|II|I|[123])\s+)?[A-Za-z][A-Za-z .]+?\s+\d)/g,
      (match, digits, rest, offset) => {
        // Extract the book-name candidate (everything before the trailing chapter number)
        const bookCandidate = rest.replace(/\s+\d$/, '').trim();
        const resolved = normalizeBookName(bookCandidate);
        // If it resolves to a canonical book name (not just echoed back), split
        if (resolved !== bookCandidate || BOOK_NAME_MAP[bookCandidate.toLowerCase()]) {
          return digits + '; ' + rest;
        }
        return match;
      }
    );

    // Split by + or ; for multiple citations
    const parts = normalized.split(/\s*[+;]\s*/);
    const citations = [];

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Extract book and chapter:verses portion
      // Matches: "Book Chapter:VerseSpec" where VerseSpec can be complex
      const mainMatch = trimmed.match(/^(.+?)\s+(\d+):(.+)$/);

      if (mainMatch) {
        const [, rawBook, chapter, verseSpec] = mainMatch;
        const book = normalizeBookName(rawBook);
        const chapterNum = parseInt(chapter);

        // Cross-chapter range: "1:1-6:8"
        const crossChapterMatch = verseSpec.match(/^(\d+)[–—-](\d+):(\d+)$/);
        if (crossChapterMatch) {
          citations.push({
            book,
            startChapter: chapterNum,
            startVerse: parseInt(crossChapterMatch[1]),
            endChapter: parseInt(crossChapterMatch[2]),
            endVerse: parseInt(crossChapterMatch[3])
          });
          continue;
        }

        // Split by comma for multiple verse specs: "4-5,14"
        const verseSegments = verseSpec.split(/\s*,\s*/);

        for (const segment of verseSegments) {
          const segTrimmed = segment.trim();
          if (!segTrimmed) continue;

          // Range: "4-5" or "4–5"
          const rangeMatch = segTrimmed.match(/^(\d+)[–—-](\d+)$/);
          if (rangeMatch) {
            citations.push({
              book,
              startChapter: chapterNum,
              startVerse: parseInt(rangeMatch[1]),
              endChapter: chapterNum,
              endVerse: parseInt(rangeMatch[2])
            });
          } else {
            // Single verse
            const verseNum = parseInt(segTrimmed);
            if (!isNaN(verseNum)) {
              citations.push({
                book,
                startChapter: chapterNum,
                startVerse: verseNum,
                endChapter: chapterNum,
                endVerse: verseNum
              });
            }
          }
        }
      } else {
        // Chapter range: "Revelation 17-18"
        const chapterRangeMatch = trimmed.match(/^(.+?)\s+(\d+)[–—-](\d+)$/);
        if (chapterRangeMatch) {
          citations.push({
            book: normalizeBookName(chapterRangeMatch[1]),
            startChapter: parseInt(chapterRangeMatch[2]),
            startVerse: 1,
            endChapter: parseInt(chapterRangeMatch[3]),
            endVerse: 200
          });
        } else {
          // Whole chapter: "Genesis 1"
          const wholeChapterMatch = trimmed.match(/^(.+?)\s+(\d+)$/);
          if (wholeChapterMatch) {
            citations.push({
              book: normalizeBookName(wholeChapterMatch[1]),
              startChapter: parseInt(wholeChapterMatch[2]),
              startVerse: 1,
              endChapter: parseInt(wholeChapterMatch[2]),
              endVerse: 200
            });
          }
        }
      }
    }

    return citations;
  },

  /**
   * Check if a citation string references multiple verses/ranges.
   * Useful for routing to multiverse view.
   * @param {string} citationStr
   * @returns {boolean}
   */
  isMultiVerseCitation(citationStr) {
    if (!citationStr || typeof citationStr !== 'string') return false;
    const parsed = this._parseCitation(citationStr);
    return parsed.length > 1;
  },

  /**
   * Resolve a citation range to verse objects.
   * @private
   */
  _resolveRange(translationId, citation) {
    const blob = this._blobs[translationId];
    const index = this._indexes[translationId];
    if (!blob || !index) return [];

    const reg = this._registryMap[translationId];
    const hasStrongsData = reg && reg.hasStrongs;
    const verses = [];

    for (let ch = citation.startChapter; ch <= citation.endChapter; ch++) {
      const startV = (ch === citation.startChapter) ? citation.startVerse : 1;
      const endV = (ch === citation.endChapter) ? citation.endVerse : 200;

      for (let v = startV; v <= endV; v++) {
        const ref = `${citation.book} ${ch}:${v}`;
        const offsets = index[ref];
        if (!offsets) {
          if (v > startV) break;
          continue;
        }
        const rawText = blob.slice(offsets[0], offsets[1]);
        verses.push({
          book: citation.book,
          chapter: ch,
          verse: v,
          text: hasStrongsData ? this._stripStrongsTags(rawText) : rawText,
          strongsText: hasStrongsData ? rawText : null,
          ref
        });
      }
    }

    return verses;
  },

  // ── Search ──

  /**
   * Search a single translation for verses matching a pattern.
   * Linear scan over the blob — cache-friendly, no object iteration.
   * @param {string} translationId
   * @param {string|RegExp} pattern - string or regex
   * @returns {Array<{ ref: string, text: string, matches: string[] }>}
   */
  searchText(translationId, pattern) {
    const blob = this._blobs[translationId];
    const index = this._indexes[translationId];
    if (!blob || !index) return [];

    const reg = this._registryMap[translationId];
    const hasStrongsData = reg && reg.hasStrongs;
    const regex = (pattern instanceof RegExp) ? pattern : new RegExp(pattern, 'ig');
    const results = [];

    // Walk the index (which maps ref → offsets) and test each verse
    for (const ref of Object.keys(index)) {
      const offsets = index[ref];
      const rawText = blob.slice(offsets[0], offsets[1]);
      const plainText = hasStrongsData ? this._stripStrongsTags(rawText) : rawText;

      regex.lastIndex = 0;
      if (regex.test(plainText)) {
        // Get all matches for highlighting
        const matchRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
        const matches = plainText.match(matchRegex) || [];
        results.push({ ref, text: plainText, matches });
      }
    }

    return results;
  },

  /**
   * Search all searchable (English) translations.
   * @param {string|RegExp} pattern
   * @returns {Object<string, Array<{ ref: string, text: string, matches: string[] }>>}
   */
  searchAllTranslations(pattern) {
    const results = {};
    for (const reg of BIBLE_REGISTRY) {
      if (reg.searchable === false) continue;
      if (!this._blobs[reg.id]) continue;
      const r = this.searchText(reg.id, pattern);
      if (r.length > 0) results[reg.id] = r;
    }
    return results;
  },

  // ── Utilities ──

  /**
   * Strip Strong's tags from text: {H####}, {G####}, {(H####)}, {(G####)}
   * @private
   */
  _stripStrongsTags(text) {
    return text.replace(/\{\(?[HG]\d+\)?\}/g, '');
  },

  /**
   * Compare two verse references for sorting in Bible order.
   * @param {string} refA - e.g. "Genesis 1:1"
   * @param {string} refB - e.g. "Exodus 2:3"
   * @returns {number} negative if a<b, positive if a>b, 0 if equal
   */
  compareRefs(refA, refB) {
    const parseRef = (ref) => {
      const m = ref.match(/^(.+?)\s+(\d+):(\d+)$/);
      if (!m) return { bookIdx: 999, ch: 0, v: 0 };
      return {
        bookIdx: BOOK_ORDER_INDEX[m[1]] !== undefined ? BOOK_ORDER_INDEX[m[1]] : 999,
        ch: parseInt(m[2]),
        v: parseInt(m[3])
      };
    };
    const a = parseRef(refA);
    const b = parseRef(refB);
    return (a.bookIdx - b.bookIdx) || (a.ch - b.ch) || (a.v - b.v);
  },

  // ── Book name utilities (exposed on API) ──

  /** Normalize any book name/abbreviation to canonical form. */
  normalizeBookName,

  /** Abbreviate a canonical book name to standard short form. */
  abbreviateBookName,

  /** Abbreviate a full reference (e.g. "Genesis 1:1" → "Gen 1:1"). */
  abbreviateRef,

  /** Parse a reference string into components { book, chapter, verse, endVerse }. */
  parseRef,

  /** Build a reference string from components. */
  buildRef,

  /** Normalize a messy citation string to canonical form. */
  normalizeCitation,

  /** Encode citation string to URL path segments. */
  citationToUrlSegments,

  /** Decode URL path segments back to canonical citation string. */
  urlSegmentsToCitation,

  /** Canonical book order (66 books). */
  BOOK_ORDER,

  /** Book number (1-66) to canonical name. */
  BOOK_NUM_TO_NAME,

  /** Canonical name to book number (1-66). */
  BOOK_NAME_TO_NUM,

  /** Canonical name to standard abbreviation. */
  BOOK_ABBREVIATIONS,

  // ── Progressive loading ──

  /**
   * Load translations progressively: primary first, then the rest in background.
   * Non-blocking — returns immediately after starting primary load.
   * @param {string} primaryId - Translation to load first (awaited). Default 'kjv'.
   * @param {Function} [onProgress] - Called as (translationId, loaded, total) when each finishes.
   * @returns {Promise<boolean>} true when primary is loaded.
   */
  async loadProgressive(primaryId = 'kjv', onProgress = null) {
    this._ensureInit();

    // Load primary translation (awaited — UI needs this)
    const ok = await this.loadTranslation(primaryId);
    if (onProgress) onProgress(primaryId, 1, BIBLE_REGISTRY.length);

    // Load rest in background (non-blocking)
    let loaded = 1;
    const total = BIBLE_REGISTRY.length;
    for (const reg of BIBLE_REGISTRY) {
      if (reg.id === primaryId) continue;
      // Don't await — fire and forget, but track progress
      this.loadTranslation(reg.id).then(() => {
        loaded++;
        if (onProgress) onProgress(reg.id, loaded, total);
      }).catch(() => {
        loaded++;
        if (onProgress) onProgress(reg.id, loaded, total);
      });
    }

    return ok;
  },

  // ── Worker-based parallel search ──

  /** @type {Object<string, Worker>} translationId → Worker instance */
  _workers: {},

  /** @type {number} Counter for unique message IDs */
  _workerMsgId: 0,

  /**
   * Get or create a worker for a translation.
   * @private
   */
  _getWorker(translationId) {
    if (this._workers[translationId]) return this._workers[translationId];

    // Workers require a URL — bible-worker.js must be served alongside bible.js
    // In environments without Worker support (Node.js), return null
    if (typeof Worker === 'undefined') return null;

    const reg = this._registryMap[translationId];
    if (!reg) return null;

    const worker = new Worker('/bible-worker.js');
    this._workers[translationId] = worker;

    // Tell worker to load its translation
    worker.postMessage({ type: 'load', translationId: translationId, file: reg.file, hasStrongs: reg.hasStrongs });
    return worker;
  },

  /**
   * Send a search query to a worker and get results back.
   * @private
   * @returns {Promise<Array>}
   */
  _workerSearch(translationId, pattern, flags) {
    const worker = this._getWorker(translationId);
    if (!worker) {
      // Fallback: run on main thread
      return Promise.resolve(this.searchText(translationId, new RegExp(pattern, flags)));
    }

    const msgId = ++this._workerMsgId;
    return new Promise((resolve) => {
      const handler = (e) => {
        if (e.data.msgId === msgId) {
          worker.removeEventListener('message', handler);
          resolve(e.data.results || []);
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'search', msgId, pattern, flags });
    });
  },

  /**
   * Search all searchable translations in parallel using Web Workers.
   * Each translation searches in its own thread simultaneously.
   * Falls back to main-thread sequential search if Workers unavailable.
   * @param {string|RegExp} pattern
   * @returns {Promise<Object<string, Array>>} translationId → results array
   */
  async searchAllParallel(pattern) {
    const source = (pattern instanceof RegExp) ? pattern.source : pattern;
    const flags = (pattern instanceof RegExp) ? pattern.flags : 'ig';

    const searchable = BIBLE_REGISTRY.filter(t => t.searchable !== false);
    const promises = [];
    const ids = [];

    for (const reg of searchable) {
      if (!this._blobs[reg.id] && typeof Worker === 'undefined') continue;
      ids.push(reg.id);
      promises.push(this._workerSearch(reg.id, source, flags));
    }

    const resultsArr = await Promise.all(promises);
    const results = {};
    for (let i = 0; i < ids.length; i++) {
      if (resultsArr[i].length > 0) {
        results[ids[i]] = resultsArr[i];
      }
    }
    return results;
  },

  /**
   * Terminate all workers (cleanup).
   */
  terminateWorkers() {
    for (const [id, worker] of Object.entries(this._workers)) {
      worker.terminate();
    }
    this._workers = {};
  },

  // ── Translation ordering preferences ──

  /** Default visible count if no preference is saved. */
  _defaultVisibleCount: 4,

  /**
   * Get translations in user-preferred order, split into visible/hidden.
   * Reads from localStorage. Falls back to registry order with default visible count.
   * Excludes source texts (WLC, Greek NT) — those are for interlinear display only.
   * @returns {{ visible: Object[], hidden: Object[], order: string[], visibleCount: number }}
   */
  getOrderedTranslations() {
    this._ensureInit();
    const searchable = BIBLE_REGISTRY.filter(t => t.searchable !== false);
    const defaultOrder = searchable.map(t => t.id);
    let order = defaultOrder;
    let visibleCount = this._defaultVisibleCount;

    try {
      const saved = localStorage.getItem('bible_translation_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.order) && parsed.order.length > 0) {
          // Validate: keep only ids that still exist in registry, append any new ones
          const validIds = new Set(defaultOrder);
          const filtered = parsed.order.filter(id => validIds.has(id));
          const missing = defaultOrder.filter(id => !filtered.includes(id));
          order = [...filtered, ...missing];
        }
        if (typeof parsed.visibleCount === 'number' && parsed.visibleCount >= 1) {
          visibleCount = Math.min(parsed.visibleCount, order.length);
        }
      }
    } catch (e) {}

    // Ensure at least 1 visible
    if (visibleCount < 1) visibleCount = 1;
    if (visibleCount > order.length) visibleCount = order.length;

    const visible = [];
    const hidden = [];
    for (let i = 0; i < order.length; i++) {
      const reg = this._registryMap[order[i]];
      if (!reg) continue;
      if (i < visibleCount) {
        visible.push(reg);
      } else {
        hidden.push(reg);
      }
    }

    return { visible, hidden, order, visibleCount };
  },

  /**
   * Save translation ordering preference to localStorage.
   * @param {string[]} order - Translation IDs in priority order
   * @param {number} visibleCount - How many are shown by default
   */
  saveTranslationOrder(order, visibleCount) {
    try {
      const vc = Math.max(1, Math.min(visibleCount, order.length));
      localStorage.setItem('bible_translation_order', JSON.stringify({ order, visibleCount: vc }));
    } catch (e) {}
  },

  /**
   * Get the user's default (first priority) translation ID.
   * @returns {string}
   */
  getDefaultTranslation() {
    const { order } = this.getOrderedTranslations();
    return order[0] || 'kjv';
  }
};

// ── Export for Node.js (tests) and browser ──
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Bible, BIBLE_REGISTRY,
    BOOK_ORDER, BOOK_NUM_TO_NAME, BOOK_NAME_TO_NUM, BOOK_NAME_MAP, BOOK_ABBREVIATIONS,
    normalizeBookName, abbreviateBookName, abbreviateRef, parseRef, buildRef,
    normalizeCitation, citationToUrlSegments, urlSegmentsToCitation
  };
}
