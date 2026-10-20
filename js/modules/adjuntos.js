// Módulo Adjuntos: informes, exámenes y documentos del paciente (se guardan cifrados en el servidor)
const Adjuntos = {
  repo: App.repo('adjuntos'), TIPOS: ['Informe', 'Examen', 'Documento', 'Otro'], MAX: 5 * 1024 * 1024,
  lista: pid => Adjuntos.repo.all().filter(a => a.pid === pid).sort((a, b) => b.fecha.localeCompare(a.fecha)),
  tam: n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB',
  card(pid) {
    const l = this.lista(pid);
    return `<div class="card"><div class="row"><strong>Adjuntos</strong><button class="pri" onclick="Adjuntos.form('${pid}')">+ Adjuntar archivo</button></div>` +
      (l.length ? `<div class="wrap"><table><tr><th>Fecha</th><th>Tipo</th><th>Archivo</th><th>Nota</th><th></th></tr>${l.map(a => `<tr><td>${esc(a.fecha)}</td><td>${esc(a.tipo)}</td><td>${esc(a.nombre)} <span class="mu" style="font-size:14px">${this.tam(a.tam || 0)}</span></td><td>${esc(a.nota)}</td><td style="white-space:nowrap"><button onclick="Adjuntos.bajar('${a.id}')">Descargar</button> <button class="del" onclick="Adjuntos.del('${a.id}')">✕</button></td></tr>`).join('')}</table></div>` : '<p class="mu">Adjunta informes, exámenes o documentos del paciente (PDF, imágenes, Word; máx. 5 MB).</p>') + '</div>';
  },
  form(pid) {
    abrir(`<h3>Adjuntar archivo</h3><label>Archivo (máx. 5 MB)</label><input id="a_f" type="file"><label>Tipo</label><select id="a_t">${this.TIPOS.map(t => `<option>${t}</option>`).join('')}</select>
      <label>Nota</label><input id="a_n" placeholder="Ej. Informe de neurología, 12/10">
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Adjuntos.guardar('${pid}')">Guardar</button></div>`);
  },
  guardar(pid) {
    const f = $('a_f').files[0]; if (!f) return alert('Elige un archivo');
    if (f.size > this.MAX) return alert('El archivo supera 5 MB');
    const tipo = $('a_t').value, nota = $('a_n').value.trim(), fr = new FileReader();
    fr.onload = () => {
      const now = new Date().toISOString(), meta = { id: uid(), pid, nombre: f.name, tipo, nota, mime: f.type || 'application/octet-stream', tam: f.size, fecha: today(), creado: now, actualizado: now, fecha_alta: today() };
      (App.cache.adjuntos ??= []).push(meta);
      App.enviar('POST', '/api/r/adjuntos', { ...meta, data: fr.result.split(',')[1] }, s => Object.assign(meta, { creado: s.creado, actualizado: s.actualizado, fecha_alta: s.fecha_alta }));
      cerrar(); App.render();
    };
    fr.onerror = () => alert('No se pudo leer el archivo'); fr.readAsDataURL(f);
  },
  async bajar(id) {
    try {
      const r = await api('GET', '/api/adjunto/' + id), b = atob(r.data), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([u], { type: r.mime })), a = document.createElement('a'); a.href = url; a.download = r.nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { alert('No se pudo descargar: ' + e.message); }
  },
  async del(id) { if (await confirmar('¿Eliminar este adjunto? Quedará una copia en la papelera del servidor.', 'Eliminar adjunto', 'Eliminar', true)) { this.repo.remove(id); App.render(); } }
};
