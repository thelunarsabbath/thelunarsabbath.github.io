# Consonantal Root Connections Feature

## Purpose

Hebrew was originally written without vowel marks (nikud). The vowel pointing was added by the Masoretes (~600-900 AD). The same consonantal letters can be read as completely different words depending on which vowels are applied.

This feature exposes that ambiguity to the user: for any Hebrew word in the interlinear, show all known words that share the same consonants. This helps readers see connections the English translation hides, and lets them evaluate whether the Masoretic vowel choice is the only valid reading.

## Example: Daniel 9:24

The consonants שבעים appear twice. The Masoretes pointed them differently:

- שָׁבֻעִים (shavuim) → H7620 "weeks/sevens"  
- שִׁבְעִים (shivim) → H7657 "seventy"

The shared root שבע (shin-bet-ayin) connects to:

| Strong's | Pointed Form | Meaning |
|----------|-------------|---------|
| H7650 | שָׁבַע | to swear, take an oath ("to seven oneself") |
| H7651 | שֶׁבַע | seven (the sacred full number) |
| H7646 | שָׂבַע | to be satisfied, filled to fullness |
| H7620 | שָׁבוּעַ | a week / a period of seven |
| H7657 | שִׁבְעִים | seventy |

So "seventy weeks" in Hebrew connects seven, oath, and fullness — all from one root.

## Implementation Plan

### Data: Build consonantal root index at runtime

When the Strong's Hebrew dictionary loads, build a lookup table:

```javascript
// In bible-reader.js, after strongsHebrewDictionary is available
let consonantalRootIndex = null;

function buildConsonantalRootIndex() {
  if (consonantalRootIndex) return;
  consonantalRootIndex = {};
  for (const [key, entry] of Object.entries(strongsHebrewDictionary)) {
    if (!key.startsWith('H') || !entry.lemma) continue;
    const consonants = stripAllDiacritics(entry.lemma);
    if (consonants.length < 2) continue;
    if (!consonantalRootIndex[consonants]) consonantalRootIndex[consonants] = [];
    consonantalRootIndex[consonants].push(key);
  }
}
```

No new data files needed — derived from the already-loaded Strong's dictionary.

### UI: "Root Connections" section in Strong's sidebar

In `renderMorphParsingHtml()` (or a new function called alongside it), when a word is opened from the interlinear:

1. Get the consonantal form: `stripAllDiacritics(hebrewText.replace(/\//g, ''))`
2. Look up in `consonantalRootIndex`
3. If multiple entries found, render a "Root Connections" section

```
── Root Connections ──────────────────
Consonants: שבע (without vowel marks)

These consonants can be read as:
  H7651 שֶׁבַע — seven (the sacred full number)
  H7650 שָׁבַע — to swear, take an oath
  H7646 שָׂבַע — to be satisfied, filled
  H7620 שָׁבוּעַ — a week / period of seven  ← current reading

The vowel pointing (added ~600-900 AD) selects one reading.
The consonantal text allows other interpretations.
```

Each Strong's number is clickable (navigates within the sidebar). The current word's entry is marked.

### Functions needed

All exist already:
- `stripAllDiacritics()` — in morphology-decoder.js, strips vowels leaving consonants only
- `getStrongsEntry()` — gets the dictionary entry for any Strong's number
- `navigateToStrongs()` — navigates within the sidebar

### CSS

Reuse the existing `.strongs-morph-parsing` section styles. Each root connection entry is a clickable row showing: Strong's number, voweled form (Hebrew), short gloss.

### Where it appears

- In the Strong's sidebar when opened from an interlinear Hebrew word (has `currentMorphContext`)
- After the Hebrew Parsing section, before the BDB Lexicon section
- Also could appear for ANY Strong's entry (not just from interlinear) by computing consonants from the entry's lemma

### Stats

- 6,243 unique consonantal forms in the Strong's dictionary
- 1,459 of those map to multiple Strong's numbers (the interesting cases)
- The remaining 4,784 have only one Strong's number (shows the reading is unambiguous)
- Index is small (~50KB in memory), built once, instant lookups
