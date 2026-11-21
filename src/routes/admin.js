const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { applyLegal } = require('./businesses');
const gwallet = require('../services/googleWallet');
const { isBlocked, recordFailure, clearFailures, parseList, birthdayText, accessInfo, todayMx, addDays, isYmd, addMonths, PLAN_PRICES } = require('../utils');
const { REASON_LABELS } = require('../promos');
const demo = require('../demo');
const pricing = require('../pricing');
const { generateUniqueSlug } = require('./businesses');
const { TERMS_VERSION, paeMissing } = require('../legal');

// Sección solo para P.A.E.: ver todos los negocios y descargar el respaldo completo.
// Todo aquí requiere la clave de administrador (ADMIN_KEY).
const router = express.Router();

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function requireAdmin(req, res) {
  if (!process.env.ADMIN_KEY) {
    res.status(403).json({ error: 'Primero configura ADMIN_KEY en Railway.' });
    return false;
  }
  if (isBlocked(req, '__admin__')) {
    res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
    return false;
  }
  if (!safeEqual(req.header('x-admin-key'), process.env.ADMIN_KEY)) {
    recordFailure(req, '__admin__');
    res.status(401).json({ error: 'La clave de administrador no es correcta.' });
    return false;
  }
  clearFailures(req, '__admin__');
  return true;
}

// Lista de negocios con sus números
router.get('/summary', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const businesses = db.prepare(`
    SELECT b.slug, b.name, b.color, b.plan, b.created_at AS createdAt, b.access_type, b.access_until,
      b.owner_name AS ownerName, b.owner_phone AS ownerPhone, b.owner_email AS ownerEmail, b.price_monthly, b.billing_cycle AS billingCycle,
      b.admin_notes AS notes, b.legal_name AS legalName, b.legal_address AS legalAddress, b.privacy_email AS privacyEmail,
      b.tier_id, b.tier_name AS tierName, b.tier_label, b.tier_esencial, b.tier_premium, b.tier_joined_at AS tierJoinedAt,
      b.terms_version AS termsVersion, b.terms_accepted_at AS termsAcceptedAt, b.terms_accepted_by AS termsAcceptedBy, b.terms_ip AS termsIp,
      (SELECT MAX(p.paid_at) FROM payments p WHERE p.business_id = b.id) AS lastPayment,
      (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.business_id = b.id) AS totalPaid,
      (SELECT COUNT(*) FROM customers c WHERE c.business_id = b.id AND c.status != 'pending') AS customers,
      (SELECT COUNT(*) FROM customers c WHERE c.business_id = b.id AND c.status = 'pending') AS pending,
      (SELECT COALESCE(SUM(h.amount), 0) FROM history h JOIN customers c ON c.id = h.customer_id
        WHERE c.business_id = b.id AND h.type = 'add') AS given,
      (SELECT COALESCE(SUM(c.redemptions), 0) FROM customers c WHERE c.business_id = b.id) AS redemptions,
      (SELECT MAX(h.created_at) FROM history h JOIN customers c ON c.id = h.customer_id
        WHERE c.business_id = b.id AND h.type = 'add' AND h.reason IS NULL) AS lastVisit,
      (SELECT COUNT(*) FROM stickers s WHERE s.business_id = b.id) AS stickers,
      (SELECT COALESCE(SUM(s.scans), 0) FROM stickers s WHERE s.business_id = b.id) AS stickerScans,
      (SELECT COUNT(*) FROM customers c WHERE c.business_id = b.id AND (SELECT COUNT(*) FROM history h
        WHERE h.customer_id = c.id AND h.type = 'add' AND h.reason IS NULL) >= 2) AS returned
    FROM businesses b WHERE b.is_demo = 0 ORDER BY b.created_at DESC
  `).all().map(({ access_type, access_until, price_monthly, tier_id, tier_label, tier_esencial, tier_premium, ...b }) => {
    const pr = pricing.priceFor({ ...b, price_monthly, access_until, tier_id, tier_name: b.tierName, tier_label, tier_esencial, tier_premium });
    return {
    ...b, priceMonthly: pr.amount, priceSource: pr.source, priceTier: pr.tier, customPrice: price_monthly != null,
    tierLocked: pr.source === 'locked',
    access: accessInfo({ access_type, access_until }),
    termsOk: b.termsVersion === TERMS_VERSION,
    legalOk: Boolean(b.legalName && b.legalAddress && b.privacyEmail)
  }; });
  const today = todayMx();
  const month = today.slice(0, 7);
  const paying = businesses.filter(b => b.access.type === 'paid' && !b.access.expired);
  const kpis = {
    mrr: paying.reduce((s, b) => s + (b.priceMonthly || 0), 0),
    collectedMonth: db.prepare("SELECT COALESCE(SUM(amount), 0) AS t FROM payments WHERE substr(paid_at, 1, 7) = ?").get(month).t,
    collectedYear: db.prepare("SELECT COALESCE(SUM(amount), 0) AS t FROM payments WHERE substr(paid_at, 1, 4) = ?").get(today.slice(0, 4)).t,
    active: paying.length,
    trial: businesses.filter(b => b.access.type === 'trial' && !b.access.expired).length,
    expired: businesses.filter(b => b.access.expired).length,
    dueSoon: businesses.filter(b => !b.access.expired && b.access.type !== 'none' && b.access.daysLeft <= 7).length,
    noLimit: businesses.filter(b => b.access.type === 'none').length
  };
  // Pruebas sin movimiento: negocios en prueba que no registran clientes o llevan días sin dar sellos.
  const daysSince = iso => iso ? Math.floor((Date.now() - new Date(String(iso).includes('T') ? iso : String(iso).replace(' ', 'T') + 'Z').getTime()) / 86400000) : null;
  const quietTrials = businesses.filter(b => b.access.type === 'trial' && !b.access.expired).map(b => {
    const daysIn = daysSince(b.createdAt) || 0, quiet = b.lastVisit ? daysSince(b.lastVisit) : daysIn;
    let reason = null;
    if (b.customers === 0 && daysIn >= 2) reason = 'Aún no registra clientes';
    else if (quiet >= 5) reason = b.lastVisit ? `${quiet} días sin dar sellos` : 'Aún no da sellos';
    return reason ? { slug: b.slug, name: b.name, ownerName: b.ownerName, ownerPhone: b.ownerPhone, customers: b.customers,
      daysLeft: b.access.daysLeft, daysIn, quietDays: quiet, reason, stickers: b.stickers, stickerScans: b.stickerScans } : null;
  }).filter(Boolean).sort((a, z) => a.daysLeft - z.daysLeft);
  const leadsNew = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status IN ('solicito_prueba','solicito_contratar','quiere_contacto')").get().n;
  const ts = pricing.tiersStatus();
  const reportsPending = db.prepare("SELECT COUNT(*) AS n FROM payment_reports WHERE status = 'pendiente'").get().n;
  res.json({ businesses, today, kpis, leadsNew, quietTrials, reportsPending, prices: { esencial: ts.current.esencial, premium: ts.current.premium },
    tiers: ts.list, currentTier: ts.current.id, payInfo: pricing.payInfo(), sheets: sheetsUrls(req), legal: { termsVersion: TERMS_VERSION, missing: paeMissing() } });
});

