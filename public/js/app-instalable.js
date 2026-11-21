/* Redeo · App instalable: la tarjeta del cliente y el panel del negocio se agregan a la pantalla de inicio
   con su propio ícono, abren sin barra del navegador y la tarjeta se sigue viendo sin internet. */
let installEvt = null;      // aviso de Android/Chrome para instalar con un botón
let installSheet = null;    // { kind:'card'|'panel' }
let offlineMode = false;    // la última respuesta vino guardada (sin internet)

function isStandalone(){ try{ return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }catch(e){ return false; } }
function isIOS(){ return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1); }
function isMobile(){ return isIOS() || /Android/i.test(navigator.userAgent); }
function isAndroidWebView(){ return /Android/i.test(navigator.userAgent) && /; wv\)|FBAN|FBAV|Instagram|WhatsApp/i.test(navigator.userAgent); }

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if(view==='clienteTarjeta' || view==='dashboard') render(); });
window.addEventListener('appinstalled', () => { installEvt = null; installSheet = null; store.set('vuelve_inst_done','1'); showToast('¡Listo! Ya está en tu pantalla de inicio.'); });
window.addEventListener('online', () => { if(offlineMode){ offlineMode = false; if(view==='clienteTarjeta' && clienteResult && clienteResult.biz) buscarTarjetaCliente(); else render(); } });

// ----- Lo que el celular lee para instalar: manifiesto, ícono y nombre -----
let appHeadKey = '';
function setHead(sel, attr, value){ const el = document.querySelector(sel); if(el && el.getAttribute(attr)!==value) el.setAttribute(attr, value); }
function iconUrl(biz, size){ return biz && biz.appIcon ? '/app/icono/'+biz.slug+'-'+size+'.png?v='+biz.appIcon.v : '/app/redeo-'+size+'.png'; }
function updateAppHead(){
  let manifest = '/manifest.webmanifest', icon = '/app/redeo-180.png', title = 'Redeo';
  const R = clienteResult;
  if(view==='clienteTarjeta' && R && R.biz && R.status!=='no_biz'){
    const personal = R.token && R.customer && R.customer.phone ? '&c='+enc(R.customer.phone)+'&t='+enc(R.token) : '';
    manifest += '?n='+enc(R.biz.slug)+personal; icon = iconUrl(R.biz, 180); title = R.biz.name;
  }else if(view==='clienteBuscar' && clientePreview){
    manifest += '?n='+enc(clientePreview.slug); icon = iconUrl(clientePreview, 180); title = clientePreview.name;
  }else if((view==='dashboard' || view==='membresia') && cache.biz && session.slug){
    manifest += '?panel='+enc(session.slug); icon = '/app/panel-180.png'; title = 'Mi negocio';
  }
  const key = manifest+'|'+icon+'|'+title;
  if(key===appHeadKey) return;
  appHeadKey = key;
  setHead('#app-manifest','href', manifest);
  setHead('#app-touch-icon','href', icon);
  setHead('meta[name="apple-mobile-web-app-title"]','content', title.slice(0,30));
}

