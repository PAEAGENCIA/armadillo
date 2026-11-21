/* Redeo · Negocio, Premium: Crecer (promociones, Te extrañamos, cumpleaños y reporte del mes). */
/* =================== Crecer (Premium): promociones, te extrañamos, cumpleaños y reporte =================== */
let crecerSub = 'promos';
let growth = { promos:null, inactive:null, inactiveDays:30, birthdays:null, report:null, month:null };
let promoForm = null;
let contacted = {};   // a quién ya se le abrió WhatsApp en esta sesión

function openCrecer(){ dashboardTab='crecer'; render(); loadCrecer(); }
async function gget(path){
  const r = await api('GET','/api/businesses/'+enc(session.slug)+'/growth'+path, undefined, session.pin);
  if(!r.ok){ if(handleAuthError(r)) return null; showToast(errMsg(r,'No se pudo cargar.')); return null; }
  return r.data;
}
async function loadCrecer(){
  if(!isPremiumBiz()) return;
  if(crecerSub==='promos' && !growth.promos){ const d = await gget('/promos'); if(d){ growth.promos=d; promoForm=JSON.parse(JSON.stringify(d)); render(); } }
  if(crecerSub==='inactive' && !growth.inactive){ const d = await gget('/inactive?days='+growth.inactiveDays); if(d){ growth.inactive=d; render(); } }
  if(crecerSub==='birthdays' && !growth.birthdays){ const d = await gget('/birthdays'); if(d){ growth.birthdays=d; render(); } }
  if(crecerSub==='levels' && !levelData) loadLevels();
  if(crecerSub==='avisos') loadPushData();
  if(crecerSub==='reminders' && !growth.reminders) loadReminders();
  if(crecerSub==='report' && !growth.report){ const d = await gget('/report'+(growth.month?'?month='+growth.month:'')); if(d){ growth.report=d; growth.month=d.current.month; render(); } }
}
function setCrecerSub(k){ crecerSub=k; render(); loadCrecer(); }
function firstName(n){ return String(n||'').trim().split(/\s+/)[0] || ''; }
function waOpen(phone, text){ contacted[phone]=true; window.open(waLink(phone, text), '_blank'); render(); }
function unitWord(n){ return cache.biz.mechanic==='sellos' ? (n===1?'sello':'sellos') : (n===1?'punto':'puntos'); }

