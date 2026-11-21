/* Redeo · Negocio: el panel (Hoy, Clientes y Más), QR, cartel e invitaciones. */
// Navegación del panel: tres pestañas (Hoy · Clientes · Crecer) y lo demás dentro de "Más".
const MAIN_TABS = ['resumen','clientes','crecer'];
const SUB_TITLES = { config:'Ajustes', invitar:'Invita a tus clientes', opiniones:'Lo que dicen tus clientes', acceso:'Mis datos de acceso' };
let showMyPin = false;
function openMas(){ dashboardTab='mas'; render(); window.scrollTo(0,0); }
function openInvitar(){ dashboardTab='invitar'; render(); window.scrollTo(0,0); }
function openOpiniones(){ dashboardTab='opiniones'; render(); window.scrollTo(0,0); if(!opinions && typeof loadOpinions==='function') loadOpinions(); }
function goHoy(){ dashboardTab='resumen'; render(); window.scrollTo(0,0); }

function viewDashboard(){
  const biz = cache.biz;
  if(isOwner() && biz.needsTerms) return viewTerminos();
  if(isExpired()) return viewPausado();
  const main = MAIN_TABS.includes(dashboardTab);
  const owner = isOwner();
  const pend = pendingCustomers().length;
  const alertsMas = owner && secAlertsCount ? secAlertsCount : 0;
  return `
  <div class="wrap fade pnl">
    <div class="topbar pnl-top" style="margin-bottom:0">
      <div class="biz-head">
        ${biz.logoUrl ? `<div class="avatar" style="background:#fff;border:1px solid var(--line);padding:5px"><img src="${escapeHtml(biz.logoUrl)}" alt="" style="width:100%;height:100%;object-fit:contain"></div>` : `<div class="avatar" style="background:${biz.color};color:${textOn(biz.color)}">${escapeHtml(initialOf(biz.name))}</div>`}
        <div style="min-width:0">
          <div class="biz-name">${escapeHtml(biz.name)}</div>
          ${owner ? '' : `<span class="pnl-who">${ic('user',12)} ${escapeHtml(biz.actor && biz.actor.name ? biz.actor.name : 'Personal')}</span>`}
        </div>
      </div>
      ${owner
        ? `<button class="pnl-more ${dashboardTab==='mas'?'on':''}" aria-label="Más opciones" onclick="${dashboardTab==='mas'?'goHoy()':'openMas()'}">${ic('sliders',18)}<span>Más</span>${alertsMas?'<i class="pnl-dot"></i>':''}</button>`
        : `<button class="icon-btn" aria-label="Cerrar sesión" onclick="cerrarSesion()">${ic('logout',18)}</button>`}
    </div>
    ${accessBannerHtml()}
    ${demoBarHtml()}
    ${serverConfig.storageWarning ? `<div class="error mt-16">${ic('info',18)}<span>Aviso para P.A.E.: el servidor no tiene disco permanente. Agrega un volumen en Railway antes de dar de alta clientes reales.</span></div>` : ''}
    ${main ? `<div class="tabs pnl-tabs" role="tablist" style="grid-template-columns:repeat(${owner?3:2},1fr)">
      <button class="${dashboardTab==='resumen'?'on':''}" onclick="goHoy()">Hoy</button>
      <button class="${dashboardTab==='clientes'?'on':''}" onclick="dashboardTab='clientes';expandedPhone=null;render();refreshCustomers()">Clientes${pend?` <span class="tab-badge">${pend}</span>`:''}</button>
      ${owner ? `<button class="${dashboardTab==='crecer'?'on':''}" onclick="openCrecer()">Crecer${isPremiumBiz() && remindersDueCount()?` <span class="tab-badge">${remindersDueCount()}</span>`:''}</button>` : ''}
    </div>` : ''}
    ${SUB_TITLES[dashboardTab] && owner ? `<button class="back mt-16" onclick="openMas()">${ic('left',18)} Más</button><h2 class="mt-12" style="margin-bottom:14px">${SUB_TITLES[dashboardTab]}</h2>` : ''}
    ${dashboardTab==='mas' && owner ? `<button class="back mt-16" onclick="goHoy()">${ic('left',18)} Volver</button>` : ''}
    ${dashboardTab==='resumen' ? dashboardResumen() : ''}
    ${dashboardTab==='clientes' ? dashboardClientes() : ''}
    ${dashboardTab==='crecer' && owner ? dashboardCrecer() : ''}
    ${dashboardTab==='config' && owner ? dashboardConfig() : ''}
    ${dashboardTab==='mas' && owner ? dashboardMas() : ''}
    ${dashboardTab==='invitar' && owner ? dashboardInvitar() : ''}
    ${dashboardTab==='opiniones' && owner ? dashboardOpiniones() : ''}
    ${dashboardTab==='acceso' && owner ? dashboardAcceso() : ''}
    ${dashboardTab==='aprende' ? academyHtml() : ''}
    ${dashboardTab==='equipo' && owner ? dashboardEquipo() : ''}
  </div>`;
}

