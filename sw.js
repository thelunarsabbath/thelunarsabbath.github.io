// Lunar Sabbath Calendar Service Worker — v13
importScripts('/version.js');
const CACHE_NAME = 'lunar-sabbath-v' + APP_VERSION;

// Core app files
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/version.js',
  '/manifest.json',
  '/styles.css',
  '/app-store.js',
  '/layout.js',
  '/content-manager.js',
  '/url-router.js',
  '/timezone-utils.js',
  '/lunar-calendar-engine.js',
  '/astronomy-utils.js',
  '/day-detail.js',
  '/world-clock.js',
  '/timetested-chapters.js',
  '/astronomy-engine-abstraction.js',
  '/priestly-divisions.js',
  '/resolved-events-cache.js',
  '/event-resolver.js',
  '/biblical-timeline.js',
  '/bible-reader.js',
  '/bible-events-loader.js',
  '/book-scripture-index.js',
  '/jubilee-cycle.js',
  '/torah-portions.js',
  '/feasts.js',
  '/year-utils.js',
  '/cross-references.js',
  '/verse-event-links.js',
  '/data/verse-event-index.json',
  '/symbol-dictionary.js',
  '/word-study-dictionary.js',
  '/strongs-hebrew-dictionary.js',
  '/strongs-greek-dictionary.js',
  '/calendar-export.js',
  '/global-search.js',
  '/morphology-decoder.js',
  '/morphhb-gloss.js',
  '/lib/marked.min.js'
];

// CDN assets (external libraries - cached separately via fetch)
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
  'https://cdn.jsdelivr.net/npm/tz-lookup@6.1.25/tz.min.js',
  'https://unpkg.com/vis-timeline@latest/standalone/umd/vis-timeline-graph2d.min.js',
  'https://unpkg.com/vis-timeline@latest/styles/vis-timeline-graph2d.min.css'
];

// Data files (JSON)
const DATA_ASSETS = [
  '/priestly_divisions.json',
  '/historical-events-v2.json',
  '/TorahReadingCycle.json',
  '/torah-special-readings.json',
  '/data/eclipses.json',
  '/data/morphhb.json',
  '/data/nt-interlinear.json',
  '/data/tipnr.json',
  '/data/bdb-ai.json',
  '/data/bdb.json',
  '/docs/temple-chronology-verification.md'
];

// Bible and book content
const CONTENT_ASSETS = [
  '/kjv.json',
  '/asv.json',
  '/lxx.json',
  '/kjv.txt',
  '/asv.txt',
  '/lxx.txt',
  '/media/time-tested-tradition.pdf'
];

// Event content files
const EVENT_ASSETS = [
  '/data/notes/joshuas-long-day.txt'
];

// Chapter markdown files (Time-Tested book)
const CHAPTER_ASSETS = [
  '/chapters/01_Introduction.md',
  '/chapters/02_Inherited_Lies.md',
  '/chapters/03_Principles_of_Evaluation.md',
  '/chapters/04_Alleged_Authority_of_Sanhedrin.md',
  '/chapters/05_Where_Does_the_Day_Start.md',
  '/chapters/06_When_Does_the_Day_Start.md',
  '/chapters/07_When_Does_the_Month_Start.md',
  '/chapters/08_When_does_the_Year_Start.md',
  '/chapters/09_How_to_Observe_the_Signs.md',
  '/chapters/10_When_is_the_Sabbath.md',
  '/chapters/11_The_Day_of_Saturn.md',
  '/chapters/12_32_AD_Resurrection.md',
  '/chapters/13_Herod_the_Great.md',
  '/chapters/14_Passion_Week_-_3_Days_&_3_Nights.md',
  '/chapters/15_Solar_Only_Calendars.md',
  '/chapters/16_The_Path_to_Salvation.md',
  '/chapters/17_Commands_to_Follow.md',
  '/chapters/18_Appointed_Times.md',
  '/chapters/19_Miscellaneous_Commands.md'
];

