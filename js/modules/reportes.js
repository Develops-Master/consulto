// Módulo Reportes: documentos imprimibles (Imprimir > Guardar como PDF)
const Reportes = {
  vista: 'documentos',
  finDesde: today().slice(0, 7) + '-01', finHasta: today(),
  imprimir(html) { $('prt').innerHTML = `<div class="rep">${html}</div>`; window.print(); },
  ver(vista) { this.vista = vista; App.render(); },
  historia(id) {
    const p = Pacientes.repo.get(id); if (!p) return; App.audit('reportes', 'imprimir historia', id, id);
    const f = (l, v) => `<p><b>${l}:</b> ${esc(v) || '—'}</p>`;
    const ses = Sesiones.repo.all().filter(s => s.pid === id).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const medicamentos = Medicamentos.lista(id), listaMedicamentos = `<h2>Medicación registrada</h2>` + (medicamentos.length ? `<table><tr><th>Medicamento</th><th>Origen / profesional</th><th>Pauta transcrita</th><th>Periodo / estado</th><th>Observación</th></tr>${medicamentos.map(m => `<tr><td>${esc(m.medicamento)}</td><td>${esc(m.fuente)}${m.prescriptor ? '<br>' + esc(m.prescriptor) : ''}</td><td>${esc(m.dosis)}${m.frecuencia ? '<br>' + esc(m.frecuencia) : ''}</td><td>${esc(m.fecha_inicio)}${m.fecha_fin ? ' a ' + esc(m.fecha_fin) : ''}<br>${esc(m.estado)}</td><td>${esc(m.observacion)}</td></tr>`).join('')}</table>` : '<p>Sin registros estructurados.</p>');
    this.imprimir(`<h1>Historia clínica</h1><p>Emitida el ${today()}</p><h2>${esc(p.nombre)}</h2>
      ${Pacientes.vistaImpresion(p)}
      <p><b>Consentimiento informado:</b> ${(c => c ? `Firmado el ${esc(c.fecha)} por ${esc(c.firmante)}` : 'No registrado')(Consent.ultimo(id))}</p><h2>Plan de tratamiento</h2>${Plan.repo.all().filter(o => o.pid === id).map(o => `<p>• ${esc(o.texto)} (${esc(o.meta)}) — ${esc(o.estado)}</p>`).join('') || '<p>Sin objetivos.</p>'}${Tests.imprimir(id)}${Riesgo.imprimir(id)}${listaMedicamentos}<h2>Estado del tratamiento</h2><p>${Cierre.estado(id)}</p>${Adjuntos.lista(id).length ? '<h2>Documentos adjuntos</h2>' + Adjuntos.lista(id).map(a => `<p>• ${esc(a.fecha)} · ${esc(a.tipo)} · ${esc(a.nombre)}</p>`).join('') : ''}<h2>Seguimiento de atención</h2>` + (ses.length ? `<table><tr><th>Fecha</th><th>Estado</th><th>Malestar</th><th>Evolución (SOAP)</th></tr>` +
      ses.map(s => `<tr><td>${esc(s.fecha)} ${esc(s.hora || '')}<br>${s.n ? 'Sesión ' + s.n + ' · ' : ''}${esc(s.tipo || '')} (${esc(s.modalidad || 'Presencial')})${s.tema || s.zona ? '<br><b>' + esc(s.tema || s.zona) + '</b>' : ''}</td><td>${esc(s.estado)}</td><td>${s.eva ?? ''}</td><td>${s.soap ? ['s', 'o', 'a', 'p'].map(k => `<b>${k.toUpperCase()}:</b> ${esc(s.soap[k])}`).join('<br>') : esc(s.nota)}</td></tr>`).join('') + '</table>' : '<p>Sin sesiones registradas.</p>'));
  },
  caja(fecha) {
    if (!fecha) return alert('Elige una fecha');
    const pg = Pagos.repo.all().filter(p => p.fecha === fecha), ses = Sesiones.repo.all().filter(s => s.fecha === fecha), cobros = pg.filter(p => p.movimiento !== 'Devolución'), devoluciones = pg.filter(p => p.movimiento === 'Devolución');
    const por = Pagos.METODOS.map(m => `<tr><td>${m}</td><td>${Pagos.fmt(Pagos.total(pg.filter(p => p.metodo === m)))}</td></tr>`).join('');
    this.imprimir(`<h1>Cierre de caja</h1><h2>${esc(fecha)}</h2>
      <p>Pacientes atendidos: <b>${ses.filter(s => s.estado === 'Atendida').length}</b> de ${ses.length} sesiones programadas</p>
      <h2>Cobros y devoluciones</h2>` + (pg.length ? `<table><tr><th>Paciente</th><th>Movimiento</th><th>Concepto</th><th>Método</th><th>Monto</th></tr>` +
      pg.map(p => `<tr><td>${esc((Pacientes.repo.get(p.pid) || {}).nombre || '—')}</td><td>${p.movimiento === 'Devolución' ? 'Devolución' : 'Cobro'}</td><td>${esc(p.concepto)}</td><td>${esc(p.metodo)}</td><td>${Pagos.fmt(p.monto)}</td></tr>`).join('') + '</table>' : '<p>Sin movimientos.</p>') +
      `<h2>Totales por método</h2><table>${por}<tr><th>Cobros</th><th>${Pagos.fmt(Pagos.total(cobros))}</th></tr><tr><th>Devoluciones</th><th>${Pagos.fmt(Pagos.total(devoluciones))}</th></tr><tr><th>Neto del día</th><th>${Pagos.fmt(Pagos.total(pg))}</th></tr></table>`);
  },
  cambiarFinanzas() {
    const desde = $('fin_desde').value, hasta = $('fin_hasta').value;
    if (desde && hasta && desde > hasta) { App.aviso('La fecha inicial no puede ser posterior a la fecha final.', 'warning'); return App.render(); }
    this.finDesde = desde; this.finHasta = hasta; App.render();
  },
  finanzasDatos() {
    const enPeriodo = fecha => (!this.finDesde || fecha >= this.finDesde) && (!this.finHasta || fecha <= this.finHasta);
    const movs = Pagos.repo.all().filter(p => enPeriodo(p.fecha)).sort((a, b) => (a.fecha + (a.creado || '')).localeCompare(b.fecha + (b.creado || '')));
    const cobros = movs.filter(p => p.movimiento !== 'Devolución'), devoluciones = movs.filter(p => p.movimiento === 'Devolución');
    const bruto = Pagos.total(cobros), devuelto = devoluciones.reduce((n, p) => n + Math.abs(+p.monto || 0), 0), neto = Pagos.total(movs);
    const metodos = new Map(), meses = new Map();
    for (const p of movs) {
      const metodo = p.metodo || 'Sin método', monto = +p.monto || 0, m = metodos.get(metodo) || { bruto: 0, devuelto: 0, neto: 0 };
      if (p.movimiento === 'Devolución') m.devuelto += Math.abs(monto); else m.bruto += monto;
      m.neto += monto; metodos.set(metodo, m);
      const mes = (p.fecha || '').slice(0, 7), v = meses.get(mes) || { bruto: 0, devuelto: 0, neto: 0 };
      if (p.movimiento === 'Devolución') v.devuelto += Math.abs(monto); else v.bruto += monto;
      v.neto += monto; meses.set(mes, v);
    }
    const admin = App.permisos.leer.includes('gastos'), gastos = admin ? Gastos.repo.all().filter(g => enPeriodo(g.fecha)) : [];
    const gastosPagados = gastos.filter(g => g.estado === 'Pagado'), pendientes = gastos.filter(g => g.estado === 'Pendiente');
    const gastoTotal = lista => lista.reduce((n, g) => n + (+g.monto || 0), 0), categorias = new Map();
    gastosPagados.forEach(g => categorias.set(g.categoria || 'Otro', (categorias.get(g.categoria || 'Otro') || 0) + (+g.monto || 0)));
    for (const g of gastos) {
      const mes = (g.fecha || '').slice(0, 7), v = meses.get(mes) || { bruto: 0, devuelto: 0, neto: 0, gastosPagados: 0, gastosPendientes: 0 };
      if (g.estado === 'Pagado') v.gastosPagados += +g.monto || 0;
      else if (g.estado === 'Pendiente') v.gastosPendientes += +g.monto || 0;
      meses.set(mes, v);
    }
    return { movs, cobros, devoluciones, bruto, devuelto, neto, metodos, meses, admin, gastos, gastosPagados: gastoTotal(gastosPagados), gastosPendientes: gastoTotal(pendientes), categorias };
  },
  exportarFinanzas() {
    const d = this.finanzasDatos(); if (!d.movs.length && !d.gastos.length) return alert('No hay datos para exportar en este periodo');
    const filas = [['Fecha', 'Tipo', 'Estado', 'Paciente', 'Concepto', 'Método', 'Ingreso', 'Egreso pagado', 'Egreso pendiente', 'Neto caja']];
    d.movs.forEach(p => {
      const importe = +p.monto || 0, devolucion = p.movimiento === 'Devolución';
      filas.push([p.fecha, p.movimiento || 'Cobro', 'Registrado', (Pacientes.repo.get(p.pid) || {}).nombre || '', p.concepto || '', p.metodo || '', devolucion ? 0 : importe, devolucion ? Math.abs(importe) : 0, 0, importe]);
    });
    d.gastos.forEach(g => {
      const importe = Math.abs(+g.monto || 0), pagado = g.estado === 'Pagado';
      filas.push([g.fecha, 'Gasto', g.estado || 'Pendiente', '', g.concepto, g.metodo, 0, pagado ? importe : 0, pagado ? 0 : importe, pagado ? -importe : 0]);
    });
    const csv = '\ufeff' + filas.map(f => f.map(v => Exportar.cel(v)).join(',')).join('\r\n');
    Exportar.bajar(`finanzas-${this.finDesde || 'inicio'}-${this.finHasta || 'hoy'}.csv`, 'text/csv;charset=utf-8', csv); App.audit('reportes', 'exportar');
  },
  imprimirFinanzas() {
    const d = this.finanzasDatos(), desde = this.finDesde || 'Todo', hasta = this.finHasta || 'Hoy';
    const mensual = [...d.meses].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, v]) => `<tr><td>${esc(mes)}</td><td>${Pagos.fmt(v.bruto)}</td><td>${Pagos.fmt(v.devuelto)}</td><td>${Pagos.fmt(v.neto)}</td>${d.admin ? `<td>${Pagos.fmt(v.gastosPagados || 0)}</td><td>${Pagos.fmt(v.gastosPendientes || 0)}</td><td>${Pagos.fmt(v.neto - (v.gastosPagados || 0))}</td>` : ''}</tr>`).join('');
    this.imprimir(`<h1>Reporte financiero</h1><p>Periodo: ${esc(desde)} a ${esc(hasta)}</p><h2>Ingresos</h2><table><tr><th>Cobros brutos</th><th>Devoluciones</th><th>Neto</th><th>Movimientos</th></tr><tr><td>${Pagos.fmt(d.bruto)}</td><td>${Pagos.fmt(d.devuelto)}</td><td>${Pagos.fmt(d.neto)}</td><td>${d.movs.length}</td></tr></table><h2>Resumen mensual</h2>${mensual ? `<table><tr><th>Mes</th><th>Cobros</th><th>Devoluciones</th><th>Neto</th>${d.admin ? '<th>Gastos pagados</th><th>Pendientes</th><th>Neto operativo</th>' : ''}</tr>${mensual}</table>` : '<p>Sin movimientos ni gastos en el periodo.</p>'}<h2>Movimientos</h2>${d.movs.length ? `<table><tr><th>Fecha</th><th>Paciente</th><th>Movimiento</th><th>Concepto</th><th>Método</th><th>Monto</th></tr>${d.movs.map(p => `<tr><td>${esc(p.fecha)}</td><td>${esc((Pacientes.repo.get(p.pid) || {}).nombre || '—')}</td><td>${esc(p.movimiento || 'Cobro')}</td><td>${esc(p.concepto)}</td><td>${esc(p.metodo)}</td><td>${Pagos.fmt(p.monto)}</td></tr>`).join('')}</table>` : '<p>Sin movimientos en el periodo.</p>'}${d.admin ? `<h2>Gastos</h2><p>Pagados: ${Pagos.fmt(d.gastosPagados)} · Pendientes: ${Pagos.fmt(d.gastosPendientes)} · Neto después de gastos pagados: ${Pagos.fmt(d.neto - d.gastosPagados)}</p>` : ''}`);
    App.audit('reportes', 'imprimir caja');
  },
  vistaFinanzas() {
    const d = this.finanzasDatos(), kpi = (v, label) => `<div class="stat"><b>${v}</b><span>${label}</span></div>`;
    const metodos = [...d.metodos].sort((a, b) => b[1].neto - a[1].neto).map(([metodo, v]) => `<tr><td>${esc(metodo)}</td><td>${Pagos.fmt(v.bruto)}</td><td>${Pagos.fmt(v.devuelto)}</td><td><b>${Pagos.fmt(v.neto)}</b></td></tr>`).join('');
    const meses = [...d.meses].sort((a, b) => b[0].localeCompare(a[0])).map(([mes, v]) => `<tr><td>${esc(mes)}</td><td>${Pagos.fmt(v.bruto)}</td><td>${Pagos.fmt(v.devuelto)}</td><td><b>${Pagos.fmt(v.neto)}</b></td>${d.admin ? `<td>${Pagos.fmt(v.gastosPagados || 0)}</td><td>${Pagos.fmt(v.gastosPendientes || 0)}</td><td><b>${Pagos.fmt(v.neto - (v.gastosPagados || 0))}</b></td>` : ''}</tr>`).join('');
    const cats = [...d.categorias].sort((a, b) => b[1] - a[1]).map(([categoria, monto]) => `<tr><td>${esc(categoria)}</td><td>${Pagos.fmt(monto)}</td></tr>`).join('');
    const deuda = Pagos.deudas().reduce((n, x) => n + x.c.saldo, 0);
    return `<div class="f2"><div><label for="fin_desde">Desde</label><input id="fin_desde" type="date" value="${esc(this.finDesde)}" onchange="Reportes.cambiarFinanzas()"></div><div><label for="fin_hasta">Hasta</label><input id="fin_hasta" type="date" value="${esc(this.finHasta)}" onchange="Reportes.cambiarFinanzas()"></div></div><div class="row"><span class="mu">Los saldos pendientes son actuales y no dependen del periodo seleccionado.</span><span><button onclick="Reportes.imprimirFinanzas()" title="Imprimir reporte">Imprimir</button> <button onclick="Reportes.exportarFinanzas()" title="Descargar CSV">⬇ CSV</button></span></div>
      <div class="expense-kpis">${kpi(Pagos.fmt(d.bruto), 'Cobros brutos')}${kpi(Pagos.fmt(d.devuelto), 'Devoluciones')}${kpi(Pagos.fmt(d.neto), 'Ingreso neto del periodo')}${kpi(Pagos.fmt(deuda), 'Saldo pendiente actual')}</div>
      <div class="expense-summary"><section><h3>Por método de pago</h3>${metodos ? `<div class="wrap"><table><tr><th>Método</th><th>Cobros</th><th>Devoluciones</th><th>Neto</th></tr>${metodos}</table></div>` : '<p class="mu">Sin movimientos en el periodo.</p>'}</section><section><h3>Por mes</h3>${meses ? `<div class="wrap"><table><tr><th>Mes</th><th>Cobros</th><th>Devoluciones</th><th>Neto</th>${d.admin ? '<th>Gastos pagados</th><th>Pendientes</th><th>Neto operativo</th>' : ''}</tr>${meses}</table></div>` : '<p class="mu">Sin movimientos ni gastos en el periodo.</p>'}</section></div>
      ${d.admin ? `<div class="expense-summary"><section><h3>Gastos del periodo</h3><dl><div><dt>Gastos pagados</dt><dd>${Pagos.fmt(d.gastosPagados)}</dd></div><div><dt>Pendientes</dt><dd>${Pagos.fmt(d.gastosPendientes)}</dd></div><div><dt>Neto después de gastos pagados</dt><dd>${Pagos.fmt(d.neto - d.gastosPagados)}</dd></div></dl><p class="mu">Estimación operativa; no reemplaza la contabilidad tributaria.</p></section><section><h3>Gastos pagados por categoría</h3>${cats ? `<div class="wrap"><table><tr><th>Categoría</th><th>Total</th></tr>${cats}</table></div>` : '<p class="mu">Sin gastos pagados en el periodo.</p>'}</section></div>` : ''}`;
  },
  asistencia(desde, hasta) {
    return Sesiones.repo.all().filter(s => s.fecha >= desde && s.fecha <= hasta).sort((a, b) => (b.fecha + (b.hora || '')).localeCompare(a.fecha + (a.hora || '')));
  },
  resumenAsistencia(sesiones) {
    const atendidas = sesiones.filter(s => s.estado === 'Atendida').length, canceladas = sesiones.filter(s => s.estado === 'Cancelada').length, faltas = sesiones.filter(s => s.estado === 'No asistió').length;
    const realizadas = atendidas + canceladas + faltas;
    return { atendidas, canceladas, faltas, realizadas, tasa: realizadas ? Math.round(atendidas / realizadas * 100) : 0 };
  },
  sinProximaCita() {
    const hoy = today(), sesiones = Sesiones.repo.all();
    return Pacientes.repo.all().filter(p => Cierre.estado(p.id) === 'Activo' && !sesiones.some(s => s.pid === p.id && s.estado === 'Programada' && s.fecha >= hoy)).map(p => {
      const atendidas = sesiones.filter(s => s.pid === p.id && s.estado === 'Atendida').sort((a, b) => (b.fecha + (b.hora || '')).localeCompare(a.fecha + (a.hora || '')));
      return { p, ultima: atendidas[0] || null };
    }).sort((a, b) => (a.ultima ? a.ultima.fecha : '0000').localeCompare(b.ultima ? b.ultima.fecha : '0000') || a.p.nombre.localeCompare(b.p.nombre));
  },
  vistaAsistencia() {
    const desde = $('rep_desde')?.value || today().slice(0, 7) + '-01', hasta = $('rep_hasta')?.value || today();
    const sesiones = this.asistencia(desde, hasta), r = this.resumenAsistencia(sesiones), tipos = Object.groupBy ? Object.groupBy(sesiones, s => s.tipo || 'Sin tipo') : sesiones.reduce((g, s) => ((g[s.tipo || 'Sin tipo'] ||= []).push(s), g), {});
    const lineas = Object.entries(tipos).sort((a, b) => b[1].length - a[1].length).map(([tipo, grupo]) => {
      const tot = this.resumenAsistencia(grupo);
      return `<tr><td>${esc(tipo)}</td><td>${grupo.length}</td><td>${tot.atendidas}</td><td>${tot.canceladas}</td><td>${tot.faltas}</td><td>${tot.tasa}%</td></tr>`;
    }).join('');
    const total = (n, label) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`;
    return `<div class="f2"><div><label for="rep_desde">Desde</label><input id="rep_desde" type="date" value="${esc(desde)}" onchange="App.render()"></div><div><label for="rep_hasta">Hasta</label><input id="rep_hasta" type="date" value="${esc(hasta)}" onchange="App.render()"></div></div>
      <div class="grid" style="margin-top:12px">${total(sesiones.length,'Sesiones')}${total(r.atendidas,'Atendidas')}${total(r.canceladas,'Canceladas')}${total(r.faltas,'No asistió')}${total(r.tasa + '%','Asistencia')}</div>
      ${lineas ? `<div class="wrap"><table><tr><th>Tipo de cita</th><th>Total</th><th>Atendidas</th><th>Canceladas</th><th>No asistió</th><th>Tasa</th></tr>${lineas}<tr><th>Total del periodo</th><th>${sesiones.length}</th><th>${r.atendidas}</th><th>${r.canceladas}</th><th>${r.faltas}</th><th>${r.tasa}%</th></tr></table></div>` : '<p class="mu">No hay citas registradas en ese intervalo.</p>'}`;
  },
  vistaSeguimiento() {
    const filas = this.sinProximaCita();
    return `<p class="mu">Pacientes con tratamiento activo que no tienen una cita programada a partir de hoy.</p>${filas.length ? `<div class="wrap"><table><tr><th>Paciente</th><th>Teléfono</th><th>Última sesión atendida</th><th></th></tr>${filas.map(({ p, ultima }) => `<tr><td><a href="#" onclick="App.go('pacientes','${p.id}');return false">${esc(p.nombre)}</a></td><td>${esc(p.tel) || '—'}</td><td>${ultima ? `${esc(ultima.fecha)}${ultima.hora ? ' · ' + esc(ultima.hora) : ''}` : 'Sin sesiones atendidas'}</td><td><button onclick="Sesiones.form('${p.id}')">+ Programar cita</button></td></tr>`).join('')}</table></div>` : '<p class="mu">Todos los pacientes activos tienen una cita próxima.</p>'}`;
  }
};
App.register({ id: 'reportes', title: 'Reportes', menu: true, icon: '🖨️', order: 6, render(el) {
  const ps = Pacientes.repo.all().sort((a, b) => a.nombre.localeCompare(b.nombre)), tabs = [['documentos','Documentos'],['asistencia','Asistencia'],['seguimiento','Sin próxima cita'],['finanzas','Finanzas']];
  const tab = ([id, nombre]) => `<button class="${Reportes.vista === id ? 'pri' : ''}" aria-pressed="${Reportes.vista === id}" onclick="Reportes.ver('${id}')">${nombre}${id === 'seguimiento' ? ` <span class="badge">${Reportes.sinProximaCita().length}</span>` : ''}</button>`;
  let contenido;
  if (Reportes.vista === 'asistencia') contenido = Reportes.vistaAsistencia();
  else if (Reportes.vista === 'seguimiento') contenido = Reportes.vistaSeguimiento();
  else if (Reportes.vista === 'finanzas') contenido = Reportes.vistaFinanzas();
  else contenido = `<div class="f2"><section><strong>Historia clínica</strong><label for="r_p">Paciente</label><select id="r_p">${ps.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select><p><button class="pri" onclick="Reportes.historia($('r_p').value)" ${ps.length ? '' : 'disabled'}>Imprimir / guardar PDF</button></p></section>
    <section><strong>Cierre de caja</strong><label for="r_f">Fecha</label><input id="r_f" type="date" value="${today()}" style="max-width:200px"><p><button class="pri" onclick="Reportes.caja($('r_f').value)">Imprimir / guardar PDF</button></p></section></div><p class="mu">En la ventana de impresión elige “Guardar como PDF”.</p>`;
  el.innerHTML = `<div class="card"><div class="row"><strong>Reportes</strong></div><div class="patient-tabs" role="group" aria-label="Vistas de reportes">${tabs.map(tab).join(' ')}</div>${contenido}</div>`;
} });
