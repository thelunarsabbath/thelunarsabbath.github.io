#!/usr/bin/env node
/**
 * Unit tests for Bible data subsystem (bible.js).
 *
 * Tests run against actual .txt files in bibles/ — no mocks.
 * Uses Node's built-in assert module (no external dependencies).
 *
 * Usage: node tests/bible-test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Load bible.js
const {
  Bible, BIBLE_REGISTRY,
  BOOK_ORDER, BOOK_NUM_TO_NAME, BOOK_NAME_TO_NUM, BOOK_NAME_MAP, BOOK_ABBREVIATIONS,
  normalizeBookName, abbreviateBookName, abbreviateRef, parseRef, buildRef,
  normalizeCitation, citationToUrlSegments, urlSegmentsToCitation
} = require('../bible.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate fetch() for Node.js by reading local files. */
function mockFetch(basePath) {
  global.fetch = async (url) => {
    const filePath = path.join(basePath, url);
    if (!fs.existsSync(filePath)) {
      return { ok: false, status: 404 };
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      ok: true,
      status: 200,
      text: async () => content,
      json: async () => JSON.parse(content)
    };
  };
}

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ── Direct loading helper (bypass fetch for tests) ──

function loadTranslationDirect(translationId) {
  const reg = Bible._registryMap[translationId];
  if (!reg) throw new Error(`Unknown translation: ${translationId}`);
  const filePath = path.join(__dirname, '..', reg.file);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const text = fs.readFileSync(filePath, 'utf8');
  Bible._parseAndStore(translationId, text);
}

// ── Tests ────────────────────────────────────────────────────────────────────

