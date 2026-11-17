// Offline-first service worker: the app shell is cached; bump VERSION on every release.
const VERSION = 'v3';
const SHELL = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'js/app.js', 'js/db.js', 'js/recommend.js', 'js/content.js', 'js/prompts.js', 'js/cards.js', 'js/voice.js', 'js/provider.js', 'js/orb.js', 'js/config.js',
  'vendor/ts-fsrs.min.mjs',
  'fonts/fraunces-latin-400-normal.woff2', 'fonts/fraunces-latin-600-normal.woff2', 'fonts/dm-sans-latin-400-normal.woff2',
  'fonts/dm-sans-latin-500-normal.woff2', 'fonts/dm-sans-latin-700-normal.woff2', 'fonts/Vazirmatn.woff2',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  // Only the app's own files; calls to the voice server always go to the network.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
