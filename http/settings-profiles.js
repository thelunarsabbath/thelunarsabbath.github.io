// Settings & Profiles Functions
// Extracted from index.html for Phase 5 refactoring

// Get the name of the currently selected profile (active on calendar)
function getCurrentProfileName() {
  const profileId = state.selectedProfile || 'timeTested';
  const profile = PROFILES[profileId];
  return profile ? profile.name : '';
}

// Get current location name for display
function getCurrentLocationName(optLat, optLon) {
  // Use provided coordinates or fall back to state
  const lat = optLat ?? state.lat ?? 31.7683;
  const lon = optLon ?? state.lon ?? 35.2137;
  
  // First, try to find city name from known cities (exact match)
  const coordValue = `${lat},${lon}`;
  if (CITY_NAMES[coordValue]) {
    return CITY_NAMES[coordValue];
  }
  
  // Try to find closest city slug match (500km radius)
  const slug = getClosestCitySlug(lat, lon, 500);
  if (slug && CITY_SLUGS[slug]) {
    // Convert slug to display name (capitalize, replace hyphens)
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  
  // If still no match, find the absolute closest city (no limit)
  const closestSlug = getClosestCitySlug(lat, lon, Infinity);
  if (closestSlug && CITY_SLUGS[closestSlug]) {
    const cityName = closestSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `Near ${cityName}`;
  }
  
  // Last resort: region name based on longitude
  return getTimezoneFromLongitude(lon);
}

// Get moon icon based on current moon phase setting
function getMoonIcon() {
  if (state.moonPhase === 'full') return '🌕';
  if (state.moonPhase === 'dark') return '🌑';
  if (state.moonPhase === 'crescent') return '🌒';
  return '🌕';
}

// Render profile icon (supports favicon URLs)
function renderProfileIcon(profile) {
  if (profile.faviconUrl) {
    return `<img src="${profile.faviconUrl}" alt="${profile.name}" onerror="this.style.display='none';this.nextSibling.style.display='inline'"><span style="display:none">${profile.icon || '📅'}</span>`;
  }
  return profile.icon || '📅';
}

// Render profile icon for plain text contexts (dropdown options)
function renderProfileIconText(profile) {
  // For text contexts (like <option>), we can only use emoji, not images
  return profile.icon || '📅';
}

// Generate a hint string from profile settings
function generateProfileHint(profile) {
  const parts = [];
  
  // Moon phase
  switch (profile.moonPhase) {
    case 'full': parts.push('Full Moon'); break;
    case 'dark': parts.push('Dark Moon'); break;
    case 'crescent': parts.push('Crescent Moon'); break;
  }
  
  // Day start
  if (profile.dayStartTime === 'evening') {
    parts.push(profile.dayStartAngle === 0 ? 'Sunset' : 'Evening');
  } else {
    parts.push(profile.dayStartAngle === 0 ? 'Sunrise' : 'Morning');
  }
  
  // Year start
  switch (profile.yearStartRule) {
    case 'virgoFeet': parts.push('Virgo Rule'); break;
    case '13daysBefore': parts.push('Passover Rule'); break;
  }
  
  // Sabbath
  switch (profile.sabbathMode) {
    case 'lunar': parts.push('Lunar Sabbath'); break;
    case 'saturday': parts.push('Saturday Sabbath'); break;
    case 'sunday': parts.push('Sunday Sabbath'); break;
    case 'friday': parts.push('Friday Sabbath'); break;
  }
  
  return parts.join(', ');
}

// Get the current profile ID (either explicitly selected or matching current state)
function getCurrentProfileId() {
  // First check if we have an explicitly selected profile that still exists
  if (state.selectedProfile && PROFILES[state.selectedProfile]) {
    return state.selectedProfile;
  }
  
  // Otherwise, check which profile matches current state settings
  for (const [id, profile] of Object.entries(PROFILES)) {
    if (state.moonPhase === profile.moonPhase &&
        state.dayStartTime === profile.dayStartTime &&
        state.dayStartAngle === profile.dayStartAngle &&
        state.yearStartRule === profile.yearStartRule &&
        state.sabbathMode === profile.sabbathMode &&
        (profile.moonPhase !== 'crescent' || state.crescentThreshold === profile.crescentThreshold)) {
      return id;
    }
  }
  return 'custom';
}

// Select and apply a profile
function selectProfile(profileId) {
  const profile = PROFILES[profileId];
  if (!profile) return;
  
  // Apply profile settings to state
  state.moonPhase = profile.moonPhase;
  state.dayStartTime = profile.dayStartTime;
  state.dayStartAngle = profile.dayStartAngle;
  state.yearStartRule = profile.yearStartRule;
  state.crescentThreshold = profile.crescentThreshold ?? 18;
  state.sabbathMode = profile.sabbathMode;
  state.selectedProfile = profileId;
  
  // Update the profile dropdown in settings page if it exists
  const select = document.getElementById('profile-select');
  if (select) {
    select.value = profileId;
  }
  
  // Close picker and regenerate
  toggleProfilePicker();
  saveState();
  regenerateCalendarPreservingScroll();
}

// Toggle the settings page
function toggleSettings() {
  const settingsPage = document.getElementById('settings-page');
  const settingsOverlay = document.getElementById('settings-page-overlay');
  
  const isOpening = !settingsPage.classList.contains('visible');
  
  if (isOpening) {
    // Show settings slide-in
    settingsPage.classList.add('visible');
    settingsOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    // Initialize editing profile to current active profile
    editingProfileId = state.selectedProfile || 'timeTested';
    
    // Update dropdown to show current profile
    const select = document.getElementById('profile-select');
    if (select) select.value = editingProfileId;
    
    // Update settings page state
    updateSettingsPageState();
    displayProfileSettings(editingProfileId);
  } else {
    // Hide settings slide-in
    settingsPage.classList.remove('visible');
    settingsOverlay.classList.remove('visible');
    document.body.style.overflow = ''; // Restore scrolling
    
    // Refresh day detail if visible
    refreshDayDetailIfVisible();
  }
}

// Profile Picker Functions
function toggleProfilePicker(event) {
  const picker = document.getElementById('profile-picker');
  const overlay = document.getElementById('profile-picker-overlay');
  
  if (picker.style.display === 'none') {
    // Position dropdown near the profile selector in top nav
    const profileBtn = document.getElementById('top-nav-profile');
    if (profileBtn) {
      const rect = profileBtn.getBoundingClientRect();
      picker.style.top = (rect.bottom + 8) + 'px';
      
      // Align right edge of picker with right edge of button
      const pickerWidth = 320;
      picker.style.left = Math.max(8, rect.right - pickerWidth) + 'px';
    }
    
    picker.style.display = 'block';
    overlay.classList.add('visible');
    populateProfilePicker();
  } else {
    picker.style.display = 'none';
    overlay.classList.remove('visible');
  }
}

function populateProfilePicker() {
  const list = document.getElementById('profile-picker-list');
  if (!list) return;
  
  const currentProfileId = getCurrentProfileId();
  
  let html = '';
  for (const [id, profile] of Object.entries(PROFILES)) {
    const isSelected = id === currentProfileId;
    // Generate hint from settings if not provided
    const hint = profile.hint || generateProfileHint(profile);
    html += `
      <div class="profile-option${isSelected ? ' selected' : ''}" onclick="selectProfile('${id}')">
        <div class="profile-option-icon">${renderProfileIcon(profile)}</div>
        <div class="profile-option-info">
          <div class="profile-option-name">${profile.name}</div>
          <div class="profile-option-hint">${hint}</div>
        </div>
        ${isSelected ? '<span style="color: #d4a017;">✓</span>' : ''}
      </div>
    `;
  }
  
  list.innerHTML = html;
}

// Open the location picker (for header - changes current location)
function openLocationPicker() {
  openLocationPickerForHeader();
}

// Update settings page state
function updateSettingsPageState() {
  // Update profile buttons
  updateProfileButtons();
  
  // Update moon phase buttons
  document.querySelectorAll('.settings-option-btn[data-phase]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.phase === state.moonPhase);
  });
  
  // Update crescent threshold visibility and buttons
  updateCrescentThresholdVisibility();
  updateCrescentThresholdButtons();
  
  // Update day start buttons
  updateDayStartButtons();
  
  // Update year start buttons
  updateYearStartButtons();
  
  // Update sabbath buttons
  updateSabbathButtons();
  
  // Update city select - use the editing profile's location
  const profileId = editingProfileId || state.selectedProfile;
  const profile = PROFILES[profileId];
  const profileLat = profile?.lat ?? state.lat;
  const profileLon = profile?.lon ?? state.lon;
  
  const citySelect = document.getElementById('settings-city-select');
  const coordValue = `${profileLat},${profileLon}`;
  let found = false;
  
  for (let option of citySelect.options) {
    if (option.value === coordValue) {
      citySelect.value = coordValue;
      found = true;
      break;
    }
  }
  
  if (!found) {
    citySelect.value = 'custom';
    document.getElementById('settings-custom-coords').style.display = 'flex';
    document.getElementById('settings-lat-input').value = profileLat;
    document.getElementById('settings-lon-input').value = profileLon;
  } else {
    document.getElementById('settings-custom-coords').style.display = 'none';
  }
  
  // Render the map
  renderSettingsPageMap();
  
  // Update settings editability based on current profile
  updateSettingsEditability();
}

