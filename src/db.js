const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// En Railway, al conectar un volumen, RAILWAY_VOLUME_MOUNT_PATH apunta al disco persistente.
// En tu computadora, los datos se guardan en la carpeta ./data del proyecto.
const DATA_DIR =
  process.env.DATA_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  path.join(__dirname, '..', 'data');

fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'vuelve.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    pin TEXT NOT NULL,
    mechanic TEXT NOT NULL CHECK(mechanic IN ('sellos','puntos')),
    stamps_goal INTEGER,
    points_goal INTEGER,
    points_per_visit INTEGER,
    reward_desc TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    name TEXT,
    progress INTEGER NOT NULL DEFAULT 0,
    redemptions INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(business_id, phone)
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('add','redeem')),
    amount INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Migración: las bases creadas antes de las solicitudes no tienen la columna "status".
// Los clientes que ya existían quedan como activos.
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumnIfMissing('customers', 'status', "TEXT NOT NULL DEFAULT 'active'");
addColumnIfMissing('customers', 'email', 'TEXT');
addColumnIfMissing('customers', 'favorites', "TEXT NOT NULL DEFAULT '[]'");
addColumnIfMissing('customers', 'marketing_opt_in', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('customers', 'privacy_accepted_at', 'TEXT');
addColumnIfMissing('businesses', 'products', "TEXT NOT NULL DEFAULT '[]'");
addColumnIfMissing('history', 'products', "TEXT NOT NULL DEFAULT '[]'");

// Planes y diseño Premium. Los negocios que ya existían (piloto) quedan en Premium
// para que no pierdan funciones que ya estaban usando.
const hadPlan = db.prepare('PRAGMA table_info(businesses)').all().some(c => c.name === 'plan');
addColumnIfMissing('businesses', 'plan', "TEXT NOT NULL DEFAULT 'esencial'");
if (!hadPlan) db.exec("UPDATE businesses SET plan = 'premium'");
addColumnIfMissing('businesses', 'logo', 'TEXT');                 // imagen en base64 (PNG/JPG/WEBP, máx. ~200 KB)
addColumnIfMissing('businesses', 'logo_version', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('businesses', 'stamp_icon', "TEXT NOT NULL DEFAULT 'check'");
addColumnIfMissing('businesses', 'card_title', 'TEXT');
addColumnIfMissing('businesses', 'card_style', "TEXT NOT NULL DEFAULT 'gradient'");

// Seguridad: PIN del personal (opcional) y una clave secreta por cliente para que
// solo él (desde su liga) y el negocio puedan ver su avance.
addColumnIfMissing('businesses', 'staff_pin', 'TEXT');
addColumnIfMissing('customers', 'card_token', 'TEXT');
// Vigencia del servicio: 'trial' (prueba) o 'paid' (pagado) hasta una fecha 'YYYY-MM-DD'.
// Sin fecha = sin límite (así quedan los negocios que ya existían).
addColumnIfMissing('businesses', 'access_type', 'TEXT');
addColumnIfMissing('businesses', 'access_until', 'TEXT');
addColumnIfMissing('customers', 'birthday', 'TEXT');   // 'MM-DD' (día y mes, sin año): con esto el cliente abre su tarjeta desde cualquier celular
{
  const crypto = require('crypto');
  const missing = db.prepare('SELECT id FROM customers WHERE card_token IS NULL').all();
  const setToken = db.prepare('UPDATE customers SET card_token = ? WHERE id = ?');
  db.transaction(() => {
    for (const row of missing) setToken.run(crypto.randomBytes(18).toString('base64url'), row.id);
  })();
}

// Premium: dinámicas de promociones, quién invitó a cada cliente y el motivo de sellos de regalo.
addColumnIfMissing('businesses', 'promos', "TEXT NOT NULL DEFAULT '{}'");
addColumnIfMissing('customers', 'referred_by', 'TEXT');
addColumnIfMissing('history', 'reason', 'TEXT');
addColumnIfMissing('history', 'parent_id', 'INTEGER');   // sellos extra ligados a la visita que los generó (para poder deshacer todo junto)   // NULL = visita normal; 'doble' | 'bienvenida' | 'referido' | 'regalo'

// Membresías: datos del dueño, precio acordado y pagos recibidos (solo los ve P.A.E.).
addColumnIfMissing('businesses', 'owner_name', 'TEXT');
addColumnIfMissing('businesses', 'owner_phone', 'TEXT');
addColumnIfMissing('businesses', 'owner_email', 'TEXT');
addColumnIfMissing('businesses', 'price_monthly', 'INTEGER');            // pesos al mes; vacío = precio de lista del plan
addColumnIfMissing('businesses', 'billing_cycle', "TEXT NOT NULL DEFAULT 'mensual'");
addColumnIfMissing('businesses', 'admin_notes', 'TEXT');
db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    folio TEXT NOT NULL,
    amount INTEGER NOT NULL,
    method TEXT NOT NULL,
    months INTEGER NOT NULL,
    plan TEXT,
    paid_at TEXT NOT NULL,
    covers_from TEXT,
    covers_to TEXT,
    note TEXT,
    created_at TEXT NOT NULL
  );
`);

// Legal: datos del negocio para su aviso de privacidad, y constancia de aceptación de los Términos.
addColumnIfMissing('businesses', 'legal_name', 'TEXT');        // nombre o razón social (responsable de los datos de sus clientes)
addColumnIfMissing('businesses', 'legal_address', 'TEXT');     // domicilio que aparece en su aviso de privacidad
addColumnIfMissing('businesses', 'privacy_email', 'TEXT');     // correo para que sus clientes pidan ver, corregir o borrar sus datos
addColumnIfMissing('businesses', 'terms_version', 'TEXT');
addColumnIfMissing('businesses', 'terms_accepted_at', 'TEXT');
addColumnIfMissing('businesses', 'terms_accepted_by', 'TEXT');
addColumnIfMissing('businesses', 'terms_ip', 'TEXT');
addColumnIfMissing('customers', 'privacy_version', 'TEXT');
addColumnIfMissing('customers', 'google_wallet', 'INTEGER NOT NULL DEFAULT 0');   // 1 = guardó su tarjeta en Google Wallet (se mantiene al día)    // versión del aviso que aceptó el cliente

// Seguridad del personal:
// - Cada empleado con su propio PIN (así cada sello dice quién lo dio).
// - Cada movimiento guarda quién lo hizo y cómo (escaneado, a mano o con código verificado).
// - Límite de tiempo entre sellos del mismo cliente y "modo estricto" (código que cambia cada 30 s y sirve una vez).
db.exec(`
  CREATE TABLE IF NOT EXISTS staff_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pin TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    last_seen_at TEXT
  );
  CREATE INDEX IF NOT EXISTS staff_members_business ON staff_members(business_id);
  CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id INTEGER,
    customer_name TEXT,
    actor_type TEXT,
    actor_id INTEGER,
    actor_name TEXT,
    kind TEXT NOT NULL,          -- 'cooldown' | 'strict' | 'bad_code' | 'undo'
    detail TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS security_events_business ON security_events(business_id, created_at);
