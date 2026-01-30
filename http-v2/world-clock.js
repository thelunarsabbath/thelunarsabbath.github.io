// World Clock Functions
// Extracted from index.html for Phase 7 refactoring

// Get default world clock entries (used when no saved entries exist)
function getDefaultWorldClockEntries() {
  const entries = [];
  const seen = new Set();
  
  // Helper to add unique entries
  const addEntry = (profileId, locationSlug, locationName) => {
    const key = `${profileId}:${locationSlug}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ profileId, locationSlug, locationName });
  };
  
  // User's saved GPS location (from localStorage) - stable across navigation
  const savedLoc = getSavedUserLocation();
  if (savedLoc) {
    const savedSlug = getClosestCitySlug(savedLoc.lat, savedLoc.lon, Infinity) || 'jerusalem';
    const savedName = savedLoc.city || formatCitySlug(savedSlug);
    // Add Time-Tested at user's location first
    addEntry('timeTested', savedSlug, savedName);
  }
  
  // All presets in Jerusalem
  for (const [profileId, profile] of Object.entries(PRESET_PROFILES)) {
    addEntry(profileId, 'jerusalem', 'Jerusalem');
  }
  
  return entries;
}

// Load world clock entries from localStorage
function loadWorldClockEntries() {
  try {
    const saved = localStorage.getItem('worldClockEntries');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading world clock entries:', e);
  }
  return null;  // null means use defaults
}

// Save world clock entries to localStorage
function saveWorldClockEntries(entries) {
  try {
    localStorage.setItem('worldClockEntries', JSON.stringify(entries));
  } catch (e) {
    console.error('Error saving world clock entries:', e);
  }
}

// Get current world clock entries (saved or defaults)
// Once defaults are generated, they're saved to keep the list stable
function getWorldClockEntries() {
  let entries = loadWorldClockEntries();
  if (!entries) {
    entries = getDefaultWorldClockEntries();
    saveWorldClockEntries(entries);  // Save so list stays stable
  }
  return entries;
}

// Add a world clock entry
function addWorldClockEntry(profileId, locationSlug, locationName) {
  const entries = getWorldClockEntries();
  const key = `${profileId}:${locationSlug}`;
  
  // Check for duplicates
  const exists = entries.some(e => `${e.profileId}:${e.locationSlug}` === key);
  if (exists) return false;
  
  entries.push({ profileId, locationSlug, locationName });
  saveWorldClockEntries(entries);
  return true;
}

// Remove a world clock entry
function removeWorldClockEntry(index) {
  const entries = getWorldClockEntries();
  if (index >= 0 && index < entries.length) {
    entries.splice(index, 1);
    saveWorldClockEntries(entries);
    return true;
  }
  return false;
}

// Reset world clock to defaults
function resetWorldClockEntries() {
  localStorage.removeItem('worldClockEntries');
}

// Remove world clock entry and refresh the UI
function removeWorldClockEntryAndRefresh(index) {
  removeWorldClockEntry(index);
  refreshDayDetailIfVisible();
}

// Open location picker for World Clock (adds new entry)
function openLocationPickerForWorldClock() {
  locationPickerMode = 'worldclock';
  locationPickerCallback = (locationSlug, locationName, coords, profileId) => {
    if (addWorldClockEntry(profileId, locationSlug, locationName)) {
      refreshDayDetailIfVisible();
    } else {
      alert('This calendar is already in your list.');
    }
  };
  showUnifiedLocationPicker('Add Calendar', true);
}

// Populate profile selector in location picker (for World Clock mode)
function populatePickerProfileSelect() {
  const select = document.getElementById('city-picker-profile-select');
  if (!select) return;
  
  select.innerHTML = '';
  for (const [id, profile] of Object.entries(PROFILES)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${renderProfileIconText(profile)} ${profile.name}`;
    if (id === (state.selectedProfile || 'timeTested')) {
      opt.selected = true;
    }
    select.appendChild(opt);
  }
}

// Get currently selected profile in picker (for World Clock mode)
function getPickerSelectedProfile() {
  const select = document.getElementById('city-picker-profile-select');
  return select ? select.value : (state.selectedProfile || 'timeTested');
}

// Confirm adding a World Clock entry
function confirmWorldClockAdd() {
  // Use the previewed location, or current selection from dropdown
  let slug = previewedLocationSlug;
  let coords = previewedLocationCoords;
  
  if (!slug) {
    // Fallback to dropdown selection
    const select = document.getElementById('city-picker-select');
    slug = select ? select.value : null;
    coords = slug ? CITY_SLUGS[slug] : null;
  }
  
  if (!slug || !coords) {
    alert('Please select a location first.');
    return;
  }
  
  const locationName = formatCitySlug(slug);
  confirmLocationSelection(slug, locationName, coords);
}

// Show modal to add new world clock entry (now uses unified picker)
function showAddWorldClockModal() {
  openLocationPickerForWorldClock();
}

// Legacy function for compatibility
function hideAddWorldClockModal() {
  toggleCityPicker();
}

// Legacy function kept for old modal (no longer used but kept for safety)
function addWorldClockFromModal() {
  // Now handled by confirmLocationSelection
}
