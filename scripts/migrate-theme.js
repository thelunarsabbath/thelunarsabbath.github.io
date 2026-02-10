#!/usr/bin/env node
/**
 * Theme Migration Script — Pass 3 (final cleanup)
 */
const fs = require('fs');
const path = require('path');

const REPLACEMENTS = [
  // ── Gradient dark endpoints ──
  { from: '#0d1f33', to: 'var(--surface-raised)' },
  { from: '#1f4a6c', to: 'var(--surface-highlight)' },
  
  // ── Remaining white rgba (no spaces variant) ──
  { from: 'rgba(255, 255, 255, 0.85)', to: 'var(--text-primary)' },
  { from: 'rgba(255, 255, 255, 0.7)', to: 'var(--text-secondary)' },
  
  // ── Dark text colors (for light-bg contexts in bible-styles) ──
  { from: '#111', to: 'var(--text-primary)' },
  { from: '#333', to: 'var(--text-primary)' },
  { from: '#000', to: 'var(--text-primary)' },
  
  // ── Muted gray text variants in bible-styles ──
  { from: '#c0c0c0', to: 'var(--text-secondary)' },
  { from: '#b0b0b0', to: 'var(--text-secondary)' },
  { from: '#a0a0a0', to: 'var(--text-secondary)' },
  { from: '#909090', to: 'var(--text-secondary)' },
  { from: '#777', to: 'var(--text-secondary)' },
  
  // ── Bible-styles coded text colors ──
  { from: '#668', to: 'var(--text-tertiary)' },
  { from: '#556', to: 'var(--text-tertiary)' },
  { from: '#445', to: 'var(--text-tertiary)' },
  { from: '#667', to: 'var(--text-tertiary)' },
  { from: '#aac', to: 'var(--text-secondary)' },
  
  // ── Accent blue variants ──
  { from: '#a0c8d8', to: 'var(--accent-primary)' },
  { from: '#a5d8f0', to: 'var(--accent-primary-hover)' },
  { from: '#6db3f2', to: 'var(--accent-primary)' },
  { from: '#8ac8ff', to: 'var(--accent-primary)' },
  
  // ── Strong's purple variants ──
  { from: '#b8a0d8', to: 'var(--color-purple)' },
  { from: '#d0c0f0', to: 'var(--color-purple-light)' },
  { from: '#c8b8e8', to: 'var(--color-purple)' },
  { from: '#e0d8f8', to: 'var(--color-purple-light)' },
  { from: '#a855f7', to: 'var(--color-purple)' },
  { from: '#d8b4fe', to: 'var(--color-purple-light)' },
  
  // ── Status color variants ──
  { from: '#4ade80', to: 'var(--color-success)' },
  { from: '#f87171', to: 'var(--color-error)' },
  { from: '#fbbf24', to: 'var(--color-warning)' },
  
  // ── Gold/yellow/warning rgba variants ──
  { from: 'rgba(255, 215, 0, 0.7)', to: 'var(--accent-gold)' },
  { from: 'rgba(255, 215, 0, 0.5)', to: 'var(--accent-gold-strong)' },
  { from: 'rgba(255, 215, 0, 0.4)', to: 'var(--accent-gold-strong)' },
  { from: 'rgba(255, 215, 0, 0.1)', to: 'var(--accent-gold-subtle)' },
  { from: 'rgba(255, 200, 100, 0.2)', to: 'var(--accent-gold-muted)' },
  { from: 'rgba(255, 200, 100, 0.1)', to: 'var(--accent-gold-subtle)' },
  { from: 'rgba(255, 200, 100, 0.5)', to: 'var(--accent-gold-strong)' },
  { from: 'rgba(255, 180, 100, 0.2)', to: 'var(--accent-gold-muted)' },
  { from: 'rgba(255, 180, 100, 0.5)', to: 'var(--accent-gold-strong)' },
  { from: 'rgba(255, 193, 7, 0.15)', to: 'var(--accent-gold-subtle)' },
  { from: 'rgba(255, 193, 7, 0.4)', to: 'var(--accent-gold-strong)' },
  { from: 'rgba(255, 193, 7, 0.1)', to: 'var(--accent-gold-subtle)' },
  
  // ── Blue rgba variants ──
  { from: 'rgba(100, 200, 255, 0.6)', to: 'var(--accent-primary)' },
  { from: 'rgba(100, 200, 255, 0.4)', to: 'var(--accent-primary-strong)' },
  { from: 'rgba(100, 160, 255, 0.3)', to: 'var(--accent-primary-muted)' },
  { from: 'rgba(100, 160, 255, 0.25)', to: 'var(--accent-primary-muted)' },
  { from: 'rgba(100, 160, 255, 0.15)', to: 'var(--accent-primary-subtle)' },
  { from: 'rgba(100, 160, 255, 0.1)', to: 'var(--accent-primary-subtle)' },
  { from: 'rgba(100, 160, 255, 0.08)', to: 'var(--accent-primary-subtle)' },
  { from: 'rgba(100, 160, 255, 0.2)', to: 'var(--accent-primary-muted)' },
  { from: 'rgba(100, 160, 255, 0.5)', to: 'var(--accent-primary-strong)' },
  { from: 'rgba(100, 150, 255, 0.2)', to: 'var(--accent-primary-muted)' },
  { from: 'rgba(100, 150, 255, 0.5)', to: 'var(--accent-primary-strong)' },
  { from: 'rgba(100, 150, 255, 0.15)', to: 'var(--accent-primary-subtle)' },
  { from: 'rgba(100, 150, 255, 0.4)', to: 'var(--accent-primary-strong)' },
  { from: 'rgba(74, 158, 255, 0.3)', to: 'var(--accent-primary-muted)' },
  { from: 'rgba(74, 158, 255, 0.5)', to: 'var(--accent-primary-strong)' },
  { from: 'rgba(42, 90, 140, 0.5)', to: 'var(--accent-primary-muted)' },
  { from: 'rgba(42, 90, 140, 0.6)', to: 'var(--accent-primary-muted)' },
  { from: 'rgba(42, 90, 140, 0.3)', to: 'var(--accent-primary-subtle)' },
  { from: 'rgba(26, 58, 92, 0.8)', to: 'var(--accent-primary-muted)' },
  { from: 'rgba(100, 140, 200, 0.2)', to: 'var(--accent-primary-subtle)' },
  { from: 'rgba(100, 140, 200, 0.15)', to: 'var(--accent-primary-subtle)' },
  { from: 'rgba(100, 150, 200, 0.2)', to: 'var(--accent-primary-muted)' },
  { from: 'rgba(100, 150, 200, 0.4)', to: 'var(--accent-primary-strong)' },
  { from: 'rgba(90, 120, 180, 0.15)', to: 'var(--accent-primary-subtle)' },
  { from: 'rgba(100, 140, 180, 0.15)', to: 'var(--accent-primary-subtle)' },
  
  // ── Green rgba variants ──
  { from: 'rgba(50, 200, 100, 0.6)', to: 'var(--color-success)' },
  { from: 'rgba(100, 180, 100, 0.06)', to: 'var(--color-success-muted)' },
  { from: 'rgba(100, 180, 100, 0.5)', to: 'var(--color-success)' },
  { from: 'rgba(100, 200, 100, 0.15)', to: 'var(--color-success-muted)' },
  { from: 'rgba(100, 200, 100, 0.3)', to: 'var(--color-success-muted)' },
  { from: 'rgba(100, 200, 100, 0.25)', to: 'var(--color-success-muted)' },
  { from: 'rgba(100, 200, 150, 0.3)', to: 'var(--color-success-muted)' },
  { from: 'rgba(144, 238, 144, 0.1)', to: 'var(--color-success-muted)' },
  { from: 'rgba(144, 238, 144, 0.4)', to: 'var(--color-success-muted)' },
  { from: 'rgba(74, 122, 92, 0.2)', to: 'var(--color-success-muted)' },
  
  // ── Purple rgba variants ──
  { from: 'rgba(150, 50, 200, 0.5)', to: 'var(--color-purple-muted)' },
  { from: 'rgba(138, 43, 226, 0.15)', to: 'var(--color-purple-muted)' },
  { from: 'rgba(138, 43, 226, 0.08)', to: 'var(--color-purple-subtle)' },
  { from: 'rgba(138, 43, 226, 0.3)', to: 'var(--color-purple-muted)' },
  { from: 'rgba(138, 43, 226, 0.2)', to: 'var(--color-purple-muted)' },
  { from: 'rgba(201, 160, 220, 0.1)', to: 'var(--color-purple-subtle)' },
  
  // ── Red/error rgba variants ──
  { from: 'rgba(255, 100, 100, 0.15)', to: 'var(--color-error-muted)' },
  { from: 'rgba(255, 100, 100, 0.8)', to: 'var(--color-error)' },
  { from: 'rgba(140, 60, 60, 0.2)', to: 'var(--color-error-muted)' },
  
  // ── Gray/neutral rgba ──
  { from: 'rgba(100, 100, 100, 0.2)', to: 'var(--surface-hover)' },
  { from: 'rgba(150, 150, 150, 0.3)', to: 'var(--border-default)' },
  { from: 'rgba(100, 150, 200, 0.15)', to: 'var(--accent-primary-subtle)' },
  
  // ── Dark overlay backgrounds ──
  { from: 'rgba(0, 0, 0, 0.7)', to: 'var(--surface-scrim)' },
  { from: 'rgba(0, 0, 0, 0.85)', to: 'var(--surface-scrim)' },
  { from: 'rgba(0, 0, 0, 0.15)', to: 'var(--surface-scrim)' },
  { from: 'rgba(0, 0, 0, 0.1)', to: 'var(--surface-scrim)' },
  
  // ── Gold text rgba ──
  { from: 'rgba(100, 70, 10, 0.4)', to: 'var(--accent-gold-strong)' },
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

function processFile(filePath) {
  const fullPath = path.resolve(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) return { file: filePath, replacements: 0 };
  let content = fs.readFileSync(fullPath, 'utf8');
  let total = 0;
  for (const rule of REPLACEMENTS) {
    const escaped = rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const matches = content.match(regex);
    if (matches) { content = content.replace(regex, rule.to); total += matches.length; }
  }
  fs.writeFileSync(fullPath, content, 'utf8');
  return { file: filePath, replacements: total };
}

console.log('Theme Migration — Pass 3 (final cleanup)');
console.log('='.repeat(60));
let grandTotal = 0;
for (const file of CSS_FILES) {
  const result = processFile(file);
  if (result.replacements > 0) console.log(`  ${result.file}: ${result.replacements}`);
  grandTotal += result.replacements;
}
console.log(`\nTotal: ${grandTotal} replacements`);
