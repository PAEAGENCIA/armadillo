/* Redeo · Stickers con QR para el mostrador.
   P.A.E. los imprime SIN negocio (mismo diseño, cada uno con su código). En la visita se pega uno y se conecta
   escaneándolo: desde el panel del negocio, desde Administración, o abriendo el sticker y escribiendo código + PIN. */

// ---------- Diseño del sticker (SVG redondo, sirve para imprimir en cualquier tamaño) ----------
// Los stickers llevan el dominio oficial (PUBLIC_URL en Railway); si no está, el de la página abierta.
function stickerUrl(code){ return ((serverConfig && serverConfig.publicUrl) || location.origin) + '/s/' + code; }
function stickerQrPath(text){
  const q = qrcode(0,'M'); q.addData(text); q.make();
  const n = q.getModuleCount(); let d = '';
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(q.isDark(r,c)) d += `M${c} ${r}h1v1h-1z`;
  return { d, n };
}
function stickerSvg(code){
  const { d, n } = stickerQrPath(stickerUrl(code));
  const qs = 27 / n;   // el QR mide 27 de 100 (con aire alrededor del recuadro blanco)
  const host = ((serverConfig && serverConfig.publicUrl) || location.origin).replace(/^https?:\/\//,'').replace(/:\d+$/,'');
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="stk">
    <defs>
      <path id="arcTop-${code}" d="M 13 50 A 37 37 0 0 1 87 50"/>
      <path id="arcBot-${code}" d="M 11 50 A 39 39 0 0 0 89 50"/>
    </defs>
    <circle cx="50" cy="50" r="50" fill="#0F5A45"/>
    <circle cx="50" cy="50" r="46.2" fill="none" stroke="#E8C274" stroke-width=".7" stroke-dasharray="1.6 1.4"/>
    <text font-family="'Plus Jakarta Sans',Arial,sans-serif" font-weight="800" font-size="5.6" letter-spacing=".55" fill="#F7F4EC"><textPath href="#arcTop-${code}" startOffset="50%" text-anchor="middle">PIDE AQUÍ TU TARJETA</textPath></text>
    <text font-family="'Plus Jakarta Sans',Arial,sans-serif" font-weight="800" font-size="4.6" letter-spacing=".8" fill="#E8C274"><textPath href="#arcBot-${code}" startOffset="50%" text-anchor="middle">ESCANEA · REGÍSTRATE</textPath></text>
    <!-- Logo Redeo: R en su cuadro + "rede" con la o de anillo dorado -->
    <g transform="translate(38.3 20.6)">
      <rect x="0" y="0" width="5.4" height="5.4" rx="1.5" fill="#F7F4EC" transform="rotate(-6 2.7 2.7)"/>
      <text x="2.75" y="4.25" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-style="italic" font-weight="700" font-size="4.2" fill="#0F5A45">R</text>
      <text x="7.1" y="4.7" font-family="Fraunces,Georgia,serif" font-style="italic" font-weight="700" font-size="6" letter-spacing="-.1" fill="#F7F4EC">rede</text>
      <g transform="translate(19.75 2.05) scale(.075)"><circle cx="20" cy="20" r="15" fill="none" stroke="#E8C274" stroke-width="6.5" stroke-linecap="round" stroke-dasharray="80 95" transform="rotate(-62 20 20)"/><circle cx="13.35" cy="6.55" r="3.9" fill="#E8C274"/></g>
    </g>
    <rect x="32" y="29.5" width="36" height="37.5" rx="5" fill="#FFFFFF"/>
    <g transform="translate(36.5 33) scale(${qs})"><path d="${d}" fill="#000"/></g>
    <text x="50" y="64.6" text-anchor="middle" font-family="'IBM Plex Mono',Menlo,monospace" font-weight="600" font-size="2.7" letter-spacing=".5" fill="#0A2A20">${code}</text>
    <text x="50" y="75.2" text-anchor="middle" font-family="'Plus Jakarta Sans',Arial,sans-serif" font-weight="700" font-size="4.1" letter-spacing=".25" fill="#F7F4EC">${host}</text>
  </svg>`;
}

// Hoja tamaño carta (21.6 × 27.9 cm) llena de stickers, sin marcos. Los tamaños caben con margen de impresora:
// 8 cm (6 por hoja), 6 cm (12) o 4.5 cm (20). Todo junto mide como máximo ~18.9 × 24.9 cm (cabe aunque la impresora deje 1.5 cm de margen).
const STICKER_SIZES = { 8:{ cols:2, rows:3, gap:.4 }, 6:{ cols:3, rows:4, gap:.3 }, 4.5:{ cols:4, rows:5, gap:.3 } };
function printStickers(codes, cm){
  cm = STICKER_SIZES[cm] ? cm : 8;
  const { cols, rows } = STICKER_SIZES[cm], per = cols*rows;
  const pages = [];
  for(let i=0;i<codes.length;i+=per) pages.push(codes.slice(i,i+per));
  const w = window.open('', '_blank');
  if(!w){ showToast('Permite las ventanas emergentes para imprimir.'); return; }
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Stickers Redeo (${codes.length})</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,700&family=Plus+Jakarta+Sans:wght@700;800&family=IBM+Plex+Mono:wght@600&display=swap" rel="stylesheet">
<style>@page{size:letter;margin:1cm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:#fff;font-family:Arial,sans-serif}
.page{width:100%;display:grid;grid-template-columns:repeat(${cols},${cm}cm);grid-auto-rows:${cm}cm;gap:${STICKER_SIZES[cm].gap}cm;justify-content:center;align-content:start;break-after:page;page-break-after:always}
.page:last-child{page-break-after:auto}
.cell{width:${cm}cm;height:${cm}cm;break-inside:avoid}
.stk{width:100%;height:100%;display:block}
.note{position:fixed;bottom:.25in;left:0;right:0;text-align:center;font-size:8pt;color:#999}
@media screen{body{background:#eee}.page{width:21.6cm;min-height:27.9cm;padding:1cm 0;box-sizing:border-box;background:#fff;margin:16px auto;box-shadow:0 2px 12px rgba(0,0,0,.15)}}
</style></head><body>
${pages.map(p=>`<div class="page">${p.map(c=>`<div class="cell">${stickerSvg(c)}</div>`).join('')}</div>`).join('')}
<script>document.fonts.ready.then(function(){setTimeout(function(){window.print()},300)})<\/script></body></html>`);
  w.document.close();
}

