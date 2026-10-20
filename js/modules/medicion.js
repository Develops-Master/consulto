// Módulo Medición continua de resultados: gráfico de evolución por escala, alerta de "sin mejoría",
// revisión del plan y envío de cuestionarios por enlace. Es una AYUDA para el criterio clínico, no lo reemplaza.
// Las reglas viven en medicion-logica.js; las escalas, en escalas.js.
const Medicion = {
  rev: App.repo('revisionesplan'), L: MedicionLogica,
  de(pid) { return { tests: Tests.lista(pid), revs: this.rev.all().filter(r => r.pid === pid), activo: Cierre.estado(pid) === 'Activo' }; },
  est(pid) { return this.L.estado(this.de(pid), today()); },
  nom: k => Escalas.T[k].corto,
  fd: f => f ? f.slice(8) + '/' + f.slice(5, 7) : '',
  sg: n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n),

  // Texto de una alerta, con los números que la justifican
  texto(a, s) {
    const e = s.escalas.find(x => x.k === a.k), n = this.nom(a.k);
    if (a.tipo === 'sin_mejoria') return `<b>${n}: sin mejoría en ${Math.floor(e.semanas)} semanas</b> (${e.base.puntaje} → ${e.ult.puntaje}; se esperaba bajar o subir al menos ${this.L.CFG[a.k].cambio} puntos). Conviene revisar el plan de tratamiento.`;
    if (a.tipo === 'empeora') return `<b>${n}: empeoró ${Math.abs(e.mejora)} puntos</b> (${e.base.puntaje} → ${e.ult.puntaje}).${a.k === 'phq' ? ' Considera evaluar el riesgo suicida.' : ''}`;
    if (a.tipo === 'reaplicar') return e.estado === 'reaplicar' ? `<b>${n}: aún sin segunda medición</b> tras ${Math.floor(this.L.dias(e.base.fecha, today()) / 7)} semanas.` : `<b>${n}: toca volver a aplicarla</b> (la última fue hace ${e.desdeUlt} días).`;
    return `<b>SRS del ${this.fd(a.fecha)}: posible dificultad en la alianza</b> (total bajo ${this.L.ALIANZA_TOTAL} o algún ítem bajo ${this.L.ALIANZA_ITEM}). Conviene conversarlo en la próxima sesión.`;
  },
  acciones(a, pid) {
    if (a.revisable) return `<button onclick="Medicion.revisar('${pid}','${a.k}')">Revisé el plan</button>`;
    if (a.tipo === 'reaplicar') return `<button onclick="Tests.form('${pid}','${a.k}')">Aplicar ahora</button>`;
    return '';
  },
  banner(pid) {
    if (!App.clinico()) return '';
    const s = this.est(pid); if (!s.hayAlgo) return '';
    return `<div class="alerta-med ${s.alertas.some(a => a.tipo === 'empeora') ? 'rojo' : ''}" role="alert"><div>🔔 <b>Medición de resultados:</b> ${s.alertas.length === 1 ? 'hay 1 aviso' : 'hay ' + s.alertas.length + ' avisos'} (${[...new Set(s.alertas.map(a => this.nom(a.k)))].join(', ')}).</div><button onclick="document.getElementById('med-card').scrollIntoView({behavior:'smooth'})">Ver evolución</button></div>`;
  },
  hoyCard() {
    if (!App.clinico()) return '';
    const f = Pacientes.repo.all().map(p => ({ p, s: this.est(p.id) })).filter(x => x.s.hayAlgo);
    if (!f.length) return '';
    f.sort((a, b) => b.s.alertas.filter(x => x.tipo === 'empeora').length - a.s.alertas.filter(x => x.tipo === 'empeora').length);
    const et = { sin_mejoria: 'sin mejoría', empeora: 'empeoró', reaplicar: 'reaplicar', alianza: 'alianza' };
    return `<div class="card" style="border-left:4px solid var(--warn)"><strong>🔔 Medición de resultados: pacientes para revisar (${f.length})</strong><div class="wrap"><table>${f.map(({ p, s }) => `<tr style="cursor:pointer" onclick="App.go('pacientes','${p.id}')"><td><b>${esc(p.nombre)}</b></td><td>${s.alertas.map(a => `<span class="badge${a.tipo === 'empeora' ? ' err' : ''}">${this.nom(a.k)} · ${et[a.tipo]}</span>`).join(' ')}</td></tr>`).join('')}</table></div><p class="mu" style="font-size:14px;margin:6px 0 0">Aviso automático a partir de tus escalas; no reemplaza tu criterio clínico.</p></div>`;
  },

  // Gráfico SVG de una escala: puntaje en el tiempo, punto de corte y revisiones del plan
  grafico(k, apps, revs) {
    const t = Escalas.T[k], W = 360, H = 175, m = { l: 30, r: 16, t: 16, b: 26 }, ms = f => new Date(f + 'T12:00:00').getTime();
    const xs = apps.map(a => ms(a.fecha)), rs = revs.map(ms);
    let min = Math.min(...xs, ...rs), max = Math.max(...xs, ...rs); if (max === min) { min -= 7 * 864e5; max += 7 * 864e5; } else { const pad = (max - min) * .05; min -= pad; max += pad; }
    const sx = v => m.l + (v - min) / (max - min) * (W - m.l - m.r), sy = p => m.t + (1 - p / t.max) * (H - m.t - m.b);
    const corte = (this.L.CFG[k] || {}).corte || (k === 'srs' ? this.L.ALIANZA_TOTAL : null), etiquetas = apps.length <= 10;
    const pts = apps.map((a, i) => [sx(xs[i]), sy(a.puntaje), a]);
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t.corto)}: ${esc(apps.map(a => this.fd(a.fecha) + ' = ' + a.puntaje).join(', '))}">` +
      [0, t.max / 2, t.max].map(v => `<line class="eje" x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${m.l - 4}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`).join('') +
      (corte != null ? `<line class="corte" x1="${m.l}" x2="${W - m.r}" y1="${sy(corte)}" y2="${sy(corte)}"/><text x="${m.l + 4}" y="${sy(corte) - 4}">corte ${corte}</text>` : '') +
      rs.map(x => `<line class="rev" x1="${sx(x)}" x2="${sx(x)}" y1="${m.t}" y2="${H - m.b}"/><text x="${sx(x) + 3}" y="${m.t + 8}">plan</text>`).join('') +
      (pts.length > 1 ? `<polyline class="ln" points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>` : '') +
      pts.map(([x, y, a]) => `<circle class="pt" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"><title>${esc(a.fecha)}: ${a.puntaje} (${esc(a.nivel)})</title></circle>${etiquetas ? `<text class="vl" x="${x.toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle">${a.puntaje}</text>` : ''}`).join('') +
      `<text x="${pts[0][0].toFixed(1)}" y="${H - 8}" text-anchor="${pts.length > 1 ? 'start' : 'middle'}">${this.fd(apps[0].fecha)}</text>` + (pts.length > 1 ? `<text x="${pts[pts.length - 1][0].toFixed(1)}" y="${H - 8}" text-anchor="end">${this.fd(apps[apps.length - 1].fecha)}</text>` : '') + '</svg>';
  },
  chip(e) {
    if (!e) return '';
    const m = { meta: ['✅ en rango no clínico', ''], mejora: ['✅ mejoría', ''], en_curso: ['➖ en curso', ' off'], sin_mejoria: ['⚠️ sin mejoría', ' err'], empeora: ['🔻 empeoró', ' err'], reaplicar: ['⏳ falta 2.ª medición', ' off'] }[e.estado];
    return `<span class="badge${m[1]}">${m[0]}</span>`;
  },
  card(pid) {
    if (!App.clinico()) return '';
    const d = this.de(pid), s = this.L.estado(d, today()), ks = Object.keys(Escalas.T).filter(k => d.tests.some(t => t.test === k));
    const al = s.alertas.map(a => `<div class="alerta-med ${a.tipo === 'empeora' ? 'rojo' : ''}"><div>${this.texto(a, s)}</div>${this.acciones(a, pid)}</div>`).join('');
    const graf = ks.map(k => {
      const apps = d.tests.filter(t => t.test === k && typeof t.puntaje === 'number'), e = s.escalas.find(x => x.k === k);
      const sub = e && e.mejora != null ? `Línea base ${e.base.puntaje} (${this.fd(e.base.fecha)}) → último ${e.ult.puntaje} (${this.fd(e.ult.fecha)}): <b>${this.sg(e.ult.puntaje - e.base.puntaje)}</b> puntos` : `Último: ${apps[apps.length - 1].puntaje} (${this.fd(apps[apps.length - 1].fecha)})`;
      return `<div class="mg"><div class="row"><b>${esc(Escalas.T[k].nom)}</b>${this.chip(e)}</div>${this.grafico(k, apps, d.revs.filter(r => r.test === k).map(r => r.fecha))}<div class="mu" style="font-size:14px">${sub}${Escalas.T[k].proceso ? ' · medida de alianza, no de síntoma' : ''}</div></div>`;
    }).join('');
    return `<div class="card" id="med-card"><div class="row"><strong>Evolución de resultados</strong><button onclick="Medicion.enlace('${pid}')" title="El paciente responde desde su celular">📲 Cuestionario por enlace</button></div>${al}` +
      (graf ? `<div class="mgrid">${graf}</div>` : '<p class="mu">Cuando apliques escalas (PHQ-9, GAD-7, PCL-5, ORS…) verás aquí cómo evolucionan, con alerta si no hay mejoría tras ' + this.L.SEMANAS + ' semanas.</p>') +
      (d.revs.length ? `<p class="mu" style="font-size:14px;margin:8px 0 0">Revisiones del plan: ${d.revs.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(r => `${this.fd(r.fecha)} · ${this.nom(r.test)} — ${esc(r.nota || '')}`).join(' · ')}</p>` : '') +
      (ks.length && !d.activo ? '<p class="mu" style="font-size:14px;margin:8px 0 0">El paciente no está en tratamiento activo: no se generan avisos.</p>' : '') + '</div>';
  },

  // ---------- revisión del plan ----------
  revisar(pid, k) {
    abrir(`<h3>Revisión del plan · ${esc(Escalas.T[k].nom)}</h3><p class="mu" style="font-size:15px">Deja constancia de lo que decidiste (ajustar objetivos o técnica, derivar, mantener el plan…). Desde la fecha de la revisión se reinicia el conteo de ${this.L.SEMANAS} semanas para esta escala.</p>
      <label>Fecha</label><input id="mr_f" type="date" value="${today()}"><label>¿Qué decidiste?</label><textarea id="mr_n" rows="3" placeholder="Ej.: se agrega activación conductual; reevaluar en 4 semanas"></textarea>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Medicion.guardarRev('${pid}','${k}')">Guardar revisión</button></div>`);
  },
  guardarRev(pid, k) {
    const nota = $('mr_n').value.trim(); if (!nota) return alert('Anota qué decidiste: queda en la ficha.');
    this.rev.save({ pid, test: k, fecha: $('mr_f').value || today(), nota }); cerrar(); App.render();
  },

  // ---------- cuestionarios por enlace ----------
  enlace(pid) {
    abrir(`<h3>📲 Cuestionario por enlace</h3><p class="mu" style="font-size:15px">El paciente responde desde su celular, sin cuenta. El enlace es personal, se usa una sola vez y vence solo. El puntaje se calcula aquí y queda en la ficha.</p>
      <label>Escalas</label>${['phq', 'gad', 'pcl', 'ors', 'srs', 'ros'].map(k => `<label style="display:flex;gap:8px;color:var(--tx);margin:3px 0"><input type="checkbox" class="en_k" value="${k}" style="width:auto"> ${esc(Escalas.T[k].nom)}</label>`).join('')}
      <div class="f2"><div><label>Momento</label><select id="en_m"><option>Seguimiento</option><option>Inicio</option><option>Cierre</option></select></div><div><label>Vence en</label><select id="en_d"><option value="3">3 días</option><option value="7" selected>7 días</option><option value="14">14 días</option></select></div></div>
      <div id="en_res"></div><div class="row" style="margin-top:14px"><button onclick="cerrar()">Cerrar</button><button class="pri" id="en_go" onclick="Medicion.generar('${pid}')">Generar enlace</button></div>
      <h4 style="margin:16px 0 4px">Enlaces pendientes</h4><div id="en_lista" class="mu">Cargando…</div>`);
    this.listar(pid);
  },
  async listar(pid) {
    try {
      const l = await api('GET', '/api/enlaces/' + pid), el = $('en_lista'); if (!el) return;
      el.innerHTML = l.length ? `<div class="wrap"><table>${l.map(e => `<tr><td>${e.tests.map(k => this.nom(k)).join(' + ')} · ${esc(e.momento)}</td><td>vence ${new Date(e.vence).toLocaleDateString('es-PE')}</td><td><button class="del" onclick="Medicion.revocar('${pid}','${e.id}')">Anular</button></td></tr>`).join('')}</table></div><p class="mu" style="font-size:14px">Por seguridad el enlace solo se muestra al crearlo. Si lo perdiste, anúlalo y genera otro.</p>` : 'No hay enlaces pendientes.';
    } catch (e) { const el = $('en_lista'); if (el) el.textContent = e.message; }
  },
  async revocar(pid, id) { if (!await confirmar('¿Anular este enlace? El paciente ya no podrá usarlo.', 'Anular cuestionario', 'Anular', true)) return; try { await api('DELETE', '/api/enlaces/' + id); } catch (e) { alert(e.message); } this.listar(pid); },
  async generar(pid) {
    const ks = [...document.querySelectorAll('.en_k:checked')].map(x => x.value); if (!ks.length) return alert('Elige al menos una escala.');
    const b = $('en_go'); b.disabled = true;
    try {
      const r = await api('POST', '/api/enlaces', { pid, tests: ks, momento: $('en_m').value, dias: +$('en_d').value });
      const raiz = ((App.ajustes || {}).urlPublica || location.origin).replace(/\/+$/, ''), url = raiz + '/r/' + r.token, local = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(raiz);
      this._url = url; this._pid = pid; this._vence = new Date(r.vence).toLocaleDateString('es-PE');
      $('en_res').innerHTML = `<div class="card" style="margin:12px 0 0"><label style="margin-top:0">Enlace (cópialo ahora; no se vuelve a mostrar)</label><input readonly value="${esc(url)}" onclick="this.select()">
        ${local ? '<p class="err" style="font-size:14.5px;margin:6px 0">⚠ Esta dirección solo funciona en este equipo. Para que el paciente la abra desde su celular, publica el sistema con HTTPS y escribe esa dirección en ⚙ Ajustes (ver docs/DESPLIEGUE.md).</p>' : ''}
        <div class="row" style="margin-top:8px"><button onclick="Medicion.copiar()">Copiar</button><button class="pri" onclick="Medicion.wa()">📲 Enviar por WhatsApp</button></div></div>`;
      this.listar(pid);
    } catch (e) { alert(e.message); }
    b.disabled = false;
  },
  copiar() { (navigator.clipboard ? navigator.clipboard.writeText(this._url) : Promise.reject()).then(() => App.aviso('Enlace copiado'), () => { const i = document.querySelector('#en_res input'); i.select(); App.aviso('Selecciónalo y cópialo con Ctrl+C'); }); },
  wa() {
    const p = Pacientes.repo.get(this._pid) || {}; let t = (p.tel || '').replace(/\D/g, ''); if (!t) return alert('El paciente no tiene teléfono registrado. Copia el enlace y envíaselo por otro medio.'); if (t.length === 9) t = '51' + t;
    window.open('https://wa.me/' + t + '?text=' + encodeURIComponent(`Hola ${(p.nombre || '').split(' ')[0]}, te envío un cuestionario breve para tu terapia. Respóndelo desde tu celular aquí: ${this._url}\nEl enlace es personal, se usa una sola vez y vence el ${this._vence}. Gracias.`), '_blank');
  }
};
