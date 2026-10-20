// Módulo Lista de espera: personas que quieren cita y aún no tienen horario
const Espera = {
  repo: App.repo('espera'), PRI: ['Normal', 'Alta'], ESTADOS: ['En espera', 'Agendado', 'Descartado'],
  activos: () => Espera.repo.all().filter(e => e.estado === 'En espera'),
  card() {
    const l = this.activos().sort((a, b) => (a.prioridad === 'Alta' ? 0 : 1) - (b.prioridad === 'Alta' ? 0 : 1) || a.fecha.localeCompare(b.fecha));
    return `<div class="card"><div class="row"><strong>Lista de espera (${l.length})</strong><button class="pri" onclick="Espera.form()">+ Agregar a la lista</button></div>` +
      (l.length ? `<div class="wrap"><table><tr><th>Persona</th><th>Motivo / preferencia</th><th>Desde</th><th>Prioridad</th><th></th></tr>${l.map(e => `<tr><td><b>${esc(e.nombre)}</b><br><span class="mu">${esc(e.tel)}</span></td><td>${esc(e.motivo)}${e.pref ? `<br><span class="mu">🕐 ${esc(e.pref)}</span>` : ''}</td><td>${esc(e.fecha)}</td><td>${e.prioridad === 'Alta' ? '<span class="badge">Alta</span>' : 'Normal'}</td><td style="white-space:nowrap"><button class="pri" onclick="Espera.agendar('${e.id}')">Agendar</button> <button onclick="Espera.form('${e.id}')" title="Editar">✎</button> <button class="del" onclick="Espera.del('${e.id}')">✕</button></td></tr>`).join('')}</table></div>` : '<p class="mu">Nadie en espera. Cuando no haya horario, agrega aquí a la persona; si se cancela una cita te avisaremos.</p>') + '</div>';
  },
  form(id) {
    const e = id ? this.repo.get(id) || {} : {}, ps = Pacientes.repo.all().sort((a, b) => a.nombre.localeCompare(b.nombre));
    abrir(`<h3>${id ? 'Editar' : 'Agregar a'} lista de espera</h3><label>Paciente existente (opcional)</label><select id="e_p"><option value="">— Persona nueva —</option>${ps.map(p => `<option value="${p.id}" ${p.id === e.paciente ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>
      <div class="f2"><div><label>Nombre</label><input id="e_n" value="${esc(e.nombre)}"></div><div><label>Teléfono (WhatsApp)</label><input id="e_t" value="${esc(e.tel)}"></div></div>
      <label>Motivo (breve)</label><input id="e_m" value="${esc(e.motivo)}"><label>Disponibilidad / preferencia</label><input id="e_h" value="${esc(e.pref)}" placeholder="Ej. lunes y miércoles por la tarde">
      <div class="f2"><div><label>Prioridad</label><select id="e_r">${this.PRI.map(x => `<option ${x === (e.prioridad || 'Normal') ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div><label>Estado</label><select id="e_e">${this.ESTADOS.map(x => `<option ${x === (e.estado || 'En espera') ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Espera.guardar('${id || ''}')">Guardar</button></div>`);
  },
  guardar(id) {
    const pid = $('e_p').value, p = pid ? Pacientes.repo.get(pid) : null, nombre = $('e_n').value.trim() || (p ? p.nombre : ''); if (!nombre) return alert('Escribe el nombre');
    const d = { nombre, tel: $('e_t').value.trim() || (p ? p.tel || '' : ''), paciente: pid, motivo: $('e_m').value.trim(), pref: $('e_h').value.trim(), prioridad: $('e_r').value, estado: $('e_e').value };
    if (id) this.repo.save({ id, ...d }); else this.repo.save({ ...d, fecha: today() });
    cerrar(); App.render();
  },
  async agendar(id) {
    const e = this.repo.get(id); if (!e) return; let pid = e.paciente;
    if (!pid || !Pacientes.repo.get(pid)) {
      if (!await confirmar(`Se creará el paciente "${e.nombre}" (con su teléfono) para programar la sesión.`, 'Crear paciente y agendar', 'Continuar')) return;
      pid = Pacientes.repo.save({ nombre: e.nombre, tel: e.tel || '' }).id; this.repo.save({ id, paciente: pid });
    }
    Sesiones.form(pid, '', '', id);
  },
  agendada(id, pid) { this.repo.save({ id, estado: 'Agendado', paciente: pid }); },
  async del(id) { if (await confirmar('¿Quitar de la lista de espera?', 'Quitar de lista de espera', 'Quitar', true)) { this.repo.remove(id); App.render(); } }
};
