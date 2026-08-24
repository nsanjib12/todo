const CACHE_NAME = 'life-tracker-v6';
const ASSETS = ['./', './index.html', './todo.html', './habits.html', './expenses.html', './shared.js'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('fetch', event => {
    if (event.request.method === 'POST') { event.respondWith(fetch(event.request)); return; }
    const url = new URL(event.request.url);
    if (url.hostname.includes('script.google.com')) { event.respondWith(fetch(event.request)); return; }
    event.respondWith(caches.match(event.request).then(r => r || fetch(event.request)));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => clients.claim()));
});