// Google Wallet: cada negocio es una "clase" (diseño de su tarjeta) y cada cliente un "objeto" (su tarjeta).
// Cuando el cliente guarda su tarjeta, Redeo la mantiene al día: cada sello, canje o corrección
// se refleja solo en su Google Wallet.
const { GoogleAuth } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { goalFor, isPremium, isWallet } = require('../utils');

const WALLET_API_BASE = 'https://walletobjects.googleapis.com/walletobjects/v1';

function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_ISSUER_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

// Dirección pública de la app (Google descarga de aquí el logo de cada tarjeta).
function publicUrl() {
  return String(process.env.PUBLIC_URL || 'https://redeo.app').replace(/\/+$/, '');
}

function getPrivateKey() {
  // En Railway la llave se pega con saltos de línea escapados (\n)
  return process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n');
}

function sanitizeId(str) {
  return String(str).replace(/[^A-Za-z0-9_.-]/g, '-');
}

function classIdFor(business) {
  return `${process.env.GOOGLE_ISSUER_ID}.${sanitizeId(business.slug)}`;
}

// Se usa el número interno del cliente (no su teléfono) para que la tarjeta siga siendo la misma
// aunque el negocio le corrija el teléfono.
function objectIdFor(business, customer) {
  return `${process.env.GOOGLE_ISSUER_ID}.${sanitizeId(business.slug)}-c${customer.id}`;
}

