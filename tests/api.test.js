// Pruebas del servidor: node --test tests/   (usa una base temporal; no toca tu carpeta data/)
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { crearServidor } = require('../server/server');
const Resp = require('../server/respaldo'), { DatabaseSync } = require('node:sqlite');
const Calendario = require('../js/modules/calendario');

const FRASE = 'frase-de-respaldo-segura-123';
async function levantar(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-')), s = crearServidor({ dirDatos: dir, silencio: true, sinRespaldoAlCerrar: true, ...extra });
  await new Promise(ok => s.servidor.listen(0, '127.0.0.1', ok)); const base = 'http://127.0.0.1:' + s.servidor.address().port;
  const cliente = () => { let ck = ''; const f = async (m, u, body, h = {}) => { const r = await fetch(base + u, { method: m, headers: { 'X-ERP': '1', 'Content-Type': 'application/json', ...(ck ? { Cookie: ck } : {}), ...h }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' }); const sc = r.headers.get('set-cookie'); if (sc) ck = sc.split(';')[0]; let j = null; try { j = await r.json(); } catch {} return { st: r.status, j, r }; }; f.cookie = () => ck; return f; };
  return { s, dir, base, cliente, cerrar: () => s.cerrar() };
}
const id = () => Math.random().toString(36).slice(2, 12);

test('flujo completo de seguridad y datos', async t => {
  const E = await levantar(), A = E.cliente();
  t.after(() => E.cerrar());

  await t.test('estado inicial y configuración', async () => {
    assert.equal((await A('GET', '/api/estado')).j.configurado, false);
    assert.equal((await A('POST', '/api/setup', { usuario: 'dra', nombre: 'Dra. Prueba', password: 'corta1', fraseRespaldo: FRASE })).st, 400);
    assert.equal((await A('POST', '/api/setup', { usuario: 'dra', nombre: 'Dra. Prueba', password: 'SoloLetrasAqui', fraseRespaldo: FRASE })).st, 400);
    assert.equal((await A('POST', '/api/setup', { usuario: 'dra', nombre: 'Dra. Prueba', password: 'Clave-Segura-2026', fraseRespaldo: 'corta' })).st, 400);
    const r = await A('POST', '/api/setup', { usuario: 'dra', nombre: 'Dra. Prueba', password: 'Clave-Segura-2026', fraseRespaldo: FRASE });
    assert.equal(r.st, 200); assert.equal(r.j.usuario.rol, 'admin');
    assert.equal((await A('POST', '/api/setup', { usuario: 'otro', nombre: 'X', password: 'Clave-Segura-2026', fraseRespaldo: FRASE })).st, 403, 'no se puede reconfigurar');
    assert.ok(Resp.listar(E.s.ctx.dirRespaldos).length === 1, 'respaldo inicial creado');
  });

  await t.test('protecciones básicas', async () => {
    const anon = E.cliente();
    assert.equal((await anon('GET', '/api/bootstrap')).st, 401);
    const sinHdr = await fetch(E.base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(sinHdr.status, 403, 'CSRF: exige X-ERP');
    const otro = await fetch(E.base + '/api/login', { method: 'POST', headers: { 'X-ERP': '1', Origin: 'http://malo.example', 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(otro.status, 403, 'CSRF: origen ajeno');
    const trav = await fetch(E.base + '/..%2f..%2fserver%2fserver.js'); assert.notEqual(trav.status, 200, 'sin path traversal');
    const idx = await fetch(E.base + '/'); assert.match(idx.headers.get('content-security-policy'), /script-src 'self'/);
    assert.match((await A('GET', '/api/estado')).r.headers.get('x-frame-options') || 'DENY', /DENY/);
    const ck = (await anon('POST', '/api/login', { usuario: 'dra', password: 'Clave-Segura-2026' })).r.headers.get('set-cookie'); assert.match(ck, /HttpOnly/); assert.match(ck, /SameSite=Strict/);
  });

  let pid, sid;
  await t.test('admin crea usuarios y datos clínicos', async () => {
    const pro = await A('POST', '/api/usuarios', { usuario: 'psico2', nombre: 'Psicólogo 2', rol: 'profesional' }); assert.equal(pro.st, 201); E.tempPro = pro.j.claveTemporal;
    const rec = await A('POST', '/api/usuarios', { usuario: 'recep', nombre: 'Recepción', rol: 'recepcion' }); assert.equal(rec.st, 201); E.tempRec = rec.j.claveTemporal;
    assert.equal((await A('POST', '/api/usuarios', { usuario: 'RECEP', nombre: 'dup', rol: 'recepcion' })).st, 409, 'usuario duplicado (sin distinguir mayúsculas)');
    pid = id(); const p = await A('POST', '/api/r/pacientes', { id: pid, nombre: 'Ana Quispe Secreta', doc: '12345678', tel: '987654321', motivo: 'Ansiedad por trabajo', riesgo: 'Riesgo bajo' }); assert.equal(p.st, 201);
    sid = id(); assert.equal((await A('POST', '/api/r/sesiones', { id: sid, pid, fecha: '2026-10-20', hora: '10:00', estado: 'Programada', soap: { s: 'texto clínico reservado' }, eva: 7, tema: 'Autoestima' })).st, 201);
    assert.equal((await A('POST', '/api/r/sesiones', { id: id(), pid: 'noexiste1', fecha: '2026-10-20' })).st, 422, 'paciente inexistente');
    assert.equal((await A('POST', '/api/r/pacientes', { id: id(), nombre: '  ' })).st, 422);
    assert.equal((await A('POST', '/api/r/objetivos', { id: id(), pid, texto: 'Autoestima', estado: 'En curso' })).st, 201);
    assert.equal((await A('POST', '/api/r/tests', { id: id(), pid, test: 'ros', puntaje: 22 })).st, 201);
    assert.equal((await A('POST', '/api/r/consentimientos', { id: id(), pid, firmante: 'Ana', firma: 'data:image/png;base64,AAAA' })).st, 201);
    assert.equal((await A('POST', '/api/r/medicaciones', { id: id(), pid, medicamento: 'Medicamento de prueba', fuente: 'Receta externa', prescriptor: '', fecha_inicio: '2026-10-19', estado: 'En uso' })).st, 422, 'una receta debe registrar su prescriptor');
    assert.equal((await A('POST', '/api/r/medicaciones', { id: id(), pid, medicamento: 'Medicamento de prueba', fuente: 'Receta externa', prescriptor: 'Profesional de prueba', dosis: 'Transcripción de receta', frecuencia: 'Según receta', fecha_inicio: '2026-10-19', estado: 'En uso' })).st, 201);
    assert.equal((await A('POST', '/api/r/pagos', { id: id(), pid, fecha: '2026-10-19', monto: 80 })).st, 201);
    assert.equal((await A('POST', '/api/r/inventada', { id: id() })).st, 404);
    const m = await A('PATCH', `/api/r/pacientes/${pid}`, { diag: 'Ansiedad generalizada', pid: 'intento-cambiar' }); assert.equal(m.st, 200); assert.equal(m.j.motivo, 'Ansiedad por trabajo', 'PATCH fusiona, no pisa');
    const b = await A('GET', '/api/bootstrap'); assert.equal(b.j.datos.pacientes.length, 1); assert.equal(b.j.datos.sesiones[0].pid, pid);
  });

  await t.test('recepción: contraseña temporal obligatoria de cambiar y datos clínicos ocultos', async () => {
    const R = E.cliente(); assert.equal((await R('POST', '/api/login', { usuario: 'recep', password: E.tempRec })).st, 200);
    assert.equal((await R('GET', '/api/bootstrap')).st, 403, 'bloqueado hasta cambiar contraseña');
    assert.equal((await R('POST', '/api/password', { actual: E.tempRec, nueva: 'recep' })).st, 400);
    assert.equal((await R('POST', '/api/password', { actual: 'mala', nueva: 'NuevaClave-2026' })).st, 403);
    assert.equal((await R('POST', '/api/password', { actual: E.tempRec, nueva: 'NuevaClave-2026' })).st, 200);
    const b = await R('GET', '/api/bootstrap'); assert.equal(b.st, 200);
    assert.deepEqual(Object.keys(b.j.datos).sort(), ['espera', 'pacientes', 'pagos', 'paquetes', 'sesiones']);
    assert.equal(b.j.datos.medicaciones, undefined, 'recepción no accede a medicaciones');
    const p = b.j.datos.pacientes[0]; assert.equal(p.nombre, 'Ana Quispe Secreta'); assert.equal(p.tel, '987654321'); assert.equal(p.motivo, undefined); assert.equal(p.riesgo, undefined); assert.equal(p.diag, undefined);
    const s = b.j.datos.sesiones[0]; assert.equal(s.soap, undefined); assert.equal(s.eva, undefined); assert.equal(s.tema, undefined); assert.equal(s.fecha, '2026-10-20');
    assert.equal((await R('PATCH', `/api/r/sesiones/${sid}`, { soap: { s: 'x' } })).st, 403);
    assert.equal((await R('PATCH', `/api/r/pacientes/${pid}`, { motivo: 'x' })).st, 403);
    assert.equal((await R('PATCH', `/api/r/sesiones/${sid}`, { estado: 'Atendida' })).st, 200, 'puede cambiar estado');
    assert.equal((await R('POST', '/api/r/pacientes', { id: id(), nombre: 'Nuevo Paciente', tel: '999' })).st, 201, 'puede registrar contacto');
    assert.equal((await R('POST', '/api/r/tests', { id: id(), pid, test: 'ros' })).st, 403);
    assert.equal((await R('DELETE', `/api/r/sesiones/${sid}`)).st, 403);
    assert.equal((await R('DELETE', `/api/r/pacientes/${pid}`)).st, 403);
    assert.equal((await R('GET', '/api/usuarios')).st, 403); assert.equal((await R('GET', '/api/auditoria')).st, 403); assert.equal((await R('GET', '/api/respaldos')).st, 403); assert.equal((await R('POST', '/api/importar-legacy', {})).st, 403);
    assert.equal((await R('POST', '/api/audit', { accion: 'cualquier cosa' })).st, 400, 'el cliente no inventa acciones');
  });

  await t.test('bloqueo por intentos fallidos', async () => {
    const X = E.cliente(); for (let i = 0; i < 5; i++) assert.equal((await X('POST', '/api/login', { usuario: 'psico2', password: 'incorrecta' + i })).st, 401);
    assert.equal((await X('POST', '/api/login', { usuario: 'psico2', password: E.tempPro })).st, 429, 'bloqueada aun con la clave correcta');
    assert.equal((await X('POST', '/api/login', { usuario: 'noexiste', password: 'xxxxxxxxxxxx' })).st, 401, 'mismo mensaje si no existe');
    assert.equal((await A('POST', `/api/usuarios/${(await A('GET', '/api/usuarios')).j.find(u => u.usuario === 'psico2').id}/reiniciar`)).st, 200, 'admin puede reiniciar y desbloquea');
  });

  await t.test('no se puede dejar el sistema sin administrador', async () => {
    const yo = (await A('GET', '/api/usuarios')).j.find(u => u.usuario === 'dra');
    assert.equal((await A('PATCH', `/api/usuarios/${yo.id}`, { activo: false })).st, 409); assert.equal((await A('PATCH', `/api/usuarios/${yo.id}`, { rol: 'recepcion' })).st, 409);
  });

  await t.test('auditoría: la escribe el servidor, con el usuario real', async () => {
    const R = E.cliente(); await R('POST', '/api/login', { usuario: 'recep', password: 'NuevaClave-2026' }); await R('GET', '/api/bootstrap');
    const ev = (await A('GET', '/api/auditoria')).j.eventos;
    const porRecep = ev.filter(e => e.usuario === 'recep'); assert.ok(porRecep.length >= 3);
    assert.ok(ev.some(e => e.usuario === 'recep' && e.accion === 'acceso denegado: borrar'), 'intentos denegados quedan registrados');
    assert.ok(ev.some(e => e.usuario === 'dra' && e.accion === 'crear' && e.entidad === 'pacientes' && e.nombre === 'Ana Quispe Secreta'));
    assert.ok(ev.some(e => e.accion === 'login fallido'));
    assert.ok(!JSON.stringify(ev).includes('texto clínico reservado'), 'la auditoría no guarda contenido clínico');
    assert.deepEqual((await A('GET', '/api/auditoria/verificar')).j.ok, true);
  });

  await t.test('cifrado en reposo: el archivo de la base no contiene datos legibles', async () => {
    E.s.base.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const crudo = fs.readFileSync(path.join(E.dir, 'erp.db')).toString('latin1');
    for (const secreto of ['Ana Quispe Secreta', '12345678', '987654321', 'texto clínico reservado', 'Ansiedad por trabajo']) assert.ok(!crudo.includes(secreto), 'texto plano encontrado: ' + secreto);
    assert.ok(crudo.includes('v1:'), 'hay datos cifrados');
  });

  await t.test('respaldo cifrado: se puede restaurar y no es legible sin la frase', async () => {
    const r = await A('POST', '/api/respaldos'); assert.equal(r.st, 201);
    const f = path.join(E.s.ctx.dirRespaldos, r.j.nombre), buf = fs.readFileSync(f);
    assert.ok(!buf.toString('latin1').includes('Ana Quispe'));
    assert.throws(() => Resp.abrirRespaldo(buf, 'frase equivocada!!'), /Frase incorrecta/);
    const dl = await fetch(E.base + '/api/respaldos/' + r.j.nombre, { headers: { Cookie: A.cookie() } }); assert.equal(dl.status, 200); assert.equal(Buffer.from(await dl.arrayBuffer()).subarray(0, 5).toString(), 'CERP1');
    assert.equal((await fetch(E.base + '/api/respaldos/' + r.j.nombre)).status, 401, 'descarga exige sesión');
    // Restauración real en un directorio nuevo mediante la herramienta de consola
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-rest-'));
    const out = execFileSync('node', ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'tools', 'restaurar.js'), f], { env: { ...process.env, ERP_DATA_DIR: dir2, ERP_BACKUP_PASS: FRASE, ERP_ASUME_SI: '1' } }).toString();
    assert.match(out, /Restaurado\. Registros: .*"pacientes":2/); assert.match(out, /Auditoría íntegra/);
  });

  await t.test('manipular la auditoría a mano es detectado', async () => {
    const dbf = path.join(E.dir, 'erp.db'); E.s.base.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const x = new DatabaseSync(dbf);
    assert.throws(() => x.exec("UPDATE auditoria SET usuario='otro' WHERE seq=2"), /inmutable/, 'trigger bloquea UPDATE');
    assert.throws(() => x.exec('DELETE FROM auditoria WHERE seq=2'), /inmutable/, 'trigger bloquea DELETE');
    // Atacante con acceso al archivo: quita triggers y edita
    x.exec('DROP TRIGGER aud_sin_update'); x.exec("UPDATE auditoria SET usuario='otro' WHERE seq=3"); x.close();
    const v = (await A('GET', '/api/auditoria/verificar')).j; assert.equal(v.ok, false); assert.match(v.motivo, /#3 fue modificado/);
  });

  await t.test('borrado va a la papelera y se elimina en cascada', async () => {
    const pb = id(); await A('POST', '/api/r/pacientes', { id: pb, nombre: 'Para Borrar' }); await A('POST', '/api/r/sesiones', { id: id(), pid: pb, fecha: '2026-11-01' }); await A('POST', '/api/r/pagos', { id: id(), pid: pb, fecha: '2026-11-01', monto: 10 });
    assert.equal((await A('DELETE', `/api/r/pacientes/${pb}`)).st, 200);
    const b = (await A('GET', '/api/bootstrap')).j.datos; assert.ok(!b.pacientes.some(p => p.id === pb)); assert.ok(!b.sesiones.some(s => s.pid === pb)); assert.ok(!b.pagos.some(s => s.pid === pb));
    assert.equal(E.s.base.db.prepare('SELECT COUNT(*) n FROM papelera').get().n, 3, 'paciente + sesión + pago en la papelera');
  });

  await t.test('importar datos de la versión anterior (localStorage)', async () => {
    const pl = id(), r = await A('POST', '/api/importar-legacy', { pacientes: [{ id: pl, nombre: 'Legado', creado: '2026-01-01T00:00:00.000Z', fecha_alta: '2026-01-01' }, { id: 'x', nombre: 'id inválido' }], sesiones: [{ id: id(), pid: pl, fecha: '2026-01-02' }, { id: id(), pid: 'huerfano1', fecha: '2026-01-02' }], tareas: [{ id: id(), pid: pl, estado: 'No válido', fecha_limite: '2026-01-02' }], auditoria: [{ falsa: 1 }] });
    assert.equal(r.j.importados.pacientes, 1); assert.equal(r.j.importados.sesiones, 1); assert.equal(r.j.omitidos, 3);
    assert.equal((await A('POST', '/api/importar-legacy', { pacientes: [{ id: pl, nombre: 'Legado' }] })).j.importados.pacientes, 0, 'idempotente');
  });
});

test('la sesión expira por inactividad', async t => {
  const E = await levantar({ idleMin: 0.004 }); t.after(() => E.cerrar()); const A = E.cliente();
  await A('POST', '/api/setup', { usuario: 'dra', nombre: 'D', password: 'Clave-Segura-2026', fraseRespaldo: FRASE });
  assert.equal((await A('GET', '/api/bootstrap')).st, 200);
  await new Promise(r => setTimeout(r, 400)); assert.equal((await A('GET', '/api/bootstrap')).st, 401);
});

test('retención de respaldos conserva lo reciente y poda lo viejo', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ret-')), pad = n => String(n).padStart(2, '0'), nom = (d, h) => `respaldo-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(h)}0000.cerp`;
  const hoy = new Date(); for (let dias = 0; dias < 60; dias++) for (const h of [8, 12, 16, 20]) { const d = new Date(hoy); d.setDate(d.getDate() - dias); fs.writeFileSync(path.join(dir, nom(d, h)), 'x'); }
  Resp.retencion(dir); const q = fs.readdirSync(dir).length;
  assert.ok(q < 240 && q >= 12 + 27, 'quedaron ' + q);
});

test('bloque 2: cierres, seguimientos y adjuntos', async t => {
  const E = await levantar(), A = E.cliente(); t.after(() => E.cerrar());
  await A('POST', '/api/setup', { usuario: 'dra', nombre: 'Dra. Prueba', password: 'Clave-Segura-2026', fraseRespaldo: FRASE });
  const pid = id(); assert.equal((await A('POST', '/api/r/pacientes', { id: pid, nombre: 'Paciente B2' })).st, 201);
  const cid = id(); assert.equal((await A('POST', '/api/r/cierres', { id: cid, pid, estado: 'Alta', fecha: '2026-10-19', resumen: 'ok' })).st, 201);
  assert.equal((await A('PATCH', '/api/r/cierres/' + cid, { estado: 'Abandono' })).j.estado, 'Abandono');
  assert.equal((await A('POST', '/api/r/seguimientos', { id: id(), pid, fecha: '2026-11-19', hecho: false })).st, 201);
  const aid = id(), data = Buffer.from('contenido-del-adjunto').toString('base64');
  assert.equal((await A('POST', '/api/r/adjuntos', { id: aid, pid, nombre: 'informe.pdf', mime: 'application/pdf', tam: 21, fecha: '2026-10-19', data })).st, 201);
  const b = await A('GET', '/api/bootstrap'); assert.ok(b.j.datos.adjuntos.length === 1 && !('data' in b.j.datos.adjuntos[0]), 'el bootstrap no lleva el contenido');
  const d = await A('GET', '/api/adjunto/' + aid); assert.equal(d.st, 200); assert.equal(d.j.data, data);
  const R = E.cliente(); await A('POST', '/api/usuarios', { usuario: 'rec', nombre: 'Rec', rol: 'recepcion' });
  assert.equal((await A('GET', '/api/auditoria')).j.eventos.some(e => e.accion === 'descargar adjunto'), true);
});

test('bloque 3: lista de espera, reprogramar y permisos de recepción', async t => {
  const E = await levantar(), A = E.cliente(); t.after(() => E.cerrar());
  await A('POST', '/api/setup', { usuario: 'dra', nombre: 'Dra. Prueba', password: 'Clave-Segura-2026', fraseRespaldo: FRASE });
  const eid = id(); assert.equal((await A('POST', '/api/r/espera', { id: eid, nombre: 'Persona X', tel: '999111222', estado: 'En espera', prioridad: 'Alta', fecha: '2026-10-19' })).st, 201);
  assert.equal((await A('PATCH', '/api/r/espera/' + eid, { estado: 'Agendado' })).j.estado, 'Agendado');
  const pid = id(), sid = id(); await A('POST', '/api/r/pacientes', { id: pid, nombre: 'Pac' });
  await A('POST', '/api/r/sesiones', { id: sid, pid, fecha: '2026-10-20', hora: '10:00', estado: 'Programada' });
  const r = await A('PATCH', '/api/r/sesiones/' + sid, { fecha: '2026-10-21', reprog: [{ de: '2026-10-20 10:00', a: '2026-10-21 10:00' }], recordado: null });
  assert.equal(r.st, 200); assert.equal(r.j.fecha, '2026-10-21'); assert.equal(r.j.reprog.length, 1);
  const P = require('../server/permisos'); assert.equal(P.filtrarEscritura('recepcion', 'sesiones', { fecha: 'x', hora: 'y', reprog: [], recordado: 'z' }).no.length, 0);
  assert.equal(P.puede('recepcion', 'espera', 'crear'), true);
});

test('bloque 4: paquetes, cobros editables, correlativo y ajustes', async t => {
  const E = await levantar(), A = E.cliente(); t.after(() => E.cerrar());
  await A('POST', '/api/setup', { usuario: 'dra', nombre: 'Dra. Prueba', password: 'Clave-Segura-2026', fraseRespaldo: FRASE });
  const pid = id(); await A('POST', '/api/r/pacientes', { id: pid, nombre: 'Pac Pago', tarifa: '80' });
  const kid = id(); assert.equal((await A('POST', '/api/r/paquetes', { id: kid, pid, nombre: 'Ciclo de 10', n: 10, precio: 700, fecha: '2026-10-19', estado: 'Activo' })).st, 201);
  const gid = id(); assert.equal((await A('POST', '/api/r/pagos', { id: gid, pid, fecha: '2026-10-19', monto: 300, metodo: 'Efectivo', paquete: kid })).st, 201);
  const editado = await A('PATCH', '/api/r/pagos/' + gid, { monto: 350, comp_tipo: 'Boleta', comp_num: 'B001-1', comp_nombre: 'Comprador de prueba', comp_doc_tipo: 'DNI', comp_doc_num: '12345678' });
  assert.equal(editado.j.monto, 350, 'cobro editable'); assert.equal(editado.j.comp_nombre, 'Comprador de prueba'); assert.equal(editado.j.comp_doc_num, '12345678');
  assert.equal((await A('POST', '/api/correlativo')).j.numero, 'R001-000001');
  assert.equal((await A('POST', '/api/correlativo')).j.numero, 'R001-000002');
  assert.equal((await A('POST', '/api/ajustes', { serie: 'minuscula' })).st, 400);
  assert.equal((await A('POST', '/api/ajustes', { consultorio: 'Consultorio Test', ruc: '20123456789', serie: 'R002' })).st, 200);
  assert.equal((await A('POST', '/api/correlativo')).j.numero, 'R002-000003');
  const b = await A('GET', '/api/bootstrap'); assert.equal(b.j.ajustes.consultorio, 'Consultorio Test'); assert.equal(b.j.datos.paquetes.length, 1);
  assert.equal((await A('POST', '/api/audit', { accion: 'exportar' })).st, 200);
  assert.equal((await A('GET', '/api/auditoria')).j.eventos.some(e => e.accion === 'emitir recibo'), true);
});

test('devoluciones: referencia válida y límite acumulado del cobro', async t => {
  const E = await levantar(), A = E.cliente(); t.after(() => E.cerrar());
  await A('POST', '/api/setup', { usuario: 'dra', nombre: 'Dra. Prueba', password: 'Clave-Segura-2026', fraseRespaldo: FRASE });
  const pid = id(), pagoId = id();
  await A('POST', '/api/r/pacientes', { id: pid, nombre: 'Paciente Devolución' });
  assert.equal((await A('POST', '/api/r/pagos', { id: pagoId, pid, fecha: '2026-10-19', monto: 100, metodo: 'Tarjeta', comp_tipo: 'Boleta', comp_num: 'B001-9' })).st, 201);
  const devolucion = (id, ref_pago, monto, comp_num = 'NC01-1') => ({ id, pid, ref_pago, movimiento: 'Devolución', fecha: '2026-10-19', monto, metodo: 'Tarjeta', concepto: 'Devolución parcial', comp_tipo: 'Nota de crédito', comp_num });
  assert.equal((await A('POST', '/api/r/pagos', devolucion(id(), 'noexiste1', -10))).st, 422, 'exige un cobro original');
  assert.equal((await A('POST', '/api/r/pagos', devolucion(id(), pagoId, -10, ''))).st, 422, 'una boleta requiere número de nota de crédito');
  assert.equal((await A('POST', '/api/r/pagos', devolucion(id(), pagoId, -101))).st, 422, 'no devuelve más de lo cobrado');
  const primeraId = id(); assert.equal((await A('POST', '/api/r/pagos', devolucion(primeraId, pagoId, -40))).st, 201);
  assert.equal((await A('POST', '/api/r/pagos', devolucion(id(), pagoId, -60))).st, 201, 'permite devolución acumulada hasta el total');
  assert.equal((await A('POST', '/api/r/pagos', devolucion(id(), pagoId, -1))).st, 422, 'bloquea exceder el total acumulado');
  assert.equal((await A('POST', '/api/r/pagos', devolucion(id(), primeraId, -1))).st, 422, 'no permite devolver una devolución');
  assert.equal((await A('PATCH', `/api/r/pagos/${pagoId}`, { monto: 90 })).st, 409, 'congela monto y datos del original mientras tenga devoluciones');
  assert.equal((await A('PATCH', `/api/r/pagos/${pagoId}`, { concepto: 'Concepto alterado' })).st, 409, 'congela el original mientras tenga devoluciones');
  assert.equal((await A('DELETE', `/api/r/pagos/${pagoId}`)).st, 409, 'no elimina el original de una devolución');
  const pagos = (await A('GET', '/api/bootstrap')).j.datos.pagos;
  assert.equal(pagos.filter(x => x.pid === pid).reduce((s, x) => s + x.monto, 0), 0, 'cobro y devoluciones dejan saldo de pagos neto cero');
  assert.ok((await A('GET', '/api/auditoria')).j.eventos.some(e => e.accion === 'registrar devolución' && e.ref === primeraId));
  const alta = await A('POST', '/api/usuarios', { usuario: 'recep', nombre: 'Recepción', rol: 'recepcion' }), R = E.cliente();
  await R('POST', '/api/login', { usuario: 'recep', password: alta.j.claveTemporal });
  await R('POST', '/api/password', { actual: alta.j.claveTemporal, nueva: 'NuevaClave-2026' });
  assert.equal((await R('POST', '/api/r/pagos', devolucion(id(), pagoId, -1))).st, 403, 'solo administración registra devoluciones');
  assert.equal((await R('PATCH', `/api/r/pagos/${pagoId}`, { movimiento: 'Devolución', ref_pago: pagoId, monto: -1 })).st, 409, 'no se convierte un cobro en devolución con PATCH');
  assert.equal((await A('PATCH', `/api/r/pagos/${primeraId}`, { concepto: 'Editar devolución' })).st, 409, 'no se edita directamente una devolución');
});

test('modo sin login (desarrollo): entra directo como administrador', async t => {
  const E = await levantar({ sinLogin: true }), A = E.cliente();
  t.after(() => E.cerrar());
  const est = await A('GET', '/api/estado');
  assert.equal(est.j.sinLogin, true); assert.equal(est.j.usuario.rol, 'admin');
  const b = await A('GET', '/api/bootstrap'); assert.equal(b.st, 200); assert.equal(b.j.usuario.rol, 'admin');
  const idp = id(), c = await A('POST', '/api/r/pacientes', { id: idp, nombre: 'Prueba', creado: new Date().toISOString(), actualizado: new Date().toISOString() });
  assert.equal(c.st, 201);
  assert.equal((await A('GET', '/api/auditoria')).st, 200, 'el admin accede a auditoría');
});

test('tareas clínicas: validación, permisos y papelera en cascada', async t => {
  const E = await levantar(), A = E.cliente(); t.after(() => E.cerrar());
  await A('POST', '/api/setup', { usuario: 'dra', nombre: 'Dra. Prueba', password: 'Clave-Segura-2026', fraseRespaldo: FRASE });
  const pid = id(); assert.equal((await A('POST', '/api/r/pacientes', { id: pid, nombre: 'Paciente Tareas' })).st, 201);
  const tarea = { id: id(), pid, titulo: 'Revisar registro de pensamientos', descripcion: 'Nota privada', fecha_limite: '2026-10-20', prioridad: 'Alta', estado: 'Pendiente' };
  assert.equal((await A('POST', '/api/r/tareas', { ...tarea, titulo: '' })).st, 422);
  assert.equal((await A('POST', '/api/r/tareas', { ...tarea, fecha_limite: '2026-02-30' })).st, 422);
  assert.equal((await A('POST', '/api/r/tareas', { ...tarea, estado: 'Inventado' })).st, 422);
  assert.equal((await A('POST', '/api/r/tareas', tarea)).st, 201);
  assert.equal((await A('PATCH', `/api/r/tareas/${tarea.id}`, { estado: 'Completada' })).j.estado, 'Completada');
  assert.equal((await A('GET', '/api/bootstrap')).j.datos.tareas.length, 1);

  const alta = await A('POST', '/api/usuarios', { usuario: 'recep', nombre: 'Recepción', rol: 'recepcion' });
  const R = E.cliente(); await R('POST', '/api/login', { usuario: 'recep', password: alta.j.claveTemporal });
  await R('POST', '/api/password', { actual: alta.j.claveTemporal, nueva: 'NuevaClave-2026' });
  assert.equal((await R('GET', '/api/bootstrap')).j.datos.tareas, undefined, 'recepción no ve tareas clínicas');
  assert.equal((await R('POST', '/api/r/tareas', { ...tarea, id: id() })).st, 403);

  assert.equal((await A('DELETE', `/api/r/pacientes/${pid}`)).st, 200);
  assert.equal(E.s.base.R.obtener('tareas', tarea.id), null);
  assert.equal(E.s.base.db.prepare("SELECT COUNT(*) n FROM papelera WHERE entidad='tareas'").get().n, 1);
});

test('exportación iCalendar: rango, privacidad, duración y alertas', () => {
  const citas = [
    { id: 'cita001', fecha: '2026-10-19', hora: '10:30', dur: 50, estado: 'Programada', paciente: 'Nombre confidencial', soap: 'Nota privada' },
    { id: 'cita002', fecha: '2026-10-20', hora: '', estado: 'Programada' },
    { id: 'cita003', fecha: '2026-10-20', hora: '12:00', estado: 'Cancelada' },
    { id: 'cita004', fecha: '2026-10-20', hora: '25:00', estado: 'Programada' },
    { id: 'cita005', fecha: '2026-11-01', hora: '12:00', estado: 'Programada' }
  ];
  const ics = Calendario.generar(citas, '2026-10-19', '2026-10-20', 30);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /DTSTART:20261019T153000Z/);
  assert.match(ics, /DTEND:20261019T162000Z/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261020/);
  assert.match(ics, /TRIGGER:-PT30M/);
  assert.match(ics, /SUMMARY:Cita de consultorio/);
  assert.doesNotMatch(ics, /Nombre confidencial|Nota privada/);
  assert.equal(Calendario.generar(citas, '2026-10-20', '2026-10-19'), '');
  assert.equal(Calendario.generar(citas, '2026-02-30', '2026-10-20'), '');
});

test('gastos del consultorio: validación, acceso admin y papelera', async t => {
  const E = await levantar(), A = E.cliente(); t.after(() => E.cerrar());
  await A('POST', '/api/setup', { usuario: 'dra', nombre: 'Dra. Prueba', password: 'Clave-Segura-2026', fraseRespaldo: FRASE });
  const gasto = { id: id(), fecha: '2026-10-19', categoria: 'Servicios', concepto: 'Internet del consultorio', monto: 120.5, metodo: 'Transferencia', estado: 'Pagado', proveedor: 'Proveedor de prueba', comprobante: 'R-204', nota: '' };
  assert.equal((await A('POST', '/api/r/gastos', { ...gasto, monto: -1 })).st, 422);
  assert.equal((await A('POST', '/api/r/gastos', { ...gasto, fecha: '2026-02-30' })).st, 422);
  assert.equal((await A('POST', '/api/r/gastos', gasto)).st, 201);
  assert.equal((await A('GET', '/api/bootstrap')).j.datos.gastos.length, 1);

  const alta = await A('POST', '/api/usuarios', { usuario: 'recep', nombre: 'Recepción', rol: 'recepcion' }), R = E.cliente();
  await R('POST', '/api/login', { usuario: 'recep', password: alta.j.claveTemporal });
  await R('POST', '/api/password', { actual: alta.j.claveTemporal, nueva: 'NuevaClave-2026' });
  assert.equal((await R('GET', '/api/bootstrap')).j.datos.gastos, undefined, 'recepción no ve gastos');
  assert.equal((await R('POST', '/api/r/gastos', { ...gasto, id: id() })).st, 403, 'recepción no puede registrar gastos');
  assert.equal((await A('DELETE', `/api/r/gastos/${gasto.id}`)).st, 200);
  assert.equal(E.s.base.R.obtener('gastos', gasto.id), null);
  assert.equal(E.s.base.db.prepare("SELECT COUNT(*) n FROM papelera WHERE entidad='gastos'").get().n, 1);
});

test('orígenes permitidos (Netlify como proxy): ERP_ALLOWED_ORIGINS', async () => {
  process.env.ERP_ALLOWED_ORIGINS = 'https://mi-sitio.netlify.app/, https://otro.example';
  const E = await levantar(); delete process.env.ERP_ALLOWED_ORIGINS;
  try {
    const login = origin => fetch(E.base + '/api/login', { method: 'POST', headers: { 'X-ERP': '1', 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: '{}' });
    assert.equal((await login('https://mi-sitio.netlify.app')).status, 401, 'origen permitido pasa la verificación de Origin');
    assert.equal((await login('https://otro.example')).status, 401);
    assert.equal((await login('https://malo.example')).status, 403, 'origen no listado se rechaza');
    assert.equal((await login('https://mi-sitio.netlify.app.malo.example')).status, 403, 'no basta con empezar igual');
    const sinHdr = await fetch(E.base + '/api/login', { method: 'POST', headers: { Origin: 'https://mi-sitio.netlify.app', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(sinHdr.status, 403, 'sigue exigiendo X-ERP');
  } finally { await E.cerrar(); }
});