function renderSettingsPageMap() {
  const container = document.getElementById('settings-page-map');
  if (container && state.lunarMonths && state.lunarMonths[state.currentMonthIndex]) {
    const month = state.lunarMonths[state.currentMonthIndex];
    
    // Use the editing profile's location for the map marker
    const profileId = editingProfileId || state.selectedProfile;
    const profile = PROFILES[profileId];
    const mapOptions = profile ? { lat: profile.lat, lon: profile.lon } : {};
    
    container.innerHTML = renderDatelineVisualization(month.moonEvent, mapOptions);
    // Update map editability after rendering
    updateMapEditability();
  }
}

// Update delete and edit button states based on editing profile
function updateProfileButtonStates() {
  const deleteBtn = document.getElementById('profile-delete-btn');
  const editBtn = document.getElementById('profile-edit-btn');
  
  const profileId = editingProfileId || state.selectedProfile;
  const isPreset = !!PRESET_PROFILES[profileId];
  
  // Delete and edit enabled only for user-saved profiles (not presets)
  if (deleteBtn) deleteBtn.disabled = isPreset;
  if (editBtn) editBtn.disabled = isPreset;
}

// Enable/disable settings controls based on whether editing profile is editable
function updateSettingsEditability() {
  const profileId = editingProfileId || state.selectedProfile;
  const isPreset = !!PRESET_PROFILES[profileId];
  
  // Get all settings controls
  const settingsContainer = document.getElementById('settings-page');
  if (!settingsContainer) return;
  
  // Toggle disabled state on settings buttons and selects (but not profile controls)
  const controls = settingsContainer.querySelectorAll('.settings-option-btn, .settings-select:not(#profile-select), #settings-lat-input, #settings-lon-input');
  controls.forEach(control => {
    if (isPreset) {
      control.disabled = true;
      control.classList.add('disabled');
    } else {
      control.disabled = false;
      control.classList.remove('disabled');
    }
  });
  
  // Also disable/enable the location button
  const locationBtn = settingsContainer.querySelector('.settings-location-btn');
  if (locationBtn) {
    locationBtn.disabled = isPreset;
    locationBtn.classList.toggle('disabled', isPreset);
  }
  
  // Update all maps to show disabled state
  updateMapEditability();
}

