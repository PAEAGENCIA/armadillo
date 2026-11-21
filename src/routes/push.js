// Avisos al celular (Premium). El cliente los activa desde su tarjeta; el dueño los manda desde Crecer → Avisos.
const express = require('express');
const db = require('../db');
const { slugify, normalizePhone, isPremium, overLimit } = require('../utils');
const { requireOwner, safeEqual } = require('./businesses');
const push = require('../push');

const router = express.Router({ mergeParams: true });
function getBusiness(slug) { return db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(slug)); }

// El cliente (con la clave de su tarjeta) se identifica igual que en el resto de su tarjeta.
function cardCustomer(req, res, business) {
  const phone = normalizePhone(req.body?.phone);
  const token = req.header('x-card-token');
  const c = db.prepare('SELECT * FROM customers WHERE business_id = ? AND phone = ?').get(business.id, phone);
  if (!c || !token || !c.card_token || !safeEqual(token, c.card_token)) { res.status(404).json({ error: 'Abre tu tarjeta de nuevo para activar los avisos.' }); return null; }
  return c;
}

// Activar avisos en este celular. body: { phone, subscription }
router.post('/subscribe', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (overLimit(req, 'push-sub', 30, 60 * 60 * 1000)) return res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' });
  if (!isPremium(business)) return res.status(403).json({ error: 'Este negocio aún no manda avisos.' });
  const customer = cardCustomer(req, res, business);
  if (!customer) return;
  const sub = push.validSubscription(req.body?.subscription);
  if (!sub) return res.status(400).json({ error: 'Tu navegador no pudo activar los avisos. Intenta de nuevo.' });
  push.subscribe(business, customer, sub);
  res.json({ ok: true });
});

// Apagar avisos en este celular. body: { phone, endpoint }
router.post('/unsubscribe', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const customer = cardCustomer(req, res, business);
  if (!customer) return;
  push.unsubscribe(customer, req.body?.endpoint);
  res.json({ ok: true });
});

// ----- Panel (solo el dueño, Premium) -----
function ownerBiz(req, res) {
  const business = getBusiness(req.params.slug);
  if (!business) { res.status(404).json({ error: 'No encontramos ese negocio.' }); return null; }
  if (!requireOwner(req, res, business)) return null;
  if (!isPremium(business)) { res.status(403).json({ error: 'Esta función es del plan Premium.' }); return null; }
  return business;
}
function summary(business) {
  const sends = db.prepare('SELECT body, created_at, targets, delivered, failed FROM push_sends WHERE business_id = ? ORDER BY id DESC LIMIT 10').all(business.id);
  const used = push.sentThisWeek(business);
  return {
    subscribers: push.subscriberCount(business),
    limit: push.LIMIT_PER_WEEK, used, left: Math.max(0, push.LIMIT_PER_WEEK - used), nextAt: push.nextAllowedAt(business),
    maxLength: push.MAX_BODY,
    history: sends.map(s => ({ body: s.body, at: s.created_at, targets: s.targets, delivered: s.delivered, failed: s.failed }))
  };
}
router.get('/', (req, res) => {
  const b = ownerBiz(req, res); if (!b) return;
  res.json(summary(b));
});
// Mandar un aviso. body: { body }
router.post('/send', async (req, res) => {
  const b = ownerBiz(req, res); if (!b) return;
  const body = String(req.body?.body || '').replace(/\s+/g, ' ').trim();
  if (body.length < 5) return res.status(400).json({ error: 'Escribe tu aviso (mínimo 5 letras).' });
  if (body.length > push.MAX_BODY) return res.status(400).json({ error: `Tu aviso es muy largo (máximo ${push.MAX_BODY} letras).` });
  if (push.sentThisWeek(b) >= push.LIMIT_PER_WEEK) {
    return res.status(429).json({ error: `Ya mandaste ${push.LIMIT_PER_WEEK} avisos esta semana. Así tus clientes no los apagan por cansancio.`, nextAt: push.nextAllowedAt(b) });
  }
  if (!push.publicKey()) return res.status(503).json({ error: 'Los avisos aún no están activos en el servidor. Avísale a P.A.E.' });
  if (!push.subscriberCount(b)) return res.status(400).json({ error: 'Todavía ningún cliente activó los avisos.' });
  try {
    const result = await push.sendToBusiness(b, body, 'Dueño');
    res.json({ ...result, ...summary(b) });
  } catch (e) {
    console.error('[avisos]', e);
    res.status(500).json({ error: 'No se pudo mandar el aviso. Intenta de nuevo.' });
  }
});

module.exports = router;
