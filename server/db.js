// Base de datos SQLite (módulo integrado de Node). Los registros clínicos se guardan CIFRADOS.
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const C = require('./cripto');

function abrir(dir, clave) {
  const db = new DatabaseSync(path.join(dir, 'erp.db'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`
  CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
  CREATE TABLE IF NOT EXISTS usuarios(id TEXT PRIMARY KEY, usuario TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, rol TEXT NOT NULL,
    hash TEXT NOT NULL, activo INTEGER NOT NULL DEFAULT 1, cambiar INTEGER NOT NULL DEFAULT 0, fallos INTEGER NOT NULL DEFAULT 0,
    bloqueado_hasta INTEGER NOT NULL DEFAULT 0, creado TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sesiones_web(tok TEXT PRIMARY KEY, uid TEXT NOT NULL, creado INTEGER NOT NULL, ultimo INTEGER NOT NULL, ip TEXT);
  CREATE TABLE IF NOT EXISTS registros(entidad TEXT NOT NULL, id TEXT NOT NULL, pid TEXT, datos TEXT NOT NULL, creado TEXT NOT NULL, actualizado TEXT NOT NULL, PRIMARY KEY(entidad,id));
  CREATE INDEX IF NOT EXISTS ix_reg_pid ON registros(entidad,pid);
  CREATE TABLE IF NOT EXISTS papelera(seq INTEGER PRIMARY KEY AUTOINCREMENT, entidad TEXT, id TEXT, pid TEXT, datos TEXT, borrado_por TEXT, fecha TEXT);
  CREATE TABLE IF NOT EXISTS auditoria(seq INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL, uid TEXT, usuario TEXT, rol TEXT,
    entidad TEXT, accion TEXT, ref TEXT, pid TEXT, nombre TEXT, ip TEXT, prev TEXT NOT NULL, hash TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS enlaces(id TEXT PRIMARY KEY, tok TEXT UNIQUE NOT NULL, pid TEXT NOT NULL, tests TEXT NOT NULL, momento TEXT NOT NULL, creado TEXT NOT NULL, vence INTEGER NOT NULL, usado TEXT, creado_por TEXT);
  CREATE INDEX IF NOT EXISTS ix_enl_pid ON enlaces(pid);
  CREATE TRIGGER IF NOT EXISTS aud_sin_update BEFORE UPDATE ON auditoria BEGIN SELECT RAISE(ABORT,'La auditoría es inmutable'); END;
  CREATE TRIGGER IF NOT EXISTS aud_sin_delete BEFORE DELETE ON auditoria BEGIN SELECT RAISE(ABORT,'La auditoría es inmutable'); END;
  `);
  const q = (sql) => db.prepare(sql);
  const S = {
    metaGet: q('SELECT v FROM meta WHERE k=?'), metaSet: q('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v'),
    regAll: q('SELECT id,datos FROM registros WHERE entidad=?'), regGet: q('SELECT datos,pid FROM registros WHERE entidad=? AND id=?'),
    regIns: q('INSERT INTO registros(entidad,id,pid,datos,creado,actualizado) VALUES(?,?,?,?,?,?)'),
    regUpd: q('UPDATE registros SET datos=?,actualizado=? WHERE entidad=? AND id=?'),
    regDel: q('DELETE FROM registros WHERE entidad=? AND id=?'),
    regPid: q('SELECT entidad,id FROM registros WHERE pid=?'),
    papIns: q('INSERT INTO papelera(entidad,id,pid,datos,borrado_por,fecha) VALUES(?,?,?,?,?,?)'),
    audUlt: q('SELECT seq,hash FROM auditoria ORDER BY seq DESC LIMIT 1'),
    audIns: q('INSERT INTO auditoria(fecha,uid,usuario,rol,entidad,accion,ref,pid,nombre,ip,prev,hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)'),
    audTodo: q('SELECT * FROM auditoria ORDER BY seq ASC'),
    audRec: q('SELECT * FROM auditoria ORDER BY seq DESC LIMIT ?')
  };
  const aad = (e, id) => `${e}:${id}`;
  const enc = (e, id, o) => C.cifrar(clave, JSON.stringify(o), aad(e, id));
  const dec = (e, id, s) => JSON.parse(C.descifrar(clave, s, aad(e, id)));

  // Ejecuta varias operaciones como una sola transacción
  const tx = fn => { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };

  const R = {
    todos(ent) { return S.regAll.all(ent).map(r => dec(ent, r.id, r.datos)); },
    obtener(ent, id) { const r = S.regGet.get(ent, id); return r ? dec(ent, id, r.datos) : null; },
    crear(ent, o) { S.regIns.run(ent, o.id, o.pid || null, enc(ent, o.id, o), o.creado, o.actualizado); return o; },
    guardar(ent, o) { S.regUpd.run(enc(ent, o.id, o), o.actualizado, ent, o.id); return o; },
    borrar(ent, id, quien) {
      const r = S.regGet.get(ent, id); if (!r) return false;
      S.papIns.run(ent, id, r.pid, r.datos, quien, new Date().toISOString()); S.regDel.run(ent, id); return true;
    },
    hijosDe(pid) { return S.regPid.all(pid); }
  };

  // ---- Auditoría encadenada: cada fila incluye el hash de la anterior (HMAC con clave secreta) ----
  const canon = (prev, f) => JSON.stringify([prev, f.fecha, f.uid || '', f.usuario || '', f.rol || '', f.entidad || '', f.accion || '', f.ref || '', f.pid || '', f.nombre || '', f.ip || '']);
  const A = {
    registrar(ev) {
      const ult = S.audUlt.get(), prev = ult ? ult.hash : 'GENESIS', fecha = new Date().toISOString();
      const nombre = ev.nombre ? C.cifrar(clave, ev.nombre, 'auditoria-nombre') : null;
      const f = { fecha, uid: ev.uid, usuario: ev.usuario, rol: ev.rol, entidad: ev.entidad, accion: ev.accion, ref: ev.ref, pid: ev.pid, nombre, ip: ev.ip };
      const hash = C.hmac(clave, canon(prev, f));
      const r = S.audIns.run(fecha, f.uid || null, f.usuario || null, f.rol || null, f.entidad || null, f.accion || null, f.ref || null, f.pid || null, nombre, f.ip || null, prev, hash);
      const seq = Number(r.lastInsertRowid);
      S.metaSet.run('aud_cabeza', JSON.stringify({ seq, hash, mac: C.hmac(clave, seq + '|' + hash) }));
      return seq;
    },
    recientes(n) { return S.audRec.all(n).map(a => ({ ...a, nombre: a.nombre ? C.descifrar(clave, a.nombre, 'auditoria-nombre') : null })); },
    verificar() {
      const filas = S.audTodo.all(); let prev = 'GENESIS';
      for (const f of filas) {
        if (f.prev !== prev) return { ok: false, motivo: `Cadena rota en el evento #${f.seq} (falta o se alteró un evento anterior)` };
        if (C.hmac(clave, canon(prev, f)) !== f.hash) return { ok: false, motivo: `El evento #${f.seq} fue modificado` };
        prev = f.hash;
      }
      const m = S.metaGet.get('aud_cabeza');
      if (filas.length || m) {
        const h = m ? JSON.parse(m.v) : null, u = filas[filas.length - 1];
        if (!h || !u || h.seq !== u.seq || h.hash !== u.hash || C.hmac(clave, h.seq + '|' + h.hash) !== h.mac) return { ok: false, motivo: 'Faltan eventos al final del registro (posible borrado)' };
      }
      return { ok: true, eventos: filas.length };
    }
  };

  // ---- Usuarios y sesiones ----
  const U = {
    contar: () => db.prepare('SELECT COUNT(*) n FROM usuarios').get().n,
    porNombre: u => db.prepare('SELECT * FROM usuarios WHERE usuario=? COLLATE NOCASE').get(u),
    porId: id => db.prepare('SELECT * FROM usuarios WHERE id=?').get(id),
    todos: () => db.prepare('SELECT id,usuario,nombre,rol,activo,cambiar,creado FROM usuarios ORDER BY creado').all(),
    crear: u => db.prepare('INSERT INTO usuarios(id,usuario,nombre,rol,hash,activo,cambiar,creado) VALUES(?,?,?,?,?,1,?,?)').run(u.id, u.usuario, u.nombre, u.rol, u.hash, u.cambiar ? 1 : 0, new Date().toISOString()),
    set: (id, campos) => { const ks = Object.keys(campos); db.prepare(`UPDATE usuarios SET ${ks.map(k => k + '=?').join(',')} WHERE id=?`).run(...ks.map(k => campos[k]), id); },
    adminsActivos: () => db.prepare("SELECT COUNT(*) n FROM usuarios WHERE rol='admin' AND activo=1").get().n
  };
  const SE = {
    crear: (tok, uid, ip) => { const t = Date.now(); db.prepare('INSERT INTO sesiones_web(tok,uid,creado,ultimo,ip) VALUES(?,?,?,?,?)').run(C.sha(tok), uid, t, t, ip); },
    obtener: tok => db.prepare('SELECT * FROM sesiones_web WHERE tok=?').get(C.sha(tok)),
    tocar: tok => db.prepare('UPDATE sesiones_web SET ultimo=? WHERE tok=?').run(Date.now(), C.sha(tok)),
    cerrar: tok => db.prepare('DELETE FROM sesiones_web WHERE tok=?').run(C.sha(tok)),
    cerrarDe: uid => db.prepare('DELETE FROM sesiones_web WHERE uid=?').run(uid),
    limpiar: (idleMs, absMs) => { const t = Date.now(); db.prepare('DELETE FROM sesiones_web WHERE ultimo<? OR creado<?').run(t - idleMs, t - absMs); }
  };
  // ---- Enlaces para que el paciente responda cuestionarios (solo se guarda el hash del token) ----
  const EN = {
    crear: e => db.prepare('INSERT INTO enlaces(id,tok,pid,tests,momento,creado,vence,creado_por) VALUES(?,?,?,?,?,?,?,?)').run(e.id, C.sha(e.token), e.pid, JSON.stringify(e.tests), e.momento, new Date().toISOString(), e.vence, e.por),
    porToken: tok => db.prepare('SELECT * FROM enlaces WHERE tok=?').get(C.sha(tok)),
    porId: id => db.prepare('SELECT * FROM enlaces WHERE id=?').get(id),
    pendientes: (pid, ahora) => db.prepare('SELECT id,pid,tests,momento,creado,vence FROM enlaces WHERE pid=? AND usado IS NULL AND vence>? ORDER BY creado DESC').all(pid, ahora),
    marcarUsado: id => db.prepare('UPDATE enlaces SET usado=? WHERE id=? AND usado IS NULL').run(new Date().toISOString(), id).changes,
    revocar: id => db.prepare('UPDATE enlaces SET vence=0 WHERE id=?').run(id),
    borrarDe: pid => db.prepare('DELETE FROM enlaces WHERE pid=?').run(pid)
  };
  const M = { get: k => (S.metaGet.get(k) || {}).v, set: (k, v) => S.metaSet.run(k, String(v)) };

  return { db, tx, R, A, U, SE, M, EN, cerrar: () => db.close() };
}
module.exports = { abrir };
