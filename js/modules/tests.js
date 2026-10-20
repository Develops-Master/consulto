// Módulo Tests psicológicos: aplicación con puntaje automático y comparación inicio → cierre
// Las escalas (textos, puntaje, niveles) viven en escalas.js: Rosenberg, PHQ-9, GAD-7, PCL-5, ORS y SRS
const Tests = {
  repo: App.repo('tests'),
  get T() { return Escalas.T; },
  puntaje: (k, r) => Escalas.puntaje(k, r),
  nivel: (k, p) => Escalas.nivel(k, p),
  form(pid, k) {
    const t = this.T[k], o = Escalas.opciones(k);
    abrir(`<h3>${t.nom}</h3><p class="mu" style="font-size:15px">${t.ins}</p><label>Momento</label><select id="t_m"><option>Inicio</option><option>Seguimiento</option><option>Cierre</option></select>` +
      t.it.map((x, i) => `<div style="margin-top:10px"><div>${i + 1}. ${esc(x)}</div>${o.map(([v, l]) => `<label style="display:inline-flex;gap:4px;margin:3px 10px 0 0;color:var(--tx)"><input type="radio" name="q${i}" id="q${i}_${v}" style="width:auto"> ${l}</label>`).join('')}</div>`).join('') +
      `<div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Tests.guardar('${pid}','${k}')">Calcular y guardar</button></div>`);
  },
  async guardar(pid, k) {
    const t = this.T[k], o = Escalas.opciones(k), r = [];
    for (let i = 0; i < t.it.length; i++) {
      const s = o.find(([v]) => $('q' + i + '_' + v).checked);
      if (!s) return alert('Responde todos los ítems (falta el ítem ' + (i + 1) + ')');
      r.push(s[0]);
    }
    const p = this.puntaje(k, r);
    this.repo.save({ pid, test: k, fecha: today(), momento: $('t_m').value, resp: r, puntaje: p, nivel: this.nivel(k, p) });
    cerrar(); App.render();
    if (k === 'phq' && r[8] > 0 && await confirmar('El ítem 9 es positivo. ¿Quieres hacer ahora la evaluación de riesgo suicida (C-SSRS)?', 'Revisar riesgo suicida', 'Abrir evaluación')) Riesgo.form(pid);
  },
  // Compara la aplicación de 'Inicio' con la de 'Cierre' (o, si no hay, la primera con la última)
  comparar(pid) {
    const l = this.lista(pid), r = [];
    for (const k of Object.keys(this.T)) {
      if (this.T[k].proceso) continue; // la alianza (SRS) no es un resultado de inicio → cierre
      const a = l.filter(x => x.test === k); if (a.length < 2) continue;
      const ini = a.find(x => x.momento === 'Inicio') || a[0], cie = [...a].reverse().find(x => x.momento === 'Cierre') || a[a.length - 1];
      if (ini.id === cie.id) continue;
      const d = cie.puntaje - ini.puntaje; r.push({ k, f: ini, u: cie, d, ok: this.T[k].mejor === 'alto' ? d > 0 : d < 0 });
    }
    return r;
  },
  resumen: pid => Tests.comparar(pid).map(c => `${Tests.T[c.k].nom}: ${c.f.puntaje} (${c.f.nivel}) al ${c.f.momento.toLowerCase()} → ${c.u.puntaje} (${c.u.nivel}) al ${c.u.momento.toLowerCase()}; ${c.d === 0 ? 'sin cambio' : c.ok ? 'mejoría' : 'sin mejoría'}.`).join('\n'),
  lista: pid => Tests.repo.all().filter(x => x.pid === pid).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado.localeCompare(b.creado)),
  alerta: x => x.test === 'phq' && x.resp && x.resp[8] > 0 ? ' ⚠️' : '',
  async del(id) { if (await confirmar('¿Eliminar esta aplicación?', 'Eliminar evaluación', 'Eliminar', true)) { this.repo.remove(id); App.render(); } },
  card(pid) {
    const l = this.lista(pid);
    const cmp = this.comparar(pid).map(c => `<p style="margin:4px 0"><b>${this.T[c.k].nom}:</b> ${c.f.puntaje} (${esc(c.f.nivel)}) → ${c.u.puntaje} (${esc(c.u.nivel)}) · ${c.d > 0 ? '+' : ''}${c.d} ${c.d === 0 ? '➖ sin cambio' : c.ok ? '✅ mejoría' : '⚠️ sin mejoría'} <span class="mu" style="font-size:14px">(${esc(c.f.momento)} ${esc(c.f.fecha)} → ${esc(c.u.momento)} ${esc(c.u.fecha)})</span></p>`).join('');
    return `<div class="card"><div class="row"><strong>Evaluaciones psicométricas</strong><span>${Object.keys(this.T).map(k => `<button onclick="Tests.form('${pid}','${k}')">+ ${this.T[k].corto}</button>`).join(' ')}</span></div>${cmp}` +
      (l.length ? `<div class="wrap"><table><tr><th>Fecha</th><th>Test</th><th>Momento</th><th>Puntaje</th><th>Nivel</th><th></th></tr>` +
        l.map(x => `<tr><td>${esc(x.fecha)}</td><td>${esc(this.T[x.test].nom)}</td><td>${esc(x.momento)}${x.origen === 'enlace' ? ' <span class="badge" title="Lo respondió el paciente desde su celular">📲 enlace</span>' : ''}</td><td><b>${x.puntaje}</b>/${this.T[x.test].max}${this.alerta(x)}</td><td>${esc(x.nivel)}</td><td><button class="del" onclick="Tests.del('${x.id}')">✕</button></td></tr>`).join('') + '</table></div>' : '<p class="mu">Aplica un test al inicio y otro al cierre del ciclo para medir el avance.</p>') +
      '<p class="mu" style="font-size:14px;margin-bottom:0">Instrumentos de tamizaje: apoyan, pero no sustituyen, la evaluación clínica.</p></div>';
  },
  imprimir(pid) {
    const l = this.lista(pid); if (!l.length) return '';
    return '<h2>Evaluaciones psicométricas</h2><table><tr><th>Fecha</th><th>Test</th><th>Momento</th><th>Puntaje</th><th>Nivel</th></tr>' +
      l.map(x => `<tr><td>${esc(x.fecha)}</td><td>${esc(this.T[x.test].nom)}</td><td>${esc(x.momento)}</td><td>${x.puntaje}/${this.T[x.test].max}${this.alerta(x)}</td><td>${esc(x.nivel)}</td></tr>`).join('') + '</table>';
  }
};
