/* Redeo · Portada: tarjeta que se sella, "Así de fácil" y la pantalla de inicio. */
/* ---------- Vistas ---------- */
const DEMO_BIZ = { slug:'cafe-luna', name:'Café Luna', mechanic:'sellos', stampsGoal:10, pointsGoal:100, pointsPerVisit:10, rewardDesc:'Un café gratis', color:'#0F5A45' };

// "Así de fácil": 4 escenas animadas que cambian solas; el ticket de abajo marca el paso y deja brincar a cualquiera.
const HOW_STEPS = [
  ['01','ESCANEA EL QR','2 SEG','con la cámara del celular'],
  ['02','PIDE TU TARJETA','0 APPS','solo nombre y teléfono'],
  ['03','COMPRA Y SELLA','+1','te lo ponen en caja'],
  ['04','COMPLETA','PREMIO','¡y ganas tu premio!']
];
let howStep = 0, howTimer = null, howPausedUntil = 0;
function howSceneHtml(i){
  const biz = DEMO_BIZ;
  if(i===0) return `<div class="hw-scene s1">
      <div class="hw-poster"><div class="top">${escapeHtml(biz.name)}<small>Junta 10 sellos y gana un café</small></div>${qrImg(location.origin+'/?n='+biz.slug)}<div class="cta">Escanea y pide tu tarjeta</div></div>
      <div class="hw-phone"><div class="hw-screen"><div class="hw-cam">${qrImg(location.origin+'/?n='+biz.slug)}<div class="hw-brackets"></div><span class="hw-scanline"></span><span class="hw-ok">${ic('check',12)} ${escapeHtml(biz.name)}</span></div></div></div>
    </div>`;
  if(i===1) return `<div class="hw-scene s2">
      <span class="hw-chip">${ic('phone',14)} Sin descargar apps</span>
      <div class="hw-phone" style="width:150px;height:262px"><div class="hw-screen"><div class="hw-form">
        <div class="hd">${escapeHtml(biz.name)}</div><div class="sub">Pide tu tarjeta de lealtad</div>
        <div class="hw-lbl">Tu nombre</div><div class="hw-field f1"><span>Ana López</span></div>
        <div class="hw-lbl">Tu teléfono</div><div class="hw-field f2"><span>222 123 4567</span></div>
        <div class="hw-btn">Solicitar mi tarjeta</div>
      </div><div class="hw-sent"><i>${ic('check',18)}</i>¡Tarjeta lista!</div></div></div>
    </div>`;
  if(i===2) return `<div class="hw-scene s3"><div class="hw-card">${passHtml(biz, {name:'Ana', phone:'', progress:8}, {})}</div><span class="hw-plus">${ic('stamp',14)} +1 sello</span></div>`;
  const colors = ['#0F5A45','#C9973A','#E0A526','#5BE0A4','#E26D5A','#2C56A8'];
  const conf = Array.from({length:18},(_,k)=>`<i style="left:${(k*53)%100}%;background:${colors[k%colors.length]};animation-delay:${(k%6)*0.18}s"></i>`).join('');
  return `<div class="hw-scene s4"><div class="hw-confetti">${conf}</div><div class="hw-card">${passHtml(biz, {name:'Ana', phone:'', progress:10}, {})}</div><span class="hw-prize">${ic('gift',18)} ¡${escapeHtml(biz.rewardDesc)}!</span></div>`;
}
function howStepsHtml(){
  return HOW_STEPS.map((r,k)=>`<button type="button" class="lp-step ${k===howStep?'on':''}" aria-pressed="${k===howStep}" onclick="howGo(${k})"><div class="lp-r-row"><span class="n">${r[0]}</span>${r[1]}<span class="d"></span>${r[2]}</div><div class="lp-r-note">${r[3]}</div></button>`).join('');
}
function paintHow(){
  const st = document.getElementById('hw-stage'); if(!st) return;
  st.innerHTML = howSceneHtml(howStep);
  const rows = document.getElementById('hw-rows');
  if(rows){ rows.innerHTML = howStepsHtml(); rows.classList.toggle('paused', Date.now() < howPausedUntil); }
}
function howGo(i){ howStep = i; howPausedUntil = Date.now() + 9000; paintHow(); }
function ensureHowTimer(){
  if(howTimer) return;
  howTimer = setInterval(()=>{
    if(view!=='home' || !document.getElementById('hw-stage')){ clearInterval(howTimer); howTimer = null; return; }
    if(Date.now() < howPausedUntil) return;
    howStep = (howStep + 1) % HOW_STEPS.length;
    paintHow();
  }, 3600);
}
// Portada: tarjeta de papel que se puede sellar tocándola, ticket de "cómo funciona" y vista del negocio.
const LP_GOAL = 10;
let lpStamps = 4, lpLocked = false, lpObserver = null;
function lpInk(i, fresh){
  const r = [-14, 9, -6, 16, -11, 4, -17, 12, -3, 7][i % 10];
  return `<span class="lp-ink ${fresh?'new':''}" style="--r:${r}deg"><svg viewBox="0 0 60 60" aria-hidden="true"><g filter="url(#lp-rough)"><circle cx="30" cy="30" r="25.5" fill="none" stroke="currentColor" stroke-width="3.2"/><circle cx="30" cy="30" r="20" fill="none" stroke="currentColor" stroke-width="1.1"/><text x="30" y="37.5" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="700" font-style="italic" font-size="21" fill="currentColor">R</text><circle cx="30" cy="12.5" r="1.4" fill="currentColor"/><circle cx="30" cy="47.5" r="1.4" fill="currentColor"/></g></svg></span>`;
}
function lpSlotsHtml(fresh){
  let h = '';
  for(let i=0;i<LP_GOAL;i++){
    const on = i < lpStamps, last = i === LP_GOAL-1;
    h += `<div class="lp-slot ${last?'last':''}">${on ? lpInk(i, fresh===i) : (last ? ic('gift',16) : '')}</div>`;
  }
  return h;
}
function lpPaint(fresh){
  const el = document.getElementById('lp-slots'); if(!el) return;
  el.innerHTML = lpSlotsHtml(fresh);
  const c = document.getElementById('lp-count'); if(c) c.textContent = String(lpStamps).padStart(2,'0') + '/' + LP_GOAL;
}
function lpStamp(){
  if(lpLocked) return;
  lpStamps++;
  try{ navigator.vibrate && navigator.vibrate(12); }catch(e){}
  lpPaint(lpStamps-1);
  if(lpStamps >= LP_GOAL){
    lpLocked = true;
    setTimeout(()=>{
      const card = document.getElementById('lp-card'); if(!card) return;
      const p = document.createElement('div'); p.className = 'lp-prize';
      p.innerHTML = '<div>¡Café gratis!<small>PREMIO CANJEADO</small></div>';
      card.appendChild(p);
      try{ navigator.vibrate && navigator.vibrate([20,40,20]); }catch(e){}
      setTimeout(()=>{ lpStamps = 0; lpLocked = false; p.remove(); lpPaint(); }, 2600);
    }, 380);
  }
}
function lpCountUp(el){
  const to = Number(el.getAttribute('data-to')) || 0, t0 = performance.now(), dur = 1100;
  const step = t => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if(k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function lpMount(){
  ensureHowTimer();
  if(lpObserver) lpObserver.disconnect();
  const reveal = el => {
    if(el.classList.contains('lp-receipt')) el.classList.add('print');
    if(el.classList.contains('lp-dash')){
      el.querySelectorAll('[data-to]').forEach(lpCountUp);
      el.querySelectorAll('.lp-chart i').forEach(i => { i.style.height = i.getAttribute('data-h') + '%'; });
    }
  };
  const targets = document.querySelectorAll('.lp-receipt, .lp-dash');
  if(!('IntersectionObserver' in window)){ targets.forEach(reveal); return; }
  lpObserver = new IntersectionObserver(entries => entries.forEach(en => { if(en.isIntersecting){ reveal(en.target); lpObserver.unobserve(en.target); } }), { threshold: .3 });
  targets.forEach(t => lpObserver.observe(t));
}

/* ---------- La historia de Redeo (2.4) ----------
   Se usa en la portada (completa) y en Aprende → ¿Por qué Redeo? (corta, con "Leer la historia"). */
let rdStoryOpen = false;
function redeoStoneHtml(){
  return `<div class="rd-stone">
    <span class="rd-place">Roma · hace dos mil años</span>
    <div class="rd-word" aria-label="Redeo">R<i>·</i>E<i>·</i>D<i>·</i>E<i>·</i>O</div>
    <div class="rd-math" aria-label="re, de nuevo, más ire, ir: voy de nuevo">
      <span><b>re</b><small>de nuevo</small></span><em>+</em><span><b>ire</b><small>ir</small></span><em>=</em><span class="res"><b>“yo vuelvo”</b><small>voy de nuevo</small></span>
    </div>
    <p class="rd-rome">La palabra con la que alguien prometía regresar.</p>
  </div>`;
}
function redeoStoryHtml(mode){
  const full = `
    <p class="rd-p">Cada negocio tiene clientes que un día cruzaron la puerta por primera vez y decidieron volver. A lo mejor fue el café, el corte o el trato, o que alguien se acordó de su nombre.</p>
    <blockquote class="rd-quote">Ese <b>“vuelvo”</b> que el cliente dice en silencio cuando sale contento es lo más valioso que tiene un negocio, y casi nadie lo cuida.</blockquote>
    <p class="rd-p"><b>Redeo nació para cuidarlo.</b> Cada visita queda guardada en la tarjeta y cada sello cuenta. Cuando llega el premio, el negocio le dice al cliente <span class="rd-hl">“te vimos volver y te lo agradecemos”</span>, y el cliente se va con una razón más para regresar.</p>
    <p class="rd-end">Una palabra de hace dos mil años sigue diciendo lo mismo: <b>las personas regresan a donde las tratan bien.</b></p>`;
  if(mode==='short'){
    return `<div class="rd-story rd-short">
      <p class="rd-kicker">La historia de Redeo</p>
      ${redeoStoneHtml()}
      <p class="rd-p rd-lead">Redeo significa <b>“yo vuelvo”</b> en latín. Es lo que piensa un cliente contento cuando sale de tu negocio. Nosotros te ayudamos a que se cumpla.</p>
      ${rdStoryOpen ? `<div class="fade">${full}</div>` : `<button class="rd-more" onclick="rdStoryOpen=true;render()">Leer la historia ${ic('right',16)}</button>`}
      <p class="rd-sign">Redeo. <em>Yo vuelvo.</em></p>
    </div>`;
  }
  return `<section class="rd-story lp-sec" aria-label="La historia de Redeo">
    <p class="rd-kicker">La historia de Redeo</p>
    <h2 class="lp-h2">Un nombre con <em>dos mil años</em> de cumplir su palabra.</h2>
    ${redeoStoneHtml()}
    ${full}
    <p class="rd-sign">Redeo. <em>Yo vuelvo.</em></p>
  </section>`;
}

function viewHome(){
  const now = new Date();
  const fecha = now.toLocaleDateString('es-MX',{ day:'2-digit', month:'2-digit', year:'numeric' });
  const hora = now.toLocaleTimeString('es-MX',{ hour:'2-digit', minute:'2-digit', hour12:false });
  let ln = 0; const d = () => `style="animation-delay:${(ln++)*0.11}s"`;
  const week = [['L',38],['M',30],['M',44],['J',52],['V',78],['S',100],['D',64]];
  return `
  <div class="wrap fade lp">
    <svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="lp-rough"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter></svg>
    <div class="lp-top">${logoHtml()}<button class="lp-enter" onclick="view='negocioEntrar';render()">Entrar a mi negocio</button></div>

    <div class="lp-hero">
    <h1 class="lp-h1">Que tus clientes <span class="l2">siempre <em>vuelvan.<svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 13 C 50 5, 120 4, 197 10"/></svg></em></span></h1>
    <p class="lp-sub">La tarjeta de sellos de toda la vida, ahora <b>en el celular</b> de tus clientes. Sin papel que se pierde, sin apps que descargar.</p>

    <div class="lp-stage">
      <div class="lp-seal" aria-hidden="true"><svg viewBox="0 0 100 100"><defs><path id="lp-circ" d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0"/></defs><text font-family="IBM Plex Mono, monospace" font-size="9.2" font-weight="600" letter-spacing="2.2" fill="#13231D"><textPath href="#lp-circ">SIN APPS · SIN PAPEL · SIN FILAS ·</textPath></text></svg><div class="c">R</div></div>
      <div class="lp-cardwrap">
        <div class="lp-card" id="lp-card" role="button" tabindex="0" aria-label="Toca para poner un sello" onclick="lpStamp()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();lpStamp()}">
          <div class="lp-card-h"><b>${escapeHtml(DEMO_BIZ.name)}</b><span>Nº 0427</span></div>
          <div class="lp-card-rule">10 sellos = ${escapeHtml(inSentence(DEMO_BIZ.rewardDesc))}</div>
          <div class="lp-slots" id="lp-slots">${lpSlotsHtml()}</div>
        </div>
      </div>
      <div class="lp-hint"><span>${ic('stamp',18)} Toca la tarjeta y ponle un sello.</span><span class="lp-count" id="lp-count">${String(lpStamps).padStart(2,'0')}/${LP_GOAL}</span></div>
    </div>

    <div class="lp-doors">
      <button class="lp-door biz" onclick="view='negocioAuth';render()"><span class="ico">${ic('store',22)}</span><span class="txt"><b>Tengo un negocio</b><small>Crea tu tarjeta o entra</small></span><span class="go">${ic('right',18)}</span></button>
      <button class="lp-door cli" onclick="view='clienteBuscar';render()"><span class="ico">${ic('card',22)}</span><span class="txt"><b>Soy cliente</b><small>Ver mi tarjeta de sellos</small></span><span class="go">${ic('right',18)}</span></button>
    </div>
    </div>

    <section class="lp-sec" aria-label="Cómo funciona">
      <h2 class="lp-h2">Así de <em>fácil</em>.</h2>
      <div class="lp-how">
      <div class="hw-stage" id="hw-stage" role="img" aria-label="Animación de cómo funciona" onclick="howGo((howStep+1)%4)">${howSceneHtml(howStep)}</div>
      <div class="lp-rwrap hw-ticket"><div class="lp-receipt">
        <div class="lp-r-c lp-r-t ln" ${d()}>REDEO · TICKET DE LEALTAD</div>
        <div class="lp-r-c lp-r-m ln" ${d()}>${fecha} ${hora} · CAJA 01</div>
        <hr class="lp-r-hr ln" ${d()}>
        <div class="lp-steps ${Date.now()<howPausedUntil?'paused':''} ln" ${d()} id="hw-rows">${howStepsHtml()}</div>
        <hr class="lp-r-hr ln" ${d()}>
        <div class="lp-r-tot ln" ${d()}><span>TOTAL</span><span>CLIENTES<br>QUE VUELVEN</span></div>
        <div class="lp-bars ln" ${d()}></div>
        <div class="lp-r-c lp-r-m ln" ${d()}>¡GRACIAS POR VOLVER!</div>
      </div></div>
      </div>
    </section>

    ${redeoStoryHtml('full')}

    <section class="lp-biz" aria-label="Para negocios">
      <h2 class="lp-h2">Y tú, desde el mostrador, <em>ves esto:</em></h2>
      <div class="lp-biz-grid"><div class="lp-biz-a">
      <div class="lp-dash">
        <div class="lp-dash-h"><span>Hoy en ${escapeHtml(DEMO_BIZ.name)}</span><span>Ejemplo</span></div>
        <div class="lp-nums">
          <div><b data-to="37">0</b><span>sellos dados</span></div>
          <div><b data-to="12">0</b><span>clientes que regresaron</span></div>
          <div><b data-to="5">0</b><span>premios canjeados</span></div>
        </div>
        <div class="lp-chart" aria-hidden="true">${week.map((w,i)=>`<div class="${i===5?'hi':''}"><i data-h="${w[1]}"></i>${w[0]}</div>`).join('')}</div>
      </div>
      <ul class="lp-list">
        <li><span class="ic">${ic('scan',16)}</span><span><b>Das sellos escaneando</b>, en 2 segundos, desde tu celular.</span></li>
        <li><span class="ic">${ic('users',16)}</span><span><b>Sabes quién ya no viene</b> y le mandas un "te extrañamos" por WhatsApp.</span></li>
        <li><span class="ic">${ic('gift',16)}</span><span><b>Promociones que traen gente:</b> hora feliz, días dobles, cumpleaños.</span></li>
        <li><span class="ic">${ic('lock',16)}</span><span><b>Cada empleado con su clave:</b> sabes quién dio cada sello.</span></li>
        <li><span class="ic">${ic('wallet',16)}</span><span><b>¿Vendes ropa, zapatos o lentes?</b> Usa Monedero: cada compra deja saldo para la siguiente, y solo cuesta si te vuelven a comprar.</span></li>
      </ul>
      </div><div class="lp-biz-b">
      ${acadCalcCardHtml('home')}
      <button class="lp-calc-go" onclick="const e=document.getElementById('precios');if(e)e.scrollIntoView({behavior:'smooth',block:'start'})">Ver los planes y precios ${ic('down',18)}</button>
      </div></div>
    </section>

    ${pricingHtml()}

    <div class="lp-foot">
      <div class="m">Redeo. Yo vuelvo. · Tarjetas de lealtad digitales</div>
      <button class="linkbtn small mt-12" style="color:var(--muted);font-weight:600" onclick="adminError='';view='adminPae';render()">Administración P.A.E.</button>
    </div>
    ${legalFootHtml(null)}
  </div>`;
}

// Lo que más pregunta un dueño antes de decir que sí, en una sola línea.
function trustLineHtml(){
  return `<p class="lp-trust">14 días gratis · Sin tarjeta de crédito · Sin contrato · Tu lista de clientes es tuya</p>`;
}

// ----- Precios: sección propia, Esencial contra Premium -----
function pricingHtml(){
  const p = serverConfig.pricing || { esencial:350, premium:500, isRegular:true };
  const founder = !p.isRegular && p.regular;
  const diff = Math.max(0, (p.premium||0) - (p.esencial||0));
  const diffVisits = diff ? Math.ceil(diff / 40) : 0;
  const check = t => `<li>${ic('check',16)}<span>${t}</span></li>`;
  const price = (k) => `<div class="pl-price"><b>${money(p[k])}</b><span>/mes</span>${founder?`<s>${money(p.regular[k])}</s>`:''}</div>`;
  const dots = founder && p.spots && p.spots<=30 ? `<div class="pl-dots" aria-hidden="true">${Array.from({length:p.spots},(_,i)=>`<i class="${i < p.spots-p.spotsLeft?'on':''}"></i>`).join('')}</div>` : '';
  return `<section class="lp-sec pl-sec" id="precios" aria-label="Planes y precios">
    <p class="rd-kicker">Planes y precios</p>
    <h2 class="lp-h2">Elige cómo quieres <em>crecer</em>.</h2>
    <p class="pl-lead">Los dos planes traen tu tarjeta digital, clientes ilimitados y tu sticker de mostrador. Empiezas con <b>14 días de Premium gratis</b> y al final eliges el que te convenga.</p>
    ${founder ? `<div class="pl-founder"><span class="pl-founder-tag">${escapeHtml(p.label||p.name||'Precio de fundador')}</span><p>${p.spotsLeft!=null?`<b>Quedan ${p.spotsLeft} de ${p.spots} lugares.</b> `:''}Quien entra ahora se queda con este precio mientras siga con Redeo, aunque después suba.</p>${dots}</div>` : ''}
    <div class="pl-grid">
      <article class="pl-card">
        <h3>Esencial</h3>
        <p class="pl-for">Para empezar a juntar clientes que regresan.</p>
        ${price('esencial')}
        <ul class="pl-list">
          ${check('Tarjeta digital de sellos, puntos o monedero')}
          ${check('Clientes ilimitados, sin apps que descargar')}
          ${check('Sticker y cartel con tu código QR')}
          ${check('Das sellos escaneando en 2 segundos')}
          ${check('Código de compra para pedidos y a domicilio')}
          ${check('Un PIN para cada empleado, con alertas')}
          ${check('Tu lista de clientes, descargable cuando quieras')}
        </ul>
      </article>
      <article class="pl-card pl-pro">
        <span class="pl-badge">Con este empiezas tu prueba</span>
        <h3>Premium</h3>
        <p class="pl-for">Para que tus clientes regresen más seguido.</p>
        ${price('premium')}
        <p class="pl-plus">Todo lo de Esencial, y además:</p>
        <ul class="pl-list">
          ${check('<b>Tu logo, tus colores</b> y tu diseño de tarjeta')}
          ${check('<b>Promociones automáticas:</b> hora feliz, días dobles, cumpleaños, invita a un amigo')}
          ${check('<b>Te extrañamos:</b> ve quién dejó de venir y escríbele con un toque')}
          ${check('<b>Avisos al celular</b> de tus clientes con tu nombre')}
          ${check('<b>Recordatorios:</b> "ya te toca tu corte", "ya toca tu café"')}
          ${check('<b>Niveles de cliente</b> y premios a elegir')}
          ${check('<b>Reporte del mes</b> con tus mejores clientes')}
          ${check('<b>Código que cambia</b> para que nadie haga trampa')}
        </ul>
        ${diff ? `<div class="pl-math">La diferencia es de <b>${money(diff)} al mes</b>. Si de cada venta te quedan $40, se paga con <b>${diffVisits} ${diffVisits===1?'visita extra':'visitas extra'} al mes</b>.</div>` : ''}
      </article>
    </div>
    <p class="pl-year">${ic('calendar',16)} <span><b>Paga el año y llévate 2 meses gratis:</b> Esencial ${money((p.esencial||0)*10)} y Premium ${money((p.premium||0)*10)} al año.</span></p>
    <button class="lp-cta" onclick="openLeadForm('prueba')">Empieza tu prueba gratis de 14 días <span>${ic('right',20)}</span></button>
    ${trustLineHtml()}
  </section>`;
}
