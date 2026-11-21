/* Redeo · Premios a elegir (Premium): menú de premios por sellos o puntos. Lo usan la tarjeta, el panel y Ajustes. */
// biz.rewards = menú completo ordenado por costo (incluye el premio principal con main:true). Vacío = un solo premio.
function rewardMenuOf(biz){ return biz && Array.isArray(biz.rewards) && biz.rewards.length > 1 ? biz.rewards : null; }
function readyAt(biz){ const m = rewardMenuOf(biz); return m ? m[0].cost : goalOf(biz); }
function canRedeem(biz, c){ return !isWalletBiz(biz) && !!c && Number(c.progress) >= readyAt(biz); }
function unitShort(biz, n){ return biz.mechanic==='sellos' ? (n===1?'sello':'sellos') : (n===1?'punto':'pts'); }

// ----- Canjear: el personal elige qué premio se lleva el cliente -----
let redeemPick = {};   // teléfono -> id del premio elegido
function defaultPick(biz, c){
  const m = rewardMenuOf(biz); if(!m) return null;
  const ok = m.filter(r => c.progress >= r.cost);
  return ok.length ? ok[ok.length-1].id : null;      // por omisión, el más grande que le alcanza
}
function redeemConfirmHtml(c, opts){
  opts = opts || {};
  const biz = cache.biz, ph = jsEsc(c.phone), stop = opts.inList ? 'event.stopPropagation();' : '';
  const m = rewardMenuOf(biz);
  if(!m){
    const goal = goalOf(biz);
    return `<div class="card" style="box-shadow:none" onclick="event.stopPropagation()"><p style="font-weight:700">¿Canjear el premio?</p><p class="muted small mt-8">Se descontarán ${goal} ${biz.mechanic==='sellos'?'sellos':'puntos'}${opts.inList?' de su tarjeta':''}.</p>
      <div class="row mt-16"><button class="btn btn-gold" style="flex:1" ${busy?'disabled':''} onclick="${stop}confirmRedeem('${ph}')">Sí, canjear</button>
      <button class="btn btn-ghost" onclick="${stop}cancelRedeem()">Cancelar</button></div></div>`;
  }
  if(redeemPick[c.phone]===undefined || !m.some(r=>r.id===redeemPick[c.phone] && c.progress>=r.cost)) redeemPick[c.phone] = defaultPick(biz, c);
  const pick = m.find(r=>r.id===redeemPick[c.phone]);
  return `<div class="card rw-choose" style="box-shadow:none" onclick="event.stopPropagation()">
    <p style="font-weight:700">¿Qué premio elige?</p>
    <p class="muted small" style="margin-top:2px">Tiene ${c.progress} ${unitShort(biz,c.progress)}. Se descuenta lo que cuesta el premio.</p>
    <div class="rw-list mt-12" role="radiogroup">${m.map(r=>{
      const ok = c.progress >= r.cost, on = pick && pick.id===r.id;
      return `<button type="button" role="radio" aria-checked="${on}" class="rw-opt ${on?'on':''}" ${ok?'':'disabled'} onclick="redeemPick['${ph}']='${jsEsc(r.id)}';render()">
        <span class="rw-cost">${r.cost}<small>${unitShort(biz,r.cost)}</small></span><span class="rw-name">${escapeHtml(r.name)}${r.main?' <em>premio mayor</em>':''}</span>${ok?(on?ic('check',18):''):`<span class="rw-miss">faltan ${r.cost-c.progress}</span>`}</button>`;
    }).join('')}</div>
    <div class="row mt-16"><button class="btn btn-gold" style="flex:1" ${busy||!pick?'disabled':''} onclick="${stop}confirmRedeem('${ph}')">${pick?'Canjear '+escapeHtml(pick.name):'Elige un premio'}</button>
    <button class="btn btn-ghost" onclick="${stop}cancelRedeem()">Cancelar</button></div></div>`;
}