// ----- Promociones -----
const DIAS = ['D','L','M','M','J','V','S'];
const DIAS_LARGO = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const HORAS = Array.from({length:17},(_,i)=>String(i+7).padStart(2,'0')+':00');   // 07:00 a 23:00
function togglePromo(k){ promoForm[k].on = !promoForm[k].on; if(k==='days' && promoForm.days.on && !promoForm.days.days.length) promoForm.days.days=[2]; render(); }
function toggleDay(d){ const a=promoForm.days.days; const i=a.indexOf(d); if(i>=0) a.splice(i,1); else a.push(d); a.sort(); render(); }
function recommendedPromos(){
  ['welcome','birthday','comeback','referral'].forEach(k=>promoForm[k].on=true);
  render(); showToast('Listo: bienvenida, cumpleaños, bono de regreso e invita a un amigo. Toca Guardar.');
}
async function savePromos(){
  if(promoForm.signup && promoForm.signup.on && !String(promoForm.signup.text||'').trim()){ showToast('Escribe qué se lleva el cliente al registrarse.'); return; }
  if(promoForm.season.on && !(promoForm.season.from && promoForm.season.to && promoForm.season.from<=promoForm.season.to)){ showToast('Elige las fechas de tu temporada doble.'); return; }
  if(promoForm.happyHour.on && !(promoForm.happyHour.from<promoForm.happyHour.to)){ showToast('La hora feliz debe terminar después de empezar.'); return; }
  busy=true; render();
  const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/growth/promos', promoForm, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudieron guardar.')); return; }
  growth.promos = r.data.promos; promoForm = JSON.parse(JSON.stringify(r.data.promos));
  cache.biz.promos = r.data.summary;
  showToast('Promociones guardadas. Tus clientes ya las ven en su tarjeta.');
}
function promoCard(k, title, desc, idea, extra){
  const on = promoForm[k].on;
  return `<div class="promo ${on?'on':''}">
    <div class="promo-head" onclick="togglePromo('${k}')">
      <div style="flex:1;min-width:0"><div class="promo-title">${title}</div><div class="muted small" style="line-height:1.45;margin-top:2px">${desc}</div></div>
      <button class="switch ${on?'on':''}" role="switch" aria-checked="${on}" aria-label="${escapeHtml(title)}" onclick="event.stopPropagation();togglePromo('${k}')"><span></span></button>
    </div>
    ${on && extra ? `<div class="promo-body">${extra}</div>` : ''}
    ${idea ? `<div class="promo-idea">${ic('bolt',14)} ${idea}</div>` : ''}
  </div>`;
}
function promosHtml(){
  if(!promoForm) return `<div class="card"><p class="muted">Cargando…</p></div>`;
  const f = promoForm, u = cache.biz.mechanic==='sellos' ? 'sello' : 'punto', W = isWalletBiz(cache.biz), gift1 = giftText(cache.biz, bonusAmt(cache.biz));
  const eachDbl = W ? 'el saldo de cada compra vale doble' : `cada ${u} vale doble`;
  const hourSel = (key) => `<select class="input" onchange="promoForm.happyHour.${key}=this.value">${HORAS.map(h=>`<option ${f.happyHour[key]===h?'selected':''}>${h}</option>`).join('')}</select>`;
  return `
    <div class="card" style="background:var(--ink);color:#fff;border-color:var(--ink)">
      <div style="font-weight:800;font-size:1.02rem">Dinámicas listas para usar</div>
      <p class="small" style="color:#D9CCE0;margin-top:6px;line-height:1.5">Prende las que quieras y listo: ${W?'el sistema abona el saldo extra solo, al registrar la compra.':'el sistema da los '+u+'s extra solo, al escanear.'} Tus clientes las ven en su tarjeta.</p>
      <button class="btn btn-gold btn-sm mt-12" onclick="recommendedPromos()">${ic('bolt',16)} Activar las recomendadas</button>
    </div>
    ${promoCard('signup','Promoción de registro', 'Un regalo o descuento para quien pide su tarjeta por primera vez. Se ve en tu cartel, en tu liga y al registrarse, y tu equipo recibe el aviso al aprobar.', 'Es el pretexto para que se registren hoy. Ej.: "Un pan dulce de regalo" o "10% en tu primera compra".',
      `<input class="input" maxlength="70" placeholder="Ej.: Un pan dulce de regalo" aria-label="Qué se lleva al registrarse" value="${escapeHtml(f.signup.text||'')}" oninput="promoForm.signup.text=this.value">
       <div class="mt-8"><label class="small">Válida hasta <span class="muted">(opcional)</span></label><input class="input" style="width:100%;min-width:0" type="date" aria-label="Válida hasta" value="${escapeHtml(f.signup.until||'')}" onchange="promoForm.signup.until=this.value"></div>
       <p class="hint">Tu equipo la entrega en caja: Redeo se la recuerda al aprobar cada tarjeta nueva.</p>`)}
    ${promoCard('welcome',W?'Saldo de bienvenida':'Sello de bienvenida', W?`Al aprobar a un cliente nuevo, recibe ${gift1} de regalo para su primera compra.`:`Al aprobar a un cliente nuevo, recibe su primer ${u} de regalo.`, W?`Hace que más gente se registre: "Regístrate y llévate ${gift1}".`:'Hace que más gente se registre: "Regístrate y llévate tu primer sello".')}
    ${promoCard('days','Días dobles', `Los días que elijas, ${eachDbl}.`, 'Úsalo en tus días más flojos. Ej.: "Martes doble".',
      `<div class="day-chips">${DIAS.map((d,i)=>`<button type="button" class="day ${f.days.days.includes(i)?'on':''}" aria-label="${DIAS_LARGO[i]}" onclick="toggleDay(${i})">${d}</button>`).join('')}</div>`)}
    ${promoCard('happyHour','Hora feliz', `En el horario que elijas, ${eachDbl}.`, 'Llena tus horas tranquilas. Ej.: de 3 a 6 de la tarde.',
      `<div class="row" style="gap:8px;align-items:center">${hourSel('from')}<span class="muted small">a</span>${hourSel('to')}</div>`)}
    ${promoCard('birthday','Semana de cumpleaños', `${W?'Saldo':u.charAt(0).toUpperCase()+u.slice(1)} doble del 3 días antes al 3 días después de su cumpleaños.`, 'Tus clientes se sienten consentidos y te visitan en su semana.')}
    ${promoCard('comeback','Bono de regreso', `Si un cliente regresa después de varios días sin venir, ${W?'el saldo de su compra':'su '+u} vale doble.`, 'Combínalo con "Te extrañamos": mándale mensaje y dale una razón para volver.',
      `<div class="row" style="gap:8px;align-items:center"><span class="small">Después de</span><select class="input" style="max-width:120px" onchange="promoForm.comeback.days=Number(this.value)">${[15,30,45,60,90].map(n=>`<option value="${n}" ${f.comeback.days===n?'selected':''}>${n} días</option>`).join('')}</select></div>`)}
    ${promoCard('referral','Invita a un amigo', `Tu cliente comparte su invitación. Cuando su amigo hace su primera compra, tu cliente gana ${gift1}${f.referral.both?' y su amigo también':''}.`, 'Crecimiento de boca en boca: solo pagas cuando el amigo ya te compró.',
      `<label class="row" style="gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" style="margin-top:3px;width:18px;height:18px;accent-color:var(--brand)" ${f.referral.both?'checked':''} onchange="promoForm.referral.both=this.checked;render()"><span class="small"><b>Los dos ganan:</b> el amigo también recibe ${gift1} en su primera compra. Invitar se vuelve más fácil ("te regalan ${gift1}").</span></label>`)}
    ${promoCard('season','Temporada doble', `Del día que elijas al día que elijas, ${eachDbl}.`, 'Aniversario, Buen Fin, vacaciones, regreso a clases, Día de las Madres…',
      `<input class="input" maxlength="30" placeholder="Nombre (ej. Aniversario)" value="${escapeHtml(f.season.name||'')}" oninput="promoForm.season.name=this.value">
       <div class="row mt-8" style="gap:8px"><div style="flex:1;min-width:0"><label class="small">Desde</label><input class="input" style="width:100%;min-width:0" type="date" aria-label="Desde" value="${escapeHtml(f.season.from||'')}" onchange="promoForm.season.from=this.value"></div><div style="flex:1;min-width:0"><label class="small">Hasta</label><input class="input" style="width:100%;min-width:0" type="date" aria-label="Hasta" value="${escapeHtml(f.season.to||'')}" onchange="promoForm.season.to=this.value"></div></div>`)}
    <p class="hint" style="margin:10px 4px 0">Si aplican varias a la vez, ${W?'el saldo':'el '+u} vale doble (no se multiplica más).</p>
    <button class="btn btn-primary btn-block mt-16" ${busy?'disabled':''} onclick="savePromos()">${busy?'Guardando…':'Guardar promociones'}</button>`;
}

