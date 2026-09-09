// Jefferson Stock — offline app-shell cache
// Bump this version string on every future deploy so devices pick up changes
// instead of getting stuck on a stale cached copy.
const CACHE_NAME = 'jefferson-stock-v15';

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
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache each file individually — if one fails (flaky connection,
      // a slow asset), it no longer takes the whole update down with it.
      await Promise.all(APP_SHELL.map((url) =>
        cache.add(url).catch((err) => {
          console.warn('Service worker: could not cache', url, err);
        })
      ));
    }).then(() => self.skipWaiting())
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
  const isNavigation = event.request.mode === 'navigate' || url.endsWith('/index.html') || url === self.registration.scope;

  const isShellRequest = APP_SHELL.some((shellUrl) => {
    if (shellUrl.startsWith('http')) return url === shellUrl;
    return url.endsWith(shellUrl.replace('./', '/')) || url.endsWith('/') || url === self.registration.scope;
  });

  if (!isShellRequest) return;

  if (isNavigation) {
    // Network-first for the app page itself — always get the latest
    // version when online; only fall back to the cached copy when
    // there's genuinely no connection.
    event.respondWith(
      fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for everything else (icons, manifest, the Firebase SDK
  // files) — these barely change, so prefer speed and offline reliability.
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