// ---------- Página que abre un sticker que todavía no está conectado (/?sticker=CODIGO) ----------
let stickerPage = null;   // { code, status, form:{slug,pin}, error, done }
async function openStickerPage(code){
  stickerPage = { code, status:'loading', form:{ slug:'', pin:'' }, error:'', done:null };
  view = 'sticker'; render();
  const r = await api('GET','/api/stickers/'+enc(code));
  if(r.ok && r.data.status==='assigned'){ location.replace('/s/'+enc(code)); return; }
  stickerPage.status = r.ok ? r.data.status : 'unknown';
  try{ const s = JSON.parse(store.get('vuelve_session')||'null'); if(s && s.slug){ stickerPage.saved = s; stickerPage.form.slug = s.slug; } }catch(e){}
  render();
}
async function assignStickerAs(slug, pin){
  const P = stickerPage; P.error = '';
  if(!slug || !pin){ P.error = 'Escribe el código de tu negocio y tu PIN de dueño.'; render(); return; }
  busy = true; render();
  const r = await api('POST','/api/stickers/'+enc(P.code)+'/assign', { slug: slugify(slug) }, pin);
  busy = false;
  if(!r.ok){ P.error = errMsg(r,'No se pudo conectar el sticker.'); render(); return; }
  P.done = r.data; render();
}
function viewSticker(){
  const P = stickerPage || {};
  let body;
  if(P.status==='loading') body = `<p class="muted mt-24">Cargando…</p>`;
  else if(P.status==='unknown') body = `<div class="card mt-24"><div class="empty"><div class="empty-ico">${ic('qr',26)}</div><b style="color:var(--ink)">Este código no es de Redeo</b><p class="small mt-8">Revisa que hayas escaneado el sticker correcto.</p></div></div>`;
  else if(P.done) body = `
    <div class="success-ico mt-24" style="background:var(--brand-soft);color:var(--brand)">${ic('check',30)}</div>
    <h2>¡Sticker conectado!</h2>
    <p class="lead">Desde ahora, quien escanee este sticker llega directo a pedir su tarjeta de <b>${escapeHtml(P.done.business.name)}</b>.</p>
    <a class="btn btn-primary btn-block mt-24" href="/s/${enc(P.code)}">${ic('qr',18)} Probarlo</a>`;
  else body = `
    <div class="stk-hero mt-16">${stickerSvg(P.code)}</div>
    <h2 class="mt-16">Este sticker aún no está conectado</h2>
    <p class="lead">Si lo viste en un negocio, pide tu tarjeta en caja. Pronto este código te llevará directo a ella.</p>
    <div class="card mt-24">
      <div class="card-title">${ic('store',18)} ¿Eres el dueño? Conéctalo a tu negocio</div>
      ${P.saved ? `<p class="muted small">Este celular tiene abierto el panel de <b>${escapeHtml(P.saved.slug)}</b>.</p>
        <button class="btn btn-primary btn-block mt-12" ${busy?'disabled':''} onclick="assignStickerAs(stickerPage.saved.slug, stickerPage.saved.pin)">${ic('check',18)} Conectar a ${escapeHtml(P.saved.slug)}</button>
        <p class="hint" style="text-align:center">¿Es otro negocio? Escribe su código y PIN abajo.</p>` : ''}
      <div class="field"><label for="stk-slug">Código del negocio</label><input id="stk-slug" class="input" autocapitalize="none" placeholder="cafe-luna" value="${escapeHtml(P.form.slug)}" oninput="stickerPage.form.slug=this.value"></div>
      <div class="field"><label for="stk-pin">PIN del dueño</label><input id="stk-pin" class="input code" type="password" inputmode="numeric" maxlength="8" value="${escapeHtml(P.form.pin)}" oninput="stickerPage.form.pin=this.value.replace(/\\D/g,'').slice(0,8);this.value=stickerPage.form.pin"></div>
      ${errorHtml(P.error)}
      <button class="btn ${P.saved?'btn-secondary':'btn-primary'} btn-block" ${busy?'disabled':''} onclick="assignStickerAs(stickerPage.form.slug, stickerPage.form.pin)">Conectar sticker</button>
    </div>
    <p class="hint" style="text-align:center">Código del sticker: <span class="mono">${escapeHtml(P.code)}</span></p>`;
  return `<div class="wrap fade"><div class="topbar">${logoHtml()}</div>${body}</div>`;
}

