#!/usr/bin/env node
/**
 * Fix broken rgba(var(--..., fallback), opacity) patterns.
 * These don't work in CSS — replace with proper token references.
 */
const fs = require('fs');
const path = require('path');

const REPLACEMENTS = [
  // Gold rgba patterns → proper tokens
  { from: 'rgba(var(--accent-gold-raw, 212, 160, 23), 0.05)', to: 'var(--accent-gold-subtle)' },
  { from: 'rgba(var(--accent-gold-raw, 212, 160, 23), 0.08)', to: 'var(--accent-gold-subtle)' },
  { from: 'rgba(var(--accent-gold-raw, 212, 160, 23), 0.1)', to: 'var(--accent-gold-subtle)' },
  { from: 'rgba(var(--accent-gold-raw, 212, 160, 23), 0.12)', to: 'var(--accent-gold-subtle)' },
  { from: 'rgba(var(--accent-gold-raw, 212, 160, 23), 0.15)', to: 'var(--accent-gold-subtle)' },
  { from: 'rgba(var(--accent-gold-raw, 212, 160, 23), 0.2)', to: 'var(--accent-gold-muted)' },
  { from: 'rgba(var(--accent-gold-raw, 212, 160, 23), 0.22)', to: 'var(--accent-gold-muted)' },
  { from: 'rgba(var(--accent-gold-raw, 212, 160, 23), 0.25)', to: 'var(--accent-gold-muted)' },
  { from: 'rgba(var(--accent-gold-raw, 212, 160, 23), 0.3)', to: 'var(--accent-gold-muted)' },
  { from: 'rgba(var(--accent-gold-raw, 212, 160, 23), 0.4)', to: 'var(--accent-gold-strong)' },
  { from: 'rgba(var(--accent-gold-raw, 212, 160, 23), 0.5)', to: 'var(--accent-gold-strong)' },
  // Surface overlay patterns
  { from: 'rgba(var(--surface-overlay-raw, 13, 40, 64), 0.8)', to: 'var(--surface-overlay)' },
  { from: 'rgba(var(--surface-overlay-raw, 13, 40, 64), 0.98)', to: 'var(--surface-overlay)' },
];

const CSS_FILES = [
  'styles.css',
  'assets/css/reader.css',
  'assets/css/settings.css',
  'assets/css/sabbath-tester.css',
  'assets/css/events.css',
  'assets/css/symbols.css',
  'assets/css/components.css',
  'assets/css/tutorial.css',
  'assets/css/blog.css',
  'assets/css/bible-styles.css',
  'components/dateline-map.css',
  'components/world-map.css',
];

let grandTotal = 0;
for (const filePath of CSS_FILES) {
  const fullPath = path.resolve(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) continue;
  let content = fs.readFileSync(fullPath, 'utf8');
  let count = 0;
  for (const rule of REPLACEMENTS) {
    const escaped = rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const matches = content.match(regex);
    if (matches) { content = content.replace(regex, rule.to); count += matches.length; }
  }
  if (count > 0) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`  ${filePath}: ${count}`);
    grandTotal += count;
  }
}
console.log(`\nTotal: ${grandTotal} broken rgba(var()) patterns fixed`);
