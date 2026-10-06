'use strict';
// Increment this version for every release, even when only HTML/CSS changes.
const CACHE_VERSION = 'v1';
const BASE_URL = new URL('./', self.location.href);
const CACHE_PREFIX = `kazu-learning:${BASE_URL.pathname}:`;
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const APP_SHELL = [
    './index.html', './styles.css', './pwa.js', './manifest.webmanifest',
    './icons/icon-192.png', './icons/icon-512.png',
    './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'
].map(path => new URL(path, BASE_URL).href);
const INDEX_URL = new URL('./index.html', BASE_URL).href;

self.addEventListener('install', event => {
    // No activation until the complete offline application is available.
    event.waitUntil(caches.open(CACHE_NAME).then(cache =>
        cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' })))
    ));
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== BASE_URL.origin ||
        !url.pathname.startsWith(BASE_URL.pathname)) return;
    const canonicalURL = url.origin + url.pathname;
    const isAppEntry = request.mode === 'navigate' &&
        (url.pathname === BASE_URL.pathname || url.pathname === new URL(INDEX_URL).pathname ||
         url.pathname.endsWith('/index%20(6).html'));
    const cacheKey = isAppEntry ? INDEX_URL : canonicalURL;
    if (!APP_SHELL.includes(cacheKey)) return;
    // A release uses one complete cached shell until its new worker is activated.
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
        return fetch(request);
    })());
});
