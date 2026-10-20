// Definición y puntaje de las escalas. Fuente única: la usan el navegador (tests.js), la página del paciente
// (responder.js) y el servidor (para calcular el puntaje de lo que el paciente responde por enlace).
// Rosenberg, PHQ-9, GAD-7 y PCL-5 son de uso libre. ORS y SRS (S. Miller / B. Duncan) son gratuitas para clínicos
// individuales con licencia en scottdmiller.com: revisa sus términos. La redacción de los ítems es una adaptación:
// si tienes la versión oficial en español, sustituye los textos (no cambies el orden ni la cantidad de ítems).
const Escalas = {
  FREC: [[0, 'Ningún día'], [1, 'Varios días'], [2, 'Más de la mitad de los días'], [3, 'Casi todos los días']],
  D010: Array.from({ length: 11 }, (_, i) => [i, String(i)]),
  T: {
    ros: { nom: 'Rosenberg · Autoestima', corto: 'Rosenberg', max: 40, mejor: 'alto', inv: [5, 6, 7, 8, 9], niv: [[26, 'Baja'], [30, 'Media'], [41, 'Elevada']],
      ins: 'Indique qué tan de acuerdo está con cada afirmación.', op: [[1, 'Muy en desacuerdo'], [2, 'En desacuerdo'], [3, 'De acuerdo'], [4, 'Muy de acuerdo']],
      it: ['Siento que soy una persona digna de aprecio, al menos en igual medida que los demás.', 'Estoy convencido/a de que tengo cualidades buenas.', 'Soy capaz de hacer las cosas tan bien como la mayoría de la gente.', 'Tengo una actitud positiva hacia mí mismo/a.', 'En general, estoy satisfecho/a de mí mismo/a.', 'Siento que no tengo mucho de lo que estar orgulloso/a.', 'En general, me inclino a pensar que soy un fracasado/a.', 'Me gustaría poder sentir más respeto por mí mismo/a.', 'Hay veces que realmente pienso que soy un inútil.', 'A veces creo que no soy buena persona.'] },
    phq: { nom: 'PHQ-9 · Depresión', corto: 'PHQ-9', max: 27, mejor: 'bajo', inv: [], niv: [[5, 'Mínima'], [10, 'Leve'], [15, 'Moderada'], [20, 'Moderadamente severa'], [28, 'Severa']],
      ins: 'Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?',
      it: ['Poco interés o placer en hacer las cosas', 'Se ha sentido decaído/a, deprimido/a o sin esperanzas', 'Dificultad para dormir o permanecer dormido/a, o ha dormido demasiado', 'Se ha sentido cansado/a o con poca energía', 'Con poco apetito o ha comido en exceso', 'Se ha sentido mal consigo mismo/a, o que es un fracaso, o que ha quedado mal con su familia', 'Dificultad para concentrarse (leer, ver televisión)', 'Se ha movido o hablado tan lento que otros podrían notarlo, o al contrario, ha estado muy inquieto/a o agitado/a', 'Pensamientos de que estaría mejor muerto/a o de lastimarse de alguna manera'] },
    gad: { nom: 'GAD-7 · Ansiedad', corto: 'GAD-7', max: 21, mejor: 'bajo', inv: [], niv: [[5, 'Mínima'], [10, 'Leve'], [15, 'Moderada'], [22, 'Severa']],
      ins: 'Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?',
      it: ['Sentirse nervioso/a, ansioso/a o muy alterado/a', 'No poder dejar de preocuparse o no poder controlar la preocupación', 'Preocuparse demasiado por diferentes cosas', 'Dificultad para relajarse', 'Estar tan inquieto/a que es difícil permanecer sentado/a', 'Molestarse o ponerse irritable fácilmente', 'Sentir miedo como si algo terrible pudiera pasar'] },
    pcl: { nom: 'PCL-5 · Estrés postraumático', corto: 'PCL-5', max: 80, mejor: 'bajo', inv: [], niv: [[33, 'Bajo el punto de corte'], [81, 'Sobre el punto de corte (33): posible TEPT']],
      ins: 'Piense en la experiencia estresante que lo/la trajo a consulta. En el último mes, ¿cuánto le molestó cada uno de estos problemas?',
      op: [[0, 'Nada en absoluto'], [1, 'Un poco'], [2, 'Moderadamente'], [3, 'Bastante'], [4, 'Extremadamente']],
      it: ['Recuerdos repetidos, perturbadores e indeseados de la experiencia', 'Sueños repetidos y perturbadores sobre la experiencia', 'De repente sentir o actuar como si la experiencia estuviera ocurriendo de nuevo', 'Sentirse muy molesto/a cuando algo le recordó la experiencia', 'Tener reacciones físicas fuertes (palpitaciones, sudor, falta de aire) cuando algo le recordó la experiencia', 'Evitar recuerdos, pensamientos o sentimientos relacionados con la experiencia', 'Evitar personas, lugares, conversaciones, actividades u objetos que le recuerdan la experiencia', 'Dificultad para recordar partes importantes de la experiencia', 'Creencias negativas fuertes sobre usted, otras personas o el mundo', 'Culparse a sí mismo/a o a otros por la experiencia o por lo que ocurrió después', 'Sentimientos negativos fuertes: miedo, horror, enojo, culpa o vergüenza', 'Pérdida de interés en actividades que antes disfrutaba', 'Sentirse distante o alejado/a de otras personas', 'Dificultad para sentir emociones positivas (felicidad, cariño)', 'Irritabilidad, arrebatos de enojo o actuar de forma agresiva', 'Asumir demasiados riesgos o hacer cosas que podrían causarle daño', 'Estar en alerta máxima, vigilante o en guardia', 'Sentirse nervioso/a o sobresaltarse con facilidad', 'Dificultad para concentrarse', 'Dificultad para conciliar o mantener el sueño'] },
    ors: { nom: 'ORS · Escala de resultado', corto: 'ORS', max: 40, mejor: 'alto', inv: [], proceso: false, niv: [[25, 'Rango clínico (bajo el punto de corte 25)'], [41, 'Rango no clínico']],
      ins: 'Piense en la última semana, incluido hoy, y marque cómo se ha sentido en cada área. Cuanto más alto el número, mejor (0 = lo peor, 10 = lo mejor).', op: null, d010: true,
      it: ['Individualmente: su bienestar personal (0 = muy mal, 10 = muy bien)', 'Interpersonalmente: su familia y relaciones cercanas (0 = muy mal, 10 = muy bien)', 'Socialmente: trabajo, estudios y amistades (0 = muy mal, 10 = muy bien)', 'En general: su sensación general de bienestar (0 = muy mal, 10 = muy bien)'] },
    srs: { nom: 'SRS · Alianza en la sesión', corto: 'SRS', max: 40, mejor: 'alto', inv: [], proceso: true, niv: [[36, 'Posible dificultad en la alianza (bajo 36)'], [41, 'Alianza adecuada']],
      ins: 'Marque cómo fue la sesión de hoy. Cuanto más alto el número, mejor (0 = lo peor, 10 = lo mejor). Sus respuestas ayudan a mejorar la terapia.', op: null, d010: true,
      it: ['Relación: me sentí escuchado/a, comprendido/a y respetado/a (0 = nada, 10 = totalmente)', 'Metas y temas: trabajamos en lo que yo quería trabajar y hablar (0 = nada, 10 = totalmente)', 'Enfoque: la forma de trabajar del terapeuta es adecuada para mí (0 = nada, 10 = totalmente)', 'En general: la sesión de hoy fue adecuada para mí (0 = nada, 10 = totalmente)'] }
  },
  opciones(k) { const t = this.T[k]; return t.d010 ? this.D010 : t.op || this.FREC; },
  puntaje(k, r) { const t = this.T[k], o = this.opciones(k); return r.reduce((a, v, i) => a + (t.inv.includes(i) ? o[0][0] + o[o.length - 1][0] - v : v), 0); },
  nivel(k, p) { return this.T[k].niv.find(([lim]) => p < lim)[1]; },
  // Valida un arreglo de respuestas (la usa el servidor con lo que envía el paciente). Devuelve un mensaje de error o null.
  validar(k, r) {
    const t = this.T[k]; if (!t) return 'Escala desconocida';
    if (!Array.isArray(r) || r.length !== t.it.length) return 'Faltan respuestas';
    const o = this.opciones(k).map(x => x[0]);
    return r.every(v => Number.isInteger(v) && o.includes(v)) ? null : 'Respuesta no válida';
  }
};
if (typeof module !== 'undefined' && module.exports) module.exports = Escalas;
