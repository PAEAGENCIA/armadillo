// Demos personalizadas para prospectos y su conversión a cuenta real.
// La demo es un negocio de verdad (así funciona todo igual), marcado como demo, con clientes de ejemplo.
// Cuando P.A.E. la aprueba, se borran los datos de ejemplo y se queda lo que el prospecto configuró
// (nombre, color, premio, productos, promociones) con su prueba gratis de 14 días.
// La prueba la puede activar el prospecto solo desde su demo (sin esperar a P.A.E.).
const crypto = require('crypto');
const db = require('./db');
const { todayMx, addDays } = require('./utils');
const { TERMS_VERSION } = require('./legal');

const DEMO_DAYS = 7;            // cuánto dura la demo si no pide nada
const DEMO_DAYS_REQUESTED = 21; // si ya pidió su prueba o contratar, se guarda más tiempo para que P.A.E. la active
const TRIAL_DAYS = 14;          // prueba gratis: 14 días naturales, contando el día en que se activa

const GIROS = {
  cafeteria:   { label: 'Cafetería',          reward: 'Un café gratis',         goal: 10, color: '#6B4226', icon: 'coffee',   products: ['Americano', 'Latte', 'Capuchino', 'Frappé', 'Pan dulce'] },
  panaderia:   { label: 'Panadería',          reward: 'Un pan dulce gratis',    goal: 10, color: '#A0522D', icon: 'bread',    products: ['Concha', 'Cuernito', 'Dona', 'Pan de elote', 'Pastel'] },
  restaurante: { label: 'Restaurante',        reward: 'Un postre gratis',       goal: 8,  color: '#9B2C2C', icon: 'flame',    products: ['Comida corrida', 'Tacos', 'Postre', 'Agua fresca'] },
  barberia:    { label: 'Barbería',           reward: 'Un corte gratis',        goal: 6,  color: '#1F2A37', icon: 'scissors', products: ['Corte', 'Barba', 'Corte y barba', 'Cejas'] },
  estetica:    { label: 'Estética o uñas',    reward: 'Un servicio gratis',     goal: 6,  color: '#8438B0', icon: 'diamond',  products: ['Manicure', 'Pedicure', 'Gelish', 'Pestañas'] },
  lavado:      { label: 'Lavado de autos',    reward: 'Un lavado gratis',       goal: 6,  color: '#2C56A8', icon: 'car',      products: ['Lavado sencillo', 'Lavado completo', 'Encerado', 'Aspirado'] },
  ropa:        { label: 'Ropa o calzado',     reward: '5% de cada compra en saldo', goal: 1, color: '#1A1320', icon: 'shirt', products: ['Vestido', 'Blusa', 'Pantalón', 'Zapatos', 'Accesorios'], wallet: 5, bonus: 50, tickets: [890, 1150, 650, 980, 1300, 720] },
  tienda:      { label: 'Tienda',             reward: 'Un regalo sorpresa',     goal: 10, color: '#0F5A45', icon: 'star',     products: ['Producto favorito', 'Novedad del mes'] },
  otro:        { label: 'Otro',               reward: 'Un regalo sorpresa',     goal: 10, color: '#0F5A45', icon: 'star',     products: ['Producto favorito', 'Novedad del mes'] }
};

// Clientes de ejemplo. visits: cuántas visitas; 'meta' = justo la meta (premio listo); 'meta+2' = ya canjeó una vez.
const SAMPLE = [
  { name: 'Mariana López',   visits: 'meta+2', from: 2,  every: 3, redeemed: true },
  { name: 'Jorge Ramírez',   visits: 'meta',   from: 0,  every: 3 },
  { name: 'Sofía Hernández', visits: 3,        from: 2,  every: 4 },
  { name: 'Carlos Méndez',   visits: 5,        from: 0,  every: 3 },
  { name: 'Ana Torres',      visits: 2,        from: 3,  every: 7, birthdayInDays: 2 },
  { name: 'Luis Pérez',      visits: 1,        from: 1,  every: 1 },
  { name: 'Diego Castro',    visits: 4,        from: 40, every: 5 },   // ya no viene: sale en "Te extrañamos"
  { name: 'Fernanda Ruiz',   visits: 2,        from: 5,  every: 9 },
  { name: 'Valeria Gómez',   pending: true }                           // solicitud por aprobar
];

