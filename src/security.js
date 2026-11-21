// Seguridad del personal: código de un solo uso, registro de quién hizo qué y alertas para el dueño.
const crypto = require('crypto');
const db = require('./db');

const STEP_SECONDS = 30;            // el código de la tarjeta cambia cada 30 segundos
const COOLDOWN_OPTIONS = [30, 60, 120, 240, 720, 1440];

// ---------- Código que cambia (mismo cálculo que hace el celular del cliente) ----------
function currentStep(now) { return Math.floor((now || Date.now()) / 1000 / STEP_SECONDS); }

function codeFor(secret, step) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha256', Buffer.from(String(secret), 'base64url')).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, '0');
}

// Clave secreta del cliente para su código (se crea la primera vez que se necesita).
function ensureQrSecret(customer) {
  if (customer.qr_secret) return customer.qr_secret;
  const secret = crypto.randomBytes(20).toString('base64url');
  db.prepare('UPDATE customers SET qr_secret = ? WHERE id = ? AND qr_secret IS NULL').run(secret, customer.id);
  return db.prepare('SELECT qr_secret FROM customers WHERE id = ?').get(customer.id).qr_secret;
}

// Revisa el código que mostró el cliente. Sirve una sola vez para cada cosa (sello o canje):
// con el mismo código se puede dar el sello y canjear el premio en la misma visita, pero no dos sellos.
// Tolera relojes de celular un poco adelantados o atrasados (±1 minuto aprox.).
function verifyCode(customer, code, action) {
  code = String(code || '').replace(/\D/g, '');
  if (code.length !== 6 || !customer.qr_secret) return { ok: false, reason: 'bad' };
  const now = currentStep();
  let step = null;
  for (let s = now - 3; s <= now + 2; s++) {
    const expected = codeFor(customer.qr_secret, s);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) { step = s; break; }
  }
  if (step === null) return { ok: false, reason: 'bad' };
  const last = customer.qr_last_step == null ? -1 : Number(customer.qr_last_step);
  const used = String(customer.qr_last_actions || '').split(',').filter(Boolean);
  if (step < last || (step === last && used.includes(action))) return { ok: false, reason: 'used' };
  return { ok: true, step, used: step === last ? used : [] };
}
function markCodeUsed(customerId, check, action) {
  db.prepare('UPDATE customers SET qr_last_step = ?, qr_last_actions = ? WHERE id = ?')
    .run(check.step, [...check.used, action].join(','), customerId);
}

// ---------- Quién hizo el movimiento ----------
function actorName(a) {
  if (!a) return '';
  if (a.type === 'owner') return 'Dueño';
  if (a.type === 'member') return a.name || 'Empleado';
  return 'Personal (PIN general)';
}

