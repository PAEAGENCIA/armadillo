function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'negocio';
}

// Deja solo dígitos para que "222 123 4567", "(222) 123-4567" y "+52 222 123 4567" sean el mismo cliente.
// México: 10 dígitos sin lada. Otros países: "+" y su lada (ver phones.js).
function normalizePhone(raw) { return require('./phones').normalizePhone(raw); }

function goalFor(business) {
  return business.mechanic === 'sellos' ? business.stamps_goal : business.points_goal;
}
// Monedero: cada compra deja un % en saldo a favor (1 punto = $1).
function isWallet(b) { return Boolean(b) && b.mechanic === 'puntos' && Number(b.wallet_pct) > 0; }
function walletAmount(b, ticket) { return Math.max(1, Math.round(Number(ticket) * Number(b.wallet_pct) / 100)); }

// Formatea una fila de "business" de snake_case (SQLite) a camelCase (API). Nunca incluye el PIN.
function businessToJSON(b) {
  return {
    slug: b.slug,
    name: b.name,
    mechanic: isWallet(b) ? 'monedero' : b.mechanic,
    walletPct: isWallet(b) ? Number(b.wallet_pct) : null,     // monedero: % de cada compra que regresa en saldo
    stampsGoal: b.stamps_goal,
    pointsGoal: b.points_goal,
    pointsPerVisit: b.points_per_visit,
    rewardDesc: b.reward_desc,
    color: b.color,
    products: isPremium(b) ? parseList(b.products) : [],
    plan: b.plan || 'esencial',
    logoUrl: isPremium(b) && b.logo ? `/api/businesses/${b.slug}/logo?v=${b.logo_version || 0}` : null,
    stampIcon: isPremium(b) ? (b.stamp_icon || 'check') : 'check',
    cardTitle: isPremium(b) ? (b.card_title || '') : '',
    cardStyle: isPremium(b) ? (b.card_style || 'gradient') : 'gradient',
    promos: isPremium(b) ? require('./promos').publicPromos(require('./promos').parsePromos(b.promos), undefined, require('./promos').promoWords(b)) : null,
    // Datos públicos del aviso de privacidad del negocio (son los que ve cualquier cliente en el aviso).
    legal: { name: b.legal_name || '', address: b.legal_address || '', email: b.privacy_email || '' },
    mapsUrl: b.maps_url || '',                                // "Cómo llegar" (Google Maps)
    reviewUrl: b.review_url || '',                            // reseña en Google (opcional)
    feedback: { on: Boolean(b.feedback_on), reward: Boolean(b.feedback_on && b.feedback_reward) },
    strictMode: strictActive(b),
    isDemo: Boolean(b.is_demo),                               // demo de un prospecto (datos de ejemplo, se borra sola)
    demoExpiresAt: b.is_demo ? (b.demo_expires_at || null) : null,                              // la tarjeta muestra un código que cambia cada 30 s (solo Premium)
    stampCooldownOn: Boolean(b.stamp_cooldown_on),            // tiempo mínimo entre sellos (lo activa el dueño)
    stampCooldownMin: b.stamp_cooldown_min || 120,
    // Redeo 2.0 (Premium): menú de premios, niveles de cliente y recordatorios por tiempo.
    rewards: require('./rewards').rewardMenu(b),                                  // menú completo (incluye el premio principal); vacío = un solo premio
    rewardExtras: isPremium(b) && !isWallet(b) ? require('./rewards').parseRewards(b.rewards) : [],
    levels: require('./levels').publicLevels(b),
    reminders: require('./reminders').publicReminders(b),
    appIcon: appIconInfo(b),
    push: isPremium(b),                                                           // avisos al celular (Premium)                                                      // ícono de la app instalada (lo dibuja el celular del dueño)
    createdAt: b.created_at
  };
}

// Versión del ícono de la app del negocio: { v, sig } o null si aún no se ha dibujado.
function appIconInfo(b) {
  if (!b || !b.id) return null;
  try {
    const row = require('./db').prepare('SELECT sig, updated_at FROM app_icons WHERE business_id = ?').get(b.id);
    return row ? { sig: row.sig, v: Date.parse(row.updated_at) || 0 } : null;
  } catch (e) { return null; }
}

// Colores de la plantilla (plan Esencial). En Premium se permite cualquier color.
const BASE_COLORS = ['#E62E6B', '#FFB627', '#2C56A8', '#1E8E5A', '#8438B0', '#E0472E', '#1A1320'];
const STAMP_ICON_IDS = ['check', 'star', 'heart', 'coffee', 'cup', 'bread', 'cookie', 'cake', 'ice-cream', 'pizza',
  'beer', 'leaf', 'flame', 'scissors', 'paw', 'barbell', 'car', 'shirt', 'diamond', 'crown'];
const CARD_STYLES = ['gradient', 'solid', 'pattern'];
const PLANS = ['esencial', 'premium'];
function isPremium(b) { return (b.plan || 'esencial') === 'premium'; }
// Modo estricto (código que cambia): es del plan Premium. Si el negocio baja a Esencial, se apaga solo.
function strictActive(b) { return Boolean(b && b.strict_mode) && isPremium(b); }

function parseList(raw) {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  } catch (e) {
    return [];
  }
}

// Limpia una lista de textos: sin vacíos, sin repetidos, con límite de cantidad y largo.
function cleanList(input, maxItems, maxLen) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const item of input) {
    const t = String(item || '').trim().slice(0, maxLen);
    const key = t.toLowerCase();
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}

