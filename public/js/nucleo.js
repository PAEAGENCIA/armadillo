/* Redeo · Lo básico que usa todo: utilidades, teléfonos de cualquier país, conexión con el servidor, estado global, cumpleaños y documentos legales. */
/* ---------- Utilidades ---------- */
function jsEsc(str){
  return String(str==null?'':str).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}
function escapeHtml(str){
  return String(str==null?'':str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
function slugify(name){
  return String(name||'')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,40) || 'negocio';
}
function fmtDate(iso){
  try{ return new Date(iso).toLocaleDateString('es-MX',{day:'numeric',month:'short'}); }catch(e){ return ''; }
}
const COLOR_SWATCHES = ['#E62E6B','#FFB627','#2C56A8','#1E8E5A','#8438B0','#E0472E','#1A1320'];

/* ---------- Conexión con el servidor ---------- */
/* ---------- Números de WhatsApp de cualquier país ----------
   México se guarda como siempre (10 dígitos sin lada). Otros países: "+" y lada ("+15551234567").
   La misma lista está en el servidor (src/phones.js). */
const PHONE_COUNTRIES = [
  ['MX','México','52',10,10],['US','Estados Unidos','1',10,10],['CA','Canadá','1',10,10],['GT','Guatemala','502',8,8],
  ['SV','El Salvador','503',8,8],['HN','Honduras','504',8,8],['NI','Nicaragua','505',8,8],['CR','Costa Rica','506',8,8],
  ['PA','Panamá','507',8,8],['CU','Cuba','53',8,8],['DO','República Dominicana','1',10,10],['PR','Puerto Rico','1',10,10],
  ['CO','Colombia','57',10,10],['VE','Venezuela','58',10,10],['EC','Ecuador','593',9,9],['PE','Perú','51',9,9],
  ['BO','Bolivia','591',8,8],['CL','Chile','56',9,9],['AR','Argentina','54',10,11],['UY','Uruguay','598',8,8],
  ['PY','Paraguay','595',9,9],['BR','Brasil','55',10,11],['ES','España','34',9,9],['FR','Francia','33',9,9],
  ['DE','Alemania','49',10,11],['IT','Italia','39',9,10],['GB','Reino Unido','44',10,10]
].map(([iso,name,cc,min,max])=>({iso,name,cc,min,max}));
const PHONE_CODES = [...new Set(PHONE_COUNTRIES.map(c=>c.cc))].sort((a,b)=>b.length-a.length);
function flagOf(iso){ return String.fromCodePoint(...[...iso].map(ch=>127397+ch.charCodeAt(0))); }
function normalizePhone(raw){
  const s0 = String(raw||'').trim();
  let d = s0.replace(/\D/g,'');
  const intl = s0.startsWith('+') || s0.startsWith('00');
  if(s0.startsWith('00')) d = d.slice(2);
  if(intl){
    if(d.startsWith('52')){ d = d.slice(2); if(d.length===11 && d.startsWith('1')) d = d.slice(1); return d; }
    return d ? '+'+d : '';
  }
  if(d.length===12 && d.startsWith('52')) d = d.slice(2);
  if(d.length===13 && d.startsWith('521')) d = d.slice(3);
  return d;
}
function phoneCountry(p, prefer){
  p = String(p||'');
  if(!p.startsWith('+')) return PHONE_COUNTRIES[0];
  const cc = PHONE_CODES.find(c=>p.slice(1).startsWith(c));
  if(!cc) return null;
  const pref = PHONE_COUNTRIES.find(c=>c.iso===prefer && c.cc===cc);
  return pref || PHONE_COUNTRIES.find(c=>c.cc===cc);
}
function isValidPhone(p){
  p = String(p||'');
  if(/^\d{10}$/.test(p)) return true;
  if(!/^\+\d{8,15}$/.test(p)) return false;
  const cc = PHONE_CODES.find(c=>p.slice(1).startsWith(c));
  if(!cc || cc==='52') return false;
  const n = p.length - 1 - cc.length;
  return PHONE_COUNTRIES.some(c=>c.cc===cc && n>=c.min && n<=c.max);
}
function waNum(p){ p = String(p||''); return p.startsWith('+') ? p.slice(1) : '52'+p; }
function waLink(p, text){ return 'https://wa.me/'+(p?waNum(p):'')+(text!=null?'?text='+encodeURIComponent(text):''); }
// "+15551234567" -> "+1 555 123 4567"; México se ve igual que antes
function fmtPhone(p){
  p = String(p||''); if(!p.startsWith('+')) return p;
  const c = phoneCountry(p); if(!c) return p;
  return '+'+c.cc+' '+p.slice(1+c.cc.length);
}
// Campo de WhatsApp con selector de país. "target" es la variable donde se guarda el número ya con lada.
let telIso = {};
function telField(id, value, target, opts){
  opts = opts || {};
  const fromVal = value ? phoneCountry(value, telIso[id]) : null;
  const cur = fromVal || PHONE_COUNTRIES.find(x=>x.iso===telIso[id]) || PHONE_COUNTRIES[0];
  telIso[id] = cur.iso;
  const national = value ? (String(value).startsWith('+') ? String(value).slice(1+cur.cc.length) : String(value)) : '';
  const ph = opts.placeholder || (cur.iso==='MX' ? '222 123 4567' : cur.min===cur.max ? cur.min+' dígitos' : cur.min+' o '+cur.max+' dígitos');
  return `<div class="tel ${opts.disabled?'off':''}">
    <label class="tel-cc"><span id="${id}-lab">${flagOf(cur.iso)} +${cur.cc}</span>${ic('down',14)}
      <select id="${id}-cc" aria-label="País del número" ${opts.disabled?'disabled':''} onchange="telIso['${id}']=this.value;telSync('${id}','${target}',true)">${PHONE_COUNTRIES.map(x=>`<option value="${x.iso}" ${x.iso===cur.iso?'selected':''}>${flagOf(x.iso)} ${escapeHtml(x.name)} +${x.cc}</option>`).join('')}</select></label>
    <input id="${id}" class="input" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="${escapeHtml(ph)}" value="${escapeHtml(national)}" ${opts.disabled?'disabled':''} oninput="telSync('${id}','${target}')"${opts.enter?` onkeydown="if(event.key==='Enter'){${opts.enter}}"`:''}>
  </div>`;
}
function telSync(id, target, changedCountry){
  const sel = document.getElementById(id+'-cc'), inp = document.getElementById(id);
  if(!sel || !inp) return;
  // Si pegan el número completo con "+lada", se elige el país solo
  if(inp.value.trim().startsWith('+')){
    const full = normalizePhone(inp.value), pc = phoneCountry(full, sel.value);
    if(pc){ sel.value = pc.iso; inp.value = full.startsWith('+') ? full.slice(1+pc.cc.length) : full; }
  }
  const c = PHONE_COUNTRIES.find(x=>x.iso===sel.value) || PHONE_COUNTRIES[0];
  telIso[id] = c.iso;
  let d = inp.value.replace(/\D/g,'');
  if(c.iso==='MX') d = normalizePhone(d);
  if(d.length > c.max) d = d.slice(0, c.max);
  if(inp.value.replace(/\D/g,'') !== d) inp.value = d;
  const v = !d ? '' : c.iso==='MX' ? d : '+'+c.cc+d;
  try{ new Function('v', target+'=v')(v); }catch(e){}
  const lab = document.getElementById(id+'-lab'); if(lab) lab.textContent = flagOf(c.iso)+' +'+c.cc;
  if(changedCountry) inp.placeholder = c.iso==='MX' ? '222 123 4567' : (c.min===c.max ? c.min+' dígitos' : c.min+' o '+c.max+' dígitos');
}
// Mensaje claro cuando el número no tiene los dígitos de su país
function phoneMsg(id, who){
  const c = PHONE_COUNTRIES.find(x=>x.iso===telIso[id]) || PHONE_COUNTRIES[0];
  return `Revisa ${who||'el número de WhatsApp'}: en ${c.name} son ${c.min===c.max?c.min:c.min+' u '+c.max} dígitos, sin la lada.`;
}
async function api(method, path, body, pin, extra){
  const headers = { ...(extra||{}) };
  if(body!==undefined) headers['Content-Type'] = 'application/json';
  if(pin) headers['x-business-pin'] = pin;
  if(method==='POST' && path==='/api/businesses' && createForm.adminKey) headers['x-admin-key'] = createForm.adminKey;
  try{
    const res = await fetch(path, { method, headers, body: body!==undefined ? JSON.stringify(body) : undefined });
    let data = null;
    try{ data = await res.json(); }catch(e){}
    // Respuesta guardada por la app (sin internet): la tarjeta lo avisa.
    if(typeof offlineMode!=='undefined' && path.indexOf('/api/businesses/')===0 && method==='GET') offlineMode = res.headers.get('x-vuelve-offline')==='1';
    return { ok: res.ok, status: res.status, data: data || {} };
  }catch(e){
    return { ok:false, status:0, data:{ error:'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.' } };
  }
}
function errMsg(r, fallback){ return (r.data && r.data.error) || fallback; }
function enc(s){ return encodeURIComponent(s); }

const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};
function customerLink(slug){ return location.origin + '/?n=' + enc(slug); }