// Update map click hint and disabled state based on editing profile
function updateMapEditability() {
  const profileId = editingProfileId || state.selectedProfile;
  const isPreset = !!PRESET_PROFILES[profileId];
  
  // Update all dateline maps
  document.querySelectorAll('.dateline-map').forEach(map => {
    map.classList.toggle('disabled', isPreset);
  });
  
  // Update click hints
  document.querySelectorAll('.dateline-click-hint').forEach(hint => {
    if (isPreset) {
      hint.style.display = 'none';
    } else {
      hint.style.display = '';
    }
  });
}

function updateProfileButtons() {
  // Profile settings are now saved directly by individual setting functions
  // This just updates UI state
  updateProfileButtonStates();
}

function onProfileSelectChange(profileId) {
  // Only change which profile is being edited in settings, don't apply to calendar state
  editingProfileId = profileId;
  displayProfileSettings(profileId);
  updateSettingsEditability();
  updateProfileButtonStates();
}

// Display a profile's settings in the settings UI without applying to state
function displayProfileSettings(profileId) {
  const profile = PROFILES[profileId];
  if (!profile) return;
  
  // Update UI to show this profile's settings
  const moonPhaseSelect = document.getElementById('moon-phase-select');
  if (moonPhaseSelect) moonPhaseSelect.value = profile.moonPhase;
  
  // Update moon phase buttons (use 'selected' class for settings buttons)
  document.querySelectorAll('.settings-option-btn[data-phase]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.phase === profile.moonPhase);
  });
  
  // Update day start buttons
  document.querySelectorAll('.settings-option-btn[data-day-start]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.dayStart === profile.dayStartTime);
  });
  document.querySelectorAll('.settings-option-btn[data-angle]').forEach(btn => {
    const angle = parseInt(btn.dataset.angle);
    btn.classList.toggle('selected', angle === profile.dayStartAngle);
  });
  
  // Update year start buttons
  document.querySelectorAll('.settings-option-btn[data-year-start]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.yearStart === profile.yearStartRule);
  });
  
  // Update crescent threshold buttons
  document.querySelectorAll('.settings-option-btn[data-threshold]').forEach(btn => {
    const threshold = parseFloat(btn.dataset.threshold);
    btn.classList.toggle('selected', threshold === (profile.crescentThreshold ?? 18));
  });
  
  // Update sabbath buttons
  document.querySelectorAll('.settings-option-btn[data-sabbath]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.sabbath === profile.sabbathMode);
  });
  
  // Update crescent threshold visibility
  const crescentSection = document.getElementById('crescent-threshold-section');
  if (crescentSection) {
    crescentSection.style.display = profile.moonPhase === 'crescent' ? 'block' : 'none';
  }
  
  // Update year start explanations
  const equinoxExplanation = document.getElementById('equinox-rule-explanation');
  if (equinoxExplanation) {
    if (profile.yearStartRule === 'equinox') {
      equinoxExplanation.innerHTML = getEquinoxMethodologyHtml({ showCalculation: false });
      equinoxExplanation.style.display = 'block';
    } else {
      equinoxExplanation.style.display = 'none';
    }
  }
  
  const lambExplanation = document.getElementById('lamb-rule-explanation');
  if (lambExplanation) {
    if (profile.yearStartRule === '13daysBefore') {
      lambExplanation.innerHTML = getPassoverMethodologyHtml({ showCalculation: false });
      lambExplanation.style.display = 'block';
    } else {
      lambExplanation.style.display = 'none';
    }
  }
  
  const virgoExplanation = document.getElementById('virgo-rule-explanation');
  if (virgoExplanation) {
    if (profile.yearStartRule === 'virgoFeet') {
      const virgoCalc = getVirgoCalculation(state.year);
      virgoExplanation.innerHTML = getVirgoMethodologyHtml({ 
        showCalculation: !!virgoCalc, 
        virgoCalc: virgoCalc 
      });
      virgoExplanation.style.display = 'block';
    } else {
      virgoExplanation.style.display = 'none';
    }
  }
  
  // Update location display for this profile
  const profileLat = profile.lat ?? state.lat;
  const profileLon = profile.lon ?? state.lon;
  const citySelect = document.getElementById('settings-city-select');
  const coordValue = `${profileLat},${profileLon}`;
  let found = false;
  
  if (citySelect) {
    for (let option of citySelect.options) {
      if (option.value === coordValue) {
        citySelect.value = coordValue;
        found = true;
        break;
      }
    }
    
    if (!found && (profileLat !== undefined && profileLon !== undefined)) {
      citySelect.value = 'custom';
      document.getElementById('settings-custom-coords').style.display = 'flex';
      document.getElementById('settings-lat-input').value = profileLat;
      document.getElementById('settings-lon-input').value = profileLon;
    } else if (found) {
      document.getElementById('settings-custom-coords').style.display = 'none';
    }
  }
  
  // Update the map to show this profile's location
  renderSettingsPageMap();
  
  // Update default profile checkbox
  if (typeof updateDefaultProfileCheckbox === 'function') {
    updateDefaultProfileCheckbox();
  }
}

