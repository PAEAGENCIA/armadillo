// Código de compra (todos los planes).
// El cajero escribe el monto y aparece un código QR de un solo uso. El cliente lo escanea con su celular
// (en caja, por WhatsApp para pedidos a domicilio o impreso en su ticket) y se le suma a su tarjeta.
const express = require('express');
const db = require('../db');
const { slugify, normalizePhone, isPremium, isWallet, walletAmount, parseList, cleanList, overLimit, accessInfo, isBlocked, recordFailure, clearFailures } = require('../utils');
const { requirePin, safeEqual } = require('./businesses');
const visits = require('../visits');
const gwallet = require('../services/googleWallet');

const router = express.Router({ mergeParams: true });
const DAY_CHOICES = [1, 3, 7, 30];

function getBusiness(slug) { return db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(slug)); }
function baseUrl(req) { return (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, ''); }
function unitText(business, n) {
  if (isWallet(business)) return '$' + Number(n).toLocaleString('es-MX') + ' de saldo';
  if (business.mechanic === 'sellos') return n === 1 ? '1 sello' : `${n} sellos`;
  return n === 1 ? '1 punto' : `${n} puntos`;
}

function codeJSON(req, business, row) {
  const st = visits.codeStatus(row);
  let who = null;
  if (row.customer_id) {
    const c = db.prepare('SELECT name, phone FROM customers WHERE id = ?').get(row.customer_id);
    if (c) who = c.name || c.phone;
  }
  return {
    code: row.code, display: visits.fmtCode(row.code),
    url: `${baseUrl(req)}/?n=${encodeURIComponent(business.slug)}&compra=${row.code}`,
    amount: row.amount, ticket: row.ticket || null, text: unitText(business, row.amount),
    products: parseList(row.products), note: row.note || '',
    by: row.actor_type === 'owner' ? 'Dueño' : row.actor_type === 'member' ? (row.actor_name || 'Empleado') : 'Personal',
    createdAt: row.created_at, expiresAt: row.expires_at, usedAt: row.used_at || null, usedBy: who,
    status: st
  };
}

