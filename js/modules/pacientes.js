// Módulo Pacientes: historia clínica
const Pacientes = {
  repo: App.repo('pacientes'), q: '', filtro: 'todos', orden: 'nombre', fichaTabs: {}, filtroSesiones: {},
  // Tipos: (vacío)=texto · date · number · email · t=área de texto · s:a|b=lista · h=encabezado de grupo · c=calculado
  campos: [
    ['_', 'Datos personales', 'h'], ['nombre', 'Nombre completo'], ['doc', 'DNI'], ['nac', 'Fecha de nacimiento', 'date'], ['_edad', 'Edad', 'c'],
    ['sexo', 'Sexo', 's:Femenino|Masculino|Otro'], ['civil', 'Estado civil', 's:Soltero/a|Casado/a|Conviviente|Divorciado/a|Viudo/a'],
    ['instr', 'Grado de instrucción', 's:Primaria|Secundaria|Técnico|Universitario|Posgrado'], ['ocup', 'Ocupación'], ['vive', 'Con quién vive'],
    ['tel', 'Teléfono (WhatsApp)'], ['email', 'Correo electrónico', 'email'], ['dir', 'Dirección'], ['distrito', 'Distrito'],
    ['_', 'Contacto de emergencia y seguro', 'h'], ['emerg', 'Contacto de emergencia'], ['emtel', 'Teléfono de emergencia'], ['seguro', 'Seguro / EPS'], ['tarifa', 'Tarifa por sesión (S/)', 'number'], ['deriv', 'Derivado por'],
    ['_', 'Historia clínica', 'h'], ['motivo', 'Motivo de consulta', 't'], ['actual', 'Historia del problema actual', 't'], ['ante', 'Antecedentes personales y familiares', 't'],
    ['psico', 'Antecedentes psicológicos / psiquiátricos previos', 't'], ['medic', 'Antecedentes de medicación (resumen)', 't'], ['habitos', 'Hábitos (sueño, alimentación, alcohol, tabaco, sustancias)', 't'],
    ['riesgo', 'Riesgo (autolesión / suicida)', 's:Sin riesgo|Riesgo bajo|Riesgo moderado|Riesgo alto'],
    ['_', 'Diagnóstico psicológico y plan', 'h'], ['tests', 'Pruebas / tests aplicados y resultados', 't'], ['diag', 'Impresión diagnóstica psicológica', 't'], ['cie', 'Código CIE-10 o DSM-5-TR'],
    ['enfoque', 'Enfoque terapéutico', 's:Cognitivo-conductual|Humanista|Sistémico|Psicodinámico|Integrativo|Otro'], ['nses', 'N.º de sesiones previstas', 'number']],
  calc(p, k) {
    if (k === '_edad') { if (!p.nac) return ''; const n = new Date(p.nac), h = new Date(); let e = h.getFullYear() - n.getFullYear(); if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) e--; return isNaN(e) ? '' : e + ' años'; }
    if (k === '_imc') { const w = +p.peso, t = +p.talla / 100; if (!w || !t) return ''; const v = w / (t * t); return v.toFixed(1) + ' (' + (v < 18.5 ? 'bajo peso' : v < 25 ? 'normal' : v < 30 ? 'sobrepeso' : 'obesidad') + ')'; }
    return '';
  },
  val(p, k, t) { return t === 'c' ? this.calc(p, k) : p[k]; },
  // Campos que este usuario puede ver/editar (recepción solo ve datos de contacto)
  cv() {
    const ok = App.permisos.campos.pacientes; if (!ok) return this.campos;
    const r = []; let enc = null;
    this.campos.forEach(c => { if (c[2] === 'h') { enc = c; return; } if (c[2] === 'c' ? c[0] === '_edad' : ok.includes(c[0])) { if (enc) { r.push(enc); enc = null; } r.push(c); } });
    return r;
  },
  vista(p) {
    let h = '', open = false;
    this.cv().forEach(([k, l, t]) => {
      if (t === 'h') { h += (open ? '</div>' : '') + `<h4 style="margin:14px 0 6px;color:var(--ac)">${l}</h4><div class="f2">`; open = true; return; }
      h += `<div${t === 't' ? ' style="grid-column:1/-1"' : ''}><div class="mu" style="font-size:15px">${l}</div><div>${esc(this.val(p, k, t)) || '—'}</div></div>`;
    });
    return h + '</div>';
  },
  vistaImpresion(p) {
    return this.cv().map(([k, l, t]) => t === 'h' ? `<h2>${l}</h2>` : `<p><b>${l}:</b> ${esc(this.val(p, k, t)) || '—'}</p>`).join('');
  },
  render(el, id) { id ? this.detalle(el, id) : this.lista(el); },
  pestanasFicha() {
    return App.clinico()
      ? [['resumen', 'Resumen'], ['historia', 'Ficha clínica'], ['historial', 'Historial'], ['sesiones', 'Sesiones'], ['avance', 'Evolución'], ['medicacion', 'Medicación'], ['clinico', 'Riesgo y consentimiento'], ['documentos', 'Documentos'], ['cuenta', 'Cuenta']]
      : [['resumen', 'Resumen'], ['historia', 'Datos'], ['sesiones', 'Sesiones'], ['cuenta', 'Cuenta']];
  },
  cambiarPestana(id, pestana) {
    this.fichaTabs[id] = pestana; this.detalle($('view'), id);
    const boton = $('ficha-tab-' + pestana); if (boton) boton.focus();
  },
  tecladoPestana(id, pestana, e) {
    const tabs = this.pestanasFicha().map(x => x[0]), indice = tabs.indexOf(pestana);
    const siguiente = e.key === 'ArrowRight' ? (indice + 1) % tabs.length : e.key === 'ArrowLeft' ? (indice + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (siguiente < 0) return;
    e.preventDefault(); this.cambiarPestana(id, tabs[siguiente]);
  },
  filtrarSesiones(id, filtro) { this.filtroSesiones[id] = filtro; this.detalle($('view'), id); },
  filas() {
    const sesiones = Sesiones.repo.all(), clinico = App.clinico();
    return this.repo.all().map(p => {
      const proximas = sesiones.filter(s => s.pid === p.id && s.estado === 'Programada' && s.fecha >= today()).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
      const riesgo = clinico ? Riesgo.est(p.id) : null, medicion = clinico ? Medicion.est(p.id) : null;
      return { p, total: sesiones.filter(s => s.pid === p.id).length, proxima: proximas[0] || null, estado: clinico ? Cierre.estado(p.id) : null, alerta: !!(riesgo && riesgo.hayAlgo || medicion && medicion.hayAlgo), riesgo, medicion };
    });
  },
  aplicarFiltro(filas) {
    const q = this.q.trim().toLocaleLowerCase('es');
    return filas.filter(x => {
      const p = x.p;
      if (this.filtro === 'proxima' && !x.proxima) return false;
      if (this.filtro === 'sin_cita' && x.proxima) return false;
      if (this.filtro === 'activos' && x.estado !== 'Activo') return false;
      if (this.filtro === 'alta' && x.estado !== 'Alta') return false;
      if (this.filtro === 'abandono' && x.estado !== 'Abandono') return false;
      if (this.filtro === 'alertas' && !x.alerta) return false;
      return !q || [p.nombre, p.doc, p.tel, p.email].some(v => String(v || '').toLocaleLowerCase('es').includes(q));
    }).sort((a, b) => this.orden === 'proxima'
      ? ((a.proxima && a.proxima.fecha + (a.proxima.hora || '') || '9999').localeCompare(b.proxima && b.proxima.fecha + (b.proxima.hora || '') || '9999') || a.p.nombre.localeCompare(b.p.nombre))
      : this.orden === 'reciente'
        ? (String(b.p.fecha_alta || '').localeCompare(String(a.p.fecha_alta || '')) || a.p.nombre.localeCompare(b.p.nombre))
        : a.p.nombre.localeCompare(b.p.nombre));
  },
  buscar(v) { this.q = v; this.lista($('view')); const q = $('qi'); q.focus(); q.setSelectionRange(v.length, v.length); },
  verFiltro(filtro) { this.filtro = filtro; this.lista($('view')); },
  ordenar(orden) { this.orden = orden; this.lista($('view')); },
  fechaProxima(s) {
    if (!s) return '<span class="mu">Sin cita programada</span>';
    const f = new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });
    return `<b>${esc(f)}</b>${s.hora ? `<br><span class="mu">${esc(s.hora)}</span>` : ''}`;
  },
  lista(el) {
    const filas = this.filas(), l = this.aplicarFiltro(filas), clinico = App.clinico();
    const filtros = clinico
      ? [['todos', 'Todos'], ['proxima', 'Próxima cita'], ['activos', 'Activos'], ['alta', 'Alta'], ['abandono', 'Abandono'], ['alertas', 'Con alertas'], ['sin_cita', 'Sin próxima cita']]
      : [['todos', 'Todos'], ['proxima', 'Próxima cita'], ['sin_cita', 'Sin próxima cita']];
    const cantidad = f => f === 'todos' ? filas.length : f === 'proxima' ? filas.filter(x => x.proxima).length : f === 'sin_cita' ? filas.filter(x => !x.proxima).length : f === 'activos' ? filas.filter(x => x.estado === 'Activo').length : f === 'alta' ? filas.filter(x => x.estado === 'Alta').length : f === 'abandono' ? filas.filter(x => x.estado === 'Abandono').length : filas.filter(x => x.alerta).length;
    el.innerHTML = `<div class="card"><div class="row"><input id="qi" type="search" style="max-width:360px" aria-label="Buscar pacientes" placeholder="Buscar nombre, DNI, teléfono o correo" value="${esc(this.q)}" oninput="Pacientes.buscar(this.value)"><span><button onclick="Exportar.panel('pacientes')">⬇ Exportar</button> <button class="pri" onclick="Pacientes.form()">+ Nuevo paciente</button></span></div>
      <div class="patient-tabs" role="group" aria-label="Filtrar pacientes">${filtros.map(([id, nombre]) => `<button class="${this.filtro === id ? 'pri' : ''}" aria-pressed="${this.filtro === id}" onclick="Pacientes.verFiltro('${id}')">${nombre} <span class="badge">${cantidad(id)}</span></button>`).join('')}</div>
      <div class="patient-sort"><label for="pa_orden">Ordenar por</label><select id="pa_orden" onchange="Pacientes.ordenar(this.value)"><option value="nombre" ${this.orden === 'nombre' ? 'selected' : ''}>Nombre (A–Z)</option><option value="proxima" ${this.orden === 'proxima' ? 'selected' : ''}>Próxima cita</option><option value="reciente" ${this.orden === 'reciente' ? 'selected' : ''}>Registro reciente</option></select><span class="mu">${l.length} de ${filas.length} pacientes</span></div>` +
      (l.length ? `<div class="wrap"><table><tr><th>Paciente</th><th>DNI</th><th>Teléfono</th><th>Sesiones</th><th>Próxima cita</th>${clinico ? '<th>Estado</th>' : ''}</tr>` +
        l.map(x => { const p = x.p; return `<tr style="cursor:pointer" onclick="App.go('pacientes','${p.id}')"><td><strong>${esc(p.nombre)}</strong>${clinico && x.riesgo.activa ? ' <span title="Alerta de riesgo suicida activa">🚩</span>' : ''}${clinico && x.medicion.hayAlgo ? ' <span title="Aviso de medición de resultados">🔔</span>' : ''}</td><td>${esc(p.doc)}</td><td>${esc(p.tel)}</td><td>${x.total}</td><td>${this.fechaProxima(x.proxima)}</td>${clinico ? `<td>${Cierre.badge(p.id)}</td>` : ''}</tr>`; }).join('') + `</table></div>` : `<p class="mu">${filas.length ? 'No hay pacientes que coincidan con esta búsqueda.' : 'Aún no hay pacientes.'}</p>`) + `</div>`;
  },
  detalle(el, id) {
    const p = this.repo.get(id); if (!p) return App.go('pacientes');
    const ses = Sesiones.repo.all().filter(s => s.pid === id).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const clinico = App.clinico(), tabs = this.pestanasFicha(), activa = tabs.some(([k]) => k === this.fichaTabs[id]) ? this.fichaTabs[id] : 'resumen';
    const proximas = ses.filter(s => s.estado === 'Programada' && s.fecha >= today()).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || ''))), ultima = ses.filter(s => s.estado === 'Atendida').sort((a, b) => (b.fecha + (b.hora || '')).localeCompare(a.fecha + (a.hora || '')))[0], cuenta = Cuenta.calc(id);
    const saldo = cuenta.saldo > 0.004 ? 'Debe ' + Pagos.fmt(cuenta.saldo) : cuenta.saldo < -0.004 ? 'A favor ' + Pagos.fmt(-cuenta.saldo) : 'Al día', fechaCorta = f => { if (!f) return '—'; const d = new Date(f + 'T12:00:00'); return Number.isNaN(d.getTime()) ? f : d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }); };
    let contenido;
    if (activa === 'resumen') contenido = `<section class="card ficha-contenido"><div class="grid ficha-indicadores"><div class="stat"><b>${ses.length}</b><span>Sesiones registradas</span></div><div class="stat"><b>${esc(fechaCorta(proximas[0] && proximas[0].fecha))}</b><span>Próxima sesión${proximas[0] && proximas[0].hora ? ' · ' + esc(proximas[0].hora) : ''}</span></div><div class="stat"><b>${esc(fechaCorta(ultima && ultima.fecha))}</b><span>Última sesión atendida</span></div><div class="stat"><b>${esc(saldo)}</b><span>Cuenta actual</span></div></div><div class="row ficha-proxima"><span>${proximas[0] ? `<b>${esc(proximas[0].tipo || 'Sesión')}</b> · ${esc(fechaCorta(proximas[0].fecha))} ${esc(proximas[0].hora || '')}` : 'No hay sesiones futuras programadas.'}</span><button onclick="Pacientes.cambiarPestana('${id}','sesiones')">Ver agenda del paciente</button></div><div class="ficha-acciones"><strong>Acciones rápidas</strong><div><button class="pri" onclick="Sesiones.form('${id}')">+ Programar sesión</button><button onclick="Pagos.form('${id}')">+ Registrar cobro</button>${clinico ? `<button onclick="Plan.form('${id}')">+ Objetivo</button><button onclick="Tests.form('${id}','phq')">+ PHQ-9</button><button onclick="Tareas.form('${id}')">+ Tarea</button><button onclick="Riesgo.form('${id}')">+ Evaluación de riesgo</button>` : ''}</div></div></section>`;
    else if (activa === 'historia') contenido = `<section class="card ficha-contenido"><h3>Ficha clínica</h3>${this.vista(p)}</section>`;
    else if (activa === 'historial') contenido = Historial.card(id);
    else if (activa === 'sesiones') {
      const filtro = this.filtroSesiones[id] || 'todas', opciones = [['todas','Todas',ses.length],['proximas','Próximas',proximas.length],['atendidas','Atendidas',ses.filter(s => s.estado === 'Atendida').length],['canceladas','Canceladas',ses.filter(s => s.estado === 'Cancelada').length],['inasistencias','No asistió',ses.filter(s => s.estado === 'No asistió').length]];
      const filtradas = ses.filter(s => filtro === 'todas' || filtro === 'proximas' && s.estado === 'Programada' && s.fecha >= today() || filtro === 'atendidas' && s.estado === 'Atendida' || filtro === 'canceladas' && s.estado === 'Cancelada' || filtro === 'inasistencias' && s.estado === 'No asistió');
      contenido = `<section class="card ficha-contenido"><div class="row"><strong>Sesiones del paciente</strong><span><button onclick="Agenda.exportar()">⬇ Calendario</button> <button onclick="Pagos.form('${id}')">+ Cobro</button> <button class="pri" onclick="Sesiones.ciclo('${id}')">+ Ciclo</button> <button onclick="Sesiones.form('${id}')">+ Sesión</button></span></div><div class="ficha-filtro-sesiones"><label for="ficha-sesiones-filtro">Mostrar</label><select id="ficha-sesiones-filtro" onchange="Pacientes.filtrarSesiones('${id}',this.value)">${opciones.map(([k,n,total]) => `<option value="${k}" ${k === filtro ? 'selected' : ''}>${n} (${total})</option>`).join('')}</select><span class="mu">${filtradas.length} de ${ses.length} sesiones</span></div>${Sesiones.tabla(filtradas, false)}</section>`;
    }
    else if (activa === 'avance') contenido = Plan.card(id) + Tareas.card(id) + Tests.card(id) + Medicion.card(id) + Cierre.card(id);
    else if (activa === 'medicacion') contenido = Medicamentos.card(id);
    else if (activa === 'clinico') contenido = Riesgo.card(id) + Consent.card(id);
    else if (activa === 'documentos') contenido = Adjuntos.card(id);
    else contenido = Cuenta.card(id);
    el.innerHTML = `<p><a href="#" onclick="App.go('pacientes');return false">← Pacientes</a></p>${Riesgo.banner(id)}${Medicion.banner(id)}
      <div class="card ficha-cabecera"><div class="row"><h2 id="ficha-titulo" style="margin:0">${esc(p.nombre)} ${clinico ? Cierre.badge(id) : ''}</h2><span>${clinico ? `<button onclick="Reportes.historia('${id}')">Imprimir historia</button> ` : ''}<button onclick="Pacientes.form('${id}')">Editar</button>${App.puedeBorrar('pacientes') ? ` <button class="del" onclick="Pacientes.eliminar('${id}')">Eliminar</button>` : ''}</span></div></div>
      <div class="ficha-pestanas" role="tablist" aria-label="Secciones de la ficha de ${esc(p.nombre)}">${tabs.map(([k, label]) => `<button id="ficha-tab-${k}" type="button" role="tab" aria-controls="ficha-panel" aria-selected="${activa === k}" tabindex="${activa === k ? '0' : '-1'}" onclick="Pacientes.cambiarPestana('${id}','${k}')" onkeydown="Pacientes.tecladoPestana('${id}','${k}',event)">${label}</button>`).join('')}</div>
      <section id="ficha-panel" class="ficha-panel" role="tabpanel" aria-labelledby="ficha-tab-${activa}">${contenido}</section>`;
  },
  gruposFormulario() {
    const grupos = []; let grupo = { titulo: 'Datos personales', campos: [] };
    this.cv().forEach(([k, label, tipo]) => {
      if (tipo === 'h') {
        if (grupo.campos.length) grupos.push(grupo);
        grupo = { titulo: label, campos: [] };
      } else if (tipo !== 'c') grupo.campos.push([k, label, tipo]);
    });
    if (grupo.campos.length) grupos.push(grupo);
    return grupos;
  },
  mostrarPasoFormulario(indice, enfocar = false) {
    const modal = $('dlg'), tabs = [...modal.querySelectorAll('[data-ficha-form-tab]')], panels = [...modal.querySelectorAll('[data-ficha-form-panel]')];
    indice = Math.max(0, Math.min(indice, tabs.length - 1));
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === indice)); tab.tabIndex = i === indice ? 0 : -1; panels[i].hidden = i !== indice; });
    $('ficha-form-anterior').disabled = indice === 0; $('ficha-form-siguiente').disabled = indice === tabs.length - 1;
    if (enfocar) tabs[indice].focus();
  },
  moverPasoFormulario(paso) {
    const tabs = [...$('dlg').querySelectorAll('[data-ficha-form-tab]')], indice = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true');
    this.mostrarPasoFormulario(indice + paso, true);
  },
  teclaPasoFormulario(indice, e) {
    const tabs = [...$('dlg').querySelectorAll('[data-ficha-form-tab]')];
    const siguiente = e.key === 'ArrowRight' ? (indice + 1) % tabs.length : e.key === 'ArrowLeft' ? (indice + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (siguiente < 0) return;
    e.preventDefault(); this.mostrarPasoFormulario(siguiente, true);
  },
  form(id) {
    const p = id ? this.repo.get(id) : {};
    const grupos = this.gruposFormulario(), campo = ([k, label, tipo]) => {
      let input;
      if (tipo === 't') input = `<textarea id="f_${k}" rows="3">${esc(p[k])}</textarea>`;
      else if (tipo && tipo.startsWith('s:')) input = `<select id="f_${k}"><option value="">—</option>${tipo.slice(2).split('|').map(o => `<option ${o === p[k] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      else if (k === 'cie') input = `<input id="f_cie" list="cie10-sugerencias" value="${esc(p[k])}" placeholder="Ej. F41.1" autocomplete="off"><datalist id="cie10-sugerencias">${CIE10.opciones()}</datalist><a class="cie10-consulta" href="${CIE10.OMS}" target="_blank" rel="noopener">Consultar CIE-10 oficial de la OMS</a><small class="mu cie10-ayuda">Sugerencias frecuentes, no exhaustivas. Verifica el código y su denominación en la clasificación aplicable; no genera diagnósticos.</small>`;
      else input = `<input id="f_${k}" type="${tipo || 'text'}" ${tipo === 'number' ? 'min="0" step="any" ' : ''}value="${esc(p[k])}">`;
      return `<div${tipo === 't' ? ' style="grid-column:1/-1"' : ''}><label for="f_${k}">${esc(label)}</label>${input}</div>`;
    };
    const tabs = grupos.map((g, i) => `<button id="ficha-form-tab-${i}" type="button" role="tab" data-ficha-form-tab aria-controls="ficha-form-panel-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? '0' : '-1'}" onclick="Pacientes.mostrarPasoFormulario(${i})" onkeydown="Pacientes.teclaPasoFormulario(${i},event)">${esc(g.titulo)}</button>`).join('');
    const panels = grupos.map((g, i) => `<section id="ficha-form-panel-${i}" class="ficha-form-panel" role="tabpanel" data-ficha-form-panel aria-labelledby="ficha-form-tab-${i}" ${i ? 'hidden' : ''}><h4>${esc(g.titulo)}</h4><div class="ficha-campos">${g.campos.map(campo).join('')}</div></section>`).join('');
    abrir(`<h3>${id ? 'Editar' : 'Nueva'} historia clínica</h3><div class="ficha-pestanas ficha-form-pestanas" role="tablist" aria-label="Secciones del formulario de paciente">${tabs}</div>${panels}<div class="row ficha-form-footer"><button onclick="cerrar()">Cancelar</button><span><button id="ficha-form-anterior" onclick="Pacientes.moverPasoFormulario(-1)">Anterior</button><button id="ficha-form-siguiente" onclick="Pacientes.moverPasoFormulario(1)">Siguiente</button><button class="pri" onclick="Pacientes.guardar('${id || ''}')">Guardar</button></span></div>`);
    this.mostrarPasoFormulario(0);
  },
  guardar(id) {
    const o = {}; this.cv().forEach(([k, l, t]) => { if (t !== 'h' && t !== 'c') o[k] = $('f_' + k).value.trim(); });
    if (!o.nombre) return alert('Ingresa el nombre');
    if (id) o.id = id;
    const r = this.repo.save(o); cerrar(); App.go('pacientes', r.id);
  },
  async eliminar(id) {
    if (!await confirmar('¿Eliminar paciente y TODA su información (sesiones, tests, consentimientos, cobros)? Quedará una copia en la papelera del servidor.', 'Eliminar paciente e historia', 'Eliminar todo', true)) return;
    Sesiones.repo.removeWhere(s => s.pid === id); Plan.repo.removeWhere(o => o.pid === id); Consent.repo.removeWhere(c => c.pid === id); Tests.repo.removeWhere(t => t.pid === id); Pagos.repo.removeWhere(g => g.pid === id); Adjuntos.repo.removeWhere(a => a.pid === id); Cierre.repo.removeWhere(c => c.pid === id); Cierre.seg.removeWhere(x => x.pid === id); Paquetes.repo.removeWhere(x => x.pid === id); Riesgo.repo.removeWhere(x => x.pid === id); Riesgo.plan.removeWhere(x => x.pid === id); Medicion.rev.removeWhere(x => x.pid === id); Medicamentos.repo.removeWhere(x => x.pid === id); this.repo.remove(id); App.go('pacientes');
  }
};
App.register({ id: 'pacientes', title: 'Pacientes', menu: true, icon: '👥', order: 2, render: (el, p) => Pacientes.render(el, p) });
