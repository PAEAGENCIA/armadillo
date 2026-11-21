/* Redeo · Niveles de cliente (Premium): Frecuente, VIP… según sus visitas recientes. Tarjeta, panel y Crecer → Niveles. */
function levelChipHtml(level){
  if(!level || !level.index) return '';
  return `<span class="lvl-chip ${level.top?'top':''}">${ic(level.top?'crown':'star',12)} ${escapeHtml(level.name)}</span>`;
}

// En la tarjeta del cliente: su nivel, cuánto le falta para el siguiente y los beneficios.
function levelCardHtml(biz, customer){
  const L = biz.levels, lv = customer && customer.level;
  if(!L || !lv) return '';
  const all = [{ name:L.base, visits:0, perk:'', boost:0 }, ...L.tiers];
  const boostTxt = t => !t.boost ? '' : biz.mechanic==='sellos' ? 'Sello doble en cada visita' : `+${t.boost}% ${isWalletBiz(biz)?'de saldo':'de puntos'} en cada visita`;
  return `<div class="card mt-16 lvl-card ${lv.top?'top':''}">
    <div class="lvl-head">
      <span class="lvl-medal">${ic(lv.top?'crown':lv.index?'star':'user',22)}</span>
      <div style="flex:1;min-width:0"><span class="muted small">Tu nivel</span><b class="lvl-name">${escapeHtml(lv.name)}</b></div>
      <span class="muted small" style="text-align:right">${lv.visits} ${lv.visits===1?'visita':'visitas'}<br>en ${L.windowDays} días</span>
    </div>
    ${lv.next ? `<p class="small mt-12">Te ${lv.next.missing===1?'falta 1 visita':'faltan '+lv.next.missing+' visitas'} para ser <b>${escapeHtml(lv.next.name)}</b>.</p>` : `<p class="small mt-12">Estás en el nivel más alto. ¡Gracias por venir tan seguido!</p>`}
    <div class="lvl-steps mt-12">${all.map((t,i)=>{
      const perks = [boostTxt(t), t.perk].filter(Boolean);
      return `<div class="lvl-step ${i===lv.index?'on':''} ${i<lv.index?'past':''}"><b>${escapeHtml(t.name)}</b><span class="muted small">${i===0?'Al registrarte':t.visits+' visitas'}</span>${perks.length?`<span class="small">${escapeHtml(perks.join(' · '))}</span>`:''}</div>`;
    }).join('')}</div>
    <p class="hint" style="margin-bottom:0">Cuentan tus visitas de los últimos ${L.windowDays} días.</p>
  </div>`;
}

