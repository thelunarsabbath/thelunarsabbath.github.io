// State Management Functions
// Extracted from index.html for Phase 8 refactoring

// Migrate old crescentThreshold values (degrees) to new format (hours)
// Old format: 5, 8, 10, 12 degrees
// New format: 12, 15.5, 18, 24 hours
function migrateCrescentThreshold(value) {
  if (value === undefined) return 18; // Default
  // Valid new values
  if (value === 12 || value === 15.5 || value === 18 || value === 24) return value;
  // Old values that need migration - default to 18h
  if (value === 5 || value === 8 || value === 10) return 18;
  // Unknown value, use default
  return 18;
}

// Load saved state from localStorage or use defaults
function loadState() {
  const saved = localStorage.getItem('lunarCalendarState');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        ...defaultState,
        year: parsed.year || defaultState.year,
        lat: parsed.lat || defaultState.lat,
        lon: parsed.lon || defaultState.lon,
        city: parsed.city || '',
        moonPhase: parsed.moonPhase || defaultState.moonPhase,
        dayStartTime: parsed.dayStartTime || defaultState.dayStartTime,
        dayStartAngle: parsed.dayStartAngle !== undefined ? parsed.dayStartAngle : defaultState.dayStartAngle,
        yearStartRule: parsed.yearStartRule || defaultState.yearStartRule,
        crescentThreshold: migrateCrescentThreshold(parsed.crescentThreshold),
        sabbathMode: parsed.sabbathMode || defaultState.sabbathMode,
        selectedProfile: parsed.selectedProfile || defaultState.selectedProfile
        // astronomyEngine is always 'astronomyEngine' for now (Swiss Ephemeris requires self-hosting)
      };
    } catch (e) {
      return { ...defaultState };
    }
  }
  return { ...defaultState };
}

// Save settings to localStorage
function saveState() {
  const toSave = {
    year: state.year,
    lat: state.lat,
    lon: state.lon,
    city: state.city,
    moonPhase: state.moonPhase,
    dayStartTime: state.dayStartTime,
    dayStartAngle: state.dayStartAngle,
    yearStartRule: state.yearStartRule,
    crescentThreshold: state.crescentThreshold,
    sabbathMode: state.sabbathMode,
    selectedProfile: state.selectedProfile
    // astronomyEngine not saved - always uses astronomy-engine for now
  };
  localStorage.setItem('lunarCalendarState', JSON.stringify(toSave));
}

// Load custom profiles from localStorage
function loadCustomProfiles() {
  try {
    const saved = localStorage.getItem('customProfiles');
    if (saved) {
      const customProfiles = JSON.parse(saved);
      PROFILES = { ...PRESET_PROFILES, ...customProfiles };
    }
  } catch (e) {
    console.error('Error loading custom profiles:', e);
  }
}

// Save custom profiles to localStorage
function saveCustomProfiles() {
  const customProfiles = {};
  for (const [id, profile] of Object.entries(PROFILES)) {
    if (!PRESET_PROFILES[id]) {
      customProfiles[id] = profile;
    }
  }
  localStorage.setItem('customProfiles', JSON.stringify(customProfiles));
}