// Cambiar el plan de un negocio (Esencial / Premium). El diseño guardado nunca se borra.
router.put('/businesses/:slug/plan', express.json(), (req, res) => {
  if (!requireAdmin(req, res)) return;
  const plan = req.body?.plan;
  if (!['esencial', 'premium'].includes(plan)) return res.status(400).json({ error: 'Plan inválido.' });
  const r = db.prepare('UPDATE businesses SET plan = ? WHERE slug = ?').run(plan, String(req.params.slug));
  if (!r.changes) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const moved = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(String(req.params.slug));
  if (moved) gwallet.syncBusiness(moved.id);   // al cambiar de plan cambian logo y título de la tarjeta
  res.json({ ok: true, plan });
});

// Vigencia del servicio.
//  { action: 'pay', days: 30 | 365 }      → suma días a partir de hoy o de la fecha vigente (lo que sea mayor), como pagado
//  { action: 'trial', days: 30 }          → prueba gratis desde hoy
//  { action: 'set', type, until }         → fecha exacta ('trial' o 'paid')
//  { action: 'none' }                     → sin fecha límite
router.put('/businesses/:slug/access', express.json(), (req, res) => {
  if (!requireAdmin(req, res)) return;
  const b = db.prepare('SELECT id, access_type, access_until FROM businesses WHERE slug = ?').get(String(req.params.slug));
  if (!b) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const { action } = req.body || {};
  const days = Math.max(1, Math.min(3660, Math.round(Number(req.body?.days) || 30)));
  let type = null, until = null;
  if (action === 'pay') {
    const today = todayMx();
    const from = b.access_until && b.access_until >= today ? addDays(b.access_until, 1) : today;
    type = 'paid'; until = addDays(from, days - 1);
  } else if (action === 'trial') {
    type = 'trial'; until = addDays(todayMx(), days - 1);
  } else if (action === 'set') {
    if (!isYmd(req.body?.until)) return res.status(400).json({ error: 'Fecha inválida.' });
    type = req.body?.type === 'paid' ? 'paid' : 'trial'; until = req.body.until;
  } else if (action !== 'none') {
    return res.status(400).json({ error: 'Acción inválida.' });
  }
  db.prepare('UPDATE businesses SET access_type = ?, access_until = ? WHERE id = ?').run(type, until, b.id);
  res.json({ ok: true, access: accessInfo({ access_type: type, access_until: until }) });
});

