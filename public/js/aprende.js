/* Redeo · Aprende Redeo: misiones, niveles y "¿Por qué Redeo?". */
/* ---------- Aprende Redeo: guía con misiones (gamificada) y "¿Por qué Redeo?" ---------- */
let acadView = 'misiones';
let acadOpen = null;               // misión abierta
let acadCalc = { clientes: 40, ticket: 80, extra: 1, margen: 50 };
let acadScene = null;              // escenario abierto en "¿Por qué Redeo?"

function acadKey(){ return 'vuelve_acad_' + session.slug; }
function acadState(){
  try{ const s = JSON.parse(store.get(acadKey()) || 'null'); if(s && s.flags) return s; }catch(e){}
  return { flags:{}, manual:{}, celebrated:null };
}
function acadSave(s){ store.set(acadKey(), JSON.stringify(s)); }
function acadFlag(k){ if(!session.slug) return; const s = acadState(); if(!s.flags[k]){ s.flags[k] = Date.now(); acadSave(s); } }
function acadClaim(id){ const s = acadState(); s.manual[id] = Date.now(); acadSave(s); acadOpen = null; render(); acadCelebrate(true); }
function openAcademy(view){ acadView = view || 'misiones'; acadOpen = null; dashboardTab = 'aprende'; window.scrollTo(0,0); render(); }

const ACAD_LEVELS = [
  { n:1, name:'Abre tu local', rank:'Aprendiz', icon:'store' },
  { n:2, name:'Tus primeros clientes', rank:'En marcha', icon:'users' },
  { n:3, name:'El día a día', rank:'Anfitrión', icon:'stamp' },
  { n:4, name:'Vende más', rank:'Estratega', icon:'trend' },
  { n:5, name:'Maestro de la lealtad', rank:'Maestro de la lealtad', icon:'crown' }
];

function acadStats(){
  const cs = activeCustomers();
  return {
    n: cs.length,
    given: cs.reduce((a,c)=>a + (Number(c.given)||0), 0),
    redeem: cs.reduce((a,c)=>a + (c.redemptions||0), 0),
    bday: cs.some(c => isOwner() ? !!c.birthday : !!c.hasBirthday)
  };
}

