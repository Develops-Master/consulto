// Módulo Respaldo (solo administrador): respaldos automáticos cifrados, descarga y migración desde la versión anterior
const Respaldo = {
  d: null,
  async cargar() { try { this.d = await api('GET', '/api/respaldos'); } catch (e) { App.aviso(e.message); } this.pintar($('view')); },
  fmt: n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB',
  async ahora() { App.aviso('Creando respaldo…'); try { const r = await api('POST', '/api/respaldos'); App.aviso('Respaldo creado: ' + r.nombre); } catch (e) { App.aviso(e.message); } this.cargar(); },
  async importar(f) {
    if (!f) return; const t = await f.text(); let j;
    try { j = JSON.parse(t); } catch (e) { return alert('El archivo no es válido'); }
    if (!await confirmar('Se agregarán al servidor los pacientes, sesiones y demás registros de ese archivo. No se borrará nada existente.', 'Importar datos', 'Importar')) return;
    try { const r = await api('POST', '/api/importar-legacy', j); await App.cargar(); App.aviso('Importado: ' + Object.entries(r.importados).map(([k, v]) => `${k}: ${v}`).join(', ') + (r.omitidos ? ` · Omitidos (duplicados o inválidos): ${r.omitidos}` : ''), 'success', 8000); App.render(); } catch (e) { alert(e.message); }
  },
  pintar(el) {
    const d = this.d; if (!d) return;
    const u = d.ultimo, ok = u && !u.error;
    el.innerHTML = `<div class="card"><div class="row"><strong>Respaldos automáticos cifrados</strong><button class="pri" onclick="Respaldo.ahora()">Crear respaldo ahora</button></div>
      <p>${d.fraseConfigurada ? '' : '⚠️ <b>No hay frase de respaldo configurada.</b> '}Estado: ${ok ? `✅ último respaldo <b>${esc(new Date(u.fecha).toLocaleString('es-PE'))}</b>` : u && u.error ? `⚠️ <b>falló el último intento:</b> ${esc(u.error)}` : '⚠️ aún no hay respaldos'}${u && u.extra ? ` · copia en carpeta extra: ${esc(u.extra)}` : ''}</p>
      <p class="mu" style="font-size:15px">Se respalda solo: al iniciar y cada 4 h si hubo cambios (y al cerrar el programa). Los archivos <b>.cerp</b> están cifrados con tu frase de respaldo. Se conservan: todo de los últimos 3 días, uno por día hasta 30 días y uno por mes hasta 12 meses. Cambios sin respaldar: <b>${d.cambiosPendientes}</b>.</p>
      <p class="mu" style="font-size:15px">Carpeta: <code>${esc(d.carpeta)}</code><br>Copia extra: ${d.carpetaExtra ? '<code>' + esc(d.carpetaExtra) + '</code>' : 'no configurada. <b>Recomendado:</b> apunta ERP_BACKUP_DIR2 a un USB o carpeta sincronizada (ver docs/DESPLIEGUE.md); un respaldo en el mismo equipo no protege si el equipo se pierde.'}</p>
      ${d.archivos.length ? `<div class="wrap"><table><tr><th>Archivo</th><th>Fecha</th><th>Tamaño</th><th></th></tr>${d.archivos.slice(0, 30).map(a => `<tr><td>${esc(a.nombre)}</td><td>${esc(new Date(a.fecha).toLocaleString('es-PE'))}</td><td>${this.fmt(a.bytes)}</td><td><a href="/api/respaldos/${encodeURIComponent(a.nombre)}" download>Descargar</a></td></tr>`).join('')}</table></div>` : ''}</div>
    <div class="card"><strong>Restaurar</strong><p class="mu" style="font-size:15px">Por seguridad se hace desde el equipo del servidor, con el programa detenido: <code>node tools/restaurar.js ruta/al/respaldo.cerp</code> (pide la frase). Lo actual no se borra: se guarda aparte.</p></div>
    <div class="card"><strong>Importar datos de la versión anterior</strong><p class="mu" style="font-size:15px">Si usaste la versión que guardaba en el navegador, carga aquí su respaldo <code>.json</code>. Se agrega sin borrar lo existente. (El registro de auditoría antiguo no se importa porque no era confiable.)</p><input type="file" accept=".json" onchange="Respaldo.importar(this.files[0])"></div>`;
  }
};
App.register({ id: 'respaldo', title: 'Respaldo', menu: true, icon: '💾', order: 9, render(el) { el.innerHTML = '<p class="mu">Cargando…</p>'; Respaldo.cargar(); } });
