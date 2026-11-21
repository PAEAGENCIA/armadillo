/* Redeo · Negocio: Código de compra (todos los planes).
   El cajero escribe el monto y aparece un QR de un solo uso. El cliente lo escanea con la cámara de su celular
   (en caja, por WhatsApp para pedidos a domicilio o impreso en su ticket) y se suma a su tarjeta. */
let compra = null;   // { step:'form'|'code', form, code, list, listOpen, waOpen, waPhone, timer }
function compraDefaults(){
  const b = cache.biz;
  return { amount: b.mechanic==='sellos' ? 1 : (Number(b.pointsPerVisit)||1), ticket:'', products:[], note:'', days:7 };
}
function openCompra(){
  closeSheet && scanPhone && closeSheet();
  compra = { step:'form', form: compraDefaults(), code:null, list:null, listOpen:false, waOpen:false, waPhone:'', timer:null };
  render(); loadCompraList();
}
function closeCompra(){ if(compra && compra.timer) clearInterval(compra.timer); compra = null; render(); }
async function loadCompraList(){
  const r = await api('GET','/api/businesses/'+enc(session.slug)+'/purchases', undefined, session.pin);
  if(!compra) return;
  if(r.ok){
    compra.list = r.data;
    // Si el código que está en pantalla ya se usó, se avisa al cajero.
    if(compra.code){
      const now = r.data.find(x=>x.code===compra.code.code);
      if(now && now.status!==compra.code.status){
        compra.code = now;
        if(now.status==='used'){ showToast('¡Listo! '+(now.usedBy?firstName(now.usedBy)+' sumó':'Se sumó')+' '+now.text+' a su tarjeta.', 5000); refreshCustomers({silent:true}); }
      }
    }
    render();
  }
}
function compraToggleProduct(p){
  const a = compra.form.products, i = a.indexOf(p);
  if(i>=0) a.splice(i,1); else if(a.length<10) a.push(p);
  render();
}
async function createCompra(){
  if(busy) return;
  const b = cache.biz, f = compra.form, wal = isWalletBiz(b);
  const body = { products: f.products, note: f.note, days: f.days };
  if(wal){ body.ticket = Math.round(Number(f.ticket)); if(!(body.ticket>0)){ showToast('Escribe de cuánto fue la compra.'); return; } }
  else { body.amount = Math.round(Number(f.amount)); if(!(body.amount>0)){ showToast('Escribe cuánto da esta compra.'); return; } }
  busy=true; render();
  const r = await api('POST','/api/businesses/'+enc(session.slug)+'/purchases', body, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo crear el código.')); return; }
  compra.code = r.data; compra.step = 'code'; compra.waOpen = false; compra.waPhone = '';
  if(compra.timer) clearInterval(compra.timer);
  compra.timer = setInterval(()=>{ if(!compra || compra.step!=='code' || !compra.code || compra.code.status!=='ok' || document.visibilityState!=='visible') return; loadCompraList(); }, 4000);
  acadFlag && acadFlag('compra');
  render();
}
async function cancelCompra(code){
  if(!confirm('¿Cancelar este código? Ya no servirá para sumar.')) return;
  const r = await api('DELETE','/api/businesses/'+enc(session.slug)+'/purchases/'+enc(code), undefined, session.pin);
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo cancelar.')); return; }
  if(compra && compra.code && compra.code.code===code) compra.code = r.data;
  showToast('Código cancelado.'); loadCompraList();
}
function compraWhenText(iso){ try{ return new Date(iso).toLocaleDateString('es-MX',{ day:'numeric', month:'long' }); }catch(e){ return ''; } }
function compraMessage(c){
  return `¡Gracias por tu compra en ${cache.biz.name}! 🎉 Suma ${c.text} a tu tarjeta de lealtad aquí: ${c.url}\n(Código ${c.display}, válido hasta el ${compraWhenText(c.expiresAt)}.)`;
}
function sendCompraWa(){
  const c = compra.code, p = normalizePhone(compra.waPhone||'');
  if(compra.waPhone && !isValidPhone(p)){ showToast(phoneMsg('cp-wa','el WhatsApp del cliente')); return; }
  window.open(waLink(isValidPhone(p)?p:'', compraMessage(c)), '_blank');
}
function printCompra(){
  const c = compra.code, b = cache.biz;
  const qr = qrCanvas(c.url, 600, '#000000').toDataURL('image/png');
  const w = window.open('', '_blank');
  if(!w){ showToast('Permite las ventanas emergentes para imprimir.'); return; }
  // Tamaño de ticket (sirve en impresoras de 58 y 80 mm, y también en hoja normal).
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Código ${escapeHtml(c.display)}</title>
<style>@page{margin:4mm}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#000;background:#fff}
.t{width:64mm;margin:0 auto;text-align:center;padding:2mm 0}h1{font-size:15pt;margin:0 0 1mm}p{margin:1mm 0;font-size:9.5pt;line-height:1.3}
img{width:44mm;height:44mm;image-rendering:pixelated;margin:2mm auto;display:block}.code{font:700 15pt/1 ui-monospace,Menlo,monospace;letter-spacing:1px;border:1.5px dashed #000;padding:2mm;margin:2mm 0}
.gana{font-size:12pt;font-weight:800}.s{font-size:8pt;color:#333}</style></head><body><div class="t">
<h1>${escapeHtml(b.name)}</h1><p>Tarjeta de lealtad</p><p class="gana">Suma ${escapeHtml(c.text)}</p>
<img src="${qr}" alt=""><p>Escanéalo con la cámara de tu celular</p><div class="code">${escapeHtml(c.display)}</div>
<p class="s">Válido hasta el ${escapeHtml(compraWhenText(c.expiresAt))}. Un solo uso.${c.note?'<br>'+escapeHtml(c.note):''}</p><p class="s">${escapeHtml(location.host)}</p>
</div><script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  w.document.close();
}

function compraStatusHtml(c){
  const map = { ok:['Sin usar','var(--brand)'], used:['Usado','var(--ok)'], expired:['Vencido','var(--muted)'], canceled:['Cancelado','var(--muted)'] };
  const [t,col] = map[c.status] || ['',''];
  return `<span class="cp-st" style="color:${col}">${t}${c.status==='used'&&c.usedBy?' · '+escapeHtml(firstName(c.usedBy)):''}</span>`;
}
function compraListHtml(){
  const l = compra.list;
  if(!l) return `<p class="muted small">Cargando…</p>`;
  if(!l.length) return `<p class="muted small">Aún no has creado códigos.</p>`;
  return `<div class="cp-list">${l.slice(0,12).map(c=>`<div class="cp-row"><span class="mono">${escapeHtml(c.display)}</span><span style="flex:1;min-width:0"><b class="small">${escapeHtml(c.text)}</b>${c.note?` <span class="muted small">· ${escapeHtml(c.note)}</span>`:''}<span class="muted small" style="display:block">${escapeHtml(c.by)} · ${escapeHtml(fmtWhen(c.createdAt))}</span></span>${compraStatusHtml(c)}${c.status==='ok'?`<button class="linkbtn small" onclick="cancelCompra('${jsEsc(c.code)}')">Cancelar</button>`:''}</div>`).join('')}</div>`;
}

function compraSheetHtml(){
  if(!compra) return '';
  const b = cache.biz, f = compra.form, wal = isWalletBiz(b), isSellos = b.mechanic==='sellos', prods = b.products || [];
  let body;
  if(compra.step==='form'){
    const amountField = wal
      ? `<label class="small" for="cp-ticket" style="font-weight:700;color:var(--ink-2)">¿De cuánto fue la compra?</label>
         <div class="input-icon mt-8">${ic('cash',18)}<input id="cp-ticket" class="input" type="number" inputmode="numeric" min="1" placeholder="0" value="${escapeHtml(String(f.ticket))}" oninput="compra.form.ticket=this.value;var o=document.getElementById('cp-out');if(o)o.innerHTML=walletOutText(this.value)" onkeydown="if(event.key==='Enter')createCompra()"></div>
         <p class="wal-out" id="cp-out">${walletOutText(f.ticket)}</p>`
      : isSellos
        ? `<label class="small" style="font-weight:700;color:var(--ink-2)">¿Cuántos sellos da esta compra?</label>
           <div class="cp-stepper mt-8"><button aria-label="Menos" onclick="compra.form.amount=Math.max(1,compra.form.amount-1);render()">−</button><b>${f.amount}</b><span>${f.amount===1?'sello':'sellos'}</span><button aria-label="Más" onclick="compra.form.amount=Math.min(10,compra.form.amount+1);render()">+</button></div>`
        : `<label class="small" for="cp-amt" style="font-weight:700;color:var(--ink-2)">¿Cuántos puntos da esta compra?</label>
           <input id="cp-amt" class="input mt-8" type="number" inputmode="numeric" min="1" value="${escapeHtml(String(f.amount))}" oninput="compra.form.amount=this.value">`;
    body = `
      <p class="muted small" style="margin:-4px 0 14px">Para pedidos para llevar, a domicilio o cuentas grandes: el cliente lo escanea con su celular y se le suma solo.</p>
      ${amountField}
      ${isPremiumBiz() && prods.length ? `<div class="mt-16"><p class="small" style="font-weight:700;color:var(--ink-2);margin-bottom:8px">¿Qué compró? <span class="muted">(opcional)</span></p><div class="chips">${prods.map(p=>`<button type="button" class="pick ${f.products.includes(p)?'on':''}" onclick="compraToggleProduct('${jsEsc(p)}')">${f.products.includes(p)?ic('check',14):''}${escapeHtml(p)}</button>`).join('')}</div></div>` : ''}
      <div class="field mt-16" style="margin-bottom:0"><label for="cp-note">Referencia <span class="muted">(opcional)</span></label><input id="cp-note" class="input" maxlength="40" placeholder="Ej. Pedido 1042 · Mesa 4" value="${escapeHtml(f.note)}" oninput="compra.form.note=this.value"></div>
      <p class="small mt-16" style="font-weight:700;color:var(--ink-2)">Vence en</p>
      <div class="day-chips mt-8">${[[1,'1 día'],[3,'3 días'],[7,'7 días'],[30,'30 días']].map(([d,l])=>`<button class="day wide ${f.days===d?'on':''}" onclick="compra.form.days=${d};render()">${l}</button>`).join('')}</div>
      <button class="btn btn-primary btn-block mt-16" style="height:56px" ${busy?'disabled':''} onclick="createCompra()">${ic('qr',20)} ${busy?'Creando…':'Crear código'}</button>`;
  }else{
    const c = compra.code, live = c.status==='ok';
    body = `
      <div class="cp-ticket ${live?'':'done'}">
        <div class="cp-gana">${live?'Suma':'Sumó'} <b>${escapeHtml(c.text)}</b>${c.note?`<span class="muted small" style="display:block">${escapeHtml(c.note)}</span>`:''}</div>
        <div class="cp-qr">${qrImg(c.url)}${live?'':`<div class="cp-stamp">${c.status==='used'?ic('check',34)+'<b>Usado</b>':c.status==='canceled'?'<b>Cancelado</b>':'<b>Vencido</b>'}</div>`}</div>
        <div class="cp-code mono">${escapeHtml(c.display)}</div>
        <p class="muted small">${live?'Que lo escanee con la cámara de su celular. Vale hasta el '+escapeHtml(compraWhenText(c.expiresAt))+', una sola vez.':c.status==='used'?escapeHtml((c.usedBy||'El cliente')+' ya lo sumó a su tarjeta.'):'Este código ya no sirve.'}</p>
      </div>
      ${live ? `
      ${compra.waOpen ? `<div class="card mt-12" style="box-shadow:none">
        <div class="field" style="margin:0"><label for="cp-wa">WhatsApp del cliente <span class="muted">(opcional)</span></label>${telField('cp-wa', normalizePhone(compra.waPhone||''), 'compra.waPhone')}<p class="hint">Si lo dejas vacío, eliges el chat en WhatsApp.</p></div>
        <button class="btn btn-wa btn-block mt-12" onclick="sendCompraWa()">${ic('send',18)} Abrir WhatsApp con el mensaje</button></div>`
      : `<button class="btn btn-wa btn-block mt-12" onclick="compra.waOpen=true;render()">${ic('send',18)} Mandar por WhatsApp</button>`}
      <div class="row mt-8" style="gap:8px"><button class="btn btn-secondary" style="flex:1" onclick="printCompra()">${ic('printer',18)} Imprimir ticket</button><button class="btn btn-secondary" style="flex:1" onclick="copyText(compra.code.url,'Liga copiada')">${ic('copy',18)} Copiar liga</button></div>` : ''}
      <button class="btn ${live?'btn-ghost':'btn-primary'} btn-block mt-8" onclick="compra.step='form';compra.form=compraDefaults();render()">${ic('plus',18)} Nuevo código</button>`;
  }
  return `<div class="sheet-bg" onclick="if(event.target===this)closeCompra()"><div class="sheet" role="dialog" aria-label="Código de compra">
    <div class="sheet-grip"></div>
    <div class="row" style="gap:12px;margin-bottom:14px"><span class="choice-icon" style="background:var(--brand-soft);color:var(--brand);width:42px;height:42px">${ic('receipt',22)}</span><div style="flex:1"><div class="biz-name">Código de compra</div><div class="muted small">Cada código queda registrado con quién lo creó</div></div><button class="icon-btn" aria-label="Cerrar" onclick="closeCompra()">${ic('x',18)}</button></div>
    ${body}
    <div class="cp-recent mt-16">
      <button class="linkbtn small" onclick="compra.listOpen=!compra.listOpen;render()">${compra.listOpen?'Ocultar':'Ver'} códigos recientes</button>
      ${compra.listOpen ? `<div class="mt-8">${compraListHtml()}</div>` : ''}
    </div>
  </div></div>`;
}

// Botón grande (Resumen y Clientes)
function compraCtaHtml(){
  return `<button class="scan-cta cp-cta" style="margin-bottom:12px" onclick="openCompra()"><span class="ico">${ic('receipt',22)}</span><span style="flex:1"><b>Código de compra</b><span class="s">Para llevar, a domicilio o en el ticket</span></span>${ic('right')}</button>`;
}