// Cada misión: qué es, para qué sirve, cómo se hace, cuántos puntos da y cómo se detecta sola.
function acadMissions(){
  const b = cache.biz, st = acadStats(), s = acadState(), f = s.flags, onb = onbFlags();
  const prem = isPremiumBiz(), owner = isOwner();
  const u = b.mechanic==='sellos' ? 'sello' : 'punto', us = u + 's';
  const promosOn = !!(b.promos && (b.promos.welcome || b.promos.referral || (b.promos.rules||[]).length));
  const goCfg = "openConfig()";
  const goLegal = "openConfig();setTimeout(()=>{const e=document.getElementById('legal-card');if(e)e.scrollIntoView({behavior:'smooth'})},60)";
  const goCli = "dashboardTab='clientes';render()";
  const M = [
    // Nivel 1
    { id:'premio', lvl:1, pts:20, owner:true, auto:()=>!!onb.premio, go:goCfg, goLabel:'Ir a Ajustes',
      title:'Define tu premio y tu meta', why:'Un premio que antoja y una meta alcanzable son lo que hace que la gente regrese.',
      steps:['Entra a Ajustes.', `Escribe tu premio (ej. "Un café gratis") y cuántos ${us} se necesitan.`, `Lo ideal: entre 8 y 10 ${us}. Si es muy lejos, la gente se desanima.`, 'Toca Guardar cambios.'] },
    { id:'legal', lvl:1, pts:20, owner:true, auto:()=>!bizLegalMissing(b), go:goLegal, goLabel:'Completar datos',
      title:'Completa tu aviso de privacidad', why:'Tus clientes ven quién cuida sus datos. Te da confianza y te protege.',
      steps:['Ve a Ajustes, hasta abajo.', 'Escribe tu nombre o razón social, domicilio y correo.', 'Toca Guardar datos legales. El aviso se arma solo.'] },
    { id:'logo', lvl:1, pts:20, owner:true, premium:true, auto:()=>!!b.logoUrl, go:goCfg, goLabel:'Subir logo',
      title:'Pon tu marca en la tarjeta', why:'Con tu logo y tu color, la tarjeta se siente 100% tuya.',
      steps:['En Ajustes, toca Cambiar logo y elige tu imagen.', 'Elige tu color exacto, el ícono de los sellos y el estilo.', 'Toca Guardar cambios.'] },
    { id:'cartel', lvl:1, pts:20, owner:true, auto:()=>!!onb.cartel, go:"setOnbFlag('cartel');printPoster()", goLabel:'Imprimir cartel',
      title:'Imprime tu cartel con QR', why:'El cartel en el mostrador hace que los clientes pidan su tarjeta solos.',
      steps:['Toca Imprimir cartel.', 'Imprímelo en tamaño carta (o guárdalo en PDF).', 'Pégalo junto a la caja, a la altura de los ojos.'] },
    { id:'staff', lvl:1, pts:20, owner:true, auto:()=>!!(b.hasStaffPin || b.teamCount), go:"openEquipo()", goLabel:'Ir a mi equipo',
      title:'Da de alta a tu equipo', why:'Cada persona entra con su propio PIN: así sabes quién dio cada sello, y nadie ve tus ajustes ni tu base de clientes.',
      steps:['En Ajustes → Equipo y seguridad, escribe el nombre y un PIN para cada persona.', 'Cada quien entra con el código del negocio y su PIN.', 'Si alguien deja de trabajar contigo, quítalo y su PIN deja de funcionar.'] },
    // Nivel 2
    { id:'cliente1', lvl:2, pts:30, auto:()=>st.n>0, claim:false, go:goCli, goLabel:'Ir a Clientes',
      title:'Registra a tu primer cliente', why:'Empieza con alguien de confianza: un cliente frecuente o un familiar.',
      steps:['Pídele que escanee tu cartel con QR, o toca Nuevo cliente en Clientes.', 'Escribe su teléfono y nombre.', '¡Listo! Ya tiene su tarjeta.'] },
    { id:'aprobar', lvl:2, pts:20, auto:()=>!!f.approve, go:goCli, goLabel:'Ver solicitudes',
      title:'Aprueba una solicitud', why:'Cuando un cliente pide su tarjeta desde el QR, tú la apruebas en su visita.',
      steps:['El cliente escanea el cartel y llena sus datos.', 'Te llega arriba en Clientes, con su nombre.', 'Confirma que es él y toca Aprobar.'] },
    { id:'sello1', lvl:2, pts:30, auto:()=>st.given>0, claim:false, go:goCli, goLabel:'Ir a Clientes',
      title:`Da tu primer ${u}`, why:'El momento clave: el cliente ve que ya avanzó y quiere volver.',
      steps:['Busca al cliente por nombre o sus últimos 4 dígitos.', `Toca Dar 1 ${u}.`, 'Dile: "¡Ya llevas uno! Te faltan pocos para tu premio".'] },
    { id:'escanear', lvl:2, pts:20, auto:()=>!!f.scan, go:'openScanner()', goLabel:'Abrir cámara',
      title:'Escanea una tarjeta con la cámara', why:'Es la forma más rápida: 5 segundos por cliente.',
      steps:['Toca el botón negro de escanear, arriba.', 'Apunta la cámara al QR de la tarjeta del cliente.', `Se abre su ficha: da el ${u} ahí mismo.`] },
    // Nivel 3
    { id:'premio1', lvl:3, pts:40, auto:()=>st.redeem>0, claim:false, go:goCli, goLabel:'Ir a Clientes',
      title:'Entrega tu primer premio', why:'Cumplir el premio es lo que genera confianza y recomendaciones.',
      steps:['Cuando un cliente completa su tarjeta, verás Premio listo.', 'Toca Canjear premio y confirma.', 'Celébralo en voz alta: los demás clientes escuchan.'] },
    { id:'whatsapp', lvl:3, pts:20, auto:()=>!!f.wa_card, go:goCli, goLabel:'Ir a Clientes',
      title:'Envía una tarjeta por WhatsApp', why:'Si un cliente no encuentra su tarjeta, se la mandas en un toque.',
      steps:['En Clientes, abre la ficha del cliente.', 'Toca Enviar por WhatsApp.', 'Se abre WhatsApp con su liga personal lista.'] },
    { id:'cumple', lvl:3, pts:20, auto:()=>st.bday, go:goCli, goLabel:'Ir a Clientes',
      title:'Registra un cumpleaños', why:'Con el cumpleaños, el cliente abre su tarjeta desde cualquier celular y tú puedes felicitarlo.',
      steps:['Abre la ficha del cliente.', 'En Cumpleaños, toca Agregar.', 'Elige día y mes, y guarda.'] },
    { id:'deshacer', lvl:3, pts:20, auto:()=>!!f.undo, go:goCli, goLabel:'Ir a Clientes',
      title:'Aprende a corregir un error', why:'Si diste un sello de más, se arregla en segundos y queda registrado.',
      steps:[`Justo después de dar un ${u}, aparece Deshacer.`, 'También puedes deshacer desde el historial de la ficha.', 'Tu personal puede deshacer hasta 15 minutos después.'] },
    { id:'diez', lvl:3, pts:40, auto:()=>st.n>=10, claim:false, go:goCli, goLabel:'Ir a Clientes', progress:()=>Math.min(st.n,10)+' de 10',
      title:'Llega a 10 clientes', why:'Con 10 clientes ya empiezas a ver quién regresa más.',
      steps:['Ofrece la tarjeta a cada cliente en caja: "¿Ya tienes tu tarjeta de lealtad?".', 'Menciona el premio: es lo que convence.', 'Tu cartel con QR hace el resto.'] },
    // Nivel 4 (Premium)
    { id:'promos', lvl:4, pts:40, owner:true, premium:true, auto:()=>promosOn, go:"openCrecer()", goLabel:'Ir a Crecer',
      title:'Activa tus promociones', why:'Sellos dobles, bienvenida y cumpleaños: el sistema los aplica solo.',
      steps:['Entra a Crecer → Promociones.', 'Toca Activar las recomendadas, o prende las que quieras.', 'Toca Guardar. Tus clientes las ven en su tarjeta.'] },
    { id:'referidos', lvl:4, pts:30, owner:true, premium:true, auto:()=>!!(b.promos && b.promos.referral), go:"openCrecer()", goLabel:'Ir a Crecer',
      title:'Activa "Invita a un amigo"', why:'Tus clientes te traen clientes nuevos a cambio de un sello.',
      steps:['En Crecer → Promociones, prende Invita a un amigo.', 'Guarda.', 'Tus clientes verán el botón para invitar en su tarjeta.'] },
    { id:'extranamos', lvl:4, pts:30, owner:true, premium:true, auto:()=>!!f.wa_inactive, go:"openCrecer();setCrecerSub('inactive')", goLabel:'Ver quién no ha vuelto',
      title:'Recupera a un cliente que no ha vuelto', why:'Un mensaje a tiempo trae de regreso a quien se estaba olvidando de ti.',
      steps:['Entra a Crecer → Te extrañamos.', 'Elige hace cuántos días no vienen.', 'Toca Escribir: WhatsApp se abre con el mensaje listo.'] },
    { id:'felicitar', lvl:4, pts:30, owner:true, premium:true, auto:()=>!!f.wa_bday, go:"openCrecer();setCrecerSub('birthdays')", goLabel:'Ver cumpleaños',
      title:'Felicita a un cliente en su cumpleaños', why:'Un detalle personal crea lealtad de verdad.',
      steps:['Entra a Crecer → Cumpleaños.', 'Toca Felicitar y envía el mensaje.', 'Si quieres, regálale un sello.'] },
    { id:'reporte', lvl:4, pts:20, owner:true, premium:true, auto:()=>!!f.report, go:"openCrecer();setCrecerSub('report')", goLabel:'Ver reporte',
      title:'Revisa tu reporte del mes', why:'Clientes nuevos, visitas y lo más vendido: decide con datos.',
      steps:['Entra a Crecer → Reporte.', 'Compara con el mes anterior.', 'Toca Compartir resumen si quieres guardarlo.'] },
    // Nivel 5
    { id:'base', lvl:5, pts:20, owner:true, auto:()=>!!f.download, go:goCfg, goLabel:'Ir a Ajustes',
      title:'Descarga tu base de clientes', why:'Tus clientes son tuyos: ten tu respaldo en Excel.',
      steps:['En Ajustes, baja a Tu base de clientes.', 'Toca Descargar clientes.', 'Se abre en Excel o Google Sheets.'] },
    { id:'comparte', lvl:5, pts:20, owner:true, auto:()=>!!f.share, go:"openInvitar()", goLabel:'Compartir liga',
      title:'Comparte tu tarjeta en redes', why:'Tus seguidores también pueden pedir su tarjeta desde tu liga.',
      steps:['En Resumen → Invita a tus clientes.', 'Toca Compartir o Descargar QR.', 'Publícalo en tus redes o en tu estado de WhatsApp.'] },
    { id:'veinticinco', lvl:5, pts:50, auto:()=>st.n>=25, claim:false, go:goCli, goLabel:'Ir a Clientes', progress:()=>Math.min(st.n,25)+' de 25',
      title:'Llega a 25 clientes', why:'Ya tienes una comunidad que regresa.',
      steps:['Sigue ofreciendo la tarjeta en cada venta.', 'Usa el sello de bienvenida para animar a registrarse.', 'Pide a tus clientes que inviten a un amigo.'] },
    { id:'diezpremios', lvl:5, pts:50, auto:()=>st.redeem>=10, claim:false, go:goCli, goLabel:'Ir a Clientes', progress:()=>Math.min(st.redeem,10)+' de 10',
      title:'Entrega 10 premios', why:'Cada premio entregado es un cliente que volvió varias veces.',
      steps:['Revisa en Resumen quién tiene premio listo.', 'Recuérdaselo cuando venga.', 'Celebra cada canje.'] }
  ];
  const s2 = acadState();
  return M.filter(m => owner || !m.owner).map(m => {
    const locked = !!m.premium && !prem;
    return { ...m, locked, done: !locked && (!!m.auto() || !!s2.manual[m.id]) };
  });
}

