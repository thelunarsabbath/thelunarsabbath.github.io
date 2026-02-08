#!/usr/bin/env node
/**
 * Compress classics/*.txt to classics/*.txt.gz using Node's built-in zlib.
 * Same pattern as scripts/build-bible-gz.js.
 *
 * Usage: node scripts/build-classics-gz.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CLASSICS_DIR = path.join(__dirname, '..', 'classics');

function main() {
  if (!fs.existsSync(CLASSICS_DIR)) {
    console.log('classics/ directory not found. Run parse-philo.js first.');
    return;
  }

  const files = fs.readdirSync(CLASSICS_DIR).filter(f => f.endsWith('.txt') && !f.endsWith('.gz'));

  if (files.length === 0) {
    console.log('No .txt files found in classics/');
    return;
  }

  console.log(`Compressing ${files.length} classics file(s)...\n`);

  let totalRaw = 0;
  let totalGz = 0;

  for (const file of files) {
    const srcPath = path.join(CLASSICS_DIR, file);
    const destPath = srcPath + '.gz';

    const raw = fs.readFileSync(srcPath);
    const compressed = zlib.gzipSync(raw, { level: 9 });

    fs.writeFileSync(destPath, compressed);

    const rawSize = raw.length;
    const gzSize = compressed.length;
    const ratio = ((1 - gzSize / rawSize) * 100).toFixed(1);

    totalRaw += rawSize;
    totalGz += gzSize;

    console.log(`  ${file}: ${(rawSize / 1024).toFixed(0)} KB → ${(gzSize / 1024).toFixed(0)} KB (${ratio}% reduction)`);
  }

  console.log(`\nTotal: ${(totalRaw / 1024 / 1024).toFixed(1)} MB → ${(totalGz / 1024 / 1024).toFixed(1)} MB (${((1 - totalGz / totalRaw) * 100).toFixed(1)}% reduction)`);
}

main();