/* ---------- Estado global ---------- */
let view = 'home';
let busy = false;
let toastMsg = null;
let toastTimer = null;
let serverConfig = { adminRequired:false, wallet:{ apple:false, google:false } };

let session = { slug:null, pin:null };
let cache = { biz:null, customers:[] };

let createForm = { name:'', mechanic:'sellos', stampsGoal:8, pointsGoal:100, pointsPerVisit:10, walletPct:5, walletBonus:50, rewardDesc:'', color:COLOR_SWATCHES[0], pin:'', adminKey:'', plan:'esencial', trialDays:14, ownerName:'', ownerPhone:'' };
const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fmtYmd(ymd){ if(!ymd) return ''; const [y,m,d] = ymd.split('-').map(Number); return d+' '+MESES_CORTOS[m-1]+' '+y; }
function isExpired(){ return !!(cache.biz && cache.biz.access && cache.biz.access.expired); }
let createError = '';

let loginForm = { slug:'', pin:'' };
let loginError = '';

let dashboardTab = 'resumen';
let customerSearch = '';
let expandedPhone = null;
let newCustomerOpen = false;
let newCustomerForm = { phone:'', name:'' };
let newCustomerError = '';
let pointsInputs = {};
let confirmRedeemPhone = null;

let configForm = null;
let configSaved = false;

