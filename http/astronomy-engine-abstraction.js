// Astronomy Engine Abstraction Layer
// Extracted from index.html for Phase 9 refactoring
// This abstraction allows switching between different astronomy calculation
// libraries (astronomy-engine, Swiss Ephemeris WASM, etc.) without changing
// the rest of the codebase.

// Available engines registry
const AstroEngines = {
  // Cache for Virgo rule calculations, keyed by year
  virgoCache: {}
};

// Currently active engine instance
let activeAstroEngine = null;

// Engine interface definition (for documentation):
// {
//   name: string,                          // Human-readable name
//   version: string,                       // Library version
//   deltaTModel: string,                   // ΔT model used
//   isLoaded: boolean,                     // Whether engine is ready
//   
//   // Core methods:
//   searchMoonPhase(phase, startDate, limitDays) => { date: Date } | null
//   getSeasons(year) => { mar_equinox: { date: Date }, ... }
//   searchRiseSet(body, observer, direction, startDate, limitDays) => { date: Date } | null
//   searchAltitude(body, observer, direction, startDate, limitDays, altitude) => { date: Date } | null
//   getEquator(body, date, observer) => { ra: number, dec: number }
//   getHorizon(date, observer, ra, dec) => { altitude: number, azimuth: number }
//   getDeltaT(date) => number (in seconds)
//   createObserver(lat, lon, elevation) => observer object
// }

// ============================================================================
// ASTRONOMY-ENGINE IMPLEMENTATION
// ============================================================================
AstroEngines.astronomyEngine = {
  name: 'astronomy-engine',
  version: '2.1.19',
  deltaTModel: 'Espenak-Meeus polynomial',
  deltaTNote: 'Good for modern dates; ~9.5h ΔT uncertainty at 1500 BC',
  isLoaded: true, // Loaded synchronously via script tag
  
  searchMoonPhase(phase, startDate, limitDays) {
    return Astronomy.SearchMoonPhase(phase, startDate, limitDays);
  },
  
  getSeasons(year) {
    return Astronomy.Seasons(year);
  },
  
  searchRiseSet(body, observer, direction, startDate, limitDays) {
    const astroBody = body === 'sun' ? Astronomy.Body.Sun : Astronomy.Body.Moon;
    return Astronomy.SearchRiseSet(astroBody, observer, direction, startDate, limitDays);
  },
  
  searchAltitude(body, observer, direction, startDate, limitDays, altitude) {
    const astroBody = body === 'sun' ? Astronomy.Body.Sun : Astronomy.Body.Moon;
    return Astronomy.SearchAltitude(astroBody, observer, direction, startDate, limitDays, altitude);
  },
  
  getEquator(body, date, observer) {
    // Validate date before calling astronomy-engine
    if (!date || isNaN(date.getTime())) {
      return { ra: 0, dec: 0 };
    }
    try {
      const astroBody = body === 'sun' ? Astronomy.Body.Sun : Astronomy.Body.Moon;
      const result = Astronomy.Equator(astroBody, date, observer, true, true);
      
      // Validate result
      if (result && isFinite(result.ra) && isFinite(result.dec)) {
        return result;
      }
      return { ra: 0, dec: 0 };
    } catch (err) {
      return { ra: 0, dec: 0 };
    }
  },
  
  getHorizon(date, observer, ra, dec) {
    // Validate inputs before calling astronomy-engine
    if (!date || isNaN(date.getTime()) || !isFinite(ra) || !isFinite(dec)) {
      return { altitude: 0, azimuth: 0 };
    }
    try {
      const result = Astronomy.Horizon(date, observer, ra, dec, 'normal');
      if (result && isFinite(result.altitude) && isFinite(result.azimuth)) {
        return result;
      }
      return { altitude: 0, azimuth: 0 };
    } catch (err) {
      return { altitude: 0, azimuth: 0 };
    }
  },
  
  getDeltaT(date) {
    // astronomy-engine doesn't expose DeltaT directly, but we can calculate it
    // from the difference between TT and UT
    const astroTime = new Astronomy.AstroTime(date);
    return (astroTime.tt - astroTime.ut) * 86400; // Convert days to seconds
  },
  
  createObserver(lat, lon, elevation = 0) {
    return new Astronomy.Observer(lat, lon, elevation);
  }
};

