/* Redeo · Negocio: escanear el QR con la cámara, hoja rápida, Monedero, deshacer y canjear. */
/* ---------- Escanear la tarjeta del cliente con la cámara ---------- */
let scanPhone = null;          // cliente encontrado por el escáner (abre la hoja rápida)
let scanCtx = null;            // tarjeta que se acaba de escanear: { phone, code (código de un uso, si trae), at }
let sheetCode = '';            // código de 6 números escrito a mano (modo estricto)
let scanStream = null;
let scanTimer = null;
let sheetProducts = [];        // productos que compró en esta visita (opcional)
let historyCache = {};         // teléfono -> lista de visitas (o 'loading')

async function loadHistory(phone){
  if(historyCache[phone]) return;
  historyCache[phone] = 'loading';
  const r = await api('GET','/api/businesses/'+enc(session.slug)+'/customers/'+enc(phone)+'/history', undefined, session.pin);
  historyCache[phone] = r.ok && Array.isArray(r.data) ? r.data : [];
  render();
}

function fmtWhen(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX',{ day:'numeric', month:'short' }) + ', ' + d.toLocaleTimeString('es-MX',{ hour:'2-digit', minute:'2-digit' });
  }catch(e){ return ''; }
}

function canUndo(e){
  if(!e.id || e.linked) return false;
  if(isOwner()) return true;
  return Date.now() - new Date(e.at).getTime() <= 15*60*1000;
}
// Quién lo dio y cómo (los movimientos anteriores a esta función no lo tienen)
const METHOD_LABELS = { scan:'escaneado', manual:'a mano', code:'con código de seguridad', compra:'por código de compra' };
function whoHtml(e){
  if(!e.by || e.linked) return '';
  return `<span class="who">${escapeHtml(e.by)}${e.method&&METHOD_LABELS[e.method]?' · '+METHOD_LABELS[e.method]:''}${e.forced?' · antes de tiempo':''}</span>`;
}
function historyHtml(phone){
  const h = historyCache[phone];
  if(!h){ setTimeout(()=>loadHistory(phone), 0); return ''; }
  if(h==='loading') return `<div class="ficha mt-12"><div class="kv"><span class="muted small">Cargando historial…</span></div></div>`;
  const isSellos = cache.biz.mechanic==='sellos', wal = isWalletBiz(cache.biz);
  const items = h.slice(0,10).map(e => `<div class="kv" style="align-items:flex-start">
      <span class="small" style="font-weight:700;color:${e.type==='redeem'?'#8A5B00':'var(--ink)'}">${wal ? (e.type==='redeem' ? 'Usó '+pesos(e.amount)+' de saldo' : '+'+pesos(e.amount)+' de saldo'+(e.ticket?` <span class="muted" style="font-weight:500">· compra de ${pesos(e.ticket)}</span>`:'')) : e.type==='redeem' ? (e.rewardName ? 'Canjeó: '+escapeHtml(e.rewardName)+` <span class="muted" style="font-weight:500">(${e.amount})</span>` : 'Canjeó premio') : '+'+e.amount+' '+(isSellos?(e.amount===1?'sello':'sellos'):'puntos')}${e.reasonLabel?`<span class="bonus-tag">${escapeHtml(e.reasonLabel)}</span>`:''}${e.products&&e.products.length?`<span class="muted" style="display:block;font-weight:500">${escapeHtml(e.products.join(', '))}</span>`:''}${whoHtml(e)}</span>
      <span class="muted small" style="text-align:right;white-space:nowrap">${escapeHtml(fmtWhen(e.at))}${canUndo(e)?`<button class="linkbtn undo-link" onclick="event.stopPropagation();undoMovement('${jsEsc(phone)}',${e.id})">Deshacer</button>`:''}</span>
    </div>`).join('');
  return `<div class="ficha mt-12"><div class="kv"><span class="small" style="font-weight:800">Historial de visitas</span><span class="muted small">${h.length} ${h.length===1?'movimiento':'movimientos'}</span></div>${items || '<div class="kv"><span class="muted small">Aún no tiene visitas registradas</span></div>'}</div>`;
}

function loadJsQR(){
  if(window.jsQR) return Promise.resolve();
  return new Promise((ok, fail)=>{
    const sc = document.createElement('script');
    sc.src = '/jsqr.min.js'; sc.onload = ok; sc.onerror = fail;
    document.head.appendChild(sc);
  });
}

