// Módulo Exportar: CSV y Excel de cobros, saldos, pacientes (solo contacto) y sesiones
const Exportar = {
  DS: {
    cobros: { nom: 'Cobros y devoluciones', rango: 'fecha', cols: ['Fecha', 'Movimiento', 'Paciente', 'DNI', 'Concepto', 'Método', 'Monto neto', 'Comprobante', 'Cobro original'], num: [6],
      filas: (d, h) => Pagos.repo.all().filter(g => (!d || g.fecha >= d) && (!h || g.fecha <= h)).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(g => { const p = Pacientes.repo.get(g.pid) || {}, original = g.ref_pago && Pagos.repo.get(g.ref_pago); return [g.fecha, g.movimiento || 'Cobro', p.nombre, p.doc, g.concepto, g.metodo, +g.monto || 0, [g.comp_tipo, g.comp_num].filter(Boolean).join(' '), original ? original.comp_num || original.id : '']; }) },
    saldos: { nom: 'Saldos por paciente', cols: ['Paciente', 'DNI', 'Tarifa', 'Sesiones sin cubrir', 'Cargos', 'Pagado', 'Saldo (debe +)', 'Sesiones de paquete por usar'], num: [2, 3, 4, 5, 6, 7],
      filas: () => Pacientes.repo.all().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(p => { const c = Cuenta.calc(p.id); return [p.nombre, p.doc, +p.tarifa || 0, c.libres, c.cargos, c.pagado, c.saldo, c.paq.reduce((a, x) => a + x.rest, 0)]; }) },
    pacientes: { nom: 'Pacientes (datos de contacto)', rango: 'fecha_alta', cols: ['Nombre', 'DNI', 'Teléfono', 'Correo', 'Distrito', 'Fecha de registro'], num: [],
      filas: (d, h) => Pacientes.repo.all().filter(p => (!d || p.fecha_alta >= d) && (!h || p.fecha_alta <= h)).sort((a, b) => a.nombre.localeCompare(b.nombre)).map(p => [p.nombre, p.doc, p.tel, p.email, p.distrito, p.fecha_alta]) },
    sesiones: { nom: 'Sesiones', rango: 'fecha', cols: ['Fecha', 'Hora', 'Paciente', 'Tipo', 'Estado', 'Modalidad', 'Duración (min)'], num: [6],
      filas: (d, h) => Sesiones.repo.all().filter(s => (!d || s.fecha >= d) && (!h || s.fecha <= h)).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || ''))).map(s => [s.fecha, s.hora, (Pacientes.repo.get(s.pid) || {}).nombre, s.tipo, s.estado, s.modalidad || 'Presencial', s.dur]) }
  },
  panel(k) {
    const mes = today().slice(0, 7) + '-01';
    abrir(`<h3>Exportar datos</h3><label>Qué exportar</label><select id="x_k" onchange="$('x_r').style.display=Exportar.DS[this.value].rango?'':'none'">${Object.entries(this.DS).map(([i, d]) => `<option value="${i}" ${i === k ? 'selected' : ''}>${d.nom}</option>`).join('')}</select>
      <div id="x_r" class="f2" style="${this.DS[k || 'cobros'].rango ? '' : 'display:none'}"><div><label>Desde</label><input id="x_d" type="date" value="${mes}"></div><div><label>Hasta</label><input id="x_h" type="date" value="${today()}"></div></div>
      <label>Formato</label><select id="x_f"><option value="xls">Excel (.xls)</option><option value="csv">CSV (.csv)</option></select>
      <p class="mu" style="font-size:14px">Contiene datos personales de pacientes: guarda el archivo en un lugar seguro. La exportación queda registrada en la auditoría.</p>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Exportar.ejecutar()">Descargar</button></div>`);
  },
  ejecutar() {
    const k = $('x_k').value, d = this.DS[k], desde = d.rango ? $('x_d').value : '', hasta = d.rango ? $('x_h').value : '', fmt = $('x_f').value, filas = d.filas(desde, hasta), nombre = `${k}-${today()}`;
    if (!filas.length) return alert('No hay datos en ese periodo');
    App.audit('reportes', 'exportar', null, null);
    if (fmt === 'csv') this.bajar(nombre + '.csv', 'text/csv;charset=utf-8', '\ufeff' + [d.cols, ...filas].map(r => r.map(v => this.cel(v)).join(',')).join('\r\n'));
    else {
      const td = (v, i) => d.num.includes(i) && v !== '' && v != null ? `<td>${Number(v)}</td>` : `<td style="mso-number-format:'\\@'">${esc(v)}</td>`;
      this.bajar(nombre + '.xls', 'application/vnd.ms-excel', `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><tr>${d.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${filas.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</table></body></html>`);
    }
    cerrar();
  },
  // Evita inyección de fórmulas (=, +, -, @) y escapa comillas
  cel(v) { let s = String(v ?? ''); if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = "'" + s; return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; },
  bajar(nombre, mime, texto) { const u = URL.createObjectURL(new Blob([texto], { type: mime })), a = document.createElement('a'); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); }
};
