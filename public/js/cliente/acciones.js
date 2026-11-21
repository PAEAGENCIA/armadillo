/* Redeo · Ubicación y opiniones, y todo lo que hace el cliente desde su tarjeta (buscarla, abrirla, pedirla, Wallet). */
/* ---------- Ubicación y opiniones (todos los planes) ---------- */
let locForm = null;
function locInit(){ const b = cache.biz; locForm = { mapsUrl:b.mapsUrl||'', reviewUrl:b.reviewUrl||'', feedbackOn:!!(b.feedback&&b.feedback.on), feedbackReward:!!(b.feedback&&b.feedback.reward) }; }
async function saveLocation(){
  const f = locForm;
  busy=true; render();
  const r = await api('PUT','/api/businesses/'+enc(session.slug), { mapsUrl:f.mapsUrl.trim(), reviewUrl:f.reviewUrl.trim(), feedbackOn:f.feedbackOn, feedbackReward:f.feedbackOn && f.feedbackReward }, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo guardar.'), 6000); return; }
  cache.biz = { ...cache.biz, ...r.data };
  locInit();
  showToast('Guardado. Tus clientes ya lo ven en su tarjeta.');
}
function locationCardHtml(){
  if(!locForm) locInit();
  const f = locForm;
  return `<div class="card" id="loc-card">
    <div class="card-title">${ic('pin',18)} Ubicación y opiniones</div>
    <p class="muted small" style="margin:-4px 0 12px">Tus clientes ven en su tarjeta cómo llegar, pueden calificarte con estrellas y dejarte un comentario.</p>
    <div class="field"><label for="loc-maps">Liga de tu negocio en Google Maps</label><input id="loc-maps" class="input" type="url" inputmode="url" autocapitalize="none" placeholder="https://maps.app.goo.gl/…" value="${escapeHtml(f.mapsUrl)}" oninput="locForm.mapsUrl=this.value"><p class="hint">En Google Maps busca tu negocio → Compartir → Copiar vínculo.</p></div>
    <div class="field"><label for="loc-review">Liga para dejar reseña en Google <span class="muted">(opcional)</span></label><input id="loc-review" class="input" type="url" inputmode="url" autocapitalize="none" placeholder="https://g.page/r/…/review" value="${escapeHtml(f.reviewUrl)}" oninput="locForm.reviewUrl=this.value"><p class="hint">En tu Perfil de Negocio de Google → Pedir reseñas → copia la liga. Si la dejas vacía, usamos la de Maps.</p></div>
    <div class="row" style="gap:12px;align-items:flex-start;margin-top:4px">
      <div style="flex:1"><b class="small" style="color:var(--ink)">Pedir calificación en la tarjeta</b><p class="muted small" style="margin-top:2px">Estrellas y comentario que solo ves tú. Después los invitamos a opinar también en Google.</p></div>
      <button class="switch ${f.feedbackOn?'on':''}" role="switch" aria-checked="${f.feedbackOn}" aria-label="Pedir calificación en la tarjeta" onclick="locForm.feedbackOn=!locForm.feedbackOn;render()"><span></span></button>
    </div>
    ${f.feedbackOn ? `<div class="row mt-12" style="gap:12px;align-items:flex-start">
      <div style="flex:1"><b class="small" style="color:var(--ink)">Regalar ${cache.biz.mechanic==='sellos'?'1 sello':giftText(cache.biz,bonusAmt(cache.biz))} por su primera opinión</b><p class="muted small" style="margin-top:2px">Una sola vez por cliente, y solo por calificarte aquí.</p></div>
      <button class="switch ${f.feedbackReward?'on':''}" role="switch" aria-checked="${f.feedbackReward}" aria-label="Regalar sello por opinar" onclick="locForm.feedbackReward=!locForm.feedbackReward;render()"><span></span></button>
    </div>` : ''}
    <div class="lock-note" style="background:var(--surface-2);color:var(--ink-2);font-weight:500;align-items:flex-start"><span style="flex-shrink:0;display:flex;margin-top:2px">${ic('info',16)}</span><span>El sello es por calificarte <b>dentro de Redeo</b>, no por la reseña en Google: Google prohíbe dar regalos o descuentos a cambio de reseñas y puede borrarlas. A Google los invitamos sin premio y sin importar cuántas estrellas te dieron.</span></div>
    <button class="btn btn-primary btn-block mt-16" ${busy?'disabled':''} onclick="saveLocation()">Guardar ubicación y opiniones</button>
  </div>`;
}

/* ---------- Opiniones: el cliente califica desde su tarjeta ---------- */
let fbForm = { stars:0, comment:'' };
let fbDone = null;   // { reward } al terminar
function starsHtml(n){ return '★'.repeat(n) + '☆'.repeat(5-n); }
async function sendFeedback(){
  const { biz, customer, token } = clienteResult;
  if(!fbForm.stars){ showToast('Toca las estrellas para calificar.'); return; }
  busy=true; render();
  const r = await api('POST','/api/businesses/'+enc(biz.slug)+'/customers/'+enc(customer.phone)+'/feedback', { stars:fbForm.stars, comment:fbForm.comment }, null, { 'x-card-token': token || (getCard(biz.slug)||{}).token });
  busy=false;
  if(!r.ok){ showToast(errMsg(r,'No se pudo enviar tu opinión.'), 6000); return; }
  const { reward, ...c } = r.data;
  clienteResult.customer = { ...clienteResult.customer, ...c };
  fbDone = { reward, stars: fbForm.stars };
  fbForm = { stars:0, comment:'' };
  showToast(reward ? '¡Gracias! Te regalamos '+giftText(biz, reward)+'.' : '¡Gracias por tu opinión!');
}
function customerExtrasHtml(biz, customer){
  const maps = biz.mapsUrl, review = biz.reviewUrl || biz.mapsUrl, fb = biz.feedback || {};
  if(!maps && !review && !fb.on) return '';
  const unit = biz.mechanic==='sellos' ? 'sello' : 'punto';
  const recent = customer.feedback && (Date.now() - new Date(customer.feedback.at).getTime() < 7*86400000);
  const googleBtn = review ? `<a class="btn btn-secondary btn-block mt-12" href="${escapeHtml(review)}" target="_blank" rel="noopener">${ic('starfill',16)} Opinar también en Google</a>` : '';
  let body = '';
  if(fb.on && !recent && !fbDone){
    body = `<p class="small" style="font-weight:800;color:var(--ink);text-align:center;margin-top:4px">¿Cómo te fue en ${escapeHtml(biz.name)}?</p>
      <div class="stars" role="radiogroup" aria-label="Calificación">${[1,2,3,4,5].map(n=>`<button type="button" class="${fbForm.stars>=n?'on':''}" role="radio" aria-checked="${fbForm.stars===n}" aria-label="${n} ${n===1?'estrella':'estrellas'}" onclick="fbForm.stars=${n};render()">${ic('starfill',34)}</button>`).join('')}</div>
      ${fbForm.stars ? `<textarea class="input mt-8" rows="3" maxlength="500" placeholder="Cuéntanos qué te gustó o qué mejorarías (opcional)" aria-label="Comentario" oninput="fbForm.comment=this.value" style="height:auto;padding-top:10px">${escapeHtml(fbForm.comment)}</textarea>
      <button class="btn btn-primary btn-block mt-12" ${busy?'disabled':''} onclick="sendFeedback()">Enviar mi opinión</button>` : ''}
      ${fb.reward && !(customer.feedback && customer.feedback.rewarded) ? `<p class="hint" style="text-align:center">${ic('gift',14)} Tu primera opinión te regala ${biz.mechanic==='sellos'?'1 sello':giftText(biz,bonusAmt(biz))}.</p>` : ''}`;
  }else if(fb.on){
    body = `<p class="small" style="font-weight:800;color:var(--ink);text-align:center;margin-top:4px">¡Gracias por tu opinión!</p>
      <p class="muted small" style="text-align:center">${fbDone && fbDone.reward ? (isWalletBiz(biz)?'Ya tienes tu saldo de regalo. ':'Ya tienes tu '+unit+' de regalo. ') : ''}Nos ayudas mucho si también la dejas en Google.</p>${googleBtn}`;
  }else{
    body = googleBtn ? `<p class="muted small" style="text-align:center">¿Te gustó? Tu opinión en Google nos ayuda a que más gente nos conozca.</p>${googleBtn}` : '';
  }
  return `<div class="card mt-16">
    <div class="card-title">${ic('pin',18)} Visítanos y califícanos</div>
    ${maps ? `<a class="btn btn-secondary btn-block" href="${escapeHtml(maps)}" target="_blank" rel="noopener">${ic('pin',18)} Cómo llegar</a>` : ''}
    ${body ? `<div class="${maps?'mt-12':''}">${body}</div>` : ''}
  </div>`;
}

/* ---------- Opiniones: lo que ve el dueño ---------- */
let opinions = null;
let opinionsOpen = false;
async function loadOpinions(){
  if(!isOwner() || isExpired()) return;
  const r = await api('GET','/api/businesses/'+enc(session.slug)+'/feedback', undefined, session.pin);
  if(r.ok){ opinions = r.data; if(view==='dashboard') render(); }
}
function opinionsCardHtml(){
  if(!isOwner() || !opinions || (!opinions.count && !(cache.biz.feedback && cache.biz.feedback.on))) return '';
  if(!opinions.count) return `<div class="card mt-12"><div class="card-title">${ic('starfill',18)} Opiniones de tus clientes</div><p class="muted small">Aún no llegan opiniones. Tus clientes las dejan desde su tarjeta.</p></div>`;
  const list = opinions.items.slice(0, opinionsOpen ? 100 : 3);
  return `<div class="card mt-12">
    <div class="card-title">${ic('starfill',18)} Opiniones de tus clientes</div>
    <div class="row" style="gap:16px;align-items:center">
      <div style="text-align:center;min-width:86px"><div class="stat-num" style="font-size:2rem">${opinions.avg}</div><div class="stars-sm">${starsHtml(Math.round(opinions.avg))}</div><div class="muted small">${opinions.count} ${opinions.count===1?'opinión':'opiniones'}</div></div>
      <div style="flex:1">${[5,4,3,2,1].map(n=>`<div class="op-bar"><span>${n}★</span><div class="mini"><span style="width:${Math.round(opinions.dist[n-1]/opinions.count*100)}%;background:#E0A526"></span></div><span>${opinions.dist[n-1]}</span></div>`).join('')}</div>
    </div>
    <div class="mt-12">${list.map(o=>`<div class="op-item"><div class="row" style="justify-content:space-between;gap:8px"><b class="small" style="color:var(--ink)">${escapeHtml(firstName(o.name)||o.phone)}</b><span class="stars-sm">${starsHtml(o.stars)}</span></div>${o.comment?`<p class="small" style="margin:3px 0 0;color:var(--ink-2)">${escapeHtml(o.comment)}</p>`:''}<span class="muted" style="font-size:.72rem">${escapeHtml(fmtWhen(o.at))}${o.rewarded?' · recibió su sello':''}</span></div>`).join('')}</div>
    ${opinions.items.length>3 ? `<button class="linkbtn small mt-8" onclick="opinionsOpen=!opinionsOpen;render()">${opinionsOpen?'Ver menos':'Ver todas ('+opinions.items.length+')'}</button>` : ''}
  </div>`;
}

/* ---------- Acciones: cliente público ---------- */
// La tarjeta de cada cliente se abre con su liga personal (teléfono + clave secreta).
// La clave se guarda en este celular; sin ella solo se ve el primer nombre, nunca los sellos.
let memCards = {};   // respaldo por si el navegador no deja guardar (modo privado)
function getCard(slug){
  try{ const v = JSON.parse(store.get('vuelve_card_'+slug)||'null'); if(v && v.phone && v.token) return v; }catch(e){}
  return memCards[slug] || null;
}
function setCard(slug, phone, token){
  memCards[slug] = { phone, token };
  store.set('vuelve_card_'+slug, JSON.stringify({ phone, token }));
  return !!store.get('vuelve_card_'+slug);
}
function delCard(slug){ delete memCards[slug]; store.del('vuelve_card_'+slug); }

async function inviteFriend(){
  const { biz, customer } = clienteResult;
  const link = location.origin + '/?n=' + enc(biz.slug) + '&ref=' + enc(customer.phone);
  const W = isWalletBiz(biz), g = giftText(biz, bonusAmt(biz));
  const perk = biz.promos && biz.promos.referralBoth ? ` y en tu primera compra te regalan ${W?g:(biz.mechanic==='sellos'?'1 sello':g)}` : biz.promos && biz.promos.welcome ? (W ? ` y llévate ${g} de bienvenida` : ' y llévate tu primer sello de regalo') : '';
  const text = `Te invito a ${biz.name}. ${W?`Cada compra te deja ${biz.walletPct}% en saldo para la siguiente. `:''}Pide tu tarjeta aquí${perk}: ${link}`;
  if(navigator.share){ try{ await navigator.share({ text }); return; }catch(e){ if(e && e.name==='AbortError') return; } }
  window.open('https://wa.me/?text='+encodeURIComponent(text), '_blank');
}
function promoBannerHtml(biz, extra){
  const now = [...(extra||[]), ...((biz.promos && biz.promos.doubleNow) || [])];
  if(!now.length) return '';
  return `<div class="promo-banner mt-16">${ic('bolt',20)}<span><b>¡Hoy ${isWalletBiz(biz)?'tu saldo':'tu sello'} vale doble!</b> ${escapeHtml([...new Set(now)].join(' · '))}</span></div>`;
}

let unlockForm = { day:'', month:'' };
let unlockError = '';
let unlockNoBday = false;
async function unlockCard(){
  unlockError='';
  const { biz, customer } = clienteResult;
  if(!unlockForm.day || !unlockForm.month){ unlockError='Elige el día y el mes de tu cumpleaños.'; render(); return; }
  busy=true; render();
  const r = await api('POST','/api/businesses/'+enc(biz.slug)+'/customers/'+enc(customer.phone)+'/unlock',{ birthday:bdayValue(unlockForm) });
  busy=false;
  if(!r.ok){
    if(r.data.code==='no_birthday') unlockNoBday = true;
    else unlockError = errMsg(r,'No se pudo abrir tu tarjeta.');
    render(); return;
  }
  setCard(biz.slug, customer.phone, r.data.cardToken);
  unlockForm = { day:'', month:'' };
  clienteResult = { status: r.data.status==='pending' ? 'pending' : 'found', biz, customer:r.data, token:r.data.cardToken };
  render();
  maybeClaimCompra();
}

// El cliente que abrió su tarjeta con la liga y aún no tiene cumpleaños lo puede agregar.
let myBday = { day:'', month:'' };
async function setMyMarketing(on){
  const { biz, customer } = clienteResult; const card = getCard(biz.slug);
  if(!card){ showToast('Abre tu tarjeta de nuevo para cambiar esto.'); return; }
  busy = true; render();
  const r = await api('PUT','/api/businesses/'+enc(biz.slug)+'/customers/'+enc(customer.phone)+'/marketing', { optIn:on }, null, { 'x-card-token': card.token });
  busy = false;
  if(!r.ok){ showToast(errMsg(r,'No se pudo guardar.')); return; }
  clienteResult.customer = { ...customer, ...r.data };
  if(!on){ store.del('vuelve_push_'+biz.slug); pushState.on = false; }   // sin promociones, tampoco avisos al celular
  showToast(on ? '¡Bienvenido a la comunidad!' : 'Listo, ya no recibirás promociones.');
}
async function saveMyBirthday(){
  const { biz, customer, token } = clienteResult;
  if(!bdayValid(myBday)){ showToast('Elige un día y mes válidos.'); return; }
  busy=true; render();
  const r = await api('PUT','/api/businesses/'+enc(biz.slug)+'/customers/'+enc(customer.phone)+'/birthday',{ birthday:bdayValue(myBday) }, null, { 'x-card-token': token });
  busy=false;
  if(!r.ok){ showToast(errMsg(r,'No se pudo guardar.')); return; }
  clienteResult.customer = { ...customer, ...r.data };
  showToast('Listo. Ya puedes abrir tu tarjeta desde cualquier celular.');
}

async function buscarTarjetaCliente(){
  fbDone = null; fbForm = { stars:0, comment:'' };
  const slug = slugify(clienteLookup.slug);
  const phone = normalizePhone(clienteLookup.phone);
  if(!clienteLookup.slug.trim()){ showToast('Escribe el código del negocio.'); return; }
  if(!isValidPhone(phone)){ showToast(phoneMsg('s-phone','tu número de WhatsApp')); return; }
  busy=true; render();
  const b = await api('GET','/api/businesses/'+enc(slug));
  if(!b.ok){
    busy=false;
    if(b.status===404){ clienteResult = {status:'no_biz', biz:null, customer:null}; view='clienteTarjeta'; render(); }
    else showToast(errMsg(b,'No se pudo buscar tu tarjeta.'));
    return;
  }
  unlockError=''; unlockNoBday=false; unlockForm={ day:'', month:'' };
  const mine = getCard(slug);
  const token = mine && mine.phone===phone ? mine.token : null;
  const c = await api('GET','/api/businesses/'+enc(slug)+'/customers/'+enc(phone), undefined, null, token ? { 'x-card-token': token } : undefined);
  busy=false;
  if(!c.ok && c.status!==404){ showToast(errMsg(c,'No se pudo buscar tu tarjeta.')); return; }
  let status;
  if(!c.ok) status = 'no_card';
  else if(c.data.locked){ status = 'locked'; if(token) delCard(slug); }
  else status = c.data.status==='pending' ? 'pending' : 'found';
  clienteResult = { status, biz:b.data, customer: c.ok ? { phone, ...c.data } : null, token: status==='locked' ? null : token };
  requestError='';
  store.set('vuelve_tel_'+slug, phone);
  view = 'clienteTarjeta';
  render();
  maybeClaimCompra();
}

async function solicitarTarjeta(){
  requestError='';
  const biz = clienteResult.biz;
  const phone = normalizePhone(clienteLookup.phone);
  const f = requestForm;
  if(!f.name.trim()){ requestError='Escribe tu nombre para que el negocio te reconozca.'; render(); return; }
  const email = f.marketing ? String(f.email||'').trim() : '';
  if(email && !isEmail(email)){ requestError='Ese correo no parece válido. Revísalo o déjalo vacío.'; render(); return; }
  if(!f.bday.day || !f.bday.month){ requestError='Elige el día y el mes de tu cumpleaños.'; render(); return; }
  if(!bdayValid(f.bday)){ requestError='Esa fecha no existe. Revisa el día y el mes.'; render(); return; }
  if(!f.source){ requestError='Cuéntanos cómo nos conociste: es un solo toque.'; render(); return; }
  const ref = f.source==='recomendacion' ? normalizePhone(f.ref||'') : '';
  if(ref && !isValidPhone(ref)){ requestError='Revisa el WhatsApp de quien te recomendó o déjalo vacío.'; render(); return; }
  if(!f.privacy){ requestError='Para crear tu tarjeta necesitas aceptar el Aviso de privacidad y los Términos del programa.'; render(); return; }
  busy=true; render();
  const r = await api('POST','/api/businesses/'+enc(biz.slug)+'/customers/request',{
    phone, name:f.name.trim(), email, marketingOptIn:f.marketing, privacyAccepted:true, birthday:bdayValue(f.bday),
    referredBy: ref || undefined, source: f.source, sourceDetail: f.source==='redes' || f.source==='otro' ? f.srcDetail : undefined,
    purchaseCode: compraPending && compraPending.slug===biz.slug && !compraPending.done && !compraPending.error ? compraPending.code : undefined
  });
  busy=false;
  if(r.status===409 && r.data.code==='exists'){
    clienteResult = { status:'locked', biz, customer:{ phone, ...r.data }, token:null };
    render(); return;
  }
  if(!r.ok){ requestError = errMsg(r,'No se pudo enviar tu solicitud.'); render(); return; }
  store.set('vuelve_tel_'+biz.slug, phone);
  setCard(biz.slug, phone, r.data.cardToken);
  const { purchase, ...newCustomer } = r.data;
  if(purchase && compraPending){
    if(purchase.error) compraPending.error = purchase.error;
    else compraPending.done = { amount:purchase.amount, text: compraPending.info ? compraPending.info.text : '', levelUp:purchase.levelUp, activated:true };
  }
  clienteResult = { status: newCustomer.status==='pending' ? 'pending' : 'found', biz, customer:newCustomer, token:r.data.cardToken };
  aboutReset(biz.slug);   // ya contestó cómo nos conoció en el registro: solo quedan sus favoritos (Premium)
  aboutUi.step = aboutWantsFavs(biz, newCustomer) ? 'fav' : 'done';
  requestForm = { name:'', email:'', favorites:[], favText:'', marketing:true, privacy:false, bday:{day:'',month:''}, ref:'', refLink:false, source:'', srcDetail:'' };
  render();
}

// Qué botones de Wallet mostrar: Apple solo en iPhone/iPad/Mac y Google solo fuera de Apple (Android o computadora).
function isAppleDevice(){ return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent); }
function walletKinds(){
  const w = serverConfig.wallet || {}, k = [];
  if(w.apple && isAppleDevice()) k.push('apple');
  if(w.google && !/iPhone|iPad|iPod/.test(navigator.userAgent)) k.push('google');
  return k;
}
async function addToWallet(kind){
  const { biz, customer, token } = clienteResult;
  if(!biz || !customer || !token) return;
  if(!serverConfig.wallet[kind]){ showToast('Muy pronto podrás guardarla en tu Wallet.'); return; }
  if(kind==='apple'){
    location.href = '/api/businesses/'+enc(biz.slug)+'/wallet/apple/'+enc(customer.phone)+'?t='+enc(token);
    return;
  }
  busy = true; render();
  const r = await api('GET','/api/businesses/'+enc(biz.slug)+'/wallet/google/'+enc(customer.phone)+'?t='+enc(token));
  busy = false; render();
  if(r.ok && r.data.url) location.href = r.data.url;
  else showToast(errMsg(r,'No se pudo abrir Google Wallet. Intenta de nuevo.'));
}