function acadSummary(){
  const ms = acadMissions(), avail = ms.filter(m=>!m.locked);
  const total = avail.reduce((a,m)=>a+m.pts,0), earned = avail.filter(m=>m.done).reduce((a,m)=>a+m.pts,0);
  const levels = ACAD_LEVELS.map(L => {
    const mine = avail.filter(m=>m.lvl===L.n);
    return { ...L, total: mine.length, done: mine.filter(m=>m.done).length, complete: mine.length>0 && mine.every(m=>m.done), empty: mine.length===0 };
  });
  let current = levels.find(l => !l.empty && !l.complete) || levels[levels.length-1];
  const completed = levels.filter(l => l.complete).length;
  const rank = (levels.filter(l=>l.complete).slice(-1)[0] || {}).rank || 'Principiante';
  const next = avail.find(m => !m.done && m.lvl === current.n) || avail.find(m => !m.done) || null;
  return { ms, avail, total, earned, levels, current, completed, rank, next, doneCount: avail.filter(m=>m.done).length };
}

// Celebra las misiones que se cumplieron solas (sin repetirlas y sin llenar de avisos la primera vez).
let acadCelebrating = false;
function acadCelebrate(now){
  if(acadCelebrating || !session.slug || !cache.biz || view!=='dashboard' || isExpired() || (isOwner() && cache.biz.needsTerms)) return;
  const s = acadState(), sum = acadSummary();
  const done = sum.avail.filter(m=>m.done).map(m=>m.id);
  if(!s.celebrated){ s.celebrated = done; acadSave(s); return; }
  const fresh = done.filter(id => !s.celebrated.includes(id));
  if(!fresh.length) return;
  s.celebrated = s.celebrated.concat(fresh); acadSave(s);
  const m = sum.avail.find(x => x.id === fresh[fresh.length-1]);
  const lvl = sum.levels.find(l => l.n === m.lvl);
  const msg = lvl && lvl.complete ? `¡Nivel ${lvl.n} completado! Ahora eres ${lvl.rank}.` : `¡Misión cumplida! +${m.pts} pts · ${m.title}`;
  acadCelebrating = true;
  setTimeout(()=>{ acadCelebrating = false; showToast(msg); }, now ? 0 : 1500);
}

