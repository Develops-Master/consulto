// Pruebas del bloque 6: escalas, reglas de "sin mejoría", revisiones del plan y cuestionarios por enlace (portal del paciente)
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const E = require('../js/modules/escalas'), ML = require('../js/modules/medicion-logica');
const { crearServidor } = require('../server/server');

const t = (test, fecha, puntaje, extra = {}) => ({ id: test + fecha, test, fecha, puntaje, creado: fecha + 'T10:00', ...extra });

test('escalas: puntaje, niveles y validación', () => {
  assert.equal(E.puntaje('pcl', Array(20).fill(4)), 80); assert.equal(E.nivel('pcl', 32), 'Bajo el punto de corte'); assert.match(E.nivel('pcl', 33), /posible TEPT/);
  assert.equal(E.puntaje('ors', [8, 7, 9, 6]), 30); assert.match(E.nivel('ors', 24), /clínico/); assert.equal(E.nivel('ors', 25), 'Rango no clínico');
  assert.equal(E.puntaje('srs', [10, 10, 10, 10]), 40); assert.match(E.nivel('srs', 35), /alianza/);
  assert.equal(E.puntaje('ros', [4, 4, 4, 4, 4, 1, 1, 1, 1, 1]), 40, 'Rosenberg invierte los ítems 6 a 10');
  assert.equal(E.puntaje('phq', [3, 3, 3, 3, 3, 3, 3, 3, 3]), 27);
  assert.equal(E.validar('phq', Array(9).fill(0)), null); assert.ok(E.validar('phq', Array(8).fill(0)), 'faltan ítems');
  assert.ok(E.validar('phq', [0, 0, 0, 0, 0, 0, 0, 0, 4]), 'valor fuera de rango'); assert.ok(E.validar('ors', [0, 0, 0, 11]), 'ORS llega hasta 10');
  assert.ok(E.validar('phq', [0, 0, 0, 0, 0, 0, 0, 0, '1']), 'texto no es número'); assert.ok(E.validar('inventada', []));
  for (const k of Object.keys(E.T)) { const d = E.T[k]; assert.equal(d.niv[d.niv.length - 1][0], d.max + 1, k + ': los niveles cubren todo el rango'); }
});

test('sin mejoría: reglas por escala', () => {
  const ev = (tests, revs = [], hoy = '2026-10-19', activo = true) => ML.estado({ tests, revs, activo }, hoy);
  // PHQ-9: 16 → 15 en 10 semanas = sin mejoría
  let s = ev([t('phq', '2026-08-01', 16), t('phq', '2026-10-10', 15)]);
  assert.equal(s.escalas[0].estado, 'sin_mejoria'); assert.equal(s.alertas[0].tipo, 'sin_mejoria'); assert.equal(s.alertas[0].revisable, true);
  // Mismo cambio pero a las 6 semanas: todavía en curso
  assert.equal(ev([t('phq', '2026-09-01', 16), t('phq', '2026-10-13', 15)]).escalas[0].estado, 'en_curso');
  // Mejoría real (≥5 puntos) a las 10 semanas
  s = ev([t('phq', '2026-08-01', 16), t('phq', '2026-10-10', 10)]); assert.equal(s.escalas[0].estado, 'mejora'); assert.equal(s.hayAlgo, false);
  // Llegó al rango no clínico: no se avisa aunque la mejoría sea pequeña
  assert.equal(ev([t('phq', '2026-08-01', 7), t('phq', '2026-10-10', 4)]).escalas[0].estado, 'meta');
  // Empeoramiento: avisa sin esperar las 8 semanas
  s = ev([t('phq', '2026-10-01', 8), t('phq', '2026-10-15', 14)]); assert.equal(s.alertas[0].tipo, 'empeora');
  // Escalas donde subir es mejorar (ORS) y umbrales distintos (PCL-5: 10 puntos; GAD-7: 4)
  assert.equal(ev([t('ors', '2026-08-01', 14), t('ors', '2026-10-10', 16)]).escalas[0].estado, 'sin_mejoria');
  assert.equal(ev([t('ors', '2026-08-01', 14), t('ors', '2026-10-10', 20)]).escalas[0].estado, 'mejora');
  assert.equal(ev([t('pcl', '2026-08-01', 50), t('pcl', '2026-10-10', 44)]).escalas[0].estado, 'sin_mejoria');
  assert.equal(ev([t('pcl', '2026-08-01', 50), t('pcl', '2026-10-10', 38)]).escalas[0].estado, 'mejora');
  assert.equal(ev([t('gad', '2026-08-01', 12), t('gad', '2026-10-10', 8)]).escalas[0].estado, 'mejora');
  // Solo una medición: sin segunda medición tras 8 semanas → aviso de reaplicar; antes, nada
  assert.equal(ev([t('phq', '2026-08-01', 15)]).alertas[0].tipo, 'reaplicar'); assert.equal(ev([t('phq', '2026-10-01', 15)]).hayAlgo, false);
  // Medición vieja (más de 28 días) en un paciente activo → reaplicar
  assert.equal(ev([t('phq', '2026-09-01', 16), t('phq', '2026-09-15', 12)]).alertas[0].tipo, 'reaplicar');
  // Rosenberg solo se grafica: nunca genera avisos
  assert.equal(ev([t('ros', '2026-06-01', 20), t('ros', '2026-10-10', 20)]).hayAlgo, false);
  // Paciente en alta o abandono: no hay avisos
  assert.equal(ev([t('phq', '2026-08-01', 16), t('phq', '2026-10-10', 15)], [], '2026-10-19', false).hayAlgo, false);
});