// Borrar un negocio para siempre, con todos sus clientes y su historial.
// Para evitar accidentes hay que mandar el código exacto del negocio en "confirm".
router.delete('/businesses/:slug', express.json(), (req, res) => {
  if (!requireAdmin(req, res)) return;
  const slug = String(req.params.slug);
  const b = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(slug);
  if (!b) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (String(req.body?.confirm || '').trim() !== slug) {
    return res.status(400).json({ error: 'Escribe el código exacto del negocio para confirmar.' });
  }
  db.transaction(() => {
    db.prepare('DELETE FROM history WHERE customer_id IN (SELECT id FROM customers WHERE business_id = ?)').run(b.id);
    db.prepare('DELETE FROM customers WHERE business_id = ?').run(b.id);
    db.prepare('DELETE FROM payments WHERE business_id = ?').run(b.id);
    db.prepare('DELETE FROM businesses WHERE id = ?').run(b.id);
  })();
  res.json({ ok: true });
});

/* ---------- Membresías ---------- */
function bizBySlug(slug) { return db.prepare('SELECT * FROM businesses WHERE slug = ?').get(String(slug)); }
function paymentJSON(p) {
  return { id: p.id, folio: p.folio, amount: p.amount, method: p.method, months: p.months, plan: p.plan,
    paidAt: p.paid_at, coversFrom: p.covers_from, coversTo: p.covers_to, note: p.note || '' };
}
const METHODS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Depósito', 'Otro'];

// Datos del dueño y condiciones de la membresía
router.put('/businesses/:slug/membership', express.json(), (req, res) => {
  if (!requireAdmin(req, res)) return;
  const b = bizBySlug(req.params.slug);
  if (!b) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const body = req.body || {};
  const phone = require('../phones').normalizePhone(body.ownerPhone || '');
  if (phone && !require('../phones').isValidPhone(phone)) return res.status(400).json({ error: 'Revisa el WhatsApp del dueño: elige el país y escribe el número completo.' });
  const email = String(body.ownerEmail || '').trim().slice(0, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'El correo no parece válido.' });
  let price = body.priceMonthly === '' || body.priceMonthly == null ? null : Math.round(Number(body.priceMonthly));
  if (price != null && !(price >= 0 && price <= 1000000)) return res.status(400).json({ error: 'Precio inválido.' });
  const cycle = body.billingCycle === 'anual' ? 'anual' : 'mensual';
  const err = applyLegal(b.id, { legalName: body.legalName, legalAddress: body.legalAddress, privacyEmail: body.privacyEmail });
  if (err) return res.status(400).json({ error: err });
  db.prepare(`UPDATE businesses SET owner_name = ?, owner_phone = ?, owner_email = ?, price_monthly = ?, billing_cycle = ?, admin_notes = ? WHERE id = ?`)
    .run(String(body.ownerName || '').trim().slice(0, 80) || null, phone || null, email || null, price, cycle,
      String(body.notes || '').trim().slice(0, 500) || null, b.id);
  res.json({ ok: true });
});

// Pagos recientes de todos los negocios
router.get('/payments', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`SELECT p.*, b.name AS business_name, b.slug AS business_slug FROM payments p
    JOIN businesses b ON b.id = p.business_id ORDER BY p.paid_at DESC, p.id DESC LIMIT 60`).all();
  res.json(rows.map(p => ({ ...paymentJSON(p), businessName: p.business_name, businessSlug: p.business_slug })));
});

// Historial de pagos de un negocio
router.get('/businesses/:slug/payments', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const b = bizBySlug(req.params.slug);
  if (!b) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  res.json(db.prepare('SELECT * FROM payments WHERE business_id = ? ORDER BY paid_at DESC, id DESC').all(b.id).map(paymentJSON));
});

