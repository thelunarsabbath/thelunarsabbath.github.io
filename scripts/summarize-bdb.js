#!/usr/bin/env node
/**
 * AI-Enhanced Hebrew Lexicon Pipeline
 * 
 * Sends BDB lexicon entries through Claude Sonnet to produce structured,
 * accessible JSON summaries with stem-specific definitions, translation notes,
 * consonantal root connections, and evidence-based insights.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/summarize-bdb.js [--test] [--concurrency=5] [--start=H1234]
 *
 * Options:
 *   --test         Run only 20 test entries
 *   --concurrency  Number of parallel requests (default: 5)
 *   --start        Resume from a specific Strong's number
 *   --model        Model to use (default: claude-sonnet-4-20250514)
 */

const fs = require('fs');
const path = require('path');

// Load .env file if it exists (for ANTHROPIC_API_KEY)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY. Set it in .env file or environment.');
  console.error('Create a file called .env in the project root with:');
  console.error('  ANTHROPIC_API_KEY=sk-ant-your-key-here');
  process.exit(1);
}

const Anthropic = require('@anthropic-ai/sdk');

// ── Paths ──────────────────────────────────────────────────────────

const BDB_PATH = path.join(__dirname, '..', 'data', 'bdb.json');
const STRONGS_PATH = path.join(__dirname, '..', 'strongs-hebrew-dictionary.js');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'bdb-ai.json');
const CHECKPOINT_PATH = path.join(__dirname, '..', 'data', 'bdb-ai-checkpoint.json');
const ERROR_LOG_PATH = path.join(__dirname, '..', 'data', 'bdb-ai-errors.json');

// ── Parse CLI args ─────────────────────────────────────────────────

const args = process.argv.slice(2);
const isTest = args.includes('--test');
const concurrencyArg = args.find(a => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split('=')[1]) : 5;
const startArg = args.find(a => a.startsWith('--start='));
const START_FROM = startArg ? startArg.split('=')[1] : null;
const modelArg = args.find(a => a.startsWith('--model='));
const MODEL = modelArg ? modelArg.split('=')[1] : 'claude-sonnet-4-20250514';

// ── Test entries ───────────────────────────────────────────────────

const TEST_ENTRIES = [
  'H1254', // bara - create (verb, theologically important)
  'H7843', // shachath - destroy (verb, multiple stems)
  'H559',  // amar - say (very common verb)
  'H935',  // bo - come/go (common verb)
  'H3045', // yada - know (verb, rich meaning)
  'H430',  // elohim - God (complex noun)
  'H4899', // mashiach - messiah/anointed
  'H8451', // torah - law/instruction
  'H1285', // berith - covenant
  'H3068', // YHWH
  'H7620', // shavua - week (root connections)
  'H7965', // shalom - peace
  'H6944', // qodesh - holy
  'H369',  // ayin - not (particle)
  'H853',  // et - object marker
  'H376',  // ish - man
  'H120',  // adam - man/mankind
  'H776',  // erets - earth/land
  'H8064', // shamayim - heaven
  'H85',   // Abraham (proper name)
];

// ── Load data ──────────────────────────────────────────────────────

console.log('Loading data...');

const bdb = JSON.parse(fs.readFileSync(BDB_PATH, 'utf8'));

// Load Strong's Hebrew dictionary (has module.exports)
const strongsDict = require(STRONGS_PATH);
console.log(`  BDB entries: ${Object.keys(bdb).length}`);
console.log(`  Strong's entries: ${Object.keys(strongsDict).length}`);

// ── Build consonantal root index ───────────────────────────────────

function stripDiacritics(text) {
  if (!text) return '';
  return text.replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, '');
}

const rootIndex = {};
for (const [key, entry] of Object.entries(strongsDict)) {
  if (!key.startsWith('H') || !entry.lemma) continue;
  const consonants = stripDiacritics(entry.lemma);
  if (consonants.length < 2) continue;
  if (!rootIndex[consonants]) rootIndex[consonants] = [];
  rootIndex[consonants].push(key);
}
console.log(`  Consonantal root groups: ${Object.keys(rootIndex).length}`);

