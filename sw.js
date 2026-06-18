// ══════════════════════════════════════════
// BombeiroCheck — Service Worker
// ══════════════════════════════════════════
const VERSAO = 'v1.0';
const CACHE_NAME = `bombeirocheck2.0-${VERSAO}`;

const ARQUIVOS_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512'.png'
];

// URLs que NUNCA devem ser interceptadas pelo SW
const URL_IGNORAR = [
  'script.google.com',   // Google Apps Script (Web App)
  'googleapis.com',      // APIs Google
  'gstatic.com',         // Assets Google
  'jsdelivr.net',        // jsPDF CDN
  'firebaseapp.com',     // Firebase (caso ainda exista alguma referência)
  'firebaseio.com',
  'firebase.google.com',
  'google-analytics.com'
];

// ══════════════════════════════════════════
// INSTALL — cacheia os arquivos essenciais
// ══════════════════════════════════════════
self.addEventListener('install', event => {
  console.log('[SW] Instalando versão:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ARQUIVOS_CACHE))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Erro no install:', err))
  );
});

// ══════════════════════════════════════════
// ACTIVATE — limpa caches antigos
// ══════════════════════════════════════════
self.addEventListener('activate', event => {
  console.log('[SW] Ativando versão:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Removendo cache antigo:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ══════════════════════════════════════════
// FETCH — estratégia por tipo de recurso
// ══════════════════════════════════════════
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 1️⃣ Ignora requisições que não devem ser cacheadas
  const deveIgnorar = URL_IGNORAR.some(dominio => url.includes(dominio));
  if (deveIgnorar) return;

  // 2️⃣ Ignora requisições não-GET (POST do salvarPassagem, etc.)
  if (event.request.method !== 'GET') return;

  // 3️⃣ Ignora extensões de browser (chrome-extension, etc.)
  if (!url.startsWith('http')) return;

  // 4️⃣ CDN (jsPDF) → Network First com fallback para cache
  if (url.includes('jsdelivr.net') || url.includes('cdn.')) {
    event.respondWith(networkFirstComCache(event.request));
    return;
  }

  // 5️⃣ Arquivos locais do app → Cache First com fallback para rede
  event.respondWith(cacheFirstComFallback(event.request));
});

// ══════════════════════════════════════════
// ESTRATÉGIA: Cache First → fallback Network
// Ideal para arquivos estáticos do app
// ══════════════════════════════════════════
async function cacheFirstComFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline e não tem cache — retorna página principal como fallback
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    return new Response('Offline — sem conexão', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// ══════════════════════════════════════════
// ESTRATÉGIA: Network First → fallback Cache
// Ideal para CDNs e recursos externos
// ══════════════════════════════════════════
async function networkFirstComCache(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Recurso externo indisponível offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// ══════════════════════════════════════════
// MENSAGENS — recebe sinal do index.html
// para forçar atualização (skipWaiting)
// ══════════════════════════════════════════
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] Aplicando update por solicitação do app');
    self.skipWaiting();
  }
});