// Profile Management Functions
function cloneProfile() {
  const profileId = editingProfileId || state.selectedProfile;
  const currentProfile = PROFILES[profileId];
  
  // Suggest a name based on current profile
  const suggestedName = currentProfile ? currentProfile.name + ' Copy' : 'My Profile';
  
  showProfileModal('create', suggestedName);
}

// Edit the name of the current custom profile
function editProfileName() {
  const profileId = editingProfileId || state.selectedProfile;
  
  // Can't edit presets
  if (PRESET_PROFILES[profileId]) return;
  
  const currentProfile = PROFILES[profileId];
  if (!currentProfile) return;
  
  showProfileModal('edit', currentProfile.name, profileId);
}

function showProfileModal(mode, defaultName, editId = null) {
  profileModalMode = mode;
  profileModalEditId = editId;
  
  const overlay = document.getElementById('profile-modal-overlay');
  const input = document.getElementById('profile-modal-input');
  const error = document.getElementById('profile-modal-error');
  const title = document.getElementById('profile-modal-title');
  const saveBtn = document.getElementById('profile-modal-save-btn');
  
  title.textContent = mode === 'edit' ? 'Rename Profile' : 'Create New Profile';
  saveBtn.textContent = mode === 'edit' ? 'Save' : 'Create';
  
  input.value = defaultName || '';
  error.textContent = '';
  overlay.classList.add('visible');
  
  // Focus and select the input text
  setTimeout(() => {
    input.focus();
    input.select();
  }, 100);
}

function closeProfileModal(event) {
  // If event exists and target is not the overlay itself, don't close
  if (event && event.target !== event.currentTarget) return;
  
  const overlay = document.getElementById('profile-modal-overlay');
  overlay.classList.remove('visible');
  profileModalMode = 'create';
  profileModalEditId = null;
}

function handleProfileModalKeydown(event) {
  if (event.key === 'Enter') {
    saveProfileModal();
  } else if (event.key === 'Escape') {
    closeProfileModal();
  }
}