// ----- "Más": todo lo que no se usa a diario, en una sola lista -----
function masRow(icon, title, sub, go, badge){
  return `<button class="pnl-row" onclick="${go}"><span class="pnl-row-ico">${ic(icon,19)}</span><span class="pnl-row-t"><b>${title}</b>${sub?`<span>${sub}</span>`:''}</span>${badge?`<span class="tab-badge" style="position:static">${badge}</span>`:''}<span class="chev">${ic('right',18)}</span></button>`;
}
function dashboardMas(){
  const a = cache.biz.access || {};
  const memb = !a.until ? 'Activa' : a.type==='trial' ? 'Prueba gratis hasta el '+fmtYmd(a.until) : 'Pagada hasta el '+fmtYmd(a.until);
  const sum = typeof acadSummary==='function' ? acadSummary() : null;
  return `
    <h2 class="mt-12" style="margin-bottom:14px">Más</h2>
    ${installPanelCardHtml()}
    <div class="pnl-list mt-12">
      ${masRow('palette','Tu tarjeta y ajustes','Diseño, premio, productos y PIN',"openConfig()")}
      ${masRow('qr','Invita a tus clientes','Tu QR, tu cartel y tu sticker',"openInvitar()")}
      ${masRow('users','Equipo y seguridad','Un PIN para cada persona y alertas',"openEquipo()", secAlertsCount||0)}
      ${masRow('heart','Lo que dicen tus clientes','Opiniones y cómo te conocieron',"openOpiniones()")}
      ${isDemoBiz() ? '' : masRow('lock','Mis datos de acceso','Tu código y tu PIN para entrar desde otro celular',"showMyPin=false;dashboardTab='acceso';render();window.scrollTo(0,0)")}
    </div>
    <div class="pnl-list mt-12">
      ${masRow('wallet','Tu membresía',escapeHtml(memb),"openMembresia()")}
      ${masRow('trophy','Tutorial: Aprende Redeo',sum?escapeHtml(sum.rank)+(sum.next?' · siguiente misión lista':''):'Misiones para dominar tu tarjeta',"openAcademy()")}
      ${isDemoBiz() ? '' : masRow('users','Ver una cuenta de ejemplo','Así se ve Redeo con clientes y sellos',"openSampleAccount()")}
    </div>
    <button class="btn btn-ghost btn-block mt-16" onclick="cerrarSesion()">${ic('logout',18)} Cerrar sesión</button>
  `;
}
function dashboardInvitar(){
  return `${inviteCardHtml()}
    <p class="eyebrow mt-24">Así se ve tu tarjeta</p>
    <div class="mt-12">${passHtml(cache.biz, null, {})}</div>`;
}
function dashboardAcceso(){
  const b = cache.biz, pin = session.pin || '';
  const text = `Mi cuenta de Redeo (${b.name})\n${location.origin} → Entrar a mi negocio\nCódigo: ${b.slug}\nPIN: ${pin}`;
  return `<div class="card">
      <p class="muted small" style="margin:0 0 10px">Para entrar desde otro celular escribe tu WhatsApp o tu código, y tu PIN.</p>
      <div class="kv"><span class="muted small">Código del negocio</span><button class="mb-copy" onclick="copyText('${jsEsc(b.slug)}','Código copiado')"><span class="mono">${escapeHtml(b.slug)}</span>${ic('copy',14)}</button></div>
      <div class="kv"><span class="muted small">Tu PIN</span><span class="row" style="gap:8px"><b class="mono">${showMyPin?escapeHtml(pin):'••••'}</b><button class="linkbtn small" onclick="showMyPin=!showMyPin;render()">${showMyPin?'Ocultar':'Mostrar'}</button></span></div>
      <button class="btn btn-wa btn-block btn-sm mt-12" onclick="window.open(waLink('', ${JSON.stringify(text).replace(/"/g,'&quot;')}),'_blank')">${ic('send',16)} Guardarlos en mi WhatsApp</button>
    </div>
    <div class="card mt-12">
      <b>¿Quieres otro PIN?</b>
      <p class="muted small" style="margin:4px 0 10px">Al cambiarlo, los demás celulares tendrán que entrar con el nuevo.</p>
      <button class="btn btn-secondary btn-block" onclick="openConfig();setTimeout(()=>{const e=document.querySelector('[aria-label=\'PIN nuevo\']');if(e){e.scrollIntoView({behavior:'smooth',block:'center'});e.focus()}},80)">${ic('lock',18)} Cambiar mi PIN</button>
    </div>`;
}
function dashboardOpiniones(){
  const inner = `${opinionsCardHtml()}${sourcesCardHtml()}${topFavoritesHtml()}`;
  return inner.trim() ? inner : `<div class="card"><div class="empty"><div class="empty-ico">${ic('heart',26)}</div><b style="color:var(--ink)">Todavía no hay nada aquí</b><p class="small mt-8">Cuando tus clientes se registren y opinen, aquí verás qué dicen y cómo te conocieron.</p></div></div>`;
}

