/**
 * Hebrew Morphology Decoder
 * 
 * Pure data module — no I/O, no DOM, fully unit-testable.
 * Decodes OSHB morphology codes (e.g. "HVqp3ms") into structured objects
 * and human-readable descriptions.
 *
 * Reference: https://github.com/openscriptures/morphhb/blob/master/parsing/HebrewMorphologyCodes.html
 *
 * Morphology code structure:
 *   [Language][PartOfSpeech][...details]
 *   Prefixes/suffixes separated by "/" matching the word's "/" splits
 *
 * Example: "HC/Vqw3ms" = Hebrew Conjunction / Verb Qal Sequential-Imperfect 3rd Masculine Singular
 */

// ── Lookup Tables ──────────────────────────────────────────────────

const LANGUAGE = {
  H: 'Hebrew',
  A: 'Aramaic'
};

const PART_OF_SPEECH = {
  A: 'Adjective',
  C: 'Conjunction',
  D: 'Adverb',
  N: 'Noun',
  P: 'Pronoun',
  R: 'Preposition',
  S: 'Suffix',
  T: 'Particle',
  V: 'Verb'
};

const VERB_STEM_HEBREW = {
  q: 'Qal',
  N: 'Niphal',
  p: 'Piel',
  P: 'Pual',
  h: 'Hiphil',
  H: 'Hophal',
  t: 'Hithpael',
  o: 'Polel',
  O: 'Polal',
  r: 'Hithpolel',
  m: 'Poel',
  M: 'Poal',
  k: 'Palel',
  K: 'Pulal',
  Q: 'Qal Passive',
  l: 'Pilpel',
  L: 'Polpal',
  f: 'Hithpalpel',
  D: 'Nithpael',
  j: 'Pealal',
  i: 'Pilel',
  u: 'Hothpaal',
  c: 'Tiphil',
  v: 'Hishtaphel',
  w: 'Nithpalel',
  y: 'Nithpoel',
  z: 'Hithpoel'
};

const VERB_STEM_ARAMAIC = {
  q: 'Peal',
  Q: 'Peil',
  u: 'Hithpeel',
  p: 'Pael',
  P: 'Ithpaal',
  M: 'Hithpaal',
  a: 'Aphel',
  h: 'Haphel',
  s: 'Saphel',
  e: 'Shaphel',
  H: 'Hophal',
  i: 'Ithpeel',
  t: 'Hishtaphel',
  v: 'Ishtaphel',
  w: 'Hithaphel',
  o: 'Polel',
  z: 'Ithpoel',
  r: 'Hithpolel',
  f: 'Hithpalpel',
  b: 'Hephal',
  c: 'Tiphel',
  m: 'Poel',
  l: 'Palpel',
  L: 'Ithpalpel',
  O: 'Ithpolel',
  G: 'Ittaphal'
};

const VERB_TYPE = {
  p: 'Perfect',
  q: 'Sequential Perfect',
  i: 'Imperfect',
  w: 'Sequential Imperfect',
  h: 'Cohortative',
  j: 'Jussive',
  v: 'Imperative',
  r: 'Participle Active',
  s: 'Participle Passive',
  a: 'Infinitive Absolute',
  c: 'Infinitive Construct'
};

const ADJECTIVE_TYPE = {
  a: 'Adjective',
  c: 'Cardinal Number',
  g: 'Gentilic',
  o: 'Ordinal Number'
};

const NOUN_TYPE = {
  c: 'Common',
  g: 'Gentilic',
  p: 'Proper Name'
};

const PRONOUN_TYPE = {
  d: 'Demonstrative',
  f: 'Indefinite',
  i: 'Interrogative',
  p: 'Personal',
  r: 'Relative'
};

const PREPOSITION_TYPE = {
  d: 'Definite Article'
};

const SUFFIX_TYPE = {
  d: 'Directional He',
  h: 'Paragogic He',
  n: 'Paragogic Nun',
  p: 'Pronominal'
};

