const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const {
  slugify, businessToJSON, isBlocked, recordFailure, clearFailures, cleanList, isValidPin, accessInfo, todayMx, addDays,
  BASE_COLORS, STAMP_ICON_IDS, CARD_STYLES, PLANS, isPremium, strictActive, isWallet
} = require('../utils');

const { TERMS_VERSION } = require('../legal');
const gwallet = require('../services/googleWallet');
const sec = require('../security');
const pricing = require('../pricing');

// El dueño debe aceptar la versión vigente de los Términos antes de usar su panel.
function termsInfo(b) {
  return { needsTerms: b.terms_version !== TERMS_VERSION, termsVersion: TERMS_VERSION, termsAcceptedAt: b.terms_accepted_at || null, termsAcceptedBy: b.terms_accepted_by || null };
}

const PREMIUM_ONLY = 'Esta función es del plan Premium.';

const router = express.Router();

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function generateUniqueSlug(name) {
  const base = slugify(name);
  let slug = base;
  let i = 1;
  const exists = db.prepare('SELECT 1 FROM businesses WHERE slug = ?');
  while (exists.get(slug)) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Revisa el PIN del negocio. Devuelve 'owner' (PIN del dueño) o 'staff' (PIN general del personal
// o el PIN propio de un empleado). En req.actor queda quién es: { type: 'owner' | 'staff' | 'member', id, name }.
// Si no es válido, responde el error y devuelve false.
// Si la prueba o el servicio ya venció, el panel queda en pausa (nada se borra): responde 402.
function requirePin(req, res, business, opts = {}) {
  if (isBlocked(req, business.slug)) {
    res.status(429).json({ error: 'Demasiados intentos con PIN incorrecto. Espera 15 minutos.' });
    return false;
  }
  const pin = req.header('x-business-pin') || req.body?.pin;
  let role = false;
  if (safeEqual(pin, business.pin)) { role = 'owner'; req.actor = { type: 'owner', id: null, name: 'Dueño' }; }
  else if (business.staff_pin && safeEqual(pin, business.staff_pin)) { role = 'staff'; req.actor = { type: 'staff', id: null, name: 'Personal (PIN general)' }; }
  else if (pin) {
    const members = db.prepare('SELECT id, name, pin, last_seen_at FROM staff_members WHERE business_id = ? AND active = 1').all(business.id);
    const m = members.find(x => safeEqual(pin, x.pin));
    if (m) {
      role = 'staff';
      req.actor = { type: 'member', id: m.id, name: m.name };
      if (!m.last_seen_at || Date.now() - new Date(m.last_seen_at).getTime() > 5 * 60000) {
        db.prepare('UPDATE staff_members SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), m.id);
      }
    }
  }
  if (!role) {
    recordFailure(req, business.slug);
    res.status(401).json({ error: 'PIN incorrecto.' });
    return false;
  }
  clearFailures(req, business.slug);
  if (!opts.allowExpired && accessInfo(business).expired) {
    res.status(402).json({ code: 'expired', error: 'El periodo de este negocio terminó. Contacta a P.A.E. para continuar.' });
    return false;
  }
  return role;
}

// Solo el PIN del dueño: ajustes, diseño, PINs y descargar la base de clientes.
// ¿Ese PIN ya lo usa alguien en el negocio? (dueño, PIN general o un empleado)
function pinTaken(business, pin, exceptMemberId) {
  pin = String(pin);
  if (pin === String(business.pin)) return 'Ese PIN ya lo usa el dueño.';
  if (business.staff_pin && pin === String(business.staff_pin)) return 'Ese PIN ya es el PIN general del personal.';
  const m = db.prepare('SELECT id, name FROM staff_members WHERE business_id = ? AND pin = ?').all(business.id, pin).find(x => x.id !== exceptMemberId);
  return m ? 'Ese PIN ya lo usa otra persona de tu equipo.' : null;
}

function requireOwner(req, res, business, opts = {}) {
  const role = requirePin(req, res, business, opts);
  if (!role) return false;
  if (role !== 'owner') {
    res.status(403).json({ error: 'Esto solo lo puede hacer el dueño del negocio.' });
    return false;
  }
  return role;
}

// Guarda nombre o razón social, domicilio y correo de privacidad. Devuelve un mensaje si algo no es válido.
function applyLegal(businessId, body) {
  const pick = (v, max) => v == null ? null : String(v).replace(/\s+/g, ' ').trim().slice(0, max);
  const legalName = pick(body.legalName, 120), legalAddress = pick(body.legalAddress, 200), privacyEmail = pick(body.privacyEmail, 120);
  if (privacyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(privacyEmail)) return 'Ese correo no parece válido.';
  db.prepare(`UPDATE businesses SET
    legal_name = CASE WHEN @n IS NULL THEN legal_name ELSE NULLIF(@n, '') END,
    legal_address = CASE WHEN @a IS NULL THEN legal_address ELSE NULLIF(@a, '') END,
    privacy_email = CASE WHEN @e IS NULL THEN privacy_email ELSE NULLIF(@e, '') END
    WHERE id = @id`).run({ n: legalName, a: legalAddress, e: privacyEmail ? privacyEmail.toLowerCase() : privacyEmail, id: businessId });
  return null;
}

function adminRequired() {
  return Boolean(process.env.ADMIN_KEY);
}

// Crear negocio. Si ADMIN_KEY está configurada, solo quien la conoce puede crear negocios.
router.post('/', (req, res) => {
  if (adminRequired()) {
    if (isBlocked(req, '__admin__')) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
    }
    if (!safeEqual(req.header('x-admin-key'), process.env.ADMIN_KEY)) {
      recordFailure(req, '__admin__');
      return res.status(401).json({ error: 'La clave de administrador no es correcta.' });
    }
    clearFailures(req, '__admin__');
  }

  let { name, mechanic, stampsGoal, pointsGoal, pointsPerVisit, rewardDesc, color, pin } = req.body || {};
  const plan = PLANS.includes(req.body?.plan) ? req.body.plan : 'esencial';

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Escribe el nombre de tu negocio.' });
  if (!['sellos', 'puntos', 'monedero'].includes(mechanic)) return res.status(400).json({ error: 'Elige sellos, puntos o monedero.' });
  // Monedero: se guarda como "puntos" (1 punto = $1). El regalo (bienvenida, opinión, invitación) es en pesos de saldo.
  let walletPct = null;
  if (mechanic === 'monedero') {
    walletPct = Math.round(Number(req.body?.walletPct));
    if (!(walletPct >= 1 && walletPct <= 30)) return res.status(400).json({ error: 'El porcentaje del monedero debe ser de 1% a 30%.' });
    const bonus = Math.round(Number(req.body?.walletBonus ?? 50));
    if (!(bonus >= 1 && bonus <= 5000)) return res.status(400).json({ error: 'El saldo de regalo debe ser de $1 a $5,000.' });
    mechanic = 'puntos'; pointsGoal = 1; pointsPerVisit = bonus;
    if (!rewardDesc || !String(rewardDesc).trim()) rewardDesc = `${walletPct}% de cada compra en saldo`;
  }
  if (!rewardDesc || !String(rewardDesc).trim()) return res.status(400).json({ error: 'Describe el premio que da tu tarjeta.' });
  if (!isValidPin(pin)) return res.status(400).json({ error: 'El PIN debe ser de 4 a 8 dígitos.' });
  if (mechanic === 'sellos' && !(Number(stampsGoal) >= 2 && Number(stampsGoal) <= 30)) {
    return res.status(400).json({ error: 'Los sellos para el premio deben ser entre 2 y 30.' });
  }
  if (mechanic === 'puntos' && !(Number(pointsGoal) >= 1 && Number(pointsPerVisit) >= 1)) {
    return res.status(400).json({ error: 'Completa los puntos del premio y los puntos por visita.' });
  }
  if (color && !HEX_COLOR.test(color)) return res.status(400).json({ error: 'Color inválido.' });
  if (color && plan !== 'premium' && !BASE_COLORS.includes(color.toUpperCase())) {
    return res.status(403).json({ error: 'Los colores personalizados son del plan Premium.' });
  }

  // Prueba gratis: por defecto 14 días. trialDays = 0 crea el negocio sin fecha límite.
  const trialDays = req.body?.trialDays === undefined ? 14 : Math.max(0, Math.min(365, Math.round(Number(req.body.trialDays) || 0)));
  const slug = generateUniqueSlug(name);
  db.prepare(`
    INSERT INTO businesses (slug, name, pin, mechanic, stamps_goal, points_goal, points_per_visit, reward_desc, color, created_at, plan,
      access_type, access_until, owner_name, owner_phone, wallet_pct)
    VALUES (@slug, @name, @pin, @mechanic, @stampsGoal, @pointsGoal, @pointsPerVisit, @rewardDesc, @color, @createdAt, @plan,
      @accessType, @accessUntil, @ownerName, @ownerPhone, @walletPct)
  `).run({
    walletPct,
    ownerName: String(req.body?.ownerName || '').trim().slice(0, 80) || null,
    ownerPhone: (() => { const p = require('../phones').normalizePhone(req.body?.ownerPhone); return require('../phones').isValidPhone(p) ? p : null; })(),
    accessType: trialDays ? 'trial' : null,
    accessUntil: trialDays ? addDays(todayMx(), trialDays - 1) : null,
    slug,
    name: String(name).trim().slice(0, 60),
    pin: String(pin),
    mechanic,
    stampsGoal: mechanic === 'sellos' ? Math.round(Number(stampsGoal)) : null,
    pointsGoal: mechanic === 'puntos' ? Math.round(Number(pointsGoal)) : null,
    pointsPerVisit: mechanic === 'puntos' ? Math.round(Number(pointsPerVisit)) : null,
    rewardDesc: String(rewardDesc).trim().slice(0, 60),
    color: (color || '#E62E6B').toUpperCase(),
    createdAt: new Date().toISOString(),
    plan
  });

  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slug);
  res.status(201).json({ ...businessToJSON(business), role: 'owner', hasStaffPin: false, access: accessInfo(business), ...termsInfo(business) });
});

// Entrar al panel (valida PIN)
router.post('/:slug/login', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business) return res.status(404).json({ error: 'No encontramos un negocio con ese código.' });
  const role = requirePin(req, res, business, { allowExpired: true });
  if (!role) return;
  const access = accessInfo(business);
  const out = { ...businessToJSON(business), role, hasStaffPin: role === 'owner' ? Boolean(business.staff_pin) : undefined, access,
    actor: { type: req.actor.type, name: req.actor.type === 'member' ? req.actor.name : null } };
  if (role === 'owner') {
    Object.assign(out, termsInfo(business));
    if (business.is_demo && business.lead_id) {
      const lead = db.prepare('SELECT status, contact_name, whatsapp, contact_time FROM leads WHERE id = ?').get(business.lead_id);
      out.demoLead = lead ? { status: lead.status, contactName: lead.contact_name, whatsapp: lead.whatsapp, contactTime: lead.contact_time || '' } : null;
      db.prepare('UPDATE leads SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), business.lead_id);
    }
    out.teamCount = db.prepare('SELECT COUNT(*) AS n FROM staff_members WHERE business_id = ? AND active = 1').get(business.id).n;
  }
  if (access.expired) {
    // Panel en pausa: solo se muestra cuántos clientes y solicitudes lo esperan.
    out.waiting = db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status != 'pending' THEN 1 ELSE 0 END), 0) AS customers,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending
      FROM customers WHERE business_id = ?`).get(business.id);
  }
  res.json(out);
});

// Cambiar el PIN del dueño. Todos los celulares que tenían sesión con el PIN anterior se salen solos.
router.put('/:slug/pin', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  const newPin = String(req.body?.newPin || '');
  if (!isValidPin(newPin)) return res.status(400).json({ error: 'El PIN nuevo debe ser de 4 a 8 dígitos.' });
  if (business.staff_pin && newPin === business.staff_pin) {
    return res.status(400).json({ error: 'El PIN del dueño debe ser distinto al del personal.' });
  }
  if (newPin !== business.pin && db.prepare('SELECT 1 FROM staff_members WHERE business_id = ? AND pin = ?').get(business.id, newPin)) {
    return res.status(400).json({ error: 'Ese PIN ya lo usa alguien de tu equipo. Elige otro.' });
  }
  db.prepare('UPDATE businesses SET pin = ? WHERE id = ?').run(newPin, business.id);
  res.json({ ok: true });
});

// Crear, cambiar o quitar el PIN del personal (solo el dueño).
router.put('/:slug/staff-pin', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  const staffPin = req.body?.staffPin;
  if (staffPin === null || staffPin === '') {
    db.prepare('UPDATE businesses SET staff_pin = NULL WHERE id = ?').run(business.id);
    return res.json({ ok: true, hasStaffPin: false });
  }
  if (!isValidPin(staffPin)) return res.status(400).json({ error: 'El PIN del personal debe ser de 4 a 8 dígitos.' });
  if (String(staffPin) === business.pin) {
    return res.status(400).json({ error: 'El PIN del personal debe ser distinto al tuyo.' });
  }
  if (db.prepare('SELECT 1 FROM staff_members WHERE business_id = ? AND pin = ?').get(business.id, String(staffPin))) {
    return res.status(400).json({ error: 'Ese PIN ya lo usa alguien de tu equipo. Elige otro.' });
  }
  db.prepare('UPDATE businesses SET staff_pin = ? WHERE id = ?').run(String(staffPin), business.id);
  res.json({ ok: true, hasStaffPin: true });
});

// Info pública del negocio (la usa la vista del cliente, sin PIN)
// El dueño acepta los Términos (queda constancia: versión, fecha, nombre de quien acepta e IP).
router.post('/:slug/accept-terms', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business, { allowExpired: true })) return;
  const name = String(req.body?.name || '').trim().slice(0, 80);
  if (req.body?.accept !== true) return res.status(400).json({ error: 'Para continuar necesitas aceptar los Términos.' });
  if (name.length < 3) return res.status(400).json({ error: 'Escribe el nombre completo de quien acepta.' });
  if (req.body?.version && req.body.version !== TERMS_VERSION) return res.status(409).json({ error: 'Los Términos se actualizaron. Recarga la página para leer la versión nueva.' });
  db.prepare('UPDATE businesses SET terms_version = ?, terms_accepted_at = ?, terms_accepted_by = ?, terms_ip = ? WHERE id = ?')
    .run(TERMS_VERSION, new Date().toISOString(), name, String(req.ip || '').slice(0, 64), business.id);
  if (!business.owner_name) db.prepare('UPDATE businesses SET owner_name = ? WHERE id = ?').run(name, business.id);
  res.json(termsInfo(db.prepare('SELECT * FROM businesses WHERE id = ?').get(business.id)));
});

// Datos legales del negocio para su aviso de privacidad (solo el dueño).
router.put('/:slug/legal', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business, { allowExpired: true })) return;
  const err = applyLegal(business.id, req.body || {});
  if (err) return res.status(400).json({ error: err });
  res.json(businessToJSON(db.prepare('SELECT * FROM businesses WHERE id = ?').get(business.id)));
});

router.get('/:slug', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  res.json(businessToJSON(business));
});

// Actualizar configuración (requiere PIN)
router.put('/:slug', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;

  let { rewardDesc, stampsGoal, pointsGoal, pointsPerVisit, color, products, stampIcon, cardTitle, cardStyle } = req.body || {};
  // Ubicación y opiniones: en todos los planes.
  const b0 = req.body || {};
  const cleanUrl = v => {
    const t = String(v || '').trim();
    if (!t) return '';
    let u; try { u = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t); } catch (e) { return null; }
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.toString().slice(0, 500) : null;
  };
  const mapsUrl = b0.mapsUrl != null ? cleanUrl(b0.mapsUrl) : undefined;
  const reviewUrl = b0.reviewUrl != null ? cleanUrl(b0.reviewUrl) : undefined;
  if (mapsUrl === null) return res.status(400).json({ error: 'La liga de tu ubicación no es válida. Cópiala desde Google Maps (Compartir → Copiar vínculo).' });
  if (reviewUrl === null) return res.status(400).json({ error: 'La liga para reseñas no es válida.' });
  if ((b0.feedbackOn != null && typeof b0.feedbackOn !== 'boolean') || (b0.feedbackReward != null && typeof b0.feedbackReward !== 'boolean')) {
    return res.status(400).json({ error: 'Falta indicar si se enciende o no.' });
  }
  if (mapsUrl !== undefined || reviewUrl !== undefined || b0.feedbackOn != null || b0.feedbackReward != null) {
    db.prepare(`UPDATE businesses SET
      maps_url = CASE WHEN @m IS NULL THEN maps_url ELSE NULLIF(@m, '') END,
      review_url = CASE WHEN @r IS NULL THEN review_url ELSE NULLIF(@r, '') END,
      feedback_on = COALESCE(@fo, feedback_on),
      feedback_reward = COALESCE(@fr, feedback_reward) WHERE id = @id`).run({
      m: mapsUrl === undefined ? null : mapsUrl, r: reviewUrl === undefined ? null : reviewUrl,
      fo: b0.feedbackOn == null ? null : (b0.feedbackOn ? 1 : 0), fr: b0.feedbackReward == null ? null : (b0.feedbackReward ? 1 : 0), id: business.id
    });
  }
  const premium = isPremium(business);
  if (!premium && (products != null || stampIcon != null || cardTitle != null || cardStyle != null)) {
    return res.status(403).json({ error: PREMIUM_ONLY });
  }
  // En Esencial solo se eligen colores de la paleta. Si el negocio bajó de Premium,
  // puede conservar el color que ya tenía (y seguir guardando su premio y meta).
  const sameColor = String(color || '').toUpperCase() === String(business.color || '').toUpperCase();
  if (color != null && !premium && !sameColor && !BASE_COLORS.includes(String(color).toUpperCase())) {
    return res.status(403).json({ error: 'Los colores personalizados son del plan Premium.' });
  }
  if (products != null && !Array.isArray(products)) return res.status(400).json({ error: 'Lista de productos inválida.' });
  if (stampIcon != null && !STAMP_ICON_IDS.includes(stampIcon)) return res.status(400).json({ error: 'Ícono inválido.' });
  if (cardStyle != null && !CARD_STYLES.includes(cardStyle)) return res.status(400).json({ error: 'Estilo inválido.' });
  if (rewardDesc != null && !String(rewardDesc).trim()) return res.status(400).json({ error: 'El premio no puede quedar vacío.' });
  if (color != null && !HEX_COLOR.test(color)) return res.status(400).json({ error: 'Color inválido.' });
  if (business.mechanic === 'sellos' && stampsGoal != null && !(Number(stampsGoal) >= 2 && Number(stampsGoal) <= 30)) {
    return res.status(400).json({ error: 'Los sellos para el premio deben ser entre 2 y 30.' });
  }
  if (business.mechanic === 'puntos' && ((pointsGoal != null && !(Number(pointsGoal) >= 1)) || (pointsPerVisit != null && !(Number(pointsPerVisit) >= 1)))) {
    return res.status(400).json({ error: 'Los puntos deben ser 1 o más.' });
  }

  // Monedero: % que regresa y saldo de regalo
  let walletPct = null;
  if (isWallet(business)) {
    if (req.body?.walletPct != null) {
      walletPct = Math.round(Number(req.body.walletPct));
      if (!(walletPct >= 1 && walletPct <= 30)) return res.status(400).json({ error: 'El porcentaje del monedero debe ser de 1% a 30%.' });
    }
    if (req.body?.walletBonus != null) {
      const bonus = Math.round(Number(req.body.walletBonus));
      if (!(bonus >= 1 && bonus <= 5000)) return res.status(400).json({ error: 'El saldo de regalo debe ser de $1 a $5,000.' });
      pointsPerVisit = bonus;
    }
    pointsGoal = null;
  }
  // Premios a elegir (Premium, sellos o puntos). Se valida con la meta que quedará guardada.
  let rewardsJson = null;
  if (req.body?.rewards != null) {
    if (!premium) return res.status(403).json({ error: PREMIUM_ONLY });
    if (isWallet(business)) return res.status(400).json({ error: 'El Monedero no usa menú de premios: el saldo se usa como dinero.' });
    const goalAfter = business.mechanic === 'sellos'
      ? (stampsGoal != null ? Math.round(Number(stampsGoal)) : business.stamps_goal)
      : (pointsGoal != null ? Math.round(Number(pointsGoal)) : business.points_goal);
    const clean = require('../rewards').cleanRewards(req.body.rewards, { ...business, stamps_goal: goalAfter, points_goal: goalAfter });
    if (clean.error) return res.status(400).json({ error: clean.error });
    rewardsJson = JSON.stringify(clean.rewards);
  }
  const isSellos = business.mechanic === 'sellos';
  if (rewardsJson != null) db.prepare('UPDATE businesses SET rewards = ? WHERE id = ?').run(rewardsJson, business.id);
  db.prepare(`
    UPDATE businesses SET
      wallet_pct = COALESCE(@walletPct, wallet_pct),
      reward_desc = COALESCE(@rewardDesc, reward_desc),
      stamps_goal = COALESCE(@stampsGoal, stamps_goal),
      points_goal = COALESCE(@pointsGoal, points_goal),
      points_per_visit = COALESCE(@pointsPerVisit, points_per_visit),
      color = COALESCE(@color, color),
      products = COALESCE(@products, products),
      stamp_icon = COALESCE(@stampIcon, stamp_icon),
      card_title = CASE WHEN @cardTitle IS NULL THEN card_title ELSE NULLIF(@cardTitle, '') END,
      card_style = COALESCE(@cardStyle, card_style)
    WHERE id = @id
  `).run({
    id: business.id, walletPct,
    rewardDesc: rewardDesc != null ? String(rewardDesc).trim().slice(0, 60) : null,
    stampsGoal: isSellos && stampsGoal != null ? Math.round(Number(stampsGoal)) : null,
    pointsGoal: !isSellos && pointsGoal != null ? Math.round(Number(pointsGoal)) : null,
    pointsPerVisit: !isSellos && pointsPerVisit != null ? Math.round(Number(pointsPerVisit)) : null,
    color: color != null ? String(color).toUpperCase() : null,
    products: products != null ? JSON.stringify(cleanList(products, 12, 30)) : null,
    stampIcon: stampIcon ?? null,
    cardTitle: cardTitle != null ? String(cardTitle).trim().slice(0, 24) : null,
    cardStyle: cardStyle ?? null
  });

  const updated = db.prepare('SELECT * FROM businesses WHERE id = ?').get(business.id);
  gwallet.syncBusiness(business.id);   // premio, meta, color o nombre nuevos también en Google Wallet
  res.json(businessToJSON(updated));
});

// ---------- Tu equipo: cada empleado con su propio PIN (solo el dueño) ----------
function getBiz(req) { return db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug)); }
function memberJSON(m) { return { id: m.id, name: m.name, active: Boolean(m.active), createdAt: m.created_at, lastSeenAt: m.last_seen_at || null }; }
function teamJSON(business) {
  const members = db.prepare('SELECT * FROM staff_members WHERE business_id = ? ORDER BY active DESC, name COLLATE NOCASE').all(business.id);
  return {
    members: members.map(memberJSON),
    hasStaffPin: Boolean(business.staff_pin),
    stampCooldownOn: Boolean(business.stamp_cooldown_on),
    stampCooldownMin: business.stamp_cooldown_min || 120,
    strictMode: strictActive(business),
    strictAvailable: isPremium(business),
    cooldownOptions: sec.COOLDOWN_OPTIONS
  };
}
function cleanName(v) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, 40); }

router.get('/:slug/team', (req, res) => {
  const business = getBiz(req);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  res.json(teamJSON(business));
});

router.post('/:slug/team', (req, res) => {
  const business = getBiz(req);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  const name = cleanName(req.body?.name);
  const pin = String(req.body?.pin || '');
  if (name.length < 2) return res.status(400).json({ error: 'Escribe el nombre de la persona.' });
  if (!isValidPin(pin)) return res.status(400).json({ error: 'Su PIN debe ser de 4 a 8 dígitos.' });
  const taken = pinTaken(business, pin);
  if (taken) return res.status(400).json({ error: taken });
  if (db.prepare('SELECT COUNT(*) AS n FROM staff_members WHERE business_id = ?').get(business.id).n >= 40) {
    return res.status(400).json({ error: 'Llegaste al máximo de 40 personas. Quita a quien ya no trabaje contigo.' });
  }
  if (db.prepare('SELECT 1 FROM staff_members WHERE business_id = ? AND lower(name) = lower(?)').get(business.id, name)) {
    return res.status(400).json({ error: 'Ya tienes a alguien con ese nombre. Agrégale su apellido o un apodo.' });
  }
  db.prepare('INSERT INTO staff_members (business_id, name, pin, active, created_at) VALUES (?, ?, ?, 1, ?)').run(business.id, name, pin, new Date().toISOString());
  res.status(201).json(teamJSON(business));
});

router.put('/:slug/team/:id', (req, res) => {
  const business = getBiz(req);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  const m = db.prepare('SELECT * FROM staff_members WHERE id = ? AND business_id = ?').get(Number(req.params.id), business.id);
  if (!m) return res.status(404).json({ error: 'Esa persona ya no está en tu equipo.' });
  const name = req.body?.name != null ? cleanName(req.body.name) : m.name;
  if (name.length < 2) return res.status(400).json({ error: 'Escribe el nombre de la persona.' });
  let pin = m.pin;
  if (req.body?.pin != null && req.body.pin !== '') {
    pin = String(req.body.pin);
    if (!isValidPin(pin)) return res.status(400).json({ error: 'Su PIN debe ser de 4 a 8 dígitos.' });
    const taken = pinTaken(business, pin, m.id);
    if (taken) return res.status(400).json({ error: taken });
  }
  const active = typeof req.body?.active === 'boolean' ? (req.body.active ? 1 : 0) : m.active;
  if (active && !m.active) {
    const taken = pinTaken(business, pin, m.id);
    if (taken) return res.status(400).json({ error: taken + ' Cámbiale el PIN para volver a activarla.' });
  }
  db.prepare('UPDATE staff_members SET name = ?, pin = ?, active = ? WHERE id = ?').run(name, pin, active, m.id);
  res.json(teamJSON(business));
});

router.delete('/:slug/team/:id', (req, res) => {
  const business = getBiz(req);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  // El historial conserva su nombre: los sellos que dio siguen diciendo quién fue.
  db.prepare('DELETE FROM staff_members WHERE id = ? AND business_id = ?').run(Number(req.params.id), business.id);
  res.json(teamJSON(business));
});

// Tiempo mínimo entre sellos del mismo cliente y modo estricto (solo el dueño).
router.put('/:slug/security', (req, res) => {
  const business = getBiz(req);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  const b = req.body || {};
  if (b.stampCooldownMin != null && !sec.COOLDOWN_OPTIONS.includes(Number(b.stampCooldownMin))) {
    return res.status(400).json({ error: 'Elige uno de los tiempos de la lista.' });
  }
  if (b.strictMode != null && typeof b.strictMode !== 'boolean') return res.status(400).json({ error: 'Falta indicar si se enciende o no.' });
  if (b.stampCooldownOn != null && typeof b.stampCooldownOn !== 'boolean') return res.status(400).json({ error: 'Falta indicar si se enciende o no.' });
  if (b.strictMode === true && !isPremium(business)) return res.status(403).json({ error: 'El código que cambia (modo estricto) es del plan Premium.' });
  const bool = v => v == null ? null : (v ? 1 : 0);
  db.prepare(`UPDATE businesses SET
    stamp_cooldown_min = COALESCE(?, stamp_cooldown_min),
    stamp_cooldown_on = COALESCE(?, stamp_cooldown_on),
    strict_mode = COALESCE(?, strict_mode) WHERE id = ?`)
    .run(b.stampCooldownMin != null ? Number(b.stampCooldownMin) : null, bool(b.stampCooldownOn), bool(b.strictMode), business.id);
  const updated = getBiz(req);
  res.json({ ...teamJSON(updated), business: businessToJSON(updated) });
});

// ---------- Mi membresía: precio, vigencia, cómo pagar y avisar "ya pagué" (solo el dueño, aunque esté en pausa) ----------
function membershipJSON(business) {
  const pr = pricing.priceFor(business);
  const pub = pricing.publicPricing();
  const report = db.prepare("SELECT * FROM payment_reports WHERE business_id = ? ORDER BY id DESC LIMIT 1").get(business.id);
  const payments = db.prepare('SELECT folio, amount, method, months, paid_at, covers_to FROM payments WHERE business_id = ? ORDER BY paid_at DESC, id DESC LIMIT 6').all(business.id);
  return {
    plan: business.plan || 'esencial', price: pr.amount, priceSource: pr.source, tierName: pr.tier || null, tierLabel: pr.label || null,
    regular: pub.regular[business.plan === 'premium' ? 'premium' : 'esencial'], spotsLeft: pr.source === 'current' ? pub.spotsLeft : null,
    spots: pr.source === 'current' ? pub.spots : null,
    premiumPrice: business.plan === 'premium' || pr.source === 'custom' ? null : pricing.priceFor({ ...business, plan: 'premium' }).amount,
    plans: pr.source === 'custom' ? null : {
      esencial: { price: pricing.priceFor({ ...business, plan: 'esencial' }).amount, regular: pub.regular.esencial },
      premium: { price: pricing.priceFor({ ...business, plan: 'premium' }).amount, regular: pub.regular.premium }
    },
    access: accessInfo(business), payInfo: pricing.payInfo(), isDemo: Boolean(business.is_demo),
    lastReport: report ? { method: report.method, amount: report.amount, months: report.months, plan: report.plan || null, status: report.status, rejectReason: report.reject_reason || '', createdAt: report.created_at } : null,
    payments: payments.map(p => ({ folio: p.folio, amount: p.amount, method: p.method, months: p.months, paidAt: p.paid_at, coversTo: p.covers_to }))
  };
}
router.get('/:slug/membership', (req, res) => {
  const business = getBiz(req);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business, { allowExpired: true })) return;
  res.json(membershipJSON(business));
});
router.post('/:slug/payment-report', (req, res) => {
  const business = getBiz(req);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business, { allowExpired: true })) return;
  if (business.is_demo) return res.status(400).json({ error: 'En la demo no se paga. Pide que activemos tu tarjeta.' });
  const method = ['Transferencia', 'Depósito', 'Efectivo'].includes(req.body?.method) ? req.body.method : null;
  if (!method) return res.status(400).json({ error: 'Elige cómo pagaste.' });
  const months = Number(req.body?.months) === 12 ? 12 : 1;
  if (db.prepare("SELECT COUNT(*) AS n FROM payment_reports WHERE business_id = ? AND status = 'pendiente'").get(business.id).n >= 3) {
    return res.status(429).json({ error: 'Ya tienes avisos por confirmar. P.A.E. los revisa pronto.' });
  }
  const custom = pricing.priceFor(business).source === 'custom';
  const plan = !custom && ['esencial', 'premium'].includes(req.body?.plan) ? req.body.plan : (business.plan || 'esencial');
  const price = pricing.priceFor({ ...business, plan }).amount;
  const amount = months === 12 ? price * 10 : price;
  const reference = String(req.body?.reference || '').trim().slice(0, 60) || null;
  const note = String(req.body?.note || '').trim().slice(0, 200) || null;
  db.prepare("INSERT INTO payment_reports (business_id, method, months, amount, reference, note, status, created_at, plan) VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)")
    .run(business.id, method, months, amount, reference, note, new Date().toISOString(), plan);
  res.status(201).json(membershipJSON(business));
});

// Opiniones de los clientes (solo el dueño).
router.get('/:slug/feedback', (req, res) => {
  const business = getBiz(req);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  const stats = db.prepare('SELECT COUNT(*) AS n, AVG(stars) AS avg FROM feedback WHERE business_id = ?').get(business.id);
  const dist = [1, 2, 3, 4, 5].map(s => db.prepare('SELECT COUNT(*) AS n FROM feedback WHERE business_id = ? AND stars = ?').get(business.id, s).n);
  const items = db.prepare(`SELECT f.stars, f.comment, f.created_at, f.rewarded, c.name, c.phone FROM feedback f JOIN customers c ON c.id = f.customer_id
    WHERE f.business_id = ? ORDER BY f.id DESC LIMIT 100`).all(business.id);
  res.json({ count: stats.n, avg: stats.avg ? Math.round(stats.avg * 10) / 10 : null, dist,
    items: items.map(i => ({ stars: i.stars, comment: i.comment || '', at: i.created_at, rewarded: Boolean(i.rewarded), name: i.name || '', phone: i.phone })) });
});

// Actividad del equipo y alertas (solo el dueño).
router.get('/:slug/security', (req, res) => {
  const business = getBiz(req);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  res.json(sec.securityReport(business, req.query.days));
});

// ---------- Logo del negocio (plan Premium) ----------
const LOGO_TYPES = { 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/webp': [0x52, 0x49, 0x46, 0x46] };

router.put('/:slug/logo', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  if (!isPremium(business)) return res.status(403).json({ error: 'El logo propio es del plan Premium.' });

  const m = String(req.body?.image || '').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return res.status(400).json({ error: 'Sube una imagen PNG, JPG o WEBP.' });
  const bytes = Buffer.from(m[2], 'base64');
  const magic = LOGO_TYPES[m[1]];
  if (!magic.every((b, i) => bytes[i] === b)) return res.status(400).json({ error: 'El archivo no es una imagen válida.' });
  if (bytes.length > 200 * 1024) return res.status(400).json({ error: 'La imagen es muy pesada (máximo 200 KB).' });

  db.prepare('UPDATE businesses SET logo = ?, logo_version = logo_version + 1 WHERE id = ?')
    .run(`${m[1]};${m[2]}`, business.id);
  gwallet.syncBusiness(business.id);
  res.json(businessToJSON(db.prepare('SELECT * FROM businesses WHERE id = ?').get(business.id)));
});

router.delete('/:slug/logo', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  db.prepare('UPDATE businesses SET logo = NULL, logo_version = logo_version + 1 WHERE id = ?').run(business.id);
  gwallet.syncBusiness(business.id);
  res.json(businessToJSON(db.prepare('SELECT * FROM businesses WHERE id = ?').get(business.id)));
});

router.get('/:slug/logo', (req, res) => {
  const business = db.prepare('SELECT logo, plan FROM businesses WHERE slug = ?').get(slugify(req.params.slug));
  if (!business || !business.logo || !isPremium(business)) return res.status(404).end();
  const [type, data] = business.logo.split(';');
  res.set('Content-Type', type);
  res.set('Cache-Control', 'public, max-age=31536000, immutable'); // la liga cambia (?v=) cada vez que se sube otro logo
  res.send(Buffer.from(data, 'base64'));
});

module.exports = { router, requirePin, requireOwner, adminRequired, safeEqual, applyLegal, generateUniqueSlug };
