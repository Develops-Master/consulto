// Gastos operativos del consultorio, visibles solo para administración.
const Gastos = {
  repo: App.repo('gastos'),
  CATEGORIAS: ['Alquiler', 'Servicios', 'Personal', 'Impuestos', 'Materiales', 'Software', 'Marketing', 'Mantenimiento', 'Transporte', 'Otro'],
  METODOS: ['Efectivo', 'Yape/Plin', 'Tarjeta', 'Transferencia', 'Otro'],
  vista: 'movimientos', periodo: 'mes', desde: today().slice(0, 7) + '-01', hasta: today(), busqueda: '', categoria: 'Todas',
  fmt: n => 'S/ ' + Number(n || 0).toFixed(2),
  setPeriodo(p) {
    this.periodo = p;
    const hoy = today();
    this.hasta = p === 'todo' ? '' : hoy;
    if (p === 'mes') this.desde = hoy.slice(0, 7) + '-01';
    else if (p === '90') { const d = new Date(hoy + 'T12:00:00'); d.setDate(d.getDate() - 89); this.desde = d.toLocaleDateString('en-CA'); }
    else this.desde = '';
    App.render();
  },
  filtrar() {
    const q = this.busqueda.trim().toLocaleLowerCase('es');
    return this.repo.all().filter(g => (!this.desde || g.fecha >= this.desde) && (!this.hasta || g.fecha <= this.hasta) && (this.categoria === 'Todas' || g.categoria === this.categoria) && (!q || `${g.concepto} ${g.proveedor || ''} ${g.comprobante || ''} ${g.categoria}`.toLocaleLowerCase('es').includes(q))).sort((a, b) => (b.fecha + b.creado).localeCompare(a.fecha + a.creado));
  },
  buscar(q) { this.busqueda = q; this.render($('view')); const e = $('gas_buscar'); e.focus(); e.setSelectionRange(q.length, q.length); },
  cambiarFechas() { this.desde = $('gas_desde').value; this.hasta = $('gas_hasta').value; this.render($('view')); },
  tabla(lista) {
    return lista.length ? `<div class="wrap"><table><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Monto</th><th>Estado</th><th></th></tr>${lista.map(g => `<tr><td>${esc(g.fecha)}</td><td><strong>${esc(g.concepto)}</strong></td><td>${esc(g.categoria)}</td><td><b>${this.fmt(g.monto)}</b></td><td><span class="badge${g.estado === 'Pendiente' ? ' warn' : ''}">${esc(g.estado)}</span></td><td><button onclick="Gastos.detalle('${g.id}')">Ver detalle</button></td></tr>`).join('')}</table></div>` : '<p class="mu">No hay gastos en este periodo.</p>';
  },
  detalle(id) {
    const g = this.repo.get(id); if (!g) return;
    const dato = (titulo, valor) => `<div><dt>${titulo}</dt><dd>${esc(valor) || '—'}</dd></div>`;
    abrir(`<div class="expense-detail"><div class="row"><div><p class="mu" style="margin:0">${esc(g.fecha)} · ${esc(g.categoria)}</p><h3>${esc(g.concepto)}</h3></div><span class="badge${g.estado === 'Pendiente' ? ' warn' : ''}">${esc(g.estado)}</span></div><strong class="expense-detail-monto">${this.fmt(g.monto)}</strong><dl>${dato('Proveedor', g.proveedor)}${dato('Método de pago', g.metodo)}${dato('N.º de comprobante', g.comprobante)}${dato('Nota', g.nota)}</dl><div class="row" style="margin-top:16px"><button onclick="cerrar()">Cerrar</button><span><button onclick="Gastos.form('${id}')">Editar</button> <button class="del" onclick="Gastos.del('${id}')">Eliminar</button></span></div></div>`);
  },
  exportar() {
    const filas = this.filtrar(); if (!filas.length) return alert('No hay gastos para exportar');
    const datos = [['Fecha', 'Concepto', 'Categoría', 'Proveedor', 'Comprobante', 'Método', 'Estado', 'Monto', 'Nota'], ...filas.map(g => [g.fecha, g.concepto, g.categoria, g.proveedor, g.comprobante, g.metodo, g.estado, +g.monto || 0, g.nota])];
    const csv = '\ufeff' + datos.map(row => row.map(v => Exportar.cel(v)).join(',')).join('\r\n');
    Exportar.bajar(`gastos-${today()}.csv`, 'text/csv;charset=utf-8', csv); App.audit('reportes', 'exportar');
  },
  datosResumen() {
    const enPeriodo = g => (!this.desde || g.fecha >= this.desde) && (!this.hasta || g.fecha <= this.hasta);
    const pagos = Pagos.repo.all().filter(p => enPeriodo(p.fecha)), gastos = this.repo.all().filter(enPeriodo);
    const ingresos = Pagos.total(pagos), pagados = gastos.filter(g => g.estado === 'Pagado').reduce((n, g) => n + (+g.monto || 0), 0), porPagar = gastos.filter(g => g.estado === 'Pendiente').reduce((n, g) => n + (+g.monto || 0), 0);
    return { ingresos, pagados, neto: ingresos - pagados, porPagar };
  },
  form(id) {
    const g = id ? this.repo.get(id) || {} : {};
    abrir(`<h3>${id ? 'Editar gasto' : 'Registrar gasto'}</h3><div class="f2"><div><label for="gas_fecha">Fecha</label><input id="gas_fecha" type="date" value="${esc(g.fecha || today())}"></div><div><label for="gas_monto">Monto (S/)</label><input id="gas_monto" type="number" min="0.01" max="100000000" step="0.01" value="${esc(g.monto)}"></div></div>
      <label for="gas_concepto">Concepto</label><input id="gas_concepto" maxlength="160" value="${esc(g.concepto)}" placeholder="Ej. Servicio de internet del consultorio">
      <div class="f2"><div><label for="gas_categoria">Categoría</label><select id="gas_categoria">${this.CATEGORIAS.map(c => `<option ${c === (g.categoria || 'Servicios') ? 'selected' : ''}>${c}</option>`).join('')}</select></div><div><label for="gas_estado">Estado</label><select id="gas_estado"><option ${!g.estado || g.estado === 'Pagado' ? 'selected' : ''}>Pagado</option><option ${g.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option></select></div></div>
      <div class="f2"><div><label for="gas_proveedor">Proveedor (opcional)</label><input id="gas_proveedor" maxlength="120" value="${esc(g.proveedor)}"></div><div><label for="gas_metodo">Método de pago</label><select id="gas_metodo">${this.METODOS.map(m => `<option ${m === (g.metodo || 'Transferencia') ? 'selected' : ''}>${m}</option>`).join('')}</select></div></div>
      <label for="gas_comprobante">N.º de comprobante (opcional)</label><input id="gas_comprobante" maxlength="100" value="${esc(g.comprobante)}">
      <label for="gas_nota">Nota (opcional)</label><textarea id="gas_nota" maxlength="1000" rows="2">${esc(g.nota)}</textarea>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Gastos.guardar('${id || ''}')">Guardar gasto</button></div>`);
  },
  guardar(id) {
    const monto = Number($('gas_monto').value), fecha = $('gas_fecha').value;
    if (!(monto > 0) || !Number.isFinite(monto) || !fecha || !$('gas_concepto').value.trim()) return alert('Completa fecha, concepto y un monto mayor que 0');
    const gasto = { fecha, categoria: $('gas_categoria').value, concepto: $('gas_concepto').value.trim(), monto, metodo: $('gas_metodo').value, estado: $('gas_estado').value, proveedor: $('gas_proveedor').value.trim(), comprobante: $('gas_comprobante').value.trim(), nota: $('gas_nota').value.trim() };
    if (id) this.repo.save({ id, ...gasto }); else this.repo.save(gasto);
    cerrar(); App.render();
  },
  async del(id) { if (await confirmar('¿Eliminar este gasto? Quedará guardado en la papelera del servidor.', 'Eliminar gasto', 'Eliminar', true)) { cerrar(); this.repo.remove(id); App.render(); } },
  render(el) {
    const gastos = this.filtrar(), tabs = [['movimientos','Movimientos'],['pendientes','Por pagar']];
    const tab = ([id, label]) => `<button class="${this.vista === id ? 'pri' : ''}" aria-pressed="${this.vista === id}" onclick="Gastos.ver('${id}')">${label}${id === 'pendientes' ? ` <span class="badge">${this.repo.all().filter(g => g.estado === 'Pendiente').length}</span>` : ''}</button>`;
    const lista = this.vista === 'pendientes' ? gastos.filter(g => g.estado === 'Pendiente') : gastos;
    const d = this.datosResumen(), kpi = (valor, label) => `<div class="stat"><b>${valor}</b><span>${label}</span></div>`;
    const rango = this.periodo === 'mes' ? 'Este mes' : this.periodo === '90' ? 'Últimos 90 días' : 'Todo el historial';
    const resumen = `<section class="expense-summary-inline" aria-label="Resumen del periodo"><div class="row"><div><strong>Resumen del periodo</strong><p class="mu" style="margin:2px 0 0">${rango} · ${esc(this.desde || 'Inicio')} a ${esc(this.hasta || 'Hoy')}</p></div><div class="expense-period"><label for="gas_periodo">Periodo</label><select id="gas_periodo" onchange="Gastos.setPeriodo(this.value)"><option value="mes" ${this.periodo === 'mes' ? 'selected' : ''}>Este mes</option><option value="90" ${this.periodo === '90' ? 'selected' : ''}>Últimos 90 días</option><option value="todo" ${this.periodo === 'todo' ? 'selected' : ''}>Todo el historial</option></select></div></div><div class="expense-kpis">${kpi(this.fmt(d.ingresos), 'Ingresos registrados')}${kpi(this.fmt(d.pagados), 'Gastos pagados')}${kpi(this.fmt(d.neto), 'Neto de caja')}${kpi(this.fmt(d.porPagar), 'Pendiente de pago')}</div><p class="mu">Estimación de caja; no reemplaza la contabilidad tributaria.</p></section>`;
    const contenido = `<div class="expense-filters"><div><label for="gas_buscar">Buscar gasto</label><input id="gas_buscar" type="search" aria-label="Buscar gasto" placeholder="Concepto, proveedor o comprobante" value="${esc(this.busqueda)}" oninput="Gastos.buscar(this.value)"></div><div><label for="gas_categoria_f">Categoría</label><select id="gas_categoria_f" onchange="Gastos.categoria=this.value;App.render()"><option ${this.categoria === 'Todas' ? 'selected' : ''}>Todas</option>${this.CATEGORIAS.map(c => `<option ${this.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div><div><label for="gas_desde">Desde</label><input id="gas_desde" type="date" value="${esc(this.desde)}" onchange="Gastos.cambiarFechas()"></div><div><label for="gas_hasta">Hasta</label><input id="gas_hasta" type="date" value="${esc(this.hasta)}" onchange="Gastos.cambiarFechas()"></div></div><div class="row"><span class="mu">${lista.length} gasto(s)</span><span><button onclick="Gastos.exportar()">⬇ CSV</button></span></div>${this.tabla(lista)}`;
    el.innerHTML = resumen + `<div class="card"><div class="row"><strong>Gastos del consultorio</strong><span><button onclick="Gastos.exportar()">⬇ CSV</button> <button class="pri" onclick="Gastos.form()">+ Registrar gasto</button></span></div><div class="expense-tabs" role="group" aria-label="Vistas de gastos">${tabs.map(tab).join(' ')}</div>${contenido}</div>`;
  },
  buscar(q) { this.busqueda = q; this.render($('view')); const e = $('gas_buscar'); if (e) { e.focus(); e.setSelectionRange(q.length, q.length); } },
  ver(vista) { this.vista = vista; App.render(); }
};
App.register({ id: 'gastos', title: 'Gastos', menu: true, icon: '🧾', order: 5.5, render: el => Gastos.render(el) });