const express = require('express');
const db = require('../db');
const { slugify, isPremium, parseList, isWallet } = require('../utils');
const { requireOwner } = require('./businesses');
const { parsePromos, cleanPromos, nowMx, birthdayDistance, publicPromos, promoWords } = require('../promos');

// Herramientas para vender más (plan Premium, solo el dueño): promociones, clientes que no han regresado,
// cumpleaños y reporte del mes.
const router = express.Router({ mergeParams: true });

function guard(req, res) {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business) { res.status(404).json({ error: 'No encontramos ese negocio.' }); return null; }
  if (!requireOwner(req, res, business)) return null;
  if (!isPremium(business)) { res.status(403).json({ error: 'Esta función es del plan Premium.' }); return null; }
  return business;
}

// Convierte una fecha guardada (UTC) al día de la Ciudad de México: 'YYYY-MM-DD'
function mxDay(iso) {
  const s = String(iso || '');
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return isNaN(d) ? '' : d.toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
}

// ---------- Promociones ----------
router.get('/promos', (req, res) => {
  const b = guard(req, res); if (!b) return;
  res.json(parsePromos(b.promos));
});
router.put('/promos', (req, res) => {
  const b = guard(req, res); if (!b) return;
  const promos = cleanPromos(req.body);
  db.prepare('UPDATE businesses SET promos = ? WHERE id = ?').run(JSON.stringify(promos), b.id);
  res.json({ promos, summary: publicPromos(promos, undefined, promoWords(b)) });
});

// ---------- Clientes que no han regresado ----------
router.get('/inactive', (req, res) => {
  const b = guard(req, res); if (!b) return;
  const days = [15, 30, 45, 60, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const rows = db.prepare(`
    SELECT c.name, c.phone, c.progress, c.created_at, c.marketing_opt_in,
      (SELECT MAX(h.created_at) FROM history h WHERE h.customer_id = c.id AND h.type = 'add' AND h.reason IS NULL) AS last_visit
    FROM customers c WHERE c.business_id = ? AND c.status = 'active'
  `).all(b.id);
  const now = Date.now();
  const list = rows.map(r => {
    const ref = r.last_visit || r.created_at;
    const away = Math.floor((now - new Date(String(ref).includes('T') ? ref : String(ref).replace(' ', 'T') + 'Z').getTime()) / 86400000);
    return { name: r.name || '', phone: r.phone, progress: r.progress, lastVisit: r.last_visit, daysAway: away, neverVisited: !r.last_visit, marketingOptIn: Boolean(r.marketing_opt_in) };
  }).filter(x => x.daysAway >= days).sort((a, b2) => b2.daysAway - a.daysAway);
  res.json({ days, customers: list });
});

// ---------- Cumpleaños (próximos 30 días) ----------
router.get('/birthdays', (req, res) => {
  const b = guard(req, res); if (!b) return;
  const today = nowMx().ymd;
  const rows = db.prepare("SELECT name, phone, progress, birthday, marketing_opt_in FROM customers WHERE business_id = ? AND status = 'active' AND birthday IS NOT NULL").all(b.id);
  const list = rows.map(r => ({ name: r.name || '', phone: r.phone, progress: r.progress, birthday: r.birthday, daysUntil: birthdayDistance(r.birthday, today).until, marketingOptIn: Boolean(r.marketing_opt_in) }))
    .filter(x => x.daysUntil <= 30).sort((a, c) => a.daysUntil - c.daysUntil);
  const missing = db.prepare("SELECT COUNT(*) AS n FROM customers WHERE business_id = ? AND status = 'active' AND birthday IS NULL").get(b.id).n;
  res.json({ customers: list, missing });
});

// ---------- Reporte del mes ----------
function monthOf(ymd) { return ymd.slice(0, 7); }
function prevMonth(m) { const y = +m.slice(0, 4), mo = +m.slice(5, 7); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; }

function stats(business, month, all, customers) {
  const inMonth = all.filter(h => h.day.slice(0, 7) === month);
  const visits = inMonth.filter(h => h.type === 'add' && !h.reason);
  const activeIds = new Set(visits.map(h => h.customer_id));
  // Regresaron: clientes que vinieron este mes y ya habían venido antes (este mes o antes)
  const firstVisit = new Map();
  all.filter(h => h.type === 'add' && !h.reason).forEach(h => { if (!firstVisit.has(h.customer_id) || h.id < firstVisit.get(h.customer_id)) firstVisit.set(h.customer_id, h.id); });
  const returned = new Set(visits.filter(h => h.id !== firstVisit.get(h.customer_id)).map(h => h.customer_id));
  const products = {};
  visits.forEach(h => parseList(h.products).forEach(p => { products[p] = (products[p] || 0) + 1; }));
  const byCustomer = {};
  visits.forEach(h => { byCustomer[h.customer_id] = (byCustomer[h.customer_id] || 0) + 1; });
  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  visits.forEach(h => { weekdays[new Date(h.day + 'T12:00:00Z').getUTCDay()] += 1; });
  const cById = new Map(customers.map(c => [c.id, c]));
  return {
    month,
    newCustomers: customers.filter(c => mxDay(c.created_at).slice(0, 7) === month).length,
    visits: visits.length,
    activeCustomers: activeIds.size,
    returningCustomers: returned.size,
    given: inMonth.filter(h => h.type === 'add').reduce((s, h) => s + h.amount, 0),
    bonusGiven: inMonth.filter(h => h.type === 'add' && h.reason).reduce((s, h) => s + h.amount, 0),
    redemptions: inMonth.filter(h => h.type === 'redeem').length,
    sales: visits.reduce((s, h) => s + (h.ticket || 0), 0),                            // monedero: ventas registradas con tarjeta
    redeemedAmount: inMonth.filter(h => h.type === 'redeem').reduce((s, h) => s + h.amount, 0),
    topProducts: Object.entries(products).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, n })),
    topCustomers: Object.entries(byCustomer).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, n]) => ({ name: (cById.get(Number(id)) || {}).name || (cById.get(Number(id)) || {}).phone || '', n })),
    weekdays
  };
}

