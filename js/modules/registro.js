// Módulo Registros: pacientes y sesiones por día, semana y mes
const Registro = {
  modo: 'dia', LIM: { dia: 30, semana: 12, mes: 12 },
  clave(f, m) {
    if (m === 'dia') return f;
    if (m === 'mes') return f.slice(0, 7);
    const d = new Date(f + 'T00:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.toLocaleDateString('en-CA');
  },
  etiqueta(k, m) {
    if (m === 'semana') return 'Semana del ' + k;
    if (m === 'mes') return new Date(k + '-01T00:00:00').toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
    return k;
  },
  datos(m) {
    const g = {}, k = f => g[this.clave(f, m)] ??= { n: 0, t: 0, a: 0, x: 0, v: 0, u: new Set(), c: 0 };
    Pacientes.repo.all().forEach(p => k(p.fecha_alta).n++);
    Sesiones.repo.all().forEach(s => {
      const r = k(s.fecha); r.t++;
      if (s.estado === 'Atendida') { r.a++; r.u.add(s.pid); if (s.modalidad === 'Virtual') r.v++; }
      if (s.estado === 'Cancelada' || s.estado === 'No asistió') r.x++;
    });
    Pagos.repo.all().forEach(p => { k(p.fecha).c += +p.monto || 0; });
    return g;
  },
  set(m) { this.modo = m; App.render(); },
  render(el) {
    const m = this.modo, d = this.datos(m), t = today();
    const ks = Object.keys(d).sort().reverse().slice(0, this.LIM[m]), mx = Math.max(1, ...ks.map(k => d[k].a));
    const cur = x => this.datos(x)[this.clave(t, x)] || { a: 0, n: 0 };
    const st = (x, l) => `<div class="stat"><b>${cur(x).a}</b><span>Atendidos ${l} · ${cur(x).n} nuevos</span></div>`;
    el.innerHTML = `<div class="grid">${st('dia', 'hoy')}${st('semana', 'esta semana')}${st('mes', 'este mes')}</div>
    <div class="card"><div class="row"><strong>Registro por período</strong><span>${[['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']].map(([k, l]) => `<button class="${m === k ? 'pri' : ''}" onclick="Registro.set('${k}')">${l}</button>`).join(' ')}</span></div>` +
      (ks.length ? `<div class="wrap"><table><tr><th>Período</th><th>Pac. nuevos</th><th>Sesiones</th><th>Atendidas</th><th>Pac. atendidos</th><th>Virtuales</th><th>Cancel./No asistió</th><th>Cobrado</th><th style="width:15%"></th></tr>` +
        ks.map(k => { const r = d[k]; return `<tr><td style="text-transform:capitalize">${esc(this.etiqueta(k, m))}</td><td>${r.n}</td><td>${r.t}</td><td><strong>${r.a}</strong></td><td>${r.u.size}</td><td>${r.v}</td><td>${r.x}</td><td>${Pagos.fmt(r.c)}</td><td><div class="bar" style="width:${r.a / mx * 100}%"></div></td></tr>`; }).join('') + '</table></div>' : '<p class="mu">Sin datos todavía.</p>') + '</div>';
  }
};
App.register({ id: 'registro', title: 'Registros', menu: true, icon: '📊', order: 4, render: el => Registro.render(el) });
