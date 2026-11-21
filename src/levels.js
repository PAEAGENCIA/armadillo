// Niveles de cliente (plan Premium): mientras más viene, más sube (ej. Frecuente y VIP).
// El nivel se calcula con las visitas de los últimos N días, así se mantiene "vivo":
// quien deja de venir baja de nivel solo y quien regresa lo recupera.
const db = require('./db');

const WINDOWS = [30, 60, 90, 180, 365];
const BOOSTS = [0, 10, 25, 50, 100];   // % extra en cada visita (en sellos: 100 = sello doble)
const DEFAULT_LEVELS = {
  on: false,
  windowDays: 90,
  base: 'Cliente',
  tiers: [
    { name: 'Frecuente', visits: 4, perk: '', boost: 0 },
    { name: 'VIP', visits: 10, perk: '', boost: 100 }
  ]
};

function isPremium(b) { return (b.plan || 'esencial') === 'premium'; }

function cleanText(v, max) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max); }

function cleanLevels(v) {
  v = v && typeof v === 'object' ? v : {};
  const windowDays = WINDOWS.includes(Number(v.windowDays)) ? Number(v.windowDays) : DEFAULT_LEVELS.windowDays;
  const src = Array.isArray(v.tiers) && v.tiers.length ? v.tiers.slice(0, 3) : DEFAULT_LEVELS.tiers;
  const tiers = [];
  let last = 0;
  for (const t of src) {
    const name = cleanText(t && t.name, 20);
    const visits = Math.round(Number(t && t.visits));
    if (!name || !(visits >= 2 && visits <= 200)) continue;
    if (visits <= last) continue;                    // cada nivel pide más visitas que el anterior
    last = visits;
    tiers.push({ name, visits, perk: cleanText(t.perk, 80), boost: BOOSTS.includes(Number(t.boost)) ? Number(t.boost) : 0 });
  }
  return {
    on: Boolean(v.on === true) && tiers.length > 0,
    windowDays,
    base: cleanText(v.base, 20) || DEFAULT_LEVELS.base,
    tiers: tiers.length ? tiers : DEFAULT_LEVELS.tiers
  };
}

function parseLevels(raw) {
  let v = {};
  try { v = JSON.parse(raw || '{}') || {}; } catch (e) { v = {}; }
  return cleanLevels(v);
}

function activeLevels(business) {
  if (!business || !isPremium(business)) return null;
  const L = parseLevels(business.levels);
  return L.on ? L : null;
}

function sinceIso(days) { return new Date(Date.now() - days * 86400000).toISOString(); }

// Visitas reales (sin regalos ni sellos extra) de un cliente en la ventana del negocio.
function visitsInWindow(customerId, L) {
  return db.prepare("SELECT COUNT(*) AS n FROM history WHERE customer_id = ? AND type = 'add' AND reason IS NULL AND created_at >= ?")
    .get(customerId, sinceIso(L.windowDays)).n;
}

// Nivel según el número de visitas: { index (0 = base), name, perk, boost, visits, next: { name, missing } }
function levelFromVisits(L, visits) {
  let idx = 0;
  L.tiers.forEach((t, i) => { if (visits >= t.visits) idx = i + 1; });
  const cur = idx ? L.tiers[idx - 1] : { name: L.base, perk: '', boost: 0 };
  const nxt = L.tiers[idx] || null;
  return {
    index: idx, top: idx === L.tiers.length, name: cur.name, perk: cur.perk || '', boost: cur.boost || 0, visits,
    next: nxt ? { name: nxt.name, missing: nxt.visits - visits } : null
  };
}

function levelOf(business, customerId) {
  const L = activeLevels(business);
  if (!L) return null;
  return levelFromVisits(L, visitsInWindow(customerId, L));
}

// Para listas: visitas de todos los clientes del negocio en una sola consulta.
function visitsMap(business) {
  const L = activeLevels(business);
  if (!L) return null;
  const rows = db.prepare(`SELECT h.customer_id AS id, COUNT(*) AS n FROM history h JOIN customers c ON c.id = h.customer_id
    WHERE c.business_id = ? AND h.type = 'add' AND h.reason IS NULL AND h.created_at >= ? GROUP BY h.customer_id`).all(business.id, sinceIso(L.windowDays));
  const m = new Map(rows.map(r => [r.id, r.n]));
  return { L, get: id => levelFromVisits(L, m.get(id) || 0) };
}

// Lo que ven los clientes y el panel.
function publicLevels(business) {
  const L = activeLevels(business);
  if (!L) return null;
  return { windowDays: L.windowDays, base: L.base, tiers: L.tiers };
}

module.exports = { WINDOWS, BOOSTS, DEFAULT_LEVELS, cleanLevels, parseLevels, activeLevels, levelOf, levelFromVisits, visitsMap, publicLevels, visitsInWindow };
