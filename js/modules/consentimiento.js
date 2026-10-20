// Módulo Consentimiento informado: texto, firma manuscrita digital y registro por paciente
const Consent = {
  repo: App.repo('consentimientos'), firmado: false,
  TEXTO: 'Declaro haber sido informado/a de forma clara sobre la evaluación y el tratamiento terapéutico propuesto, sus beneficios y posibles molestias, y autorizo su realización. Autorizo además, de manera previa, libre, expresa, informada e inequívoca, el tratamiento de mis datos personales y de salud (datos sensibles) para mi atención, seguimiento y registro en mi historia clínica, conforme a la Ley N.º 29733. Puedo ejercer mis derechos de acceso, rectificación, cancelación y oposición solicitándolo al consultorio.',
  ultimo: pid => Consent.repo.all().filter(c => c.pid === pid).sort((a, b) => b.creado.localeCompare(a.creado))[0],
  card(pid) {
    const c = this.ultimo(pid);
    return `<div class="card"><div class="row"><strong>Consentimiento informado</strong><span>${c ? `<button onclick="Consent.ver('${c.id}')">Ver / imprimir</button> ` : ''}<button class="${c ? '' : 'pri'}" onclick="Consent.form('${pid}')">${c ? 'Nuevo' : 'Registrar'} consentimiento</button></span></div>` +
      (c ? `<p>✅ Firmado el <b>${esc(c.fecha)}</b> por ${esc(c.firmante)} (${esc(c.relacion)})</p>` : '<p class="mu">⚠️ Pendiente: aún no hay consentimiento firmado.</p>') + '</div>';
  },
  form(pid) {
    const p = Pacientes.repo.get(pid);
    abrir(`<h3>Consentimiento informado</h3><div class="mu" style="max-height:130px;overflow:auto;font-size:15px;border:1px solid var(--bd);border-radius:8px;padding:8px">${esc(this.TEXTO)}</div>
      <p class="mu" style="font-size:14px">Texto modelo: revísalo con un asesor legal antes de usarlo con pacientes.</p>
      <label><input id="c_ok" type="checkbox" style="width:auto"> El paciente (o su representante) lee y acepta lo anterior</label>
      <div class="f2"><div><label>Nombre del firmante</label><input id="c_n" value="${esc(p.nombre)}"></div><div><label>Relación</label><select id="c_r"><option>Paciente</option><option>Representante legal</option></select></div></div>
      <label>Firma (con dedo o mouse) <a href="#" onclick="Consent.initFirma();return false">borrar</a></label>
      <canvas id="firma" width="400" height="150" style="width:100%;border:1px solid var(--bd);border-radius:8px;background:#fff;touch-action:none"></canvas>
      <div class="row" style="margin-top:14px"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Consent.guardar('${pid}')">Guardar</button></div>`);
    this.initFirma();
  },
  initFirma() {
    const c = $('firma'), x = c.getContext('2d'); this.firmado = false; let d = false;
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.lineWidth = 2; x.lineCap = 'round'; x.strokeStyle = '#000';
    const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
    c.onpointerdown = e => { d = true; this.firmado = true; const [a, b] = pos(e); x.beginPath(); x.moveTo(a, b); c.setPointerCapture(e.pointerId); };
    c.onpointermove = e => { if (!d) return; const [a, b] = pos(e); x.lineTo(a, b); x.stroke(); };
    c.onpointerup = () => { d = false; };
  },
  guardar(pid) {
    if (!$('c_ok').checked) return alert('Debe marcarse la aceptación');
    const n = $('c_n').value.trim(); if (!n) return alert('Escribe el nombre del firmante');
    if (!this.firmado) return alert('Falta la firma');
    this.repo.save({ pid, fecha: today(), firmante: n, relacion: $('c_r').value, firma: $('firma').toDataURL('image/png'), texto: this.TEXTO, version: 'v1' });
    cerrar(); App.render();
  },
  img: c => c.firma && c.firma.startsWith('data:image/png;base64,') ? `<img src="${esc(c.firma)}" style="max-width:100%;max-height:120px;background:#fff;border:1px solid #999;border-radius:6px">` : '',
  ver(id) {
    const c = this.repo.get(id); if (!c) return;
    abrir(`<h3>Consentimiento · ${esc(c.fecha)}</h3><p style="font-size:15px">${esc(c.texto)}</p>${this.img(c)}<p>${esc(c.firmante)} (${esc(c.relacion)})</p>
      <div class="row"><button onclick="cerrar()">Cerrar</button><button class="pri" onclick="Consent.imprimir('${id}')">Imprimir / PDF</button></div>`);
  },
  imprimir(id) {
    const c = this.repo.get(id), p = Pacientes.repo.get(c.pid) || {}; cerrar();
    Reportes.imprimir(`<h1>Consentimiento informado</h1><p>Paciente: <b>${esc(p.nombre)}</b> · DNI ${esc(p.doc)}</p><p>${esc(c.texto)}</p>${this.img(c)}<p>Firmante: ${esc(c.firmante)} (${esc(c.relacion)})<br>Fecha: ${esc(c.fecha)}</p>`);
  }
};