test('revisión del plan reinicia el conteo; la alianza (SRS) avisa', () => {
  const tests = [t('phq', '2026-07-01', 18), t('phq', '2026-09-15', 17)], rev = { test: 'phq', fecha: '2026-09-16' };
  assert.equal(ML.estado({ tests, revs: [], activo: true }, '2026-10-19').alertas[0].tipo, 'sin_mejoria');
  assert.equal(ML.estado({ tests, revs: [rev], activo: true }, '2026-10-19').hayAlgo, false, 'tras revisar el plan, empiezan 8 semanas nuevas');
  // Después de la revisión llega otra medición y a las 8 semanas sigue sin cambiar → vuelve a avisar
  const mas = [...tests, t('phq', '2026-11-20', 17)];
  assert.equal(ML.estado({ tests: mas, revs: [rev], activo: true }, '2026-11-21').alertas[0].tipo, 'sin_mejoria');
  assert.equal(ML.estado({ tests: [...tests, t('phq', '2026-10-25', 11)], revs: [rev], activo: true }, '2026-10-26').escalas[0].estado, 'mejora');
  // SRS: total < 36 o un ítem < 9
  const srs = (resp, f = '2026-10-18') => ({ id: 'srs' + f, test: 'srs', fecha: f, resp, puntaje: resp.reduce((a, b) => a + b, 0), creado: f });
  assert.equal(ML.estado({ tests: [srs([10, 10, 10, 10])], revs: [], activo: true }, '2026-10-19').hayAlgo, false);
  assert.equal(ML.estado({ tests: [srs([10, 10, 8, 10])], revs: [], activo: true }, '2026-10-19').alertas[0].tipo, 'alianza', 'un ítem bajo 9');
  assert.equal(ML.estado({ tests: [srs([7, 7, 7, 7])], revs: [], activo: true }, '2026-10-19').alertas[0].tipo, 'alianza');
  assert.equal(ML.validarRev({ fecha: '2026-10-19', test: 'phq' }), null); assert.ok(ML.validarRev({ fecha: 'x', test: 'phq' })); assert.ok(ML.validarRev({ fecha: '2026-10-19', test: 'ros' }));
});

