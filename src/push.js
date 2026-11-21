// Avisos al celular (plan Premium), con el estándar de notificaciones de los navegadores (Web Push).
// - No cuesta nada por aviso y no necesita cuentas de Apple ni de Google.
// - Las "claves" que firman los avisos se crean solas la primera vez y se guardan en la base de datos
//   (en el volumen de Railway). Si se borran, los clientes tendrían que volver a activar sus avisos.
// - Android: llegan aunque no tenga la tarjeta instalada. iPhone: solo con la tarjeta en su pantalla de inicio (iOS 16.4+).
const db = require('./db');
// Si el paquete "web-push" no está instalado (por ejemplo, si no se subió package.json), la app sigue
// funcionando normal y solo los avisos quedan apagados. Nunca debe tumbar la página.
let webpush = null;
try { webpush = require('web-push'); } catch (e) { console.error('[avisos] Falta el paquete web-push: los avisos quedan apagados hasta subir package.json y package-lock.json.'); }

const LIMIT_PER_WEEK = 2;          // avisos por negocio cada 7 días (para que los clientes no los apaguen por cansancio)
const MAX_BODY = 140;

// Solo se aceptan direcciones de los servicios de avisos de Google, Apple, Mozilla y Microsoft.
const PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|push\.apple\.com|mozilla\.com|mozaws\.net|notify\.windows\.com)(:\d+)?\//i;

let vapid = null;
function keys() {
  if (!webpush) throw new Error('web-push no instalado');
  if (vapid) return vapid;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'vapid'").get();
    if (row) vapid = JSON.parse(row.value);
    else {
      vapid = webpush.generateVAPIDKeys();
      db.prepare("INSERT INTO settings (key, value) VALUES ('vapid', ?)").run(JSON.stringify(vapid));
    }
  }
  const contact = process.env.LEGAL_EMAIL ? `mailto:${process.env.LEGAL_EMAIL}` : 'mailto:hola@redeo.app';
  webpush.setVapidDetails(contact, vapid.publicKey, vapid.privateKey);
  return vapid;
}
function publicKey() { try { return keys().publicKey; } catch (e) { if (webpush) console.error('[avisos]', e.message); return null; } }

function validSubscription(sub) {
  if (!sub || typeof sub !== 'object') return null;
  const endpoint = String(sub.endpoint || '');
  const p256dh = String(sub.keys && sub.keys.p256dh || '');
  const auth = String(sub.keys && sub.keys.auth || '');
  if (endpoint.length > 800 || !PUSH_HOSTS.test(endpoint)) return null;
  if (!/^[A-Za-z0-9_-]{40,140}$/.test(p256dh) || !/^[A-Za-z0-9_-]{10,40}$/.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

function subscribe(business, customer, sub) {
  db.prepare(`INSERT INTO push_subs (business_id, customer_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(business_id, endpoint) DO UPDATE SET customer_id = excluded.customer_id,
      p256dh = excluded.p256dh, auth = excluded.auth, fails = 0`).run(business.id, customer.id, sub.endpoint, sub.p256dh, sub.auth, new Date().toISOString());
}
function unsubscribe(customer, endpoint) {
  return db.prepare('DELETE FROM push_subs WHERE customer_id = ? AND endpoint = ?').run(customer.id, String(endpoint || '')).changes;
}

function sentThisWeek(business) {
  return db.prepare('SELECT COUNT(*) AS n FROM push_sends WHERE business_id = ? AND created_at >= ?')
    .get(business.id, new Date(Date.now() - 7 * 86400000).toISOString()).n;
}
function nextAllowedAt(business) {
  const rows = db.prepare('SELECT created_at FROM push_sends WHERE business_id = ? AND created_at >= ? ORDER BY created_at ASC')
    .all(business.id, new Date(Date.now() - 7 * 86400000).toISOString());
  if (rows.length < LIMIT_PER_WEEK) return null;
  return new Date(new Date(rows[0].created_at).getTime() + 7 * 86400000).toISOString();
}
function subscriberCount(business) {
  return db.prepare('SELECT COUNT(DISTINCT customer_id) AS n FROM push_subs WHERE business_id = ?').get(business.id).n;
}

// Para pruebas en una computadora sin internet: PUSH_DRY_RUN=1 cuenta los avisos como entregados sin mandarlos.
let sender = (sub, payload) => process.env.PUSH_DRY_RUN === '1'
  ? Promise.resolve({ statusCode: 201 })
  : webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 24 * 3600, urgency: 'normal' });

// Manda un aviso a todos los clientes del negocio que lo activaron. Devuelve { targets, delivered, failed }.
async function sendToBusiness(business, body, actorName) {
  keys();
  const subs = db.prepare('SELECT * FROM push_subs WHERE business_id = ?').all(business.id);
  const icon = db.prepare('SELECT updated_at FROM app_icons WHERE business_id = ?').get(business.id);
  const payload = JSON.stringify({
    title: business.name, body,
    url: `/?n=${encodeURIComponent(business.slug)}`,
    icon: icon ? `/app/icono/${business.slug}-192.png?v=${Date.parse(icon.updated_at) || 0}` : '/app/redeo-192.png',
    tag: `vuelve-${business.slug}`
  });
  const sendId = db.prepare('INSERT INTO push_sends (business_id, body, actor_name, created_at, targets) VALUES (?, ?, ?, ?, ?)')
    .run(business.id, body, actorName || null, new Date().toISOString(), subs.length).lastInsertRowid;
  let delivered = 0, failed = 0;
  const now = new Date().toISOString();
  // De 20 en 20 para no saturar.
  for (let i = 0; i < subs.length; i += 20) {
    await Promise.all(subs.slice(i, i + 20).map(async sub => {
      try {
        await sender(sub, payload);
        delivered++;
        db.prepare('UPDATE push_subs SET last_ok_at = ?, fails = 0 WHERE id = ?').run(now, sub.id);
      } catch (e) {
        failed++;
        // 404/410: el cliente quitó el permiso o borró la app; esa dirección ya no sirve.
        if (e && (e.statusCode === 404 || e.statusCode === 410)) db.prepare('DELETE FROM push_subs WHERE id = ?').run(sub.id);
        else db.prepare('UPDATE push_subs SET fails = fails + 1 WHERE id = ?').run(sub.id);
      }
    }));
  }
  db.prepare('DELETE FROM push_subs WHERE business_id = ? AND fails >= 5').run(business.id);
  db.prepare('UPDATE push_sends SET delivered = ?, failed = ? WHERE id = ?').run(delivered, failed, sendId);
  return { targets: subs.length, delivered, failed };
}

module.exports = {
  LIMIT_PER_WEEK, MAX_BODY, publicKey, validSubscription, subscribe, unsubscribe, sentThisWeek, nextAllowedAt, subscriberCount, sendToBusiness,
  _setSender: fn => { sender = fn; }
};
