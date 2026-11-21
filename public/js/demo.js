/* Redeo · Demos para prospectos: formulario, guía dentro de la demo y "¡Lo quiero!". */
/* ---------- Prospectos: demo con su propio negocio o pedir que los contacten ---------- */
const GIROS = [['cafeteria','Cafetería'],['panaderia','Panadería'],['restaurante','Restaurante'],['barberia','Barbería'],['estetica','Estética o uñas'],['lavado','Lavado de autos'],['ropa','Ropa o calzado'],['tienda','Tienda'],['otro','Otro']];
const GIRO_LOOK = { cafeteria:['#6B4226','Un café gratis','coffee',10], panaderia:['#A0522D','Un pan dulce gratis','bread',10], restaurante:['#9B2C2C','Un postre gratis','flame',8], barberia:['#1F2A37','Un corte gratis','scissors',6], estetica:['#8438B0','Un servicio gratis','diamond',6], lavado:['#2C56A8','Un lavado gratis','car',6], ropa:['#1A1320','5% de cada compra en saldo','shirt',1,5], tienda:['#0F5A45','Un regalo sorpresa','star',10], otro:['#0F5A45','Un regalo sorpresa','star',10] };
const CONTACT_TIMES = ['Mañana','Tarde','Noche','Cuando sea'];
let leadForm = { contactName:'', businessName:'', giro:'', whatsapp:'', contactTime:'', message:'', consent:false, pin:'' };
let leadMode = 'prueba';     // prueba (cuenta real con prueba gratis) | contacto | demo (versiones anteriores)
let leadTrial = null;        // prueba creada: { slug, pin, name, until, whatsapp }
let leadUsed = false;        // ese número ya tuvo prueba: queda como solicitud para P.A.E.
let leadError = '';
let leadDone = null;         // contacto enviado: { name }
function openLeadForm(mode){ leadMode = mode; leadError = ''; leadDone = null; leadTrial = null; leadUsed = false; view = 'demoForm'; window.scrollTo(0,0); render(); }
function savedDemo(){ try{ return JSON.parse(store.get('vuelve_demo')||'null'); }catch(e){ return null; } }
function leadPreviewBiz(){
  const L = GIRO_LOOK[leadForm.giro] || GIRO_LOOK.otro;
  return { slug:'demo', name: leadForm.businessName.trim() || 'Tu negocio', mechanic: L[4] ? 'monedero' : 'sellos', walletPct:L[4]||null, stampsGoal:L[3], pointsGoal:1, rewardDesc:L[1], color:L[0], stampIcon:L[2], plan:'premium', cardStyle:'gradient' };
}
function leadPreviewCustomer(){ const L = GIRO_LOOK[leadForm.giro] || GIRO_LOOK.otro; return {name:'', phone:'', progress: L[4] ? 145 : 3}; }
function updateLeadPreview(){ const el = document.getElementById('lead-preview'); if(el) el.innerHTML = passHtml(leadPreviewBiz(), leadPreviewCustomer(), {}); }
async function submitLead(){
  leadError = '';
  const f = leadForm;
  if(f.contactName.trim().length<2){ leadError='Escribe tu nombre.'; render(); return; }
  if(f.businessName.trim().length<2){ leadError='Escribe el nombre de tu negocio.'; render(); return; }
  if(!f.giro){ leadError='Elige a qué se dedica tu negocio.'; render(); return; }
  if(!isValidPhone(normalizePhone(f.whatsapp))){ leadError=phoneMsg('ld-wa','tu número de WhatsApp'); render(); return; }
  if(leadMode==='prueba' && !/^\d{4,8}$/.test(f.pin||'')){ leadError='Crea tu PIN: de 4 a 8 números. Con él entras a tu panel.'; render(); return; }
  if(!f.consent){ leadError='Para continuar acepta que P.A.E. te contacte y el aviso de privacidad.'; render(); return; }
  busy=true; render();
  const body = { contactName:f.contactName.trim(), businessName:f.businessName.trim(), giro:f.giro, whatsapp:normalizePhone(f.whatsapp), contactTime:f.contactTime||undefined, message:f.message.trim()||undefined, consent:true };
  if(leadMode==='contacto'){
    const r = await api('POST','/api/leads', body);
    busy=false;
    if(!r.ok){ leadError = errMsg(r,'No se pudo enviar.'); render(); return; }
    leadDone = { name: f.contactName.trim().split(' ')[0] };
    render(); return;
  }
  if(leadMode==='prueba'){
    const t = await api('POST','/api/trial', { ...body, pin:f.pin });
    busy=false;
    if(!t.ok){ leadError = errMsg(t,'No se pudo crear tu cuenta. Intenta de nuevo.'); render(); return; }
    if(t.data.activated) leadTrial = { slug:t.data.slug, pin:t.data.pin, name:t.data.name, until:t.data.until, whatsapp:body.whatsapp };
    else leadUsed = true;
    window.scrollTo(0,0); render(); return;
  }
  const r = await api('POST','/api/demo', body);
  if(!r.ok){ busy=false; leadError = errMsg(r,'No se pudo crear tu demo.'); render(); return; }
  store.set('vuelve_demo', JSON.stringify({ slug:r.data.slug, pin:r.data.pin, name:r.data.name }));
  const l = await loadDashboard(r.data.slug, r.data.pin);
  busy=false;
  if(!l.ok){ leadError = errMsg(l,'Tu demo está lista, pero no pudimos abrirla. Intenta de nuevo.'); render(); return; }
  setOnbFlag('hidden');
  dashboardTab='resumen'; expandedPhone=null; customerSearch=''; view='dashboard';
  window.scrollTo(0,0);
  showToast('¡Listo! Así se ve '+r.data.name+' en Redeo.', 4500);
}
async function continueDemo(){
  const d = savedDemo(); if(!d) return;
  busy=true; render();
  const r = await loadDashboard(d.slug, d.pin);
  busy=false;
  if(!r.ok){ store.del('vuelve_demo'); showToast('Esa demo ya terminó. Puedes crear otra.', 5000); render(); return; }
  dashboardTab='resumen'; view='dashboard'; render();
}
async function enterTrialAccount(){
  const a = leadTrial; if(!a) return;
  busy=true; render();
  const r = await loadDashboard(a.slug, a.pin);
  busy=false;
  if(!r.ok){ showToast(errMsg(r,'Tu cuenta ya está lista. Entra con tu código y PIN.'), 6000); return; }
  leadTrial = null; dashboardTab='resumen'; expandedPhone=null; customerSearch=''; view='dashboard';
  window.scrollTo(0,0); render();
}
function viewDemoForm(){
  const f = leadForm, contact = leadMode==='contacto', trial = leadMode==='prueba';
  if(leadTrial) return `<div class="wrap fade">
    <div class="success-ico mt-24">${ic('check',30)}</div>
    <h2>¡Listo, ${escapeHtml(firstName(f.contactName)||'ya está')}!</h2>
    <p class="lead">${escapeHtml(leadTrial.name)} ya tiene su tarjeta de lealtad. Tu prueba gratis dura hasta el <b>${escapeHtml(fmtYmd(leadTrial.until))}</b> y tiene todo incluido.</p>
    <div class="card mt-16">
      <p class="small" style="margin:0 0 8px;font-weight:700;color:var(--ink)">Para entrar desde cualquier celular</p>
      <div class="kv"><span class="muted small">Tu WhatsApp</span><b class="mono">${escapeHtml(fmtPhone(leadTrial.whatsapp))}</b></div>
      <div class="kv"><span class="muted small">o el código</span><b class="mono">${escapeHtml(leadTrial.slug)}</b></div>
      <div class="kv"><span class="muted small">Tu PIN</span><b class="mono">${escapeHtml(leadTrial.pin)}</b></div>
      <button class="btn btn-wa btn-block btn-sm mt-12" onclick="window.open(waLink('${jsEsc(leadTrial.whatsapp)}', trialAccessText(leadTrial)),'_blank')">${ic('send',16)} Mandármelos a mi WhatsApp</button>
    </div>
    <button class="btn btn-primary btn-block mt-16" style="height:58px" ${busy?'disabled':''} onclick="enterTrialAccount()">${busy?'Entrando…':'Entrar a mi cuenta'}</button>
    <p class="hint" style="text-align:center">Sin tarjeta y sin contrato. Al terminar la prueba eliges tu plan; si no, tu panel se pausa y no se borra nada.</p>
  </div>`;
  if(leadUsed) return `<div class="wrap fade">
    ${backHtml("view='negocioAuth';render()")}
    <div class="success-ico mt-24" style="background:#FFF1CF;color:#8A5B00">${ic('info',30)}</div>
    <h2>Ese número ya tiene una cuenta</h2>
    <p class="lead">Con este WhatsApp ya se usó una prueba gratis. Si ya tienes cuenta, entra con tu código y PIN. Si no, P.A.E. te escribe para ayudarte.</p>
    <button class="btn btn-primary btn-block mt-16" onclick="loginError='';view='negocioEntrar';render()">${ic('lock',18)} Ya tengo cuenta</button>
  </div>`;
  if(leadDone) return `<div class="wrap fade">
    ${backHtml("view='negocioAuth';render()")}
    <div class="success-ico mt-24">${ic('check',30)}</div>
    <h2>¡Gracias, ${escapeHtml(leadDone.name)}!</h2>
    <p class="lead">Te escribimos por WhatsApp ${f.contactTime && f.contactTime!=='Cuando sea' ? 'en la '+f.contactTime.toLowerCase() : 'muy pronto'} para platicar de tu negocio.</p>
    <div class="demo-cta mt-24"><h3>¿Mientras, lo pruebas?</h3><p>Tu cuenta queda lista en un minuto, con 14 días gratis. Ya tenemos tus datos.</p>
      <button class="btn btn-gold2 btn-block" onclick="leadDone=null;leadMode='prueba';submitLead()">${ic('bolt',18)} Empezar mi prueba gratis</button></div>
  </div>`;
  return `<div class="wrap fade">
    ${backHtml("view='negocioAuth';render()")}
    <h2 class="mt-12">${contact ? 'Te contactamos' : trial ? 'Empieza tu prueba gratis' : 'Pruébalo con tu negocio'}</h2>
    <p class="lead">${contact ? 'Déjanos tus datos y te escribimos por WhatsApp. Sin compromiso.' : trial ? '14 días con todo incluido. Tu cuenta queda lista en un minuto, sin tarjeta y sin contrato.' : 'Armamos una demo con el nombre de tu negocio y clientes de ejemplo. En un minuto la estás usando.'}</p>
    <div class="card mt-16">
      <div class="field"><label for="ld-biz">Nombre de tu negocio</label><input id="ld-biz" class="input" maxlength="60" autocomplete="organization" placeholder="Ej.: Café La Esquina" value="${escapeHtml(f.businessName)}" oninput="leadForm.businessName=this.value;updateLeadPreview()"></div>
      <div class="field"><label>¿A qué se dedica?</label><div class="giro-chips">${GIROS.map(([k,l])=>`<button type="button" class="${f.giro===k?'on':''}" onclick="leadForm.giro='${k}';render()">${l}</button>`).join('')}</div></div>
      <div class="field"><label for="ld-name">Tu nombre</label><input id="ld-name" class="input" maxlength="60" autocomplete="name" placeholder="Ej.: Rosa Díaz" value="${escapeHtml(f.contactName)}" oninput="leadForm.contactName=this.value"></div>
      <div class="field"${trial?'':' style="margin-bottom:0"'}><label for="ld-wa">Tu número de WhatsApp</label>${telField('ld-wa', normalizePhone(f.whatsapp), 'leadForm.whatsapp')}${trial?`<p class="hint">Con este número también puedes entrar a tu panel.</p>`:''}</div>
      ${trial ? `<div class="field" style="margin-bottom:0"><label for="ld-pin">Crea tu PIN</label><input id="ld-pin" class="input code" type="text" inputmode="numeric" autocomplete="new-password" maxlength="8" placeholder="4 a 8 números" value="${escapeHtml(f.pin||'')}" oninput="leadForm.pin=this.value.replace(/\D/g,'').slice(0,8);this.value=leadForm.pin"><p class="hint">Es tu clave para entrar. Elige uno que recuerdes y no lo compartas.</p></div>` : ''}
      ${contact ? `<div class="field"><label>¿Cuándo te escribimos?</label><div class="time-chips">${CONTACT_TIMES.map(t=>`<button type="button" class="${f.contactTime===t?'on':''}" onclick="leadForm.contactTime='${t}';render()">${t}</button>`).join('')}</div></div>
      <div class="field" style="margin-bottom:0"><label for="ld-msg">¿Algo que quieras contarnos? <span class="muted">(opcional)</span></label><textarea id="ld-msg" class="input" rows="3" maxlength="400" style="height:auto;padding-top:10px" placeholder="Ej.: Tengo dos sucursales" oninput="leadForm.message=this.value">${escapeHtml(f.message)}</textarea></div>` : ''}
    </div>
    ${contact ? '' : `<p class="eyebrow mt-24">Así se verá tu tarjeta</p><div class="mt-12" id="lead-preview">${passHtml(leadPreviewBiz(), leadPreviewCustomer(), {})}</div><p class="hint" style="text-align:center">Después le cambias el color, el premio y le pones tu logo.</p>`}
    <label class="check mt-12"><input type="checkbox" ${f.consent?'checked':''} onchange="leadForm.consent=this.checked"><span>Acepto que P.A.E. me contacte por WhatsApp sobre Redeo y el <button type="button" class="linkbtn" onclick="event.preventDefault();openLegal('privacidad-pae')">Aviso de privacidad</button>.</span></label>
    ${errorHtml(leadError)}
    <button class="btn btn-primary btn-block mt-16" style="height:58px" ${busy?'disabled':''} onclick="submitLead()">${busy ? (contact?'Enviando…':trial?'Creando tu cuenta…':'Armando tu demo…') : (contact ? ic('send',18)+' Enviar' : trial ? ic('bolt',18)+' Crear mi cuenta gratis' : ic('bolt',18)+' Crear mi demo')}</button>
    ${contact ? '' : `<p class="hint" style="text-align:center">${trial?'Gratis 14 días. Sin tarjeta y sin contrato.':'Es gratis y no necesitas tarjeta. La demo dura 7 días.'}</p>`}
  </div>`;
}

