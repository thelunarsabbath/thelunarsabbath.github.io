/**
 * SettingsView - User Preferences Management
 * 
 * Handles:
 * - Default scripture translation (KJV, ASV, LXX, etc)
 * - Default home location (GPS, city selector, or manual coordinates)
 * - Theme preference (light/dark)
 */

const SettingsView = {
  _mapInitialized: false,
  
  /**
   * Close settings and return to previous page
   */
  close() {
    // Use browser back if there's history, otherwise go to calendar
    if (window.history.length > 1) {
      window.history.back();
    } else {
      AppStore.dispatch({ type: 'SET_VIEW', view: 'calendar' });
    }
  },
  
  render(state, derived, container) {
    // Load current preferences
    const translation = this.getTranslationPreference();
    const locationPref = this.getLocationPreference();
    const theme = this.getThemePreference();
    const namePrefs = this.getNamePreferences();
    const currentLocation = state.context.location;
    const currentProfileId = state.context.profileId || 'timeTested';
    
    // Build profile options from available profiles
    const profiles = window.PROFILES || {};
    const profileOptions = Object.entries(profiles)
      .map(([id, profile]) => {
        const icon = profile.icon || '📅';
        const name = profile.name || id;
        const selected = id === currentProfileId ? 'selected' : '';
        return `<option value="${id}" ${selected}>${icon} ${name}</option>`;
      })
      .join('');
    
    // Reset map initialization flag when rendering fresh
    this._mapInitialized = false;
    
    container.innerHTML = `
      <div class="settings-view">
        <header class="settings-page-header">
          <h2>⚙️ Settings</h2>
          <button class="settings-close-btn" onclick="SettingsView.close()" title="Close">✕</button>
        </header>
        
        <!-- Default Calendar Profile -->
        <section class="settings-section">
          <h3>📅 Default Calendar Profile</h3>
          <p class="settings-description">Choose the calendar profile used for Sabbath and feast day calculations.</p>
          <select id="settings-profile-select" class="settings-select" onchange="SettingsView.saveProfilePreference(this.value)">
            ${profileOptions}
          </select>
        </section>
        
        <!-- Default Scripture Translation -->
        <section class="settings-section">
          <h3>📖 Default Scripture Translation</h3>
          <p class="settings-description">Choose the default Bible translation shown in the Reader.</p>
          <select id="settings-translation-select" class="settings-select" onchange="SettingsView.saveTranslationPreference(this.value)">
            <option value="kjv" ${translation === 'kjv' ? 'selected' : ''}>KJV - King James Version</option>
            <option value="asv" ${translation === 'asv' ? 'selected' : ''}>ASV - American Standard Version</option>
            <option value="lxx" ${translation === 'lxx' ? 'selected' : ''}>LXX - Septuagint</option>
          </select>
        </section>
        
        <!-- Name Preferences -->
        <section class="settings-section">
          <h3>✡️ Name Preferences</h3>
          <p class="settings-description">Choose how divine names are displayed throughout the app.</p>
          
          <div class="settings-name-prefs">
            <div class="settings-name-row">
              <label class="settings-name-label">Messiah:</label>
              <div class="settings-name-options">
                <button class="settings-name-btn ${namePrefs.messiah === 'jesus' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('messiah', 'jesus')">Jesus</button>
                <button class="settings-name-btn ${namePrefs.messiah === 'yeshua' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('messiah', 'yeshua')">Yeshua</button>
              </div>
            </div>
            
            <div class="settings-name-row">
              <label class="settings-name-label">Divine Name:</label>
              <div class="settings-name-options">
                <button class="settings-name-btn ${namePrefs.divineName === 'lord' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('divineName', 'lord')">the LORD</button>
                <button class="settings-name-btn ${namePrefs.divineName === 'yhwh' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('divineName', 'yhwh')">𐤉𐤄𐤅𐤄</button>
                <button class="settings-name-btn ${namePrefs.divineName === 'yahweh' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('divineName', 'yahweh')">Yahweh</button>
              </div>
            </div>
            
            <div class="settings-name-row">
              <label class="settings-name-label">Creator:</label>
              <div class="settings-name-options">
                <button class="settings-name-btn ${namePrefs.god === 'god' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('god', 'god')">God</button>
                <button class="settings-name-btn ${namePrefs.god === 'elohim' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('god', 'elohim')">Elohim</button>
              </div>
            </div>
          </div>
        </section>
        
        <!-- Default Home Location -->
        <section class="settings-section">
          <h3>📍 Default Home Location</h3>
          <p class="settings-description">Set your default location for calendar calculations. This will be used when no location is specified in the URL.</p>
          
          <div class="settings-location-controls">
            <div class="settings-location-method">
              <label class="settings-radio-label">
                <input type="radio" name="location-method" value="gps" ${locationPref.method === 'gps' ? 'checked' : ''} 
                       onchange="SettingsView.saveLocationMethod('gps')">
                <span>Use GPS (when available)</span>
              </label>
              <label class="settings-radio-label">
                <input type="radio" name="location-method" value="map" ${locationPref.method === 'map' || locationPref.method === 'city' || locationPref.method === 'manual' ? 'checked' : ''} 
                       onchange="SettingsView.saveLocationMethod('map')">
                <span>Select from Map</span>
              </label>
            </div>
            
            <div id="settings-location-map" class="settings-location-option" style="display: ${locationPref.method === 'gps' ? 'none' : 'block'}">
              <div id="settings-map-container" class="settings-map-container"></div>
              <p class="settings-current-value" style="margin-top: 10px;">
                <strong>Current Location:</strong> ${currentLocation.lat.toFixed(4)}, ${currentLocation.lon.toFixed(4)}
              </p>
            </div>
            
            <div class="settings-location-gps" style="margin-top: 15px;">
              <button class="settings-btn settings-btn-secondary" onclick="SettingsView.useCurrentGPS()">
                📍 Use Current GPS Location
              </button>
            </div>
          </div>
        </section>
        
        <!-- Data & Cache -->
        <section class="settings-section">
          <h3>🗑️ Data &amp; Cache</h3>
          <p class="settings-description">Clear all cached data including Sabbath Tester results, calendar computations, and service worker cache. The page will reload after clearing.</p>
          <button class="settings-btn settings-btn-danger" onclick="SettingsView.clearAllCache()">
            🗑️ Clear All Cache &amp; Reload
          </button>
        </section>
        
        <!-- Theme Preference -->
        <section class="settings-section">
          <h3>🎨 Theme</h3>
          <p class="settings-description">Choose your preferred color theme. The current blue/white theme is closer to a dark theme.</p>
          <div class="settings-theme-options">
            <button class="settings-option-btn ${theme === 'dark' ? 'selected' : ''}" 
                    onclick="SettingsView.saveThemePreference('dark')"
                    data-theme="dark">
              <span class="option-icon">🌙</span>
              <span class="option-label">Dark</span>
              <span class="option-hint">Current theme</span>
            </button>
            <button class="settings-option-btn ${theme === 'light' ? 'selected' : ''}" 
                    onclick="SettingsView.saveThemePreference('light')"
                    data-theme="light">
              <span class="option-icon">☀️</span>
              <span class="option-label">Light</span>
              <span class="option-hint">Coming soon</span>
            </button>
          </div>
          ${theme === 'light' ? '<p class="settings-note" style="margin-top: 10px; color: var(--color-text-muted); font-size: 0.9em;">Light theme is not yet implemented. Dark theme will be used.</p>' : ''}
        </section>
      </div>
    `;
    
    // Initialize map after DOM is ready
    setTimeout(() => {
      this.initLocationMap(container, currentLocation, locationPref.method !== 'gps');
    }, 0);
  },
  
  /**
   * Initialize the location map component
   */
  initLocationMap(container, currentLocation, showMap) {
    const mapContainer = container.querySelector('#settings-map-container');
    if (!mapContainer || !showMap || this._mapInitialized) return;
    
    this._mapInitialized = true;
    
    // Clear any existing map
    mapContainer.innerHTML = '';
    
    // Create WorldMap component
    if (typeof WorldMap !== 'undefined') {
      const mapComponent = WorldMap.create({
        lat: currentLocation.lat,
        lon: currentLocation.lon,
        onLocationSelect: (lat, lon, citySlug) => {
          this.saveMapLocation(lat, lon, citySlug);
        },
        showHint: true
      });
      mapContainer.appendChild(mapComponent);
    } else {
      mapContainer.innerHTML = '<p style="color: rgba(255,255,255,0.6);">Map component not available</p>';
    }
  },
  
  /**
   * Save profile preference
   */
  saveProfilePreference(profileId) {
    try {
      localStorage.setItem('defaultCalendarProfile', profileId);
      // Update current profile in AppStore
      if (typeof AppStore !== 'undefined') {
        AppStore.dispatch({ type: 'SET_PROFILE', profileId });
      }
    } catch (e) {
      console.error('Failed to save profile preference:', e);
    }
  },
  
  /**
   * Get profile preference from localStorage
   */
  getProfilePreference() {
    try {
      return localStorage.getItem('defaultCalendarProfile') || 'timeTested';
    } catch (e) {
      return 'timeTested';
    }
  },
  
  /**
   * Get name preferences from localStorage
   */
  getNamePreferences() {
    try {
      const saved = localStorage.getItem('namePreferences');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    // Defaults
    return {
      messiah: 'jesus',      // 'jesus' or 'yeshua'
      divineName: 'lord',    // 'lord', 'yhwh', or 'yahweh'
      god: 'god'             // 'god' or 'elohim'
    };
  },
  
  /**
   * Save a single name preference
   */
  saveNamePreference(key, value) {
    try {
      const prefs = this.getNamePreferences();
      prefs[key] = value;
      localStorage.setItem('namePreferences', JSON.stringify(prefs));
      
      // Update button states without full re-render
      const container = document.querySelector('.settings-name-prefs');
      if (container) {
        // Find all buttons in the row for this key
        const rows = container.querySelectorAll('.settings-name-row');
        rows.forEach(row => {
          const label = row.querySelector('.settings-name-label');
          if (label) {
            const labelText = label.textContent.toLowerCase();
            const keyMap = { 'messiah:': 'messiah', 'divine name:': 'divineName', 'creator:': 'god' };
            const rowKey = keyMap[labelText];
            if (rowKey === key) {
              row.querySelectorAll('.settings-name-btn').forEach(btn => {
                const btnValue = btn.textContent.trim();
                const valueMap = {
                  'Jesus': 'jesus', 'Yeshua': 'yeshua',
                  'the LORD': 'lord', '𐤉𐤄𐤅𐤄': 'yhwh', 'Yahweh': 'yahweh',
                  'God': 'god', 'Elohim': 'elohim'
                };
                const mappedValue = valueMap[btnValue];
                btn.classList.toggle('selected', mappedValue === value);
              });
            }
          }
        });
      }
      
      // Notify that preferences changed (for any listeners)
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('namePreferencesChanged', { detail: prefs }));
      }
    } catch (e) {
      console.error('Failed to save name preference:', e);
    }
  },
  
  /**
   * Get translation preference from localStorage
   */
  getTranslationPreference() {
    try {
      return localStorage.getItem('bible_translation_preference') || 'kjv';
    } catch (e) {
      return 'kjv';
    }
  },
  
  /**
   * Save translation preference
   */
  saveTranslationPreference(translation) {
    try {
      localStorage.setItem('bible_translation_preference', translation);
      // If currently viewing Bible, update the translation
      const state = AppStore.getState();
      if (state.content.view === 'reader' && state.content.params.contentType === 'bible') {
        AppStore.dispatch({
          type: 'SET_VIEW',
          view: 'reader',
          params: { ...state.content.params, translation }
        });
      }
    } catch (e) {
      console.error('Failed to save translation preference:', e);
    }
  },
  
  /**
   * Get location preference from localStorage
   */
  getLocationPreference() {
    try {
      const method = localStorage.getItem('userLocationMethod') || 'gps';
      return { method };
    } catch (e) {
      return { method: 'gps' };
    }
  },
  
  /**
   * Save location method preference
   */
  saveLocationMethod(method) {
    try {
      localStorage.setItem('userLocationMethod', method);
      // Update UI to show/hide map
      const mapDiv = document.getElementById('settings-location-map');
      if (mapDiv) {
        mapDiv.style.display = method === 'gps' ? 'none' : 'block';
        
        // Reinitialize map if showing
        if (method !== 'gps') {
          const state = AppStore.getState();
          const currentLocation = state.context.location;
          this._mapInitialized = false; // Reset flag to allow reinitialization
          this.initLocationMap(document.querySelector('.settings-view'), currentLocation, true);
        }
      }
      
      // If switching to GPS, try to get current location
      if (method === 'gps') {
        this.useCurrentGPS();
      }
    } catch (e) {
      console.error('Failed to save location method:', e);
    }
  },
  
  /**
   * Save location selected from map
   */
  saveMapLocation(lat, lon, citySlug) {
    try {
      const coords = { lat, lon };
      localStorage.setItem('userLocation', JSON.stringify(coords));
      localStorage.setItem('userLocationSource', 'user');
      localStorage.setItem('userLocationMethod', 'map');
      
      if (citySlug) {
        localStorage.setItem('userDefaultCity', citySlug);
      }
      
      // Update current location
      const state = AppStore.getState();
      if (state.content.view === 'calendar') {
        AppStore.dispatch({ type: 'SET_LOCATION', lat, lon });
      }
      
      // Update the map marker position
      const mapContainer = document.querySelector('#settings-map-container');
      if (mapContainer && typeof WorldMap !== 'undefined') {
        mapContainer.innerHTML = '';
        this._mapInitialized = false; // Reset flag to allow reinitialization
        const mapComponent = WorldMap.create({
          lat,
          lon,
          onLocationSelect: (newLat, newLon, newCitySlug) => {
            this.saveMapLocation(newLat, newLon, newCitySlug);
          },
          showHint: true
        });
        mapContainer.appendChild(mapComponent);
        this._mapInitialized = true;
      }
      
      // Update current location display
      const currentValueEl = document.querySelector('.settings-current-value');
      if (currentValueEl) {
        currentValueEl.innerHTML = `<strong>Current Location:</strong> ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }
    } catch (e) {
      console.error('Failed to save map location:', e);
    }
  },
  
  /**
   * Use current GPS location
   */
  useCurrentGPS() {
    if (!navigator.geolocation) {
      alert('GPS is not available on this device.');
      return;
    }
    
    const btn = event?.target;
    if (btn) {
      btn.disabled = true;
      btn.textContent = '📍 Getting location...';
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Math.round(position.coords.latitude * 10000) / 10000;
        const lon = Math.round(position.coords.longitude * 10000) / 10000;
        
        try {
          const coords = { lat, lon };
          localStorage.setItem('userLocation', JSON.stringify(coords));
          localStorage.setItem('userLocationSource', 'gps');
          localStorage.setItem('userLocationMethod', 'gps');
          
          // Update current location
          const state = AppStore.getState();
          if (state.content.view === 'calendar') {
            AppStore.dispatch({ type: 'SET_LOCATION', lat, lon });
          }
          
          // Update manual inputs if visible
          const latInput = document.getElementById('settings-lat-input');
          const lonInput = document.getElementById('settings-lon-input');
          if (latInput) latInput.value = lat;
          if (lonInput) lonInput.value = lon;
          
          if (btn) {
            btn.textContent = '✓ Location saved!';
            setTimeout(() => {
              btn.disabled = false;
              btn.textContent = '📍 Use Current GPS Location';
            }, 2000);
          }
        } catch (e) {
          console.error('Failed to save GPS location:', e);
          if (btn) {
            btn.disabled = false;
            btn.textContent = '📍 Use Current GPS Location';
          }
        }
      },
      (error) => {
        let message = 'Unable to get location';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access denied. Please enable location permissions in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out.';
            break;
        }
        alert(message);
        if (btn) {
          btn.disabled = false;
          btn.textContent = '📍 Use Current GPS Location';
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000 // Cache for 5 minutes
      }
    );
  },
  
  /**
   * Get theme preference from localStorage
   */
  getThemePreference() {
    try {
      return localStorage.getItem('userThemePreference') || 'dark';
    } catch (e) {
      return 'dark';
    }
  },
  
  /**
   * Clear all cached data and reload the page
   */
  clearAllCache() {
    const btn = event?.target;
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Clearing...';
    }
    
    try {
      // 1. Clear Sabbath Tester in-memory + localStorage cache
      if (typeof SabbathTesterView !== 'undefined') {
        SabbathTesterView.clearCache();
        SabbathTesterView._hasRendered = false;
      }
      
      // 2. Clear calendar engine caches (if accessible via AppStore)
      if (typeof AppStore !== 'undefined' && AppStore._engine) {
        AppStore._engine._calendarCache = {};
        AppStore._engine._moonEventsCache = {};
        AppStore._engine._virgoCache = {};
      }
      
      // 3. Clear resolved events cache
      if (typeof ResolvedEventsCache !== 'undefined' && ResolvedEventsCache.clear) {
        ResolvedEventsCache.clear();
      }
      
      // 4. Clear app-specific localStorage keys (preserve user preferences)
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key === 'sabbathTesterCache' ||
          key === 'resolvedEventsCache' ||
          key.startsWith('calendarCache')
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // 5. Clear service worker caches
      if ('caches' in window) {
        caches.keys().then(names => {
          return Promise.all(names.map(name => caches.delete(name)));
        }).then(() => {
          console.log('[Settings] All service worker caches cleared');
        });
      }
      
      // 6. Unregister service worker so it re-fetches everything
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(reg => reg.unregister());
        });
      }
      
      console.log('[Settings] All caches cleared, reloading...');
      
      // Reload after a brief delay to let async operations finish
      setTimeout(() => {
        window.location.reload(true);
      }, 500);
      
    } catch (e) {
      console.error('Failed to clear cache:', e);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '❌ Error - try again';
      }
    }
  },
  
  /**
   * Save theme preference
   */
  saveThemePreference(theme) {
    try {
      localStorage.setItem('userThemePreference', theme);
      // TODO: Apply theme when light theme is implemented
      if (theme === 'light') {
        // For now, just show a message that it's not implemented
        console.log('Light theme not yet implemented');
      }
    } catch (e) {
      console.error('Failed to save theme preference:', e);
    }
  }
};

/**
 * Apply name preferences to a string of text
 * Call this when rendering text that may contain divine names
 * @param {string} text - The text to transform
 * @returns {string} - Text with name substitutions applied
 */
function applyNamePreferences(text) {
  if (!text) return text;
  
  const prefs = SettingsView.getNamePreferences();
  let result = text;
  
  // Messiah name
  if (prefs.messiah === 'yeshua') {
    result = result.replace(/\bJesus\b/g, 'Yeshua');
    result = result.replace(/\bJESUS\b/g, 'YESHUA');
  } else {
    result = result.replace(/\bYeshua\b/g, 'Jesus');
    result = result.replace(/\bYESHUA\b/g, 'JESUS');
  }
  
  // Divine name (LORD -> YHWH or Yahweh)
  if (prefs.divineName === 'yhwh') {
    result = result.replace(/\bthe LORD\b/g, '𐤉𐤄𐤅𐤄');
    result = result.replace(/\bTHE LORD\b/g, '𐤉𐤄𐤅𐤄');
    result = result.replace(/\bLORD\b/g, '𐤉𐤄𐤅𐤄');
  } else if (prefs.divineName === 'yahweh') {
    result = result.replace(/\bthe LORD\b/g, 'Yahweh');
    result = result.replace(/\bTHE LORD\b/g, 'YAHWEH');
    result = result.replace(/\bLORD\b/g, 'Yahweh');
  }
  // If 'lord', keep as-is (default in most translations)
  
  // God/Elohim
  if (prefs.god === 'elohim') {
    // Only replace standalone "God" not "gods" or "godly" etc.
    result = result.replace(/\bGod\b/g, 'Elohim');
    result = result.replace(/\bGOD\b/g, 'ELOHIM');
  }
  // If 'god', keep as-is (default)
  
  return result;
}

// Make available globally
window.SettingsView = SettingsView;
window.applyNamePreferences = applyNamePreferences;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsView;
}