// ----- Te extrañamos -----
function missMsg(c){
  const biz = cache.biz, goal = goalOf(biz), left = Math.max(0, goal - c.progress);
  const n = firstName(c.name);
  const bonus = growth.promos ? growth.promos.comeback.on : (biz.promos && (biz.promos.rules||[]).some(r=>r.startsWith('Si regresas')));
  let m = `Hola${n?' '+n:''}, ¡te extrañamos en ${biz.name}! `;
  if(isWalletBiz(biz)){
    m += c.progress>0 ? `Tienes ${pesos(c.progress)} de saldo a favor para usar en tu próxima compra. ` : `Recuerda que cada compra te deja ${biz.walletPct}% en saldo para la siguiente. `;
    if(bonus) m += 'Si vienes esta semana, el saldo de tu compra vale doble. ';
    return m + '¡Te esperamos!';
  }
  m += c.progress>0 ? `Llevas ${c.progress} de ${goal} ${unitWord(goal)}${left>0?` y te ${left===1?'falta':'faltan'} ${left} para tu premio: ${inSentence(biz.rewardDesc)}`:`: ¡ya tienes tu premio (${inSentence(biz.rewardDesc)}) esperándote!`}. ` : `Tu tarjeta te está esperando para tu primer ${unitWord(1)}. `;
  if(bonus) m += `Si vienes esta semana, tu ${unitWord(1)} vale doble. `;
  return m + '¡Te esperamos!';
}
async function setInactiveDays(d){ growth.inactiveDays=d; growth.inactive=null; render(); loadCrecer(); }
function consentBtn(c, label, onclick){
  if(!c.marketingOptIn) return `<span class="muted small" style="text-align:right;max-width:120px;line-height:1.3">No aceptó promociones</span>`;
  const done = contacted[c.phone];
  return `<button class="btn ${done?'btn-secondary':'btn-wa'} btn-sm" onclick="${onclick}">${done?ic('check',16)+' Enviado':ic('send',16)+' '+label}</button>`;
}
function inactiveHtml(){
  const g = growth.inactive;
  const chips = [15,30,60,90].map(d=>`<button class="day wide ${growth.inactiveDays===d?'on':''}" onclick="setInactiveDays(${d})">${d} días</button>`).join('');
  let list;
  if(!g) list = `<p class="muted small">Cargando…</p>`;
  else if(!g.customers.length) list = `<div class="empty"><div class="empty-ico">${ic('users',26)}</div><b style="color:var(--ink)">¡Nadie se te ha ido!</b><p class="small mt-8">Todos tus clientes han venido en los últimos ${g.days} días.</p></div>`;
  else list = `<div class="list" style="margin-top:0">${g.customers.map(c=>`
    <div class="item" style="cursor:default">
      <div class="avatar sm" style="background:${tint(cache.biz.color)};color:${shade(cache.biz.color,-30)}">${escapeHtml(initialOf(c.name||c.phone))}</div>
      <div class="item-main"><div class="item-name">${escapeHtml(c.name||c.phone)}</div><div class="item-sub">${c.neverVisited?'Se registró hace '+c.daysAway+' días y no ha vuelto':'Última visita hace '+c.daysAway+' días'} · ${c.progress}/${goalOf(cache.biz)}</div></div>
      ${consentBtn(c,'Escribirle',`waOpen('${jsEsc(c.phone)}', missMsg(growth.inactive.customers.find(x=>x.phone==='${jsEsc(c.phone)}')))`)}
    </div>`).join('')}</div>`;
  return `
    <div class="card">
      <div class="card-title">${ic('heart',18)} Te extrañamos</div>
      <p class="muted small">Clientes que no han venido en:</p>
      <div class="day-chips mt-8">${chips}</div>
      ${g && g.customers.length ? `<p class="small mt-12" style="color:var(--ink-2)"><b>${g.customers.length}</b> ${g.customers.length===1?'cliente':'clientes'} por recuperar. Toca <b>Escribirle</b> y se abre WhatsApp con el mensaje listo.</p>` : ''}
    </div>
    ${list}
    <p class="hint" style="margin:10px 4px 0">Solo puedes escribir a quienes aceptaron recibir promociones. Tip: prende el <b>Bono de regreso</b> en Promociones para que el mensaje ofrezca sello doble.</p>`;
}

