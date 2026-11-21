// Stickers con QR para el mostrador.
// P.A.E. los genera e imprime SIN negocio (todos con el mismo diseño, cada uno con su propio código).
// En la visita se pega uno y se "conecta" al negocio escaneándolo. Desde ese momento, quien lo escanee
// llega directo a pedir su tarjeta de ese negocio. Si el negocio no contrata, el sticker se puede reasignar.
const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { slugify, overLimit } = require('../utils');
const { requireOwner } = require('./businesses');
const adminRouter = require('./admin');

const router = express.Router();
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // sin 0/O ni 1/I/L
function newCode() {
  let s = '';
  for (const b of crypto.randomBytes(5)) s += ALPHABET[b % ALPHABET.length];
  return s;
}
function cleanCode(raw) { return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); }
function getSticker(code) { return db.prepare('SELECT * FROM stickers WHERE code = ?').get(cleanCode(code)); }
function getBusiness(slug) { return db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(slug)); }
function stickerJSON(s) {
  const b = s.business_id ? db.prepare('SELECT slug, name FROM businesses WHERE id = ?').get(s.business_id) : null;
  return { code: s.code, batch: s.batch, business: b ? { slug: b.slug, name: b.name } : null, assignedAt: s.assigned_at,
    scans: s.scans, lastScanAt: s.last_scan_at, createdAt: s.created_at };
}
function assign(sticker, business) {
  db.prepare('UPDATE stickers SET business_id = ?, assigned_at = ? WHERE id = ?').run(business ? business.id : null, business ? new Date().toISOString() : null, sticker.id);
  return stickerJSON(db.prepare('SELECT * FROM stickers WHERE id = ?').get(sticker.id));
}

// Lo que abre el QR: redeo.app/s/CODIGO
router.get('/s/:code', (req, res) => {
  const s = getSticker(req.params.code);
  if (s && s.business_id) {
    const b = db.prepare('SELECT slug FROM businesses WHERE id = ?').get(s.business_id);
    if (b) {
      db.prepare('UPDATE stickers SET scans = scans + 1, last_scan_at = ? WHERE id = ?').run(new Date().toISOString(), s.id);
      return res.redirect(302, `/?n=${encodeURIComponent(b.slug)}`);
    }
  }
  // Sin conectar (o código que no existe): la página explica y deja activarlo.
  res.redirect(302, `/?sticker=${encodeURIComponent(cleanCode(req.params.code))}`);
});

// Público: ¿este sticker está libre? (no dice de qué negocio es si ya está conectado)
router.get('/api/stickers/:code', (req, res) => {
  if (overLimit(req, 'sticker', 120, 60 * 60 * 1000)) return res.status(429).json({ error: 'Demasiados intentos.' });
  const s = getSticker(req.params.code);
  if (!s) return res.status(404).json({ status: 'unknown', error: 'Ese sticker no existe.' });
  res.json({ code: s.code, status: s.business_id ? 'assigned' : 'free' });
});

// El dueño conecta un sticker libre a su negocio (con su PIN). body: { slug }
router.post('/api/stickers/:code/assign', (req, res) => {
  const business = getBusiness(req.body?.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio. Revisa el código.' });
  if (!requireOwner(req, res, business, { allowExpired: true })) return;
  const s = getSticker(req.params.code);
  if (!s) return res.status(404).json({ error: 'Ese sticker no existe.' });
  if (s.business_id && s.business_id !== business.id) return res.status(409).json({ error: 'Ese sticker ya está conectado a otro negocio. Pídele a P.A.E. que lo libere.' });
  res.json(assign(s, business));
});

// Los stickers de un negocio y cuántas veces los han escaneado (dueño).
router.get('/api/businesses/:slug/stickers', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business, { allowExpired: true })) return;
  res.json(db.prepare('SELECT * FROM stickers WHERE business_id = ? ORDER BY assigned_at DESC').all(business.id).map(stickerJSON));
});

// ----- Administración P.A.E. -----
router.get('/api/admin/stickers', (req, res) => {
  if (!adminRouter.requireAdmin(req, res)) return;
  const rows = db.prepare('SELECT * FROM stickers ORDER BY id DESC LIMIT 500').all();
  const batches = db.prepare(`SELECT batch, COUNT(*) AS total, SUM(CASE WHEN business_id IS NULL THEN 1 ELSE 0 END) AS free, MIN(created_at) AS createdAt
    FROM stickers GROUP BY batch ORDER BY createdAt DESC`).all();
  res.json({ stickers: rows.map(stickerJSON), batches });
});
// Generar stickers nuevos (libres). body: { count }
router.post('/api/admin/stickers', (req, res) => {
  if (!adminRouter.requireAdmin(req, res)) return;
  const count = Math.round(Number(req.body?.count));
  if (!(count >= 1 && count <= 200)) return res.status(400).json({ error: 'Elige de 1 a 200 stickers.' });
  const now = new Date().toISOString();
  const batch = now.slice(0, 10) + '-' + crypto.randomBytes(2).toString('hex');
  const insert = db.prepare('INSERT INTO stickers (code, batch, created_at) VALUES (?, ?, ?)');
  const codes = [];
  db.transaction(() => {
    while (codes.length < count) {
      const c = newCode();
      if (getSticker(c)) continue;
      insert.run(c, batch, now); codes.push(c);
    }
  })();
  res.status(201).json({ batch, codes });
});
// Conectar, mover o liberar un sticker. body: { slug } (vacío = liberar)
router.put('/api/admin/stickers/:code', (req, res) => {
  if (!adminRouter.requireAdmin(req, res)) return;
  const s = getSticker(req.params.code);
  if (!s) return res.status(404).json({ error: 'Ese sticker no existe.' });
  const slug = String(req.body?.slug || '').trim();
  if (!slug) return res.json(assign(s, null));
  const business = getBusiness(slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  res.json(assign(s, business));
});

module.exports = router;
