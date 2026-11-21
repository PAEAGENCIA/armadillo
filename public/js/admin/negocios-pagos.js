/* Redeo · Administración P.A.E.: membresías, pagos, avisos "Ya pagué", lotes, datos para cobrar, prospectos y recibos. */
/* =================== Administración: negocios, membresías y pagos =================== */
let adminTab = 'prospectos';     // prospectos | negocios | pagos | herramientas
let adminBiz = null;             // negocio abierto en su ficha
let adminPay = null;             // apartado de pagos abierto: { slug, from }
let adminSearch = '';
let memForm = null;              // datos del dueño en edición
let payForm = null;              // pago en captura
let adminPayments = {};          // pagos por negocio
let recentPayments = null;       // pagos recientes de todos los negocios
let lastPayment = null;          // último pago registrado (para el recibo)

function money(n){ return '$' + Number(n||0).toLocaleString('es-MX'); }
function bizOf(slug){ return (adminData.businesses||[]).find(b=>b.slug===slug); }
async function adminReload(){ const r = await adminFetch('/api/admin/summary'); if(r.ok){ adminData = r.data; render(); } }
function planName(p){ return p==='premium' ? 'Premium' : 'Esencial'; }
function monthsText(n){ return n===12 ? '1 año' : n+' '+(n===1?'mes':'meses'); }

// Precios de las membresías (los del catálogo). Anual = 10 meses (2 gratis).
function listPrice(b){ return b.priceMonthly || (adminData.prices && adminData.prices[b.plan]) || 0; }
function packagesFor(b){
  const m = listPrice(b);
  return [
    { key:'mensual', label:'Mensual', months:1, amount:m, sub:'1 mes' },
    { key:'anual', label:'Anual', months:12, amount:m*10, sub:'12 meses · 2 gratis' }
  ];
}

function statusOf(b){
  const a = b.access;
  if(!a || a.type==='none') return { key:'none', label:'Sin fecha límite', cls:'' };
  if(a.expired) return { key:'expired', label:(a.type==='trial'?'Prueba terminada':'Vencido')+' · '+fmtYmd(a.until), cls:'off' };
  if(a.type==='trial') return { key:'trial', label:'Prueba · '+a.daysLeft+' '+(a.daysLeft===1?'día':'días'), cls:'trial'+(a.daysLeft<=5?' warn':'') };
  return { key: a.daysLeft<=7 ? 'due' : 'paid', label:'Al corriente · vence '+fmtYmd(a.until), cls: a.daysLeft<=7 ? 'paid warn' : 'paid' };
}

// ----- Recordatorio amable por WhatsApp al dueño -----
function remindText(b){
  const who = firstName(b.ownerName), a = b.access, price = money(listPrice(b));
  const hi = `Hola${who?' '+who:''}, ¿cómo estás? Te escribe Raúl de P.A.E. `;
  if(a.type==='trial' && a.expired) return hi + `Tu prueba gratis de Redeo en ${b.name} terminó el ${fmtYmd(a.until)}. Si te gustó, podemos seguir con el plan ${planName(b.plan)} por ${price} al mes. Entra a tu panel y en Ajustes → Tu membresía ves cómo pagar (transferencia, depósito o efectivo).`;
  if(a.type==='trial'){
    const c = b.customers||0, r = b.returned||0;
    const avance = c ? `Así vas: ${c} ${c===1?'cliente registrado':'clientes registrados'}${r?` y ${r} ya ${r===1?'regresó':'regresaron'}`:''}. La meta de la prueba es llegar a 20. ` : 'Todavía no registras clientes: la meta de la prueba es llegar a 20. Si quieres, paso a ayudarte a registrar a los primeros. ';
    return hi + avance + `Tu prueba gratis termina el ${fmtYmd(a.until)}. Si quieres continuar, el plan ${planName(b.plan)} queda en ${price} al mes y tus clientes y sellos se quedan tal cual.`;
  }
  if(a.expired) return hi + `Tu membresía Redeo ${planName(b.plan)} de ${b.name} terminó el ${fmtYmd(a.until)} y tu panel está en pausa. Tus clientes y sellos siguen guardados. La renovación es de ${price} al mes: entra a tu panel y toca "Pagar mi membresía".`;
  return hi + `Solo para recordarte que tu membresía Redeo ${planName(b.plan)} de ${b.name} se renueva el ${fmtYmd(a.until)} (${price} al mes). Puedes pagar desde tu panel en Ajustes → Tu membresía.`;
}
function remindOwner(slug){
  const b = bizOf(slug); if(!b) return;
  if(!b.ownerPhone){ showToast('Agrega el WhatsApp del dueño en su ficha.'); openAdminBiz(slug); return; }
  window.open(waLink(b.ownerPhone, remindText(b)), '_blank');
}

