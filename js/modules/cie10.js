// Referencias rápidas de CIE-10 para trastornos mentales; no es un catálogo completo.
const CIE10 = {
  OMS: 'https://icd.who.int/browse10/2019/en',
  FRECUENTES: [
    ['F20.0', 'Esquizofrenia paranoide'],
    ['F31.3', 'Trastorno bipolar, episodio depresivo leve o moderado'],
    ['F32.0', 'Episodio depresivo leve'],
    ['F32.1', 'Episodio depresivo moderado'],
    ['F32.2', 'Episodio depresivo grave sin síntomas psicóticos'],
    ['F33.0', 'Trastorno depresivo recurrente, episodio actual leve'],
    ['F33.1', 'Trastorno depresivo recurrente, episodio actual moderado'],
    ['F40.0', 'Agorafobia'],
    ['F40.1', 'Fobias sociales'],
    ['F41.0', 'Trastorno de pánico'],
    ['F41.1', 'Trastorno de ansiedad generalizada'],
    ['F41.2', 'Trastorno mixto ansioso-depresivo'],
    ['F42.2', 'Trastorno obsesivo-compulsivo, pensamientos y actos mixtos'],
    ['F43.1', 'Trastorno de estrés postraumático'],
    ['F43.2', 'Trastornos de adaptación'],
    ['F50.9', 'Trastorno de la conducta alimentaria, no especificado'],
    ['F51.0', 'Insomnio no orgánico'],
    ['F60.3', 'Trastorno de personalidad emocionalmente inestable'],
    ['F84.0', 'Autismo infantil'],
    ['F90.0', 'Trastorno de la actividad y de la atención']
  ],
  opciones() { return this.FRECUENTES.map(([codigo, nombre]) => `<option value="${codigo}" label="${nombre}"></option>`).join(''); }
};