/* Redeo · Negocio: liga personal de cada cliente, editar clientes y dar sellos/puntos/saldo. */
/* ---------- Liga personal de cada cliente ---------- */
function cardLink(phone, token){ return location.origin + '/?n=' + enc(session.slug||'') + '&c=' + enc(phone) + '&t=' + enc(token); }
function whatsappCard(phone){
  const c = cache.customers.find(x=>x.phone===phone);
  if(!c || !c.cardToken) return;
  const nombre = String(c.name||'').trim().split(/\s+/)[0];
  const msg = `Hola${nombre?' '+nombre:''}, aquí está tu tarjeta de lealtad de ${cache.biz.name}. Ábrela y guárdala en tu celular, es solo tuya: ${cardLink(c.phone, c.cardToken)}`;
  window.open(waLink(c.phone, msg), '_blank');
}
function copyCardLink(phone){
  const c = cache.customers.find(x=>x.phone===phone);
  if(c && c.cardToken) copyText(cardLink(c.phone, c.cardToken), 'Liga de su tarjeta copiada');
}
let bdayEditPhone = null;
let bdayEdit = { day:'', month:'' };
function startBdayEdit(phone){
  const c = cache.customers.find(x=>x.phone===phone);
  const v = c && c.birthday ? c.birthday.split('-').map(Number) : null;
  bdayEdit = v ? { month:v[0], day:v[1] } : { day:'', month:'' };
  bdayEditPhone = phone; render();
}
async function saveBdayEdit(){
  if(!bdayValid(bdayEdit)){ showToast('Elige un día y mes válidos.'); return; }
  busy=true; render();
  const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/customers/'+enc(bdayEditPhone)+'/birthday',{ birthday:bdayValue(bdayEdit) }, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo guardar el cumpleaños.')); return; }
  upsertCustomer(r.data); bdayEditPhone = null;
  showToast('Cumpleaños guardado.');
}
function bdayRowHtml(c){
  const has = isOwner() ? !!c.birthday : !!c.hasBirthday;
  if(bdayEditPhone===c.phone){
    return `<div class="share-card mt-12" onclick="event.stopPropagation()"><div class="small" style="font-weight:700;color:var(--ink-2);margin-bottom:8px">${ic('gift',14)} Cumpleaños</div>${bdayPickerHtml('bdayEdit','e-bday')}
      <div class="row mt-12" style="gap:8px"><button class="btn btn-primary btn-sm" style="flex:1" ${busy?'disabled':''} onclick="event.stopPropagation();saveBdayEdit()">Guardar</button><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();bdayEditPhone=null;render()">Cancelar</button></div></div>`;
  }
  const label = has ? (isOwner() ? bdayText(c.birthday) : 'Registrado') : 'Sin registrar';
  return `<div class="share-card mt-12" style="display:flex;align-items:center;gap:10px" onclick="event.stopPropagation()">
    <span class="small" style="font-weight:700;color:var(--ink-2);white-space:nowrap;display:inline-flex;align-items:center;gap:6px">${ic('gift',14)} Cumpleaños</span>
    <span class="small" style="flex:1;text-align:right;white-space:nowrap;color:${has?'var(--ink)':'var(--muted)'}">${escapeHtml(label)}</span>
    <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();startBdayEdit('${jsEsc(c.phone)}')">${has?'Cambiar':'Agregar'}</button>
  </div>${has?'':'<p class="hint" style="margin-top:6px">Sin cumpleaños, el cliente solo puede abrir su tarjeta con la liga de WhatsApp.</p>'}`;
}

