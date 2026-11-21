/* Redeo · Negocio: pantallas para entrar, crear negocio, éxito y panel en pausa. */
function viewNegocioAuth(){
  const d = savedDemo();
  return `
  <div class="wrap fade lp lp-narrow">
    ${backHtml('goHome()')}
    <h2 class="lp-h2 mt-12" style="font-size:2.2rem">Tu negocio en <em>Redeo</em>.</h2>
    <p class="rd-mini">Redeo significa <b>“yo vuelvo”</b> en latín. Es lo que piensa un cliente contento cuando sale de tu negocio. Nosotros te ayudamos a que se cumpla.</p>
    <p class="lead">Empieza hoy con 14 días gratis, o te contactamos nosotros.</p>
    <div class="lp-doors">
      ${d ? `<button class="lp-door biz" ${busy?'disabled':''} onclick="continueDemo()"><span class="ico">${ic('bolt',22)}</span><span class="txt"><b>Seguir con mi demo</b><small>${escapeHtml(d.name)}</small></span><span class="go">${ic('right',18)}</span></button>` :
      `<button class="lp-door biz" onclick="openLeadForm('prueba')"><span class="ico">${ic('bolt',22)}</span><span class="txt"><b>Empieza tu prueba gratis</b><small>14 días con todo incluido, lista en un minuto</small></span><span class="go">${ic('right',18)}</span></button>`}
      <button class="lp-door cli" onclick="openLeadForm('contacto')"><span class="ico">${ic('phone',22)}</span><span class="txt"><b>Prefiero que me contacten</b><small>Te escribimos por WhatsApp</small></span><span class="go">${ic('right',18)}</span></button>
      <button class="lp-door cli" onclick="loginError='';view='negocioEntrar';render()"><span class="ico">${ic('lock',22)}</span><span class="txt"><b>Ya tengo cuenta</b><small>Entra con tu código y PIN</small></span><span class="go">${ic('right',18)}</span></button>
    </div>
    ${trustLineHtml()}
    ${d ? `<button class="linkbtn small mt-16" onclick="store.del('vuelve_demo');openLeadForm('prueba')">Mejor empezar mi prueba gratis</button>` : ''}
    ${legalFootHtml(null)}
  </div>`;
}

function previewPassHtml(){
  const f = createForm;
  const biz = { slug:'vista-previa', name:(f.name||'').trim()||'Tu negocio', mechanic:f.mechanic, walletPct:Number(f.walletPct)||5,
    stampsGoal:Number(f.stampsGoal)||10, pointsGoal:Number(f.pointsGoal)||100, pointsPerVisit:Number(f.pointsPerVisit)||10,
    rewardDesc:(f.rewardDesc||'').trim()||'Tu premio', color:f.color };
  const g = Math.max(1, goalOf(biz));
  return passHtml(biz, {name:'Cliente', phone:'', progress:Math.max(1, Math.round(g*0.4))}, {});
}
function updatePreview(){
  const el = document.getElementById('preview');
  if(el) el.innerHTML = previewPassHtml();
}

