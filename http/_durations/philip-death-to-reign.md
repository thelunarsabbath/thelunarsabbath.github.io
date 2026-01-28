# Duration: philip-death → philip-reign

## Summary
**From:** `philip-death`  
**To:** `philip-reign`  
**Duration:** 37 years  
**Direction:** before  

Philip the Tetrarch reigned for 37 years using Nisan-to-Nisan (spring-to-spring) reckoning.

## Calculation

```
philip-reign-start = philip-death - 37 lunar years
```

Where:
- `philip-death` = Nisan 1, 36 AD (first Nisan after Tiberius 22nd year begins)
- `philip-reign-start` = 36 - 37 = year -1 (2 BC)

## Sources

### Primary Source
> "Philip also died in the twentieth year of Tiberius, after he had been tetrarch of Trachonitis and Gaulanitis, and of the nation of the Bataneans also, thirty-seven years."

— Josephus, Antiquities 18.4.6

### Reckoning Method

Philip used **Nisan-to-Nisan** regal years (Jewish spring-to-spring), not Roman calendar years. 

**Inclusive counting rule:** If even one day of Philip's 37th year overlaps with Tiberius's 22nd year (which begins Sept 17, 35 AD per Roman exact-date reckoning), then Philip's 37th year ends the following Nisan 1.

## Cross-Validation

- Tiberius 22nd year: Sept 17, 35 AD
- Next Nisan 1: Spring 36 AD
- Philip year 37 ends: Nisan 1, 36 AD
- Philip year 1 begins: Nisan 1, 36 - 37 + 1 = Nisan 1, 2 BC

This confirms Herod died before Nisan 1, 1 BC (so Philip's Year 1 could include part of 2 BC).

## Notes

- The 37 years is using inclusive counting (year 1 through year 37)
- Philip's reign starting in 2 BC is consistent with Herod's death in early 1 BC

## JSON Reference

```json
{
  "id": "philip-death-to-reign",
  "title": "Philip's 37 Year Reign",
  "description": "Philip reigned 37 years as tetrarch",
  "from_event": "philip-death",
  "to_event": "philip-reign",
  "offset": { "years": 37 },
  "direction": "before",
  "article": "/_durations/philip-death-to-reign.md"
}
```
