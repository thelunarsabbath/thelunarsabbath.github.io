/**
 * Bible Search Web Worker
 *
 * Each worker instance loads one translation's text blob and handles
 * search queries in its own thread. The main thread orchestrates
 * parallel search by posting the same query to multiple workers.
 *
 * Messages IN:
 *   { type: 'load', translationId, file, hasStrongs }
 *   { type: 'search', msgId, pattern, flags }
 *
 * Messages OUT:
 *   { type: 'loaded', translationId, verseCount }
 *   { type: 'results', msgId, results: [{ ref, text, matches }] }
 *   { type: 'error', msgId?, error }
 */

let blob = null;
let index = null;   // ref → [start, end]
let translationId = null;
let hasStrongs = false;

const STRONGS_RE = /\{\(?[HG]\d+\)?\}/g;

function stripStrongsTags(text) {
  return text.replace(STRONGS_RE, '');
}

/**
 * Parse a standardized .txt file into blob + index.
 * Same logic as Bible._parseAndStore but standalone for the worker.
 */
function parseAndStore(rawText) {
  const offsets = {};
  let pos = 0;
  let lineNum = 0;
  const len = rawText.length;

  while (pos < len) {
    const nlIdx = rawText.indexOf('\n', pos);
    const lineEnd = nlIdx === -1 ? len : nlIdx;
    lineNum++;

    if (lineNum > 2) {
      const tabIdx = rawText.indexOf('\t', pos);
      if (tabIdx !== -1 && tabIdx < lineEnd) {
        const ref = rawText.slice(pos, tabIdx);
        offsets[ref] = [tabIdx + 1, lineEnd];
      }
    }

    pos = lineEnd + 1;
  }

  blob = rawText;
  index = offsets;
  return Object.keys(offsets).length;
}

self.onmessage = async function(e) {
  const msg = e.data;

  if (msg.type === 'load') {
    translationId = msg.translationId;
    hasStrongs = msg.hasStrongs || false;

    try {
      const response = await fetch(msg.file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const count = parseAndStore(text);
      self.postMessage({ type: 'loaded', translationId, verseCount: count });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message });
    }
  }

  if (msg.type === 'search') {
    if (!blob || !index) {
      self.postMessage({ type: 'results', msgId: msg.msgId, results: [] });
      return;
    }

    const regex = new RegExp(msg.pattern, msg.flags || 'ig');
    const matchRegex = new RegExp(msg.pattern, (msg.flags || 'ig').includes('g') ? (msg.flags || 'ig') : (msg.flags || 'ig') + 'g');
    const results = [];

    for (const ref of Object.keys(index)) {
      const offsets = index[ref];
      const rawText = blob.slice(offsets[0], offsets[1]);
      const plainText = hasStrongs ? stripStrongsTags(rawText) : rawText;

      regex.lastIndex = 0;
      if (regex.test(plainText)) {
        const matches = plainText.match(matchRegex) || [];
        results.push({ ref, text: plainText, matches });
      }
    }

    self.postMessage({ type: 'results', msgId: msg.msgId, results });
  }
};
