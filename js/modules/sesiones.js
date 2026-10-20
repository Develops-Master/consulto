// Módulo Sesiones: programación y seguimiento de terapias
const Sesiones = {
  repo: App.repo('sesiones'), ESTADOS: ['Programada', 'Atendida', 'Cancelada', 'No asistió'],
  TIPOS: ['Evaluación inicial', 'Psicoterapia individual', 'Terapia de pareja', 'Terapia familiar', 'Orientación', 'Control / seguimiento', 'Cierre', 'Otro'],
  TEMAS: ['Autoestima: encuadre, evaluación y línea base', 'Pensamientos automáticos y diálogo interno', 'Reconocer y manejar emociones', 'Creencias centrales sobre uno mismo', 'Comunicación asertiva', 'Límites y relaciones saludables', 'Manejo de estrés y ansiedad', 'Estrategias de afrontamiento', 'Proyecto de vida y metas', 'Cierre: evaluación de avances y prevención de recaídas'],
  url: e => /^https?:\/\//i.test(e || '') ? e : '',
  tabla(l, showPat) {
    if (!l.length) return '<p class="mu">Sin sesiones.</p>';
    const at = l.filter(s => s.estado === 'Atendida').length;
    const prog = `<p class="mu" style="margin:0 0 6px">Progreso: <b>${at}</b> de ${l.length} sesiones atendidas</p><div style="background:var(--ac2);border-radius:5px;margin-bottom:12px"><div class="bar" style="width:${at / l.length * 100}%"></div></div>`;
    return (showPat ? '' : prog) + `<div class="wrap"><table class="ses"><tr><th>Fecha</th>${showPat ? '<th>Paciente</th>' : ''}<th>Estado</th><th>Evolución</th><th></th></tr>` +
      l.map(s => `<tr><td>${esc(s.fecha)}<br><span class="mu">${esc(s.hora || '')}</span><br><span class="mu">${s.n ? 'Sesión ' + s.n + '/' + s.total + ' · ' : ''}${esc(s.tipo || '')}${s.dur ? ' · ' + s.dur + ' min' : ''}</span>${s.tema || s.zona ? `<br><b>${esc(s.tema || s.zona)}</b>` : ''}<br>${s.modalidad === 'Virtual' ? '💻 Virtual' + (this.url(s.enlace) ? ` <a href="${esc(this.url(s.enlace))}" target="_blank" rel="noopener">Abrir sala</a>` : '') : '🏥 Presencial'}${s.reprog && s.reprog.length ? '<br><span class="mu" title="' + esc(s.reprog.map(r => r.de + ' → ' + r.a).join(' | ')) + '">↻ Reprogramada ' + s.reprog.length + 'x</span>' : ''}</td>` +
        (showPat ? `<td><a href="#" onclick="App.go('pacientes','${s.pid}');return false">${esc((Pacientes.repo.get(s.pid) || {}).nombre || '—')}</a></td>` : '') +
        `<td><select onchange="Sesiones.set('${s.id}','estado',this.value)">${this.ESTADOS.map(e => `<option ${e === s.estado ? 'selected' : ''}>${e}</option>`).join('')}</select></td>
        <td>${!App.clinico() ? '' : (s.soap ? `<small><b>Malestar:</b> ${s.eva ?? '—'} · ${esc((s.soap.a || s.soap.s || '').slice(0, 70))}</small><br>` : (s.nota ? `<small>${esc(s.nota)}</small><br>` : '')) + `<button onclick="Sesiones.soap('${s.id}')">📝 ${s.soap ? 'Ver/editar' : 'Nota'} SOAP</button>`}</td>
        <td style="white-space:nowrap"><button title="Reprogramar" onclick="Sesiones.reprog('${s.id}')">📅</button> <button title="Recordatorio por WhatsApp" onclick="Sesiones.wa('${s.id}')">📲</button>${s.recordado ? ' <span title="Recordatorio enviado">✓</span>' : ''} ${App.puedeBorrar('sesiones') ? `<button class="del" onclick="Sesiones.del('${s.id}')">✕</button>` : ''}</td></tr>`).join('') + '</table></div>';
  },
  ciclo(pid) {
    const p = Pacientes.repo.get(pid); if (!p) return;
    abrir(`<h3>Ciclo de sesiones · ${esc(p.nombre)}</h3><div class="f2">
      <div><label>N.º de sesiones</label><input id="cy_n" type="number" min="1" max="40" value="${esc(p.nses) || 10}"></div><div><label>Fecha de la 1.ª sesión</label><input id="cy_f" type="date" value="${today()}"></div>
      <div><label>Hora</label><input id="cy_h" type="time"></div><div><label>Frecuencia</label><select id="cy_p"><option value="7">Semanal</option><option value="14">Quincenal</option><option value="3">Cada 3 días</option><option value="1">Diaria</option></select></div>
      <div><label>Modalidad</label><select id="cy_m"><option>Presencial</option><option>Virtual</option></select></div><div><label>Duración (min)</label><input id="cy_d" type="number" min="5" step="5" value="50"></div></div>
      <label>Enlace de videollamada (si es virtual)</label><input id="cy_e" placeholder="https://meet.google.com/...">
      <label>Tema de cada sesión (uno por línea, editable)</label><textarea id="cy_t" rows="8">${this.TEMAS.join('\n')}</textarea>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Sesiones.guardarCiclo('${pid}')">Crear sesiones</button></div>`);
  },
  async guardarCiclo(pid) {
    const n = Math.min(40, Math.max(1, parseInt($('cy_n').value) || 0)), f = $('cy_f').value, paso = +$('cy_p').value || 7;
    if (!f) return alert('Elige la fecha de la primera sesión');
    const temas = $('cy_t').value.split('\n').map(t => t.trim()).filter(Boolean), base = new Date(f + 'T00:00:00');
    if ($('cy_h').value) {
      const ch = []; for (let i = 0; i < n; i++) { const d = new Date(base); d.setDate(base.getDate() + i * paso); const ff = d.toLocaleDateString('en-CA'); if (this.choque(ff, $('cy_h').value, +$('cy_d').value || null).length) ch.push(ff); }
      if (ch.length && !await confirmar('Hay ' + ch.length + ' sesión(es) que chocan con otras citas: ' + ch.slice(0, 6).join(', ') + (ch.length > 6 ? '…' : '') + '. ¿Crear el ciclo de todos modos?', 'Choque de horarios', 'Crear de todos modos')) return;
    }
    for (let i = 0; i < n; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i * paso);
      this.repo.save({ pid, fecha: d.toLocaleDateString('en-CA'), hora: $('cy_h').value, estado: 'Programada', nota: '', tipo: i === n - 1 && n > 1 ? 'Cierre' : 'Psicoterapia individual', dur: +$('cy_d').value || null, tema: temas[i] || '', modalidad: $('cy_m').value, enlace: this.url($('cy_e').value.trim()), n: i + 1, total: n });
    }
    cerrar(); App.render();
  },
  wa(id) {
    const s = this.repo.all().find(x => x.id === id), p = Pacientes.repo.get(s.pid) || {};
    let t = (p.tel || '').replace(/\D/g, ''); if (!t) return alert('El paciente no tiene teléfono registrado'); if (t.length === 9) t = '51' + t;
    App.audit('sesiones', 'recordatorio', id, s.pid); this.repo.save({ id, recordado: new Date().toISOString() });
    window.open('https://wa.me/' + t + '?text=' + encodeURIComponent(Recordatorios.mensaje(s, p)), '_blank'); if (!$('dlg').open) App.render();
  },
  // ---- choques de horario (un solo consultorio: dos sesiones activas no pueden solaparse) ----
  min: h => { const [H, M] = h.split(':'); return +H * 60 + +M; },
  activa: s => s.estado === 'Programada' || s.estado === 'Atendida',
  choque(f, h, d, excl) {
    if (!h) return []; const a = this.min(h), b = a + (d || 45);
    return this.repo.all().filter(s => s.id !== excl && s.fecha === f && s.hora && this.activa(s) && this.min(s.hora) < b && a < this.min(s.hora) + (s.dur || 45));
  },
  async avisoChoque(f, h, d, excl) {
    const c = this.choque(f, h, d, excl); if (!c.length) return true;
    return await confirmar('Choque de horario el ' + f + ':\n' + c.map(x => `• ${x.hora} · ${(Pacientes.repo.get(x.pid) || {}).nombre || '—'} (${x.dur || 45} min)`).join('\n') + '\n¿Guardar de todos modos?', 'Choque de horarios', 'Guardar de todos modos');
  },
  // ---- reprogramar (conserva el historial de cambios) ----
  reprog(id) {
    const s = this.repo.all().find(x => x.id === id); if (!s) return;
    abrir(`<h3>Reprogramar sesión</h3><p class="mu">${esc((Pacientes.repo.get(s.pid) || {}).nombre || '')} · actual: ${esc(s.fecha)} ${esc(s.hora || '')}</p>
      <div class="f2"><div><label>Nueva fecha</label><input id="rp_f" type="date" value="${esc(s.fecha)}"></div><div><label>Nueva hora</label><input id="rp_h" type="time" value="${esc(s.hora || '')}"></div></div>
      <label>Motivo (opcional)</label><input id="rp_m" placeholder="Ej. lo pidió el paciente">
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Sesiones.guardarReprog('${id}')">Reprogramar</button></div>`);
  },
  async guardarReprog(id) {
    const s = this.repo.all().find(x => x.id === id), f = $('rp_f').value, h = $('rp_h').value; if (!f) return alert('Elige la nueva fecha');
    if (f === s.fecha && h === (s.hora || '')) return alert('Es la misma fecha y hora');
    if (!await this.avisoChoque(f, h, s.dur, id)) return;
    const hist = [...(s.reprog || []), { de: `${s.fecha} ${s.hora || ''}`.trim(), a: `${f} ${h}`.trim(), en: today(), motivo: $('rp_m').value.trim() }];
    this.repo.save({ id, fecha: f, hora: h, estado: 'Programada', reprog: hist, recordado: null }); cerrar(); App.render();
  },
  soap(id) {
    const s = this.repo.all().find(x => x.id === id), n = s.soap || {};
    const t = (k, l, ph) => `<label>${l}</label><textarea id="n_${k}" rows="2" placeholder="${ph}">${esc(n[k])}</textarea>`;
    abrir(`<h3>Nota SOAP · ${esc(s.fecha)}</h3>${s.nota && !s.soap ? `<p class="mu">Nota anterior: ${esc(s.nota)}</p>` : ''}
      ${t('s', 'S · Subjetivo', 'Lo que refiere el paciente')}${t('o', 'O · Objetivo', 'Observaciones conductuales, técnicas aplicadas, tarea')}
      ${t('a', 'A · Evaluación', 'Interpretación clínica, avance')}${t('p', 'P · Plan', 'Indicaciones, próxima sesión')}
      <label>Malestar emocional (0-10)</label><input id="n_eva" type="number" min="0" max="10" step="1" value="${s.eva ?? ''}" style="max-width:120px">
      <label class="chk" style="margin-top:12px"><input type="checkbox" id="n_ide" ${s.ideacion ? 'checked' : ''}> Hubo ideación suicida o autolesión en esta sesión</label>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Sesiones.guardarSoap('${id}')">Guardar</button></div>`);
  },
  guardarSoap(id) {
    const e = $('n_eva').value, v = e === '' ? null : Math.min(10, Math.max(0, +e));
    const ide = $('n_ide').checked, s = this.repo.all().find(x => x.id === id);
    this.repo.save({ id, eva: v, ideacion: ide, soap: { s: $('n_s').value.trim(), o: $('n_o').value.trim(), a: $('n_a').value.trim(), p: $('n_p').value.trim() } });
    cerrar(); if (ide && s) Riesgo.recordar(s.pid, s.fecha); else App.render();
  },
  set(id, k, v) {
    this.repo.save({ id, [k]: v }); if (k === 'estado') { App.render(); if ((v === 'Cancelada' || v === 'No asistió') && Espera.activos().length) App.aviso('Se liberó un horario: hay ' + Espera.activos().length + ' persona(s) en lista de espera (Agenda → Lista de espera).'); }
  },
  async del(id) { if (await confirmar('¿Eliminar esta sesión?', 'Eliminar sesión', 'Eliminar', true)) { this.repo.remove(id); App.render(); } },
  form(pid, fecha, hora, esp) {
    this._esp = esp || null; const ps = Pacientes.repo.all(); if (!ps.length) return alert('Primero registra un paciente');
    abrir(`<h3>Programar sesión</h3><label>Paciente</label><select id="s_p">${ps.map(p => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>
      <div class="f2"><div><label>Fecha</label><input id="s_f" type="date" value="${esc(fecha || today())}"></div><div><label>Hora</label><input id="s_h" type="time" value="${esc(hora || '')}"></div></div>
      <div class="f2"><div><label>Tipo de terapia</label><select id="s_t">${this.TIPOS.map(t => `<option>${t}</option>`).join('')}</select></div><div><label>Duración (min)</label><input id="s_d" type="number" min="5" step="5" value="45"></div></div>
      <label>Tema / objetivo de la sesión</label><input id="s_z" placeholder="Ej. Autoestima">
      <div class="f2"><div><label>Modalidad</label><select id="s_mo"><option>Presencial</option><option>Virtual</option></select></div><div><label>Enlace de videollamada</label><input id="s_e" placeholder="https://..."></div></div>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Sesiones.guardar()">Guardar</button></div>`);
  },
  async guardar() {
    if (!$('s_f').value) return alert('Elige una fecha');
    if (!await this.avisoChoque($('s_f').value, $('s_h').value, +$('s_d').value || null)) return;
    const pid = $('s_p').value; if (this._esp) { Espera.agendada(this._esp, pid); this._esp = null; }
    this.repo.save({ pid, fecha: $('s_f').value, hora: $('s_h').value, tipo: $('s_t').value, dur: +$('s_d').value || null, tema: $('s_z').value.trim(), modalidad: $('s_mo').value, enlace: this.url($('s_e').value.trim()), estado: 'Programada', nota: '' });
    cerrar(); App.render();
  }
};