// ----- Invitación a instalar -----
function installSeenKey(kind){ return kind==='panel' ? 'vuelve_inst_panel' : 'vuelve_inst_'+((clienteResult && clienteResult.biz && clienteResult.biz.slug)||''); }
function openInstall(kind){
  installSheet = { kind };
  // En iPhone, "Agregar a inicio" guarda la dirección que está abierta: dejamos la liga completa
  // para que la app abra directo en su tarjeta (o en el panel).
  if(isIOS()){
    const R = clienteResult;
    if(kind==='card' && R && R.biz && R.token && R.customer) history.replaceState(null,'','/?n='+enc(R.biz.slug)+'&c='+enc(R.customer.phone)+'&t='+enc(R.token)+'&app=1');
    if(kind==='panel' && session.slug) history.replaceState(null,'','/?panel='+enc(session.slug)+'&app=1');
  }
  render();
}
function closeInstall(never){
  if(installSheet && never) store.set(installSeenKey(installSheet.kind), 'no');
  installSheet = null; render();
}
async function doInstall(){
  if(!installEvt) return;
  const e = installEvt; installEvt = null;
  try{ e.prompt(); const c = await e.userChoice; if(c && c.outcome==='accepted'){ installSheet = null; store.set('vuelve_inst_done','1'); } }catch(err){}
  render();
}
// Se ofrece una sola vez, después de ver su tarjeta. Si dice "Ahora no", no se insiste.
let installAutoTimer = null;
function maybeOfferInstall(){
  if(installAutoTimer || installSheet || isStandalone() || !isMobile()) return;
  const R = clienteResult;
  if(view!=='clienteTarjeta' || !R || R.status!=='found' || !R.biz || R.biz.isDemo) return;
  if(store.get(installSeenKey('card'))) return;
  installAutoTimer = setTimeout(()=>{
    installAutoTimer = null;
    if(view!=='clienteTarjeta' || installSheet || store.get(installSeenKey('card'))) return;
    store.set(installSeenKey('card'), 'shown');
    openInstall('card');
  }, 2600);
}
function installIconHtml(kind, biz){
  if(kind==='panel') return `<img class="inst-icon" src="/app/panel-180.png" alt="">`;
  if(biz && biz.appIcon) return `<span class="inst-wrap"><img class="inst-icon" src="${escapeHtml(iconUrl(biz,180))}" alt=""></span>`;
  return `<span class="inst-wrap"><span class="inst-icon inst-tile" style="background:linear-gradient(155deg,${biz.color},${shade(biz.color,-28)});color:${textOn(biz.color)}">${escapeHtml(initialOf(biz.name))}</span><span class="inst-seal">${ic('check',11)}</span></span>`;
}
function installSheetHtml(){
  if(!installSheet) return '';
  const kind = installSheet.kind, biz = kind==='panel' ? cache.biz : (clienteResult && clienteResult.biz);
  if(!biz) return '';
  const title = kind==='panel' ? 'Tu panel, a un toque' : `Ten tu tarjeta de ${escapeHtml(biz.name)} a un toque`;
  const sub = kind==='panel' ? 'Se abre como app con el nombre "Mi negocio". Ideal para el celular de caja.' : 'Sin descargar nada. Se queda junto a tus apps.';
  let how;
  if(installEvt){
    how = `<button class="btn btn-primary btn-block inst-cta" onclick="doInstall()">${ic('addhome',20)} Agregar a mi pantalla</button>`;
  }else if(isIOS()){
    how = `<div class="inst-steps">
        <div class="inst-step"><span class="k">${ic('shareios',16)}</span><span>Toca <b>Compartir</b> en la barra de Safari</span></div>
        <div class="inst-step"><span class="k">${ic('addhome',16)}</span><span>Elige <b>Agregar a inicio</b> y listo</span></div>
      </div>
      <p class="hint" style="margin-top:-6px">¿No aparece? Abre esta página en Safari (toca el ícono de Safari o "Abrir en Safari").</p>
      <button class="btn btn-primary btn-block inst-cta" onclick="closeInstall(true)">Ya entendí, lo hago</button>`;
  }else{
    how = `<div class="inst-steps">
        <div class="inst-step"><span class="k">${ic('dots',16)}</span><span>Abre el <b>menú</b> de tu navegador (los 3 puntos)</span></div>
        <div class="inst-step"><span class="k">${ic('addhome',16)}</span><span>Toca <b>Instalar app</b> o <b>Agregar a pantalla principal</b></span></div>
      </div>
      ${isAndroidWebView() ? `<p class="hint" style="margin-top:-6px">Si lo abriste desde WhatsApp o Instagram, primero toca "Abrir en Chrome".</p>` : ''}
      <button class="btn btn-primary btn-block inst-cta" onclick="closeInstall(true)">Ya entendí, lo hago</button>`;
  }
  return `<div class="sheet-bg inst-bg" onclick="if(event.target===this)closeInstall(true)"><div class="sheet inst-sheet" role="dialog" aria-label="Agregar a la pantalla de inicio">
    <div class="sheet-grip"></div>
    <div class="inst-head">${installIconHtml(kind, biz)}<div><h3>${title}</h3><p>${sub}</p></div></div>
    ${how}
    <button class="linkbtn inst-later" onclick="closeInstall(true)">Ahora no</button>
  </div></div>`;
}
// Liga discreta en la tarjeta para instalar cuando quiera.
function installLinkHtml(kind){
  if(isStandalone() || store.get('vuelve_inst_done')) return '';
  if(kind==='card' && !isMobile()) return '';
  return `<button class="linkbtn small inst-link" onclick="openInstall('${kind}')">${ic('phoneapp',16)} Agregar a mi pantalla de inicio</button>`;
}
// Tarjeta en Resumen del panel.
function installPanelCardHtml(){
  if(isStandalone() || !isMobile() || store.get('vuelve_inst_panel')) return '';
  return `<div class="card mt-12 inst-card"><div class="inst-card-top"><span class="inst-mini"><img src="/app/panel-180.png" alt=""></span><div style="flex:1;min-width:0"><b>Instala tu panel en este celular</b><p class="muted small" style="margin-top:2px">Abre como app con el nombre "Mi negocio". Sin descargar nada.</p></div></div>
    <div class="row mt-12" style="gap:8px"><button class="btn btn-primary btn-sm" style="flex:1" onclick="openInstall('panel')">${ic('phoneapp',16)} Instalar</button><button class="btn btn-ghost btn-sm" onclick="store.set('vuelve_inst_panel','no');render()">Ahora no</button></div></div>`;
}
// Aviso en la tarjeta cuando no hay internet.
function offlineChipHtml(){
  return offlineMode ? `<div class="off-chip mt-12">${ic('wifioff',16)} Sin internet · tu tarjeta guardada sigue funcionando</div>` : '';
}

