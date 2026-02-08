#!/usr/bin/env node
/**
 * Build compact BDB lexicon JSON from the Eliran Wong unabridged BDB source.
 *
 * Reads source/lexicons/DictBDB.json (HTML-formatted entries keyed by index)
 * and produces data/bdb.json keyed by Strong's number with cleaned text.
 *
 * Output format: { "H1": "father. ...", "H430": "God, gods. ...", ... }
 *
 * Usage: node scripts/build-bdb.js
 */

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'source', 'lexicons', 'DictBDB.json');
const OUTPUT = path.join(__dirname, '..', 'data', 'bdb.json');

// ── HTML cleaning ──────────────────────────────────────────────────

/**
 * Convert BDB HTML entry to clean readable text.
 * Preserves structure (stems, senses) but removes HTML tags.
 */
function cleanHtml(html) {
  if (!html) return '';
  
  let text = html;
  
  // Replace <p> and <div> with newlines
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<p[^>]*>/gi, '');
  text = text.replace(/<div[^>]*>/gi, '');
  
  // Replace <br> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Convert bold to markers we can preserve
  text = text.replace(/<b>(.*?)<\/b>/gi, '$1');
  
  // Convert italic to markers
  text = text.replace(/<i>(.*?)<\/i>/gi, '$1');
  
  // Strip Hebrew font tags but keep content
  text = text.replace(/<font[^>]*>(.*?)<\/font>/gi, '$1');
  text = text.replace(/<heb>(.*?)<\/heb>/gi, '$1');
  
  // Convert bible references to readable form
  text = text.replace(/<a\s+href='bible:\/\/([^']+)'[^>]*>(.*?)<\/a>/gi, '$2');
  
  // Strip ref0/ref tags but keep content
  text = text.replace(/<ref0[^>]*>(.*?)<\/ref0>/gi, '$1');
  text = text.replace(/<ref[^>]*>(.*?)<\/ref>/gi, '$1');
  
  // Strip sup/sub but keep content
  text = text.replace(/<su[bp][^>]*>(.*?)<\/su[bp]>/gi, '($1)');
  
  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&#x200E;/g, '');  // LTR mark
  text = text.replace(/&#x200F;/g, '');  // RTL mark
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#(\d+);/g, (m, code) => String.fromCharCode(parseInt(code)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (m, code) => String.fromCharCode(parseInt(code, 16)));
  
  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n /g, '\n');
  text = text.replace(/ \n/g, '\n');
  text = text.trim();
  
  // Remove the first line (H####. word) since we store that as the key
  const firstNewline = text.indexOf('\n');
  if (firstNewline > 0 && firstNewline < 80) {
    text = text.substring(firstNewline + 1).trim();
  }
  
  return text;
}

// ── Main ───────────────────────────────────────────────────────────

console.log('Building BDB lexicon...\n');

if (!fs.existsSync(SOURCE)) {
  console.error('Source not found:', SOURCE);
  console.error('Download from: https://github.com/eliranwong/unabridged-BDB-Hebrew-lexicon');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const entries = Object.values(raw);
console.log(`  Source entries: ${entries.length}`);

const output = {};
let count = 0;
let skipped = 0;

for (const entry of entries) {
  if (!entry || !entry.top || !entry.def) {
    skipped++;
    continue;
  }
  
  // Extract Strong's number from 'top' field (e.g. "H1", "H430", "H7843")
  const strongsMatch = entry.top.match(/^(H\d+)/);
  if (!strongsMatch) {
    skipped++;
    continue;
  }
  
  const strongsNum = strongsMatch[1];
  const cleaned = cleanHtml(entry.def);
  
  if (!cleaned || cleaned.length < 5) {
    skipped++;
    continue;
  }
  
  // Store. If duplicate Strong's number, append (some entries span multiple BDB articles)
  if (output[strongsNum]) {
    output[strongsNum] += '\n\n' + cleaned;
  } else {
    output[strongsNum] = cleaned;
  }
  count++;
}

// Write output
fs.writeFileSync(OUTPUT, JSON.stringify(output), 'utf8');

const sizeKB = Math.round(fs.statSync(OUTPUT).size / 1024);
console.log(`  Entries mapped: ${count} (${skipped} skipped)`);
console.log(`  Unique Strong's numbers: ${Object.keys(output).length}`);
console.log(`  Output: ${OUTPUT} (${sizeKB} KB)`);
console.log('\nDone.');
