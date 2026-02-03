// Lunar Sabbath Calendar Service Worker
const CACHE_NAME = 'lunar-sabbath-v768';

// Core app files
const CORE_ASSETS = [
  '/',
  '/index.html',
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
  '/historical-events.js',
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
  '/symbol-dictionary.js',
  '/word-study-dictionary.js',
  '/strongs-hebrew-dictionary.js',
  '/strongs-greek-dictionary.js',
  '/calendar-export.js'
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
  '/bible-events-by-month-day.json',
  '/historical-events.json',
  '/historical-events-v2.json',
  '/TorahReadingCycle.json',
  '/torah-special-readings.json',
  '/data/eclipses.json',
  '/data/interlinear.json',
  '/data/nt-interlinear.json',
  '/data/tipnr.json',
  '/docs/temple-chronology-verification.md'
];

// Bible and book content
const CONTENT_ASSETS = [
  '/kjv.txt',
  '/asv.txt',
  '/lxx.txt',
  '/wlc/verses.txt',
  '/media/time-tested-tradition.pdf'
];

// Event content files
const EVENT_ASSETS = [
  '/data/notes/joshuas-long-day.txt'
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
  '/views/events-view.js',
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
  '/assets/css/bible-styles.css'
];

// Combine all local assets (no external URLs)
const ASSETS_TO_CACHE = [
  ...CORE_ASSETS,
  ...VIEW_ASSETS,
  ...DATA_ASSETS,
  ...CONTENT_ASSETS,
  ...EVENT_ASSETS,
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
        // Cache local assets
        return cache.addAll(ASSETS_TO_CACHE);
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