// Tarjeta en Resumen que invita a seguir aprendiendo.
function acadCardHtml(){
  const sum = acadSummary(), pct = sum.total ? Math.round(sum.earned/sum.total*100) : 0;
  return `<button class="acad-cta" onclick="openAcademy()">
    <span class="lvl-badge sm">${ic('trophy',18)}</span>
    <span style="flex:1;min-width:0;text-align:left">
      <b>Aprende Redeo · ${escapeHtml(sum.rank)}</b>
      <span class="s">${sum.next ? 'Siguiente misión: '+escapeHtml(sum.next.title) : '¡Completaste todas las misiones!'}</span>
      <span class="xp-bar" style="margin-top:8px"><span style="width:${pct}%"></span></span>
    </span>${ic('right')}
  </button>`;
}

function academyHtml(){
  return `
    <button class="back mt-16" onclick="goHoy()">${ic('left',18)} Volver</button>
    <h2 class="mt-12">Aprende Redeo</h2>
    <p class="lead" style="margin-top:6px">${acadView==='misiones' ? 'Cumple misiones, gana puntos y domina tu tarjeta de lealtad.' : 'Todo lo que tu tarjeta puede hacer por tu negocio.'}</p>
    <div class="seg acad-seg mt-16" role="tablist">
      <button class="${acadView==='misiones'?'on':''}" onclick="acadView='misiones';render()">${ic('trophy',16)} Misiones</button>
      <button class="${acadView==='porque'?'on':''}" onclick="acadView='porque';render()">${ic('bulb',16)} Por qué Redeo</button>
    </div>
    ${acadView==='misiones' ? acadMissionsHtml() : acadWhyHtml()}`;
}

