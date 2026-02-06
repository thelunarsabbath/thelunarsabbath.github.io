/**
 * Node.js wrapper for astronomy-engine
 * Maps the npm `astronomy-engine` package to the interface LunarCalendarEngine expects.
 */

const Astronomy = require('astronomy-engine');

const astroEngine = {
  name: 'astronomy-engine',

  searchMoonPhase(phase, startDate, limitDays) {
    return Astronomy.SearchMoonPhase(phase, startDate, limitDays);
  },

  getSeasons(year) {
    // Fix for years 0-99 (JS Date bug treats them as 1900-1999)
    if (year >= 0 && year < 100) {
      const startDate = new Date(Date.UTC(2000, 0, 1));
      startDate.setUTCFullYear(year);
      const equinox = Astronomy.SearchSunLongitude(0, startDate, 120);
      if (equinox) {
        return { mar_equinox: equinox };
      }
    }
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
    const astroBody = body === 'sun' ? Astronomy.Body.Sun : Astronomy.Body.Moon;
    return Astronomy.Equator(astroBody, date, observer, true, true);
  },

  createObserver(lat, lon, elevation = 0) {
    return new Astronomy.Observer(lat, lon, elevation);
  }
};

module.exports = astroEngine;
