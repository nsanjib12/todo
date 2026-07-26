const CACHE_NAME = 'life-tracker-v2';
const ASSETS = ['./', './index.html', './todo.html', './habits.html', './expenses.html', './shared.js', 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (url.hostname === 'jsonblob.com') { e.respondWith(fetch(e.request)); return; }
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(fr => caches.open(CACHE_NAME).then(c => { c.put(e.request, fr.clone()); return fr; }))));
});
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs => { for(const c of cs) if(c.url.includes(self.location.origin) && 'focus' in c) return c.focus(); if(clients.openWindow) return clients.openWindow(self.location.origin); }));
});
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => clients.claim())); });