function getSiblings(strongsNum) {
  const entry = strongsDict[strongsNum];
  if (!entry || !entry.lemma) return [];
  const consonants = stripDiacritics(entry.lemma);
  const siblings = rootIndex[consonants] || [];
  return siblings
    .filter(s => s !== strongsNum)
    .map(s => {
      const e = strongsDict[s];
      const def = (e.strongs_def || '').substring(0, 80);
      return `${s} ${e.lemma} = ${def}`;
    });
}

// ── System prompt ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a biblical Hebrew lexicographer creating a modern, accessible study resource from Brown-Driver-Briggs Hebrew Lexicon entries.

AUDIENCE: Bible students who do not read Hebrew but want to understand the original language behind their English translation. They want to validate translation choices and discover meaning the English obscures.

HERMENEUTIC FRAMEWORK (from the author):
- Let Scripture define its own terms. How the Bible uses a word across all its occurrences is more authoritative than any single dictionary gloss or theological tradition.
- Show the full semantic range. A single English translation often flattens a Hebrew word's meaning. Present alternatives so the reader can evaluate.
- Flag where translations diverge from the Hebrew. When KJV, ASV, or modern translations render a word in a way that narrows or shifts the Hebrew meaning, note it.
- Treat the Bible as a unified document. Do not assume discontinuity between Old and New Testaments. Torah terminology carries forward without being abolished or redefined.
- Present evidence, not conclusions. When scholars or traditions disagree, note the disagreement rather than asserting one view. Use language like "traditionally interpreted as" or "the Hebrew suggests" rather than "this means."
- When a traditional reading relies on inherited theological assumption rather than the Hebrew text itself, flag it as "traditional reading" rather than presenting it as the plain meaning.
- Physical/concrete meanings often carry deeper significance in Scripture. Note where a word's literal meaning connects to broader biblical patterns.

DEPTH CALIBRATION:
Your goal is to produce a study resource, not a summary. Some words warrant extensive treatment — words that are theologically significant, frequently mistranslated, or where the Hebrew reveals something English readers cannot see. For these words, write as much as needed in the evidence field — a 5-paragraph evidence section tracing derivation chains through 10 verses is better than a 2-sentence stub if the evidence is there.

Other words are straightforward — common prepositions, proper names, simple adjectives where there's nothing surprising. For these, a brief summary is sufficient. Do not manufacture depth where none exists.

The test: Would a serious Bible student, encountering this word in their reading, benefit from this information? Would it change how they understand a passage? If yes, go deep. If no, be concise. Every claim must be grounded in evidence — verses, derivation chains, cross-references, translation comparisons. Insight without evidence is opinion. Evidence without insight is a data dump. Provide both or neither.

CONSONANTAL ROOT ANALYSIS:
Hebrew was originally written without vowel marks. The vowel pointing was added by the Masoretes (~600-900 AD). I provide verified root connections from the Strong's dictionary (words sharing the same consonants without vowels). If these connections reveal a meaningful semantic relationship, explain why in rootNote. If you are aware of additional connections (Aramaic cognates, Dead Sea Scroll variants, LXX variant readings, disputed etymologies), you may note them but mark them as supplementary. If connections are trivial (proper names, coincidental similarity), set rootNote to null.

LANGUAGE RULES:
- Do NOT include Hebrew script (voweled or unvoweled) anywhere in the output. Your audience cannot read Hebrew.
- When referencing a specific Hebrew form, use English transliteration with the Strong's number: "mashach (H4886)" not "מָשַׁח".
- Write all prose in plain English. Every technical term must be explained in context.

OUTPUT FORMAT:
Respond with ONLY a JSON object matching this exact schema. No markdown, no explanation outside the JSON.

A "ref" object is: {"verse": "Gen 1:1", "strongs": ["H1254"], "stem": "Qal", "translation": "created"}
- "verse": standard abbreviation (e.g. "Gen 1:1", "Exod 20:3", "1Sam 17:4", "Psa 23:1", "Dan 9:24"). Null if referencing only a Strong's number.
- "strongs": array of Strong's numbers relevant to this reference. Always include.
- "stem": verb stem if relevant (Qal, Niphal, Piel, Hiphil, etc.). Null if not a verb or stem isn't the point.
- "translation": how English Bibles typically render this word in this verse. Null if not relevant.