// ----- Crecer → Niveles (solo el dueño) -----
let levelForm = null, levelData = null;
async function loadLevels(){
  const d = await gget('/levels');
  if(d){ levelData = d; levelForm = JSON.parse(JSON.stringify(d.config)); render(); }
}
function addLevelTier(){
  const t = levelForm.tiers, last = t[t.length-1];
  if(t.length>=3){ showToast('Máximo 3 niveles.'); return; }
  t.push({ name: t.length===2 ? 'Leyenda' : 'VIP', visits: (last?last.visits:2)+6, perk:'', boost:0 }); render();
}
async function saveLevels(){
  const t = levelForm.tiers;
  for(let i=0;i<t.length;i++){
    if(!String(t[i].name||'').trim()){ showToast('Ponle nombre a cada nivel.'); return; }
    if(!(Number(t[i].visits)>=2)){ showToast('Cada nivel pide al menos 2 visitas.'); return; }
    if(i && Number(t[i].visits)<=Number(t[i-1].visits)){ showToast(`"${t[i].name}" debe pedir más visitas que "${t[i-1].name}".`); return; }
  }
  busy=true; render();
  const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/growth/levels', levelForm, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudieron guardar.')); return; }
  cache.biz.levels = r.data.summary; levelForm = JSON.parse(JSON.stringify(r.data.config));
  levelData = null; loadLevels(); refreshCustomers({silent:true});
  showToast(r.data.config.on ? 'Niveles guardados. Tus clientes ya ven su nivel en su tarjeta.' : 'Niveles apagados.');
}
function levelsHtml(){
  if(!levelForm){ if(!levelData) setTimeout(loadLevels,0); return `<div class="card"><p class="muted">Cargando…</p></div>`; }
  const f = levelForm, biz = cache.biz, isSellos = biz.mechanic==='sellos', W = isWalletBiz(biz);
  const boosts = isSellos ? [[0,'Sin extra'],[100,'Sello doble']] : (levelData ? levelData.boosts : [0,10,25,50,100]).map(b=>[b, b?`+${b}%`:'Sin extra']);
  const counts = levelData ? levelData.counts : [];
  const tierRow = (t,i) => `<div class="lvl-edit">
    <div class="row" style="gap:8px;align-items:flex-end">
      <div class="field" style="flex:1;min-width:0;margin:0"><label>Nombre</label><input class="input" maxlength="20" value="${escapeHtml(t.name)}" oninput="levelForm.tiers[${i}].name=this.value"></div>
      <div class="field" style="width:96px;margin:0"><label>Visitas</label><input class="input" type="number" inputmode="numeric" min="2" value="${escapeHtml(String(t.visits))}" oninput="levelForm.tiers[${i}].visits=Number(this.value)"></div>
      ${i>0 ? `<button class="icon-btn" aria-label="Quitar nivel" onclick="levelForm.tiers.splice(${i},1);render()">${ic('x',16)}</button>` : ''}
    </div>
    <div class="field" style="margin:10px 0 0"><label>Beneficio que ve el cliente <span class="muted">(opcional)</span></label><input class="input" maxlength="80" placeholder="${i? 'Ej. Postre de cortesía en tu cumpleaños' : 'Ej. Bebida de cortesía cada visita'}" value="${escapeHtml(t.perk||'')}" oninput="levelForm.tiers[${i}].perk=this.value"></div>
    <p class="small mt-12" style="font-weight:700;color:var(--ink-2)">${isSellos?'¿Sello doble en cada visita?':`Extra de ${W?'saldo':'puntos'} en cada visita`}</p>
    <div class="day-chips mt-8">${boosts.map(([v,l])=>`<button class="day wide ${Number(t.boost)===v?'on':''}" onclick="levelForm.tiers[${i}].boost=${v};render()">${l}</button>`).join('')}</div>
    ${counts.length ? `<p class="muted small mt-8">${counts[i+1]||0} ${counts[i+1]===1?'cliente está':'clientes están'} hoy en este nivel.</p>` : ''}
  </div>`;
  return `
    <div class="card" style="background:var(--ink);color:#fff;border-color:var(--ink)">
      <div style="font-weight:800;font-size:1.02rem">Mientras más vienen, más ganan</div>
      <p class="small" style="color:#D9CCE0;margin-top:6px;line-height:1.5">Tus clientes suben de nivel con sus visitas recientes y lo ven en su tarjeta. Si dejan de venir, bajan solos; si regresan, lo recuperan. Funciona muy bien en restaurantes, bares y boutiques.</p>
    </div>
    <div class="promo ${f.on?'on':''}">
      <div class="promo-head" onclick="levelForm.on=!levelForm.on;render()"><div style="flex:1"><div class="promo-title">Niveles de cliente</div><div class="muted small">${f.on?'Prendidos':'Apagados'}</div></div>
      <button class="switch ${f.on?'on':''}" role="switch" aria-checked="${f.on}" aria-label="Niveles de cliente" onclick="event.stopPropagation();levelForm.on=!levelForm.on;render()"><span></span></button></div>
    </div>
    <div class="card">
      <div class="card-title">${ic('chart',18)} Cómo se sube</div>
      <p class="muted small">Se cuentan las visitas de los últimos:</p>
      <div class="day-chips mt-8">${(levelData?levelData.windows:[30,60,90,180,365]).map(d=>`<button class="day wide ${f.windowDays===d?'on':''}" onclick="levelForm.windowDays=${d};render()">${d} días</button>`).join('')}</div>
      <div class="field mt-16" style="margin-bottom:0"><label>Nivel de entrada</label><input class="input" maxlength="20" value="${escapeHtml(f.base||'Cliente')}" oninput="levelForm.base=this.value">${counts.length?`<p class="hint">${counts[0]||0} clientes hoy.</p>`:''}</div>
    </div>
    ${f.tiers.map((t,i)=>`<div class="card"><div class="card-title">${ic(i===f.tiers.length-1?'crown':'star',18)} Nivel ${i+1}</div>${tierRow(t,i)}</div>`).join('')}
    ${f.tiers.length<3 ? `<button class="btn btn-secondary btn-block" onclick="addLevelTier()">${ic('plus',18)} Agregar otro nivel</button>` : ''}
    <p class="hint" style="margin:10px 4px 0">Si ese día ya aplica una promoción doble, el beneficio de nivel no se suma encima (nunca más que doble).</p>
    <button class="btn btn-primary btn-block mt-16" ${busy?'disabled':''} onclick="saveLevels()">${busy?'Guardando…':'Guardar niveles'}</button>`;
}