function viewNegocioCrear(){
  const f = createForm;
  const isSellos = f.mechanic==='sellos', isWal = f.mechanic==='monedero';
  return `
  <div class="wrap fade">
    ${backHtml(adminData ? "view='adminPae';render()" : "view='negocioAuth';render()")}
    <h2 class="mt-12">Diseña tu tarjeta</h2>
    <p class="lead">Así la verán tus clientes. Se actualiza mientras escribes.</p>
    <div id="preview" class="mt-24">${previewPassHtml()}</div>

    <div class="card mt-24">
      <div class="card-title">${ic('store',18)} Tu negocio</div>
      <div class="field">
        <label for="f-name">Nombre</label>
        <input id="f-name" class="input" type="text" value="${escapeHtml(f.name)}" placeholder="Café Luna" oninput="createForm.name=this.value;updatePreview()">
      </div>
    </div>

    <div class="card">
      <div class="card-title">${ic('gift',18)} Cómo premias</div>
      <div class="seg seg3">
        <button class="${isSellos?'on':''}" onclick="createForm.mechanic='sellos';render()">${ic('stamp',18)} Sellos</button>
        <button class="${f.mechanic==='puntos'?'on':''}" onclick="createForm.mechanic='puntos';render()">${ic('coin',18)} Puntos</button>
        <button class="${isWal?'on':''}" onclick="createForm.mechanic='monedero';render()">${ic('wallet',18)} Monedero</button>
      </div>
      <p class="hint" style="margin-top:8px">${isSellos?'Ideal si te visitan seguido (café, comida, barbería).':isWal?'Ideal para compras de ticket alto (ropa, zapatos, ópticas): cada compra deja un % de saldo para la siguiente. Solo cuesta si la clienta regresa.':'Puntos por visita hasta llegar al premio.'}</p>
      ${isWal ? `
      <div class="row mt-16" style="gap:8px">
        <div class="field" style="flex:1;min-width:0"><label for="f-wpct">% de cada compra</label><input id="f-wpct" class="input" type="number" min="1" max="30" value="${f.walletPct}" oninput="createForm.walletPct=this.value;updatePreview()"></div>
        <div class="field" style="flex:1;min-width:0"><label for="f-wbon">Saldo de regalo</label><input id="f-wbon" class="input" type="number" min="1" value="${f.walletBonus}" oninput="createForm.walletBonus=this.value"></div>
      </div>
      <p class="hint" style="margin-top:-6px">Con 5%, una compra de $1,000 deja $50 para la próxima. El saldo de regalo es lo que das en bienvenida, cumpleaños, opinión o por invitar a una amiga.</p>` : isSellos ? `
      <div class="field mt-16">
        <label for="f-goal">Sellos para ganar el premio</label>
        <input id="f-goal" class="input" type="number" min="2" max="30" value="${f.stampsGoal}" oninput="createForm.stampsGoal=this.value;updatePreview()">
      </div>` : `
      <div class="field mt-16">
        <label for="f-pgoal">Puntos para el premio</label>
        <input id="f-pgoal" class="input" type="number" min="1" value="${f.pointsGoal}" oninput="createForm.pointsGoal=this.value;updatePreview()">
      </div>
      <div class="field">
        <label for="f-ppv">Puntos por visita</label>
        <input id="f-ppv" class="input" type="number" min="1" value="${f.pointsPerVisit}" oninput="createForm.pointsPerVisit=this.value">
      </div>`}
      ${isWal ? '' : `<div class="field">
        <label for="f-reward">Premio</label>
        <input id="f-reward" class="input" type="text" value="${escapeHtml(f.rewardDesc)}" placeholder="Un café gratis" oninput="createForm.rewardDesc=this.value;updatePreview()">
      </div>`}
    </div>

    <div class="card">
      <div class="card-title">${ic('palette',18)} Color de marca</div>
      <div class="swatches">
        ${COLOR_SWATCHES.map(c=>`<button class="swatch ${f.color===c?'on':''}" style="background:${c};color:${textOn(c)}" aria-label="Color ${c}" onclick="createForm.color='${c}';render()">${f.color===c?ic('check',16):''}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title">${ic('crown',18)} Plan</div>
      <div class="seg">
        <button class="${createForm.plan!=='premium'?'on':''}" onclick="createForm.plan='esencial';render()">Esencial</button>
        <button class="${createForm.plan==='premium'?'on':''}" onclick="createForm.plan='premium';render()">${ic('crown',16)} Premium</button>
      </div>
      <p class="hint">${createForm.plan==='premium'?'Incluye logo, color exacto, ícono de sello, nombre de tarjeta, estilos y productos. Se diseñan en Ajustes.':'Plantilla Redeo con 7 colores. Se puede subir a Premium cuando quieras.'}</p>
      <label class="mt-16">Periodo</label>
      <div class="seg">
        <button class="${Number(createForm.trialDays)?'on':''}" onclick="createForm.trialDays=14;render()">${ic('clock',16)} Prueba 14 días</button>
        <button class="${!Number(createForm.trialDays)?'on':''}" onclick="createForm.trialDays=0;render()">Sin fecha límite</button>
      </div>
      <p class="hint">${Number(createForm.trialDays)?'Al terminar la prueba, el panel se pausa hasta que registres su pago en Administración P.A.E. No se borra nada.':'El negocio no tendrá fecha de vencimiento.'}</p>
    </div>
    <div class="card">
      <div class="card-title">${ic('lock',18)} Acceso a tu panel</div>
      <div class="field">
        <label for="f-pin">PIN del dueño (4 a 8 dígitos)</label>
        <input id="f-pin" class="input code" type="password" inputmode="numeric" maxlength="8" value="${escapeHtml(f.pin)}" placeholder="••••••" oninput="createForm.pin=this.value.replace(/\\D/g,'').slice(0,8);this.value=createForm.pin">
        <p class="hint">Recomendado: 6 dígitos. Después puedes crear otro PIN solo para tu personal.</p>
      </div>
      ${serverConfig.adminRequired ? `
      <div class="row" style="gap:8px">
        <div class="field" style="flex:1;min-width:0"><label for="f-oname">Nombre del dueño</label><input id="f-oname" class="input" value="${escapeHtml(f.ownerName||'')}" oninput="createForm.ownerName=this.value" placeholder="Para P.A.E."></div>
        <div class="field" style="flex:1 1 100%;min-width:0"><label for="f-ophone">Número de WhatsApp del dueño</label>${telField('f-ophone', normalizePhone(f.ownerPhone||''), 'createForm.ownerPhone')}</div>
      </div>
      <div class="field">
        <label for="f-admin">Clave de administrador P.A.E.</label>
        <input id="f-admin" class="input" type="password" autocomplete="off" value="${escapeHtml(f.adminKey)}" placeholder="Solo P.A.E. puede dar de alta negocios" oninput="createForm.adminKey=this.value">
      </div>` : ''}
    </div>

    ${errorHtml(createError)}
    <button class="btn btn-primary btn-block mt-24" ${busy?'disabled':''} onclick="submitCrearNegocio()">${busy?'Creando…':ic('check')+' Crear mi tarjeta'}</button>
  </div>`;
}

function viewNegocioExito(){
  const biz = cache.biz;
  return `
  <div class="wrap fade">
    <div class="success-ico">${ic('check',30)}</div>
    <h2>Tu tarjeta está lista</h2>
    <p class="lead">Comparte tu código con tus clientes para que vean su tarjeta.</p>
    <div class="mt-24">${passHtml(biz, null, {})}</div>
    <div class="card mt-24">
      <div class="kv"><span class="muted small">Código del negocio</span><button class="btn btn-secondary btn-sm" onclick="copyText('${jsEsc(biz.slug)}')">${ic('copy',16)} <span class="mono">${escapeHtml(biz.slug)}</span></button></div>
      <div class="kv"><span class="muted small">PIN de acceso</span><span class="mono">${escapeHtml(biz.pin)}</span></div>
      <div class="kv"><span class="muted small">Liga para tus clientes</span><button class="btn btn-secondary btn-sm" onclick="copyText('${jsEsc(customerLink(biz.slug))}','Liga copiada')">${ic('copy',16)} Copiar liga</button></div>
    </div>
    <p class="hint">Guarda tu PIN en un lugar seguro. La liga es la que va en el QR de tu mostrador.${biz.access && biz.access.type==='trial' ? ' Prueba gratis hasta el '+fmtYmd(biz.access.until)+'.' : ''}</p>
    <button class="btn btn-primary btn-block mt-24" onclick="dashboardTab='resumen';view='dashboard';render()">Ir a mi panel ${ic('right')}</button>
  </div>`;
}

function viewNegocioEntrar(){
  return `
  <div class="wrap fade">
    ${backHtml("view='negocioAuth';render()")}
    <h2 class="mt-12">Entra a tu panel</h2>
    <p class="lead">Con tu WhatsApp o el código de tu negocio, y tu PIN.</p>
    <div class="card mt-24">
      <div class="field">
        <label for="l-slug">Tu WhatsApp o el código del negocio</label>
        <div class="input-icon">${ic('store',18)}<input id="l-slug" class="input" type="text" autocapitalize="none" autocomplete="username" value="${escapeHtml(loginForm.slug)}" placeholder="2221234567 o cafe-luna" oninput="loginForm.slug=this.value"></div>
      </div>
      <div class="field">
        <label for="l-pin">PIN</label>
        <input id="l-pin" class="input code" type="password" inputmode="numeric" maxlength="8" value="${escapeHtml(loginForm.pin)}" placeholder="••••" oninput="loginForm.pin=this.value.replace(/\\D/g,'').slice(0,8);this.value=loginForm.pin" onkeydown="if(event.key==='Enter')submitLogin()">
      </div>
      ${errorHtml(loginError)}
    </div>
    <button class="btn btn-primary btn-block mt-24" ${busy?'disabled':''} onclick="submitLogin()">${busy?'Entrando…':'Entrar'}</button>
    ${forgotPinHtml()}
  </div>`;
}

// ¿Olvidaste tu PIN? Queda como aviso para P.A.E., que te manda uno nuevo por WhatsApp.
let forgotPin = null;   // { phone, sent }
function forgotPinHtml(){
  if(!forgotPin) return `<button class="linkbtn small mt-16" style="display:block;margin-left:auto;margin-right:auto" onclick="forgotPin={phone:'',sent:false};render()">¿Olvidaste tu PIN o tu código?</button>`;
  if(forgotPin.sent) return `<div class="card mt-16" style="text-align:center"><div class="success-ico" style="margin:4px auto 10px;width:48px;height:48px">${ic('check',24)}</div><b>Listo</b><p class="small muted" style="margin:6px 0 0">Si ese número tiene una cuenta, P.A.E. te escribe por WhatsApp para darte un PIN nuevo.</p></div>`;
  return `<div class="card mt-16">
    <b>¿Olvidaste tu PIN o tu código?</b>
    <p class="small muted" style="margin:4px 0 12px">Escribe el WhatsApp con el que registraste tu negocio. P.A.E. te escribe para darte un PIN nuevo.</p>
    <div class="field" style="margin-bottom:0"><label for="fp-wa">Tu WhatsApp</label>${telField('fp-wa', normalizePhone(forgotPin.phone), 'forgotPin.phone')}</div>
    <div class="row mt-12" style="gap:8px"><button class="btn btn-primary" style="flex:1" ${busy?'disabled':''} onclick="sendForgotPin()">${busy?'Enviando…':'Pedir PIN nuevo'}</button><button class="btn btn-ghost" onclick="forgotPin=null;render()">Cancelar</button></div>
  </div>`;
}
async function sendForgotPin(){
  const phone = normalizePhone(forgotPin && forgotPin.phone);
  if(!isValidPhone(phone)){ showToast(phoneMsg('fp-wa','tu número de WhatsApp')); return; }
  busy=true; render();
  const r = await api('POST','/api/forgot-pin', { phone });
  busy=false;
  if(!r.ok){ showToast(errMsg(r,'No se pudo enviar. Intenta de nuevo.'), 5000); render(); return; }
  forgotPin.sent = true; render();
}

function accessBannerHtml(){
  const a = cache.biz.access;
  if(!a || a.type==='none' || a.expired || !isOwner()) return '';
  if(a.type==='trial'){
    if(a.daysLeft>3) return '';
    return `<div class="access-banner ${a.daysLeft<=5?'warn':''}">${ic('clock',18)}<span><b>Prueba gratis:</b> ${a.daysLeft===1?'hoy es tu último día':'te quedan '+a.daysLeft+' días'} (hasta el ${fmtYmd(a.until)}).</span>${a.daysLeft<=10?`<button class="ab-go" onclick="openMembresia()">Pagar</button>`:''}</div>`;
  }
  if(a.daysLeft<=7){
    return `<div class="access-banner warn">${ic('clock',18)}<span><b>Tu servicio vence ${a.daysLeft===1?'hoy':'en '+a.daysLeft+' días'}</b> (${fmtYmd(a.until)}). Renueva para no pausar tu panel.</span><button class="ab-go" onclick="openMembresia()">Renovar</button></div>`;
  }
  return '';
}

function viewPausado(){
  const biz = cache.biz, a = biz.access, w = biz.waiting || {};
  return `
  <div class="wrap fade">
    <div class="topbar" style="margin-bottom:0">
      <div class="biz-head"><div class="avatar" style="background:${biz.color};color:${textOn(biz.color)}">${escapeHtml(initialOf(biz.name))}</div>
        <div><div class="biz-name">${escapeHtml(biz.name)}</div><span class="code-chip">${escapeHtml(biz.slug)}</span></div></div>
      <button class="icon-btn" aria-label="Cerrar sesión" onclick="cerrarSesion()">${ic('logout',18)}</button>
    </div>
    <div class="card mt-24" style="text-align:center;padding:28px 22px">
      <div class="success-ico" style="margin:0 auto 16px;background:#FFF1CF;color:#8A5B00">${ic('lock',30)}</div>
      <h2 style="margin-bottom:8px">${a.type==='paid'?'Tu servicio está en pausa':'Tu prueba gratis terminó'}</h2>
      <p class="lead" style="margin:0 auto">${a.type==='paid'?'Tu periodo terminó el '+fmtYmd(a.until)+'.':'Tu prueba terminó el '+fmtYmd(a.until)+'.'} ${isOwner()?'Paga tu membresía para seguir usando Redeo.':'Pídele al dueño que renueve el servicio.'}</p>
    </div>
    <div class="stats mt-12" style="grid-template-columns:1fr 1fr">
      <div class="stat"><div class="stat-ico" style="background:var(--brand-soft);color:var(--brand)">${ic('users',17)}</div><div class="stat-num">${w.customers||0}</div><div class="stat-label">Clientes guardados</div></div>
      <div class="stat"><div class="stat-ico" style="background:#FFF1CF;color:#8A5B00">${ic('inbox',17)}</div><div class="stat-num">${w.pending||0}</div><div class="stat-label">Solicitudes esperando</div></div>
    </div>
    <div class="private-note mt-12">${ic('check',16)}<span>No se borró nada: tus clientes, sus sellos y sus solicitudes siguen guardados. Tus clientes pueden seguir viendo su tarjeta. En cuanto se active tu servicio, todo sigue donde lo dejaste.</span></div>
    ${isOwner() ? `<button class="btn btn-primary btn-block mt-16" onclick="openMembresia()">${ic('wallet',18)} Pagar mi membresía</button>
    <button class="btn btn-secondary btn-block mt-8" onclick="downloadCustomers()">${ic('download',18)} Descargar mis clientes</button>` : ''}
    <button class="btn btn-ghost btn-block mt-8" onclick="retryAccess()">${ic('refresh',18)} Ya me confirmaron, revisar de nuevo</button>
  </div>`;
}
async function retryAccess(){
  busy=true; render();
  const r = await loadDashboard(session.slug, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo revisar.')); return; }
  if(!isExpired()) showToast('¡Listo! Tu servicio está activo.');
  render();
}