function isEmail(raw) {
  const e = String(raw || '').trim();
  return e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

function customerToJSON(c) {
  return {
    phone: c.phone,
    name: c.name,
    progress: c.progress,
    redemptions: c.redemptions,
    status: c.status || 'active',
    hasBirthday: Boolean(c.birthday),
    given: c.given != null ? c.given : undefined,
    visits: c.visits != null ? c.visits : undefined,
    createdAt: c.created_at
  };
}

// Lo que ve el propio cliente (con la clave de su tarjeta): su avance y si acepta promociones.
function customerSelfJSON(c) {
  const { given, visits, ...rest } = c;
  return { ...customerToJSON(rest), marketingOptIn: Boolean(c.marketing_opt_in),
    hasEmail: Boolean(c.email), hasFavorites: parseList(c.favorites).length > 0, sourceAnswered: Boolean(c.source), hasReferrer: Boolean(c.referred_by) };
}

// Lo que ve cualquiera que escriba un teléfono sin la liga del cliente: solo el primer nombre.
function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}
function customerPublicJSON(c) {
  return { locked: true, firstName: firstName(c.name), status: c.status || 'active' };
}

// Lo que ve el personal: avance y la liga de la tarjeta, sin correo ni favoritos.
function customerStaffJSON(c) {
  return { ...customerToJSON(c), cardToken: c.card_token || '' };
}

// Versión completa para el dueño del negocio. Nunca se usa en la vista pública.
function customerPrivateJSON(c) {
  return {
    ...customerStaffJSON(c),
    email: c.email || '',
    favorites: parseList(c.favorites),
    marketingOptIn: Boolean(c.marketing_opt_in),
    birthday: c.birthday || '',
    privacyAcceptedAt: c.privacy_accepted_at || null,
    source: c.source || null,
    sourceDetail: c.source_detail || null
  };
}

function newCardToken() {
  return require('crypto').randomBytes(18).toString('base64url');
}

// Cumpleaños como 'MM-DD' (acepta {day, month} o 'MM-DD'). Devuelve null si no es una fecha real.
function parseBirthday(input) {
  let m, d;
  if (input && typeof input === 'object') { m = Number(input.month); d = Number(input.day); }
  else { const x = String(input || '').match(/^(\d{1,2})-(\d{1,2})$/); if (!x) return null; m = Number(x[1]); d = Number(x[2]); }
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1) return null;
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  if (d > maxDay) return null;
  return String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function birthdayText(b) {
  if (!b) return '';
  const [m, d] = b.split('-').map(Number);
  return `${d} de ${MESES[m - 1]}`;
}

// ---------- Vigencia (prueba o pagado) ----------
// Las fechas se cuentan con el calendario de la Ciudad de México. La fecha "hasta" es el último día con servicio.
function todayMx() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
}
function addDays(ymd, n) {
  const d = new Date(ymd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
}
function accessInfo(b) {
  if (!b.access_until) return { type: 'none', until: null, daysLeft: null, expired: false };
  const left = daysBetween(todayMx(), b.access_until);   // 0 = hoy es el último día
  return { type: b.access_type === 'paid' ? 'paid' : 'trial', until: b.access_until, daysLeft: Math.max(left + 1, 0), expired: left < 0 };
}
// Suma meses a una fecha 'YYYY-MM-DD' (si el día no existe, usa el último del mes)
function addMonths(ymd, n) {
  const y = +ymd.slice(0, 4), m = +ymd.slice(5, 7) - 1 + n, d = +ymd.slice(8, 10);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10);
}
const PLAN_PRICES = { esencial: 350, premium: 500 };   // precio de lista mensual (se puede cambiar por negocio)
function isYmd(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(new Date(s + 'T12:00:00Z'));
}

// PIN de 4 a 8 dígitos
function isValidPin(p) {
  return /^\d{4,8}$/.test(String(p || ''));
}

// Freno contra adivinar el PIN: después de 10 intentos fallidos en 15 minutos,
// ese negocio queda bloqueado desde esa conexión hasta que pase el tiempo.
const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

function attemptKey(req, slug) {
  return `${slug}|${req.ip}`;
}

function isBlocked(req, slug) {
  const entry = failures.get(attemptKey(req, slug));
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(attemptKey(req, slug));
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(req, slug) {
  const key = attemptKey(req, slug);
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    failures.set(key, { count: 1, first: Date.now() });
  } else {
    entry.count += 1;
  }
}

function clearFailures(req, slug) {
  failures.delete(attemptKey(req, slug));
}

// Límite simple de peticiones por conexión (evita que alguien llene un negocio de solicitudes falsas).
const hits = new Map();
function overLimit(req, bucket, max, windowMs) {
  const key = `${bucket}|${req.ip}`;
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.first > windowMs) {
    hits.set(key, { count: 1, first: now });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

module.exports = {
  overLimit,
  slugify, normalizePhone, goalFor, isWallet, walletAmount, businessToJSON, customerToJSON, customerPrivateJSON,
  customerPublicJSON, customerStaffJSON, customerSelfJSON, newCardToken, isValidPin, firstName, parseBirthday, birthdayText,
  accessInfo, todayMx, addDays, isYmd, addMonths, PLAN_PRICES,
  parseList, cleanList, isEmail,
  BASE_COLORS, STAMP_ICON_IDS, CARD_STYLES, PLANS, isPremium, strictActive,
  isBlocked, recordFailure, clearFailures
};