async function openScanner(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    showToast('Este navegador no permite usar la cámara. Busca al cliente por teléfono.'); return;
  }
  closeScanner();
  const box = document.createElement('div');
  box.id = 'scanner';
  box.innerHTML = '<video playsinline muted></video><div class="frame"></div><div class="hint">Apunta al código QR de la tarjeta del cliente</div><button class="close" onclick="closeScanner()">Cancelar</button>';
  document.body.appendChild(box);
  try{
    await loadJsQR();
    scanStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' }, audio:false });
  }catch(e){
    closeScanner();
    showToast('No se pudo abrir la cámara. Revisa el permiso de cámara del navegador.');
    return;
  }
  if(!document.getElementById('scanner')){ closeScanner(); return; }
  const video = box.querySelector('video');
  video.srcObject = scanStream;
  await video.play().catch(()=>{});
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  // Lector nativo (Android/Chrome): lee mejor códigos con poco contraste o desde otra pantalla.
  let detector = null;
  try{
    if('BarcodeDetector' in window){
      const fmts = await window.BarcodeDetector.getSupportedFormats();
      if(fmts.includes('qr_code')) detector = new window.BarcodeDetector({ formats:['qr_code'] });
    }
  }catch(e){ detector = null; }
  let turn = 0;
  const tick = async ()=>{
    if(!scanStream) return;
    if(video.readyState >= 2 && video.videoWidth){
      if(detector){
        try{
          const found = await detector.detect(video);
          if(found && found[0] && found[0].rawValue){ handleScan(found[0].rawValue); return; }
        }catch(e){ detector = null; }
      }
      if(!scanStream) return;
      // Alterna tamaño para leer QR chicos (lejos) y grandes (cerca)
      turn++;
      const w = (turn % 2) ? 640 : 400, h = Math.round(video.videoHeight * (w / video.videoWidth));
      canvas.width = w; canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
      const code = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts:'attemptBoth' });
      if(code && code.data){ handleScan(code.data); return; }
    }
    scanTimer = setTimeout(tick, 120);
  };
  tick();
}

function closeScanner(){
  clearTimeout(scanTimer);
  if(scanStream){ scanStream.getTracks().forEach(t=>t.stop()); scanStream = null; }
  const box = document.getElementById('scanner');
  if(box) box.remove();
}

function handleScan(text){
  closeScanner();
  try{ navigator.vibrate && navigator.vibrate(60); }catch(e){}
  // Sticker de mostrador (redeo.app/s/CODIGO): se conecta a este negocio.
  const stk = stickerCodeFrom(text);
  if(stk){ handleStickerScan(stk); return; }
  if(stickerTarget){ stickerTarget = null; showToast('Ese QR no es un sticker de Redeo.'); return; }
  const m = String(text).trim().match(/^([a-z0-9-]+):(\+?\d{8,15})(?::(\d{6}))?$/);
  if(!m){ showToast('Ese código no es una tarjeta Redeo.'); return; }
  if(m[1] !== session.slug){ showToast('Esa tarjeta es de otro negocio.'); return; }
  const c = cache.customers.find(x=>x.phone===m[2]);
  if(!c){ showToast('No encontramos esa tarjeta. Revisa si la solicitud sigue pendiente.'); refreshCustomers(); return; }
  scanPhone = c.phone; sheetProducts = []; confirmRedeemPhone = null; sheetCode = '';
  scanCtx = { phone:c.phone, code: m[3] || null, at: Date.now() };
  if(needsCode() && !m[3] && c.status!=='pending') showToast('Ese código no trae la clave de seguridad (puede ser una captura o la tarjeta de Wallet). Pide al cliente abrir su tarjeta o dictarte los 6 números.', 7000);
  else render();
}

function openSheet(phone){ scanPhone = phone; sheetProducts = []; confirmRedeemPhone = null; sheetCode = ''; if(!scanCtx || scanCtx.phone!==phone) scanCtx = null; render(); }
function closeSheet(){ rejectConfirmPhone = null; scanPhone = null; sheetProducts = []; confirmRedeemPhone = null; scanCtx = null; sheetCode = ''; render(); }
function toggleSheetProduct(p){
  const i = sheetProducts.indexOf(p);
  if(i>=0) sheetProducts.splice(i,1); else if(sheetProducts.length<10) sheetProducts.push(p);
  render();
}

