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
    const themePreference = this.getThemePreference();
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
      .join('')
      + '<option value="__custom__">➕ Create Custom...</option>';
    
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
                  <option value="hebrew" ${namePrefs.god === 'hebrew' ? 'selected' : ''}>Hebrew Names (Elohim / El / Eloah per Strong's)</option>
                </select>
              </div>
            </div>
            
            <div class="settings-name-row">
              <label class="settings-name-label">Christ:</label>
              <div class="settings-name-options">
                <button class="settings-name-btn ${namePrefs.christ === 'christ' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('christ', 'christ')">Christ</button>
                <button class="settings-name-btn ${namePrefs.christ === 'messiah' ? 'selected' : ''}" 
                        onclick="SettingsView.saveNamePreference('christ', 'messiah')">Messiah</button>
                <select class="settings-name-more ${!['christ','messiah'].includes(namePrefs.christ) ? 'selected' : ''}"
                        onchange="if(this.value) SettingsView.saveNamePreference('christ', this.value)">
                  <option value="">More...</option>
                  <option value="mashiach" ${namePrefs.christ === 'mashiach' ? 'selected' : ''}>Mashiach</option>
                  <option value="anointed" ${namePrefs.christ === 'anointed' ? 'selected' : ''}>Anointed One</option>
                </select>
              </div>
            </div>
            
            <div class="settings-name-status" id="name-prefs-status"></div>
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
          <p class="settings-description">Choose your preferred color theme. Auto follows your system setting, or uses time of day.</p>
          <div class="settings-theme-options">
            <button class="settings-option-btn ${themePreference === 'auto' ? 'selected' : ''}" 
                    onclick="AppStore.dispatch({type:'SET_THEME', theme:'auto'})"
                    data-theme="auto">
              <span class="option-icon">🔄</span>
              <span class="option-label">Auto</span>
            </button>
            <button class="settings-option-btn ${themePreference === 'dark' ? 'selected' : ''}" 
                    onclick="AppStore.dispatch({type:'SET_THEME', theme:'dark'})"
                    data-theme="dark">
              <span class="option-icon">🌙</span>
              <span class="option-label">Dark</span>
            </button>
            <button class="settings-option-btn ${themePreference === 'light' ? 'selected' : ''}" 
                    onclick="AppStore.dispatch({type:'SET_THEME', theme:'light'})"
                    data-theme="light">
              <span class="option-icon">☀️</span>
              <span class="option-label">Light</span>
            </button>
          </div>
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
      mapContainer.innerHTML = '<p style="color: var(--text-tertiary);">Map component not available</p>';
    }
  },
  
  /**
   * Save profile preference
   */
  saveProfilePreference(profileId) {
    if (profileId === '__custom__') {
      // Reset dropdown to current profile while modal is open
      const select = document.getElementById('settings-profile-select');
      const state = AppStore.getState();
      if (select) select.value = state.context.profileId;
      
      // Show the profile name modal (reuse CalendarView's modal)
      if (typeof CalendarView !== 'undefined' && CalendarView.showProfileNameModal) {
        CalendarView.showProfileNameModal('create', () => {
          // After creation, update the dropdown to show the new profile
          this._refreshProfileDropdown();
        });
      }
      return;
    }
    
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
   * Refresh the profile dropdown to reflect current profiles and selection
   */
  _refreshProfileDropdown() {
    const select = document.getElementById('settings-profile-select');
    if (!select) return;
    const state = AppStore.getState();
    const currentProfileId = state.context.profileId || 'timeTested';
    const profiles = window.PROFILES || {};
    
    let html = Object.entries(profiles)
      .map(([id, profile]) => {
        const icon = profile.icon || '📅';
        const name = profile.name || id;
        const selected = id === currentProfileId ? ' selected' : '';
        return `<option value="${id}"${selected}>${icon} ${name}</option>`;
      })
      .join('');
    html += '<option value="__custom__">➕ Create Custom...</option>';
    select.innerHTML = html;
    
    // Also persist the new profile as default
    try { localStorage.setItem('defaultCalendarProfile', currentProfileId); } catch(e) {}
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
    // Defaults — when all are default, name substitution is completely disabled (zero overhead)
    return {
      messiah: 'jesus',      // 'jesus', 'yeshua', etc.
      divineName: 'lord',    // 'lord', 'yhwh', 'yahweh', etc.
      god: 'god',            // 'god', 'elohim', 'hebrew'
      christ: 'christ'       // 'christ', 'messiah', 'mashiach', 'anointed'
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
            const keyMap = { 'messiah:': 'messiah', 'divine name:': 'divineName', 'creator:': 'god', 'christ:': 'christ' };
            const rowKey = keyMap[labelText];
            if (rowKey === key) {
              // Map button text to values
              const valueMap = {
                'Jesus': 'jesus', 'Yeshua': 'yeshua',
                'the LORD': 'lord', 'Yahweh': 'yahweh', 'Jehovah': 'jehovah', 'YHWH': 'yhwh',
                'God': 'god', 'Elohim': 'elohim',
                'Christ': 'christ', 'Messiah': 'messiah'
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
      
      // Update the active flag for the substitution engine
      updateNameSubsActive();
      
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

      html += `<div class="translation-sort-item" data-id="${t.id}">
        <span class="ts-grip" draggable="true">⠿</span>
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

    // --- Mouse / HTML5 drag (only from grip) ---
    list.addEventListener('dragstart', (e) => {
      if (!e.target.closest('.ts-grip')) { e.preventDefault(); return; }
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

    // --- Touch drag (only from grip) ---
    list.addEventListener('touchstart', (e) => {
      if (!e.target.closest('.ts-grip')) return;
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
      return localStorage.getItem('userThemePreference') || 'auto';
    } catch (e) {
      return 'auto';
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
   * Save theme preference (dispatches through AppStore)
   */
  saveThemePreference(theme) {
    AppStore.dispatch({ type: 'SET_THEME', theme });
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
  'hebrew': { display: null, upper: null } // Special: uses actual Hebrew per Strong's number
};

// Per-Strong's Hebrew name map for 'hebrew' mode
const GOD_HEBREW_MAP = {
  'H430': { display: 'Elohim', upper: 'ELOHIM' },
  'H410': { display: 'El', upper: 'EL' },
  'H433': { display: 'Eloah', upper: 'ELOAH' },
  'G2316': { display: 'Theos', upper: 'THEOS' }
};

const CHRIST_NAME_MAP = {
  'christ': { display: 'Christ', upper: 'CHRIST' },
  'messiah': { display: 'Messiah', upper: 'MESSIAH' },
  'mashiach': { display: 'Mashiach', upper: 'MASHIACH' },
  'anointed': { display: 'Anointed One', upper: 'ANOINTED ONE' }
};

// ── Name Substitution Engine ──
// When all preferences are at defaults, the entire system is skipped (zero overhead).
// For Strong's translations: precise identification via Strong's number + word text.
// For other translations: careful regex on text content only (skips HTML tags).

let nameSubsActive = false;

function updateNameSubsActive() {
  const p = SettingsView.getNamePreferences();
  nameSubsActive = (p.divineName !== 'lord' || p.messiah !== 'jesus' || p.god !== 'god' || p.christ !== 'christ');
  // Update status hint in settings UI
  const statusEl = document.getElementById('name-prefs-status');
  if (statusEl) {
    statusEl.textContent = nameSubsActive ? '' : 'Using native translation text. Select an alternative above to enable name substitution.';
  }
}

// Initialize on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', updateNameSubsActive);
}

/**
 * Strong's-based name substitution.
 * Called from renderInlineStrongs() for each tagged word.
 * Returns the replacement display text, or null if no substitution needed.
 * @param {string} strongsNum - e.g. "H3068", "G2424"
 * @param {string} word - the rendered English word from the translation
 * @returns {string|null} replacement text, or null
 */
function getNameSubstitution(strongsNum, word) {
  if (!nameSubsActive) return null;
  const prefs = SettingsView.getNamePreferences();

  // ── Divine Name: H3068 (YHWH), H3069 (YHWH variant in "Lord GOD"), H3050 (Yah) ──
  if (strongsNum === 'H3068' || strongsNum === 'H3069') {
    if (prefs.divineName === 'lord') return null;
    const divine = DIVINE_NAME_MAP[prefs.divineName];
    if (!divine) return null;
    if (word === 'GOD') return divine.bare;           // "Lord GOD" context (H3069)
    if (word === 'Jehovah' || word === 'JEHOVAH') return word === 'JEHOVAH' ? divine.upper : divine.display;
    // Default: "LORD" → bare form (leading "the" handled separately)
    return divine.bare;
  }
  if (strongsNum === 'H3050') {
    if (prefs.divineName === 'lord') return null;
    // Short form "Yah"/"JAH" — use the preference's bare form
    const divine = DIVINE_NAME_MAP[prefs.divineName];
    if (!divine) return null;
    return divine.bare;
  }

  // ── Creator/God: H430 (Elohim), H410 (El), H433 (Eloah), G2316 (Theos) ──
  if (strongsNum === 'H430' || strongsNum === 'H410' || strongsNum === 'H433' || strongsNum === 'G2316') {
    if (prefs.god === 'god') return null;
    // Only replace capitalized "God" / "GOD", not lowercase "gods"
    if (word !== 'God' && word !== 'GOD') return null;
    if (prefs.god === 'hebrew') {
      const heb = GOD_HEBREW_MAP[strongsNum];
      if (!heb) return null;
      return word === 'GOD' ? heb.upper : heb.display;
    }
    const god = GOD_NAME_MAP[prefs.god];
    if (!god || !god.display) return null;
    return word === 'GOD' ? god.upper : god.display;
  }

  // ── Messiah: G2424 (Iesous) ──
  if (strongsNum === 'G2424') {
    if (prefs.messiah === 'jesus') return null;
    // Only replace "Jesus"/"JESUS", NOT "Joshua" (same Strong's, different anglicization)
    if (word !== 'Jesus' && word !== 'JESUS') return null;
    const messiah = MESSIAH_NAME_MAP[prefs.messiah];
    if (!messiah) return null;
    return word === 'JESUS' ? messiah.upper : messiah.display;
  }

  // ── Christ: G5547 (Christos) ──
  if (strongsNum === 'G5547') {
    if (prefs.christ === 'christ') return null;
    if (word !== 'Christ' && word !== 'CHRIST' && word !== "Christ's") return null;
    const christ = CHRIST_NAME_MAP[prefs.christ];
    if (!christ) return null;
    if (word === "Christ's") return christ.display + "'s";
    return word === 'CHRIST' ? christ.upper : christ.display;
  }

  return null;
}

/**
 * Regex-based name substitution for non-Strong's translations.
 * Operates on an HTML string, only replacing text content (not inside tags).
 * Wraps substituted names in <span class="name-sub"> with data-original.
 * @param {string} html - HTML string (may contain tags from annotations/symbols)
 * @returns {string} HTML with name substitutions applied
 */
function applyNamePreferencesHTML(html) {
  if (!nameSubsActive || !html) return html;
  const prefs = SettingsView.getNamePreferences();

  // Split HTML into tag portions and text portions; only replace in text
  return html.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
    if (tag) return tag;
    if (!text) return match;
    return _replaceNamesInText(text, prefs);
  });
}

// Collect substitutions as [index, original, replacement] tuples during regex pass,
// then apply them in reverse order to avoid offset shifting.
// This avoids chained-regex matching inside previously-inserted HTML.
function _replaceNamesInText(text, prefs) {
  const subs = []; // {start, end, original, replacement}

  function collectMatches(regex, replacement, original) {
    let m;
    while ((m = regex.exec(text)) !== null) {
      // Skip if this range overlaps with an already-collected substitution
      const overlaps = subs.some(s => m.index < s.end && (m.index + m[0].length) > s.start);
      if (!overlaps) {
        subs.push({ start: m.index, end: m.index + m[0].length, original: original || m[0], replacement });
      }
    }
  }

  // Divine name — "the LORD" / "LORD" / "Jehovah" (longer patterns first)
  if (prefs.divineName !== 'lord') {
    const divine = DIVINE_NAME_MAP[prefs.divineName];
    if (divine) {
      collectMatches(/\bthe LORD\b/g, divine.display, 'the LORD');
      collectMatches(/\bTHE LORD\b/g, divine.upper, 'THE LORD');
      collectMatches(/\bLORD\b/g, divine.bare, 'LORD');
      if (prefs.divineName !== 'jehovah') {
        collectMatches(/\bJehovah\b/g, divine.display, 'Jehovah');
        collectMatches(/\bJEHOVAH\b/g, divine.upper, 'JEHOVAH');
      }
    }
  }

  // Messiah — "Jesus"
  if (prefs.messiah !== 'jesus') {
    const messiah = MESSIAH_NAME_MAP[prefs.messiah];
    if (messiah) {
      collectMatches(/\bJesus\b/g, messiah.display, 'Jesus');
      collectMatches(/\bJESUS\b/g, messiah.upper, 'JESUS');
    }
  }

  // Creator — "God" (not "gods", "godly", etc.)
  if (prefs.god !== 'god') {
    const god = GOD_NAME_MAP[prefs.god];
    if (god && god.display) {
      collectMatches(/\bGod\b/g, god.display, 'God');
      collectMatches(/\bGOD\b/g, god.upper, 'GOD');
    } else if (prefs.god === 'hebrew') {
      collectMatches(/\bGod\b/g, 'Elohim', 'God');
      collectMatches(/\bGOD\b/g, 'ELOHIM', 'GOD');
    }
  }

  // Christ
  if (prefs.christ !== 'christ') {
    const christ = CHRIST_NAME_MAP[prefs.christ];
    if (christ) {
      collectMatches(/\bChrist\b/g, christ.display, 'Christ');
      collectMatches(/\bCHRIST\b/g, christ.upper, 'CHRIST');
    }
  }

  if (subs.length === 0) return text;

  // Sort by position (reverse order) so we can splice from the end without shifting offsets
  subs.sort((a, b) => b.start - a.start);

  let result = text;
  for (const sub of subs) {
    const escaped = sub.original.replace(/"/g, '&quot;');
    const span = `<span class="name-sub" data-original="${escaped}" onmouseenter="if(typeof showWordTooltip==='function')showWordTooltip(event)" onmouseleave="if(typeof hideWordTooltip==='function')hideWordTooltip(event)">${sub.replacement}</span>`;
    result = result.slice(0, sub.start) + span + result.slice(sub.end);
  }

  return result;
}

// Legacy plain-text version (no HTML wrapping) for non-rendering contexts
function applyNamePreferences(text) {
  if (!nameSubsActive || !text) return text;
  const prefs = SettingsView.getNamePreferences();

  let result = text;
  if (prefs.divineName !== 'lord') {
    const divine = DIVINE_NAME_MAP[prefs.divineName];
    if (divine) {
      result = result.replace(/\bthe LORD\b/g, divine.display);
      result = result.replace(/\bTHE LORD\b/g, divine.upper);
      result = result.replace(/\bLORD\b/g, divine.bare);
      if (prefs.divineName !== 'jehovah') {
        result = result.replace(/\bJehovah\b/g, divine.display);
        result = result.replace(/\bJEHOVAH\b/g, divine.upper);
      }
    }
  }
  if (prefs.messiah !== 'jesus') {
    const messiah = MESSIAH_NAME_MAP[prefs.messiah];
    if (messiah) {
      result = result.replace(/\bJesus\b/g, messiah.display);
      result = result.replace(/\bJESUS\b/g, messiah.upper);
    }
  }
  if (prefs.god !== 'god') {
    const god = GOD_NAME_MAP[prefs.god];
    if (god && god.display) {
      result = result.replace(/\bGod\b/g, god.display);
      result = result.replace(/\bGOD\b/g, god.upper);
    } else if (prefs.god === 'hebrew') {
      result = result.replace(/\bGod\b/g, 'Elohim');
      result = result.replace(/\bGOD\b/g, 'ELOHIM');
    }
  }
  if (prefs.christ !== 'christ') {
    const christ = CHRIST_NAME_MAP[prefs.christ];
    if (christ) {
      result = result.replace(/\bChrist\b/g, christ.display);
      result = result.replace(/\bCHRIST\b/g, christ.upper);
    }
  }
  return result;
}

// Make available globally
window.SettingsView = SettingsView;
window.applyNamePreferences = applyNamePreferences;
window.applyNamePreferencesHTML = applyNamePreferencesHTML;
window.getNameSubstitution = getNameSubstitution;
window.nameSubsActive = false; // Will be updated by updateNameSubsActive

// Re-export nameSubsActive as a getter so bible-reader.js can check it
Object.defineProperty(window, 'nameSubsActive', {
  get() { return nameSubsActive; },
  configurable: true
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsView;
}
