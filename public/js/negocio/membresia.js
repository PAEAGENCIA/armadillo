/* Redeo · Negocio: "Tu membresía" (precio, lote, cómo pagar) y aceptar términos. */
/* ---------- Mi membresía: precio, lote y cómo pagar ---------- */
let memb = { data:null, loading:false, period:1, method:'Transferencia', ref:'', error:'', sent:false, plan:null };
const PAY_METHODS = [
  { id:'Transferencia', icon:'transfer', title:'Transferencia', sub:'SPEI desde tu banco' },
  { id:'Depósito', icon:'bank', title:'Depósito', sub:'En ventanilla u OXXO' },
  { id:'Efectivo', icon:'cash', title:'Efectivo', sub:'Con tu asesor de P.A.E.' },
  { id:'mp', icon:'card', title:'Mercado Pago', sub:'Tarjeta en línea', soon:true }
];
async function openMembresia(){
  if(!isOwner()) return;
  if(memb.slug!==session.slug){ memb.data = null; memb.slug = session.slug; memb.ref = ''; }
  view = 'membresia'; memb.error = ''; memb.sent = false; memb.loading = !memb.data; render(); window.scrollTo(0,0);
  const r = await api('GET','/api/businesses/'+enc(session.slug)+'/membership', undefined, session.pin);
  memb.loading = false;
  if(!r.ok){ if(handleAuthError(r)) return; memb.error = errMsg(r,'No se pudo cargar tu membresía.'); render(); return; }
  memb.data = r.data;
  if(!memb.plan || !r.data.plans) memb.plan = r.data.plan;
  if(r.data.access && r.data.access.type==='paid' && memb.period!==12 && memb.period!==1) memb.period = 1;
  render();
}
function membRowHtml(){
  const a = cache.biz.access || {};
  const st = !a.until ? 'Activa' : a.type==='trial' ? 'Prueba gratis hasta el '+fmtYmd(a.until) : 'Pagada hasta el '+fmtYmd(a.until);
  return `<button class="mb-row mt-12" onclick="openMembresia()"><span class="mb-row-ico">${ic('wallet',20)}</span><div><b>Tu membresía</b><span>${st} · ver precio y pagar</span></div><span class="chev">${ic('right',18)}</span></button>`;
}
function closeMembresia(){ view = 'dashboard'; render(); window.scrollTo(0,0); }
// Precio del plan que eligió (Esencial o Premium) en su mismo lote; con precio especial solo hay uno.
function membPlan(){ const d = memb.data; return d && d.plans && (memb.plan==='premium'||memb.plan==='esencial') ? memb.plan : (d ? d.plan : 'esencial'); }
function membPrice(){ const d = memb.data; if(!d) return 0; return d.plans ? d.plans[membPlan()].price : d.price; }
function membRegular(){ const d = memb.data; if(!d) return 0; return d.plans ? d.plans[membPlan()].regular : d.regular; }
function membTotal(){ const p = membPrice(); return memb.period===12 ? p*10 : p; }
function membPlansHtml(d){
  if(!d.plans) return '';
  const cur = membPlan();
  const card = (k, name, sub, bullets) => `<button class="mb-planopt ${cur===k?'on':''} ${k==='premium'?'pro':''}" onclick="memb.plan='${k}';render()" aria-pressed="${cur===k}">
      ${k==='premium'?'<i>Recomendado</i>':''}
      <span class="mb-po-h"><b>${name}</b><span class="mb-po-radio"></span></span>
      <span class="mb-po-price">${money(d.plans[k].price)}<small>/mes</small>${d.plans[k].regular>d.plans[k].price?` <s>${money(d.plans[k].regular)}</s>`:''}</span>
      <span class="mb-po-sub">${sub}</span>
      <span class="mb-po-list">${bullets.map(t=>`<span>${ic('check',14)} ${t}</span>`).join('')}</span>
    </button>`;
  const change = cur!==d.plan ? `<p class="mb-note">${ic('info',14)} <span>${cur==='esencial'
      ? '<b>Cambias a Esencial.</b> Tus clientes y sus sellos se quedan igual. Tu logo, tus colores propios y las herramientas de Crecer se pausan; si regresas a Premium, vuelven.'
      : '<b>Cambias a Premium.</b> En cuanto P.A.E. confirme tu pago se activan tu logo, tus colores y todas las herramientas de Crecer.'}</span></p>` : '';
  return `<div class="mb-sec">¿Qué plan quieres?</div>
    <div class="mb-plans">
      ${card('esencial','Esencial','Tu tarjeta digital y tus clientes, sin complicaciones.',['Sellos, puntos o monedero','Clientes ilimitados','Sticker, QR y equipo con PIN'])}
      ${card('premium','Premium','Para que regresen más seguido.',['Todo lo de Esencial','Tu logo y tus colores','Promociones, avisos y "Te extrañamos"'])}
    </div>${change}`;
}
function membStatusHtml(a){
  if(!a || a.type==='none') return `<span class="mb-dot ok"></span> Activa · sin fecha de vencimiento`;
  if(a.expired) return `<span class="mb-dot off"></span> En pausa desde el ${fmtYmd(a.until)}`;
  if(a.type==='trial') return `<span class="mb-dot trial"></span> Prueba gratis hasta el ${fmtYmd(a.until)} · ${a.daysLeft===1?'último día':a.daysLeft+' días'}`;
  return `<span class="mb-dot ${a.daysLeft<=7?'warn':'ok'}"></span> Pagada hasta el ${fmtYmd(a.until)}`;
}
function membPriceNote(d){
  if(d.priceSource==='custom') return `<p class="mb-note">Precio especial acordado con P.A.E.</p>`;
  if(d.priceSource==='locked') return `<p class="mb-note">${ic('lock',14)} <span><b>Tu precio está congelado.</b> Lo conservas mientras sigas pagando, aunque el precio suba para los nuevos. Si pasan más de 30 días sin servicio, al regresar pagarías el precio que esté vigente.</span></p>`;
  if(d.spotsLeft!=null) return `<p class="mb-note">${ic('clock',14)} <span><b>Quedan ${d.spotsLeft} de ${d.spots} lugares a este precio.</b> Tu lugar se aparta con tu primer pago y te quedas con este precio mientras sigas pagando.</span></p>`;
  return '';
}
function payRow(label, value, copyLabel){
  if(!value) return '';
  return `<div class="kv"><span class="muted small">${label}</span><button class="mb-copy" onclick="copyText('${jsEsc(String(value))}','${jsEsc(copyLabel||label+' copiado')}')"><span class="mono">${escapeHtml(String(value))}</span>${ic('copy',14)}</button></div>`;
}
function membMethodHtml(d){
  const p = d.payInfo || {}, slug = session.slug, total = membTotal();
  const noBank = !p.clabe && !p.card && !p.bank;
  const amountRow = payRow('Monto', money(total), 'Monto copiado');
  let body = '';
  if(memb.method==='Transferencia'){
    body = noBank ? `<p class="small muted">Tu asesor de P.A.E. te da los datos para transferir. Cuando pagues, avísanos aquí abajo.</p>${amountRow}` :
      `${p.bank?`<div class="kv"><span class="muted small">Banco</span><b>${escapeHtml(p.bank)}</b></div>`:''}
       ${p.holder?`<div class="kv"><span class="muted small">A nombre de</span><b style="text-align:right">${escapeHtml(p.holder)}</b></div>`:''}
       ${payRow('CLABE', p.clabe, 'CLABE copiada')}${amountRow}${payRow('Concepto', slug, 'Concepto copiado')}
       <p class="small muted mt-8">Escribe <b>${escapeHtml(slug)}</b> en el concepto para que sepamos que es tu pago.</p>`;
  } else if(memb.method==='Depósito'){
    body = !p.card && !p.clabe ? `<p class="small muted">Tu asesor de P.A.E. te da el número para depositar. Cuando pagues, avísanos aquí abajo.</p>${amountRow}` :
      `${p.bank?`<div class="kv"><span class="muted small">Banco</span><b>${escapeHtml(p.bank)}</b></div>`:''}
       ${p.holder?`<div class="kv"><span class="muted small">A nombre de</span><b style="text-align:right">${escapeHtml(p.holder)}</b></div>`:''}
       ${payRow(p.card?'Tarjeta o cuenta':'CLABE', p.card||p.clabe, 'Número copiado')}${amountRow}
       <p class="small muted mt-8">Guarda tu comprobante. Si puedes, escribe <b>${escapeHtml(slug)}</b> en la referencia.</p>`;
  } else {
    body = `<p class="small" style="margin:0 0 6px">${escapeHtml(p.cashNote||'Paga en efectivo directamente a tu asesor de P.A.E.')}</p>${amountRow}
      <p class="small muted mt-8">Avísanos y tu asesor se pone de acuerdo contigo para recogerlo.</p>`;
  }
  const ask = memb.method!=='Efectivo';
  return `<div class="mb-how fade">${body}${p.extra?`<p class="small muted mt-8">${escapeHtml(p.extra)}</p>`:''}
    ${ask?`<div class="field mt-16" style="margin-bottom:0"><label for="mb-ref">Folio o clave de rastreo <span class="muted">(opcional)</span></label>
      <input id="mb-ref" class="input" maxlength="60" value="${escapeHtml(memb.ref)}" placeholder="Ej. 0923ABC45" oninput="memb.ref=this.value"></div>`:''}
  </div>`;
}
function membReportHtml(r){
  if(!r) return '';
  const when = new Date(r.createdAt).toLocaleDateString('es-MX',{day:'numeric',month:'short'});
  if(r.status==='pendiente') return `<div class="mb-status wait">${ic('clock',18)}<div><b>Aviso enviado el ${when}</b><span>${escapeHtml(r.method)} de ${money(r.amount)} (${r.plan?(r.plan==='premium'?'Premium':'Esencial')+', ':''}${r.months===12?'12 meses':'1 mes'}). P.A.E. lo revisa y activa tu servicio; normalmente el mismo día hábil.</span></div></div>`;
  if(r.status==='rechazado') return `<div class="mb-status bad">${ic('info',18)}<div><b>No pudimos confirmar tu aviso del ${when}</b><span>${escapeHtml(r.rejectReason||'Revisa los datos e inténtalo de nuevo, o escríbele a tu asesor.')}</span></div></div>`;
  return '';
}
function viewMembresia(){
  const d = memb.data, biz = cache.biz;
  const back = `<button class="back" onclick="closeMembresia()">${ic('left',18)} Volver</button>`;
  if(!d) return `<div class="wrap fade mbw">${back}<h2 class="mt-12">Tu membresía</h2>${memb.loading?`<p class="lead">Cargando…</p>`:errorHtml(memb.error)}</div>`;
  const premium = membPlan()==='premium', total = membTotal(), price = membPrice(), regular = membRegular();
  const cheaper = regular && price < regular;
  const pending = d.lastReport && d.lastReport.status==='pendiente';
  return `
  <div class="wrap fade mbw">
    ${back}
    <div class="eyebrow mt-12">Tu membresía</div>
    <h2 style="margin:4px 0 16px">Redeo ${premium?'Premium':'Esencial'}</h2>
    <div class="mb-layout"><div class="mb-col-a">

    <div class="mb-ticket">
      <div class="mb-top">
        ${d.tierLabel && d.priceSource!=='custom' ? `<span class="mb-tag">${d.priceSource==='locked'?ic('lock',12):''} ${escapeHtml(d.tierLabel)}</span>` : '<span></span>'}
        <span class="mb-plan">${premium?'Premium':'Esencial'}</span>
      </div>
      <div class="mb-price"><span class="mb-cur">$</span>${Number(price).toLocaleString('es-MX')}<span class="mb-per">/mes</span></div>
      ${cheaper ? `<div class="mb-reg">Precio regular <s>${money(regular)}</s></div>` : ''}
      <div class="mb-cut"></div>
      <div class="mb-state">${membStatusHtml(d.access)}</div>
    </div>
    ${membPriceNote(d)}
    ${d.premiumPrice && !d.plans ? `<p class="small muted" style="margin:6px 2px 0">¿Quieres tu logo, tu color exacto y más? Premium en tu mismo lote: <b>${money(d.premiumPrice)}/mes</b>. Pídeselo a tu asesor.</p>` : ''}
    </div><div class="mb-col-b">

    ${d.isDemo ? `<div class="private-note mt-24">${ic('info',16)}<span>Esto es una demo. Cuando actives tu tarjeta, aquí mismo eliges cómo pagar: transferencia, depósito o efectivo.</span></div>
      <button class="btn btn-primary btn-block mt-16" onclick="closeMembresia();openDemoSheet('contratar')">Quiero activar mi tarjeta</button></div></div></div>` : `

    ${membPlansHtml(d)}
    <div class="mb-sec">¿Cuánto quieres pagar?</div>
    <div class="mb-periods">
      <button class="${memb.period===1?'on':''}" onclick="memb.period=1;render()"><b>1 mes</b><span>${money(price)}</span></button>
      <button class="${memb.period===12?'on':''}" onclick="memb.period=12;render()"><i>2 meses gratis</i><b>12 meses</b><span>${money(price*10)} <s>${money(price*12)}</s></span></button>
    </div>

    <div class="mb-sec">¿Cómo quieres pagar?</div>
    <div class="mb-methods">
      ${PAY_METHODS.map(m=>`<button class="${memb.method===m.id?'on':''} ${m.soon?'soon':''}" ${m.soon?'disabled aria-disabled="true"':''} onclick="memb.method='${m.id}';memb.error='';render()">
        ${ic(m.icon,20)}<b>${m.title}</b><span>${m.soon?'Próximamente':m.sub}</span></button>`).join('')}
    </div>
    ${membMethodHtml(d)}

    ${membReportHtml(d.lastReport)}
    ${errorHtml(memb.error)}
    <button class="btn btn-primary btn-block mt-16" ${busy||pending?'disabled':''} onclick="sendPayReport()">${busy?'Enviando…':pending?'Aviso enviado':(memb.method==='Efectivo'?'Avisar que pagaré en efectivo':'Ya pagué, avisar a P.A.E.')} ${!busy&&!pending?`· ${money(total)}`:''}</button>
    <p class="small muted" style="text-align:center;margin:8px 0 0">Tu pago se aplica en cuanto P.A.E. lo confirme.</p>

    ${d.payments && d.payments.length ? `<div class="mb-sec">Tus pagos</div>
      <div class="card" style="padding:4px 16px">${d.payments.map(p=>`<div class="kv"><div><b>${money(p.amount)}</b> <span class="muted small">· ${p.months===12?'12 meses':p.months+' '+(p.months===1?'mes':'meses')} · ${escapeHtml(p.method||'')}</span><div class="muted small">${fmtYmd(String(p.paidAt||'').slice(0,10))}${p.coversTo?' · cubre hasta el '+fmtYmd(p.coversTo):''}</div></div><span class="mono small">${escapeHtml(p.folio||'')}</span></div>`).join('')}</div>` : ''}
  </div></div></div>`}`;
}
async function sendPayReport(){
  if(!memb.data || busy) return;
  memb.error = ''; busy = true; render();
  const r = await api('POST','/api/businesses/'+enc(session.slug)+'/payment-report', { method:memb.method, months:memb.period, reference:memb.ref.trim(), plan:membPlan() }, session.pin);
  busy = false;
  if(!r.ok){ if(handleAuthError(r)) return; memb.error = errMsg(r,'No se pudo enviar tu aviso.'); render(); return; }
  memb.data = r.data; memb.ref = '';
  showToast('¡Listo! P.A.E. ya recibió tu aviso.');
  render();
}

