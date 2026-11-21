/* Redeo · Negocio: entrar, solicitudes de clientes, equipo y seguridad (acciones). */
/* ---------- Acciones: negocio ---------- */
async function submitCrearNegocio(){
  createError='';
  const f = createForm;
  if(!f.name.trim()){ createError='Escribe el nombre de tu negocio.'; render(); return; }
  if(f.mechanic!=='monedero' && !f.rewardDesc.trim()){ createError='Describe el premio que da tu tarjeta.'; render(); return; }
  if(f.mechanic==='sellos' && !(Number(f.stampsGoal)>=2 && Number(f.stampsGoal)<=30)){ createError='Los sellos para el premio deben ser entre 2 y 30.'; render(); return; }
  if(f.mechanic==='puntos' && !(Number(f.pointsGoal)>=1 && Number(f.pointsPerVisit)>=1)){ createError='Completa los puntos del premio y los puntos por visita.'; render(); return; }
  if(f.ownerPhone && !isValidPhone(normalizePhone(f.ownerPhone))){ createError=phoneMsg('f-ophone','el WhatsApp del dueño'); render(); return; }
  if(f.mechanic==='monedero' && !(Number(f.walletPct)>=1 && Number(f.walletPct)<=30)){ createError='El porcentaje del monedero debe ser de 1% a 30%.'; render(); return; }
  if(!/^\d{4,8}$/.test(f.pin)){ createError='El PIN debe ser de 4 a 8 dígitos.'; render(); return; }
  if(serverConfig.adminRequired && !f.adminKey.trim()){ createError='Escribe la clave de administrador de P.A.E.'; render(); return; }

  busy = true; render();
  const r = await api('POST','/api/businesses',{
    name:f.name.trim(), mechanic:f.mechanic, stampsGoal:Number(f.stampsGoal), pointsGoal:Number(f.pointsGoal),
    pointsPerVisit:Number(f.pointsPerVisit), walletPct:Number(f.walletPct), walletBonus:Number(f.walletBonus), rewardDesc:f.rewardDesc.trim(), color:f.color, pin:f.pin, plan:f.plan, trialDays:Number(f.trialDays)||0,
    ownerName:(f.ownerName||'').trim(), ownerPhone:normalizePhone(f.ownerPhone||'')
  });
  busy = false;
  if(!r.ok){ createError = errMsg(r,'No se pudo crear el negocio.'); render(); return; }
  cache.biz = { ...r.data, pin:f.pin };
  cache.customers = [];
  session = { slug:r.data.slug, pin:f.pin };
  store.set('vuelve_session', JSON.stringify(session));
  createForm = { ...createForm, name:'', rewardDesc:'', pin:'', ownerName:'', ownerPhone:'' };
  view = 'negocioExito';
  render();
}

async function loadDashboard(slug, pin){
  const r = await api('POST','/api/businesses/'+enc(slug)+'/login',{ pin });
  if(!r.ok) return r;
  if(r.data.access && r.data.access.expired){
    cache.biz = { ...r.data, pin }; cache.customers = [];
    session = { slug:r.data.slug, pin }; store.set('vuelve_session', JSON.stringify(session));
    return { ok:true };
  }
  const c = await api('GET','/api/businesses/'+enc(slug)+'/customers', undefined, pin);
  if(!c.ok) return c;
  cache.biz = { ...r.data, pin };
  cache.customers = Array.isArray(c.data) ? c.data : [];
  session = { slug:r.data.slug, pin };
  store.set('vuelve_session', JSON.stringify(session));
  secAlertsCount = 0; team = null; secReport = null;
  opinions = null; opinionsOpen = false;
  if(r.data.role==='owner'){ setTimeout(loadSecAlerts, 0); setTimeout(loadOpinions, 0); }
  return { ok:true };
}

