/* Redeo · Administración P.A.E.: entrar, respaldo, plan, borrar y vigencia de negocios. */
/* ---------- Administración P.A.E. (clave de administrador, no se guarda en el celular) ---------- */
let adminKey = '';
let adminData = null;
let adminError = '';

async function adminLogin(){
  adminError='';
  if(!adminKey.trim()){ adminError='Escribe tu clave de administrador.'; render(); return; }
  busy=true; render();
  const r = await adminFetch('/api/admin/summary');
  busy=false;
  if(!r.ok){ adminError = r.error; render(); return; }
  adminData = r.data;
  render();
  if(adminTab==='prospectos') loadLeads();
}

async function adminFetch(path){
  try{
    const res = await fetch(path, { headers:{ 'x-admin-key': adminKey.trim() } });
    if(!res.ok){ let e={}; try{ e=await res.json(); }catch(x){} return { ok:false, error:e.error||'No se pudo conectar.' }; }
    return { ok:true, data: await res.json() };
  }catch(e){ return { ok:false, error:'No hay conexión con el servidor.' }; }
}

async function adminBackup(){
  busy=true; render();
  try{
    const res = await fetch('/api/admin/backup', { headers:{ 'x-admin-key': adminKey.trim() } });
    if(!res.ok){ busy=false; showToast('No se pudo generar el respaldo.'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'vuelve-respaldo-'+new Date().toISOString().slice(0,10)+'.db';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
    busy=false;
    showToast('Respaldo descargado. Guárdalo en Google Drive.');
  }catch(e){ busy=false; showToast('No se pudo generar el respaldo.'); }
}

function sheetsCardHtml(sheets){
  if(!sheets){
    return `<div class="card mt-12">
      <div class="card-title">${ic('sheet',18)} Google Sheets</div>
      <p class="muted small">Para ver todo en Google Sheets, agrega en Railway la variable <span class="mono">SHEETS_KEY</span> con una clave larga inventada, espera a que se actualice y vuelve a entrar aquí.</p>
    </div>`;
  }
  const f1 = '=IMPORTDATA("'+sheets.negocios+'")';
  const f2 = '=IMPORTDATA("'+sheets.clientes+'")';
  const f3 = sheets.visitas ? '=IMPORTDATA("'+sheets.visitas+'")' : '';
  const f4 = sheets.prospectos ? '=IMPORTDATA("'+sheets.prospectos+'")' : '';
  return `<div class="card mt-12">
    <div class="card-title">${ic('sheet',18)} Google Sheets</div>
    <p class="muted small">Pega cada fórmula en la celda A1 de su pestaña. La hoja se llena sola y se actualiza cada hora aproximadamente. No compartas estas fórmulas: incluyen datos de clientes.</p>
    <div class="kv"><span class="small" style="font-weight:700">Pestaña Negocios</span><button class="btn btn-secondary btn-sm" onclick="copyText('${escapeHtml(jsEsc(f1))}','Fórmula de Negocios copiada')">${ic('copy',16)} Copiar fórmula</button></div>
    <div class="kv"><span class="small" style="font-weight:700">Pestaña Clientes</span><button class="btn btn-secondary btn-sm" onclick="copyText('${escapeHtml(jsEsc(f2))}','Fórmula de Clientes copiada')">${ic('copy',16)} Copiar fórmula</button></div>
    ${f4?`<div class="kv"><span class="small" style="font-weight:700">Pestaña Prospectos</span><button class="btn btn-secondary btn-sm" onclick="copyText('${escapeHtml(jsEsc(f4))}','Fórmula de Prospectos copiada')">${ic('copy',16)} Copiar fórmula</button></div>`:''}
    ${f3?`<div class="kv"><span class="small" style="font-weight:700">Pestaña Visitas</span><button class="btn btn-secondary btn-sm" onclick="copyText('${escapeHtml(jsEsc(f3))}','Fórmula de Visitas copiada')">${ic('copy',16)} Copiar fórmula</button></div>`:''}
    <a class="btn btn-secondary btn-block mt-12" style="text-decoration:none" href="https://sheets.new" target="_blank" rel="noopener">${ic('plus',18)} Crear Google Sheet nuevo</a>
  </div>`;
}

async function adminSetPlan(slug, plan){
  if(plan==='esencial' && !confirm('¿Pasar este negocio a Esencial? Su diseño se guarda y regresa si vuelve a Premium.')) return;
  busy=true; render();
  try{
    const res = await fetch('/api/admin/businesses/'+enc(slug)+'/plan', { method:'PUT', headers:{ 'x-admin-key': adminKey.trim(), 'Content-Type':'application/json' }, body: JSON.stringify({ plan }) });
    busy=false;
    if(!res.ok){ showToast('No se pudo cambiar el plan.'); render(); return; }
    await adminReload();
    showToast(plan==='premium' ? 'Negocio en Premium.' : 'Negocio en Esencial.');
  }catch(e){ busy=false; showToast('No hay conexión con el servidor.'); }
}

let adminNewPins = {};
let deleteSlug = null, deleteText = '';
async function adminDelete(slug){
  if(deleteText.trim()!==slug){ showToast('Escribe el código exacto para confirmar.'); return; }
  busy=true; render();
  try{
    const res = await fetch('/api/admin/businesses/'+enc(slug), { method:'DELETE', headers:{ 'x-admin-key': adminKey.trim(), 'Content-Type':'application/json' }, body: JSON.stringify({ confirm: deleteText.trim() }) });
    const data = await res.json().catch(()=>({}));
    busy=false;
    if(!res.ok){ showToast(data.error || 'No se pudo borrar.'); return; }
    adminData.businesses = (adminData.businesses||[]).filter(b=>b.slug!==slug);
    deleteSlug=null; deleteText=''; adminBiz=null;
    adminReload();
    showToast('Negocio borrado.');
  }catch(e){ busy=false; showToast('No hay conexión con el servidor.'); }
}
function deleteBoxHtml(b){
  if(deleteSlug!==b.slug) return `<button class="btn btn-ghost btn-sm" style="flex-basis:100%;color:var(--danger)" onclick="deleteSlug='${jsEsc(b.slug)}';deleteText='';render()">${ic('x',16)} Borrar negocio</button>`;
  return `<div class="share-card" style="flex-basis:100%;border-color:#F6C9C3;background:#FDF3F1">
    <p class="small" style="font-weight:800;color:var(--danger)">¿Borrar "${escapeHtml(b.name)}" para siempre?</p>
    <p class="muted small" style="margin:4px 0 10px">Se borran el negocio, sus ${b.customers} clientes, sus sellos y su historial. No se puede deshacer. Si tienes duda, primero descarga el respaldo.</p>
    <label class="small">Escribe <b class="mono">${escapeHtml(b.slug)}</b> para confirmar</label>
    <input class="input mono" autocapitalize="none" autocomplete="off" value="${escapeHtml(deleteText)}" oninput="deleteText=this.value">
    <div class="row mt-12" style="gap:8px"><button class="btn btn-danger btn-sm" style="flex:1" ${busy?'disabled':''} onclick="adminDelete('${jsEsc(b.slug)}')">Borrar para siempre</button><button class="btn btn-ghost btn-sm" onclick="deleteSlug=null;deleteText='';render()">Cancelar</button></div>
  </div>`;
}
let accessEdit = null;            // slug del negocio cuya fecha se está editando
let accessForm = { type:'paid', until:'' };
async function adminAccess(slug, body, okMsg){
  busy=true; render();
  try{
    const res = await fetch('/api/admin/businesses/'+enc(slug)+'/access', { method:'PUT', headers:{ 'x-admin-key': adminKey.trim(), 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(()=>({}));
    busy=false;
    if(!res.ok){ showToast(data.error || 'No se pudo guardar.'); return; }
    accessEdit = null;
    await adminReload();
    showToast(okMsg);
  }catch(e){ busy=false; showToast('No hay conexión con el servidor.'); }
}
function accessPillHtml(a){
  if(!a || a.type==='none') return `<span class="acc-pill">Sin fecha límite</span>`;
  if(a.expired) return `<span class="acc-pill off">${a.type==='paid'?'Vencido':'Prueba terminada'} · ${fmtYmd(a.until)}</span>`;
  return `<span class="acc-pill ${a.type==='paid'?'paid':'trial'} ${a.daysLeft<=5?'warn':''}">${a.type==='paid'?'Pagado':'Prueba'} · ${a.daysLeft} ${a.daysLeft===1?'día':'días'} · hasta ${fmtYmd(a.until)}</span>`;
}
function accessEditorHtml(b){
  if(accessEdit!==b.slug){
    return `<div class="row" style="flex-basis:100%;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" style="flex:1" ${busy?'disabled':''} onclick="accessEdit='${jsEsc(b.slug)}';accessForm={type:'${b.access&&b.access.type==='trial'?'trial':'paid'}',until:'${jsEsc((b.access&&b.access.until)||adminData.today||'')}'};render()">${ic('clock',16)} Cambiar fecha a mano</button>
    </div>`;
  }
  return `<div class="share-card" style="flex-basis:100%">
    <div class="seg"><button class="${accessForm.type==='paid'?'on':''}" onclick="accessForm.type='paid';render()">Pagado</button><button class="${accessForm.type==='trial'?'on':''}" onclick="accessForm.type='trial';render()">Prueba</button></div>
    <label class="mt-12">Último día con servicio</label>
    <input class="input" type="date" value="${escapeHtml(accessForm.until)}" onchange="accessForm.until=this.value">
    <div class="row mt-12" style="gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" style="flex:1" ${busy?'disabled':''} onclick="adminAccess('${jsEsc(b.slug)}',{action:'set',type:accessForm.type,until:accessForm.until},'Fecha guardada.')">Guardar</button>
      <button class="btn btn-secondary btn-sm" ${busy?'disabled':''} onclick="adminAccess('${jsEsc(b.slug)}',{action:'trial',days:14},'Prueba de 14 días desde hoy.')">Prueba 14 días</button>
      <button class="btn btn-ghost btn-sm" ${busy?'disabled':''} onclick="adminAccess('${jsEsc(b.slug)}',{action:'none'},'Sin fecha límite.')">Sin límite</button>
      <button class="btn btn-ghost btn-sm" onclick="accessEdit=null;render()">Cancelar</button>
    </div>
  </div>`;
}
async function adminResetPin(slug){
  if(!confirm('¿Restablecer el PIN del dueño? Se genera uno nuevo y todos sus celulares se salen de su panel.')) return;
  busy=true; render();
  try{
    const res = await fetch('/api/admin/businesses/'+enc(slug)+'/pin', { method:'PUT', headers:{ 'x-admin-key': adminKey.trim() } });
    const data = await res.json().catch(()=>({}));
    busy=false;
    if(!res.ok || !data.pin){ showToast(data.error || 'No se pudo restablecer el PIN.'); return; }
    adminNewPins[slug] = data.pin;
    showToast('PIN nuevo listo. Dáselo al dueño.');
  }catch(e){ busy=false; showToast('No hay conexión con el servidor.'); }
}

function adminExit(){ adminKey=''; adminData=null; adminError=''; adminNewPins={}; adminBiz=null; adminPay=null; adminPayments={}; recentPayments=null; lastPayment=null; adminTab='prospectos'; adminLeads=null; leadApprove=null; leadResult=null; goHome(); }

function viewAdminPae(){
  if(!adminData){
    return `
    <div class="wrap fade">
      ${backHtml('adminExit()')}
      <h2 class="mt-12">Administración P.A.E.</h2>
      <p class="lead">Todos tus negocios y el respaldo completo de la información.</p>
      <div class="card mt-24">
        <div class="field"><label for="a-key">Clave de administrador</label><input id="a-key" class="input" type="password" autocomplete="off" value="${escapeHtml(adminKey)}" oninput="adminKey=this.value" onkeydown="if(event.key==='Enter')adminLogin()"></div>
        ${errorHtml(adminError)}
      </div>
      <button class="btn btn-primary btn-block mt-24" ${busy?'disabled':''} onclick="adminLogin()">${busy?'Entrando…':'Entrar'}</button>
    </div>`;
  }
  return adminPay ? adminPayView() : adminBiz ? adminBizView() : adminHome();
}
