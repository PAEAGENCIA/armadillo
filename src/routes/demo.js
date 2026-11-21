// Prospectos: probar Redeo con una demo de su propio negocio, o pedir que P.A.E. los contacte.
// Todo se queda dentro de la app (no los manda a WhatsApp): P.A.E. ve los prospectos en su panel y en Google Sheets.
const express = require('express');
const db = require('../db');
const { slugify, normalizePhone, businessToJSON, overLimit, isValidPin, isBlocked, recordFailure, clearFailures } = require('../utils');
const { requireOwner, generateUniqueSlug, safeEqual } = require('./businesses');
const demo = require('../demo');
const { isValidPhone } = require('../phones');

const router = express.Router();
const clean = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
const CONTACT_TIMES = ['Mañana', 'Tarde', 'Noche', 'Cuando sea'];

function readLead(body) {
  const b = body || {};
  const lead = {
    contact_name: clean(b.contactName, 60),
    business_name: clean(b.businessName, 60),
    giro: demo.GIROS[b.giro] ? b.giro : 'otro',
    whatsapp: normalizePhone(b.whatsapp),
    contact_time: CONTACT_TIMES.includes(b.contactTime) ? b.contactTime : null,
    message: clean(b.message, 400) || null
  };
  if (lead.contact_name.length < 2) return { error: 'Escribe tu nombre.' };
  if (lead.business_name.length < 2) return { error: 'Escribe el nombre de tu negocio.' };
  if (!isValidPhone(lead.whatsapp)) return { error: 'Revisa tu número de WhatsApp: elige tu país y escribe el número completo.' };
  if (b.consent !== true) return { error: 'Para continuar acepta que P.A.E. te contacte y el aviso de privacidad.' };
  return { lead };
}

// Crear la demo personalizada: su negocio con clientes de ejemplo. Entra directo, sin PIN que recordar.
router.post('/demo', (req, res) => {
  if (overLimit(req, 'demo', 6, 24 * 60 * 60 * 1000)) return res.status(429).json({ error: 'Ya creaste varias demos hoy. Si quieres otra, escríbenos.' });
  const { lead, error } = readLead(req.body);
  if (error) return res.status(400).json({ error });
  const now = new Date().toISOString();
  let out;
  db.transaction(() => {
    const leadId = db.prepare(`INSERT INTO leads (contact_name, business_name, giro, whatsapp, status, created_at, updated_at, last_seen_at, ip)
      VALUES (?, ?, ?, ?, 'probando', ?, ?, ?, ?)`).run(lead.contact_name, lead.business_name, lead.giro, lead.whatsapp, now, now, now, String(req.ip || '').slice(0, 64)).lastInsertRowid;
    const { business, pin } = demo.createDemoBusiness({ ...lead, id: leadId }, generateUniqueSlug);
    db.prepare('UPDATE leads SET business_id = ? WHERE id = ?').run(business.id, leadId);
    out = { ...businessToJSON(business), pin };
  })();
  res.status(201).json(out);
});

