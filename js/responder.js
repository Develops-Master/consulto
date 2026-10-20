// Página del paciente: responde los cuestionarios del enlace. No guarda nada en el navegador y no necesita cuenta.
(function () {
  const tok = location.pathname.split('/').pop(), P = document.getElementById('p');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const llamar = async (m, cuerpo) => {
    const r = await fetch('/api/portal/' + encodeURIComponent(tok), { method: m, headers: { 'Content-Type': 'application/json', 'X-ERP': '1' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const x = new Error((j && j.error) || 'No se pudo conectar. Inténtalo de nuevo.'); x.status = r.status; throw x; }
    return j;
  };
  const resp = {}; let datos, paso = 0;
  const fin = (titulo, html) => { P.innerHTML = `<h1>${titulo}</h1>${html}`; };
  function pantalla() {
    const e = datos.escalas[paso], total = datos.escalas.length, r = resp[e.k] || (resp[e.k] = []);
    P.innerHTML = `<p class="mu">${esc(datos.consultorio)}${datos.consultorio ? ' · ' : ''}Cuestionario ${paso + 1} de ${total}</p><h1>${esc(e.nom)}</h1><p>${esc(e.ins)}</p>` +
      e.it.map((t, i) => `<fieldset class="preg" id="f${i}"><legend>${i + 1}. ${esc(t)}</legend><div class="opts">${e.op.map(([v, l]) => `<label class="opc"><input type="radio" name="q${i}" value="${v}" ${r[i] === v ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></fieldset>`).join('') +
      `<p id="err" class="err" role="alert" hidden></p><div class="row" style="margin-top:16px">${paso ? '<button id="atras">← Anterior</button>' : '<span></span>'}<button class="pri" id="sig">${paso === total - 1 ? 'Enviar respuestas' : 'Siguiente →'}</button></div>`;
    window.scrollTo(0, 0);
    P.querySelectorAll('input[type=radio]').forEach(inp => inp.addEventListener('change', () => { r[+inp.name.slice(1)] = +inp.value; document.getElementById('f' + inp.name.slice(1)).classList.remove('falta'); document.getElementById('err').hidden = true; }));
    if (paso) document.getElementById('atras').onclick = () => { paso--; pantalla(); };
    document.getElementById('sig').onclick = async () => {
      const falta = e.it.findIndex((_, i) => r[i] === undefined || r[i] === null), er = document.getElementById('err');
      if (falta >= 0) { e.it.forEach((_, i) => document.getElementById('f' + i).classList.toggle('falta', r[i] === undefined)); er.hidden = false; er.textContent = 'Falta responder la pregunta ' + (falta + 1) + '.'; document.getElementById('f' + falta).scrollIntoView({ block: 'center' }); return; }
      if (paso < total - 1) { paso++; return pantalla(); }
      const b = document.getElementById('sig'); b.disabled = true; b.textContent = 'Enviando…';
      try { const o = await llamar('POST', { resp }); gracias(o.crisis); }
      catch (x) { b.disabled = false; b.textContent = 'Enviar respuestas'; er.hidden = false; er.textContent = x.message; }
    };
  }
  function gracias(crisis) {
    document.getElementById('crisis').hidden = !!crisis;
    fin('Gracias, tus respuestas se enviaron', '<p>Tus respuestas quedaron guardadas en tu ficha. Ya puedes cerrar esta página.</p>' + (crisis ? `<div class="crisis-box" role="alert"><b>Si estás pasando por un momento muy difícil, no tienes que estar a solas con eso.</b><br>Llama ahora a la <b>Línea 113, opción 5</b> (gratuita, 24 horas) o escribe por WhatsApp al <b>955 557 000</b>. Si estás en peligro inmediato: <b>SAMU 106</b> o <b>Policía 105</b>.<br>Además, avisa a tu terapeuta cuanto antes.</div>` : ''));
  }
  llamar('GET').then(d => { datos = d; pantalla(); }).catch(x => { document.getElementById('crisis').hidden = false; fin('Enlace no disponible', `<p>${esc(x.message)}</p>`); });
})();