async function submitLogin(){
  loginError='';
  const raw = loginForm.slug.trim();
  if(!raw || !loginForm.pin){ loginError='Escribe tu WhatsApp o el código de tu negocio, y tu PIN.'; render(); return; }
  // ¿Escribió su WhatsApp? (solo números, con 10 dígitos o más)
  const isPhone = /^[+\d][\d\s()-]*$/.test(raw) && raw.replace(/\D/g,'').length >= 10;
  busy = true; render();
  let slug = slugify(raw);
  if(isPhone){
    const f = await api('POST','/api/owner-login', { phone: normalizePhone(raw), pin: loginForm.pin });
    if(!f.ok){ busy=false; loginError = f.status===401 ? 'El WhatsApp o el PIN no son correctos.' : errMsg(f,'No se pudo entrar.'); render(); return; }
    slug = f.data.slug;
  }
  const r = await loadDashboard(slug, loginForm.pin);
  busy = false;
  if(!r.ok){ loginError = r.status===401 ? 'El código o el PIN no son correctos.' : errMsg(r,'No se pudo entrar.'); render(); return; }
  forgotPin = null;
  loginForm = { slug:'', pin:'' };
  dashboardTab='resumen'; expandedPhone=null; customerSearch='';
  view = 'dashboard';
  render();
}

async function refreshCustomers(opts){
  opts = opts || {};
  if(!session.slug || isExpired()) return;
  const c = await api('GET','/api/businesses/'+enc(session.slug)+'/customers', undefined, session.pin);
  if(c.status===402){ handleAuthError(c); return; }
  if(!(c.ok && Array.isArray(c.data))) return;
  const before = JSON.stringify(cache.customers);
  const newPending = c.data.filter(x=>x.status==='pending').length - pendingCustomers().length;
  cache.customers = c.data;
  if(before === JSON.stringify(cache.customers)) return;
  const el = document.activeElement;
  const typing = el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA');
  if(opts.silent && typing) return;
  if(opts.silent && newPending > 0) showToast(newPending===1 ? 'Nueva solicitud de tarjeta' : newPending+' solicitudes nuevas');
  else render();
}

// El panel se actualiza solo cada 15 segundos para mostrar solicitudes nuevas.
setInterval(()=>{
  if(view==='dashboard' && !busy && !isExpired() && document.visibilityState==='visible') refreshCustomers({silent:true});
}, 15000);
document.addEventListener('visibilitychange', ()=>{
  if(view==='dashboard' && !isExpired() && document.visibilityState==='visible') refreshCustomers({silent:true});
});