// Prueba gratis directa: el negocio se registra y su cuenta real queda lista al instante (14 días, plan Premium).
// Una prueba automática por número de WhatsApp; si ese número ya tuvo cuenta o prueba, queda como solicitud para P.A.E.
router.post('/trial', (req, res) => {
  if (overLimit(req, 'trial-signup', 4, 24 * 60 * 60 * 1000)) return res.status(429).json({ error: 'Ya registraste varios negocios hoy. Escríbenos y te ayudamos.' });
  const { lead, error } = readLead(req.body);
  if (error) return res.status(400).json({ error });
  const ownPin = req.body?.pin != null && req.body.pin !== '' ? String(req.body.pin) : null;
  if (ownPin && !isValidPin(ownPin)) return res.status(400).json({ error: 'Tu PIN debe ser de 4 a 8 números.' });
  const now = new Date().toISOString();
  const used = db.prepare('SELECT 1 FROM businesses WHERE is_demo = 0 AND owner_phone = ? LIMIT 1').get(lead.whatsapp)
    || db.prepare("SELECT 1 FROM leads WHERE whatsapp = ? AND status IN ('aprobado', 'prueba_activa') LIMIT 1").get(lead.whatsapp);
  const leadId = db.prepare(`INSERT INTO leads (contact_name, business_name, giro, whatsapp, status, created_at, updated_at, requested_at, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(lead.contact_name, lead.business_name, lead.giro, lead.whatsapp,
    used ? 'solicito_prueba' : 'probando', now, now, now, String(req.ip || '').slice(0, 64)).lastInsertRowid;
  if (used) return res.json({ ok: true, activated: false });
  const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  const created = demo.approveLead(row, { plan: 'premium', trialDays: demo.TRIAL_DAYS }, generateUniqueSlug);
  const business = created.business;
  let pin = created.pin;
  if (ownPin) { db.prepare('UPDATE businesses SET pin = ? WHERE id = ?').run(ownPin, business.id); pin = ownPin; }
  db.prepare("UPDATE leads SET status = 'prueba_activa', updated_at = ? WHERE id = ?").run(now, leadId);
  res.status(201).json({ ok: true, activated: true, slug: business.slug, pin, name: business.name, until: business.access_until });
});

// Entrar con el WhatsApp del dueño en lugar del código del negocio (solo el PIN del dueño).
router.post('/owner-login', (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const pin = String(req.body?.pin || '');
  const key = 'owner:' + phone;
  if (isBlocked(req, key)) return res.status(429).json({ error: 'Demasiados intentos con PIN incorrecto. Espera 15 minutos.' });
  if (!isValidPhone(phone) || !pin) return res.status(400).json({ error: 'Escribe tu WhatsApp y tu PIN.' });
  const list = db.prepare('SELECT slug, pin FROM businesses WHERE is_demo = 0 AND owner_phone = ?').all(phone);
  const hit = list.find(b => safeEqual(pin, b.pin));
  if (!hit) { recordFailure(req, key); return res.status(401).json({ error: 'El WhatsApp o el PIN no son correctos.' }); }
  clearFailures(req, key);
  res.json({ slug: hit.slug });
});

// "Olvidé mi PIN": queda como aviso para P.A.E. Siempre responde lo mismo, para no revelar qué números tienen cuenta.
router.post('/forgot-pin', (req, res) => {
  if (overLimit(req, 'forgot-pin', 5, 24 * 60 * 60 * 1000)) return res.json({ ok: true });
  const phone = normalizePhone(req.body?.phone);
  if (!isValidPhone(phone)) return res.status(400).json({ error: 'Revisa tu número de WhatsApp: elige tu país y escribe el número completo.' });
  const b = db.prepare('SELECT id, slug, name, owner_name FROM businesses WHERE is_demo = 0 AND owner_phone = ? ORDER BY id DESC LIMIT 1').get(phone);
  if (b && !db.prepare("SELECT 1 FROM leads WHERE whatsapp = ? AND status = 'olvido_pin' LIMIT 1").get(phone)) {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO leads (contact_name, business_name, giro, whatsapp, status, message, created_at, updated_at, requested_at, business_id, ip)
      VALUES (?, ?, 'otro', ?, 'olvido_pin', ?, ?, ?, ?, ?, ?)`).run(b.owner_name || 'Dueño', b.name, phone, 'Olvidó su PIN · código ' + b.slug, now, now, now, b.id, String(req.ip || '').slice(0, 64));
  }
  res.json({ ok: true });
});

// Cuenta de ejemplo para un dueño que ya tiene su cuenta: un negocio con clientes de prueba para ver cómo se ve en uso.
// No crea prospecto; se borra sola a los 7 días como cualquier demo.
router.post('/businesses/:slug/sample', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  if (overLimit(req, 'sample', 5, 24 * 60 * 60 * 1000)) return res.status(429).json({ error: 'Ya abriste varias cuentas de ejemplo hoy. Intenta mañana.' });
  const lead = db.prepare('SELECT giro FROM leads WHERE business_id = ? ORDER BY id DESC LIMIT 1').get(business.id);
  const giro = lead && demo.GIROS[lead.giro] ? lead.giro : (business.wallet_pct ? 'ropa' : 'cafeteria');
  const g = demo.GIROS[giro];
  const name = giro === 'cafeteria' ? 'Café Luna (ejemplo)' : (g.label.split(' ')[0] + ' Luna (ejemplo)');
  const { business: sample, pin } = demo.createDemoBusiness({ id: null, business_name: name, giro, contact_name: business.owner_name || 'Dueño', whatsapp: null }, generateUniqueSlug);
  res.status(201).json({ slug: sample.slug, pin, name: sample.name });
});

