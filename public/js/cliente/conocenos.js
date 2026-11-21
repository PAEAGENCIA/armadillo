/* Redeo · "¿Cómo nos conociste?" (v2.3)
   El cliente contesta con un toque justo después de crear su tarjeta (nunca antes: primero recibe, luego le preguntamos).
   El negocio ve en su panel qué le trae clientes. También: la comunidad (promociones + correo opcional). */
const SOURCE_OPTS = [
  ['calle',         'Pasé por aquí',       'store'],
  ['recomendacion', 'Me lo recomendaron',  'users'],
  ['redes',         'Redes sociales',      'phoneapp'],
  ['google',        'Google o Maps',       'search'],
  ['cliente',       'Ya era cliente',      'heart'],
  ['otro',          'Otro',                'dots']
];
const NETWORK_OPTS = [['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok'],['whatsapp','WhatsApp']];
const SOURCE_LABEL = { calle:'Pasaron por aquí', recomendacion:'Se lo recomendaron', redes:'Redes sociales', google:'Google o Maps', cliente:'Ya eran clientes', otro:'Otro' };

let aboutUi = { slug:null, step:'source', pick:null, detail:'', ref:'', favs:[] };
function aboutDismissed(slug){ return store.get('vuelve_about_'+slug)==='1'; }
function aboutReset(slug){ aboutUi = { slug, step:'source', pick:null, detail:'', ref:'', favs:[] }; }

function aboutWantsFavs(biz, customer){ return biz.plan==='premium' && (biz.products||[]).length>0 && !customer.hasFavorites; }
function aboutWantsRef(biz, customer){ return !!(biz.promos && biz.promos.referral) && !customer.hasReferrer; }

async function sendAbout(patch){
  const { biz, customer } = clienteResult;
  const card = getCard(biz.slug);
  if(!card){ showToast('Abre tu tarjeta de nuevo para contestar.'); return false; }
  busy = true; render();
  const r = await api('PUT','/api/businesses/'+enc(biz.slug)+'/customers/'+enc(customer.phone)+'/about', patch, null, { 'x-card-token': card.token });
  busy = false;
  if(!r.ok){ showToast(errMsg(r,'No se pudo guardar.')); render(); return false; }
  clienteResult.customer = { ...customer, ...r.data };
  return true;
}
function aboutFinish(){
  aboutUi.step = 'done';
  store.set('vuelve_about_'+clienteResult.biz.slug, '1');
  showToast('¡Gracias! Con eso nos ayudas muchísimo.');
  render();
}
async function aboutSaveSource(extra){
  const { biz } = clienteResult;
  const ok = await sendAbout({ source: aboutUi.pick, ...(extra||{}) });
  if(!ok) return;
  if(aboutWantsFavs(biz, clienteResult.customer)){ aboutUi.step = 'fav'; render(); }
  else aboutFinish();
}
function aboutPick(key){
  const { biz, customer } = clienteResult;
  if(aboutUi.slug!==biz.slug) aboutReset(biz.slug);
  aboutUi.pick = key;
  if(key==='redes'){ aboutUi.step='redes'; render(); return; }
  if(key==='otro'){ aboutUi.step='otro'; render(); setTimeout(()=>{ const i=document.getElementById('ab-otro'); if(i) i.focus(); }, 50); return; }
  if(key==='recomendacion' && aboutWantsRef(biz, customer)){ aboutUi.step='ref'; render(); return; }
  aboutSaveSource();
}
function aboutNetwork(n){ aboutSaveSource(n ? { sourceDetail:n } : null); }
function aboutRefSave(skip){
  if(skip) return aboutSaveSource();
  const ref = normalizePhone(aboutUi.ref);
  if(!isValidPhone(ref)){ showToast(phoneMsg('ab-ref','el WhatsApp de quien te invitó')); return; }
  aboutSaveSource({ referredBy: ref });
}
function aboutToggleFav(p){
  const i = aboutUi.favs.indexOf(p);
  if(i>=0) aboutUi.favs.splice(i,1); else if(aboutUi.favs.length<5) aboutUi.favs.push(p);
  render();
}
async function aboutFavSave(skip){
  if(!skip && aboutUi.favs.length){ const ok = await sendAbout({ favorites: aboutUi.favs }); if(!ok) return; }
  aboutFinish();
}
function aboutSkip(){
  store.set('vuelve_about_'+clienteResult.biz.slug, '1');
  aboutUi.step = 'done';
  render();
}

