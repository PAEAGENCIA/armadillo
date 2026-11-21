/* Redeo · Piezas visuales que se repiten: íconos, colores, la tarjeta tipo Wallet, avisos y botones. */
/* ---------- Íconos ---------- */
const ICONS = {
  starfill:'<path fill="currentColor" stroke="currentColor" d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/>',
  pin:'<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>',
  store:'<path d="M3 21h18"/><path d="M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4"/><path d="M5 21V10.85"/><path d="M19 21V10.85"/><path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/>',
  card:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h3"/>',
  user:'<circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>',
  users:'<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>',
  left:'<path d="M15 6l-6 6 6 6"/>',
  right:'<path d="M9 6l6 6-6 6"/>',
  logout:'<path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2"/><path d="M9 12h12l-3-3"/><path d="M18 15l3-3"/>',
  gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C9 3 12 8 12 8s3-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  sliders:'<path d="M4 6h8"/><path d="M16 6h4"/><path d="M4 12h2"/><path d="M10 12h10"/><path d="M4 18h11"/><path d="M19 18h1"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  cake:'<path d="M3 20h18v-8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8"/><path d="M3 14.8c.3.1.7.2 1 .2a2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 4 0 2.4 2.4 0 0 0 4 0 2.4 2.4 0 0 1 4 0 2.4 2.4 0 0 0 2 1c.4 0 .7-.1 1-.2"/><path d="M12 4l1.5 1.6a2 2 0 1 1-3 .1L12 4"/>',
  bolt:'<path d="M13 3v7h6l-8 11v-7H5l8-11"/>',
  send:'<path d="M10 14L21 3"/><path d="M21 3l-6.5 18a.55.55 0 0 1-1 0L10 14l-7-3.5a.55.55 0 0 1 0-1L21 3"/>',
  plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  check:'<path d="M5 12l5 5L20 7"/>',
  stamp:'<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  coin:'<circle cx="12" cy="12" r="9"/><path d="M14.8 9A2 2 0 0 0 13 8h-2a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-2a2 2 0 0 1-1.8-1"/><path d="M12 7v10"/>',
  wallet:'<path d="M17 8V5a1 1 0 0 0-1-1H6a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6"/><path d="M20 12v4h-4a2 2 0 0 1 0-4h4"/>',
  trophy:'<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M5 9a2 2 0 0 1 0-4h2"/><path d="M19 9a2 2 0 0 0 0-4h-2"/>',
  bulb:'<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3"/>',
  calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M8 16h.01"/><path d="M12 16h.01"/><path d="M16 16h.01"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="16" r="1"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/>',
  palette:'<path d="M12 21a9 9 0 0 1 0-18c4.97 0 9 3.58 9 8 0 1.06-.47 2.08-1.3 2.83-.84.75-1.98 1.17-3.17 1.17H14a2 2 0 0 0-1 3.75A1.3 1.3 0 0 1 12 21"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/>',
  phone:'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 17h2"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  x:'<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  upload:'<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M7 9l5-5 5 5"/><path d="M12 4v12"/>',
  crown:'<path d="M12 6l4 6 5-4-2 10H5L3 8l5 4z"/>',
  scan:'<path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  qr:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2z"/><path d="M18 18h2v2h-2z"/><path d="M14 18h2"/><path d="M18 14h2"/>',
  share:'<path d="M12 4v11"/><path d="M8 8l4-4 4 4"/><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  printer:'<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/>',
  sheet:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3v18"/>',
  heart:'<path d="M19.5 12.6L12 20l-7.5-7.4A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.6"/>',
  download:'<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M7 11l5 5 5-5"/><path d="M12 4v12"/>',
  inbox:'<path d="M4 13h4l2 3h4l2-3h4"/><path d="M4 13l2-8h12l2 8v6H4z"/>',
  bank:'<path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M5 10v11"/><path d="M19 10v11"/><path d="M9.5 10v11"/><path d="M14.5 10v11"/>',
  cash:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v.01"/><path d="M18 14.5v.01"/>',
  down:'<path d="M6 9l6 6 6-6"/>',
  transfer:'<path d="M4 8h13"/><path d="M14 5l3 3-3 3"/><path d="M20 16H7"/><path d="M10 13l-3 3 3 3"/>',
  // Redeo 2.0
  star:'<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/>',
  receipt:'<path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2"/><path d="M9 7h6"/><path d="M9 11h6"/><path d="M13 15h2"/>',
  bell:'<path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/>',
  calendar:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/><path d="M11 15h1v3"/>',
  shareios:'<path d="M12 15V3"/><path d="M8 7l4-4l4 4"/><path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1"/>',
  addhome:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8"/><path d="M8 12h8"/>',
  dots:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  phoneapp:'<rect x="6" y="3" width="12" height="18" rx="3"/><path d="M11 17h2"/>',
  wifioff:'<path d="M12 18h.01"/><path d="M9.17 15.17a4 4 0 0 1 5.66 0"/><path d="M6.34 12.34a8 8 0 0 1 4.2-2.2"/><path d="M3.51 9.51a12 12 0 0 1 3.1-2.2"/><path d="M17.66 12.34a8 8 0 0 0-1.45-1.13"/><path d="M20.49 9.51A12 12 0 0 0 12.9 6"/><path d="M3 3l18 18"/>'
};
function ic(name, size){
  size = size || 20;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||''}</svg>`;
}

/* ---------- Color ---------- */
function hexToRgb(hex){
  const h = String(hex||'#E62E6B').replace('#','');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function textOn(hex){
  const [r,g,b] = hexToRgb(hex).map(v=>{ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); });
  const lum = 0.2126*r + 0.7152*g + 0.0722*b;
  return lum > 0.45 ? '#1A1320' : '#FFFFFF';
}
function shade(hex, amt){
  const [r,g,b] = hexToRgb(hex);
  const f = v => Math.max(0, Math.min(255, Math.round(v + (amt/100)*(amt<0 ? v : 255-v))));
  return '#' + [f(r),f(g),f(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function tint(hex){ const [r,g,b]=hexToRgb(hex); return `rgba(${r},${g},${b},0.12)`; }
function initialOf(name){ return (String(name||'?').trim()[0]||'?').toUpperCase(); }
function goalOf(biz){ return biz.mechanic==='sellos' ? Number(biz.stampsGoal) : Number(biz.pointsGoal); }
// Monedero (saldo a favor): cada compra deja un % de saldo. 1 punto = $1.
function isWalletBiz(biz){ return !!biz && biz.mechanic==='monedero'; }
function pesos(n){ return '$'+Math.round(Number(n)||0).toLocaleString('es-MX'); }
function giftText(biz, n){ n = Number(n)||0; if(isWalletBiz(biz)) return pesos(n)+' de saldo'; if(biz.mechanic==='sellos') return n===1?'1 sello':n+' sellos'; return n+' '+(n===1?'punto':'puntos'); }
function bonusAmt(biz){ return biz.mechanic==='sellos' ? 1 : (Number(biz.pointsPerVisit)||1); }
function walletCredit(biz, ticket){ return Math.max(1, Math.round((Number(ticket)||0) * (Number(biz.walletPct)||0) / 100)); }

/* ---------- Tarjeta tipo Wallet ---------- */
const STAMP_ICONS = {"check": {"label": "Palomita", "svg": "<path d=\"M5 12l5 5l10 -10\" />"}, "star": {"label": "Estrella", "svg": "<path d=\"M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245\" />"}, "heart": {"label": "Corazón", "svg": "<path d=\"M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572\" />"}, "coffee": {"label": "Café", "svg": "<path d=\"M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1\" /> <path d=\"M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2\" /> <path d=\"M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2\" /> <path d=\"M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5\" /> <path d=\"M16.746 16.726a3 3 0 1 0 .252 -5.555\" />"}, "cup": {"label": "Bebida", "svg": "<path d=\"M5 11h14v-3h-14l0 3\" /> <path d=\"M17.5 11l-1.5 10h-8l-1.5 -10\" /> <path d=\"M6 8v-1a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v1\" /> <path d=\"M15 5v-2\" />"}, "bread": {"label": "Pan", "svg": "<path d=\"M18 4a3 3 0 0 1 2 5.235v8.765a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-8.764a3 3 0 0 1 1.824 -5.231h12.176v-.005\" />"}, "cookie": {"label": "Galleta", "svg": "<path d=\"M8 13v.01\" /> <path d=\"M12 17v.01\" /> <path d=\"M12 12v.01\" /> <path d=\"M16 14v.01\" /> <path d=\"M11 8v.01\" /> <path d=\"M13.148 3.476l2.667 1.104a4 4 0 0 0 4.656 6.14l.053 .132a3 3 0 0 1 0 2.296q -.745 1.18 -1.024 1.852q -.283 .684 -.66 2.216a3 3 0 0 1 -1.624 1.623q -1.572 .394 -2.216 .661q -.712 .295 -1.852 1.024a3 3 0 0 1 -2.296 0q -1.203 -.754 -1.852 -1.024q -.707 -.292 -2.216 -.66a3 3 0 0 1 -1.623 -1.624q -.397 -1.577 -.661 -2.216q -.298 -.718 -1.024 -1.852a3 3 0 0 1 0 -2.296q .719 -1.116 1.024 -1.852q .257 -.62 .66 -2.216a3 3 0 0 1 1.624 -1.623q 1.547 -.384 2.216 -.661q .687 -.285 1.852 -1.024a3 3 0 0 1 2.296 0\" />"}, "cake": {"label": "Pastel", "svg": "<path d=\"M3 20h18v-8a3 3 0 0 0 -3 -3h-12a3 3 0 0 0 -3 3v8\" /> <path d=\"M3 14.803c.312 .135 .654 .204 1 .197a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1c.35 .007 .692 -.062 1 -.197\" /> <path d=\"M12 4l1.465 1.638a2 2 0 1 1 -3.015 .099l1.55 -1.737\" />"}, "ice-cream": {"label": "Helado", "svg": "<path d=\"M17.657 11a6 6 0 1 0 -11.315 0\" /> <path d=\"M6.342 11l5.658 11l5.657 -11l-11.315 0\" />"}, "pizza": {"label": "Pizza", "svg": "<path d=\"M12 21.5c-3.04 0 -5.952 -.714 -8.5 -1.983l8.5 -16.517l8.5 16.517a19.09 19.09 0 0 1 -8.5 1.983\" /> <path d=\"M5.38 15.866a14.94 14.94 0 0 0 6.815 1.634a14.944 14.944 0 0 0 6.502 -1.479\" /> <path d=\"M13 11.01v-.01\" /> <path d=\"M11 14v-.01\" />"}, "beer": {"label": "Cerveza", "svg": "<path d=\"M9 21h6a1 1 0 0 0 1 -1v-3.625c0 -1.397 .29 -2.775 .845 -4.025l.31 -.7c.556 -1.25 .845 -2.253 .845 -3.65v-4a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1v4c0 1.397 .29 2.4 .845 3.65l.31 .7a9.931 9.931 0 0 1 .845 4.025v3.625a1 1 0 0 0 1 1\" /> <path d=\"M6 8h12\" />"}, "leaf": {"label": "Hoja", "svg": "<path d=\"M5 21c.5 -4.5 2.5 -8 7 -10\" /> <path d=\"M9 18c6.218 0 10.5 -3.288 11 -12v-2h-4.014c-9 0 -11.986 4 -12 9c0 1 0 3 2 5h3l.014 0\" />"}, "flame": {"label": "Fuego", "svg": "<path d=\"M12 10.941c2.333 -3.308 .167 -7.823 -1 -8.941c0 3.395 -2.235 5.299 -3.667 6.706c-1.43 1.408 -2.333 3.294 -2.333 5.588c0 3.704 3.134 6.706 7 6.706c3.866 0 7 -3.002 7 -6.706c0 -1.712 -1.232 -4.403 -2.333 -5.588c-2.084 3.353 -3.257 3.353 -4.667 2.235\" />"}, "scissors": {"label": "Tijeras", "svg": "<path d=\"M3 7a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\" /> <path d=\"M3 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\" /> <path d=\"M8.6 8.6l10.4 10.4\" /> <path d=\"M8.6 15.4l10.4 -10.4\" />"}, "paw": {"label": "Huella", "svg": "<path d=\"M14.7 13.5c-1.1 -2 -1.441 -2.5 -2.7 -2.5c-1.259 0 -1.736 .755 -2.836 2.747c-.942 1.703 -2.846 1.845 -3.321 3.291c-.097 .265 -.145 .677 -.143 .962c0 1.176 .787 2 1.8 2c1.259 0 3 -1 4.5 -1s3.241 1 4.5 1c1.013 0 1.8 -.823 1.8 -2c0 -.285 -.049 -.697 -.146 -.962c-.475 -1.451 -2.512 -1.835 -3.454 -3.538\" /> <path d=\"M20.188 8.082a1.039 1.039 0 0 0 -.406 -.082h-.015c-.735 .012 -1.56 .75 -1.993 1.866c-.519 1.335 -.28 2.7 .538 3.052c.129 .055 .267 .082 .406 .082c.739 0 1.575 -.742 2.011 -1.866c.516 -1.335 .273 -2.7 -.54 -3.052l-.001 0\" /> <path d=\"M9.474 9c.055 0 .109 0 .163 -.011c.944 -.128 1.533 -1.346 1.32 -2.722c-.203 -1.297 -1.047 -2.267 -1.932 -2.267c-.055 0 -.109 0 -.163 .011c-.944 .128 -1.533 1.346 -1.32 2.722c.204 1.293 1.048 2.267 1.933 2.267\" /> <path d=\"M16.456 6.733c.214 -1.376 -.375 -2.594 -1.32 -2.722a1.164 1.164 0 0 0 -.162 -.011c-.885 0 -1.728 .97 -1.93 2.267c-.214 1.376 .375 2.594 1.32 2.722c.054 .007 .108 .011 .162 .011c.885 0 1.73 -.974 1.93 -2.267\" /> <path d=\"M5.69 12.918c.816 -.352 1.054 -1.719 .536 -3.052c-.436 -1.124 -1.271 -1.866 -2.009 -1.866c-.14 0 -.277 .027 -.407 .082c-.816 .352 -1.054 1.719 -.536 3.052c.436 1.124 1.271 1.866 2.009 1.866c.14 0 .277 -.027 .407 -.082\" />"}, "barbell": {"label": "Pesas", "svg": "<path d=\"M2 12h1\" /> <path d=\"M6 8h-2a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h2\" /> <path d=\"M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1\" /> <path d=\"M9 12h6\" /> <path d=\"M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1\" /> <path d=\"M18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-2\" /> <path d=\"M22 12h-1\" />"}, "car": {"label": "Auto", "svg": "<path d=\"M5 20a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" /> <path d=\"M15 20a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" /> <path d=\"M5 20h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5\" /> <path d=\"M3 6l9 -4l9 4\" />"}, "shirt": {"label": "Ropa", "svg": "<path d=\"M15 4l6 2v5h-3v8a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-8h-3v-5l6 -2a3 3 0 0 0 6 0\" />"}, "diamond": {"label": "Diamante", "svg": "<path d=\"M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5\" /> <path d=\"M10 12l-2 -2.2l.6 -1\" />"}, "crown": {"label": "Corona", "svg": "<path d=\"M12 6l4 6l5 -4l-2 10h-14l-2 -10l5 4l4 -6\" />"}};

function stampSvg(id, size){
  const icon = STAMP_ICONS[id] || STAMP_ICONS.check;
  size = size || 20;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon.svg}</svg>`;
}

