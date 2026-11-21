/* Redeo · Administración P.A.E.: pantallas (Prospectos, Negocios, Pagos, Más, ficha y pagos de un negocio). */
// ----- Pantalla principal -----
function adminHome(){
  const bs = adminData.businesses || [];
  const nl = adminData.leadsNew || 0;
  const rp = adminData.reportsPending || 0;
  const tabs = [['prospectos','Prospectos'+(nl?` <span class="tab-badge">${nl}</span>`:'')],['negocios','Negocios'],['pagos','Pagos'+(rp?` <span class="tab-badge">${rp}</span>`:'')],['herramientas','Más']];
  return `
  <div class="wrap fade adm">
    <div class="topbar" style="margin-bottom:0">
      <div><div class="biz-name">Administración P.A.E.</div><span class="muted small">Negocios y membresías de Redeo</span></div>
      <button class="icon-btn" aria-label="Salir" onclick="adminExit()">${ic('logout',18)}</button>
    </div>
    <div class="seg admin-tabs four mt-24">${tabs.map(([t,l])=>`<button class="${adminTab===t?'on':''}" onclick="setAdminTab('${t}')">${l}</button>`).join('')}</div>
    ${adminTab==='pagos' ? adminPagos(bs) : adminTab==='herramientas' ? adminHerramientas(bs) : adminTab==='prospectos' ? adminProspectos() : adminNegocios(bs)}
  </div>`;
}
function adminRow(b, actions){
  const st = statusOf(b);
  return `<div class="item" style="flex-wrap:wrap" onclick="openAdminBiz('${jsEsc(b.slug)}')">
    <div class="avatar sm" style="background:${b.color};color:${textOn(b.color)}">${escapeHtml(initialOf(b.name))}</div>
    <div class="item-main"><div class="item-name">${escapeHtml(b.name)}</div>
      <div class="item-sub"><span class="plan-pill ${b.plan==='premium'?'premium':'esencial'}">${planName(b.plan)}</span> ${b.customers} ${b.customers===1?'cliente':'clientes'}${b.ownerName?' · '+escapeHtml(b.ownerName):''}</div>
      <div style="margin-top:6px"><span class="acc-pill ${st.cls}">${escapeHtml(st.label)}</span></div></div>
    ${actions ? `<div class="row" style="flex-basis:100%;gap:8px" onclick="event.stopPropagation()">${actions}</div>` : `<span class="muted">${ic('right',18)}</span>`}
  </div>`;
}
function adminNegocios(bs){
  const q = adminSearch.trim().toLowerCase();
  const list = bs.filter(b=>!q || b.name.toLowerCase().includes(q) || b.slug.includes(q) || (b.ownerName||'').toLowerCase().includes(q));
  const totalC = bs.reduce((s,b)=>s+b.customers,0);
  return `
    ${quietTrialsHtml()}
    <p class="muted small mt-16">${bs.length} ${bs.length===1?'negocio':'negocios'} · ${totalC} clientes en total</p>
    <div class="input-icon mt-8">${ic('search',18)}<input class="input" type="search" placeholder="Buscar negocio o dueño" value="${escapeHtml(adminSearch)}" oninput="adminSearch=this.value;render();var i=document.querySelector('input[type=search]');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}"></div>
    ${list.length ? `<div class="list">${list.map(b=>adminRow(b)).join('')}</div>` : `<div class="card mt-12"><div class="empty"><b style="color:var(--ink)">${q?'Sin resultados':'Aún no hay negocios'}</b></div></div>`}
    <button class="btn btn-secondary btn-block mt-16" onclick="createForm.adminKey=adminKey;createError='';view='negocioCrear';render()">${ic('plus',18)} Dar de alta un negocio a mano</button>
    <p class="hint" style="margin:8px 4px 0">Lo normal es activarlo desde Prospectos: su demo se vuelve su cuenta en un toque.</p>`;
}
function adminPagos(bs){
  const k = adminData.kpis || {};
  const pend = bs.filter(b=>b.access && b.access.type!=='none' && (b.access.expired || (b.access.type==='paid' && b.access.daysLeft<=7)))
    .sort((a,b)=> (a.access.expired===b.access.expired ? (a.access.until<b.access.until?-1:1) : (a.access.expired?-1:1)));
  const trials = bs.filter(b=>b.access && b.access.type==='trial' && !b.access.expired).sort((a,b)=>a.access.daysLeft-b.access.daysLeft);
  const acts = (b, remindLabel) => `<button class="btn btn-secondary btn-sm" style="flex:1;min-width:0" onclick="openAdminPay('${jsEsc(b.slug)}','pagos')">${ic('coin',16)} Registrar pago</button><button class="btn btn-ghost btn-sm" style="flex:1;min-width:0" onclick="remindOwner('${jsEsc(b.slug)}')">${ic('send',16)} ${remindLabel}</button>`;
  return `
    ${payReportsHtml()}
    <div class="kpi-grid mt-16">
      <div class="kpi dark"><span>Ingreso mensual</span><b>${money(k.mrr)}</b><small>${k.active||0} ${k.active===1?'negocio pagando':'negocios pagando'}</small></div>
      <div class="kpi"><span>Cobrado este mes</span><b>${money(k.collectedMonth)}</b><small>En el año: ${money(k.collectedYear)}</small></div>
      <div class="kpi ${k.dueSoon?'warn':''}"><span>Renuevan en 7 días</span><b>${k.dueSoon||0}</b><small>${k.trial||0} en prueba</small></div>
      <div class="kpi ${k.expired?'bad':''}"><span>Vencidos</span><b>${k.expired||0}</b><small>Panel en pausa</small></div>
    </div>
    <p class="eyebrow mt-24">Próximas renovaciones</p>
    ${pend.length ? `<div class="list">${pend.map(b=>adminRow(b, acts(b,'Recordar'))).join('')}</div>` : `<div class="card mt-12"><div class="empty"><div class="empty-ico">${ic('check',26)}</div><b style="color:var(--ink)">Todo al corriente</b><p class="small mt-8">Nadie renueva en los próximos 7 días.</p></div></div>`}
    ${trials.length ? `<p class="eyebrow mt-24">En prueba gratis</p><div class="list">${trials.map(b=>adminRow(b, acts(b,'Escribirle'))).join('')}</div>` : ''}
    <p class="eyebrow mt-24">Pagos recientes</p>
    <div class="card mt-12">${!recentPayments ? '<p class="muted small">Cargando…</p>' : !recentPayments.length ? '<p class="muted small">Aún no hay pagos registrados.</p>' : recentPayments.map(p=>payRowHtml(p, p.businessSlug, true)).join('')}</div>
    <div class="card">
      <div class="card-title">${ic('coin',18)} Registrar un pago</div>
      <select class="input" onchange="if(this.value)openAdminPay(this.value,'pagos')"><option value="">Elige el negocio…</option>${bs.map(b=>`<option value="${escapeHtml(b.slug)}">${escapeHtml(b.name)}</option>`).join('')}</select>
    </div>`;
}
function adminHerramientas(bs){
  const totalC = bs.reduce((s,b)=>s+b.customers,0), totalP = bs.reduce((s,b)=>s+b.pending,0);
  return `
    ${stickersAdminHtml()}
    <div class="stats mt-16">
      <div class="stat"><div class="stat-ico" style="background:var(--brand-soft);color:var(--brand)">${ic('store',17)}</div><div class="stat-num">${bs.length}</div><div class="stat-label">Negocios</div></div>
      <div class="stat"><div class="stat-ico" style="background:#EEF1FB;color:#2C56A8">${ic('users',17)}</div><div class="stat-num">${totalC}</div><div class="stat-label">Clientes</div></div>
      <div class="stat"><div class="stat-ico" style="background:#FFF1CF;color:#8A5B00">${ic('inbox',17)}</div><div class="stat-num">${totalP}</div><div class="stat-label">Solicitudes</div></div>
    </div>
    <div class="card mt-12">
      <div class="card-title">${ic('download',18)} Respaldo completo</div>
      <p class="muted small">Una copia exacta de todos los negocios, clientes, sellos y pagos. Descárgala cada semana y guárdala en Google Drive. Si algo falla, con este archivo se recupera todo.</p>
      <button class="btn btn-primary btn-block mt-12" ${busy?'disabled':''} onclick="adminBackup()">${busy?'Generando…':ic('download',18)+' Descargar respaldo'}</button>
    </div>
    ${tiersCardHtml()}
    ${payInfoCardHtml()}
    ${sheetsCardHtml(adminData.sheets)}
    ${adminLegalHtml(bs)}`;
}
function adminLegalHtml(bs){
  const lg = adminData.legal || { missing:[] };
  const hard = lg.missing.filter(m=>!m.soft);
  const noTerms = bs.filter(b=>!b.termsOk).length, noData = bs.filter(b=>!b.legalOk).length;
  return `<div class="card">
    <div class="card-title">${ic('info',18)} Documentos legales</div>
    ${hard.length ? `<div class="legal-warn">${ic('info',16)}<span>Faltan datos de P.A.E. en los documentos. Agrégalos en Railway → Variables:</span></div>` : `<p class="small" style="color:var(--ok);font-weight:700;margin-bottom:8px">Los datos de P.A.E. están completos.</p>`}
    ${lg.missing.map(m=>`<div class="kv"><span class="mono small">${escapeHtml(m.key)}</span><span class="small muted" style="text-align:right">${escapeHtml(m.label)}</span></div>`).join('')}
    <div class="kv"><span class="muted small">Negocios sin aceptar los Términos</span><b>${noTerms}</b></div>
    <div class="kv"><span class="muted small">Negocios con aviso incompleto</span><b>${noData}</b></div>
    <div class="kv"><span class="muted small">Versión vigente</span><span class="small">${escapeHtml(fmtYmd(lg.termsVersion||''))}</span></div>
    <div class="doc-links">
      <button class="doc-link" onclick="openLegal('terminos',false)">${ic('info',18)}<span>Términos y Condiciones del Servicio</span>${ic('right',16)}</button>
      <button class="doc-link" onclick="openLegal('privacidad-pae',false)">${ic('lock',18)}<span>Aviso de Privacidad de P.A.E.</span>${ic('right',16)}</button>
    </div>
    <p class="hint">Son modelos preparados con la ley vigente, pero no sustituyen la revisión de un abogado.</p>
  </div>`;
}

