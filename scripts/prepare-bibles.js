#!/usr/bin/env node
/**
 * Prepare all Bible source files into standardized format in bibles/ folder.
 * Also generates greek_nt.txt from nt-interlinear.json.
 * Also converts wlc/verses.txt (pipe-delimited) to bibles/wlc.txt.
 *
 * Standardized format:
 *   Line 1: ID
 *   Line 2: Full Name
 *   Line 3+: BookName Chapter:Verse\tText
 *
 * For Strong's files, text contains {H####}/{G####} tags.
 *
 * Usage: node scripts/prepare-bibles.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BIBLES_DIR = path.join(ROOT, 'bibles');

const BOOK_NUM_TO_NAME = {
  1: 'Genesis', 2: 'Exodus', 3: 'Leviticus', 4: 'Numbers', 5: 'Deuteronomy',
  6: 'Joshua', 7: 'Judges', 8: 'Ruth', 9: '1 Samuel', 10: '2 Samuel',
  11: '1 Kings', 12: '2 Kings', 13: '1 Chronicles', 14: '2 Chronicles',
  15: 'Ezra', 16: 'Nehemiah', 17: 'Esther', 18: 'Job', 19: 'Psalms',
  20: 'Proverbs', 21: 'Ecclesiastes', 22: 'Song of Solomon', 23: 'Isaiah',
  24: 'Jeremiah', 25: 'Lamentations', 26: 'Ezekiel', 27: 'Daniel',
  28: 'Hosea', 29: 'Joel', 30: 'Amos', 31: 'Obadiah', 32: 'Jonah',
  33: 'Micah', 34: 'Nahum', 35: 'Habakkuk', 36: 'Zephaniah', 37: 'Haggai',
  38: 'Zechariah', 39: 'Malachi',
  40: 'Matthew', 41: 'Mark', 42: 'Luke', 43: 'John', 44: 'Acts',
  45: 'Romans', 46: '1 Corinthians', 47: '2 Corinthians', 48: 'Galatians',
  49: 'Ephesians', 50: 'Philippians', 51: 'Colossians',
  52: '1 Thessalonians', 53: '2 Thessalonians', 54: '1 Timothy', 55: '2 Timothy',
  56: 'Titus', 57: 'Philemon', 58: 'Hebrews', 59: 'James',
  60: '1 Peter', 61: '2 Peter', 62: '1 John', 63: '2 John', 64: '3 John',
  65: 'Jude', 66: 'Revelation'
};

// Normalize "Psalm" -> "Psalms", etc.
function normalizeBookName(book) {
  const map = {
    'psalm': 'Psalms',
    'song of songs': 'Song of Solomon',
    'canticles': 'Song of Solomon',
  };
  const lower = book.toLowerCase().trim();
  return map[lower] || book.trim();
}

/**
 * Copy a tab-separated file (ID\nFullName\nRef\tText lines) to bibles/
 */
function copyTabFile(srcRelative, destName) {
  const src = path.join(ROOT, srcRelative);
  const dest = path.join(BIBLES_DIR, destName);
  if (!fs.existsSync(src)) {
    console.warn(`  SKIP (not found): ${srcRelative}`);
    return 0;
  }
  const content = fs.readFileSync(src, 'utf8');
  const lines = content.split(/\r?\n/);

  // These files have: Line1=ID, Line2=FullName, Line3+=Ref\tText
  // Verify format
  let verseCount = 0;
  for (let i = 2; i < lines.length; i++) {
    if (lines[i].includes('\t')) verseCount++;
  }

  fs.copyFileSync(src, dest);
  console.log(`  ${destName}: ${verseCount} verses (copied from ${srcRelative})`);
  return verseCount;
}

/**
 * Convert a Strong's-tagged space-separated file to tab-separated format.
 * Input: "BookName Ch:V text{H####}..." (space after ref)
 * Output: "BookName Ch:V\ttext{H####}..."
 */
function convertStrongsFile(srcRelative, destName, id, fullName) {
  const src = path.join(ROOT, srcRelative);
  const dest = path.join(BIBLES_DIR, destName);
  if (!fs.existsSync(src)) {
    console.warn(`  SKIP (not found): ${srcRelative}`);
    return 0;
  }
  const content = fs.readFileSync(src, 'utf8');
  const lines = content.split(/\r?\n/);

  const output = [id, fullName];
  let verseCount = 0;

  for (const line of lines) {
    // Match: BookName Chapter:Verse rest...
    const m = line.match(/^(.+?\s+\d+:\d+)\s+(.*)$/);
    if (!m) continue;
    const ref = normalizeBookName(m[1].replace(/^(.+?)\s/, (_, book) => normalizeBookName(book) + ' '));
    // Normalize ref book name
    const refMatch = ref.match(/^(.+?)\s+(\d+:\d+)$/);
    if (!refMatch) continue;
    const normalizedRef = normalizeBookName(refMatch[1]) + ' ' + refMatch[2];
    output.push(normalizedRef + '\t' + m[2]);
    verseCount++;
  }

  fs.writeFileSync(dest, output.join('\n'), 'utf8');
  console.log(`  ${destName}: ${verseCount} verses (converted from ${srcRelative})`);
  return verseCount;
}

/**
 * Convert WLC pipe-delimited file to standard format.
 */