async function main() {
  const ROOT = path.join(__dirname, '..');
  mockFetch(ROOT);

  // Initialize
  Bible._ensureInit();

  console.log('\n=== BIBLE_REGISTRY Tests ===\n');

  test('Registry has 12 translations', () => {
    assert.strictEqual(BIBLE_REGISTRY.length, 12);
  });

  test('Registry has required fields for every entry', () => {
    for (const reg of BIBLE_REGISTRY) {
      assert.ok(reg.id, `Missing id`);
      assert.ok(reg.name, `Missing name for ${reg.id}`);
      assert.ok(reg.fullName, `Missing fullName for ${reg.id}`);
      assert.ok(reg.file, `Missing file for ${reg.id}`);
      assert.strictEqual(typeof reg.hasStrongs, 'boolean', `hasStrongs not boolean for ${reg.id}`);
      assert.strictEqual(typeof reg.searchable, 'boolean', `searchable not boolean for ${reg.id}`);
      assert.strictEqual(typeof reg.isSourceText, 'boolean', `isSourceText not boolean for ${reg.id}`);
      assert.strictEqual(typeof reg.rtl, 'boolean', `rtl not boolean for ${reg.id}`);
    }
  });

  test('getTranslations returns all entries', () => {
    assert.strictEqual(Bible.getTranslations().length, 12);
  });

  test('getTranslation returns correct entry', () => {
    const kjv = Bible.getTranslation('kjv');
    assert.strictEqual(kjv.name, 'KJV');
    assert.strictEqual(kjv.year, 1611);
    assert.strictEqual(kjv.hasStrongs, true);
  });

  test('getTranslation returns null for unknown', () => {
    assert.strictEqual(Bible.getTranslation('xyz'), null);
  });

  test('getSearchableTranslations excludes source texts', () => {
    const searchable = Bible.getSearchableTranslations();
    assert.ok(searchable.length > 0);
    for (const t of searchable) {
      assert.strictEqual(t.searchable, true, `${t.id} should be searchable`);
    }
    assert.ok(!searchable.find(t => t.id === 'wlc'), 'WLC should not be searchable');
    assert.ok(!searchable.find(t => t.id === 'greek_nt'), 'Greek NT should not be searchable');
  });

  test('getSourceTexts returns only source texts', () => {
    const sources = Bible.getSourceTexts();
    assert.strictEqual(sources.length, 2);
    assert.ok(sources.find(t => t.id === 'wlc'));
    assert.ok(sources.find(t => t.id === 'greek_nt'));
  });

  test('hasStrongs returns correct values', () => {
    assert.strictEqual(Bible.hasStrongs('kjv'), true);
    assert.strictEqual(Bible.hasStrongs('asv'), true);
    assert.strictEqual(Bible.hasStrongs('akjv'), true);
    assert.strictEqual(Bible.hasStrongs('ylt'), false);
    assert.strictEqual(Bible.hasStrongs('wlc'), false);
    assert.strictEqual(Bible.hasStrongs('xyz'), false);
  });

  // ── Loading tests ──

  console.log('\n=== Loading Tests ===\n');

  test('isLoaded returns false before loading', () => {
    assert.strictEqual(Bible.isLoaded('kjv'), false);
  });

  // Load KJV directly (synchronous, no fetch)
  loadTranslationDirect('kjv');

  test('isLoaded returns true after loading KJV', () => {
    assert.strictEqual(Bible.isLoaded('kjv'), true);
  });

  test('getLoadedTranslations includes kjv', () => {
    assert.ok(Bible.getLoadedTranslations().includes('kjv'));
  });

  test('KJV blob is a string', () => {
    assert.strictEqual(typeof Bible._blobs['kjv'], 'string');
  });

  test('KJV index has 31000+ verses', () => {
    const count = Object.keys(Bible._indexes['kjv']).length;
    assert.ok(count >= 31000, `Expected 31000+, got ${count}`);
  });

  // Load remaining translations
  const toLoad = ['asv', 'akjv', 'ylt', 'dbt', 'drb', 'jps', 'slt', 'wbt', 'lxx', 'wlc', 'greek_nt'];
  for (const id of toLoad) {
    try {
      loadTranslationDirect(id);
    } catch (e) {
      console.log(`  (skipping ${id}: ${e.message})`);
    }
  }

  test('ASV loaded with 31000+ verses', () => {
    assert.ok(Bible.isLoaded('asv'));
    assert.ok(Object.keys(Bible._indexes['asv']).length >= 31000);
  });

  test('LXX loaded with 28000+ verses (OT only)', () => {
    assert.ok(Bible.isLoaded('lxx'));
    const count = Object.keys(Bible._indexes['lxx']).length;
    assert.ok(count >= 28000 && count < 31200, `Expected ~28460, got ${count}`);
  });

  test('WLC loaded with 23000+ verses (Hebrew OT)', () => {
    assert.ok(Bible.isLoaded('wlc'));
    const count = Object.keys(Bible._indexes['wlc']).length;
    assert.ok(count >= 23000, `Expected 23000+, got ${count}`);
  });

  test('Greek NT loaded with 7900+ verses', () => {
    assert.ok(Bible.isLoaded('greek_nt'));
    const count = Object.keys(Bible._indexes['greek_nt']).length;
    assert.ok(count >= 7900, `Expected 7900+, got ${count}`);
  });

  // ── Metadata tests ──

  console.log('\n=== Metadata Tests ===\n');

  test('getBooks returns 66 books', () => {
    const books = Bible.getBooks();
    assert.strictEqual(books.length, 66);
    assert.strictEqual(books[0], 'Genesis');
    assert.strictEqual(books[65], 'Revelation');
  });

  test('getChapterCount returns correct counts', () => {
    assert.strictEqual(Bible.getChapterCount('Genesis'), 50);
    assert.strictEqual(Bible.getChapterCount('Psalms'), 150);
    assert.strictEqual(Bible.getChapterCount('Revelation'), 22);
    assert.strictEqual(Bible.getChapterCount('Obadiah'), 1);
  });

  test('getBookChapterCounts returns object with 66 books', () => {
    const counts = Bible.getBookChapterCounts();
    assert.strictEqual(Object.keys(counts).length, 66);
    assert.strictEqual(counts['Genesis'], 50);
  });

  // ── Point lookup tests ──

  console.log('\n=== Point Lookup Tests ===\n');

  test('getVerse returns KJV Genesis 1:1 with Strong\'s', () => {
    const v = Bible.getVerse('kjv', 'Genesis', 1, 1);
    assert.ok(v, 'Verse should exist');
    assert.strictEqual(v.ref, 'Genesis 1:1');
    assert.ok(v.text.includes('In the beginning'), `Text: ${v.text}`);
    assert.ok(!v.text.includes('{H'), 'text should not contain Strong\'s tags');
    assert.ok(v.strongsText, 'strongsText should exist');
    assert.ok(v.strongsText.includes('{H7225}'), 'strongsText should contain Strong\'s tags');
  });

  test('getVerse returns ASV Genesis 1:1 with Strong\'s', () => {
    const v = Bible.getVerse('asv', 'Genesis', 1, 1);
    assert.ok(v);
    assert.ok(v.text.includes('In the beginning'));
    assert.ok(v.strongsText.includes('{H7225}'));
  });

  test('getVerse returns YLT without Strong\'s', () => {
    const v = Bible.getVerse('ylt', 'Genesis', 1, 1);
    assert.ok(v);
    assert.ok(v.text.includes('beginning of God'), `YLT text: ${v.text.slice(0, 60)}`);
    assert.strictEqual(v.strongsText, null, 'YLT should have no strongsText');
  });

  test('getVerse returns WLC Hebrew text', () => {
    const v = Bible.getVerse('wlc', 'Genesis', 1, 1);
    assert.ok(v);
    // Check for Hebrew characters (avoid Unicode normalization issues with specific words)
    assert.ok(v.text.length > 10, `Expected non-empty Hebrew text, got: ${v.text.slice(0, 30)}`);
    assert.ok(/[\u0590-\u05FF]/.test(v.text), `Expected Hebrew characters, got: ${v.text.slice(0, 30)}`);
    assert.strictEqual(v.strongsText, null);
  });

  test('getVerse returns Greek NT text for John 1:1', () => {
    const v = Bible.getVerse('greek_nt', 'John', 1, 1);
    assert.ok(v);
    assert.ok(v.text.includes('Ἐν'), `Expected Greek, got: ${v.text}`);
    assert.ok(v.text.includes('Λόγος'));
  });

  test('getVerse returns null for non-existent verse', () => {
    const v = Bible.getVerse('kjv', 'Genesis', 1, 999);
    assert.strictEqual(v, null);
  });

  test('getVerse returns null for non-existent book', () => {
    const v = Bible.getVerse('kjv', 'FakeBook', 1, 1);
    assert.strictEqual(v, null);
  });

  test('getVerse returns null for unloaded translation', () => {
    const v = Bible.getVerse('nonexistent', 'Genesis', 1, 1);
    assert.strictEqual(v, null);
  });

  test('LXX returns null for NT verse (OT only)', () => {
    const v = Bible.getVerse('lxx', 'John', 1, 1);
    assert.strictEqual(v, null);
  });

  test('WLC returns null for NT verse (OT only)', () => {
    const v = Bible.getVerse('wlc', 'Matthew', 1, 1);
    assert.strictEqual(v, null);
  });

  test('Greek NT returns null for OT verse', () => {
    const v = Bible.getVerse('greek_nt', 'Genesis', 1, 1);
    assert.strictEqual(v, null);
  });

  // ── Chapter tests ──

  console.log('\n=== Chapter Tests ===\n');

  test('getChapter returns all verses in Genesis 1', () => {
    const verses = Bible.getChapter('kjv', 'Genesis', 1);
    assert.strictEqual(verses.length, 31);
    assert.strictEqual(verses[0].verse, 1);
    assert.strictEqual(verses[0].ref, 'Genesis 1:1');
    assert.strictEqual(verses[30].verse, 31);
    assert.ok(verses[0].text.includes('In the beginning'));
  });

  test('getChapter returns correct count for Psalm 119 (176 verses)', () => {
    const verses = Bible.getChapter('kjv', 'Psalms', 119);
    assert.strictEqual(verses.length, 176);
  });

  test('getChapter returns empty for non-existent chapter', () => {
    const verses = Bible.getChapter('kjv', 'Genesis', 999);
    assert.strictEqual(verses.length, 0);
  });

  test('getChapter returns Hebrew for WLC Genesis 1', () => {
    const verses = Bible.getChapter('wlc', 'Genesis', 1);
    assert.ok(verses.length > 0, 'WLC Genesis 1 should have verses');
    assert.ok(/[\u0590-\u05FF]/.test(verses[0].text), 'First verse should contain Hebrew chars');
  });

  // ── Cross-translation tests ──

  console.log('\n=== Cross-Translation Tests ===\n');

  test('getVerseAllTranslations returns multiple translations', () => {
    const all = Bible.getVerseAllTranslations('Genesis', 1, 1);
    assert.ok(all.kjv, 'Should have KJV');
    assert.ok(all.asv, 'Should have ASV');
    assert.ok(all.ylt, 'Should have YLT');
    assert.ok(all.wlc, 'Should have WLC');
    assert.ok(all.kjv.text.includes('In the beginning'));
    assert.ok(/[\u0590-\u05FF]/.test(all.wlc.text), 'WLC should have Hebrew');
  });

  test('getVerseAllTranslations with englishOnly excludes source texts', () => {
    const all = Bible.getVerseAllTranslations('Genesis', 1, 1, { englishOnly: true });
    assert.ok(all.kjv);
    assert.ok(!all.wlc, 'Should not have WLC');
    assert.ok(!all.greek_nt, 'Should not have Greek NT');
  });

  test('Cross-translation for John 1:1 includes Greek NT', () => {
    const all = Bible.getVerseAllTranslations('John', 1, 1);
    assert.ok(all.kjv);
    assert.ok(all.greek_nt, 'Should have Greek NT for John');
    assert.ok(!all.wlc, 'Should not have WLC for John (OT only)');
  });

  // ── Citation tests ──

  console.log('\n=== Citation Tests ===\n');

  test('getVersesForCitation handles "Genesis 1:1"', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1:1');
    assert.strictEqual(verses.length, 1);
    assert.strictEqual(verses[0].ref, 'Genesis 1:1');
  });

  test('getVersesForCitation handles range "Genesis 1:1-3"', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1:1-3');
    assert.strictEqual(verses.length, 3);
    assert.strictEqual(verses[0].verse, 1);
    assert.strictEqual(verses[2].verse, 3);
  });

  test('getVersesForCitation handles multiple citations with semicolon', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1:1; John 3:16');
    assert.ok(verses.length >= 3, 'Should have verses + separator');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 2);
    assert.strictEqual(nonSep[0].ref, 'Genesis 1:1');
    assert.strictEqual(nonSep[1].ref, 'John 3:16');
  });

  test('getVersesForCitation handles whole chapter "Genesis 1"', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1');
    assert.strictEqual(verses.length, 31);
  });

  // ── Search tests ──

  console.log('\n=== Search Tests ===\n');

  test('searchText finds "In the beginning" in KJV', () => {
    const results = Bible.searchText('kjv', /\bIn the beginning\b/i);
    assert.ok(results.length > 0, 'Should find at least one match');
    assert.ok(results.some(r => r.ref === 'Genesis 1:1'));
  });

  test('searchText finds "faith" across many verses', () => {
    const results = Bible.searchText('kjv', /\bfaith\b/i);
    assert.ok(results.length > 200, `Expected 200+, got ${results.length}`);
  });

  test('searchText returns empty for nonsense pattern', () => {
    const results = Bible.searchText('kjv', /xyzzy123qqq/);
    assert.strictEqual(results.length, 0);
  });

  test('searchText strips Strong\'s tags before matching', () => {
    // "H7225" should not match in plain text search
    const results = Bible.searchText('kjv', /H7225/);
    assert.strictEqual(results.length, 0, 'Should not match Strong\'s numbers in text search');
  });

  test('searchAllTranslations searches only searchable translations', () => {
    const results = Bible.searchAllTranslations(/\bIn the beginning\b/i);
    assert.ok(results.kjv, 'Should have KJV results');
    assert.ok(!results.wlc, 'Should not search WLC');
    assert.ok(!results.greek_nt, 'Should not search Greek NT');
  });

  test('searchText works on YLT (plain text)', () => {
    const results = Bible.searchText('ylt', /\bpreparing\b/i);
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.ref === 'Genesis 1:1'));
  });

  // ── Strong's tag handling ──

  console.log('\n=== Strong\'s Tag Tests ===\n');

  test('KJV verse text has no Strong\'s tags', () => {
    const v = Bible.getVerse('kjv', 'Genesis', 1, 1);
    assert.ok(!v.text.match(/\{[HG]\d+\}/), 'text should be clean');
  });

  test('KJV strongsText has Strong\'s tags', () => {
    const v = Bible.getVerse('kjv', 'Genesis', 1, 1);
    assert.ok(v.strongsText.match(/\{H\d+\}/), 'strongsText should have H tags');
  });

  test('KJV NT verse has Greek Strong\'s in strongsText', () => {
    const v = Bible.getVerse('kjv', 'John', 1, 1);
    assert.ok(v.strongsText.match(/\{G\d+\}/), 'NT strongsText should have G tags');
  });

  test('AKJV strongsText has tags', () => {
    const v = Bible.getVerse('akjv', 'Genesis', 1, 1);
    assert.ok(v.strongsText.match(/\{H\d+\}/));
  });

  test('_stripStrongsTags removes all tag forms', () => {
    const input = 'beginning{H7225} God{H430} created{H1254}{(H8804)}';
    const result = Bible._stripStrongsTags(input);
    assert.strictEqual(result, 'beginning God created');
  });

  // ── Ref comparison tests ──

  console.log('\n=== Ref Comparison Tests ===\n');

  test('compareRefs sorts Genesis before Exodus', () => {
    assert.ok(Bible.compareRefs('Genesis 1:1', 'Exodus 1:1') < 0);
  });

  test('compareRefs sorts by chapter then verse', () => {
    assert.ok(Bible.compareRefs('Genesis 1:1', 'Genesis 1:2') < 0);
    assert.ok(Bible.compareRefs('Genesis 1:31', 'Genesis 2:1') < 0);
  });

  test('compareRefs returns 0 for same ref', () => {
    assert.strictEqual(Bible.compareRefs('Genesis 1:1', 'Genesis 1:1'), 0);
  });

  test('compareRefs sorts Revelation after Genesis', () => {
    assert.ok(Bible.compareRefs('Genesis 1:1', 'Revelation 22:21') < 0);
  });

  // ── Fetch-based loading test ──

  console.log('\n=== Fetch-based Loading Test ===\n');

  // Reset KJV to test fetch path
  delete Bible._blobs['kjv'];
  delete Bible._indexes['kjv'];

  await testAsync('loadTranslation via fetch works', async () => {
    const ok = await Bible.loadTranslation('kjv');
    assert.strictEqual(ok, true);
    assert.strictEqual(Bible.isLoaded('kjv'), true);
    const v = Bible.getVerse('kjv', 'Genesis', 1, 1);
    assert.ok(v.text.includes('In the beginning'));
  });

  await testAsync('loadTranslation returns false for unknown', async () => {
    const ok = await Bible.loadTranslation('nonexistent');
    assert.strictEqual(ok, false);
  });

  // ── Book Name & Abbreviation Tests ──

  console.log('\n=== Book Constants Tests ===\n');

  test('BOOK_ORDER has 66 books', () => {
    assert.strictEqual(BOOK_ORDER.length, 66);
    assert.strictEqual(BOOK_ORDER[0], 'Genesis');
    assert.strictEqual(BOOK_ORDER[38], 'Malachi');
    assert.strictEqual(BOOK_ORDER[39], 'Matthew');
    assert.strictEqual(BOOK_ORDER[65], 'Revelation');
  });

  test('BOOK_NUM_TO_NAME maps 1-66 completely', () => {
    assert.strictEqual(BOOK_NUM_TO_NAME[1], 'Genesis');
    assert.strictEqual(BOOK_NUM_TO_NAME[19], 'Psalms');
    assert.strictEqual(BOOK_NUM_TO_NAME[39], 'Malachi');
    assert.strictEqual(BOOK_NUM_TO_NAME[40], 'Matthew');
    assert.strictEqual(BOOK_NUM_TO_NAME[66], 'Revelation');
    assert.strictEqual(Object.keys(BOOK_NUM_TO_NAME).length, 66);
  });

  test('BOOK_NAME_TO_NUM reverse maps all 66', () => {
    assert.strictEqual(BOOK_NAME_TO_NUM['Genesis'], 1);
    assert.strictEqual(BOOK_NAME_TO_NUM['Psalms'], 19);
    assert.strictEqual(BOOK_NAME_TO_NUM['Revelation'], 66);
    assert.strictEqual(Object.keys(BOOK_NAME_TO_NUM).length, 66);
  });

  test('BOOK_NUM_TO_NAME and BOOK_NAME_TO_NUM are inverses', () => {
    for (let i = 1; i <= 66; i++) {
      const name = BOOK_NUM_TO_NAME[i];
      assert.ok(name, `No name for book ${i}`);
      assert.strictEqual(BOOK_NAME_TO_NUM[name], i, `Round-trip failed for ${name}`);
    }
  });

  test('BOOK_ABBREVIATIONS covers all 66 books', () => {
    assert.strictEqual(Object.keys(BOOK_ABBREVIATIONS).length, 66);
    for (const book of BOOK_ORDER) {
      assert.ok(BOOK_ABBREVIATIONS[book], `Missing abbreviation for ${book}`);
    }
  });

  // ── normalizeBookName Tests ──

  console.log('\n=== normalizeBookName Tests ===\n');

  test('normalizeBookName: full names (case insensitive)', () => {
    assert.strictEqual(normalizeBookName('genesis'), 'Genesis');
    assert.strictEqual(normalizeBookName('GENESIS'), 'Genesis');
    assert.strictEqual(normalizeBookName('Genesis'), 'Genesis');
    assert.strictEqual(normalizeBookName('1 corinthians'), '1 Corinthians');
    assert.strictEqual(normalizeBookName('3 john'), '3 John');
    assert.strictEqual(normalizeBookName('song of solomon'), 'Song of Solomon');
  });

  test('normalizeBookName: trailing period stripped', () => {
    assert.strictEqual(normalizeBookName('Gen.'), 'Genesis');
    assert.strictEqual(normalizeBookName('Rev.'), 'Revelation');
    assert.strictEqual(normalizeBookName('Exod.'), 'Exodus');
    assert.strictEqual(normalizeBookName('1 Cor.'), '1 Corinthians');
  });

  test('normalizeBookName: variant spellings', () => {
    assert.strictEqual(normalizeBookName('Psalm'), 'Psalms');
    assert.strictEqual(normalizeBookName('Revelations'), 'Revelation');
    assert.strictEqual(normalizeBookName('Song of Songs'), 'Song of Solomon');
    assert.strictEqual(normalizeBookName('Canticles'), 'Song of Solomon');
  });

  test('normalizeBookName: standard abbreviations (OT)', () => {
    const cases = {
      'Gen': 'Genesis', 'Exod': 'Exodus', 'Exo': 'Exodus', 'Ex': 'Exodus',
      'Lev': 'Leviticus', 'Num': 'Numbers', 'Deut': 'Deuteronomy', 'Dt': 'Deuteronomy',
      'Josh': 'Joshua', 'Judg': 'Judges', 'Jdg': 'Judges',
      '1 Sam': '1 Samuel', '1Sam': '1 Samuel', '1sa': '1 Samuel',
      '2 Sam': '2 Samuel', '1 Kgs': '1 Kings', '1Ki': '1 Kings',
      '2 Kgs': '2 Kings', '1 Chr': '1 Chronicles', '2 Chr': '2 Chronicles',
      'Neh': 'Nehemiah', 'Est': 'Esther',
      'Ps': 'Psalms', 'Psa': 'Psalms', 'Prov': 'Proverbs', 'Pro': 'Proverbs',
      'Eccl': 'Ecclesiastes', 'Ecc': 'Ecclesiastes',
      'Song': 'Song of Solomon', 'SoS': 'Song of Solomon',
      'Isa': 'Isaiah', 'Jer': 'Jeremiah', 'Lam': 'Lamentations',
      'Ezek': 'Ezekiel', 'Eze': 'Ezekiel', 'Dan': 'Daniel',
      'Hos': 'Hosea', 'Obad': 'Obadiah', 'Mic': 'Micah', 'Nah': 'Nahum',
      'Hab': 'Habakkuk', 'Zeph': 'Zephaniah', 'Hag': 'Haggai',
      'Zech': 'Zechariah', 'Mal': 'Malachi'
    };
    for (const [input, expected] of Object.entries(cases)) {
      assert.strictEqual(normalizeBookName(input), expected, `normalizeBookName('${input}') should be '${expected}'`);
    }
  });

  test('normalizeBookName: standard abbreviations (NT)', () => {
    const cases = {
      'Matt': 'Matthew', 'Mat': 'Matthew', 'Mt': 'Matthew',
      'Mk': 'Mark', 'Mr': 'Mark',
      'Lk': 'Luke', 'Lu': 'Luke',
      'Jn': 'John', 'Joh': 'John',
      'Ac': 'Acts', 'Rom': 'Romans', 'Ro': 'Romans',
      '1 Cor': '1 Corinthians', '1Cor': '1 Corinthians', '1Co': '1 Corinthians',
      '2 Cor': '2 Corinthians',
      'Gal': 'Galatians', 'Eph': 'Ephesians', 'Phil': 'Philippians', 'Col': 'Colossians',
      '1 Thess': '1 Thessalonians', '1Thess': '1 Thessalonians', '1Th': '1 Thessalonians',
      '2 Thess': '2 Thessalonians',
      '1 Tim': '1 Timothy', '1Tim': '1 Timothy', '1Ti': '1 Timothy',
      '2 Tim': '2 Timothy', 'Tit': 'Titus',
      'Phlm': 'Philemon', 'Phm': 'Philemon',
      'Heb': 'Hebrews', 'Jas': 'James', 'Jam': 'James',
      '1 Pet': '1 Peter', '1Pet': '1 Peter', '1Pe': '1 Peter',
      '2 Pet': '2 Peter',
      '1 Jn': '1 John', '1Jn': '1 John', '1Jo': '1 John',
      '2 Jn': '2 John', '3 Jn': '3 John',
      'Rev': 'Revelation', 'Re': 'Revelation'
    };
    for (const [input, expected] of Object.entries(cases)) {
      assert.strictEqual(normalizeBookName(input), expected, `normalizeBookName('${input}') should be '${expected}'`);
    }
  });

  test('normalizeBookName: shortest abbreviations', () => {
    assert.strictEqual(normalizeBookName('ge'), 'Genesis');
    assert.strictEqual(normalizeBookName('le'), 'Leviticus');
    assert.strictEqual(normalizeBookName('nu'), 'Numbers');
    assert.strictEqual(normalizeBookName('de'), 'Deuteronomy');
    assert.strictEqual(normalizeBookName('ru'), 'Ruth');
    assert.strictEqual(normalizeBookName('jb'), 'Job');
    assert.strictEqual(normalizeBookName('ec'), 'Ecclesiastes');
    assert.strictEqual(normalizeBookName('da'), 'Daniel');
    assert.strictEqual(normalizeBookName('am'), 'Amos');
    assert.strictEqual(normalizeBookName('ob'), 'Obadiah');
    assert.strictEqual(normalizeBookName('mi'), 'Micah');
    assert.strictEqual(normalizeBookName('na'), 'Nahum');
    assert.strictEqual(normalizeBookName('hg'), 'Haggai');
    assert.strictEqual(normalizeBookName('ro'), 'Romans');
    assert.strictEqual(normalizeBookName('ga'), 'Galatians');
  });

  test('normalizeBookName: returns input for unknown', () => {
    assert.strictEqual(normalizeBookName('FakeBook'), 'FakeBook');
    assert.strictEqual(normalizeBookName(''), '');
  });

  test('normalizeBookName: null/undefined passthrough', () => {
    assert.strictEqual(normalizeBookName(null), null);
    assert.strictEqual(normalizeBookName(undefined), undefined);
  });

  test('normalizeBookName: OSIS abbreviations', () => {
    assert.strictEqual(normalizeBookName('Gn'), 'Genesis');
    assert.strictEqual(normalizeBookName('Lv'), 'Leviticus');
    assert.strictEqual(normalizeBookName('Nm'), 'Numbers');
    assert.strictEqual(normalizeBookName('Dn'), 'Daniel');
    assert.strictEqual(normalizeBookName('Mrk'), 'Mark');
    assert.strictEqual(normalizeBookName('Rm'), 'Romans');
  });

  test('normalizeBookName: alternative forms', () => {
    assert.strictEqual(normalizeBookName('Ezr'), 'Ezra');
    assert.strictEqual(normalizeBookName('Pss'), 'Psalms');
    assert.strictEqual(normalizeBookName('Prv'), 'Proverbs');
    assert.strictEqual(normalizeBookName('Eccles'), 'Ecclesiastes');
    assert.strictEqual(normalizeBookName('Qoh'), 'Ecclesiastes');
    assert.strictEqual(normalizeBookName('Qoheleth'), 'Ecclesiastes');
    assert.strictEqual(normalizeBookName('Cant'), 'Song of Solomon');
    assert.strictEqual(normalizeBookName('SS'), 'Song of Solomon');
    assert.strictEqual(normalizeBookName('Act'), 'Acts');
    assert.strictEqual(normalizeBookName('Philem'), 'Philemon');
    assert.strictEqual(normalizeBookName('Jms'), 'James');
    assert.strictEqual(normalizeBookName('Jud'), 'Jude');
    assert.strictEqual(normalizeBookName('Jd'), 'Jude');
    assert.strictEqual(normalizeBookName('Apoc'), 'Revelation');
    assert.strictEqual(normalizeBookName('Apocalypse'), 'Revelation');
    assert.strictEqual(normalizeBookName('Pp'), 'Philippians');
  });

  test('normalizeBookName: spacing variants', () => {
    assert.strictEqual(normalizeBookName('1 Sa'), '1 Samuel');
    assert.strictEqual(normalizeBookName('2 Sa'), '2 Samuel');
    assert.strictEqual(normalizeBookName('1 Ki'), '1 Kings');
    assert.strictEqual(normalizeBookName('2 Ki'), '2 Kings');
    assert.strictEqual(normalizeBookName('1 Ch'), '1 Chronicles');
    assert.strictEqual(normalizeBookName('2 Ch'), '2 Chronicles');
  });

  test('normalizeBookName: Roman numeral prefix (I/II/III)', () => {
    // Roman numerals are normalized to 1/2/3 before lookup
    assert.strictEqual(normalizeBookName('I Samuel'), '1 Samuel');
    assert.strictEqual(normalizeBookName('II Samuel'), '2 Samuel');
    assert.strictEqual(normalizeBookName('I Kings'), '1 Kings');
    assert.strictEqual(normalizeBookName('II Kings'), '2 Kings');
    assert.strictEqual(normalizeBookName('I Chronicles'), '1 Chronicles');
    assert.strictEqual(normalizeBookName('II Chronicles'), '2 Chronicles');
    assert.strictEqual(normalizeBookName('I Corinthians'), '1 Corinthians');
    assert.strictEqual(normalizeBookName('II Corinthians'), '2 Corinthians');
    assert.strictEqual(normalizeBookName('I Thessalonians'), '1 Thessalonians');
    assert.strictEqual(normalizeBookName('II Thessalonians'), '2 Thessalonians');
    assert.strictEqual(normalizeBookName('I Timothy'), '1 Timothy');
    assert.strictEqual(normalizeBookName('II Timothy'), '2 Timothy');
    assert.strictEqual(normalizeBookName('I Peter'), '1 Peter');
    assert.strictEqual(normalizeBookName('II Peter'), '2 Peter');
    assert.strictEqual(normalizeBookName('I John'), '1 John');
    assert.strictEqual(normalizeBookName('II John'), '2 John');
    assert.strictEqual(normalizeBookName('III John'), '3 John');
  });

  test('normalizeBookName: Roman numeral abbreviations', () => {
    assert.strictEqual(normalizeBookName('I Sam'), '1 Samuel');
    assert.strictEqual(normalizeBookName('II Sam'), '2 Samuel');
    assert.strictEqual(normalizeBookName('I Kgs'), '1 Kings');
    assert.strictEqual(normalizeBookName('II Kgs'), '2 Kings');
    assert.strictEqual(normalizeBookName('I Chr'), '1 Chronicles');
    assert.strictEqual(normalizeBookName('II Chr'), '2 Chronicles');
    assert.strictEqual(normalizeBookName('I Cor'), '1 Corinthians');
    assert.strictEqual(normalizeBookName('II Cor'), '2 Corinthians');
    assert.strictEqual(normalizeBookName('I Thess'), '1 Thessalonians');
    assert.strictEqual(normalizeBookName('II Thess'), '2 Thessalonians');
    assert.strictEqual(normalizeBookName('I Tim'), '1 Timothy');
    assert.strictEqual(normalizeBookName('II Tim'), '2 Timothy');
    assert.strictEqual(normalizeBookName('I Pet'), '1 Peter');
    assert.strictEqual(normalizeBookName('II Pet'), '2 Peter');
    assert.strictEqual(normalizeBookName('I Jn'), '1 John');
    assert.strictEqual(normalizeBookName('II Jn'), '2 John');
    assert.strictEqual(normalizeBookName('III Jn'), '3 John');
  });

  test('normalizeBookName: Roman numeral case insensitive', () => {
    assert.strictEqual(normalizeBookName('i sam'), '1 Samuel');
    assert.strictEqual(normalizeBookName('ii kings'), '2 Kings');
    assert.strictEqual(normalizeBookName('iii john'), '3 John');
    assert.strictEqual(normalizeBookName('I COR'), '1 Corinthians');
  });

  test('normalizeBookName: Ruth/Mark/Jude short forms', () => {
    assert.strictEqual(normalizeBookName('Rth'), 'Ruth');
    assert.strictEqual(normalizeBookName('Rut'), 'Ruth');
    assert.strictEqual(normalizeBookName('Jsh'), 'Joshua');
    assert.strictEqual(normalizeBookName('Jdgs'), 'Judges');
  });

  // ── abbreviateBookName Tests ──

  console.log('\n=== abbreviateBookName Tests ===\n');

  test('abbreviateBookName: all 66 books', () => {
    const expected = {
      'Genesis': 'Gen', 'Exodus': 'Exod', 'Leviticus': 'Lev', 'Psalms': 'Ps',
      'Isaiah': 'Isa', 'Matthew': 'Matt', 'Mark': 'Mark', 'John': 'John',
      'Romans': 'Rom', '1 Corinthians': '1 Cor', 'Revelation': 'Rev',
      'Song of Solomon': 'Song', 'Philemon': 'Phlm', '1 John': '1 Jn',
      '1 Thessalonians': '1 Thess', 'Hebrews': 'Heb', 'James': 'Jas'
    };
    for (const [full, abbrev] of Object.entries(expected)) {
      assert.strictEqual(abbreviateBookName(full), abbrev, `abbreviateBookName('${full}') should be '${abbrev}'`);
    }
  });

  test('abbreviateBookName: returns input for unknown', () => {
    assert.strictEqual(abbreviateBookName('FakeBook'), 'FakeBook');
  });

  // ── Round-trip: normalize → abbreviate and abbreviate → normalize ──

  console.log('\n=== Round-trip Conversion Tests ===\n');

  test('Round-trip: abbreviate(canonical) then normalize back', () => {
    for (const book of BOOK_ORDER) {
      const abbrev = abbreviateBookName(book);
      const restored = normalizeBookName(abbrev);
      assert.strictEqual(restored, book, `Round-trip failed: '${book}' → '${abbrev}' → '${restored}'`);
    }
  });

  test('Round-trip: normalize(abbrev) then abbreviate back', () => {
    // Every abbreviation in the map should normalize then abbreviate consistently
    const testAbbrevs = ['Gen', 'Ex', 'Ps', 'Isa', 'Matt', 'Mk', 'Jn', 'Rom', '1 Cor', 'Rev', 'Heb', 'Jas', '1 Jn'];
    for (const abbrev of testAbbrevs) {
      const full = normalizeBookName(abbrev);
      const reAbbrev = abbreviateBookName(full);
      // reAbbrev should be a valid abbreviation (may differ from input, e.g. 'Ex' → 'Exodus' → 'Exod')
      const reFull = normalizeBookName(reAbbrev);
      assert.strictEqual(reFull, full, `normalize(abbreviate(normalize('${abbrev}'))) failed: got '${reFull}' expected '${full}'`);
    }
  });

  // ── abbreviateRef Tests ──

  console.log('\n=== abbreviateRef Tests ===\n');

  test('abbreviateRef: full references', () => {
    assert.strictEqual(abbreviateRef('Genesis 1:1'), 'Gen 1:1');
    assert.strictEqual(abbreviateRef('Revelation 22:21'), 'Rev 22:21');
    assert.strictEqual(abbreviateRef('1 Corinthians 13:4'), '1 Cor 13:4');
    assert.strictEqual(abbreviateRef('Song of Solomon 2:1'), 'Song 2:1');
    assert.strictEqual(abbreviateRef('Psalms 119:105'), 'Ps 119:105');
  });

  test('abbreviateRef: chapter-only ref', () => {
    assert.strictEqual(abbreviateRef('Genesis 1'), 'Gen 1');
  });

  test('abbreviateRef: null/empty passthrough', () => {
    assert.strictEqual(abbreviateRef(''), '');
    assert.strictEqual(abbreviateRef(null), null);
  });

  // ── parseRef Tests ──

  console.log('\n=== parseRef Tests ===\n');

  test('parseRef: full reference', () => {
    const r = parseRef('Genesis 1:1');
    assert.deepStrictEqual(r, { book: 'Genesis', chapter: 1, verse: 1, endVerse: null });
  });

  test('parseRef: with abbreviation', () => {
    const r = parseRef('Gen 1:1');
    assert.deepStrictEqual(r, { book: 'Genesis', chapter: 1, verse: 1, endVerse: null });
  });

  test('parseRef: chapter only', () => {
    const r = parseRef('Genesis 1');
    assert.deepStrictEqual(r, { book: 'Genesis', chapter: 1, verse: null, endVerse: null });
  });

  test('parseRef: verse range', () => {
    const r = parseRef('Genesis 1:1-3');
    assert.deepStrictEqual(r, { book: 'Genesis', chapter: 1, verse: 1, endVerse: 3 });
  });

  test('parseRef: en-dash range', () => {
    const r = parseRef('Genesis 1:1\u20133');
    assert.deepStrictEqual(r, { book: 'Genesis', chapter: 1, verse: 1, endVerse: 3 });
  });

  test('parseRef: numbered book', () => {
    const r = parseRef('1 Cor 13:4');
    assert.deepStrictEqual(r, { book: '1 Corinthians', chapter: 13, verse: 4, endVerse: null });
  });

  test('parseRef: null for invalid', () => {
    assert.strictEqual(parseRef(''), null);
    assert.strictEqual(parseRef(null), null);
    assert.strictEqual(parseRef('not a reference'), null);
  });

  // ── buildRef Tests ──

  console.log('\n=== buildRef Tests ===\n');

  test('buildRef: book+chapter+verse', () => {
    assert.strictEqual(buildRef('Genesis', 1, 1), 'Genesis 1:1');
  });

  test('buildRef: chapter only', () => {
    assert.strictEqual(buildRef('Genesis', 1), 'Genesis 1');
  });

  test('buildRef: verse range', () => {
    assert.strictEqual(buildRef('Genesis', 1, 1, 3), 'Genesis 1:1-3');
  });

  test('buildRef: same start and end verse = no range', () => {
    assert.strictEqual(buildRef('Genesis', 1, 5, 5), 'Genesis 1:5');
  });

  test('parseRef and buildRef round-trip', () => {
    const refs = ['Genesis 1:1', 'Psalms 119:105', 'Revelation 22:21', '1 Corinthians 13:4'];
    for (const ref of refs) {
      const parsed = parseRef(ref);
      const rebuilt = buildRef(parsed.book, parsed.chapter, parsed.verse, parsed.endVerse);
      assert.strictEqual(rebuilt, ref, `Round-trip failed for '${ref}': got '${rebuilt}'`);
    }
  });

  // ── Robust Citation Parser Tests ──

  console.log('\n=== Robust Citation Parser Tests ===\n');

  test('citation: single verse with full name', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1:1');
    assert.strictEqual(verses.length, 1);
    assert.strictEqual(verses[0].ref, 'Genesis 1:1');
  });

  test('citation: single verse with abbreviation', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Gen 1:1');
    assert.strictEqual(verses.length, 1);
    assert.strictEqual(verses[0].ref, 'Genesis 1:1');
  });

  test('citation: verse range (hyphen)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1:1-3');
    assert.strictEqual(verses.length, 3);
    assert.strictEqual(verses[0].verse, 1);
    assert.strictEqual(verses[2].verse, 3);
  });

  test('citation: verse range (en-dash)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1:1\u20133');
    assert.strictEqual(verses.length, 3);
  });

  test('citation: verse range (em-dash)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1:1\u20143');
    assert.strictEqual(verses.length, 3);
  });

  test('citation: comma-separated verses', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1:4,14');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 2);
    assert.strictEqual(nonSep[0].verse, 4);
    assert.strictEqual(nonSep[1].verse, 14);
  });

  test('citation: mixed range+comma (Gen 1:4-5,14)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1:4-5,14');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 3);
    assert.strictEqual(nonSep[0].verse, 4);
    assert.strictEqual(nonSep[1].verse, 5);
    assert.strictEqual(nonSep[2].verse, 14);
  });

  test('citation: cross-chapter range (Gen 1:1-2:3)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1:1-2:3');
    assert.ok(verses.length >= 34, `Expected 31+3 verses, got ${verses.length}`);
    assert.strictEqual(verses[0].ref, 'Genesis 1:1');
    assert.strictEqual(verses[verses.length - 1].ref, 'Genesis 2:3');
  });

  test('citation: chapter range (Rev 17-18)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Revelation 17-18');
    assert.ok(verses.length > 30, `Expected ~42 verses, got ${verses.length}`);
  });

  test('citation: whole chapter (Genesis 1)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1');
    assert.strictEqual(verses.length, 31);
  });

  test('citation: semicolon-separated (Gen 1:1; John 3:16)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1:1; John 3:16');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 2);
    assert.strictEqual(nonSep[0].ref, 'Genesis 1:1');
    assert.strictEqual(nonSep[1].ref, 'John 3:16');
  });

  test('citation: plus-separated (Gen 1:1 + Rev 22:21)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 1:1 + Revelation 22:21');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 2);
    assert.strictEqual(nonSep[0].ref, 'Genesis 1:1');
    assert.strictEqual(nonSep[1].ref, 'Revelation 22:21');
  });

  test('citation: abbreviated multi (Gen 1:1; Jn 3:16; Rev 22:21)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Gen 1:1; Jn 3:16; Rev 22:21');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 3);
    assert.strictEqual(nonSep[0].ref, 'Genesis 1:1');
    assert.strictEqual(nonSep[1].ref, 'John 3:16');
    assert.strictEqual(nonSep[2].ref, 'Revelation 22:21');
  });

  test('citation: complex (Gen 21:1-34 + Num 29:1-6)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Genesis 21:1-34 + Numbers 29:1-6');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 34 + 6);
    assert.strictEqual(nonSep[0].ref, 'Genesis 21:1');
    assert.strictEqual(nonSep[33].ref, 'Genesis 21:34');
    assert.strictEqual(nonSep[34].ref, 'Numbers 29:1');
    assert.strictEqual(nonSep[39].ref, 'Numbers 29:6');
  });

  test('citation: empty string returns empty', () => {
    assert.strictEqual(Bible.getVersesForCitation('kjv', '').length, 0);
  });

  test('citation: invalid returns empty', () => {
    assert.strictEqual(Bible.getVersesForCitation('kjv', 'not a citation').length, 0);
  });

  test('isMultiVerseCitation: true for semicolon', () => {
    assert.strictEqual(Bible.isMultiVerseCitation('Gen 1:1; John 3:16'), true);
  });

  test('isMultiVerseCitation: true for plus', () => {
    assert.strictEqual(Bible.isMultiVerseCitation('Gen 1:1 + Rev 22:21'), true);
  });

  test('isMultiVerseCitation: true for comma-separated verses', () => {
    assert.strictEqual(Bible.isMultiVerseCitation('Gen 1:4,14'), true);
  });

  test('isMultiVerseCitation: false for single verse', () => {
    assert.strictEqual(Bible.isMultiVerseCitation('Gen 1:1'), false);
  });

  test('isMultiVerseCitation: false for single range', () => {
    assert.strictEqual(Bible.isMultiVerseCitation('Gen 1:1-3'), false);
  });

  test('isMultiVerseCitation: false for whole chapter', () => {
    assert.strictEqual(Bible.isMultiVerseCitation('Genesis 1'), false);
  });

  test('isMultiVerseCitation: false for empty/null', () => {
    assert.strictEqual(Bible.isMultiVerseCitation(''), false);
    assert.strictEqual(Bible.isMultiVerseCitation(null), false);
  });

  // ── normalizeCitation Tests ──

  console.log('\n=== normalizeCitation Tests ===\n');

  test('normalizeCitation: single verse', () => {
    assert.strictEqual(normalizeCitation('Gen 1:1'), 'Genesis 1:1');
  });

  test('normalizeCitation: range', () => {
    assert.strictEqual(normalizeCitation('Gen 1:1-3'), 'Genesis 1:1-3');
  });

  test('normalizeCitation: semicolon-separated', () => {
    assert.strictEqual(normalizeCitation('Gen 1:1; Jn 3:16'), 'Genesis 1:1; John 3:16');
  });

  test('normalizeCitation: plus-separated', () => {
    assert.strictEqual(normalizeCitation('Gen 1:1 + Rev 22:21'), 'Genesis 1:1; Revelation 22:21');
  });

  test('normalizeCitation: trailing period', () => {
    assert.strictEqual(normalizeCitation('Gen. 1:1; Rev. 22:21'), 'Genesis 1:1; Revelation 22:21');
  });

  test('normalizeCitation: Roman numerals', () => {
    assert.strictEqual(normalizeCitation('I Cor 13:4-7 + II Tim 3:16'), '1 Corinthians 13:4-7; 2 Timothy 3:16');
  });

  test('normalizeCitation: OSIS abbreviations', () => {
    assert.strictEqual(normalizeCitation('Gn 1:1; Lv 23:1-3; Dt 5:12'), 'Genesis 1:1; Leviticus 23:1-3; Deuteronomy 5:12');
  });

  test('normalizeCitation: alternative names', () => {
    assert.strictEqual(normalizeCitation('Apoc 21:1; Cant 2:1; Qoh 3:1'), 'Revelation 21:1; Song of Solomon 2:1; Ecclesiastes 3:1');
  });

  test('normalizeCitation: whole chapter', () => {
    assert.strictEqual(normalizeCitation('Gen 1'), 'Genesis 1');
  });

  test('normalizeCitation: chapter range', () => {
    assert.strictEqual(normalizeCitation('Rev 17-18'), 'Revelation 17-18');
  });

  test('normalizeCitation: comma-separated verses', () => {
    assert.strictEqual(normalizeCitation('Gen 1:4,14'), 'Genesis 1:4,14');
  });

  test('normalizeCitation: en-dash normalized to hyphen', () => {
    assert.strictEqual(normalizeCitation('Gen 1:1\u20133'), 'Genesis 1:1-3');
  });

  test('normalizeCitation: empty returns empty', () => {
    assert.strictEqual(normalizeCitation(''), '');
    assert.strictEqual(normalizeCitation(null), '');
  });

  test('normalizeCitation: complex real-world string', () => {
    const input = 'Gen. 1:1-3; I Cor 13:4-7 + Apoc 21:1-4; Ps 23:1';
    const expected = 'Genesis 1:1-3; 1 Corinthians 13:4-7; Revelation 21:1-4; Psalms 23:1';
    assert.strictEqual(normalizeCitation(input), expected);
  });

  // ── URL Segment Encoding Tests ──

  console.log('\n=== citationToUrlSegments Tests ===\n');

  test('citationToUrlSegments: single verse', () => {
    assert.deepStrictEqual(citationToUrlSegments('Genesis 1:1'), ['Genesis.1.1']);
  });

  test('citationToUrlSegments: verse range', () => {
    assert.deepStrictEqual(citationToUrlSegments('Genesis 1:1-3'), ['Genesis.1.1-3']);
  });

  test('citationToUrlSegments: comma-separated verses', () => {
    assert.deepStrictEqual(citationToUrlSegments('Genesis 1:4,14'), ['Genesis.1.4.14']);
  });

  test('citationToUrlSegments: multiple citations', () => {
    assert.deepStrictEqual(
      citationToUrlSegments('Genesis 1:1; John 3:16'),
      ['Genesis.1.1', 'John.3.16']
    );
  });

  test('citationToUrlSegments: book with spaces → hyphens', () => {
    assert.deepStrictEqual(
      citationToUrlSegments('Song of Solomon 2:1'),
      ['Song-of-Solomon.2.1']
    );
  });

  test('citationToUrlSegments: numbered book', () => {
    assert.deepStrictEqual(
      citationToUrlSegments('1 Corinthians 13:4-7'),
      ['1-Corinthians.13.4-7']
    );
  });

  test('citationToUrlSegments: normalizes abbreviations before encoding', () => {
    assert.deepStrictEqual(
      citationToUrlSegments('Gen 1:1; Jn 3:16; Rev 22:21'),
      ['Genesis.1.1', 'John.3.16', 'Revelation.22.21']
    );
  });

  test('citationToUrlSegments: Roman numerals normalized', () => {
    assert.deepStrictEqual(
      citationToUrlSegments('I Cor 13:4; III Jn 1:4'),
      ['1-Corinthians.13.4', '3-John.1.4']
    );
  });

  test('citationToUrlSegments: whole chapter', () => {
    assert.deepStrictEqual(citationToUrlSegments('Genesis 1'), ['Genesis.1']);
  });

  test('citationToUrlSegments: chapter range', () => {
    assert.deepStrictEqual(citationToUrlSegments('Rev 17-18'), ['Revelation.17-18']);
  });

  test('citationToUrlSegments: empty returns empty', () => {
    assert.deepStrictEqual(citationToUrlSegments(''), []);
    assert.deepStrictEqual(citationToUrlSegments(null), []);
  });

  console.log('\n=== urlSegmentsToCitation Tests ===\n');

  test('urlSegmentsToCitation: single verse', () => {
    assert.strictEqual(urlSegmentsToCitation(['Genesis.1.1']), 'Genesis 1:1');
  });

  test('urlSegmentsToCitation: verse range', () => {
    assert.strictEqual(urlSegmentsToCitation(['Genesis.1.1-3']), 'Genesis 1:1-3');
  });

  test('urlSegmentsToCitation: comma-separated (dots → commas)', () => {
    assert.strictEqual(urlSegmentsToCitation(['Genesis.1.4.14']), 'Genesis 1:4,14');
  });

  test('urlSegmentsToCitation: multiple segments', () => {
    assert.strictEqual(
      urlSegmentsToCitation(['Genesis.1.1', 'John.3.16']),
      'Genesis 1:1; John 3:16'
    );
  });

  test('urlSegmentsToCitation: hyphens in book → spaces, normalized', () => {
    assert.strictEqual(
      urlSegmentsToCitation(['Song-of-Solomon.2.1']),
      'Song of Solomon 2:1'
    );
  });

  test('urlSegmentsToCitation: numbered book', () => {
    assert.strictEqual(
      urlSegmentsToCitation(['1-Corinthians.13.4-7']),
      '1 Corinthians 13:4-7'
    );
  });

  test('urlSegmentsToCitation: normalizes abbreviated book names from URL', () => {
    // If someone manually types /Dan.9.23 in the URL
    assert.strictEqual(urlSegmentsToCitation(['Dan.9.23']), 'Daniel 9:23');
  });

  test('urlSegmentsToCitation: whole chapter', () => {
    assert.strictEqual(urlSegmentsToCitation(['Genesis.1']), 'Genesis 1');
  });

  test('urlSegmentsToCitation: empty returns empty', () => {
    assert.strictEqual(urlSegmentsToCitation([]), '');
    assert.strictEqual(urlSegmentsToCitation(null), '');
  });

  // ── Round-trip: citation → URL → citation ──

  console.log('\n=== URL Encoding Round-trip Tests ===\n');

  test('round-trip: single verse', () => {
    const citation = 'Genesis 1:1';
    const segments = citationToUrlSegments(citation);
    const restored = urlSegmentsToCitation(segments);
    assert.strictEqual(restored, citation);
  });

  test('round-trip: multiple verses with ranges', () => {
    const citation = 'Genesis 1:1-3; John 3:16-18; Revelation 22:21';
    const segments = citationToUrlSegments(citation);
    const restored = urlSegmentsToCitation(segments);
    assert.strictEqual(restored, citation);
  });

  test('round-trip: numbered books', () => {
    const citation = '1 Corinthians 13:4-7; 2 Timothy 3:16';
    const segments = citationToUrlSegments(citation);
    const restored = urlSegmentsToCitation(segments);
    assert.strictEqual(restored, citation);
  });

  test('round-trip: Song of Solomon (multi-word book)', () => {
    const citation = 'Song of Solomon 2:1';
    const segments = citationToUrlSegments(citation);
    const restored = urlSegmentsToCitation(segments);
    assert.strictEqual(restored, citation);
  });

  test('round-trip: abbreviations normalized first', () => {
    const input = 'Gen 1:1; Jn 3:16; Rev 22:21';
    const segments = citationToUrlSegments(input);
    const restored = urlSegmentsToCitation(segments);
    assert.strictEqual(restored, 'Genesis 1:1; John 3:16; Revelation 22:21');
  });

  test('round-trip: Roman numerals normalized first', () => {
    const input = 'I Cor 13:4; III Jn 1:4';
    const segments = citationToUrlSegments(input);
    const restored = urlSegmentsToCitation(segments);
    assert.strictEqual(restored, '1 Corinthians 13:4; 3 John 1:4');
  });

  // ── Multiverse String Resolution Tests (mixed abbreviations) ──

  console.log('\n=== Multiverse Mixed Abbreviation Tests ===\n');

  test('multiverse: abbreviated + Roman + trailing period', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Gen. 1:1; I Cor 13:4; Rev. 22:21');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 3);
    assert.strictEqual(nonSep[0].ref, 'Genesis 1:1');
    assert.strictEqual(nonSep[1].ref, '1 Corinthians 13:4');
    assert.strictEqual(nonSep[2].ref, 'Revelation 22:21');
  });

  test('multiverse: OSIS + ranges + plus-separated', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Gn 1:1-3 + Lv 23:1-3 + Dt 5:12-15');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 3 + 3 + 4);
    assert.strictEqual(nonSep[0].ref, 'Genesis 1:1');
    assert.strictEqual(nonSep[3].ref, 'Leviticus 23:1');
    assert.strictEqual(nonSep[6].ref, 'Deuteronomy 5:12');
  });

  test('multiverse: Roman numerals across all numbered books', () => {
    const verses = Bible.getVersesForCitation('kjv', 'I Sam 1:1; II Kgs 2:11; I Chr 1:1; II Pet 1:1; III Jn 1:4');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 5);
    assert.strictEqual(nonSep[0].ref, '1 Samuel 1:1');
    assert.strictEqual(nonSep[1].ref, '2 Kings 2:11');
    assert.strictEqual(nonSep[2].ref, '1 Chronicles 1:1');
    assert.strictEqual(nonSep[3].ref, '2 Peter 1:1');
    assert.strictEqual(nonSep[4].ref, '3 John 1:4');
  });

  test('multiverse: alternative names (Apoc, Cant, Qoh)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Apoc 21:1; Cant 2:1; Qoh 3:1');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 3);
    assert.strictEqual(nonSep[0].ref, 'Revelation 21:1');
    assert.strictEqual(nonSep[1].ref, 'Song of Solomon 2:1');
    assert.strictEqual(nonSep[2].ref, 'Ecclesiastes 3:1');
  });

  test('multiverse: mixed range+comma with abbreviations', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Gen. 1:1-3, 14; Ex 20:8-11');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 8); // 3+1+4
    assert.strictEqual(nonSep[0].ref, 'Genesis 1:1');
    assert.strictEqual(nonSep[3].ref, 'Genesis 1:14');
    assert.strictEqual(nonSep[4].ref, 'Exodus 20:8');
  });

  test('multiverse: scholarly citation style', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Deut. 6:4; Rom. 8:28; Heb 11:1');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 3);
    assert.strictEqual(nonSep[0].ref, 'Deuteronomy 6:4');
    assert.strictEqual(nonSep[1].ref, 'Romans 8:28');
    assert.strictEqual(nonSep[2].ref, 'Hebrews 11:1');
  });

  test('multiverse: I Pet + II Pet + III John across plus separator', () => {
    const verses = Bible.getVersesForCitation('kjv', 'I Pet 2:9 + II Pet 1:20-21 + III John 1:4');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 4);
    assert.strictEqual(nonSep[0].ref, '1 Peter 2:9');
    assert.strictEqual(nonSep[1].ref, '2 Peter 1:20');
    assert.strictEqual(nonSep[2].ref, '2 Peter 1:21');
    assert.strictEqual(nonSep[3].ref, '3 John 1:4');
  });

  test('multiverse: Mk + Lk short forms', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Mk 16:15; Lk 2:7');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 2);
    assert.strictEqual(nonSep[0].ref, 'Mark 16:15');
    assert.strictEqual(nonSep[1].ref, 'Luke 2:7');
  });

  // ── Space/Tab Separated (No Delimiter) Tests ──

  console.log('\n=== Space/Tab Separated Citation Tests ===\n');

  test('space-separated: Gen 1:1 John 3:16 Rev 22:21', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Gen 1:1 John 3:16 Rev 22:21');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 3);
    assert.strictEqual(nonSep[0].ref, 'Genesis 1:1');
    assert.strictEqual(nonSep[1].ref, 'John 3:16');
    assert.strictEqual(nonSep[2].ref, 'Revelation 22:21');
  });

  test('tab-separated: Gen 1:1\\tJohn 3:16\\tRev 22:21', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Gen 1:1\tJohn 3:16\tRev 22:21');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 3);
    assert.strictEqual(nonSep[0].ref, 'Genesis 1:1');
    assert.strictEqual(nonSep[1].ref, 'John 3:16');
    assert.strictEqual(nonSep[2].ref, 'Revelation 22:21');
  });

  test('space-separated with ranges: Gen 1:1-3 John 3:16-18', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Gen 1:1-3 John 3:16-18');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 6);
    assert.strictEqual(nonSep[0].ref, 'Genesis 1:1');
    assert.strictEqual(nonSep[3].ref, 'John 3:16');
  });

  test('space-separated with Roman numerals: I Cor 13:4 II Tim 3:16 III John 1:4', () => {
    const verses = Bible.getVersesForCitation('kjv', 'I Cor 13:4 II Tim 3:16 III John 1:4');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 3);
    assert.strictEqual(nonSep[0].ref, '1 Corinthians 13:4');
    assert.strictEqual(nonSep[1].ref, '2 Timothy 3:16');
    assert.strictEqual(nonSep[2].ref, '3 John 1:4');
  });

  test('space-separated: Song of Solomon 2:1 Psalms 23:1 (multi-word book)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Song of Solomon 2:1 Psalms 23:1');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 2);
    assert.strictEqual(nonSep[0].ref, 'Song of Solomon 2:1');
    assert.strictEqual(nonSep[1].ref, 'Psalms 23:1');
  });

  test('space-separated with numbered books: 1 Cor 13:4 2 Tim 3:16', () => {
    const verses = Bible.getVersesForCitation('kjv', '1 Cor 13:4 2 Tim 3:16');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 2);
    assert.strictEqual(nonSep[0].ref, '1 Corinthians 13:4');
    assert.strictEqual(nonSep[1].ref, '2 Timothy 3:16');
  });

  test('normalizeCitation: space-separated', () => {
    assert.strictEqual(
      normalizeCitation('Gen 1:1 John 3:16 Rev 22:21'),
      'Genesis 1:1; John 3:16; Revelation 22:21'
    );
  });

  test('normalizeCitation: tab-separated', () => {
    assert.strictEqual(
      normalizeCitation('Gen 1:1\tJohn 3:16'),
      'Genesis 1:1; John 3:16'
    );
  });

  test('normalizeCitation: space-separated with Roman numerals', () => {
    assert.strictEqual(
      normalizeCitation('I Cor 13:4 II Tim 3:16 III John 1:4'),
      '1 Corinthians 13:4; 2 Timothy 3:16; 3 John 1:4'
    );
  });

  test('space-separated: chapter-range then verse ref (Rev 17-18 Gen 1:1)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Rev 17-18 Gen 1:1');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.ok(nonSep.length > 30, `Expected Rev 17-18 + Gen 1:1, got ${nonSep.length}`);
    assert.strictEqual(nonSep[nonSep.length - 1].ref, 'Genesis 1:1');
  });

  test('space-separated: whole chapter then verse ref (Gen 1 John 3:16)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Gen 1 John 3:16');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep[0].ref, 'Genesis 1:1');
    assert.strictEqual(nonSep[nonSep.length - 1].ref, 'John 3:16');
  });

  test('space-separated does NOT split numbered book prefix (1 Cor 13:4)', () => {
    assert.strictEqual(normalizeCitation('1 Cor 13:4'), '1 Corinthians 13:4');
    assert.strictEqual(normalizeCitation('2 Tim 3:16'), '2 Timothy 3:16');
  });

  test('normalizeCitation: chapter-range then new book', () => {
    assert.strictEqual(
      normalizeCitation('Rev 17-18 Gen 1:1'),
      'Revelation 17-18; Genesis 1:1'
    );
  });

  test('normalizeCitation: whole chapter then new book', () => {
    assert.strictEqual(
      normalizeCitation('Gen 1 John 3:16'),
      'Genesis 1; John 3:16'
    );
  });

  test('normalizeCitation: three-way mixed spacing (verse + chapterRange + verse)', () => {
    assert.strictEqual(
      normalizeCitation('Gen 1:1 Rev 17-18 John 3:16'),
      'Genesis 1:1; Revelation 17-18; John 3:16'
    );
  });

  // ── Boundary & Edge Case Tests ──

  console.log('\n=== Boundary & Edge Case Tests ===\n');

  test('getVerse: first verse of Bible', () => {
    const v = Bible.getVerse('kjv', 'Genesis', 1, 1);
    assert.ok(v);
    assert.ok(v.text.includes('In the beginning'));
  });

  test('getVerse: last verse of Bible', () => {
    const v = Bible.getVerse('kjv', 'Revelation', 22, 21);
    assert.ok(v);
    assert.ok(v.text.includes('grace') || v.text.includes('Amen'));
  });

  test('getVerse: last verse of Genesis', () => {
    const v = Bible.getVerse('kjv', 'Genesis', 50, 26);
    assert.ok(v);
  });

  test('getChapter: Obadiah (single-chapter book) has 21 verses', () => {
    assert.strictEqual(Bible.getChapter('kjv', 'Obadiah', 1).length, 21);
  });

  test('getChapter: Jude (single-chapter book) has 25 verses', () => {
    assert.strictEqual(Bible.getChapter('kjv', 'Jude', 1).length, 25);
  });

  test('getChapter: Philemon (single-chapter book) has 25 verses', () => {
    assert.strictEqual(Bible.getChapter('kjv', 'Philemon', 1).length, 25);
  });

  test('getChapter: 3 John (short book) has 14 verses', () => {
    assert.strictEqual(Bible.getChapter('kjv', '3 John', 1).length, 14);
  });

  test('citation: cross-chapter with abbreviation (Gen 1:28-2:3)', () => {
    const verses = Bible.getVersesForCitation('kjv', 'Gen 1:28-2:3');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 7); // Gen 1:28-31 (4) + Gen 2:1-3 (3)
    assert.strictEqual(nonSep[0].ref, 'Genesis 1:28');
    assert.strictEqual(nonSep[6].ref, 'Genesis 2:3');
  });

  test('citation: extra whitespace handled', () => {
    const verses = Bible.getVersesForCitation('kjv', '   Gen 1:1  ;  Jn 3:16  ');
    const nonSep = verses.filter(v => !v.isSeparator);
    assert.strictEqual(nonSep.length, 2);
  });

  test('Strong\'s: KJV morphology codes preserved in strongsText', () => {
    const v = Bible.getVerse('kjv', 'Genesis', 1, 1);
    assert.ok(v.strongsText.includes('{(H'), 'KJV should have morphology codes like {(H8804)}');
  });

  test('Strong\'s: morphology codes stripped from text', () => {
    const v = Bible.getVerse('kjv', 'Genesis', 1, 1);
    assert.ok(!v.text.includes('{'), 'text should not contain any tags');
  });

  test('search: string pattern works (not just regex)', () => {
    const results = Bible.searchText('kjv', 'faith');
    assert.ok(results.length > 200);
  });

  test('search: LORD appears 100+ times', () => {
    const results = Bible.searchText('kjv', /\bLORD\b/);
    assert.ok(results.length > 100);
  });

  test('compareRefs: OT before NT', () => {
    assert.ok(Bible.compareRefs('Malachi 4:6', 'Matthew 1:1') < 0);
  });

  test('compareRefs: different chapters in same book', () => {
    assert.ok(Bible.compareRefs('Genesis 2:1', 'Genesis 1:31') > 0);
  });

  // ── Progressive Loading Test ──

  console.log('\n=== Progressive Loading Test ===\n');

  // Reset all blobs
  for (const id of Object.keys(Bible._blobs)) {
    delete Bible._blobs[id];
    delete Bible._indexes[id];
  }
  Bible._bookChapters = null;

  await testAsync('loadProgressive loads primary first, then others', async () => {
    const progress = [];
    const ok = await Bible.loadProgressive('kjv', (id, loaded, total) => {
      progress.push({ id, loaded, total });
    });
    assert.strictEqual(ok, true);
    assert.strictEqual(Bible.isLoaded('kjv'), true);
    // Primary should be first in progress
    assert.strictEqual(progress[0].id, 'kjv');
    assert.strictEqual(progress[0].loaded, 1);

    // Wait a bit for background loads
    await new Promise(r => setTimeout(r, 500));

    // Some background translations should have loaded
    const loadedCount = Bible.getLoadedTranslations().length;
    assert.ok(loadedCount >= 2, `Expected at least 2 loaded, got ${loadedCount}`);
  });

  // ── Summary ──

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  ${f.name}: ${f.error.message}`);
    }
  }
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