// La tarjeta de la pregunta. Aparece una sola vez: hasta que contesta o toca "Ahora no".
function aboutCardHtml(biz, customer){
  if(!biz || !customer || biz.isDemo) return '';
  if(aboutUi.slug!==biz.slug) aboutReset(biz.slug);
  const st = aboutUi.step;
  if(st==='done') return '';
  if(st==='source' && (customer.sourceAnswered || aboutDismissed(biz.slug))) return '';
  const back = `<button class="ask-back" onclick="aboutUi.step='source';render()">${ic('left',16)} Cambiar</button>`;
  let inner;
  if(st==='source'){
    inner = `<p class="ask-kicker">Una pregunta · un toque</p>
      <h3 class="ask-q">¿Cómo nos conociste?</h3>
      <div class="ask-grid">${SOURCE_OPTS.map(([k,l,i])=>`<button class="ask-opt" ${busy?'disabled':''} onclick="aboutPick('${k}')"><span class="ask-ico">${ic(i,18)}</span><span>${l}</span></button>`).join('')}</div>
      <button class="ask-skip" onclick="aboutSkip()">Ahora no</button>`;
  }else if(st==='redes'){
    inner = `${back}<h3 class="ask-q">¿En cuál?</h3>
      <div class="ask-chips">${NETWORK_OPTS.map(([k,l])=>`<button class="pick" ${busy?'disabled':''} onclick="aboutNetwork('${k}')">${l}</button>`).join('')}</div>
      <button class="ask-skip" ${busy?'disabled':''} onclick="aboutNetwork('')">No me acuerdo</button>`;
  }else if(st==='otro'){
    inner = `${back}<h3 class="ask-q">¿Dónde nos viste?</h3>
      <input id="ab-otro" class="input" type="text" maxlength="40" placeholder="Por ejemplo: un evento, un volante…" value="${escapeHtml(aboutUi.detail)}" oninput="aboutUi.detail=this.value">
      <button class="btn btn-primary btn-block mt-12" ${busy?'disabled':''} onclick="aboutSaveSource({sourceDetail:aboutUi.detail})">Listo</button>`;
  }else if(st==='ref'){
    const both = biz.promos.referralBoth, g = biz.mechanic==='sellos' ? '1 sello' : giftText(biz, bonusAmt(biz));
    inner = `${back}<h3 class="ask-q">¿Quién te recomendó?</h3>
      <p class="ask-sub">${both ? `Escribe su WhatsApp y en tu primera compra <b>los dos ganan ${escapeHtml(g)}</b>.` : `Escribe su WhatsApp y en tu primera compra <b>tu amigo gana ${escapeHtml(g)}</b>.`}</p>
      ${telField('ab-ref', normalizePhone(aboutUi.ref), 'aboutUi.ref', {placeholder:'WhatsApp de tu amigo'})}
      <button class="btn btn-primary btn-block mt-12" ${busy?'disabled':''} onclick="aboutRefSave()">Guardar</button>
      <button class="ask-skip" ${busy?'disabled':''} onclick="aboutRefSave(true)">Prefiero no decir</button>`;
  }else if(st==='fav'){
    inner = `<p class="ask-kicker">Última, lo prometemos</p>
      <h3 class="ask-q">¿Qué es lo que más te gusta?</h3>
      <div class="ask-chips">${biz.products.map(p=>`<button class="pick ${aboutUi.favs.includes(p)?'on':''}" onclick="aboutToggleFav('${jsEsc(p)}')">${aboutUi.favs.includes(p)?ic('check',14):''}${escapeHtml(p)}</button>`).join('')}</div>
      <button class="btn btn-primary btn-block mt-12" ${busy||!aboutUi.favs.length?'disabled':''} onclick="aboutFavSave()">Listo</button>
      <button class="ask-skip" onclick="aboutFavSave(true)">Ahora no</button>`;
  }
  return `<div class="ask mt-16 fade">${inner}</div>`;
}

