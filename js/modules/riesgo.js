// Módulo Riesgo suicida: tamizaje C-SSRS, entrevista clínica, nivel de riesgo, alerta visible y plan de seguridad (Stanley-Brown).
// Es una AYUDA para el criterio clínico, no lo reemplaza. La lógica de niveles vive en riesgo-logica.js.
// Escala C-SSRS: © 2008 The Research Foundation for Mental Hygiene, Inc. (Columbia University). Uso clínico gratuito;
// la redacción de los ítems es una adaptación: sustitúyela por la versión oficial en español de cssrs.columbia.edu.
// Plan de seguridad: Stanley & Brown (2008, 2012).
const Riesgo = {
  repo: App.repo('evalriesgo'), plan: App.repo('planseguridad'), L: RiesgoLogica,
  PREG: [
    ['q1', '1. ¿Ha deseado estar muerto/a o poder dormirse y no despertar?'],
    ['q2', '2. ¿Ha tenido realmente la idea de suicidarse?'],
    ['q3', '3. ¿Ha pensado en cómo se suicidaría (método), sin un plan específico?'],
    ['q4', '4. ¿Ha tenido estos pensamientos y alguna intención de llevarlos a cabo?'],
    ['q5', '5. ¿Ha empezado a elaborar, o ha elaborado, los detalles de un plan, con intención de llevarlo a cabo?']
  ],
  P6: '6. ¿Alguna vez ha hecho algo, ha empezado a hacer algo o ha preparado algo para terminar con su vida? (p. ej. juntar pastillas, conseguir un arma, regalar pertenencias, escribir una nota, subirse a un borde, intentarlo)',
  FR: ['Intento de suicidio previo', 'Trastorno mental diagnosticado', 'Consumo de alcohol o sustancias', 'Desesperanza', 'Impulsividad / agitación', 'Pérdida o ruptura reciente', 'Aislamiento social', 'Dolor crónico o enfermedad grave', 'Violencia o abuso (actual o pasado)', 'Antecedente familiar de suicidio', 'Problemas económicos o laborales graves', 'Problemas legales o vergüenza pública'],
  PROT: ['Razones para vivir expresadas', 'Hijos o familiares que dependen de él/ella', 'Red de apoyo disponible', 'Buen vínculo terapéutico', 'Creencias religiosas o espirituales', 'Habilidades de afrontamiento', 'Planes y proyectos a futuro', 'Acceso a tratamiento'],
  ACC: ['Plan de seguridad elaborado o revisado', 'Se conversó la restricción de medios letales', 'Contacto de apoyo informado (con consentimiento)', 'Derivación a psiquiatría / urgencias', 'Mayor frecuencia de sesiones', 'Contacto de seguimiento programado entre sesiones'],
  MEDIOS: ['No se indagó', 'Sin acceso a medios letales', 'Con acceso (armas, plaguicidas, medicación acumulada…)'],
  PASOS: [
    ['alerta', '1. Señales de alerta', 'Pensamientos, situaciones, emociones o conductas que indican que puede venir una crisis (uno por línea)'],
    ['interno', '2. Cosas que puedo hacer yo solo/a para distraerme', 'Estrategias propias, sin contactar a nadie (uno por línea)'],
    ['distraccion', '3. Personas y lugares que me distraen', 'Nombre y teléfono, o el lugar (uno por línea)'],
    ['apoyo', '4. Personas a quienes puedo pedir ayuda', 'Nombre y teléfono de personas de confianza (uno por línea)'],
    ['profesionales', '5. Profesionales y servicios de crisis', 'Teléfonos del terapeuta, líneas de ayuda y emergencias (uno por línea)'],
    ['ambiente', '6. Hacer mi entorno más seguro', 'Qué medios voy a alejar o dejar guardados fuera de mi alcance, y quién me ayuda (uno por línea)']
  ],
  _tocado: false,

  // ---------- estado ----------
  de(pid) { return { evals: this.repo.all().filter(x => x.pid === pid), plan: this.plan.all().find(x => x.pid === pid) || null, tests: Tests.repo.all().filter(t => t.pid === pid) }; },
  est(pid) { return this.L.estado(this.de(pid), today()); },
  lista(pid) { return this.repo.all().filter(x => x.pid === pid).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado.localeCompare(a.creado)); },
  badge(n) { return `<span class="badge ${n === 'Alto' ? 'err' : n === 'Moderado' ? 'warn' : n === 'Bajo' ? '' : 'off'}">${esc(n)}</span>`; },
  lineas: t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean),

  // ---------- avisos visibles ----------
  banner(pid) {
    if (!App.clinico()) return '';
    const s = this.est(pid); let h = '';
    if (s.activa) {
      h += `<div class="alerta-riesgo ${s.nivel === 'Alto' ? 'alto' : 'mod'}" role="alert"><div><b>🚩 Alerta de riesgo suicida: ${esc(s.nivel.toUpperCase())}</b><br><span>Evaluación del ${esc(s.eval.fecha)} (hace ${s.dias} día${s.dias === 1 ? '' : 's'}).${s.reevaluar ? ' ⏰ Toca reevaluar.' : ''}${s.sinPlan ? ' ⚠️ Falta el plan de seguridad o no se revisó después de esta evaluación.' : ''}</span></div><span><button onclick="Riesgo.form('${pid}')">Reevaluar</button> <button class="${s.sinPlan ? 'pri' : ''}" onclick="Riesgo.formPlan('${pid}')">Plan de seguridad</button></span></div>`;
    }
    if (s.ideacionPendiente) {
      h += `<div class="alerta-riesgo mod" role="alert"><div><b>⚠️ PHQ-9, ítem 9 positivo (${esc(s.ideacionPendiente.fecha)})</b><br><span>Aún no hay una evaluación de riesgo posterior a ese test.</span></div><button class="pri" onclick="Riesgo.form('${pid}')">Evaluar riesgo (C-SSRS)</button></div>`;
    }
    return h;
  },
  hoyCard() {
    if (!App.clinico()) return '';
    const orden = x => x.s.nivel === 'Alto' && x.s.activa ? 0 : x.s.activa ? 1 : 2;
    const f = Pacientes.repo.all().map(p => ({ p, s: this.est(p.id) })).filter(x => x.s.hayAlgo).sort((a, b) => orden(a) - orden(b));
    if (!f.length) return '';
    return `<div class="card" style="border-left:4px solid var(--err)"><strong>🚩 Pacientes con alerta de riesgo (${f.length})</strong><div class="wrap"><table>${f.map(({ p, s }) => `<tr style="cursor:pointer" onclick="App.go('pacientes','${p.id}')"><td><b>${esc(p.nombre)}</b></td><td>${s.activa ? this.badge(s.nivel) : '<span class="badge warn">PHQ-9 ítem 9</span>'}</td><td class="mu">${[s.reevaluar ? '⏰ reevaluar (hace ' + s.dias + ' días)' : '', s.sinPlan ? 'falta plan de seguridad' : '', s.ideacionPendiente ? 'ítem 9 del PHQ-9 sin evaluación de riesgo' : ''].filter(Boolean).join(' · ') || 'seguimiento al día'}</td></tr>`).join('')}</table></div></div>`;
  },
  // Recordatorio automático cuando se documenta ideación (nota de sesión o PHQ-9)
  async recordar(pid, fecha) {
    const s = this.est(pid);
    if (!(s.eval && s.eval.fecha >= fecha) && await confirmar('Marcaste que hubo ideación suicida o autolesión. ¿Quieres hacer ahora la evaluación de riesgo (C-SSRS)?', 'Evaluar riesgo', 'Abrir evaluación')) return this.form(pid, fecha);
    if (s.activa && s.sinPlan && await confirmar('Este paciente tiene una alerta de riesgo activa y falta el plan de seguridad. ¿Quieres elaborarlo o revisarlo ahora?', 'Plan de seguridad pendiente', 'Abrir plan')) return this.formPlan(pid);
    App.render();
  },

  // ---------- tarjeta en la ficha ----------
  card(pid) {
    const l = this.lista(pid), s = this.est(pid), pl = this.de(pid).plan;
    const resumen = l.length ? `<p style="margin:6px 0">Último nivel: ${this.badge(s.nivel)} <span class="mu">(${esc(s.eval.fecha)})</span>${s.activa ? ' · alerta <b>activa</b>' : s.eval.alerta === 'resuelta' ? ' · alerta levantada' : ''}</p>` : '<p class="mu">Sin evaluaciones de riesgo suicida. Hazla en la primera sesión y siempre que aparezca ideación.</p>';
    return `<div class="card"><div class="row"><strong>Riesgo suicida y plan de seguridad</strong><span><button class="pri" onclick="Riesgo.form('${pid}')">+ Evaluación C-SSRS</button> <button onclick="Riesgo.formPlan('${pid}')">${pl ? '✎ Plan de seguridad' : '+ Plan de seguridad'}</button>${pl ? ` <button onclick="Riesgo.imprimirPlan('${pid}')" title="Copia para entregar al paciente">🖨</button>` : ''}</span></div>${resumen}` +
      `<p style="margin:4px 0">${pl ? `Plan de seguridad: ✅ vigente (revisado el ${esc(pl.revisado || pl.fecha)})${pl.entregado ? ' · copia entregada' : ' · <span class="mu">copia sin entregar</span>'}` : '<span class="mu">Plan de seguridad: aún no elaborado</span>'}</p>` +
      (l.length ? `<div class="wrap"><table><tr><th>Fecha</th><th>Nivel</th><th>Ideación</th><th>Acciones</th><th></th></tr>${l.map(x => `<tr><td>${esc(x.fecha)}</td><td>${this.badge(x.nivel_final)}${x.nivel !== x.nivel_final ? ' <span class="mu" title="Sugerido por el tamizaje: ' + esc(x.nivel) + '">(ajustado)</span>' : ''}</td><td>${x.q.q5 ? 'Con plan e intención' : x.q.q4 ? 'Con intención' : x.q.q3 ? 'Con método' : x.q.q2 ? 'Activa' : x.q.q1 ? 'Deseo de morir' : 'No'}${x.q.q6 ? (x.q.q6r ? ' · conducta ≤3 m' : ' · conducta previa') : ''}</td><td>${(x.acciones || []).length} registrada(s)</td><td style="white-space:nowrap"><button onclick="Riesgo.ver('${x.id}')">Ver</button>${App.puedeBorrar('evalriesgo') ? ` <button class="del" onclick="Riesgo.del('${x.id}')">✕</button>` : ''}</td></tr>`).join('')}</table></div>` : '') +
      '<p class="mu" style="font-size:14px;margin-bottom:0">Ayuda para el criterio clínico: no lo reemplaza. El nivel final lo decides tú.</p></div>';
  },

  // ---------- formulario de evaluación ----------
  rad(k) { return `<label class="chk"><input type="radio" name="rk_${k}" id="rk_${k}_1" onchange="Riesgo.recalc()"> Sí</label><label class="chk"><input type="radio" name="rk_${k}" id="rk_${k}_0" onchange="Riesgo.recalc()"> No</label>`; },
  resp(k) { const a = $('rk_' + k + '_1'), b = $('rk_' + k + '_0'); return a && a.checked ? true : b && b.checked ? false : null; },
  form(pid, fecha) {
    const p = Pacientes.repo.get(pid); if (!p) return; this._tocado = false;
    const chk = (pre, arr) => arr.map((x, i) => `<label class="chk"><input type="checkbox" id="${pre}${i}"> ${esc(x)}</label>`).join('');
    abrir(`<h3>Evaluación de riesgo suicida · ${esc(p.nombre)}</h3><p class="mu" style="font-size:15px;margin-top:0">Tamizaje C-SSRS (ítems 1 a 5: último mes). Pregunta con calma y de forma directa: preguntar no induce la conducta.</p>
      <label>Fecha</label><input id="rk_fecha" type="date" value="${esc(fecha || today())}" style="max-width:180px">
      <h4 style="margin:14px 0 4px;color:var(--ac)">Tamizaje</h4>
      ${this.PREG.map(([k, t]) => `<div id="rk_b_${k}" ${k > 'q2' ? 'hidden' : ''} style="margin-top:8px"><div>${esc(t)}</div><div class="rad">${this.rad(k)}</div></div>`).join('')}
      <div style="margin-top:8px"><div>${esc(this.P6)}</div><div class="rad">${this.rad('q6')}</div></div>
      <div id="rk_b_q6r" hidden style="margin-top:8px"><div>¿Esa conducta fue en los últimos 3 meses?</div><div class="rad"><label class="chk"><input type="radio" name="rk_q6r" id="rk_q6r_1" onchange="Riesgo.recalc()"> Sí, en los últimos 3 meses</label><label class="chk"><input type="radio" name="rk_q6r" id="rk_q6r_0" onchange="Riesgo.recalc()"> No, hace más de 3 meses</label></div></div>
      <div id="rk_sug" class="rk-sug">Responde el tamizaje para ver el nivel sugerido.</div>
      <h4 style="margin:14px 0 4px;color:var(--ac)">Entrevista clínica</h4>
      <label>Factores de riesgo presentes</label><div class="f2">${chk('rk_fr', this.FR)}</div>
      <label>Factores protectores</label><div class="f2">${chk('rk_pr', this.PROT)}</div>
      <label>Acceso a medios letales</label><select id="rk_med">${this.MEDIOS.map(m => `<option>${esc(m)}</option>`).join('')}</select>
      <label>Observaciones (razones para vivir, contexto, impresión clínica)</label><textarea id="rk_notas" rows="3"></textarea>
      <h4 style="margin:14px 0 4px;color:var(--ac)">Nivel de riesgo y acciones</h4>
      <label>Nivel final (tu criterio clínico)</label><select id="rk_nf" onchange="Riesgo._tocado=true;Riesgo.recalc()">${this.L.NIVELES.map(n => `<option>${n}</option>`).join('')}</select>
      <div id="rk_jb" hidden><label>Justificación (obligatoria si cambias el nivel sugerido)</label><input id="rk_just" placeholder="Ej. Factores protectores sólidos, sin acceso a medios"></div>
      <label>Acciones realizadas</label>${chk('rk_ac', this.ACC)}
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Riesgo.guardar('${pid}')">Guardar evaluación</button></div>
      <p class="mu" style="font-size:14px">C-SSRS © 2008 The Research Foundation for Mental Hygiene, Inc. Redacción adaptada: reemplázala por la versión oficial en español (cssrs.columbia.edu).</p>`);
  },
  sugerido() {
    const q = {}; for (const k of ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']) q[k] = this.resp(k);
    if (q.q2 !== true) { q.q3 = false; q.q4 = false; q.q5 = false; }
    q.q6r = q.q6 === true ? this.resp('q6r') : false; return q;
  },
  recalc() {
    const q = this.sugerido(), ver = (id, v) => { const e = $(id); if (e) e.hidden = !v; };
    ver('rk_b_q3', q.q2 === true); ver('rk_b_q4', q.q2 === true); ver('rk_b_q5', q.q2 === true); ver('rk_b_q6r', q.q6 === true);
    const completo = q.q1 !== null && q.q2 !== null && q.q6 !== null && (q.q2 !== true || (q.q3 !== null && q.q4 !== null && q.q5 !== null)) && (q.q6 !== true || q.q6r !== null);
    const sug = $('rk_sug'), nf = $('rk_nf'); if (!sug) return;
    if (!completo) { sug.className = 'rk-sug'; sug.textContent = 'Responde el tamizaje para ver el nivel sugerido.'; return; }
    const n = this.L.nivel(q); this._sug = n;
    sug.className = 'rk-sug ' + (n === 'Alto' ? 'alto' : n === 'Moderado' ? 'mod' : '');
    sug.innerHTML = `Nivel sugerido por el tamizaje: <b>${esc(n)}</b>` + (n === 'Alto' ? '<br><span style="font-size:15px">Con riesgo alto, lo habitual es valorar derivación o evaluación urgente y no dejar solo/a al paciente. Decide según tu criterio y tu protocolo.</span>' : n === 'Moderado' ? '<br><span style="font-size:15px">Con riesgo moderado conviene elaborar o revisar el plan de seguridad y reevaluar pronto.</span>' : '');
    if (!this._tocado) nf.value = n;
    $('rk_jb').hidden = nf.value === n;
  },
  marcados(pre, arr) { return arr.filter((_, i) => $(pre + i).checked); },
  async guardar(pid) {
    const q = this.sugerido(); this.recalc();
    if (q.q1 === null || q.q2 === null || q.q6 === null || (q.q2 && (q.q3 === null || q.q4 === null || q.q5 === null)) || (q.q6 && q.q6r === null)) return alert('Responde todas las preguntas del tamizaje que correspondan.');
    const n = this.L.nivel(q), nf = $('rk_nf').value, just = $('rk_just').value.trim();
    if (n !== nf && !just) return alert('Cambiaste el nivel sugerido (' + n + ' → ' + nf + '): escribe la justificación.');
    const fecha = $('rk_fecha').value; if (!fecha) return alert('Elige la fecha');
    const alerta = this.L.conAlerta(nf) ? 'activa' : 'ninguna';
    this.repo.save({ pid, fecha, q, nivel: n, nivel_final: nf, justificacion: n !== nf ? just : '', alerta, fr: this.marcados('rk_fr', this.FR), prot: this.marcados('rk_pr', this.PROT), medios: $('rk_med').value, notas: $('rk_notas').value.trim(), acciones: this.marcados('rk_ac', this.ACC) });
    const p = Pacientes.repo.get(pid); if (p && p.riesgo !== this.L.FICHA[nf]) Pacientes.repo.save({ id: pid, riesgo: this.L.FICHA[nf] });
    cerrar(); App.render();
    if (alerta === 'activa' && this.est(pid).sinPlan && await confirmar('Alerta de riesgo ' + nf.toUpperCase() + ' registrada. ¿Quieres elaborar el plan de seguridad con el paciente ahora?', 'Plan de seguridad pendiente', 'Elaborar plan')) this.formPlan(pid);
  },

  // ---------- ver / levantar alerta / borrar ----------
  ver(id) {
    const x = this.repo.get(id); if (!x) return; const p = Pacientes.repo.get(x.pid) || {}, l = t => (t && t.length) ? t.map(esc).join(' · ') : '—';
    const resp = [...this.PREG.map(([k, t]) => [t, x.q[k]]), [this.P6, x.q.q6, x.q.q6 ? (x.q.q6r ? 'últimos 3 meses' : 'hace más de 3 meses') : '']].map(([t, v, e]) => `<tr><td>${esc(t)}</td><td style="white-space:nowrap"><b>${v === true ? 'Sí' : 'No'}</b>${e ? ' · ' + esc(e) : ''}</td></tr>`).join('');
    const ultima = this.L.ultima(this.lista(x.pid)) ;
    abrir(`<h3>Evaluación de riesgo · ${esc(x.fecha)}</h3><p>${esc(p.nombre)} · Nivel final: ${this.badge(x.nivel_final)}${x.nivel !== x.nivel_final ? ` <span class="mu">(sugerido: ${esc(x.nivel)})</span><br><span class="mu">Justificación: ${esc(x.justificacion)}</span>` : ''}</p>
      <div class="wrap"><table>${resp}</table></div>
      <p><b>Factores de riesgo:</b> ${l(x.fr)}<br><b>Factores protectores:</b> ${l(x.prot)}<br><b>Acceso a medios:</b> ${esc(x.medios || '—')}<br><b>Observaciones:</b> ${esc(x.notas) || '—'}<br><b>Acciones:</b> ${l(x.acciones)}</p>
      ${x.alerta === 'resuelta' ? `<p class="mu">Alerta levantada el ${esc(x.resuelta_en)}: ${esc(x.resuelta_nota)}</p>` : ''}
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cerrar</button>${x.alerta === 'activa' && ultima && ultima.id === x.id ? `<button onclick="Riesgo.levantar('${x.id}')">Levantar alerta…</button>` : ''}</div>`);
  },
  levantar(id) {
    abrir(`<h3>Levantar la alerta</h3><p class="mu">Deja constancia de por qué ya no corresponde mantenerla (p. ej. nueva evaluación sin riesgo, crisis superada).</p><label>Motivo</label><textarea id="rk_lev" rows="3"></textarea>
      <div class="row" style="margin-top:14px"><button onclick="Riesgo.ver('${id}')">Cancelar</button><button class="pri" onclick="Riesgo.confirmarLevantar('${id}')">Levantar alerta</button></div>`);
  },
  confirmarLevantar(id) {
    const m = $('rk_lev').value.trim(); if (!m) return alert('Escribe el motivo');
    this.repo.save({ id, alerta: 'resuelta', resuelta_en: today(), resuelta_nota: m }); cerrar(); App.render();
  },
  async del(id) { if (await confirmar('¿Eliminar esta evaluación? Quedará una copia en la papelera del servidor.', 'Eliminar evaluación de riesgo', 'Eliminar', true)) { this.repo.remove(id); App.render(); } },

  // ---------- plan de seguridad (Stanley-Brown) ----------
  PROF0() { const t = (App.ajustes || {}).telefono; return ['Línea 113, opción 5 (Minsa, gratuita, 24 horas)', 'WhatsApp salud mental Minsa: 955 557 000', 'Emergencias: SAMU 106 · Policía 105', t ? 'Consultorio: ' + t : ''].filter(Boolean).join('\n'); },
  formPlan(pid) {
    const p = Pacientes.repo.get(pid); if (!p) return; const pl = this.de(pid).plan || {};
    abrir(`<h3>Plan de seguridad · ${esc(p.nombre)}</h3><p class="mu" style="font-size:15px;margin-top:0">Se construye <b>junto con el paciente</b>, con sus propias palabras. Los teléfonos de crisis son los habituales en Perú: verifícalos de vez en cuando.</p>` +
      this.PASOS.map(([k, t, ph]) => `<label>${t}</label><textarea id="pl_${k}" rows="3" placeholder="${esc(ph)}">${esc(pl[k] !== undefined ? pl[k] : (k === 'profesionales' ? this.PROF0() : ''))}</textarea>`).join('') +
      `<label>Mi razón más importante para vivir</label><input id="pl_razon" value="${esc(pl.razon)}">
      <label class="chk" style="margin-top:12px"><input type="checkbox" id="pl_ent" ${pl.entregado ? 'checked' : ''}> Se entregó una copia al paciente</label>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Riesgo.guardarPlan('${pid}')">Guardar plan</button></div>
      <p class="mu" style="font-size:14px">Basado en el Safety Planning Intervention de Stanley y Brown.</p>`);
  },
  guardarPlan(pid) {
    const pl = this.de(pid).plan, d = { revisado: today(), razon: $('pl_razon').value.trim(), entregado: $('pl_ent').checked };
    this.PASOS.forEach(([k]) => { d[k] = $('pl_' + k).value.trim(); });
    if (!d.alerta && !d.interno && !d.apoyo) return alert('Completa al menos las señales de alerta, las estrategias propias o las personas de apoyo.');
    if (pl) this.plan.save({ id: pl.id, ...d }); else this.plan.save({ pid, fecha: today(), ...d });
    cerrar(); App.render();
  },
  imprimirPlan(pid) {
    const p = Pacientes.repo.get(pid), pl = this.de(pid).plan; if (!p || !pl) return;
    App.audit('reportes', 'imprimir plan de seguridad', pl.id, pid);
    const sec = ([k, t]) => `<h2>${esc(t)}</h2>` + (this.lineas(pl[k]).length ? '<ul>' + this.lineas(pl[k]).map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<p>________________________________</p>');
    Reportes.imprimir(`<h1>Mi plan de seguridad</h1><p>${esc(p.nombre)} · elaborado con mi terapeuta · actualizado el ${esc(pl.revisado || pl.fecha)}</p>${this.PASOS.map(sec).join('')}<h2>Mi razón más importante para vivir</h2><p>${esc(pl.razon) || '________________________________'}</p><p style="margin-top:18px"><b>Si siento que no puedo mantenerme a salvo: llamo al 113 (opción 5) o al 106, o voy a la emergencia más cercana.</b></p>`);
  },

  // ---------- historia clínica impresa ----------
  imprimir(pid) {
    const l = this.lista(pid), pl = this.de(pid).plan; if (!l.length && !pl) return '';
    const x = l[0];
    return '<h2>Riesgo suicida</h2>' + (x ? `<p>Última evaluación C-SSRS: ${esc(x.fecha)} · nivel final <b>${esc(x.nivel_final)}</b>${x.nivel !== x.nivel_final ? ' (sugerido ' + esc(x.nivel) + '; ' + esc(x.justificacion) + ')' : ''}.${x.alerta === 'activa' ? ' Alerta activa.' : ''}<br>Factores de riesgo: ${x.fr.map(esc).join(', ') || '—'}.<br>Factores protectores: ${x.prot.map(esc).join(', ') || '—'}.<br>Acciones: ${x.acciones.map(esc).join(', ') || '—'}.</p><p>Evaluaciones registradas: ${l.length}.</p>` : '') + `<p>Plan de seguridad: ${pl ? 'elaborado, revisado el ' + esc(pl.revisado || pl.fecha) : 'no elaborado'}.</p>`;
  }
};