let clienteLookup = { slug:'', phone:'' };
let clienteResult = { status:null, biz:null, customer:null };
let clientePreview = null;     // negocio de la liga /?n=… (nombre y promoción de registro)

// Promoción de registro: el "pretexto" para pedir la tarjeta hoy.
function signupPromo(biz){ return biz && biz.promos && biz.promos.signup ? biz.promos.signup : null; }
function signupBannerHtml(biz, mode){
  const sp = signupPromo(biz);
  if(!sp) return '';
  const note = mode==='pending' ? 'Pídela en caja cuando aprueben tu tarjeta.' : (sp.untilText ? 'Válida hasta el '+sp.untilText+'.' : '');
  return `<div class="promo-banner mt-16">${ic('gift',20)}<span><b>Promoción por registrarte</b><span style="display:block;font-size:1rem;font-weight:800;margin-top:2px">${escapeHtml(sp.text)}</span>${note?`<span style="display:block;font-size:.8rem;margin-top:3px">${escapeHtml(note)}</span>`:''}</span></div>`;
}
function signupStaffHtml(){
  const sp = signupPromo(cache.biz);
  return sp ? `<div class="promo-now">${ic('gift',16)} Al aprobarla, dale su promoción de registro: ${escapeHtml(sp.text)}</div>` : '';
}
// marketing: viene prendido (el cliente lo puede apagar). source: "¿Cómo nos conociste?", obligatorio en el registro (2.3).
let requestForm = { name:'', email:'', favorites:[], favText:'', marketing:true, privacy:false, bday:{day:'',month:''}, ref:'', refLink:false, source:'', srcDetail:'' };
let productDraft = '';

function isEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e||'').trim()); }
function toggleFavorite(p){
  const i = requestForm.favorites.indexOf(p);
  if(i>=0) requestForm.favorites.splice(i,1);
  else if(requestForm.favorites.length<5) requestForm.favorites.push(p);
  else { showToast('Puedes elegir hasta 5 favoritos.'); return; }
  render();
}
/* ---------- Cumpleaños (día y mes, sin año) ---------- */
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function bdayValue(b){ return b && b.day && b.month ? String(b.month).padStart(2,'0')+'-'+String(b.day).padStart(2,'0') : ''; }
function bdayText(v){ if(!v) return ''; const [m,d] = v.split('-').map(Number); return d+' de '+MESES[m-1].toLowerCase(); }
function bdayValid(b){
  if(!b || !b.day || !b.month) return false;
  return Number(b.day) <= [31,29,31,30,31,30,31,31,30,31,30,31][Number(b.month)-1];
}
// obj: nombre de la variable global que guarda {day, month}
function bdayPickerHtml(obj, id){
  const b = eval(obj) || {};
  return `<div class="bday" onclick="event.stopPropagation()">
    <select class="input" id="${id}-d" aria-label="Día de tu cumpleaños" onchange="(${obj}=${obj}||{}).day=this.value">
      <option value="">Día</option>${Array.from({length:31},(_,i)=>`<option value="${i+1}" ${String(b.day)===String(i+1)?'selected':''}>${i+1}</option>`).join('')}
    </select>
    <select class="input" id="${id}-m" aria-label="Mes de tu cumpleaños" onchange="(${obj}=${obj}||{}).month=this.value">
      <option value="">Mes</option>${MESES.map((m,i)=>`<option value="${i+1}" ${String(b.month)===String(i+1)?'selected':''}>${m}</option>`).join('')}
    </select>
  </div>`;
}