// Registrar un pago: queda con folio y extiende la vigencia los meses pagados.
// Si es su primer pago (o regresa después de perder su precio), ocupa su lugar en el lote vigente.
function registerPayment(b, body) {
  const amount = Math.round(Number(body?.amount));
  const months = Math.round(Number(body?.months));
  const method = METHODS.includes(body?.method) ? body.method : 'Otro';
  const today = todayMx();
  const paidAt = isYmd(body?.paidAt) ? body.paidAt : today;
  if (!(amount > 0 && amount <= 10000000)) return { error: 'Escribe el monto que te pagaron.' };
  if (!(months >= 1 && months <= 36)) return { error: 'Elige cuántos meses cubre el pago.' };
  const from = b.access_type === 'paid' && b.access_until && b.access_until >= today ? addDays(b.access_until, 1) : today;
  const to = addDays(addMonths(from, months), -1);
  let payment, tier = null;
  db.transaction(() => {
    tier = pricing.assignTierOnPayment(b);
    const info = db.prepare(`INSERT INTO payments (business_id, folio, amount, method, months, plan, paid_at, covers_from, covers_to, note, created_at)
      VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(b.id, amount, method, months, b.plan, paidAt, from, to,
      String(body?.note || '').trim().slice(0, 200) || null, new Date().toISOString());
    // El folio sale del número interno del pago: nunca se repite, aunque se borre un pago
    db.prepare('UPDATE payments SET folio = ? WHERE id = ?').run('P-' + String(info.lastInsertRowid).padStart(4, '0'), info.lastInsertRowid);
    db.prepare("UPDATE businesses SET access_type = 'paid', access_until = ? WHERE id = ?").run(to, b.id);
    payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid);
  })();
  return { payment, to, tier };
}
router.post('/businesses/:slug/payments', express.json(), (req, res) => {
  if (!requireAdmin(req, res)) return;
  const b = bizBySlug(req.params.slug);
  if (!b) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const r = registerPayment(b, req.body);
  if (r.error) return res.status(400).json({ error: r.error });
  res.status(201).json({ payment: paymentJSON(r.payment), access: accessInfo({ access_type: 'paid', access_until: r.to }), tier: r.tier ? { name: r.tier.name, label: r.tier.label } : null });
});

/* ---------- Avisos de pago que mandan los negocios ("Ya pagué") ---------- */
function reportJSON(r) {
  return { id: r.id, method: r.method, months: r.months, amount: r.amount, plan: r.plan || null, reference: r.reference || '', note: r.note || '', status: r.status,
    rejectReason: r.reject_reason || '', createdAt: r.created_at, resolvedAt: r.resolved_at, businessName: r.business_name, businessSlug: r.business_slug,
    ownerName: r.owner_name || '', ownerPhone: r.owner_phone || '' };
}
router.get('/payment-reports', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`SELECT r.*, b.name AS business_name, b.slug AS business_slug, b.owner_name, b.owner_phone FROM payment_reports r
    JOIN businesses b ON b.id = r.business_id ORDER BY CASE r.status WHEN 'pendiente' THEN 0 ELSE 1 END, r.id DESC LIMIT 60`).all();
  res.json(rows.map(reportJSON));
});
router.post('/payment-reports/:id/confirm', express.json(), (req, res) => {
  if (!requireAdmin(req, res)) return;
  const r = db.prepare('SELECT * FROM payment_reports WHERE id = ?').get(Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'Ese aviso ya no existe.' });
  if (r.status !== 'pendiente') return res.status(400).json({ error: 'Ese aviso ya se resolvió.' });
  let b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(r.business_id);
  // Si al pagar eligió otro plan, se cambia antes de registrar el pago (el pago queda con ese plan).
  if (r.plan && ['esencial', 'premium'].includes(r.plan) && r.plan !== b.plan) {
    db.prepare('UPDATE businesses SET plan = ? WHERE id = ?').run(r.plan, b.id);
    b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(b.id);
  }
  const out = registerPayment(b, { amount: req.body?.amount ?? r.amount, months: req.body?.months ?? r.months, method: r.method,
    paidAt: req.body?.paidAt, note: [r.reference ? 'Ref. ' + r.reference : '', r.note || ''].filter(Boolean).join(' · ') });
  if (out.error) return res.status(400).json({ error: out.error });
  db.prepare("UPDATE payment_reports SET status = 'confirmado', payment_id = ?, resolved_at = ? WHERE id = ?").run(out.payment.id, new Date().toISOString(), r.id);
  res.json({ payment: paymentJSON(out.payment), access: accessInfo({ access_type: 'paid', access_until: out.to }), slug: b.slug, tier: out.tier ? { name: out.tier.name, label: out.tier.label } : null });
});
router.post('/payment-reports/:id/reject', express.json(), (req, res) => {
  if (!requireAdmin(req, res)) return;
  const r = db.prepare('SELECT * FROM payment_reports WHERE id = ?').get(Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'Ese aviso ya no existe.' });
  if (r.status !== 'pendiente') return res.status(400).json({ error: 'Ese aviso ya se resolvió.' });
  db.prepare("UPDATE payment_reports SET status = 'rechazado', reject_reason = ?, resolved_at = ? WHERE id = ?")
    .run(String(req.body?.reason || '').trim().slice(0, 200) || null, new Date().toISOString(), r.id);
  res.json({ ok: true });
});

/* ---------- Lotes de precio y datos para cobrar ---------- */
router.put('/settings/pricing', express.json(), (req, res) => {
  if (!requireAdmin(req, res)) return;
  const t = pricing.cleanTiers(req.body?.tiers);
  if (!t) return res.status(400).json({ error: 'Revisa los lotes: cada uno necesita precio Esencial y Premium mayores a 0, y lugares de 1 en adelante.' });
  pricing.setSetting('price_tiers', t);
  const ts = pricing.tiersStatus();
  res.json({ tiers: ts.list, currentTier: ts.current.id });
});
router.put('/settings/payinfo', express.json(), (req, res) => {
  if (!requireAdmin(req, res)) return;
  const b = req.body || {};
  const pick = (v, max) => String(v || '').trim().slice(0, max);
  const clabe = pick(b.clabe, 24).replace(/\s+/g, '');
  if (clabe && !/^\d{18}$/.test(clabe)) return res.status(400).json({ error: 'La CLABE debe tener 18 dígitos.' });
  const info = { bank: pick(b.bank, 60), holder: pick(b.holder, 80), clabe, card: pick(b.card, 24).replace(/[^\d ]/g, ''), cashNote: pick(b.cashNote, 200), extra: pick(b.extra, 300) };
  pricing.setSetting('pay_info', info);
  res.json(pricing.payInfo());
});

// Borrar un pago registrado por error (no cambia la vigencia; ajústala con "Otra fecha" si hace falta)
router.delete('/payments/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const r = db.prepare('DELETE FROM payments WHERE id = ?').run(Number(req.params.id));
  if (!r.changes) return res.status(404).json({ error: 'Ese pago ya no existe.' });
  res.json({ ok: true });
});

// Suspender el acceso hoy mismo (por falta de pago). Nada se borra.
router.put('/businesses/:slug/suspend', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const b = bizBySlug(req.params.slug);
  if (!b) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const type = b.access_type === 'trial' ? 'trial' : 'paid';
  const until = addDays(todayMx(), -1);
  db.prepare('UPDATE businesses SET access_type = ?, access_until = ? WHERE id = ?').run(type, until, b.id);
  res.json({ ok: true, access: accessInfo({ access_type: type, access_until: until }) });
});

// Restablecer el PIN del dueño cuando lo olvidó. Se genera uno nuevo de 6 dígitos al azar
// y todos los celulares con sesión abierta se salen solos.
router.put('/businesses/:slug/pin', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const business = db.prepare('SELECT id, staff_pin FROM businesses WHERE slug = ?').get(String(req.params.slug));
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  let pin;
  const used = db.prepare('SELECT 1 FROM staff_members WHERE business_id = ? AND pin = ?');
  do { pin = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); } while (pin === business.staff_pin || used.get(business.id, pin));
  db.prepare('UPDATE businesses SET pin = ? WHERE id = ?').run(pin, business.id);
  res.json({ ok: true, pin });
});

/* ---------- Google Sheets ----------
   Google Sheets lee estas ligas con la fórmula IMPORTDATA y se actualiza solo.
   Usan una clave aparte (SHEETS_KEY) que solo permite LEER: aunque alguien la viera,
   no podría crear negocios ni tocar tarjetas. */

function baseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function sheetsUrls(req) {
  if (!process.env.SHEETS_KEY) return null;
  const k = encodeURIComponent(process.env.SHEETS_KEY);
  return {
    negocios: `${baseUrl(req)}/api/admin/sheets/negocios.csv?key=${k}`,
    clientes: `${baseUrl(req)}/api/admin/sheets/clientes.csv?key=${k}`,
    visitas: `${baseUrl(req)}/api/admin/sheets/visitas.csv?key=${k}`,
    prospectos: `${baseUrl(req)}/api/admin/sheets/prospectos.csv?key=${k}`,
    pagos: `${baseUrl(req)}/api/admin/sheets/pagos.csv?key=${k}`
  };
}

function requireSheetsKey(req, res) {
  if (!process.env.SHEETS_KEY) {
    res.status(403).type('text/plain').send('Falta configurar SHEETS_KEY en Railway.');
    return false;
  }
  if (isBlocked(req, '__sheets__')) {
    res.status(429).type('text/plain').send('Demasiados intentos.');
    return false;
  }
  if (!safeEqual(req.query.key, process.env.SHEETS_KEY)) {
    recordFailure(req, '__sheets__');
    res.status(401).type('text/plain').send('Clave incorrecta.');
    return false;
  }
  clearFailures(req, '__sheets__');
  return true;
}

// Celda de CSV segura: entre comillas, y sin que un texto que empiece con "=" se vuelva fórmula.
function cell(value) {
  let t = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(t)) t = ' ' + t;
  return '"' + t.replace(/"/g, '""').replace(/[\r\n]+/g, ' ') + '"';
}

function fecha(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).includes('T') ? iso : String(iso).replace(' ', 'T') + 'Z');
  if (isNaN(d)) return String(iso);
  // Hora de la Ciudad de México
  return d.toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' }).slice(0, 16);
}

function vigenciaText(a) {
  if (a.type === 'none') return 'Sin fecha límite';
  const tipo = a.type === 'paid' ? 'Pagado' : 'Prueba';
  return a.expired ? `${tipo} · vencido el ${a.until}` : `${tipo} hasta ${a.until} (${a.daysLeft} días)`;
}

function sendCsv(res, header, rows) {
  const lines = [header.map(cell).join(',')].concat(rows.map(r => r.map(cell).join(',')));
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Cache-Control', 'no-store');
  res.send(lines.join('\r\n'));
}

router.get('/sheets/negocios.csv', (req, res) => {
  if (!requireSheetsKey(req, res)) return;
  const rows = db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM customers c WHERE c.business_id = b.id AND c.status != 'pending') AS activos,
      (SELECT COUNT(*) FROM customers c WHERE c.business_id = b.id AND c.status = 'pending') AS pendientes,
      (SELECT COUNT(*) FROM customers c WHERE c.business_id = b.id AND c.marketing_opt_in = 1) AS promos,
      (SELECT COALESCE(SUM(h.amount), 0) FROM history h JOIN customers c ON c.id = h.customer_id
        WHERE c.business_id = b.id AND h.type = 'add') AS dados,
      (SELECT COALESCE(SUM(c.redemptions), 0) FROM customers c WHERE c.business_id = b.id) AS canjes,
      (SELECT MAX(h.created_at) FROM history h JOIN customers c ON c.id = h.customer_id
        WHERE c.business_id = b.id) AS ultima
    FROM businesses b WHERE b.is_demo = 0 ORDER BY b.created_at ASC
  `).all();
  sendCsv(res,
    ['Negocio', 'Código', 'Plan', 'Vigencia', 'Dueño', 'WhatsApp dueño', 'Precio mensual', 'Mecánica', 'Meta', 'Premio', 'Productos', 'Clientes activos', 'Solicitudes pendientes',
      'Aceptan promociones', 'Sellos o puntos dados', 'Premios canjeados', 'Última actividad', 'Fecha de alta', 'Liga para clientes'],
    rows.map(b => [
      b.name, b.slug, b.plan === 'premium' ? 'Premium' : 'Esencial', vigenciaText(accessInfo(b)), b.owner_name || '', b.owner_phone || '',
      pricing.priceFor(b).amount, b.mechanic === 'sellos' ? 'Sellos' : b.wallet_pct > 0 ? `Monedero ${b.wallet_pct}%` : 'Puntos',
      b.mechanic === 'sellos' ? b.stamps_goal : b.points_goal, b.reward_desc, parseList(b.products).join(' / '),
      b.activos, b.pendientes, b.promos, b.dados, b.canjes, fecha(b.ultima), fecha(b.created_at),
      `${baseUrl(req)}/?n=${b.slug}`
    ]));
});

router.get('/sheets/clientes.csv', (req, res) => {
  if (!requireSheetsKey(req, res)) return;
  const rows = db.prepare(`
    SELECT c.*, b.name AS negocio, b.slug, b.mechanic, b.stamps_goal, b.points_goal,
      (SELECT COALESCE(SUM(h.amount), 0) FROM history h WHERE h.customer_id = c.id AND h.type = 'add') AS dados,
      (SELECT MAX(h.created_at) FROM history h WHERE h.customer_id = c.id) AS ultima
    FROM customers c JOIN businesses b ON b.id = c.business_id
    WHERE b.is_demo = 0
    ORDER BY b.name ASC, c.created_at ASC
  `).all();
  sendCsv(res,
    ['Negocio', 'Código negocio', 'Nombre', 'Teléfono', 'Correo', 'Cumpleaños', 'Productos favoritos', 'Acepta promociones',
      'Estado', 'Avance actual', 'Meta', 'Total dado', 'Premios canjeados', 'Última visita', 'Fecha de registro'],
    rows.map(c => [
      c.negocio, c.slug, c.name, c.phone, c.email || '', birthdayText(c.birthday), parseList(c.favorites).join(' / '),
      c.marketing_opt_in ? 'Sí' : 'No', c.status === 'pending' ? 'Solicitud pendiente' : 'Activo',
      c.progress, c.mechanic === 'sellos' ? c.stamps_goal : c.points_goal, c.dados, c.redemptions,
      fecha(c.ultima), fecha(c.created_at)
    ]));
});

// Copia exacta de toda la base de datos (todos los negocios y clientes)
router.get('/backup', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const tmp = path.join(os.tmpdir(), `redeo-respaldo-${Date.now()}.db`);
  try {
    await db.backup(tmp);
    const day = new Date().toISOString().slice(0, 10);
    res.download(tmp, `redeo-respaldo-${day}.db`, () => fs.unlink(tmp, () => {}));
  } catch (err) {
    console.error(err);
    fs.unlink(tmp, () => {});
    res.status(500).json({ error: 'No se pudo generar el respaldo.' });
  }
});

