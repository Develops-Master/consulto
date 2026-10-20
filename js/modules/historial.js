// Línea de tiempo clínica compuesta a partir de los registros del paciente.
const Historial = {
  estado: {},
  filtros(pid) { return this.estado[pid] ||= { desde: '', hasta: '', tipo: 'todos', buscar: '' }; },
  eventos(pid) {
    if (!App.clinico()) return [];
    const eventos = [], agregar = e => eventos.push({ ...e, fecha: e.fecha || String(e.creado || '').slice(0, 10) || today(), detalles: e.detalles || [] });
    Sesiones.repo.all().filter(s => s.pid === pid).forEach(s => {
      const soap = s.soap || {}, detalle = [['Estado', s.estado], ['Tipo', s.tipo], ['Tema', s.tema || s.zona], ['Duración', s.dur ? s.dur + ' min' : ''], ['Malestar', s.eva == null ? '' : s.eva + ' / 10'], ['S · Subjetivo', soap.s], ['O · Objetivo', soap.o], ['A · Evaluación', soap.a], ['P · Plan', soap.p], ['Nota anterior', !s.soap && s.nota ? s.nota : '']];
      agregar({ fecha: s.fecha, hora: s.hora, tipo: 'sesion', categoria: 'Sesión', titulo: s.soap ? 'Sesión y nota SOAP' : 'Sesión', resumen: `${s.estado || 'Sin estado'}${s.tipo ? ' · ' + s.tipo : ''}${s.modalidad === 'Virtual' ? ' · Virtual' : ''}`, detalles: detalle, accion: `<button onclick="Sesiones.soap('${s.id}')">${s.soap ? 'Abrir nota' : 'Añadir nota SOAP'}</button>` });
    });
    Tests.lista(pid).forEach(t => {
      const escala = Escalas.T[t.test];
      agregar({ fecha: t.fecha, creado: t.creado, tipo: 'evaluacion', categoria: 'Evaluación', titulo: escala ? escala.nom : 'Evaluación', resumen: `${t.puntaje}${escala ? ' / ' + escala.max : ''}${t.nivel ? ' · ' + t.nivel : ''}${t.momento ? ' · ' + t.momento : ''}${t.origen === 'enlace' ? ' · Respondida por enlace' : ''}`, detalles: [['Resultado', `${t.puntaje}${escala ? ' / ' + escala.max : ''}`], ['Nivel', t.nivel], ['Momento', t.momento], ['Origen', t.origen === 'enlace' ? 'Enlace del paciente' : 'Aplicada en consulta']], accion: `<button onclick="Pacientes.cambiarPestana('${pid}','avance')">Ver evolución</button>` });
    });
    Riesgo.lista(pid).forEach(r => {
      agregar({ fecha: r.fecha, creado: r.creado, tipo: 'riesgo', categoria: 'Riesgo', titulo: 'Evaluación de riesgo suicida', resumen: `Nivel final: ${r.nivel_final || r.nivel || 'Sin nivel'}${r.alerta === 'activa' ? ' · alerta activa' : r.alerta === 'resuelta' ? ' · alerta levantada' : ''}`, detalles: [['Nivel sugerido', r.nivel], ['Nivel final', r.nivel_final], ['Justificación', r.justificacion], ['Factores de riesgo', (r.fr || []).join(', ')], ['Factores protectores', (r.prot || []).join(', ')], ['Acceso a medios', r.medios], ['Observaciones', r.notas], ['Acciones', (r.acciones || []).join(', ')]], accion: `<button onclick="Riesgo.ver('${r.id}')">Ver evaluación</button>` });
    });
    Riesgo.plan.all().filter(x => x.pid === pid).forEach(p => {
      agregar({ fecha: p.revisado || p.fecha, creado: p.creado, tipo: 'riesgo', categoria: 'Plan de seguridad', titulo: 'Plan de seguridad', resumen: `Revisado ${p.revisado || p.fecha || ''}${p.entregado ? ' · copia entregada' : ''}`, detalles: Riesgo.PASOS.map(([k, nombre]) => [nombre, p[k]]).concat([['Razón para vivir', p.razon]]), accion: `<button onclick="Riesgo.formPlan('${pid}')">Abrir plan</button>` });
    });
    Medicion.rev.all().filter(r => r.pid === pid).forEach(r => {
      agregar({ fecha: r.fecha, creado: r.creado, tipo: 'plan', categoria: 'Revisión del plan', titulo: `Revisión del plan · ${Historial.nombreEscala(r.test)}`, resumen: r.nota || 'Plan revisado', detalles: [['Decisión clínica', r.nota], ['Escala', Historial.nombreEscala(r.test)]] });
    });
    Plan.repo.all().filter(o => o.pid === pid).forEach(o => {
      agregar({ fecha: String(o.actualizado || o.creado || o.fecha_alta || '').slice(0, 10), creado: o.actualizado || o.creado, tipo: 'plan', categoria: 'Objetivo', titulo: o.texto || 'Objetivo terapéutico', resumen: `${o.estado || 'En curso'}${o.meta ? ' · ' + o.meta : ''}`, detalles: [['Meta', o.meta], ['Fecha meta', o.fecha_meta], ['Estado actual', o.estado], ['Última nota de avance', o.avance]], accion: `<button onclick="Plan.form('${pid}','${o.id}')">Editar objetivo</button>` });
    });
    Tareas.repo.all().filter(t => t.pid === pid).forEach(t => {
      agregar({ fecha: String(t.actualizado || t.creado || t.fecha_alta || '').slice(0, 10), creado: t.actualizado || t.creado, tipo: 'tarea', categoria: 'Tarea', titulo: t.titulo, resumen: `${t.estado || 'Pendiente'} · vence ${t.fecha_limite || 'sin fecha'} · prioridad ${t.prioridad || 'Normal'}`, detalles: [['Descripción', t.descripcion], ['Fecha límite', t.fecha_limite], ['Prioridad', t.prioridad], ['Estado actual', t.estado]], accion: `<button onclick="Tareas.form('${pid}','${t.id}')">Abrir tarea</button>` });
    });
    Consent.repo.all().filter(c => c.pid === pid).forEach(c => {
      agregar({ fecha: c.fecha, creado: c.creado, tipo: 'consentimiento', categoria: 'Consentimiento', titulo: 'Consentimiento informado', resumen: `Firmado por ${c.firmante || '—'} · ${c.relacion || 'Paciente'}`, detalles: [['Firmante', c.firmante], ['Relación', c.relacion], ['Fecha', c.fecha], ['Versión', c.version]], accion: `<button onclick="Consent.ver('${c.id}')">Ver consentimiento</button>` });
    });
    const cierre = Cierre.de(pid);
    if (cierre) agregar({ fecha: cierre.fecha, creado: cierre.actualizado || cierre.creado, tipo: 'cierre', categoria: 'Cierre', titulo: 'Cierre del tratamiento', resumen: `${cierre.estado || 'Activo'}${cierre.motivo ? ' · ' + cierre.motivo : ''}`, detalles: [['Estado', cierre.estado], ['Motivo', cierre.motivo], ['Resumen del proceso', cierre.resumen], ['Logros', cierre.logros], ['Impresión diagnóstica', cierre.diag], ['Recomendaciones', cierre.recom]], accion: `<button onclick="Cierre.form('${pid}')">Abrir cierre</button>${cierre.estado && cierre.estado !== 'Activo' ? ` <button onclick="Cierre.imprimir('${pid}')">Informe final</button>` : ''}` });
    Cierre.seg.all().filter(s => s.pid === pid).forEach(s => {
      agregar({ fecha: s.fecha, creado: s.creado, tipo: 'seguimiento', categoria: 'Seguimiento', titulo: 'Seguimiento posterior', resumen: `${s.hecho ? s.situacion || 'Realizado' : 'Pendiente'} · ${s.medio || 'Sin medio'}`, detalles: [['Fecha', s.fecha], ['Medio', s.medio], ['Situación', s.situacion], ['Nota', s.nota]], accion: `<button onclick="Cierre.formSeg('${pid}','${s.id}')">Abrir seguimiento</button>` });
    });
    Adjuntos.lista(pid).forEach(a => {
      agregar({ fecha: a.fecha, creado: a.creado, tipo: 'documento', categoria: 'Documento', titulo: a.nombre || 'Archivo adjunto', resumen: `${a.tipo || 'Documento'}${a.nota ? ' · ' + a.nota : ''}`, detalles: [['Tipo', a.tipo], ['Archivo', a.nombre], ['Nota', a.nota]], accion: `<button onclick="Adjuntos.bajar('${a.id}')">Descargar</button>` });
    });
    Medicamentos.lista(pid).forEach(m => {
      agregar({ fecha: m.fecha_inicio, creado: m.creado, tipo: 'medicacion', categoria: 'Medicación registrada', titulo: m.medicamento, resumen: `${m.fuente}${m.estado ? ' · ' + m.estado : ''}`, detalles: [['Origen', m.fuente], ['Profesional en receta', m.prescriptor], ['Dosis transcrita', m.dosis], ['Frecuencia transcrita', m.frecuencia], ['Fecha de fin', m.fecha_fin], ['Observación reportada', m.observacion]], accion: `<button onclick="Pacientes.cambiarPestana('${pid}','medicacion')">Ver registro</button>` });
    });
    return eventos.sort((a, b) => (b.fecha + (b.hora || '') + (b.creado || '')).localeCompare(a.fecha + (a.hora || '') + (a.creado || '')));
  },
  nombreEscala(k) { return Escalas.T[k] ? Escalas.T[k].corto : 'escala'; },
  cambiar(pid) {
    const f = this.filtros(pid); f.desde = $('hist_desde').value; f.hasta = $('hist_hasta').value; f.tipo = $('hist_tipo').value; f.buscar = $('hist_buscar').value;
    Pacientes.detalle($('view'), pid);
  },
  buscar(pid, texto) {
    this.filtros(pid).buscar = texto; Pacientes.detalle($('view'), pid);
    const e = $('hist_buscar'); e.focus(); e.setSelectionRange(texto.length, texto.length);
  },
  card(pid) {
    const f = this.filtros(pid), todos = this.eventos(pid), q = f.buscar.trim().toLocaleLowerCase('es');
    const tipos = [...new Set(todos.map(e => e.tipo))], etiquetas = { sesion: 'Sesiones', evaluacion: 'Evaluaciones', riesgo: 'Riesgo y seguridad', plan: 'Plan y objetivos', tarea: 'Tareas', consentimiento: 'Consentimiento', cierre: 'Cierre', seguimiento: 'Seguimiento', documento: 'Documentos', medicacion: 'Medicación' };
    const eventos = todos.filter(e => (!f.desde || e.fecha >= f.desde) && (!f.hasta || e.fecha <= f.hasta) && (f.tipo === 'todos' || f.tipo === e.tipo) && (!q || `${e.titulo} ${e.resumen} ${e.detalles.map(x => x[1]).join(' ')}`.toLocaleLowerCase('es').includes(q)));
    const fecha = x => { const d = new Date(x + 'T12:00:00'); return Number.isNaN(d.getTime()) ? esc(x) : esc(d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })); };
    const entradas = eventos.map(e => `<article class="historial-evento"><div class="historial-meta"><span class="badge">${esc(e.categoria)}</span><time datetime="${esc(e.fecha)}">${fecha(e.fecha)}${e.hora ? ' · ' + esc(e.hora) : ''}</time></div><h3>${esc(e.titulo)}</h3><p>${esc(e.resumen || '')}</p>${e.detalles.length ? `<details><summary>Ver detalles</summary><dl>${e.detalles.filter(([,v]) => v !== undefined && v !== null && String(v).trim() !== '').map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(Array.isArray(v) ? v.join(', ') : v)}</dd></div>`).join('')}</dl></details>` : ''}${e.accion ? `<div class="historial-acciones">${e.accion}</div>` : ''}</article>`).join('');
    return `<section class="card ficha-contenido historial-card"><div class="row"><strong>Historial longitudinal · ${eventos.length} de ${todos.length} eventos</strong><button onclick="Reportes.historia('${pid}')">Imprimir historia</button></div><p class="mu">Sesiones, evaluaciones y cambios documentados durante la atención. Los datos de la ficha muestran su estado actual; este sistema no conserva versiones anteriores de esos campos.</p><div class="historial-filtros"><div><label for="hist_desde">Desde</label><input id="hist_desde" type="date" value="${esc(f.desde)}" onchange="Historial.cambiar('${pid}')"></div><div><label for="hist_hasta">Hasta</label><input id="hist_hasta" type="date" value="${esc(f.hasta)}" onchange="Historial.cambiar('${pid}')"></div><div><label for="hist_tipo">Tipo de evento</label><select id="hist_tipo" onchange="Historial.cambiar('${pid}')"><option value="todos" ${f.tipo === 'todos' ? 'selected' : ''}>Todos (${todos.length})</option>${tipos.map(t => `<option value="${t}" ${f.tipo === t ? 'selected' : ''}>${esc(etiquetas[t] || t)} (${todos.filter(e => e.tipo === t).length})</option>`).join('')}</select></div><div><label for="hist_buscar">Buscar en el historial</label><input id="hist_buscar" type="search" value="${esc(f.buscar)}" placeholder="Texto, resultado o estado" oninput="Historial.buscar('${pid}',this.value)"></div></div>${entradas ? `<div class="historial-linea">${entradas}</div>` : '<p class="mu">No hay eventos para estos filtros.</p>'}</section>`;
  }
};