// ============================================================================
// SWISS EPHEMERIS WASM IMPLEMENTATION (@swisseph/browser - self-hosted)
// ============================================================================
AstroEngines.swissEphemeris = {
  name: 'Swiss Ephemeris',
  version: 'Loading...',
  deltaTModel: 'Moshier Ephemeris',
  deltaTNote: 'Built-in analytical ephemeris; good for dates from 3000 BC to 3000 AD',
  isLoaded: false,
  _swe: null,
  _module: null,
  _loadPromise: null,
  
  async load() {
    if (this.isLoaded) return true;
    if (this._loadPromise) return this._loadPromise;
    
    this._loadPromise = (async () => {
      try {
        // Dynamic import of self-hosted @swisseph/browser
        const module = await import('/lib/swisseph/swisseph-browser.js');
        this._module = module;
        
        // Create SwissEphemeris instance and initialize WASM with explicit path
        this._swe = new module.SwissEphemeris();
        await this._swe.init('/lib/swisseph/swisseph.wasm');
        
        this.version = '1.1.0';
        this.isLoaded = true;
        console.log('Swiss Ephemeris WASM loaded successfully');
        return true;
      } catch (err) {
        console.error('Failed to load Swiss Ephemeris WASM:', err);
        this.isLoaded = false;
        return false;
      }
    })();
    
    return this._loadPromise;
  },
  
  // Julian Day conversion helpers
  _dateToJD(date) {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const h = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    
    // Julian calendar for dates before Oct 15, 1582
    // Gregorian calendar for dates on or after Oct 15, 1582
    let jdn;
    if (y < 1582 || (y === 1582 && (m < 10 || (m === 10 && d < 15)))) {
      jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
    } else {
      jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
    }
    return jdn + (h - 12) / 24;
  },
  
  _jdToDate(jd) {
    // Helper to create Date with proper year handling (including negative years)
    const createDate = (year, month, day, h, min, sec) => {
      // JavaScript Date.UTC interprets years 0-99 as 1900-1999
      // We need to use setUTCFullYear for ancient dates
      const date = new Date(Date.UTC(2000, month - 1, day, h, min, sec));
      date.setUTCFullYear(year);
      return date;
    };
    
    if (!this._swe) {
      // Manual Julian Day to calendar date conversion
      const z = Math.floor(jd + 0.5);
      const f = jd + 0.5 - z;
      let a = z;
      if (z >= 2299161) {
        const alpha = Math.floor((z - 1867216.25) / 36524.25);
        a = z + 1 + alpha - Math.floor(alpha / 4);
      }
      const b = a + 1524;
      const c = Math.floor((b - 122.1) / 365.25);
      const d = Math.floor(365.25 * c);
      const e = Math.floor((b - d) / 30.6001);
      
      const day = b - d - Math.floor(30.6001 * e);
      const month = e < 14 ? e - 1 : e - 13;
      const year = month > 2 ? c - 4716 : c - 4715;
      
      const hours = f * 24;
      const h = Math.floor(hours);
      const minutes = (hours - h) * 60;
      const min = Math.floor(minutes);
      const sec = Math.floor((minutes - min) * 60);
      
      return createDate(year, month, day, h, min, sec);
    }
    
    // Use library's conversion
    try {
      const cal = this._swe.julianDayToDate(jd);
      // The library might return hours as a decimal or separate hour/minute/second fields
      let h = 0, min = 0, sec = 0;
      if (typeof cal.hours === 'number') {
        h = Math.floor(cal.hours);
        min = Math.floor((cal.hours % 1) * 60);
        sec = Math.floor(((cal.hours % 1) * 60 % 1) * 60);
      } else if (typeof cal.hour === 'number') {
        h = cal.hour;
        min = cal.minute || 0;
        sec = Math.floor(cal.second || 0);
      }
      
      return createDate(cal.year, cal.month, cal.day, h, min, sec);
    } catch (err) {
      console.warn('Swiss Ephemeris julianDayToDate failed, using manual conversion:', err);
      // Fall through to manual calculation
      const z = Math.floor(jd + 0.5);
      const f = jd + 0.5 - z;
      let a = z;
      if (z >= 2299161) {
        const alpha = Math.floor((z - 1867216.25) / 36524.25);
        a = z + 1 + alpha - Math.floor(alpha / 4);
      }
      const b = a + 1524;
      const c = Math.floor((b - 122.1) / 365.25);
      const d = Math.floor(365.25 * c);
      const e = Math.floor((b - d) / 30.6001);
      
      const day = b - d - Math.floor(30.6001 * e);
      const month = e < 14 ? e - 1 : e - 13;
      const year = month > 2 ? c - 4716 : c - 4715;
      
      const hours = f * 24;
      const hh = Math.floor(hours);
      const minutes = (hours - hh) * 60;
      const mm = Math.floor(minutes);
      const ss = Math.floor((minutes - mm) * 60);
      
      return createDate(year, month, day, hh, mm, ss);
    }
  },
  
  // Get Moon-Sun elongation for phase calculations
  _getMoonSunElongation(jd) {
    if (!this._swe || !this._module) return null;
    
    try {
      const Planet = this._module.Planet;
      const sunPos = this._swe.calculatePosition(jd, Planet.Sun);
      const moonPos = this._swe.calculatePosition(jd, Planet.Moon);
      
      if (sunPos.longitude === undefined || moonPos.longitude === undefined) {
        return null;
      }
      
      let elongation = moonPos.longitude - sunPos.longitude;
      while (elongation < 0) elongation += 360;
      while (elongation >= 360) elongation -= 360;
      return elongation;
    } catch (err) {
      return null;
    }
  },
  
  searchMoonPhase(phase, startDate, limitDays) {
    if (!this.isLoaded || !this._swe) {
      return AstroEngines.astronomyEngine.searchMoonPhase(phase, startDate, limitDays);
    }
    
    const startJD = this._dateToJD(startDate);
    const endJD = startJD + limitDays;
    const step = 1;
    
    let prevJD = startJD;
    let prevElong = this._getMoonSunElongation(prevJD);
    if (prevElong === null) {
      return AstroEngines.astronomyEngine.searchMoonPhase(phase, startDate, limitDays);
    }
    
    const targetPhase = phase % 360;
    
    for (let jd = startJD + step; jd <= endJD; jd += step) {
      let elong = this._getMoonSunElongation(jd);
      if (elong === null) continue;
      
      // Check for phase crossing (handling 360→0 wrap)
      let crossed = false;
      if (targetPhase === 0) {
        // New moon: elongation wraps from ~359° down to ~1° (crosses 0°)
        // This happens when prevElong is high (>300) and elong is low (<60)
        if (prevElong > 300 && elong < 60) crossed = true;
      } else if (targetPhase === 180) {
        // Full moon: elongation crossing 180 from below
        if (prevElong < 180 && elong >= 180) crossed = true;
      } else {
        // Other phases
        if ((prevElong < targetPhase && elong >= targetPhase) ||
            (prevElong > targetPhase && elong <= targetPhase && Math.abs(prevElong - elong) < 180)) {
          crossed = true;
        }
      }
      
      if (crossed) {
        // Refine with bisection
        let lo = prevJD, hi = jd;
        for (let i = 0; i < 20; i++) { // ~1 second precision
          const mid = (lo + hi) / 2;
          const midElong = this._getMoonSunElongation(mid);
          if (midElong === null) break;
          
          if (targetPhase === 0) {
            // New moon: we want to find where elongation is closest to 0
            // If midElong > 180, we're before the crossing (moon catching up)
            if (midElong > 180) lo = mid; else hi = mid;
          } else if (targetPhase === 180) {
            if (midElong < 180) lo = mid; else hi = mid;
          } else {
            if (midElong < targetPhase) lo = mid; else hi = mid;
          }
        }
        
        const resultJD = (lo + hi) / 2;
        return { date: this._jdToDate(resultJD), jd: resultJD };
      }
      
      prevJD = jd;
      prevElong = elong;
    }
    
    return null;
  },
  
  getSeasons(year) {
    if (!this.isLoaded || !this._swe || !this._module) {
      return AstroEngines.astronomyEngine.getSeasons(year);
    }
    
    try {
      const Planet = this._module.Planet;
      
      // Start search around March 1
      // Use setUTCFullYear for proper handling of negative/ancient years
      const startDate = new Date(Date.UTC(2000, 2, 1));
      startDate.setUTCFullYear(year);
      let jd = this._dateToJD(startDate);
      const endJD = jd + 30;
      
      let prevLon = null;
      for (; jd <= endJD; jd += 0.5) {
        const sunPos = this._swe.calculatePosition(jd, Planet.Sun);
        const lon = sunPos.longitude;
        
        // Spring equinox: Sun crossing 0° from ~359° to ~1°
        if (prevLon !== null && prevLon > 350 && lon < 10) {
          // Refine with bisection
          let lo = jd - 0.5, hi = jd;
          for (let i = 0; i < 20; i++) {
            const mid = (lo + hi) / 2;
            const midPos = this._swe.calculatePosition(mid, Planet.Sun);
            const midLon = midPos.longitude;
            if (midLon > 180) lo = mid; else hi = mid;
          }
          
          return {
            mar_equinox: { date: this._jdToDate((lo + hi) / 2) }
          };
        }
        prevLon = lon;
      }
    } catch (err) {
      console.warn('Error finding equinox with Swiss Ephemeris:', err);
    }
    
    // Fallback
    return AstroEngines.astronomyEngine.getSeasons(year);
  },
  
  searchRiseSet(body, observer, direction, startDate, limitDays) {
    // Swiss Ephemeris rise/set calculation is complex, use fallback for now
    return AstroEngines.astronomyEngine.searchRiseSet(body, observer, direction, startDate, limitDays);
  },
  
  searchAltitude(body, observer, direction, startDate, limitDays, altitude) {
    return AstroEngines.astronomyEngine.searchAltitude(body, observer, direction, startDate, limitDays, altitude);
  },
  
  getEquator(body, date, observer) {
    if (!this.isLoaded || !this._swe || !this._module) {
      return AstroEngines.astronomyEngine.getEquator(body, date, observer);
    }
    
    try {
      const Planet = this._module.Planet;
      const CalculationFlag = this._module.CalculationFlag;
      const planet = body === 'sun' ? Planet.Sun : Planet.Moon;
      const jd = this._dateToJD(date);
      
      // Get equatorial coordinates
      const pos = this._swe.calculatePosition(jd, planet, CalculationFlag.Equatorial);
      
      // Validate result - if invalid, fall back to astronomy-engine
      if (pos && isFinite(pos.rightAscension) && isFinite(pos.declination)) {
        return {
          ra: pos.rightAscension / 15, // Convert degrees to hours
          dec: pos.declination
        };
      }
      
      // Invalid result, fall back
      return AstroEngines.astronomyEngine.getEquator(body, date, observer);
    } catch (err) {
      return AstroEngines.astronomyEngine.getEquator(body, date, observer);
    }
  },
  
  getHorizon(date, observer, ra, dec) {
    // Use astronomy-engine for horizon conversion (simpler)
    return AstroEngines.astronomyEngine.getHorizon(date, observer, ra, dec);
  },
  
  getDeltaT(date) {
    if (!this.isLoaded || !this._swe) {
      return AstroEngines.astronomyEngine.getDeltaT(date);
    }
    
    try {
      const jd = this._dateToJD(date);
      const deltaT = this._swe.deltaT(jd);
      return deltaT * 86400; // Convert days to seconds
    } catch (err) {
      return AstroEngines.astronomyEngine.getDeltaT(date);
    }
  },
  
  createObserver(lat, lon, elevation = 0) {
    // Use astronomy-engine observer format for compatibility
    return new Astronomy.Observer(lat, lon, elevation);
  }
};