// Patrón de fondo con el ícono del sello, muy tenue, en el color del texto de la tarjeta
function patternUrl(id, onColor){
  const icon = STAMP_ICONS[id] || STAMP_ICONS.check;
  const stroke = onColor === '#FFFFFF' ? 'rgba(255,255,255,0.13)' : 'rgba(26,19,32,0.10)';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="-7 -7 38 38" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icon.svg}</svg>`;
  // Comillas simples: este valor va dentro de style="..." y unas comillas dobles lo cortarían.
  return `url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g,'%27')}')`;
}

function passHtml(biz, customer, opts){
  opts = opts || {};
  const goal = Math.max(1, goalOf(biz) || 1);
  const progress = customer ? Number(customer.progress)||0 : 0;
  const ready = customer && progress >= readyAt(biz);   // con premios a elegir, en cuanto alcanza el primero
  const on = textOn(biz.color);
  const cardStyle = biz.cardStyle || 'gradient';
  const stampIcon = biz.stampIcon || 'check';
  const style = `--c:${biz.color};--c2:${shade(biz.color,-28)};--on:${on}` + (cardStyle==='pattern' ? `;--pat:${patternUrl(stampIcon, on)}` : '');
  let body;
  const wallet = isWalletBiz(biz);
  if(wallet){
    body = `<div class="pts wal"><span class="pts-num">${pesos(progress)}</span><span class="pts-of">saldo a favor</span></div><div class="wal-note">${ic('coin',14)} Ganas ${Number(biz.walletPct)||0}% de cada compra</div>`;
  }else if(biz.mechanic==='sellos'){
    const shown = Math.min(goal, 30);
    let s='';
    for(let i=0;i<shown;i++){
      const filled = i < progress;
      const last = i === shown-1;
      s += `<span class="stamp ${filled?'on':''} ${!filled&&last?'gift':''}">${filled?stampSvg(stampIcon):(last?ic('gift',16):'')}</span>`;
    }
    body = `<div class="stamps">${s}</div>`;
  }else{
    const pct = Math.max(0, Math.min(100, Math.round(progress/goal*100)));
    body = `<div class="pts"><span class="pts-num">${progress}</span><span class="pts-of">de ${goal} puntos</span></div><div class="pbar"><span style="width:${pct}%"></span></div>`;
  }
  const who = customer ? (customer.name || customer.phone || 'Cliente') : 'Tus clientes';
  const qr = (opts.qr && customer && customer.phone)
    ? `<div class="pass-qr"><div class="qr" data-qr="${escapeHtml(biz.slug+':'+customer.phone)}" ${opts.live?'data-qr-live="1"':''} onclick="zoomQR(this.getAttribute('data-qr'))" role="button" aria-label="Agrandar código QR"></div>${opts.live ? `<span class="qr-live" data-qr-num>··· ···</span><div class="qr-timer" aria-hidden="true"><span data-qr-bar></span></div><span class="qr-tap" style="text-align:center">Código de seguridad: cambia cada 30 segundos.<br>Abre esta página en caja; las capturas no sirven.</span>` : `<small>Muéstralo en caja · ${escapeHtml(fmtPhone(customer.phone))}</small><span class="qr-tap">Toca el código para agrandarlo</span>`}</div>` : '';
  return `
  <div class="pass ${opts.tilt?'pass-tilt':''} ${cardStyle}" style="${style}">
    <div class="pass-top">
      <div class="pass-logo ${biz.logoUrl?'has-img':''}">${biz.logoUrl ? `<img src="${escapeHtml(biz.logoUrl)}" alt="">` : escapeHtml(initialOf(biz.name))}</div>
      <div class="pass-id"><div class="pass-name">${escapeHtml(biz.name)}</div><div class="pass-kind">${escapeHtml(biz.cardTitle || 'Tarjeta de lealtad')}</div></div>
      ${ready && !wallet ? `<span class="pass-ready">Premio listo</span>` : ''}
    </div>
    <div class="pass-body">${body}</div>
    <div class="pass-meta">
      <div><span class="k">${wallet?'Monedero':'Premio'}</span><span class="v">${wallet ? 'Úsalo en tu próxima compra' : escapeHtml(biz.rewardDesc)}</span></div>
      <div><span class="k">${biz.mechanic==='sellos'?'Sellos':customer&&customer.level?'Nivel':'Cliente'}</span><span class="v">${biz.mechanic==='sellos' ? Math.min(progress,goal)+'/'+goal : escapeHtml(customer&&customer.level ? customer.level.name : who)}</span></div>
    </div>
    ${qr}
  </div>`;
}
// Compatibilidad con el nombre anterior
function ticketCardHtml(biz, customer){ return passHtml(biz, customer, {}); }

