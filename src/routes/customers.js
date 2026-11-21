const express = require('express');
const db = require('../db');
const {
  slugify, normalizePhone, goalFor, customerToJSON, customerPrivateJSON,
  customerPublicJSON, customerStaffJSON, customerSelfJSON, newCardToken, parseBirthday, birthdayText,
  isBlocked, recordFailure, clearFailures,
  overLimit, parseList, cleanList, isEmail, isPremium, strictActive, isWallet, walletAmount
} = require('../utils');
const { requirePin, requireOwner, safeEqual } = require('./businesses');
const { TERMS_VERSION } = require('../legal');
const gwallet = require('../services/googleWallet');
const { parsePromos, globalDoubles, personalDoubles, nowMx, REASON_LABELS } = require('../promos');
const sec = require('../security');
const { isValidPhone, PHONE_ERROR } = require('../phones');
const visits = require('../visits');
const { lastVisit, unitFor, giveBonus, welcomeBonus } = visits;
const { rewardMenu } = require('../rewards');
const { cleanSource, sourceText } = require('../sources');

// Favoritos: solo Premium, máximo 5. Si el negocio tiene su lista de productos, solo se aceptan de esa lista.
function cleanFavorites(business, raw) {
  let favorites = isPremium(business) ? cleanList(raw, 5, 30) : [];
  const products = parseList(business.products);
  if (products.length) {
    const allowed = new Map(products.map(p => [p.toLowerCase(), p]));
    favorites = favorites.map(f => allowed.get(f.toLowerCase())).filter(Boolean);
  }
  return favorites;
}

// Lo que ve el propio cliente. En modo estricto también recibe la clave para generar su código de un uso.
function selfOut(business, customer) {
  const out = customerSelfJSON(customer);
  // Su última opinión (para mostrar "¡Gracias!" en lugar del formulario) y si ya recibió su sello por opinar.
  const fb = db.prepare('SELECT stars, created_at FROM feedback WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(customer.id);
  out.feedback = fb ? { stars: fb.stars, at: fb.created_at, rewarded: Boolean(db.prepare('SELECT 1 FROM feedback WHERE customer_id = ? AND rewarded = 1').get(customer.id)) } : null;
  if (strictActive(business) && customer.status !== 'pending') out.qrSecret = sec.ensureQrSecret(customer);
  return visits.withExtras(business, customer, out);
}

// Quién hizo el movimiento y cómo, para guardarlo en el historial.
function actorCols(req) {
  const a = req.actor || {};
  return { actor_type: a.type || null, actor_id: a.id || null, actor_name: a.type === 'member' ? a.name : null };
}

// Modo estricto: el personal necesita el código que muestra la tarjeta del cliente (cambia cada 30 s y sirve una vez).
// El dueño puede hacerlo sin código (queda registrado como "a mano").
// Devuelve { method } si se puede continuar, o responde el error y devuelve null.
function checkAccess(req, res, business, customer, role, action) {
  const code = String(req.body?.code || '').replace(/\D/g, '');
  if (code && (strictActive(business) || customer.qr_secret)) {
    const fresh = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id);
    const check = sec.verifyCode(fresh, code, action);
    if (check.ok) return { method: 'code', check };
    if (strictActive(business) && role !== 'owner') {
      sec.logEvent(business, req.actor, 'bad_code', customer, check.reason);
      res.status(400).json({ code: 'bad_code', error: check.reason === 'used'
        ? 'Ese código ya se usó. Pide al cliente que te muestre el código nuevo de su tarjeta.'
        : 'Ese código ya no es válido. Pide al cliente que abra su tarjeta y te muestre el código de ahorita.' });
      return null;
    }
  }
  if (strictActive(business) && role !== 'owner') {
    sec.logEvent(business, req.actor, 'strict', customer, action);
    res.status(403).json({ code: 'strict', error: 'Modo estricto: escanea la tarjeta del cliente o escribe los 6 números que aparecen en ella. Las capturas de pantalla y la tarjeta de Wallet no sirven para esto.' });
    return null;
  }
  return { method: req.body?.method === 'scan' ? 'scan' : 'manual' };
}



// El dueño ve todo; el personal ve avance y liga de la tarjeta, sin correo ni favoritos.
// En modo estricto el personal no recibe la liga privada de la tarjeta (con ella podría generar el código del cliente).
function forRole(role, business, row, ctx) {
  let out;
  if (role === 'owner') out = customerPrivateJSON(row);
  else {
    out = customerStaffJSON(row);
    if (business && strictActive(business)) out.cardToken = '';
  }
  // Nivel y recordatorio (Premium). En listas llega "ctx" ya preparado para no consultar fila por fila.
  return ctx ? ctx.apply(row, out) : visits.withExtras(business, row, out);
}

const router = express.Router({ mergeParams: true });

