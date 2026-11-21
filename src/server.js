require('dotenv').config();
const path = require('path');
const express = require('express');

const db = require('./db');
const { router: businessesRouter, adminRequired } = require('./routes/businesses');
const customersRouter = require('./routes/customers');
const walletRouter = require('./routes/wallet');
const growthRouter = require('./routes/growth');
const adminRouter = require('./routes/admin');
const demoRouter = require('./routes/demo');
const purchasesRouter = require('./routes/purchases');   // Redeo 2.0: código de compra
const appRouter = require('./routes/app');               // Redeo 2.0: app instalable (manifiesto e íconos)
const pushRouter = require('./routes/push');             // Redeo 2.1: avisos al celular
const push = require('./push');
const stickersRouter = require('./routes/stickers');     // Redeo 2.2: stickers con QR que se activan en la visita
const { cleanupDemos } = require('./demo');
const pricing = require('./pricing');
pricing.migrateExistingPayers();
const { isAppleConfigured } = require('./services/appleWallet');
const { isGoogleConfigured } = require('./services/googleWallet');

const app = express();
app.set('trust proxy', 1); // Railway pone un proxy delante; así se ve la IP real de cada visitante.
app.disable('x-powered-by');
const jsonSmall = express.json({ limit: '20kb' });
const jsonLogo = express.json({ limit: '400kb' });
app.use((req, res, next) => {
  if (/\/app-icon$/.test(req.path)) return next();                 // el ícono de la app trae su propio límite (routes/app.js)
  return (/\/logo$/.test(req.path) ? jsonLogo : jsonSmall)(req, res, next);
});

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Lo que la interfaz necesita saber al abrir: si pide clave de administrador y si Wallet ya está activo.
const { paeLegal, TERMS_VERSION } = require('./legal');

app.get('/api/config', (req, res) => {
  res.json({
    adminRequired: adminRequired(),
    storageWarning: Boolean(process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_VOLUME_MOUNT_PATH && !process.env.DATA_DIR),
    wallet: { apple: isAppleConfigured(), google: isGoogleConfigured() },
    legal: { ...paeLegal(), termsVersion: TERMS_VERSION },
    pricing: pricing.publicPricing(),
    push: { publicKey: push.publicKey() },     // para que el celular del cliente pueda activar los avisos
    publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, '')   // el dominio que va en los QR de los stickers
  });
});

app.use(appRouter);
app.use(stickersRouter);
app.use('/api/admin', adminRouter);
app.use('/api', demoRouter);        // demos y prospectos (antes que /api/businesses)
app.use('/api/businesses', businessesRouter);
app.use('/api/businesses/:slug/customers', customersRouter);
app.use('/api/businesses/:slug/wallet', walletRouter);
app.use('/api/businesses/:slug/growth', growthRouter);
app.use('/api/businesses/:slug/purchases', purchasesRouter);
app.use('/api/businesses/:slug/push', pushRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// La interfaz (panel del negocio y vista del cliente)
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, { index: 'index.html', maxAge: 0 }));
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Datos inválidos.' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// Las demos que nadie activó se borran solas (se revisa al arrancar y cada hora).
cleanupDemos();
setInterval(cleanupDemos, 60 * 60 * 1000).unref();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Redeo corriendo en http://localhost:${PORT}`);
  console.log(`Base de datos: ${db.DB_PATH}`);
  if (process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_VOLUME_MOUNT_PATH && !process.env.DATA_DIR) {
    console.log('AVISO: no hay volumen conectado. Los datos se BORRARÁN en cada despliegue. Agrega un volumen en /data.');
  }
  if (!adminRequired()) {
    console.log('Aviso: ADMIN_KEY no está configurada; cualquiera puede crear negocios.');
  }
});
