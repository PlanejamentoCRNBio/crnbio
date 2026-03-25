// CRNBio Service Worker — v3.0
// Cache First agressivo — funciona offline em qualquer situação

const CACHE_NAME = 'crnbio-v3';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-apple.png',
];

// ── INSTALL ───────────────────────────────────────────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        // Cacheia fontes opcionalmente (não falha se offline)
        cache.add(
          'https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900' +
          '&family=Nunito+Sans:wght@400;600;700&display=swap'
        ).catch(function() {});
        // Cacheia assets essenciais (obrigatório)
        return cache.addAll(CORE_ASSETS);
      })
      .then(function() {
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(
          keys
            .filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // API — nunca cacheia
  if (
    url.includes('script.google.com') ||
    url.includes('googleapis.com/') ||
    url.includes('drive.google.com')
  ) {
    return;
  }

  // Assets — Cache First com atualização silenciosa em background
  e.respondWith(
    caches.match(e.request)
      .then(function(cached) {
        if (cached) {
          // Serve do cache imediatamente
          // Atualiza em background quando online
          fetch(e.request)
            .then(function(response) {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME).then(function(cache) {
                  cache.put(e.request, response);
                });
              }
            })
            .catch(function() {});
          return cached;
        }

        // Não está no cache — busca na rede
        return fetch(e.request)
          .then(function(response) {
            if (response && response.status === 200 && response.type !== 'opaque') {
              var clone = response.clone();
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(e.request, clone);
              });
            }
            return response;
          })
          .catch(function() {
            // Offline sem cache — fallback para index.html
            return caches.match('./index.html');
          });
      })
  );
});

self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