// ============================================================================
// HYBRID ENGINE: Swiss Ephemeris calibrated against NASA Eclipse anchors
// ============================================================================
// This approach uses Swiss Ephemeris for precise local calculations, but
// calibrates the ΔT model against NASA eclipse data to reduce drift for 
// ancient dates. NASA eclipses are observable historical events with known
// times, providing ground truth for ΔT corrections.
// ============================================================================
AstroEngines.nasaEclipse = {
  name: 'Hybrid (Swiss Eph + NASA)',
  version: '1.0',
  deltaTModel: 'NASA Eclipse Calibrated',
  deltaTNote: 'Swiss Ephemeris calculations aligned to NASA eclipse anchors',
  isLoaded: false,
  _eclipses: null,  // Array of {jd, y, t} where t='n' (new) or 'f' (full)
  _loadPromise: null,
  _offsetCache: new Map(), // Cache offset calculations by year
  
  async load() {
    if (this.isLoaded) return true;
    if (this._loadPromise) return this._loadPromise;
    
    this._loadPromise = (async () => {
      try {
        const response = await fetch('/data/eclipses.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        this._eclipses = await response.json();
        this.isLoaded = true;
        console.log(`NASA Eclipse data loaded: ${this._eclipses.length} eclipses`);
        return true;
      } catch (err) {
        console.error('Failed to load NASA eclipse data:', err);
        this.isLoaded = false;
        return false;
      }
    })();
    
    return this._loadPromise;
  },
  
  // Julian Day conversion (handles both Julian and Gregorian calendars)
  _dateToJD(date) {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const h = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    
    // Julian calendar for dates before Oct 15, 1582
    // Gregorian calendar for dates on or after Oct 15, 1582
    let jdn;
    if (y < 1582 || (y === 1582 && (m < 10 || (m === 10 && d < 15)))) {
      // Julian calendar
      jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
    } else {
      // Gregorian calendar
      jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
    }
    return jdn + (h - 12) / 24;
  },
  
  _jdToDate(jd) {
    const createDate = (year, month, day, h, min, sec) => {
      const date = new Date(Date.UTC(2000, month - 1, day, h, min, sec));
      date.setUTCFullYear(year);
      return date;
    };
    
    const z = Math.floor(jd + 0.5);
    const f = jd + 0.5 - z;
    let a = z;
    if (z >= 2299161) {
      const alpha = Math.floor((z - 1867216.25) / 36524.25);
      a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    const b = a + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const d = Math.floor(365.25 * c);
    const e = Math.floor((b - d) / 30.6001);
    
    const day = b - d - Math.floor(30.6001 * e);
    const month = e < 14 ? e - 1 : e - 13;
    const year = month > 2 ? c - 4716 : c - 4715;
    
    const hours = f * 24;
    const hh = Math.floor(hours);
    const minutes = (hours - hh) * 60;
    const mm = Math.floor(minutes);
    const ss = Math.floor((minutes - mm) * 60);
    
    return createDate(year, month, day, hh, mm, ss);
  },
  
  // Find eclipse of given type before or after a JD
  _findEclipse(targetJD, type, direction) {
    if (!this._eclipses) return null;
    
    // Binary search for approximate position
    let lo = 0, hi = this._eclipses.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (this._eclipses[mid].jd < targetJD) lo = mid + 1;
      else hi = mid;
    }
    
    if (direction < 0) {
      // Search backward for eclipse of this type
      for (let i = lo - 1; i >= 0; i--) {
        if (this._eclipses[i].t === type) return this._eclipses[i];
      }
    } else {
      // Search forward for eclipse of this type
      for (let i = lo; i < this._eclipses.length; i++) {
        if (this._eclipses[i].t === type) return this._eclipses[i];
      }
    }
    return null;
  },
  
  // Find the nearest eclipse (any type) to a given JD
  _findNearestEclipse(targetJD) {
    if (!this._eclipses || this._eclipses.length === 0) return null;
    
    let lo = 0, hi = this._eclipses.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (this._eclipses[mid].jd < targetJD) lo = mid + 1;
      else hi = mid;
    }
    
    // Check both lo and lo-1 to find closest
    const candidates = [];
    if (lo > 0) candidates.push(this._eclipses[lo - 1]);
    if (lo < this._eclipses.length) candidates.push(this._eclipses[lo]);
    
    let nearest = null;
    let minDist = Infinity;
    for (const e of candidates) {
      const dist = Math.abs(e.jd - targetJD);
      if (dist < minDist) {
        minDist = dist;
        nearest = e;
      }
    }
    return nearest;
  },
  
  // Check if a given date has a lunar eclipse (blood moon)
  // Returns true if there's a lunar eclipse within 0.5 days of the given date
  hasLunarEclipse(date) {
    if (!this._eclipses) {
      return false;
    }
    
    const jd = this._dateToJD(date);
    
    // Binary search to find nearby eclipses
    let lo = 0, hi = this._eclipses.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (this._eclipses[mid].jd < jd) lo = mid + 1;
      else hi = mid;
    }
    
    // Check nearby eclipses (within a day on either side)
    for (let i = Math.max(0, lo - 2); i < Math.min(this._eclipses.length, lo + 3); i++) {
      const e = this._eclipses[i];
      const diff = Math.abs(e.jd - jd);
      if (e.t === 'f' && diff < 1.0) {
        return true;
      }
    }
    return false;
  },
  
  // Get the exact time of a lunar eclipse for a given date
  // Returns a Date object or null if no eclipse found
  getLunarEclipseTime(date) {
    if (!this._eclipses) {
      return null;
    }
    
    const jd = this._dateToJD(date);
    
    // Binary search to find nearby eclipses
    let lo = 0, hi = this._eclipses.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (this._eclipses[mid].jd < jd) lo = mid + 1;
      else hi = mid;
    }
    
    // Check nearby eclipses (within a day on either side)
    for (let i = Math.max(0, lo - 2); i < Math.min(this._eclipses.length, lo + 3); i++) {
      const e = this._eclipses[i];
      const diff = Math.abs(e.jd - jd);
      if (e.t === 'f' && diff < 1.0) {
        // Convert JD to Date
        return this._jdToDate(e.jd);
      }
    }
    return null;
  },
  
  // Helper to create Date with proper year handling (including negative years)
  _createDate(year, month, day, hour, minute, second) {
    // JavaScript Date.UTC interprets years 0-99 as 1900-1999
    // We need to use setUTCFullYear for all dates to be safe
    const date = new Date(Date.UTC(2000, month - 1, day, hour || 0, minute || 0, second || 0));
    date.setUTCFullYear(year);
    return date;
  },
  
  // Calculate the ΔT offset between Swiss Ephemeris and NASA eclipse
  // This is the key to the hybrid approach
  _calculateOffset(nearYear, eclipseType) {
    const cacheKey = `${nearYear}_${eclipseType}`;
    if (this._offsetCache.has(cacheKey)) {
      return this._offsetCache.get(cacheKey);
    }
    
    if (!AstroEngines.swissEphemeris.isLoaded) {
      return 0;
    }
    
    // Find a NASA eclipse near the target year
    const midYearDate = this._createDate(nearYear, 7, 1, 0, 0, 0);
    const approxJD = this._dateToJD(midYearDate);
    
    const nasaEclipse = this._findEclipse(approxJD, eclipseType, -1) || 
                        this._findEclipse(approxJD, eclipseType, 1);
    
    if (!nasaEclipse) {
      return 0;
    }
    
    // Get what Swiss Ephemeris calculates for this same moon phase
    const searchStart = this._jdToDate(nasaEclipse.jd - 3);
    const phase = eclipseType === 'n' ? 0 : 180;
    
    try {
      const sweResult = AstroEngines.swissEphemeris.searchMoonPhase(phase, searchStart, 10);
      if (!sweResult || !sweResult.date) {
        return 0;
      }
      
      // Use JD directly if available (avoids Date round-trip issues with ancient dates)
      const sweJD = sweResult.jd || this._dateToJD(sweResult.date);
      
      // Sanity check - offset should be reasonable (less than a few days)
      const offset = nasaEclipse.jd - sweJD;
      if (!isFinite(offset) || Math.abs(offset) > 5) {
        return 0;
      }
      
      this._offsetCache.set(cacheKey, offset);
      return offset;
    } catch (err) {
      console.warn(`Error calculating offset for year ${nearYear}:`, err);
      return 0;
    }
  },
  
  // Hybrid moon phase search:
  // 1. Use Swiss Ephemeris for precise phase calculation
  // 2. Apply ΔT correction from nearest NASA eclipse anchor
  searchMoonPhase(phase, startDate, limitDays) {
    try {
      if (!AstroEngines.swissEphemeris.isLoaded) {
        return this._searchMoonPhaseInterpolate(phase, startDate, limitDays);
      }
      
      if (!this.isLoaded || !this._eclipses) {
        return AstroEngines.swissEphemeris.searchMoonPhase(phase, startDate, limitDays);
      }
      
      const sweResult = AstroEngines.swissEphemeris.searchMoonPhase(phase, startDate, limitDays);
      if (!sweResult || !sweResult.date) return null;
      
      if (isNaN(sweResult.date.getTime())) {
        return this._searchMoonPhaseInterpolate(phase, startDate, limitDays);
      }
      
      // For modern dates (1600-2100 CE), Swiss Eph is already accurate
      const year = sweResult.date.getUTCFullYear();
      if (year >= 1600 && year <= 2100) {
        return sweResult;
      }
      
      // For ancient/future dates, apply NASA eclipse calibration
      const eclipseType = (phase === 0 || phase === 360) ? 'n' : 'f';
      const offset = this._calculateOffset(year, eclipseType);
      
      if (!isFinite(offset) || Math.abs(offset) < 0.001) {
        return sweResult;
      }
      
      // Apply the offset correction using JD directly if available
      const sweJD = sweResult.jd || this._dateToJD(sweResult.date);
      const correctedJD = sweJD + offset;
      
      if (!isFinite(correctedJD)) {
        return sweResult;
      }
      
      return { date: this._jdToDate(correctedJD) };
    } catch (err) {
      return this._searchMoonPhaseInterpolate(phase, startDate, limitDays);
    }
  },
  
  // Pure interpolation fallback (original algorithm)
  _searchMoonPhaseInterpolate(phase, startDate, limitDays) {
    if (!this.isLoaded || !this._eclipses) {
      return AstroEngines.astronomyEngine.searchMoonPhase(phase, startDate, limitDays);
    }
    
    const targetJD = this._dateToJD(startDate);
    const endJD = targetJD + limitDays;
    const SYNODIC_MONTH = 29.530588853;
    
    const wantNewMoon = (phase === 0 || phase === 360);
    const eclipseType = wantNewMoon ? 'n' : 'f';
    
    const eclipseBefore = this._findEclipse(targetJD, eclipseType, -1);
    const eclipseAfter = this._findEclipse(targetJD, eclipseType, 1);
    
    if (!eclipseBefore && !eclipseAfter) {
      return AstroEngines.astronomyEngine.searchMoonPhase(phase, startDate, limitDays);
    }
    
    let localSynodicMonth = SYNODIC_MONTH;
    if (eclipseBefore && eclipseAfter) {
      const span = eclipseAfter.jd - eclipseBefore.jd;
      const lunations = Math.round(span / SYNODIC_MONTH);
      if (lunations > 0) {
        localSynodicMonth = span / lunations;
      }
    }
    
    let anchorEclipse, direction;
    if (!eclipseBefore) {
      anchorEclipse = eclipseAfter;
      direction = -1;
    } else if (!eclipseAfter) {
      anchorEclipse = eclipseBefore;
      direction = 1;
    } else {
      const distBefore = targetJD - eclipseBefore.jd;
      const distAfter = eclipseAfter.jd - targetJD;
      if (distBefore <= distAfter) {
        anchorEclipse = eclipseBefore;
        direction = 1;
      } else {
        anchorEclipse = eclipseAfter;
        direction = -1;
      }
    }
    
    let resultJD;
    if (direction > 0) {
      const lunationsFromAnchor = Math.ceil((targetJD - anchorEclipse.jd) / localSynodicMonth);
      resultJD = anchorEclipse.jd + lunationsFromAnchor * localSynodicMonth;
    } else {
      const lunationsFromAnchor = Math.ceil((anchorEclipse.jd - targetJD) / localSynodicMonth);
      resultJD = anchorEclipse.jd - (lunationsFromAnchor - 1) * localSynodicMonth;
    }
    
    while (resultJD < targetJD) resultJD += localSynodicMonth;
    if (resultJD > endJD) return null;
    
    return { date: this._jdToDate(resultJD) };
  },
  
  // Use Swiss Ephemeris or astronomy-engine for other calculations
  getSeasons(year) {
    return AstroEngines.swissEphemeris.isLoaded 
      ? AstroEngines.swissEphemeris.getSeasons(year)
      : AstroEngines.astronomyEngine.getSeasons(year);
  },
  
  searchRiseSet(body, observer, direction, startDate, limitDays) {
    return AstroEngines.astronomyEngine.searchRiseSet(body, observer, direction, startDate, limitDays);
  },
  
  searchAltitude(body, observer, direction, startDate, limitDays, altitude) {
    return AstroEngines.astronomyEngine.searchAltitude(body, observer, direction, startDate, limitDays, altitude);
  },
  
  getEquator(body, date, observer) {
    return AstroEngines.swissEphemeris.isLoaded 
      ? AstroEngines.swissEphemeris.getEquator(body, date, observer)
      : AstroEngines.astronomyEngine.getEquator(body, date, observer);
  },
  
  getHorizon(date, observer, ra, dec) {
    return AstroEngines.astronomyEngine.getHorizon(date, observer, ra, dec);
  },
  
  getDeltaT(date) {
    // We don't have direct ΔT values, but the eclipse times incorporate it
    return AstroEngines.swissEphemeris.isLoaded 
      ? AstroEngines.swissEphemeris.getDeltaT(date)
      : AstroEngines.astronomyEngine.getDeltaT(date);
  },
  
  createObserver(lat, lon, elevation = 0) {
    return new Astronomy.Observer(lat, lon, elevation);
  },
  
  // Estimate ΔT uncertainty in hours based on year
  // Since we use NASA eclipse anchors for calibration, uncertainty is reduced
  // compared to raw ΔT models. These values represent residual uncertainty.
  // Reference: https://eclipse.gsfc.nasa.gov/SEcat5/uncertainty.html
  getDeltaTUncertainty(year) {
    // Modern dates (1600-2100): uncertainty is negligible
    if (year >= 1600 && year <= 2100) {
      return 0;
    }
    
    // For ancient dates, uncertainty grows but our hybrid calibration helps
    // These are practical estimates for when day-boundary could be affected:
    // - 500 BC: ~0.5 hours
    // - 1000 BC: ~1 hour
    // - 2000 BC: ~2 hours
    // - 3000 BC: ~3-4 hours
    const yearsFromPresent = Math.abs(year - 2000);
    
    if (yearsFromPresent <= 500) return 0.25;
    if (yearsFromPresent <= 1000) return 0.5;
    if (yearsFromPresent <= 1500) return 1;
    if (yearsFromPresent <= 2000) return 1.5;
    if (yearsFromPresent <= 2500) return 2;
    if (yearsFromPresent <= 3000) return 2.5;
    if (yearsFromPresent <= 4000) return 3;
    if (yearsFromPresent <= 5000) return 4;
    return 6; // Very ancient dates
  }
};

