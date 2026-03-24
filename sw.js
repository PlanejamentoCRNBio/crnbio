// CRNBio Service Worker — v2.0
// ─────────────────────────────────────────────────────────────────────
// Estratégia: Cache First agressivo
// O app inteiro fica salvo permanentemente no dispositivo.
// A rede só é consultada para chamadas à API (Apps Script).
// Isso garante que o app abre offline mesmo após reinicialização
// do aparelho ou longos períodos sem internet.
// ─────────────────────────────────────────────────────────────────────

const CACHE_NAME = 'crnbio-v2';

// Arquivos essenciais — TODOS precisam ser cacheados com sucesso
const CORE_ASSETS = [
  '/crnbio/',
  '/crnbio/index.html',
  '/crnbio/manifest.json',
  '/crnbio/icons/icon-192.png',
  '/crnbio/icons/icon-512.png',
  '/crnbio/icons/icon-apple.png',
];

// ── INSTALL ───────────────────────────────────────────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(CORE_ASSETS)
          .then(function() {
            return cache.add(
              'https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900' +
              '&family=Nunito+Sans:wght@400;600;700&display=swap'
            ).catch(function() {});
          });
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

  // API — nunca cacheia, deixa passar direto
  if (
    url.includes('script.google.com') ||
    url.includes('googleapis.com/') ||
    url.includes('drive.google.com')
  ) {
    return;
  }

  // Assets locais — Cache First com atualização em background
  e.respondWith(
    caches.match(e.request)
      .then(function(cached) {

        if (cached) {
          // Serve do cache imediatamente
          // Atualiza em background se estiver online
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

        // Não está no cache — busca na rede e cacheia
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
            return caches.match('/crnbio/index.html');
          });
      })
  );
});

// ── MENSAGEM ──────────────────────────────────────────────────────────
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