function saveProfileModal() {
  const input = document.getElementById('profile-modal-input');
  const error = document.getElementById('profile-modal-error');
  const select = document.getElementById('profile-select');
  
  let name = input.value.trim();
  
  if (!name) {
    error.textContent = 'Please enter a profile name.';
    input.focus();
    return;
  }
  
  // Check for unique name (exclude current profile when editing)
  if (!isProfileNameUnique(name, profileModalEditId)) {
    error.textContent = 'A profile with this name already exists.';
    input.focus();
    return;
  }
  
  // Get the profile being cloned from (editing profile, not necessarily active profile)
  const sourceProfileId = editingProfileId || state.selectedProfile;
  const sourceProfile = PROFILES[sourceProfileId] || {};
  
  if (profileModalMode === 'edit' && profileModalEditId) {
    // Edit existing profile name
    PROFILES[profileModalEditId].name = name;
    saveCustomProfiles();
    rebuildProfileDropdown();
    if (select) select.value = profileModalEditId;
    editingProfileId = profileModalEditId;
  } else {
    // Create new profile based on the currently editing profile's settings
    const id = 'custom_' + Date.now();
    PROFILES[id] = {
      name: name,
      icon: sourceProfile.icon || getProfileIcon(sourceProfile.moonPhase || 'full'),
      moonPhase: sourceProfile.moonPhase || 'full',
      dayStartTime: sourceProfile.dayStartTime || 'morning',
      dayStartAngle: sourceProfile.dayStartAngle ?? 12,
      yearStartRule: sourceProfile.yearStartRule || 'equinox',
      crescentThreshold: sourceProfile.crescentThreshold ?? 18,
      sabbathMode: sourceProfile.sabbathMode || 'lunar',
      lat: sourceProfile.lat ?? state.lat,
      lon: sourceProfile.lon ?? state.lon,
      city: sourceProfile.city || state.city
    };
    
    saveCustomProfiles();
    
    // Switch to editing the new profile (don't apply to calendar yet)
    editingProfileId = id;
    rebuildProfileDropdown();
    if (select) select.value = id;
  }
  
  updateProfileButtonStates();
  updateSettingsEditability();
  
  // Close the modal
  closeProfileModal();
}

// Delete the currently selected custom profile
function deleteCustomProfile() {
  const profileId = editingProfileId || state.selectedProfile;
  
  // Can't delete presets
  if (PRESET_PROFILES[profileId]) return;
  
  const profile = PROFILES[profileId];
  if (!confirm(`Delete profile "${profile.name}"?`)) return;
  
  delete PROFILES[profileId];
  saveCustomProfiles();
  
  // If we deleted the active profile, switch to Time-Tested
  if (profileId === state.selectedProfile) {
    state.selectedProfile = 'timeTested';
    applyProfile('timeTested');
  }
  
  // Reset editing to first available profile
  editingProfileId = 'timeTested';
  rebuildProfileDropdown();
  
  // Switch to Time-Tested preset (Jerusalem)
  applyProfile('timeTested');
}

function isProfileNameUnique(name, excludeId = null) {
  const normalizedName = name.trim().toLowerCase();
  for (const [id, profile] of Object.entries(PROFILES)) {
    if (id !== excludeId && profile.name.toLowerCase() === normalizedName) {
      return false;
    }
  }
  return true;
}

// Get the icon for a moon phase
function getProfileIcon(phase) {
  if (phase === 'full') return '🌕';
  if (phase === 'dark') return '🌑';
  if (phase === 'crescent') return '🌒';
  return '🌕';
}

// Settings Button Update Functions
function updateMoonPhaseButtons() {
  // For main calendar UI, use state
  document.querySelectorAll('.moon-phase-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.phase === state.moonPhase);
  });
  // For settings page, use the editing profile
  const profileId = editingProfileId || state.selectedProfile;
  const profile = PROFILES[profileId];
  const editingPhase = profile ? profile.moonPhase : state.moonPhase;
  document.querySelectorAll('.settings-option-btn[data-phase]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.phase === editingPhase);
  });
}

function selectMoonPhase(phase) {
  // Don't allow changes on preset profiles
  const profileId = editingProfileId || state.selectedProfile;
  if (PRESET_PROFILES[profileId]) return;
  
  // Update the editing profile
  if (PROFILES[profileId]) {
    PROFILES[profileId].moonPhase = phase;
    PROFILES[profileId].icon = getProfileIcon(phase);
    saveCustomProfiles();
  }
  
  document.getElementById('moon-phase-select').value = phase;
  updateMoonPhaseButtons();
  updateCrescentThresholdVisibility();
  updateYearStartButtons();  // Update year start icon to match moon phase
  
  // Only update state if editing the active profile
  if (profileId === state.selectedProfile) {
    state.moonPhase = phase;
    saveState();
    regenerateCalendarPreservingScroll();
  }
}

function updateDayStartButtons() {
  // Use the editing profile for settings page
  const profileId = editingProfileId || state.selectedProfile;
  const profile = PROFILES[profileId];
  const dayStartTime = profile ? profile.dayStartTime : state.dayStartTime;
  const dayStartAngle = profile ? profile.dayStartAngle : state.dayStartAngle;
  
  // Update day start time buttons (evening/morning)
  document.querySelectorAll('.settings-option-btn[data-daystart]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.daystart === dayStartTime);
  });
  // Update angle buttons
  document.querySelectorAll('.settings-option-btn[data-angle]').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.angle) === dayStartAngle);
  });
}

function selectDayStartTime(time) {
  // Don't allow changes on preset profiles
  const profileId = editingProfileId || state.selectedProfile;
  if (PRESET_PROFILES[profileId]) return;
  
  // Update the editing profile
  if (PROFILES[profileId]) {
    PROFILES[profileId].dayStartTime = time;
    saveCustomProfiles();
  }
  
  updateDayStartButtons();
  
  // Only update state if editing the active profile
  if (profileId === state.selectedProfile) {
    state.dayStartTime = time;
    saveState();
    regenerateCalendarPreservingScroll();
  }
}