// ----- Lo que ve el cliente en su tarjeta -----
function rewardsMenuCardHtml(biz, customer){
  const m = rewardMenuOf(biz); if(!m) return '';
  const p = Number(customer && customer.progress)||0;
  const next = m.find(r => p < r.cost);
  return `<div class="card mt-16 rw-card">
    <div class="card-title">${ic('gift',18)} Premios a elegir</div>
    <p class="muted small" style="margin-top:-4px">Canjea el que quieras en cuanto te alcance${next?`; te faltan <b>${next.cost-p}</b> para ${escapeHtml(inSentence(next.name))}`:''}.</p>
    <div class="rw-ladder mt-12">${m.map(r=>{
      const ok = p >= r.cost, pct = Math.max(0, Math.min(100, Math.round(p/r.cost*100)));
      return `<div class="rw-step ${ok?'ok':''}"><span class="rw-cost">${r.cost}<small>${unitShort(biz,r.cost)}</small></span>
        <span class="rw-body"><b>${escapeHtml(r.name)}</b><span class="rw-bar"><span style="width:${pct}%"></span></span></span>
        <span class="rw-state">${ok?ic('check',16)+' Ya te alcanza':''}</span></div>`;
    }).join('')}</div>
  </div>`;
}
// Frase de arriba de la tarjeta cuando hay menú de premios.
function rewardsLeadText(biz, customer){
  const m = rewardMenuOf(biz); if(!m) return null;
  const p = Number(customer.progress)||0;
  const ok = m.filter(r => p >= r.cost);
  if(ok.length) return `¡Ya puedes canjear ${escapeHtml(inSentence(ok[ok.length-1].name))}${ok.length>1?' u otro premio del menú':''}! Muéstrale tu tarjeta al personal.`;
  const n = m[0].cost - p;
  return `Te ${n===1?'falta':'faltan'} ${n} ${biz.mechanic==='sellos'?(n===1?'sello':'sellos'):(n===1?'punto':'puntos')} para tu primer premio: ${escapeHtml(inSentence(m[0].name))}.`;
}

// ----- Ajustes: el dueño arma su menú -----
let rewardDraft = { name:'', cost:'' };
function addRewardDraft(){
  const name = String(rewardDraft.name||'').trim().slice(0,40), cost = Math.round(Number(rewardDraft.cost));
  const f = configForm, goal = Number(cache.biz.mechanic==='sellos' ? f.stampsGoal : f.pointsGoal);
  if(!name){ showToast('Escribe el nombre del premio.'); return; }
  if(!(cost>=1)){ showToast('Escribe cuántos '+(cache.biz.mechanic==='sellos'?'sellos':'puntos')+' cuesta.'); return; }
  if(cache.biz.mechanic==='sellos' && cost>=goal){ showToast('Con '+goal+' sellos ya se gana el premio principal. Usa un número menor.'); return; }
  f.rewardExtras = f.rewardExtras || [];
  if(f.rewardExtras.length>=8){ showToast('Máximo 8 premios extra.'); return; }
  if(cost===goal || f.rewardExtras.some(r=>Number(r.cost)===cost)){ showToast('Ya hay un premio con ese costo.'); return; }
  f.rewardExtras.push({ name, cost });
  f.rewardExtras.sort((a,b)=>a.cost-b.cost);
  rewardDraft = { name:'', cost:'' };
  render();
  const i=document.getElementById('rw-name'); if(i) i.focus();
}
function rewardsEditorHtml(){
  if(isWalletBiz(cache.biz)) return '';
  const f = configForm, isSellos = cache.biz.mechanic==='sellos', u = isSellos?'sellos':'puntos';
  const goal = Number(isSellos ? f.stampsGoal : f.pointsGoal) || 0;
  const list = [...(f.rewardExtras||[]).map((r,i)=>({ ...r, i })), { name: f.rewardDesc || 'Premio principal', cost: goal, main:true }].sort((a,b)=>a.cost-b.cost);
  return `<div class="card">
    <div class="card-title">${ic('gift',18)} Premios a elegir <span class="plan-pill premium" style="margin-left:auto">Nuevo</span></div>
    ${premiumLock(`<p class="muted small">Además de tu premio principal, ofrece premios más chicos. El cliente canjea antes y regresa más. Ej.: ${isSellos?'con 3 sellos un café, con 8 un desayuno':'con 50 puntos un café, con 100 un postre, con 200 un platillo'}.</p>
    <div class="rw-edit mt-12">${list.map(r=>`<div class="rw-edit-row ${r.main?'main':''}"><span class="rw-cost">${r.cost}<small>${u}</small></span><span style="flex:1;min-width:0">${escapeHtml(r.name)}${r.main?' <span class="muted small">· premio principal (arriba)</span>':''}</span>${r.main?'':`<button type="button" class="linkbtn" aria-label="Quitar ${escapeHtml(r.name)}" onclick="configForm.rewardExtras.splice(${r.i},1);render()">${ic('x',16)}</button>`}</div>`).join('')}</div>
    <div class="rw-add mt-12">
      <input id="rw-cost" class="input" type="number" inputmode="numeric" min="1" placeholder="${u}" aria-label="Cuántos ${u} cuesta" value="${escapeHtml(String(rewardDraft.cost))}" oninput="rewardDraft.cost=this.value">
      <input id="rw-name" class="input" type="text" maxlength="40" placeholder="Ej. Un café" aria-label="Nombre del premio" value="${escapeHtml(rewardDraft.name)}" oninput="rewardDraft.name=this.value" onkeydown="if(event.key==='Enter'){event.preventDefault();addRewardDraft()}">
      <button class="btn btn-secondary" onclick="addRewardDraft()">${ic('plus',18)}</button>
    </div>
    <p class="hint">Se guarda con el botón "Guardar cambios". Si lo dejas vacío, tu tarjeta sigue con un solo premio.</p>`, true)}
  </div>`;
}