function acadMissionsHtml(){
  const sum = acadSummary(), pct = sum.total ? Math.round(sum.earned/sum.total*100) : 0;
  const cur = sum.current;
  const levelHtml = sum.levels.filter(L => !L.empty || sum.ms.some(m=>m.lvl===L.n)).map(L => {
    const mine = sum.ms.filter(m=>m.lvl===L.n);
    const onlyLocked = mine.length && mine.every(m=>m.locked);
    return `<section class="lvl ${L.complete?'complete':''}">
      <div class="lvl-head">
        <span class="lvl-num ${L.complete?'on':''}">${L.complete ? ic('check',16) : L.n}</span>
        <div style="flex:1;min-width:0"><div class="lvl-title">Nivel ${L.n} · ${escapeHtml(L.name)}</div>
          <div class="muted small">${onlyLocked ? 'Incluido en Premium' : L.complete ? 'Insignia: '+escapeHtml(L.rank) : L.done+' de '+L.total+' misiones'}</div></div>
        ${onlyLocked ? `<span class="plan-pill premium">Premium</span>` : ''}
      </div>
      ${mine.map(m => missionHtml(m, sum.next && sum.next.id===m.id)).join('')}
    </section>`;
  }).join('');
  return `
    <div class="acad-hero mt-16">
      <div style="display:flex;gap:14px;align-items:center">
        <span class="lvl-badge">${ic(ACAD_LEVELS[Math.max(0,sum.completed-1)] ? ACAD_LEVELS[Math.max(0,sum.completed-1)].icon : 'star', 26)}</span>
        <div style="flex:1;min-width:0">
          <div class="acad-rank">${escapeHtml(sum.rank)}</div>
          <div class="acad-sub">Nivel ${cur.n} · ${escapeHtml(cur.name)}</div>
        </div>
        <div style="text-align:right"><div class="acad-pts">${sum.earned}</div><div class="acad-sub">de ${sum.total} pts</div></div>
      </div>
      <span class="xp-bar light mt-16"><span style="width:${pct}%"></span></span>
      <div class="acad-sub" style="margin-top:8px">${sum.doneCount} de ${sum.avail.length} misiones cumplidas</div>
      <div class="badges">${ACAD_LEVELS.map(L => { const l = sum.levels.find(x=>x.n===L.n); const on = l && l.complete; return `<span class="badge-lvl ${on?'on':''}" title="${escapeHtml(L.rank)}">${ic(L.icon,18)}<small>${L.n}</small></span>`; }).join('')}</div>
    </div>
    ${sum.next ? `<div class="next-mission">${ic('bolt',16)}<span>Tu siguiente misión: <b>${escapeHtml(sum.next.title)}</b></span></div>` : `<div class="next-mission done">${ic('trophy',16)}<span><b>¡Eres Maestro de la lealtad!</b> Completaste todas las misiones.</span></div>`}
    ${levelHtml}
    <p class="hint" style="text-align:center">Las misiones se palomean solas cuando las haces en tu panel.</p>`;
}