async function adminSend(method, path, body){
  try{
    const res = await fetch(path, { method, headers:{ 'x-admin-key': adminKey.trim(), 'Content-Type':'application/json' }, body: body!==undefined ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(()=>({}));
    return { ok: res.ok, status: res.status, data };
  }catch(e){ return { ok:false, status:0, data:{ error:'No hay conexión con el servidor.' } }; }
}
async function loadPayments(slug){
  const r = await adminFetch('/api/admin/businesses/'+enc(slug)+'/payments');
  if(r.ok){ adminPayments[slug] = r.data; render(); }
}
async function loadRecentPayments(){
  const r = await adminFetch('/api/admin/payments');
  if(r.ok){ recentPayments = r.data; render(); }
}
function setAdminTab(t){ adminTab=t; render(); if(t==='pagos'){ if(!recentPayments) loadRecentPayments(); loadPayReports(); } if(t==='prospectos') loadLeads(); }

/* ----- Avisos de pago ("Ya pagué") que mandan los negocios ----- */
let payReports = null;
let rejectingReport = null;   // { id, reason }
async function loadPayReports(){
  const r = await adminFetch('/api/admin/payment-reports');
  if(r.ok){ payReports = r.data; render(); }
}
function payReportsHtml(){
  if(!payReports) return '';
  const pend = payReports.filter(r=>r.status==='pendiente');
  if(!pend.length) return '';
  return `<p class="eyebrow mt-24">Avisos de pago por confirmar</p>
    ${pend.map(r=>`<div class="card mt-12 rep-card">
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="min-width:0"><b>${escapeHtml(r.businessName)}</b><div class="muted small">${escapeHtml(r.ownerName||r.businessSlug)} · ${escapeHtml(fmtDate(r.createdAt))}</div></div>
        <b class="rep-amt">${money(r.amount)}</b>
      </div>
      <div class="rep-meta"><span>${ic(r.method==='Efectivo'?'cash':r.method==='Depósito'?'bank':'transfer',14)} ${escapeHtml(r.method)}</span><span>${monthsText(r.months)}</span>${r.plan?`<span><b>${r.plan==='premium'?'Premium':'Esencial'}</b></span>`:''}${r.reference?`<span class="mono">Ref. ${escapeHtml(r.reference)}</span>`:''}</div>
      <p class="hint" style="margin:6px 0 0">${r.method==='Efectivo'?'Quiere pagar en efectivo: ponte de acuerdo con él y confirma cuando lo recibas.':'Revisa que el dinero ya esté en tu cuenta antes de confirmar.'}</p>
      ${rejectingReport && rejectingReport.id===r.id ? `
        <div class="field mt-12" style="margin-bottom:8px"><label>¿Por qué no se confirma? <span class="muted">(lo verá el negocio)</span></label>
        <input class="input" maxlength="200" value="${escapeHtml(rejectingReport.reason)}" placeholder="Ej. No encontramos la transferencia, revisa la CLABE" oninput="rejectingReport.reason=this.value"></div>
        <div class="row" style="gap:8px"><button class="btn btn-ghost btn-sm" style="flex:1" onclick="rejectingReport=null;render()">Cancelar</button><button class="btn btn-secondary btn-sm" style="flex:1;color:var(--danger)" ${busy?'disabled':''} onclick="rejectReport(${r.id})">No confirmar</button></div>` : `
        <div class="row mt-12" style="gap:8px"><button class="btn btn-primary btn-sm" style="flex:2;min-width:0" ${busy?'disabled':''} onclick="confirmReport(${r.id})">${ic('check',16)} Confirmar pago</button><button class="btn btn-ghost btn-sm" style="flex:1;min-width:0" onclick="rejectingReport={id:${r.id},reason:''};render()">No llegó</button></div>`}
    </div>`).join('')}`;
}
async function confirmReport(id){
  if(busy) return; busy = true; render();
  const r = await adminSend('POST','/api/admin/payment-reports/'+id+'/confirm', {});
  busy = false;
  if(!r.ok){ showToast(errMsg(r,'No se pudo confirmar.')); render(); return; }
  lastPayment = r.data.payment;
  showToast('Pago confirmado · '+r.data.payment.folio+(r.data.tier?' · entra a '+r.data.tier.name:''), 4200);
  recentPayments = null; delete adminPayments[r.data.slug];
  await Promise.all([adminReload(), loadPayReports(), loadRecentPayments()]);
}
async function rejectReport(id){
  if(busy) return; busy = true; render();
  const r = await adminSend('POST','/api/admin/payment-reports/'+id+'/reject', { reason:(rejectingReport&&rejectingReport.reason)||'' });
  busy = false; rejectingReport = null;
  if(!r.ok){ showToast(errMsg(r,'No se pudo guardar.')); render(); return; }
  showToast('Listo. El negocio verá que su pago no se confirmó.');
  await Promise.all([adminReload(), loadPayReports()]);
}

/* ----- Precios por lotes y datos para cobrar (Administración → Más) ----- */
let tierForm = null, payInfoForm = null, tierError = '', payInfoError = '';
function openTierEditor(){ tierForm = (adminData.tiers||[]).map(t=>({ ...t, spots: t.spots==null?'':t.spots })); tierError=''; render(); }
function addTier(){
  const last = tierForm[tierForm.length-1], prev = tierForm[tierForm.length-2] || last;
  tierForm.splice(tierForm.length-1, 0, { id:'', name:'Lote '+tierForm.length, label:'', spots:20, esencial:prev.esencial, premium:prev.premium, until:'', filled:0 });
  render();
}
function removeTier(i){ if(tierForm[i].filled){ showToast('Ese lote ya tiene negocios: no se puede quitar.'); return; } tierForm.splice(i,1); render(); }
async function saveTiers(){
  tierError = ''; busy = true; render();
  const r = await adminSend('PUT','/api/admin/settings/pricing', { tiers: tierForm.map(t=>({ id:t.id, name:t.name, label:t.label, spots:t.spots, esencial:t.esencial, premium:t.premium, until:t.until })) });
  busy = false;
  if(!r.ok){ tierError = errMsg(r,'No se pudo guardar.'); render(); return; }
  tierForm = null; showToast('Precios guardados'); await adminReload();
}
function tiersCardHtml(){
  const list = adminData.tiers || [], cur = adminData.currentTier;
  if(tierForm){
    return `<div class="card">
      <div class="card-title">${ic('coin',18)} Precios por lotes</div>
      ${tierForm.map((t,i)=>{ const last = i===tierForm.length-1; return `<div class="tier-edit">
        <div class="row" style="gap:8px;align-items:center"><span class="tier-n">${i+1}</span>
          <input class="input" style="flex:1;min-width:0;height:40px" maxlength="30" value="${escapeHtml(t.name)}" aria-label="Nombre del lote" oninput="tierForm[${i}].name=this.value">
          ${!last && !t.filled ? `<button class="icon-btn" style="width:36px;height:36px" aria-label="Quitar lote" onclick="removeTier(${i})">${ic('x',16)}</button>` : ''}</div>
        <div class="tier-grid">
          <label>Lugares${last?'':''}<input class="input" type="number" inputmode="numeric" min="1" ${last?'disabled placeholder="Sin límite"':''} value="${last?'':escapeHtml(String(t.spots))}" oninput="tierForm[${i}].spots=this.value"></label>
          <label>Esencial<input class="input" type="number" inputmode="numeric" min="1" value="${escapeHtml(String(t.esencial))}" oninput="tierForm[${i}].esencial=this.value"></label>
          <label>Premium<input class="input" type="number" inputmode="numeric" min="1" value="${escapeHtml(String(t.premium))}" oninput="tierForm[${i}].premium=this.value"></label>
        </div>
        <div class="tier-grid two">
          <label>Etiqueta<input class="input" maxlength="40" value="${escapeHtml(t.label||'')}" placeholder="Ej. Precio de fundador" oninput="tierForm[${i}].label=this.value"></label>
          <label>Hasta <span class="muted">(opcional)</span><input class="input" type="date" ${last?'disabled':''} value="${escapeHtml(t.until||'')}" onchange="tierForm[${i}].until=this.value"></label>
        </div>
        ${t.filled?`<p class="hint" style="margin:6px 0 0">${t.filled} ${t.filled===1?'negocio ya está':'negocios ya están'} en este lote. Cambiar su precio aquí no cambia lo que ellos pagan: su precio ya quedó congelado.</p>`:''}
      </div>`; }).join('')}
      <button class="linkbtn small mt-8" onclick="addTier()">${ic('plus',14)} Agregar un lote antes del regular</button>
      ${errorHtml(tierError)}
      <div class="row mt-12" style="gap:8px"><button class="btn btn-ghost" style="flex:1" onclick="tierForm=null;render()">Cancelar</button><button class="btn btn-primary" style="flex:2" ${busy?'disabled':''} onclick="saveTiers()">Guardar precios</button></div>
      <p class="hint">El último lote es el precio regular y no tiene límite. Cuando un lote se llena (o pasa su fecha), el siguiente se activa solo.</p>
    </div>`;
  }
  return `<div class="card">
    <div class="card-title">${ic('coin',18)} Precios por lotes <button class="linkbtn small" style="margin-left:auto" onclick="openTierEditor()">Editar</button></div>
    ${list.map((t,i)=>{ const on = t.id===cur, full = t.spots!=null && t.filled>=t.spots, last = i===list.length-1;
      const pct = t.spots ? Math.min(100, Math.round(t.filled/t.spots*100)) : 0;
      return `<div class="tier-row ${on?'on':''} ${full?'full':''}">
        <div class="row" style="justify-content:space-between;gap:8px"><b>${escapeHtml(t.name)} ${on?'<span class="tier-now">Vigente</span>':''}${full?'<span class="tier-done">Lleno</span>':''}</b><span class="small"><b>${money(t.esencial)}</b> / <b>${money(t.premium)}</b></span></div>
        ${last ? `<div class="muted small">Sin límite · ${t.filled} ${t.filled===1?'negocio':'negocios'}</div>` : `<div class="tier-bar"><i style="width:${pct}%"></i></div><div class="muted small">${t.filled} de ${t.spots} lugares${t.until?' · hasta el '+fmtYmd(t.until):''}</div>`}
      </div>`; }).join('')}
    <p class="hint">Un lugar se ocupa cuando el negocio paga por primera vez. Precios: Esencial / Premium al mes.</p>
  </div>`;
}
function openPayInfoEditor(){ payInfoForm = { ...(adminData.payInfo||{}) }; payInfoError=''; render(); }
async function savePayInfo(){
  payInfoError = ''; busy = true; render();
  const r = await adminSend('PUT','/api/admin/settings/payinfo', payInfoForm);
  busy = false;
  if(!r.ok){ payInfoError = errMsg(r,'No se pudo guardar.'); render(); return; }
  payInfoForm = null; showToast('Datos para cobrar guardados'); await adminReload();
}
function payInfoCardHtml(){
  const p = adminData.payInfo || {};
  if(payInfoForm){
    const f = payInfoForm, fld = (k,label,ph,extra) => `<div class="field"><label>${label}</label><input class="input" ${extra||''} value="${escapeHtml(f[k]||'')}" placeholder="${ph}" oninput="payInfoForm.${k}=this.value"></div>`;
    return `<div class="card">
      <div class="card-title">${ic('bank',18)} Datos para cobrar</div>
      ${fld('bank','Banco','Ej. BBVA','maxlength="60"')}
      ${fld('holder','A nombre de','Nombre completo o razón social','maxlength="80"')}
      ${fld('clabe','CLABE (18 dígitos)','012 345 678901234567','inputmode="numeric" maxlength="24"')}
      ${fld('card','Tarjeta o cuenta para depósito','Ej. 4152 3138 0000 0000','inputmode="numeric" maxlength="24"')}
      ${fld('cashNote','Instrucciones para pago en efectivo','Ej. Tu asesor pasa a tu negocio','maxlength="200"')}
      ${fld('extra','Nota extra (opcional)','Ej. Si necesitas factura, pídela a tu asesor','maxlength="300"')}
      ${errorHtml(payInfoError)}
      <div class="row mt-12" style="gap:8px"><button class="btn btn-ghost" style="flex:1" onclick="payInfoForm=null;render()">Cancelar</button><button class="btn btn-primary" style="flex:2" ${busy?'disabled':''} onclick="savePayInfo()">Guardar</button></div>
      <p class="hint">Los negocios ven estos datos en su panel → Ajustes → Tu membresía. Nunca pongas aquí contraseñas ni el NIP de tu tarjeta.</p>
    </div>`;
  }
  const empty = !p.clabe && !p.card;
  return `<div class="card">
    <div class="card-title">${ic('bank',18)} Datos para cobrar <button class="linkbtn small" style="margin-left:auto" onclick="openPayInfoEditor()">${empty?'Agregar':'Editar'}</button></div>
    ${empty ? `<div class="legal-warn">${ic('info',16)}<span>Aún no hay datos bancarios. Los negocios verán "tu asesor te da los datos".</span></div>` : ''}
    <div class="kv"><span class="muted small">Banco</span><span class="small">${escapeHtml(p.bank||'—')}</span></div>
    <div class="kv"><span class="muted small">A nombre de</span><span class="small" style="text-align:right">${escapeHtml(p.holder||'—')}</span></div>
    <div class="kv"><span class="muted small">CLABE</span><span class="mono small">${escapeHtml(p.clabe||'—')}</span></div>
    <div class="kv"><span class="muted small">Depósito</span><span class="mono small">${escapeHtml(p.card||'—')}</span></div>
    <div class="kv"><span class="muted small">Mercado Pago</span><span class="small muted">Próximamente</span></div>
  </div>`;
}

/* ----- Prospectos: quién probó la demo o pidió que lo contacten, y activarlo en un toque ----- */
let adminLeads = null;
let leadApprove = null;      // { id, plan, trialDays }
let leadResult = null;       // resultado de la activación (código y PIN)
let leadsOld = false;
async function loadLeads(){
  const r = await adminFetch('/api/admin/leads');
  if(r.ok){ adminLeads = r.data; render(); }
}
function leadOf(id){ return (adminLeads||[]).find(l=>l.id===id); }
function leadAgo(iso){
  if(!iso) return '';
  const m = Math.round((Date.now()-new Date(iso).getTime())/60000);
  if(m<60) return 'hace '+Math.max(1,m)+' min';
  if(m<1440) return 'hace '+Math.round(m/60)+' h';
  const d = Math.round(m/1440); return 'hace '+d+(d===1?' día':' días');
}
function waLead(id){
  const l = leadOf(id); if(!l) return;
  const n = firstName(l.contactName);
  const t = l.status==='probando'
    ? `¡Hola ${n}! Te escribimos de P.A.E. ¿Qué te pareció la demo de ${l.businessName} en Redeo? Desde tu demo puedes activar tu prueba gratis de 14 días en un toque, o si quieres te ayudo a dejarla lista.`
    : l.status==='olvido_pin'
    ? `¡Hola ${n}! Te escribimos de P.A.E. por tu PIN de Redeo para ${l.businessName}.`
    : l.status==='prueba_activa'
    ? `¡Hola ${n}! Soy Raúl de P.A.E. Vi que empezaste tu prueba de Redeo para ${l.businessName}, ¡qué gusto! ¿Cuándo te queda bien que pase a dejarte tu sticker de mostrador y registrar contigo a tus primeros clientes?`
    : l.status==='quiere_contacto'
    ? `¡Hola ${n}! Te escribimos de P.A.E. por tu interés en Redeo para ${l.businessName}. ¿Tienes 10 minutos para platicar? Mientras, puedes probar la demo en ${location.origin}`
    : `¡Hola ${n}! Te escribimos de P.A.E. Vimos que quieres ${l.status==='solicito_contratar'?'contratar':'activar tu prueba gratis de'} Redeo para ${l.businessName}. ¿Te parece si la dejamos lista hoy?`;
  window.open(waLink(l.whatsapp, t), '_blank');
}
function waAccess(){
  const r = leadResult; if(!r) return;
  const t = `¡Hola ${firstName(r.contactName)}! Ya activamos ${r.name} en Redeo.${r.access && r.access.type==='trial' ? ' Tu prueba gratis dura hasta el '+fmtYmd(r.access.until)+'.' : ''}

`
    + `Para entrar: ${location.origin} → Tengo un negocio → Ya tengo cuenta
Código: ${r.slug}
PIN: ${r.pin}

`
    + `Si seguías en la demo en tu celular, ya estás dentro de tu cuenta real: solo acepta los términos y listo. Tu tarjeta se queda como la dejaste, sin los clientes de ejemplo.`;
  window.open(waLink(r.whatsapp, t), '_blank');
}
// Olvidó su PIN: genera uno nuevo y abre WhatsApp con el mensaje listo.
async function leadNewPin(id){
  const l = leadOf(id); if(!l || !l.slug) return;
  await adminResetPin(l.slug);
  const pin = adminNewPins[l.slug]; if(!pin) return;
  const t = `¡Hola ${firstName(l.contactName)}! Te escribimos de P.A.E. Tu PIN nuevo de Redeo para ${l.businessName} es: ${pin}\n\nPara entrar: ${location.origin} → Entrar a mi negocio, con tu WhatsApp o el código ${l.slug}. Si quieres, después lo cambias en Más → Mis datos de acceso.`;
  window.open(waLink(l.whatsapp, t), '_blank');
}
function startApprove(id){
  const l = leadOf(id);
  leadApprove = { id, plan: l && l.plan==='premium' ? 'premium' : 'esencial', trialDays: l && l.status==='solicito_contratar' ? 0 : 14 };
  leadResult = null; render();
}
async function confirmApprove(){
  const a = leadApprove; if(!a) return;
  busy=true; render();
  const r = await adminSend('POST','/api/admin/leads/'+a.id+'/approve', { plan:a.plan, trialDays:a.trialDays });
  busy=false;
  if(!r.ok){ showToast(errMsg(r,'No se pudo activar.'), 5000); return; }
  leadResult = { ...r.data, id:a.id }; leadApprove = null;
  await adminReload(); await loadLeads();
}
async function leadAction(id, action){
  const l = leadOf(id); if(!l) return;
  if(action==='discard' && !confirm('¿Descartar a '+l.businessName+'? Se borra su demo.')) return;
  busy=true; render();
  const r = await adminSend('POST','/api/admin/leads/'+id+'/'+action);
  busy=false;
  if(!r.ok){ showToast(errMsg(r,'No se pudo.'), 5000); return; }
  showToast(action==='extend' ? 'Su demo dura 7 días más.' : 'Descartado.');
  await loadLeads(); adminReload();
}
function leadCardHtml(l){
  const hot = l.status==='solicito_prueba' || l.status==='solicito_contratar' || l.status==='quiere_contacto' || l.status==='olvido_pin';
  const pill = `<span class="lead-pill ${hot?'hot':(l.status==='aprobado'||l.status==='prueba_activa')?'on':l.status==='probando'?'demo':''}">${escapeHtml(l.statusLabel)}</span>`;
  const res = '';

  const ap = leadApprove && leadApprove.id===l.id ? `<div class="card mt-12" style="box-shadow:none;background:var(--surface-2)">
      <b class="small">Activar ${escapeHtml(l.businessName)}</b>
      <p class="muted small" style="margin:4px 0 10px">${l.isDemo ? 'Su demo se vuelve su cuenta: se queda lo que configuró, se borran los clientes de ejemplo y conserva su PIN.' : 'Se crea su negocio con lo que llenó.'}</p>
      <div class="seg"><button class="${leadApprove.plan==='esencial'?'on':''}" onclick="leadApprove.plan='esencial';render()">Esencial</button><button class="${leadApprove.plan==='premium'?'on':''}" onclick="leadApprove.plan='premium';render()">Premium</button></div>
      <label class="small mt-12" style="display:block;font-weight:700;color:var(--ink-2)">Prueba gratis</label>
      <select class="input mt-8" onchange="leadApprove.trialDays=Number(this.value)">${[[14,'14 días'],[7,'7 días'],[0,'Sin prueba (ya pagó o va a pagar)']].map(([v,t])=>`<option value="${v}" ${leadApprove.trialDays===v?'selected':''}>${t}</option>`).join('')}</select>
      <div class="row mt-12" style="gap:8px"><button class="btn btn-primary" style="flex:1" ${busy?'disabled':''} onclick="confirmApprove()">${busy?'Activando…':'Activar'}</button><button class="btn btn-ghost" onclick="leadApprove=null;render()">Cancelar</button></div>
    </div>` : '';
  const active = l.status!=='aprobado' && l.status!=='descartado' && l.status!=='prueba_activa' && l.status!=='olvido_pin';
  return `<div class="lead-card">
    <div class="row" style="justify-content:space-between;gap:8px;align-items:flex-start">
      <div style="min-width:0"><b style="color:var(--ink);font-size:1rem">${escapeHtml(l.businessName)}</b><div class="muted small">${escapeHtml(l.giroLabel)} · ${escapeHtml(l.contactName)} · <span class="mono">${escapeHtml(l.whatsapp)}</span></div></div>
      ${pill}
    </div>
    <div class="muted small mt-8">${escapeHtml(leadAgo(l.createdAt))}${l.contactTime?(l.contactTime==='Cuando sea'?' · a cualquier hora':' · prefiere en la '+escapeHtml(l.contactTime.toLowerCase())):''}${l.isDemo?` · usó la demo ${l.demoMoves} ${l.demoMoves===1?'vez':'veces'} · se borra ${escapeHtml(fmtYmd(String(l.demoExpiresAt||'').slice(0,10)))}`:''}${l.lastSeenAt&&l.isDemo?' · entró '+escapeHtml(leadAgo(l.lastSeenAt)):''}</div>
    ${l.message?`<p class="small" style="margin:8px 0 0;color:var(--ink-2)">"${escapeHtml(l.message)}"</p>`:''}
    ${active ? `<div class="row mt-12" style="gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" style="flex:1;min-width:110px" onclick="startApprove(${l.id})">${ic('check',16)} Activar</button>
      <button class="btn btn-wa btn-sm" style="flex:1;min-width:110px" onclick="waLead(${l.id})">${ic('send',16)} Escribirle</button>
      ${l.isDemo?`<button class="btn btn-ghost btn-sm" onclick="leadAction(${l.id},'extend')">+7 días</button>`:''}
      <button class="btn btn-ghost btn-sm" onclick="leadAction(${l.id},'discard')">Descartar</button>
    </div>` : l.status==='olvido_pin' && l.slug ? `<div class="row mt-12" style="gap:8px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" style="flex:1;min-width:160px" ${busy?'disabled':''} onclick="leadNewPin(${l.id})">${ic('lock',16)} PIN nuevo y mandárselo</button><button class="btn btn-ghost btn-sm" onclick="leadAction(${l.id},'discard')">Ya quedó</button></div>` : l.status==='prueba_activa' ? `<div class="row mt-12" style="gap:8px"><button class="btn btn-wa btn-sm" style="flex:1" onclick="waLead(${l.id})">${ic('send',16)} Escribirle para pasar a pegar su sticker</button></div>` : ''}
    ${ap}${res}
  </div>`;
}
function leadResultHtml(){
  const r = leadResult; if(!r) return '';
  return `<div class="card mt-16" style="background:#E9F5EE;border-color:#BFE6CF">
      <div class="row" style="justify-content:space-between;gap:8px"><b style="color:var(--ok)">${ic('check',16)} ${escapeHtml(r.name)} ya está activo</b><button class="linkbtn small" onclick="leadResult=null;render()">Cerrar</button></div>
      <div class="kv mt-8"><span class="muted small">Código</span><span class="mono">${escapeHtml(r.slug)}</span></div>
      <div class="kv"><span class="muted small">PIN</span><span class="mono">${escapeHtml(r.pin)}</span></div>
      <div class="kv"><span class="muted small">Acceso</span><span class="small">${r.access && r.access.type==='trial' ? 'Prueba hasta el '+fmtYmd(r.access.until) : 'Sin fecha: registra su pago'}</span></div>
      <button class="btn btn-primary btn-block mt-12" onclick="connectStickerScan({admin:true, slug:'${jsEsc(r.slug)}'})">${ic('scan',16)} Conectar su sticker</button>
      <button class="btn btn-wa btn-block mt-8" onclick="waAccess()">${ic('send',16)} Enviarle su acceso por WhatsApp</button>
      <button class="btn btn-secondary btn-block mt-8" onclick="openAdminPay('${jsEsc(r.slug)}','pagos')">${ic('coin',16)} Registrar su pago</button>
    </div>`;
}
function adminProspectos(){
  if(!adminLeads) return `<p class="muted small mt-16">Cargando prospectos…</p>`;
  const hot = adminLeads.filter(l=>['solicito_contratar','solicito_prueba','quiere_contacto'].includes(l.status));
  const demo = adminLeads.filter(l=>l.status==='probando');
  const old = adminLeads.filter(l=>['aprobado','descartado','vencido'].includes(l.status));
  const sec = (title, list, empty) => `<p class="eyebrow mt-24">${title} ${list.length?`<span class="muted">(${list.length})</span>`:''}</p>${list.length ? list.map(leadCardHtml).join('') : `<p class="muted small mt-8">${empty}</p>`}`;
  return `
    ${leadResultHtml()}
    ${quietTrialsHtml()}
    <p class="muted small mt-16">Negocios que probaron la demo o pidieron que los contactes. También llegan a tu Google Sheet (pestaña Prospectos).</p>
    ${sec('Quieren activar o que los contactes', hot, 'Nadie por ahora.')}
    ${sec('Probando la demo', demo, 'Nadie está probando la demo ahora.')}
    ${old.length ? `<button class="linkbtn small mt-24" onclick="leadsOld=!leadsOld;render()">${leadsOld?'Ocultar':'Ver'} anteriores (${old.length})</button>${leadsOld?old.map(leadCardHtml).join(''):''}` : ''}`;
}

// ----- Ficha del negocio (datos, plan y acceso; sin cobro) -----
function openAdminBiz(slug){
  const b = bizOf(slug); if(!b) return;
  adminBiz = slug; adminPay = null; deleteSlug = null; accessEdit = null;
  memForm = { ownerName:b.ownerName||'', ownerPhone:b.ownerPhone||'', ownerEmail:b.ownerEmail||'', billingCycle:b.billingCycle||'mensual', notes:b.notes||'',
    legalName:b.legalName||'', legalAddress:b.legalAddress||'', privacyEmail:b.privacyEmail||'' };
  window.scrollTo(0,0); render();
  if(!adminPayments[slug]) loadPayments(slug);
}
function closeAdminBiz(){ adminBiz=null; render(); }
async function saveMembership(){
  const f = memForm;
  if(f.ownerPhone && !isValidPhone(normalizePhone(f.ownerPhone))){ showToast(phoneMsg('m-phone','el WhatsApp del dueño')); return; }
  const b = bizOf(adminBiz);
  busy=true; render();
  const r = await adminSend('PUT','/api/admin/businesses/'+enc(adminBiz)+'/membership', { ...f, ownerPhone: normalizePhone(f.ownerPhone), priceMonthly: b && b.customPrice ? b.priceMonthly : '' });
  busy=false;
  if(!r.ok){ showToast(r.data.error||'No se pudo guardar.'); render(); return; }
  await adminReload();
  showToast('Datos guardados.');
}
async function suspendAccess(slug){
  if(!confirm('¿Suspender el acceso hoy? Su panel se pausa (no se borra nada) hasta que registres un pago.')) return;
  const r = await adminSend('PUT','/api/admin/businesses/'+enc(slug)+'/suspend');
  if(!r.ok){ showToast(r.data.error||'No se pudo suspender.'); return; }
  await adminReload(); showToast('Acceso suspendido.');
}

// ----- Apartado de pagos de un negocio -----
function openAdminPay(slug, from){
  const b = bizOf(slug); if(!b) return;
  adminPay = { slug, from: from || (adminBiz ? 'ficha' : 'pagos') };
  lastPayment = null;
  const pk = packagesFor(b).find(x=>x.key===(b.billingCycle==='anual'?'anual':'mensual'));
  payForm = { pkg: pk.key, months: pk.months, amount: String(pk.amount), custom:false, method:'Transferencia', paidAt: adminData.today, note:'' };
  window.scrollTo(0,0); render();
  loadPayments(slug);
}
function closeAdminPay(){
  const from = adminPay && adminPay.from; adminPay = null;
  if(from!=='ficha'){ adminBiz = null; adminTab = 'pagos'; loadRecentPayments(); }
  render();
}
function pickPackage(key){
  const b = bizOf(adminPay.slug), pk = packagesFor(b).find(x=>x.key===key);
  payForm.pkg = key; payForm.months = pk.months; payForm.amount = String(pk.amount); payForm.custom = false; render();
}
function toggleCustomPay(){
  payForm.custom = !payForm.custom;
  if(!payForm.custom) pickPackage(payForm.pkg || 'mensual'); else render();
}
function coversPreview(b, months){
  const today = adminData.today, a = b.access;
  const add = (ymd, d) => { const x = new Date(ymd+'T12:00:00Z'); x.setUTCDate(x.getUTCDate()+d); return x.toISOString().slice(0,10); };
  const addM = (ymd, n) => { const y=+ymd.slice(0,4), m=+ymd.slice(5,7)-1+n, d=+ymd.slice(8,10); const last=new Date(Date.UTC(y,m+1,0)).getUTCDate(); return new Date(Date.UTC(y,m,Math.min(d,last))).toISOString().slice(0,10); };
  const from = a && a.type==='paid' && a.until && a.until>=today ? add(a.until,1) : today;
  return { from, to: add(addM(from, months), -1) };
}
async function registerPayment(){
  const f = payForm, amount = Math.round(Number(f.amount)), months = Math.round(Number(f.months));
  if(!(amount>0)){ showToast('Escribe el monto.'); return; }
  if(!(months>=1)){ showToast('Elige cuántos meses cubre.'); return; }
  busy=true; render();
  const r = await adminSend('POST','/api/admin/businesses/'+enc(adminPay.slug)+'/payments', { amount, months, method:f.method, paidAt:f.paidAt, note:f.note });
  busy=false;
  if(!r.ok){ showToast(r.data.error||'No se pudo registrar.'); render(); return; }
  lastPayment = r.data.payment; recentPayments = null;
  await adminReload(); await loadPayments(adminPay.slug);
  showToast('Pago registrado: '+lastPayment.folio);
}
async function deletePayment(slug, id){
  if(!confirm('¿Borrar este pago? Úsalo solo si lo registraste por error. La vigencia no cambia; si hace falta, ajústala en la ficha del negocio.')) return;
  const r = await adminSend('DELETE','/api/admin/payments/'+id);
  if(!r.ok){ showToast(r.data.error||'No se pudo borrar.'); return; }
  if(lastPayment && lastPayment.id===id) lastPayment=null;
  recentPayments = null;
  await adminReload(); await loadPayments(slug);
  showToast('Pago borrado.');
}

// ----- Recibo -----
function findPayment(id){
  for(const k in adminPayments){ const p = (adminPayments[k]||[]).find(x=>x.id===id); if(p) return [p, k]; }
  const r = (recentPayments||[]).find(x=>x.id===id); if(r) return [r, r.businessSlug];
  if(lastPayment && lastPayment.id===id) return [lastPayment, adminPay && adminPay.slug];
  return [null, null];
}
function receiptHtml(p, b){
  const row = (k,v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recibo ${escapeHtml(p.folio)}</title>
<style>body{font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#1A1320;background:#F6F1EA;margin:0;padding:24px}
.r{max-width:560px;margin:0 auto;background:#fff;border-radius:18px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,.06)}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1A1320;padding-bottom:16px}
h1{font-size:22px;margin:0}.muted{color:#8A8190;font-size:13px}.folio{font-weight:800;font-size:15px;text-align:right}
table{width:100%;border-collapse:collapse;margin-top:18px}td{padding:10px 0;border-bottom:1px solid #EAE3DC;font-size:14px;vertical-align:top}td:first-child{color:#8A8190;width:42%}
.total{display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding:16px;border-radius:14px;background:#FDE8EF}
.total b{font-size:26px;color:#0F5A45}.foot{margin-top:22px;font-size:12px;color:#8A8190;line-height:1.5}
.btn{display:block;margin:18px auto 0;max-width:560px;text-align:center}.btn button{font:inherit;font-weight:700;border:none;background:#1A1320;color:#fff;border-radius:12px;padding:12px 22px}
@media print{body{background:#fff;padding:0}.r{box-shadow:none}.btn{display:none}}</style></head><body>
<div class="r"><div class="top"><div><h1>Recibo de pago</h1><div class="muted">P.A.E. · Plataforma de Asistencia a Emprendedores</div></div><div><div class="folio">${escapeHtml(p.folio)}</div><div class="muted">${escapeHtml(fmtYmd(p.paidAt))}</div></div></div>
<table>${row('Recibimos de', escapeHtml(b.ownerName ? b.ownerName+' · '+b.name : b.name))}
${row('Concepto', 'Membresía Redeo '+planName(p.plan)+' · '+monthsText(p.months))}
${row('Periodo', escapeHtml(fmtYmd(p.coversFrom))+' al '+escapeHtml(fmtYmd(p.coversTo)))}
${row('Forma de pago', escapeHtml(p.method))}${p.note?row('Referencia', escapeHtml(p.note)):''}</table>
<div class="total"><span>Total pagado</span><b>${money(p.amount)} MXN</b></div>
<div class="foot">Gracias por confiar en Redeo. Este recibo es un comprobante de pago interno; no es un comprobante fiscal (CFDI).</div></div>
<div class="btn"><button onclick="window.print()">Imprimir o guardar en PDF</button></div></body></html>`;
}
function openReceipt(id){
  const [p, slug] = findPayment(id); const b = slug && bizOf(slug);
  if(!b || !p) return;
  const w = window.open('', '_blank');
  if(!w){ showToast('Permite las ventanas emergentes para ver el recibo.'); return; }
  w.document.open(); w.document.write(receiptHtml(p, b)); w.document.close();
}
function receiptWhatsApp(id){
  const [p, slug] = findPayment(id); const b = slug && bizOf(slug); if(!b||!p) return;
  const who = firstName(b.ownerName);
  const t = `Hola${who?' '+who:''}, recibí tu pago de ${money(p.amount)} por la membresía Redeo ${planName(p.plan)} de ${b.name} (${monthsText(p.months)}: del ${fmtYmd(p.coversFrom)} al ${fmtYmd(p.coversTo)}). Folio ${p.folio}. ¡Gracias!`;
  window.open(waLink(b.ownerPhone, t), '_blank');
}
function payRowHtml(p, slug, showBiz){
  return `<div class="pay-row">
    <div style="flex:1;min-width:0"><b>${money(p.amount)}</b> <span class="muted small">· ${escapeHtml(p.folio)} · ${escapeHtml(p.method)}</span>
      <div class="muted small">${showBiz?`<b style="color:var(--ink-2)">${escapeHtml(p.businessName)}</b> · `:''}${fmtYmd(p.paidAt)} · ${monthsText(p.months)} (${fmtYmd(p.coversFrom)} – ${fmtYmd(p.coversTo)})${p.note?' · '+escapeHtml(p.note):''}</div></div>
    <button class="icon-btn" aria-label="Recibo ${escapeHtml(p.folio)}" onclick="openReceipt(${p.id})">${ic('printer',16)}</button>
    <button class="icon-btn" aria-label="Enviar recibo ${escapeHtml(p.folio)}" onclick="receiptWhatsApp(${p.id})">${ic('send',16)}</button>
    ${showBiz?'':`<button class="icon-btn" aria-label="Borrar pago ${escapeHtml(p.folio)}" onclick="deletePayment('${jsEsc(slug)}',${p.id})">${ic('x',16)}</button>`}
  </div>`;
}
