// Datos legales de P.A.E. (van en los Términos y en los avisos de privacidad).
// Se configuran como variables en Railway; lo que falte se ve como "por completar" en los documentos.
const path = require('path');
const docs = require(path.join(__dirname, '..', 'public', 'legal.js'));

const TERMS_VERSION = docs.VERSION;

function paeLegal() {
  const e = process.env;
  return {
    name: (e.LEGAL_NAME || 'José Raúl Sánchez Flores').trim(),
    brand: (e.LEGAL_BRAND || 'P.A.E.').trim(),
    address: (e.LEGAL_ADDRESS || '').trim(),
    email: (e.LEGAL_EMAIL || '').trim(),
    phone: (e.LEGAL_PHONE || '').trim(),
    rfc: (e.LEGAL_RFC || '').trim()
  };
}

// Qué variables faltan (para la lista de pendientes en Administración).
function paeMissing() {
  const l = paeLegal();
  const out = [];
  if (!process.env.LEGAL_NAME) out.push({ key: 'LEGAL_NAME', label: 'Nombre completo del titular (se usa "' + l.name + '" por ahora)', soft: true });
  if (!l.address) out.push({ key: 'LEGAL_ADDRESS', label: 'Domicilio de P.A.E.' });
  if (!l.email) out.push({ key: 'LEGAL_EMAIL', label: 'Correo de contacto y privacidad' });
  if (!l.phone) out.push({ key: 'LEGAL_PHONE', label: 'WhatsApp de P.A.E.' });
  if (!l.rfc) out.push({ key: 'LEGAL_RFC', label: 'RFC (opcional)', soft: true });
  return out;
}

module.exports = { TERMS_VERSION, paeLegal, paeMissing };
