// Módulo Plan de tratamiento: objetivos por paciente + gráfico de evolución del dolor (EVA)
const Plan = {
  repo: App.repo('objetivos'), ESTADOS: ['En curso', 'Logrado', 'Descartado'],
  card(pid) {
    const ob = this.repo.all().filter(o => o.pid === pid);
    return `<div class="card"><div class="row"><strong>Plan de tratamiento</strong><button class="pri" onclick="Plan.form('${pid}')">+ Objetivo</button></div>` +
      (ob.length ? `<div class="wrap"><table><tr><th>Objetivo</th><th>Meta medible</th><th>Fecha meta</th><th>Estado</th><th></th></tr>` +
        ob.map(o => `<tr><td>${esc(o.texto)}</td><td>${esc(o.meta)}${o.avance ? `<br><span class="mu" style="font-size:14px">Avance: ${esc(o.avance)}</span>` : ''}</td><td>${esc(o.fecha_meta) || '—'}</td><td><select onchange="Plan.set('${o.id}',this.value)">${this.ESTADOS.map(e => `<option ${e === o.estado ? 'selected' : ''}>${e}</option>`).join('')}</select></td><td style="white-space:nowrap"><button onclick="Plan.form('${pid}','${o.id}')" title="Editar">✎</button> <button class="del" onclick="Plan.del('${o.id}')">✕</button></td></tr>`).join('') + '</table></div>'
        : '<p class="mu">Define objetivos con metas medibles (ej. reducir el puntaje de ansiedad).</p>') +
      `<div style="margin-top:12px"><strong>Evolución del malestar emocional (0-10)</strong>${this.chart(pid)}</div></div>`;
  },
  chart(pid) {
    const d = Sesiones.repo.all().filter(s => s.pid === pid && s.eva != null && s.eva !== '').sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (d.length < 2) return '<p class="mu">Registra el malestar emocional en al menos 2 sesiones para ver la curva.</p>';
    const W = 400, H = 140, px = 28, py = 16, X = i => px + i * (W - 2 * px) / (d.length - 1), Y = v => H - py - (v / 10) * (H - 2 * py);
    const pts = d.map((s, i) => `${X(i).toFixed(1)},${Y(+s.eva).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:560px"><g stroke="var(--bd)" font-size="11" fill="var(--mu)">${[0, 5, 10].map(v => `<line x1="${px}" x2="${W - px}" y1="${Y(v)}" y2="${Y(v)}"/><text x="4" y="${Y(v) + 3}" stroke="none">${v}</text>`).join('')}</g>
      <polyline points="${pts}" fill="none" stroke="var(--ac)" stroke-width="2.5"/>
      ${d.map((s, i) => `<circle cx="${X(i)}" cy="${Y(+s.eva)}" r="4" fill="var(--ac)"><title>${esc(s.fecha)}: Malestar ${s.eva}</title></circle>`).join('')}
      <text x="${px}" y="${H - 2}" font-size="11" fill="var(--mu)">${esc(d[0].fecha)}</text><text x="${W - px}" y="${H - 2}" font-size="11" fill="var(--mu)" text-anchor="end">${esc(d[d.length - 1].fecha)}</text></svg>`;
  },
  form(pid, id) {
    const o = id ? this.repo.get(id) || {} : {};
    abrir(`<h3>${id ? 'Editar' : 'Nuevo'} objetivo</h3><label>Objetivo terapéutico</label><input id="o_t" value="${esc(o.texto)}" placeholder="Ej. Fortalecer la autoestima">
      <label>Meta medible</label><input id="o_m" value="${esc(o.meta)}" placeholder="Ej. Rosenberg ≥ 30 al cierre del ciclo">
      <div class="f2"><div><label>Fecha meta (opcional)</label><input id="o_f" type="date" value="${esc(o.fecha_meta)}"></div>
      <div><label>Estado</label><select id="o_e">${this.ESTADOS.map(e => `<option ${e === (o.estado || 'En curso') ? 'selected' : ''}>${e}</option>`).join('')}</select></div></div>
      <label>Nota de avance</label><textarea id="o_a" rows="2">${esc(o.avance)}</textarea>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Plan.guardar('${pid}','${id || ''}')">Guardar</button></div>`);
  },
  guardar(pid, id) {
    const t = $('o_t').value.trim(); if (!t) return alert('Escribe el objetivo');
    const d = { texto: t, meta: $('o_m').value.trim(), fecha_meta: $('o_f').value, estado: $('o_e').value, avance: $('o_a').value.trim() };
    if (id) this.repo.save({ id, ...d }); else this.repo.save({ pid, ...d });
    cerrar(); App.render();
  },
  set(id, estado) { this.repo.save({ id, estado }); },
  async del(id) { if (await confirmar('¿Eliminar este objetivo?', 'Eliminar objetivo', 'Eliminar', true)) { this.repo.remove(id); App.render(); } }
};
