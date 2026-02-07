#!/usr/bin/env node
/**
 * Convert a MyBible-format SQLite module (.bbl.mybible) to our standardized
 * Strong's .txt format (same as kjv_strongs.txt):
 *
 *   Line 1: Title
 *   Line 2: (blank)
 *   Line 3: Copyright / notice
 *   Line 4: (blank)
 *   Line 5: (blank)
 *   Line 6+: "BookName Chapter:Verse " + verse text with {H####} and {G####} tags
 *
 * MyBible uses <WH7225> and <WG1722>; we convert to {H7225} and {G1722}.
 *
 * Usage: node scripts/mybatis-to-strongs-txt.js <input.mybible> [output.txt]
 *   If output is omitted, writes to stdout.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Book number to name (Protestant order, 1–66)
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

function convertStrongsTags(text) {
  if (!text) return '';
  return text
    .replace(/<W(H\d+)>/gi, '{$1}')
    .replace(/<W(G\d+)>/gi, '{$1}');
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath) {
    console.error('Usage: node mybatis-to-strongs-txt.js <input.mybible> [output.txt]');
    process.exit(1);
  }

  const inputAbs = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);
  if (!fs.existsSync(inputAbs)) {
    console.error('Input file not found:', inputAbs);
    process.exit(1);
  }

  const sqlite = spawn('sqlite3', [inputAbs, '-noheader', '-separator', '\t', 'SELECT Book, Chapter, Verse, Scripture FROM Bible ORDER BY Book, Chapter, Verse;'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let buffer = '';
  const lines = [];

  sqlite.stdout.setEncoding('utf8');
  sqlite.stdout.on('data', (chunk) => {
    buffer += chunk;
    const parts = buffer.split('\n');
    buffer = parts.pop() || '';
    for (const line of parts) {
      if (!line.trim()) continue;
      const idx = line.indexOf('\t');
      const idx2 = line.indexOf('\t', idx + 1);
      const idx3 = line.indexOf('\t', idx2 + 1);
      const bookNum = line.slice(0, idx);
      const chapter = line.slice(idx + 1, idx2);
      const verse = line.slice(idx2 + 1, idx3);
      const scripture = idx3 >= 0 ? line.slice(idx3 + 1) : '';
      const bookName = BOOK_NUM_TO_NAME[parseInt(bookNum, 10)];
      if (!bookName) {
        console.error('Unknown book number:', bookNum);
        continue;
      }
      const ref = `${bookName} ${chapter}:${verse}`;
      const text = convertStrongsTags(scripture);
      lines.push(`${ref} ${text}`);
    }
  });

  sqlite.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  sqlite.on('close', (code) => {
    if (buffer.trim()) {
      const idx = buffer.indexOf('\t');
      const idx2 = buffer.indexOf('\t', idx + 1);
      const idx3 = buffer.indexOf('\t', idx2 + 1);
      const bookNum = buffer.slice(0, idx);
      const chapter = buffer.slice(idx + 1, idx2);
      const verse = buffer.slice(idx2 + 1, idx3);
      const scripture = idx3 >= 0 ? buffer.slice(idx3 + 1) : '';
      const bookName = BOOK_NUM_TO_NAME[parseInt(bookNum, 10)];
      if (bookName) {
        const text = convertStrongsTags(scripture);
        lines.push(`${bookName} ${chapter}:${verse} ${text}`);
      }
    }
    if (code !== 0) {
      process.exit(code);
    }

    const title = 'American King James Version with Strong\'s Numbers';
    const header = [
      title,
      '',
      'This Bible is in the Public Domain.',
      '',
      '',
      ...lines
    ].join('\n');

    if (outputPath) {
      const outAbs = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
      fs.writeFileSync(outAbs, header, 'utf8');
      console.error('Wrote', lines.length, 'verses to', outAbs);
    } else {
      process.stdout.write(header);
    }
  });
}

main();