function selectDayStartAngle(angle) {
  // Don't allow changes on preset profiles
  const profileId = editingProfileId || state.selectedProfile;
  if (PRESET_PROFILES[profileId]) return;
  
  // Update the editing profile
  if (PROFILES[profileId]) {
    PROFILES[profileId].dayStartAngle = angle;
    saveCustomProfiles();
  }
  
  updateDayStartButtons();
  
  // Only update state if editing the active profile
  if (profileId === state.selectedProfile) {
    state.dayStartAngle = angle;
    saveState();
    regenerateCalendarPreservingScroll();
  }
}

function updateYearStartButtons() {
  // Use the editing profile for settings page
  const profileId = editingProfileId || state.selectedProfile;
  const profile = PROFILES[profileId];
  const yearStartRule = profile ? profile.yearStartRule : state.yearStartRule;
  
  document.querySelectorAll('.settings-option-btn[data-yearstart]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.yearstart === yearStartRule);
  });
  
  // Update the "Renewed Moon after Equinox" icon to match current moon phase
  const iconEl = document.getElementById('yearstart-equinox-icon');
  if (iconEl) {
    iconEl.textContent = getMoonIcon();
  }
  
  // Show/hide the year start rule explanations - all populated dynamically
  const equinoxExplanation = document.getElementById('equinox-rule-explanation');
  if (equinoxExplanation) {
    if (yearStartRule === 'equinox') {
      equinoxExplanation.innerHTML = getEquinoxMethodologyHtml({ showCalculation: false });
      equinoxExplanation.style.display = 'block';
    } else {
      equinoxExplanation.style.display = 'none';
    }
  }
  
  const lambExplanation = document.getElementById('lamb-rule-explanation');
  if (lambExplanation) {
    if (yearStartRule === '13daysBefore') {
      lambExplanation.innerHTML = getPassoverMethodologyHtml({ showCalculation: false });
      lambExplanation.style.display = 'block';
    } else {
      lambExplanation.style.display = 'none';
    }
  }
  
  const virgoExplanation = document.getElementById('virgo-rule-explanation');
  if (virgoExplanation) {
    if (yearStartRule === 'virgoFeet') {
      // Populate with shared methodology content, including calculation if available
      const virgoCalc = getVirgoCalculation(state.year);
      virgoExplanation.innerHTML = getVirgoMethodologyHtml({ 
        showCalculation: !!virgoCalc, 
        virgoCalc: virgoCalc 
      });
      virgoExplanation.style.display = 'block';
    } else {
      virgoExplanation.style.display = 'none';
    }
  }
}

function selectYearStartRule(rule) {
  // Don't allow changes on preset profiles
  const profileId = editingProfileId || state.selectedProfile;
  if (PRESET_PROFILES[profileId]) return;
  
  // Update the editing profile
  if (PROFILES[profileId]) {
    PROFILES[profileId].yearStartRule = rule;
    saveCustomProfiles();
  }
  
  updateYearStartButtons();
  
  // Only update state if editing the active profile
  if (profileId === state.selectedProfile) {
    state.yearStartRule = rule;
    saveState();
    regenerateCalendarPreservingScroll();
  }
}

function updateCrescentThresholdButtons() {
  // Use the editing profile for settings page
  const profileId = editingProfileId || state.selectedProfile;
  const profile = PROFILES[profileId];
  const crescentThreshold = profile ? (profile.crescentThreshold ?? 18) : state.crescentThreshold;
  
  document.querySelectorAll('.settings-option-btn[data-threshold]').forEach(btn => {
    btn.classList.toggle('selected', parseFloat(btn.dataset.threshold) === crescentThreshold);
  });
}

function updateCrescentThresholdVisibility() {
  // Use the editing profile for settings page
  const profileId = editingProfileId || state.selectedProfile;
  const profile = PROFILES[profileId];
  const moonPhase = profile ? profile.moonPhase : state.moonPhase;
  
  const section = document.getElementById('crescent-threshold-section');
  if (section) {
    section.style.display = moonPhase === 'crescent' ? 'block' : 'none';
  }
}

function selectCrescentThreshold(threshold) {
  // Don't allow changes on preset profiles
  const profileId = editingProfileId || state.selectedProfile;
  if (PRESET_PROFILES[profileId]) return;
  
  // Update the editing profile
  if (PROFILES[profileId]) {
    PROFILES[profileId].crescentThreshold = threshold;
    saveCustomProfiles();
  }
  
  updateCrescentThresholdButtons();
  
  // Only update state if editing the active profile
  if (profileId === state.selectedProfile) {
    state.crescentThreshold = threshold;
    saveState();
    regenerateCalendarPreservingScroll();
  }
}