router.get('/report', (req, res) => {
  const b = guard(req, res); if (!b) return;
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? req.query.month : monthOf(nowMx().ymd);
  const customers = db.prepare('SELECT id, name, phone, created_at FROM customers WHERE business_id = ?').all(b.id);
  const all = db.prepare(`SELECT h.id, h.customer_id, h.type, h.amount, h.products, h.reason, h.created_at, h.ticket
    FROM history h JOIN customers c ON c.id = h.customer_id WHERE c.business_id = ?`).all(b.id)
    .map(h => ({ ...h, day: mxDay(h.created_at) }));
  res.json({ current: stats(b, month, all, customers), previous: stats(b, prevMonth(month), all, customers), mechanic: isWallet(b) ? 'monedero' : b.mechanic });
});

// ---------- Niveles de cliente ----------
const levels = require('../levels');
const reminders = require('../reminders');
router.get('/levels', (req, res) => {
  const b = guard(req, res); if (!b) return;
  const config = levels.parseLevels(b.levels);
  // Cuántos clientes hay en cada nivel (con la ventana de días guardada).
  const map = levels.visitsMap({ ...b, levels: JSON.stringify({ ...config, on: true }) });
  const ids = db.prepare("SELECT id FROM customers WHERE business_id = ? AND status = 'active'").all(b.id);
  const counts = new Array(config.tiers.length + 1).fill(0);
  ids.forEach(r => { counts[map.get(r.id).index]++; });
  res.json({ config, counts, windows: levels.WINDOWS, boosts: levels.BOOSTS });
});
router.put('/levels', (req, res) => {
  const b = guard(req, res); if (!b) return;
  const config = levels.cleanLevels(req.body);
  db.prepare('UPDATE businesses SET levels = ? WHERE id = ?').run(JSON.stringify(config), b.id);
  const updated = db.prepare('SELECT * FROM businesses WHERE id = ?').get(b.id);
  res.json({ config, summary: levels.publicLevels(updated) });
});

// ---------- Recordatorios por tiempo ----------
router.get('/reminders', (req, res) => {
  const b = guard(req, res); if (!b) return;
  const config = reminders.parseReminders(b.reminders);
  const R = { ...config, on: true };
  const last = reminders.lastVisitsMap(b);
  const rows = db.prepare("SELECT id, name, phone, progress, marketing_opt_in, remind_days, remind_at, remind_note, remind_sent_at FROM customers WHERE business_id = ? AND status = 'active'").all(b.id);
  const list = [];
  for (const c of rows) {
    const r = reminders.reminderFor(R, c, last.get(c.id));
    if (!r) continue;
    list.push({ name: c.name || '', phone: c.phone, progress: c.progress, marketingOptIn: Boolean(c.marketing_opt_in),
      // Si el negocio le puso fecha o nota, fue a petición del cliente (ej. "avísame de la vacuna"): sí se le puede escribir.
      asked: Boolean(c.remind_at || c.remind_note), lastVisit: last.get(c.id) || null, ...r });
  }
  const due = list.filter(x => x.daysLeft <= 0 && x.daysLeft >= -60 && !x.sentAt).sort((a, z) => a.daysLeft - z.daysLeft);
  const sent = list.filter(x => x.daysLeft <= 0 && x.sentAt).length;
  const upcoming = list.filter(x => x.daysLeft > 0 && x.daysLeft <= 7).sort((a, z) => a.daysLeft - z.daysLeft);
  res.json({ config, due, upcoming, sent, options: reminders.DAY_OPTIONS });
});
router.put('/reminders', (req, res) => {
  const b = guard(req, res); if (!b) return;
  const config = reminders.cleanReminders(req.body);
  db.prepare('UPDATE businesses SET reminders = ? WHERE id = ?').run(JSON.stringify(config), b.id);
  const updated = db.prepare('SELECT * FROM businesses WHERE id = ?').get(b.id);
  res.json({ config, summary: reminders.publicReminders(updated) });
});

module.exports = router;
