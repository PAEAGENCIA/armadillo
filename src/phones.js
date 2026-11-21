// Números de WhatsApp de cualquier país.
// México se guarda como siempre: 10 dígitos sin lada ("2221234567"), así los clientes que ya existen no cambian.
// Otros países se guardan con "+" y su lada ("+15551234567", "+573001234567").
// Esta lista es la misma que usa la pantalla (public/index.html → PHONE_COUNTRIES).
const COUNTRIES = [
  { iso: 'MX', name: 'México', cc: '52', min: 10, max: 10 },
  { iso: 'US', name: 'Estados Unidos', cc: '1', min: 10, max: 10 },
  { iso: 'CA', name: 'Canadá', cc: '1', min: 10, max: 10 },
  { iso: 'GT', name: 'Guatemala', cc: '502', min: 8, max: 8 },
  { iso: 'SV', name: 'El Salvador', cc: '503', min: 8, max: 8 },
  { iso: 'HN', name: 'Honduras', cc: '504', min: 8, max: 8 },
  { iso: 'NI', name: 'Nicaragua', cc: '505', min: 8, max: 8 },
  { iso: 'CR', name: 'Costa Rica', cc: '506', min: 8, max: 8 },
  { iso: 'PA', name: 'Panamá', cc: '507', min: 8, max: 8 },
  { iso: 'CU', name: 'Cuba', cc: '53', min: 8, max: 8 },
  { iso: 'DO', name: 'República Dominicana', cc: '1', min: 10, max: 10 },
  { iso: 'PR', name: 'Puerto Rico', cc: '1', min: 10, max: 10 },
  { iso: 'CO', name: 'Colombia', cc: '57', min: 10, max: 10 },
  { iso: 'VE', name: 'Venezuela', cc: '58', min: 10, max: 10 },
  { iso: 'EC', name: 'Ecuador', cc: '593', min: 9, max: 9 },
  { iso: 'PE', name: 'Perú', cc: '51', min: 9, max: 9 },
  { iso: 'BO', name: 'Bolivia', cc: '591', min: 8, max: 8 },
  { iso: 'CL', name: 'Chile', cc: '56', min: 9, max: 9 },
  { iso: 'AR', name: 'Argentina', cc: '54', min: 10, max: 11 },
  { iso: 'UY', name: 'Uruguay', cc: '598', min: 8, max: 8 },
  { iso: 'PY', name: 'Paraguay', cc: '595', min: 9, max: 9 },
  { iso: 'BR', name: 'Brasil', cc: '55', min: 10, max: 11 },
  { iso: 'ES', name: 'España', cc: '34', min: 9, max: 9 },
  { iso: 'FR', name: 'Francia', cc: '33', min: 9, max: 9 },
  { iso: 'DE', name: 'Alemania', cc: '49', min: 10, max: 11 },
  { iso: 'IT', name: 'Italia', cc: '39', min: 9, max: 10 },
  { iso: 'GB', name: 'Reino Unido', cc: '44', min: 10, max: 10 }
];
const CODES = [...new Set(COUNTRIES.map(c => c.cc))].sort((a, b) => b.length - a.length);

// "222 123 4567", "+52 1 222 123 4567" -> "2221234567" (México). "+1 (555) 123-4567" -> "+15551234567".
function normalizePhone(raw) {
  const s = String(raw || '').trim();
  let digits = s.replace(/\D/g, '');
  const intl = s.startsWith('+') || s.startsWith('00');
  if (s.startsWith('00')) digits = digits.slice(2);
  if (intl) {
    if (digits.startsWith('52')) {
      digits = digits.slice(2);
      if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);   // formato viejo +52 1
      return digits;
    }
    return digits ? '+' + digits : '';
  }
  if (digits.length === 12 && digits.startsWith('52')) digits = digits.slice(2);
  if (digits.length === 13 && digits.startsWith('521')) digits = digits.slice(3);
  return digits;
}

function countryOf(phone) {
  const m = /^\+(\d+)$/.exec(String(phone || ''));
  if (!m) return /^\d{10}$/.test(String(phone || '')) ? COUNTRIES[0] : null;
  const cc = CODES.find(c => m[1].startsWith(c));
  return cc ? COUNTRIES.find(c => c.cc === cc) : null;
}

// ¿Tiene los dígitos que se usan en ese país?
function isValidPhone(phone) {
  const p = String(phone || '');
  if (/^\d{10}$/.test(p)) return true;                         // México
  const m = /^\+(\d{8,15})$/.exec(p);
  if (!m) return false;
  const cc = CODES.find(c => m[1].startsWith(c));
  if (!cc || cc === '52') return false;
  const n = m[1].length - cc.length;
  return COUNTRIES.some(c => c.cc === cc && n >= c.min && n <= c.max);
}

// Número para abrir WhatsApp (wa.me)
function waNumber(phone) { const p = String(phone || ''); return p.startsWith('+') ? p.slice(1) : '52' + p; }

const PHONE_ERROR = 'Revisa el número de WhatsApp: elige el país y escribe el número completo, sin la lada.';

module.exports = { COUNTRIES, normalizePhone, isValidPhone, countryOf, waNumber, PHONE_ERROR };