function updateSabbathButtons() {
  // Use the editing profile for settings page
  const profileId = editingProfileId || state.selectedProfile;
  const profile = PROFILES[profileId];
  const sabbathMode = profile ? profile.sabbathMode : state.sabbathMode;
  
  document.querySelectorAll('.settings-option-btn[data-sabbath]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.sabbath === sabbathMode);
  });
  
  // Update the dropdown to reflect current selection
  const dropdown = document.getElementById('sabbath-day-select');
  if (dropdown) {
    const dropdownDays = ['none', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    if (dropdownDays.includes(sabbathMode)) {
      dropdown.value = sabbathMode;
    } else {
      dropdown.value = '';
    }
  }
}

function selectSabbathMode(mode) {
  // Don't allow changes on preset profiles
  const profileId = editingProfileId || state.selectedProfile;
  if (PRESET_PROFILES[profileId]) return;
  
  // Update the editing profile
  if (PROFILES[profileId]) {
    PROFILES[profileId].sabbathMode = mode;
    saveCustomProfiles();
  }
  
  // Clear dropdown when selecting a button option
  const dropdown = document.getElementById('sabbath-day-select');
  if (dropdown) dropdown.value = '';
  updateSabbathButtons();
  
  // Only update state if editing the active profile
  if (profileId === state.selectedProfile) {
    state.sabbathMode = mode;
    saveState();
    regenerateCalendarPreservingScroll();
  }
}

function selectSabbathDayFromDropdown(day) {
  if (!day) return;
  
  // Don't allow changes on preset profiles
  const profileId = editingProfileId || state.selectedProfile;
  if (PRESET_PROFILES[profileId]) {
    // Reset dropdown to empty
    document.getElementById('sabbath-day-select').value = '';
    return;
  }
  
  state.sabbathMode = day;
  // Deselect the button options when selecting from dropdown
  document.querySelectorAll('.settings-option-btn[data-sabbath]').forEach(btn => {
    btn.classList.remove('selected');
  });
  updateSabbathButtons();
  updateProfileButtons();
  saveState();
  regenerateCalendarPreservingScroll();
}

