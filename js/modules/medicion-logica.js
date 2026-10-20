// Lógica PURA de la medición continua de resultados (sin pantalla). La usan el navegador, el servidor (validación) y las pruebas.
// Es una AYUDA para el criterio clínico: avisa, no decide. Los valores de CFG son referencias habituales en la literatura
// (cambio mínimo relevante, punto de corte); ajústalos a tu criterio y protocolo.
const MedicionLogica = {
  SEMANAS: 8,          // sin mejoría: tras este tiempo desde la línea base (o desde la última revisión del plan)
  REAPLICAR_DIAS: 28,  // avisa si el paciente sigue activo y la escala no se aplica desde hace tanto
  // cambio: puntos mínimos para considerar mejoría o empeoramiento real · meta(p): ya está en rango no clínico
  // Rosenberg no figura: no hay un umbral de cambio aceptado, solo se grafica.
  CFG: {
    phq: { cambio: 5, meta: p => p < 5, corte: 5, mejor: 'bajo' },
    gad: { cambio: 4, meta: p => p < 5, corte: 5, mejor: 'bajo' },
    pcl: { cambio: 10, meta: p => p < 33, corte: 33, mejor: 'bajo' },
    ors: { cambio: 5, meta: p => p >= 25, corte: 25, mejor: 'alto' }
  },
  ALIANZA_TOTAL: 36, ALIANZA_ITEM: 9,   // SRS: total < 36 o algún ítem < 9 = conversar sobre la alianza
  dias(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); },
  orden: (a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.creado || '').localeCompare(b.creado || ''),
  // Positivo = mejoró
  mejora(k, desde, hasta) { return this.CFG[k].mejor === 'bajo' ? desde - hasta : hasta - desde; },

  // Evalúa UNA escala. tests = aplicaciones del paciente (todas las escalas), revs = revisiones del plan, hoy = 'YYYY-MM-DD'
  escala(k, tests, revs, hoy) {
    const c = this.CFG[k]; if (!c) return null;
    const a = (tests || []).filter(t => t.test === k && typeof t.puntaje === 'number').sort(this.orden); if (!a.length) return null;
    const ult = a[a.length - 1], rev = (revs || []).filter(r => r.test === k).map(r => r.fecha).sort().pop() || null;
    let base = { fecha: a[0].fecha, puntaje: a[0].puntaje, id: a[0].id }, posteriores = a.slice(1);
    if (rev) {
      // El plan se revisó: la cuenta de semanas se reinicia en esa fecha, tomando como punto de partida la última medición hasta entonces
      const ant = a.filter(t => t.fecha <= rev).pop();
      if (ant) { base = { fecha: rev, puntaje: ant.puntaje, id: ant.id }; posteriores = a.filter(t => t.fecha > rev && t.id !== ant.id); }
    }
    const r = { k, base, ult, n: a.length, revisado: rev, desdeUlt: this.dias(ult.fecha, hoy), mejora: null, semanas: null, estado: 'en_curso' };
    if (!posteriores.length) { // todavía no hay una segunda medición desde la línea base
      r.estado = c.meta(ult.puntaje) ? 'meta' : (this.dias(base.fecha, hoy) >= this.SEMANAS * 7 ? 'reaplicar' : 'en_curso');
      r.reaplicarYa = r.estado === 'reaplicar'; return r;
    }
    r.mejora = this.mejora(k, base.puntaje, ult.puntaje); r.semanas = this.dias(base.fecha, ult.fecha) / 7;
    if (c.meta(ult.puntaje)) r.estado = 'meta';
    else if (r.mejora <= -c.cambio) r.estado = 'empeora';
    else if (r.mejora >= c.cambio) r.estado = 'mejora';
    else r.estado = r.semanas >= this.SEMANAS ? 'sin_mejoria' : 'en_curso';
    r.reaplicarYa = r.estado !== 'meta' && r.desdeUlt >= this.REAPLICAR_DIAS;
    return r;
  },

  // Estado del paciente. d = { tests, revs, activo }. Solo genera alertas si el paciente está en tratamiento activo.
  estado(d, hoy) {
    const escalas = Object.keys(this.CFG).map(k => this.escala(k, d.tests, d.revs, hoy)).filter(Boolean), alertas = [];
    if (d.activo) {
      for (const e of escalas) {
        if (e.estado === 'sin_mejoria') alertas.push({ k: e.k, tipo: 'sin_mejoria', revisable: true });
        else if (e.estado === 'empeora') alertas.push({ k: e.k, tipo: 'empeora', revisable: true });
        else if (e.estado === 'reaplicar' || e.reaplicarYa) alertas.push({ k: e.k, tipo: 'reaplicar', revisable: false });
      }
      const srs = (d.tests || []).filter(t => t.test === 'srs' && Array.isArray(t.resp)).sort(this.orden).pop();
      if (srs && (srs.puntaje < this.ALIANZA_TOTAL || srs.resp.some(v => v < this.ALIANZA_ITEM))) alertas.push({ k: 'srs', tipo: 'alianza', revisable: false, fecha: srs.fecha });
    }
    return { escalas, alertas, hayAlgo: alertas.length > 0 };
  },
  // Validación de una revisión del plan (la usa el servidor). Devuelve un mensaje de error o null.
  validarRev(o) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.fecha || '')) return 'Fecha no válida';
    if (!this.CFG[o.test]) return 'Escala no válida';
    return null;
  }
};
if (typeof module !== 'undefined' && module.exports) module.exports = MedicionLogica;
