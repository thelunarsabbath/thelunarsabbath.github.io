# Historical Events JSON Schema Specification

## Overview

This schema defines the structure for biblical and historical events used throughout the Time Tested application. Events are used for:

1. **Timeline visualization** - Plotting events on a timeline with duration bars
2. **Calendar integration** - Showing events on specific calendar days
3. **Sabbath testing** - Validating calendar theories against known events
4. **Cross-referencing** - Linking events to chapters, articles, and related events

## Core Principle: Events and Durations

The chronological data is structured like a **spreadsheet** where:
- **Events** = Points in time (cells with values or formulas)
- **Durations** = Relationships between events (formulas linking cells)

### Events (Points in Time)

Each event represents a specific moment with either:
- **Stipulated date** (white in debug table) - Directly specified lunar date
- **Calculated date** (blue in debug table) - Derived from another event via duration

**Primary calendar:** Lunar (month/day/year)  
**Secondary calendar:** Gregorian (always calculated from Julian Day)

### Durations (Evidence/Testimony)

The `durations` array contains **lines of evidence** - claims from sources about the time between events.

**Key distinction:**
- **Events table** = The math we're actually doing (contains `relative` formulas)
- **Durations table** = Documentary evidence for that math (can have multiple per event pair)

```
Event B = Event A ± Duration (defined in event.start.relative)
Duration record = testimony that A to B is X years (validation)
```

**Validation process:**
1. Resolver calculates events using their `relative` formulas
2. For each duration, compare `claimed` offset to actual calculated difference
3. Mismatches flag errors in original testimony ("doesn't overlap")

Multiple durations can point to same event pair (cross-validation).

### Durations Schema

```json
{
  "durations": [
    {
      "id": "josephus-pompey-herod-27y",
      "title": "Pompey to Herod: 27 Years",
      "from_event": "pompey-takes-jerusalem",
      "to_event": "herod-takes-jerusalem",
      "claimed": { 
        "years": 27,
        "months": 0,
        "days": 0,
        "approximate": false,
        "reckoning": "lunar"
      },
      "source": {
        "ref": "Josephus, Antiquities 14.16.4",
        "type": "historical|scripture|astronomical|chronological",
        "quote": "after twenty-seven years' time"
      },
      "doc": "_durations/pompey-to-herod-jerusalem.md",
      "validates": true,
      "notes": "Optional clarification"
    }
  ]
}
```

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier |
| `title` | Yes | Human-readable title |
| `from_event` | Yes | Start event ID |
| `to_event` | Yes | End event ID |
| `claimed` | Yes | The claimed offset (years/months/days) |
| `source` | Yes | Citation with ref, type, and quote |
| `doc` | No | Link to markdown documentation |
| `validates` | No | Secondary validation source (not primary) |
| `notes` | No | Clarification or discrepancy notes |

### Date Anchors

