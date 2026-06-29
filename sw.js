// Service worker — offline shell + push handling.
const CACHE = 'spw-v9';
const VAPID_PUBLIC = 'BFSu8U-LDVea9hFmAMQ9XHoaYfvPkmlXcllv7o1eqki9F7OABINKmDBHr4wLfVRasPOll4m6P3Y0tdheYOEkUrc';
function urlB64ToU8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
const SHELL = [
  '/', '/index.html', '/style.css', '/app.js', '/manifest.webmanifest',
  '/favicon.ico', '/favicon-32.png', '/favicon-16.png',
  '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png',
  '/assets/img/pug-banner.png', '/assets/img/pug-car.png', '/assets/img/pug-hiking.png',
  '/assets/img/pug-cheeseburger.png', '/assets/img/pug-fishing.png', '/assets/img/pug-racing.png',
  '/assets/img/pug-checklist.png', '/assets/img/pug-heart.png', '/assets/img/pug-sleep.png',
  '/assets/img/pug-map.png', '/assets/img/pug-shaking-fun.png', '/assets/img/beanie-doodle.png',
  '/assets/img/pug-smores.png', '/assets/img/pug-parksign.png', '/assets/img/pug-burger.png',
  '/assets/img/pug-flag.png', '/assets/img/pug-cozy.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;            // mutations -> network
  if (url.pathname.startsWith('/api/')) return;       // shared state must be fresh

  const isShell = e.request.mode === 'navigate' || /\.(css|js)$/.test(url.pathname);
  if (isShell) {
    // network-first so deploys show up immediately, cache as offline fallback
    e.respondWith(
      fetch(e.request)
        .then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return res; })
        .catch(() => caches.match(e.request).then((h) => h || caches.match('/index.html')))
    );
  } else {
    // cache-first for images/icons
    e.respondWith(
      caches.match(e.request).then((h) => h || fetch(e.request).then((res) => {
        const c = res.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return res;
      }))
    );
  }
});

self.addEventListener('push', (e) => {
  let d = { title: '🐾 Seattle Weekend', body: 'Something got checked off.' };
  try { d = e.data.json(); } catch { try { d = { title: '🐾 Seattle Weekend', body: e.data.text() }; } catch {} }
  e.waitUntil(self.registration.showNotification(d.title || '🐾 Seattle Weekend', {
    body: d.body || '', icon: '/icon-192.png', badge: '/favicon-32.png', tag: 'spw-checks', renotify: true,
  }));
});

// Browsers occasionally rotate the push subscription — re-subscribe so the
// device keeps receiving instead of silently going dark.
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    try {
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: urlB64ToU8(VAPID_PUBLIC),
      });
      await fetch('/api/subscribe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON ? sub.toJSON() : sub }),
      });
    } catch { /* will re-sync next app open */ }
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((cs) => {
      for (const c of cs) if ('focus' in c) return c.focus();
      return self.clients.openWindow('/');
    })
  );
});
