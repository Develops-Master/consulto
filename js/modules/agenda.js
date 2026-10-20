// Módulo Agenda: calendario semanal / mensual / lista, reprogramación, choques y lista de espera
const ymd = d => d.toLocaleDateString('en-CA');
const sumarDias = (f, n) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const Agenda = {
  vista: 'semana', ref: today(), DIAS: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  lunes(f) { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); },
  ir(v) { this.vista = v; App.render(); }, hoy() { this.ref = today(); App.render(); }, dia(f) { this.ref = f; this.vista = 'semana'; App.render(); },
  mover(n) { if (this.vista === 'semana') this.ref = sumarDias(this.ref, 7 * n); else { const d = new Date(this.ref + 'T12:00:00'); d.setDate(1); d.setMonth(d.getMonth() + n); this.ref = ymd(d); } App.render(); },
  del: f => Sesiones.repo.all().filter(s => s.fecha === f).sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99')),
  nom: s => ((Pacientes.repo.get(s.pid) || {}).nombre || '—').split(' ').slice(0, 2).join(' '),
  chip(s, compacto = false) {
    const c = Sesiones.activa(s) && Sesiones.choque(s.fecha, s.hora, s.dur, s.id).length, k = s.estado === 'Programada' ? 'p' : s.estado === 'Atendida' ? 'a' : 'x';
    const riesgo = App.clinico() && Riesgo.est(s.pid).activa;
    return `<button class="chip ${k}${compacto ? ' compacto' : ''}" onclick="Agenda.det('${s.id}')" title="${esc(s.estado)}${c ? ' · CHOQUE DE HORARIO' : ''}" aria-label="${esc(s.hora || 'Hora sin definir')} · ${esc(this.nom(s))} · ${esc(s.tipo || 'Sesión')}${c ? ' · Choque de horario' : ''}">
      <span class="chip-cab"><b>${esc(s.hora || 'Hora por definir')}</b><span>${c ? '⚠' : ''}${riesgo ? ' 🚩' : ''}</span></span><span class="chip-paciente">${esc(this.nom(s))}</span>
      <span class="chip-pie">${esc(s.modalidad || 'Presencial')} · ${s.dur || 45} min</span></button>`;
  },
  det(id) {
    const s = Sesiones.repo.all().find(x => x.id === id); if (!s) return; const p = Pacientes.repo.get(s.pid) || {}, c = Sesiones.activa(s) ? Sesiones.choque(s.fecha, s.hora, s.dur, id) : [];
    abrir(`<h3>${esc(p.nombre)}</h3><p>${esc(s.fecha)} ${esc(s.hora || '')} · ${esc(s.tipo || '')} · ${s.dur || 45} min · ${esc(s.modalidad || 'Presencial')}</p>${s.tema ? `<p class="mu">${esc(s.tema)}</p>` : ''}
      ${c.length ? `<p class="warn-txt">⚠️ Choca con: ${c.map(x => esc(this.nom(x)) + ' ' + esc(x.hora)).join(', ')}</p>` : ''}<label>Estado</label><select onchange="cerrar();Sesiones.set('${id}','estado',this.value)">${Sesiones.ESTADOS.map(e => `<option ${e === s.estado ? 'selected' : ''}>${e}</option>`).join('')}</select>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cerrar</button><span><button onclick="cerrar();Sesiones.reprog('${id}')">📅 Reprogramar</button> <button onclick="Sesiones.wa('${id}')">📲</button> <button class="pri" onclick="cerrar();App.go('pacientes','${s.pid}')">Abrir ficha</button></span></div>`);
  },
  exportar() {
    const desde = today(), hasta = sumarDias(desde, 90);
    abrir(`<h3>Exportar agenda</h3><p class="mu">Archivo compatible con Apple Calendar, Google Calendar y Outlook. Los eventos no incluyen nombres ni información clínica.</p>
      <div class="f2"><div><label for="ag_desde">Desde</label><input id="ag_desde" type="date" value="${desde}" onchange="Agenda.contarExportacion()"></div><div><label for="ag_hasta">Hasta</label><input id="ag_hasta" type="date" value="${hasta}" onchange="Agenda.contarExportacion()"></div></div>
      <label for="ag_alarma">Recordatorio</label><select id="ag_alarma"><option value="0">Sin recordatorio</option><option value="15">15 minutos antes</option><option value="30" selected>30 minutos antes</option><option value="60">1 hora antes</option></select>
      <p id="ag_export_info" class="mu" aria-live="polite"></p><div class="row"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Agenda.descargar()">⬇ Descargar .ics</button></div>`);
    this.contarExportacion();
  },
  contarExportacion() {
    const info = $('ag_export_info'); if (!info) return;
    const n = Calendario.seleccionar(Sesiones.repo.all(), $('ag_desde').value, $('ag_hasta').value).length;
    info.textContent = n ? `${n} cita(s) programada(s) en el rango.` : 'No hay citas programadas en ese rango.';
  },
  descargar() {
    const desde = $('ag_desde').value, hasta = $('ag_hasta').value;
    if (desde > hasta) return alert('La fecha inicial debe ser anterior a la fecha final');
    const contenido = Calendario.generar(Sesiones.repo.all(), desde, hasta, $('ag_alarma').value);
    if (!contenido) return alert('No hay citas programadas en ese rango');
    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/calendar;charset=utf-8' })), a = document.createElement('a');
    a.href = url; a.download = `agenda-${desde}-${hasta}.ics`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    App.audit('reportes', 'exportar'); cerrar();
  },
  semana() {
    const l = this.lunes(this.ref), t = today();
    return `<div class="cal-w">${this.DIAS.map((n, i) => { const f = sumarDias(l, i), ss = this.del(f); return `<div class="cal-d ${f === t ? 'hoy' : ''}"><div class="cal-h"><span class="cal-dia"><span class="cal-dia-nombre">${n}</span><span class="cal-dia-num">${+f.slice(8)}</span></span><span class="cal-total">${ss.length || ''}</span><button onclick="Sesiones.form('','${f}')" title="Programar el ${f}" aria-label="Programar cita el ${f}">+</button></div>${ss.map(s => this.chip(s)).join('') || '<span class="cal-libre">Sin citas</span>'}</div>`; }).join('')}</div>`;
  },
  mes() {
    const d = new Date(this.ref + 'T12:00:00'), y = d.getFullYear(), m = d.getMonth(), prim = ymd(new Date(y, m, 1)), n = new Date(y, m + 1, 0).getDate(), off = (new Date(y, m, 1).getDay() + 6) % 7, sem = Math.ceil((off + n) / 7), ini = this.lunes(prim), t = today();
    let h = `<div class="cal-m">${this.DIAS.map(x => `<div class="cal-hd">${x}</div>`).join('')}`;
    for (let i = 0; i < sem * 7; i++) {
      const f = sumarDias(ini, i), ss = this.del(f), fuera = f.slice(0, 7) !== prim.slice(0, 7);
      h += `<div class="cal-c ${fuera ? 'fuera' : ''} ${f === t ? 'hoy' : ''}"><a class="cal-fecha" href="#" aria-label="Ir al ${f}" onclick="Agenda.dia('${f}');return false">${+f.slice(8)}</a>${ss.length ? `<span class="cnt badge">${ss.length}</span>` : ''}${ss.slice(0, 3).map(s => this.chip(s, true)).join('')}${ss.length > 3 ? `<a href="#" class="cal-mas" onclick="Agenda.dia('${f}');return false">+${ss.length - 3} más</a>` : ''}</div>`;
    }
    return h + '</div>';
  },
  etiqueta() {
    if (this.vista === 'mes') return new Date(this.ref + 'T12:00:00').toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
    const l = this.lunes(this.ref); return 'Semana del ' + l.slice(8) + '/' + l.slice(5, 7) + ' al ' + sumarDias(l, 6).slice(8) + '/' + sumarDias(l, 6).slice(5, 7);
  },
  render(el) {
    const v = this.vista, t = today(), tab = (k, l) => `<button class="${v === k ? 'pri' : ''}" onclick="Agenda.ir('${k}')">${l}</button>`;
    let cuerpo;
    if (v === 'lista') { const l = Sesiones.repo.all().filter(s => s.fecha >= t && s.estado === 'Programada').sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)); cuerpo = `<strong>Próximas sesiones</strong>${Sesiones.tabla(l, true)}`; }
    else cuerpo = `<div class="row" style="margin-bottom:10px"><span><button onclick="Agenda.mover(-1)">‹</button> <button onclick="Agenda.hoy()">Hoy</button> <button onclick="Agenda.mover(1)">›</button></span><strong style="text-transform:capitalize">${this.etiqueta()}</strong></div>${v === 'mes' ? this.mes() : this.semana()}<p class="mu" style="font-size:14px;margin-bottom:0">⚠️ = choque de horario · toca una cita para ver, reprogramar o cambiar su estado.</p>`;
    el.innerHTML = Recordatorios.banner() + `<div class="card"><div class="row" style="margin-bottom:10px"><span>${tab('semana', 'Semana')} ${tab('mes', 'Mes')} ${tab('lista', 'Lista')}</span><span><button onclick="Agenda.exportar()">⬇ Calendario</button> <button class="pri" onclick="Sesiones.form()">+ Programar sesión</button></span></div>${cuerpo}</div>` + Espera.card();
  }
};
App.register({ id: 'agenda', title: 'Agenda', menu: true, icon: '📅', order: 3, render: el => Agenda.render(el) });
