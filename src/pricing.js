// Precios por lotes ("precio de fundador") y datos para cobrar la membresía.
// - Los lotes se llenan en orden. Un lugar se ocupa cuando el negocio paga por primera vez.
// - Quien entra en un lote se queda con ese precio mientras siga pagando.
// - Si deja de pagar más de 30 días y regresa, paga el precio del lote vigente en ese momento.
const crypto = require('crypto');
const db = require('./db');
const { todayMx, addDays } = require('./utils');

const LAPSE_DAYS = 30;   // días sin servicio para perder el precio congelado

const DEFAULT_TIERS = [
  { id: 'fundadores',  name: 'Fundadores',  label: 'Precio de fundador',        spots: 10,   esencial: 350, premium: 500, until: '' },
  { id: 'pioneros',    name: 'Pioneros',    label: 'Precio de lanzamiento',     spots: 20,   esencial: 390, premium: 550, until: '' },
  { id: 'lanzamiento', name: 'Lanzamiento', label: 'Últimos lugares con descuento', spots: 30, esencial: 420, premium: 600, until: '' },
  { id: 'regular',     name: 'Regular',     label: 'Precio regular',            spots: null, esencial: 450, premium: 650, until: '' }
];
const DEFAULT_PAYINFO = { bank: '', holder: '', clabe: '', card: '', cashNote: 'Paga en efectivo directamente a tu asesor de P.A.E. y recibe tu recibo al momento.', extra: '' };

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch (e) { return fallback; }
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const slugId = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
function cleanTiers(input) {
  if (!Array.isArray(input) || !input.length) return null;
  const out = [];
  for (const t of input.slice(0, 8)) {
    const esencial = Math.round(Number(t.esencial)), premium = Math.round(Number(t.premium));
    if (!(esencial > 0 && premium > 0)) return null;
    const spots = t.spots === '' || t.spots == null ? null : Math.round(Number(t.spots));
    if (spots != null && !(spots >= 1 && spots <= 100000)) return null;
    out.push({
      id: String(t.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 24) || slugId(t.name) || crypto.randomBytes(4).toString('hex'),
      name: String(t.name || 'Lote').trim().slice(0, 30) || 'Lote',
      label: String(t.label || '').trim().slice(0, 40) || String(t.name || 'Lote').trim().slice(0, 30),
      spots, esencial, premium,
      until: YMD.test(String(t.until || '')) ? t.until : ''
    });
  }
  const seen = new Set();
  for (const t of out) { while (seen.has(t.id)) t.id = (t.id + '-2').slice(-24); seen.add(t.id); }
  out[out.length - 1].spots = null;   // el último lote siempre es sin límite (precio regular)
  out[out.length - 1].until = '';
  return out;
}
function tiers() { return cleanTiers(getSetting('price_tiers', DEFAULT_TIERS)) || DEFAULT_TIERS; }
function payInfo() { return { ...DEFAULT_PAYINFO, ...(getSetting('pay_info', {}) || {}) }; }

// Lugares ocupados: cada negocio que entró a ese lote al pagar. Si luego deja de pagar, su lugar sigue contado.
function filledCount(tierId) {
  return db.prepare('SELECT COUNT(DISTINCT t.business_id) AS n FROM tier_claims t JOIN businesses b ON b.id = t.business_id WHERE t.tier_id = ? AND b.is_demo = 0').get(tierId).n;
}
// Lote vigente: el primero que aún tiene lugares y no ha pasado su fecha.
function tiersStatus() {
  const today = todayMx();
  const list = tiers().map(t => ({ ...t, filled: filledCount(t.id) }));
  let current = list[list.length - 1];
  for (const t of list) {
    const full = t.spots != null && t.filled >= t.spots;
    const expired = t.until && today > t.until;
    if (!full && !expired) { current = t; break; }
  }
  return { list, current, regular: list[list.length - 1] };
}
function publicPricing() {
  const { current, regular } = tiersStatus();
  return {
    name: current.name, label: current.label, esencial: current.esencial, premium: current.premium,
    spots: current.spots, spotsLeft: current.spots != null ? Math.max(0, current.spots - current.filled) : null, until: current.until || null,
    regular: { esencial: regular.esencial, premium: regular.premium }, isRegular: current.id === regular.id
  };
}

// ¿Ya perdió su precio congelado? (lleva más de 30 días sin servicio)
function lapsed(b) {
  if (!b.tier_id) return false;
  if (!b.access_until) return false;
  return b.access_until < addDays(todayMx(), -LAPSE_DAYS);
}
// Precio mensual de un negocio: el que P.A.E. le puso a mano > su precio congelado > el del lote vigente.
function priceFor(b) {
  if (b.price_monthly != null) return { amount: b.price_monthly, source: 'custom', tier: b.tier_name || null };
  const plan = b.plan === 'premium' ? 'premium' : 'esencial';
  if (b.tier_id && !lapsed(b)) {
    const locked = plan === 'premium' ? b.tier_premium : b.tier_esencial;
    if (locked) return { amount: locked, source: 'locked', tier: b.tier_name, label: b.tier_label };
  }
  const { current } = tiersStatus();
  return { amount: current[plan], source: 'current', tier: current.name, label: current.label };
}
// Al registrar su primer pago (o al regresar después de perder su precio) se le asigna el lote vigente.
function assignTierOnPayment(b) {
  if (b.tier_id && !lapsed(b)) return null;   // ya tiene su lugar y su precio congelado
  const { current } = tiersStatus();
  db.prepare('UPDATE businesses SET tier_id = ?, tier_name = ?, tier_label = ?, tier_esencial = ?, tier_premium = ?, tier_joined_at = ? WHERE id = ?')
    .run(current.id, current.name, current.label, current.esencial, current.premium, new Date().toISOString(), b.id);
  db.prepare('INSERT INTO tier_claims (business_id, tier_id, created_at) VALUES (?, ?, ?)').run(b.id, current.id, new Date().toISOString());
  return current;
}

// Una sola vez: los negocios que ya pagaban antes de los lotes ocupan sus lugares en orden (son los primeros).
function migrateExistingPayers() {
  // Negocios con lote pero sin su lugar registrado (versión anterior de esta función).
  db.prepare(`INSERT INTO tier_claims (business_id, tier_id, created_at)
    SELECT id, tier_id, COALESCE(tier_joined_at, datetime('now')) FROM businesses b
    WHERE tier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tier_claims t WHERE t.business_id = b.id AND t.tier_id = b.tier_id)`).run();
  const rows = db.prepare(`SELECT b.* FROM businesses b WHERE b.is_demo = 0 AND b.tier_id IS NULL
    AND EXISTS (SELECT 1 FROM payments p WHERE p.business_id = b.id)
    ORDER BY (SELECT MIN(p.paid_at) FROM payments p WHERE p.business_id = b.id), b.id`).all();
  for (const b of rows) assignTierOnPayment(b);
  if (rows.length) console.log(`[lotes] ${rows.length} negocio(s) que ya pagaban quedaron en su lote.`);
}

module.exports = { migrateExistingPayers, DEFAULT_TIERS, LAPSE_DAYS, tiers, cleanTiers, payInfo, getSetting, setSetting, tiersStatus, publicPricing, priceFor, assignTierOnPayment, lapsed };
