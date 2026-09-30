// CRNBio Service Worker — v5.0
// ─────────────────────────────────────────────────────────────────────
// Mudanca critica em relacao a v4:
// A v4 usava cache.addAll(), que cancela a instalacao INTEIRA se um
// unico arquivo faltar (um icone ausente, por exemplo). O resultado e
// que o Service Worker nunca era instalado e o app nao abria offline,
// sem nenhuma mensagem de erro.
// Agora cada arquivo e gravado separadamente: se um falhar, os outros
// continuam. O app passa a funcionar offline mesmo com arquivos faltando.
// ─────────────────────────────────────────────────────────────────────

const CACHE_NAME = 'crnbio-v5';

// Obrigatorio para o app abrir offline
const ESSENCIAL = [
  './index.html',
];

// Bom ter, mas a ausencia nao impede o app de funcionar
const OPCIONAL = [
  './',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-apple.png',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900' +
    '&family=Nunito+Sans:wght@400;600;700&display=swap',
];

// Grava um arquivo no cache; nunca lanca erro
function gravar(cache, url) {
  return fetch(new Request(url, { cache: 'reload' }))
    .then(function (r) {
      if (r && (r.ok || r.type === 'opaque')) return cache.put(url, r);
    })
    .catch(function () { /* ignora: sera tentado de novo depois */ });
}

// ── INSTALL ───────────────────────────────────────────────────────────
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      var todos = ESSENCIAL.concat(OPCIONAL);
      return Promise.all(todos.map(function (u) { return gravar(cache, u); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────────
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

function guardar(req, resp) {
  if (!resp || resp.status !== 200 || resp.type === 'opaque') return;
  var copia = resp.clone();
  caches.open(CACHE_NAME).then(function (cache) {
    cache.put(req, copia).catch(function () {});
  });
}

// ── FETCH ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = req.url;

  if (req.method !== 'GET') return;

  if (url.indexOf('script.google.com') !== -1 ||
      url.indexOf('googleapis.com/')   !== -1 ||
      url.indexOf('drive.google.com')  !== -1) {
    return;
  }

  // Abrir o app: cache primeiro, sem depender da rede
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(function (cached) {
        if (cached) {
          fetch(req).then(function (r) { guardar('./index.html', r); })
                    .catch(function () {});
          return cached;
        }
        return fetch(req)
          .then(function (r) { guardar('./index.html', r); return r; })
          .catch(function () {
            return new Response(
              '<meta charset="utf-8"><div style="font-family:sans-serif;padding:28px;' +
              'line-height:1.6"><h3>Modo offline ainda nao instalado</h3>' +
              '<p>Abra o app uma vez <b>com internet</b> para concluir a instalacao.</p></div>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) {
        fetch(req).then(function (r) { guardar(req, r); }).catch(function () {});
        return cached;
      }
      return fetch(req)
        .then(function (r) { guardar(req, r); return r; })
        .catch(function () {
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});

// ── MENSAGENS: diagnostico e reinstalacao do cache ────────────────────
self.addEventListener('message', function (e) {
  var porta = e.ports && e.ports[0];

  if (e.data && e.data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }

  // Relatorio do que esta realmente gravado no aparelho
  if (e.data && e.data.type === 'STATUS') {
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.keys().then(function (reqs) {
        var urls = reqs.map(function (r) { return r.url; });
        return cache.match('./index.html').then(function (idx) {
          if (porta) porta.postMessage({
            versao: CACHE_NAME,
            total: urls.length,
            temIndex: !!idx,
            urls: urls
          });
        });
      });
    }).catch(function () {
      if (porta) porta.postMessage({ versao: CACHE_NAME, total: 0, temIndex: false, urls: [] });
    });
    return;
  }

  // Forca regravar tudo (usado pelo botao no app)
  if (e.data && e.data.type === 'RECACHE') {
    caches.open(CACHE_NAME).then(function (cache) {
      var todos = ESSENCIAL.concat(OPCIONAL);
      return Promise.all(todos.map(function (u) { return gravar(cache, u); }))
        .then(function () { return cache.match('./index.html'); })
        .then(function (idx) {
          if (porta) porta.postMessage({ ok: !!idx });
        });
    }).catch(function () { if (porta) porta.postMessage({ ok: false }); });
  }
});
