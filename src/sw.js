// Elastic Day service worker. Generated into dist/sw.js at build time (see vite.config.ts),
// which fills in the cache version and the build's file list.
// Pages: network first, falling back to the cached copy offline. Build files: cache first.

const CACHE = 'elastic-day-__VERSION__';
const ASSETS = __ASSETS__;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', ...ASSETS])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('elastic-day-') && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  if (req.mode === 'navigate') {
    // Only the app page itself is stored as the offline shell, never some other file opened in a tab.
    const isShell = url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html';
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (isShell && res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./', copy));
          }
          return res;
        })
        .catch(() => caches.match(isShell ? './' : req).then((hit) => hit || caches.match('./'))),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// Time's up while the app is closed or in the background: the push worker sends an empty push
// at the right moment, and the task's name comes from the app's own IndexedDB, so it never
// leaves the device.
self.addEventListener('push', (e) => {
  e.waitUntil(
    runningItem()
      .catch(() => null)
      .then(async (it) => {
        const tag = it ? 'timer-' + it.id : 'timer';
        // Not every browser replaces a notification with the same tag, so close any first.
        try {
          for (const n of await self.registration.getNotifications({ tag })) n.close();
        } catch {
          /* can't list them here; the tag has to do */
        }
        return self.registration.showNotification("Time's up", {
          body: it ? it.title : 'Your timer has run out.',
          icon: 'icon-192.png',
          tag,
        });
      }),
  );
});

/** The item currently running, read straight from the app's database (never creating it). */
function runningItem() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('elastic-day');
    req.onupgradeneeded = () => req.transaction.abort(); // no database yet: don't create an empty one
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('days')) {
        db.close();
        return resolve(null);
      }
      const all = db.transaction('days').objectStore('days').getAll();
      all.onerror = () => reject(all.error);
      all.onsuccess = () => {
        db.close();
        for (const day of all.result) for (const it of day.items) if (it.status === 'running') return resolve(it);
        resolve(null);
      };
    };
  });
}

// Tapping a time's-up notification brings the planner back to the front.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow('./');
    }),
  );
});