`);
addColumnIfMissing('history', 'actor_type', 'TEXT');     // 'owner' | 'staff' (PIN general) | 'member' (empleado con su PIN)
addColumnIfMissing('history', 'actor_id', 'INTEGER');
addColumnIfMissing('history', 'actor_name', 'TEXT');
addColumnIfMissing('history', 'method', 'TEXT');         // 'scan' | 'manual' | 'code' (código de un uso verificado)
addColumnIfMissing('history', 'forced', 'INTEGER NOT NULL DEFAULT 0');   // el dueño lo dio aunque no había pasado el tiempo mínimo
addColumnIfMissing('businesses', 'stamp_cooldown_min', 'INTEGER NOT NULL DEFAULT 120');   // minutos entre sellos del mismo cliente
addColumnIfMissing('businesses', 'stamp_cooldown_on', 'INTEGER NOT NULL DEFAULT 0');      // el dueño lo activa si lo necesita
addColumnIfMissing('businesses', 'strict_mode', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('customers', 'qr_secret', 'TEXT');
addColumnIfMissing('customers', 'qr_last_step', 'INTEGER');
addColumnIfMissing('customers', 'qr_last_actions', 'TEXT');

// Ubicación del negocio y opiniones de sus clientes (todos los planes).
addColumnIfMissing('businesses', 'maps_url', 'TEXT');                 // liga de Google Maps ("Cómo llegar")
addColumnIfMissing('businesses', 'review_url', 'TEXT');               // liga para dejar reseña en Google (opcional)
addColumnIfMissing('businesses', 'feedback_on', 'INTEGER NOT NULL DEFAULT 0');       // pedir calificación dentro de la tarjeta
addColumnIfMissing('businesses', 'feedback_reward', 'INTEGER NOT NULL DEFAULT 0');   // regalar 1 sello por la primera opinión
db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    stars INTEGER NOT NULL,
    comment TEXT,
    rewarded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS feedback_business ON feedback(business_id, created_at);
`);