// ----- Ficha de un negocio -----
function adminBizView(){
  const b = bizOf(adminBiz);
  if(!b){ adminBiz=null; return adminHome(); }
  const st = statusOf(b), f = memForm, pays = adminPayments[b.slug];
  const last = pays && pays[0];
  return `
  <div class="wrap fade adm">
    <button class="back" onclick="closeAdminBiz()">${ic('left',18)} Administración</button>
    <div class="biz-head mt-12">
      <div class="avatar" style="background:${b.color};color:${textOn(b.color)}">${escapeHtml(initialOf(b.name))}</div>
      <div style="min-width:0"><div class="biz-name">${escapeHtml(b.name)}</div>
        <span class="code-chip">${escapeHtml(b.slug)}</span> <span class="plan-pill ${b.plan==='premium'?'premium':'esencial'}">${planName(b.plan)}</span></div>
    </div>

    <div class="card mt-16">
      <div class="card-title">${ic('store',18)} Negocio</div>
      <div class="kv"><span class="muted small">Clientes</span><b>${b.customers}</b></div>
      <div class="kv"><span class="muted small">Ya regresaron (2+ visitas)</span><b>${b.returned||0}</b></div>
      <div class="kv"><span class="muted small">Solicitudes pendientes</span><b>${b.pending}</b></div>
      <div class="kv"><span class="muted small">Sellos o puntos dados</span><b>${b.given}</b></div>
      <div class="kv"><span class="muted small">Alta</span><span class="small">${escapeHtml(fmtYmd(String(b.createdAt||'').slice(0,10)))}</span></div>
      <div class="kv"><span class="muted small">Sticker de mostrador</span><span class="small">${b.stickers ? `${b.stickers} · ${b.stickerScans} ${b.stickerScans===1?'escaneo':'escaneos'}` : 'Sin sticker'}</span></div>
      <button class="btn btn-secondary btn-block mt-8" onclick="connectStickerScan({admin:true, slug:'${jsEsc(b.slug)}'})">${ic('scan',18)} ${b.stickers?'Conectar otro sticker':'Conectar sticker'}</button>
    </div>

    <div class="card">
      <div class="card-title">${ic('user',18)} Datos del dueño</div>
      <div class="field"><label for="m-name">Nombre</label><input id="m-name" class="input" value="${escapeHtml(f.ownerName)}" oninput="memForm.ownerName=this.value" placeholder="Ej. Laura Pérez"></div>
      <div class="row" style="gap:8px">
        <div class="field" style="flex:1 1 100%;min-width:0"><label for="m-phone">Número de WhatsApp</label>${telField('m-phone', normalizePhone(f.ownerPhone), 'memForm.ownerPhone')}</div>
        <div class="field" style="flex:1;min-width:0"><label for="m-email">Correo</label><input id="m-email" class="input" type="email" autocapitalize="none" value="${escapeHtml(f.ownerEmail)}" oninput="memForm.ownerEmail=this.value"></div>
      </div>
      <div class="field"><label for="m-notes">Notas internas</label><input id="m-notes" class="input" maxlength="500" value="${escapeHtml(f.notes)}" oninput="memForm.notes=this.value" placeholder="Ej. prefiere que le escriban por la tarde"></div>
      <button class="btn btn-secondary btn-block" ${busy?'disabled':''} onclick="saveMembership()">Guardar datos</button>
    </div>

    <div class="card">
      <div class="card-title">${ic('info',18)} Legal</div>
      <div class="kv"><span class="muted small">Términos</span>${b.termsOk ? `<span class="small" style="text-align:right"><b style="color:var(--ok)">Aceptados</b> ${escapeHtml(fmtDate(b.termsAcceptedAt))}<br><span class="muted">por ${escapeHtml(b.termsAcceptedBy||'')}${b.termsIp?' · IP '+escapeHtml(b.termsIp):''}</span></span>` : `<span class="small" style="font-weight:700;color:#8A5B00;text-align:right">${b.termsAcceptedAt?'Falta aceptar la versión nueva':'Pendiente (se pide al entrar el dueño)'}</span>`}</div>
      <div class="field mt-12"><label for="m-lname">Nombre o razón social</label><input id="m-lname" class="input" maxlength="120" value="${escapeHtml(f.legalName)}" oninput="memForm.legalName=this.value" placeholder="Para su aviso de privacidad"></div>
      <div class="field"><label for="m-laddr">Domicilio del negocio</label><input id="m-laddr" class="input" maxlength="200" value="${escapeHtml(f.legalAddress)}" oninput="memForm.legalAddress=this.value"></div>
      <div class="field"><label for="m-lmail">Correo de privacidad</label><input id="m-lmail" class="input" type="email" autocapitalize="none" maxlength="120" value="${escapeHtml(f.privacyEmail)}" oninput="memForm.privacyEmail=this.value"></div>
      <button class="btn btn-secondary btn-block" ${busy?'disabled':''} onclick="saveMembership()">Guardar datos</button>
    </div>

    <div class="card">
      <div class="card-title">${ic('crown',18)} Membresía</div>
      <div class="kv"><span class="muted small">Plan</span><div class="seg" style="width:210px"><button class="${b.plan!=='premium'?'on':''}" ${busy?'disabled':''} onclick="${b.plan==='premium'?`adminSetPlan('${jsEsc(b.slug)}','esencial')`:''}">Esencial</button><button class="${b.plan==='premium'?'on':''}" ${busy?'disabled':''} onclick="${b.plan!=='premium'?`adminSetPlan('${jsEsc(b.slug)}','premium')`:''}">Premium</button></div></div>
      <div class="kv"><span class="muted small">Forma de cobro</span><div class="seg" style="width:210px"><button class="${f.billingCycle!=='anual'?'on':''}" onclick="memForm.billingCycle='mensual';saveMembership()">Mensual</button><button class="${f.billingCycle==='anual'?'on':''}" onclick="memForm.billingCycle='anual';saveMembership()">Anual</button></div></div>
      <div class="kv"><span class="muted small">Precio</span><span class="small"><b>${money(listPrice(b))}</b> al mes · ${money(listPrice(b)*10)} al año</span></div>
      <div class="kv"><span class="muted small">Lote</span><span class="small" style="text-align:right">${b.priceSource==='custom'?'Precio especial':b.tierLocked?`<b>${escapeHtml(b.tierName||'')}</b> · precio congelado`:b.tierName?`Tenía ${escapeHtml(b.tierName)}; perdió su precio (más de 30 días sin pagar)`:`Aún no paga · vería ${escapeHtml(b.priceTier||'')}`}</span></div>
      <div class="kv"><span class="muted small">Acceso</span><span class="acc-pill ${st.cls}">${escapeHtml(st.label)}</span></div>
      <div class="kv"><span class="muted small">Último pago</span><span class="small">${!pays ? '…' : last ? `${money(last.amount)} · ${fmtYmd(last.paidAt)}` : 'Sin pagos registrados'}</span></div>
      <button class="btn btn-secondary btn-block mt-12" onclick="openAdminPay('${jsEsc(b.slug)}','ficha')">${ic('coin',18)} Ver pagos de este negocio</button>
      <div class="row mt-8" style="gap:8px;flex-wrap:wrap">${accessEditorHtml(b)}</div>
      ${b.ownerPhone && b.access.type!=='none' ? `<button class="btn btn-ghost btn-block mt-8" onclick="remindOwner('${jsEsc(b.slug)}')">${ic('send',16)} ${b.access.type==='trial' && !b.access.expired ? 'Mandar su avance por WhatsApp' : 'Recordatorio de renovación'}</button>` : ''}
      ${!b.access.expired && b.access.type!=='none' ? `<button class="btn btn-ghost btn-block" style="color:var(--danger)" onclick="suspendAccess('${jsEsc(b.slug)}')">${ic('lock',16)} Suspender acceso hoy</button>` : ''}
    </div>

    <div class="card">
      <div class="card-title">${ic('lock',18)} Acceso del dueño</div>
      ${adminNewPins[b.slug] ? `<div class="new-pin">${ic('lock',16)}<span style="flex:1">PIN nuevo del dueño</span><b class="mono">${escapeHtml(adminNewPins[b.slug])}</b></div>` : ''}
      <button class="btn btn-ghost btn-block mt-8" ${busy?'disabled':''} onclick="adminResetPin('${jsEsc(b.slug)}')">${ic('refresh',16)} Restablecer PIN del dueño</button>
      <div class="row">${deleteBoxHtml(b)}</div>
    </div>
  </div>`;
}