const PARTICLE_TYPE = {
  a: 'Affirmation',
  d: 'Definite Article',
  e: 'Exhortation',
  i: 'Interrogative',
  j: 'Interjection',
  m: 'Demonstrative',
  n: 'Negative',
  o: 'Object Marker',
  r: 'Relative'
};

const PERSON = {
  '1': '1st',
  '2': '2nd',
  '3': '3rd',
  'x': ''
};

const GENDER = {
  b: 'Both',
  c: 'Common',
  f: 'Feminine',
  m: 'Masculine',
  x: ''
};

const NUMBER = {
  d: 'Dual',
  p: 'Plural',
  s: 'Singular',
  x: ''
};

const STATE = {
  a: 'Absolute',
  c: 'Construct',
  d: 'Determined'
};


// ── Core Decoder ───────────────────────────────────────────────────

/**
 * Decode a single morphology segment (one part between "/" delimiters).
 * The first segment in a morph string starts with the language code (H/A);
 * subsequent segments do not.
 *
 * @param {string} code - e.g. "HVqp3ms", "Ncfsa", "C", "Td", "Sp3ms"
 * @param {string} lang - 'H' or 'A' (carried from the first segment)
 * @returns {object} Parsed morphology object
 */
function decodeSegment(code, lang) {
  if (!code || code === '') return null;

  const result = {
    code: code,
    language: LANGUAGE[lang] || lang
  };

  let pos = 0;

  // Check if this segment starts with a language code
  if (code[0] === 'H' || code[0] === 'A') {
    lang = code[0];
    result.language = LANGUAGE[lang];
    pos = 1;
  }

  if (pos >= code.length) return result;

  // Part of speech
  const posCode = code[pos];
  result.partOfSpeech = PART_OF_SPEECH[posCode] || posCode;
  result.posCode = posCode;
  pos++;

  if (pos >= code.length) return result;

  // Parse remaining based on part of speech
  switch (posCode) {
    case 'V': // Verb: stem, type, person, gender, number, [state for participles]
      result.stem = (lang === 'A' ? VERB_STEM_ARAMAIC : VERB_STEM_HEBREW)[code[pos]] || code[pos];
      result.stemCode = code[pos];
      pos++;
      if (pos < code.length) {
        result.type = VERB_TYPE[code[pos]] || code[pos];
        result.typeCode = code[pos];
        pos++;
      }
      // Participles (r, s) take gender, number, state (no person)
      // Infinitives (a, c) take no person/gender/number/state
      // Finite verbs (p, q, i, w, h, j, v) take person, gender, number
      if (result.typeCode === 'r' || result.typeCode === 's') {
        // Participle: gender, number, state
        if (pos < code.length && code[pos] !== 'x') {
          result.gender = GENDER[code[pos]] || code[pos];
        }
        pos++;
        if (pos < code.length && code[pos] !== 'x') {
          result.number = NUMBER[code[pos]] || code[pos];
        }
        pos++;
        if (pos < code.length) {
          result.state = STATE[code[pos]] || code[pos];
        }
      } else if (result.typeCode === 'a' || result.typeCode === 'c') {
        // Infinitive: no further parsing needed typically
      } else {
        // Finite verb: person, gender, number
        if (pos < code.length && code[pos] !== 'x') {
          result.person = PERSON[code[pos]] || code[pos];
        }
        pos++;
        if (pos < code.length && code[pos] !== 'x') {
          result.gender = GENDER[code[pos]] || code[pos];
        }
        pos++;
        if (pos < code.length && code[pos] !== 'x') {
          result.number = NUMBER[code[pos]] || code[pos];
        }
      }
      break;

    case 'N': // Noun: type, gender, number, state
      result.type = NOUN_TYPE[code[pos]] || code[pos];
      pos++;
      if (pos < code.length && code[pos] !== 'x') {
        result.gender = GENDER[code[pos]] || code[pos];
      }
      pos++;
      if (pos < code.length && code[pos] !== 'x') {
        result.number = NUMBER[code[pos]] || code[pos];
      }
      pos++;
      if (pos < code.length) {
        result.state = STATE[code[pos]] || code[pos];
      }
      break;

    case 'A': // Adjective: type, gender, number, state
      result.type = ADJECTIVE_TYPE[code[pos]] || code[pos];
      pos++;
      if (pos < code.length && code[pos] !== 'x') {
        result.gender = GENDER[code[pos]] || code[pos];
      }
      pos++;
      if (pos < code.length && code[pos] !== 'x') {
        result.number = NUMBER[code[pos]] || code[pos];
      }
      pos++;
      if (pos < code.length) {
        result.state = STATE[code[pos]] || code[pos];
      }
      break;

    case 'P': // Pronoun: type, person, gender, number
      result.type = PRONOUN_TYPE[code[pos]] || code[pos];
      pos++;
      if (pos < code.length && code[pos] !== 'x') {
        result.person = PERSON[code[pos]] || code[pos];
      }
      pos++;
      if (pos < code.length && code[pos] !== 'x') {
        result.gender = GENDER[code[pos]] || code[pos];
      }
      pos++;
      if (pos < code.length && code[pos] !== 'x') {
        result.number = NUMBER[code[pos]] || code[pos];
      }
      break;

    case 'S': // Suffix: type, person, gender, number
      result.type = SUFFIX_TYPE[code[pos]] || code[pos];
      pos++;
      if (pos < code.length && code[pos] !== 'x') {
        result.person = PERSON[code[pos]] || code[pos];
      }
      pos++;
      if (pos < code.length && code[pos] !== 'x') {
        result.gender = GENDER[code[pos]] || code[pos];
      }
      pos++;
      if (pos < code.length && code[pos] !== 'x') {
        result.number = NUMBER[code[pos]] || code[pos];
      }
      break;

    case 'T': // Particle: type only
      result.type = PARTICLE_TYPE[code[pos]] || code[pos];
      break;

    case 'R': // Preposition: optional type (d = definite article)
      if (pos < code.length) {
        result.type = PREPOSITION_TYPE[code[pos]] || code[pos];
      }
      break;

    case 'C': // Conjunction: no further data
    case 'D': // Adverb: no further data
      break;
  }

  return result;
}

