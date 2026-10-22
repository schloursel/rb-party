// RB-Party Service Worker â€“ macht die App offline startbar.
// Bei jeder neuen Version der App VERSION erhÃ¶hen, damit alte Dateien ersetzt werden.
const VERSION = 'rbparty-v2.3.149';
const APP_FILES = [
  './',
  'index.html',
  'rb-sounds.js',
  'rb-flags.js',
  'charakter-teile.js',
  'charaktere.json',
  'charaktere.js',
  'charakter-editor.html',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    // cache: 'reload' umgeht den HTTP-Cache des Browsers (GitHub Pages cached ca. 10 Min.), sonst landet evtl. die alte Datei im neuen Cache
    caches.open(VERSION).then(cache => Promise.all(APP_FILES.map(f => fetch(new Request(f, { cache: 'reload' })).then(res => { if (!res.ok) { if (f === 'index.html') throw new Error(f); return; } return cache.put(f, res); })))).then(() => self.skipWaiting())
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

  // Seitenaufrufe (auch ?beamer=1): zuerst das Netz (max. 3 s, damit neue Versionen sofort erscheinen), sonst die gecachte index.html (offline)
  if (req.mode === 'navigate' && !/charakter-(editor|test|prototypen)\.html$/.test(url.pathname)) {
    event.respondWith(
      Promise.race([
        fetch('index.html', { cache: 'no-cache' }).then(res => {
          if (!res || !res.ok) throw new Error('net');
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put('index.html', copy));
          return res;
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
      ]).catch(() => caches.match('index.html').then(hit => hit || fetch(req)))
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




