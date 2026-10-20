// Módulo Cuenta del paciente: saldo, deudas y paquetes de sesiones prepagados
const Paquetes = {
  repo: App.repo('paquetes'),
  form(pid, id) {
    const ps = Pacientes.repo.all().sort((a, b) => a.nombre.localeCompare(b.nombre)); if (!ps.length) return alert('Primero registra un paciente');
    const x = id ? this.repo.get(id) || {} : {}, pp = x.pid || pid || ps[0].id, p = Pacientes.repo.get(pp) || {}, n = x.n || +p.nses || 10, tar = +p.tarifa || 0;
    abrir(`<h3>${id ? 'Editar' : 'Nuevo'} paquete de sesiones</h3><label>Paciente</label><select id="k_p" ${id ? 'disabled' : ''}>${ps.map(q => `<option value="${q.id}" ${q.id === pp ? 'selected' : ''}>${esc(q.nombre)}</option>`).join('')}</select>
      <label>Nombre</label><input id="k_n" value="${esc(x.nombre || 'Ciclo de ' + n + ' sesiones')}"><div class="f2"><div><label>N.º de sesiones</label><input id="k_s" type="number" min="1" value="${n}"></div><div><label>Precio total (S/)</label><input id="k_m" type="number" min="0" step="0.01" value="${x.precio ?? (tar ? (tar * n).toFixed(2) : '')}"></div></div>
      <label>Fecha de compra (las sesiones atendidas desde esta fecha se descuentan)</label><input id="k_f" type="date" value="${esc(x.fecha || today())}">
      ${id ? '' : `<div class="f2"><div><label>Pago recibido ahora (S/)</label><input id="k_a" type="number" min="0" step="0.01" placeholder="0 = nada todavía"></div><div><label>Método</label><select id="k_t">${Pagos.METODOS.map(m => `<option>${m}</option>`).join('')}</select></div></div>`}
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Paquetes.guardar('${id || ''}')">Guardar</button></div>`);
  },
  guardar(id) {
    const n = parseInt($('k_s').value), m = parseFloat($('k_m').value); if (!(n > 0) || !(m >= 0) || !$('k_f').value) return alert('Revisa el N.º de sesiones, el precio y la fecha');
    const d = { nombre: $('k_n').value.trim() || 'Paquete de ' + n + ' sesiones', n, precio: m, fecha: $('k_f').value };
    if (id) this.repo.save({ id, ...d }); else {
      const pid = $('k_p').value, r = this.repo.save({ pid, estado: 'Activo', ...d }), a = parseFloat($('k_a').value);
      if (a > 0) Pagos.repo.save({ pid, fecha: today(), monto: a, metodo: $('k_t').value, concepto: d.nombre, paquete: r.id, comp_tipo: '', comp_num: '' });
    }
    cerrar(); App.render();
  },
  async anular(id) { const x = this.repo.get(id); if (await confirmar(x.estado === 'Anulado' ? '¿Reactivar este paquete?' : '¿Anular este paquete? Dejará de contar como cargo.', x.estado === 'Anulado' ? 'Reactivar paquete' : 'Anular paquete', x.estado === 'Anulado' ? 'Reactivar' : 'Anular', x.estado !== 'Anulado')) { this.repo.save({ id, estado: x.estado === 'Anulado' ? 'Activo' : 'Anulado' }); App.render(); } }
};
const Cuenta = {
  // Saldo = cargos (sesiones atendidas fuera de paquete × tarifa + paquetes) − pagos. Positivo = debe.
  calc(pid) {
    const p = Pacientes.repo.get(pid) || {}, tar = +p.tarifa || 0;
    const att = Sesiones.repo.all().filter(s => s.pid === pid && s.estado === 'Atendida').sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
    const paq = Paquetes.repo.all().filter(x => x.pid === pid).sort((a, b) => a.fecha.localeCompare(b.fecha)), act = paq.filter(x => x.estado !== 'Anulado'), uso = {}; act.forEach(x => uso[x.id] = 0);
    let libres = 0; for (const s of att) { const k = act.find(x => x.fecha <= s.fecha && uso[x.id] < (+x.n || 0)); if (k) uso[k.id]++; else libres++; }
    const cSes = libres * tar, cPaq = act.reduce((a, x) => a + (+x.precio || 0), 0), pagado = Pagos.total(Pagos.repo.all().filter(g => g.pid === pid));
    return { tar, libres, cSes, cPaq, cargos: cSes + cPaq, pagado, saldo: cSes + cPaq - pagado, paq: paq.map(x => ({ ...x, usadas: uso[x.id] || 0, rest: x.estado === 'Anulado' ? 0 : (+x.n || 0) - (uso[x.id] || 0) })) };
  },
  filaPago(g, conPac) {
    const comp = g.comp_num ? `${esc(g.comp_tipo)} ${esc(g.comp_num)}` : (g.comp_tipo === 'Recibo interno' ? `<button onclick="Pagos.emitir('${g.id}')">Emitir recibo</button>` : '—');
    const devolucion = g.movimiento === 'Devolución', devuelto = !devolucion ? Pagos.devuelto(g.id) : 0, tieneDevoluciones = devuelto > 0.004;
    const puedeDevolver = !devolucion && g.monto > 0 && Pagos.disponible(g) > 0.004 && App.user && App.user.rol === 'admin';
    const devueltoBadge = tieneDevoluciones ? `<br><span class="badge warn">Devuelto ${Pagos.fmt(devuelto)}</span>` : '';
    return `<tr class="${devolucion ? 'refund-row' : ''}"><td>${esc(g.fecha)}</td>${conPac ? `<td>${esc((Pacientes.repo.get(g.pid) || {}).nombre || '—')}</td>` : ''}<td>${devolucion ? '<span class="badge warn">↩ Devolución</span> ' : ''}${esc(g.concepto)}${g.paquete ? ' <span class="badge">paquete</span>' : ''}${devueltoBadge}${devolucion && g.ref_pago ? `<br><span class="mu">Cobro original ${esc((Pagos.repo.get(g.ref_pago) || {}).comp_num || '')}</span>` : ''}</td><td>${esc(g.metodo)}</td><td><strong>${devolucion ? '−' + Pagos.fmt(Math.abs(g.monto)) : Pagos.fmt(g.monto)}</strong></td><td>${comp}</td><td style="white-space:nowrap"><button onclick="Pagos.comprobante('${g.id}')" title="Imprimir comprobante">🖨</button>${!devolucion && !tieneDevoluciones ? ` <button onclick="Pagos.form('${g.pid}','${g.id}')" title="Editar">✎</button>` : ''}${puedeDevolver ? ` <button onclick="Pagos.formDevolucion('${g.id}')" title="Registrar devolución">↩</button>` : ''}${App.puedeBorrar('pagos') ? ` <button class="del" onclick="Pagos.del('${g.id}')" ${!devolucion && tieneDevoluciones ? 'disabled title="Tiene devoluciones"' : ''}>✕</button>` : ''}</td></tr>`;
  },
  card(pid) {
    const c = this.calc(pid), pg = Pagos.repo.all().filter(g => g.pid === pid).sort((a, b) => b.fecha.localeCompare(a.fecha)), st = (n, x, col) => `<div class="stat"><b${col ? ` style="color:${col}"` : ''}>${n}</b><span>${x}</span></div>`;
    return `<div class="card"><div class="row"><strong>Cuenta y pagos</strong><span><button onclick="Paquetes.form('${pid}')">+ Paquete</button> <button class="pri" onclick="Pagos.form('${pid}')">+ Cobro</button></span></div>
      <div class="grid" style="margin-top:10px">${st(Pagos.fmt(c.cargos), 'Cargos')}${st(Pagos.fmt(c.pagado), 'Pagado')}${st(c.saldo > 0.004 ? Pagos.fmt(c.saldo) : c.saldo < -0.004 ? Pagos.fmt(-c.saldo) : 'S/ 0.00', c.saldo > 0.004 ? 'Debe' : c.saldo < -0.004 ? 'Saldo a favor' : 'Al día', c.saldo > 0.004 ? 'var(--rd)' : '')}</div>
      ${!c.tar && c.libres ? `<p class="mu" style="font-size:15px">⚠ ${c.libres} sesión(es) atendida(s) fuera de paquete sin cobrar: define la <b>tarifa por sesión</b> en la ficha del paciente para calcular la deuda.</p>` : c.libres ? `<p class="mu" style="font-size:15px">${c.libres} sesión(es) atendida(s) fuera de paquete × ${Pagos.fmt(c.tar)}.</p>` : ''}
      ${c.saldo > 0.004 ? `<p><button onclick="Pagos.cobranza('${pid}')">📲 Recordar deuda por WhatsApp</button></p>` : ''}
      ${c.paq.length ? `<div class="wrap"><table><tr><th>Paquete</th><th>Uso</th><th>Precio</th><th></th></tr>${c.paq.map(x => `<tr><td>${esc(x.nombre)}<br><span class="mu" style="font-size:14px">${esc(x.fecha)}${x.estado === 'Anulado' ? ' · Anulado' : ''}</span></td><td>${x.usadas}/${x.n}${x.estado !== 'Anulado' ? ` · quedan <b>${x.rest}</b>` : ''}<div style="background:var(--ac2);border-radius:5px;margin-top:4px"><div class="bar" style="width:${Math.min(100, x.usadas / (x.n || 1) * 100)}%"></div></div></td><td>${Pagos.fmt(x.precio)}</td><td style="white-space:nowrap"><button onclick="Paquetes.form('${pid}','${x.id}')" title="Editar">✎</button> <button onclick="Paquetes.anular('${x.id}')">${x.estado === 'Anulado' ? 'Reactivar' : 'Anular'}</button></td></tr>`).join('')}</table></div>` : ''}
      ${pg.length ? `<div class="wrap"><table><tr><th>Fecha</th><th>Concepto</th><th>Método</th><th>Monto</th><th>Comprobante</th><th></th></tr>${pg.map(g => this.filaPago(g, false)).join('')}</table></div>` : '<p class="mu">Sin cobros registrados.</p>'}</div>`;
  }
};