// Helper function to format city slug for display
function formatCitySlug(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Get closest city slug to given coordinates
function getClosestCitySlug(lat, lon, maxDistKm = 500) {
  let closestSlug = null;
  let closestDist = Infinity;
  
  for (const [slug, coords] of Object.entries(CITY_SLUGS)) {
    const dist = haversineDistance(lat, lon, coords.lat, coords.lon);
    if (dist < closestDist && dist < maxDistKm) {
      closestDist = dist;
      closestSlug = slug;
    }
  }
  
  return closestSlug;
}

// Haversine distance in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Curated list of main cities for dropdown (kept small and manageable)
const DROPDOWN_CITIES = {
  'Biblical': ['jerusalem', 'bethlehem', 'nazareth', 'jericho', 'hebron', 'ramses', 'goshen', 'wilderness-of-sin', 'cairo', 'alexandria', 'mt-sinai-saudi', 'mecca', 'medina'],
  'Middle East': ['tel-aviv', 'dubai', 'amman', 'baghdad', 'tehran', 'riyadh', 'istanbul', 'ankara', 'damascus', 'beirut'],
  'Americas': ['new-york', 'los-angeles', 'chicago', 'houston', 'phoenix', 'dallas', 'denver', 'miami', 'atlanta', 'seattle', 'boston', 'san-francisco', 'toronto', 'vancouver', 'mexico-city', 'sao-paulo', 'buenos-aires', 'lima', 'bogota'],
  'Europe': ['london', 'paris', 'berlin', 'rome', 'madrid', 'amsterdam', 'vienna', 'moscow', 'kiev', 'warsaw', 'athens', 'lisbon', 'dublin', 'stockholm', 'oslo', 'helsinki', 'zurich', 'brussels', 'prague', 'budapest'],
  'Asia': ['tokyo', 'beijing', 'shanghai', 'hong-kong', 'singapore', 'mumbai', 'delhi', 'bangalore', 'seoul', 'bangkok', 'jakarta', 'manila', 'kuala-lumpur', 'taipei', 'osaka', 'hanoi', 'karachi'],
  'Africa': ['johannesburg', 'lagos', 'nairobi', 'addis-ababa', 'casablanca', 'accra', 'dar-es-salaam', 'cape-town'],
  'Oceania': ['sydney', 'melbourne', 'brisbane', 'perth', 'auckland', 'wellington']
};

// Location Picker Functions
function toggleCityPicker() {
  const picker = document.getElementById('city-picker');
  const overlay = document.getElementById('city-picker-overlay');
  
  if (picker.style.display === 'none') {
    picker.style.display = 'block';
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
    renderCityPickerMap();
    populateCityDropdown();
    updateCityPickerLocationName();
  } else {
    picker.style.display = 'none';
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }
}

function renderCityPickerMap() {
  const container = document.getElementById('city-picker-map');
  if (!container) return;
  
  // Get current moon event for the map visualization
  let moonEvent = new Date();
  if (state.lunarMonths && state.lunarMonths[state.currentMonthIndex]) {
    moonEvent = state.lunarMonths[state.currentMonthIndex].moonEvent;
  }
  
  container.innerHTML = renderDatelineVisualization(moonEvent);
  
  // Override the click handler on the map for city picker
  const map = container.querySelector('.dateline-map');
  if (map) {
    map.style.cursor = 'crosshair';
    // Remove inline onclick and set our handler
    map.removeAttribute('onclick');
    map.addEventListener('click', handleCityPickerMapClick);
  }
}

function handleCityPickerMapClick(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // Convert click position to lat/lon
  const clickLon = (x / rect.width) * 360 - 180;
  const clickLat = 90 - (y / rect.height) * 180;
  
  // Snap to nearest city
  const nearestSlug = getClosestCitySlug(clickLat, clickLon, Infinity);
  if (nearestSlug && CITY_SLUGS[nearestSlug]) {
    const coords = CITY_SLUGS[nearestSlug];
    // Always preview - don't close dialog
    previewLocationSelection(nearestSlug, coords);
  }
}

// previewLocationSelection uses global variables previewedLocationSlug and previewedLocationCoords
// (declared in index.html since they're used by functions in both files)
function previewLocationSelection(slug, coords) {
  previewedLocationSlug = slug;
  previewedLocationCoords = coords;
  
  // Update the map marker to show preview
  state.lat = coords.lat;
  state.lon = coords.lon;
  renderCityPickerMap();
  updateCityPickerLocationName();
  updateCityDropdownSelection();
  
  // For header mode, apply changes immediately (but don't close dialog)
  if (locationPickerMode === 'header') {
    state.locationSource = 'url';
    regenerateCalendarPreservingScroll();
    const newURL = buildPathURL();
    window.history.replaceState({}, '', newURL);
    updateTimeDisplay();
  }
}

function updateCityDropdownSelection() {
  const select = document.getElementById('city-picker-select');
  if (!select) return;
  
  const lat = state.lat ?? 31.7683;
  const lon = state.lon ?? 35.2137;
  
  // Find closest city (no distance limit since we snap to cities)
  const currentSlug = getClosestCitySlug(lat, lon, Infinity);
  
  if (!currentSlug) {
    select.value = '';
    return;
  }
  
  // Check if option exists in dropdown
  let option = select.querySelector(`option[value="${currentSlug}"]`);
  
  if (!option && CITY_SLUGS[currentSlug]) {
    // City exists but not in dropdown - dynamically add it
    const displayName = currentSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    // Check if "Current Location" optgroup exists
    let currentLocGroup = select.querySelector('optgroup[label="Current Location"]');
    if (!currentLocGroup) {
      // Create new optgroup at the top (after the placeholder)
      currentLocGroup = document.createElement('optgroup');
      currentLocGroup.label = 'Current Location';
      select.insertBefore(currentLocGroup, select.firstChild.nextSibling);
    }
    
    // Clear old options in Current Location group and add new one
    currentLocGroup.innerHTML = `<option value="${currentSlug}">${displayName}</option>`;
    option = currentLocGroup.querySelector('option');
  }
  
  if (option) {
    select.value = currentSlug;
  }
}

// Check if a city slug is in the curated dropdown list
function isInDropdownList(slug) {
  for (const cities of Object.values(DROPDOWN_CITIES)) {
    if (cities.includes(slug)) return true;
  }
  return false;
}

function populateCityDropdown() {
  const select = document.getElementById('city-picker-select');
  if (!select) return;
  
  // Find current city slug (no distance limit since we snap to cities)
  const currentSlug = getClosestCitySlug(state.lat ?? 31.7683, state.lon ?? 35.2137, Infinity);
  
  let html = '<option value="">-- Select a city --</option>';
  
  // If current location is a city not in the curated list, add it at the top
  if (currentSlug && CITY_SLUGS[currentSlug] && !isInDropdownList(currentSlug)) {
    const displayName = currentSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    html += `<optgroup label="Current Location">`;
    html += `<option value="${currentSlug}" selected>${displayName}</option>`;
    html += `</optgroup>`;
  }
  
  // Add curated cities by region
  for (const [region, cities] of Object.entries(DROPDOWN_CITIES)) {
    html += `<optgroup label="${region}">`;
    for (const slug of cities) {
      if (!CITY_SLUGS[slug]) continue;
      const displayName = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const selected = slug === currentSlug ? ' selected' : '';
      html += `<option value="${slug}"${selected}>${displayName}</option>`;
    }
    html += '</optgroup>';
  }
  
  select.innerHTML = html;
}

function selectCityFromDropdown(slug) {
  if (!slug) return;
  
  const coords = CITY_SLUGS[slug];
  if (!coords) return;
  
  // Always preview - don't close dialog
  previewLocationSelection(slug, coords);
}

function updateCityPickerLocationName() {
  const nameSpan = document.getElementById('city-picker-location-name');
  if (nameSpan) {
    const name = getCurrentLocationName();
    const lat = state.lat ?? 31.7683;
    const lon = state.lon ?? 35.2137;
    const coordStr = `${lat.toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
    nameSpan.textContent = `${name} (${coordStr})`;
  }
}
