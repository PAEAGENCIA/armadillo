/* Redeo · Service worker: deja que la app abra y muestre la tarjeta aunque no haya internet.
   Siempre intenta primero con internet (así cada actualización se ve al momento) y solo si no hay
   conexión usa lo último que guardó. Nunca guarda nada del panel del negocio ni de Administración.

   Si algún día hubiera que apagarlo: cambia VERSION y deja este archivo con solo
   self.addEventListener('install',()=>self.skipWaiting()); self.addEventListener('activate',()=>self.registration.unregister()); */
const VERSION = 'redeo-2.9.0';
const SHELL = 'shell-' + VERSION;
const DATA = 'datos-v1';         // la última tarjeta vista de cada cliente (en su propio celular)
const FONTS = 'letras-v1';

// Al instalar, guarda la página y todos los archivos que ella misma pide (así no hay lista que mantener).
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    const res = await fetch('/index.html', { cache: 'reload' });
    const html = await res.clone().text();
    await cache.put('/index.html', res);
    const files = [...html.matchAll(/(?:src|href)="(\/[^"#?]+\.(?:js|css|png))"/g)].map(m => m[1]);
    await Promise.all([...new Set([...files, '/app/redeo-192.png', '/app/panel-192.png', '/jsqr.min.js'])]
      .map(f => fetch(f, { cache: 'reload' }).then(r => r.ok && cache.put(f, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [SHELL, DATA, FONTS];
    for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Internet primero; si tarda mucho o no hay, lo guardado.
async function networkFirst(req, cacheName, opts = {}) {
  const cache = await caches.open(cacheName);
  const key = opts.key || req;
  const net = fetch(req).then(res => {
    const html = (res.headers.get('content-type') || '').includes('text/html');
    if (res && res.ok && (!opts.htmlOnly || html)) cache.put(key, res.clone());
    return res;
  });
  const timeout = new Promise(r => setTimeout(() => r(null), opts.wait || 4000));
  try {
    const first = await Promise.race([net, timeout]);
    if (first) return first;
    const saved = await cache.match(key, { ignoreSearch: !!opts.ignoreSearch });
    return saved ? mark(saved, opts.markOffline) : await net;
  } catch (e) {
    const saved = await cache.match(key, { ignoreSearch: !!opts.ignoreSearch });
    if (saved) return mark(saved, opts.markOffline);
    throw e;
  }
}
// Las respuestas guardadas de la tarjeta llevan una marca para que la página diga "Sin internet".
async function mark(res, yes) {
  if (!yes) return res;
  const headers = new Headers(res.headers);
  headers.set('x-vuelve-offline', '1');
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers });
}

const CARD_API = /^\/api\/businesses\/[a-z0-9-]+(\/customers\/[^/]+)?$/;   // negocio (público) y la tarjeta del cliente
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Letras de Google: se guardan para la próxima vez.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    // Solo la tarjeta del cliente (con su clave) y la configuración pública. El panel y Administración nunca se guardan.
    const isCard = CARD_API.test(url.pathname) && (url.pathname.includes('/customers/') ? req.headers.has('x-card-token') : true);
    if (isCard || url.pathname === '/api/config') event.respondWith(networkFirst(req, DATA, { markOffline: true, wait: 6000 }));
    return;
  }
  if (url.pathname === '/manifest.webmanifest' || url.pathname.startsWith('/app/icono/')) return;

  // Páginas: siempre la versión nueva; sin internet, la guardada (la página lee la liga y abre lo que toca).
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, SHELL, { key: '/index.html', htmlOnly: true, wait: 5000 }).catch(() => caches.match('/index.html')));
    return;
  }
  // Archivos de la app (estilos, código, íconos).
  if (/\.(js|css|png|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(networkFirst(req, SHELL, { key: url.pathname, wait: 4000 }));
  }
});

// ---------- Avisos al celular (Premium) ----------
// El negocio manda el aviso desde su panel; aquí se muestra con el nombre y el ícono del negocio.
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  const title = d.title || 'Redeo';
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '', icon: d.icon || '/app/redeo-192.png', badge: '/app/redeo-192.png',
    tag: d.tag || 'vuelve', renotify: true, data: { url: d.url || '/' }
  }));
});
// Al tocar el aviso se abre la tarjeta (si ya estaba abierta, solo se trae al frente).
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) { if (w.url.startsWith(url) && 'focus' in w) return w.focus(); }
    return self.clients.openWindow(url);
  })());
});