let termsForm = { accept:false, name:'' };
let termsError = '';
async function acceptTerms(){
  termsError = '';
  if(!termsForm.accept){ termsError = 'Marca la casilla para aceptar.'; render(); return; }
  if(termsForm.name.trim().length < 3){ termsError = 'Escribe tu nombre completo.'; render(); return; }
  busy = true; render();
  const r = await api('POST','/api/businesses/'+enc(session.slug)+'/accept-terms', { accept:true, name:termsForm.name.trim(), version:(serverConfig.legal||{}).termsVersion }, session.pin);
  busy = false;
  if(!r.ok){ termsError = errMsg(r,'No se pudo guardar. Intenta de nuevo.'); render(); return; }
  cache.biz = { ...cache.biz, ...r.data };
  termsForm = { accept:false, name:'' };
  window.scrollTo(0,0);
  showToast('¡Gracias! Ya puedes usar tu panel.');
}
function viewTerminos(){
  const b = cache.biz, again = !!b.termsAcceptedAt;
  return `
  <div class="wrap fade">
    <div class="topbar">${logoHtml()}<button class="icon-btn" aria-label="Cerrar sesión" onclick="cerrarSesion()">${ic('logout',18)}</button></div>
    <p class="eyebrow">${escapeHtml(b.name)}</p>
    <h2 class="mt-8">${again ? 'Actualizamos los Términos' : 'Antes de empezar'}</h2>
    <p class="lead">${again ? 'Hicimos cambios en los Términos del servicio. Léelos y acéptalos para seguir usando tu panel.' : 'Lee y acepta los Términos del servicio. Es un acuerdo sencillo que nos protege a los dos y a tus clientes.'}</p>
    <div class="terms-sum mt-16"><b style="color:var(--ink)">En palabras simples</b><ul class="mt-8">
      <li>Tus clientes son tuyos: puedes descargarlos cuando quieras y nunca los vendemos.</li>
      <li>Tú decides y cumples los premios y promociones de tu tarjeta.</li>
      <li>Cuida tus PIN: lo que se haga con ellos cuenta como hecho por tu negocio.</li>
      <li>Pagas por adelantado; si no pagas, tu panel se pausa pero no se borra nada de inmediato.</li>
      <li>Puedes cancelar cuando quieras, sin penalización.</li>
    </ul></div>
    <div class="doc-links">
      <button class="doc-link" onclick="openLegal('terminos',false)">${ic('info',18)}<span>Términos y Condiciones del Servicio<small>Incluye el Anexo A: cómo cuidamos los datos de tus clientes</small></span>${ic('right',16)}</button>
      <button class="doc-link" onclick="openLegal('privacidad-pae',false)">${ic('lock',18)}<span>Aviso de Privacidad de P.A.E.<small>Cómo usamos tus datos como cliente de Redeo</small></span>${ic('right',16)}</button>
    </div>
    <div class="card mt-16">
      <div class="field"><label for="t-name">Nombre completo de quien acepta</label><input id="t-name" class="input" autocomplete="name" value="${escapeHtml(termsForm.name)}" oninput="termsForm.name=this.value" placeholder="Ej. Laura Pérez Gómez"><p class="hint">Dueño(a) o representante del negocio.</p></div>
      <label class="check" style="padding-bottom:4px"><input id="t-accept" type="checkbox" ${termsForm.accept?'checked':''} onchange="termsForm.accept=this.checked"><span>Leí y acepto los Términos y Condiciones del Servicio (incluido su Anexo A) a nombre del negocio, y el Aviso de Privacidad de P.A.E.</span></label>
    </div>
    ${errorHtml(termsError)}
    <button class="btn btn-primary btn-block mt-16" ${busy?'disabled':''} onclick="acceptTerms()">${busy?'Guardando…':'Aceptar y continuar'}</button>
    <p class="hint" style="text-align:center">Queda constancia de la fecha, la hora y el nombre de quien acepta.</p>
  </div>`;
}
