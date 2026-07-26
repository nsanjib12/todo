const CACHE_NAME = 'daily-tasks-v4';
const ASSETS = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  // Activate immediately
  self.skipWaiting();
});

// Fetch event
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Bypass cache for Firebase API calls
  if (url.hostname.includes('firebaseio.com') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebaseapp.com')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Bypass cache for JSONBlob API calls (if still used)
  if (url.hostname === 'jsonblob.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for other requests
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(fetchResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    })
  );
});

// Notification click handler (REQUIRED for Android Chrome PWA)
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(self.location.origin);
        }
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => {
      // Take control of all clients immediately
      return clients.claim();
    })
  );
});