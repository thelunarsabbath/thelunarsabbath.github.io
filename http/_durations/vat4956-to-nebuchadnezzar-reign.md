# Duration: vat-4956-observation → nebuchadnezzar-reign

## Summary
**From:** `vat-4956-observation`  
**To:** `nebuchadnezzar-reign`  
**Duration:** 36 years  
**Direction:** before  

Nebuchadnezzar's 1st regnal year is 36 years before his 37th year (VAT 4956).

## Calculation

```
nebuchadnezzar-reign-start = vat-4956-observation - 36 years
```

Where:
- `vat-4956-observation` = 568 BC (year 37)
- `nebuchadnezzar-reign-start` = 568 + 36 = 604 BC (year 1)

Note: Year 37 is 36 complete years after year 1.

## Sources

### Primary Source: VAT 4956 Tablet

The VAT 4956 is a Babylonian astronomical diary currently housed in the Berlin Museum. It contains detailed observations from "Year 37 of Nebukadnezar, king of Babylon."

The tablet records:
- Lunar positions relative to stars
- Planetary positions
- Eclipse observations

Modern astronomical software confirms these observations match **only** 568/567 BC.

> "Year 37 of Nebukadnezar, king of Babylon. Month I, the 1st, the moon became visible behind the Bull of Heaven..."

— VAT 4956, Lines 1-3 (Sachs & Hunger translation)

### Supporting Source: Jeremiah

> "The word that came to Jeremiah concerning all the people of Judah in the fourth year of Jehoiakim the son of Josiah king of Judah, that was the first year of Nebuchadrezzar king of Babylon."

— Jeremiah 25:1

This synchronizes Nebuchadnezzar's year 1 with Jehoiakim's year 4.

## Cross-Validation

| Calculation | Result |
|-------------|--------|
| VAT 4956 (year 37 = 568 BC) - 36 years | 604 BC |
| Biblical synchronisms with Judean kings | ~605-604 BC |

## Notes

- VAT 4956 is considered the most reliable anchor for Babylonian chronology
- The astronomical observations are precise enough to eliminate alternative years
- Nebuchadnezzar's accession year was 605 BC; his 1st regnal year was 604 BC

## JSON Reference

```json
{
  "id": "vat4956-to-nebuchadnezzar-reign",
  "title": "VAT 4956 to Nebuchadnezzar Year 1",
  "description": "Nebuchadnezzar's reign dated via astronomical tablet",
  "from_event": "vat-4956-observation",
  "to_event": "nebuchadnezzar-reign",
  "offset": { "years": 36 },
  "direction": "before",
  "article": "/_durations/vat4956-to-nebuchadnezzar-reign.md"
}
```
