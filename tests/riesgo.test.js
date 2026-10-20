// Pruebas del módulo de riesgo suicida: reglas del tamizaje, alertas y permisos/validación en el servidor
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const RL = require('../js/modules/riesgo-logica');
const { crearServidor } = require('../server/server');

test('C-SSRS: el nivel sugerido sigue el triage del tamizaje', () => {
  const caso = (r, esperado) => assert.equal(RL.nivel(r), esperado, JSON.stringify(r));
  caso({}, 'Sin riesgo'); caso({ q1: false, q2: false, q6: false }, 'Sin riesgo');
  caso({ q1: true }, 'Bajo'); caso({ q1: true, q2: true }, 'Bajo');
  caso({ q1: true, q2: true, q3: true }, 'Moderado');
  caso({ q6: true, q6r: false }, 'Moderado');            // conducta suicida hace más de 3 meses
  caso({ q6: true, q6r: true }, 'Alto');                  // conducta en los últimos 3 meses
  caso({ q1: true, q2: true, q3: true, q4: true }, 'Alto');
  caso({ q1: true, q2: true, q5: true }, 'Alto');
  caso({ q1: true, q2: true, q3: true, q6: true, q6r: false }, 'Moderado');
});

test('estado del paciente: alerta, reevaluación, plan y PHQ-9 ítem 9', () => {
  const ev = (fecha, nivel, alerta, extra = {}) => ({ id: fecha, fecha, creado: fecha + 'T10:00', nivel, nivel_final: nivel, alerta, ...extra });
  assert.equal(RL.estado({ evals: [], plan: null, tests: [] }, '2026-10-19').hayAlgo, false);
  // Alto: alerta activa, sin plan y con más de 7 días
  let s = RL.estado({ evals: [ev('2026-10-01', 'Alto', 'activa')], plan: null, tests: [] }, '2026-10-19');
  assert.equal(s.activa, true); assert.equal(s.reevaluar, true); assert.equal(s.sinPlan, true); assert.equal(s.dias, 18);
  // Moderado dentro de 14 días y con plan revisado después de la evaluación
  s = RL.estado({ evals: [ev('2026-10-10', 'Moderado', 'activa')], plan: { fecha: '2026-10-01', revisado: '2026-10-11' }, tests: [] }, '2026-10-19');
  assert.equal(s.reevaluar, false); assert.equal(s.sinPlan, false);
  // Plan anterior a la evaluación = hay que revisarlo
  assert.equal(RL.estado({ evals: [ev('2026-10-10', 'Alto', 'activa')], plan: { fecha: '2026-09-01' }, tests: [] }, '2026-10-12').sinPlan, true);
  // Alerta levantada o riesgo bajo: no hay alerta
  assert.equal(RL.estado({ evals: [ev('2026-10-10', 'Alto', 'resuelta')], plan: null, tests: [] }, '2026-10-19').activa, false);
  assert.equal(RL.estado({ evals: [ev('2026-10-10', 'Bajo', 'ninguna')], plan: null, tests: [] }, '2026-10-19').activa, false);
  // Cuenta la evaluación más reciente
  s = RL.estado({ evals: [ev('2026-10-01', 'Alto', 'activa'), ev('2026-10-15', 'Bajo', 'ninguna')], plan: null, tests: [] }, '2026-10-19');
  assert.equal(s.activa, false); assert.equal(s.nivel, 'Bajo');
  // PHQ-9 con ítem 9 positivo y sin evaluación posterior
  const phq = (fecha, i9) => ({ test: 'phq', fecha, resp: [0, 0, 0, 0, 0, 0, 0, 0, i9] });
  assert.ok(RL.estado({ evals: [], plan: null, tests: [phq('2026-10-18', 1)] }, '2026-10-19').ideacionPendiente);
  assert.equal(RL.estado({ evals: [ev('2026-10-18', 'Bajo', 'ninguna')], plan: null, tests: [phq('2026-10-18', 1)] }, '2026-10-19').ideacionPendiente, null, 'evaluar el mismo día resuelve el aviso');
  assert.ok(RL.estado({ evals: [ev('2026-10-18', 'Bajo', 'ninguna')], plan: null, tests: [{ ...phq('2026-10-18', 1), creado: '2026-10-18T15:00' }] }, '2026-10-19').ideacionPendiente, 'un test posterior, el mismo día, vuelve a avisar');
  assert.equal(RL.estado({ evals: [], plan: null, tests: [phq('2026-10-18', 0)] }, '2026-10-19').hayAlgo, false);
});