function missionHtml(m, isNext){
  const open = acadOpen === m.id;
  const state = m.locked ? 'locked' : m.done ? 'done' : isNext ? 'next' : '';
  return `<div class="mission ${state}">
    <button class="mission-row" aria-expanded="${open}" onclick="acadOpen=${open?'null':`'${m.id}'`};render()">
      <span class="m-dot">${m.done ? ic('check',14) : m.locked ? ic('lock',13) : ''}</span>
      <span style="flex:1;min-width:0;text-align:left"><span class="m-title">${escapeHtml(m.title)}</span>${m.progress && !m.done && !m.locked ? `<span class="m-prog">${escapeHtml(m.progress())}</span>` : ''}</span>
      <span class="m-pts">${m.done ? '+'+m.pts : m.pts+' pts'}</span>
    </button>
    ${open ? `<div class="mission-body">
      <p class="small" style="color:var(--ink-2);margin-bottom:10px">${escapeHtml(m.why)}</p>
      ${m.locked ? `<p class="small" style="font-weight:700;color:#6B4700">Esta misión es del plan Premium. Pregúntale a P.A.E. cómo cambiarte.</p>` : `
      <ol class="m-steps">${m.steps.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ol>
      ${m.done ? `<p class="small" style="font-weight:700;color:var(--ok);margin-top:10px">${ic('check',14)} Misión cumplida</p>` : `
      <div class="row mt-12" style="gap:8px">
        <button class="btn btn-primary btn-sm" style="flex:1" onclick="${m.go}">${escapeHtml(m.goLabel)} ${ic('right',16)}</button>
        ${m.claim===false ? '' : `<button class="btn btn-secondary btn-sm" onclick="acadClaim('${m.id}')">Ya lo hice</button>`}
      </div>`}`}
    </div>` : ''}
  </div>`;
}

/* ----- ¿Por qué Redeo? ----- */
const ACAD_SCENES = [
  { id:'cafe', icon:'coffee', name:'Cafetería', idea:'10 sellos = un café gratis. Martes de sello doble para llenar el día más flojo.', why:'El café se compra casi diario: la tarjeta se llena rápido y el cliente elige tu cafetería por costumbre.' },
  { id:'barber', icon:'scissors', name:'Barbería', idea:'5 cortes = el sexto gratis. Si alguien no viene en 30 días, mándale "Te extrañamos".', why:'Un corte cada 3 o 4 semanas es el ritmo perfecto para recordarle que su lugar es contigo.' },
  { id:'pan', icon:'bread', name:'Panadería', idea:'Puntos por cada compra y un pan de regalo en su cumpleaños.', why:'Compras pequeñas y frecuentes: los puntos premian también a quien compra más.' },
  { id:'estetica', icon:'heart', name:'Estética y uñas', idea:'Invita a una amiga y las dos ganan un sello. Felicitación de cumpleaños con descuento.', why:'Tus clientas recomiendan a sus amigas: el referido convierte esa recomendación en visitas.' },
  { id:'autolavado', icon:'car', name:'Autolavado', idea:'Primer sello de regalo al registrarse y el lavado número 8 gratis.', why:'El sello de bienvenida hace que la tarjeta se sienta "ya empezada" y más gente la termina.' },
  { id:'ropa', icon:'shirt', name:'Ropa, calzado y accesorios', idea:'Monedero de 5%: cada compra deja saldo para la siguiente. Invita a una amiga y las dos ganan $50.', why:'Tus clientas compran pocas veces al año, pero cada compra es grande. El saldo solo se usa si te vuelven a comprar a ti, así que no regalas nada.' },
  { id:'comida', icon:'pizza', name:'Comida y antojitos', idea:'Hora feliz de sello doble a la hora de menos gente y premio de temporada.', why:'Mueves clientes a las horas vacías sin bajar tus precios.' }
];
function acadPlanPrice(){ const pr = (memb.data && memb.data.price) || (serverConfig.pricing && serverConfig.pricing[cache.biz && cache.biz.plan==='premium'?'premium':'esencial']); return pr || (cache.biz && cache.biz.plan==='premium' ? 500 : 350); }
// La cuenta se hace con lo que le QUEDA al negocio de cada venta (su ganancia), no con lo que paga el cliente.
function acadCalcOut(){
  const c = acadCalc, price = acadPlanPrice();
  const ticket = Number(c.ticket)||0, margen = (Number(c.margen)||0) / 100;
  const ventas = Math.round((Number(c.clientes)||0) * ticket * (Number(c.extra)||0));
  const ganancia = Math.round(ventas * margen);
  const porVisita = ticket * margen;
  const visits = porVisita > 0 ? Math.ceil(price / porVisita) : 0;
  const semana = visits / 4.3;
  const semanaTxt = !visits ? '' : semana < 0.8 ? ' (menos de 1 por semana)' : semana <= 1.4 ? ' (como 1 por semana)' : ` (unas ${Math.round(semana)} por semana)`;
  return `<div class="calc-out">
    <div><span class="muted small">Ganancia extra al mes</span><div class="calc-big">${money(ganancia)}</div><span class="muted small">En ventas: ${money(ventas)}</span></div>
    <div class="calc-note">${(view!=='dashboard'||isDemoBiz())?'Redeo cuesta':'Tu plan cuesta'} <b>${money(price)}</b> al mes. Si de cada venta te quedan <b>${money(Math.round(porVisita))}</b>, se paga con <b>${visits} ${visits===1?'visita extra':'visitas extra'} al mes</b>${semanaTxt}, sumando a todos tus clientes.</div>
  </div>`;
}
function acadCalcSet(k, v){ acadCalc[k] = v; const el = document.getElementById('calc-out'); if(el) el.innerHTML = acadCalcOut(); }
// Los botones cambian el número sin redibujar toda la pantalla (en la portada no se repiten las animaciones).
function acadCalcPick(btn, k, v){
  acadCalcSet(k, v);
  btn.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===btn));
}

