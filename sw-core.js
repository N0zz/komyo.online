// Shared service-worker engine for komyo. Each sw.js sets three globals then imports this:
//   self.SCOPE   — cache namespace ('root' or a game slug)
//   self.VERSION — build id ('dev' locally; the commit SHA, stamped at deploy)
//   self.SHELL   — same-origin URLs to precache for offline
//
// Strategy: STALE-WHILE-REVALIDATE — serve the cached copy instantly (so an offline refresh never
// breaks), and refresh it from the network in the background when online. The cache name carries the
// VERSION, so a new build lands in a fresh cache; skipWaiting + clients.claim make the new worker take
// over immediately, and gamekit.pwa() reloads the page once → silent auto-update. Old versions of THIS
// scope (and the legacy 'gamekit-' cache) are purged on activate.
(function () {
  var SCOPE = self.SCOPE || 'app';
  var VERSION = self.VERSION || 'dev';
  var PREFIX = 'komyo-' + SCOPE + '-';
  var CACHE = PREFIX + VERSION;
  var SHELL = self.SHELL || [];
  var ORIGIN = self.location.origin;

  self.addEventListener('install', function (e) {
    e.waitUntil(
      caches.open(CACHE).then(function (c) {
        // resilient: one missing/404 file must not fail the whole precache
        // {cache:'reload'} — cache.add() would otherwise do a normal fetch, which can silently
        // reuse a browser-HTTP-cached (stale) response and precache stale content into a brand
        // new versioned cache, so "Update now" applies but a hard refresh is still needed.
        return Promise.all(SHELL.map(function (u) {
          return fetch(u, { cache: 'reload' }).then(function (resp) {
            if (resp && resp.ok) return c.put(u, resp);
          }).catch(function () {});
        }));
      }).then(function () { return self.skipWaiting(); })
    );
  });

  self.addEventListener('activate', function (e) {
    e.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) {
          // drop old versions of THIS scope, and every pre-overhaul cache (anything not in the
          // 'komyo-' namespace: gamekit-v1, bubbles-v1, …); leave other scopes' current caches alone
          if ((k.indexOf(PREFIX) === 0 && k !== CACHE) || k.indexOf('komyo-') !== 0) return caches.delete(k);
          return null;
        }));
      }).then(function () { return self.clients.claim(); })
    );
  });

  self.addEventListener('fetch', function (e) {
    if (e.request.method !== 'GET') return;
    if (e.request.url.indexOf(ORIGIN) !== 0) return; // cross-origin (e.g. GA) → browser default, never cached
    e.respondWith(
      caches.open(CACHE).then(function (cache) {
        return cache.match(e.request).then(function (cached) {
          // {cache:'reload'} — the background revalidation must actually reach the network, not
          // silently resolve from the browser's own HTTP cache (same staleness bug as install above).
          var network = fetch(e.request, { cache: 'reload' }).then(function (resp) {
            if (resp && resp.ok) { try { cache.put(e.request, resp.clone()); } catch (x) {} }
            return resp;
          }).catch(function () { return null; });
          if (cached) return cached;                       // stale-while-revalidate: cached now, refresh in bg
          return network.then(function (r) {
            if (r) return r;
            if (e.request.mode === 'navigate') {            // offline + uncached page → this scope's shell
              return cache.match('./index.html').then(function (i) { return i || cache.match('./'); });
            }
            return Response.error();
          });
        });
      })
    );
  });
})();
