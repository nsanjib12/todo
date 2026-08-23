const CACHE_NAME = 'life-tracker-v5';
const ASSETS = [
    './',
    './index.html',
    './todo.html',
    './habits.html',
    './expenses.html',
    './shared.js',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Install event - cache core assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Fetch event - network-first for API, cache-first for assets
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // BYPASS cache for Google Apps Script API calls (GET and POST)
    if (url.hostname.includes('script.google.com') || 
        url.hostname.includes('script.googleusercontent.com')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // BYPASS cache for all POST requests (API sync calls)
    if (event.request.method === 'POST') {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // For GET requests (assets), use cache-first strategy
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                return response;
            }
            return fetch(event.request).then(fetchResponse => {
                // Only cache successful GET responses
                if (fetchResponse.ok && fetchResponse.type === 'basic') {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, fetchResponse.clone());
                        return fetchResponse;
                    });
                }
                return fetchResponse;
            });
        })
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(self.location.origin);
                }
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => clients.claim())
    );
});