/* Redeo · Negocio: pantallas de Ajustes, Equipo y seguridad, y datos legales. */
function dashboardConfig(){
  const f = configForm;
  const isSellos = cache.biz.mechanic==='sellos';
  const premium = isPremiumBiz();
  const styles = [['gradient','Degradado'],['solid','Liso'],['pattern','Con patrón']];
  return `
    ${membRowHtml()}
    <div class="cfg-design">
    <div class="preview-sticky">${passHtml(configPreviewBiz(), {name:'Cliente', phone:'', progress: Math.max(1, Math.round(goalOf(configPreviewBiz())*0.4))}, {})}</div>

    <div class="card mt-12">
      <div class="card-title">${ic('palette',18)} Diseño de tu tarjeta <span style="margin-left:auto" class="plan-pill ${premium?'premium':'esencial'}">${premium?'Premium':'Esencial'}</span></div>
      ${premium ? '' : `<div class="upsell">${ic('crown',22)}<div><b>Haz la tarjeta 100% tuya con Premium</b><p>Tu logo, el color exacto de tu marca, ícono de sellos, nombre y estilo de tarjeta, más productos favoritos y lo que compra cada cliente. Pídeselo a P.A.E.</p></div></div>`}

      <label>Color</label>
      <div class="swatches">
        ${COLOR_SWATCHES.map(c=>`<button class="swatch ${f.color===c?'on':''}" style="background:${c};color:${textOn(c)}" aria-label="Color ${c}" onclick="configForm.color='${c}';render()">${f.color===c?ic('check',16):''}</button>`).join('')}
      </div>
      <label class="mt-12" style="margin-top:14px">Color exacto de tu marca</label>
      ${premiumLock(`<div class="color-row"><input type="color" value="${escapeHtml(f.color)}" aria-label="Color exacto" oninput="configForm.color=this.value.toUpperCase();render()"><input class="input mono" style="max-width:150px" maxlength="7" value="${escapeHtml(f.color)}" aria-label="Código de color" onchange="setHexColor(this.value)"><span class="muted small">Cualquier color, con su código</span></div>`)}

      <div class="field mt-24"><label>Logo</label>
      ${premiumLock(`<div class="logo-row"><div class="logo-box">${cache.biz.logoUrl?`<img src="${escapeHtml(cache.biz.logoUrl)}" alt="Logo">`:ic('store',26)}</div>
        <div class="stack" style="flex:1;gap:8px">
          <label class="btn btn-secondary btn-sm" style="margin:0;cursor:pointer">${ic('upload',16)} ${cache.biz.logoUrl?'Cambiar logo':'Subir logo'}<input type="file" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="uploadLogo(this.files[0]);this.value=''"></label>
          ${cache.biz.logoUrl?`<button class="btn btn-ghost btn-sm" onclick="removeLogo()">Quitar logo</button>`:'<span class="muted small">PNG con fondo transparente se ve mejor.</span>'}
        </div></div>`)}
      </div>

      <div class="field"><label>Ícono de los sellos</label>
      ${premiumLock(`<div class="icon-grid">${Object.keys(STAMP_ICONS).map(id=>`<button class="icon-opt ${f.stampIcon===id?'on':''}" aria-label="${escapeHtml(STAMP_ICONS[id].label)}" title="${escapeHtml(STAMP_ICONS[id].label)}" onclick="configForm.stampIcon='${id}';render()">${stampSvg(id,24)}</button>`).join('')}</div>`)}
      </div>

      <div class="field"><label for="c-title">Nombre de la tarjeta</label>
      ${premiumLock(`<input id="c-title" class="input" type="text" maxlength="24" value="${escapeHtml(f.cardTitle||'')}" placeholder="Ej. Club ${escapeHtml(cache.biz.name.split(' ')[0])}" oninput="configForm.cardTitle=this.value;var t=document.querySelector('.preview-sticky .pass-kind');if(t)t.textContent=this.value||'Tarjeta de lealtad'">`)}
      </div>

      <div class="field"><label>Estilo</label>
      ${premiumLock(`<div class="style-grid">${styles.map(([id,label])=>{
        const bz = {...configPreviewBiz(), cardStyle:id};
        const on = textOn(bz.color);
        const bg = id==='solid' ? bz.color : (id==='pattern' ? `${patternUrl(f.stampIcon||'check', on)} 0 0/22px 22px, linear-gradient(150deg,${bz.color},${shade(bz.color,-28)})` : `linear-gradient(150deg,${bz.color},${shade(bz.color,-28)})`);
        return `<button class="style-opt ${ (f.cardStyle||'gradient')===id?'on':''}" onclick="configForm.cardStyle='${id}';render()"><div class="sw" style="background:${bg}"></div>${label}</button>`;
      }).join('')}</div>`)}
      </div>
    </div>

    ${isWalletBiz(cache.biz) ? `<div class="card">
      <div class="card-title">${ic('wallet',18)} Monedero</div>
      <div class="row" style="gap:8px">
        <div class="field" style="flex:1;min-width:0"><label for="c-wpct">% de cada compra</label><input id="c-wpct" class="input" type="number" min="1" max="30" value="${f.walletPct}" oninput="configForm.walletPct=this.value"></div>
        <div class="field" style="flex:1;min-width:0"><label for="c-wbon">Saldo de regalo</label><input id="c-wbon" class="input" type="number" min="1" value="${f.pointsPerVisit}" oninput="configForm.pointsPerVisit=this.value"></div>
      </div>
      <p class="hint" style="margin-top:-4px">Cada compra deja ese % como saldo para la siguiente. El saldo de regalo es lo que das en bienvenida, cumpleaños, por opinar o por invitar a una amiga. Si cambias el %, el saldo que ya tienen tus clientes no cambia.</p>
    </div>` : `<div class="card">
      <div class="card-title">${ic('gift',18)} Premio y meta</div>
      <div class="field"><label for="c-reward">Premio</label><input id="c-reward" class="input" type="text" value="${escapeHtml(f.rewardDesc)}" oninput="configForm.rewardDesc=this.value"></div>
      ${isSellos ? `
      <div class="field"><label for="c-goal">Sellos para el premio</label><input id="c-goal" class="input" type="number" min="2" max="30" value="${f.stampsGoal}" oninput="configForm.stampsGoal=this.value"></div>` : `
      <div class="field"><label for="c-pgoal">Puntos para el premio</label><input id="c-pgoal" class="input" type="number" min="1" value="${f.pointsGoal}" oninput="configForm.pointsGoal=this.value"></div>
      <div class="field"><label for="c-ppv">Puntos por visita</label><input id="c-ppv" class="input" type="number" min="1" value="${f.pointsPerVisit}" oninput="configForm.pointsPerVisit=this.value"></div>`}
    </div>`}

    ${rewardsEditorHtml()}

    <div class="card">
      <div class="card-title">${ic('heart',18)} Productos</div>
      ${premiumLock(`<p class="muted small">Tus clientes eligen sus favoritos al registrarse y el personal marca lo que compró en cada visita. Hasta 12.</p>
      ${(f.products||[]).length ? `<div class="chips mt-12">${f.products.map((p,i)=>`<span class="pick on">${escapeHtml(p)}<button type="button" class="rm linkbtn" style="text-decoration:none" aria-label="Quitar ${escapeHtml(p)}" onclick="configForm.products.splice(${i},1);render()">${ic('x',14)}</button></span>`).join('')}</div>` : ''}
      <div class="row mt-12"><input id="c-prod" class="input" type="text" maxlength="30" value="${escapeHtml(productDraft)}" placeholder="Ej. Kombucha de jengibre" oninput="productDraft=this.value" onkeydown="if(event.key==='Enter'){event.preventDefault();addProduct()}"><button class="btn btn-secondary" style="height:50px" onclick="addProduct()">${ic('plus',18)} Agregar</button></div>`, true)}
    </div>

    <button class="btn btn-primary btn-block mt-24" ${busy?'disabled':''} onclick="saveConfig()">${busy?'Guardando…':'Guardar cambios'}</button>
    </div>

    <div class="mt-24">${locationCardHtml()}</div>
    <div class="card">
      <div class="card-title">${ic('lock',18)} Acceso</div>
      <div class="kv"><span class="muted small">Código del negocio</span><button class="btn btn-secondary btn-sm" onclick="copyText('${jsEsc(cache.biz.slug)}')">${ic('copy',16)} <span class="mono">${escapeHtml(cache.biz.slug)}</span></button></div>
      <div class="kv"><span class="muted small">Liga para tus clientes</span><button class="btn btn-secondary btn-sm" onclick="copyText('${jsEsc(customerLink(cache.biz.slug))}','Liga copiada')">${ic('copy',16)} Copiar liga</button></div>
    </div>
    <div class="card">
      <div class="card-title">${ic('lock',18)} Seguridad</div>
      <p class="small" style="font-weight:700;color:var(--ink-2)">Cambiar tu PIN de dueño</p>
      <p class="muted small" style="margin:2px 0 10px">Al cambiarlo, todos los celulares que tenían tu sesión abierta se salen solos.</p>
      <div class="row" style="gap:8px">
        <input class="input code ph-plain" type="password" inputmode="numeric" maxlength="8" placeholder="PIN nuevo" aria-label="PIN nuevo" value="${escapeHtml(secForm.newPin)}" oninput="secForm.newPin=this.value.replace(/\\D/g,'').slice(0,8);this.value=secForm.newPin">
        <input class="input code ph-plain" type="password" inputmode="numeric" maxlength="8" placeholder="Repítelo" aria-label="Repite el PIN nuevo" value="${escapeHtml(secForm.newPin2)}" oninput="secForm.newPin2=this.value.replace(/\\D/g,'').slice(0,8);this.value=secForm.newPin2">
      </div>
      <button class="btn btn-secondary btn-block mt-12" ${busy?'disabled':''} onclick="changeOwnerPin()">Cambiar mi PIN</button>

      ${errorHtml(secError)}
    </div>
    <div class="card">
      <div class="card-title">${ic('download',18)} Tu base de clientes</div>
      <p class="muted small">Nombre, teléfono, correo, favoritos y si aceptan promociones. Se abre en Excel o Google Sheets. Envía promociones solo a quienes las aceptaron.</p>
      <button class="btn btn-secondary btn-block mt-12" ${busy?'disabled':''} onclick="downloadCustomers()">${ic('download',18)} Descargar clientes</button>
    </div>
    ${legalCardHtml()}
  `;
}

