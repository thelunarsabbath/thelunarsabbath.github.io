/**
 * Service Worker for Time Tested PWA
 * Provides offline functionality and caching
 */

const CACHE_NAME = 'time-tested-v1';
const STATIC_CACHE = 'time-tested-static-v1';
const DATA_CACHE = 'time-tested-data-v1';

// Core assets to cache immediately on install
const CORE_ASSETS = [
  '/time-tested/',
  '/index.html',
  '/styles.css',
  '/layout.js',
  '/app-store.js',
  '/url-router.js',
  '/content-manager.js',
  '/lunar-calendar-engine.js',
  '/astronomy-utils.js',
  '/year-utils.js',
  '/views/calendar-view.js',
  '/views/bible-view.js',
  '/views/book-view.js',
  '/views/events-view.js',
  '/components/dateline-map.js',
  '/components/dateline-map.css',
  '/assets/css/bible-styles.css',
  '/assets/img/earth.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg'
];

// Data files to cache (larger, can be cached lazily)
const DATA_ASSETS = [
  '/astronomy-engine.min.js',
  '/astronomy-engine-abstraction.js',
  '/strongs-hebrew-dictionary.js',
  '/strongs-greek-dictionary.js',
  '/bible-reader.js',
  '/kjv.txt',
  '/bible-events-by-month-day.json'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching core assets');
        return cache.addAll(CORE_ASSETS.map(url => {
          // Handle both absolute and relative URLs
          return url.startsWith('/time-tested') ? url : url;
        }));
      })
      .then(() => {
        console.log('[SW] Core assets cached');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.warn('[SW] Failed to cache some assets:', err);
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DATA_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // For navigation requests, try network first, then cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the response for offline use
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return the cached index.html as fallback for SPA routing
              return caches.match('/index.html');
            });
        })
    );
    return;
  }
  
  // For static assets, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version, but also fetch and update cache in background
          fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                caches.open(STATIC_CACHE).then((cache) => {
                  cache.put(event.request, response);
                });
              }
            })
            .catch(() => { /* Ignore network errors for background update */ });
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        return fetch(event.request)
          .then((response) => {
            // Cache successful responses
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          });
      })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_DATA') {
    // Cache data assets on demand
    event.waitUntil(
      caches.open(DATA_CACHE)
        .then((cache) => cache.addAll(DATA_ASSETS))
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((err) => {
          event.ports[0].postMessage({ success: false, error: err.message });
        })
    );
  }
});
