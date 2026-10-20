// Búsqueda global (Ctrl+K): pacientes, sesiones, cobros, paquetes y lista de espera. Solo busca en datos de contacto y administrativos.
const Buscar = {
  n: s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
  abrir() { if (!App.user) return; abrir(`<h3>Buscar</h3><input id="gq" placeholder="Nombre, DNI, teléfono, fecha (2026-10), monto, concepto, N.º de recibo…" autocomplete="off" oninput="Buscar.res(this.value)"><div id="gr" style="margin-top:10px"></div><div class="row" style="margin-top:10px"><span class="mu" style="font-size:14px">Esc para cerrar</span><button onclick="cerrar()">Cerrar</button></div>`); setTimeout(() => $('gq') && $('gq').focus(), 30); },
  ir(tipo, id) { cerrar(); if (tipo === 'p') App.go('pacientes', id); else if (tipo === 'f') Agenda.dia(id); else if (tipo === 'e') App.go('agenda'); else App.go(tipo, id); },
  res(q) {
    q = this.n(q).trim(); const out = $('gr'); if (q.length < 2) { out.innerHTML = '<p class="mu">Escribe al menos 2 letras o números.</p>'; return; }
    const m = (...v) => v.some(x => this.n(x).includes(q)), nom = pid => (Pacientes.repo.get(pid) || {}).nombre || '—', lim = 8;
    const g = (t, l, f) => l.length ? `<h4 style="margin:10px 0 4px;color:var(--ac)">${t} (${l.length})</h4>` + l.slice(0, lim).map(f).join('') + (l.length > lim ? `<div class="mu" style="font-size:14px">…y ${l.length - lim} más: afina la búsqueda</div>` : '') : '';
    const it = (tipo, id, a, b) => `<div style="padding:6px 8px;border-radius:8px;cursor:pointer" onmouseover="this.style.background='var(--ac2)'" onmouseout="this.style.background=''" onclick="Buscar.ir('${tipo}','${id}')"><b>${esc(a)}</b><br><span class="mu" style="font-size:14.5px">${esc(b)}</span></div>`;
    const pa = Pacientes.repo.all().filter(p => m(p.nombre, p.doc, p.tel, p.email)).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const se = Sesiones.repo.all().filter(s => m(nom(s.pid), s.fecha, s.tipo, s.estado)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const pg = Pagos.repo.all().filter(x => m(nom(x.pid), x.fecha, x.concepto, x.monto, x.comp_num, x.metodo)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const pk = Paquetes.repo.all().filter(x => m(nom(x.pid), x.nombre));
    const es = Espera.repo.all().filter(x => m(x.nombre, x.tel, x.motivo));
    const h = g('Pacientes', pa, p => it('p', p.id, p.nombre, [p.doc && 'DNI ' + p.doc, p.tel].filter(Boolean).join(' · ') || 'Sin DNI/teléfono')) +
      g('Sesiones', se, s => it('f', s.fecha, `${s.fecha} ${s.hora || ''} · ${nom(s.pid)}`, `${s.tipo || ''} · ${s.estado}`)) +
      g('Cobros', pg, x => it('p', x.pid, `${x.fecha} · ${nom(x.pid)} · ${Pagos.fmt(x.monto)}`, `${x.concepto || ''} ${x.comp_num ? '· ' + x.comp_tipo + ' ' + x.comp_num : ''}`)) +
      g('Paquetes', pk, x => it('p', x.pid, `${x.nombre} · ${nom(x.pid)}`, `${x.n} sesiones · ${Pagos.fmt(x.precio)} · ${x.estado || 'Activo'}`)) +
      g('Lista de espera', es, x => it('e', x.id, x.nombre, `${x.tel || ''} · ${x.estado}`));
    out.innerHTML = h || '<p class="mu">Sin resultados.</p>';
  }
};
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); Buscar.abrir(); } });