// Pagos de membresías (para tu control de ingresos)
router.get('/sheets/pagos.csv', (req, res) => {
  if (!requireSheetsKey(req, res)) return;
  const rows = db.prepare(`SELECT p.*, b.name AS negocio, b.slug FROM payments p JOIN businesses b ON b.id = p.business_id
    ORDER BY p.paid_at DESC, p.id DESC`).all();
  sendCsv(res, ['Folio', 'Fecha de pago', 'Negocio', 'Código negocio', 'Plan', 'Monto', 'Método', 'Meses', 'Cubre desde', 'Cubre hasta', 'Nota'],
    rows.map(p => [p.folio, p.paid_at, p.negocio, p.slug, p.plan === 'premium' ? 'Premium' : 'Esencial', p.amount, p.method, p.months, p.covers_from, p.covers_to, p.note || '']));
});

// Cada sello y cada canje, con fecha, hora y productos (lo más reciente primero)
router.get('/sheets/visitas.csv', (req, res) => {
  if (!requireSheetsKey(req, res)) return;
  const rows = db.prepare(`
    SELECT h.type, h.amount, h.products, h.created_at, h.reason, c.name, c.phone, b.name AS negocio, b.slug, b.mechanic, b.wallet_pct
    FROM history h JOIN customers c ON c.id = h.customer_id JOIN businesses b ON b.id = c.business_id
    WHERE b.is_demo = 0
    ORDER BY h.id DESC LIMIT 20000
  `).all();
  sendCsv(res,
    ['Fecha y hora', 'Negocio', 'Código negocio', 'Cliente', 'Teléfono', 'Movimiento', 'Cantidad', 'Productos comprados'],
    rows.map(h => [
      fecha(h.created_at), h.negocio, h.slug, h.name, h.phone,
      h.type === 'redeem' ? (h.wallet_pct > 0 ? 'Usó saldo' : 'Canjeó premio') : ((h.mechanic === 'sellos' ? 'Sello' : h.wallet_pct > 0 ? 'Saldo ($)' : 'Puntos') + (h.reason ? ` (${REASON_LABELS[h.reason] || h.reason})` : '')),
      h.type === 'redeem' ? -h.amount : h.amount, parseList(h.products).join(' / ')
    ]));
});