// Google Wallet: después de cualquier cambio que salió bien (sello, canje, deshacer, regalo, corrección),
// se actualiza la tarjeta guardada del cliente y, si aplica, la de quien lo invitó. Corre en segundo plano.
router.use((req, res, next) => {
  if (req.method === 'GET' || !gwallet.isGoogleConfigured()) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    try {
      const business = getBusiness(req.params.slug);
      if (!business) return;
      const first = normalizePhone(String(req.path).split('/')[1] || '');
      const phones = [first, normalizePhone(req.body?.phone || '')].filter(p => isValidPhone(p));
      for (const phone of new Set(phones)) {
        const c = db.prepare('SELECT id, referred_by FROM customers WHERE business_id = ? AND phone = ?').get(business.id, phone);
        if (!c) continue;
        gwallet.syncCustomer(c.id);
        if (c.referred_by) {
          const ref = db.prepare('SELECT id FROM customers WHERE business_id = ? AND phone = ?').get(business.id, c.referred_by);
          if (ref) gwallet.syncCustomer(ref.id);
        }
      }
    } catch (e) { console.error('[Google Wallet]', e.message); }
  });
  next();
});

const WITH_GIVEN = `
  SELECT c.*, (
    SELECT COALESCE(SUM(h.amount), 0) FROM history h
    WHERE h.customer_id = c.id AND h.type = 'add'
  ) AS given, (
    SELECT COUNT(*) FROM history h
    WHERE h.customer_id = c.id AND h.type = 'add' AND h.reason IS NULL
  ) AS visits
  FROM customers c
`;

function getBusiness(slug) {
  return db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slugify(slug));
}

function getCustomer(businessId, phone) {
  return db.prepare(`${WITH_GIVEN} WHERE c.business_id = ? AND c.phone = ?`).get(businessId, phone);
}

// Listar todos los clientes del negocio (requiere PIN)
router.get('/', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const role = requirePin(req, res, business);
  if (!role) return;

  const rows = db.prepare(`${WITH_GIVEN} WHERE c.business_id = ? ORDER BY c.created_at DESC`).all(business.id);
  const ctx = visits.extrasContext(business);
  res.json(rows.map(r => forRole(role, business, r, ctx)));
});