/**
 * Decode a full OSHB morphology string, handling "/" delimiters for
 * prefix/root/suffix parts.
 *
 * @param {string} morphCode - e.g. "HC/Vqw3ms", "HTd/Ncmpa", "HC/Vqw3ms/Sp3ms"
 * @returns {object} { language, parts: [...decodedSegments], description }
 */
function decodeMorphology(morphCode) {
  if (!morphCode || morphCode === '') return null;

  const segments = morphCode.split('/');

  // Language is always the first character of the full string
  const lang = morphCode[0];
  const language = LANGUAGE[lang] || lang;

  const parts = [];
  for (let i = 0; i < segments.length; i++) {
    const decoded = decodeSegment(segments[i], lang);
    if (decoded) {
      // Classify each part's role
      if (segments.length === 1) {
        decoded.role = 'word';
      } else if (i === 0) {
        decoded.role = 'prefix';
      } else if (i === segments.length - 1 && segments.length > 2) {
        // If there are 3+ parts and this is the last, it might be a suffix
        // But it could also be the main word — check if it's a suffix type
        decoded.role = decoded.posCode === 'S' ? 'suffix' : 'word';
      } else if (i === segments.length - 1) {
        decoded.role = 'word';
      } else {
        // Middle parts in a 3+ part word
        decoded.role = decoded.posCode === 'S' ? 'suffix' : 'word';
      }
      parts.push(decoded);
    }
  }

  return {
    code: morphCode,
    language,
    parts,
    description: buildDescription(parts)
  };
}

/**
 * Build a human-readable description from decoded parts.
 * @param {object[]} parts - Array of decoded segments
 * @returns {string} e.g. "Conjunction + Verb: Qal Sequential Imperfect 3rd Masculine Singular"
 */
function buildDescription(parts) {
  if (!parts || parts.length === 0) return '';

  const descriptions = [];
  for (const part of parts) {
    const pieces = [part.partOfSpeech];

    if (part.type) pieces.push(part.type);
    if (part.stem) pieces.push(part.stem);
    if (part.person) pieces.push(part.person);
    if (part.gender) pieces.push(part.gender);
    if (part.number) pieces.push(part.number);
    if (part.state) pieces.push(part.state);

    descriptions.push(pieces.join(' '));
  }

  return descriptions.join(' + ');
}

