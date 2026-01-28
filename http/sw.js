// Lunar Sabbath Calendar Service Worker
const CACHE_NAME = 'lunar-sabbath-v536';

// Core app files
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles.css',
  '/lunar-calendar-engine.js',
  '/sabbath-tester.js',
  '/astronomy-utils.js',
  '/calendar-core.js',
  '/day-detail.js',
  '/settings-profiles.js',
  '/navigation-routing.js',
  '/world-clock.js',
  '/state-management.js',
  '/astronomy-engine-abstraction.js',
  '/priestly-divisions.js',
  '/historical-events.js',
  '/event-resolver.js',
  '/biblical-timeline.js',
  '/bible-reader.js',
  '/jubilee-cycle.js',
  '/torah-portions.js'
];

// Data files (JSON)
const DATA_ASSETS = [
  '/priestly_divisions.json',
  '/bible-events-by-month-day.json',
  '/historical-events.json',
  '/historical-events-v2.json',
  '/TorahReadingCycle.json',
  '/torah-special-readings.json',
  '/data/eclipses.json'
];

// Bible and book content
const CONTENT_ASSETS = [
  '/kjv.txt',
  '/media/time-tested-tradition.pdf'
];

// Event content files
const EVENT_ASSETS = [
  '/events/joshuas-long-day.txt'
];

// Icons and images
const IMAGE_ASSETS = [
  '/icons/icon-16.png',
  '/icons/icon-32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
  '/icons/menorah.png',
  '/assets/img/LongDay.jpg'
];

// External libraries
const LIB_ASSETS = [
  'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
  '/lib/swisseph/swisseph-browser.js',
  '/lib/swisseph/swisseph.js',
  '/lib/swisseph/swisseph.wasm',
  '/assets/js/simple-jekyll-search.min.js'
];

// CSS assets
const CSS_ASSETS = [
  '/assets/css/style.css',
  '/assets/css/book.css',
  '/assets/css/highlight.css'
];

// Combine all assets
const ASSETS_TO_CACHE = [
  ...CORE_ASSETS,
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
        return cache.addAll(ASSETS_TO_CACHE);
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