async function sheetAdd(amount){
  const ok = await addProgress(scanPhone, amount, sheetProducts.slice());
  if(ok) sheetProducts = [];
  render();
}

async function sheetApprove(phone){
  await approveRequest(phone);
  scanPhone = phone;
  render();
}

function scanSheetHtml(){
  if(!scanPhone) return '';
  const c = cache.customers.find(x=>x.phone===scanPhone);
  if(!c) return '';
  const biz = cache.biz, goal = goalOf(biz), isSellos = biz.mechanic==='sellos', wal = isWalletBiz(biz);
  const ready = canRedeem(biz, c);
  const prods = biz.products || [];
  let actions;
  const scannedCode = scanCtx && scanCtx.phone===c.phone && scanCtx.code;
  const codeBox = (needsCode() && c.status!=='pending') ? (scannedCode && !sheetCode
    ? `<div class="code-ok">${ic('check',16)} Tarjeta escaneada con su código de seguridad</div>`
    : `<div class="field" style="margin:0"><label for="sheet-code">Código de seguridad de su tarjeta</label><input id="sheet-code" class="input code-in" type="tel" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="000000" value="${escapeHtml(sheetCode)}" oninput="sheetCode=this.value.replace(/\\D/g,'').slice(0,6);this.value=sheetCode"><p class="hint">Modo estricto: escanea su tarjeta o pídele los 6 números que aparecen abajo de su código (cambian cada 30 segundos).</p></div>`) : '';
  if(c.status==='pending'){
    actions = `${signupStaffHtml()}<div class="row" style="gap:8px">${rejectBtnHtml(c)}<button class="btn btn-primary" style="flex:1" ${busy?'disabled':''} onclick="sheetApprove('${jsEsc(c.phone)}')">${ic('check')} Aprobar tarjeta</button></div>`;
  }else if(wal){
    const picker = prods.length ? `<div><p class="small" style="font-weight:700;color:var(--ink-2);margin-bottom:8px">¿Qué compró? <span class="muted">(opcional)</span></p><div class="chips">${prods.map(p=>`<button type="button" class="pick ${sheetProducts.includes(p)?'on':''}" onclick="toggleSheetProduct('${jsEsc(p)}')">${sheetProducts.includes(p)?ic('check',14):''}${escapeHtml(p)}</button>`).join('')}</div></div>` : '';
    actions = codeBox + picker + walletActionsHtml(c, 'sheet');
  }else if(confirmRedeemPhone===c.phone){
    actions = codeBox + redeemConfirmHtml(c);
  }else{
    const picker = prods.length ? `<div><p class="small" style="font-weight:700;color:var(--ink-2);margin-bottom:8px">¿Qué compró? <span class="muted">(opcional)</span></p><div class="chips">${prods.map(p=>`<button type="button" class="pick ${sheetProducts.includes(p)?'on':''}" onclick="toggleSheetProduct('${jsEsc(p)}')">${sheetProducts.includes(p)?ic('check',14):''}${escapeHtml(p)}</button>`).join('')}</div></div>` : '';
    const add = isSellos
      ? `<button class="btn btn-primary btn-block" style="height:60px;font-size:1.05rem" ${busy?'disabled':''} onclick="sheetAdd(1)">${ic('stamp')} Dar 1 sello</button>`
      : `<div class="row"><input class="input" type="number" min="1" value="${pointsInputs[c.phone]||biz.pointsPerVisit}" style="max-width:110px" oninput="pointsInputs['${jsEsc(c.phone)}']=this.value"><button class="btn btn-primary" style="flex:1" ${busy?'disabled':''} onclick="sheetAdd(Number(pointsInputs['${jsEsc(c.phone)}']||${biz.pointsPerVisit}))">${ic('plus')} Sumar puntos</button></div>`;
    actions = codeBox + picker + add + (ready ? `<button class="btn btn-gold btn-block" ${busy?'disabled':''} onclick="askRedeem('${jsEsc(c.phone)}')">${ic('gift')} ${rewardMenuOf(biz)?'Canjear un premio':'Canjear premio'}</button>` : '');
  }
  return `<div class="sheet-bg" onclick="if(event.target===this)closeSheet()"><div class="sheet" role="dialog" aria-label="Cliente escaneado">
    <div class="sheet-grip"></div>
    <div class="row" style="gap:12px">
      <div class="avatar" style="background:${biz.color};color:${textOn(biz.color)}">${escapeHtml(initialOf(c.name||c.phone))}</div>
      <div style="flex:1;min-width:0"><div class="biz-name">${escapeHtml(c.name||'Sin nombre')}</div><div class="muted small">${escapeHtml(fmtPhone(c.phone))}${c.status==='pending'?' · Solicitud pendiente':''}</div>${c.level && c.level.index ? `<div style="margin-top:4px">${levelChipHtml(c.level)}${c.level.perk?` <span class="muted small">${escapeHtml(c.level.perk)}</span>`:''}</div>` : ''}</div>
      <div style="text-align:right">${wal ? `<div class="stat-num" style="font-size:1.6rem">${pesos(c.progress)}</div><span class="muted small">saldo</span>` : `<div class="stat-num" style="font-size:1.6rem">${c.progress}<span class="muted" style="font-size:1rem">/${goal}</span></div>${ready?'<span class="badge-ready">Premio listo</span>':''}`}</div>
    </div>
    ${wal ? '' : `<div class="mini mt-16" style="height:8px"><span style="width:${Math.min(100,Math.round(c.progress/goal*100))}%;background:${biz.color}"></span></div>`}
    ${c.status!=='pending' && biz.promos && biz.promos.doubleNow && biz.promos.doubleNow.length ? `<div class="promo-now mt-12">${ic('bolt',16)} Hoy ${wal?'el saldo':'el sello'} vale doble: ${escapeHtml(biz.promos.doubleNow.join(' · '))}</div>` : ''}
    ${undoBarHtml(c.phone)}
    <div class="stack mt-16">${actions}</div>
    <div class="row mt-12"><button class="btn btn-secondary" style="flex:1" onclick="closeSheet();openScanner()">${ic('scan',18)} Escanear otro</button><button class="btn btn-ghost" onclick="closeSheet()">Listo</button></div>
  </div></div>`;
}

