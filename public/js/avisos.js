/* Redeo · Avisos al celular (Premium).
   El cliente los activa desde su tarjeta; el dueño los manda desde Crecer → Avisos (máximo 2 por semana). */

// ---------- Cliente: activar o apagar avisos en este celular ----------
let pushState = { checked:false, slug:null, supported:false, permission:'default', on:false, busy:false };
function pushSupported(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function pushKey(){ return serverConfig.push && serverConfig.push.publicKey; }
function pushFlagKey(slug){ return 'vuelve_push_'+slug; }
function b64ToBytes(s){ const p = '='.repeat((4 - s.length % 4) % 4); const raw = atob((s + p).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from(raw, c=>c.charCodeAt(0)); }
async function swReady(){
  // Sin service worker no hay avisos; no esperar para siempre.
  return Promise.race([navigator.serviceWorker.ready, new Promise((_,f)=>setTimeout(()=>f(new Error('sin sw')), 8000))]);
}
async function checkPushState(slug){
  if(pushState.checked && pushState.slug===slug) return;
  pushState = { checked:true, slug, supported:pushSupported() && !!pushKey(), permission: ('Notification' in window) ? Notification.permission : 'denied', on:false, busy:false };
  if(pushState.supported && pushState.permission==='granted' && store.get(pushFlagKey(slug))){
    try{ const reg = await swReady(); pushState.on = !!(await reg.pushManager.getSubscription()); }catch(e){}
  }
  render();
}
async function enablePush(){
  const { biz, customer, token } = clienteResult;
  if(pushState.busy) return;
  pushState.busy = true; render();
  try{
    const perm = await Notification.requestPermission();
    pushState.permission = perm;
    if(perm!=='granted'){ pushState.busy=false; render(); return; }
    const reg = await swReady();
    let sub = await reg.pushManager.getSubscription();
    try{ if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: b64ToBytes(pushKey()) }); }
    catch(e){ if(sub){ await sub.unsubscribe(); } sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: b64ToBytes(pushKey()) }); }
    const r = await api('POST','/api/businesses/'+enc(biz.slug)+'/push/subscribe', { phone:customer.phone, subscription: sub.toJSON() }, null, { 'x-card-token': token });
    if(!r.ok){ const err = new Error(errMsg(r,'No se pudieron activar los avisos.')); err.ours = true; throw err; }
    store.set(pushFlagKey(biz.slug), '1'); pushState.on = true;
    showToast('Listo. Te avisaremos de las promociones de '+biz.name+'.');
  }catch(e){ showToast(e && e.ours ? e.message : 'Tu celular no pudo activar los avisos. Si estás en modo incógnito, abre tu tarjeta en una ventana normal e intenta de nuevo.', 6000); }
  pushState.busy = false; render();
}
async function disablePush(){
  const { biz, customer, token } = clienteResult;
  pushState.busy = true; render();
  try{
    const reg = await swReady(); const sub = await reg.pushManager.getSubscription();
    // Solo se quita este negocio: el mismo celular puede tener avisos de otros negocios.
    if(sub) await api('POST','/api/businesses/'+enc(biz.slug)+'/push/unsubscribe', { phone:customer.phone, endpoint: sub.endpoint }, null, { 'x-card-token': token });
  }catch(e){}
  store.del(pushFlagKey(biz.slug)); pushState.on = false; pushState.busy = false;
  showToast('Listo, ya no recibirás avisos de '+biz.name+'.');
}
function pushCardHtml(biz, customer){
  if(!biz.push || !pushKey() || biz.isDemo) return '';
  if(!pushState.checked || pushState.slug!==biz.slug){ setTimeout(()=>checkPushState(biz.slug), 0); return ''; }
  const head = `<div style="flex:1;min-width:0"><b class="small" style="color:var(--ink)">Avisos de promociones</b>`;
  let body;
  if(isIOS() && !isStandalone()){
    body = `${head}<p class="muted small" style="margin-top:2px">En iPhone, los avisos llegan cuando agregas tu tarjeta a tu pantalla de inicio.</p></div><button class="btn btn-secondary btn-sm" onclick="openInstall('card')">${ic('phoneapp',16)} Agregar</button>`;
  }else if(!pushState.supported){
    return '';
  }else if(pushState.permission==='denied'){
    body = `${head}<p class="muted small" style="margin-top:2px">Bloqueaste los avisos en este navegador. Para recibirlos, permite las notificaciones de esta página en los ajustes.</p></div>`;
  }else{
    const on = pushState.on;
    body = `${head}<p class="muted small" style="margin-top:2px">${on ? `Te llegan al celular las promociones de ${escapeHtml(biz.name)}. Máximo 2 por semana.` : `Recibe en tu celular las promociones de ${escapeHtml(biz.name)} (máximo 2 por semana).`}</p></div>
      <button class="switch ${on?'on':''}" role="switch" aria-checked="${on?'true':'false'}" aria-label="Avisos de promociones" ${pushState.busy?'disabled':''} onclick="${on?'disablePush()':'enablePush()'}"><span></span></button>`;
  }
  return `<div class="card mt-16 push-card"><div class="row" style="gap:12px;align-items:flex-start"><span class="push-ico">${ic('bell',18)}</span>${body}</div></div>`;
}