// ---------- Conectar escaneando (panel del negocio o Administración) ----------
let stickerTarget = null;   // { slug, name, admin:true } cuando se conecta desde Administración
function connectStickerScan(target){
  stickerTarget = target || { panel:true };
  openScanner();
  const h = document.querySelector('#scanner .hint'); if(h) h.textContent = 'Apunta al QR del sticker que vas a pegar';
}
function stickerCodeFrom(text){ const m = String(text||'').match(/\/s\/([A-Za-z0-9]{4,8})(?:[?#/]|$)/); return m ? m[1].toUpperCase() : null; }
async function handleStickerScan(code){
  const t = stickerTarget && stickerTarget.admin ? stickerTarget : null; stickerTarget = null;
  let r;
  if(t && t.admin) r = await adminSend('PUT','/api/admin/stickers/'+enc(code), { slug:t.slug });
  else if(view==='dashboard' && cache.biz && isOwner()) r = await api('POST','/api/stickers/'+enc(code)+'/assign', { slug: session.slug }, session.pin);
  else { showToast('Para conectar un sticker, entra al panel como dueño.'); return; }
  if(!r.ok){ showToast(errMsg(r,'No se pudo conectar el sticker.'), 6000); return; }
  try{ navigator.vibrate && navigator.vibrate([40,60,40]); }catch(e){}
  showToast('¡Sticker '+code+' conectado a '+r.data.business.name+'! Ya lleva a sus clientes directo a pedir su tarjeta.', 6000);
  if(t && t.admin){ adminReload(); stickersAdmin = null; } else { myStickers = null; loadMyStickers(); }
}

// ---------- Panel del negocio: sus stickers ----------
let myStickers = null;
async function loadMyStickers(){
  if(!isOwner() || myStickers==='loading') return;
  myStickers = 'loading';
  const r = await api('GET','/api/businesses/'+enc(session.slug)+'/stickers', undefined, session.pin);
  myStickers = r.ok ? r.data : [];
  render();
}
function myStickersHtml(){
  if(!isOwner()) return '';
  if(myStickers===null){ setTimeout(loadMyStickers,0); }
  const list = Array.isArray(myStickers) ? myStickers : [];
  const scans = list.reduce((s,x)=>s+(x.scans||0),0);
  return `<div class="stk-row mt-12">
    <span class="stk-mini">${ic('qr',18)}</span>
    <span style="flex:1;min-width:0" class="small">${list.length ? `<b>${list.length===1?'Tu sticker':list.length+' stickers'}</b> · escaneado ${scans} ${scans===1?'vez':'veces'}` : `<b>¿Tienes un sticker de Redeo?</b><span class="muted" style="display:block">Conéctalo para que lleve a tu tarjeta.</span>`}</span>
    <button class="btn btn-secondary btn-sm" onclick="connectStickerScan()">${ic('scan',16)} ${list.length?'Conectar otro':'Conectar'}</button>
  </div>`;
}

// ---------- Administración P.A.E.: generar, imprimir y conectar ----------
let stickersAdmin = null, stickerGen = { count:12, size:8 }, stickerSearch = '';
async function loadStickersAdmin(){
  const r = await adminFetch('/api/admin/stickers');
  stickersAdmin = r.ok ? r.data : { stickers:[], batches:[] };
  render();
}
async function generateStickers(){
  const n = Math.round(Number(stickerGen.count));
  if(!(n>=1 && n<=200)){ showToast('Elige de 1 a 200 stickers.'); return; }
  busy = true; render();
  const r = await adminSend('POST','/api/admin/stickers', { count:n });
  busy = false;
  if(!r.ok){ showToast(errMsg(r,'No se pudieron generar.')); render(); return; }
  printStickers(r.data.codes, stickerGen.size);
  showToast(n+' stickers listos para imprimir. Todos sirven para cualquier negocio.', 6000);
  loadStickersAdmin();
}
function printBatch(batch, onlyFree){
  const codes = stickersAdmin.stickers.filter(s=>s.batch===batch && (!onlyFree || !s.business)).map(s=>s.code);
  if(!codes.length){ showToast('No hay stickers libres en ese lote.'); return; }
  printStickers(codes, stickerGen.size);
}
async function adminAssignSticker(code, slug){
  const r = await adminSend('PUT','/api/admin/stickers/'+enc(code), { slug: slug||'' });
  if(!r.ok){ showToast(errMsg(r,'No se pudo.')); return; }
  showToast(slug ? 'Sticker '+code+' conectado a '+r.data.business.name+'.' : 'Sticker '+code+' liberado: ya sirve para otro negocio.');
  loadStickersAdmin(); adminReload();
}
function stickersAdminHtml(){
  if(!stickersAdmin){ setTimeout(loadStickersAdmin,0); return `<div class="card mt-12"><div class="card-title">${ic('qr',18)} Stickers para mostrador</div><p class="muted small">Cargando…</p></div>`; }
  const S = stickersAdmin, bs = (adminData && adminData.businesses) || [];
  const free = S.stickers.filter(s=>!s.business).length, used = S.stickers.length - free;
  const q = stickerSearch.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  const found = q.length>=3 ? S.stickers.filter(s=>s.code.includes(q) || (s.business && s.business.name.toUpperCase().includes(stickerSearch.trim().toUpperCase()))).slice(0,8) : [];
  return `<div class="card mt-12">
    <div class="card-title">${ic('qr',18)} Stickers para mostrador</div>
    <p class="muted small">Se imprimen sin negocio: todos iguales, cada uno con su código. En la visita pegas uno y lo conectas escaneándolo (desde la ficha del negocio o desde su panel).</p>
    <div class="stats mt-12" style="grid-template-columns:1fr 1fr"><div class="stat"><div class="stat-num">${free}</div><div class="stat-label">libres</div></div><div class="stat"><div class="stat-num">${used}</div><div class="stat-label">conectados</div></div></div>
    <p class="small mt-16" style="font-weight:700;color:var(--ink-2)">Generar e imprimir</p>
    <div class="day-chips mt-8">${[6,12,24,48].map(n=>`<button class="day wide ${Number(stickerGen.count)===n?'on':''}" onclick="stickerGen.count=${n};render()">${n}</button>`).join('')}<input class="input" style="width:84px;height:40px" type="number" min="1" max="200" aria-label="Cuántos" value="${escapeHtml(String(stickerGen.count))}" oninput="stickerGen.count=this.value"></div>
    <p class="small mt-12" style="font-weight:700;color:var(--ink-2)">Tamaño</p>
    <div class="day-chips mt-8">${[[8,'8 cm · 6 por hoja'],[6,'6 cm · 12'],[4.5,'4.5 cm · 20']].map(([v,l])=>`<button class="day wide ${stickerGen.size===v?'on':''}" onclick="stickerGen.size=${v};render()">${l}</button>`).join('')}</div>
    <div class="stk-preview mt-12">${stickerSvg('V7K2P')}</div>
    <button class="btn btn-primary btn-block mt-12" ${busy?'disabled':''} onclick="generateStickers()">${ic('printer',18)} Generar ${escapeHtml(String(stickerGen.count))} e imprimir</button>
    <p class="hint">Se abre la hoja tamaño carta: imprímela o guárdala como PDF para la imprenta (vinil con corte en círculo).</p>
    ${S.batches.length ? `<p class="small mt-16" style="font-weight:700;color:var(--ink-2)">Lotes impresos</p>${S.batches.slice(0,6).map(b=>`<div class="kv"><span class="small">${escapeHtml(fmtYmd(b.createdAt.slice(0,10)))} · ${b.total} stickers · <b>${b.free} libres</b></span><span class="row" style="gap:6px"><button class="linkbtn small" onclick="printBatch('${jsEsc(b.batch)}',true)">Imprimir libres</button></span></div>`).join('')}` : ''}
    <p class="small mt-16" style="font-weight:700;color:var(--ink-2)">Buscar un sticker</p>
    <input class="input mt-8" placeholder="Código del sticker o nombre del negocio" value="${escapeHtml(stickerSearch)}" oninput="stickerSearch=this.value;render();var i=this;setTimeout(()=>{const e=document.querySelector('[data-stk-search]');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length)}},0)" data-stk-search>
    ${found.map(s=>`<div class="kv" style="flex-wrap:wrap"><span class="small"><span class="mono">${escapeHtml(s.code)}</span> · ${s.business?escapeHtml(s.business.name)+` · ${s.scans} escaneos`:'<b>libre</b>'}</span>
      <span class="row" style="gap:6px"><select class="input" style="height:36px;max-width:170px" onchange="if(this.value!=='-')adminAssignSticker('${jsEsc(s.code)}',this.value)"><option value="-">${s.business?'Mover a…':'Conectar a…'}</option>${s.business?'<option value="">— Liberar —</option>':''}${bs.map(b=>`<option value="${escapeHtml(b.slug)}">${escapeHtml(b.name)}</option>`).join('')}</select></span></div>`).join('')}
  </div>`;
}

// ---------- Administración: pruebas sin movimiento ----------
let quietOpen = true;
function quietMsg(t){
  const n = firstName(t.ownerName||'');
  return t.customers ? `Hola${n?' '+n:''}, ¿cómo va Redeo en ${t.name}? Vemos que llevan ${t.quietDays} días sin dar sellos. Si quieres, pasamos a apoyarte con tu equipo para que no se les olvide ofrecerla. Te quedan ${t.daysLeft} días de prueba.`
    : `Hola${n?' '+n:''}, ¿cómo va todo en ${t.name}? Vimos que aún no registran clientes en su tarjeta Redeo. ¿Te ayudamos a arrancar? En 10 minutos dejamos el sticker en el mostrador y registramos a los primeros juntos. Te quedan ${t.daysLeft} días de prueba.`;
}
function quietTrialsHtml(){
  const list = (adminData && adminData.quietTrials) || [];
  if(!list.length) return '';
  return `<div class="card mt-16 quiet-card">
    <button class="quiet-head" onclick="quietOpen=!quietOpen;render()"><span class="choice-icon" style="background:#FFE9B8;color:#6B4700;width:38px;height:38px">${ic('bell',18)}</span><span style="flex:1;text-align:left"><b>${list.length===1?'1 prueba sin movimiento':list.length+' pruebas sin movimiento'}</b><span class="muted small" style="display:block">Visítalos o escríbeles antes de que se acabe su prueba</span></span>${ic(quietOpen?'down':'right',18)}</button>
    ${quietOpen ? list.map(t=>`<div class="quiet-row">
      <div style="flex:1;min-width:0"><b class="small">${escapeHtml(t.name)}</b><span class="muted small" style="display:block">${escapeHtml(t.reason)} · ${t.customers} ${t.customers===1?'cliente':'clientes'} · le ${t.daysLeft===1?'queda 1 día':'quedan '+t.daysLeft+' días'}${t.stickers?` · sticker: ${t.stickerScans} escaneos`:' · sin sticker'}</span></div>
      <div class="row" style="gap:6px">${t.ownerPhone?`<button class="btn btn-wa btn-sm" onclick="window.open(waLink('${jsEsc(t.ownerPhone)}', quietMsg(adminData.quietTrials.find(x=>x.slug==='${jsEsc(t.slug)}'))),'_blank')">${ic('send',14)}</button>`:''}<button class="btn btn-secondary btn-sm" onclick="openAdminBiz('${jsEsc(t.slug)}')">Ver</button></div>
    </div>`).join('') : ''}
  </div>`;
}
