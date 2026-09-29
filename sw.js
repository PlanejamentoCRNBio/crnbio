// CRNBio Service Worker — v4.0
// ─────────────────────────────────────────────────────────────────────
// Objetivo: o app SEMPRE abre, mesmo offline, mesmo depois de o
// aparelho ficar semanas desligado ou sem internet.
//
// Mudancas principais em relacao a v3:
//  1. Requisicoes de NAVEGACAO (abrir o app) sao tratadas a parte e
//     respondidas do cache ANTES de tentar a rede. Era aqui que o app
//     caia na tela "Voce esta offline" do navegador.
//  2. Arquivos que faltam no cache nao recebem mais o index.html como
//     resposta (isso quebrava CSS e fontes silenciosamente).
//  3. As fontes do Google sao cacheadas quando houver internet.
// ─────────────────────────────────────────────────────────────────────

const CACHE_NAME = 'crnbio-v4';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-apple.png',
];

const FONTE_GOOGLE =
  'https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900' +
  '&family=Nunito+Sans:wght@400;600;700&display=swap';

// ── INSTALL ───────────────────────────────────────────────────────────
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        // Fontes: tentativa opcional, nunca derruba a instalacao
        cache.add(FONTE_GOOGLE).catch(function () {});
        // Arquivos do app: obrigatorios
        return cache.addAll(CORE_ASSETS);
      })
      .then(function () { return self.skipWaiting(); })
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────────
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (k) { return k !== CACHE_NAME; })
              .map(function (k) { return caches.delete(k); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

// ── Guarda no cache sem quebrar em caso de erro ───────────────────────
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

  // Somente GET passa pelo cache
  if (req.method !== 'GET') return;

  // API (Apps Script / Drive) — nunca cacheia, deixa passar
  if (url.indexOf('script.google.com')  !== -1 ||
      url.indexOf('googleapis.com/')    !== -1 ||
      url.indexOf('drive.google.com')   !== -1) {
    return;
  }

  // ── 1. ABRIR O APP (navegacao) ─────────────────────────────────────
  // Responde do cache imediatamente, sem depender da rede.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html')
        .then(function (cached) {
          if (cached) {
            // Atualiza em segundo plano, sem travar a abertura
            fetch(req).then(function (r) { guardar('./index.html', r); })
                      .catch(function () {});
            return cached;
          }
          return fetch(req)
            .then(function (r) { guardar('./index.html', r); return r; })
            .catch(function () {
              return caches.match('./') ||
                new Response(
                  '<h3 style="font-family:sans-serif;padding:24px">' +
                  'Abra o app uma vez com internet para instalar o modo offline.</h3>',
                  { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                );
            });
        })
    );
    return;
  }

  // ── 2. DEMAIS ARQUIVOS — cache primeiro ────────────────────────────
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) {
        fetch(req).then(function (r) { guardar(req, r); }).catch(function () {});
        return cached;
      }
      return fetch(req)
        .then(function (r) { guardar(req, r); return r; })
        .catch(function () {
          // Sem rede e sem cache: devolve resposta vazia valida.
          // NUNCA devolver index.html aqui (quebra CSS/fontes/imagens).
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});

// ── MENSAGEM ──────────────────────────────────────────────────────────
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
