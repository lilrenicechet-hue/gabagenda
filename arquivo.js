/**
 * GABCalendar — arquivo.js (Service Worker)
 * Permite instalar o GABCalendar como aplicativo (celular e computador) e abrir a tela
 * mesmo com a internet instável. Os dados da agenda NUNCA ficam em cache: sempre vêm
 * do Apps Script (Google Sheets).
 *
 * Coloque este arquivo na MESMA pasta do index.html (ex.: raiz do repositório no GitHub Pages).
 */
const VERSAO_CACHE = 'gabcalendar-v1.0.0';
const ESSENCIAIS = ['./', './index.html'];
const CDN = /(^|\.)(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)$/;

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSAO_CACHE).then((c) => c.addAll(ESSENCIAIS)).catch(() => { /* instala mesmo assim */ }));
  self.skipWaiting();
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('gabcalendar-') && k !== VERSAO_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API do Apps Script: sempre direto na rede (dados em tempo real, nada em cache)
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;

  // Páginas: tenta a rede primeiro (versão mais nova); sem rede, usa a cópia salva
  if (req.mode === 'navigate') {
    ev.respondWith(
      fetch(req).then((r) => {
        const copia = r.clone();
        caches.open(VERSAO_CACHE).then((c) => c.put('./index.html', copia));
        return r;
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Arquivos do próprio site, ícones e fontes: usa o cache e atualiza em segundo plano
  if (url.origin === self.location.origin || CDN.test(url.hostname)) {
    ev.respondWith(
      caches.match(req).then((salvo) => {
        const rede = fetch(req).then((r) => {
          if (r && (r.ok || r.type === 'opaque')) {
            const copia = r.clone();
            caches.open(VERSAO_CACHE).then((c) => c.put(req, copia));
          }
          return r;
        }).catch(() => salvo);
        return salvo || rede;
      })
    );
  }
});

self.addEventListener('message', (ev) => {
  if (ev.data === 'atualizar') self.skipWaiting();
});