function randomPin() { return String(crypto.randomInt(100000, 1000000)); }
// Fecha de ejemplo hace d días (siempre en el pasado, a distintas horas). 'extra' mueve unos minutos (para canjes).
function isoDaysAgo(d, extra) {
  const minutesBack = 45 + ((d * 53) % 360) - (extra ? 20 : 0);
  return new Date(Date.now() - d * 86400000 - minutesBack * 60000).toISOString();
}
function mmddInDays(n) {
  const t = new Date(Date.now() + n * 86400000);
  const s = t.toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
  return s.slice(5);
}

// Crea el negocio demo con datos de ejemplo. Devuelve { business, pin }.
function createDemoBusiness(lead, generateUniqueSlug) {
  const g = GIROS[lead.giro] || GIROS.otro;
  const pin = randomPin();
  const slug = generateUniqueSlug(lead.business_name);
  const now = new Date().toISOString();
  const promos = {
    welcome: { on: true }, days: { on: true, days: [2] }, happyHour: { on: false, from: '15:00', to: '18:00' },
    birthday: { on: true }, comeback: { on: true, days: 30 }, referral: { on: true },
    season: { on: false, from: '', to: '', name: 'Temporada doble' },
    signup: { on: true, text: g.wallet ? `$${g.bonus} de regalo en tu monedero al registrarte` : 'Tu primer ' + (g.goal > 6 ? 'sello doble' : 'servicio con 10% de descuento'), until: '' }
  };
  if (g.wallet) promos.referral.both = true;
  const info = db.prepare(`INSERT INTO businesses (slug, name, pin, mechanic, stamps_goal, points_goal, points_per_visit, wallet_pct, reward_desc, color, created_at, plan,
      products, stamp_icon, card_style, promos, owner_name, owner_phone, terms_version, terms_accepted_at, terms_accepted_by,
      is_demo, demo_expires_at, lead_id, feedback_on, feedback_reward, stamp_cooldown_on)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'premium', ?, ?, 'gradient', ?, ?, ?, ?, ?, 'Demo', 1, ?, ?, 1, 1, 0)`)
    .run(slug, String(lead.business_name).slice(0, 60), pin, g.wallet ? 'puntos' : 'sellos', g.wallet ? null : g.goal, g.wallet ? 1 : null, g.wallet ? g.bonus : null, g.wallet || null,
      g.reward, g.color, now, JSON.stringify(g.products), g.icon,
      JSON.stringify(promos), lead.contact_name, lead.whatsapp, TERMS_VERSION, now,
      new Date(Date.now() + DEMO_DAYS * 86400000).toISOString(), lead.id);
  const businessId = info.lastInsertRowid;

  // Un empleado de ejemplo (para que vea "quién dio cada sello")
  const staff = db.prepare("INSERT INTO staff_members (business_id, name, pin, active, created_at, last_seen_at) VALUES (?, 'Pau (ejemplo)', ?, 1, ?, ?)")
    .run(businessId, randomPin(), now, isoDaysAgo(0)).lastInsertRowid;

  const insC = db.prepare(`INSERT INTO customers (business_id, phone, name, email, progress, redemptions, created_at, status, card_token, birthday, marketing_opt_in, favorites, privacy_accepted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`);
  const insH = db.prepare(`INSERT INTO history (customer_id, type, amount, products, created_at, actor_type, actor_id, actor_name, method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insF = db.prepare('INSERT INTO feedback (business_id, customer_id, stars, comment, rewarded, created_at) VALUES (?, ?, ?, ?, 0, ?)');
  const comments = [[5, 'Me encanta que ya no tengo que cargar la tarjeta de papel.'], [5, 'Muy buena atención, ya casi llego a mi premio.'], [4, '']];

  SAMPLE.forEach((s, i) => {
    const phone = '55500000' + String(10 + i);
    const token = crypto.randomBytes(18).toString('base64url');
    const bday = s.birthdayInDays != null ? mmddInDays(s.birthdayInDays) : `0${1 + (i % 9)}-1${i % 9}`;
    const favs = JSON.stringify([g.products[i % g.products.length]]);
    const email = s.name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@ejemplo.com';
    if (s.pending) {
      insC.run(businessId, phone, s.name, email, 0, 0, isoDaysAgo(0), 'pending', token, bday, favs, now);
      return;
    }
    if (g.wallet) {   // monedero: compras con su ticket; Mariana ya usó parte de su saldo
      const n = s.visits === 'meta+2' ? 5 : s.visits === 'meta' ? 4 : s.visits;
      const days = Array.from({ length: n }, (_, k) => s.from * 3 + k * s.every * 6).reverse();
      let bal = 0;
      const cid = insC.run(businessId, phone, s.name, email, 0, s.redeemed ? 1 : 0, isoDaysAgo(days[0] + 1), 'active', token, bday, favs, now).lastInsertRowid;
      days.forEach((d, k) => {
        const ticket = g.tickets[(i + k) % g.tickets.length], credit = Math.round(ticket * g.wallet / 100);
        const byStaff = k % 3 !== 0;
        db.prepare(`INSERT INTO history (customer_id, type, amount, products, created_at, actor_type, actor_id, actor_name, method, ticket) VALUES (?, 'add', ?, ?, ?, ?, ?, ?, 'scan', ?)`)
          .run(cid, credit, JSON.stringify([g.products[(i + k) % g.products.length]]), isoDaysAgo(d), byStaff ? 'member' : 'owner', byStaff ? staff : null, byStaff ? 'Pau (ejemplo)' : null, ticket);
        bal += credit;
        if (s.redeemed && k === 2) { const use = Math.min(bal, 100); insH.run(cid, 'redeem', use, '[]', isoDaysAgo(d, true), 'member', staff, 'Pau (ejemplo)', 'scan'); bal -= use; }
      });
      db.prepare('UPDATE customers SET progress = ? WHERE id = ?').run(bal, cid);
      if (i < comments.length) insF.run(businessId, cid, comments[i][0], (i === 1 ? 'Me encanta juntar saldo para mi siguiente compra.' : comments[i][1]) || null, isoDaysAgo(i + 1));
      return;
    }
    const goal = g.goal;
    const visits = s.visits === 'meta' ? goal : s.visits === 'meta+2' ? goal + 2 : Math.min(s.visits, goal - 1);
    const progress = s.redeemed ? visits - goal : visits;
    const days = Array.from({ length: visits }, (_, k) => s.from + k * s.every);   // k = 0 es la visita más reciente
    const first = Math.max(...days) + 1;
    const cid = insC.run(businessId, phone, s.name, email, progress, s.redeemed ? 1 : 0, isoDaysAgo(first), 'active', token, bday, favs, now).lastInsertRowid;
    days.slice().reverse().forEach((d, k) => {            // de la más antigua a la más reciente
      const byStaff = k % 3 !== 0;
      insH.run(cid, 'add', 1, JSON.stringify([g.products[(i + k) % g.products.length]]), isoDaysAgo(d),
        byStaff ? 'member' : 'owner', byStaff ? staff : null, byStaff ? 'Pau (ejemplo)' : null, 'scan');
      if (s.redeemed && k === goal - 1) insH.run(cid, 'redeem', goal, '[]', isoDaysAgo(d, true), 'member', staff, 'Pau (ejemplo)', 'scan');
    });
    if (i < comments.length) insF.run(businessId, cid, comments[i][0], comments[i][1] || null, isoDaysAgo(i + 1));
  });
  return { business: db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId), pin };
}

// Borra los datos de ejemplo de un negocio (clientes, historial, opiniones, equipo de ejemplo).
function wipeSampleData(businessId) {
  db.prepare('DELETE FROM history WHERE customer_id IN (SELECT id FROM customers WHERE business_id = ?)').run(businessId);
  db.prepare('DELETE FROM feedback WHERE business_id = ?').run(businessId);
  db.prepare('DELETE FROM customers WHERE business_id = ?').run(businessId);
  db.prepare('DELETE FROM security_events WHERE business_id = ?').run(businessId);
  db.prepare('DELETE FROM staff_members WHERE business_id = ?').run(businessId);
}

function deleteBusiness(businessId) {
  db.transaction(() => {
    wipeSampleData(businessId);
    db.prepare('DELETE FROM payments WHERE business_id = ?').run(businessId);
    db.prepare('DELETE FROM businesses WHERE id = ?').run(businessId);
  })();
}

// Convierte el prospecto en cuenta real: su demo se vuelve su negocio (sin datos de ejemplo) con prueba gratis.
// Si ya no tiene demo, se crea el negocio con lo que llenó. Devuelve { business, pin }.
function approveLead(lead, opts, generateUniqueSlug) {
  const plan = opts.plan === 'premium' ? 'premium' : 'esencial';
  const trialDays = Math.max(0, Math.min(365, Math.round(Number(opts.trialDays ?? TRIAL_DAYS))));
  const accessType = trialDays ? 'trial' : null;
  const accessUntil = trialDays ? addDays(todayMx(), trialDays - 1) : null;
  let business = lead.business_id ? db.prepare('SELECT * FROM businesses WHERE id = ?').get(lead.business_id) : null;
  let pin;
  db.transaction(() => {
    if (business && business.is_demo) {
      wipeSampleData(business.id);
      pin = business.pin;   // se queda su PIN: si sigue con la sesión abierta en su celular, entra directo a su cuenta real
      db.prepare(`UPDATE businesses SET is_demo = 0, demo_expires_at = NULL, plan = ?, access_type = ?, access_until = ?,
          terms_version = NULL, terms_accepted_at = NULL, terms_accepted_by = NULL, terms_ip = NULL,
          owner_name = COALESCE(owner_name, ?), owner_phone = COALESCE(owner_phone, ?), feedback_reward = 0 WHERE id = ?`)
        .run(plan, accessType, accessUntil, lead.contact_name, lead.whatsapp, business.id);
    } else {
      const g = GIROS[lead.giro] || GIROS.otro;
      pin = randomPin();
      const slug = generateUniqueSlug(lead.business_name);
      const id = db.prepare(`INSERT INTO businesses (slug, name, pin, mechanic, stamps_goal, points_goal, points_per_visit, wallet_pct, reward_desc, color, created_at, plan,
          products, stamp_icon, access_type, access_until, owner_name, owner_phone, lead_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(slug, String(lead.business_name).slice(0, 60), pin, g.wallet ? 'puntos' : 'sellos', g.wallet ? null : g.goal, g.wallet ? 1 : null, g.wallet ? g.bonus : null, g.wallet || null,
          g.reward, g.color, new Date().toISOString(), plan,
          JSON.stringify(g.products), g.icon, accessType, accessUntil, lead.contact_name, lead.whatsapp, lead.id).lastInsertRowid;
      business = { id };
    }
    db.prepare("UPDATE leads SET status = 'aprobado', approved_at = ?, updated_at = ?, business_id = ? WHERE id = ?")
      .run(new Date().toISOString(), new Date().toISOString(), business.id, lead.id);
  })();
  return { business: db.prepare('SELECT * FROM businesses WHERE id = ?').get(business.id), pin };
}

// Borra las demos vencidas que nadie aprobó (el prospecto se queda en la lista como "vencido").
function cleanupDemos() {
  try {
    const old = db.prepare("SELECT id, lead_id FROM businesses WHERE is_demo = 1 AND demo_expires_at IS NOT NULL AND demo_expires_at < ?").all(new Date().toISOString());
    for (const b of old) {
      deleteBusiness(b.id);
      if (b.lead_id) db.prepare("UPDATE leads SET status = CASE WHEN status = 'probando' THEN 'vencido' ELSE status END, business_id = NULL, updated_at = ? WHERE id = ?").run(new Date().toISOString(), b.lead_id);
    }
    if (old.length) console.log(`[demos] ${old.length} demo(s) vencida(s) borrada(s).`);
  } catch (e) { console.error('[demos]', e.message); }
}

module.exports = { GIROS, DEMO_DAYS, DEMO_DAYS_REQUESTED, TRIAL_DAYS, createDemoBusiness, approveLead, deleteBusiness, cleanupDemos };
