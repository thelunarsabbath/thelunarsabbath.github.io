# Pompey to Herod: 27 Years (Day of Atonement to Day of Atonement)

## Overview

Josephus explicitly states that Herod captured Jerusalem exactly **27 years** after Pompey captured it, and on the **same day** - the Day of Atonement (10th of Tishri).

## Chain Structure

```
pompey-takes-jerusalem (7/10, 63 BC) - ANCHOR
    ↓ +27 years
herod-takes-jerusalem (7/10, 36 BC)
```

## Primary Source

### Josephus, Antiquities 14.16.4
> "This destruction befell the city of Jerusalem when Marcus Agrippa and Caninius Gallus were consuls of Rome, on the hundred eighty and fifth olympiad, on the third month, on the solemnity of the fast, as if a periodical revolution of calamities had returned since that which befell the Jews under Pompey; for **the Jews were taken by him on the same day, and this was after twenty-seven years' time.**"

## Calculation

- Pompey captures Jerusalem: Day of Atonement, 63 BC (7/10/-62 astronomical)
- 27 lunar years later: Day of Atonement, 36 BC (7/10/-35 astronomical)
- Both events on Tishri 10 (Day of Atonement)

## Cross-References

### Josephus, Wars 1.18.2
Confirms Herod's capture occurred during the siege.

### Josephus, Antiquities 14.4.3
> "This was done on the day of the fast"

Confirms Pompey's capture was on Day of Atonement.

### Consular Dating
Marcus Agrippa and Caninius Gallus were consuls in 37 BC (Roman reckoning), which aligns with late 37 BC / early 36 BC in the Jewish calendar.

## Independent Verification: Sabbatical Cycle

The 36 BC date is independently verified by the **sabbatical cycle**:

- 36 BC = **Year 6** of the 7-year sabbatical cycle
- The **sabbath year (year 7)** began Tishri 36 BC
- No planting allowed that fall → no harvest allowed spring 35 BC
- Josephus mentions this sabbatical context in relation to the siege

This provides a completely independent chronological anchor that confirms the 27-year calculation from Pompey.

## Significance

This is a key chronological anchor for Herod's reign:
- **Regal reign** (from Roman appointment): 37 years
- **De facto reign** (from Jerusalem capture): 34 years
- **27-year connection to Pompey** (Josephus explicit)
- **Sabbatical cycle** provides independent verification

## JSON Relationship

```json
{
  "id": "herod-takes-jerusalem",
  "start": {
    "relative": {
      "event": "pompey-takes-jerusalem",
      "offset": { "years": 27 }
    },
    "lunar": { "month": 7, "day": 10 }
  }
}
```