// ============================================================================
// ENGINE MANAGEMENT FUNCTIONS
// ============================================================================

function getAstroEngine() {
  if (!activeAstroEngine) {
    activeAstroEngine = AstroEngines.astronomyEngine;
  }
  return activeAstroEngine;
}

async function setAstroEngine(engineId) {
  const engine = AstroEngines[engineId];
  if (!engine) {
    console.error(`Unknown astronomy engine: ${engineId}`);
    return false;
  }
  
  // If engine needs async loading, do it
  if (engine.load && !engine.isLoaded) {
    const loaded = await engine.load();
    if (!loaded) {
      console.error(`Failed to load engine: ${engineId}`);
      return false;
    }
  }
  
  activeAstroEngine = engine;
  state.astronomyEngine = engineId;
  saveState();
  
  // Update UI
  updateAstroEngineUI();
  
  return true;
}

function updateAstroEngineUI() {
  const engine = getAstroEngine();
  
  // Update engine info display
  const nameEl = document.getElementById('astro-engine-name');
  const deltaEl = document.getElementById('astro-engine-delta');
  
  if (nameEl) nameEl.textContent = `${engine.name} v${engine.version}`;
  if (deltaEl) deltaEl.textContent = engine.deltaTModel;
  
  // Update button states
  document.querySelectorAll('.astro-engine-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.engine === state.astronomyEngine);
  });
}

