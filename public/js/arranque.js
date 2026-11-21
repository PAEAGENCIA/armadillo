/* Redeo · Arranque: lee la liga, abre la vista correcta y pinta la pantalla. Va SIEMPRE al final. */
/* ---------- Dominio principal (2.4) ----------
   Si la app se abre desde otro dominio (por ejemplo vuelvecard.app) y en Railway está PUBLIC_URL (https://redeo.app),
   se pasa sola al dominio principal. Si el cliente tiene su tarjeta guardada en este celular, se lleva su liga personal
   para que no tenga que volver a abrirla con su cumpleaños. El panel no se lleva el PIN: el dueño entra de nuevo. */
function goToMainDomain(){
  try{
    const main = new URL(serverConfig && serverConfig.publicUrl);
    if(main.origin === location.origin || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return false;
    const params = new URLSearchParams(location.search);
    const n = params.get('n') ? slugify(params.get('n')) : '';
    if(n && !params.get('t')){
      const card = getCard(n);
      if(card){ params.set('c', card.phone); params.set('t', card.token); }
    }else if(!location.search && location.pathname==='/'){
      try{ const s = JSON.parse(store.get('vuelve_session')||'null'); if(s && s.slug) params.set('panel', s.slug); }catch(e){}
    }
    const q = params.toString();
    location.replace(main.origin + location.pathname + (q ? '?'+q : '') + location.hash);
    return true;
  }catch(e){ return false; }
}

/* ---------- Arranque ---------- */
async function boot(){
  const cfg = await api('GET','/api/config');
  if(cfg.ok) serverConfig = cfg.data;
  if(goToMainDomain()) return;

  const params = new URLSearchParams(location.search);
  const docId = params.get('doc');
  if(docId && window.VuelveLegal && VuelveLegal.TITLES[docId]){
    let biz = null;
    if(VuelveLegal.NEEDS_BIZ[docId]){
      const slug = slugify(params.get('n')||'');
      const r = slug ? await api('GET','/api/businesses/'+enc(slug)) : { ok:false };
      if(!r.ok){ legalPage = { id:docId, error:true }; view='legalPage'; render(); return; }
      biz = r.data;
    }
    legalPage = { id:docId, biz };
    document.title = VuelveLegal.TITLES[docId] + (biz ? ' · '+biz.name : ' · Redeo');
    view = 'legalPage'; render(); return;
  }
  // Sticker de mostrador que todavía no está conectado: /?sticker=CODIGO
  const stk = String(params.get('sticker')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(stk){ history.replaceState(null,'','/?sticker='+stk); await openStickerPage(stk); return; }
  const n = params.get('n');
  if(n){
    const slug = slugify(n);
    clienteLookup.slug = slug;
    const ref = normalizePhone(params.get('ref')||'');
    if(isValidPhone(ref)){ requestForm.ref = ref; requestForm.refLink = true; requestForm.source = requestForm.source || 'recomendacion'; }     // viene de la invitación de un amigo
    // Liga personal del cliente: /?n=negocio&c=telefono&t=clave
    const lc = normalizePhone(params.get('c')||''), lt = params.get('t');
    let clean = params.has('app');
    if(isValidPhone(lc) && lt){
      const kept = setCard(slug, lc, lt);
      if(kept) clean = true;                             // quita la clave de la barra de direcciones
    }
    // Código de compra (lo escaneó del ticket o le llegó por WhatsApp): /?n=negocio&compra=K7P29QXM
    const compraCode = String(params.get('compra')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(compraCode.length===8){ await loadCompraInfo(slug, compraCode); clean = true; }
    if(clean) history.replaceState(null,'','/?n='+enc(slug)+(requestForm.ref?'&ref='+enc(requestForm.ref):''));
    const card = getCard(slug);
    const saved = card ? card.phone : store.get('vuelve_tel_'+slug);
    if(saved){ clienteLookup.phone = saved; await buscarTarjetaCliente(); return; }
    const pb = await api('GET','/api/businesses/'+enc(slug));
    if(pb.ok) clientePreview = pb.data;
    view = 'clienteBuscar'; render(); return;
  }

  let saved = null;
  try{ saved = JSON.parse(store.get('vuelve_session')||'null'); }catch(e){}
  // Panel instalado como app ("Mi negocio"): /?panel=negocio
  const panelSlug = slugify(params.get('panel')||'');
  if(params.has('panel') || params.has('app')) history.replaceState(null,'','/');
  if(params.has('panel') && !(saved && saved.slug===panelSlug && saved.pin)){
    loginForm.slug = panelSlug; view = 'negocioEntrar'; render(); return;
  }
  if(saved && saved.slug && saved.pin){
    busy = true; render();
    const r = await loadDashboard(saved.slug, saved.pin);
    busy = false;
    if(r.ok){ dashboardTab='resumen'; view='dashboard'; render(); return; }
    store.del('vuelve_session');
  }
  render();
}

// Las acciones del panel dejan marca para las misiones que no se pueden contar con datos.
(function acadHooks(){
  const wrap = (name, fn) => {
    const orig = window[name];
    if(typeof orig !== 'function') return;
    window[name] = function(){ try{ fn.apply(this, arguments); }catch(e){} return orig.apply(this, arguments); };
  };
  wrap('openScanner', () => acadFlag('scan'));
  wrap('whatsappCard', () => acadFlag('wa_card'));
  wrap('approveRequest', () => acadFlag('approve'));
  wrap('undoMovement', () => acadFlag('undo'));
  wrap('downloadCustomers', () => acadFlag('download'));
  wrap('waOpen', () => acadFlag(crecerSub==='birthdays' ? 'wa_bday' : 'wa_inactive'));
  wrap('setCrecerSub', (k) => { if(k==='report') acadFlag('report'); });
  wrap('shareLink', () => acadFlag('share'));
  wrap('downloadQR', () => acadFlag('share'));
})();

/* ---------- Render principal ---------- */
function render(){
  let html;
  switch(view){
    case 'negocioAuth': html = viewNegocioAuth(); break;
    case 'negocioCrear': html = viewNegocioCrear(); break;
    case 'demoForm': html = viewDemoForm(); break;
    case 'negocioExito': html = viewNegocioExito(); break;
    case 'negocioEntrar': html = viewNegocioEntrar(); break;
    case 'dashboard': html = viewDashboard(); break;
    case 'membresia': html = viewMembresia(); break;
    case 'clienteBuscar': html = viewClienteBuscar(); break;
    case 'clienteTarjeta': html = viewClienteTarjeta(); break;
    case 'cargando': html = viewCargando(); break;
    case 'adminPae': html = viewAdminPae(); break;
    case 'legalPage': html = viewLegalPage(); break;
    case 'sticker': html = viewSticker(); break;
    default: html = viewHome();
  }
  document.getElementById('app').innerHTML = `<div class="app-shell">${html}</div>${view==='dashboard'?scanSheetHtml()+demoSheetHtml()+compraSheetHtml():''}${installSheetHtml()}${toastHtml()}`;
  hydrateQR();
  // Redeo 2.0: app instalable
  updateAppHead();
  if(view==='clienteTarjeta') maybeOfferInstall();
  if(view==='dashboard') ensureAppIcon();
  if(view==='dashboard') acadCelebrate();
  if(view==='home') lpMount();
}
view = 'cargando';
registerServiceWorker();
render();
boot().then(()=>{ if(view==='cargando'){ view='home'; render(); } });