/* ---------- Monedero: abonar saldo por compra y usar saldo ---------- */
let walletUseAmt = {};
function walletOutText(v){
  const t = Number(v)||0, pct = Number(cache.biz.walletPct)||0;
  return t>0 ? `Se abonan <b>${pesos(walletCredit(cache.biz,t))}</b> de saldo (${pct}% de ${pesos(t)})` : `Se abona el ${pct}% de la compra como saldo a favor.`;
}
function walPreview(id, v){ const el = document.getElementById('walout-'+id); if(el) el.innerHTML = walletOutText(v); }
function walletActionsHtml(c, where){
  const inSheet = where==='sheet', ph = jsEsc(c.phone), id = (inSheet?'s':'l')+c.phone;
  const stop = inSheet ? '' : 'event.stopPropagation();';
  const goCode = !inSheet && needsCode();
  const addCall = goCode ? `openSheet('${ph}')` : inSheet ? `sheetAdd(Number(pointsInputs['${ph}']||0))` : `addProgress('${ph}', Number(pointsInputs['${ph}']||0))`;
  const val = pointsInputs[c.phone] || '';
  const add = `<div onclick="event.stopPropagation()"><label class="small" for="wal-${id}" style="font-weight:700;color:var(--ink-2);margin:0">¿De cuánto fue la compra?</label>
    <div class="wal-calc mt-8"><div class="input-icon" style="flex:1;min-width:0">${ic('cash',18)}<input id="wal-${id}" class="input" type="number" inputmode="numeric" min="1" placeholder="0" value="${escapeHtml(String(val))}" oninput="pointsInputs['${ph}']=this.value;walPreview('${id}',this.value)" onkeydown="if(event.key==='Enter'){${addCall}}"></div>
    <button class="btn btn-primary" style="flex-shrink:0" ${busy?'disabled':''} onclick="${stop}${addCall}">${ic('plus')} Abonar</button></div>
    <p class="wal-out" id="walout-${id}">${walletOutText(val)}</p></div>`;
  let use;
  if(confirmRedeemPhone===c.phone){
    const amt = walletUseAmt[c.phone] != null ? walletUseAmt[c.phone] : c.progress;
    use = `<div class="card" style="box-shadow:none" onclick="event.stopPropagation()"><p style="font-weight:700">¿Cuánto saldo va a usar?</p><p class="muted small mt-8">Tiene ${pesos(c.progress)}. Descuéntalo del total de su compra.</p>
      <div class="input-icon mt-12">${ic('cash',18)}<input class="input" type="number" inputmode="numeric" min="1" max="${c.progress}" value="${escapeHtml(String(amt))}" oninput="walletUseAmt['${ph}']=this.value"></div>
      <div class="row mt-16"><button class="btn btn-gold" style="flex:1" ${busy?'disabled':''} onclick="confirmRedeem('${ph}')">Sí, descontar</button><button class="btn btn-ghost" onclick="cancelRedeem()">Cancelar</button></div></div>`;
  }else{
    use = c.progress>0 ? `<button class="btn btn-gold btn-block" ${busy?'disabled':''} onclick="${stop}${goCode?`openSheet('${ph}')`:`walletUseAmt['${ph}']=null;askRedeem('${ph}')`}">${ic('gift')} Usar saldo · tiene ${pesos(c.progress)}</button>`
      : `<button class="btn btn-secondary btn-block" disabled>${ic('gift')} Aún no tiene saldo</button>`;
  }
  return add + use;
}
function askRedeem(phone){ confirmRedeemPhone = phone; render(); }
function cancelRedeem(){ confirmRedeemPhone = null; render(); }