/* ---------- Prospectos (negocios interesados) ---------- */
const LEAD_STATUS = {
  probando: 'Probando la demo', solicito_prueba: 'Pidió su prueba gratis', solicito_contratar: 'Quiere contratar',
  quiere_contacto: 'Pidió que lo contacten', prueba_activa: 'Activó su prueba solo', olvido_pin: 'Olvidó su PIN', aprobado: 'Activado', descartado: 'Descartado', vencido: 'Demo vencida'
};
function leadRows() {
  return db.prepare(`SELECT l.*, b.slug, b.is_demo, b.demo_expires_at, b.name AS biz_name, b.plan,
      (SELECT COUNT(*) FROM history h JOIN customers c ON c.id = h.customer_id WHERE c.business_id = b.id AND h.created_at > l.created_at) AS demo_moves
    FROM leads l LEFT JOIN businesses b ON b.id = l.business_id ORDER BY
      CASE l.status WHEN 'olvido_pin' THEN 0 WHEN 'solicito_contratar' THEN 0 WHEN 'solicito_prueba' THEN 1 WHEN 'prueba_activa' THEN 2 WHEN 'quiere_contacto' THEN 3 WHEN 'probando' THEN 4 ELSE 5 END, l.id DESC
    LIMIT 500`).all();
}
function leadJSON(l) {
  return {
    id: l.id, contactName: l.contact_name, businessName: l.business_name, giro: l.giro, giroLabel: (demo.GIROS[l.giro] || demo.GIROS.otro).label,
    whatsapp: l.whatsapp, status: l.status, statusLabel: LEAD_STATUS[l.status] || l.status, contactTime: l.contact_time || '', message: l.message || '',
    notes: l.notes || '', createdAt: l.created_at, requestedAt: l.requested_at, approvedAt: l.approved_at, lastSeenAt: l.last_seen_at,
    slug: l.slug || null, isDemo: Boolean(l.is_demo), demoExpiresAt: l.is_demo ? l.demo_expires_at : null, demoMoves: l.demo_moves || 0, plan: l.plan || null
  };
}
router.get('/leads', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(leadRows().map(leadJSON));
});
router.put('/leads/:id', express.json(), (req, res) => {
  if (!requireAdmin(req, res)) return;
  const l = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: 'Ese prospecto ya no existe.' });
  const notes = req.body?.notes != null ? String(req.body.notes).slice(0, 1000) : l.notes;
  db.prepare('UPDATE leads SET notes = ?, updated_at = ? WHERE id = ?').run(notes, new Date().toISOString(), l.id);
  res.json({ ok: true });
});
// Activar: su demo se vuelve su cuenta real (sin datos de ejemplo) con prueba gratis.
router.post('/leads/:id/approve', express.json(), (req, res) => {
  if (!requireAdmin(req, res)) return;
  const l = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: 'Ese prospecto ya no existe.' });
  if (l.status === 'aprobado' || l.status === 'prueba_activa') return res.status(400).json({ error: 'Este prospecto ya está activado.' });
  const { business, pin } = demo.approveLead(l, { plan: req.body?.plan, trialDays: req.body?.trialDays }, generateUniqueSlug);
  res.json({ ok: true, slug: business.slug, pin, name: business.name, contactName: l.contact_name, whatsapp: l.whatsapp,
    plan: business.plan, access: accessInfo(business), link: `${baseUrl(req)}/` });
});
// Darle más días a su demo.
router.post('/leads/:id/extend', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const l = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(req.params.id));
  if (!l || !l.business_id) return res.status(404).json({ error: 'Ese prospecto ya no tiene demo.' });
  db.prepare('UPDATE businesses SET demo_expires_at = ? WHERE id = ? AND is_demo = 1').run(new Date(Date.now() + 7 * 86400000).toISOString(), l.business_id);
  res.json({ ok: true });
});
// Descartar: se borra su demo y queda en la lista como descartado.
router.post('/leads/:id/discard', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const l = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: 'Ese prospecto ya no existe.' });
  const b = l.business_id ? db.prepare('SELECT id, is_demo FROM businesses WHERE id = ?').get(l.business_id) : null;
  if (b && b.is_demo) demo.deleteBusiness(b.id);
  db.prepare("UPDATE leads SET status = 'descartado', business_id = CASE WHEN ? THEN NULL ELSE business_id END, updated_at = ? WHERE id = ?")
    .run(b && b.is_demo ? 1 : 0, new Date().toISOString(), l.id);
  res.json({ ok: true });
});
router.get('/sheets/prospectos.csv', (req, res) => {
  if (!requireSheetsKey(req, res)) return;
  const rows = leadRows();
  sendCsv(res,
    ['Fecha', 'Nombre', 'Negocio', 'Giro', 'WhatsApp', 'Estado', 'Horario para contactar', 'Mensaje', 'Movimientos en la demo', 'Última vez en la demo', 'Código del negocio', 'Notas'],
    rows.map(l => { const j = leadJSON(l); return [fecha(j.createdAt), j.contactName, j.businessName, j.giroLabel, j.whatsapp, j.statusLabel, j.contactTime,
      j.message, j.demoMoves, fecha(j.lastSeenAt), j.slug || '', j.notes]; }));
});

router.requireAdmin = requireAdmin;   // lo usan los stickers (routes/stickers.js)
module.exports = router;