{
  "strongs": "H####",
  "word": "Hebrew word with vowels",
  "translit": "transliteration",
  "pos": "verb|noun|adjective|adverb|preposition|conjunction|particle|pronoun|proper noun|suffix",
  "gloss": "2-5 word English gloss (the core meaning)",
  "stems": [
    {
      "stem": "Qal|Niphal|Piel|Pual|Hiphil|Hophal|Hithpael|etc.",
      "meaning": "what this stem means for this word",
      "detail": "1-3 sentences elaborating with context. No Hebrew script.",
      "refs": [{"verse": "Gen 1:1", "strongs": ["H1254"], "stem": "Qal", "translation": "created"}]
    }
  ],
  "senses": [
    {
      "number": 1,
      "meaning": "short meaning label",
      "detail": "1-3 sentences elaborating. No Hebrew script.",
      "refs": [{"verse": "Gen 1:1", "strongs": ["H1254"], "stem": null, "translation": "created"}]
    }
  ],
  "keyDistinction": "One sentence on why the different forms/senses matter for understanding. Null if straightforward.",
  "translationNote": "Where English translations may flatten or obscure the Hebrew. Null if translations are accurate.",
  "insight": "A genuine linguistic or cross-biblical observation beyond what BDB says. Null if nothing non-obvious to add.",
  "rootNote": "What the consonantal root connects and why it matters. Null if trivial. Reference related Strong's numbers inline like: 'from the same root as shava (H7650) meaning to swear'.",
  "evidence": [
    {
      "point": "A claim or observation in plain English. No Hebrew script. Reference forms by transliteration and Strong's number.",
      "refs": [{"verse": "Gen 6:11", "strongs": ["H7843"], "stem": "Niphal", "translation": "was corrupt"}]
    }
  ],
  "keyVerses": [
    {"verse": "Gen 1:1", "strongs": ["H1254"], "note": "God created heaven and earth (Qal — exclusive divine action)"}
  ]
}

Set "evidence" to null (not empty array) if the summary fields are self-sufficient.

RULES:
- Verbs populate "stems" (organized by Hebrew verb stem). Nouns/particles populate "senses". Some entries may have both.
- "stems" and "senses" arrays may be empty if the entry doesn't warrant subdivision.
- All nullable fields (keyDistinction, translationNote, insight, rootNote, evidence) should be null rather than contain filler.
- Do NOT invent verse references. Only cite verses mentioned in the BDB text or that you are confident exist.
- Do NOT include Hebrew script anywhere. Use transliterations with Strong's numbers instead.
- Every Strong's number you mention in prose should appear in a refs array so the UI can link it.
- Base your summary primarily on the BDB entry text provided. You may supplement with knowledge from your training data but do not contradict the BDB.`;

// ── Build user message per entry ───────────────────────────────────

function buildUserMessage(strongsNum) {
  const entry = strongsDict[strongsNum] || {};
  const bdbText = bdb[strongsNum] || bdb[strongsNum.replace(/[a-z]$/, '')] || '';
  const siblings = getSiblings(strongsNum);
  
  let msg = `Strong's: ${strongsNum}\n`;
  msg += `Lemma: ${entry.lemma || '(unknown)'}\n`;
  if (entry.xlit) msg += `Transliteration: ${entry.xlit}\n`;
  if (entry.pron) msg += `Pronunciation: ${entry.pron}\n`;
  if (entry.strongs_def) msg += `Definition: ${entry.strongs_def}\n`;
  if (entry.kjv_def) msg += `KJV Usage: ${entry.kjv_def}\n`;
  if (entry.derivation) msg += `Derivation: ${entry.derivation}\n`;
  
  if (bdbText) {
    msg += `\nBDB Lexicon Entry:\n${bdbText.substring(0, 6000)}\n`;
    if (bdbText.length > 6000) msg += `[...truncated, ${bdbText.length} chars total]\n`;
  } else {
    msg += `\nNo BDB entry available.\n`;
  }
  
  if (siblings.length > 0) {
    msg += `\nConsonantal root siblings (same consonants without vowel marks):\n`;
    for (const s of siblings.slice(0, 15)) {
      msg += `  ${s}\n`;
    }
    if (siblings.length > 15) msg += `  ...and ${siblings.length - 15} more\n`;
  }
  
  msg += `\nProduce the JSON entry for ${strongsNum}.`;
  return msg;
}

// ── API call with retry ────────────────────────────────────────────

const client = new Anthropic();

