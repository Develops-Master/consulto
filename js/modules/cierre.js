// Módulo Cierre del tratamiento: estado del paciente, informe psicológico final y seguimiento posterior al alta
const Cierre = {
  repo: App.repo('cierres'), seg: App.repo('seguimientos'),
  ESTADOS: ['Activo', 'Alta', 'Abandono'], MEDIOS: ['Llamada', 'WhatsApp', 'Cita', 'Otro'], SITUA: ['Estable', 'Mejoría sostenida', 'Recaída', 'Sin contacto'],
  de: pid => Cierre.repo.all().find(c => c.pid === pid),
  estado: pid => (Cierre.de(pid) || {}).estado || 'Activo',
  badge(pid) { const e = this.estado(pid); return `<span class="badge${e === 'Activo' ? '' : ' off'}">${e}</span>`; },
  card(pid) {
    const c = this.de(pid), sg = this.seg.all().filter(x => x.pid === pid).sort((a, b) => a.fecha.localeCompare(b.fecha)), e = this.estado(pid);
    return `<div class="card"><div class="row"><strong>Cierre del tratamiento</strong><span>${c && e !== 'Activo' ? `<button onclick="Cierre.imprimir('${pid}')">Informe final</button> ` : ''}<button class="pri" onclick="Cierre.form('${pid}')">${c ? 'Editar cierre' : 'Cerrar tratamiento'}</button></span></div>
      <p style="margin:6px 0">Estado: ${this.badge(pid)}${c && e !== 'Activo' ? ` · ${esc(c.fecha)}${c.motivo ? ' · ' + esc(c.motivo) : ''}` : ''}</p>
      ${c && e !== 'Activo' ? `<div class="row" style="margin-top:8px"><strong style="font-size:16px">Seguimiento posterior</strong><span>${sg.length ? '' : `<button onclick="Cierre.programar('${pid}')">Programar 1, 3 y 6 meses</button> `}<button onclick="Cierre.formSeg('${pid}')">+ Seguimiento</button></span></div>` +
        (sg.length ? `<div class="wrap"><table><tr><th>Fecha</th><th>Medio</th><th>Situación</th><th>Nota</th><th></th></tr>${sg.map(x => `<tr><td>${esc(x.fecha)}</td><td>${esc(x.medio)}</td><td>${x.hecho ? esc(x.situacion) : '<span class="badge">Pendiente</span>'}</td><td>${esc(x.nota)}</td><td style="white-space:nowrap"><button onclick="Cierre.formSeg('${pid}','${x.id}')" title="Registrar / editar">✎</button> <button class="del" onclick="Cierre.delSeg('${x.id}')">✕</button></td></tr>`).join('')}</table></div>` : '<p class="mu">Sin seguimientos programados.</p>') : '<p class="mu">Al dar el alta o registrar un abandono podrás redactar el informe final y programar el seguimiento.</p>'}</div>`;
  },
  form(pid) {
    const c = this.de(pid) || {};
    abrir(`<h3>Cierre del tratamiento</h3><div class="f2"><div><label>Estado</label><select id="c_e">${this.ESTADOS.map(x => `<option ${x === (c.estado || 'Alta') ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div><label>Fecha de cierre</label><input id="c_f" type="date" value="${esc(c.fecha || today())}"></div></div>
      <label>Motivo del cierre</label><input id="c_m" value="${esc(c.motivo)}" placeholder="Ej. Objetivos logrados / dejó de asistir desde…">
      <div class="row" style="margin-top:10px"><strong>Informe psicológico final</strong><button onclick="Cierre.auto('${pid}')">Autocompletar resumen</button></div>
      <label>Resumen del proceso</label><textarea id="c_r" rows="4">${esc(c.resumen)}</textarea>
      <label>Resultados / logros</label><textarea id="c_l" rows="3">${esc(c.logros)}</textarea>
      <label>Impresión diagnóstica final</label><textarea id="c_d" rows="2">${esc(c.diag)}</textarea>
      <label>Recomendaciones</label><textarea id="c_c" rows="3">${esc(c.recom)}</textarea>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Cierre.guardar('${pid}')">Guardar</button></div>`);
  },
  auto(pid) {
    const ses = Sesiones.repo.all().filter(s => s.pid === pid), at = ses.filter(s => s.estado === 'Atendida').sort((a, b) => a.fecha.localeCompare(b.fecha)), p = Pacientes.repo.get(pid) || {};
    const ob = Plan.repo.all().filter(o => o.pid === pid), lg = ob.filter(o => o.estado === 'Logrado'), t = Tests.resumen(pid);
    if (!$('c_r').value.trim()) $('c_r').value = `${p.nombre || 'El paciente'} acudió por: ${p.motivo || '—'}. Se realizaron ${at.length} sesiones atendidas${at.length ? ` (del ${at[0].fecha} al ${at[at.length - 1].fecha})` : ''}${p.enfoque ? ' con enfoque ' + p.enfoque : ''}.`;
    if (!$('c_l').value.trim()) $('c_l').value = (ob.length ? `Objetivos logrados: ${lg.length} de ${ob.length}.\n${lg.map(o => '• ' + o.texto).join('\n')}\n` : '') + t;
    if (!$('c_d').value.trim()) $('c_d').value = [p.diag, p.cie].filter(Boolean).join(' · ');
  },
  guardar(pid) {
    const d = { estado: $('c_e').value, fecha: $('c_f').value || today(), motivo: $('c_m').value.trim(), resumen: $('c_r').value.trim(), logros: $('c_l').value.trim(), diag: $('c_d').value.trim(), recom: $('c_c').value.trim() }, c = this.de(pid);
    if (c) this.repo.save({ id: c.id, ...d }); else this.repo.save({ pid, ...d });
    cerrar(); App.render();
  },
  programar(pid) {
    const c = this.de(pid); if (!c) return;
    [1, 3, 6].forEach(m => { const f = new Date(c.fecha + 'T12:00:00'); f.setMonth(f.getMonth() + m); this.seg.save({ pid, fecha: f.toLocaleDateString('en-CA'), medio: 'Llamada', hecho: false, situacion: '', nota: '' }); });
    App.render();
  },
  formSeg(pid, id) {
    const x = id ? this.seg.get(id) || {} : {};
    abrir(`<h3>${id ? 'Seguimiento' : 'Nuevo seguimiento'}</h3><div class="f2"><div><label>Fecha</label><input id="s_f" type="date" value="${esc(x.fecha || today())}"></div>
      <div><label>Medio</label><select id="s_m">${this.MEDIOS.map(m => `<option ${m === x.medio ? 'selected' : ''}>${m}</option>`).join('')}</select></div></div>
      <label style="display:flex;gap:6px;align-items:center"><input id="s_h" type="checkbox" style="width:auto" ${x.hecho || !id ? 'checked' : ''}> Ya realizado</label>
      <label>Situación del paciente</label><select id="s_s">${this.SITUA.map(m => `<option ${m === x.situacion ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <label>Nota</label><textarea id="s_n" rows="3">${esc(x.nota)}</textarea>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Cierre.guardarSeg('${pid}','${id || ''}')">Guardar</button></div>`);
  },
  guardarSeg(pid, id) {
    const d = { fecha: $('s_f').value || today(), medio: $('s_m').value, hecho: $('s_h').checked, situacion: $('s_s').value, nota: $('s_n').value.trim() };
    if (id) this.seg.save({ id, ...d }); else this.seg.save({ pid, ...d });
    cerrar(); App.render();
  },
  async delSeg(id) { if (await confirmar('¿Eliminar este seguimiento?', 'Eliminar seguimiento', 'Eliminar', true)) { this.seg.remove(id); App.render(); } },
  imprimir(pid) {
    const c = this.de(pid), p = Pacientes.repo.get(pid); if (!c || !p) return; App.audit('reportes', 'imprimir informe', c.id, pid);
    const at = Sesiones.repo.all().filter(s => s.pid === pid && s.estado === 'Atendida'), ob = Plan.repo.all().filter(o => o.pid === pid), t = Tests.comparar(pid);
    const tx = s => esc(s).replace(/\n/g, '<br>') || '—', f = (l, v) => `<p><b>${l}:</b> ${esc(v) || '—'}</p>`;
    Reportes.imprimir(`<h1>Informe psicológico final</h1><p>Emitido el ${today()}</p><h2>Datos del paciente</h2>${f('Nombre', p.nombre)}${f('DNI', p.doc)}${f('Edad', Pacientes.calc(p, '_edad'))}${f('Motivo de consulta', p.motivo)}
      <h2>Cierre</h2>${f('Estado', c.estado)}${f('Fecha de cierre', c.fecha)}${f('Motivo del cierre', c.motivo)}${f('Sesiones atendidas', String(at.length))}
      <h2>Resumen del proceso</h2><p>${tx(c.resumen)}</p><h2>Plan y objetivos</h2>${ob.map(o => `<p>• ${esc(o.texto)} (${esc(o.meta)}) — ${esc(o.estado)}</p>`).join('') || '<p>Sin objetivos.</p>'}
      ${t.length ? '<h2>Evaluación psicométrica (inicio → cierre)</h2><table><tr><th>Test</th><th>Inicio</th><th>Cierre</th><th>Cambio</th></tr>' + t.map(x => `<tr><td>${esc(Tests.T[x.k].nom)}</td><td>${x.f.puntaje} (${esc(x.f.nivel)})</td><td>${x.u.puntaje} (${esc(x.u.nivel)})</td><td>${x.d > 0 ? '+' : ''}${x.d} ${x.d === 0 ? 'sin cambio' : x.ok ? 'mejoría' : 'sin mejoría'}</td></tr>`).join('') + '</table>' : ''}
      <h2>Resultados / logros</h2><p>${tx(c.logros)}</p><h2>Impresión diagnóstica final</h2><p>${tx(c.diag)}</p><h2>Recomendaciones</h2><p>${tx(c.recom)}</p>
      <p style="margin-top:60px">______________________________<br>${esc(App.user ? App.user.nombre : '')}<br>Psicólogo/a</p>`);
  }
};