function convertWLC() {
  const src = path.join(ROOT, 'wlc', 'verses.txt');
  const dest = path.join(BIBLES_DIR, 'wlc.txt');
  if (!fs.existsSync(src)) {
    console.warn('  SKIP (not found): wlc/verses.txt');
    return 0;
  }
  const content = fs.readFileSync(src, 'utf8');
  const lines = content.split(/\r?\n/);

  const output = ['WLC', 'Westminster Leningrad Codex (Hebrew OT)'];
  let verseCount = 0;

  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue;
    const parts = line.split('|');
    if (parts.length < 4) continue;
    const bookNum = parseInt(parts[0]);
    const chapter = parts[1];
    const verse = parts[2];
    const text = parts[3];
    const bookName = BOOK_NUM_TO_NAME[bookNum];
    if (!bookName) continue;
    output.push(`${bookName} ${chapter}:${verse}\t${text}`);
    verseCount++;
  }

  fs.writeFileSync(dest, output.join('\n'), 'utf8');
  console.log(`  wlc.txt: ${verseCount} verses (converted from wlc/verses.txt)`);
  return verseCount;
}

/**
 * Generate Greek NT from nt-interlinear.json
 */
function generateGreekNT() {
  const src = path.join(ROOT, 'data', 'nt-interlinear.json');
  const dest = path.join(BIBLES_DIR, 'greek_nt.txt');
  if (!fs.existsSync(src)) {
    console.warn('  SKIP (not found): data/nt-interlinear.json');
    return 0;
  }
  const data = JSON.parse(fs.readFileSync(src, 'utf8'));
  const refs = Object.keys(data);

  // Sort refs in Bible order
  const bookOrder = {};
  let idx = 0;
  for (let i = 40; i <= 66; i++) {
    bookOrder[BOOK_NUM_TO_NAME[i]] = idx++;
  }

  refs.sort((a, b) => {
    const ma = a.match(/^(.+?)\s+(\d+):(\d+)$/);
    const mb = b.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (!ma || !mb) return 0;
    const bookDiff = (bookOrder[ma[1]] || 0) - (bookOrder[mb[1]] || 0);
    if (bookDiff !== 0) return bookDiff;
    const chDiff = parseInt(ma[2]) - parseInt(mb[2]);
    if (chDiff !== 0) return chDiff;
    return parseInt(ma[3]) - parseInt(mb[3]);
  });

  const output = ['GREEK_NT', 'Greek New Testament (from Interlinear)'];
  let verseCount = 0;

  for (const ref of refs) {
    const verse = data[ref];
    if (!verse || !verse.g || verse.g.length === 0) continue;
    const greekText = verse.g.map(w => w.g).join(' ');
    output.push(`${ref}\t${greekText}`);
    verseCount++;
  }

  fs.writeFileSync(dest, output.join('\n'), 'utf8');
  console.log(`  greek_nt.txt: ${verseCount} verses (generated from nt-interlinear.json)`);
  return verseCount;
}

/**
 * Convert LXX file (tab-separated with header lines)
 */
function convertLXX() {
  const src = path.join(ROOT, 'lxx.txt');
  const dest = path.join(BIBLES_DIR, 'lxx.txt');
  if (!fs.existsSync(src)) {
    console.warn('  SKIP (not found): lxx.txt');
    return 0;
  }
  const content = fs.readFileSync(src, 'utf8');
  const lines = content.split(/\r?\n/);

  const output = ['LXX', 'Septuagint (Brenton English)'];
  let verseCount = 0;

  for (const line of lines) {
    const tabIdx = line.indexOf('\t');
    if (tabIdx === -1) continue;
    const ref = line.substring(0, tabIdx).trim();
    const text = line.substring(tabIdx + 1).trim();
    if (!ref.match(/\d+:\d+$/)) continue;
    // Normalize book name
    const refMatch = ref.match(/^(.+?)\s+(\d+:\d+)$/);
    if (!refMatch) continue;
    const normalizedRef = normalizeBookName(refMatch[1]) + ' ' + refMatch[2];
    output.push(normalizedRef + '\t' + text);
    verseCount++;
  }

  fs.writeFileSync(dest, output.join('\n'), 'utf8');
  console.log(`  lxx.txt: ${verseCount} verses (converted from lxx.txt)`);
  return verseCount;
}

// Main
function main() {
  if (!fs.existsSync(BIBLES_DIR)) {
    fs.mkdirSync(BIBLES_DIR, { recursive: true });
  }

  console.log('Preparing Bible files in bibles/...\n');

  let total = 0;

  // Strong's-tagged files (space-separated → tab-separated)
  console.log('Strong\'s tagged translations:');
  total += convertStrongsFile('kjv_strongs.txt', 'kjv_strongs.txt', 'KJV', 'King James Version with Strong\'s');
  total += convertStrongsFile('http-v1/asvs.txt', 'asv_strongs.txt', 'ASV', 'American Standard Version with Strong\'s');
  total += convertStrongsFile('http/bibles/akjv_strongs.txt', 'akjv_strongs.txt', 'AKJV', 'American King James Version with Strong\'s');
  console.log();

  // Tab-separated translations (copy as-is)
  console.log('Plain text translations:');
  total += copyTabFile('http/bibles/ylt.txt', 'ylt.txt');
  total += copyTabFile('http/bibles/dbt.txt', 'dbt.txt');
  total += copyTabFile('http/bibles/drb.txt', 'drb.txt');
  total += copyTabFile('http/bibles/jps.txt', 'jps.txt');
  total += copyTabFile('http/bibles/slt.txt', 'slt.txt');
  total += copyTabFile('http/bibles/wbt.txt', 'wbt.txt');
  console.log();

  // LXX (tab-separated with different header)
  console.log('Septuagint:');
  total += convertLXX();
  console.log();

  // Original language source texts
  console.log('Source texts:');
  total += convertWLC();
  total += generateGreekNT();
  console.log();

  console.log(`Done. Total: ${total} verse entries across all files.`);
}

main();