// Prospectos (negocios interesados) y demos personalizadas.
addColumnIfMissing('businesses', 'is_demo', 'INTEGER NOT NULL DEFAULT 0');   // 1 = demo de un prospecto (datos de ejemplo)
addColumnIfMissing('businesses', 'demo_expires_at', 'TEXT');                 // la demo se borra sola después de esta fecha
addColumnIfMissing('businesses', 'lead_id', 'INTEGER');
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_name TEXT NOT NULL,
    business_name TEXT NOT NULL,
    giro TEXT,
    whatsapp TEXT NOT NULL,
    status TEXT NOT NULL,           -- probando | solicito_prueba | solicito_contratar | quiere_contacto | aprobado | descartado | vencido
    contact_time TEXT,
    message TEXT,
    notes TEXT,
    business_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    requested_at TEXT,
    approved_at TEXT,
    last_seen_at TEXT,
    ip TEXT
  );
  CREATE INDEX IF NOT EXISTS leads_created ON leads(created_at);
`);

// Lotes de precio ("precio de fundador") y avisos de pago de la membresía.
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS payment_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    method TEXT NOT NULL,            -- Transferencia | Depósito | Efectivo
    months INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    reference TEXT,
    note TEXT,
    status TEXT NOT NULL,            -- pendiente | confirmado | rechazado
    reject_reason TEXT,
    payment_id INTEGER,
    created_at TEXT NOT NULL,
    resolved_at TEXT
  );
  -- Lugares ocupados en cada lote. Un lugar ocupado ya no se libera (el contador de la portada nunca "regresa").
  CREATE TABLE IF NOT EXISTS tier_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    tier_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS tier_claims_tier ON tier_claims(tier_id);
`);
addColumnIfMissing('businesses', 'tier_id', 'TEXT');          // lote en el que entró (al pagar por primera vez)
addColumnIfMissing('businesses', 'tier_name', 'TEXT');
addColumnIfMissing('businesses', 'tier_label', 'TEXT');
addColumnIfMissing('businesses', 'tier_esencial', 'INTEGER'); // precio congelado del lote (Esencial)
addColumnIfMissing('businesses', 'tier_premium', 'INTEGER');  // precio congelado del lote (Premium)
addColumnIfMissing('businesses', 'tier_joined_at', 'TEXT');

// Monedero (saldo a favor): para negocios de ticket alto (ropa, zapatos, ópticas…).
// Se guarda como mecánica "puntos" (1 punto = $1 de saldo) con el % que regresa cada compra.
addColumnIfMissing('businesses', 'wallet_pct', 'INTEGER');     // % de cada compra que se vuelve saldo (vacío = no es monedero)
addColumnIfMissing('history', 'ticket', 'INTEGER');            // monto de la compra (solo monedero)

