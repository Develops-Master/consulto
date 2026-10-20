// Conciliación de medicación declarada o transcrita de una receta externa. No prescribe ni dispensa.
const Medicamentos = {
  repo: App.repo('medicaciones'),
  FUENTES: ['Receta externa', 'Informado por paciente'],
  ESTADOS: ['En uso', 'Suspendido', 'Finalizado'],
  lista(pid) { return this.repo.all().filter(m => m.pid === pid).sort((a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || '') || (b.creado || '').localeCompare(a.creado || '')); },
  card(pid) {
    const lista = this.lista(pid);
    return `<div class="card ficha-contenido"><div class="row"><strong>Medicación registrada</strong><button class="pri" onclick="Medicamentos.form('${pid}')">+ Registrar medicación</button></div><p class="mu">Conciliación de información reportada o transcrita de una receta externa. No recomienda, prescribe, dispensa ni verifica interacciones.</p>${lista.length ? `<div class="wrap"><table><tr><th>Medicamento</th><th>Estado</th><th>Inicio</th><th>Origen</th><th></th></tr>${lista.map(m => `<tr><td><b>${esc(m.medicamento)}</b><br><span class="mu">${esc(m.dosis || '')}${m.frecuencia ? ' · ' + esc(m.frecuencia) : ''}</span></td><td><span class="badge${m.estado !== 'En uso' ? ' off' : ''}">${esc(m.estado)}</span></td><td>${esc(m.fecha_inicio)}</td><td>${esc(m.fuente)}</td><td><button onclick="Medicamentos.form('${pid}','${m.id}')">Ver / editar</button>${App.puedeBorrar('medicaciones') ? ` <button class="del" onclick="Medicamentos.del('${m.id}')">✕</button>` : ''}</td></tr>`).join('')}</table></div>` : '<p class="mu">Aún no hay medicación registrada.</p>'}</div>`;
  },
  form(pid, id) {
    const m = id ? this.repo.get(id) || {} : {};
    abrir(`<h3>${id ? 'Registro de medicación' : 'Registrar medicación'}</h3><p class="mu">Anota lo que el paciente informa o transcribe exactamente de una receta externa. Este formulario no indica qué medicamento ni dosis usar.</p>
      <label for="med_nombre">Medicamento</label><input id="med_nombre" maxlength="120" value="${esc(m.medicamento)}" placeholder="Nombre tal como aparece en la receta o informa el paciente">
      <div class="f2"><div><label for="med_fuente">Origen</label><select id="med_fuente" onchange="Medicamentos.actualizarOrigen()">${this.FUENTES.map(f => `<option ${f === (m.fuente || this.FUENTES[0]) ? 'selected' : ''}>${f}</option>`).join('')}</select></div><div id="med_prescriptor_wrap"><label for="med_prescriptor">Profesional que figura en la receta</label><input id="med_prescriptor" maxlength="160" value="${esc(m.prescriptor)}"></div></div>
      <div class="f2"><div><label for="med_dosis">Dosis transcrita (opcional)</label><input id="med_dosis" maxlength="120" value="${esc(m.dosis)}" placeholder="Copiar literalmente de la receta"></div><div><label for="med_frecuencia">Frecuencia transcrita (opcional)</label><input id="med_frecuencia" maxlength="120" value="${esc(m.frecuencia)}" placeholder="Copiar literalmente de la receta"></div></div>
      <div class="f2"><div><label for="med_inicio">Fecha de inicio o reporte</label><input id="med_inicio" type="date" value="${esc(m.fecha_inicio || today())}"></div><div><label for="med_fin">Fecha de fin (opcional)</label><input id="med_fin" type="date" value="${esc(m.fecha_fin)}"></div></div>
      <label for="med_estado">Estado</label><select id="med_estado">${this.ESTADOS.map(e => `<option ${e === (m.estado || 'En uso') ? 'selected' : ''}>${e}</option>`).join('')}</select>
      <label for="med_observacion">Observación reportada (opcional)</label><textarea id="med_observacion" maxlength="2000" rows="3">${esc(m.observacion)}</textarea>
      <p class="mu" style="font-size:14px">Si se requiere una indicación farmacológica, debe emitirla y revisarla el profesional legalmente autorizado. El consultorio no mantiene inventario ni dispensa medicamentos.</p>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Medicamentos.guardar('${pid}','${id || ''}')">Guardar registro</button></div>`);
    this.actualizarOrigen();
  },
  actualizarOrigen() { const externo = $('med_fuente').value === 'Receta externa'; $('med_prescriptor_wrap').hidden = !externo; },
  guardar(pid, id) {
    const d = { medicamento: $('med_nombre').value.trim(), fuente: $('med_fuente').value, prescriptor: $('med_prescriptor').value.trim(), dosis: $('med_dosis').value.trim(), frecuencia: $('med_frecuencia').value.trim(), fecha_inicio: $('med_inicio').value, fecha_fin: $('med_fin').value, estado: $('med_estado').value, observacion: $('med_observacion').value.trim() };
    if (!d.medicamento) return alert('Escribe el nombre del medicamento');
    if (d.fuente === 'Receta externa' && !d.prescriptor) return alert('Registra el profesional que figura en la receta');
    if (!d.fecha_inicio || d.fecha_fin && d.fecha_fin < d.fecha_inicio) return alert('Revisa las fechas del registro');
    if (id) this.repo.save({ id, ...d }); else this.repo.save({ pid, ...d });
    cerrar(); App.render();
  },
  async del(id) { if (await confirmar('¿Eliminar este registro de medicación? Quedará en la papelera.', 'Eliminar registro', 'Eliminar', true)) { this.repo.remove(id); App.render(); } }
};