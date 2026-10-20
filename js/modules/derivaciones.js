// Seguimiento agregado de las fuentes de derivación registradas en la ficha.
const Derivaciones = {
  desde: '', hasta: today(), busqueda: '', fuente: 'Todas', _fuentes: [],
  normalizar: texto => String(texto || '').trim().replace(/\s+/g, ' ') || 'Sin registrar',
  pacientes() {
    return Pacientes.repo.all().filter(p => (!this.desde || p.fecha_alta >= this.desde) && (!this.hasta || p.fecha_alta <= this.hasta));
  },
  grupos() {
    const grupos = new Map();
    for (const p of this.pacientes()) {
      const fuente = this.normalizar(p.deriv), clave = fuente.toLocaleLowerCase('es'), estado = Cierre.estado(p.id);
      const g = grupos.get(clave) || { fuente, total: 0, activos: 0, altas: 0, abandonos: 0 };
      g.total++;
      if (estado === 'Activo') g.activos++;
      else if (estado === 'Alta') g.altas++;
      else if (estado === 'Abandono') g.abandonos++;
      grupos.set(clave, g);
    }
    return [...grupos.values()].sort((a, b) => b.total - a.total || a.fuente.localeCompare(b.fuente, 'es'));
  },
  cambiarFechas() {
    const desde = $('der_desde').value, hasta = $('der_hasta').value;
    if (desde && hasta && desde > hasta) { App.aviso('La fecha inicial no puede ser posterior a la fecha final.', 'warning'); return App.render(); }
    this.desde = desde; this.hasta = hasta; App.render();
  },
  buscar(texto) { this.busqueda = texto; App.render(); const e = $('der_buscar'); e.focus(); e.setSelectionRange(texto.length, texto.length); },
  verFuente(indice) { this.fuente = this._fuentes[indice] || 'Todas'; App.render(); },
  exportar() {
    const grupos = this.grupos(); if (!grupos.length) return alert('No hay pacientes en este periodo');
    const filas = [['Origen', 'Pacientes', 'Activos', 'Alta', 'Abandono'], ...grupos.map(g => [g.fuente, g.total, g.activos, g.altas, g.abandonos])];
    const csv = '\ufeff' + filas.map(f => f.map(Exportar.cel).join(',')).join('\r\n');
    Exportar.bajar(`derivaciones-${today()}.csv`, 'text/csv;charset=utf-8', csv); App.audit('reportes', 'exportar');
  },
  render(el) {
    const pacientes = this.pacientes(), grupos = this.grupos(), q = this.busqueda.trim().toLocaleLowerCase('es');
    const filtrados = grupos.filter(g => (this.fuente === 'Todas' || g.fuente === this.fuente) && (!q || g.fuente.toLocaleLowerCase('es').includes(q)));
    const conFuente = pacientes.filter(p => this.normalizar(p.deriv) !== 'Sin registrar').length;
    const activas = pacientes.filter(p => Cierre.estado(p.id) === 'Activo').length;
    const kpi = (n, texto) => `<div class="stat"><b>${n}</b><span>${texto}</span></div>`;
    this._fuentes = filtrados.map(g => g.fuente);
    const suma = Math.max(1, pacientes.length);
    const filas = filtrados.map((g, i) => `<tr><td><b>${esc(g.fuente)}</b></td><td>${g.total}</td><td>${g.activos}</td><td>${g.altas}</td><td>${g.abandonos}</td><td>${Math.round(g.total / suma * 100)}%</td><td><button onclick="Derivaciones.verFuente(${i})">Ver pacientes</button></td></tr>`).join('');
    const detalle = this.fuente === 'Todas' ? '' : (() => {
      const lista = pacientes.filter(p => this.normalizar(p.deriv) === this.fuente).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      return `<div class="row deriv-detalle"><strong>Pacientes · ${esc(this.fuente)}</strong><button onclick="Derivaciones.verFuente(-1)">Ver todos los orígenes</button></div>${lista.length ? `<div class="wrap"><table><tr><th>Paciente</th><th>Registro</th><th>Tratamiento</th></tr>${lista.map(p => `<tr><td><a href="#" onclick="App.go('pacientes','${p.id}');return false">${esc(p.nombre)}</a></td><td>${esc(p.fecha_alta || '—')}</td><td>${esc(Cierre.estado(p.id))}</td></tr>`).join('')}</table></div>` : '<p class="mu">No hay pacientes para este origen en el periodo.</p>'}`;
    })();
    el.innerHTML = `<div class="grid deriv-kpis">${kpi(pacientes.length, 'Pacientes en el periodo')}${kpi(conFuente, 'Con origen registrado')}${kpi(grupos.filter(g => g.fuente !== 'Sin registrar').length, 'Orígenes distintos')}${kpi(activas, 'Tratamientos activos')}</div>
      <div class="card"><div class="row"><strong>Origen de pacientes y derivaciones</strong><button onclick="Derivaciones.exportar()" title="Exportar resumen agregado">⬇ CSV</button></div>
      <p class="mu">Resumen administrativo por periodo de registro. No incluye motivo de consulta ni notas clínicas.</p>
      <div class="deriv-filtros"><div><label for="der_desde">Desde</label><input id="der_desde" type="date" value="${esc(this.desde)}" onchange="Derivaciones.cambiarFechas()"></div><div><label for="der_hasta">Hasta</label><input id="der_hasta" type="date" value="${esc(this.hasta)}" onchange="Derivaciones.cambiarFechas()"></div><div><label for="der_buscar">Buscar origen</label><input id="der_buscar" type="search" value="${esc(this.busqueda)}" placeholder="Profesional, centro o campaña" oninput="Derivaciones.buscar(this.value)"></div></div>
      <div class="row"><span class="mu">${conFuente} de ${pacientes.length} pacientes tienen origen registrado</span></div>
      ${filtrados.length ? `<div class="wrap"><table><tr><th>Origen</th><th>Pacientes</th><th>Activos</th><th>Alta</th><th>Abandono</th><th>Participación</th><th></th></tr>${filas}</table></div>` : '<p class="mu">No hay pacientes que coincidan con los filtros.</p>'}${detalle}</div>`;
  }
};
App.register({ id: 'derivaciones', title: 'Derivaciones', menu: true, icon: '↗', order: 6.5, render: el => Derivaciones.render(el) });