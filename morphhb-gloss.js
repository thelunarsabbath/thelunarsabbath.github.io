/**
 * MorphHB Gloss Derivation
 *
 * Pure data module — derives English glosses from the Strong's Hebrew dictionary
 * for use in the interlinear display. No I/O, no DOM, fully unit-testable.
 *
 * At runtime, this replaces the pre-computed glosses that were in interlinear.json.
 * The Strong's dictionary (strongsHebrewDictionary) is already loaded by the app.
 */

/**
 * Extract a short English gloss from a Strong's dictionary entry.
 * Prefers the first KJV rendering that isn't a grammar note.
 *
 * @param {object} entry - Strong's dictionary entry (e.g. strongsHebrewDictionary["H430"])
 * @returns {string} Short gloss, e.g. "God", "beginning", "create"
 */
function extractGloss(entry) {
  if (!entry) return '';

  // Try kjv_def first — gives actual translation words
  if (entry.kjv_def) {
    const gloss = extractFirstMeaning(entry.kjv_def);
    if (gloss) return gloss;
  }

  // Fall back to strongs_def
  if (entry.strongs_def) {
    const gloss = extractFirstMeaning(entry.strongs_def);
    if (gloss) return gloss;
  }

  // Last resort: the lemma itself
  return entry.lemma || '';
}

/**
 * Extract the first meaningful word/phrase from a definition string.
 * Handles KJV-style definitions like:
 *   "beginning, chief(-est), first(-fruits, part, time)"
 *   "(as such unrepresented in English)."
 *   "angels, [idiom] exceeding, God (gods) (-dess, -ly)"
 *
 * @param {string} def - Definition string
 * @returns {string} First meaningful rendering
 */
function extractFirstMeaning(def) {
  if (!def) return '';

  // Split on comma to get individual renderings
  const parts = def.split(',');

  for (let part of parts) {
    part = part.trim();

    // Skip empty
    if (!part) continue;

    // Skip grammar markers and noise
    if (part.startsWith('[idiom]') ||
        part.startsWith('[phrase') ||
        part.startsWith('[phras') ||
        part.startsWith('(') ||
        part.startsWith('[') ||
        part.startsWith('[idiom') ||
        /^\[.*\]$/.test(part) ||
        /^[idiom]/.test(part)) {
      continue;
    }

    // Remove parenthetical suffixes: "chief(-est)" → "chief", "God (gods)" → "God"
    let cleaned = part
      .replace(/\s*\([\-][^)]*\)/g, '')     // remove "(-est)", "(-ly)" etc
      .replace(/\s*\([^)]*\)\s*/g, ' ')     // remove "(gods)" etc
      .replace(/\[idiom\]\s*/g, '')          // remove [idiom] prefix
      .replace(/\[phrase[^\]]*\]\s*/g, '')   // remove [phrase...] prefix
      .replace(/^\[.*?\]\s*/, '')            // remove any [...] prefix
      .replace(/\s+/g, ' ')                 // normalize whitespace
      .replace(/\.\s*$/, '')                 // remove trailing period
      .trim();

    // Skip if too short or just punctuation after cleaning
    if (cleaned.length < 2) continue;
    // Skip if starts with "+" or "×" (reference markers)
    if (cleaned.startsWith('+') || cleaned.startsWith('×')) continue;

    return cleaned;
  }

  return '';
}

/**
 * Get a short gloss for a Strong's number, using the dictionary.
 *
 * @param {string} strongsNum - e.g. "H430", "H7225", "A1934"
 * @param {object} dictionary - The Strong's dictionary object (strongsHebrewDictionary or strongsGreekDictionary)
 * @returns {string} Short gloss
 */
function getGloss(strongsNum, dictionary) {
  if (!strongsNum || !dictionary) return '';

  // Handle variant suffixes: "H1254a" → try "H1254a" first, then "H1254"
  let entry = dictionary[strongsNum];
  if (!entry) {
    // Strip trailing letter variant
    const base = strongsNum.replace(/[a-z]$/, '');
    entry = dictionary[base];
  }

  return extractGloss(entry);
}

/**
 * Get the root/lemma Hebrew form for a Strong's number.
 *
 * @param {string} strongsNum - e.g. "H430"
 * @param {object} dictionary - The Strong's dictionary object
 * @returns {string} Root Hebrew word, e.g. "אֱלֹהִים"
 */
function getRootWord(strongsNum, dictionary) {
  if (!strongsNum || !dictionary) return '';

  let entry = dictionary[strongsNum];
  if (!entry) {
    const base = strongsNum.replace(/[a-z]$/, '');
    entry = dictionary[base];
  }

  return entry?.lemma || '';
}

/**
 * Build a complete gloss for a MorphHB word entry, handling compound lemmas.
 * For a word like "בְּ/רֵאשִׁית" with lemma "b/7225":
 *   - "b" is a prefix (preposition "in")
 *   - "7225" → H7225 → "beginning"
 *   - Result: "in + beginning" or just "beginning" depending on mode
 *
 * @param {string} lemma - MorphHB lemma, e.g. "b/7225", "c/d/8064"
 * @param {string} lang - 'H' or 'A'
 * @param {object} dictionary - Strong's dictionary
 * @returns {string} Primary gloss for the root word
 */
function getWordGloss(lemma, lang, dictionary) {
  if (!lemma || !dictionary) return '';
  const prefix = lang === 'A' ? 'A' : 'H';

  // Split lemma on "/" and find the last numeric part (the root word)
  const parts = lemma.split('/');
  for (let i = parts.length - 1; i >= 0; i--) {
    // Strip spaces and "+" multi-word construct marker
    const cleaned = parts[i].replace(/\s+/g, '').replace(/\+$/, '');
    if (/^\d/.test(cleaned)) {
      return getGloss(prefix + cleaned, dictionary);
    }
  }

  return '';
}

/**
 * Get prefix meanings for display (e.g. "in", "and", "the").
 * These are the single-letter prefix markers in the lemma.
 *
 * @param {string} lemma - MorphHB lemma, e.g. "b/7225"
 * @returns {string[]} Array of prefix meanings
 */
function getPrefixMeanings(lemma) {
  if (!lemma) return [];
  const parts = lemma.split('/');
  const prefixes = [];

  for (const part of parts) {
    const cleaned = part.replace(/\s+/g, '');
    if (/^\d/.test(cleaned)) break; // Stop at the root number

    switch (cleaned) {
      case 'b': prefixes.push('in'); break;
      case 'c': prefixes.push('and'); break;
      case 'd': prefixes.push('the'); break;
      case 'k': prefixes.push('as/like'); break;
      case 'l': prefixes.push('to/for'); break;
      case 'm': prefixes.push('from'); break;
      case 's': prefixes.push('that/which'); break;
      // Some rarer prefixes
      default:
        if (/^[a-z]$/.test(cleaned)) {
          prefixes.push(cleaned); // Return raw prefix letter if unknown
        }
    }
  }

  return prefixes;
}


// ── Exports ────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractGloss,
    extractFirstMeaning,
    getGloss,
    getRootWord,
    getWordGloss,
    getPrefixMeanings
  };
}
