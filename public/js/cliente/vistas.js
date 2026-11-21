/* Redeo · Cliente: pantallas para buscar y ver su tarjeta, páginas legales y "cargando". */
function viewClienteBuscar(){
  const pv = clientePreview && clientePreview.slug===slugify(clienteLookup.slug) ? clientePreview : null;
  return `
  <div class="wrap fade">
    ${backHtml('goHome()')}
    <h2 class="mt-12">${pv ? escapeHtml(pv.name) : 'Ver mi tarjeta'}</h2>
    <p class="lead">${pv ? 'Escribe tu número de WhatsApp para ver tu tarjeta o pedirla.' : 'Pide el código en el mostrador del negocio.'}</p>
    ${pv ? signupBannerHtml(pv) : ''}
    ${compraBannerHtml('buscar')}
    <div class="card mt-24">
      <div class="field"><label for="s-slug">Código del negocio</label><div class="input-icon">${ic('store',18)}<input id="s-slug" class="input" type="text" autocapitalize="none" value="${escapeHtml(clienteLookup.slug)}" placeholder="cafe-luna" oninput="clienteLookup.slug=this.value"></div></div>
      <div class="field"><label for="s-phone">Tu número de WhatsApp</label>${telField('s-phone', normalizePhone(clienteLookup.phone), 'clienteLookup.phone')}</div>
    </div>
    <button class="btn btn-primary btn-block mt-24" ${busy?'disabled':''} onclick="buscarTarjetaCliente()">${busy?'Buscando…':'Ver mi tarjeta'}</button>
  </div>`;
}