/* ---------- Documentos legales (Términos y avisos de privacidad) ---------- */
function legalCtx(biz){
  const L = (serverConfig && serverConfig.legal) || {};
  const g = biz && biz.legal || {};
  return {
    pae:{ name:L.name, brand:L.brand, address:L.address, email:L.email, phone:L.phone, rfc:L.rfc, site:location.origin },
    biz: biz ? { name:biz.name, legalName:g.name, address:g.address, email:g.email, mechanic:biz.mechanic,
      stampsGoal:biz.stampsGoal, pointsGoal:biz.pointsGoal, pointsPerVisit:biz.pointsPerVisit, rewardDesc:biz.rewardDesc } : null
  };
}
function legalUrl(id, slug){ return '/?doc='+enc(id)+(slug?'&n='+enc(slug):''); }
function legalDocHtml(id, biz){ return window.VuelveLegal ? VuelveLegal.toHtml(VuelveLegal.build(id, legalCtx(biz))) : '<p class="muted">No se pudo cargar el documento.</p>'; }
let legalOpenBiz = null;
// Se dibuja aparte de la app para que no pierda la posición al leer mientras la app se actualiza.
function openLegal(id, useBiz){
  const biz = useBiz===false ? null : (useBiz || legalOpenBiz);
  const root = document.getElementById('legal-root'); if(!root || !window.VuelveLegal) return;
  const title = VuelveLegal.TITLES[id] || 'Documento';
  root.innerHTML = `<div class="lg-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
    <div class="lg-bar"><b>${escapeHtml(title)}</b>
      <a class="icon-btn" href="${legalUrl(id, biz && biz.slug)}" target="_blank" rel="noopener" aria-label="Abrir en otra pestaña">${ic('share',18)}</a>
      <button class="icon-btn" aria-label="Cerrar" onclick="closeLegal()">${ic('x',18)}</button></div>
    <div class="lg-scroll">${legalDocHtml(id, biz)}
      <button class="btn btn-secondary btn-block mt-24" style="max-width:640px;margin-left:auto;margin-right:auto" onclick="closeLegal()">Cerrar</button></div>
  </div>`;
  document.body.classList.add('lg-lock');
}
function closeLegal(){ const root = document.getElementById('legal-root'); if(root) root.innerHTML=''; document.body.classList.remove('lg-lock'); }
document.addEventListener('keydown', e => { if(e.key==='Escape') closeLegal(); });
// Ligas al pie: para un negocio (aviso y términos del programa) o generales (P.A.E.).
function legalFootHtml(biz){
  if(biz){
    legalOpenBiz = biz;
    return `<div class="lg-foot"><button onclick="openLegal('privacidad')">Aviso de privacidad</button><button onclick="openLegal('programa')">Términos del programa</button>
      <span class="by">Tarjeta digital con Redeo <i>(“yo vuelvo”, en latín)</i>, un servicio de ${escapeHtml((serverConfig.legal&&serverConfig.legal.brand)||'P.A.E.')}</span></div>`;
  }
  return `<div class="lg-foot"><button onclick="openLegal('terminos',false)">Términos del servicio</button><button onclick="openLegal('privacidad-pae',false)">Aviso de privacidad</button></div>`;
}
function bizLegalMissing(biz){ return !(biz && biz.legal && biz.legal.name && biz.legal.address && biz.legal.email); }
let requestError = '';

function activeCustomers(){ return cache.customers.filter(c => c.status !== 'pending'); }
function pendingCustomers(){ return cache.customers.filter(c => c.status === 'pending'); }

function showToast(msg, ms){
  toastMsg = msg;
  render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ toastMsg=null; render(); }, ms || (String(msg).length > 90 ? 6500 : 2800));
}

function goHome(){
  view='home'; createError=''; loginError=''; newCustomerError='';
  clienteResult={status:null,biz:null,customer:null};
  history.replaceState(null,'','/');
  render();
}