let editCustomer = null;      // teléfono del cliente cuyos datos se están corrigiendo
let editForm = null;
let deleteCustomerPhone = null;
function startEditCustomer(c){ editCustomer = c.phone; editForm = { name:c.name||'', phone:c.phone, email:c.email||'' }; deleteCustomerPhone=null; render(); }
async function saveCustomerEdit(){
  const f = editForm, phone = normalizePhone(f.phone);
  if(!isValidPhone(phone)){ showToast(phoneMsg('e-phone')); return; }
  if(f.email && !isEmail(f.email)){ showToast('Ese correo no parece válido.'); return; }
  busy=true; render();
  const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/customers/'+enc(editCustomer),{ name:f.name.trim(), phone, email:f.email.trim() }, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo guardar.')); render(); return; }
  const old = editCustomer;
  cache.customers = cache.customers.map(x => x.phone===old ? { ...x, ...r.data } : x);
  if(expandedPhone===old) expandedPhone = r.data.phone;
  delete historyCache[old];
  editCustomer = null;
  showToast(phone!==old ? 'Datos guardados. Si cambió de teléfono, mándale otra vez su tarjeta por WhatsApp.' : 'Datos guardados.');
}
async function setCustomerMarketing(phone, on){
  if(on && !confirm('Marca que acepta promociones solo si el cliente te lo pidió o lo autorizó.')) return;
  busy = true; render();
  const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/customers/'+enc(phone)+'/marketing', { optIn:on }, session.pin);
  busy = false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo guardar.')); return; }
  upsertCustomer(r.data);
  showToast(on ? 'Marcado: sí acepta promociones.' : 'Listo: ya no aparecerá en tus listas de promociones.');
}
async function deleteCustomer(phone){
  if(deleteCustomerPhone!==phone){ deleteCustomerPhone = phone; render(); return; }
  busy=true; render();
  const r = await api('DELETE','/api/businesses/'+enc(session.slug)+'/customers/'+enc(phone), undefined, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo eliminar.')); render(); return; }
  cache.customers = cache.customers.filter(x=>x.phone!==phone);
  expandedPhone = null; deleteCustomerPhone = null;
  showToast('Cliente eliminado con su historial.');
}
function customerEditHtml(c){
  if(editCustomer===c.phone){
    return `<div class="share-card mt-12" onclick="event.stopPropagation()">
      <div class="small" style="font-weight:700;color:var(--ink-2);margin-bottom:8px">${ic('user',14)} Corregir datos</div>
      <div class="field"><label>Nombre</label><input class="input" value="${escapeHtml(editForm.name)}" oninput="editForm.name=this.value"></div>
      <div class="field"><label for="e-phone">Número de WhatsApp</label>${telField('e-phone', normalizePhone(editForm.phone), 'editForm.phone')}</div>
      <div class="field"><label>Correo</label><input class="input" type="email" autocapitalize="none" value="${escapeHtml(editForm.email)}" oninput="editForm.email=this.value"></div>
      <div class="row" style="gap:8px"><button class="btn btn-primary btn-sm" style="flex:1" ${busy?'disabled':''} onclick="saveCustomerEdit()">Guardar</button><button class="btn btn-ghost btn-sm" onclick="editCustomer=null;render()">Cancelar</button></div>
    </div>`;
  }
  const sure = deleteCustomerPhone===c.phone;
  return `<div class="row mt-12" style="gap:8px" onclick="event.stopPropagation()">
    <button class="btn btn-ghost btn-sm" style="flex:1;min-width:0" onclick="startEditCustomer(cache.customers.find(x=>x.phone==='${jsEsc(c.phone)}'))">${ic('user',16)} Corregir datos</button>
    <button class="btn ${sure?'btn-danger':'btn-ghost'} btn-sm" style="flex:1;min-width:0;${sure?'':'color:var(--danger)'}" ${busy?'disabled':''} onclick="deleteCustomer('${jsEsc(c.phone)}')">${ic('x',16)} ${sure?'Sí, eliminar':'Eliminar'}</button>
  </div>${sure?`<p class="hint" style="margin-top:6px;color:var(--danger)">Se borran su tarjeta, sus sellos y su historial. No se puede deshacer.</p>`:''}`;
}

function cardShareHtml(c){
  if(!c.cardToken) return '';
  return `<div class="share-card mt-12" onclick="event.stopPropagation()">
    <div class="small" style="font-weight:700;color:var(--ink-2)">${ic('lock',14)} Tarjeta privada del cliente</div>
    <p class="muted small" style="margin:4px 0 10px">Si no puede abrir su tarjeta, mándasela por WhatsApp.</p>
    <div class="row" style="gap:8px"><button class="btn btn-wa btn-sm" style="flex:1" onclick="whatsappCard('${jsEsc(c.phone)}')">${ic('phone',16)} Enviar por WhatsApp</button><button class="btn btn-secondary btn-sm" aria-label="Copiar liga de su tarjeta" onclick="copyCardLink('${jsEsc(c.phone)}')">${ic('copy',16)}</button></div>
  </div>`;
}

/* ---------- Acciones: clientes (panel de negocio) ---------- */
function upsertCustomer(c){
  const i = cache.customers.findIndex(x=>x.phone===c.phone);
  if(i>=0) cache.customers[i] = { ...cache.customers[i], ...c };
  else cache.customers.unshift(c);
}

async function addCustomer(){
  newCustomerError='';
  const phone = normalizePhone(newCustomerForm.phone);
  if(!isValidPhone(phone)){ newCustomerError=phoneMsg('n-phone'); render(); return; }
  if(activeCustomers().some(c=>c.phone===phone)){ newCustomerError='Ese teléfono ya tiene una tarjeta.'; render(); return; }
  busy=true; render();
  const email = String(newCustomerForm.email||'').trim();
  if(email && !isEmail(email)){ busy=false; newCustomerError='Ese correo no parece válido.'; render(); return; }
  const nb = newCustomerForm.bday || {};
  if((nb.day||nb.month) && !bdayValid(nb)){ busy=false; newCustomerError='Revisa el día y el mes del cumpleaños.'; render(); return; }
  const r = await api('POST','/api/businesses/'+enc(session.slug)+'/customers',{ phone, name:newCustomerForm.name.trim(), email, birthday: bdayValid(nb) ? bdayValue(nb) : undefined, marketingOptIn: !!newCustomerForm.marketing, source: newCustomerForm.source || undefined }, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; newCustomerError = errMsg(r,'No se pudo guardar el cliente.'); render(); return; }
  const { bonus:nb2, ...createdC } = r.data;
  upsertCustomer({ given:0, ...createdC });
  newCustomerForm={phone:'',name:'',email:'',bday:{day:'',month:''},marketing:false,source:''}; newCustomerOpen=false;
  expandedPhone = createdC.phone; customerSearch='';
  const sp = signupPromo(cache.biz);
  showToast((nb2 ? (isWalletBiz(cache.biz)?'Tarjeta creada con su saldo de bienvenida.':'Tarjeta creada con su sello de bienvenida.') : 'Tarjeta creada para el cliente.') + (sp ? ' Dale su promoción de registro: '+sp.text+'.' : ''), sp ? 7000 : undefined);
}

// Cómo se identificó al cliente: escaneando su tarjeta (con o sin código de un uso), con el código escrito a mano, o a mano.
function accessBody(phone){
  const b = { method:'manual' };
  if(scanCtx && scanCtx.phone===phone){ b.method = 'scan'; if(scanCtx.code) b.code = scanCtx.code; }
  if(scanPhone===phone && /^\d{6}$/.test(sheetCode)) b.code = sheetCode;
  return b;
}
function strictOn(){ return !!(cache.biz && cache.biz.strictMode); }
function needsCode(){ return strictOn() && !isOwner(); }
// Errores de acceso: modo estricto o código vencido -> abre la hoja para escribir el código nuevo.
function handleAccessError(r, phone){
  const code = r.data && r.data.code;
  if(code==='strict' || code==='bad_code'){
    if(scanPhone!==phone){ scanPhone = phone; sheetProducts = []; confirmRedeemPhone = null; }
    sheetCode = ''; if(scanCtx && scanCtx.phone===phone) scanCtx.code = null;
    showToast(errMsg(r,'Falta el código de la tarjeta del cliente.'), 7000);
    return true;
  }
  return false;
}

async function addProgress(phone, amount, products, force){
  amount = Math.round(Number(amount));
  if(!(amount>0) || busy) return false;
  busy=true; render();
  // Monedero: "amount" es el monto de la compra; el servidor calcula el saldo.
  const wal = isWalletBiz(cache.biz);
  const r = await api('POST','/api/businesses/'+enc(session.slug)+'/customers/'+enc(phone)+'/progress',{ ...(wal?{ ticket:amount }:{ amount }), products: products||[], ...accessBody(phone), force: force===true }, session.pin);
  busy=false;
  if(!r.ok){
    if(handleAuthError(r)) return false;
    if(r.data && r.data.code==='cooldown' && r.data.canForce){
      if(confirm(r.data.error+'\n\n¿Darlo de todos modos? Quedará anotado que lo diste tú.')) return addProgress(phone, amount, products, true);
      render(); return false;
    }
    if(handleAccessError(r, phone)) return false;
    showToast(errMsg(r,'No se pudo sumar.'), 7000); return false;
  }
  delete historyCache[phone];
  if(wal){
    const { bonus, referrer, historyId, ticket, levelBonus, levelUp, ...cust } = r.data;
    const got = (ticket?ticket.credit:0) + (bonus?bonus.amount:0) + (referrer&&referrer.both?referrer.amount:0);
    lastAction = { phone, historyId, at: Date.now(), label: 'Se abonaron '+pesos(got)+' de saldo' };
    upsertCustomer(cust); pointsInputs[phone]='';
    let msg = 'Compra de '+pesos(ticket.amount)+': se abonaron '+pesos(got)+' de saldo. Ahora tiene '+pesos(cust.progress)+'.';
    if(bonus) msg = '¡Doble! ' + bonus.reasons.join(' · ') + '. ' + msg;
    if(referrer){ msg += ' '+String(referrer.name).split(' ')[0]+' ganó '+pesos(referrer.amount)+' por invitarla.'; delete historyCache[referrer.phone]; refreshCustomers({silent:true}); }
    msg += levelMsg(levelBonus, levelUp, cust);
    showToast(msg, 6000);
    return true;
  }
  const { bonus, referrer, historyId, levelBonus, levelUp, ...cust } = r.data;
  lastAction = { phone, historyId, at: Date.now(), label: 'Se '+((amount+(bonus?bonus.amount:0))===1?'agregó ':'agregaron ')+(amount+(bonus?bonus.amount:0))+' '+(cache.biz.mechanic==='sellos'?((amount+(bonus?bonus.amount:0))===1?'sello':'sellos'):'puntos') };
  upsertCustomer(cust);
  pointsInputs[phone]='';
  const unit = cache.biz.mechanic==='sellos' ? 'sello' : 'punto';
  const goal = goalOf(cache.biz);
  const total = amount + (bonus ? bonus.amount : 0);
  let msg = canRedeem(cache.biz, cust) ? (rewardMenuOf(cache.biz)?'¡Ya le alcanza para un premio!':'¡Premio listo para este cliente!') : 'Se '+(total===1?'agregó ':'agregaron ')+total+' '+unit+(total===1?'':'s')+'.';
  if(bonus) msg = '¡Doble! ' + bonus.reasons.join(' · ') + '. ' + msg;
  if(referrer){ msg += ' '+String(referrer.name).split(' ')[0]+' ganó '+(referrer.amount===1?'1 '+unit:referrer.amount+' '+unit+'s')+' por invitarlo'+(referrer.both?' (y este cliente también)':'')+'.'; delete historyCache[referrer.phone]; refreshCustomers({silent:true}); }
  msg += levelMsg(levelBonus, levelUp, cust);
  showToast(msg, levelUp ? 6000 : undefined);
  return true;
}
// Niveles (Premium): lo que se suma por su nivel y si subió con esta visita.
function levelMsg(levelBonus, levelUp, cust){
  let m = '';
  if(levelBonus) m += ' +'+(isWalletBiz(cache.biz)?pesos(levelBonus):levelBonus)+' por su nivel'+(cust.level?' '+cust.level.name:'')+'.';
  if(levelUp) m += ' ¡Subió a '+levelUp.name+'!'+(levelUp.perk?' Beneficio: '+levelUp.perk+'.':'');
  return m;
}
