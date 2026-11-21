// Registrar una visita (sello, puntos o saldo) con todo lo que conlleva: promociones, invitaciones,
// beneficios de nivel e historial. Lo usan el panel (dar sello) y el código de compra (lo escanea el cliente).
const db = require('./db');
const { isPremium, isWallet, walletAmount } = require('./utils');
const { parsePromos, globalDoubles, personalDoubles, nowMx } = require('./promos');
const levels = require('./levels');
const reminders = require('./reminders');
const sec = require('./security');

// Última visita "real" (sin contar sellos de regalo)
function lastVisit(customerId) {
  return db.prepare("SELECT MAX(created_at) AS at FROM history WHERE customer_id = ? AND type = 'add' AND reason IS NULL").get(customerId).at;
}
function unitFor(business) { return business.mechanic === 'sellos' ? 1 : (business.points_per_visit || 1); }

// Da sellos de regalo (bienvenida, doble, invitación…) y los deja en el historial con su motivo.
function giveBonus(customerId, amount, reason, parentId) {
  db.prepare('UPDATE customers SET progress = progress + ? WHERE id = ?').run(amount, customerId);
  return db.prepare("INSERT INTO history (customer_id, type, amount, products, created_at, reason, parent_id) VALUES (?, 'add', ?, '[]', ?, ?, ?)")
    .run(customerId, amount, new Date().toISOString(), reason, parentId || null).lastInsertRowid;
}

// Sello de bienvenida: solo si la promoción está prendida y el cliente aún no tiene movimientos.
function welcomeBonus(business, customer) {
  if (!isPremium(business) || !parsePromos(business.promos).welcome.on) return 0;
  const any = db.prepare('SELECT 1 FROM history WHERE customer_id = ? LIMIT 1').get(customer.id);
  if (any) return 0;
  const amount = unitFor(business);
  giveBonus(customer.id, amount, 'bienvenida');
  return amount;
}

// Beneficio de nivel: % extra en puntos/saldo; en sellos, 100% = sello doble.
function levelExtra(business, amount, boost) {
  if (!(boost > 0)) return 0;
  if (business.mechanic === 'sellos') return boost >= 100 ? amount : 0;
  return Math.round(amount * boost / 100);
}

