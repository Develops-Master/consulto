// Tareas clínicas vinculadas a cada paciente, con fecha límite y estado.
const Tareas = {
  repo: App.repo('tareas'), filtro: 'pendientes', busqueda: '', prioridad: 'Todas', paciente: 'todos',
  ESTADOS: ['Pendiente', 'En curso', 'Completada', 'Cancelada'],
  activas() { return this.repo.all().filter(t => t.estado === 'Pendiente' || t.estado === 'En curso'); },
  orden(a, b) { return a.fecha_limite.localeCompare(b.fecha_limite) || a.titulo.localeCompare(b.titulo); },
  fecha(t) { return t.fecha_limite < today() ? `<span class="warn-txt">Vencida · ${esc(t.fecha_limite)}</span>` : esc(t.fecha_limite); },
  sieteDias() { const d = new Date(today() + 'T12:00:00'); d.setDate(d.getDate() + 7); return d.toLocaleDateString('en-CA'); },
  filtrar() {
    const hoy = today(), limite = this.sieteDias(), q = this.busqueda.trim().toLocaleLowerCase('es');
    return this.repo.all().filter(t => {
      const activa = t.estado === 'Pendiente' || t.estado === 'En curso';
      if (this.filtro === 'pendientes' && !activa) return false;
      if (this.filtro === 'hoy' && (!activa || t.fecha_limite !== hoy)) return false;
      if (this.filtro === 'semana' && (!activa || t.fecha_limite < hoy || t.fecha_limite > limite)) return false;
      if (this.filtro === 'vencidas' && (!activa || t.fecha_limite >= hoy)) return false;
      if (this.filtro === 'completadas' && t.estado !== 'Completada') return false;
      if (this.paciente !== 'todos' && t.pid !== this.paciente) return false;
      if (this.prioridad !== 'Todas' && t.prioridad !== this.prioridad) return false;
      const nombre = (Pacientes.repo.get(t.pid) || {}).nombre || '';
      return !q || `${t.titulo} ${t.descripcion} ${nombre}`.toLocaleLowerCase('es').includes(q);
    }).sort((a, b) => this.orden(a, b));
  },
  tabla(lista, conPaciente) {
    if (!lista.length) return '<p class="mu">No hay tareas en esta vista.</p>';
    return `<div class="wrap"><table><tr>${conPaciente ? '<th>Paciente</th>' : ''}<th>Tarea</th><th>Fecha límite</th><th>Prioridad</th><th>Estado</th><th></th></tr>` +
      lista.map(t => `<tr>${conPaciente ? `<td><a href="#" onclick="App.go('pacientes','${t.pid}');return false">${esc((Pacientes.repo.get(t.pid) || {}).nombre || '—')}</a></td>` : ''}<td><strong>${esc(t.titulo)}</strong>${t.descripcion ? `<br><span class="mu">${esc(t.descripcion)}</span>` : ''}</td><td>${this.fecha(t)}</td><td>${t.prioridad === 'Alta' ? '<span class="warn-txt">Alta</span>' : 'Normal'}</td><td><select aria-label="Estado de ${esc(t.titulo)}" onchange="Tareas.set('${t.id}',this.value)">${this.ESTADOS.map(e => `<option ${e === t.estado ? 'selected' : ''}>${e}</option>`).join('')}</select></td><td style="white-space:nowrap"><button onclick="Tareas.form('${t.pid}','${t.id}')" title="Editar tarea">✎</button> <button class="del" onclick="Tareas.del('${t.id}')" title="Eliminar tarea">✕</button></td></tr>`).join('') + '</table></div>';
  },
  card(pid) {
    const lista = this.repo.all().filter(t => t.pid === pid).sort((a, b) => this.orden(a, b));
    return `<div class="card"><div class="row"><strong>Tareas de seguimiento</strong><button class="pri" onclick="Tareas.form('${pid}')">+ Tarea</button></div>${this.tabla(lista, false)}</div>`;
  },
  hoyCard() {
    const lista = this.activas().filter(t => t.fecha_limite <= today()).sort((a, b) => this.orden(a, b));
    if (!lista.length) return '';
    return `<div class="card"><div class="row"><strong>Tareas vencidas o para hoy · ${lista.length}</strong><button onclick="App.go('tareas')">Ver tareas</button></div>${this.tabla(lista.slice(0, 5), true)}${lista.length > 5 ? `<p class="mu">Y ${lista.length - 5} más</p>` : ''}</div>`;
  },
  render(el) {
    const todas = this.repo.all(), hoy = today(), activas = this.activas();
    const cuenta = filtro => filtro === 'todas' ? todas.length : filtro === 'completadas' ? todas.filter(t => t.estado === 'Completada').length : filtro === 'vencidas' ? activas.filter(t => t.fecha_limite < hoy).length : filtro === 'hoy' ? activas.filter(t => t.fecha_limite === hoy).length : filtro === 'semana' ? activas.filter(t => t.fecha_limite >= hoy && t.fecha_limite <= this.sieteDias()).length : activas.length;
    const pestañas = [['pendientes', 'Abiertas'], ['hoy', 'Hoy'], ['semana', 'Próx. 7 días'], ['vencidas', 'Vencidas'], ['completadas', 'Completadas'], ['todas', 'Todas']];
    const pacientes = Pacientes.repo.all().slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
    const tab = ([id, label]) => `<button class="${this.filtro === id ? 'pri' : ''}" aria-pressed="${this.filtro === id}" onclick="Tareas.ver('${id}')">${label} <span class="badge">${cuenta(id)}</span></button>`;
    const lista = this.filtrar();
    el.innerHTML = `<div class="grid">${[['Abiertas', cuenta('pendientes')], ['Vencidas', cuenta('vencidas')], ['Para hoy', cuenta('hoy')], ['Completadas', cuenta('completadas')]].map(([label, total]) => `<div class="stat"><b>${total}</b><span>${label}</span></div>`).join('')}</div>
      <div class="card"><div class="row"><strong>Seguimiento de tareas clínicas</strong><button class="pri" onclick="Tareas.form()">+ Nueva tarea</button></div>
      <div class="row" role="group" aria-label="Vistas de tareas">${pestañas.map(tab).join(' ')}</div>
      <div class="f2"><div><label for="ta_buscar">Buscar tarea o paciente</label><input id="ta_buscar" type="search" value="${esc(this.busqueda)}" oninput="Tareas.buscar(this.value)" placeholder="Título, indicaciones o paciente"></div>
      <div><label for="ta_paciente">Paciente</label><select id="ta_paciente" onchange="Tareas.filtrarPaciente(this.value)"><option value="todos">Todos los pacientes</option>${pacientes.map(p => `<option value="${p.id}" ${this.paciente === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div></div>
      <div class="row" style="margin-top:8px"><label for="ta_prioridad">Prioridad</label><select id="ta_prioridad" style="max-width:220px" onchange="Tareas.filtrarPrioridad(this.value)"><option ${this.prioridad === 'Todas' ? 'selected' : ''}>Todas</option><option ${this.prioridad === 'Alta' ? 'selected' : ''}>Alta</option><option ${this.prioridad === 'Normal' ? 'selected' : ''}>Normal</option></select><span class="mu">${lista.length} tarea(s)</span></div>${this.tabla(lista, true)}</div>`;
  },
  ver(filtro) { this.filtro = filtro; App.render(); },
  buscar(texto) { this.busqueda = texto; this.render($('view')); $('ta_buscar').focus(); $('ta_buscar').setSelectionRange(texto.length, texto.length); },
  filtrarPaciente(id) { this.paciente = id; App.render(); },
  filtrarPrioridad(prioridad) { this.prioridad = prioridad; App.render(); },
  form(pid, id) {
    if (!pid || pid === 'undefined') pid = '';
    const t = id ? this.repo.get(id) || {} : {};
    const pacientes = Pacientes.repo.all().slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (!pid && !pacientes.length) return alert('Primero registra un paciente');
    const paciente = pid || t.pid || '';
    abrir(`<h3>${id ? 'Editar tarea' : 'Nueva tarea de seguimiento'}</h3>${pid ? `<p class="mu">Paciente: ${esc((Pacientes.repo.get(pid) || {}).nombre || '')}</p>` : `<label for="ta_pid">Paciente</label><select id="ta_pid"><option value="">Selecciona un paciente</option>${pacientes.map(p => `<option value="${p.id}" ${p.id === paciente ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>`}<label>Tarea</label><input id="ta_t" maxlength="120" value="${esc(t.titulo)}" placeholder="Ej. Practicar el registro de pensamientos">
      <label>Indicaciones / nota privada</label><textarea id="ta_d" maxlength="4000" rows="3">${esc(t.descripcion)}</textarea>
      <div class="f2"><div><label>Fecha límite</label><input id="ta_f" type="date" value="${esc(t.fecha_limite || today())}" required></div><div><label>Prioridad</label><select id="ta_p"><option ${!t.prioridad || t.prioridad === 'Normal' ? 'selected' : ''}>Normal</option><option ${t.prioridad === 'Alta' ? 'selected' : ''}>Alta</option></select></div></div>
      <div class="f2"><div><label>Estado</label><select id="ta_e">${this.ESTADOS.map(e => `<option ${e === (t.estado || 'Pendiente') ? 'selected' : ''}>${e}</option>`).join('')}</select></div><div class="mu" style="align-self:end">${esc((Pacientes.repo.get(pid) || {}).nombre || '')}</div></div>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Tareas.guardar('${pid}','${id || ''}')">Guardar</button></div>`);
  },
  guardar(pid, id) {
    const titulo = $('ta_t').value.trim(), fecha_limite = $('ta_f').value;
    if (!titulo) return alert('Escribe el nombre de la tarea');
    if (!fecha_limite) return alert('Elige una fecha límite');
    pid = pid || $('ta_pid').value;
    if (!pid) return alert('Selecciona un paciente');
    const tarea = { titulo, descripcion: $('ta_d').value.trim(), fecha_limite, prioridad: $('ta_p').value, estado: $('ta_e').value };
    if (id) this.repo.save({ id, ...tarea }); else this.repo.save({ pid, ...tarea });
    cerrar(); App.render();
  },
  set(id, estado) { this.repo.save({ id, estado }); App.render(); },
  async del(id) { if (await confirmar('¿Eliminar esta tarea? Quedará en la papelera del servidor.', 'Eliminar tarea', 'Eliminar', true)) { this.repo.remove(id); App.render(); } }
};
App.register({ id: 'tareas', title: 'Tareas', menu: true, icon: '☑', order: 3.5, render: el => Tareas.render(el) });