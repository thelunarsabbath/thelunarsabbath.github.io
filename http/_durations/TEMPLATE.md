# Duration: [FROM_EVENT] → [TO_EVENT]

## Summary
**From:** `from-event-id`  
**To:** `to-event-id`  
**Duration:** X years/months/days  
**Direction:** after/before  

One sentence description of this duration relationship.

## Calculation

```
to-event = from-event + X years
```

## Sources

### Primary Source
> "Full quote from primary source establishing this duration..."

— Source Reference (e.g., Josephus, Antiquities 17.8.1)

### Supporting Sources
> "Additional quote that confirms or supports..."

— Source Reference

## Cross-Validation

This duration can be validated against:
- `other-event-id`: Should produce consistent dates
- `another-event-id`: Alternative calculation path

## Notes

Any additional context, caveats, or scholarly discussion about this duration.

## JSON Reference

```json
{
  "id": "duration-id",
  "title": "Duration Title",
  "description": "One sentence description",
  "from_event": "from-event-id",
  "to_event": "to-event-id",
  "offset": {
    "years": 0,
    "months": 0,
    "days": 0
  },
  "direction": "after",
  "article": "/_durations/this-file.md"
}
```