/* ---------- Equipo y seguridad ---------- */
function fmtAgo(iso){
  if(!iso) return 'Aún no entra';
  const d = new Date(iso), mins = Math.round((Date.now()-d.getTime())/60000);
  if(mins < 60) return 'Activo hace '+Math.max(1,mins)+' min';
  if(mins < 1440) return 'Activo hace '+Math.round(mins/60)+' h';
  return 'Última vez: '+d.toLocaleDateString('es-MX',{ day:'numeric', month:'short' });
}
function secAlertsHtml(){
  if(!secReport) return `<p class="muted small mt-12">Revisando…</p>`;
  if(!secReport.alerts.length) return `<div class="sec-alert ok">${ic('check',18)}<div><b>Todo en orden</b><p>No vemos nada raro en ${secDays===7?'los últimos 7 días':'los últimos 30 días'}.</p></div></div>`;
  return secReport.alerts.map(a=>`<div class="sec-alert ${a.level==='alta'?'alta':'media'}">${ic('info',18)}<div><b>${escapeHtml(a.title)}</b><p>${escapeHtml(a.text)}</p></div></div>`).join('');
}
function secTeamTableHtml(){
  if(!secReport) return '';
  const rows = secReport.team.filter(t => t.visits || t.redeems || t.blocked || t.type!=='staff' || cache.biz.hasStaffPin);
  if(!rows.length) return '';
  return `<div class="act-wrap"><table class="act-table">
    <tr><th>Persona</th><th>Sellos</th><th>Escaneados</th><th>A mano</th><th>Canjes</th><th>Bloqueos</th></tr>
    ${rows.map(t=>{ const warn = t.type!=='owner' && t.manual>=5 && t.manual/Math.max(1,t.visits)>=0.5;
      return `<tr><td>${escapeHtml(t.name)}${t.removed?' <span class="muted small">(ya no está)</span>':''}</td><td>${t.visits}</td><td>${t.scan+t.verified}</td><td class="${warn?'warn':''}">${t.manual}</td><td>${t.redeems}</td><td class="${t.blocked>=2&&t.type!=='owner'?'warn':''}">${t.blocked}</td></tr>`; }).join('')}
  </table></div>
  <p class="hint">"A mano" = sin escanear la tarjeta. "Bloqueos" = intentos que Redeo frenó (antes de tiempo o sin código). Los movimientos de antes de esta función no dicen quién los hizo.</p>`;
}
function teamMembersHtml(){
  if(!team) return `<p class="muted small">Cargando…</p>`;
  const list = team.members.map(m => teamEdit && teamEdit.id===m.id ? `
    <div class="team-row" style="display:block">
      <div class="field"><label>Nombre</label><input class="input" maxlength="40" value="${escapeHtml(teamEdit.name)}" oninput="teamEdit.name=this.value"></div>
      <div class="field"><label>PIN nuevo <span class="muted">(déjalo vacío para no cambiarlo)</span></label><input class="input code ph-plain" type="password" inputmode="numeric" maxlength="8" value="${escapeHtml(teamEdit.pin)}" oninput="teamEdit.pin=this.value.replace(/\\D/g,'').slice(0,8);this.value=teamEdit.pin"></div>
      <div class="row" style="gap:8px"><button class="btn btn-primary btn-sm" style="flex:1" ${busy?'disabled':''} onclick="saveMemberEdit()">Guardar</button><button class="btn btn-ghost btn-sm" onclick="teamEdit=null;teamError='';render()">Cancelar</button></div>
    </div>` : `
    <div class="team-row">
      <div class="avatar sm" style="background:${m.active?'var(--brand-soft)':'#EEE'};color:${m.active?'var(--brand-deep)':'var(--muted)'}">${escapeHtml(initialOf(m.name))}</div>
      <div style="flex:1;min-width:120px"><div style="font-weight:800;color:var(--ink)">${escapeHtml(m.name)} ${m.active?'':'<span class="status-dot">En pausa</span>'}</div><div class="muted small">${escapeHtml(fmtAgo(m.lastSeenAt))}</div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="startMemberEdit(${m.id})">Editar</button>
        <button class="btn btn-ghost btn-sm" ${busy?'disabled':''} onclick="toggleMember(${m.id}, ${m.active?'false':'true'})">${m.active?'Pausar':'Activar'}</button>
        <button class="btn btn-ghost btn-sm" ${busy?'disabled':''} onclick="removeMember(${m.id})">Quitar</button>
      </div>
    </div>`).join('');
  return `${list || `<p class="muted small">Aún no das de alta a nadie.</p>`}
    <div class="card mt-12" style="box-shadow:none;background:var(--surface-2)">
      <p class="small" style="font-weight:800;color:var(--ink)">Agregar a alguien</p>
      <div class="row mt-8" style="gap:8px;flex-wrap:wrap">
        <input class="input" style="flex:2;min-width:140px" maxlength="40" placeholder="Nombre (ej. Pedro)" aria-label="Nombre" value="${escapeHtml(teamForm.name)}" oninput="teamForm.name=this.value">
        <input class="input code ph-plain" style="flex:1;min-width:110px" type="password" inputmode="numeric" maxlength="8" placeholder="Su PIN" aria-label="Su PIN" value="${escapeHtml(teamForm.pin)}" oninput="teamForm.pin=this.value.replace(/\\D/g,'').slice(0,8);this.value=teamForm.pin">
      </div>
      <button class="btn btn-primary btn-block mt-12" ${busy?'disabled':''} onclick="addMember()">${ic('plus')} Agregar a mi equipo</button>
      <p class="hint">Cada quien entra con el código del negocio (<b>${escapeHtml(cache.biz.slug)}</b>) y su propio PIN. Puede escanear, dar sellos, canjear premios y aprobar solicitudes; no ve correos, no descarga tu base ni cambia tus ajustes.</p>
    </div>
    ${errorHtml(teamError)}`;
}
function generalPinHtml(){
  const has = cache.biz.hasStaffPin, members = team ? team.members.filter(m=>m.active).length : 0;
  return `<details class="how" ${has?'open':''}>
    <summary>${ic('lock',16)} PIN general del personal <span class="status-dot ${has?'on':''}">${has?'Activo':'Apagado'}</span>${ic('right',16).replace('<svg','<svg class="chev"')}</summary>
    <div class="how-body">
      <p style="margin-top:0">Es un solo PIN para todos. Funciona, pero <b>no dice quién dio cada sello</b>.${has && members ? ' Como ya diste PIN a tu equipo, te recomendamos quitarlo.' : ''}</p>
      <input class="input code ph-plain mt-8" type="password" inputmode="numeric" maxlength="8" placeholder="${has?'Nuevo PIN general':'PIN general'}" aria-label="PIN general del personal" value="${escapeHtml(secForm.staffPin)}" oninput="secForm.staffPin=this.value.replace(/\\D/g,'').slice(0,8);this.value=secForm.staffPin">
      <div class="row mt-12" style="gap:8px">
        <button class="btn btn-secondary btn-sm" style="flex:1" ${busy?'disabled':''} onclick="saveStaffPin(false)">${has?'Cambiar PIN general':'Crear PIN general'}</button>
        ${has?`<button class="btn btn-ghost btn-sm" ${busy?'disabled':''} onclick="saveStaffPin(true)">Quitar</button>`:''}
      </div>
      ${errorHtml(secError)}
    </div>
  </details>`;
}
function strictHowHtml(){
  return `
  <details class="how">
    <summary>${ic('info',16)} ¿Cómo funciona?${ic('right',16).replace('<svg','<svg class="chev"')}</summary>
    <div class="how-body">
      <p style="margin-top:0"><b>La idea:</b> la tarjeta de cada cliente muestra un código que cambia cada 30 segundos y sirve una sola vez. Para dar un sello o canjear un premio, tu equipo necesita ese código. Así nadie puede dar sellos con una foto guardada o sin que el cliente esté ahí con su celular.</p>
      <p><b>Tu equipo, en caja:</b></p>
      <ol>
        <li>Pide al cliente que abra su tarjeta Redeo en su celular (su liga o la página; no una captura).</li>
        <li>Toca <b>Escanear</b> y apunta a su código.</li>
        <li>Si la cámara no lo lee, busca al cliente, toca <b>Dar sello</b> y escribe los 6 números que aparecen abajo de su código.</li>
        <li>Si sale "ya se usó" o "ya no es válido", pide el código nuevo (cambia cada 30 segundos).</li>
      </ol>
      <p><b>Tus clientes:</b></p>
      <ul>
        <li>Tienen que abrir su tarjeta en su celular al pagar. Las capturas de pantalla ya no sirven para sellar.</li>
        <li>La tarjeta de Apple o Google Wallet sigue mostrando sus sellos, pero no sirve para sellar: para eso abren su liga.</li>
        <li>Si cambian de celular, la abren con su teléfono y su cumpleaños, como siempre.</li>
      </ul>
      <p><b>Tú (dueño):</b></p>
      <ul>
        <li>Puedes dar sellos sin código (por ejemplo, si al cliente se le acabó la pila). Queda anotado como "a mano".</li>
        <li>Tu equipo ya no puede mandar la liga de la tarjeta por WhatsApp; solo tú.</li>
      </ul>
      <p><b>Lo que no evita:</b> que un amigo del empleado venga en persona sin comprar. Para eso revisa las alertas y el historial.</p>
    </div>
  </details>
  <details class="how">
    <summary>${ic('bulb',16)} ¿Me conviene encenderlo?${ic('right',16).replace('<svg','<svg class="chev"')}</summary>
    <div class="how-body">
      <p style="margin-top:0"><b>Sí conviene si:</b></p>
      <ul><li>Tu premio es caro (por ejemplo, un servicio de $300 o más).</li><li>Tienes varios empleados y casi no estás en el negocio.</li><li>Las alertas te muestran cosas raras seguido.</li></ul>
      <p><b>Mejor no, si:</b></p>
      <ul><li>Tu premio es barato (un café, un pan): cada sello vale pocos pesos y la fila es más importante.</li><li>Muchos de tus clientes son mayores o usan capturas de pantalla.</li><li>Tú mismo atiendes la caja casi siempre.</li></ul>
      <p>Para la mayoría basta con dar un PIN a cada persona y el tiempo mínimo entre sellos. Puedes encenderlo y apagarlo cuando quieras.</p>
    </div>
  </details>`;
}
function dashboardEquipo(){
  const t = team;
  const cd = t ? t.stampCooldownMin : (cache.biz.stampCooldownMin || 120);
  const cdOn = t ? t.stampCooldownOn : !!cache.biz.stampCooldownOn;
  const strict = t ? t.strictMode : !!cache.biz.strictMode;
  return `
    <button class="back mt-16" onclick="openMas()">${ic('left',18)} Más</button>
    <h2 class="mt-12">Equipo y seguridad</h2>
    <p class="lead">Sabe quién dio cada sello y evita trampas, sin hacerle más difícil la vida a tus clientes.</p>

    <div class="card mt-16">
      <div class="card-title">${ic('info',18)} Lo que hay que revisar</div>
      <div class="seg" style="margin-bottom:4px"><button class="${secDays===7?'on':''}" onclick="setSecDays(7)">7 días</button><button class="${secDays===30?'on':''}" onclick="setSecDays(30)">30 días</button></div>
      ${secAlertsHtml()}
      <p class="small mt-16" style="font-weight:800;color:var(--ink)">Quién dio los sellos</p>
      ${secTeamTableHtml()}
    </div>

    <div class="card">
      <div class="card-title">${ic('users',18)} Tu equipo</div>
      <p class="muted small" style="margin:-4px 0 6px">Un PIN para cada persona: así cada sello dice quién lo dio. Si alguien deja de trabajar contigo, quítalo y su PIN deja de funcionar.</p>
      ${teamMembersHtml()}
      <div class="mt-12">${generalPinHtml()}</div>
    </div>

    <div class="card">
      <div class="card-title">${ic('clock',18)} Tiempo mínimo entre sellos <span class="status-dot ${cdOn?'on':''}">${cdOn?'Activado':'Desactivado'}</span></div>
      <div class="row" style="gap:12px;align-items:flex-start">
        <p class="muted small" style="flex:1;margin:0">Evita que le den varios sellos seguidos al mismo cliente. Tu equipo no puede saltárselo; tú sí, confirmándolo.</p>
        <button class="switch ${cdOn?'on':''}" role="switch" aria-checked="${cdOn}" aria-label="Tiempo mínimo entre sellos" ${busy||!t?'disabled':''} onclick="toggleCooldown()"><span></span></button>
      </div>
      ${cdOn ? `<label class="small mt-12" style="display:block;font-weight:700;color:var(--ink-2)" for="cd-min">Máximo un sello por cliente cada:</label>
      <select id="cd-min" class="input mt-8" aria-label="Cada cuánto tiempo" ${busy?'disabled':''} onchange="saveSecurity({ stampCooldownMin:Number(this.value) }, 'Listo: máximo '+cooldownText(Number(this.value))+'.')">
        ${[30,60,120,240,720,1440].map(v=>`<option value="${v}" ${cd===v?'selected':''}>${COOLDOWN_LABELS[v]}</option>`).join('')}
      </select>
      <p class="hint">Si tus clientes suelen venir dos veces el mismo día (por ejemplo, café en la mañana y en la tarde), elige 2 o 4 horas.</p>`
      : `<p class="hint">Recomendado si tienes empleados: actívalo y elige cada cuánto (sugerimos 2 horas).</p>`}
    </div>

    <div class="card">
      <div class="card-title">${ic('scan',18)} Modo estricto ${isPremiumBiz() ? `<span class="status-dot ${strict?'on':''}">${strict?'Encendido':'Apagado'}</span>` : `<span class="lock-badge" style="position:static;margin-left:6px">${ic('lock',12)} Premium</span>`}</div>
      <div class="row" style="gap:12px;align-items:flex-start">
        <p class="muted small" style="flex:1;margin:0">La tarjeta del cliente muestra un código que cambia cada 30 segundos y sirve una sola vez. Tu equipo solo puede dar sellos y canjear premios con ese código.</p>
        ${isPremiumBiz() ? `<button class="switch ${strict?'on':''}" role="switch" aria-checked="${strict}" aria-label="Modo estricto" ${busy||!t?'disabled':''} onclick="toggleStrict()"><span></span></button>` : ''}
      </div>
      ${isPremiumBiz() ? '' : `<div class="lock-note mt-12">${ic('lock',16)} Disponible en el plan Premium. Pídeselo a P.A.E.</div>`}
      ${strictHowHtml()}
      ${isPremiumBiz() ? `<button class="btn btn-secondary btn-block mt-12" onclick="copyText(staffInstructions(),'Instrucciones copiadas. Pégalas en el WhatsApp de tu equipo.')">${ic('copy',18)} Copiar instrucciones</button>
      <p class="hint" style="text-align:center">Para pegarlas en el WhatsApp de tu equipo.</p>` : ''}
    </div>`;
}

