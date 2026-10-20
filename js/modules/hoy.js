// Módulo Hoy: panel diario
App.register({ id: 'hoy', title: 'Hoy', menu: true, icon: '🏠', order: 1, render(el) {
  const t = today(), ses = Sesiones.repo.all().filter(s => s.fecha === t).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  const st = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
  el.innerHTML = Recordatorios.banner() + Tareas.hoyCard() + Riesgo.hoyCard() + Medicion.hoyCard() + `<div class="grid">${st(ses.length, 'Sesiones hoy')}${st(ses.filter(s => s.estado === 'Atendida').length, 'Atendidos')}${st(ses.filter(s => s.estado === 'Programada').length, 'Pendientes')}${st(Pacientes.repo.all().filter(p => p.fecha_alta === t).length, 'Pacientes nuevos')}${st(Pagos.fmt(Pagos.total(Pagos.repo.all().filter(p => p.fecha === t))), 'Cobrado hoy')}</div>
  <div class="card"><div class="row"><strong>Agenda de hoy · ${t}</strong><button class="pri" onclick="Sesiones.form()">+ Programar sesión</button></div>${Sesiones.tabla(ses, true)}</div>`;
} });