// Calculadora de ganancia: en Aprende, en la demo (demo = true) y en la portada de redeo.app (demo = 'home').
function acadCalcCardHtml(demo){
  return `
    <div class="card${demo==='home'?' lp-calc':demo?' mt-12':''}">
      <div class="card-title">${ic('calc',18)} ${demo?'¿Redeo se paga solo? Haz la cuenta':'¿Cuánto podrías vender de más?'}</div>
      <p class="muted small" style="margin:-4px 0 12px">${demo?'Pon los números de tu negocio.':'Mueve los números con los de tu negocio.'}</p>
      <div class="calc-grid">
        <div class="field" style="margin:0"><label for="calc-c">Clientes frecuentes</label><input id="calc-c" class="input" type="number" inputmode="numeric" min="0" value="${acadCalc.clientes}" oninput="acadCalcSet('clientes', this.value)"></div>
        <div class="field" style="margin:0"><label for="calc-t">Gasto promedio ($)</label><input id="calc-t" class="input" type="number" inputmode="numeric" min="0" value="${acadCalc.ticket}" oninput="acadCalcSet('ticket', this.value)"></div>
      </div>
      <div class="field mt-12" style="margin-bottom:0"><label>Visitas extra al mes por cliente</label>
        <div class="seg" style="margin-top:6px;grid-template-columns:repeat(3,minmax(0,1fr))">${[0.5,1,2].map(v=>`<button class="${Number(acadCalc.extra)===v?'on':''}" onclick="acadCalcPick(this,'extra',${v})">${v===0.5?'Media':v}</button>`).join('')}</div>
      </div>
      <div class="field mt-12" style="margin-bottom:0"><label>¿Cuánto te queda de cada venta?</label>
        <div class="seg" style="margin-top:6px;grid-template-columns:repeat(3,minmax(0,1fr))">${[30,50,70].map(v=>`<button class="${Number(acadCalc.margen)===v?'on':''}" onclick="acadCalcPick(this,'margen',${v})">${v}%</button>`).join('')}</div>
        <p class="hint" style="margin-top:6px">Lo que te queda después de pagar ingredientes y material. Si no lo sabes, deja 50%.</p>
      </div>
      <div id="calc-out">${acadCalcOut()}</div>
      <p class="hint">Es un cálculo de ejemplo con tus propios números, no una garantía.</p>
    </div>`;
}

