# Duration: herod-death → herod-birth

## Summary
**From:** `herod-death`  
**To:** `herod-birth`  
**Duration:** 70 years  
**Direction:** before  

Herod the Great was approximately 70 years old when he died.

## Calculation

```
herod-birth = herod-death - 70 years
```

## Sources

### Primary Source
> "Herod died... having lived for about seventy years."

— Josephus, Antiquities 17.6.1

### Supporting Sources
> "He was about seventy years old when he died, having reigned thirty-seven years from the time he was appointed king by the Romans, and thirty-four years from when he captured Jerusalem and ousted Antigonus."

— Josephus, Wars 1.33.1

## Cross-Validation

This duration can be validated against:
- `herod-governor-galilee`: Herod appointed at age 15 in 55/54 BC → birth ~70/69 BC
- `herod-death`: Established via lunar eclipse of Jan 10, 1 BC and Philip's reign

| Calculation Path | Result |
|------------------|--------|
| Death (1 BC) - 70 years | ~70 BC |
| Governor (55 BC) - 15 years | ~70 BC |

Both paths converge on approximately 70/69 BC.

## Notes

- Josephus says "about" 70, indicating some uncertainty (±1-2 years)
- The convergence of two independent calculations (age at death, age at appointment) strengthens confidence

## JSON Reference

```json
{
  "id": "herod-death-to-birth",
  "title": "Herod's Age at Death",
  "description": "Herod was about 70 years old when he died",
  "from_event": "herod-death",
  "to_event": "herod-birth",
  "offset": { "years": 70 },
  "direction": "before",
  "article": "/_durations/herod-death-to-birth.md"
}
```