// Solo quiere que lo contacten (sin probar la demo).
router.post('/leads', (req, res) => {
  if (overLimit(req, 'lead', 10, 24 * 60 * 60 * 1000)) return res.status(429).json({ error: 'Ya recibimos tus datos. Te contactamos pronto.' });
  const { lead, error } = readLead(req.body);
  if (error) return res.status(400).json({ error });
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO leads (contact_name, business_name, giro, whatsapp, status, contact_time, message, created_at, updated_at, requested_at, ip)
    VALUES (?, ?, ?, ?, 'quiere_contacto', ?, ?, ?, ?, ?, ?)`).run(lead.contact_name, lead.business_name, lead.giro, lead.whatsapp,
    lead.contact_time, lead.message, now, now, now, String(req.ip || '').slice(0, 64));
  res.status(201).json({ ok: true });
});

// Desde la demo: activar la prueba gratis al instante, sin esperar a P.A.E.
// Su demo se vuelve su cuenta real (se queda lo que configuró, se borran los clientes de ejemplo y conserva su PIN),
// con plan Premium durante la prueba para que conozca todo. Una prueba automática por número de WhatsApp:
// si ese número ya tuvo cuenta o prueba, se guarda como solicitud para que P.A.E. lo atienda.
router.post('/businesses/:slug/start-trial', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  if (!business.is_demo || !business.lead_id) return res.status(400).json({ error: 'Esta cuenta ya está activa.' });
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(business.lead_id);
  if (!lead) return res.status(400).json({ error: 'No encontramos tu solicitud. Escríbenos y la activamos.' });
  if (overLimit(req, 'trial', 3, 24 * 60 * 60 * 1000)) return res.status(429).json({ error: 'Ya activaste varias pruebas hoy. Escríbenos y te ayudamos.' });
  const typed = normalizePhone(req.body?.whatsapp);
  const whatsapp = isValidPhone(typed) ? typed : lead.whatsapp;
  const now = new Date().toISOString();
  db.prepare('UPDATE leads SET whatsapp = ?, updated_at = ? WHERE id = ?').run(whatsapp, now, lead.id);
  db.prepare('UPDATE businesses SET owner_phone = ? WHERE id = ?').run(whatsapp, business.id);

  const used = db.prepare('SELECT 1 FROM businesses WHERE is_demo = 0 AND owner_phone = ? AND id != ? LIMIT 1').get(whatsapp, business.id)
    || db.prepare("SELECT 1 FROM leads WHERE whatsapp = ? AND id != ? AND status IN ('aprobado', 'prueba_activa') LIMIT 1").get(whatsapp, lead.id);
  if (used) {
    db.prepare("UPDATE leads SET status = 'solicito_prueba', requested_at = ?, updated_at = ? WHERE id = ?").run(now, now, lead.id);
    db.prepare('UPDATE businesses SET demo_expires_at = ? WHERE id = ?').run(new Date(Date.now() + demo.DEMO_DAYS_REQUESTED * 86400000).toISOString(), business.id);
    return res.json({ ok: true, activated: false, status: 'solicito_prueba' });
  }

  const { business: real, pin } = demo.approveLead({ ...lead, whatsapp }, { plan: 'premium', trialDays: demo.TRIAL_DAYS }, generateUniqueSlug);
  db.prepare("UPDATE leads SET status = 'prueba_activa', requested_at = ?, updated_at = ? WHERE id = ?").run(now, now, lead.id);
  res.json({ ok: true, activated: true, slug: real.slug, pin, name: real.name, until: real.access_until });
});

// Desde la demo: "Contratar ya" (o una prueba que no se pudo activar sola). Se guarda para P.A.E.
router.post('/businesses/:slug/demo-request', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  if (!business.is_demo || !business.lead_id) return res.status(400).json({ error: 'Esta cuenta ya está activa.' });
  const wants = req.body?.wants === 'contratar' ? 'contratar' : 'prueba';
  const contactTime = CONTACT_TIMES.includes(req.body?.contactTime) ? req.body.contactTime : null;
  const whatsapp = normalizePhone(req.body?.whatsapp);
  const message = clean(req.body?.message, 400) || null;
  const now = new Date().toISOString();
  db.prepare(`UPDATE leads SET status = ?, contact_time = COALESCE(?, contact_time), whatsapp = CASE WHEN ? THEN ? ELSE whatsapp END,
      message = COALESCE(?, message), requested_at = ?, updated_at = ? WHERE id = ?`)
    .run(wants === 'contratar' ? 'solicito_contratar' : 'solicito_prueba', contactTime, isValidPhone(whatsapp) ? 1 : 0, whatsapp, message, now, now, business.lead_id);
  // Se guarda más tiempo su demo para que P.A.E. la active tal cual la dejó.
  db.prepare('UPDATE businesses SET demo_expires_at = ? WHERE id = ?').run(new Date(Date.now() + demo.DEMO_DAYS_REQUESTED * 86400000).toISOString(), business.id);
  res.json({ ok: true, status: wants === 'contratar' ? 'solicito_contratar' : 'solicito_prueba' });
});

module.exports = router;
