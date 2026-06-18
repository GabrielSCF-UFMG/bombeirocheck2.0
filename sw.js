// ============================================
// BombeiroCheck Service Worker v3
// 🔄 Mude o número abaixo a cada nova release!
// ============================================
const VERSAO = 'v3.0.1';
const CACHE = `bombeirocheck-${VERSAO}`;

const ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png'
];

// ============================================
// INSTALL: baixa arquivos e ATIVA NA HORA
// ============================================
self.addEventListener('install', e => {
  console.log('[SW] Instalando', VERSAO);
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ARQUIVOS))
      .then(() => self.skipWaiting()) // ⚡ Não espera fechar abas antigas
  );
});

// ============================================
// ACTIVATE: limpa caches velhos e assume controle
// ============================================
self.addEventListener('activate', e => {
  console.log('[SW] Ativando', VERSAO);
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE)
            .map(k => {
              console.log('[SW] Apagando cache antigo:', k);
              return caches.delete(k);
            })
      ))
      .then(() => self.clients.claim()) // 🎯 Controla todas as abas abertas
  );
});

// ============================================
// FETCH: estratégia INTELIGENTE
// - HTML/JS/CSS → Network First (sempre busca novo)
// - Imagens/ícones → Cache First (rápido)
// - Firebase/CDN → ignora (deixa direto)
// ============================================
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  
  const url = e.request.url;
  
  // Ignora Firebase, Google e CDNs (deixa o browser cuidar)
  if (url.includes('firebase') || 
      url.includes('gstatic') || 
      url.includes('googleapis') ||
      url.includes('jsdelivr')) {
    return;
  }
  
  // Detecta se é arquivo "estático" (imagens, ícones)
  const ehEstatico = url.match(/\.(png|jpg|jpeg|gif|svg|ico|woff2?)$/i);
  
  if (ehEstatico) {
    // 🖼️ CACHE FIRST: imagens não mudam, serve rápido do cache
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
        return resp;
      }))
    );
  } else {
    // 🌐 NETWORK FIRST: HTML/JS sempre busca novo, cache só como fallback offline
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          // Atualiza cache com a versão nova
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
          return resp;
        })
        .catch(() => {
          // Se offline, usa o cache
          return caches.match(e.request).then(r => r || caches.match('./index.html'));
        })
    );
  }
});

// ============================================
// MENSAGEM: permite o app forçar atualização
// ============================================
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