// "Un fermento gratis" -> "un fermento gratis" para usarlo a media frase (respeta siglas como "2x1" o "CACHAI")
function inSentence(t){
  t = String(t||'');
  return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

// El QR va como imagen (negro puro sobre blanco y con su margen blanco incluido):
// así, aunque el celular del cliente oscurezca la página, el código se sigue leyendo.
const qrImgCache = {};
function qrImg(text){
  try{
    if(!qrImgCache[text]) qrImgCache[text] = qrCanvas(text, 480, '#000000').toDataURL('image/png');
    return `<img src="${qrImgCache[text]}" alt="Código QR" draggable="false">`;
  }catch(e){ return qrSvgRaw(text); }
}
function qrSvgRaw(text){
  try{ const q = qrcode(0,'M'); q.addData(text); q.make(); return q.createSvgTag({cellSize:4, margin:4, scalable:true}); }
  catch(e){ return ''; }
}
function qrSvg(text){ return qrImg(text); }
function zoomQR(text){
  closeQRZoom();
  const phone = String(text||'').split(':').pop();
  const box = document.createElement('div');
  box.id = 'qr-zoom';
  if(liveQR && liveQR.base===text){
    box.innerHTML = '<div data-qr-live="1"></div><p>Muestra este código en caja</p><span class="qr-live" data-qr-num></span><small>Cambia en <span data-qr-left></span> s · Toca para cerrar</small>';
  }else{
    box.innerHTML = qrImg(text) + '<p>Muestra este código en caja</p><small>' + escapeHtml(phone) + ' · Toca para cerrar</small>';
  }
  box.onclick = closeQRZoom;
  document.body.appendChild(box);
  if(liveQR) paintLiveQR();
}

// Modo estricto: el código de la tarjeta cambia cada 30 segundos (lo calcula el celular del cliente, sin internet).
let liveQR = null;   // { base, secret, step, code, timer, err }
function b64urlBytes(s){
  const b64 = String(s).replace(/-/g,'+').replace(/_/g,'/');
  const bin = atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
  return Uint8Array.from(bin, ch => ch.charCodeAt(0));
}
async function liveCode(secret, step){
  const key = await crypto.subtle.importKey('raw', b64urlBytes(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const msg = new ArrayBuffer(8); const dv = new DataView(msg);
  dv.setUint32(0, Math.floor(step / 4294967296)); dv.setUint32(4, step >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = h[h.length-1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o+1] << 16) | (h[o+2] << 8) | h[o+3];
  return String(n % 1000000).padStart(6, '0');
}
function startLiveQR(base, secret){
  if(liveQR && liveQR.base===base && liveQR.secret===secret){ paintLiveQR(); return; }
  stopLiveQR();
  liveQR = { base, secret, step:null, code:null, timer:null, err:false, busy:false };
  liveQR.timer = setInterval(tickLiveQR, 1000);
  tickLiveQR();
}
function stopLiveQR(){ if(liveQR && liveQR.timer) clearInterval(liveQR.timer); liveQR = null; }
async function tickLiveQR(){
  const L = liveQR;
  if(!L) return;
  if(!document.querySelector('[data-qr-live]')){ stopLiveQR(); return; }
  const step = Math.floor(Date.now() / 30000);
  if(step !== L.step && !L.busy){
    L.busy = true;
    try{
      if(!(window.crypto && crypto.subtle)) throw new Error('sin crypto');
      L.code = await liveCode(L.secret, step); L.step = step; L.err = false;
    }catch(e){ L.err = true; }
    L.busy = false;
  }
  paintLiveQR();
}
function paintLiveQR(){
  const L = liveQR;
  if(!L) return;
  const left = 30 - Math.floor(Date.now() / 1000) % 30;
  document.querySelectorAll('[data-qr-live]').forEach(el=>{
    if(L.err){ el.innerHTML = '<p class="small" style="color:#B3261E;text-align:center;margin:0">Tu navegador no puede crear el código. Actualízalo o abre tu tarjeta en Chrome o Safari.</p>'; return; }
    if(!L.code) return;
    const want = L.base + ':' + L.code;
    if(el.getAttribute('data-shown') !== want){ el.innerHTML = qrImg(want); el.setAttribute('data-shown', want); }
  });
  document.querySelectorAll('[data-qr-num]').forEach(el=>{ el.textContent = L.code ? L.code.slice(0,3) + ' ' + L.code.slice(3) : '··· ···'; });
  document.querySelectorAll('[data-qr-bar]').forEach(el=>{ el.style.width = Math.round(left / 30 * 100) + '%'; });
  document.querySelectorAll('[data-qr-left]').forEach(el=>{ el.textContent = left; });
}
function closeQRZoom(){ const b = document.getElementById('qr-zoom'); if(b) b.remove(); }

// Dibuja el QR en un lienzo grande (sirve para descargarlo y para el cartel)
function qrCanvas(text, size, dark){
  const q = qrcode(0,'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), margin = 4, cell = Math.floor(size/(n+margin*2));
  const c = document.createElement('canvas'); c.width = c.height = cell*(n+margin*2);
  const g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0,0,c.width,c.height);
  g.fillStyle = dark || '#1A1320';
  for(let r=0;r<n;r++) for(let k=0;k<n;k++) if(q.isDark(r,k)) g.fillRect((k+margin)*cell,(r+margin)*cell,cell,cell);
  return c;
}

function downloadCanvas(canvas, filename){
  canvas.toBlob(blob=>{
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

function downloadQR(){
  setOnbFlag('cartel');
  downloadCanvas(qrCanvas(customerLink(cache.biz.slug), 1200), 'qr-'+cache.biz.slug+'.png');
  showToast('QR descargado.');
}

async function shareLink(){
  const url = customerLink(cache.biz.slug);
  const sp = signupPromo(cache.biz);
  const text = 'Pide tu tarjeta de lealtad de '+cache.biz.name+' y gana '+inSentence(cache.biz.rewardDesc)+'.'+(sp ? ' Por registrarte: '+sp.text+'.' : '')+' Pídela aquí:';
  if(navigator.share){
    try{ await navigator.share({ title:cache.biz.name, text, url }); return; }catch(e){ if(e && e.name==='AbortError') return; }
  }
  copyText(text+' '+url, 'Invitación copiada. Pégala en WhatsApp.');
}

// Cartel para imprimir: tamaño carta, con el color de la marca y el QR grande
function printPoster(){
  setOnbFlag('cartel');
  const b = cache.biz, url = customerLink(b.slug);
  const qr = qrCanvas(url, 900).toDataURL('image/png');
  const on = textOn(b.color), c2 = shade(b.color,-28);
  const goal = goalOf(b), unit = b.mechanic==='sellos' ? 'sellos' : 'puntos';
  const w = window.open('', '_blank');
  if(!w){ showToast('Permite las ventanas emergentes para imprimir el cartel.'); return; }
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Cartel ${escapeHtml(b.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
<style>
@page{size:letter;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#1A1320;background:#fff}
.page{width:8.5in;height:11in;display:flex;flex-direction:column}
.top{background:linear-gradient(150deg,${b.color},${c2});color:${on};padding:.9in .8in .7in;text-align:center}
.logo{width:1in;height:1in;border-radius:.28in;margin:0 auto .3in;display:grid;place-items:center;font-family:Fraunces,serif;font-size:.55in;background:rgba(255,255,255,.2)}
h1{font-family:Fraunces,serif;font-size:.62in;line-height:1.05;margin:0}
.sub{font-size:.24in;font-weight:700;margin-top:.18in;opacity:.9}
.mid{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:.4in .8in;text-align:center}
.mid img{width:4.1in;height:4.1in;image-rendering:pixelated}
.cta{font-size:.34in;font-weight:800;margin-top:.25in}
.steps{font-size:.19in;color:#4A4150;margin-top:.14in;line-height:1.5}
.foot{text-align:center;font-size:.14in;color:#8A8190;padding:0 .8in .45in;word-break:break-all}
.gift{margin:.22in auto 0;max-width:6.4in;background:#FFE6A8;color:#5A3A00;border-radius:.2in;padding:.16in .32in;text-align:center}
.gift small{display:block;font-size:.16in;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.gift b{display:block;font-size:.3in;line-height:1.15;margin-top:.04in}
</style></head><body><div class="page">
<div class="top"><div class="logo" ${b.logoUrl?'style="background:#fff;padding:.12in"':''}>${b.logoUrl?`<img src="${location.origin+b.logoUrl}" style="width:100%;height:100%;object-fit:contain">`:escapeHtml(initialOf(b.name))}</div><h1>${escapeHtml(b.name)}</h1>
<div class="sub">${isWalletBiz(b) ? `Cada compra te deja ${b.walletPct}% en saldo para la siguiente` : `Junta ${goal} ${unit} y gana ${escapeHtml(inSentence(b.rewardDesc))}`}</div></div>
<div class="mid">${signupPromo(b) ? `<div class="gift" style="margin:0 auto .22in"><small>Promoción por registrarte</small><b>${escapeHtml(signupPromo(b).text)}</b></div>` : ''}<img src="${qr}" alt="Código QR"><div class="cta">Escanea y pide tu tarjeta</div>
<div class="steps">Abre la cámara de tu celular, apunta al código y regístrate en segundos.<br>Sin descargar ninguna app.</div></div>
<div class="foot">${escapeHtml(url)}</div></div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`);
  w.document.close();
}

function inviteCardHtml(){
  const url = customerLink(cache.biz.slug);
  return `<div class="card mt-12">
    <div class="invite">
      <div class="qr-box">${qrSvg(url)}</div>
      <div>
        <p class="small" style="color:var(--ink-2)">Tus clientes escanean este QR o abren la liga, piden su tarjeta y te llega la solicitud aquí.</p>
        <div class="invite-link mt-8">${escapeHtml(url)}</div>
      </div>
    </div>
    <div class="invite-btns">
      <button class="btn btn-secondary" onclick="shareLink()">${ic('share',18)} Compartir</button>
      <button class="btn btn-secondary" onclick="downloadQR()">${ic('download',18)} Descargar QR</button>
      <button class="btn btn-secondary" onclick="printPoster()">${ic('printer',18)} Cartel</button>
    </div>
    ${myStickersHtml()}
  </div>`;
}

function topFavoritesHtml(){
  if(!isPremiumBiz()) return '';
  const counts = {};
  cache.customers.forEach(c => (c.favorites||[]).forEach(f => { counts[f] = (counts[f]||0) + 1; }));
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3);
  if(!top.length) return '';
  return `<div class="card mt-12">
    <div class="card-title">${ic('heart',18)} Lo que más aman tus clientes</div>
    ${top.map(([name,n],i)=>`<div class="fav-rank"><span class="avatar sm" style="width:30px;height:30px;border-radius:10px;font-size:.8rem;background:var(--brand-soft);color:var(--brand-deep)">${i+1}</span><b>${escapeHtml(name)}</b><span class="muted small">${n} ${n===1?'cliente':'clientes'}</span></div>`).join('')}
  </div>`;
}

function onbFlags(){ try{ return JSON.parse(store.get('vuelve_onb_'+session.slug)||'{}')||{}; }catch(e){ return {}; } }
function setOnbFlag(k){ const f = onbFlags(); f[k]=true; store.set('vuelve_onb_'+session.slug, JSON.stringify(f)); }
// Primeros pasos: en Hoy solo se ve el siguiente, para no llenar la pantalla.
function onboardingSteps(){
  const f = onbFlags(), b = cache.biz, prem = isPremiumBiz();
  if(isOwner() && myStickers===null && typeof loadMyStickers==='function') setTimeout(loadMyStickers, 0);
  const hasSticker = Array.isArray(myStickers) && myStickers.length > 0;
  return [
    { done: !!f.cartel || hasSticker, label:'Pega tu sticker o imprime tu cartel', go:"openInvitar()" },
    { done: activeCustomers().length>0, label:'Registra a tu primer cliente', go:"dashboardTab='clientes';newCustomerOpen=true;newCustomerForm={phone:'',name:'',email:'',bday:{day:'',month:''},source:''};render()" },
    { done: !!f.premio, label:'Revisa tu premio y tu meta', go:"openConfig()" },
    { done: !!(b.hasStaffPin || b.teamCount), label:'Da de alta a tu equipo', go:"openEquipo()" },
    ...(prem ? [{ done: !!(b.promos && (b.promos.welcome || b.promos.referral || (b.promos.rules||[]).length)), label:'Activa tus promociones', go:"openCrecer()" }] : []),
    ...(prem ? [{ done: !!b.logoUrl, label:'Sube tu logo', go:"openConfig()" }] : []),
    { done: !bizLegalMissing(b), label:'Completa tu aviso de privacidad', go:"openConfig();setTimeout(()=>{const e=document.getElementById('legal-card');if(e)e.scrollIntoView({behavior:'smooth'})},60)" }
  ];
}
// Bienvenida: la cuenta ya está lista; si quiere, el tutorial (misiones) o una cuenta de ejemplo en uso.
function welcomeHtml(){
  if(!isOwner() || isDemoBiz() || onbFlags().welcome) return '';
  return `<div class="pnl-welcome">
    <span class="pnl-k">Tu tarjeta ya está lista</span>
    <h3>Ya puedes dar sellos desde hoy.</h3>
    <p>¿Quieres que te enseñemos a usar Redeo? Son misiones cortas, a tu ritmo.</p>
    <div class="pnl-welcome-btns">
      <button class="btn btn-gold2" onclick="setOnbFlag('welcome');openAcademy()">${ic('trophy',18)} Sí, ver el tutorial</button>
      <button class="btn btn-ghost-light" ${busy?'disabled':''} onclick="openSampleAccount()">${ic('users',18)} Ver una cuenta de ejemplo</button>
    </div>
    <button class="pnl-welcome-x" onclick="setOnbFlag('welcome');render()">Ahora no</button>
  </div>`;
}
// Cuenta de ejemplo con clientes de prueba; se guarda a qué cuenta regresar.
async function openSampleAccount(){
  if(!session || !isOwner()) return;
  const back = { slug:session.slug, pin:session.pin };
  let saved = null; try{ saved = JSON.parse(store.get('vuelve_sample_'+back.slug)||'null'); }catch(e){}
  busy=true; render();
  let r = saved ? await loadDashboard(saved.slug, saved.pin) : { ok:false };
  if(!r.ok){
    const c = await api('POST','/api/businesses/'+enc(back.slug)+'/sample', {}, back.pin);
    if(!c.ok){ busy=false; await loadDashboard(back.slug, back.pin); showToast(errMsg(c,'No se pudo abrir la cuenta de ejemplo.'), 5000); render(); return; }
    saved = { slug:c.data.slug, pin:c.data.pin };
    store.set('vuelve_sample_'+back.slug, JSON.stringify(saved));
    r = await loadDashboard(saved.slug, saved.pin);
  }
  busy=false;
  if(!r.ok){ await loadDashboard(back.slug, back.pin); showToast('No se pudo abrir la cuenta de ejemplo.', 5000); render(); return; }
  store.set('vuelve_sample_return', JSON.stringify(back));
  setOnbFlagFor(back.slug, 'welcome');
  dashboardTab='resumen'; expandedPhone=null; view='dashboard'; window.scrollTo(0,0); render();
  showToast('Así se ve Redeo con clientes. Toca todo lo que quieras: es de ejemplo.', 5000);
}
async function backToMyAccount(){
  let back = null; try{ back = JSON.parse(store.get('vuelve_sample_return')||'null'); }catch(e){}
  store.del('vuelve_sample_return');
  if(!back){ cerrarSesion(); return; }
  busy=true; render();
  const r = await loadDashboard(back.slug, back.pin);
  busy=false;
  if(!r.ok){ showToast('Entra de nuevo con tu código y PIN.', 5000); view='negocioEntrar'; render(); return; }
  dashboardTab='resumen'; expandedPhone=null; view='dashboard'; window.scrollTo(0,0); render();
}
function setOnbFlagFor(slug, k){ try{ const f = JSON.parse(store.get('vuelve_onb_'+slug)||'{}')||{}; f[k]=true; store.set('vuelve_onb_'+slug, JSON.stringify(f)); }catch(e){} }

function nextStepHtml(){
  if(!isOwner() || isDemoBiz() || onbFlags().hidden || !onbFlags().welcome) return '';
  const steps = onboardingSteps(), next = steps.find(x=>!x.done);
  if(!next) return '';
  const n = steps.filter(x=>x.done).length;
  return `<div class="pnl-next">
    <button class="pnl-next-go" onclick="${next.go}">
      <span class="pnl-next-n">${n+1}</span>
      <span style="flex:1;min-width:0;text-align:left"><span class="pnl-k">Siguiente paso · ${n} de ${steps.length} listos</span><b>${next.label}</b></span>${ic('right',18)}
    </button>
    <button class="pnl-next-x" aria-label="Ocultar los primeros pasos" onclick="setOnbFlag('hidden');render()">${ic('x',16)}</button>
  </div>`;
}

// Meta de la prueba: solo para el dueño mientras dura su prueba gratis; después desaparece.
const TRIAL_GOAL = 20;
function trialGoalHtml(){
  const a = cache.biz.access;
  if(!isOwner() || isDemoBiz() || !a || a.type!=='trial' || a.expired) return '';
  const cs = activeCustomers(), n = cs.length;
  const back = cs.filter(c=>(Number(c.visits)||0) >= 2).length;
  const pct = Math.min(100, Math.round(n / TRIAL_GOAL * 100));
  const tip = n >= TRIAL_GOAL ? '¡Meta cumplida! Ahora lo importante es que regresen.'
    : n === 0 ? 'En cada venta pregunta: “¿Ya tienes tu tarjeta de lealtad?”'
    : `Te ${TRIAL_GOAL-n===1?'falta 1':'faltan '+(TRIAL_GOAL-n)}. En cada venta pregunta: “¿Ya tienes tu tarjeta?”`;
  return `<div class="card pnl-status">
    <div class="pnl-status-top"><span class="pnl-k">Prueba · ${a.daysLeft===1?'último día':'quedan '+a.daysLeft+' días'}</span><button class="linkbtn small" onclick="openMembresia()">Ver precio</button></div>
    <div class="pnl-goal"><b>${n}</b><span>de ${TRIAL_GOAL} clientes</span><em>${back} ${back===1?'ya regresó':'ya regresaron'}</em></div>
    <div class="pnl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${TRIAL_GOAL}" aria-valuenow="${Math.min(n,TRIAL_GOAL)}"><span style="width:${pct}%"></span></div>
    <p class="muted small" style="margin:8px 0 0;line-height:1.45">${tip}</p>
  </div>`;
}
function statsHtml(){
  const cs = activeCustomers(), W = isWalletBiz(cache.biz), isSellos = cache.biz.mechanic==='sellos';
  const given = cs.reduce((s,c)=>s + (Number(c.given)||0), 0);
  const redeem = cs.reduce((s,c)=>s + c.redemptions, 0);
  const balance = cs.reduce((s,c)=>s + (Number(c.progress)||0), 0);
  const cell = (num, label) => `<div><b>${num}</b><span>${label}</span></div>`;
  return `<div class="card pnl-stats">
    ${cell(cs.length, cs.length===1?'cliente':'clientes')}
    ${cell(W?pesos(given):given, W?'saldo dado':isSellos?'sellos dados':'puntos dados')}
    ${cell(W?pesos(balance):redeem, W?'por usar':redeem===1?'premio':'premios')}
  </div>`;
}
// Avisos de hoy: solo aparecen si hay algo que hacer.
function todayAlertsHtml(){
  const cs = activeCustomers(), pend = pendingCustomers().length;
  const ready = isWalletBiz(cache.biz) ? 0 : cs.filter(c=>canRedeem(cache.biz, c)).length;
  const due = isOwner() && isPremiumBiz() ? remindersDueCount() : 0;
  const rows = [];
  if(pend) rows.push(['inbox', `${pend} ${pend===1?'solicitud nueva':'solicitudes nuevas'}`, 'Apruébalas', "dashboardTab='clientes';render()", 'hot']);
  if(ready) rows.push(['gift', `${ready} ${ready===1?'cliente tiene':'clientes tienen'} premio listo`, '', "dashboardTab='clientes';render()", '']);
  if(due) rows.push(['bell', due===1?'A 1 cliente le toca volver':`A ${due} clientes les toca volver`, 'Recuérdales por WhatsApp', "crecerSub='reminders';openCrecer()", '']);
  if(isOwner() && secAlertsCount) rows.push(['lock', secAlertsCount===1?'1 cosa por revisar de tu equipo':`${secAlertsCount} cosas por revisar de tu equipo`, '', "openEquipo()", '']);
  if(!rows.length) return '';
  return `<div class="pnl-list mt-12">${rows.map(([i,t,sb,go,cls])=>`<button class="pnl-row ${cls}" onclick="${go}"><span class="pnl-row-ico">${ic(i,19)}</span><span class="pnl-row-t"><b>${t}</b>${sb?`<span>${sb}</span>`:''}</span><span class="chev">${ic('right',18)}</span></button>`).join('')}</div>`;
}

function dashboardResumen(){
  const W = isWalletBiz(cache.biz), isSellos = cache.biz.mechanic==='sellos';
  const a = cache.biz.access;
  const trial = isOwner() && !isDemoBiz() && a && a.type==='trial' && !a.expired;
  return `
    ${demoTryHtml()}
    ${welcomeHtml()}
    <div class="pnl-hoy"><div class="pnl-hoy-a">
    <button class="pnl-main" onclick="openScanner()">
      <span class="pnl-main-ico">${ic('scan',30)}</span>
      <span class="pnl-main-t"><b>${W?'Abonar compra':isSellos?'Dar sello':'Sumar puntos'}</b><span>Escanea la tarjeta del cliente</span></span>
    </button>
    <button class="pnl-alt" onclick="openCompra()">${ic('receipt',16)} Usar código de compra</button>
    ${todayAlertsHtml()}
    </div><div class="pnl-hoy-b">
    ${trial ? trialGoalHtml() : statsHtml()}
    ${nextStepHtml()}
    </div></div>
    ${isDemoBiz() && !isSampleView() ? acadCalcCardHtml(true) : ''}
    ${demoCtaHtml()}
  `;
}

function dashboardClientes(){
  const q = customerSearch.trim();
  const list = activeCustomers().filter(c => !q || c.phone.includes(q) || (c.name||'').toLowerCase().includes(q.toLowerCase()));
  const pend = pendingCustomers();
  const biz = cache.biz;
  const goal = goalOf(biz);

  const rows = list.map(c => {
    const isOpen = expandedPhone===c.phone;
    const wal = isWalletBiz(biz);
    const ready = canRedeem(biz, c);
    const pct = Math.max(0, Math.min(100, Math.round(c.progress/goal*100)));
    let row = `
      <div class="item" onclick="expandedPhone = expandedPhone==='${jsEsc(c.phone)}' ? null : '${jsEsc(c.phone)}'; confirmRedeemPhone=null; render()">
        <div class="avatar sm" style="background:${tint(biz.color)};color:${shade(biz.color,-30)}">${escapeHtml(initialOf(c.name||c.phone))}</div>
        <div class="item-main"><div class="item-name">${escapeHtml(c.name||'Sin nombre')} ${levelChipHtml(c.level)}</div><div class="item-sub">${escapeHtml(fmtPhone(c.phone))}${c.reminder && c.reminder.daysLeft<=0 && !c.reminder.sentAt ? ` · <span style="color:#8A5B00;font-weight:700">${ic('bell',12)} ${escapeHtml(dueText(c.reminder))}</span>` : ''}</div></div>
        <div class="item-prog">${wal ? `<b>${pesos(c.progress)}</b><span class="muted" style="font-size:.7rem;display:block">saldo</span>` : `<b>${c.progress}/${goal}</b><div class="mini"><span style="width:${pct}%;background:${biz.color}"></span></div>${ready?'<span class="badge-ready">Premio listo</span>':''}`}</div>
        <button class="quick" ${busy?'disabled':''} aria-label="${biz.mechanic==='sellos'?'Dar sello':wal?'Abonar saldo':'Sumar puntos'} a ${escapeHtml(c.name||c.phone)}" onclick="event.stopPropagation();openSheet('${jsEsc(c.phone)}')">${ic('stamp',20)}</button>
      </div>`;
    if(isOpen){
      row += `<div class="item-open"><div class="mt-12">${passHtml(biz, c, {qr:true})}</div>
        ${cardShareHtml(c)}
        ${bdayRowHtml(c)}
        ${reminderRowHtml(c)}
        ${undoBarHtml(c.phone)}
        ${isOwner() ? customerEditHtml(c) : ''}
        ${isOwner() ? `<div class="ficha mt-12">
          <div class="kv"><span class="muted small">Correo</span>${c.email?`<a class="mono small" style="color:var(--ink)" href="mailto:${escapeHtml(c.email)}" onclick="event.stopPropagation()">${escapeHtml(c.email)}</a>`:'<span class="muted small">Sin correo</span>'}</div>
          <div class="kv"><span class="muted small">Favoritos</span><span class="small" style="text-align:right">${(c.favorites||[]).length?escapeHtml(c.favorites.join(', ')):'<span class="muted">Sin elegir</span>'}</span></div>
          <div class="kv"><span class="muted small">Promociones</span><span class="row" style="gap:8px"><span class="small" style="font-weight:700;color:${c.marketingOptIn?'var(--ok)':'var(--muted)'}">${c.marketingOptIn?'Sí acepta':'No acepta'}</span><button class="linkbtn small" onclick="event.stopPropagation();setCustomerMarketing('${jsEsc(c.phone)}', ${c.marketingOptIn?'false':'true'})">${c.marketingOptIn?'Dar de baja':'Cambiar'}</button></span></div>
        </div>` : ''}
        ${historyHtml(c.phone)}
        <div class="stack mt-16">`;
      if(wal){
        row += walletActionsHtml(c, 'list') + `</div></div>`;
        return row;
      }
      if(biz.mechanic==='sellos'){
        row += `<button class="btn btn-primary btn-block" ${busy?'disabled':''} onclick="event.stopPropagation();${((biz.products||[]).length || needsCode())?`openSheet('${jsEsc(c.phone)}')`:`addProgress('${jsEsc(c.phone)}',1)`}">${ic('stamp')} Dar 1 sello</button>`;
      }else{
        const val = pointsInputs[c.phone] || biz.pointsPerVisit;
        row += `<div class="row"><input class="input" type="number" min="1" value="${val}" style="max-width:110px" oninput="pointsInputs['${jsEsc(c.phone)}']=this.value" onclick="event.stopPropagation()">
          <button class="btn btn-primary" style="flex:1" ${busy?'disabled':''} onclick="event.stopPropagation();${needsCode()?`openSheet('${jsEsc(c.phone)}')`:`addProgress('${jsEsc(c.phone)}', Number(pointsInputs['${jsEsc(c.phone)}'] || ${biz.pointsPerVisit}))`}">${ic('plus')} Sumar puntos</button></div>`;
      }
      if(confirmRedeemPhone===c.phone){
        row += redeemConfirmHtml(c, { inList:true });
      }else{
        row += `<button class="btn ${ready?'btn-gold':'btn-secondary'} btn-block" ${ready?'':'disabled'} onclick="event.stopPropagation();${needsCode()?`openSheet('${jsEsc(c.phone)}')`:`askRedeem('${jsEsc(c.phone)}')`}">${ic('gift')} ${ready?(rewardMenuOf(biz)?'Canjear un premio':'Canjear premio'):'Aún no alcanza '+(rewardMenuOf(biz)?'ningún premio':'el premio')}</button>`;
      }
      row += `</div></div>`;
    }
    return row;
  }).join('');

  const empty = `<div class="empty"><div class="empty-ico">${ic('users',26)}</div><b style="color:var(--ink)">${q?'Sin resultados':'Aún no tienes clientes'}</b><p class="small mt-8">${q?'Prueba con otro nombre o teléfono.':'Da de alta a tu primer cliente con su teléfono.'}</p></div>`;

  return `
    ${pend.length ? `
    <div class="req-card" style="margin-top:0;margin-bottom:14px">
      <div class="req-head">${ic('inbox',18)} ${pend.length===1?'1 solicitud nueva':pend.length+' solicitudes nuevas'}</div>
      ${pend.map(c=>`
      <div class="item" style="cursor:default;flex-wrap:wrap">
        <div class="avatar sm" style="background:${tint(biz.color)};color:${shade(biz.color,-30)}">${escapeHtml(initialOf(c.name||c.phone))}</div>
        <div class="item-main"><div class="item-name">${escapeHtml(c.name||'Sin nombre')}</div><div class="item-sub">${escapeHtml(fmtPhone(c.phone))}${c.email?' · '+escapeHtml(c.email):''}</div>${(c.favorites||[]).length?`<div class="item-sub">Le gusta: ${escapeHtml(c.favorites.join(', '))}</div>`:''}${signupPromo(biz)?`<div class="signup-line">${ic('gift',14)} Dale: ${escapeHtml(signupPromo(biz).text)}</div>`:''}</div>
        <div class="req-actions" style="flex-basis:100%">
          ${rejectBtnHtml(c)}
          <button class="btn btn-primary btn-sm" style="flex:1" ${busy?'disabled':''} onclick="approveRequest('${jsEsc(c.phone)}')">${ic('check',16)} Aprobar</button>
        </div>
      </div>`).join('')}
    </div>` : ''}
    <div class="input-icon">${ic('search',18)}<input class="input" type="search" placeholder="Nombre o últimos 4 dígitos" value="${escapeHtml(customerSearch)}" oninput="customerSearch=this.value;render();var i=document.querySelector('input[type=search]');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}"></div>
    ${newCustomerOpen ? `
      <div class="card mt-12">
        <div class="card-title">${ic('user',18)} Nuevo cliente</div>
        <div class="field"><label for="n-phone">Número de WhatsApp</label>${telField('n-phone', normalizePhone(newCustomerForm.phone), 'newCustomerForm.phone')}</div>
        <div class="field"><label for="n-name">Nombre <span class="muted">(opcional)</span></label><input id="n-name" class="input" type="text" value="${escapeHtml(newCustomerForm.name)}" oninput="newCustomerForm.name=this.value" placeholder="Ana"></div>
        <div class="field"><label>Cumpleaños <span class="muted">(recomendado)</span></label>${bdayPickerHtml('newCustomerForm.bday','n-bday')}<p class="hint">Con su número de WhatsApp y su cumpleaños podrá abrir su tarjeta desde cualquier celular.</p></div>
        <div class="field"><label for="n-email">Correo <span class="muted">(opcional)</span></label><input id="n-email" class="input" type="email" autocapitalize="none" value="${escapeHtml(newCustomerForm.email||'')}" oninput="newCustomerForm.email=this.value" placeholder="ana@ejemplo.com"></div>
        ${staffSourceHtml()}
        <label class="check"><input type="checkbox" ${newCustomerForm.marketing?'checked':''} onchange="newCustomerForm.marketing=this.checked"><span>El cliente acepta recibir promociones por WhatsApp o correo.</span></label>
        ${errorHtml(newCustomerError)}
        <div class="row mt-16"><button class="btn btn-primary" style="flex:1" ${busy?'disabled':''} onclick="addCustomer()">Guardar cliente</button><button class="btn btn-ghost" onclick="newCustomerOpen=false;newCustomerError='';render()">Cancelar</button></div>
      </div>
    ` : `<div class="row mt-12" style="gap:8px"><button class="btn btn-secondary" style="flex:1" onclick="newCustomerOpen=true;newCustomerForm={phone:'',name:'',email:'',bday:{day:'',month:''},source:''};render()">${ic('plus')} Nuevo cliente</button>${isOwner()?`<button class="btn btn-secondary" style="flex:1" onclick="openInvitar()">${ic('qr',18)} Invitar</button>`:''}</div>`}
    ${list.length ? `<div class="list">${rows}</div>` : `<div class="card mt-12">${empty}</div>`}
  `;
}

function rejectBtnHtml(c){
  const sure = rejectConfirmPhone===c.phone;
  return `<button class="btn ${sure?'btn-danger':'btn-secondary'} btn-sm" style="flex:1" ${busy?'disabled':''} aria-label="Rechazar solicitud de ${escapeHtml(c.name||c.phone)}" onclick="event.stopPropagation();rejectRequest('${jsEsc(c.phone)}')">${ic('x',16)} ${sure?'Sí, rechazar':'Rechazar'}</button>`;
}
