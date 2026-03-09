// CRNBio Service Worker — v1.0
// Atualizar CACHE_NAME ao fazer alterações no app
const CACHE_NAME = 'crnbio-v1';

// Arquivos que serão cacheados para funcionar offline
const ASSETS = [
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap'
];

// ── INSTALL: cacheia todos os assets ao instalar ──────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Tenta cachear fontes do Google, mas não falha se não conseguir
      return cache.addAll(['/index.html', '/manifest.json',
                           '/icons/icon-192.png', '/icons/icon-512.png'])
        .then(function() {
          return cache.add('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap')
            .catch(function() {}); // ignora falha nas fontes (ok, tem fallback)
        });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: remove caches antigos ──────────────────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// ── FETCH: serve do cache, busca na rede se não tiver ────────────────
// Estratégia: Cache First para assets locais, Network First para API
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Requisições ao Google Apps Script (API) — deixa passar normalmente
  if (url.includes('script.google.com') ||
      url.includes('googleapis.com/')) {
    return; // não intercepta chamadas à API
  }

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached; // serve do cache se tiver

      // Não está no cache — tenta buscar na rede
      return fetch(e.request).then(function(response) {
        // Salva no cache para próxima vez (só respostas válidas)
        if (response && response.status === 200 && response.type !== 'opaque') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Sem rede e sem cache — retorna o index.html como fallback
        if (e.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