// ---------- Redeo 2.0 ----------
// Premios a elegir (Premium): menú de premios por sellos o puntos, ej. [{ id, name, cost }].
addColumnIfMissing('businesses', 'rewards', "TEXT NOT NULL DEFAULT '[]'");
addColumnIfMissing('history', 'reward_name', 'TEXT');          // qué premio eligió el cliente al canjear
// Niveles de cliente (Premium): Frecuente, VIP… según sus visitas recientes.
addColumnIfMissing('businesses', 'levels', "TEXT NOT NULL DEFAULT '{}'");
// Recordatorios por tiempo (Premium): "ya te toca tu corte", "ya toca la vacuna".
addColumnIfMissing('businesses', 'reminders', "TEXT NOT NULL DEFAULT '{}'");
addColumnIfMissing('customers', 'remind_days', 'INTEGER');     // cada cuántos días le toca (vacío = lo del negocio; 0 = no recordarle)
addColumnIfMissing('customers', 'remind_at', 'TEXT');          // fecha fija 'YYYY-MM-DD' (ej. la próxima vacuna)
addColumnIfMissing('customers', 'remind_note', 'TEXT');        // de qué es el recordatorio (ej. "Vacuna de Firulais")
addColumnIfMissing('customers', 'remind_sent_at', 'TEXT');     // cuándo se le mandó el último recordatorio
// "¿Cómo nos conociste?" (v2.3): calle, recomendacion, redes, google, cliente u otro.
addColumnIfMissing('customers', 'source', 'TEXT');
addColumnIfMissing('customers', 'source_detail', 'TEXT');      // red social (instagram, facebook…) o el texto de "Otro"
addColumnIfMissing('customers', 'source_at', 'TEXT');
addColumnIfMissing('payment_reports', 'plan', 'TEXT');   // plan que eligió el dueño al pagar (2.9)
db.exec(`
  -- Código de compra: el cajero lo crea con el monto y el cliente lo escanea (en caja, por WhatsApp o impreso en su ticket).
  CREATE TABLE IF NOT EXISTS purchase_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    amount INTEGER NOT NULL,          -- sellos, puntos o pesos de saldo que da
    ticket INTEGER,                   -- monto de la compra (monedero)
    products TEXT NOT NULL DEFAULT '[]',
    note TEXT,                        -- referencia opcional (ej. "Pedido 1042" o "Mesa 4")
    actor_type TEXT, actor_id INTEGER, actor_name TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    customer_id INTEGER,
    history_id INTEGER,
    canceled_at TEXT
  );
  CREATE INDEX IF NOT EXISTS purchase_codes_business ON purchase_codes(business_id, created_at);
  -- Ícono de la app de cada negocio (lo dibuja el celular del dueño y se guarda aquí).
  CREATE TABLE IF NOT EXISTS app_icons (
    business_id INTEGER PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    sig TEXT NOT NULL,
    png192 BLOB, png512 BLOB, png180 BLOB,
    updated_at TEXT NOT NULL
  );
`);

// Avisos al celular (Premium): el cliente da permiso desde su tarjeta y el negocio manda avisos desde Crecer.
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,          -- un mismo celular puede tener avisos de varios negocios
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_ok_at TEXT,
    fails INTEGER NOT NULL DEFAULT 0,
    UNIQUE(business_id, endpoint)
  );
  CREATE INDEX IF NOT EXISTS push_subs_business ON push_subs(business_id);
  CREATE TABLE IF NOT EXISTS push_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    actor_name TEXT,
    created_at TEXT NOT NULL,
    targets INTEGER NOT NULL DEFAULT 0,
    delivered INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS push_sends_business ON push_sends(business_id, created_at);
`);

// Stickers con QR (se imprimen sin negocio y se conectan a uno en la visita).
db.exec(`
  CREATE TABLE IF NOT EXISTS stickers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    batch TEXT NOT NULL,             -- el lote con el que se imprimió (para volver a imprimirlo)
    business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
    assigned_at TEXT,
    scans INTEGER NOT NULL DEFAULT 0,
    last_scan_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS stickers_business ON stickers(business_id);
`);

db.DB_PATH = DB_PATH;
module.exports = db;
