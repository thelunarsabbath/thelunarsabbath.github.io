#!/usr/bin/env node
/**
 * Sanity check: compare Strong's numbers verse-by-verse between two
 * standardized Strong's .txt files (e.g. kjv_strongs.txt vs akjv_strongs.txt).
 * Reports verses where the set of Strong's numbers differs.
 *
 * Format: lines 1-5 are header; line 6+ are "Book Chapter:Verse text".
 * We extract {H####} and {G####} (and {(H####)} / {(G####)} morphology in KJV)
 * and compare the sets per verse. Morphology codes are normalized to the same
 * number (e.g. {(H8804)} counts as H8804).
 *
 * Usage: node scripts/compare-strongs-txt.js <file1.txt> <file2.txt>
 *   e.g. node scripts/compare-strongs-txt.js kjv_strongs.txt http/bibles/akjv_strongs.txt
 */

const fs = require('fs');
const path = require('path');

// Lexical (word) tags only: {H####} or {G####}. Excludes morphology {(H####)} so we can compare across KJV (has morphology) vs AKJV (no morphology).
const LEXICAL_RE = /\{(?!\()([HG]\d+)\}/g;

function extractStrongs(line, lexicalOnly = true) {
  const set = new Set();
  let m;
  const re = lexicalOnly ? LEXICAL_RE : /\{\(?([HG]\d+)\)?\}/g;
  while ((m = re.exec(line)) !== null) {
    set.add(m[1].toUpperCase());
  }
  return set;
}

function parseStrongsFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const content = fs.readFileSync(abs, 'utf8');
  const lines = content.split(/\r?\n/);
  const verses = {};
  let skipped = 0;
  for (const line of lines) {
    const refMatch = line.match(/^(.+?\s+\d+:\d+)\s+(.*)$/);
    if (!refMatch) {
      skipped++;
      continue;
    }
    const [, ref, text] = refMatch;
    verses[ref] = extractStrongs(text);
  }
  return verses;
}

function main() {
  const file1 = process.argv[2];
  const file2 = process.argv[3];
  if (!file1 || !file2) {
    console.error('Usage: node compare-strongs-txt.js <file1.txt> <file2.txt>');
    process.exit(1);
  }

  const name1 = path.basename(file1);
  const name2 = path.basename(file2);

  const verses1 = parseStrongsFile(file1);
  const verses2 = parseStrongsFile(file2);

  const refs1 = new Set(Object.keys(verses1));
  const refs2 = new Set(Object.keys(verses2));
  const allRefs = new Set([...refs1, ...refs2]);
  const onlyIn1 = [...allRefs].filter(r => !refs2.has(r));
  const onlyIn2 = [...allRefs].filter(r => !refs1.has(r));

  const mismatches = [];
  const matches = [];
  for (const ref of allRefs) {
    const s1 = verses1[ref];
    const s2 = verses2[ref];
    if (!s1 || !s2) continue; // skip refs only in one file (reported separately)
    const only1 = [...s1].filter(x => !s2.has(x)).sort();
    const only2 = [...s2].filter(x => !s1.has(x)).sort();
    if (only1.length || only2.length) {
      mismatches.push({ ref, only1, only2, size1: s1.size, size2: s2.size });
    } else {
      matches.push(ref);
    }
  }

  console.log('=== Strong\'s verse-by-verse comparison ===');
  console.log(name1, 'vs', name2);
  console.log('(Comparing lexical Strong\'s only: {H####}/{G####}. Morphology {(H####)} in KJV is ignored.)');
  console.log('');
  console.log('Verses in', name1 + ':', refs1.size);
  console.log('Verses in', name2 + ':', refs2.size);
  if (onlyIn1.length) console.log('Only in', name1 + ':', onlyIn1.length, onlyIn1.slice(0, 5).join(', ') + (onlyIn1.length > 5 ? '...' : ''));
  if (onlyIn2.length) console.log('Only in', name2 + ':', onlyIn2.length, onlyIn2.slice(0, 5).join(', ') + (onlyIn2.length > 5 ? '...' : ''));
  console.log('');
  console.log('Verses with matching Strong\'s set:', matches.length);
  console.log('Verses with different Strong\'s set:', mismatches.length);
  console.log('');

  if (mismatches.length > 0) {
    console.log('--- Sample mismatches (first 20) ---');
    for (const { ref, only1, only2, size1, size2 } of mismatches.slice(0, 20)) {
      console.log(ref + ':');
      if (only1.length) console.log('  only in', name1 + ':', only1.join(', '));
      if (only2.length) console.log('  only in', name2 + ':', only2.join(', '));
      console.log('  counts:', size1, 'vs', size2);
    }
    if (mismatches.length > 20) {
      console.log('... and', mismatches.length - 20, 'more.');
    }
  }
}

main();
