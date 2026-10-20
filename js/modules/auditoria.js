// Módulo Auditoría (solo administrador): quién hizo qué y cuándo. Lo escribe el SERVIDOR; el navegador no puede alterarlo.
const Auditoria = {
  q: '', datos: null, ver: null,
  ENT: { pacientes: 'Historia clínica', sesiones: 'Sesión', pagos: 'Pago', objetivos: 'Objetivo', consentimientos: 'Consentimiento', reportes: 'Reporte', respaldo: 'Respaldo', tests: 'Test psicológico', evalriesgo: 'Evaluación de riesgo', planseguridad: 'Plan de seguridad', paquetes: 'Paquete de sesiones', cierres: 'Cierre de tratamiento', seguimientos: 'Seguimiento', adjuntos: 'Adjunto', espera: 'Lista de espera', sesion: 'Acceso al sistema', usuarios: 'Usuarios', sistema: 'Sistema' },
  async cargar() { try { this.datos = await api('GET', '/api/auditoria'); } catch (e) { this.datos = { eventos: [], total: 0, error: e.message }; } this.lista($('view')); },
  async verificar() { try { this.ver = await api('GET', '/api/auditoria/verificar'); } catch (e) { this.ver = { ok: false, motivo: e.message }; } this.lista($('view')); },
  buscar(v) { this.q = v; this.lista($('view')); $('aq').focus(); },
  lista(el) {
    if (!this.datos) { el.innerHTML = '<p class="mu">Cargando…</p>'; return this.cargar(); }
    const q = this.q.toLowerCase(), all = this.datos.eventos;
    const l = all.filter(a => ((a.nombre || '') + a.accion + a.usuario + (this.ENT[a.entidad] || a.entidad || '')).toLowerCase().includes(q)).slice(0, 300);
    const v = this.ver ? (this.ver.ok ? `<span class="badge">✓ Registro íntegro (${this.ver.eventos} eventos)</span>` : `<span class="badge err">⚠ ${esc(this.ver.motivo)}</span>`) : '';
    el.innerHTML = `<div class="card"><p class="mu">Registro de accesos y cambios (${this.datos.total} eventos; se muestran los 500 más recientes). Lo escribe el servidor con el usuario real, no guarda contenido clínico y cada evento queda encadenado al anterior: si alguien lo altera, la verificación lo detecta.</p>
      <div class="row"><input id="aq" style="max-width:320px" placeholder="Filtrar por paciente, usuario o acción" value="${esc(this.q)}" oninput="Auditoria.buscar(this.value)"><span>${v} <button onclick="Auditoria.verificar()">Verificar integridad</button> <button onclick="Auditoria.datos=null;Auditoria.ver=null;App.render()">Actualizar</button></span></div>
      ${l.length ? `<div class="wrap"><table><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Paciente</th></tr>` +
        l.map(a => `<tr><td>${esc(new Date(a.fecha).toLocaleString('es-PE'))}</td><td>${esc(a.usuario || '—')} <span class="mu">${esc(a.rol || '')}</span></td><td>${esc(a.accion)}</td><td>${esc(this.ENT[a.entidad] || a.entidad || '')}</td><td>${esc(a.nombre || '—')}</td></tr>`).join('') + '</table></div>' : '<p class="mu">Sin eventos.</p>'}</div>`;
  }
};
App.register({ id: 'auditoria', title: 'Auditoría', menu: true, icon: '🔒', order: 8, render: el => { Auditoria.datos = null; Auditoria.lista(el); } });