async function summarizeEntry(strongsNum) {
  const userMsg = buildUserMessage(strongsNum);
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }]
      });
      
      const text = response.content[0].text.trim();
      
      // Parse JSON — handle potential markdown wrapping
      let jsonText = text;
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      const parsed = JSON.parse(jsonText);
      
      // Basic validation
      if (!parsed.strongs || !parsed.gloss) {
        throw new Error('Missing required fields: strongs, gloss');
      }
      
      // Normalize: ensure arrays exist
      parsed.stems = parsed.stems || [];
      parsed.senses = parsed.senses || [];
      parsed.keyVerses = parsed.keyVerses || [];
      
      return parsed;
    } catch (err) {
      if (attempt < 3) {
        console.warn(`  Retry ${attempt}/3 for ${strongsNum}: ${err.message}`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
      } else {
        throw err;
      }
    }
  }
}

// ── Main pipeline ──────────────────────────────────────────────────

async function main() {
  console.log(`\nModel: ${MODEL}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Mode: ${isTest ? 'TEST (20 entries)' : 'FULL'}\n`);
  
  // Determine which entries to process
  let entriesToProcess;
  if (isTest) {
    entriesToProcess = TEST_ENTRIES.filter(s => bdb[s] || strongsDict[s]);
  } else {
    // All Strong's numbers that have either BDB or Strong's data
    const allNums = new Set([...Object.keys(bdb), ...Object.keys(strongsDict).filter(k => k.startsWith('H'))]);
    entriesToProcess = Array.from(allNums).sort((a, b) => {
      const na = parseInt(a.slice(1));
      const nb = parseInt(b.slice(1));
      return na - nb;
    });
  }
  
  console.log(`Entries to process: ${entriesToProcess.length}`);
  
  // Load checkpoint
  let results = {};
  if (fs.existsSync(CHECKPOINT_PATH)) {
    results = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
    console.log(`Loaded checkpoint: ${Object.keys(results).length} entries already done`);
  }
  
  // Filter out already-completed entries
  let remaining = entriesToProcess.filter(s => !results[s]);
  
  // Apply --start filter
  if (START_FROM) {
    const startIdx = remaining.indexOf(START_FROM);
    if (startIdx > 0) {
      remaining = remaining.slice(startIdx);
      console.log(`Starting from ${START_FROM}, ${remaining.length} entries remaining`);
    }
  }
  
  console.log(`Remaining: ${remaining.length}\n`);
  
  if (remaining.length === 0) {
    console.log('All entries already processed. Writing output...');
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 1), 'utf8');
    console.log(`Output: ${OUTPUT_PATH}`);
    return;
  }
  
  const errors = [];
  let completed = Object.keys(results).length;
  const total = entriesToProcess.length;
  const startTime = Date.now();
  
  // Process in batches with concurrency
  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY);
    
    const promises = batch.map(async (strongsNum) => {
      try {
        const result = await summarizeEntry(strongsNum);
        results[strongsNum] = result;
        completed++;
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const rate = (completed / (elapsed || 1)).toFixed(1);
        const eta = ((total - completed) / (rate || 1) / 60).toFixed(1);
        console.log(`  [${completed}/${total}] ${strongsNum} — ${result.gloss} (${elapsed}s, ${rate}/s, ETA ${eta}m)`);
        
        return { strongsNum, success: true };
      } catch (err) {
        console.error(`  FAIL ${strongsNum}: ${err.message}`);
        errors.push({ strongs: strongsNum, error: err.message });
        return { strongsNum, success: false };
      }
    });
    
    await Promise.all(promises);
    
    // Checkpoint every batch
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(results), 'utf8');
  }
  
  // Write final output (pretty-printed with minimal indent for readability)
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 1), 'utf8');
  
  // Write error log
  if (errors.length > 0) {
    fs.writeFileSync(ERROR_LOG_PATH, JSON.stringify(errors, null, 2), 'utf8');
  }
  
  const sizeKB = Math.round(fs.statSync(OUTPUT_PATH).size / 1024);
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log(`\n════════════════════════════════════════`);
  console.log(`Done in ${elapsed} minutes.`);
  console.log(`Entries: ${Object.keys(results).length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Output: ${OUTPUT_PATH} (${sizeKB} KB)`);
  if (errors.length > 0) console.log(`Error log: ${ERROR_LOG_PATH}`);
  console.log(`════════════════════════════════════════`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