// Crear un código (dueño o personal). body: { amount (sellos/puntos) | ticket (monedero), products, note, days }
router.post('/', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const role = requirePin(req, res, business);
  if (!role) return;
  const made = db.prepare('SELECT COUNT(*) AS n FROM purchase_codes WHERE business_id = ? AND created_at >= ?').get(business.id, new Date(Date.now() - 86400000).toISOString()).n;
  if (made >= 500) return res.status(429).json({ error: 'Llegaste al máximo de 500 códigos en 24 horas.' });

  const wallet = isWallet(business);
  let amount, ticket = null;
  if (wallet) {
    ticket = Math.round(Number(req.body?.ticket));
    if (!(ticket >= 1 && ticket <= 1000000)) return res.status(400).json({ error: 'Escribe de cuánto fue la compra.' });
    amount = walletAmount(business, ticket);
  } else {
    amount = Math.round(Number(req.body?.amount));
    const max = business.mechanic === 'sellos' ? 10 : 10000;
    if (!(amount >= 1 && amount <= max)) return res.status(400).json({ error: business.mechanic === 'sellos' ? 'Elige de 1 a 10 sellos.' : 'Escribe cuántos puntos da esta compra.' });
  }
  let products = isPremium(business) ? cleanList(req.body?.products, 10, 30) : [];
  const catalog = parseList(business.products);
  if (catalog.length) {
    const allowed = new Map(catalog.map(p => [p.toLowerCase(), p]));
    products = products.map(p => allowed.get(p.toLowerCase())).filter(Boolean);
  }
  const note = String(req.body?.note || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const days = DAY_CHOICES.includes(Number(req.body?.days)) ? Number(req.body.days) : 7;
  const a = req.actor || {};
  let code;
  for (let i = 0; i < 6; i++) {
    code = visits.newPurchaseCode();
    if (!db.prepare('SELECT 1 FROM purchase_codes WHERE code = ?').get(code)) break;
  }
  const now = new Date();
  db.prepare(`INSERT INTO purchase_codes (business_id, code, amount, ticket, products, note, actor_type, actor_id, actor_name, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(business.id, code, amount, ticket, JSON.stringify(products), note || null,
    a.type || null, a.id || null, a.type === 'member' ? a.name : null, now.toISOString(), new Date(now.getTime() + days * 86400000).toISOString());
  res.status(201).json(codeJSON(req, business, db.prepare('SELECT * FROM purchase_codes WHERE code = ?').get(code)));
});

// Códigos recientes (dueño o personal): para ver cuáles ya se usaron.
router.get('/', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requirePin(req, res, business)) return;
  const rows = db.prepare('SELECT * FROM purchase_codes WHERE business_id = ? ORDER BY id DESC LIMIT 20').all(business.id);
  res.json(rows.map(r => codeJSON(req, business, r)));
});

// Cancelar un código sin usar: el dueño, o la persona que lo creó.
router.delete('/:code', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const role = requirePin(req, res, business);
  if (!role) return;
  const row = db.prepare('SELECT * FROM purchase_codes WHERE code = ? AND business_id = ?').get(visits.normalizeCode(req.params.code), business.id);
  if (!row) return res.status(404).json({ error: 'Ese código no existe.' });
  const a = req.actor || {};
  const mine = row.actor_type === a.type && (row.actor_id || null) === (a.id || null);
  if (role !== 'owner' && !mine) return res.status(403).json({ error: 'Solo el dueño o quien lo creó puede cancelarlo.' });
  if (row.used_at) return res.status(409).json({ error: 'Ese código ya se usó. Si fue un error, deshaz el movimiento desde el historial del cliente.' });
  db.prepare('UPDATE purchase_codes SET canceled_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  res.json(codeJSON(req, business, db.prepare('SELECT * FROM purchase_codes WHERE id = ?').get(row.id)));
});

// Lo que ve el cliente al abrir el código (público): qué gana y si sigue vigente. No dice quién lo usó.
router.get('/:code', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (overLimit(req, 'pcode', 120, 60 * 60 * 1000)) return res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' });
  const row = db.prepare('SELECT * FROM purchase_codes WHERE code = ? AND business_id = ?').get(visits.normalizeCode(req.params.code), business.id);
  const st = visits.codeStatus(row);
  if (!row) return res.status(404).json({ status: st, error: visits.CODE_ERRORS[st] });
  res.json({ status: st, code: row.code, display: visits.fmtCode(row.code), amount: row.amount, ticket: row.ticket || null,
    text: unitText(business, row.amount), expiresAt: row.expires_at, error: st === 'ok' ? null : visits.CODE_ERRORS[st] });
});

// El cliente suma el código a su tarjeta (con la clave de su tarjeta). body: { phone }
// Freno contra adivinar códigos: 20 intentos fallidos por conexión cada 15 minutos.
router.post('/:code/claim', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const key = `pclaim:${business.slug}`;
  if (isBlocked(req, key) || overLimit(req, 'pclaim', 60, 60 * 60 * 1000)) return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
  if (accessInfo(business).expired) return res.status(402).json({ error: `${business.name} tiene su tarjeta en pausa por ahora. Tu compra no se perdió: pide en caja que la registren.` });
  const phone = normalizePhone(req.body?.phone);
  const token = req.header('x-card-token');
  const customer = db.prepare(`SELECT c.*, (SELECT COALESCE(SUM(h.amount),0) FROM history h WHERE h.customer_id = c.id AND h.type='add') AS given
    FROM customers c WHERE c.business_id = ? AND c.phone = ?`).get(business.id, phone);
  if (!customer || !token || !customer.card_token || !safeEqual(token, customer.card_token)) return res.status(404).json({ error: 'Abre tu tarjeta para sumar tu compra.' });
  const row = db.prepare('SELECT * FROM purchase_codes WHERE code = ?').get(visits.normalizeCode(req.params.code));
  const claim = visits.claimPurchase(business, customer, row && row.business_id === business.id ? row : null);
  if (!claim.ok) {
    if (claim.code === 'not_found') recordFailure(req, key);
    return res.status(claim.status).json({ code: claim.code, error: claim.error });
  }
  clearFailures(req, key);
  try { if (gwallet.isGoogleConfigured()) gwallet.syncCustomer(customer.id); } catch (e) { console.error('[Google Wallet]', e.message); }
  const r = claim.result;
  res.json({
    ok: true, amount: row.amount, ticket: row.ticket || null, text: unitText(business, row.amount),
    bonus: r.reasons.length ? { amount: row.amount, reasons: r.reasons } : null,
    levelBonus: r.levelBonus || 0, levelUp: r.levelUp || null, activated: customer.status === 'pending'
  });
});

module.exports = router;
