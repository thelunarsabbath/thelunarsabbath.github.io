#!/usr/bin/env node
/**
 * Color Lint Script
 * 
 * Scans CSS and JS files for hardcoded color values that should use theme tokens.
 * Run from project root: node scripts/lint-colors.js
 * 
 * Exits with code 1 if violations found (useful for CI).
 * Use --fix to attempt auto-replacement (same as migrate-theme.js).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Files/patterns to ignore
const IGNORE_PATTERNS = [
  'theme-tokens.css',   // This IS the token definition file
  '_dev/',               // Development/prototype files  
  'node_modules/',
  'dejavuserif.css',     // Legacy third-party
  'scripts/',            // Build/migration scripts
  'lib/',                // Third-party libraries
];

// Patterns that indicate a hardcoded color
const COLOR_PATTERNS = [
  { regex: /#[0-9a-fA-F]{3,8}\b/g, name: 'hex color' },
  { regex: /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g, name: 'rgb/rgba color' },
];

// CSS files to scan
const CSS_GLOBS = [
  'styles.css',
  'assets/css/*.css',
  'components/*.css',
];

// JS files to scan (only for inline styles)
const JS_GLOBS = [
  'views/*.js',
  '*.js',
];

function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(p => filePath.includes(p));
}

function getFiles(patterns, ext) {
  const files = [];
  for (const pattern of patterns) {
    const dir = path.dirname(path.join(ROOT, pattern));
    const glob = path.basename(pattern);
    
    if (!fs.existsSync(dir)) continue;
    
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const relPath = path.relative(ROOT, fullPath);
      
      if (shouldIgnore(relPath)) continue;
      if (!entry.endsWith(ext)) continue;
      
      // Simple glob matching (just *)
      if (glob.includes('*')) {
        const prefix = glob.split('*')[0];
        const suffix = glob.split('*').pop();
        if (entry.startsWith(prefix) && entry.endsWith(suffix)) {
          files.push({ fullPath, relPath });
        }
      } else if (entry === glob) {
        files.push({ fullPath, relPath });
      }
    }
  }
  return files;
}

function scanFile(filePath, relPath, isJS) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) continue;
    
    // For JS files, only check lines with style= or .style.
    if (isJS && !line.includes('style=') && !line.includes('.style.') && !line.includes('style:')) continue;
    
    // Skip lines that already use var()
    // (they might have a hex in a var fallback, which is OK)
    
    for (const pattern of COLOR_PATTERNS) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      while ((match = regex.exec(line)) !== null) {
        // Skip if inside a var() fallback
        const before = line.substring(0, match.index);
        if (before.includes('var(') && !before.includes(')')) continue;
        
        // Skip CSS custom property definitions (--foo: #hex)
        if (line.match(/^\s*--[\w-]+\s*:/)) continue;
        
        violations.push({
          file: relPath,
          line: lineNum,
          match: match[0],
          type: pattern.name,
          context: line.trim().substring(0, 80),
        });
      }
    }
  }
  
  return violations;
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log('Color Lint — Checking for hardcoded colors...');
console.log('='.repeat(60));
console.log('');

const cssFiles = getFiles(CSS_GLOBS, '.css');
const jsFiles = getFiles(JS_GLOBS, '.js');

let allViolations = [];

for (const { fullPath, relPath } of cssFiles) {
  const violations = scanFile(fullPath, relPath, false);
  allViolations.push(...violations);
}

for (const { fullPath, relPath } of jsFiles) {
  const violations = scanFile(fullPath, relPath, true);
  allViolations.push(...violations);
}

// Group by file
const byFile = {};
for (const v of allViolations) {
  if (!byFile[v.file]) byFile[v.file] = [];
  byFile[v.file].push(v);
}

// Report
let totalViolations = 0;
for (const [file, violations] of Object.entries(byFile).sort()) {
  console.log(`${file} (${violations.length} hardcoded colors):`);
  for (const v of violations.slice(0, 5)) {
    console.log(`  L${v.line}: ${v.match} — ${v.context}`);
  }
  if (violations.length > 5) {
    console.log(`  ... and ${violations.length - 5} more`);
  }
  console.log('');
  totalViolations += violations.length;
}

console.log('='.repeat(60));
console.log(`Total: ${totalViolations} hardcoded colors in ${Object.keys(byFile).length} files`);
console.log('');

if (totalViolations > 0) {
  console.log('Tip: Replace these with theme tokens from assets/css/theme-tokens.css');
  console.log('Example: #7ec8e3 → var(--accent-primary)');
  process.exit(1);
} else {
  console.log('All clear — no hardcoded colors found.');
  process.exit(0);
}