/* ---------- Ajustes: datos legales del negocio y documentos ---------- */
let legalForm = null;
let legalError = '';
function legalCardHtml(){
  const b = cache.biz, g = b.legal || {};
  if(!legalForm) legalForm = { legalName:g.name||'', legalAddress:g.address||'', privacyEmail:g.email||'' };
  const f = legalForm;
  return `<div class="card" id="legal-card">
    <div class="card-title">${ic('info',18)} Privacidad y documentos legales</div>
    ${bizLegalMissing(b) ? `<div class="legal-warn">${ic('info',16)}<span>Tu aviso de privacidad tiene datos por completar. Llénalos para que tus clientes vean quién cuida sus datos.</span></div>` : ''}
    <p class="muted small" style="margin-bottom:12px">Estos datos aparecen en el Aviso de privacidad y en los Términos del programa que ven tus clientes al pedir su tarjeta.</p>
    <div class="field"><label for="lg-name">Nombre o razón social</label><input id="lg-name" class="input" maxlength="120" value="${escapeHtml(f.legalName)}" oninput="legalForm.legalName=this.value" placeholder="Ej. Laura Pérez Gómez o Café Luna S.A. de C.V."><p class="hint">Si no tienes empresa, es tu nombre completo como dueño(a).</p></div>
    <div class="field"><label for="lg-addr">Domicilio del negocio</label><input id="lg-addr" class="input" maxlength="200" value="${escapeHtml(f.legalAddress)}" oninput="legalForm.legalAddress=this.value" placeholder="Calle, número, colonia, ciudad, estado y C.P."></div>
    <div class="field"><label for="lg-email">Correo para temas de privacidad</label><input id="lg-email" class="input" type="email" autocapitalize="none" maxlength="120" value="${escapeHtml(f.privacyEmail)}" oninput="legalForm.privacyEmail=this.value" placeholder="contacto@tunegocio.com"><p class="hint">Tus clientes pueden escribir aquí para pedir ver, corregir o borrar sus datos. También pueden pedirlo en tu local.</p></div>
    ${errorHtml(legalError)}
    <button class="btn btn-secondary btn-block" ${busy?'disabled':''} onclick="saveLegal()">Guardar datos legales</button>
    <div class="doc-links">
      <button class="doc-link" onclick="openLegal('privacidad', cache.biz)">${ic('lock',18)}<span>Aviso de privacidad para tus clientes<small>Se genera con tus datos</small></span>${ic('right',16)}</button>
      <button class="doc-link" onclick="openLegal('programa', cache.biz)">${ic('gift',18)}<span>Términos de tu programa de lealtad<small>Con tu premio y tu meta</small></span>${ic('right',16)}</button>
      <button class="doc-link" onclick="openLegal('terminos',false)">${ic('info',18)}<span>Términos del servicio Redeo<small>${b.termsAcceptedAt ? 'Aceptados el '+escapeHtml(fmtDate(b.termsAcceptedAt))+(b.termsAcceptedBy?' por '+escapeHtml(b.termsAcceptedBy):'') : 'Contrato entre tu negocio y P.A.E.'}</small></span>${ic('right',16)}</button>
      <button class="doc-link" onclick="openLegal('privacidad-pae',false)">${ic('user',18)}<span>Aviso de privacidad de P.A.E.<small>Cómo usamos tus datos como cliente de Redeo</small></span>${ic('right',16)}</button>
    </div>
    <p class="hint">Son modelos generados por Redeo. Revísalos y, si tienes dudas, consúltalos con tu abogado. Si registras clientes en persona, muéstrales el cartel con QR o envíales la liga para que conozcan el aviso.</p>
  </div>`;
}
async function saveLegal(){
  legalError = '';
  const f = legalForm;
  if(f.privacyEmail.trim() && !isEmail(f.privacyEmail)){ legalError = 'Ese correo no parece válido.'; render(); return; }
  busy = true; render();
  const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/legal', { legalName:f.legalName, legalAddress:f.legalAddress, privacyEmail:f.privacyEmail.trim() }, session.pin);
  busy = false;
  if(!r.ok){ if(handleAuthError(r)) return; legalError = errMsg(r,'No se pudo guardar.'); render(); return; }
  cache.biz = { ...cache.biz, legal:r.data.legal };
  legalForm = null;
  showToast('Datos legales guardados.');
}
