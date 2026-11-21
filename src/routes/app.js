// Redeo como app instalable: el "manifiesto" que lee el celular al instalar y los íconos de cada negocio.
// - La tarjeta del cliente se instala con el nombre y el ícono del negocio.
// - El panel se instala como "Mi negocio".
// El ícono de cada negocio lo dibuja el celular del dueño (con su logo, color y letras) y se guarda aquí.
const path = require('path');
const express = require('express');
const db = require('../db');
const { slugify, normalizePhone, isPremium } = require('../utils');
const { requireOwner, safeEqual } = require('./businesses');

const router = express.Router();
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const SIZES = ['192', '512', '180'];

function getBusiness(slug) { return slug ? db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(slug)) : null; }
function iconRow(id) { return db.prepare('SELECT sig, updated_at FROM app_icons WHERE business_id = ?').get(id); }

function redeoIcons(kind) {
  return [
    { src: `/app/${kind}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `/app/${kind}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `/app/${kind}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ];
}
function bizIcons(b) {
  const row = iconRow(b.id);
  if (!row) return redeoIcons('redeo');
  const v = Date.parse(row.updated_at) || 0;
  const src = s => `/app/icono/${b.slug}-${s}.png?v=${v}`;
  return [
    { src: src(192), sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: src(512), sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: src(512), sizes: '512x512', type: 'image/png', purpose: 'maskable' }   // el dibujo deja margen para cualquier forma de ícono
  ];
}
function shortName(name) {
  const n = String(name || '').trim();
  if (n.length <= 12) return n;
  const words = n.split(/\s+/);
  return words[0].length <= 12 ? words[0] : n.slice(0, 12);
}

router.get('/manifest.webmanifest', (req, res) => {
  const base = { lang: 'es-MX', dir: 'ltr', display: 'standalone', scope: '/', orientation: 'portrait' };
  let m;
  const panelBiz = getBusiness(req.query.panel);
  const cardBiz = !panelBiz && getBusiness(req.query.n);
  if (panelBiz) {
    m = { ...base, id: `/?panel=${panelBiz.slug}`, name: `${panelBiz.name} · Redeo`, short_name: 'Mi negocio',
      description: `Panel de ${panelBiz.name}: da sellos, aprueba clientes y ve tu reporte.`,
      start_url: `/?panel=${encodeURIComponent(panelBiz.slug)}&app=1`, theme_color: '#0F5A45', background_color: '#F7F4EC', icons: redeoIcons('panel') };
  } else if (cardBiz) {
    // Si llega la liga personal del cliente (teléfono + clave) y es correcta, la app abre directo en su tarjeta,
    // aunque el celular guarde la app aparte del navegador (pasa en iPhone).
    let personal = '';
    const phone = normalizePhone(req.query.c || '');
    const token = String(req.query.t || '');
    if (phone && token) {
      const c = db.prepare('SELECT card_token FROM customers WHERE business_id = ? AND phone = ?').get(cardBiz.id, phone);
      if (c && c.card_token && safeEqual(token, c.card_token)) personal = `&c=${encodeURIComponent(phone)}&t=${encodeURIComponent(token)}`;
    }
    m = { ...base, id: `/?n=${cardBiz.slug}`, name: cardBiz.name, short_name: shortName(cardBiz.name),
      description: `Tu tarjeta de lealtad de ${cardBiz.name}.`,
      start_url: `/?n=${encodeURIComponent(cardBiz.slug)}${personal}&app=1`, theme_color: cardBiz.color, background_color: cardBiz.color, icons: bizIcons(cardBiz) };
  } else {
    m = { ...base, id: '/', name: 'Redeo · Tarjetas de lealtad', short_name: 'Redeo',
      description: 'Tarjetas de lealtad digitales para negocios.', start_url: '/?app=1', theme_color: '#0F5A45', background_color: '#F7F4EC', icons: redeoIcons('redeo') };
  }
  res.set('Cache-Control', 'no-cache');
  res.type('application/manifest+json').send(JSON.stringify(m));
});

// Ícono de un negocio: /app/icono/cafe-luna-192.png (si aún no lo tiene, el de Redeo).
router.get('/app/icono/:file', (req, res) => {
  const m = String(req.params.file).match(/^([a-z0-9-]+)-(192|512|180)\.png$/);
  if (!m) return res.status(404).end();
  const b = getBusiness(m[1]);
  const row = b && db.prepare(`SELECT png${m[2]} AS png FROM app_icons WHERE business_id = ?`).get(b.id);
  res.set('Cache-Control', 'public, max-age=86400');
  if (!row || !row.png) return res.sendFile(path.join(PUBLIC_DIR, 'app', `redeo-${m[2]}.png`));
  res.type('image/png').send(row.png);
});

// El celular del dueño sube el ícono que dibujó. body: { sig, png192, png512, png180 } (data:image/png;base64,…)
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
router.put('/api/businesses/:slug/app-icon', express.json({ limit: '1600kb' }), (req, res) => {
  const b = getBusiness(req.params.slug);
  if (!b) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, b)) return;
  const sig = String(req.body?.sig || '').slice(0, 120);
  if (!sig) return res.status(400).json({ error: 'Falta la versión del ícono.' });
  const out = {};
  for (const s of SIZES) {
    const m = String(req.body?.['png' + s] || '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return res.status(400).json({ error: 'Ícono inválido.' });
    const buf = Buffer.from(m[1], 'base64');
    if (!PNG_MAGIC.every((x, i) => buf[i] === x) || buf.length > 400 * 1024) return res.status(400).json({ error: 'Ícono inválido.' });
    out[s] = buf;
  }
  db.prepare(`INSERT INTO app_icons (business_id, sig, png192, png512, png180, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(business_id) DO UPDATE SET sig = excluded.sig, png192 = excluded.png192, png512 = excluded.png512, png180 = excluded.png180, updated_at = excluded.updated_at`)
    .run(b.id, sig, out['192'], out['512'], out['180'], new Date().toISOString());
  const row = iconRow(b.id);
  res.json({ sig: row.sig, v: Date.parse(row.updated_at) || 0 });
});

module.exports = router;