// UI handler for selecting astronomy engine (currently disabled - Swiss Ephemeris requires self-hosting)
// The abstraction layer is in place for future engine support
function selectAstroEngine(engineId) {
  if (engineId !== 'astronomyEngine') {
    console.log('Swiss Ephemeris WASM requires self-hosting. Using astronomy-engine.');
  }
}

// Initialize astronomy engine - Hybrid approach combines Swiss Ephemeris precision with NASA eclipse calibration
async function initializeAstroEngine() {
  // Load Swiss Ephemeris for precise calculations
  let sweLoaded = false;
  try {
    sweLoaded = await AstroEngines.swissEphemeris.load();
  } catch (err) {
    console.warn('Swiss Ephemeris not available:', err.message);
  }
  
  // Load NASA Eclipse data for ΔT calibration
  let nasaLoaded = false;
  try {
    nasaLoaded = await AstroEngines.nasaEclipse.load();
  } catch (err) {
    console.warn('NASA Eclipse data not available:', err.message);
  }
  
  // Choose the best available engine configuration
  if (nasaLoaded && sweLoaded) {
    // Best case: Hybrid mode - Swiss Ephemeris calibrated against NASA eclipses
    activeAstroEngine = AstroEngines.nasaEclipse;
    state.astronomyEngine = 'nasaEclipse';
    console.log('Using Hybrid mode: Swiss Ephemeris + NASA Eclipse calibration');
    console.log('  - Modern dates (1600-2100): Swiss Ephemeris direct');
    console.log('  - Ancient dates: Swiss Ephemeris with NASA ΔT correction');
  } else if (nasaLoaded) {
    // NASA data but no Swiss Eph - use interpolation fallback
    activeAstroEngine = AstroEngines.nasaEclipse;
    state.astronomyEngine = 'nasaEclipse';
    console.log('Using NASA Eclipse interpolation (Swiss Ephemeris not available)');
  } else if (sweLoaded) {
    // Swiss Eph but no NASA data - use Swiss Eph alone
    activeAstroEngine = AstroEngines.swissEphemeris;
    state.astronomyEngine = 'swissEphemeris';
    console.log('Using Swiss Ephemeris (no NASA calibration)');
  } else {
    // Fallback to astronomy-engine
    activeAstroEngine = AstroEngines.astronomyEngine;
    state.astronomyEngine = 'astronomyEngine';
    console.log('Using astronomy-engine for calculations');
  }
  
  updateAstroEngineUI();
}

// Make these available globally
window.AstroEngines = AstroEngines;
window.getAstroEngine = getAstroEngine;
window.setAstroEngine = setAstroEngine;
window.updateAstroEngineUI = updateAstroEngineUI;
window.selectAstroEngine = selectAstroEngine;
window.initializeAstroEngine = initializeAstroEngine;
