// Recordatorios por tiempo (plan Premium): "ya te toca tu corte", "ya toca la vacuna de tu perro".
// Cada negocio dice cada cuántos días suele regresar un cliente; a cada cliente se le puede poner
// su propio tiempo o una fecha fija (ej. la próxima vacuna) con una nota.
const db = require('./db');

const DAY_OPTIONS = [7, 14, 21, 28, 30, 45, 60, 90, 120, 180, 365];
const DEFAULT_REMINDERS = { on: false, days: 21, label: 'tu próxima visita' };

function isPremium(b) { return (b.plan || 'esencial') === 'premium'; }

function cleanReminders(v) {
  v = v && typeof v === 'object' ? v : {};
  const label = String(v.label || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return {
    on: v.on === true,
    days: DAY_OPTIONS.includes(Number(v.days)) ? Number(v.days) : DEFAULT_REMINDERS.days,
    label: label || DEFAULT_REMINDERS.label
  };
}
function parseReminders(raw) {
  let v = {};
  try { v = JSON.parse(raw || '{}') || {}; } catch (e) { v = {}; }
  return cleanReminders(v);
}
function activeReminders(business) {
  if (!business || !isPremium(business)) return null;
  const R = parseReminders(business.reminders);
  return R.on ? R : null;
}

function todayMx() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' }); }
function mxDay(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).includes('T') ? iso : String(iso).replace(' ', 'T') + 'Z');
  return isNaN(d) ? '' : d.toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
}
function addDays(ymd, n) {
  const d = new Date(ymd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000); }

// Cuándo le toca a un cliente. Devuelve null si no hay recordatorio para él.
// { due: 'YYYY-MM-DD', daysLeft (negativo = ya se pasó), every (días) | null, fixed: bool, note, sentAt }
function reminderFor(R, c, lastVisitIso) {
  if (!R) return null;
  const note = c.remind_note || '';
  if (c.remind_at && /^\d{4}-\d{2}-\d{2}$/.test(c.remind_at)) {
    return { due: c.remind_at, daysLeft: daysBetween(todayMx(), c.remind_at), every: null, fixed: true, note, sentAt: c.remind_sent_at || null, custom: true };
  }
  const every = c.remind_days == null ? R.days : Number(c.remind_days);
  if (!(every > 0)) return null;                    // 0 = el negocio no quiere recordarle
  const from = mxDay(lastVisitIso);
  if (!from) return null;                           // aún no tiene visitas
  const due = addDays(from, every);
  return { due, daysLeft: daysBetween(todayMx(), due), every, fixed: false, note, sentAt: c.remind_sent_at || null, custom: c.remind_days != null };
}

// Últimas visitas de todos los clientes del negocio en una consulta.
function lastVisitsMap(business) {
  const rows = db.prepare(`SELECT h.customer_id AS id, MAX(h.created_at) AS at FROM history h JOIN customers c ON c.id = h.customer_id
    WHERE c.business_id = ? AND h.type = 'add' AND h.reason IS NULL GROUP BY h.customer_id`).all(business.id);
  return new Map(rows.map(r => [r.id, r.at]));
}

function publicReminders(business) {
  const R = activeReminders(business);
  return R ? { days: R.days, label: R.label } : null;
}

module.exports = { DAY_OPTIONS, cleanReminders, parseReminders, activeReminders, reminderFor, lastVisitsMap, publicReminders, todayMx, mxDay, addDays };