test('servidor: permisos y validación de evaluaciones y plan de seguridad', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-rs-')), s = crearServidor({ dirDatos: dir, silencio: true, sinRespaldoAlCerrar: true });
  await new Promise(ok => s.servidor.listen(0, '127.0.0.1', ok)); const base = 'http://127.0.0.1:' + s.servidor.address().port;
  t.after(() => s.cerrar());
  const cliente = () => { let ck = ''; return async (m, u, body) => { const r = await fetch(base + u, { method: m, headers: { 'X-ERP': '1', 'Content-Type': 'application/json', ...(ck ? { Cookie: ck } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); if (sc) ck = sc.split(';')[0]; let j = null; try { j = await r.json(); } catch {} return { st: r.status, j }; }; };
  const id = () => Math.random().toString(36).slice(2, 12), A = cliente();
  assert.equal((await A('POST', '/api/setup', { usuario: 'dra', nombre: 'Dra', password: 'Clave-Segura-2026', fraseRespaldo: 'frase-de-respaldo-segura-123' })).st, 200);
  const pid = id(); assert.equal((await A('POST', '/api/r/pacientes', { id: pid, nombre: 'Paciente Riesgo' })).st, 201);
  const q = { q1: true, q2: true, q3: true, q4: false, q5: false, q6: false, q6r: false };
  const ev = (o = {}) => ({ id: id(), pid, fecha: '2026-10-19', q, nivel: 'Moderado', nivel_final: 'Moderado', alerta: 'activa', fr: [], prot: [], acciones: [], ...o });

  const buena = ev(); assert.equal((await A('POST', '/api/r/evalriesgo', buena)).st, 201);
  assert.equal((await A('POST', '/api/r/evalriesgo', ev({ nivel: 'Bajo', nivel_final: 'Bajo' }))).st, 422, 'el nivel sugerido no puede contradecir las respuestas');
  assert.equal((await A('POST', '/api/r/evalriesgo', ev({ nivel_final: 'Alto' }))).st, 422, 'cambiar el nivel exige justificación');
  assert.equal((await A('POST', '/api/r/evalriesgo', ev({ nivel_final: 'Alto', justificacion: 'Acceso a medios letales' }))).st, 201);
  assert.equal((await A('POST', '/api/r/evalriesgo', ev({ nivel_final: 'Inventado' }))).st, 422);
  assert.equal((await A('POST', '/api/r/evalriesgo', ev({ q: undefined }))).st, 422);
  assert.equal((await A('POST', '/api/r/evalriesgo', ev({ fecha: 'ayer' }))).st, 422);
  assert.equal((await A('POST', '/api/r/evalriesgo', ev({ alerta: 'quizás' }))).st, 422);
  assert.equal((await A('PATCH', `/api/r/evalriesgo/${buena.id}`, { alerta: 'resuelta', resuelta_nota: 'Crisis superada' })).st, 200, 'levantar la alerta');
  assert.equal((await A('PATCH', `/api/r/evalriesgo/${buena.id}`, { nivel_final: 'Bajo' })).st, 422, 'no se puede editar a un nivel sin justificar');
  assert.equal((await A('POST', '/api/r/planseguridad', { id: id(), pid, fecha: '2026-10-19', alerta: 'llamar a mi hermana', apoyo: 'Rosa 999' })).st, 201);
  assert.equal((await A('POST', '/api/r/planseguridad', { id: id(), pid, fecha: 'x' })).st, 422);

  // Recepción: no ve ni escribe nada de riesgo
  const rec = await A('POST', '/api/usuarios', { usuario: 'recep', nombre: 'Recepción', rol: 'recepcion' }); assert.equal(rec.st, 201);
  const R = cliente(); await R('POST', '/api/login', { usuario: 'recep', password: rec.j.claveTemporal });
  assert.equal((await R('POST', '/api/password', { actual: rec.j.claveTemporal, nueva: 'NuevaClave-2026' })).st, 200);
  const b = (await R('GET', '/api/bootstrap')).j.datos; assert.equal(b.evalriesgo, undefined); assert.equal(b.planseguridad, undefined);
  assert.equal((await R('POST', '/api/r/evalriesgo', ev())).st, 403); assert.equal((await R('POST', '/api/r/planseguridad', { id: id(), pid, fecha: '2026-10-19' })).st, 403);
  assert.equal((await R('PATCH', `/api/r/sesiones/${id()}`, { ideacion: true })).st, 404);

  // Borrar: solo admin; el paciente borrado arrastra sus evaluaciones a la papelera
  const bt = (await A('GET', '/api/bootstrap')).j.datos; assert.equal(bt.evalriesgo.length, 2); assert.equal(bt.planseguridad.length, 1);
  assert.equal((await A('POST', '/api/audit', { accion: 'imprimir plan de seguridad', pid })).st, 200);
  assert.equal((await A('DELETE', `/api/r/pacientes/${pid}`)).st, 200);
  const dd = (await A('GET', '/api/bootstrap')).j.datos; assert.equal(dd.evalriesgo.length, 0); assert.equal(dd.planseguridad.length, 0);
  assert.equal((await A('GET', '/api/auditoria/verificar')).j.ok, true);
});
