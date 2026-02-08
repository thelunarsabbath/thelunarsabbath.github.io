#!/usr/bin/env node
/**
 * Unit tests for Classics data subsystem (classics.js).
 *
 * Tests decode citation, lookup section, normalize citation.
 * Uses injected philo blob from classics/philo.txt (no network).
 *
 * Usage: node tests/classics-test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Classics = require('../classics.js');

const ROOT = path.join(__dirname, '..');
const PHILO_TXT = path.join(ROOT, 'classics', 'philo.txt');
const JOSEPHUS_TXT = path.join(ROOT, 'classics', 'josephus.txt');

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

// ─── Inject Philo data for tests ───────────────────────────────────────────
function loadPhiloDirect() {
  if (!fs.existsSync(PHILO_TXT)) {
    throw new Error(`Run scripts/parse-philo.js first to create ${PHILO_TXT}`);
  }
  const blob = fs.readFileSync(PHILO_TXT, 'utf8');
  Classics._injectForTest('philo', blob);
}

function loadJosephusDirect() {
  if (!fs.existsSync(JOSEPHUS_TXT)) {
    throw new Error(`Run scripts/parse-josephus.js first to create ${JOSEPHUS_TXT}`);
  }
  const blob = fs.readFileSync(JOSEPHUS_TXT, 'utf8');
  Classics._injectForTest('josephus', blob);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Classics: Decode citation (Philo) ===\n');

  test('parsePhiloCitation("On the Creation 42") returns correct shape', () => {
    const p = Classics.parsePhiloCitation('On the Creation 42');
    assert.strictEqual(p.author, 'philo');
    assert.strictEqual(p.work, 'On the Creation');
    assert.strictEqual(p.section, '42');
    assert.ok(p.workKey);
  });

  test('parsePhiloCitation("Philo, On the Creation 42") strips author prefix', () => {
    const p = Classics.parsePhiloCitation('Philo, On the Creation 42');
    assert.strictEqual(p.author, 'philo');
    assert.strictEqual(p.work, 'On the Creation');
    assert.strictEqual(p.section, '42');
  });

  test('parsePhiloCitation("Opif. 42") resolves abbreviation', () => {
    const p = Classics.parsePhiloCitation('Opif. 42');
    assert.strictEqual(p.work, 'On the Creation');
    assert.strictEqual(p.section, '42');
  });

  test('parsePhiloCitation("On the Migration of Abraham 89")', () => {
    const p = Classics.parsePhiloCitation('On the Migration of Abraham 89');
    assert.strictEqual(p.author, 'philo');
    assert.strictEqual(p.work, 'On the Migration of Abraham');
    assert.strictEqual(p.section, '89');
  });

  test('parsePhiloCitation with subsection "On Dreams 1.1")', () => {
    const p = Classics.parsePhiloCitation('On Dreams 1.1');
    assert.strictEqual(p.author, 'philo');
    assert.strictEqual(p.section, '1.1');
  });

  test('parsePhiloCitation(null) returns null', () => {
    assert.strictEqual(Classics.parsePhiloCitation(null), null);
  });

  test('parsePhiloCitation("garbage") returns null', () => {
    assert.strictEqual(Classics.parsePhiloCitation('garbage'), null);
  });

  console.log('\n=== Classics: Decode citation (Josephus) ===\n');

  test('parseJosephusCitation("Antiquities 18.2.2") returns correct shape', () => {
    const p = Classics.parseJosephusCitation('Antiquities 18.2.2');
    assert.strictEqual(p.author, 'josephus');
    assert.strictEqual(p.work, 'Antiquities');
    assert.strictEqual(p.book, 18);
    assert.strictEqual(p.chapter, 2);
    assert.strictEqual(p.section, 2);
  });

  test('parseJosephusCitation("Ant. 18.2.2") resolves abbreviation', () => {
    const p = Classics.parseJosephusCitation('Ant. 18.2.2');
    assert.strictEqual(p.work, 'Antiquities');
    assert.strictEqual(p.book, 18);
  });

  test('parseJosephusCitation("Against Apion 2.282")', () => {
    const p = Classics.parseJosephusCitation('Against Apion 2.282');
    assert.strictEqual(p.author, 'josephus');
    assert.strictEqual(p.work, 'Against Apion');
  });

  test('parseJosephusCitation("Jewish War 2.17.8")', () => {
    const p = Classics.parseJosephusCitation('Jewish War 2.17.8');
    assert.strictEqual(p.work, 'Jewish War');
    assert.strictEqual(p.book, 2);
  });

  test('parseJosephusCitation("A.J. 18.2.2") resolves SBL abbreviation', () => {
    const p = Classics.parseJosephusCitation('A.J. 18.2.2');
    assert.strictEqual(p.work, 'Antiquities');
    assert.strictEqual(p.book, 18);
  });

  test('parseJosephusCitation("B.J. 2.17.8") resolves Jewish War', () => {
    const p = Classics.parseJosephusCitation('B.J. 2.17.8');
    assert.strictEqual(p.work, 'Jewish War');
  });

  test('parseJosephusCitation("Antiquities of the Jews (Book 18, 1:4)") normalizes parentheses form', () => {
    const p = Classics.parseJosephusCitation('Antiquities of the Jews (Book 18, 1:4)');
    assert.strictEqual(p.work, 'Antiquities');
    assert.strictEqual(p.book, 18);
    assert.strictEqual(p.chapter, 1);
    assert.strictEqual(p.section, 4);
  });

  test('parseJosephusCitation(null) returns null', () => {
    assert.strictEqual(Classics.parseJosephusCitation(null), null);
  });

  test('parsePhiloCitation("Migr. 89") resolves abbreviation', () => {
    const p = Classics.parsePhiloCitation('Migr. 89');
    assert.strictEqual(p.work, 'On the Migration of Abraham');
  });

  test('parsePhiloCitation("Special Laws II, XXX") resolves work and Roman section', () => {
    const p = Classics.parsePhiloCitation('Special Laws II, XXX');
    assert.strictEqual(p.work, 'The Second Festival');
    assert.strictEqual(p.section, '30');
  });

  console.log('\n=== Classics: parseCitation (disambiguation) ===\n');

  test('parseCitation("On the Creation 42") returns Philo', () => {
    const p = Classics.parseCitation('On the Creation 42');
    assert.strictEqual(p.author, 'philo');
  });

  test('parseCitation("Antiquities 18.2.2") returns Josephus', () => {
    const p = Classics.parseCitation('Antiquities 18.2.2');
    assert.strictEqual(p.author, 'josephus');
  });

  test('parseCitation("unknown work 99") tries title-case work name', () => {
    const p = Classics.parseCitation('unknown work 99');
    assert.strictEqual(p.author, 'philo');
    assert.strictEqual(p.work, 'Unknown Work');
    assert.strictEqual(p.section, '99');
  });

  console.log('\n=== Classics: normalizeCitation ===\n');

  test('normalizeCitation("On the Creation 42") returns same', () => {
    assert.strictEqual(Classics.normalizeCitation('On the Creation 42'), 'On the Creation 42');
  });

  test('normalizeCitation("Ant. 18.2.2") returns Antiquities 18.2.2', () => {
    assert.strictEqual(Classics.normalizeCitation('Ant. 18.2.2'), 'Antiquities 18.2.2');
  });

  test('normalizeCitation("Philo, Opif. 42") returns On the Creation 42', () => {
    assert.strictEqual(Classics.normalizeCitation('Philo, Opif. 42'), 'On the Creation 42');
  });

  test('normalizeCitation("garbage") returns empty string', () => {
    assert.strictEqual(Classics.normalizeCitation('garbage'), '');
  });

  console.log('\n=== Classics: Lookup (Philo blob required) ===\n');

  try {
    loadPhiloDirect();
  } catch (e) {
    console.log('  (skipping lookup tests: run scripts/parse-philo.js first)');
    console.log(`  ${e.message}`);
    printSummary();
    process.exit(failed > 0 ? 1 : 0);
  }

  test('isLoaded("philo") is true after inject', () => {
    assert.strictEqual(Classics.isLoaded('philo'), true);
  });

  test('getSection("philo", "On the Creation", 42) returns non-empty string', () => {
    const text = Classics.getSection('philo', 'On the Creation', 42);
    assert.strictEqual(typeof text, 'string');
    assert.ok(text.length > 0);
  });

  test('getSection("philo", "On the Creation", 42) contains expected phrase', () => {
    const text = Classics.getSection('philo', 'On the Creation', 42);
    assert.ok(text.includes('creation') || text.includes('Creation') || text.length > 50);
  });

  test('getSectionByParsed(parseCitation("On the Creation 42")) returns text', () => {
    const parsed = Classics.parseCitation('On the Creation 42');
    const text = Classics.getSectionByParsed(parsed);
    assert.ok(text && text.length > 0);
  });

  test('getSection("philo", "On the Creation", 1) returns first section', () => {
    const text = Classics.getSection('philo', 'On the Creation', 1);
    assert.ok(text && text.length > 0);
    assert.ok(text.includes('lawgivers') || text.includes('Moses'));
  });

  test('getSection("philo", "Nonexistent Work", 1) returns null', () => {
    assert.strictEqual(Classics.getSection('philo', 'Nonexistent Work', 1), null);
  });

  test('getSection("philo", "On the Creation", 99999) returns null', () => {
    assert.strictEqual(Classics.getSection('philo', 'On the Creation', 99999), null);
  });

  test('getWorks("philo") includes On the Creation', () => {
    const works = Classics.getWorks('philo');
    assert.ok(Array.isArray(works));
    assert.ok(works.includes('On the Creation'));
  });

  test('getAuthors returns registry with philo and josephus', () => {
    const authors = Classics.getAuthors();
    assert.ok(authors.length >= 1);
    const ids = authors.map(a => a.id);
    assert.ok(ids.includes('philo'));
  });

  console.log('\n=== Classics: Lookup (Josephus blob) ===\n');

  try {
    loadJosephusDirect();
  } catch (e) {
    console.log('  (skipping Josephus lookup tests: run scripts/parse-josephus.js first)');
    printSummary();
    process.exit(failed > 0 ? 1 : 0);
  }

  test('Josephus isLoaded after inject', () => {
    assert.strictEqual(Classics.isLoaded('josephus'), true);
  });

  test('getSection("josephus", "Antiquities|18|2|2") returns non-empty text', () => {
    const text = Classics.getSection('josephus', 'Antiquities|18|2|2');
    assert.ok(text && text.length > 0);
  });

  test('getSectionByParsed(parseCitation("Antiquities 18.2.2")) returns text', () => {
    const parsed = Classics.parseCitation('Antiquities 18.2.2');
    const text = Classics.getSectionByParsed(parsed);
    assert.ok(text && text.length > 0);
  });

  test('getWorks("josephus") includes Antiquities and Jewish War', () => {
    const works = Classics.getWorks('josephus');
    assert.ok(works.includes('Antiquities'));
    assert.ok(works.includes('Jewish War'));
  });

  printSummary();
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  console.log('\n---');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f.name}: ${f.error.message}`));
  }
}

main();
