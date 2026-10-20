// Módulo Recordatorios: detecta las citas por recordar, arma el mensaje y deja el envío en un clic.
// (El envío 100% automático sin intervención requiere un servicio de pago de WhatsApp/SMS; aquí todo queda listo para enviar rápido.)
const Recordatorios = {
  PL0: 'Hola {nombre}, le recordamos su sesión{n} el {fecha}{hora} ({modalidad}).{enlace} Si necesita reprogramar, responda este mensaje.',
  plantilla() { try { return localStorage.getItem('erp_pl') || this.PL0; } catch { return this.PL0; } },
  dias() { try { return +localStorage.getItem('erp_pl_dias') || 1; } catch { return 1; } },
  mensaje(s, p) {
    const f = new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
    return this.plantilla().replace(/\{nombre\}/g, p.nombre || '').replace(/\{n\}/g, s.n ? ' N.º ' + s.n : '').replace(/\{fecha\}/g, f).replace(/\{hora\}/g, s.hora ? ' a las ' + s.hora : '').replace(/\{modalidad\}/g, s.modalidad || 'Presencial').replace(/\{enlace\}/g, Sesiones.url(s.enlace) ? ' Enlace: ' + s.enlace : '');
  },
  pendientes() {
    const t = today(), lim = sumarDias(t, this.dias());
    return Sesiones.repo.all().filter(s => s.estado === 'Programada' && s.fecha >= t && s.fecha <= lim && !s.recordado).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
  },
  banner() {
    const n = this.pendientes().length; if (!n) return '';
    return `<div class="card" style="border-left:4px solid var(--ac)"><div class="row"><span>📲 <b>${n}</b> recordatorio${n > 1 ? 's' : ''} por enviar (citas de hoy${this.dias() > 0 ? ' y de los próximos ' + this.dias() + ' día(s)' : ''})</span><button class="pri" onclick="Recordatorios.panel()">Revisar y enviar</button></div></div>`;
  },
  panel() {
    const l = this.pendientes();
    abrir(`<h3>Recordatorios por enviar</h3>` + (l.length ? `<div class="wrap"><table><tr><th>Cita</th><th>Paciente</th><th></th></tr>${l.map(s => { const p = Pacientes.repo.get(s.pid) || {}; return `<tr><td>${esc(s.fecha)}<br><span class="mu">${esc(s.hora || '')}</span></td><td>${esc(p.nombre)}${p.tel ? '' : '<br><span class="mu">⚠ sin teléfono</span>'}</td><td style="white-space:nowrap"><button class="pri" onclick="Recordatorios.enviar('${s.id}')" ${p.tel ? '' : 'disabled'}>📲 Enviar</button> <button onclick="Recordatorios.marcar('${s.id}')" title="Ya lo avisé por otro medio">✓</button></td></tr>`; }).join('')}</table></div>` : '<p class="mu">No hay recordatorios pendientes. 🎉</p>') +
      `<div class="row" style="margin-top:14px"><button onclick="Recordatorios.config()">Mensaje y anticipación</button><button class="pri" onclick="cerrar();App.render()">Cerrar</button></div>`);
  },
  enviar(id) { Sesiones.wa(id); this.panel(); },
  marcar(id) { Sesiones.repo.save({ id, recordado: new Date().toISOString() }); this.panel(); },
  config() {
    abrir(`<h3>Recordatorios</h3><label>Mensaje (variables: {nombre} {n} {fecha} {hora} {modalidad} {enlace})</label><textarea id="rc_p" rows="5">${esc(this.plantilla())}</textarea>
      <label>Avisar con cuántos días de anticipación (0 = solo hoy)</label><input id="rc_d" type="number" min="0" max="7" value="${this.dias()}" style="max-width:120px">
      <div class="row" style="margin-top:14px"><button onclick="Recordatorios.restablecer()">Restablecer</button><span><button onclick="Recordatorios.panel()">Cancelar</button> <button class="pri" onclick="Recordatorios.guardar()">Guardar</button></span></div>`);
  },
  guardar() { try { localStorage.setItem('erp_pl', $('rc_p').value.trim() || this.PL0); localStorage.setItem('erp_pl_dias', String(Math.max(0, Math.min(7, +$('rc_d').value || 0)))); } catch {} this.panel(); },
  restablecer() { try { localStorage.removeItem('erp_pl'); } catch {} this.config(); }
};