/**
 * Parse a lemma string into its component Strong's numbers with prefix markers.
 * MorphHB lemma format: "b/7225" → prefix b + H7225
 *                       "c/853" → prefix c + H853
 *                       "1254 a" → H1254a (variant)
 *                       "d/8064" → article d + H8064
 *
 * @param {string} lemma - Raw lemma from MorphHB XML
 * @param {string} lang - 'H' for Hebrew, 'A' for Aramaic
 * @returns {string[]} Array of Strong's numbers with H/A prefix, e.g. ["H7225"]
 */
function parseLemma(lemma, lang) {
  if (!lemma) return [];
  const prefix = lang === 'A' ? 'A' : 'H';

  return lemma.split('/')
    .map(part => {
      // Clean up: remove spaces, handle variants like "1254 a" → "1254a"
      // Strip "+" suffix (multi-word construct marker, e.g. "1035+" for Beth-lehem)
      const cleaned = part.replace(/\s+/g, '').replace(/\+$/, '');
      // Skip prefix markers (single letters that aren't Strong's numbers)
      if (/^[a-zA-Z]$/.test(cleaned)) return null;
      // If it's a number (possibly with variant letter), prefix it
      if (/^\d/.test(cleaned)) return prefix + cleaned;
      // Proper noun marker or other non-numeric — skip
      return null;
    })
    .filter(Boolean);
}

/**
 * Extract the primary Strong's number from a lemma string.
 * Returns the last (main word) Strong's number.
 *
 * @param {string} lemma - Raw lemma, e.g. "b/7225", "c/d/8064"
 * @param {string} lang - 'H' or 'A'
 * @returns {string|null} e.g. "H7225", "H8064"
 */
function primaryStrongsFromLemma(lemma, lang) {
  const numbers = parseLemma(lemma, lang);
  return numbers.length > 0 ? numbers[numbers.length - 1] : null;
}


// ── Unicode Helpers ────────────────────────────────────────────────

/**
 * Strip cantillation marks (trope/accents) from Hebrew text.
 * Preserves consonants and vowel points (nikud).
 *
 * Cantillation marks: U+0591–U+05AF
 * Vowel points:       U+05B0–U+05BD, U+05BF, U+05C1–U+05C2, U+05C4–U+05C5, U+05C7
 * Consonants:         U+05D0–U+05EA
 * Other marks:        U+05BE (maqaf), U+05C0 (paseq), U+05C3 (sof pasuq), U+05C6 (nun hafukha)
 *
 * @param {string} text - Hebrew text with cantillation
 * @returns {string} Hebrew text with cantillation removed
 */
function stripCantillation(text) {
  if (!text) return text;
  // Remove characters in range U+0591 to U+05AF (cantillation marks)
  return text.replace(/[\u0591-\u05AF]/g, '');
}

/**
 * Strip all diacritics (both cantillation and vowel points) from Hebrew text.
 * Leaves only consonants.
 *
 * @param {string} text - Hebrew text
 * @returns {string} Consonants only
 */
function stripAllDiacritics(text) {
  if (!text) return text;
  // Remove U+0591–U+05C7 (all marks), keep U+05D0–U+05EA (consonants) and U+05BE (maqaf)
  return text.replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, '');
}


// ── Exports ────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    decodeMorphology,
    decodeSegment,
    buildDescription,
    parseLemma,
    primaryStrongsFromLemma,
    stripCantillation,
    stripAllDiacritics,
    // Export tables for testing/inspection
    LANGUAGE, PART_OF_SPEECH, VERB_STEM_HEBREW, VERB_STEM_ARAMAIC,
    VERB_TYPE, ADJECTIVE_TYPE, NOUN_TYPE, PRONOUN_TYPE,
    PREPOSITION_TYPE, SUFFIX_TYPE, PARTICLE_TYPE,
    PERSON, GENDER, NUMBER, STATE
  };
}
