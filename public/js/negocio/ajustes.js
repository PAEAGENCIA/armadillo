/* Redeo · Negocio: guardar ajustes, productos, logo y descargar clientes (acciones). */
/* ---------- Acciones: configuración ---------- */
function openConfig(){
  legalForm = null; legalError = ''; locForm = null;
  configForm = JSON.parse(JSON.stringify(cache.biz));
  configSaved = false;
  dashboardTab = 'config';
  render();
}
function addProduct(){
  const t = productDraft.trim().slice(0,30);
  if(!t) return;
  configForm.products = configForm.products || [];
  if(configForm.products.some(p=>p.toLowerCase()===t.toLowerCase())){ showToast('Ese producto ya está en la lista.'); return; }
  if(configForm.products.length>=12){ showToast('Máximo 12 productos.'); return; }
  configForm.products.push(t);
  productDraft='';
  render();
  const i=document.getElementById('c-prod'); if(i) i.focus();
}

async function downloadCustomers(){
  try{
    const res = await fetch('/api/businesses/'+enc(session.slug)+'/customers/export.csv', { headers:{ 'x-business-pin': session.pin } });
    if(!res.ok){ showToast('No se pudo descargar.'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'clientes-'+session.slug+'.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
    showToast('Descarga lista.');
  }catch(e){ showToast('No se pudo descargar.'); }
}

// Reduce la imagen a 256 px (suficiente para la tarjeta) antes de subirla
function prepareLogo(file){
  return new Promise((ok, fail)=>{
    if(!file || !/^image\//.test(file.type)){ fail(new Error('Elige una imagen.')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{
      const max = 256, k = Math.min(1, max/Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width*k)); c.height = Math.max(1, Math.round(img.height*k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let data = c.toDataURL('image/png');
      if(data.length*0.75 > 190*1024) data = c.toDataURL('image/webp', 0.9);
      if(!/^data:image\/(png|webp)/.test(data) || data.length*0.75 > 190*1024) data = c.toDataURL('image/jpeg', 0.88);
      ok(data);
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); fail(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

async function uploadLogo(file){
  if(!file) return;
  let image;
  try{ image = await prepareLogo(file); }catch(e){ showToast(e.message); return; }
  busy=true; render();
  const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/logo',{ image }, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo subir el logo.')); return; }
  cache.biz = { ...cache.biz, ...r.data, pin:session.pin };
  showToast('Logo actualizado.');
}

async function removeLogo(){
  busy=true; render();
  const r = await api('DELETE','/api/businesses/'+enc(session.slug)+'/logo', undefined, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo quitar el logo.')); return; }
  cache.biz = { ...cache.biz, ...r.data, pin:session.pin };
  showToast('Logo quitado.');
}

async function saveConfig(){
  if(!String(configForm.rewardDesc||'').trim()){ showToast('El premio no puede quedar vacío.'); return; }
  busy=true; render();
  const isSellos = cache.biz.mechanic==='sellos';
  const body = { rewardDesc:configForm.rewardDesc.trim(), color:configForm.color };
  if(isPremiumBiz()){
    body.products = configForm.products||[];
    body.stampIcon = configForm.stampIcon || 'check';
    body.cardTitle = String(configForm.cardTitle||'').trim();
    body.cardStyle = configForm.cardStyle || 'gradient';
    if(!isWalletBiz(cache.biz)) body.rewards = (configForm.rewardExtras||[]).map(r=>({ id:r.id, name:r.name, cost:Number(r.cost) }));
  }
  if(isSellos) body.stampsGoal = Number(configForm.stampsGoal);
  else if(isWalletBiz(cache.biz)){ body.walletPct = Number(configForm.walletPct); body.walletBonus = Number(configForm.pointsPerVisit); body.rewardDesc = body.walletPct+'% de cada compra en saldo'; }
  else { body.pointsGoal = Number(configForm.pointsGoal); body.pointsPerVisit = Number(configForm.pointsPerVisit); }
  const r = await api('PUT','/api/businesses/'+enc(session.slug), body, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudieron guardar los cambios.')); return; }
  cache.biz = { ...r.data, pin:session.pin };
  configForm = JSON.parse(JSON.stringify(cache.biz));
  configSaved = true;
  setOnbFlag('premio');
  showToast('Cambios guardados.');
}