// Descargar la base de clientes en CSV (se abre en Excel o Google Sheets). Requiere PIN.
function csvCell(value) {
  let t = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // evita que Excel ejecute fórmulas escondidas en un dato
  return '"' + t.replace(/"/g, '""') + '"';
}
router.get('/export.csv', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  // Aunque el periodo haya terminado, el dueño siempre puede descargar la información de sus clientes.
  if (!requireOwner(req, res, business, { allowExpired: true })) return;

  const unit = isWallet(business) ? 'Saldo ($)' : business.mechanic === 'sellos' ? 'Sellos' : 'Puntos';
  const rows = db.prepare(`${WITH_GIVEN} WHERE c.business_id = ? ORDER BY c.created_at ASC`).all(business.id);
  const header = ['Nombre', 'Teléfono', 'Correo', 'Cumpleaños', 'Productos favoritos', 'Acepta promociones', 'Estado',
    `${unit} actuales`, `${unit} dados en total`, 'Premios canjeados', 'Fecha de registro', 'Cómo nos conoció'];
  const lines = [header.map(csvCell).join(',')];
  for (const c of rows) {
    lines.push([
      c.name, c.phone, c.email || '', birthdayText(c.birthday), parseList(c.favorites).join(' / '),
      c.marketing_opt_in ? 'Sí' : 'No', c.status === 'pending' ? 'Solicitud pendiente' : 'Activo',
      c.progress, c.given, c.redemptions, String(c.created_at || '').slice(0, 10), sourceText(c.source, c.source_detail)
    ].map(csvCell).join(','));
  }
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="clientes-${business.slug}.csv"`);
  res.send('\uFEFF' + lines.join('\r\n'));
});

// Ver la tarjeta de un cliente (vista "Ver mi tarjeta").
// Con la clave de su liga (x-card-token) ve su avance completo.
// Sin la clave, solo se confirma que la tarjeta existe y su primer nombre: nadie más ve sus sellos.
router.get('/:phone', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const token = req.header('x-card-token');
  if (!token && overLimit(req, 'lookup', 60, 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Demasiadas búsquedas desde esta conexión. Intenta más tarde.' });
  }
  const customer = getCustomer(business.id, normalizePhone(req.params.phone));
  if (!customer) return res.status(404).json({ error: 'no_card' });
  if (token && customer.card_token && safeEqual(token, customer.card_token)) {
    const out = selfOut(business, customer);
    if (isPremium(business)) out.promoForYou = personalDoubles(parsePromos(business.promos), customer, lastVisit(customer.id));
    return res.json(out);
  }
  res.json(customerPublicJSON(customer));
});

// Dar de alta un cliente (requiere PIN)
router.post('/', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const role = requirePin(req, res, business);
  if (!role) return;

  const phone = normalizePhone(req.body?.phone);
  const name = String(req.body?.name || '').trim().slice(0, 40);
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!isValidPhone(phone)) return res.status(400).json({ error: PHONE_ERROR });
  if (email && !isEmail(email)) return res.status(400).json({ error: 'Ese correo no parece válido.' });
  const birthday = req.body?.birthday ? parseBirthday(req.body.birthday) : null;
  if (req.body?.birthday && !birthday) return res.status(400).json({ error: 'Esa fecha de cumpleaños no existe.' });

  const src = cleanSource(req.body?.source, req.body?.sourceDetail);
  const existing = getCustomer(business.id, phone);
  if (existing && existing.status === 'pending') {
    db.prepare(`UPDATE customers SET status = 'active', name = COALESCE(NULLIF(?, ''), name),
      email = COALESCE(NULLIF(?, ''), email) WHERE id = ?`).run(name, email, existing.id);
    const welcome = welcomeBonus(business, existing);
    return res.status(200).json({ ...forRole(role, business, getCustomer(business.id, phone)), bonus: welcome ? { amount: welcome, reasons: [isWallet(business) ? 'Saldo de bienvenida' : 'Sello de bienvenida'] } : null });
  }
  if (existing) return res.status(409).json({ error: 'Ese teléfono ya tiene una tarjeta.' });

  db.prepare(`
    INSERT INTO customers (business_id, phone, name, email, progress, redemptions, created_at, status, card_token, birthday, marketing_opt_in)
    VALUES (?, ?, ?, ?, 0, 0, ?, 'active', ?, ?, ?)
  `).run(business.id, phone, name, email || null, new Date().toISOString(), newCardToken(), birthday, req.body?.marketingOptIn === true ? 1 : 0);
  if (src) db.prepare('UPDATE customers SET source = ?, source_detail = ?, source_at = ? WHERE business_id = ? AND phone = ?')
    .run(src.source, src.detail, new Date().toISOString(), business.id, phone);
  const created = getCustomer(business.id, phone);
  const welcome = welcomeBonus(business, created);

  res.status(201).json({ ...forRole(role, business, getCustomer(business.id, phone)), bonus: welcome ? { amount: welcome, reasons: [isWallet(business) ? 'Saldo de bienvenida' : 'Sello de bienvenida'] } : null });
});

// El cliente pide su tarjeta desde su celular (pública). Queda pendiente hasta que el negocio la apruebe.
router.post('/request', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (overLimit(req, 'request', 40, 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes desde esta conexión. Intenta más tarde.' });
  }

  const phone = normalizePhone(req.body?.phone);
  const name = String(req.body?.name || '').trim().slice(0, 40);
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!isValidPhone(phone)) return res.status(400).json({ error: PHONE_ERROR });
  if (!name) return res.status(400).json({ error: 'Escribe tu nombre para que el negocio te reconozca.' });
  if (email && !isEmail(email)) return res.status(400).json({ error: 'Ese correo no parece válido. Revísalo o déjalo vacío.' });
  const birthday = parseBirthday(req.body?.birthday);
  if (!birthday) return res.status(400).json({ error: 'Elige el día y el mes de tu cumpleaños.' });
  if (req.body?.privacyAccepted !== true) return res.status(400).json({ error: 'Para crear tu tarjeta necesitas aceptar el aviso de privacidad.' });

  const favorites = cleanFavorites(business, req.body?.favorites);
  const src = cleanSource(req.body?.source, req.body?.sourceDetail);

  // Si ese teléfono ya tiene tarjeta, no se entrega su liga: así nadie puede "pedir" la tarjeta de otra persona.
  const existing = getCustomer(business.id, phone);
  if (existing) {
    return res.status(409).json({ code: 'exists', error: 'Ese teléfono ya tiene tarjeta en este negocio.', ...customerPublicJSON(existing) });
  }

  // Invita a un amigo: guardamos quién lo invitó (el sello se le da cuando este cliente haga su primera compra).
  let referredBy = normalizePhone(req.body?.referredBy);
  if (!(isPremium(business) && parsePromos(business.promos).referral.on && isValidPhone(referredBy) && referredBy !== phone)) referredBy = null;

  // Si llega con un código de compra válido, la compra demuestra que sí es cliente: su tarjeta queda activa al momento.
  const pcode = visits.normalizeCode(req.body?.purchaseCode);
  const prow = pcode ? db.prepare('SELECT * FROM purchase_codes WHERE code = ? AND business_id = ?').get(pcode, business.id) : null;
  const usable = prow && visits.codeStatus(prow) === 'ok';

  const token = newCardToken();
  db.prepare(`
    INSERT INTO customers (business_id, phone, name, email, favorites, marketing_opt_in, privacy_accepted_at,
      progress, redemptions, created_at, status, card_token, birthday, referred_by, privacy_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'pending', ?, ?, ?, ?)
  `).run(business.id, phone, name, email || null, JSON.stringify(favorites), req.body?.marketingOptIn === true ? 1 : 0,
    new Date().toISOString(), new Date().toISOString(), token, birthday, referredBy, TERMS_VERSION);
  if (src) db.prepare('UPDATE customers SET source = ?, source_detail = ?, source_at = ? WHERE business_id = ? AND phone = ?')
    .run(src.source, src.detail, new Date().toISOString(), business.id, phone);

  let purchase = null;
  if (usable) {
    const claim = visits.claimPurchase(business, getCustomer(business.id, phone), prow);
    if (claim.ok) {
      purchase = { amount: prow.amount, ticket: prow.ticket, levelUp: claim.result.levelUp, bonus: claim.result.reasons.length ? prow.amount : claim.result.levelBonus };
    }
  } else if (pcode) {
    purchase = { error: visits.CODE_ERRORS[visits.codeStatus(prow)] };
  }
  res.status(201).json({ ...selfOut(business, getCustomer(business.id, phone)), cardToken: token, purchase });
});

// Abrir la tarjeta desde cualquier celular con teléfono + cumpleaños (pública).
// Si coincide, se entrega la clave de su tarjeta para que ese celular la recuerde.
// Freno: 10 intentos fallidos por tarjeta cada 15 minutos, y 30 intentos por hora desde una conexión.
router.post('/:phone/unlock', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const phone = normalizePhone(req.params.phone);
  const key = `card:${business.slug}:${phone}`;
  if (isBlocked(req, key) || overLimit(req, 'unlock', 30, 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos o pide ayuda en caja.' });
  }
  const customer = getCustomer(business.id, phone);
  if (!customer) return res.status(404).json({ error: 'no_card' });
  if (!customer.birthday) {
    return res.status(400).json({ code: 'no_birthday', error: 'Tu tarjeta aún no tiene cumpleaños registrado. Pide en caja que lo agreguen o que te envíen tu tarjeta por WhatsApp.' });
  }
  const birthday = parseBirthday(req.body?.birthday);
  if (!birthday || birthday !== customer.birthday) {
    recordFailure(req, key);
    return res.status(401).json({ error: 'El cumpleaños no coincide con esta tarjeta.' });
  }
  clearFailures(req, key);
  res.json({ ...selfOut(business, customer), cardToken: customer.card_token });
});

// Guardar o corregir el cumpleaños: el negocio (con PIN) o el propio cliente (con la clave de su tarjeta).
router.put('/:phone/birthday', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const customer = getCustomer(business.id, normalizePhone(req.params.phone));
  const token = req.header('x-card-token');
  let role = null;
  if (token) {
    if (!customer || !customer.card_token || !safeEqual(token, customer.card_token)) return res.status(404).json({ error: 'No encontramos esa tarjeta.' });
  } else {
    role = requirePin(req, res, business);
    if (!role) return;
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado.' });
  }
  const birthday = parseBirthday(req.body?.birthday);
  if (!birthday) return res.status(400).json({ error: 'Elige un día y mes válidos.' });
  db.prepare('UPDATE customers SET birthday = ? WHERE id = ?').run(birthday, customer.id);
  const updated = getCustomer(business.id, customer.phone);
  if (role) return res.json(forRole(role, business, updated));
  res.json(selfOut(business, updated));
});

// "Conócenos": lo que el cliente contesta después de crear su tarjeta (con la clave de su tarjeta).
// Todo es opcional y se manda por partes: cómo nos conoció, quién lo invitó, sus favoritos y su correo.
router.put('/:phone/about', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (overLimit(req, 'about', 60, 60 * 60 * 1000)) return res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' });
  const customer = getCustomer(business.id, normalizePhone(req.params.phone));
  const token = req.header('x-card-token');
  if (!token || !customer || !customer.card_token || !safeEqual(token, customer.card_token)) return res.status(404).json({ error: 'No encontramos esa tarjeta.' });
  const b = req.body || {};
  const now = new Date().toISOString();

  if (b.source !== undefined) {
    const src = cleanSource(b.source, b.sourceDetail);
    if (!src) return res.status(400).json({ error: 'Elige una opción.' });
    db.prepare('UPDATE customers SET source = ?, source_detail = ?, source_at = ? WHERE id = ?').run(src.source, src.detail, now, customer.id);
  }
  // Quién lo invitó: solo si el negocio tiene "Invita a un amigo", aún no tiene a nadie y todavía no hace su primera compra
  // (el sello del amigo se da en esa primera compra).
  if (b.referredBy !== undefined && b.referredBy !== '') {
    const ref = normalizePhone(b.referredBy);
    if (!isValidPhone(ref) || ref === customer.phone) return res.status(400).json({ error: 'Revisa el número de quien te invitó.' });
    const canRefer = isPremium(business) && parsePromos(business.promos).referral.on && !customer.referred_by && !(Number(customer.given) > 0);
    if (canRefer) db.prepare('UPDATE customers SET referred_by = ? WHERE id = ?').run(ref, customer.id);
  }
  if (b.favorites !== undefined) {
    db.prepare('UPDATE customers SET favorites = ? WHERE id = ?').run(JSON.stringify(cleanFavorites(business, b.favorites)), customer.id);
  }
  if (b.email !== undefined && String(b.email).trim()) {
    const email = String(b.email).trim().toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ error: 'Ese correo no parece válido.' });
    db.prepare('UPDATE customers SET email = ? WHERE id = ?').run(email, customer.id);
  }
  if (b.marketingOptIn === true) db.prepare('UPDATE customers SET marketing_opt_in = 1 WHERE id = ?').run(customer.id);
  res.json(selfOut(business, getCustomer(business.id, customer.phone)));
});

// Recibir o no promociones: el propio cliente (con la clave de su tarjeta) o el dueño del negocio.
// Apagarlo es la "lista de exclusión": el negocio ya no lo verá en las listas para enviar promociones.
router.put('/:phone/marketing', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const customer = getCustomer(business.id, normalizePhone(req.params.phone));
  const token = req.header('x-card-token');
  let role = null;
  if (token) {
    if (!customer || !customer.card_token || !safeEqual(token, customer.card_token)) return res.status(404).json({ error: 'No encontramos esa tarjeta.' });
  } else {
    role = requireOwner(req, res, business, { allowExpired: true });
    if (!role) return;
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado.' });
  }
  if (typeof req.body?.optIn !== 'boolean') return res.status(400).json({ error: 'Falta indicar si sí o no.' });
  db.prepare('UPDATE customers SET marketing_opt_in = ? WHERE id = ?').run(req.body.optIn ? 1 : 0, customer.id);
  if (!req.body.optIn) db.prepare('DELETE FROM push_subs WHERE customer_id = ?').run(customer.id);   // sin promociones, tampoco avisos al celular
  const updated = getCustomer(business.id, customer.phone);
  res.json(role ? forRole(role, business, updated) : selfOut(business, updated));
});

// El cliente califica al negocio desde su tarjeta (con la clave de su tarjeta).
// Máximo una opinión cada 7 días. Si el negocio lo activó, su primera opinión le regala 1 sello (una sola vez).
router.post('/:phone/feedback', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (overLimit(req, 'feedback', 30, 60 * 60 * 1000)) return res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' });
  const customer = getCustomer(business.id, normalizePhone(req.params.phone));
  const token = req.header('x-card-token');
  if (!customer || !token || !customer.card_token || !safeEqual(token, customer.card_token)) return res.status(404).json({ error: 'No encontramos esa tarjeta.' });
  if (!business.feedback_on) return res.status(400).json({ error: 'Este negocio no está recibiendo opiniones por ahora.' });
  if (customer.status === 'pending') return res.status(400).json({ error: 'Podrás calificar cuando aprueben tu tarjeta.' });
  const stars = Math.round(Number(req.body?.stars));
  if (!(stars >= 1 && stars <= 5)) return res.status(400).json({ error: 'Elige de 1 a 5 estrellas.' });
  const comment = String(req.body?.comment || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  const last = db.prepare('SELECT created_at FROM feedback WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(customer.id);
  if (last && Date.now() - new Date(last.created_at).getTime() < 7 * 86400000) {
    return res.status(429).json({ error: 'Ya nos diste tu opinión esta semana. ¡Gracias!' });
  }
  const already = db.prepare('SELECT 1 FROM feedback WHERE customer_id = ? AND rewarded = 1').get(customer.id);
  const reward = business.feedback_reward && !already ? unitFor(business) : 0;
  db.transaction(() => {
    db.prepare('INSERT INTO feedback (business_id, customer_id, stars, comment, rewarded, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(business.id, customer.id, stars, comment || null, reward ? 1 : 0, new Date().toISOString());
    if (reward) giveBonus(customer.id, reward, 'opinion');
  })();
  res.json({ ...selfOut(business, getCustomer(business.id, customer.phone)), reward });
});

// Historial de visitas de un cliente: fecha y hora de cada sello o canje, y lo que compró (requiere PIN)
router.get('/:phone/history', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requirePin(req, res, business)) return;
  const customer = getCustomer(business.id, normalizePhone(req.params.phone));
  if (!customer) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const rows = db.prepare('SELECT id, type, amount, products, created_at, reason, parent_id, actor_type, actor_name, method, forced, ticket, reward_name FROM history WHERE customer_id = ? ORDER BY id DESC LIMIT 50')
    .all(customer.id);
  res.json(rows.map(r => ({ id: r.id, linked: Boolean(r.parent_id), type: r.type, amount: r.amount, products: parseList(r.products), at: r.created_at, reason: r.reason || null, reasonLabel: r.reason ? (REASON_LABELS[r.reason] || r.reason) : null,
    by: r.actor_type ? (r.actor_type === 'owner' ? 'Dueño' : r.actor_type === 'member' ? (r.actor_name || 'Empleado') : 'Personal') : null,
    method: r.method || null, forced: Boolean(r.forced), ticket: r.ticket || null, rewardName: r.reward_name || null })));
});

// Aprobar una solicitud (requiere PIN)
router.post('/:phone/approve', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const role = requirePin(req, res, business);
  if (!role) return;

  const customer = getCustomer(business.id, normalizePhone(req.params.phone));
  if (!customer) return res.status(404).json({ error: 'Esa solicitud ya no existe.' });
  db.prepare("UPDATE customers SET status = 'active' WHERE id = ?").run(customer.id);
  const welcome = welcomeBonus(business, customer);
  res.json({ ...forRole(role, business, getCustomer(business.id, customer.phone)), bonus: welcome ? { amount: welcome, reasons: [isWallet(business) ? 'Saldo de bienvenida' : 'Sello de bienvenida'] } : null });
});

// Rechazar una solicitud pendiente (PIN del dueño o del personal),
// o eliminar a un cliente activo con todo su historial (solo el dueño; por ejemplo, si el cliente pide borrar sus datos).
router.delete('/:phone', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const role = requirePin(req, res, business);
  if (!role) return;

  const customer = getCustomer(business.id, normalizePhone(req.params.phone));
  if (!customer) return res.status(404).json({ error: 'Ese cliente ya no existe.' });
  if (customer.status !== 'pending' && role !== 'owner') return res.status(403).json({ error: 'Solo el dueño puede eliminar clientes.' });
  gwallet.deactivateCustomer(business, customer);
  db.transaction(() => {
    db.prepare('DELETE FROM history WHERE customer_id = ?').run(customer.id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(customer.id);
  })();
  res.json({ ok: true });
});

// Corregir los datos de un cliente (solo el dueño): nombre, teléfono y correo.
router.put('/:phone', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  if (!requireOwner(req, res, business)) return;
  const customer = getCustomer(business.id, normalizePhone(req.params.phone));
  if (!customer) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const name = req.body?.name != null ? String(req.body.name).trim().slice(0, 40) : customer.name;
  const email = req.body?.email != null ? String(req.body.email).trim().toLowerCase().slice(0, 120) : (customer.email || '');
  const phone = req.body?.phone != null ? normalizePhone(req.body.phone) : customer.phone;
  if (!isValidPhone(phone)) return res.status(400).json({ error: PHONE_ERROR });
  if (email && !isEmail(email)) return res.status(400).json({ error: 'Ese correo no parece válido.' });
  if (phone !== customer.phone && getCustomer(business.id, phone)) return res.status(409).json({ error: 'Ese teléfono ya tiene otra tarjeta en tu negocio.' });
  db.prepare('UPDATE customers SET name = ?, email = ?, phone = ? WHERE id = ?').run(name || null, email || null, phone, customer.id);
  res.json(forRole('owner', business, getCustomer(business.id, phone)));
});

// Deshacer un movimiento (sello, puntos, regalo o canje), junto con los sellos extra que generó.
// El personal puede deshacer hasta 15 minutos después; el dueño, cuando sea.
router.post('/:phone/undo/:historyId', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const role = requirePin(req, res, business);
  if (!role) return;
  const customer = getCustomer(business.id, normalizePhone(req.params.phone));
  if (!customer) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const entry = db.prepare('SELECT * FROM history WHERE id = ? AND customer_id = ?').get(Number(req.params.historyId), customer.id);
  if (!entry) return res.status(404).json({ error: 'Ese movimiento ya no existe.' });
  if (role !== 'owner') {
    const mins = (Date.now() - new Date(entry.created_at).getTime()) / 60000;
    if (entry.parent_id) return res.status(403).json({ error: 'Deshaz la visita que lo generó.' });
    if (mins > 15) return res.status(403).json({ error: 'Pasaron más de 15 minutos: pídele al dueño que lo corrija.' });
  }
  const rows = [entry, ...db.prepare('SELECT * FROM history WHERE parent_id = ?').all(entry.id)];
  const undoKind = entry.type === 'redeem' ? 'redeem' : (entry.reason || 'add');
  // Revisa que nadie quede con sellos negativos (por ejemplo, si esos sellos ya se usaron en un canje)
  const delta = new Map();
  rows.forEach(r => delta.set(r.customer_id, (delta.get(r.customer_id) || 0) + (r.type === 'redeem' ? r.amount : -r.amount)));
  for (const [cid, d] of delta) {
    const c = db.prepare('SELECT progress FROM customers WHERE id = ?').get(cid);
    if (c && c.progress + d < 0) return res.status(400).json({ error: 'Esos sellos ya se usaron en un canje. Primero deshaz el canje.' });
  }
  const affected = [];
  db.transaction(() => {
    for (const r of rows) {
      if (r.type === 'redeem') db.prepare('UPDATE customers SET progress = progress + ?, redemptions = MAX(redemptions - 1, 0) WHERE id = ?').run(r.amount, r.customer_id);
      else db.prepare('UPDATE customers SET progress = progress - ? WHERE id = ?').run(r.amount, r.customer_id);
      db.prepare('DELETE FROM history WHERE id = ?').run(r.id);
      if (r.customer_id !== customer.id) affected.push(db.prepare('SELECT phone FROM customers WHERE id = ?').get(r.customer_id)?.phone);
    }
  })();
  sec.logEvent(business, req.actor, 'undo', customer, undoKind);
  res.json({ ...forRole(role, business, getCustomer(business.id, customer.phone)), undone: rows.length, affected: affected.filter(Boolean) });
});

// Sumar sellos o puntos (requiere PIN)
router.post('/:phone/progress', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const role = requirePin(req, res, business);
  if (!role) return;

  // Monedero: se escribe cuánto compró y se abona el % en saldo. En regalos, "amount" son pesos de saldo.
  const wallet = isWallet(business);
  const ticket = wallet && req.body?.gift !== true ? Math.round(Number(req.body?.ticket)) : null;
  if (wallet && req.body?.gift !== true && !(ticket >= 1 && ticket <= 1000000)) return res.status(400).json({ error: 'Escribe cuánto fue la compra.' });
  const amount = ticket ? walletAmount(business, ticket) : Math.round(Number(req.body?.amount));
  if (!(amount > 0) || amount > (wallet ? 50000 : 10000)) return res.status(400).json({ error: 'La cantidad debe ser mayor a 0.' });

  // Productos que compró en esta visita (opcional). Solo se aceptan los de la lista del negocio.
  let bought = isPremium(business) ? cleanList(req.body?.products, 10, 30) : [];
  const catalog = parseList(business.products);
  if (catalog.length) {
    const allowed = new Map(catalog.map(p => [p.toLowerCase(), p]));
    bought = bought.map(p => allowed.get(p.toLowerCase())).filter(Boolean);
  }

  const customer = getCustomer(business.id, normalizePhone(req.params.phone));
  if (!customer) return res.status(404).json({ error: 'Cliente no encontrado.' });
  if (customer.status === 'pending') return res.status(400).json({ error: 'Primero aprueba la solicitud de este cliente.' });

  // Regalo del negocio (ej. por su cumpleaños): no cuenta como visita ni activa promociones. Solo el dueño.
  if (req.body?.gift === true) {
    if (!isPremium(business)) return res.status(403).json({ error: 'Esta función es del plan Premium.' });
    if (role !== 'owner') return res.status(403).json({ error: 'Solo el dueño puede regalar sellos.' });
    const historyId = db.transaction(() => {
      const id = giveBonus(customer.id, amount, 'regalo');
      db.prepare("UPDATE history SET actor_type = 'owner', method = 'manual' WHERE id = ?").run(id);
      return id;
    })();
    return res.json({ ...forRole(role, business, getCustomer(business.id, customer.phone)), bonus: { amount, reasons: ['Regalo del negocio'] }, gift: true, historyId });
  }

  const previous = lastVisit(customer.id);

  // Tiempo mínimo entre sellos del mismo cliente (si el dueño lo activó). El personal no puede saltárselo; el dueño sí, confirmándolo.
  const cooldown = business.stamp_cooldown_on ? Number(business.stamp_cooldown_min || 120) : 0;
  let forced = 0;
  if (cooldown > 0 && previous) {
    const next = new Date(new Date(previous).getTime() + cooldown * 60000);
    if (next > new Date()) {
      if (role === 'owner' && req.body?.force === true) forced = 1;
      else {
        if (role !== 'owner') sec.logEvent(business, req.actor, 'cooldown', customer, previous);
        const quien = customer.name ? String(customer.name).split(' ')[0] : 'Este cliente';
        return res.status(409).json({
          code: 'cooldown', canForce: role === 'owner', nextAt: next.toISOString(),
          error: `${quien} ya recibió su ${isWallet(business) ? 'saldo' : business.mechanic === 'sellos' ? 'sello' : 'visita'} a las ${sec.fmtHour(previous)} `
            + `y tu negocio da máximo uno cada ${sec.cooldownLabel(cooldown)}. El siguiente puede ser desde las ${sec.fmtHour(next)}`.replace(/\.?$/, '.')
        });
      }
    }
  }
  const access = checkAccess(req, res, business, customer, role, 'add');
  if (!access) return;

  const visit = visits.recordVisit(business, customer, {
    amount, ticket, products: bought, who: actorCols(req), method: access.method, forced, check: access.check
  });
  const { historyId, reasons, referrer } = visit;
  const promos = isPremium(business) ? parsePromos(business.promos) : null;

  const out = forRole(role, business, getCustomer(business.id, customer.phone));
  out.historyId = historyId;
  out.bonus = reasons.length ? { amount, reasons } : null;
  if (referrer) out.referrer = { name: referrer.name || referrer.phone, phone: referrer.phone, amount: unitFor(business), both: Boolean(promos.referral.both) };
  if (ticket) out.ticket = { amount: ticket, credit: amount, pct: Number(business.wallet_pct) };
  if (visit.levelBonus) out.levelBonus = visit.levelBonus;
  if (visit.levelUp) out.levelUp = visit.levelUp;
  res.json(out);
});

// Canjear premio (requiere PIN)
router.post('/:phone/redeem', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const role = requirePin(req, res, business);
  if (!role) return;

  const customer = getCustomer(business.id, normalizePhone(req.params.phone));
  if (!customer) return res.status(404).json({ error: 'Cliente no encontrado.' });
  if (customer.status === 'pending') return res.status(400).json({ error: 'Primero aprueba la solicitud de este cliente.' });

  // Monedero: usa la parte del saldo que el cliente quiera (hasta lo que tiene). Sellos/puntos: se descuenta la meta.
  let goal = goalFor(business);
  let rewardName = null;
  const menu = rewardMenu(business);
  if (menu.length) {
    // Premios a elegir: se descuenta el costo del premio que eligió (si no dice, el principal).
    const pick = menu.find(r => r.id === String(req.body?.rewardId || 'main'));
    if (!pick) return res.status(400).json({ error: 'Ese premio ya no está en el menú. Actualiza la página.' });
    goal = pick.cost; rewardName = pick.name;
    if (customer.progress < goal) return res.status(400).json({ error: `Todavía no le alcanza para ${pick.name} (${customer.progress}/${goal}).` });
  } else if (isWallet(business)) {
    goal = Math.round(Number(req.body?.amount));
    if (!(goal >= 1)) return res.status(400).json({ error: 'Escribe cuánto saldo va a usar.' });
    if (goal > customer.progress) return res.status(400).json({ error: `Solo tiene $${customer.progress.toLocaleString('es-MX')} de saldo.` });
  } else if (customer.progress < goal) {
    return res.status(400).json({ error: `Todavía no alcanza el premio (${customer.progress}/${goal}).` });
  }
  const access = checkAccess(req, res, business, customer, role, 'redeem');
  if (!access) return;

  let historyId;
  db.transaction(() => {
    db.prepare('UPDATE customers SET progress = progress - ?, redemptions = redemptions + 1 WHERE id = ?')
      .run(goal, customer.id);
    const who = actorCols(req);
    historyId = db.prepare('INSERT INTO history (customer_id, type, amount, created_at, actor_type, actor_id, actor_name, method, reward_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(customer.id, 'redeem', goal, new Date().toISOString(), who.actor_type, who.actor_id, who.actor_name, access.method, rewardName).lastInsertRowid;
    if (access.check) sec.markCodeUsed(customer.id, access.check, 'redeem');
  })();

  res.json({ ...forRole(role, business, getCustomer(business.id, customer.phone)), historyId, rewardName });
});

// Recordatorio de un cliente (Premium): cada cuánto le toca, una fecha fija y una nota. Dueño o personal.
// body: { days: número | null (lo del negocio) | 0 (no recordarle), at: 'YYYY-MM-DD' | '', note, sent: true (ya se le mandó) }
router.put('/:phone/reminder', (req, res) => {
  const business = getBusiness(req.params.slug);
  if (!business) return res.status(404).json({ error: 'No encontramos ese negocio.' });
  const role = requirePin(req, res, business);
  if (!role) return;
  if (!isPremium(business)) return res.status(403).json({ error: 'Esta función es del plan Premium.' });
  const customer = getCustomer(business.id, normalizePhone(req.params.phone));
  if (!customer) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const b = req.body || {};
  if (b.sent === true) {
    db.prepare('UPDATE customers SET remind_sent_at = ? WHERE id = ?').run(new Date().toISOString(), customer.id);
  } else {
    let days = b.days === null || b.days === '' || b.days === undefined ? null : Math.round(Number(b.days));
    if (days !== null && !(days >= 0 && days <= 730)) return res.status(400).json({ error: 'Elige cada cuánto le toca.' });
    const at = String(b.at || '').trim();
    if (at && !/^\d{4}-\d{2}-\d{2}$/.test(at)) return res.status(400).json({ error: 'Esa fecha no es válida.' });
    const note = String(b.note || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    db.prepare('UPDATE customers SET remind_days = ?, remind_at = ?, remind_note = ?, remind_sent_at = NULL WHERE id = ?')
      .run(days, at || null, note || null, customer.id);
  }
  res.json(forRole(role, business, getCustomer(business.id, customer.phone)));
});

module.exports = router;