/* ---------- Deshacer un movimiento ---------- */
let lastAction = null;   // último sello o canje hecho desde este celular
async function undoMovement(phone, historyId){
  if(busy) return;
  if(!confirm('¿Deshacer este movimiento? Se quitan también los sellos extra que haya generado.')) return;
  busy=true; render();
  const r = await api('POST','/api/businesses/'+enc(session.slug)+'/customers/'+enc(phone)+'/undo/'+historyId,{}, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo deshacer.')); render(); return; }
  const { undone, affected, ...cust } = r.data;
  upsertCustomer(cust);
  delete historyCache[phone]; (affected||[]).forEach(p=>delete historyCache[p]);
  if(lastAction && lastAction.historyId===historyId) lastAction = null;
  if((affected||[]).length) refreshCustomers({silent:true});
  showToast('Listo, se deshizo el movimiento.');
}
function undoBarHtml(phone){
  if(!lastAction || lastAction.phone!==phone || !lastAction.historyId) return '';
  if(Date.now() - lastAction.at > 15*60*1000) return '';
  return `<div class="undo-bar" onclick="event.stopPropagation()">${ic('check',16)}<span style="flex:1">${escapeHtml(lastAction.label)}</span><button class="linkbtn" ${busy?'disabled':''} onclick="undoMovement('${jsEsc(phone)}',${lastAction.historyId})">Deshacer</button></div>`;
}

async function confirmRedeem(phone){
  if(busy) return;
  busy=true; render();
  const wal = isWalletBiz(cache.biz);
  const cur = cache.customers.find(x=>x.phone===phone) || {};
  const useAmt = wal ? Math.round(Number(walletUseAmt[phone] != null ? walletUseAmt[phone] : cur.progress)) : null;
  if(wal && !(useAmt>0)){ busy=false; showToast('Escribe cuánto saldo va a usar.'); render(); return; }
  const menu = !wal && rewardMenuOf(cache.biz);
  if(menu && !redeemPick[phone]){ busy=false; showToast('Elige qué premio se lleva.'); render(); return; }
  const r = await api('POST','/api/businesses/'+enc(session.slug)+'/customers/'+enc(phone)+'/redeem', { ...accessBody(phone), ...(wal?{ amount:useAmt }:{}), ...(menu?{ rewardId: redeemPick[phone] }:{}) }, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; if(handleAccessError(r, phone)) return; showToast(errMsg(r,'No se pudo canjear.')); render(); return; }
  confirmRedeemPhone=null;
  const { historyId, rewardName, ...redeemed } = r.data;
  upsertCustomer(redeemed);
  delete historyCache[phone]; delete walletUseAmt[phone]; delete redeemPick[phone];
  lastAction = { phone, historyId, at: Date.now(), label: wal ? 'Usó '+pesos(useAmt)+' de saldo' : rewardName ? 'Canjeó: '+rewardName : 'Premio canjeado' };
  showToast(wal ? 'Listo: se descontaron '+pesos(useAmt)+'. Le quedan '+pesos(redeemed.progress)+'.' : rewardName ? 'Canjeó '+rewardName+'. Le quedan '+redeemed.progress+' '+(cache.biz.mechanic==='sellos'?'sellos':'puntos')+'.' : 'Premio canjeado.');
  render();
}
