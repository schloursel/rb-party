// RB-Party Service Worker – macht die App offline startbar.
// Bei jeder neuen Version der App VERSION erhöhen, damit alte Dateien ersetzt werden.
const VERSION = 'rbparty-v2.3.73';
const APP_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Schriften von Google und PeerJS-Baustein (Kopplung): einmal laden, danach aus dem Cache (im Hintergrund aktualisieren)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'unpkg.com') {
    event.respondWith(
      caches.open(VERSION).then(cache =>
        cache.match(req).then(hit => {
          const fresh = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
          return hit || fresh;
        })
      )
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Seitenaufrufe (auch ?beamer=1): immer die gecachte index.html, sonst Netz
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html').then(hit => hit || fetch(req))
    );
    return;
  }

  // Alles andere: Cache zuerst, dann Netz
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});