async function approveRequest(phone){
  if(busy) return;
  rejectConfirmPhone = null;
  busy=true; render();
  const r = await api('POST','/api/businesses/'+enc(session.slug)+'/customers/'+enc(phone)+'/approve',{}, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo aprobar.')); refreshCustomers(); return; }
  const { bonus:ab, ...approved } = r.data;
  upsertCustomer(approved); delete historyCache[phone];
  dashboardTab='clientes'; expandedPhone=phone; customerSearch='';
  const sp = signupPromo(cache.biz);
  showToast((ab ? (isWalletBiz(cache.biz)?'Tarjeta aprobada con su saldo de bienvenida.':'Tarjeta aprobada con su sello de bienvenida.') : (isWalletBiz(cache.biz)?'Tarjeta aprobada. Ya puedes abonarle sus compras.':'Tarjeta aprobada. Ya puedes darle su sello.')) + (sp ? ' Dale su promoción de registro: '+sp.text+'.' : ''), sp ? 7000 : undefined);
}

let rejectConfirmPhone = null;
async function rejectRequest(phone){
  if(busy) return;
  if(rejectConfirmPhone!==phone){ rejectConfirmPhone = phone; render(); return; }   // primer toque: pide confirmar
  rejectConfirmPhone = null;
  if(scanPhone===phone) scanPhone = null;
  busy=true; render();
  const r = await api('DELETE','/api/businesses/'+enc(session.slug)+'/customers/'+enc(phone), undefined, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo rechazar.')); refreshCustomers(); return; }
  cache.customers = cache.customers.filter(c=>c.phone!==phone);
  showToast('Solicitud rechazada.');
}

function cerrarSesion(){
  if(typeof isSampleView==='function' && isSampleView()){ backToMyAccount(); return; }
  if(isDemoBiz() && !confirm('¿Salir de la demo? Puedes volver cuando quieras desde "Tengo un negocio" → "Seguir con mi demo".')) return;
  demoSheet = null; demoTried = {};
  session = {slug:null, pin:null}; cache = {biz:null, customers:[]};
  team = null; secReport = null; secAlertsCount = 0; scanCtx = null; sheetCode = '';
  store.del('vuelve_session'); store.del('vuelve_sample_return');
  goHome();
}

function handleAuthError(r){
  if(r.status===402){ busy=false; scanPhone=null; loadDashboard(session.slug, session.pin).then(()=>{ view='dashboard'; render(); }); return true; }
  if(r.status===401){ showToast('Tu sesión ya no es válida. Entra de nuevo.'); setTimeout(cerrarSesion, 1200); return true; }
  return false;
}

/* ---------- Dueño o personal ---------- */
function isOwner(){ return !!cache.biz && cache.biz.role !== 'staff'; }

/* ---------- Equipo y seguridad (solo dueño) ---------- */
let team = null;            // { members, hasStaffPin, stampCooldownMin, strictMode, cooldownOptions }
let secReport = null;       // actividad de cada persona y alertas
let secDays = 7;
let secAlertsCount = 0;     // aviso en Resumen
let teamForm = { name:'', pin:'' };
let teamEdit = null;        // { id, name, pin }
let teamError = '';
const COOLDOWN_LABELS = { 30:'30 minutos', 60:'1 hora', 120:'2 horas (recomendado)', 240:'4 horas', 720:'12 horas', 1440:'1 al día' };
function cooldownText(v){ return v===1440 ? 'un sello al día por cliente' : 'un sello cada '+COOLDOWN_LABELS[v].replace(' (recomendado)','')+' por cliente'; }
function toggleCooldown(){
  if(!team) return;
  const on = !team.stampCooldownOn;
  saveSecurity({ stampCooldownOn:on }, on ? 'Límite activado: máximo '+cooldownText(team.stampCooldownMin)+'.' : 'Límite desactivado: se pueden dar sellos seguidos.');
}

function openEquipo(){ dashboardTab='equipo'; teamError=''; teamEdit=null; render(); window.scrollTo(0,0); loadEquipo(); }
function applyTeam(t){
  team = t;
  cache.biz.hasStaffPin = t.hasStaffPin;
  cache.biz.teamCount = t.members.filter(m=>m.active).length;
  cache.biz.strictMode = t.strictMode;
  cache.biz.stampCooldownMin = t.stampCooldownMin;
  cache.biz.stampCooldownOn = t.stampCooldownOn;
}
async function loadEquipo(){
  const base = '/api/businesses/'+enc(session.slug);
  const [t, r] = await Promise.all([
    api('GET', base+'/team', undefined, session.pin),
    api('GET', base+'/security?days='+secDays, undefined, session.pin)
  ]);
  if(!t.ok){ if(handleAuthError(t)) return; showToast(errMsg(t,'No se pudo cargar tu equipo.')); return; }
  applyTeam(t.data);
  if(r.ok){ secReport = r.data; if(secDays===7) secAlertsCount = r.data.alerts.length; }
  render();
}
async function loadSecAlerts(){
  if(!isOwner() || isExpired()) return;
  const r = await api('GET','/api/businesses/'+enc(session.slug)+'/security?days=7', undefined, session.pin);
  if(r.ok){ secAlertsCount = r.data.alerts.length; if(view==='dashboard') render(); }
}
function setSecDays(d){ secDays = d; secReport = null; render(); loadEquipo(); }
async function teamSend(method, path, body, okMsg){
  teamError = '';
  busy = true; render();
  const r = await api(method, '/api/businesses/'+enc(session.slug)+'/team'+path, body, session.pin);
  busy = false;
  if(!r.ok){ if(handleAuthError(r)) return false; teamError = errMsg(r,'No se pudo guardar.'); render(); return false; }
  applyTeam(r.data);
  if(okMsg) showToast(okMsg, 6000); else render();
  return true;
}
async function addMember(){
  const name = teamForm.name.trim(), pin = teamForm.pin;
  if(name.length<2){ teamError='Escribe el nombre de la persona.'; render(); return; }
  if(!/^\d{4,8}$/.test(pin)){ teamError='Su PIN debe ser de 4 a 8 dígitos.'; render(); return; }
  if(await teamSend('POST', '', { name, pin }, 'Listo. '+name+' ya puede entrar con el código '+cache.biz.slug+' y su PIN.')) teamForm = { name:'', pin:'' };
}
function startMemberEdit(id){ const m = team.members.find(x=>x.id===id); teamEdit = { id, name:m.name, pin:'' }; teamError=''; render(); }
async function saveMemberEdit(){
  const e = teamEdit;
  if(e.pin && !/^\d{4,8}$/.test(e.pin)){ teamError='El PIN debe ser de 4 a 8 dígitos.'; render(); return; }
  if(await teamSend('PUT', '/'+e.id, { name:e.name, pin:e.pin||undefined }, e.pin ? 'PIN cambiado. Su celular tendrá que entrar con el nuevo.' : 'Guardado.')) teamEdit = null;
}
async function toggleMember(id, active){
  const m = team.members.find(x=>x.id===id);
  await teamSend('PUT', '/'+id, { active }, active ? m.name+' puede volver a entrar.' : m.name+' ya no puede entrar. Su historial se queda.');
}
async function removeMember(id){
  const m = team.members.find(x=>x.id===id);
  if(!confirm('¿Quitar a '+m.name+' de tu equipo? Ya no podrá entrar. Los sellos que dio seguirán diciendo su nombre.')) return;
  await teamSend('DELETE', '/'+id, undefined, m.name+' ya no está en tu equipo.');
}
async function saveSecurity(patch, okMsg){
  busy = true; render();
  const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/security', patch, session.pin);
  busy = false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo guardar.')); return; }
  const { business, ...t } = r.data;
  applyTeam(t);
  showToast(okMsg || 'Guardado.', 6000);
}
function toggleStrict(){
  if(!team) return;
  if(!team.strictMode && !confirm('¿Encender el modo estricto?\n\nDesde ahora tu equipo solo podrá dar sellos y canjear premios con el código que aparece en la tarjeta del cliente (cambia cada 30 segundos). Avísale a tu equipo antes.')) return;
  saveSecurity({ strictMode: !team.strictMode }, team.strictMode ? 'Modo estricto apagado.' : 'Modo estricto encendido. Comparte las instrucciones con tu equipo.');
}
function staffInstructions(){
  const b = cache.biz;
  return 'Instrucciones para dar sellos en '+b.name+' (modo estricto):\n'
    + '1. Pide al cliente que abra su tarjeta Redeo en su celular (la liga o la página, no una captura).\n'
    + '2. Toca Escanear y apunta a su código. Redeo revisa solo que el código sea de ahorita.\n'
    + '3. Si la cámara no lo lee, busca al cliente por su nombre o teléfono, toca Dar sello y escribe los 6 números que aparecen abajo de su código.\n'
    + '4. El código cambia cada 30 segundos y sirve una sola vez: si te sale "ya se usó" o "ya no es válido", pídele que te muestre el nuevo.\n'
    + '5. Las capturas de pantalla y la tarjeta de Wallet no sirven para dar sellos. Si el cliente no trae su celular, avísale al dueño.';
}

/* ---------- Seguridad (solo dueño) ---------- */
let secForm = { newPin:'', newPin2:'', staffPin:'' };
let secError = '';
async function changeOwnerPin(){
  secError='';
  const a = secForm.newPin, b = secForm.newPin2;
  if(!/^\d{4,8}$/.test(a)){ secError='El PIN nuevo debe ser de 4 a 8 dígitos.'; render(); return; }
  if(a!==b){ secError='Los dos PIN no coinciden.'; render(); return; }
  busy=true; render();
  const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/pin',{ newPin:a }, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; secError = errMsg(r,'No se pudo cambiar el PIN.'); render(); return; }
  session.pin = a; cache.biz.pin = a;
  store.set('vuelve_session', JSON.stringify(session));
  secForm = { newPin:'', newPin2:'', staffPin:'' };
  showToast('PIN cambiado. Los demás celulares tendrán que entrar con el nuevo.');
}
async function saveStaffPin(remove){
  secError='';
  const p = remove ? null : secForm.staffPin;
  if(!remove && !/^\d{4,8}$/.test(p)){ secError='El PIN del personal debe ser de 4 a 8 dígitos.'; render(); return; }
  busy=true; render();
  const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/staff-pin',{ staffPin:p }, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; secError = errMsg(r,'No se pudo guardar el PIN del personal.'); render(); return; }
  cache.biz.hasStaffPin = !!r.data.hasStaffPin;
  if(team) team.hasStaffPin = !!r.data.hasStaffPin;
  secForm.staffPin = '';
  showToast(remove ? 'PIN del personal quitado. Tu equipo ya no puede entrar.' : 'PIN del personal guardado.');
}
