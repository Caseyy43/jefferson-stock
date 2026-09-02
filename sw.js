// Jefferson Stock — offline app-shell cache
// Bump this version string on every future deploy so devices pick up changes
// instead of getting stuck on a stale cached copy.
const CACHE_NAME = 'jefferson-stock-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only handle requests for the app shell / Firebase SDK files listed above.
  // Everything else — Firestore's own live data and sync traffic — passes
  // straight through untouched, so it never interferes with Firestore's own
  // offline queue and real-time sync.
  const isShellRequest = APP_SHELL.some((shellUrl) => {
    if (shellUrl.startsWith('http')) return url === shellUrl;
    return url.endsWith(shellUrl.replace('./', '/')) || url.endsWith('/') || url === self.registration.scope;
  });

  if (!isShellRequest) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }).catch(() => caches.match('./index.html'))
  );
});