// Symbol study files
const SYMBOL_ASSETS = [
  '/symbols/ANIMAL.md',
  '/symbols/BABYLON.md',
  '/symbols/BELIEVE.md',
  '/symbols/BREAD.md',
  '/symbols/EAGLE.md',
  '/symbols/EVENING.md',
  '/symbols/FAITH.md',
  '/symbols/FOOL.md',
  '/symbols/FORNICATION.md',
  '/symbols/FRUIT.md',
  '/symbols/HIGHWAY.md',
  '/symbols/HOW-SCRIPTURE-TEACHES.md',
  '/symbols/IDOLATRY.md',
  '/symbols/ISLAND.md',
  '/symbols/LAMP.md',
  '/symbols/LIGHT.md',
  '/symbols/MARK.md',
  '/symbols/MARRIAGE.md',
  '/symbols/MOMENT.md',
  '/symbols/MOUNTAIN.md',
  '/symbols/NAME.md',
  '/symbols/OIL.md',
  '/symbols/ROCK.md',
  '/symbols/SAND.md',
  '/symbols/SEA.md',
  '/symbols/SLEEP.md',
  '/symbols/THORNS.md',
  '/symbols/TREE.md',
  '/symbols/TRUTH.md',
  '/symbols/VIRGIN.md',
  '/symbols/WAY.md',
  '/symbols/WHY-PARABLES.md',
  '/symbols/WICKEDNESS.md',
  '/symbols/WIND.md',
  '/symbols/WINE.md',
  '/symbols/WINGS.md',
  '/symbols/WISE.md',
  '/symbols/index.md'
];

// Icons and images
const IMAGE_ASSETS = [
  '/icons/icon-16.png',
  '/icons/icon-32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
  '/icons/menorah.png',
  '/assets/img/LongDay.jpg',
  '/assets/img/earth.png'
];

// Local library assets
const LIB_ASSETS = [
  '/lib/swisseph/swisseph-browser.js',
  '/lib/swisseph/swisseph.js',
  '/lib/swisseph/swisseph.wasm'
];

// View files
const VIEW_ASSETS = [
  '/views/bible-view.js',
  '/views/book-view.js',
  '/views/calendar-view.js',
  '/views/help-view.js',
  '/views/priestly-view.js',
  '/views/reader-view.js',
  '/views/sabbath-tester-view.js',
  '/views/settings-view.js',
  '/views/symbols-view.js',
  '/views/timeline-view.js',
  '/views/tutorial-view.js'
];

// CSS assets
const CSS_ASSETS = [
  '/assets/css/bible-styles.css',
  '/assets/css/tutorial.css',
  '/assets/css/settings.css',
  '/assets/css/symbols.css',
  '/assets/css/reader.css',
  '/assets/css/components.css',
  '/assets/css/sabbath-tester.css',
  '/components/world-map.css',
  '/components/dateline-map.css'
];

// Component JS files
const COMPONENT_ASSETS = [
  '/components/world-map.js',
  '/components/dateline-map.js'
];

// Combine all local assets (no external URLs)
const ASSETS_TO_CACHE = [
  ...CORE_ASSETS,
  ...VIEW_ASSETS,
  ...COMPONENT_ASSETS,
  ...DATA_ASSETS,
  ...CONTENT_ASSETS,
  ...EVENT_ASSETS,
  ...CHAPTER_ASSETS,
  ...SYMBOL_ASSETS,
  ...IMAGE_ASSETS,
  ...LIB_ASSETS,
  ...CSS_ASSETS
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app assets');
        // Cache local assets individually (more resilient than addAll)
        return Promise.all(
          ASSETS_TO_CACHE.map((url) => {
            return fetch(url)
              .then((response) => {
                if (response.ok) {
                  return cache.put(url, response);
                } else {
                  console.warn(`Failed to cache (${response.status}):`, url);
                }
              })
              .catch((err) => {
                console.warn('Failed to cache asset:', url, err.message);
              });
          })
        );
      })
      .then(() => {
        // Cache CDN assets separately (may fail due to CORS)
        return caches.open(CACHE_NAME).then((cache) => {
          return Promise.all(
            CDN_ASSETS.map((url) => {
              return fetch(url, { mode: 'cors' })
                .then((response) => {
                  if (response.ok) {
                    return cache.put(url, response);
                  }
                })
                .catch((err) => {
                  console.warn('Failed to cache CDN asset:', url, err);
                });
            })
          );
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Message event - respond to version queries
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          // Fetch in background to update cache
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request).then((response) => {
          // Cache successful responses
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
      .catch(() => {
        // If both cache and network fail, return offline page for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});