async function entorno(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-med-')), s = crearServidor({ dirDatos: dir, silencio: true, sinRespaldoAlCerrar: true, ...extra });
  await new Promise(ok => s.servidor.listen(0, '127.0.0.1', ok)); const base = 'http://127.0.0.1:' + s.servidor.address().port;
  const cliente = () => { let ck = ''; return async (m, u, body, h = {}) => { const r = await fetch(base + u, { method: m, headers: { 'X-ERP': '1', 'Content-Type': 'application/json', ...(ck ? { Cookie: ck } : {}), ...h }, body: body === undefined ? undefined : JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); if (sc) ck = sc.split(';')[0]; let j = null; let txt = ''; try { txt = await r.text(); j = JSON.parse(txt); } catch {} return { st: r.status, j, txt, r }; }; };
  return { s, base, dir, cliente, cerrar: () => s.cerrar() };
}
const rid = () => Math.random().toString(36).slice(2, 12);

test('servidor: revisiones del plan y enlaces para el paciente', async t => {
  const V = await entorno(); t.after(() => V.cerrar()); const A = V.cliente();
  assert.equal((await A('POST', '/api/setup', { usuario: 'dra', nombre: 'Dra', password: 'Clave-Segura-2026', fraseRespaldo: 'frase-de-respaldo-segura-123' })).st, 200);
  const pid = rid(); assert.equal((await A('POST', '/api/r/pacientes', { id: pid, nombre: 'Marta Secreta Quispe' })).st, 201);

  // revisiones del plan: validación y permisos
  assert.equal((await A('POST', '/api/r/revisionesplan', { id: rid(), pid, test: 'phq', fecha: '2026-10-19', nota: 'Se agrega activación conductual' })).st, 201);
  assert.equal((await A('POST', '/api/r/revisionesplan', { id: rid(), pid, test: 'ros', fecha: '2026-10-19' })).st, 422);
  assert.equal((await A('POST', '/api/r/revisionesplan', { id: rid(), pid, test: 'phq', fecha: 'hoy' })).st, 422);
  const rec = await A('POST', '/api/usuarios', { usuario: 'recep', nombre: 'Recepción', rol: 'recepcion' }); const R = V.cliente();
  await R('POST', '/api/login', { usuario: 'recep', password: rec.j.claveTemporal }); await R('POST', '/api/password', { actual: rec.j.claveTemporal, nueva: 'NuevaClave-2026' });
  assert.equal((await R('GET', '/api/bootstrap')).j.datos.revisionesplan, undefined, 'recepción no ve revisiones');
  assert.equal((await R('POST', '/api/r/revisionesplan', { id: rid(), pid, test: 'phq', fecha: '2026-10-19' })).st, 403);
  assert.equal((await R('POST', '/api/enlaces', { pid, tests: ['phq'], momento: 'Seguimiento' })).st, 403, 'recepción no crea enlaces clínicos');
  assert.equal((await R('GET', `/api/enlaces/${pid}`)).st, 403);

  // crear enlace: validaciones
  assert.equal((await A('POST', '/api/enlaces', { pid: 'noexiste1', tests: ['phq'], momento: 'Seguimiento' })).st, 422);
  assert.equal((await A('POST', '/api/enlaces', { pid, tests: [], momento: 'Seguimiento' })).st, 400);
  assert.equal((await A('POST', '/api/enlaces', { pid, tests: ['inventada'], momento: 'Seguimiento' })).st, 400);
  assert.equal((await A('POST', '/api/enlaces', { pid, tests: ['phq'], momento: 'Mañana' })).st, 400);
  const ok = await A('POST', '/api/enlaces', { pid, tests: ['phq', 'gad'], momento: 'Seguimiento', dias: 7 }); assert.equal(ok.st, 201); const tok = ok.j.token; assert.ok(tok.length >= 20);

  // el token no se guarda en claro
  const crudo = fs.readFileSync(path.join(V.dir, 'erp.db')).toString('latin1') + (fs.existsSync(path.join(V.dir, 'erp.db-wal')) ? fs.readFileSync(path.join(V.dir, 'erp.db-wal')).toString('latin1') : '');
  assert.ok(!crudo.includes(tok), 'solo se guarda el hash del token');

  // portal (sin sesión)
  const P = V.cliente();
  assert.equal((await P('GET', '/api/portal/' + 'x'.repeat(30))).st, 404, 'token inexistente');
  assert.equal((await P('GET', '/api/portal/corto')).st, 404);
  const pg = await fetch(V.base + '/r/' + tok); assert.equal(pg.status, 200); assert.match(await pg.text(), /responder\.js/, 'sirve la página del paciente');
  const g = await P('GET', '/api/portal/' + tok); assert.equal(g.st, 200); assert.deepEqual(g.j.escalas.map(e => e.k), ['phq', 'gad']); assert.equal(g.j.escalas[0].it.length, 9);
  assert.ok(!g.txt.includes('Marta') && !g.txt.includes(pid), 'el portal no revela datos del paciente');
  // respuestas inválidas no consumen el enlace
  assert.equal((await P('POST', '/api/portal/' + tok, { resp: { phq: Array(9).fill(0) } })).st, 400, 'falta gad');
  assert.equal((await P('POST', '/api/portal/' + tok, { resp: { phq: Array(9).fill(9), gad: Array(7).fill(0) } })).st, 400);
  assert.equal((await P('POST', '/api/portal/' + tok, {})).st, 400);
  // respuestas válidas: el servidor calcula el puntaje y marca el origen; ítem 9 positivo → crisis
  const env = await P('POST', '/api/portal/' + tok, { resp: { phq: [1, 1, 1, 1, 1, 1, 1, 1, 2], gad: Array(7).fill(1) }, puntaje: 0 });
  assert.equal(env.st, 200); assert.equal(env.j.crisis, true);
  const tests = (await A('GET', '/api/bootstrap')).j.datos.tests; assert.equal(tests.length, 2);
  const phq = tests.find(x => x.test === 'phq'); assert.equal(phq.puntaje, 10); assert.equal(phq.nivel, 'Moderada'); assert.equal(phq.origen, 'enlace'); assert.equal(phq.momento, 'Seguimiento'); assert.equal(phq.pid, pid);
  assert.equal((await P('POST', '/api/portal/' + tok, { resp: { phq: Array(9).fill(0), gad: Array(7).fill(0) } })).st, 404, 'un solo uso');
  assert.equal((await P('GET', '/api/portal/' + tok)).st, 404);
  assert.equal((await A('GET', `/api/enlaces/${pid}`)).j.length, 0, 'ya no está pendiente');
  // la auditoría registra al paciente, no a un usuario
  const aud = (await A('GET', '/api/auditoria')).j.eventos.filter(e => /respondió por enlace/.test(e.accion)); assert.equal(aud.length, 2); assert.equal(aud[0].usuario, 'paciente (enlace)'); assert.equal(aud[0].pid, pid);
  assert.equal((await A('GET', '/api/auditoria/verificar')).j.ok, true);

  // vencimiento y anulación
  const e2 = await A('POST', '/api/enlaces', { pid, tests: ['ors'], momento: 'Seguimiento' });
  V.s.base.db.prepare('UPDATE enlaces SET vence=? WHERE id=?').run(Date.now() - 1000, e2.j.id);
  assert.equal((await P('GET', '/api/portal/' + e2.j.token)).st, 404, 'enlace vencido');
  const e3 = await A('POST', '/api/enlaces', { pid, tests: ['srs'], momento: 'Seguimiento' });
  assert.equal((await A('GET', `/api/enlaces/${pid}`)).j.length, 1); assert.equal((await A('DELETE', `/api/enlaces/${e3.j.id}`)).st, 200);
  assert.equal((await P('GET', '/api/portal/' + e3.j.token)).st, 404, 'enlace anulado');
  // al borrar al paciente se borran sus enlaces
  const e4 = await A('POST', '/api/enlaces', { pid, tests: ['phq'], momento: 'Inicio' });
  assert.equal((await A('DELETE', `/api/r/pacientes/${pid}`)).st, 200); assert.equal((await P('GET', '/api/portal/' + e4.j.token)).st, 404);
  // dirección pública: solo https (o localhost)
  assert.equal((await A('POST', '/api/ajustes', { urlPublica: 'http://consultorio.pe' })).st, 400); assert.equal((await A('POST', '/api/ajustes', { urlPublica: 'https://consultorio.pe/' })).j.urlPublica, 'https://consultorio.pe');
  assert.equal((await A('GET', '/api/auditoria/verificar')).j.ok, true);
});

test('servidor: el portal limita intentos y no actúa como administrador en modo sin login', async t => {
  const V = await entorno({ sinLogin: true }); t.after(() => V.cerrar()); const A = V.cliente(), P = V.cliente();
  const pid = rid(); assert.equal((await A('POST', '/api/r/pacientes', { id: pid, nombre: 'Paciente Local' })).st, 201);
  const e = await A('POST', '/api/enlaces', { pid, tests: ['phq'], momento: 'Inicio' });
  assert.equal((await P('POST', '/api/portal/' + e.j.token, { resp: { phq: Array(9).fill(0) } })).st, 200);
  const aud = (await A('GET', '/api/auditoria')).j.eventos.find(x => /respondió por enlace/.test(x.accion)); assert.equal(aud.usuario, 'paciente (enlace)'); assert.ok(!aud.uid, 'no se atribuye al administrador');
  let ultimo = 0; for (let i = 0; i < 40; i++) ultimo = (await P('GET', '/api/portal/' + 'z'.repeat(30))).st; assert.equal(ultimo, 429, 'tope de intentos por IP');
});