// opts: { amount, ticket, products, who:{actor_type,actor_id,actor_name}, method, forced, at (Date de la compra), check }
// Devuelve { historyId, reasons, referrer, levelBonus, levelUp, level }
function recordVisit(business, customer, opts) {
  const at = opts.at || new Date();
  const amount = opts.amount;
  const previous = lastVisit(customer.id);
  const promos = isPremium(business) ? parsePromos(business.promos) : null;
  const now = nowMx(at);
  const reasons = promos ? [...globalDoubles(promos, now), ...personalDoubles(promos, customer, previous, now)] : [];
  let referrer = null;
  if (promos && promos.referral.on && !previous && customer.referred_by) {
    const r = db.prepare("SELECT * FROM customers WHERE business_id = ? AND phone = ? AND status = 'active'").get(business.id, customer.referred_by);
    if (r && r.id !== customer.id) referrer = r;
  }
  const L = levels.activeLevels(business);
  const before = L ? levels.levelFromVisits(L, levels.visitsInWindow(customer.id, L)) : null;
  // El beneficio es el del nivel que alcanza con esta visita (si con ella sube a VIP, ya lo disfruta).
  const reached = L ? levels.levelFromVisits(L, before.visits + 1) : null;
  let levelBonus = 0;

  const who = opts.who || {};
  let historyId;
  db.transaction(() => {
    db.prepare('UPDATE customers SET progress = progress + ? WHERE id = ?').run(amount, customer.id);
    historyId = db.prepare(`INSERT INTO history (customer_id, type, amount, products, created_at, actor_type, actor_id, actor_name, method, forced, ticket)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(customer.id, 'add', amount, JSON.stringify(opts.products || []), at.toISOString(), who.actor_type || null, who.actor_id || null, who.actor_name || null,
        opts.method || 'manual', opts.forced || 0, opts.ticket || null).lastInsertRowid;
    if (opts.check) sec.markCodeUsed(customer.id, opts.check, 'add');
    if (reasons.length) giveBonus(customer.id, amount, 'doble', historyId);              // la promoción duplica lo de esta visita
    else if (reached) {                                                                  // nunca más que doble: si ya hay promoción, el nivel no suma
      levelBonus = levelExtra(business, amount, reached.boost);
      if (levelBonus > 0) giveBonus(customer.id, levelBonus, 'nivel', historyId);
    }
    if (referrer) {
      giveBonus(referrer.id, unitFor(business), 'referido', historyId);                    // quien lo invitó gana su sello
      if (promos.referral.both) giveBonus(customer.id, unitFor(business), 'invitado', historyId);  // y, si el negocio quiere, el invitado también
    }
    // Al venir, su recordatorio vuelve a empezar (una fecha fija que ya pasó se borra sola).
    db.prepare(`UPDATE customers SET remind_sent_at = NULL,
      remind_at = CASE WHEN remind_at IS NOT NULL AND remind_at <= ? THEN NULL ELSE remind_at END WHERE id = ?`).run(reminders.todayMx(), customer.id);
  })();
  const after = L ? levels.levelFromVisits(L, levels.visitsInWindow(customer.id, L)) : null;
  return {
    historyId, reasons, referrer, levelBonus,
    levelUp: after && before && after.index > before.index ? { name: after.name, perk: after.perk } : null,
    level: after
  };
}

// ---------- Datos extra de cada cliente: nivel y recordatorio ----------
// Para listas se prepara una vez (dos consultas) y se aplica a cada fila.
function extrasContext(business) {
  const lv = levels.visitsMap(business);
  const R = reminders.activeReminders(business);
  const last = R ? reminders.lastVisitsMap(business) : null;
  return {
    apply(row, out) {
      if (lv) out.level = lv.get(row.id);
      if (R) out.reminder = reminders.reminderFor(R, row, last.get(row.id));
      return out;
    }
  };
}
function withExtras(business, row, out) {
  if (!business || !row) return out;
  const L = levels.activeLevels(business);
  if (L) out.level = levels.levelOf(business, row.id);
  const R = reminders.activeReminders(business);
  if (R) out.reminder = reminders.reminderFor(R, row, lastVisit(row.id));
  return out;
}

// ---------- Código de compra ----------
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // sin 0/O ni 1/I/L para que no se confundan
function newPurchaseCode() {
  const bytes = require('crypto').randomBytes(8);
  let s = '';
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s;
}
function normalizeCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}
function fmtCode(code) { return code.slice(0, 4) + '-' + code.slice(4); }

function codeStatus(row) {
  if (!row) return 'not_found';
  if (row.canceled_at) return 'canceled';
  if (row.used_at) return 'used';
  if (new Date(row.expires_at) < new Date()) return 'expired';
  return 'ok';
}
const CODE_ERRORS = {
  not_found: 'Ese código no existe. Revisa que esté bien escrito.',
  canceled: 'Ese código lo canceló el negocio.',
  used: 'Ese código ya se usó.',
  expired: 'Ese código ya venció.'
};

// Suma la compra a la tarjeta del cliente. Si su tarjeta estaba pendiente, la compra la activa.
// Devuelve { ok, result, customer } o { error, status }.
function claimPurchase(business, customer, row) {
  const st = codeStatus(row);
  if (st !== 'ok') return { status: st === 'not_found' ? 404 : 409, code: st, error: CODE_ERRORS[st] };
  if (row.business_id !== business.id) return { status: 404, code: 'not_found', error: CODE_ERRORS.not_found };
  let result = null, ok = false;
  db.transaction(() => {
    const mark = db.prepare('UPDATE purchase_codes SET used_at = ?, customer_id = ? WHERE id = ? AND used_at IS NULL AND canceled_at IS NULL')
      .run(new Date().toISOString(), customer.id, row.id);
    if (mark.changes !== 1) return;
    if (customer.status === 'pending') {
      db.prepare("UPDATE customers SET status = 'active' WHERE id = ?").run(customer.id);
      welcomeBonus(business, customer);            // su compra activó la tarjeta: recibe la bienvenida como si la aprobaran
    }
    let products = [];
    try { products = JSON.parse(row.products || '[]'); } catch (e) { products = []; }
    result = recordVisit(business, { ...customer, status: 'active' }, {
      amount: row.amount, ticket: row.ticket, products,
      who: { actor_type: row.actor_type, actor_id: row.actor_id, actor_name: row.actor_name },
      method: 'compra', at: new Date(row.created_at)
    });
    db.prepare('UPDATE purchase_codes SET history_id = ? WHERE id = ?').run(result.historyId, row.id);
    ok = true;
  })();
  if (!ok) return { status: 409, code: 'used', error: CODE_ERRORS.used };
  return { ok: true, result, row };
}

module.exports = {
  lastVisit, unitFor, giveBonus, welcomeBonus, recordVisit, extrasContext, withExtras,
  newPurchaseCode, normalizeCode, fmtCode, codeStatus, claimPurchase, CODE_ERRORS
};