Some dates are **fixed anchors** (astronomically or historically attested):
- Eclipses (e.g., Jan 10, 1 BC lunar eclipse before Herod's death)
- Astronomical tablets (e.g., VAT 4956 for Nebuchadnezzar's 37th year)
- Roman records (e.g., Tiberius accession Sept 17, 14 AD)

All other dates are **derived** through duration chains back to these anchors.

---

## Data vs Computed Values

The JSON stores **source data** - what scripture or history actually states. The application **computes** Julian Day numbers at runtime based on the user's calendar profile settings.

### Date Certainty Levels

1. **Fixed Gregorian** - Astronomically attested (eclipses, astronomical tablets)
2. **Fixed Lunar** - Scripture gives complete lunar date (month/day/year)
3. **Relative** - Defined by offset from another event (duration formula)
4. **Partial Lunar** - Month/day known, year derived from reference chain

---

## Schema Structure

### Required Fields

```json
{
  "id": "unique-identifier",
  "title": "Event Title",
  "type": "event-type"
}
```

### Complete Event Template

```json
{
  "id": "example-event",
  "title": "Example Event Title",
  "type": "milestone",
  "description": "Detailed description of the event...",
  
  "start": {
    "fixed": {
      "julian_day": 1720693,
      "gregorian": { "year": -31, "month": 9, "day": 2 },
      "source": "Roman records, astronomical verification"
    },
    "lunar": {
      "month": 7,
      "day": 10,
      "time_of_day": "evening",
      "calendar_source": "babylonian-crescent"
    },
    "anno_mundi": { "year": 1656, "month": 2, "day": 17 },
    "regal": {
      "epoch": "herod-regal",
      "year": 7
    },
    "relative": {
      "event": "other-event-id",
      "offset": { "years": 40, "months": 0, "days": 0 },
      "direction": "after"
    }
  },
  
  "end": {
    "fixed": { ... },
    "lunar": { ... },
    "regal": { ... },
    "event": "ending-event-id",
    "relative": { ... }
  },
  
  "duration": {
    "value": 37,
    "unit": "regal_years",
    "reckoning": "spring-to-spring",
    "notes": "Josephus: reigned 37 years from Roman appointment"
  },
  
  "certainty": "high",
  "priority": 1,
  "sources": [
    {
      "ref": "Genesis 7:11",
      "type": "scripture",
      "quote": "In the six hundredth year of Noah's life..."
    },
    {
      "ref": "Josephus, Antiquities 14.14.5",
      "type": "historical",
      "quote": "..."
    }
  ],
  "tags": ["tag1", "tag2"],
  "article": "/chapters/chapter-name/",
  "anniversary_display": false,
  "notes": "Additional notes..."
}
```

---

## Field Definitions

### `id` (required)
Unique identifier for the event. Use lowercase with hyphens.
```
"id": "herod-senate-appointment"
```

### `title` (required)
Display title. May include emoji prefix for visual categorization.
```
"title": "🚢 Noah Enters the Ark"
```

### `type` (required)
Event classification. Used for filtering, icons, and styling.

| Type | Description | Icon |
|------|-------------|------|
| `milestone` | Major turning points (Creation, Exodus, Crucifixion) | ⭐ |
| `biblical-event` | Significant biblical occurrences | 📖 |
| `birth` | Birth of a person | 👶 |
| `death` | Death of a person | ✝️ |
| `reign` | Beginning of a king's reign | 👑 |
| `construction` | Building projects (Temple, etc.) | 🏛️ |
| `conquest` | Military victories, captures | ⚔️ |
| `decree` | Official proclamations, edicts | 📜 |
| `captivity` | Exile, imprisonment events | ⛓️ |
| `astronomical` | Eclipses, celestial events | 🌑 |
| `feast` | Appointed times, festivals | 🎉 |
| `prophecy` | Prophetic fulfillment | 🔮 |
| `catastrophe` | Disasters, judgments | 💥 |
| `battle` | Military engagements | ⚔️ |
| `invasion` | Foreign attacks | 🏹 |

### `description`
Detailed description including historical context, scripture references, and significance.

---

## Date Specification (`start` and `end`)

Events can specify dates in multiple ways. The resolver uses them in priority order:

### Priority Order for Resolution

1. `fixed.julian_day` - Absolute, no calculation needed
2. `fixed.gregorian` - Convert to Julian Day directly
3. `regal` - Requires epoch lookup + reckoning rules
4. `lunar` - Requires calendar profile (month start, year start)
5. `anno_mundi` - Requires AM-to-Gregorian conversion
6. `relative` - Requires resolving referenced event first
7. `event` - End is defined by another event's start

### `fixed` - Astronomically/Historically Certain Dates

Use when the Julian/Gregorian date is **independently attested** (not derived from biblical chronology).

```json
"start": {
  "fixed": {
    "julian_day": 1720693,
    "gregorian": { "year": -31, "month": 9, "day": 2 },
    "source": "Battle of Actium - Plutarch, Dio Cassius, astronomical records"
  }
}
```

**When to use `fixed`:**
- Eclipses verified by NASA data
- Events dated by multiple independent Roman/Greek sources
- Inscriptions with explicit dates (OGIS 532, etc.)
- Babylonian astronomical diaries (VAT 4956)

**When NOT to use `fixed`:**
- Dates derived from biblical chronology
- Dates calculated from reign lengths
- Dates where only lunar month/day is certain

### `lunar` - Biblical Lunar Calendar Dates

Use when scripture specifies month and/or day in the lunar calendar.

```json
"start": {
  "lunar": {
    "month": 1,
    "day": 14,
    "time_of_day": "evening",
    "calendar_source": null
  }
}
```

**Fields:**
- `month` (1-13): Lunar month (1=Nisan, 7=Tishri, 13=Adar II)
- `day` (1-30): Day of lunar month
- `time_of_day`: "morning", "evening", "night", "dawn", "dusk", "noon", "midnight"
- `calendar_source`: Override for non-biblical calendars
  - `null` or omitted: Use user's profile settings
  - `"babylonian-crescent"`: Babylonian calendar (crescent moon start)
  - `"islamic-crescent"`: Islamic calendar
  - `"rabbinic"`: Calculated Jewish calendar

**Profile-Dependent Resolution:**
When `calendar_source` is null, the app applies the user's settings:
- Month start: Crescent, Full Moon, Conjunction
- Day start: Sunset, Sunrise, Dawn
- Year start: Spring equinox method

### `anno_mundi` - Year from Creation

Use for events dated by years from Creation (AM = Anno Mundi).

```json
"start": {
  "anno_mundi": {
    "year": 1656,
    "month": 2,
    "day": 17
  }
}
```

**Conversion:** AM year → Gregorian requires a reference point.
Default: AM 1 ≈ 4000 BC (adjustable based on chronology model)

### `regal` - Regnal Year Dating

Use when scripture or history dates events by a king's reign.

```json
"start": {
  "regal": {
    "epoch": "herod-regal",
    "year": 18
  }
}
```

**Resolution requires:**
1. Looking up the epoch definition
2. Applying the reckoning system (spring-to-spring, fall-to-fall, accession-year)
3. Calculating Julian Day from epoch start + years

### `relative` - Offset from Another Event

Use when an event is defined by its relationship to another.

```json
"start": {
  "relative": {
    "event": "exodus-from-egypt",
    "offset": { "years": 480 },
    "direction": "after"
  }
}
```

**Fields:**
- `event`: ID of the reference event
- `offset`: { `years`, `months`, `weeks`, `days` }
- `direction`: `"before"` or `"after"`

### `event` - End Defined by Another Event

Use when the end point IS another event.

```json
"end": {
  "event": "herod-death"
}
```

---

## Duration Specification

Duration defines the span from start to end. Use when:
- The source specifies a duration (e.g., "reigned 40 years")
- End date is not independently known

```json
"duration": {
  "value": 40,
  "unit": "lunar_years",
  "reckoning": "nisan-to-nisan",
  "notes": "Scripture: 'The Israelites ate manna forty years'"
}
```

### `unit` Values

| Unit | Description | Length |
|------|-------------|--------|
| `lunar_years` | 12 lunar months (DEFAULT) | ~354.37 days |
| `solar_years` | Gregorian/Julian years | 365.2422 days |
| `regal_years` | King's regnal years | Depends on reckoning |
| `months` | Lunar months | ~29.53 days |
| `weeks` | 7-day weeks (solar) | 7 days |
| `lunar_weeks` | Lunar weeks (sabbaths on 8, 15, 22, 29) | ~7.38 days avg |
| `days` | Days | 1 day |

**Important:** Biblical years are assumed to be `lunar_years` unless explicitly specified otherwise. Use `solar_years` only for events whose duration is definitively measured by the Gregorian/Julian calendar (e.g., Roman records, modern dates).

**Note on Lunar Weeks:**
In the lunar sabbath system, weeks reset with each new moon. Sabbaths fall on days 8, 15, 22, and 29 of each lunar month. A "lunar week" spans from one lunar sabbath to the next (typically 7 days, but the 4th week spans to the new moon).

### `reckoning` Values

| Reckoning | Description |
|-----------|-------------|
| `spring-to-spring` | Year begins at Nisan 1 |
| `fall-to-fall` | Year begins at Tishri 1 |
| `accession-year` | First partial year is "year 0" |
| `non-accession` | First partial year is "year 1" |
| `exact-date` | From exact appointment date |

---

## Multiple Durations (Prophecies)

For events that mark the start of multiple prophetic periods:

```json
{
  "id": "first-captivity-daniel",
  "title": "First Captivity - Daily Sacrifice Taken Away",
  "start": {
    "gregorian": { "year": -598 },
    "regal": { "epoch": "nebuchadnezzar", "year": 7 }
  },
  "prophecies": [
    {
      "id": "1290-years",
      "duration": { "value": 1290, "unit": "lunar_years" },
      "end_event": "dome-of-rock",
      "source": "Daniel 12:11"
    },
    {
      "id": "1335-years",
      "duration": { "value": 1335, "unit": "lunar_years" },
      "end_event": "1335-endpoint",
      "source": "Daniel 12:12"
    }
  ]
}
```

The timeline renderer expands these into separate duration bars.

---

## Epochs Definition

Epochs define reference points for regal year calculations.

```json
"epochs": {
  "herod-regal": {
    "name": "Herod the Great (Regal)",
    "start": {
      "fixed": {
        "gregorian": { "year": -38, "month": 4, "day": 1 },
        "notes": "First Nisan after Senate appointment in 39 BC"
      }
    },
    "reckoning": "spring-to-spring",
    "duration": { "value": 37, "unit": "regal_years" },
    "notes": "From Roman Senate appointment. Josephus: 'reigned 37 years from when the Romans declared him king.'"
  },
  "tiberius": {
    "name": "Tiberius Caesar",
    "start": {
      "fixed": {
        "gregorian": { "year": 14, "month": 9, "day": 17 },
        "source": "Senate investiture - exact date"
      }
    },
    "reckoning": "exact-date",
    "duration": { "value": 23, "unit": "solar_years" }
  }
}
```

---

## Metadata Fields

### `certainty`
Confidence level in the date accuracy.

| Value | Meaning |
|-------|---------|
| `high` | Multiple independent attestations, astronomically verified |
| `medium` | Single good source, some calculation involved |
| `low` | Uncertain, based on inference or tradition |
| `theological` | Date has theological significance but historical uncertainty |

### `sources`
Array of source citations.

```json
"sources": [
  {
    "ref": "Genesis 7:11",
    "type": "scripture",
    "quote": "In the six hundredth year of Noah's life, in the second month..."
  },
  {
    "ref": "Josephus, Antiquities 17.8.1",
    "type": "historical",
    "quote": "..."
  },
  {
    "ref": "NASA Eclipse Catalog",
    "type": "astronomical"
  }
]
```

**Source types:** `scripture`, `historical`, `astronomical`, `archaeological`, `traditional`

### `tags`
Array of searchable tags for filtering and categorization.

```json
"tags": ["flood", "noah", "judgment", "days-of-noah"]
```

### `article`
Link to related chapter or article.

```json
"article": "/chapters/13_Herod_the_Great/"
```

### `anniversary_display`
Controls whether event appears on calendar day view each year.

- `true` or omitted: Show as annual anniversary (feasts, observances)
- `false`: One-time historical event (births, deaths, battles)

### `notes`
Additional notes not part of description.

---

## Resolution Algorithm

The app resolves events to Julian Day ranges using this algorithm:

```javascript
function resolveEventToJulianDays(event, profile, epochs, allEvents) {
  const startJD = resolveDate(event.start, profile, epochs, allEvents);
  
  let endJD = null;
  
  if (event.end) {
    endJD = resolveDate(event.end, profile, epochs, allEvents);
  } else if (event.duration) {
    endJD = applyDuration(startJD, event.duration, profile);
  }
  
  return { startJD, endJD };
}

function resolveDate(dateSpec, profile, epochs, allEvents) {
  // Priority order:
  if (dateSpec.fixed?.julian_day) {
    return dateSpec.fixed.julian_day;
  }
  
  if (dateSpec.fixed?.gregorian) {
    return gregorianToJulianDay(dateSpec.fixed.gregorian);
  }
  
  if (dateSpec.regal) {
    const epoch = epochs[dateSpec.regal.epoch];
    const epochStartJD = resolveDate(epoch.start, profile, epochs, allEvents);
    return applyRegalYears(epochStartJD, dateSpec.regal.year, epoch.reckoning, profile);
  }
  
  if (dateSpec.lunar) {
    const calendarSource = dateSpec.lunar.calendar_source || profile.monthStart;
    return lunarToJulianDay(dateSpec.lunar, calendarSource, profile);
  }
  
  if (dateSpec.anno_mundi) {
    return annoMundiToJulianDay(dateSpec.anno_mundi, profile.amEpoch);
  }
  
  if (dateSpec.relative) {
    const refEvent = allEvents.find(e => e.id === dateSpec.relative.event);
    const refJD = resolveEventToJulianDays(refEvent, profile, epochs, allEvents).startJD;
    return applyOffset(refJD, dateSpec.relative.offset, dateSpec.relative.direction, profile);
  }
  
  if (dateSpec.event) {
    const refEvent = allEvents.find(e => e.id === dateSpec.event);
    return resolveEventToJulianDays(refEvent, profile, epochs, allEvents).startJD;
  }
  
  return null;
}
```

---

## Migration Notes

### Converting from Old Schema

| Old Format | New Format |
|------------|------------|
| `dates.gregorian.year` | `start.gregorian.year` or `start.fixed.gregorian.year` |
| `dates.lunar` | `start.lunar` |
| `dates.regal` | `start.regal` |
| `duration: { years: 40 }` | `duration: { value: 40, unit: "lunar_years" }` |
| `duration_years: 40` (epochs) | `duration: { value: 40, unit: "regal_years" }` |
| `durations: [...]` | `prophecies: [...]` |
| `end_dates` | `end` |
| `relative_to` | `start.relative` or keep for documentation |

### Backwards Compatibility

During migration, the resolver should handle both old and new formats:

```javascript
function normalizeEvent(event) {
  if (event.dates && !event.start) {
    // Convert old format to new
    event.start = {
      gregorian: event.dates.gregorian,
      lunar: event.dates.lunar,
      anno_mundi: event.dates.anno_mundi,
      regal: event.dates.regal
    };
  }
  // ... additional normalization
  return event;
}
```

---

## Examples

### Fixed Gregorian Date (Battle of Actium)
```json
{
  "id": "battle-of-actium",
  "title": "Battle of Actium",
  "type": "battle",
  "start": {
    "fixed": {
      "gregorian": { "year": -31, "month": 9, "day": 2 },
      "source": "Plutarch, Dio Cassius - astronomically verified"
    },
    "regal": { "epoch": "herod-regal", "year": 7 }
  },
  "certainty": "high"
}
```

### Lunar Date with Year (Passover/Exodus)
```json
{
  "id": "exodus-from-egypt",
  "title": "Exodus from Egypt",
  "type": "milestone",
  "start": {
    "gregorian": { "year": -1446 },
    "lunar": { "month": 1, "day": 15 }
  },
  "certainty": "high"
}
```

### Regal Duration (Herod's Reign)
```json
{
  "id": "herod-senate-appointment",
  "title": "Roman Senate Appoints Herod King",
  "type": "reign",
  "start": {
    "gregorian": { "year": -39, "month": 4 }
  },
  "end": {
    "event": "herod-death"
  },
  "duration": {
    "value": 37,
    "unit": "regal_years",
    "reckoning": "spring-to-spring"
  },
  "defines_epoch": {
    "id": "herod-regal",
    "name": "Herod the Great (Regal)"
  },
  "certainty": "high"
}
```

### Relative Date (480 Years After Exodus)
```json
{
  "id": "solomon-temple-construction",
  "title": "Construction of Solomon's Temple",
  "type": "construction",
  "start": {
    "lunar": { "month": 2 },
    "regal": { "epoch": "solomon", "year": 4 },
    "relative": {
      "event": "exodus-from-egypt",
      "offset": { "years": 480 },
      "direction": "after"
    }
  },
  "duration": { "value": 7, "unit": "lunar_years" },
  "certainty": "high"
}
```

### Prophetic Durations
```json
{
  "id": "first-captivity-daniel",
  "title": "First Captivity - Daily Sacrifice Taken Away",
  "type": "captivity",
  "start": {
    "gregorian": { "year": -598 },
    "regal": { "epoch": "nebuchadnezzar", "year": 7 }
  },
  "prophecies": [
    {
      "id": "1290-years",
      "title": "1290 Lunar Years (Daniel 12:11)",
      "duration": { "value": 1290, "unit": "lunar_years" },
      "end_event": "dome-of-rock"
    },
    {
      "id": "1335-years",
      "title": "1335 Lunar Years (Daniel 12:12)",
      "duration": { "value": 1335, "unit": "lunar_years" }
    }
  ],
  "certainty": "medium"
}
```