// ----- Ícono de la app del negocio: lo dibuja el celular del dueño (con su color, inicial o logo) -----
let appIconTried = '';
function appIconSig(b){ return ['v1', b.name, b.color, b.logoUrl||'', b.plan].join('|'); }
function loadImg(src){ return new Promise((ok, fail)=>{ const im = new Image(); im.onload = ()=>ok(im); im.onerror = fail; im.src = src; }); }
function roundRect(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
async function drawAppIcon(b){
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, S, S); grad.addColorStop(0, b.color); grad.addColorStop(1, shade(b.color, -28));
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  // Todo lo importante queda dentro del círculo central (así se ve bien en íconos redondos o cuadrados).
  let drewLogo = false;
  if(b.logoUrl){
    try{
      const im = await loadImg(b.logoUrl);
      g.fillStyle = '#FFFFFF'; roundRect(g, 136, 136, 240, 240, 56); g.fill();
      const k = Math.min(196/im.width, 196/im.height), w = im.width*k, h = im.height*k;
      g.drawImage(im, 256-w/2, 256-h/2, w, h); drewLogo = true;
    }catch(e){}
  }
  if(!drewLogo){
    try{ await document.fonts.load('700 230px Fraunces'); }catch(e){}
    g.fillStyle = textOn(b.color); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 236px Fraunces, Georgia, serif';
    g.fillText(initialOf(b.name), 256, 268);
  }
  // Selito dorado: "esto es una tarjeta Redeo"
  const sx = 356, sy = 356;
  g.fillStyle = shade(b.color, -28); g.beginPath(); g.arc(sx, sy, 46, 0, Math.PI*2); g.fill();
  g.fillStyle = '#E8C274'; g.beginPath(); g.arc(sx, sy, 38, 0, Math.PI*2); g.fill();
  g.strokeStyle = '#0A2A20'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(sx-16, sy+1); g.lineTo(sx-4, sy+13); g.lineTo(sx+18, sy-11); g.stroke();
  const out = { png512: c.toDataURL('image/png') };
  for(const s of [192,180]){ const k = document.createElement('canvas'); k.width = k.height = s; k.getContext('2d').drawImage(c, 0, 0, s, s); out['png'+s] = k.toDataURL('image/png'); }
  return out;
}
async function ensureAppIcon(){
  const b = cache.biz;
  if(!b || !isOwner() || isExpired() || !document.createElement('canvas').getContext) return;
  const sig = appIconSig(b);
  if((b.appIcon && b.appIcon.sig===sig) || appIconTried===sig) return;   // ya está al día (o ya se intentó con este diseño)
  appIconTried = sig;
  try{
    const icons = await drawAppIcon(b);
    const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/app-icon', { sig, ...icons }, session.pin);
    if(r.ok && cache.biz){ cache.biz.appIcon = r.data; appHeadKey = ''; }
  }catch(e){}
}

// ----- Funcionar sin internet -----
function registerServiceWorker(){
  if(!('serviceWorker' in navigator) || location.protocol==='file:') return;
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('/sw.js').catch(()=>{}); });
}