// ----- Cumpleaños -----
function bdayMsg(c){
  const biz = cache.biz, n = firstName(c.name);
  const on = growth.promos ? growth.promos.birthday.on : (biz.promos && (biz.promos.rules||[]).some(r=>r.includes('cumpleaños')));
  return `¡Feliz cumpleaños${n?', '+n:''}! 🎉 En ${biz.name} queremos celebrarte${on?(isWalletBiz(biz)?': toda tu semana de cumpleaños el saldo de tus compras vale doble':`: toda tu semana de cumpleaños tus ${unitWord(2)} valen doble`):'. Pasa a vernos, tenemos un detalle para ti'}. ¡Te esperamos!`;
}
async function giftStamp(phone){
  if(busy) return;
  busy=true; render();
  const amount = cache.biz.mechanic==='sellos' ? 1 : (cache.biz.pointsPerVisit||1);
  const r = await api('POST','/api/businesses/'+enc(session.slug)+'/customers/'+enc(phone)+'/progress',{ amount, gift:true }, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo regalar.')); return; }
  const { bonus, ...cust } = r.data; upsertCustomer(cust); delete historyCache[phone];
  const b = growth.birthdays && growth.birthdays.customers.find(x=>x.phone===phone); if(b){ b.progress = cust.progress; b.gifted = true; }
  showToast('Le regalaste '+giftText(cache.biz, amount)+'.');
}
function bdaysHtml(){
  const g = growth.birthdays;
  let list;
  if(!g) list = `<p class="muted small">Cargando…</p>`;
  else if(!g.customers.length) list = `<div class="empty"><div class="empty-ico">${ic('cake',26)}</div><b style="color:var(--ink)">Nadie cumple años en los próximos 30 días</b></div>`;
  else list = `<div class="list" style="margin-top:0">${g.customers.map(c=>`
    <div class="item" style="cursor:default;flex-wrap:wrap">
      <div class="avatar sm" style="background:#FFF1CF;color:#8A5B00">${ic('cake',18)}</div>
      <div class="item-main"><div class="item-name">${escapeHtml(c.name||c.phone)}</div><div class="item-sub">${c.daysUntil===0?'<b style="color:var(--brand)">¡Hoy es su cumpleaños!</b>':c.daysUntil===1?'Mañana':'En '+c.daysUntil+' días'} · ${bdayText(c.birthday)}</div></div>
      <div class="row" style="gap:6px;flex-basis:100%;justify-content:flex-end">
        <button class="btn btn-secondary btn-sm" ${busy||c.gifted?'disabled':''} onclick="giftStamp('${jsEsc(c.phone)}')">${ic('gift',16)} ${c.gifted?'Regalado':'Regalar '+(isWalletBiz(cache.biz)?giftText(cache.biz,bonusAmt(cache.biz)):unitWord(1))}</button>
        ${consentBtn(c,'Felicitar',`waOpen('${jsEsc(c.phone)}', bdayMsg(growth.birthdays.customers.find(x=>x.phone==='${jsEsc(c.phone)}')))`)}
      </div>
    </div>`).join('')}</div>`;
  return `
    <div class="card">
      <div class="card-title">${ic('cake',18)} Cumpleaños de los próximos 30 días</div>
      <p class="muted small">Felicítalos por WhatsApp con el mensaje listo, o regálales ${isWalletBiz(cache.biz)?giftText(cache.biz,bonusAmt(cache.biz)):'un '+unitWord(1)} cuando vengan.</p>
      ${g && g.missing ? `<p class="small mt-12" style="color:var(--ink-2)">${g.missing} ${g.missing===1?'cliente no tiene':'clientes no tienen'} cumpleaños registrado. Agrégalo desde su ficha en Clientes.</p>` : ''}
    </div>
    ${list}`;
}

// ----- Reporte del mes -----
const MESES_LARGOS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function monthName(m){ const [y,mo]=m.split('-').map(Number); return MESES_LARGOS[mo-1].charAt(0).toUpperCase()+MESES_LARGOS[mo-1].slice(1)+' '+y; }
function shiftMonth(delta){
  const [y,m] = growth.month.split('-').map(Number); const d = new Date(Date.UTC(y, m-1+delta, 1));
  growth.month = d.toISOString().slice(0,7); growth.report=null; render(); loadCrecer();
}
function delta(cur, prev){
  const d = cur - prev; if(!prev && !cur) return '';
  if(d===0) return `<span class="delta">= igual</span>`;
  return `<span class="delta ${d>0?'up':'down'}">${d>0?'▲ +':'▼ '}${d}</span>`;
}
function reportText(r){
  const c = r.current, u = r.mechanic==='sellos'?'Sellos':'Puntos';
  const rate = c.activeCustomers ? Math.round(c.returningCustomers/c.activeCustomers*100) : 0;
  return [`Resumen de ${monthName(c.month)} · ${cache.biz.name}`,
    `• Clientes nuevos: ${c.newCustomers}`, `• Visitas: ${c.visits}`, `• Clientes que regresaron: ${c.returningCustomers} (${rate}%)`,
    ...(r.mechanic==='monedero' ? [`• Ventas con tarjeta: ${pesos(c.sales)}`, `• Saldo dado: ${pesos(c.given)}${c.bonusGiven?` (${pesos(c.bonusGiven)} de promociones)`:''}`, `• Saldo usado: ${pesos(c.redeemedAmount)}`]
      : [`• ${u} dados: ${c.given}${c.bonusGiven?` (${c.bonusGiven} de promociones)`:''}`, `• Premios canjeados: ${c.redemptions}`]),
    ...(c.topProducts.length?[`• Lo más vendido: ${c.topProducts.slice(0,3).map(p=>p.name).join(', ')}`]:[]),
    '', 'Tarjeta de lealtad Redeo · P.A.E.'].join('\n');
}
function reportHtml(){
  const r = growth.report;
  if(!r) return `<div class="card"><p class="muted">Cargando…</p></div>`;
  const c = r.current, p = r.previous, u = r.mechanic==='sellos'?'Sellos':'Puntos';
  const rate = c.activeCustomers ? Math.round(c.returningCustomers/c.activeCustomers*100) : 0;
  const isCurrent = growth.month === new Date().toLocaleDateString('sv-SE',{timeZone:'America/Mexico_City'}).slice(0,7);
  const tile = (label, v, pv, color) => `<div class="stat"><div class="stat-num">${v}</div><div class="stat-label">${label}</div>${pv==null?'':delta(v,pv)}</div>`;
  const maxW = Math.max(1, ...c.weekdays);
  const order = [1,2,3,4,5,6,0];
  return `
    <div class="month-nav">
      <button class="icon-btn" aria-label="Mes anterior" onclick="shiftMonth(-1)">${ic('left',18)}</button>
      <b>${monthName(c.month)}</b>
      <button class="icon-btn" aria-label="Mes siguiente" ${isCurrent?'disabled style="opacity:.35"':''} onclick="shiftMonth(1)">${ic('right',18)}</button>
    </div>
    <div class="stats report-stats">
      ${tile('Clientes nuevos', c.newCustomers, p.newCustomers)}
      ${tile('Visitas', c.visits, p.visits)}
      ${tile('Regresaron', c.returningCustomers, p.returningCustomers)}
      ${r.mechanic==='monedero' ? `${tile('Ventas con tarjeta', pesos(c.sales), null)}
      ${tile('Saldo usado', pesos(c.redeemedAmount), null)}` : `${tile(u+' dados', c.given, p.given)}
      ${tile('Premios', c.redemptions, p.redemptions)}`}
      ${tile('Clientes activos', c.activeCustomers, p.activeCustomers)}
    </div>
    <div class="card mt-12">
      <div class="kv"><span class="small" style="font-weight:700">Tasa de regreso</span><b style="font-size:1.1rem;color:${rate>=50?'var(--ok)':'var(--ink)'}">${rate}%</b></div>
      <p class="muted small" style="margin-top:6px">De los clientes que vinieron este mes, ${rate}% ya te había visitado antes.${c.bonusGiven?` Tus promociones regalaron ${r.mechanic==='monedero'?pesos(c.bonusGiven)+' de saldo':c.bonusGiven+' '+u.toLowerCase()}.`:''}</p>${r.mechanic==='monedero'&&c.sales?`<p class="muted small" style="margin-top:6px">Tus clientas con tarjeta compraron ${pesos(c.sales)} este mes. El saldo que diste fue ${pesos(c.given)}, y solo se usa si regresan a comprar.</p>`:''}
    </div>
    ${c.topProducts.length ? `<div class="card"><div class="card-title">${ic('heart',18)} Lo más vendido</div>${c.topProducts.map((x,i)=>`<div class="fav-rank"><span class="avatar sm" style="width:28px;height:28px;border-radius:9px;font-size:.78rem;background:var(--brand-soft);color:var(--brand-deep)">${i+1}</span><b>${escapeHtml(x.name)}</b><span class="muted small">${x.n} ${x.n===1?'vez':'veces'}</span></div>`).join('')}</div>` : ''}
    ${c.topCustomers.length ? `<div class="card"><div class="card-title">${ic('users',18)} Tus clientes más fieles</div>${c.topCustomers.map((x,i)=>`<div class="fav-rank"><span class="avatar sm" style="width:28px;height:28px;border-radius:9px;font-size:.78rem;background:#FFF1CF;color:#8A5B00">${i+1}</span><b>${escapeHtml(x.name)}</b><span class="muted small">${x.n} ${x.n===1?'visita':'visitas'}</span></div>`).join('')}</div>` : ''}
    <div class="card">
      <div class="card-title">${ic('chart',18)} Visitas por día</div>
      <div class="week-bars">${order.map(i=>`<div class="wb"><div class="wb-bar"><span style="height:${Math.round(c.weekdays[i]/maxW*100)}%;background:${c.weekdays[i]===maxW&&maxW>0?'var(--brand)':'#E9DDE3'}"></span></div><b>${c.weekdays[i]}</b><small>${DIAS[i]}</small></div>`).join('')}</div>
      <p class="hint">Los días con menos visitas son buenos para "Días dobles".</p>
    </div>
    <button class="btn btn-secondary btn-block" onclick="window.open('https://wa.me/?text='+encodeURIComponent(reportText(growth.report)),'_blank')">${ic('send',18)} Compartir resumen por WhatsApp</button>`;
}

function crecerUpsell(){
  const item = (icon, t, s) => `<div class="upsell-item"><span class="choice-icon" style="background:#FFF1CF;color:#8A5B00;width:38px;height:38px">${ic(icon,18)}</span><div><b>${t}</b><p class="muted small" style="margin-top:2px">${s}</p></div></div>`;
  return `<div class="card">
    <div class="card-title">${ic('trend',18)} Herramientas para vender más <span class="plan-pill premium" style="margin-left:auto">Premium</span></div>
    ${item('bolt','Promociones automáticas','Sello de bienvenida, días dobles, hora feliz, cumpleaños, bono de regreso, invita a un amigo y temporadas.')}
    ${item('heart','Te extrañamos','Ve quién dejó de venir y escríbele por WhatsApp con el mensaje listo.')}
    ${item('cake','Cumpleaños','Quién cumple años este mes, con felicitación lista y sello de regalo.')}
    ${item('chart','Reporte del mes','Clientes nuevos, visitas, cuántos regresan, lo más vendido y tus mejores clientes.')}
    ${item('send','Avisos al celular','Tu promoción llega como notificación al celular de tus clientes, con tu nombre y tu ícono.')}
    ${item('crown','Niveles de cliente','Frecuente, VIP… mientras más vienen, más ganan. Lo ven en su tarjeta.')}
    ${item('bell','Recordatorios','"Ya te toca tu corte", "ya toca la vacuna": Redeo te dice a quién escribirle y cuándo.')}
    ${item('gift','Premios a elegir','Un menú de premios: con 50 puntos un café, con 100 un postre, con 200 un platillo.')}
    <div class="lock-note">${ic('lock',16)} Disponible en el plan Premium. Pídeselo a P.A.E.</div>
  </div>`;
}

// Crecer en 4 grupos; los que tienen dos partes muestran un selector chico arriba.
const CRECER_GROUPS = [
  ['promos', 'bolt', 'Promociones', [['promos','Promociones'],['levels','Niveles']]],
  ['mensajes', 'send', 'Mensajes', [['avisos','Avisos al celular'],['reminders','Recordatorios']]],
  ['recuperar', 'heart', 'Recuperar', [['inactive','Te extrañamos'],['birthdays','Cumpleaños']]],
  ['report', 'chart', 'Reporte', [['report','Reporte del mes']]]
];
function crecerGroupOf(sub){ return CRECER_GROUPS.find(g=>g[3].some(x=>x[0]===sub)) || CRECER_GROUPS[0]; }
function dashboardCrecer(){
  if(!isPremiumBiz()) return crecerUpsell();
  const due = remindersDueCount();
  const g = crecerGroupOf(crecerSub);
  const badge = n => n ? ` <span class="tab-badge" style="position:static">${n}</span>` : '';
  return `<div class="pnl-groups">${CRECER_GROUPS.map(([k,i,l,subs])=>`<button class="${g[0]===k?'on':''}" onclick="setCrecerSub('${subs[0][0]}')">${ic(i,18)}<span>${l}${k==='mensajes'?badge(due):''}</span></button>`).join('')}</div>
    ${g[3].length>1 ? `<div class="seg pnl-seg">${g[3].map(([k,l])=>`<button class="${crecerSub===k?'on':''}" onclick="setCrecerSub('${k}')">${l}${k==='reminders'?badge(due):''}</button>`).join('')}</div>` : ''}
    ${crecerSub==='promos'?promosHtml():crecerSub==='avisos'?pushHtml():crecerSub==='reminders'?remindersHtml():crecerSub==='levels'?levelsHtml():crecerSub==='inactive'?inactiveHtml():crecerSub==='birthdays'?bdaysHtml():reportHtml()}`;
}

function isPremiumBiz(){ return (cache.biz && cache.biz.plan) === 'premium'; }

function premiumLock(inner, withNote){
  if(isPremiumBiz()) return inner;
  return `<div class="locked">${withNote?'':`<span class="lock-badge">${ic('lock',12)} Premium</span>`}<div class="lock-body">${inner}</div>${withNote?`<div class="lock-note">${ic('lock',16)} Disponible en el plan Premium. Pídeselo a P.A.E.</div>`:''}</div>`;
}

function configPreviewBiz(){
  const f = configForm, b = cache.biz;
  return { ...b, color:f.color, rewardDesc:f.rewardDesc||b.rewardDesc, stampsGoal:f.stampsGoal, pointsGoal:f.pointsGoal,
    stampIcon: isPremiumBiz() ? f.stampIcon : 'check', cardTitle: isPremiumBiz() ? f.cardTitle : '', cardStyle: isPremiumBiz() ? f.cardStyle : 'gradient',
    logoUrl: isPremiumBiz() ? b.logoUrl : null };
}

function setHexColor(v){
  v = String(v||'').trim();
  if(!v.startsWith('#')) v = '#'+v;
  if(/^#[0-9a-fA-F]{6}$/.test(v)){ configForm.color = v.toUpperCase(); render(); }
}