// ---------- Dueño: Crecer → Avisos ----------
let pushData = null, pushDraft = '';
async function loadPushData(){
  const r = await api('GET','/api/businesses/'+enc(session.slug)+'/push', undefined, session.pin);
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo cargar.')); return; }
  pushData = r.data; render();
}
function pushIdeas(){
  const b = cache.biz, u = b.mechanic==='sellos' ? 'sello' : isWalletBiz(b) ? 'saldo' : 'punto';
  const ideas = [];
  const rules = (b.promos && b.promos.rules) || [];
  if(rules.some(r=>/doble/i.test(r))) ideas.push(`¡Hoy tu ${u} vale doble! Te esperamos 🙌`);
  ideas.push(`Esta semana, ${u==='saldo'?'el saldo de tu compra':'tu '+u} vale doble. ¡No te lo pierdas!`);
  ideas.push(`Te extrañamos. Pasa esta semana y te damos un detalle 🎁`);
  ideas.push(`¡Novedad en ${b.name}! Ven a probarla y suma a tu tarjeta.`);
  return ideas.slice(0,3);
}
async function sendPush(){
  const text = pushDraft.replace(/\s+/g,' ').trim();
  if(text.length<5){ showToast('Escribe tu aviso.'); return; }
  if(!confirm(`¿Mandar este aviso a ${pushData.subscribers} ${pushData.subscribers===1?'cliente':'clientes'}?\n\n"${text}"`)) return;
  busy=true; render();
  const r = await api('POST','/api/businesses/'+enc(session.slug)+'/push/send', { body:text }, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo mandar.'), 6000); return; }
  pushData = r.data; pushDraft = '';
  showToast(`Aviso enviado: llegó a ${r.data.delivered} ${r.data.delivered===1?'celular':'celulares'}.`+(r.data.failed?` ${r.data.failed} no lo recibieron (quitaron el permiso o cambiaron de celular).`:''), 6000);
}
function pushPreviewHtml(text){
  const b = cache.biz;
  const icon = b.appIcon ? `<img src="${escapeHtml(iconUrl(b,180))}" alt="">` : `<span style="background:${b.color};color:${textOn(b.color)}">${escapeHtml(initialOf(b.name))}</span>`;
  return `<div class="push-prev"><div class="push-prev-ico">${icon}</div><div style="flex:1;min-width:0"><div class="push-prev-top"><b>${escapeHtml(b.name)}</b><span>ahora</span></div><p>${escapeHtml(text || 'Así se verá tu aviso en el celular de tus clientes.')}</p></div></div>`;
}
function pushHtml(){
  const d = pushData;
  if(!d){ setTimeout(loadPushData,0); return `<div class="card"><p class="muted">Cargando…</p></div>`; }
  const max = d.maxLength || 140;
  const canSend = d.left>0 && d.subscribers>0;
  return `
    <div class="card" style="background:var(--ink);color:#fff;border-color:var(--ink)">
      <div style="font-weight:800;font-size:1.02rem">Tu promoción, directo a su celular</div>
      <p class="small" style="color:#D9CCE0;margin-top:6px;line-height:1.5">Tus clientes activan los avisos en su tarjeta y les llega como notificación, con tu nombre y tu ícono. Sin costo por mensaje.</p>
    </div>
    <div class="stats" style="grid-template-columns:1fr 1fr">
      <div class="stat"><div class="stat-num">${d.subscribers}</div><div class="stat-label">${d.subscribers===1?'cliente con avisos':'clientes con avisos'}</div></div>
      <div class="stat"><div class="stat-num">${d.left}<span class="muted" style="font-size:1rem">/${d.limit}</span></div><div class="stat-label">avisos esta semana</div></div>
    </div>
    ${d.subscribers ? '' : `<div class="card mt-12"><div class="card-title">${ic('info',18)} Aún nadie los activa</div><p class="muted small">Tus clientes los activan en su tarjeta, en "Avisos de promociones". Cuando escanees su tarjeta, invítalos: "actívale a los avisos y te aviso de las promos". En iPhone primero deben agregar su tarjeta a la pantalla de inicio.</p></div>`}
    <div class="card mt-12">
      <div class="card-title">${ic('send',18)} Nuevo aviso</div>
      <textarea id="push-text" class="input push-text" maxlength="${max}" rows="3" placeholder="Ej. ¡Hoy tu sello vale doble! Te esperamos" oninput="pushDraft=this.value;document.getElementById('push-count').textContent=this.value.length+'/${max}';var p=document.getElementById('push-prev');if(p)p.innerHTML=pushPreviewHtml(this.value)">${escapeHtml(pushDraft)}</textarea>
      <div class="row" style="justify-content:space-between;margin-top:6px"><span class="muted small">Corto y claro funciona mejor.</span><span id="push-count" class="muted small">${pushDraft.length}/${max}</span></div>
      <div class="chips mt-12">${pushIdeas().map(t=>`<button type="button" class="pick" onclick="pushDraft=${escapeHtml(JSON.stringify(t))};render()">${escapeHtml(t)}</button>`).join('')}</div>
      <p class="small mt-16" style="font-weight:700;color:var(--ink-2)">Así le llega</p>
      <div id="push-prev" class="mt-8">${pushPreviewHtml(pushDraft)}</div>
      <button class="btn btn-primary btn-block mt-16" ${busy||!canSend?'disabled':''} onclick="sendPush()">${ic('send',18)} ${d.left>0 ? (d.subscribers ? `Mandar a ${d.subscribers} ${d.subscribers===1?'cliente':'clientes'}` : 'Mandar aviso') : 'Ya usaste los '+d.limit+' de esta semana'}</button>
      ${d.left===0 && d.nextAt ? `<p class="hint" style="text-align:center">Puedes mandar otro desde el ${escapeHtml(fmtWhen(d.nextAt).replace(/\.$/,''))}</p>` : ''}
    </div>
    ${d.history.length ? `<p class="eyebrow mt-16">Avisos enviados</p><div class="list" style="margin-top:8px">${d.history.map(h=>`<div class="item" style="cursor:default"><div class="item-main"><div class="item-name" style="white-space:normal">${escapeHtml(h.body)}</div><div class="item-sub">${escapeHtml(fmtWhen(h.at))} · llegó a ${h.delivered} de ${h.targets}</div></div></div>`).join('')}</div>` : ''}
    <p class="hint" style="margin:10px 4px 0">Máximo ${d.limit} avisos por semana para que tus clientes no los apaguen. Si un cliente apaga "Recibir promociones", deja de recibir avisos.</p>`;
}