// ----- Apartado de pagos de un negocio -----
function adminPayView(){
  const b = bizOf(adminPay.slug);
  if(!b){ adminPay=null; return adminHome(); }
  const pf = payForm, pays = adminPayments[b.slug], st = statusOf(b);
  const pk = packagesFor(b), cov = coversPreview(b, Number(pf.months)||1);
  const total = (pays||[]).reduce((s,p)=>s+p.amount,0);
  return `
  <div class="wrap fade adm">
    <button class="back" onclick="closeAdminPay()">${ic('left',18)} ${adminPay.from==='ficha'?escapeHtml(b.name):'Pagos'}</button>
    <h2 class="mt-12" style="margin-bottom:4px">Pagos</h2>
    <p class="muted">${escapeHtml(b.name)} · <span class="plan-pill ${b.plan==='premium'?'premium':'esencial'}">${planName(b.plan)}</span> · <span class="acc-pill ${st.cls}">${escapeHtml(st.label)}</span></p>

    ${lastPayment ? `<div class="card mt-16" style="border-color:var(--ok);background:#F2FBF6">
      <div class="card-title" style="color:var(--ok)">${ic('check',18)} Pago registrado · ${escapeHtml(lastPayment.folio)}</div>
      <p class="small">${money(lastPayment.amount)} · ${monthsText(lastPayment.months)} · cubre del ${fmtYmd(lastPayment.coversFrom)} al ${fmtYmd(lastPayment.coversTo)}</p>
      <div class="row mt-12" style="gap:8px"><button class="btn btn-secondary btn-sm" style="flex:1;min-width:0" onclick="openReceipt(${lastPayment.id})">${ic('printer',16)} Ver recibo</button><button class="btn btn-wa btn-sm" style="flex:1;min-width:0" onclick="receiptWhatsApp(${lastPayment.id})">${ic('send',16)} WhatsApp</button></div>
    </div>` : ''}

    <div class="card mt-16">
      <div class="card-title">${ic('coin',18)} Registrar pago</div>
      <div class="pkg-grid">${pk.map(x=>`<button class="pkg ${!pf.custom && pf.pkg===x.key?'on':''}" onclick="pickPackage('${x.key}')"><span>${x.label}</span><b>${money(x.amount)}</b><small>${x.sub}</small></button>`).join('')}</div>
      <button class="linkbtn small mt-8" onclick="toggleCustomPay()">${pf.custom?'Usar precio de la membresía':'Otro monto o periodo'}</button>
      ${pf.custom ? `<div class="row mt-8" style="gap:8px">
        <div style="flex:1;min-width:0"><label for="p-amount">Monto (MXN)</label><input id="p-amount" class="input" type="number" inputmode="numeric" min="1" value="${escapeHtml(pf.amount)}" oninput="payForm.amount=this.value"></div>
        <div style="flex:1;min-width:0"><label for="p-months">Meses que cubre</label><select id="p-months" class="input" onchange="payForm.months=Number(this.value);render()">${[1,2,3,4,5,6,9,12].map(n=>`<option value="${n}" ${Number(pf.months)===n?'selected':''}>${monthsText(n)}</option>`).join('')}</select></div>
      </div>` : ''}
      <div class="row mt-12" style="gap:8px">
        <div style="flex:1;min-width:0"><label for="p-method">Forma de pago</label><select id="p-method" class="input" onchange="payForm.method=this.value">${['Transferencia','Efectivo','Tarjeta','Depósito','Otro'].map(m=>`<option ${pf.method===m?'selected':''}>${m}</option>`).join('')}</select></div>
        <div style="flex:1;min-width:0"><label for="p-date">Fecha de pago</label><input id="p-date" class="input" style="width:100%;min-width:0" type="date" value="${escapeHtml(pf.paidAt)}" onchange="payForm.paidAt=this.value"></div>
      </div>
      <div class="field mt-12" style="margin-bottom:0"><label for="p-note">Referencia <span class="muted">(opcional)</span></label><input id="p-note" class="input" maxlength="200" value="${escapeHtml(pf.note)}" placeholder="Ej. SPEI 1234" oninput="payForm.note=this.value"></div>
      <p class="hint">Cubre del <b>${fmtYmd(cov.from)}</b> al <b>${fmtYmd(cov.to)}</b>.</p>
      <button class="btn btn-primary btn-block mt-12" ${busy?'disabled':''} onclick="registerPayment()">${busy?'Guardando…':'Registrar '+money(pf.amount)}</button>
    </div>

    <div class="card">
      <div class="card-title">${ic('inbox',18)} Historial ${pays&&pays.length?`<span class="muted small" style="margin-left:auto">Total ${money(total)}</span>`:''}</div>
      ${!pays ? '<p class="muted small">Cargando…</p>' : !pays.length ? '<p class="muted small">Aún no hay pagos registrados.</p>' : pays.map(p=>payRowHtml(p, b.slug, false)).join('')}
    </div>
  </div>`;
}
