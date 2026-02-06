# Feature Inventory - Time-Tested Calendar Application

**Purpose**: This document serves as the acceptance checklist for the refactoring to `http-v2/`. Every feature listed here must work in the new version before cutover.

**Status Legend**: 
- [ ] Not started
- [~] In progress
- [x] Complete and verified

---

## Table of Contents

1. [Calendar View](#1-calendar-view)
2. [Day Detail Panel](#2-day-detail-panel)
3. [Bible Reader](#3-bible-reader)
4. [Biblical Timeline](#4-biblical-timeline)
5. [Historical Events](#5-historical-events)
6. [Settings & Profiles](#6-settings--profiles)
7. [Priestly Divisions](#7-priestly-divisions)
8. [Sabbath Tester](#8-sabbath-tester)
9. [Torah Portions](#9-torah-portions)
10. [Jubilee Cycle](#10-jubilee-cycle)
11. [World Clock](#11-world-clock)
12. [Book/Chapters](#12-bookchapters)
13. [Navigation & URL Routing](#13-navigation--url-routing)
14. [LocalStorage Keys](#14-localstorage-keys)
15. [PWA Features](#15-pwa-features)

---

## 1. Calendar View

### Calendar Header
- [ ] Jubilee indicator row (Jubilee X, Week Y, Year Z)
- [ ] Jubilee year special styling (trumpet icon)
- [ ] Sabbath year special styling (grain icon)
- [ ] Jubilee info link (opens modal)
- [ ] Year dropdown (click opens year picker)
- [ ] Month dropdown (click opens month picker)
- [ ] Time display (click opens time picker)
- [ ] Location dropdown (click opens location picker)

### Day 1 (New Moon) Box
- [ ] Gregorian date display (short format)
- [ ] Year display (BC for negative years)
- [ ] Moon phase icon (full/dark/crescent)
- [ ] Lunar day number (1)
- [ ] Feast icons (if applicable)
- [ ] Event icons (historical/biblical)
- [ ] Blood moon indicator for lunar eclipses
- [ ] Click selects day and opens detail panel
- [ ] Highlighted state when selected
- [ ] Today highlighting
- [ ] Date uncertainty indicator (+/-)

### Week Header
- [ ] 7 columns labeled "Day 1" through "Day 7"
- [ ] Weekday labels aligned to Day 2's weekday
- [ ] Sabbath column highlighting based on sabbathMode

### Day Cycle Bar
- [ ] Visual gradient showing day/night cycle
- [ ] Based on Day 1's sunrise/sunset times
- [ ] Daylight percentage display
- [ ] Gradient direction changes based on dayStartTime

### Calendar Grid (Days 2-30)
- [ ] 4 lunar weeks (Days 2-8, 9-15, 16-22, 23-29)
- [ ] Last row with Day 30 (if exists)
- [ ] Gregorian date in each cell
- [ ] Moon phase icon in each cell
- [ ] Lunar day number in each cell
- [ ] Feast icons (multiple supported)
- [ ] Event icons (historical/biblical)
- [ ] Equinox icon when applicable
- [ ] Blood moon indicator
- [ ] Click selects day and opens detail panel
- [ ] Highlighted state when selected
- [ ] Sabbath styling
- [ ] Feast day styling
- [ ] Today highlighting
- [ ] Date uncertainty indicator
- [ ] Hover tooltip with feast names, uncertainty info

### Navigation Controls
- [ ] Previous/Next Month arrows
- [ ] Previous/Next Year arrows
- [ ] Year wrap indication in tooltips
- [ ] Scripture quote in last row (rotates by month)

### Month Buttons
- [ ] 12 month buttons always visible
- [ ] Month 13 button appears in leap years only
- [ ] Active month highlighted
- [ ] Disabled if month doesn't exist
- [ ] Click switches to that month

### Year Start Uncertainty Banner
- [ ] Shows when Nisan moon is close to year start boundary
- [ ] Displays probability and direction
- [ ] Warning about potential 1-month shift

### Feast Table
- [ ] Lists all feasts for the year
- [ ] Sortable by Gregorian date
- [ ] Columns: Feast name, Lunar date, Gregorian date, Description
- [ ] Feast names clickable (jump to date)
- [ ] Handles multi-day feasts spanning months

---

## 2. Day Detail Panel

### Header
- [ ] Lunar date: "Day X of the Nth Month"
- [ ] Gregorian date (clickable for time picker)
- [ ] Priestly course with order number and meaning
- [ ] Priestly nav buttons (previous/next service)
- [ ] Priestly info icon (popup with notes/famous people)
- [ ] Priestly course clickable (opens priestly page)
- [ ] Astronomical times (daybreak, sunrise, sunset, twilight)

### Feasts Section
- [ ] List all feasts for the day
- [ ] Each feast shows icon, name, description
- [ ] Day number for multi-day feasts
- [ ] Basis explanation (moon event timing)
- [ ] Stellarium link for Renewed Moon/Day 1
- [ ] Uncertainty warning if applicable
- [ ] "Learn more" link to chapter

### Special Sections
- [ ] Spring equinox info when applicable
- [ ] Blood moon (lunar eclipse) info when applicable
- [ ] Date uncertainty warning
- [ ] Year start explanation (Day 1 of Month 1)
- [ ] Intercalary month explanation (Day 1 of Month 13)

### Biblical Events
- [ ] List historical/biblical events on this lunar date
- [ ] Title with description
- [ ] Scripture verse (clickable)
- [ ] Quote display (if available)
- [ ] Image display (if available)
- [ ] Expandable details section
- [ ] Book chapter link
- [ ] Condition badges (Sabbath Year, Jubilee Year, Original Event, Anniversary)
- [ ] Calendar link (jump to event's original year)

### Torah Portion
- [ ] Shows Torah portion for Sabbath days
- [ ] Format varies by sabbathMode
- [ ] Holiday replacements when applicable

### Additional Info
- [ ] Sabbath label with appropriate name
- [ ] Moon phase for non-Day-1 days

### Dateline Visualization
- [ ] Shows for Day 1 only
- [ ] Visual representation across timezones

---

## 3. Bible Reader

### Bible Text Display
- [ ] KJV translation (default)
- [ ] ASV translation
- [ ] Translation selector dropdown
- [ ] Translation preference saved to localStorage
- [ ] Book dropdown with OT/NT optgroups
- [ ] Chapter dropdown (populated per book)
- [ ] Chapter grid buttons
- [ ] Chapter title display
- [ ] Verse numbers as superscripts
- [ ] Clickable Strong's words in verse text

### Welcome Screen
- [ ] Translation cards
- [ ] Quick start buttons (Genesis 1, Psalm 23, John 1, Revelation 1)

### Navigation
- [ ] Previous/Next chapter buttons
- [ ] History navigation (Back/Forward buttons)
- [ ] URL pattern: `/bible/{translation}/{book}/{chapter}?verse={verse}`
- [ ] Browser back/forward support
- [ ] URL updated on navigation

### Strong's Panel (Sidebar)
- [ ] Slide-out sidebar from right edge
- [ ] Resizable (drag handle)
- [ ] Width persisted in localStorage
- [ ] History navigation in panel
- [ ] Close button
- [ ] Strong's number display (H1234, G5678)
- [ ] English word
- [ ] Lemma (original language)
- [ ] Transliteration with pronunciation
- [ ] Definition
- [ ] KJV usage
- [ ] Derivation (links to Hebrew for Greek words)
- [ ] Symbolic meaning (IS/DOES fields)
- [ ] Link to full word study

### Strong's Word Clicking
- [ ] Words with Strong's are clickable
- [ ] Click opens Strong's panel
- [ ] Handles KJV name variants

### Strong's Verse Search
- [ ] "Find all verses" button
- [ ] Paginated search (infinite scroll)
- [ ] Highlights matching words
- [ ] Click result navigates to verse
- [ ] Searches both OT and NT

### Person Cards (TIPNR)
- [ ] Person/place data display
- [ ] Type indicator (Person/Place/Other)
- [ ] Name, label, meaning, significance
- [ ] Description and summary
- [ ] Scripture references linkified
- [ ] Strong's references linkified
- [ ] Greek name fallback to Hebrew

### Interlinear Display
- [ ] Toggle by clicking verse number
- [ ] Hebrew interlinear (RTL layout)
- [ ] Greek interlinear (LTR layout)
- [ ] Strong's number and gloss for each word
- [ ] Each word clickable (opens Strong's)
- [ ] Loading state
- [ ] Auto-collapses other expanded interlinears

### Search Functionality
- [ ] Smart search input (handles multiple types)
- [ ] Verse citation parsing (e.g., "John 3:16")
- [ ] Strong's number parsing (e.g., "H1234")
- [ ] Concept search by English word
- [ ] Two-phase results (text matches, concept expansion)
- [ ] Checkboxes to select Strong's numbers
- [ ] Relevance scoring
- [ ] Paginated results (50 initially)

### Verse Highlighting
- [ ] Highlighted verse when navigating to specific verse
- [ ] Smooth scroll to highlighted verse
- [ ] Click verse number to copy reference

### Additional Features
- [ ] Book reference popup (chapters referencing verse)
- [ ] Hebrew annotations with emoji markers
- [ ] Symbol highlighting
- [ ] Loading states
- [ ] Modal Bible reader for inline popups
- [ ] Citation linkification throughout site

---

## 4. Biblical Timeline

### Timeline Display
- [ ] Ruler-style vertical timeline
- [ ] Year range: 4050 BC to 3500 AD
- [ ] Multi-level tick marks (millennium/century/decade/year/month/week/day)
- [ ] Dynamic tick visibility based on zoom
- [ ] Event positioning on right side
- [ ] Connecting lines from events to ruler

### Zoom Controls
- [ ] Zoom in button (1.5x)
- [ ] Zoom out button (1/1.5x)
- [ ] Reset zoom button
- [ ] Zoom at mouse/touch point
- [ ] Zoom level indicator (pixels per year)
- [ ] Zoom state persisted to localStorage

### Pan/Drag Controls
- [ ] Drag-to-pan
- [ ] Touch support for mobile
- [ ] Scroll position persistence

### Event Display
- [ ] Point events as labels
- [ ] Duration events as vertical bars
- [ ] Event clustering when zoomed out
- [ ] Smart positioning (prevents overlaps)
- [ ] Type-based colors
- [ ] Type-based emoji icons
- [ ] Priority-based visibility
- [ ] Zoom-based filtering

### Event Detail Panel
- [ ] Slide-out panel for event details
- [ ] Title with type icon
- [ ] Lunar date (formatted)
- [ ] Gregorian date
- [ ] Regal year (if applicable)
- [ ] Description (markdown support)
- [ ] Sources (clickable scripture)
- [ ] Validation section
- [ ] Article link
- [ ] Previous/Next event navigation
- [ ] "View on Calendar" button

### Duration Detail Panel
- [ ] From/To event links
- [ ] Claimed vs actual duration
- [ ] Source references
- [ ] Validation status

### Event Filtering
- [ ] Filter toggles: Births, Deaths, Biblical, Historical, Prophecy
- [ ] Type filter dropdown
- [ ] Era filter
- [ ] Text search
- [ ] Filter state persisted to localStorage

### Profile Integration
- [ ] Profile-aware date calculations
- [ ] Cache invalidation when profile changes

---

## 5. Historical Events

### Event Loading
- [ ] Dual format support (v1 and v2)
- [ ] Event normalization
- [ ] Caching

### Event Display
- [ ] List view grouped by era
- [ ] Timeline view
- [ ] Event cards with type icon, title, dates, description, tags

### Calendar Integration
- [ ] Navigate to event date function
- [ ] Updates calendar and URL

---

## 6. Settings & Profiles

### Profile Management
- [ ] 5 preset profiles (Time-Tested, Ancient Traditional, 119 Ministries, Creator's Calendar, Traditional Lunar)
- [ ] Custom profile creation (clone)
- [ ] Custom profile editing (rename)
- [ ] Custom profile deletion
- [ ] Profile switching
- [ ] Profile auto-detection from current state

### Profile Picker UI
- [ ] Profile picker popup
- [ ] Desktop positioning (right edge)
- [ ] Mobile positioning
- [ ] Profile list with icons and hints
- [ ] Checkmark for selected profile

### Settings Page
- [ ] Profile selection dropdown
- [ ] Clone/Edit/Delete buttons (disabled for presets)
- [ ] Month Starts At: Full Moon, Dark Moon, Crescent buttons
- [ ] Crescent Visibility Timing (shown only for crescent)
- [ ] Day Starts At: Evening, Morning buttons
- [ ] Day Start Angle: 0°, 6°, 12°, 18° buttons
- [ ] Year Starts At: Equinox, Passover, Virgo buttons
- [ ] Dynamic methodology explanations
- [ ] Sabbath Day buttons and dropdown
- [ ] Priestly Cycle Reference buttons
- [ ] Default Profile checkbox
- [ ] Default Location with map
- [ ] GPS location button
- [ ] City selector dropdown
- [ ] Custom coordinates inputs

### Profile Modal
- [ ] Create new profile modal
- [ ] Rename profile modal
- [ ] Name validation (unique)
- [ ] Enter to save, Escape to close

### Settings Editability
- [ ] Preset profiles: settings read-only
- [ ] Custom profiles: settings editable
- [ ] Editing profile vs active profile distinction

---

## 7. Priestly Divisions

### Priestly Calculations
- [ ] 24 priestly courses (Mishmarot)
- [ ] Temple Destruction anchor (70 AD)
- [ ] Temple Dedication anchor (959 BC)
- [ ] Lunar Sabbath mode support
- [ ] Saturday Sabbath mode support

### Priestly Page
- [ ] Table showing all 24 courses
- [ ] Warning for cycle discrepancies
- [ ] Profile/year display
- [ ] Expandable detail rows
- [ ] Links to historical dates (dedication, destructions)

### Priestly in Day Detail
- [ ] Course display with order number
- [ ] Navigate to previous/next service
- [ ] Info popup for courses with notes

---

## 8. Sabbath Tester

### Test Framework
- [ ] Tests all calendar configuration combinations
- [ ] 7 biblical test cases
- [ ] Uses Saturday Sabbath and Jerusalem location

### Sabbath Tester Page
- [ ] Loading indicator
- [ ] Results container
- [ ] Summary scoreboard table
- [ ] Expandable rows
- [ ] Individual test cards
- [ ] Date links navigate to calendar

---

## 9. Torah Portions

### Torah Calculations
- [ ] 54 Torah portions
- [ ] Lunar Sabbath mode support
- [ ] Saturday Sabbath mode support
- [ ] Holiday replacements
- [ ] Maftir additions

### Torah Display
- [ ] Portion in day detail for Sabbath days
- [ ] Hebrew name and meaning
- [ ] Bible citation (clickable)
- [ ] Summary text
- [ ] Special indicators

### Torah Modal
- [ ] Full list of all 54 portions
- [ ] Expandable summaries

---

## 10. Jubilee Cycle

### Jubilee Calculations
- [ ] 49-year Jubilee cycles
- [ ] 7-year Sabbath cycles
- [ ] Reference: 1406 BC (Jordan crossing)
- [ ] Sabbath year detection
- [ ] Jubilee year detection
- [ ] Planting prohibition calculations

### Jubilee Display
- [ ] Indicator in calendar header
- [ ] Info link opens modal
- [ ] Modal with cycle explanation
- [ ] Scripture references

---

## 11. World Clock

### World Clock Display
- [ ] Section in day detail panel
- [ ] Comparison grid showing multiple profiles/locations
- [ ] Each entry shows: profile, lunar date, location, local time, priestly course, feasts
- [ ] Current profile/location highlighted

### World Clock Interactions
- [ ] Add button to add profile/location
- [ ] Remove button on each entry
- [ ] Click entry to navigate to that profile/location
- [ ] Location picker integration

---

## 12. Book/Chapters

### Static HTML (SEO)
- [ ] Jekyll generates static HTML pages
- [ ] URL pattern: `/chapters/{chapter-name}/`
- [ ] Full page with header, footer, navigation
- [ ] Scripture references linkified
- [ ] SEO meta tags

### SPA Integration
- [ ] Fetch HTML and extract article content
- [ ] Display in content area
- [ ] Chapter navigation (prev/next)
- [ ] Scripture links use SPA navigation
- [ ] Related facts sidebar

---

## 13. Navigation & URL Routing

### URL Patterns
- [ ] `/` - Calendar home
- [ ] `/{profile}/{location}/{date}` - Calendar with context
- [ ] `/bible/{translation}/{book}/{chapter}?verse={verse}` - Bible reader
- [ ] `/chapters/{chapter-name}/` - Book chapters (static)
- [ ] `/priestly` - Priestly divisions
- [ ] `/sabbath-tester` - Sabbath tester
- [ ] `/feasts` - Feast table
- [ ] `/events` - Historical events
- [ ] `/biblical-timeline` - Timeline
- [ ] `/settings` - Settings page

### Navigation Menu
- [ ] Hamburger button (mobile)
- [ ] Fixed sidebar (desktop)
- [ ] Menu items: Calendar, Feasts, Settings, Sabbath Tester, Priestly, Events, Timeline, Bible
- [ ] Install App button (when PWA installable)

### Top Navigation
- [ ] Brand logo (navigates to calendar)
- [ ] Today button
- [ ] Profile selector

### Pickers/Modals
- [ ] Year picker popup
- [ ] Month picker popup
- [ ] Time picker popup
- [ ] Location picker modal
- [ ] Profile picker popup

### Browser Integration
- [ ] Browser back/forward support
- [ ] URL updates on navigation
- [ ] State restoration from URL

---

## 14. LocalStorage Keys

| Key | Purpose |
|-----|---------|
- [ ] `lunarCalendarState` | Current viewing state + active profile ID
- [ ] `customProfiles` | User-created custom profiles
- [ ] `defaultProfileId` | Default profile for "Today" button
- [ ] `biblicalTimelineState` | Timeline zoom level and scroll position
- [ ] `biblicalTimelineFilters` | Timeline filter toggle states
- [ ] `strongs-sidebar-width` | Strong's panel width
- [ ] `bible_translation_preference` | Preferred Bible translation
- [ ] `worldClockEntries` | World clock profile/location entries

---

## 15. PWA Features

### Service Worker
- [ ] Offline caching
- [ ] Cache-first strategy for static assets
- [ ] Network-first strategy for data

### Manifest
- [ ] App name and icons
- [ ] Display mode: standalone
- [ ] Theme colors

### Install Prompt
- [ ] Install button in menu (when available)
- [ ] iOS install instructions

### PWA Navigation
- [ ] Back/Forward buttons in standalone mode
- [ ] Detect standalone mode

---

## Keyboard Shortcuts

- [ ] Enter in search triggers search
- [ ] Enter in profile modal saves
- [ ] Escape closes modals

---

## Responsive Breakpoints

- [ ] Desktop: >= 1200px (fixed sidebar)
- [ ] Mobile: < 1200px (hamburger menu)

---

## Future Feature Backlog

- [ ] **Name-aware search**: Searching for "Jesus" should also match "Yeshua" and vice versa. Same for LORD/YHWH/Yahweh and God/Elohim. Search should expand queries based on the name equivalence mapping in SettingsView.
- [ ] **Universal name normalization**: All displayed text (Bible reader, chapter content, events, tooltips, search results) should normalize names to the user's stated preference from Settings. Currently `applyNamePreferences()` exists but is not applied everywhere. Needs systematic integration into all rendering paths.

---

## Verification Checklist

After completing all phases, verify:

1. [ ] All URL patterns work correctly
2. [ ] Browser back/forward works
3. [ ] All localStorage keys are migrated
4. [ ] All modals open and close correctly
5. [ ] Profile switching works
6. [ ] Calendar regenerates correctly on setting changes
7. [ ] All views render correctly on desktop
8. [ ] All views render correctly on mobile
9. [ ] PWA install and offline work
10. [ ] No console errors
11. [ ] Performance is acceptable (< 3s initial load)
