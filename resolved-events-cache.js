/**
 * ResolvedEventsCache — Singleton service for resolved timeline event data.
 *
 * Architecture:
 *   Raw Events JSON + Profile Config → EventResolver → Resolved Events
 *   Cached in: RAM (instant) + localStorage (persistent across page loads)
 *
 * The transformation is deterministic and stateless:
 *   same (data + profile) → same output, every time.
 *
 * Cache is invalidated when:
 *   - CACHE_VERSION is bumped (code/data schema change)
 *   - A new profile configuration is used (different settings → different dates)
 *
 * Usage:
 *   const events = ResolvedEventsCache.getEvents(profile);      // sync, from cache
 *   const events = await ResolvedEventsCache.getEventsAsync(profile, onProgress); // async, computes if needed
 *   ResolvedEventsCache.invalidate(profile);                     // clear a profile's cache
 */
const ResolvedEventsCache = (() => {
  // ── Configuration ──────────────────────────────────────────────────────
  // Bump when event-resolver.js logic, data schema, or historical-events JSON changes.
  const CACHE_VERSION = String(typeof APP_VERSION !== 'undefined' ? APP_VERSION : 0);
  const STORAGE_PREFIX = 'rev_cache_v';

  // ── Internal State ─────────────────────────────────────────────────────
  let _data = null;            // Raw event data (loaded once from JSON)
  let _dataPromise = null;     // In-flight data load promise
  const _ram = new Map();      // profileKey → Array<resolved event>
  const _computing = new Map();// profileKey → Promise (in-flight computations)

  // ── Profile Key ────────────────────────────────────────────────────────
  // Deterministic hash of all profile fields that affect event resolution.
  function profileKey(profile) {
    if (!profile) return 'default';
    const p = {
      moonPhase:          profile.moonPhase || 'full',
      dayStartTime:       profile.dayStartTime || 'morning',
      dayStartAngle:      Math.round((profile.dayStartAngle ?? 12) * 1000) / 1000,
      yearStartRule:      profile.yearStartRule || 'equinox',
      crescentThreshold:  Math.round((profile.crescentThreshold ?? 18) * 1000) / 1000,
      lat:                Math.round((profile.lat || 31.7683) * 10000) / 10000,
      lon:                Math.round((profile.lon || 35.2137) * 10000) / 10000,
      amEpoch:            profile.amEpoch || -4000
    };
    const str = JSON.stringify(p);
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  function storageKey(pKey) {
    return `${STORAGE_PREFIX}${CACHE_VERSION}_${pKey}`;
  }

  // ── Data Loading ───────────────────────────────────────────────────────
  async function loadData() {
    if (_data) return _data;
    if (_dataPromise) return _dataPromise;

    _dataPromise = (async () => {
      try {
        const resp = await fetch('/historical-events-v2.json?v=' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : 0));
        if (resp.ok) { _data = await resp.json(); return _data; }
      } catch (e) { /* fall through */ }
      console.error('[ResolvedEventsCache] Failed to load event data');
      _dataPromise = null;
      return null;
    })();

    return _dataPromise;
  }

  // ── localStorage I/O ───────────────────────────────────────────────────
  function loadFromStorage(pKey) {
    try {
      const raw = localStorage.getItem(storageKey(pKey));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.v !== CACHE_VERSION || !Array.isArray(parsed.events)) {
        localStorage.removeItem(storageKey(pKey));
        return null;
      }
      return parsed.events;
    } catch (e) {
      return null;
    }
  }

  function saveToStorage(pKey, events) {
    try {
      const payload = { v: CACHE_VERSION, t: Date.now(), events };
      localStorage.setItem(storageKey(pKey), JSON.stringify(payload));
      console.log(`[ResolvedEventsCache] Saved ${events.length} events (profile: ${pKey})`);
    } catch (e) {
      console.warn('[ResolvedEventsCache] localStorage save failed:', e);
      // Try to make room by clearing old caches
      clearOldCaches();
      try {
        const payload = { v: CACHE_VERSION, t: Date.now(), events };
        localStorage.setItem(storageKey(pKey), JSON.stringify(payload));
      } catch (e2) { /* give up */ }
    }
  }

  function clearOldCaches() {
    try {
      const currentPrefix = storageKey('');
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        // Remove old versions of this cache
        if (key.startsWith(STORAGE_PREFIX) && !key.startsWith(currentPrefix)) {
          keysToRemove.push(key);
        }
        // Remove legacy cache keys from the old system
        if (key.startsWith('timeline_resolved_events') || key.startsWith('resolved_events_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      if (keysToRemove.length > 0) {
        console.log(`[ResolvedEventsCache] Cleared ${keysToRemove.length} old cache entries`);
      }
    } catch (e) { /* ignore */ }
  }

  // ── Public API ─────────────────────────────────────────────────────────
  return {
    CACHE_VERSION,
    profileKey,

    /** Get raw event data synchronously (null if not yet loaded). */
    getDataSync() { return _data; },

    /** Load raw event data (fetches if not already loaded). */
    async getData() { return loadData(); },

    /**
     * Get resolved events synchronously from cache.
     * Returns the cached array, or null if not cached for this profile.
     * This is the fast path — no computation, no async, no loading spinner.
     */
    getEvents(profile) {
      const pKey = profileKey(profile);
      // RAM cache (instant)
      if (_ram.has(pKey)) return _ram.get(pKey);
      // localStorage (fast)
      const stored = loadFromStorage(pKey);
      if (stored) {
        _ram.set(pKey, stored);
        return stored;
      }
      return null;
    },

    /** Check whether resolved events are cached for this profile. */
    isCached(profile) {
      const pKey = profileKey(profile);
      return _ram.has(pKey) || !!loadFromStorage(pKey);
    },

    /**
     * Get resolved events, computing if necessary.
     * If cached (RAM or localStorage), returns instantly.
     * Otherwise loads data, runs EventResolver, caches, and returns.
     * @param {object} profile - Calendar profile settings
     * @param {function} [onProgress] - Optional (percent, message) callback
     * @returns {Promise<Array>} Resolved events
     */
    async getEventsAsync(profile, onProgress) {
      const pKey = profileKey(profile);

      // RAM cache
      if (_ram.has(pKey)) return _ram.get(pKey);

      // localStorage
      const stored = loadFromStorage(pKey);
      if (stored) {
        _ram.set(pKey, stored);
        return stored;
      }

      // Already computing for this profile? Wait for it.
      if (_computing.has(pKey)) return _computing.get(pKey);

      // Compute fresh
      const promise = (async () => {
        try {
          const data = await loadData();
          if (!data || typeof EventResolver === 'undefined') return [];

          clearOldCaches();

          let events;
          if (onProgress && typeof EventResolver.resolveAllEventsAsync === 'function') {
            events = await EventResolver.resolveAllEventsAsync(data, profile, onProgress);
          } else {
            events = EventResolver.resolveAllEvents(data, profile);
          }

          _ram.set(pKey, events);
          saveToStorage(pKey, events);
          console.log(`[ResolvedEventsCache] Resolved ${events.length} events for profile ${pKey}`);
          return events;
        } catch (e) {
          console.error('[ResolvedEventsCache] Resolution failed:', e);
          return [];
        } finally {
          _computing.delete(pKey);
        }
      })();

      _computing.set(pKey, promise);
      return promise;
    },

    /**
     * Invalidate cache for a specific profile, or all profiles if none given.
     */
    invalidate(profile) {
      if (profile) {
        const pKey = profileKey(profile);
        _ram.delete(pKey);
        try { localStorage.removeItem(storageKey(pKey)); } catch (e) {}
        console.log(`[ResolvedEventsCache] Invalidated profile ${pKey}`);
      } else {
        _ram.clear();
        try {
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
          }
          keys.forEach(k => localStorage.removeItem(k));
        } catch (e) {}
        console.log('[ResolvedEventsCache] Invalidated all profiles');
      }
    },

    /**
     * Pre-warm cache for a profile (non-blocking).
     * Call during app startup so data is ready before user navigates to timeline.
     */
    async preload(profile) {
      return this.getEventsAsync(profile);
    }
  };
})();

// Expose globally
if (typeof window !== 'undefined') {
  window.ResolvedEventsCache = ResolvedEventsCache;

  // Legacy global wrappers (previously in historical-events.js)
  // Kept so any stray callers don't break.
  window.clearResolvedEventsCache = () => ResolvedEventsCache.invalidate();
  window.clearAllEventCaches = () => ResolvedEventsCache.invalidate();
  window.getSWVersion = async () => ResolvedEventsCache.CACHE_VERSION;
  window.getSWVersionSync = () => ResolvedEventsCache.CACHE_VERSION;
  window.getProfileHash = (profile) => ResolvedEventsCache.profileKey(profile);
}