function acadWhyHtml(){
  const stat = (big, text, src) => `<div class="why-stat"><div class="why-big">${big}</div><div class="small" style="color:var(--ink-2);line-height:1.4">${text}</div><div class="why-src">${src}</div></div>`;
  const ben = (icon, t, d) => `<div class="benefit"><span class="choice-icon" style="background:var(--brand-soft);color:var(--brand);width:40px;height:40px">${ic(icon,19)}</span><div><b>${t}</b><p class="muted small" style="margin-top:2px;line-height:1.45">${d}</p></div></div>`;
  return `
    <div class="mt-16">${redeoStoryHtml('short')}</div>
    <div class="card mt-16 why-hero">
      <p class="eyebrow" style="color:var(--accent)">La idea en una frase</p>
      <h3 style="font-family:var(--display);font-size:1.45rem;line-height:1.2;margin-top:6px;color:#fff">Un cliente que regresa vale más que uno nuevo.</h3>
      <p class="small" style="color:#CFE0D8;margin-top:8px;line-height:1.5">Redeo le da a tus clientes una razón para elegirte otra vez, y a ti las herramientas para no perderlos.</p>
    </div>
    <div class="why-stats">
      ${stat('5 a 25×', 'más cuesta conseguir un cliente nuevo que conservar uno que ya tienes.', 'Harvard Business Review')}
      ${stat('+25 a 95%', 'de utilidades puede traer subir solo 5% los clientes que regresan.', 'Bain &amp; Company')}
      ${stat('34% vs 19%', 'completaron su tarjeta cuando ya traía 2 sellos de regalo. Por eso existe el sello de bienvenida.', 'Estudio Nunes y Drèze')}
    </div>

    <div class="card mt-12">
      <div class="card-title">${ic('gift',18)} Lo que gana tu negocio</div>
      ${ben('refresh','Clientes que regresan más seguido','Cada sello los acerca al premio, y mientras más cerca están, más rápido vuelven.')}
      ${ben('users','Conoces a tus clientes','Nombre, cumpleaños, visitas y lo que más les gusta. Datos que son tuyos, no de una red social.')}
      ${ben('send','Marketing sin pagar anuncios','Escríbeles por WhatsApp con el mensaje listo, solo a quien aceptó recibir promociones.')}
      ${ben('chart','Decisiones con datos','Tu reporte del mes te dice quién regresa, qué se vende más y qué días hacen falta.')}
      ${ben('phone','Tu marca en su celular','Sin apps que descargar y sin tarjetas de papel que se pierdan o se mojen.')}
      ${ben('lock','Adiós a las trampas','Cada sello queda con fecha y hora. Nadie puede sellarse solo ni falsificar una tarjeta.')}
      ${ben('share','Clientes que traen clientes','Con "Invita a un amigo", tus clientes te recomiendan a cambio de un sello.')}
    </div>

    <div class="card">
      <div class="card-title">${ic('bulb',18)} Ideas según tu tipo de negocio</div>
      <p class="muted small" style="margin:-4px 0 10px">Toca uno para ver cómo aprovecharla.</p>
      ${ACAD_SCENES.map(sc => `<div class="scene ${acadScene===sc.id?'open':''}">
        <button class="scene-row" aria-expanded="${acadScene===sc.id}" onclick="acadScene=${acadScene===sc.id?'null':`'${sc.id}'`};render()">
          <span class="scene-ico">${stampSvg(sc.icon, 20)}</span><b style="flex:1;text-align:left">${sc.name}</b>${ic(acadScene===sc.id?'x':'right',16)}
        </button>
        ${acadScene===sc.id ? `<div class="scene-body"><p class="small"><b>Idea:</b> ${sc.idea}</p><p class="small muted" style="margin-top:6px"><b style="color:var(--ink-2)">Por qué funciona:</b> ${sc.why}</p></div>` : ''}
      </div>`).join('')}
    </div>

    ${acadCalcCardHtml()}

    <div class="card">
      <div class="card-title">${ic('trophy',18)} El mejor escenario: 7 hábitos que funcionan</div>
      <ol class="m-steps">
        <li><b>Un premio que antoje</b> y una meta alcanzable (8 a 10 ${cache.biz.mechanic==='sellos'?'sellos':'visitas'}).</li>
        <li><b>Ofrécela en cada venta:</b> "¿Ya tienes tu tarjeta de lealtad?".</li>
        <li><b>Cartel con QR a la vista</b>, junto a la caja.</li>
        <li><b>Regala el primer sello</b> para que se sienta ya empezada.</li>
        <li><b>Celebra cada premio</b> en voz alta: los demás escuchan.</li>
        <li><b>Escribe a quien no ha vuelto</b> antes de que se le olvide que existes.</li>
        <li><b>Revisa tu reporte</b> cada mes y ajusta tus promociones.</li>
      </ol>
      <button class="btn btn-primary btn-block mt-16" onclick="openAcademy('misiones')">${ic('trophy',18)} Ir a mis misiones</button>
    </div>
    <p class="hint" style="text-align:center">Fuentes: Harvard Business Review, "The Value of Keeping the Right Customers" (2014); Bain &amp; Company, <i>Loyalty Rules</i>; Nunes y Drèze, "The Endowed Progress Effect" (2006).</p>`;
}