/* ---------- En el registro: "¿Cómo nos conociste?" (obligatorio, un toque) ---------- */
function pickSignupSource(k){
  if(requestForm.source!==k){ requestForm.srcDetail=''; if(!requestForm.refLink) requestForm.ref=''; }
  requestForm.source = k;
  render();
  if(k==='otro') setTimeout(()=>{ const i=document.getElementById('r-otro'); if(i) i.focus(); }, 50);
}
function signupSourceHtml(biz){
  const f = requestForm, cur = f.source;
  const referral = !!(biz.promos && biz.promos.referral);
  const g = biz.mechanic==='sellos' ? '1 sello' : giftText(biz, bonusAmt(biz));
  let follow = '';
  if(cur==='redes'){
    follow = `<p class="ask-follow">¿En cuál?</p><div class="ask-chips">${NETWORK_OPTS.map(([k,l])=>`<button type="button" class="pick ${f.srcDetail===k?'on':''}" onclick="requestForm.srcDetail=requestForm.srcDetail==='${k}'?'':'${k}';render()">${f.srcDetail===k?ic('check',14):''}${l}</button>`).join('')}</div>`;
  }else if(cur==='otro'){
    follow = `<input id="r-otro" class="input mt-12" type="text" maxlength="40" placeholder="¿Dónde nos viste? (opcional)" value="${escapeHtml(f.srcDetail)}" oninput="requestForm.srcDetail=this.value">`;
  }else if(cur==='recomendacion' && referral){
    follow = f.refLink
      ? `<div class="ref-chip mt-12">${ic('users',16)}<span>Vienes invitado por un amigo. En tu primera compra ${biz.promos.referralBoth?`<b>los dos ganan ${escapeHtml(g)}</b>`:`<b>tu amigo gana ${escapeHtml(g)}</b>`}.</span></div>`
      : `<p class="ask-follow">¿Quién? <span class="muted">(opcional)</span></p>${telField('r-ref', normalizePhone(f.ref||''), 'requestForm.ref', {placeholder:'WhatsApp de tu amigo'})}<p class="hint">${biz.promos.referralBoth?`En tu primera compra los dos ganan ${escapeHtml(g)}.`:`En tu primera compra tu amigo gana ${escapeHtml(g)}.`}</p>`;
  }
  return `<div class="ask ask-inline mt-12">
    <h3 class="ask-q">¿Cómo nos conociste?</h3>
    <div class="ask-grid">${SOURCE_OPTS.map(([k,l,i])=>`<button type="button" class="ask-opt ${cur===k?'on':''}" aria-pressed="${cur===k}" onclick="pickSignupSource('${k}')"><span class="ask-ico">${ic(cur===k?'check':i,18)}</span><span>${l}</span></button>`).join('')}</div>
    ${follow}
  </div>`;
}

/* ---------- Comunidad: recibir promociones + correo opcional ---------- */
let communityEmail = '';
async function joinCommunityEmail(){
  const email = communityEmail.trim();
  if(!isEmail(email)){ showToast('Ese correo no parece válido.'); return; }
  const ok = await sendAbout({ email, marketingOptIn:true });
  if(ok){ communityEmail = ''; showToast('¡Listo! Te llegarán las promociones y eventos de la comunidad.'); render(); }
}
// En el formulario de registro: viene prendido y el cliente lo puede apagar. Aquí no se pide correo.
function communitySignupHtml(biz){
  const on = !!requestForm.marketing;
  return `<div class="community ${on?'on':''} mt-12">
    <div class="community-row">
      <span class="community-ico">${ic('heart',18)}</span>
      <div style="flex:1;min-width:0"><b>Únete a la comunidad</b><p>Te avisamos por WhatsApp de tu premio, promociones y eventos de ${escapeHtml(biz.name)}. Puedes salirte cuando quieras.</p></div>
      <button class="switch ${on?'on':''}" role="switch" aria-checked="${on}" aria-label="Unirme a la comunidad" onclick="requestForm.marketing=!requestForm.marketing;render()"><span></span></button>
    </div>
  </div>`;
}
// En la tarjeta: la comunidad (interruptor) y, si aún no lo dio, la invitación a compartir su correo.
function communityCardHtml(biz, customer){
  const on = !!customer.marketingOptIn;
  return `<div class="community ${on?'on':''} mt-16">
    <div class="community-row">
      <span class="community-ico">${ic('heart',18)}</span>
      <div style="flex:1;min-width:0"><b>Comunidad de ${escapeHtml(biz.name)}</b><p>${on ? 'Estás dentro: te avisamos de tu premio, promociones y eventos.' : 'Únete y entérate primero de promociones y eventos.'}</p></div>
      <button class="switch ${on?'on':''}" role="switch" aria-checked="${on}" aria-label="Recibir promociones" ${busy?'disabled':''} onclick="setMyMarketing(${on?'false':'true'})"><span></span></button>
    </div>
    ${!customer.hasEmail ? `<div class="community-mail">
      <p class="community-mail-t">${ic('send',15)}<span>Compártenos tu correo y te llegan las <b>promociones exclusivas y los eventos</b> de la comunidad.</span></p>
      <div class="row" style="gap:8px"><input class="input" style="flex:1;min-width:0" type="email" inputmode="email" autocomplete="email" autocapitalize="none" value="${escapeHtml(communityEmail)}" placeholder="tucorreo@ejemplo.com" aria-label="Tu correo" oninput="communityEmail=this.value"><button class="btn btn-primary" ${busy?'disabled':''} onclick="joinCommunityEmail()">Enviar</button></div>
      <p class="hint" style="margin-bottom:0">Opcional. Puedes darte de baja cuando quieras.</p>
    </div>` : ''}
  </div>`;
}

