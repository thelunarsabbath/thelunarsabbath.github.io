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
        
        <!-- Translation Priority -->
        <section class="settings-section">
          <h3>📖 Translation Priority</h3>
          <p class="settings-description">Drag to reorder. Translations above the line are shown by default; those below appear when you tap "more translations."</p>
          <div id="translation-sort-container">
            ${this._buildTranslationSortList()}
          </div>
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
                <select class="settings-name-more ${!['jesus','yeshua'].includes(namePrefs.messiah) ? 'selected' : ''}" 
                        onchange="if(this.value) SettingsView.saveNamePreference('messiah', this.value)">
                  <option value="">More...</option>
                  <option value="yahushua" ${namePrefs.messiah === 'yahushua' ? 'selected' : ''}>Yahushua</option>
                  <option value="yehoshua" ${namePrefs.messiah === 'yehoshua' ? 'selected' : ''}>Yehoshua</option>
                  <option value="iesous" ${namePrefs.messiah === 'iesous' ? 'selected' : ''}>Iesous (Greek)</option>
                </select>
              </div>
            </div>
            
            <div class="settings-name-row">
              <label class="settings-name-label">Divine Name:</label>
              <div class="settings-name-options">
                <button class="settings-name-btn ${namePrefs.divineName === 'lord' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('divineName', 'lord')">the LORD</button>
                <button class="settings-name-btn ${namePrefs.divineName === 'yahweh' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('divineName', 'yahweh')">Yahweh</button>
                <button class="settings-name-btn ${namePrefs.divineName === 'jehovah' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('divineName', 'jehovah')">Jehovah</button>
                <button class="settings-name-btn ${namePrefs.divineName === 'yhwh' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('divineName', 'yhwh')">YHWH</button>
                <select class="settings-name-more ${!['lord','yahweh','jehovah','yhwh'].includes(namePrefs.divineName) ? 'selected' : ''}"
                        onchange="if(this.value) SettingsView.saveNamePreference('divineName', this.value)">
                  <option value="">More...</option>
                  <option value="yhvh" ${namePrefs.divineName === 'yhvh' ? 'selected' : ''}>YHVH</option>
                  <option value="yhuh" ${namePrefs.divineName === 'yhuh' ? 'selected' : ''}>YHUH</option>
                  <option value="yehovah" ${namePrefs.divineName === 'yehovah' ? 'selected' : ''}>Yehovah</option>
                  <option value="yahuah" ${namePrefs.divineName === 'yahuah' ? 'selected' : ''}>Yahuah</option>
                  <option value="yah" ${namePrefs.divineName === 'yah' ? 'selected' : ''}>Yah</option>
                  <option value="paleo" ${namePrefs.divineName === 'paleo' ? 'selected' : ''}>𐤉𐤄𐤅𐤄 (Paleo-Hebrew)</option>
                  <option value="hebrew" ${namePrefs.divineName === 'hebrew' ? 'selected' : ''}>יהוה (Hebrew)</option>
                  <option value="hashem" ${namePrefs.divineName === 'hashem' ? 'selected' : ''}>HaShem</option>
                  <option value="adonai" ${namePrefs.divineName === 'adonai' ? 'selected' : ''}>Adonai</option>
                </select>
              </div>
            </div>
            
            <div class="settings-name-row">
              <label class="settings-name-label">Creator:</label>
              <div class="settings-name-options">
                <button class="settings-name-btn ${namePrefs.god === 'god' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('god', 'god')">God</button>
                <button class="settings-name-btn ${namePrefs.god === 'elohim' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('god', 'elohim')">Elohim</button>
                <select class="settings-name-more ${!['god','elohim'].includes(namePrefs.god) ? 'selected' : ''}"
                        onchange="if(this.value) SettingsView.saveNamePreference('god', this.value)">
                  <option value="">More...</option>
                  <option value="eloah" ${namePrefs.god === 'eloah' ? 'selected' : ''}>Eloah</option>
                  <option value="elyon" ${namePrefs.god === 'elyon' ? 'selected' : ''}>El Elyon</option>
                  <option value="shaddai" ${namePrefs.god === 'shaddai' ? 'selected' : ''}>El Shaddai</option>
                </select>
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
    
    // Initialize map and drag-drop after DOM is ready
    setTimeout(() => {
      this.initLocationMap(container, currentLocation, locationPref.method !== 'gps');
      this._initTranslationDragDrop();
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

      // Update button + dropdown states without full re-render
      const container = document.querySelector('.settings-name-prefs');
      if (container) {
        const rows = container.querySelectorAll('.settings-name-row');
        rows.forEach(row => {
          const label = row.querySelector('.settings-name-label');
          if (label) {
            const labelText = label.textContent.toLowerCase();
            const keyMap = { 'messiah:': 'messiah', 'divine name:': 'divineName', 'creator:': 'god' };
            const rowKey = keyMap[labelText];
            if (rowKey === key) {
              // Map button text to values
              const valueMap = {
                'Jesus': 'jesus', 'Yeshua': 'yeshua',
                'the LORD': 'lord', 'Yahweh': 'yahweh', 'Jehovah': 'jehovah', 'YHWH': 'yhwh',
                'God': 'god', 'Elohim': 'elohim'
              };
              let matchedButton = false;
              row.querySelectorAll('.settings-name-btn').forEach(btn => {
                const mappedValue = valueMap[btn.textContent.trim()];
                const isMatch = mappedValue === value;
                btn.classList.toggle('selected', isMatch);
                if (isMatch) matchedButton = true;
              });
              // Update dropdown — if value came from dropdown, highlight it; if from button, reset dropdown
              const dropdown = row.querySelector('.settings-name-more');
              if (dropdown) {
                if (!matchedButton) {
                  dropdown.value = value;
                  dropdown.classList.add('selected');
                } else {
                  dropdown.value = '';
                  dropdown.classList.remove('selected');
                }
              }
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
  
  // ── Translation Sort List ──

  /**
   * Build the HTML for the draggable translation sort list.
   */
  _buildTranslationSortList() {
    const { visible, hidden, notLoaded, visibleCount, loadCount } = Bible.getOrderedTranslations();
    const all = [...visible, ...hidden, ...notLoaded];

    let html = '<div class="translation-sort-list" id="translation-sort-list">';
    let itemIdx = 0;
    for (let i = 0; i < all.length; i++) {
      const t = all[i];
      const isDefault = i === 0;
      const strongsBadge = t.hasStrongs ? '<span class="ts-badge ts-badge-strongs">Strong\'s</span>' : '';
      const defaultBadge = isDefault ? '<span class="ts-badge ts-badge-default">Default</span>' : '';
      const yearStr = t.year ? `<span class="ts-year">${t.year}</span>` : '';

      // Divider 1: between visible and hidden
      if (i === visibleCount) {
        html += `<div class="translation-sort-divider" data-divider="hidden">
          <span class="ts-divider-label">Hidden — tap "more" to see</span>
        </div>`;
      }

      // Divider 2: between hidden (loaded) and not-loaded
      if (i === loadCount) {
        html += `<div class="translation-sort-divider ts-divider-noload" data-divider="noload">
          <span class="ts-divider-label">Not loaded — saves space</span>
        </div>`;
      }

      html += `<div class="translation-sort-item" data-id="${t.id}" draggable="true">
        <span class="ts-grip">⠿</span>
        <span class="ts-name">${t.name}</span>
        <span class="ts-fullname">${t.fullName}</span>
        ${yearStr}
        <span class="ts-badges">${defaultBadge}${strongsBadge}</span>
      </div>`;
      itemIdx++;
    }

    // Add missing dividers at end if needed
    if (visibleCount >= all.length && !html.includes('data-divider="hidden"')) {
      html += `<div class="translation-sort-divider" data-divider="hidden">
        <span class="ts-divider-label">Hidden — tap "more" to see</span>
      </div>`;
    }
    if (loadCount >= all.length && !html.includes('data-divider="noload"')) {
      html += `<div class="translation-sort-divider ts-divider-noload" data-divider="noload">
        <span class="ts-divider-label">Not loaded — saves space</span>
      </div>`;
    }

    html += '</div>';
    return html;
  },

  /**
   * Initialize drag-and-drop event handlers on the sort list.
   * Called after the settings page renders.
   */
  _initTranslationDragDrop() {
    const list = document.getElementById('translation-sort-list');
    if (!list) return;

    let dragItem = null;
    let touchClone = null;
    let touchStartY = 0;

    // --- Mouse / HTML5 drag ---
    list.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.translation-sort-item');
      if (!item) return;
      dragItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    });

    list.addEventListener('dragend', (e) => {
      const item = e.target.closest('.translation-sort-item');
      if (item) item.classList.remove('dragging');
      dragItem = null;
      this._saveTranslationSort();
    });

    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!dragItem) return;
      const target = this._getDragTarget(e.clientY, list);
      if (target && target !== dragItem) {
        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          list.insertBefore(dragItem, target);
        } else {
          list.insertBefore(dragItem, target.nextSibling);
        }
      }
    });

    // --- Touch drag ---
    list.addEventListener('touchstart', (e) => {
      const item = e.target.closest('.translation-sort-item');
      if (!item) return;
      dragItem = item;
      touchStartY = e.touches[0].clientY;
      item.classList.add('dragging');

      // Create visual clone
      touchClone = item.cloneNode(true);
      touchClone.classList.add('ts-touch-clone');
      const rect = item.getBoundingClientRect();
      touchClone.style.width = rect.width + 'px';
      touchClone.style.left = rect.left + 'px';
      touchClone.style.top = rect.top + 'px';
      document.body.appendChild(touchClone);
    }, { passive: true });

    list.addEventListener('touchmove', (e) => {
      if (!dragItem || !touchClone) return;
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      touchClone.style.top = touchY - 20 + 'px';

      const target = this._getDragTarget(touchY, list);
      if (target && target !== dragItem) {
        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (touchY < midY) {
          list.insertBefore(dragItem, target);
        } else {
          list.insertBefore(dragItem, target.nextSibling);
        }
      }
    }, { passive: false });

    list.addEventListener('touchend', () => {
      if (dragItem) dragItem.classList.remove('dragging');
      if (touchClone) { touchClone.remove(); touchClone = null; }
      dragItem = null;
      this._saveTranslationSort();
    });
  },

  /**
   * Find the sort item under a Y coordinate (skipping divider).
   */
  _getDragTarget(clientY, list) {
    const items = list.querySelectorAll('.translation-sort-item:not(.dragging)');
    let closest = null;
    let closestDist = Infinity;
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      const dist = Math.abs(clientY - (rect.top + rect.height / 2));
      if (dist < closestDist) {
        closestDist = dist;
        closest = item;
      }
    }
    return closest;
  },

  /**
   * Read current DOM order + divider position and save to localStorage.
   */
  _saveTranslationSort() {
    const list = document.getElementById('translation-sort-list');
    if (!list) return;

    const children = Array.from(list.children);
    const order = [];
    let visibleCount = 0;
    let loadCount = 0;
    let foundHiddenDivider = false;
    let foundNoloadDivider = false;

    for (const child of children) {
      if (child.dataset && child.dataset.divider === 'hidden') {
        foundHiddenDivider = true;
        visibleCount = order.length;
        continue;
      }
      if (child.dataset && child.dataset.divider === 'noload') {
        foundNoloadDivider = true;
        loadCount = order.length;
        continue;
      }
      if (child.dataset && child.dataset.id) {
        order.push(child.dataset.id);
      }
    }

    // If dividers not found, default to all
    if (!foundHiddenDivider) visibleCount = order.length;
    if (!foundNoloadDivider) loadCount = order.length;
    // Enforce constraints
    if (visibleCount < 1) visibleCount = 1;
    if (loadCount < visibleCount) loadCount = visibleCount;

    Bible.saveTranslationOrder(order, visibleCount, loadCount);

    // Re-render the list to update badges
    const container = document.getElementById('translation-sort-container');
    if (container) {
      container.innerHTML = this._buildTranslationSortList();
      this._initTranslationDragDrop();
    }
  },

  /**
   * Get translation preference from localStorage
   */
  getTranslationPreference() {
    // Use Bible API's ordered list — first item is the default
    if (typeof Bible !== 'undefined' && Bible.getDefaultTranslation) {
      return Bible.getDefaultTranslation();
    }
    try {
      return localStorage.getItem('bible_translation_preference') || 'kjv';
    } catch (e) {
      return 'kjv';
    }
  },

  /**
   * Save translation preference (legacy — now handled by sort order)
   */
  saveTranslationPreference(translation) {
    try {
      localStorage.setItem('bible_translation_preference', translation);
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
// Map of divine name preference values to their display text
const DIVINE_NAME_MAP = {
  'lord': { display: 'the LORD', upper: 'THE LORD', bare: 'LORD' },
  'yahweh': { display: 'Yahweh', upper: 'YAHWEH', bare: 'Yahweh' },
  'jehovah': { display: 'Jehovah', upper: 'JEHOVAH', bare: 'Jehovah' },
  'yhwh': { display: 'YHWH', upper: 'YHWH', bare: 'YHWH' },
  'yhvh': { display: 'YHVH', upper: 'YHVH', bare: 'YHVH' },
  'yhuh': { display: 'YHUH', upper: 'YHUH', bare: 'YHUH' },
  'yehovah': { display: 'Yehovah', upper: 'YEHOVAH', bare: 'Yehovah' },
  'yahuah': { display: 'Yahuah', upper: 'YAHUAH', bare: 'Yahuah' },
  'yah': { display: 'Yah', upper: 'YAH', bare: 'Yah' },
  'paleo': { display: '𐤉𐤄𐤅𐤄', upper: '𐤉𐤄𐤅𐤄', bare: '𐤉𐤄𐤅𐤄' },
  'hebrew': { display: 'יהוה', upper: 'יהוה', bare: 'יהוה' },
  'hashem': { display: 'HaShem', upper: 'HASHEM', bare: 'HaShem' },
  'adonai': { display: 'Adonai', upper: 'ADONAI', bare: 'Adonai' }
};

const MESSIAH_NAME_MAP = {
  'jesus': { display: 'Jesus', upper: 'JESUS' },
  'yeshua': { display: 'Yeshua', upper: 'YESHUA' },
  'yahushua': { display: 'Yahushua', upper: 'YAHUSHUA' },
  'yehoshua': { display: 'Yehoshua', upper: 'YEHOSHUA' },
  'iesous': { display: 'Iesous', upper: 'IESOUS' }
};

const GOD_NAME_MAP = {
  'god': { display: 'God', upper: 'GOD' },
  'elohim': { display: 'Elohim', upper: 'ELOHIM' },
  'eloah': { display: 'Eloah', upper: 'ELOAH' },
  'elyon': { display: 'El Elyon', upper: 'EL ELYON' },
  'shaddai': { display: 'El Shaddai', upper: 'EL SHADDAI' }
};

function applyNamePreferences(text) {
  if (!text) return text;

  const prefs = SettingsView.getNamePreferences();
  let result = text;

  // Messiah name
  const messiah = MESSIAH_NAME_MAP[prefs.messiah];
  if (messiah && prefs.messiah !== 'jesus') {
    result = result.replace(/\bJesus\b/g, messiah.display);
    result = result.replace(/\bJESUS\b/g, messiah.upper);
  } else if (prefs.messiah === 'jesus') {
    // Normalize any non-standard back to Jesus
    result = result.replace(/\bYeshua\b/g, 'Jesus');
    result = result.replace(/\bYESHUA\b/g, 'JESUS');
  }

  // Divine name (LORD → user's preference)
  const divine = DIVINE_NAME_MAP[prefs.divineName];
  if (divine && prefs.divineName !== 'lord') {
    result = result.replace(/\bthe LORD\b/g, divine.display);
    result = result.replace(/\bTHE LORD\b/g, divine.upper);
    result = result.replace(/\bLORD\b/g, divine.bare);
    // Also handle "Jehovah" in ASV → user's preference
    if (prefs.divineName !== 'jehovah') {
      result = result.replace(/\bJehovah\b/g, divine.display);
      result = result.replace(/\bJEHOVAH\b/g, divine.upper);
    }
  }
  // If 'lord', keep as-is

  // God/Creator name
  const god = GOD_NAME_MAP[prefs.god];
  if (god && prefs.god !== 'god') {
    result = result.replace(/\bGod\b/g, god.display);
    result = result.replace(/\bGOD\b/g, god.upper);
  }
  // If 'god', keep as-is

  return result;
}

// Make available globally
window.SettingsView = SettingsView;
window.applyNamePreferences = applyNamePreferences;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsView;
}
