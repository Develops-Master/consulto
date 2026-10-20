// Módulo Pagos: cobros (crear, editar, comprobantes), saldos pendientes y caja
const Pagos = {
  repo: App.repo('pagos'), METODOS: ['Efectivo', 'Yape/Plin', 'Tarjeta', 'Transferencia'], COMP: ['Ninguno', 'Recibo interno', 'Boleta', 'Factura'], filtro: 'mes', desde: today().slice(0, 7) + '-01', hasta: today(), vista: 'resumen', metodo: 'Todos', busqueda: '', filtroPaquete: 'Activos',
  total: l => l.reduce((a, p) => a + (+p.monto || 0), 0),
  fmt: n => 'S/ ' + Number(n).toFixed(2),
  opcPaq(pid, sel) { return '<option value="">— Cobro suelto —</option>' + Paquetes.repo.all().filter(x => x.pid === pid && x.estado !== 'Anulado').map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nombre)}</option>`).join(''); },
  form(pid, id) {
    const ps = Pacientes.repo.all().sort((a, b) => a.nombre.localeCompare(b.nombre)); if (!ps.length) return alert('Primero registra un paciente');
    const g = id ? this.repo.get(id) || {} : {}, pp = g.pid || pid || ps[0].id, ct = g.comp_tipo || 'Ninguno', p = Pacientes.repo.get(pp) || {};
    abrir(`<h3>${id ? 'Editar' : 'Registrar'} cobro</h3><label>Paciente</label><select id="g_p" ${id ? 'disabled' : ''} onchange="Pagos.cambiarPaciente(this.value)">${ps.map(p => `<option value="${p.id}" ${p.id === pp ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>
      <div class="f2"><div><label>Fecha</label><input id="g_f" type="date" value="${esc(g.fecha || today())}"></div><div><label>Monto (S/)</label><input id="g_m" type="number" min="0" step="0.01" value="${g.monto ?? ''}"></div></div>
      <div class="f2"><div><label>Método</label><select id="g_t">${this.METODOS.map(m => `<option ${m === g.metodo ? 'selected' : ''}>${m}</option>`).join('')}</select></div><div><label>Concepto</label><input id="g_c" value="${esc(g.concepto)}" placeholder="Ej. Sesión de terapia"></div></div>
      <label>Aplicar a paquete (opcional)</label><select id="g_q">${this.opcPaq(pp, g.paquete)}</select>
      <div class="f2"><div><label>Tipo de comprobante</label><select id="g_ct" onchange="Pagos.documento()"><option value="Ninguno" ${ct === 'Ninguno' ? 'selected' : ''}>Sin comprobante</option><option value="Recibo interno" ${ct === 'Recibo interno' ? 'selected' : ''}>Ticket / recibo interno</option><option value="Boleta" ${ct === 'Boleta' ? 'selected' : ''}>Boleta de venta (emitida externamente)</option><option value="Factura" ${ct === 'Factura' ? 'selected' : ''}>Factura (emitida externamente)</option></select></div><div><label>N.º de comprobante</label><input id="g_cn" value="${esc(g.comp_num)}" placeholder="Ej. B001-123"></div></div>
      <p id="g_cpe_aviso" class="mu" style="font-size:14px" ${ct === 'Boleta' || ct === 'Factura' ? '' : 'hidden'}>Emite primero la boleta/factura en SUNAT u otro sistema autorizado y registra aquí su número. Este ERP solo genera una constancia de referencia.</p>
      <div id="g_identidad" ${ct === 'Boleta' || ct === 'Factura' ? '' : 'hidden'}><label>Nombre / razón social del adquirente</label><input id="g_doc_nombre" value="${esc(g.comp_nombre || p.nombre)}"><div class="f2"><div><label>Tipo de documento</label><select id="g_doc_tipo"><option ${g.comp_doc_tipo === 'DNI' || (!g.comp_doc_tipo && ct !== 'Factura') ? 'selected' : ''}>DNI</option><option ${g.comp_doc_tipo === 'RUC' || (!g.comp_doc_tipo && ct === 'Factura') ? 'selected' : ''}>RUC</option><option ${g.comp_doc_tipo === 'Carné de extranjería' ? 'selected' : ''}>Carné de extranjería</option><option ${g.comp_doc_tipo === 'Pasaporte' ? 'selected' : ''}>Pasaporte</option><option ${g.comp_doc_tipo === 'Sin documento' ? 'selected' : ''}>Sin documento</option></select></div><div><label>N.º de documento</label><input id="g_doc_num" inputmode="numeric" value="${esc(g.comp_doc_num || (ct === 'Factura' ? '' : p.doc))}"></div></div></div>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Pagos.guardar('${id || ''}')">Guardar</button></div>`);
  },
  documento() {
    const externo = ['Boleta', 'Factura'].includes($('g_ct').value);
    $('g_identidad').hidden = !externo; $('g_cpe_aviso').hidden = !externo;
  },
  cambiarPaciente(pid) {
    $('g_q').innerHTML = this.opcPaq(pid);
    const p = Pacientes.repo.get(pid) || {}, tipo = $('g_doc_tipo');
    if (!$('g_doc_nombre')) return;
    $('g_doc_nombre').value = p.nombre || '';
    if ($('g_ct').value === 'Factura') { tipo.value = 'RUC'; $('g_doc_num').value = ''; }
    else { tipo.value = 'DNI'; $('g_doc_num').value = p.doc || ''; }
  },
  guardar(id) {
    const m = parseFloat($('g_m').value); if (!(m > 0) || !$('g_f').value) return alert('Ingresa fecha y un monto mayor a 0');
    const ct = $('g_ct').value, comp_num = $('g_cn').value.trim(), externo = ['Boleta', 'Factura'].includes(ct);
    const doc_tipo = externo ? $('g_doc_tipo').value : '', doc_num = externo ? $('g_doc_num').value.trim() : '', doc_nombre = externo ? $('g_doc_nombre').value.trim() : '';
    if (externo && !comp_num) return alert('Registra el número de la boleta o factura emitida externamente');
    if (ct === 'Factura' && (!doc_nombre || doc_tipo !== 'RUC' || !/^\d{11}$/.test(doc_num))) return alert('Para factura indica razón social y RUC de 11 dígitos');
    if (ct === 'Boleta' && doc_tipo === 'DNI' && doc_num && !/^\d{8}$/.test(doc_num)) return alert('El DNI debe tener 8 dígitos');
    const d = { fecha: $('g_f').value, monto: m, metodo: $('g_t').value, concepto: $('g_c').value.trim(), paquete: $('g_q').value || '', comp_tipo: ct === 'Ninguno' ? '' : ct, comp_num, comp_nombre: doc_nombre, comp_doc_tipo: doc_tipo, comp_doc_num: doc_num };
    if (ct === 'Ninguno') d.comp_num = '';
    let r; if (id) r = this.repo.save({ id, ...d }); else r = this.repo.save({ pid: $('g_p').value, ...d });
    cerrar(); App.render(); if (ct === 'Recibo interno' && !r.comp_num) this.emitir(r.id, !id);
  },
  async emitir(id, imprimir) {
    try { const r = await api('POST', '/api/correlativo'); this.repo.save({ id, comp_tipo: 'Recibo interno', comp_num: r.numero }); App.render(); if (imprimir) this.comprobante(id); }
    catch (e) { alert('No se pudo emitir el recibo: ' + e.message); }
  },
  devuelto(id) { return this.repo.all().filter(p => p.movimiento === 'Devolución' && p.ref_pago === id).reduce((a, p) => a + Math.abs(+p.monto || 0), 0); },
  disponible(pago) { return Math.max(0, (+pago.monto || 0) - this.devuelto(pago.id)); },
  formDevolucion(id) {
    const g = this.repo.get(id); if (!g || g.movimiento === 'Devolución' || !(g.monto > 0)) return;
    const disponible = this.disponible(g); if (disponible <= 0.004) return alert('Este cobro ya fue devuelto por completo');
    const externa = ['Boleta', 'Factura'].includes(g.comp_tipo);
    abrir(`<h3>Registrar devolución</h3><p class="mu">Cobro original: ${esc(g.fecha)} · ${esc(g.concepto || 'Atención')} · ${this.fmt(g.monto)}${g.comp_num ? ' · ' + esc(g.comp_num) : ''}</p> 
      <div class="f2"><div><label for="dv_fecha">Fecha de devolución</label><input id="dv_fecha" type="date" value="${today()}"></div><div><label for="dv_monto">Monto a devolver (máx. ${this.fmt(disponible)})</label><input id="dv_monto" type="number" min="0.01" max="${disponible.toFixed(2)}" step="0.01" value="${disponible.toFixed(2)}"></div></div>
      <div class="f2"><div><label for="dv_metodo">Método de devolución</label><select id="dv_metodo">${this.METODOS.map(m => `<option ${m === g.metodo ? 'selected' : ''}>${m}</option>`).join('')}</select></div><div><label for="dv_ref">${externa ? 'N.º de nota de crédito emitida' : 'Referencia de comprobante (opcional)'}</label><input id="dv_ref" maxlength="100" placeholder="${externa ? 'Emitir primero fuera del ERP' : 'Opcional'}" ${externa ? 'required' : ''}></div></div>
      <label for="dv_motivo">Motivo de la devolución</label><textarea id="dv_motivo" maxlength="240" rows="2" placeholder="Ej. Servicio no realizado o cobro duplicado"></textarea>
      ${externa ? '<p class="mu" style="font-size:14px">Registra primero la nota de crédito en SUNAT u otro sistema autorizado. Este ERP no emite CPE.</p>' : ''}
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Pagos.guardarDevolucion('${id}')">Registrar devolución</button></div>`);
  },
  guardarDevolucion(id) {
    const original = this.repo.get(id); if (!original) return alert('No se encontró el cobro original');
    const monto = Number($('dv_monto').value), motivo = $('dv_motivo').value.trim(), numero = $('dv_ref').value.trim();
    if (!(monto > 0) || monto > this.disponible(original) + 0.004) return alert('El monto supera el saldo disponible para devolver');
    if (!motivo) return alert('Indica el motivo de la devolución');
    const externa = ['Boleta', 'Factura'].includes(original.comp_tipo);
    if (externa && !numero) return alert('Registra el número de la nota de crédito emitida externamente');
    this.repo.save({ pid: original.pid, fecha: $('dv_fecha').value, monto: -monto, metodo: $('dv_metodo').value, concepto: motivo, movimiento: 'Devolución', ref_pago: original.id, comp_tipo: externa ? 'Nota de crédito' : '', comp_num: externa ? numero : '', comp_nombre: original.comp_nombre || '', comp_doc_tipo: original.comp_doc_tipo || '', comp_doc_num: original.comp_doc_num || '' });
    cerrar(); App.render();
  },
  comprobante(id) {
    const g = this.repo.get(id), p = g && Pacientes.repo.get(g.pid); if (!g || !p) return; App.audit('reportes', 'imprimir comprobante', id, g.pid);
    const a = App.ajustes || {}, c = Cuenta.calc(g.pid), devolucion = g.movimiento === 'Devolución', interno = !devolucion && (!g.comp_tipo || g.comp_tipo === 'Recibo interno'), externo = ['Boleta', 'Factura', 'Nota de crédito'].includes(g.comp_tipo), tipo = g.comp_tipo === 'Factura' ? 'Factura electrónica' : g.comp_tipo === 'Nota de crédito' ? 'Nota de crédito electrónica' : 'Boleta de venta electrónica', original = devolucion && this.repo.get(g.ref_pago);
    const comprador = g.comp_nombre || p.nombre, docTipo = g.comp_doc_tipo || 'DNI', docNum = g.comp_doc_num || p.doc || '';
      Reportes.imprimir(`<div class="ticket"><header class="ticket-head"><h1>${esc(a.consultorio || 'Consultorio de Psicología')}</h1>${a.ruc ? `<p>RUC ${esc(a.ruc)}</p>` : ''}${a.direccion ? `<p>${esc(a.direccion)}</p>` : ''}${a.telefono ? `<p>Tel. ${esc(a.telefono)}</p>` : ''}</header>
        <h2>${devolucion ? 'CONSTANCIA DE DEVOLUCIÓN' : interno ? 'TICKET INTERNO DE PAGO' : 'CONSTANCIA DE PAGO'}</h2>${devolucion ? `<p class="ticket-ref">${externo ? 'Referencia de nota de crédito externa' : 'Devolución registrada internamente'}${externo ? `<br><b>${esc(g.comp_num)}</b>` : ''}${original ? `<br>Cobro original: ${esc(original.comp_num || original.id)}` : ''}</p>` : !interno ? `<p class="ticket-ref">Referencia de ${esc(tipo)} externa<br><b>${esc(g.comp_num)}</b></p>` : `<p class="ticket-ref">Recibo interno <b>${esc(g.comp_num || 'Pendiente de numeración')}</b></p>`}
        <div class="ticket-line"><span>Fecha</span><b>${esc(g.fecha)}</b></div><div class="ticket-line"><span>Paciente</span><b>${esc(p.nombre)}</b></div>
        ${externo ? `<div class="ticket-line"><span>Adquirente</span><b>${esc(comprador)}</b></div><div class="ticket-line"><span>${esc(docTipo)}</span><b>${esc(docNum) || '—'}</b></div>` : ''}
        <div class="ticket-line"><span>Concepto</span><b>${esc(g.concepto || 'Atención psicológica')}</b></div><div class="ticket-line"><span>Método</span><b>${esc(g.metodo)}</b></div>
        <div class="ticket-total"><span>${devolucion ? 'Monto devuelto' : 'Monto recibido'}</span><b>${this.fmt(Math.abs(g.monto))}</b></div>
        <div class="ticket-line"><span>Saldo de la cuenta</span><b>${c.saldo > 0 ? this.fmt(c.saldo) + ' pendiente' : c.saldo < 0 ? this.fmt(-c.saldo) + ' a favor' : 'Al día'}</b></div>
        ${externo ? '<p class="ticket-aviso">Documento electrónico emitido fuera de este ERP. Esta constancia no es el comprobante tributario; verifica el documento en el sistema de emisión correspondiente.</p>' : devolucion ? '<p class="ticket-aviso">Devolución interna de control; no es una nota de crédito electrónica.</p>' : '<p class="ticket-aviso">Ticket interno de control. No reemplaza una boleta o factura electrónica.</p>'}
        <footer>${esc(App.user ? App.user.nombre : '')}<br>${esc(a.consultorio || 'Consultorio de Psicología')}</footer></div>`);
  },
  async del(id) { if (this.devuelto(id) > 0.004) return alert('No puedes eliminar un cobro con devoluciones registradas'); if (await confirmar('¿Eliminar este movimiento?', 'Eliminar movimiento', 'Eliminar', true)) { this.repo.remove(id); App.render(); } },
  ajustes() {
    const a = App.ajustes || {};
    abrir(`<h3>Datos del consultorio (para comprobantes)</h3><label>Nombre / razón social</label><input id="aj_c" value="${esc(a.consultorio)}"><div class="f2"><div><label>RUC</label><input id="aj_r" value="${esc(a.ruc)}"></div><div><label>Teléfono</label><input id="aj_t" value="${esc(a.telefono)}"></div></div> 
      <label>Dirección</label><input id="aj_d" value="${esc(a.direccion)}"><label>Serie de recibos (ej. R001)</label><input id="aj_s" value="${esc(a.serie || 'R001')}" style="max-width:140px"><label>Dirección pública del sistema (para enlaces a pacientes)</label><input id="aj_u" value="${esc(a.urlPublica || '')}" placeholder="https://consultorio.tudominio.pe">
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Pagos.guardarAjustes()">Guardar</button></div>`);
  },
  async guardarAjustes() {
    try { App.ajustes = await api('POST', '/api/ajustes', { consultorio: $('aj_c').value, ruc: $('aj_r').value, telefono: $('aj_t').value, direccion: $('aj_d').value, serie: $('aj_s').value.toUpperCase(), urlPublica: $('aj_u').value }); cerrar(); App.render(); }
    catch (e) { alert(e.message); }
  },
  cobranza(pid) {
    const p = Pacientes.repo.get(pid) || {}, c = Cuenta.calc(pid); let t = (p.tel || '').replace(/\D/g, ''); if (!t) return alert('El paciente no tiene teléfono registrado'); if (t.length === 9) t = '51' + t;
    App.audit('sesiones', 'recordatorio', null, pid); window.open('https://wa.me/' + t + '?text=' + encodeURIComponent(`Hola ${p.nombre}, le recordamos que tiene un saldo pendiente de ${this.fmt(c.saldo)} en el consultorio. Gracias.`), '_blank');
  },
  ver(vista) { this.vista = vista; this.busqueda = ''; App.render(); },
  cambiarRango() {
    const desde = $('pag_desde').value, hasta = $('pag_hasta').value;
    if (desde && hasta && desde > hasta) { App.aviso('La fecha inicial no puede ser posterior a la fecha final.', 'warning'); return App.render(); }
    this.desde = desde; this.hasta = hasta; App.render();
  },
  buscar(texto) { this.busqueda = texto; this.render($('view')); const e = $('pag_buscar'); e.focus(); e.setSelectionRange(texto.length, texto.length); },
  deudas() {
    const q = this.busqueda.trim().toLocaleLowerCase('es');
    return Pacientes.repo.all().map(p => ({ p, c: Cuenta.calc(p.id) })).filter(x => x.c.saldo > 0.004 && (!q || `${x.p.nombre} ${x.p.doc || ''} ${x.p.tel || ''}`.toLocaleLowerCase('es').includes(q))).sort((a, b) => b.c.saldo - a.c.saldo);
  },
  cobros() {
    const mes = today().slice(0, 7), q = this.busqueda.trim().toLocaleLowerCase('es'); let lista = this.repo.all().slice().sort((a, b) => (b.fecha + b.creado).localeCompare(a.fecha + a.creado));
    if (this.filtro === 'mes') lista = lista.filter(p => p.fecha.startsWith(mes)); else if (this.filtro === 'ult') lista = lista.slice(0, 50); else if (this.filtro === 'rango') lista = lista.filter(p => (!this.desde || p.fecha >= this.desde) && (!this.hasta || p.fecha <= this.hasta));
    return lista.filter(p => (this.metodo === 'Todos' || p.metodo === this.metodo) && (!q || `${(Pacientes.repo.get(p.pid) || {}).nombre || ''} ${p.concepto || ''} ${p.comp_num || ''} ${p.metodo || ''}`.toLocaleLowerCase('es').includes(q)));
  },
  inventarioPaquetes() {
    const consulta = this.busqueda.trim().toLocaleLowerCase('es'), cuentas = new Map();
    return Paquetes.repo.all().map(paquete => {
      if (!cuentas.has(paquete.pid)) cuentas.set(paquete.pid, Cuenta.calc(paquete.pid).paq);
      const detalle = cuentas.get(paquete.pid).find(x => x.id === paquete.id) || paquete, paciente = Pacientes.repo.get(paquete.pid) || {};
      return { ...detalle, paciente };
    }).filter(x => (this.filtroPaquete === 'Todos' || (this.filtroPaquete === 'Activos' ? x.estado !== 'Anulado' : x.estado === 'Anulado')) && (!consulta || `${x.paciente.nombre || ''} ${x.nombre || ''}`.toLocaleLowerCase('es').includes(consulta))).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  },
  tablaDeudas(deudas, limite = deudas.length) {
    return deudas.length ? `<div class="wrap"><table><tr><th>Paciente</th><th>Cargos</th><th>Pagado</th><th>Debe</th><th></th></tr>${deudas.slice(0, limite).map(x => `<tr><td><a href="#" onclick="App.go('pacientes','${x.p.id}');return false">${esc(x.p.nombre)}</a></td><td>${this.fmt(x.c.cargos)}</td><td>${this.fmt(x.c.pagado)}</td><td><b style="color:var(--rd)">${this.fmt(x.c.saldo)}</b></td><td><button onclick="Pagos.form('${x.p.id}')">+ Cobro</button> <button onclick="Pagos.cobranza('${x.p.id}')" title="Recordar deuda por WhatsApp">📲</button></td></tr>`).join('')}</table></div>` : '<p class="mu">Sin deudas pendientes.</p>';
  },
  tablaCobros(lista) {
    return lista.length ? `<div class="wrap"><table><tr><th>Fecha</th><th>Paciente</th><th>Concepto</th><th>Método</th><th>Monto</th><th>Comprobante</th><th></th></tr>${lista.map(p => Cuenta.filaPago(p, true)).join('')}</table></div>` : '<p class="mu">Sin cobros en este periodo.</p>';
  },
  tablaPaquetes(lista) {
    return lista.length ? `<div class="wrap"><table><tr><th>Paciente</th><th>Paquete</th><th>Uso</th><th>Precio</th><th>Estado</th><th></th></tr>${lista.map(x => `<tr><td>${esc(x.paciente.nombre || '—')}</td><td>${esc(x.nombre)}<br><span class="mu">${esc(x.fecha)}</span></td><td>${x.usadas}/${x.n} · ${x.estado === 'Anulado' ? '—' : `quedan <b>${x.rest}</b>`}</td><td>${this.fmt(x.precio)}</td><td><span class="badge${x.estado === 'Anulado' ? ' off' : ''}">${esc(x.estado || 'Activo')}</span></td><td style="white-space:nowrap"><button onclick="Paquetes.form('${x.pid}','${x.id}')" title="Editar">✎</button> <button onclick="Paquetes.anular('${x.id}')">${x.estado === 'Anulado' ? 'Reactivar' : 'Anular'}</button></td></tr>`).join('')}</table></div>` : '<p class="mu">No hay paquetes que coincidan con esta vista.</p>';
  }
};
App.register({ id: 'pagos', title: 'Pagos', menu: true, icon: '💳', order: 5, render(el) {
  const hoy = today(), mes = hoy.slice(0, 7), all = Pagos.repo.all(), deudas = Pagos.deudas(), cobros = Pagos.cobros(), paquetes = Pagos.inventarioPaquetes();
  const saldoTotal = deudas.reduce((a, x) => a + x.c.saldo, 0), tab = (id, texto, n) => `<button class="${Pagos.vista === id ? 'pri' : ''}" aria-pressed="${Pagos.vista === id}" onclick="Pagos.ver('${id}')">${texto} <span class="badge">${n}</span></button>`;
  const kpi = (n, label) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`;
  const caja = `<div class="grid">${kpi(Pagos.fmt(Pagos.total(all.filter(p => p.fecha === hoy))), 'Ingreso neto hoy')}${kpi(Pagos.fmt(Pagos.total(all.filter(p => p.fecha.startsWith(mes)))), 'Ingreso neto del mes')}${kpi(Pagos.fmt(saldoTotal), 'Por cobrar')}${kpi(deudas.length, 'Pacientes con deuda')}</div>`;
  let controles = '', contenido = '';
  if (Pagos.vista === 'resumen') {
    contenido = `<div class="pay-overview"><section><div class="row"><strong>Mayores saldos pendientes</strong><button onclick="Pagos.ver('deudas')">Ver todos</button></div>${Pagos.tablaDeudas(deudas, 5)}</section><section><div class="row"><strong>Últimos movimientos</strong><button onclick="Pagos.ver('cobros')">Ver todos</button></div>${Pagos.tablaCobros(all.slice().sort((a,b)=>(b.fecha+b.creado).localeCompare(a.fecha+a.creado)).slice(0, 8))}</section></div>`;
  } else if (Pagos.vista === 'deudas') {
    controles = `<div class="row"><input id="pag_buscar" type="search" aria-label="Buscar deudas" placeholder="Paciente, DNI o teléfono" value="${esc(Pagos.busqueda)}" oninput="Pagos.buscar(this.value)"><button onclick="Exportar.panel('saldos')">⬇ Exportar</button></div>`;
    contenido = Pagos.tablaDeudas(deudas);
  } else if (Pagos.vista === 'cobros') {
    const brutoFiltrado = Pagos.total(cobros.filter(p => p.movimiento !== 'Devolución')), devueltoFiltrado = cobros.filter(p => p.movimiento === 'Devolución').reduce((n, p) => n + Math.abs(+p.monto || 0), 0);
    controles = `<div class="pay-filtros ${Pagos.filtro === 'rango' ? 'pay-range' : ''}"><div><label for="pag_buscar">Buscar movimiento</label><input id="pag_buscar" type="search" aria-label="Buscar cobro o devolución" placeholder="Paciente, concepto o comprobante" value="${esc(Pagos.busqueda)}" oninput="Pagos.buscar(this.value)"></div><div><label for="pf">Periodo</label><select id="pf" onchange="Pagos.filtro=this.value;App.render()"><option value="mes" ${Pagos.filtro === 'mes' ? 'selected' : ''}>Este mes</option><option value="ult" ${Pagos.filtro === 'ult' ? 'selected' : ''}>Últimos 50</option><option value="todo" ${Pagos.filtro === 'todo' ? 'selected' : ''}>Todos</option><option value="rango" ${Pagos.filtro === 'rango' ? 'selected' : ''}>Rango personalizado</option></select></div><div><label for="pag_metodo">Método</label><select id="pag_metodo" onchange="Pagos.metodo=this.value;App.render()"><option ${Pagos.metodo === 'Todos' ? 'selected' : ''}>Todos</option>${Pagos.METODOS.map(m => `<option ${Pagos.metodo === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>${Pagos.filtro === 'rango' ? `<div><label for="pag_desde">Desde</label><input id="pag_desde" type="date" value="${esc(Pagos.desde)}" onchange="Pagos.cambiarRango()"></div><div><label for="pag_hasta">Hasta</label><input id="pag_hasta" type="date" value="${esc(Pagos.hasta)}" onchange="Pagos.cambiarRango()"></div>` : ''}</div><div class="row"><span class="mu">${cobros.length} movimiento(s) · bruto ${Pagos.fmt(brutoFiltrado)} · devoluciones ${Pagos.fmt(devueltoFiltrado)} · neto ${Pagos.fmt(brutoFiltrado - devueltoFiltrado)}</span><span>${App.puedeVer('reportes') ? '<button onclick="App.go(\'reportes\');Reportes.ver(\'finanzas\')" title="Abrir informe financiero">Reporte financiero</button> ' : ''}<button onclick="Exportar.panel('cobros')">⬇ Exportar</button> ${App.user && App.user.rol === 'admin' ? '<button onclick="Pagos.ajustes()" title="Datos para comprobantes">⚙</button>' : ''}</span></div>`;
    contenido = Pagos.tablaCobros(cobros);
  } else {
    controles = `<div class="row"><input id="pag_buscar" type="search" aria-label="Buscar paquetes" placeholder="Paciente o nombre del paquete" value="${esc(Pagos.busqueda)}" oninput="Pagos.buscar(this.value)"><label for="paq_estado">Estado</label><select id="paq_estado" style="max-width:190px" onchange="Pagos.filtroPaquete=this.value;App.render()"><option ${Pagos.filtroPaquete === 'Activos' ? 'selected' : ''}>Activos</option><option ${Pagos.filtroPaquete === 'Anulados' ? 'selected' : ''}>Anulados</option><option ${Pagos.filtroPaquete === 'Todos' ? 'selected' : ''}>Todos</option></select><button class="pri" onclick="Paquetes.form()">+ Paquete</button></div>`;
    contenido = Pagos.tablaPaquetes(paquetes);
  }
  el.innerHTML = caja + `<div class="card"><div class="row"><strong>Gestión financiera</strong><span>${Pagos.vista !== 'paquetes' ? '<button onclick="Paquetes.form()">+ Paquete</button> ' : ''}<button class="pri" onclick="Pagos.form()">+ Registrar cobro</button></span></div><div class="pay-tabs" role="group" aria-label="Vistas de pagos">${tab('resumen','Resumen',all.length)}${tab('deudas','Deudas',deudas.length)}${tab('cobros','Movimientos',all.length)}${tab('paquetes','Paquetes',Paquetes.repo.all().length)}</div>${controles}${contenido}</div>`;
} });