// ----- Dentro de la demo: guía, barra y "¡Lo quiero!" -----
let demoSheet = null;     // { wants, contactTime, whatsapp, sent }
let demoTried = {};
function isDemoBiz(){ return !!(cache.biz && cache.biz.isDemo); }
function demoRequested(){ const s = cache.biz && cache.biz.demoLead && cache.biz.demoLead.status; return s==='solicito_prueba' || s==='solicito_contratar'; }
function openDemoSheet(wants){
  const L = (cache.biz && cache.biz.demoLead) || {};
  demoSheet = { wants: wants || 'prueba', contactTime: L.contactTime || '', whatsapp: L.whatsapp || '', sent:false };
  render();
}
async function sendDemoRequest(){
  const d = demoSheet;
  if(!isValidPhone(normalizePhone(d.whatsapp))){ showToast(phoneMsg('ds-wa','tu número de WhatsApp')); return; }
  busy=true; render();
  const r = await api('POST','/api/businesses/'+enc(session.slug)+'/demo-request', { wants:d.wants, contactTime:d.contactTime||undefined, whatsapp:normalizePhone(d.whatsapp) }, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo enviar.'), 5000); return; }
  cache.biz.demoLead = { ...(cache.biz.demoLead||{}), status:r.data.status, contactTime:d.contactTime, whatsapp:normalizePhone(d.whatsapp) };
  d.sent = true; render();
}
// Prueba gratis: se activa al instante desde la demo. Si su número ya tuvo prueba, queda como solicitud para P.A.E.
async function startTrial(){
  const d = demoSheet;
  if(!isValidPhone(normalizePhone(d.whatsapp))){ showToast(phoneMsg('ds-wa','tu número de WhatsApp')); return; }
  busy=true; render();
  const r = await api('POST','/api/businesses/'+enc(session.slug)+'/start-trial', { whatsapp:normalizePhone(d.whatsapp) }, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo activar. Intenta de nuevo.'), 5000); return; }
  if(!r.data.activated){
    cache.biz.demoLead = { ...(cache.biz.demoLead||{}), status:r.data.status, whatsapp:normalizePhone(d.whatsapp) };
    d.sent = true; d.trialUsed = true; render(); return;
  }
  store.del('vuelve_demo');
  d.activated = { slug:r.data.slug, pin:r.data.pin, name:r.data.name, until:r.data.until, whatsapp:normalizePhone(d.whatsapp) };
  render();
}
function trialAccessText(a){
  return `Mi cuenta de Redeo (${a.name})\n${location.origin} → Entrar a mi negocio\nEntro con mi WhatsApp${a.whatsapp?' ('+fmtPhone(a.whatsapp)+')':''} o con el código: ${a.slug}\nPIN: ${a.pin}`;
}
async function enterRealAccount(){
  const a = demoSheet && demoSheet.activated; if(!a) return;
  busy=true; render();
  const r = await loadDashboard(a.slug, a.pin);
  busy=false;
  if(!r.ok){ showToast(errMsg(r,'Tu cuenta ya está activa. Entra con tu código y PIN.'), 6000); return; }
  demoSheet=null; dashboardTab='resumen'; expandedPhone=null; view='dashboard';
  window.scrollTo(0,0); render();
}

function demoSheetHtml(){
  if(!demoSheet || (!isDemoBiz() && !demoSheet.activated)) return '';
  const d = demoSheet, name = (cache.biz.demoLead && cache.biz.demoLead.contactName || '').split(' ')[0];
  const a = d.activated;
  const inner = a ? `
      <div class="success-ico" style="margin-top:6px">${ic('check',30)}</div>
      <h2 style="text-align:center">¡Tu prueba ya está activa${name?', '+escapeHtml(name):''}!</h2>
      <p class="lead" style="text-align:center">${escapeHtml(a.name)} ya es tuya, gratis hasta el <b>${escapeHtml(fmtYmd(a.until))}</b>. Quitamos los clientes de ejemplo; lo que configuraste se queda igual.</p>
      <div class="card mt-12" style="box-shadow:none;background:var(--surface-2)">
        <p class="small" style="margin:0 0 8px;font-weight:700;color:var(--ink)">Guarda estos datos para entrar desde otro celular</p>
        <div class="kv"><span class="muted small">Código</span><b class="mono">${escapeHtml(a.slug)}</b></div>
        <div class="kv"><span class="muted small">PIN</span><b class="mono">${escapeHtml(a.pin)}</b></div>
        <button class="btn btn-wa btn-block btn-sm mt-12" onclick="window.open(waLink('${jsEsc(a.whatsapp)}', trialAccessText(demoSheet.activated)),'_blank')">${ic('send',16)} Mandármelos a mi WhatsApp</button>
      </div>
      <button class="btn btn-primary btn-block mt-16" style="height:56px" ${busy?'disabled':''} onclick="enterRealAccount()">${busy?'Entrando…':'Entrar a mi cuenta'}</button>
      <p class="hint" style="text-align:center">Al terminar la prueba, tu panel se pausa si no contratas. No se borra nada.</p>` : d.sent ? `
      <div class="success-ico" style="margin-top:6px">${ic('check',30)}</div>
      <h2 style="text-align:center">¡Listo${name?', '+escapeHtml(name):''}!</h2>
      <p class="lead" style="text-align:center">P.A.E. te escribe por WhatsApp ${d.contactTime && d.contactTime!=='Cuando sea' ? 'en la '+d.contactTime.toLowerCase() : 'muy pronto'} para ${d.wants==='contratar'?'dejar lista tu contratación':'ayudarte a activar tu prueba gratis'}.</p>
      ${d.trialUsed?`<p class="muted small" style="text-align:center">Con este número ya se usó una prueba gratis, por eso la activamos contigo.</p>`:''}
      <p class="muted small" style="text-align:center">Lo que configuraste se queda tal cual; solo quitamos los clientes de ejemplo. Mientras, sigue probando.</p>
      <button class="btn btn-primary btn-block mt-16" onclick="demoSheet=null;render()">Seguir probando</button>` : `
      <h2 style="margin-top:4px">Hagámoslo real</h2>
      <p class="muted small" style="margin:6px 0 14px">Activamos ${escapeHtml(cache.biz.name)} con todo lo que configuraste. Sin clientes de ejemplo, lista para tu mostrador.</p>
      <div class="seg"><button class="${d.wants==='prueba'?'on':''}" onclick="demoSheet.wants='prueba';render()">${ic('gift',16)} Prueba gratis 14 días</button><button class="${d.wants==='contratar'?'on':''}" onclick="demoSheet.wants='contratar';render()">${ic('check',16)} Contratar ya</button></div>
      ${d.wants==='contratar' ? `<div class="field mt-16"><label>¿Cuándo te escribimos?</label><div class="time-chips">${CONTACT_TIMES.map(t=>`<button type="button" class="${d.contactTime===t?'on':''}" onclick="demoSheet.contactTime='${t}';render()">${t}</button>`).join('')}</div></div>` : ''}
      <div class="field${d.wants==='contratar'?'':' mt-16'}" style="margin-bottom:0"><label for="ds-wa">Tu número de WhatsApp</label>${telField('ds-wa', normalizePhone(d.whatsapp), 'demoSheet.whatsapp')}</div>
      ${d.wants==='contratar'
        ? `<button class="btn btn-primary btn-block mt-16" style="height:56px" ${busy?'disabled':''} onclick="sendDemoRequest()">${busy?'Enviando…':'Quiero contratar'}</button>
      <p class="hint" style="text-align:center">No pagas nada ahora. Te escribimos para dejarla lista.</p>`
        : `<button class="btn btn-primary btn-block mt-16" style="height:56px" ${busy?'disabled':''} onclick="startTrial()">${busy?'Activando…':'Activar mi prueba gratis'}</button>
      <p class="hint" style="text-align:center">Se activa al instante. Sin tarjeta y sin contrato. A los 14 días se pausa sola si no contratas.</p>`}`;
  return `<div class="sheet-bg" onclick="if(event.target===this){demoSheet=null;render()}"><div class="sheet" role="dialog" aria-label="Activar mi tarjeta"><div class="sheet-grip"></div>${inner}</div></div>`;
}
function isSampleView(){ return isDemoBiz() && !!store.get('vuelve_sample_return'); }
function demoBarHtml(){
  if(!isDemoBiz()) return '';
  if(isSampleView()) return `<div class="demo-bar"><span class="t"><b>Cuenta de ejemplo</b> · clientes de prueba</span><button ${busy?'disabled':''} onclick="backToMyAccount()">Volver a mi cuenta</button></div>`;
  if(demoRequested()) return `<div class="demo-bar sent">${ic('check',18)}<span class="t"><b>Solicitud enviada.</b> P.A.E. te escribe pronto para activarla.</span></div>`;
  return `<div class="demo-bar"><span class="t"><b>Demo de ${escapeHtml(cache.biz.name)}</b> · clientes de ejemplo</span><button onclick="openDemoSheet('prueba')">La quiero</button></div>`;
}
function demoTryHtml(){
  if(!isDemoBiz()) return '';
  const ex = cache.customers.find(c=>c.status!=='pending' && c.progress < goalOf(cache.biz) && c.progress >= 3) || cache.customers.find(c=>c.status!=='pending');
  const pend = cache.customers.find(c=>c.status==='pending');
  const steps = [
    ex ? { k:'sello', t:(isWalletBiz(cache.biz)?'Abónale una compra a ':'Dale un sello a ')+firstName(ex.name), go:`demoTried.sello=true;handleScan('${jsEsc(cache.biz.slug)}:${jsEsc(ex.phone)}')` } : null,
    pend ? { k:'aprobar', t:'Aprueba la solicitud de '+firstName(pend.name), go:`demoTried.aprobar=true;dashboardTab='clientes';render()` } : { k:'aprobar', t:'Mira a tus clientes', go:`demoTried.aprobar=true;dashboardTab='clientes';render()` },
    { k:'crecer', t:'Mira quién ya no viene y tus promociones', go:`demoTried.crecer=true;openCrecer()` },
    { k:'ajustes', t:'Cambia el color y el premio de tu tarjeta', go:`demoTried.ajustes=true;openConfig()` }
  ].filter(Boolean);
  return `<div class="card" style="margin-bottom:12px"><div class="card-title">${ic('bolt',18)} Prueba esto</div>
    <div class="demo-try">${steps.map((x,i)=>`<button class="${demoTried[x.k]?'done':''}" onclick="${x.go}"><span class="n">${demoTried[x.k]?ic('check',14):i+1}</span>${escapeHtml(x.t)}</button>`).join('')}</div></div>`;
}
// Precio del lote vigente (portada y demo). Los lugares son reales: se ocupan cuando un negocio paga por primera vez.
function founderHtml(){
  const p = serverConfig.pricing; if(!p) return '';
  if(p.isRegular) return `<div class="lp-price"><div class="lp-price-row"><span class="lp-price-big">${money(p.esencial)}<small>/mes</small></span><span class="lp-price-alt">Premium ${money(p.premium)}/mes</span></div><p class="lp-price-foot">Pruébalo gratis 14 días. Sin plazos forzosos.</p></div>`;
  const dots = p.spots && p.spots<=30 ? `<div class="lp-dots" aria-hidden="true">${Array.from({length:p.spots},(_,i)=>`<i class="${i < p.spots-p.spotsLeft?'on':''}"></i>`).join('')}</div>` : '';
  return `<div class="lp-price">
    <span class="lp-price-tag">${escapeHtml(p.label||p.name)}</span>
    <div class="lp-price-row"><span class="lp-price-big">${money(p.esencial)}<small>/mes</small></span><span class="lp-price-alt">Premium ${money(p.premium)}<br><s>Regular ${money(p.regular.esencial)} y ${money(p.regular.premium)}</s></span></div>
    ${dots}
    <p class="lp-price-foot">${p.spotsLeft!=null?`<b>Quedan ${p.spotsLeft} de ${p.spots} lugares.</b> `:''}${p.until?`Hasta el ${fmtYmd(p.until)}. `:''}Quien entra se queda con este precio mientras siga con Redeo.</p>
  </div>`;
}
function demoPriceLine(){
  const p = serverConfig.pricing; if(!p) return '';
  const plan = cache.biz && cache.biz.plan==='premium' ? 'premium' : 'esencial';
  if(p.isRegular) return `<p class="demo-price">Desde ${money(p.esencial)}/mes · 14 días gratis para empezar.</p>`;
  return `<p class="demo-price"><b>${escapeHtml(p.label||p.name)}: ${money(p[plan])}/mes</b> <s>${money(p.regular[plan])}</s>${p.spotsLeft!=null?` · quedan ${p.spotsLeft} lugares`:''}</p>`;
}
function demoCtaHtml(){
  if(!isDemoBiz() || isSampleView()) return '';
  if(demoRequested()) return `<div class="demo-cta"><h3>Ya casi es tuya</h3><p>Recibimos tu solicitud. P.A.E. te escribe por WhatsApp para dejar lista ${escapeHtml(cache.biz.name)}. Puedes seguir probando todo lo que quieras.</p></div>`;
  return `<div class="demo-cta">
    <h3>¿Te imaginas esto en ${escapeHtml(cache.biz.name)}?</h3>
    <p>Actívalo tú mismo en un minuto. Lo que configuraste se queda tal cual; solo quitamos los clientes de ejemplo.</p>
    ${demoPriceLine()}
    <button class="btn btn-gold2 btn-block" onclick="openDemoSheet('prueba')">${ic('gift',18)} Activar mi prueba gratis de 14 días</button>
    <button class="btn btn-ghost-light btn-block mt-8" onclick="openDemoSheet('contratar')">Quiero contratar ya</button>
  </div>`;
}