function hydrateQR(){
  if(!document.querySelectorAll) return;
  document.querySelectorAll('[data-qr]').forEach(el=>{
    if(el.hasAttribute('data-qr-live')){
      const secret = clienteResult && clienteResult.customer && clienteResult.customer.qrSecret;
      if(secret) startLiveQR(el.getAttribute('data-qr'), secret);
      return;
    }
    try{
      if(typeof qrcode==='function'){
        el.innerHTML = qrImg(el.getAttribute('data-qr'));
      }else{
        el.innerHTML = ic('card',40);
      }
    }catch(e){ el.innerHTML = ic('card',40); }
  });
}

function copyText(t, label){
  label = label || 'Código copiado';
  try{
    navigator.clipboard.writeText(t).then(()=>showToast(label)).catch(()=>showToast(t));
  }catch(e){ showToast(t); }
}

function toastHtml(){
  return toastMsg ? `<div class="toast" role="status">${ic('check',18)}<span>${escapeHtml(toastMsg)}</span></div>` : '';
}
function errorHtml(msg){ return msg ? `<div class="error">${ic('info',18)}<span>${escapeHtml(msg)}</span></div>` : ''; }
function backHtml(action){ return `<button class="back" onclick="${action}">${ic('left',18)} Volver</button>`; }
// Logo Redeo: la "o" es un anillo dorado que casi se cierra (la vuelta del cliente que regresa).
function redeoO(){ return `<svg class="logo-o" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round" stroke-dasharray="80 95" transform="rotate(-62 20 20)"/><circle cx="13.35" cy="6.55" r="3.9" fill="currentColor"/></svg>`; }
function logoHtml(){ return `<div class="logo" role="img" aria-label="Redeo"><span class="logo-mark">R</span><span class="logo-word">rede${redeoO()}</span></div>`; }