/* ---------- Panel del negocio ---------- */
// En "Nuevo cliente": el personal también puede marcar cómo llegó (opcional).
function staffSourceHtml(){
  const cur = newCustomerForm.source || '';
  return `<div class="field"><label>¿Cómo nos conoció? <span class="muted">(opcional)</span></label>
    <div class="chips">${SOURCE_OPTS.map(([k,l])=>`<button type="button" class="pick ${cur===k?'on':''}" onclick="newCustomerForm.source=newCustomerForm.source==='${k}'?'':'${k}';render()">${cur===k?ic('check',14):''}${l}</button>`).join('')}</div></div>`;
}

const SOURCE_TIPS = {
  calle: 'Tu fachada y tu sticker en el mostrador están trayendo clientes. Que se vean bien desde la calle.',
  recomendacion: 'Tus clientes te recomiendan. Premia eso con "Invita a un amigo" para que lo hagan más seguido.',
  redes: 'Tus redes sí traen clientes. Publicar seguido vale la pena.',
  google: 'Te encuentran en Google. Pedir opiniones te ayuda a subir en Maps.',
  cliente: 'La mayoría ya te conocía: la tarjeta está premiando a tus clientes de siempre. Ahora toca atraer nuevos.',
  otro: 'Revisa en la lista de clientes qué escribieron en "Otro".'
};
function sourcesCardHtml(){
  if(!isOwner() || !cache.customers) return '';
  const all = cache.customers;
  const ans = all.filter(c=>c.source && SOURCE_LABEL[c.source]);
  if(!ans.length) return '';
  const counts = {}, nets = {};
  ans.forEach(c=>{ counts[c.source]=(counts[c.source]||0)+1; if(c.source==='redes' && c.sourceDetail) nets[c.sourceDetail]=(nets[c.sourceDetail]||0)+1; });
  const rows = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const total = ans.length, top = rows[0][0];
  const leads = total >= 3 && (rows.length === 1 || rows[0][1] > rows[1][1]);   // el consejo solo cuando hay un claro primer lugar
  const netTxt = Object.entries(nets).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${(NETWORK_OPTS.find(x=>x[0]===k)||[k,k])[1]} ${n}`).join(' · ');
  const icon = k => (SOURCE_OPTS.find(o=>o[0]===k)||[])[2] || 'dots';
  return `<div class="card mt-12">
    <div class="card-title">${ic('chart',18)} ¿Cómo te conocen tus clientes?</div>
    <div class="src-list">${rows.map(([k,n],i)=>{ const pct = Math.round(n/total*100); return `<div class="src-row ${i===0?'top':''}">
      <span class="src-ico">${ic(icon(k),15)}</span>
      <div class="src-main"><div class="src-line"><b>${SOURCE_LABEL[k]}</b><span>${pct}% <span class="muted">· ${n}</span></span></div>
      <div class="src-bar"><span style="width:${Math.max(pct,3)}%"></span></div>
      ${k==='redes' && netTxt ? `<span class="muted" style="font-size:.74rem">${escapeHtml(netTxt)}</span>` : ''}</div>
    </div>`; }).join('')}</div>
    ${leads ? `<p class="src-tip">${ic('bulb',16)}<span>${SOURCE_TIPS[top]}</span></p>` : ''}
    <p class="muted" style="font-size:.74rem;margin-top:8px">Respondieron ${total} de ${all.length} ${all.length===1?'cliente':'clientes'}. Tus clientes lo contestan con un toque al crear su tarjeta.</p>
  </div>`;
}
