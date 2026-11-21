/* Redeo · Cliente: sumar un código de compra a su tarjeta (lo escaneó del ticket, del celular del cajero o le llegó por WhatsApp). */
let compraPending = null;   // { slug, code, info, done, error, busy }
let compraInput = '';       // código escrito a mano en la tarjeta
let compraFormOpen = false;

async function loadCompraInfo(slug, code){
  compraPending = { slug, code, info:null, done:null, error:null, busy:false };
  const r = await api('GET','/api/businesses/'+enc(slug)+'/purchases/'+enc(code));
  if(!compraPending) return;
  if(r.ok && r.data.status==='ok') compraPending.info = r.data;
  else compraPending.error = errMsg(r, 'Ese código no es válido.');
}

// Se llama cuando la tarjeta del cliente ya está abierta (con su clave). Suma la compra sola.
async function maybeClaimCompra(){
  const P = compraPending, R = clienteResult;
  if(!P || P.done || P.busy || P.error || !R || !R.biz || R.biz.slug!==P.slug) return;
  if(!(R.status==='found' || R.status==='pending') || !R.token || !R.customer) return;
  P.busy = true; render();
  const r = await api('POST','/api/businesses/'+enc(P.slug)+'/purchases/'+enc(P.code)+'/claim', { phone: R.customer.phone }, null, { 'x-card-token': R.token });
  P.busy = false;
  if(!r.ok){ P.error = errMsg(r,'No se pudo sumar tu compra.'); render(); return; }
  P.done = r.data;
  // Vuelve a leer la tarjeta para mostrar lo nuevo.
  const c = await api('GET','/api/businesses/'+enc(P.slug)+'/customers/'+enc(R.customer.phone), undefined, null, { 'x-card-token': R.token });
  if(c.ok && !c.data.locked) clienteResult = { ...R, status: c.data.status==='pending'?'pending':'found', customer:{ phone:R.customer.phone, ...c.data } };
  try{ navigator.vibrate && navigator.vibrate([40,60,40]); }catch(e){}
  render();
}

async function submitCompraInput(){
  const code = String(compraInput||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length!==8){ showToast('El código tiene 8 letras y números (ej. K7P2-9QXM).'); return; }
  const slug = clienteResult.biz.slug;
  await loadCompraInfo(slug, code);
  compraInput = ''; compraFormOpen = false;
  if(compraPending.error){ render(); return; }
  maybeClaimCompra();
}

// Aviso arriba de la tarjeta (o del formulario) mientras hay una compra por sumar o recién sumada.
function compraBannerHtml(where){
  const P = compraPending;
  if(!P) return '';
  if(P.error) return `<div class="cp-banner err mt-16">${ic('info',20)}<span><b>No se pudo sumar tu compra.</b> ${escapeHtml(P.error)}</span><button class="linkbtn" onclick="compraPending=null;render()">${ic('x',16)}</button></div>`;
  if(P.done){
    const d = P.done;
    return `<div class="cp-banner ok mt-16 pop">${ic('check',22)}<span><b>¡Listo! Se ${d.amount===1?'sumó':'sumaron'} ${escapeHtml(d.text)} por tu compra.</b>${d.bonus?' Hoy vale doble: '+escapeHtml(d.bonus.reasons.join(' · '))+'.':''}${d.levelBonus?' +'+d.levelBonus+' por tu nivel.':''}${d.levelUp?` <br>¡Subiste a <b>${escapeHtml(d.levelUp.name)}</b>!`:''}${d.activated?' Tu tarjeta ya está activa.':''}</span><button class="linkbtn" aria-label="Cerrar" onclick="compraPending=null;render()">${ic('x',16)}</button></div>`;
  }
  const what = P.info ? escapeHtml(P.info.text) : 'tu compra';
  if(P.busy) return `<div class="cp-banner mt-16">${ic('receipt',20)}<span>Sumando ${what} a tu tarjeta…</span></div>`;
  if(where==='no_card') return `<div class="cp-banner mt-16">${ic('receipt',20)}<span><b>Tienes ${what} por tu compra.</b> Pide tu tarjeta y se suma al momento, sin esperar aprobación.</span></div>`;
  if(where==='locked') return `<div class="cp-banner mt-16">${ic('receipt',20)}<span><b>Tienes ${what} por tu compra.</b> Confirma tu cumpleaños para sumarla.</span></div>`;
  return `<div class="cp-banner mt-16">${ic('receipt',20)}<span><b>Tienes ${what} por tu compra.</b> Escribe tu número de WhatsApp para sumarla a tu tarjeta.</span></div>`;
}

// En la tarjeta: "¿Tienes un código de compra?"
function compraEntryHtml(){
  if(compraFormOpen) return `<div class="card mt-16">
    <div class="card-title">${ic('receipt',18)} Código de compra</div>
    <p class="muted small" style="margin-top:-4px">Escríbelo como viene en tu ticket o en el mensaje.</p>
    <div class="row mt-12" style="gap:8px"><input class="input mono cp-in" maxlength="9" autocapitalize="characters" autocomplete="off" placeholder="K7P2-9QXM" aria-label="Código de compra" value="${escapeHtml(compraInput)}" oninput="compraInput=this.value.toUpperCase();this.value=compraInput" onkeydown="if(event.key==='Enter')submitCompraInput()"><button class="btn btn-primary" onclick="submitCompraInput()">Sumar</button></div>
  </div>`;
  return `<button class="linkbtn small mt-16 cp-open" onclick="compraFormOpen=true;render();setTimeout(()=>{const i=document.querySelector('.cp-in');if(i)i.focus()},30)">${ic('receipt',16)} ¿Tienes un código de compra?</button>`;
}
