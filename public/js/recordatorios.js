/* Redeo · Recordatorios por tiempo (Premium): "ya te toca tu corte", "ya toca la vacuna". Panel, tarjeta y Crecer → Recordatorios. */
const REMIND_OPTIONS = [[7,'Cada semana'],[14,'Cada 2 semanas'],[21,'Cada 3 semanas'],[28,'Cada 4 semanas'],[30,'Cada mes'],[45,'Cada mes y medio'],[60,'Cada 2 meses'],[90,'Cada 3 meses'],[120,'Cada 4 meses'],[180,'Cada 6 meses'],[365,'Cada año']];
function everyText(d){ const o = REMIND_OPTIONS.find(x=>x[0]===d); return o ? o[1].toLowerCase() : 'cada '+d+' días'; }
function ymdText(ymd){ return fmtYmd(ymd); }
function dueText(r){
  if(r.daysLeft < -1) return 'le tocaba hace '+(-r.daysLeft)+' días';
  if(r.daysLeft === -1) return 'le tocaba ayer';
  if(r.daysLeft === 0) return 'le toca hoy';
  if(r.daysLeft === 1) return 'le toca mañana';
  return 'le toca el '+ymdText(r.due);
}

// ----- En la ficha del cliente (dueño y personal) -----
let remEdit = null;   // { phone, days ('' = lo del negocio, 0 = no), at, note }
function startRemEdit(c){
  const r = c.reminder;
  remEdit = { phone:c.phone, days: r && r.custom && !r.fixed ? String(r.every) : '', at: r && r.fixed ? r.due : '', note: r ? (r.note||'') : '' };
  render();
}
async function saveRemEdit(off){
  const e = remEdit; if(!e || busy) return;
  busy=true; render();
  const body = off ? { days:0, at:'', note:'' } : { days: e.days==='' ? null : Number(e.days), at: e.at||'', note: e.note||'' };
  const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/customers/'+enc(e.phone)+'/reminder', body, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo guardar.')); return; }
  upsertCustomer(r.data); if(!r.data.reminder) cache.customers.find(x=>x.phone===e.phone).reminder = null;
  remEdit = null; growth.reminders = null;
  showToast(off ? 'Listo, no le llegarán recordatorios.' : 'Recordatorio guardado.');
}
function reminderRowHtml(c){
  const R = cache.biz.reminders;
  if(!R) return '';
  const ph = jsEsc(c.phone);
  if(remEdit && remEdit.phone===c.phone){
    const e = remEdit;
    return `<div class="ficha mt-12 rem-edit" onclick="event.stopPropagation()">
      <div class="kv"><span class="small" style="font-weight:800">${ic('bell',16)} Recordatorio</span></div>
      <div class="field" style="margin:8px 0 0"><label>¿Cada cuánto le toca?</label>
        <select class="input" onchange="remEdit.days=this.value"><option value="" ${e.days===''?'selected':''}>Lo de tu negocio (${everyText(R.days)})</option>${REMIND_OPTIONS.map(([d,l])=>`<option value="${d}" ${String(e.days)===String(d)?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="field" style="margin:10px 0 0"><label>O una fecha exacta <span class="muted">(opcional)</span></label><input class="input" type="date" value="${escapeHtml(e.at||'')}" onchange="remEdit.at=this.value"></div>
      <div class="field" style="margin:10px 0 0"><label>¿De qué es? <span class="muted">(opcional)</span></label><input class="input" maxlength="60" placeholder="Ej. Vacuna de Firulais · Retoque de tinte" value="${escapeHtml(e.note||'')}" oninput="remEdit.note=this.value"><p class="hint">Si el cliente te pidió que le avisaras (fecha o nota), podrás escribirle aunque no acepte promociones.</p></div>
      <div class="row mt-12" style="gap:8px"><button class="btn btn-primary btn-sm" style="flex:1" ${busy?'disabled':''} onclick="saveRemEdit(false)">Guardar</button><button class="btn btn-ghost btn-sm" onclick="remEdit=null;render()">Cancelar</button></div>
      <button class="linkbtn small mt-8" onclick="saveRemEdit(true)">No recordarle nada</button>
    </div>`;
  }
  const r = c.reminder;
  return `<div class="ficha mt-12"><div class="kv">
    <span class="small"><b>${ic('bell',14)} ${r ? (r.note ? escapeHtml(r.note)+': ' : '') + dueText(r) : 'Sin recordatorio'}</b>${r && !r.fixed ? `<span class="muted" style="display:block">${everyText(r.every)}${r.custom?'':' (lo de tu negocio)'}</span>` : r ? '<span class="muted" style="display:block">fecha exacta</span>' : `<span class="muted" style="display:block">${c.progress||c.given ? 'No recibe recordatorios' : 'Empieza a contar desde su primera visita'}</span>`}</span>
    <button class="linkbtn small" onclick="event.stopPropagation();startRemEdit(cache.customers.find(x=>x.phone==='${ph}'))">Cambiar</button>
  </div></div>`;
}

// ----- En la tarjeta del cliente -----
function reminderCardHtml(biz, customer){
  const R = biz.reminders, r = customer && customer.reminder;
  if(!R || !r) return '';
  const when = r.daysLeft < 0 ? '¡Ya te toca!' : r.daysLeft===0 ? 'Hoy' : r.daysLeft===1 ? 'Mañana' : fmtYmd(r.due);
  return `<div class="rem-card mt-16">${ic('calendar',22)}<div style="flex:1;min-width:0"><span class="muted small">${escapeHtml(r.note || 'Te toca '+R.label)}</span><b>${escapeHtml(when)}${r.fixed||r.daysLeft<=1?'':' · aprox.'}</b></div>${biz.mapsUrl && r.daysLeft<=3 ? `<a class="btn btn-secondary btn-sm" href="${escapeHtml(biz.mapsUrl)}" target="_blank" rel="noopener">${ic('pin',16)} Cómo llegar</a>` : ''}</div>`;
}

// ----- Crecer → Recordatorios (solo el dueño) -----
let remForm = null;
async function loadReminders(){
  const d = await gget('/reminders');
  if(d){ growth.reminders = d; if(!remForm) remForm = JSON.parse(JSON.stringify(d.config)); render(); }
}
async function saveReminderConfig(){
  if(!String(remForm.label||'').trim()){ showToast('Escribe qué le toca al cliente (ej. "tu corte").'); return; }
  busy=true; render();
  const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/growth/reminders', remForm, session.pin);
  busy=false;
  if(!r.ok){ if(handleAuthError(r)) return; showToast(errMsg(r,'No se pudo guardar.')); return; }
  cache.biz.reminders = r.data.summary; remForm = JSON.parse(JSON.stringify(r.data.config));
  growth.reminders = null; loadReminders(); refreshCustomers({silent:true});
  showToast(r.data.config.on ? 'Recordatorios guardados.' : 'Recordatorios apagados.');
}
function remindMsg(c){
  const biz = cache.biz, n = firstName(c.name), label = (growth.reminders && growth.reminders.config.label) || 'tu próxima visita';
  const what = c.note ? c.note.charAt(0).toLowerCase()+c.note.slice(1) : label;
  return `Hola${n?' '+n:''} 👋 En ${biz.name} te recordamos: ${c.daysLeft<0?'ya te toca':'pronto te toca'} ${what}${c.fixed?' ('+fmtYmd(c.due)+')':''}. ¿Te apartamos un lugar? Responde este mensaje y te agendamos.`;
}
async function remindSend(phone){
  const c = growth.reminders.due.find(x=>x.phone===phone);
  waOpen(phone, remindMsg(c));
  const r = await api('PUT','/api/businesses/'+enc(session.slug)+'/customers/'+enc(phone)+'/reminder', { sent:true }, session.pin);
  if(r.ok){ c.sentNow = true; render(); }
}
function remindersHtml(){
  const g = growth.reminders;
  if(!g || !remForm){ if(!g) setTimeout(loadReminders,0); return `<div class="card"><p class="muted">Cargando…</p></div>`; }
  const f = remForm;
  const canWrite = c => c.marketingOptIn || c.asked;
  const row = (c, isDue) => `<div class="item" style="cursor:default">
      <div class="avatar sm" style="background:${isDue?'#FFF1CF':'var(--brand-soft)'};color:${isDue?'#8A5B00':'var(--brand-deep)'}">${ic(isDue?'bell':'calendar',18)}</div>
      <div class="item-main"><div class="item-name">${escapeHtml(c.name||c.phone)}</div><div class="item-sub">${c.note?escapeHtml(c.note)+' · ':''}${dueText(c)}</div></div>
      ${isDue ? (canWrite(c) ? `<button class="btn ${c.sentNow?'btn-secondary':'btn-wa'} btn-sm" onclick="remindSend('${jsEsc(c.phone)}')">${c.sentNow?ic('check',16)+' Enviado':ic('send',16)+' Recordarle'}</button>` : `<span class="muted small" style="text-align:right;max-width:120px;line-height:1.3">No aceptó mensajes</span>`) : ''}
    </div>`;
  return `
    <div class="card" style="background:var(--ink);color:#fff;border-color:var(--ink)">
      <div style="font-weight:800;font-size:1.02rem">Que regresen justo a tiempo</div>
      <p class="small" style="color:#D9CCE0;margin-top:6px;line-height:1.5">Redeo calcula cuándo le toca regresar a cada cliente y te avisa aquí. Tú le escribes por WhatsApp con el mensaje listo. Ideal para barberías, salones, veterinarias y consultorios.</p>
    </div>
    <div class="promo ${f.on?'on':''}">
      <div class="promo-head" onclick="remForm.on=!remForm.on;render()"><div style="flex:1"><div class="promo-title">Recordatorios</div><div class="muted small">${f.on?'Prendidos':'Apagados'}</div></div>
      <button class="switch ${f.on?'on':''}" role="switch" aria-checked="${f.on}" aria-label="Recordatorios" onclick="event.stopPropagation();remForm.on=!remForm.on;render()"><span></span></button></div>
      ${f.on ? `<div class="promo-body">
        <div class="field" style="margin:0"><label>Tus clientes suelen regresar</label><select class="input" onchange="remForm.days=Number(this.value)">${REMIND_OPTIONS.map(([d,l])=>`<option value="${d}" ${f.days===d?'selected':''}>${l}</option>`).join('')}</select></div>
        <div class="field" style="margin:10px 0 0"><label>¿Qué les toca?</label><input class="input" maxlength="40" placeholder="Ej. tu corte · tu limpieza · la vacuna de tu mascota" value="${escapeHtml(f.label||'')}" oninput="remForm.label=this.value"><p class="hint">Así se lee: "ya te toca <b>${escapeHtml(f.label||'tu próxima visita')}</b>". A cada cliente le puedes poner su propio tiempo o una fecha exacta desde su ficha.</p></div>
      </div>` : ''}
    </div>
    <button class="btn btn-primary btn-block" ${busy?'disabled':''} onclick="saveReminderConfig()">${busy?'Guardando…':'Guardar'}</button>
    ${cache.biz.reminders ? `
    <div class="card mt-16"><div class="card-title">${ic('bell',18)} Les toca ${g.due.length?`<span class="tab-badge" style="position:static;margin-left:6px">${g.due.length}</span>`:''}</div>
      ${g.due.length ? `<p class="muted small">Toca <b>Recordarle</b> y se abre WhatsApp con el mensaje listo. Cuando regresen, su recordatorio vuelve a empezar solo.</p>` : `<p class="muted small">Nadie por ahora. ${g.sent?`Ya recordaste a ${g.sent} ${g.sent===1?'cliente':'clientes'}.`:''}</p>`}
    </div>
    ${g.due.length ? `<div class="list" style="margin-top:0">${g.due.map(c=>row(c,true)).join('')}</div>` : ''}
    ${g.upcoming.length ? `<p class="eyebrow mt-16">Próximos 7 días</p><div class="list" style="margin-top:8px">${g.upcoming.map(c=>row(c,false)).join('')}</div>` : ''}
    <p class="hint" style="margin:10px 4px 0">Solo puedes escribir a quienes aceptaron recibir mensajes, o a quienes te pidieron que les avisaras (les pusiste fecha o nota).</p>` : ''}`;
}
// Aviso en Resumen: cuántos clientes les toca hoy (lo calcula con la lista de clientes que ya tiene el panel).
function remindersDueCount(){
  if(!cache.biz || !cache.biz.reminders) return 0;
  return activeCustomers().filter(c => c.reminder && c.reminder.daysLeft <= 0 && c.reminder.daysLeft >= -60 && !c.reminder.sentAt).length;
}
