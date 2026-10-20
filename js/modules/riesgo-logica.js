// Lógica PURA del riesgo suicida (sin pantalla). La usan el navegador, el servidor (para validar) y las pruebas.
// Si cambias una regla aquí, cambia para todos a la vez: es la única fuente de verdad.
const RiesgoLogica = {
  NIVELES: ['Sin riesgo', 'Bajo', 'Moderado', 'Alto'],
  // Cómo se escribe el nivel en el campo "Riesgo" de la historia clínica
  FICHA: { 'Sin riesgo': 'Sin riesgo', Bajo: 'Riesgo bajo', Moderado: 'Riesgo moderado', Alto: 'Riesgo alto' },
  // Días máximos entre evaluaciones mientras la alerta siga activa
  REEVAL: { Alto: 7, Moderado: 14 },

  // Triage de la C-SSRS versión tamizaje (ítems 1 a 6). r = { q1..q6: boolean, q6r: boolean (conducta en los últimos 3 meses) }
  //   Alto: ítem 4 o 5 (intención), o conducta suicida en los últimos 3 meses
  //   Moderado: ítem 3 (método sin intención), o conducta suicida alguna vez (más de 3 meses atrás)
  //   Bajo: ítem 1 o 2 (deseo de morir / ideación sin método)
  nivel(r) {
    r = r || {};
    if (r.q4 || r.q5 || (r.q6 && r.q6r)) return 'Alto';
    if (r.q3 || r.q6) return 'Moderado';
    if (r.q1 || r.q2) return 'Bajo';
    return 'Sin riesgo';
  },
  conAlerta: nivel => nivel === 'Moderado' || nivel === 'Alto',
  dias(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); },
  ultima(evals) { return [...(evals || [])].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || '').localeCompare(a.creado || ''))[0] || null; },

  // Estado de un paciente. d = { evals: [], plan: {}|null, tests: [] } (solo de ese paciente), hoy = 'YYYY-MM-DD'
  estado(d, hoy) {
    const e = this.ultima(d.evals), nivel = e ? e.nivel_final : null;
    const phq = (d.tests || []).filter(t => t.test === 'phq' && t.resp && t.resp[8] > 0).sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null;
    const activa = !!e && e.alerta === 'activa' && this.conAlerta(nivel);
    const dias = e ? this.dias(e.fecha, hoy) : null, lim = this.REEVAL[nivel];
    const planFecha = d.plan ? (d.plan.revisado || d.plan.fecha) : null;
    // Pendiente si no hay evaluación, o si la última es anterior al test (el mismo día cuenta la hora de registro)
    const ideacionPendiente = phq && (!e || e.fecha < phq.fecha || (e.fecha === phq.fecha && (e.creado || '') < (phq.creado || ''))) ? phq : null;
    return {
      eval: e, nivel, activa, dias,
      reevaluar: activa && lim != null && dias > lim,
      sinPlan: activa && (!planFecha || planFecha < e.fecha),
      ideacionPendiente, hayAlgo: activa || !!ideacionPendiente
    };
  },
  // Validación (la usa el servidor al guardar). Devuelve un mensaje de error o null.
  validarEval(o) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.fecha || '')) return 'Fecha no válida';
    if (!this.NIVELES.includes(o.nivel) || !this.NIVELES.includes(o.nivel_final)) return 'Nivel de riesgo no válido';
    if (!o.q || typeof o.q !== 'object') return 'Faltan las respuestas del tamizaje';
    if (this.nivel(o.q) !== o.nivel) return 'El nivel sugerido no coincide con las respuestas del tamizaje';
    if (o.nivel !== o.nivel_final && !String(o.justificacion || '').trim()) return 'Si cambias el nivel sugerido, escribe la justificación';
    if (!['activa', 'resuelta', 'ninguna'].includes(o.alerta)) return 'Estado de alerta no válido';
    return null;
  },
  validarPlan(o) { return /^\d{4}-\d{2}-\d{2}$/.test(o.fecha || '') ? null : 'Fecha no válida'; }
};
if (typeof module !== 'undefined' && module.exports) module.exports = RiesgoLogica;