function viewClienteTarjeta(){
  const {status, biz, customer} = clienteResult;
  let body;
  if(status==='no_biz'){
    body = `<div class="card mt-24"><div class="empty"><div class="empty-ico">${ic('store',26)}</div><b style="color:var(--ink)">No encontramos ese negocio</b><p class="small mt-8">Revisa el código con el personal del negocio.</p></div></div>`;
  }else if(status==='no_card'){
    body = `
      <h2 class="mt-12">Pide tu tarjeta</h2>
      <p class="lead">Aún no tienes tarjeta en ${escapeHtml(biz.name)}. ${compraPending && compraPending.info && !compraPending.done ? 'Pídela aquí y tu compra se suma al momento.' : 'Pídela aquí y el personal la aprueba en tu visita.'}</p>
      ${compraBannerHtml('no_card')}
      ${signupBannerHtml(biz)}
      ${biz.promos && biz.promos.welcome ? `<div class="promo-banner mt-16">${ic('gift',20)}<span><b>${isWalletBiz(biz)?`Regístrate y llévate ${giftText(biz,bonusAmt(biz))} de regalo.`:'Regístrate y llévate tu primer sello de regalo.'}</b></span></div>` : ''}
      ${promoBannerHtml(biz)}
      <div class="mt-24">${passHtml(biz, null, {})}</div>
      <div class="card mt-24 signup-card">
        <div class="field"><label>Tu WhatsApp</label>${telField('rq-phone', normalizePhone(clienteLookup.phone), 'clienteLookup.phone', {disabled:true})}</div>
        <div class="field"><label for="r-name">¿Cómo te llamas?</label><input id="r-name" class="input" type="text" autocomplete="given-name" value="${escapeHtml(requestForm.name)}" placeholder="Para que te reconozcan en caja" oninput="requestForm.name=this.value"></div>
        <div class="field" style="margin-bottom:0"><label>Tu cumpleaños</label>${bdayPickerHtml('requestForm.bday','r-bday')}<p class="hint">Es tu llave: con tu WhatsApp y tu cumpleaños abres tu tarjeta en cualquier celular.</p></div>
      </div>
      ${signupSourceHtml(biz)}
      ${communitySignupHtml(biz)}
      <label class="check legal-check mt-12"><input type="checkbox" ${requestForm.privacy?'checked':''} onchange="requestForm.privacy=this.checked"><span>Acepto el <button type="button" class="linkbtn" onclick="event.preventDefault();openLegal('privacidad')">Aviso de privacidad</button> y los <button type="button" class="linkbtn" onclick="event.preventDefault();openLegal('programa')">Términos del programa</button>.</span></label>
      ${errorHtml(requestError)}
      <button class="btn btn-primary btn-block mt-24" ${busy?'disabled':''} onclick="solicitarTarjeta()">${busy?'Creando…':ic('card')+' Crear mi tarjeta'}</button>`;
  }else if(status==='locked'){
    const nombre = customer.firstName || '';
    const pend = customer.status==='pending';
    body = `
      <div class="success-ico mt-12" style="background:var(--brand-soft);color:var(--brand)">${ic('lock',30)}</div>
      <h2>Hola${nombre?', '+escapeHtml(nombre):''}</h2>
      <p class="lead">${pend ? `Tu solicitud en ${escapeHtml(biz.name)} ya está enviada.` : `Tu tarjeta de ${escapeHtml(biz.name)} ya existe.`} Para cuidar tu privacidad, confirma que eres tú.</p>
      ${compraBannerHtml('locked')}
      ${unlockNoBday ? `
      <div class="card mt-24"><p style="font-weight:700">Tu tarjeta aún no tiene cumpleaños registrado.</p><p class="muted small mt-8">Pide en caja que lo agreguen o que te envíen tu tarjeta por WhatsApp.</p></div>` : `
      <div class="card mt-24">
        <div class="field" style="margin-bottom:0"><label>¿Cuándo es tu cumpleaños?</label>${bdayPickerHtml('unlockForm','u-bday')}</div>
        ${errorHtml(unlockError)}
      </div>
      <button class="btn btn-primary btn-block mt-16" ${busy?'disabled':''} onclick="unlockCard()">${busy?'Abriendo…':ic('card')+' Abrir mi tarjeta'}</button>`}
      <div class="card mt-24">
        <div class="card-title">${ic('info',18)} ¿Necesitas ayuda?</div>
        <p class="muted small">Muestra este código en caja y el personal te ${pend?'aprueba':isWalletBiz(biz)?'abona tu saldo':'pone tu sello'} o te envía tu tarjeta por WhatsApp.</p>
        <div class="qr-help">${qrSvg(biz.slug+':'+customer.phone)}</div>
        <p class="muted small" style="text-align:center">${escapeHtml(fmtPhone(customer.phone))}</p>
      </div>`;
  }else if(status==='pending'){
    body = `
      <div class="success-ico mt-12" style="background:var(--brand-soft);color:var(--brand)">${ic('clock',30)}</div>
      <h2>Solicitud enviada</h2>
      <p class="lead">${customer.name?escapeHtml(customer.name)+', t':'T'}u tarjeta de ${escapeHtml(biz.name)} está esperando aprobación. Dile tu nombre al personal en tu visita.</p>
      ${compraBannerHtml('pending')}
      ${signupBannerHtml(biz, 'pending')}
      <div class="mt-24" style="opacity:.55">${passHtml(biz, null, {})}</div>
      ${aboutCardHtml(biz, customer)}
      <button class="btn btn-secondary btn-block mt-24" ${busy?'disabled':''} onclick="buscarTarjetaCliente()">${busy?'Revisando…':ic('refresh')+' Ya me aprobaron, ver mi tarjeta'}</button>`;
  }else{
    const goal = goalOf(biz);
    const left = Math.max(0, goal - customer.progress);
    body = `
      <h2 class="mt-12">Hola${customer.name?', '+escapeHtml(customer.name):''}</h2>
      ${customer.level && customer.level.index ? `<div class="mt-8">${levelChipHtml(customer.level)}</div>` : ''}
      <p class="lead">${isWalletBiz(biz) ? (customer.progress>0 ? `Tienes <b>${pesos(customer.progress)}</b> de saldo a favor para tu próxima compra.` : `Cada compra te deja ${biz.walletPct}% en saldo para la siguiente.`) : rewardsLeadText(biz, customer) || (left===0 ? 'Te vimos volver y te lo agradecemos: ¡ya tienes tu premio! Muéstrale esta tarjeta al personal.' : `Te ${left===1?'falta':'faltan'} ${left} ${biz.mechanic==='sellos'?(left===1?'sello':'sellos'):(left===1?'punto':'puntos')} para tu premio.`)}</p>
      ${compraBannerHtml('found')}
      ${offlineChipHtml()}
      ${promoBannerHtml(biz, customer.promoForYou)}
      <div class="mt-24">${passHtml(biz, customer, {qr:true, live: !!(biz.strictMode && customer.qrSecret)})}</div>
      ${aboutCardHtml(biz, customer)}
      ${reminderCardHtml(biz, customer)}
      ${rewardsMenuCardHtml(biz, customer)}
      ${levelCardHtml(biz, customer)}
      ${pushCardHtml(biz, customer)}
      ${customerExtrasHtml(biz, customer)}
      ${walletKinds().length && !biz.isDemo ? `<div class="wallet-btns" style="${walletKinds().length===1?'grid-template-columns:1fr':''}">
        ${walletKinds().includes('apple') ? `<button class="wallet-btn" onclick="addToWallet('apple')">${ic('wallet',18)} Agregar a Apple Wallet</button>` : ''}
        ${walletKinds().includes('google') ? `<button class="wallet-btn" ${busy?'disabled':''} onclick="addToWallet('google')">${ic('wallet',18)} Agregar a Google Wallet</button>` : ''}
      </div>` : ''}
      ${biz.promos && (biz.promos.rules.length || biz.promos.referral) ? `<div class="card mt-16">
        <div class="card-title">${ic('gift',18)} Promociones de ${escapeHtml(biz.name)}</div>
        ${biz.promos.rules.length ? `<ul class="promo-rules">${biz.promos.rules.map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
        ${biz.promos.referral ? `<button class="btn btn-secondary btn-block mt-12" onclick="inviteFriend()">${ic('share',18)} Invitar a un amigo</button>` : ''}
      </div>` : ''}
      ${customer.hasBirthday===false ? `<div class="card mt-16">
        <div class="card-title">${ic('gift',18)} Agrega tu cumpleaños</div>
        <p class="muted small" style="margin-bottom:10px">Así abres tu tarjeta desde cualquier celular solo con tu número de WhatsApp y tu cumpleaños.</p>
        ${bdayPickerHtml('myBday','my-bday')}
        <button class="btn btn-secondary btn-block mt-12" ${busy?'disabled':''} onclick="saveMyBirthday()">Guardar mi cumpleaños</button>
      </div>` : ''}
      ${communityCardHtml(biz, customer)}
      <div class="private-note mt-16">${ic('lock',16)}<span>Solo tú y ${escapeHtml(biz.name)} pueden ver ${isWalletBiz(biz)?'tu saldo':'tus sellos'}. Si cambias de celular, ábrela con tu número de WhatsApp y tu cumpleaños.</span></div>
      <div class="card-links">${compraEntryHtml()}${installLinkHtml('card')}</div>`;
  }
  return `
  <div class="wrap fade">
    <button class="back" onclick="view='clienteBuscar';render()">${ic('left',18)} Buscar otra tarjeta</button>
    ${body}
    ${biz && status!=='no_biz' ? legalFootHtml(biz) : ''}
  </div>`;
}

let legalPage = null;
function viewLegalPage(){
  const { id, biz, error } = legalPage || {};
  const back = biz ? `location.href='/?n=${jsEsc(enc(biz.slug))}'` : `location.href='/'`;
  if(error) return `<div class="wrap fade"><div class="topbar">${logoHtml()}</div><div class="card mt-24"><div class="empty"><b style="color:var(--ink)">No encontramos ese negocio</b><p class="small mt-8">Revisa la liga con el negocio.</p></div></div></div>`;
  const others = biz ? [['privacidad','Aviso de privacidad'],['programa','Términos del programa']] : [['terminos','Términos del servicio'],['privacidad-pae','Aviso de privacidad']];
  return `<div class="wrap fade" style="max-width:680px">
    <div class="topbar lg-noprint"><button class="back" style="margin:0" onclick="${back}">${ic('left',18)} ${biz ? escapeHtml(biz.name) : 'Redeo'}</button><button class="btn btn-secondary btn-sm" onclick="window.print()">${ic('printer',16)} Imprimir</button></div>
    ${legalDocHtml(id, biz)}
    <div class="lg-foot lg-noprint">${others.filter(o=>o[0]!==id).map(o=>`<button onclick="location.href='${legalUrl(o[0], biz && biz.slug)}'">${o[1]}</button>`).join('')}</div>
  </div>`;
}

function viewCargando(){
  return `<div class="wrap fade"><div class="topbar">${logoHtml()}</div><div class="empty"><p class="muted">Cargando…</p></div></div>`;
}