function logEvent(business, actor, kind, customer, detail) {
  try {
    db.prepare(`INSERT INTO security_events (business_id, customer_id, customer_name, actor_type, actor_id, actor_name, kind, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(business.id, customer ? customer.id : null, customer ? (customer.name || customer.phone) : null,
      actor ? actor.type : null, actor && actor.id ? actor.id : null, actorName(actor), kind, detail || null, new Date().toISOString());
  } catch (e) { console.error('[seguridad]', e.message); }
}

// ---------- Tiempo mínimo entre sellos ----------
function fmtHour(date) {
  return new Date(date).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' });
}
function cooldownLabel(min) {
  if (!min) return 'sin límite';
  if (min < 60) return `${min} minutos`;
  if (min === 1440) return '1 día';
  const h = min / 60;
  return `${h} ${h === 1 ? 'hora' : 'horas'}`;
}

// ---------- Resumen de actividad y alertas (solo lo ve el dueño) ----------
function actorKey(type, id) { return type === 'member' ? `member:${id}` : (type || 'unknown'); }

function securityReport(business, days) {
  days = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const members = db.prepare('SELECT id, name, active, created_at, last_seen_at FROM staff_members WHERE business_id = ? ORDER BY active DESC, name').all(business.id);

  const team = new Map();
  const ensure = (type, id, name) => {
    const key = actorKey(type, id);
    if (!team.has(key)) team.set(key, { key, type, id: id || null, name, visits: 0, manual: 0, scan: 0, verified: 0, redeems: 0, blocked: 0, badCodes: 0, undos: 0, lastAt: null });
    return team.get(key);
  };
  ensure('owner', null, 'Tú (dueño)');
  if (business.staff_pin) ensure('staff', null, 'Personal (PIN general)');
  members.forEach(m => ensure('member', m.id, m.name));

  const rows = db.prepare(`SELECT h.*, c.name AS cname, c.phone AS cphone FROM history h JOIN customers c ON c.id = h.customer_id
    WHERE c.business_id = ? AND h.created_at >= ? AND h.parent_id IS NULL AND h.actor_type IS NOT NULL ORDER BY h.id`).all(business.id, since);
  const perCustomer = new Map();   // empleado+cliente -> sellos a mano
  for (const r of rows) {
    const t = ensure(r.actor_type, r.actor_id, r.actor_type === 'member' ? r.actor_name : (r.actor_type === 'owner' ? 'Tú (dueño)' : 'Personal (PIN general)'));
    if (!t.lastAt || r.created_at > t.lastAt) t.lastAt = r.created_at;
    if (r.type === 'redeem') { t.redeems++; continue; }
    if (r.reason) continue;                 // regalos y sellos extra no cuentan como visita
    t.visits++;
    if (r.method === 'code') t.verified++;
    else if (r.method === 'scan' || r.method === 'compra') t.scan++;   // código de compra: lo escaneó el propio cliente
    else {
      t.manual++;
      if (r.actor_type !== 'owner') {
        const k = t.key + '|' + r.customer_id;
        const e = perCustomer.get(k) || { actor: t.name, customer: r.cname || r.cphone, n: 0 };
        e.n++; perCustomer.set(k, e);
      }
    }
  }

  const events = db.prepare('SELECT * FROM security_events WHERE business_id = ? AND created_at >= ? ORDER BY id').all(business.id, since);
  const blockedBy = new Map();
  const alerts = [];
  for (const ev of events) {
    const t = ensure(ev.actor_type, ev.actor_id, ev.actor_name || 'Personal');
    if (ev.kind === 'cooldown' || ev.kind === 'strict') {
      t.blocked++;
      const k = t.key + '|' + ev.kind;
      blockedBy.set(k, { actor: t.name, kind: ev.kind, n: (blockedBy.get(k)?.n || 0) + 1 });
    } else if (ev.kind === 'bad_code') t.badCodes++;
    else if (ev.kind === 'undo') {
      t.undos++;
      if (ev.detail === 'redeem' && ev.actor_type !== 'owner') {
        alerts.push({ level: 'alta', title: `${t.name} deshizo un canje de premio`, text: `Fue el canje de ${ev.customer_name || 'un cliente'} (${fmtDate(ev.created_at)}). Al deshacerlo, el cliente recupera sus sellos: confirma que sí se regresó el premio.`, at: ev.created_at });
      }
    }
  }
  for (const e of perCustomer.values()) {
    if (e.n >= 3) alerts.push({ level: 'alta', title: `${e.actor} le dio ${e.n} sellos a mano a ${e.customer}`, text: 'Sin escanear su tarjeta. Pregúntale por qué no la escaneó y revisa el historial de ese cliente.' });
  }
  for (const t of team.values()) {
    if (t.type !== 'owner' && t.manual >= 5 && t.manual / Math.max(1, t.visits) >= 0.5) {
      alerts.push({ level: 'media', title: `${t.name} da la mayoría de los sellos a mano`, text: `${t.manual} de ${t.visits} sellos fueron sin escanear. Pídele que escanee la tarjeta del cliente.` });
    }
    if (t.type !== 'owner' && t.badCodes >= 3) {
      alerts.push({ level: 'media', title: `${t.name} usó códigos vencidos o repetidos ${t.badCodes} veces`, text: 'Puede ser un error (el cliente enseñó una captura) o alguien intentando usar un código viejo.' });
    }
  }
  for (const b of blockedBy.values()) {
    if (b.n >= 2 && !/dueño/i.test(b.actor)) {
      alerts.push({ level: 'media', title: b.kind === 'cooldown' ? `${b.actor} intentó dar sellos antes de tiempo ${b.n} veces` : `${b.actor} intentó dar sellos sin el código del cliente ${b.n} veces`, text: b.kind === 'cooldown' ? 'Redeo lo bloqueó porque ese cliente ya había recibido su sello hace poco.' : 'Redeo lo bloqueó porque el modo estricto está encendido.' });
    }
  }
  alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === 'alta' ? -1 : 1));

  const memberInfo = new Map(members.map(m => [m.id, m]));
  const teamList = [...team.values()].map(t => ({ ...t, active: t.type === 'member' ? Boolean(memberInfo.get(t.id)?.active) : true, removed: t.type === 'member' && !memberInfo.has(t.id) }));
  return { days, team: teamList, alerts, untracked: 'Los movimientos anteriores a esta función no dicen quién los hizo.' };
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' });
}

module.exports = {
  STEP_SECONDS, COOLDOWN_OPTIONS, currentStep, codeFor, ensureQrSecret, verifyCode, markCodeUsed,
  actorName, logEvent, fmtHour, cooldownLabel, securityReport
};
