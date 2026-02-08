#!/usr/bin/env node
/**
 * BDB Formatting-Only AI Pass
 * 
 * Sends raw BDB entries through Claude Haiku (cheaper, simpler task) to produce
 * structured formatting WITHOUT rewriting the content. The goal is to:
 * 1. Identify stem section boundaries (Qal, Niphal, Piel, etc.)
 * 2. Tag verse references as machine-readable
 * 3. Expand common scholarly abbreviations
 * 4. Separate the content into labeled sections
 * 5. Preserve the original BDB text verbatim — no paraphrasing
 *
 * Output replaces data/bdb.json with a structured version that can be
 * shown as "Original BDB" in the UI with proper formatting.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/format-bdb.js [--test] [--concurrency=10]
 *
 * This is a much simpler task than summarize-bdb.js and can use Haiku.
 */

const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY. Set in .env or environment.');
  process.exit(1);
}

const Anthropic = require('@anthropic-ai/sdk');

const BDB_PATH = path.join(__dirname, '..', 'data', 'bdb.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'bdb-formatted.json');
const CHECKPOINT_PATH = path.join(__dirname, '..', 'data', 'bdb-fmt-checkpoint.json');

const args = process.argv.slice(2);
const isTest = args.includes('--test');
const concurrencyArg = args.find(a => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split('=')[1]) : 10;
const MODEL = 'claude-3-5-haiku-20241022'; // Haiku is sufficient for formatting

const TEST_ENTRIES = ['H1254', 'H7843', 'H430', 'H4899', 'H7620', 'H369', 'H7965', 'H8451'];

const SYSTEM_PROMPT = `You are formatting a Brown-Driver-Briggs Hebrew Lexicon entry into structured JSON.
DO NOT rewrite, paraphrase, or summarize the content. Your ONLY job is to:
1. Identify where stem sections begin (Qal, Niphal, Piel, Hiphil, etc.) and label them
2. Extract verse references into machine-readable format (e.g. "Gen 1:1")
3. Expand common scholarly abbreviations inline (e.g. "masc." → "masculine", "fem." → "feminine", "abs." → "absolute", "constr." → "construct", "pl." → "plural", "sg." → "singular", "impf." → "imperfect", "pf." → "perfect", "ptc." → "participle", "inf." → "infinitive", "subst." → "substantive")
4. Separate the etymology/introduction from the stem-specific content

OUTPUT: JSON only. Schema:
{
  "intro": "The introductory/etymological material before any stem sections. Preserve original text.",
  "sections": [
    {
      "label": "Qal|Niphal|Piel|Hiphil|etc.|General",
      "text": "The BDB text for this stem section. Preserve original text with abbreviations expanded.",
      "verses": ["Gen 1:1", "Exod 20:3"]
    }
  ]
}

If the entry has no stem sections (nouns, particles, etc.), put everything in a single section with label "General".
Extract ALL verse references from the text into the verses array.
Do NOT remove verse references from the text — they should appear in both places.`;

const client = new Anthropic();

async function formatEntry(strongsNum, rawText) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Format this BDB entry for ${strongsNum}:\n\n${rawText.substring(0, 5000)}` }]
      });
      
      let jsonText = response.content[0].text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      const parsed = JSON.parse(jsonText);
      if (!parsed.sections) throw new Error('Missing sections');
      return parsed;
    } catch (err) {
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1500 * attempt));
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  console.log('BDB Formatting Pipeline');
  console.log(`Model: ${MODEL}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Mode: ${isTest ? 'TEST' : 'FULL'}\n`);
  
  const bdb = JSON.parse(fs.readFileSync(BDB_PATH, 'utf8'));
  const allKeys = isTest ? TEST_ENTRIES.filter(k => bdb[k]) : Object.keys(bdb).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  
  let results = {};
  if (fs.existsSync(CHECKPOINT_PATH)) {
    results = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
    console.log(`Checkpoint: ${Object.keys(results).length} done`);
  }
  
  const remaining = allKeys.filter(k => !results[k]);
  console.log(`Entries: ${allKeys.length}, Remaining: ${remaining.length}\n`);
  
  const errors = [];
  let completed = Object.keys(results).length;
  const total = allKeys.length;
  const startTime = Date.now();
  
  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY);
    
    await Promise.all(batch.map(async (sn) => {
      try {
        const result = await formatEntry(sn, bdb[sn]);
        results[sn] = result;
        completed++;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`  [${completed}/${total}] ${sn} (${elapsed}s)`);
      } catch (err) {
        console.error(`  FAIL ${sn}: ${err.message}`);
        errors.push({ strongs: sn, error: err.message });
      }
    }));
    
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(results), 'utf8');
  }
  
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 1), 'utf8');
  
  const sizeKB = Math.round(fs.statSync(OUTPUT_PATH).size / 1024);
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log(`\nDone in ${elapsed} min. Entries: ${Object.keys(results).length}, Errors: ${errors.length}, Size: ${sizeKB} KB`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