let cachedToken = null;
async function getAccessToken() {
  if (cachedToken && cachedToken.exp > Date.now() + 60000) return cachedToken.token;
  const auth = new GoogleAuth({
    credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: getPrivateKey() },
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  cachedToken = { token, exp: Date.now() + 45 * 60 * 1000 };
  return token;
}

async function api(method, path, body) {
  const token = await getAccessToken();
  const res = await fetch(`${WALLET_API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* sin cuerpo */ }
  return { status: res.status, ok: res.ok, data };
}

// Logo de la tarjeta: el del negocio si es Premium (PNG o JPG); si no, el de Redeo.
function logoUrlFor(business) {
  if (isPremium(business) && business.logo && /^image\/(png|jpeg)/.test(business.logo)) {
    return `${publicUrl()}/api/businesses/${encodeURIComponent(business.slug)}/logo?v=${business.logo_version || 0}`;
  }
  return `${publicUrl()}/wallet/redeo-logo.png`;
}

const es = (value) => ({ defaultValue: { language: 'es-MX', value: String(value) } });

function classBody(business) {
  const programName = (isPremium(business) && business.card_title) || 'Tarjeta de lealtad';
  return {
    id: classIdFor(business),
    issuerName: business.name,
    programName,
    programLogo: { sourceUri: { uri: logoUrlFor(business) }, contentDescription: es(business.name) },
    hexBackgroundColor: business.color,
    countryCode: 'MX',
    reviewStatus: 'UNDER_REVIEW',
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES'
  };
}

// Crea el diseño de la tarjeta del negocio, o lo actualiza si cambió su nombre, color o logo.
async function ensureLoyaltyClass(business) {
  const body = classBody(business);
  const found = await api('GET', `/loyaltyClass/${body.id}`);
  if (found.status === 404) {
    const created = await api('POST', '/loyaltyClass', body);
    if (!created.ok && created.status !== 409) throw new Error(`Google Wallet no aceptó la tarjeta del negocio (${created.status}): ${JSON.stringify(created.data)}`);
    return body.id;
  }
  if (!found.ok) throw new Error(`No se pudo consultar Google Wallet (${found.status}): ${JSON.stringify(found.data)}`);
  const c = found.data || {};
  const changed = c.issuerName !== body.issuerName || c.programName !== body.programName ||
    (c.hexBackgroundColor || '').toUpperCase() !== String(body.hexBackgroundColor || '').toUpperCase() ||
    (((c.programLogo || {}).sourceUri || {}).uri) !== body.programLogo.sourceUri.uri;
  if (changed) {
    const upd = await api('PATCH', `/loyaltyClass/${body.id}`, body);
    if (!upd.ok) throw new Error(`No se pudo actualizar el diseño en Google Wallet (${upd.status}): ${JSON.stringify(upd.data)}`);
  }
  return body.id;
}

function objectBody(business, customer) {
  const goal = goalFor(business);
  const sellos = business.mechanic === 'sellos';
  const wallet = isWallet(business);
  const unitWord = (n) => sellos ? (n === 1 ? 'sello' : 'sellos') : (n === 1 ? 'punto' : 'puntos');
  const left = Math.max(0, goal - customer.progress);
  const cardUrl = `${publicUrl()}/?n=${encodeURIComponent(business.slug)}&c=${encodeURIComponent(customer.phone)}&t=${encodeURIComponent(customer.card_token || '')}`;
  return {
    id: objectIdFor(business, customer),
    classId: classIdFor(business),
    state: 'ACTIVE',
    accountName: customer.name || customer.phone,
    accountId: customer.phone,
    loyaltyPoints: wallet
      ? { label: 'Saldo a favor', balance: { money: { micros: Number(customer.progress) * 1000000, currencyCode: 'MXN' } } }
      : { label: sellos ? 'Sellos' : 'Puntos', balance: { string: `${customer.progress}/${goal}` } },
    secondaryLoyaltyPoints: wallet ? undefined : { label: 'Premios', balance: { int: customer.redemptions || 0 } },
    barcode: { type: 'QR_CODE', value: `${business.slug}:${customer.phone}`, alternateText: customer.phone },
    textModulesData: wallet ? [
      { id: 'premio', header: 'Monedero', body: `Ganas ${business.wallet_pct}% de cada compra en saldo a favor.` },
      { id: 'avance', header: 'Tu saldo', body: customer.progress > 0 ? `Tienes $${Number(customer.progress).toLocaleString('es-MX')} para usar en tu próxima compra.` : 'Tu saldo aparece aquí en cuanto hagas tu primera compra.' }
    ] : [
      { id: 'premio', header: 'Premio', body: business.reward_desc },
      { id: 'avance', header: 'Tu avance', body: left === 0 ? '¡Ya tienes tu premio! Muéstrale esta tarjeta al personal.' : `Te ${left === 1 ? 'falta' : 'faltan'} ${left} ${unitWord(left)} para tu premio.` }
    ],
    linksModuleData: { uris: [
      { id: 'tarjeta', uri: cardUrl, description: 'Ver mi tarjeta y mi historial' },
      ...(business.maps_url ? [{ id: 'ubicacion', uri: business.maps_url, description: 'Cómo llegar' }] : []),
      ...(business.review_url || business.maps_url ? [{ id: 'resena', uri: business.review_url || business.maps_url, description: 'Déjanos tu opinión en Google' }] : [])
    ] }
  };
}

// Crea o actualiza la tarjeta del cliente en Google.
async function upsertObject(business, customer) {
  const body = objectBody(business, customer);
  const found = await api('GET', `/loyaltyObject/${body.id}`);
  if (found.status === 404) {
    const created = await api('POST', '/loyaltyObject', body);
    if (!created.ok && created.status !== 409) throw new Error(`Google Wallet no aceptó la tarjeta del cliente (${created.status}): ${JSON.stringify(created.data)}`);
    return body.id;
  }
  if (!found.ok) throw new Error(`No se pudo consultar Google Wallet (${found.status}): ${JSON.stringify(found.data)}`);
  const upd = await api('PATCH', `/loyaltyObject/${body.id}`, body);
  if (!upd.ok) throw new Error(`No se pudo actualizar la tarjeta en Google Wallet (${upd.status}): ${JSON.stringify(upd.data)}`);
  return body.id;
}

// Liga "Guardar en Google Wallet". La tarjeta se crea antes en Google, así la liga solo la señala.
async function generateGoogleSaveLink(business, customer) {
  if (!isGoogleConfigured()) {
    const err = new Error('Google Wallet todavía no está activado.');
    err.code = 'GOOGLE_NOT_CONFIGURED';
    throw err;
  }
  const classId = await ensureLoyaltyClass(business);
  const objectId = await upsertObject(business, customer);
  db.prepare('UPDATE customers SET google_wallet = 1 WHERE id = ?').run(customer.id);
  const payload = {
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins: [publicUrl()],
    payload: { loyaltyObjects: [{ id: objectId, classId }] }
  };
  const token = jwt.sign(payload, getPrivateKey(), { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}

// ---------- Mantener al día las tarjetas guardadas (en segundo plano, nunca frena la caja) ----------
function quietly(promise, what) {
  promise.catch(err => console.error(`[Google Wallet] ${what}:`, err.message));
}

// Actualiza la tarjeta de un cliente, solo si alguna vez la guardó en Google Wallet.
function syncCustomer(customerId) {
  if (!isGoogleConfigured() || !customerId) return;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer || !customer.google_wallet) return;
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(customer.business_id);
  if (!business) return;
  quietly(upsertObject(business, customer), `actualizar cliente ${customerId}`);
}

// Cuando se borra un cliente: su tarjeta de Google queda desactivada.
function deactivateCustomer(business, customer) {
  if (!isGoogleConfigured() || !customer || !customer.google_wallet) return;
  const id = objectIdFor(business, customer);
  quietly(api('PATCH', `/loyaltyObject/${id}`, { state: 'INACTIVE' }).then(r => {
    if (!r.ok && r.status !== 404) throw new Error(`(${r.status}) ${JSON.stringify(r.data)}`);
  }), `desactivar cliente ${customer.id}`);
}

// Cuando el negocio cambia su nombre, color, logo, premio o meta: se actualiza su diseño
// y las tarjetas ya guardadas (en lotes pequeños para no saturar a Google).
function syncBusiness(businessId) {
  if (!isGoogleConfigured() || !businessId) return;
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!business) return;
  const saved = db.prepare('SELECT * FROM customers WHERE business_id = ? AND google_wallet = 1').all(businessId);
  if (!saved.length) return;
  quietly((async () => {
    await ensureLoyaltyClass(business);
    for (const c of saved) {
      try { await upsertObject(business, c); } catch (e) { console.error('[Google Wallet] cliente', c.id, e.message); }
    }
  })(), `actualizar negocio ${businessId}`);
}

module.exports = { isGoogleConfigured, generateGoogleSaveLink, syncCustomer, syncBusiness, deactivateCustomer, logoUrlFor, classBody, objectBody };
