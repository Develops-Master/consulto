// Servidor del Consultorio ERP: API + archivos estáticos. Sin dependencias externas (solo Node >= 22.13).
process.env.TZ = process.env.TZ || 'America/Lima';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const C = require('./cripto');
const P = require('./permisos');
const { abrir } = require('./db');
const Resp = require('./respaldo');
const Escalas = require('../js/modules/escalas');

const RAIZ = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const hoy = () => new Date().toLocaleDateString('en-CA');
const ID_RE = /^[a-z0-9]{6,24}$/;

function crearServidor(opts = {}) {
  const dirDatos = path.resolve(opts.dirDatos || process.env.ERP_DATA_DIR || path.join(RAIZ, 'data'));
  fs.mkdirSync(dirDatos, { recursive: true });
  const log = opts.silencio ? () => {} : m => console.log(`[${new Date().toLocaleString('es-PE')}] ${m}`);
  const { clave, origen } = C.cargarClave(dirDatos);
  const base = abrir(dirDatos, clave);
  const cfgPath = path.join(dirDatos, 'config.json');
  const leerCfg = () => { try { return JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch { return {}; } };
  const escribirCfg = c => fs.writeFileSync(cfgPath, JSON.stringify(c, null, 2), { mode: 0o600 });
  const IDLE = (+process.env.ERP_IDLE_MIN || opts.idleMin || 30) * 60000, ABS = 12 * 3600000;
  const confiarProxy = process.env.ERP_TRUST_PROXY === '1';
  // Orígenes extra permitidos para peticiones que modifican datos (p. ej. el sitio de Netlify que hace de proxy): ERP_ALLOWED_ORIGINS=https://mi-sitio.netlify.app,https://otro.dominio
  const origenesOk = (process.env.ERP_ALLOWED_ORIGINS || '').split(',').map(x => x.trim().replace(/\/+$/, '')).filter(Boolean);
  const ctx = {
    base, clave, dirDatos, dirRespaldos: path.join(dirDatos, 'respaldos'),
    get dirExtra() { return process.env.ERP_BACKUP_DIR2 || leerCfg().dirExtra || null; },
    frase: () => process.env.ERP_BACKUP_PASS || leerCfg().fraseRespaldo || null
  };
  const intentosIP = new Map(), ultBoot = new Map(), intentosPortal = new Map();

  // ---------- utilidades HTTP ----------
  const ipDe = req => (confiarProxy && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress) || '';
  const esHttps = req => req.socket.encrypted || (confiarProxy && req.headers['x-forwarded-proto'] === 'https');
  const enviar = (res, code, obj, extra = {}) => { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }); res.end(b); };
  class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
  const fallar = (code, msg) => { throw new HttpError(code, msg); };
  const leerCuerpo = (req, limite) => new Promise((ok, no) => {
    const partes = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limite) { no(new HttpError(413, 'Cuerpo demasiado grande')); req.destroy(); } else partes.push(c); });
    req.on('end', () => { if (!partes.length) return ok({}); try { ok(JSON.parse(Buffer.concat(partes).toString('utf8'))); } catch { no(new HttpError(400, 'JSON no válido')); } });
    req.on('error', no);
  });
  const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(a => a[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
  const cookieSesion = (req, tok, borrar) => `erp_sid=${borrar ? '' : tok}; HttpOnly; SameSite=Strict; Path=/; ${borrar ? 'Max-Age=0' : 'Max-Age=43200'}${esHttps(req) || process.env.COOKIE_SECURE === '1' ? '; Secure' : ''}`;

  // ---------- auditoría desde el servidor ----------
  const nombrePaciente = pid => { if (!pid) return null; try { return (base.R.obtener('pacientes', pid) || {}).nombre || null; } catch { return null; } };
  const aud = (req, ev) => base.A.registrar({ uid: req.user && req.user.id, usuario: req.user ? req.user.usuario : ev.usuario, rol: req.user && req.user.rol, ip: ipDe(req), nombre: ev.nombre !== undefined ? ev.nombre : nombrePaciente(ev.pid), ...ev });
  const marcarCambio = () => base.M.set('cambios_desde_respaldo', (+base.M.get('cambios_desde_respaldo') || 0) + 1);

  // ---------- usuarios / sesiones ----------
  const validarClave = (pw, usuario) => {
    if (typeof pw !== 'string' || pw.length < 10) fallar(400, 'La contraseña debe tener al menos 10 caracteres');
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) fallar(400, 'La contraseña debe combinar letras y números');
    if (usuario && pw.toLowerCase().includes(String(usuario).toLowerCase())) fallar(400, 'La contraseña no debe contener el nombre de usuario');
  };
  const publico = u => ({ id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, cambiar: !!u.cambiar });
  const iniciarSesion = (req, res, u) => {
    const tok = C.aleatorio(32); base.SE.crear(tok, u.id, ipDe(req)); return cookieSesion(req, tok);
  };
  // MODO SIN LOGIN (solo desarrollo): toda petición entra como el administrador, sin pantalla de acceso.
  const sinLogin = !!opts.sinLogin;
  let uidDev = null;
  if (sinLogin) {
    let u = base.U.todos().find(x => x.rol === 'admin' && x.activo);
    if (!u) {
      const id = C.aleatorio(9).toLowerCase().replace(/[^a-z0-9]/g, 'x');
      base.U.crear({ id, usuario: 'admin', nombre: 'Administrador', rol: 'admin', hash: C.hashClave(C.aleatorio(24) + 'a1'), cambiar: false });
      u = { id };
    }
    base.U.set(u.id, { cambiar: 0 }); uidDev = u.id;
    if (!ctx.frase()) { const cfg = leerCfg(); cfg.fraseRespaldo = C.aleatorio(24); escribirCfg(cfg); }
  }
  function autenticar(req) {
    if (sinLogin) { const u = base.U.porId(uidDev); req.tok = 'sin-login'; return u && u.activo ? u : null; }
    const tok = cookies(req).erp_sid; if (!tok) return null;
    const s = base.SE.obtener(tok); if (!s) return null;
    const t = Date.now(); if (t - s.ultimo > IDLE || t - s.creado > ABS) { base.SE.cerrar(tok); return null; }
    const u = base.U.porId(s.uid); if (!u || !u.activo) { base.SE.cerrar(tok); return null; }
    base.SE.tocar(tok); req.tok = tok; return u;
  }
  const requiereRol = (req, ...roles) => { if (!roles.includes(req.user.rol)) fallar(403, 'No tienes permiso para esta acción'); };

  // ---------- rutas de la API ----------
  const rutas = [];
  const ruta = (metodo, re, fn, o = {}) => rutas.push({ metodo, re, fn, ...o });

  ruta('GET', /^\/api\/estado$/, (req, res) => enviar(res, 200, { configurado: base.U.contar() > 0, usuario: req.user ? publico(req.user) : null, inactividadMin: IDLE / 60000, sinLogin }), { publica: true });

  ruta('POST', /^\/api\/setup$/, async (req, res) => {
    if (base.U.contar() > 0) fallar(403, 'El sistema ya está configurado');
    const b = await leerCuerpo(req, 1e5), usuario = String(b.usuario || '').trim(), nombre = String(b.nombre || '').trim();
    if (!/^[a-z0-9._-]{3,32}$/i.test(usuario)) fallar(400, 'Usuario: 3 a 32 caracteres (letras, números, punto, guion)');
    if (!nombre) fallar(400, 'Escribe tu nombre');
    validarClave(b.password, usuario);
    if (typeof b.fraseRespaldo !== 'string' || b.fraseRespaldo.length < 12) fallar(400, 'La frase de respaldo debe tener al menos 12 caracteres');
    const cfg = leerCfg(); cfg.fraseRespaldo = b.fraseRespaldo; escribirCfg(cfg);
    const u = { id: C.aleatorio(9).toLowerCase().replace(/[^a-z0-9]/g, 'x'), usuario, nombre, rol: 'admin', hash: C.hashClave(b.password), cambiar: false };
    base.U.crear(u); req.user = base.U.porId(u.id); aud(req, { entidad: 'usuarios', accion: 'configuración inicial', ref: u.id });
    const ck = iniciarSesion(req, res, u);
    try { Resp.crear(ctx, 'inicial'); } catch (e) { log('No se pudo crear el respaldo inicial: ' + e.message); }
    enviar(res, 200, { usuario: publico(req.user) }, { 'Set-Cookie': ck });
  }, { publica: true });

  ruta('POST', /^\/api\/login$/, async (req, res) => {
    const ip = ipDe(req), t = Date.now(), lista = (intentosIP.get(ip) || []).filter(x => t - x < 600000);
    if (lista.length >= 30) fallar(429, 'Demasiados intentos. Espera unos minutos.');
    lista.push(t); intentosIP.set(ip, lista);
    const b = await leerCuerpo(req, 1e4), nom = String(b.usuario || '').trim().slice(0, 40), u = base.U.porNombre(nom);
    if (u && u.bloqueado_hasta > t) { aud(req, { usuario: nom, entidad: 'sesion', accion: 'login bloqueado' }); fallar(429, 'Cuenta bloqueada temporalmente por intentos fallidos. Inténtalo en unos minutos.'); }
    const ok = C.verificarClave(String(b.password || ''), u ? u.hash : C.claveFalsa) && u && u.activo;
    if (!ok) {
      if (u) { const f = u.fallos + 1; base.U.set(u.id, f >= 5 ? { fallos: 0, bloqueado_hasta: t + 15 * 60000 } : { fallos: f }); }
      aud(req, { usuario: nom, entidad: 'sesion', accion: 'login fallido' }); fallar(401, 'Usuario o contraseña incorrectos');
    }
    base.U.set(u.id, { fallos: 0, bloqueado_hasta: 0 }); req.user = u; aud(req, { entidad: 'sesion', accion: 'login' });
    enviar(res, 200, { usuario: publico(u) }, { 'Set-Cookie': iniciarSesion(req, res, u) });
  }, { publica: true });

  ruta('POST', /^\/api\/logout$/, (req, res) => { if (req.user) { aud(req, { entidad: 'sesion', accion: 'logout' }); base.SE.cerrar(req.tok); } enviar(res, 200, { ok: true }, { 'Set-Cookie': cookieSesion(req, '', true) }); }, { publica: true });

  ruta('POST', /^\/api\/password$/, async (req, res) => {
    const b = await leerCuerpo(req, 1e4);
    if (!C.verificarClave(String(b.actual || ''), req.user.hash)) fallar(403, 'La contraseña actual no es correcta');
    validarClave(b.nueva, req.user.usuario);
    if (b.nueva === b.actual) fallar(400, 'La nueva contraseña debe ser distinta');
    base.U.set(req.user.id, { hash: C.hashClave(b.nueva), cambiar: 0 });
    base.SE.cerrarDe(req.user.id); aud(req, { entidad: 'usuarios', accion: 'cambio de contraseña', ref: req.user.id });
    const ck = iniciarSesion(req, res, req.user); enviar(res, 200, { ok: true }, { 'Set-Cookie': ck });
  }, { permitirCambiar: true });

  ruta('GET', /^\/api\/bootstrap$/, (req, res) => {
    const rol = req.user.rol, datos = {};
    for (const e of Object.keys(P.ENTIDADES)) if (P.puede(rol, e, 'leer')) datos[e] = base.R.todos(e).map(r => P.filtrarLectura(rol, e, r));
    const t = Date.now(), k = req.tok;
    if (!ultBoot.has(k) || t - ultBoot.get(k) > 15 * 60000) { ultBoot.set(k, t); aud(req, { entidad: 'sistema', accion: 'cargar datos', nombre: null }); }
    enviar(res, 200, { usuario: publico(req.user), permisos: P.paraCliente(rol), datos, ajustes: JSON.parse(base.M.get('ajustes') || '{}') });
  });

  // ---- CRUD genérico de registros ----
  const entidad = nombre => { if (!P.ENTIDADES[nombre]) fallar(404, 'Entidad desconocida'); return nombre; };
  const limpiar = (o, lim = 1.5e6) => { if (typeof o !== 'object' || !o || Array.isArray(o)) fallar(400, 'Registro no válido'); const r = {}; for (const k of Object.keys(o)) if (k !== '__proto__' && k !== 'constructor') r[k] = o[k]; if (JSON.stringify(r).length > lim) fallar(413, 'Registro demasiado grande'); return r; };
  const permiso = (req, ent, op) => { if (!P.puede(req.user.rol, ent, op)) { aud(req, { entidad: ent, accion: 'acceso denegado: ' + op }); fallar(403, 'No tienes permiso para esta acción'); } };
  const validarMovimientoPago = (p, excluir = '') => {
    if (p.movimiento && !['Cobro', 'Devolución'].includes(p.movimiento)) return 'El tipo de movimiento no es válido';
    if (p.movimiento === 'Devolución') {
      if (typeof p.monto !== 'number' || !Number.isFinite(p.monto) || p.monto >= 0) return 'La devolución debe tener un monto negativo';
      if (!ID_RE.test(String(p.ref_pago || ''))) return 'Selecciona el cobro original de la devolución';
      const original = base.R.obtener('pagos', p.ref_pago);
      if (!original || original.pid !== p.pid || original.monto <= 0 || original.movimiento === 'Devolución') return 'El cobro original no existe o no corresponde a este paciente';
      if (['Boleta', 'Factura'].includes(original.comp_tipo) && (p.comp_tipo !== 'Nota de crédito' || !String(p.comp_num || '').trim())) return 'Registra el número de la nota de crédito emitida externamente';
      const devuelto = base.R.todos('pagos').filter(x => x.id !== excluir && x.movimiento === 'Devolución' && x.ref_pago === original.id).reduce((n, x) => n + Math.abs(+x.monto || 0), 0);
      if (devuelto + Math.abs(p.monto) > +original.monto + 0.004) return 'La devolución acumulada no puede superar el cobro original';
      return null;
    }
    if (typeof p.monto !== 'number' || !Number.isFinite(p.monto) || p.monto <= 0) return 'El monto del cobro debe ser mayor que 0';
    const devuelto = base.R.todos('pagos').filter(x => x.id !== excluir && x.movimiento === 'Devolución' && x.ref_pago === p.id).reduce((n, x) => n + Math.abs(+x.monto || 0), 0);
    if (devuelto > p.monto + 0.004) return 'El monto del cobro no puede ser menor que sus devoluciones registradas';
    return null;
  };

  ruta('POST', /^\/api\/r\/([a-z]+)$/, async (req, res, [, ent]) => {
    entidad(ent); permiso(req, ent, 'crear');
    const cfg = P.ENTIDADES[ent], b = limpiar(await leerCuerpo(req, cfg.max || 2e6), cfg.max || 1.5e6);
    if (ent === 'pagos' && b.movimiento === 'Devolución' && req.user.rol !== 'admin') { aud(req, { entidad: ent, accion: 'acceso denegado: registrar devolución' }); fallar(403, 'Solo administración puede registrar devoluciones'); }
    const { ok, no } = P.filtrarEscritura(req.user.rol, ent, b); if (no.length) fallar(403, 'Sin permiso para los campos: ' + no.join(', '));
    const id = b.id; if (!ID_RE.test(String(id || ''))) fallar(400, 'Identificador no válido');
    if (base.R.obtener(ent, id)) fallar(409, 'Ya existe un registro con ese identificador');
    if (cfg.hijo && !base.R.obtener('pacientes', String(b.pid || ''))) fallar(422, 'El paciente indicado no existe');
    if (ent === 'pacientes' && !String(b.nombre || '').trim()) fallar(422, 'El nombre es obligatorio');
    const now = new Date().toISOString(), o = { ...ok, id, creado: now, actualizado: now, fecha_alta: hoy() }; if (cfg.hijo) o.pid = b.pid;
    const errV = cfg.validar && cfg.validar(o); if (errV) fallar(422, errV);
    if (ent === 'pagos') { const errPago = validarMovimientoPago(o); if (errPago) fallar(422, errPago); }
    base.tx(() => { base.R.crear(ent, o); marcarCambio(); aud(req, { entidad: ent, accion: ent === 'pagos' && o.movimiento === 'Devolución' ? 'registrar devolución' : 'crear', ref: id, pid: ent === 'pacientes' ? id : o.pid }); });
    enviar(res, 201, P.filtrarLectura(req.user.rol, ent, o));
  });

  ruta('PATCH', /^\/api\/r\/([a-z]+)\/([a-z0-9]+)$/, async (req, res, [, ent, id]) => {
    entidad(ent); permiso(req, ent, 'editar');
    const ex = base.R.obtener(ent, id); if (!ex) fallar(404, 'No existe el registro');
    if (ent === 'pagos' && ex.movimiento === 'Devolución') fallar(409, 'Las devoluciones son inmutables; registra un nuevo movimiento para corregirla');
    if (ent === 'pagos' && base.R.todos('pagos').some(p => p.movimiento === 'Devolución' && p.ref_pago === id)) fallar(409, 'No puedes editar un cobro mientras tenga devoluciones registradas');
    const b = limpiar(await leerCuerpo(req, P.ENTIDADES[ent].max || 2e6), P.ENTIDADES[ent].max || 1.5e6); delete b.pid;
    if (ent === 'pagos' && b.movimiento === 'Devolución') { if (req.user.rol !== 'admin') { aud(req, { entidad: ent, accion: 'acceso denegado: registrar devolución' }); fallar(403, 'Solo administración puede registrar devoluciones'); } fallar(422, 'Registra una devolución como un nuevo movimiento, no edites el cobro'); }
    const { ok, no } = P.filtrarEscritura(req.user.rol, ent, b); if (no.length) fallar(403, 'Sin permiso para los campos: ' + no.join(', '));
    if (ent === 'pacientes' && 'nombre' in ok && !String(ok.nombre).trim()) fallar(422, 'El nombre es obligatorio');
    const o = { ...ex, ...ok, id: ex.id, creado: ex.creado, fecha_alta: ex.fecha_alta, actualizado: new Date().toISOString() }; if (ex.pid) o.pid = ex.pid;
    const errV = P.ENTIDADES[ent].validar && P.ENTIDADES[ent].validar(o); if (errV) fallar(422, errV);
    if (ent === 'pagos') { const errPago = validarMovimientoPago(o, id); if (errPago) fallar(422, errPago); }
    base.tx(() => { base.R.guardar(ent, o); marcarCambio(); aud(req, { entidad: ent, accion: 'editar', ref: id, pid: ent === 'pacientes' ? id : o.pid }); });
    enviar(res, 200, P.filtrarLectura(req.user.rol, ent, o));
  });

  const borrarUno = (req, ent, id, accion = 'eliminar') => {
    const ex = base.R.obtener(ent, id); if (!ex) return false;
    const pid = ent === 'pacientes' ? id : ex.pid, nombre = nombrePaciente(pid);
    base.R.borrar(ent, id, req.user.usuario); aud(req, { entidad: ent, accion, ref: id, pid, nombre }); return true;
  };
  ruta('DELETE', /^\/api\/r\/([a-z]+)\/([a-z0-9]+)$/, (req, res, [, ent, id]) => {
    entidad(ent); permiso(req, ent, 'borrar');
    if (ent === 'pagos' && base.R.todos('pagos').some(p => p.movimiento === 'Devolución' && p.ref_pago === id)) fallar(409, 'No puedes eliminar este cobro mientras tenga devoluciones registradas');
    base.tx(() => {
      if (ent === 'pacientes') { for (const h of base.R.hijosDe(id)) borrarUno(req, h.entidad, h.id, 'eliminar (cascada)'); base.EN.borrarDe(id); }
      if (!borrarUno(req, ent, id)) fallar(404, 'No existe el registro'); marcarCambio();
    });
    enviar(res, 200, { ok: true });
  });
  ruta('POST', /^\/api\/r\/([a-z]+)\/borrar-varios$/, async (req, res, [, ent]) => {
    entidad(ent); permiso(req, ent, 'borrar');
    const b = await leerCuerpo(req, 1e6); if (!Array.isArray(b.ids) || b.ids.some(i => !ID_RE.test(String(i)))) fallar(400, 'Lista de identificadores no válida');
    let n = 0; base.tx(() => { b.ids.forEach(i => { if (borrarUno(req, ent, i)) n++; }); if (n) marcarCambio(); });
    enviar(res, 200, { borrados: n });
  });

  // ---- correlativo de recibos internos y datos del consultorio ----
  ruta('POST', /^\/api\/correlativo$/, (req, res) => {
    if (!P.puede(req.user.rol, 'pagos', 'crear')) fallar(403, 'Sin permiso');
    const aj = JSON.parse(base.M.get('ajustes') || '{}'), serie = /^[A-Z0-9]{2,6}$/.test(aj.serie || '') ? aj.serie : 'R001'; let numero;
    base.tx(() => { const n = (+base.M.get('corr_recibo') || 0) + 1; base.M.set('corr_recibo', n); numero = serie + '-' + String(n).padStart(6, '0'); marcarCambio(); aud(req, { entidad: 'pagos', accion: 'emitir recibo', ref: numero, nombre: null }); });
    enviar(res, 200, { numero });
  });
  ruta('POST', /^\/api\/ajustes$/, async (req, res) => {
    requiereRol(req, 'admin'); const b = await leerCuerpo(req, 1e4), o = {};
    for (const k of ['consultorio', 'ruc', 'direccion', 'telefono', 'serie', 'urlPublica']) if (b[k] !== undefined) o[k] = String(b[k]).trim().slice(0, 200);
    if (o.urlPublica) { o.urlPublica = o.urlPublica.replace(/\/+$/, ''); if (!/^https:\/\/[^\s/]+$/i.test(o.urlPublica) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o.urlPublica)) fallar(400, 'La dirección pública debe ser como https://consultorio.tudominio.pe (con HTTPS, sin rutas)'); }
    if (o.serie && !/^[A-Z0-9]{2,6}$/.test(o.serie)) fallar(400, 'La serie debe tener 2 a 6 letras mayúsculas o números (ej. R001)');
    base.M.set('ajustes', JSON.stringify(o)); marcarCambio(); aud(req, { entidad: 'sistema', accion: 'editar datos del consultorio', nombre: null }); enviar(res, 200, o);
  });

  // ---- cuestionarios por enlace: el profesional crea el enlace; el paciente responde sin cuenta ----
  const MOMENTOS = ['Inicio', 'Seguimiento', 'Cierre'];
  ruta('POST', /^\/api\/enlaces$/, async (req, res) => {
    permiso(req, 'tests', 'crear'); const b = await leerCuerpo(req, 1e4);
    if (!ID_RE.test(String(b.pid || '')) || !base.R.obtener('pacientes', b.pid)) fallar(422, 'El paciente indicado no existe');
    const tests = [...new Set(Array.isArray(b.tests) ? b.tests : [])]; if (!tests.length || tests.length > 6 || tests.some(k => !Escalas.T[k])) fallar(400, 'Elige entre 1 y 6 escalas válidas');
    if (!MOMENTOS.includes(b.momento)) fallar(400, 'Momento no válido'); const dias = Math.min(30, Math.max(1, Math.round(+b.dias || 7)));
    const token = C.aleatorio(24), id = C.aleatorio(9).toLowerCase().replace(/[^a-z0-9]/g, 'x'), vence = Date.now() + dias * 864e5;
    base.tx(() => { base.EN.crear({ id, token, pid: b.pid, tests, momento: b.momento, vence, por: req.user.usuario }); aud(req, { entidad: 'enlaces', accion: 'crear enlace de cuestionario (' + tests.join(',') + ')', ref: id, pid: b.pid }); });
    enviar(res, 201, { id, token, vence });
  });
  ruta('GET', /^\/api\/enlaces\/([a-z0-9]{6,24})$/, (req, res, [, pid]) => {
    permiso(req, 'tests', 'leer'); enviar(res, 200, base.EN.pendientes(pid, Date.now()).map(e => ({ ...e, tests: JSON.parse(e.tests) })));
  });
  ruta('DELETE', /^\/api\/enlaces\/([a-z0-9]{6,24})$/, (req, res, [, id]) => {
    permiso(req, 'tests', 'borrar'); const e = base.EN.porId(id); if (!e) fallar(404, 'No existe el enlace');
    base.EN.revocar(id); aud(req, { entidad: 'enlaces', accion: 'revocar enlace', ref: id, pid: e.pid }); enviar(res, 200, { ok: true });
  });

  // Portal del paciente (rutas PÚBLICAS: no hay sesión; el token del enlace es la única credencial, de un solo uso y con vencimiento)
  const TOK_RE = /^[A-Za-z0-9_-]{20,64}$/;
  function enlaceValido(req, tok) {
    req.user = null; // aunque el servidor esté en modo sin login, el portal nunca actúa como el administrador
    const ip = ipDe(req), t = Date.now(), lista = (intentosPortal.get(ip) || []).filter(x => t - x < 600000);
    if (lista.length >= 60) fallar(429, 'Demasiados intentos. Espera unos minutos.');
    lista.push(t); intentosPortal.set(ip, lista);
    const e = TOK_RE.test(tok) ? base.EN.porToken(tok) : null;
    if (!e || e.usado || e.vence <= t) { for (let i = 0; i < 4; i++) lista.push(t); fallar(404, 'Este enlace no es válido, ya se usó o venció. Pide uno nuevo a tu terapeuta.'); }
    return e;
  }
  ruta('GET', /^\/api\/portal\/([A-Za-z0-9_-]+)$/, (req, res, [, tok]) => {
    const e = enlaceValido(req, tok), aj = JSON.parse(base.M.get('ajustes') || '{}');
    enviar(res, 200, { consultorio: aj.consultorio || '', vence: e.vence, momento: e.momento, escalas: JSON.parse(e.tests).map(k => { const d = Escalas.T[k]; return { k, nom: d.nom, ins: d.ins, it: d.it, op: Escalas.opciones(k) }; }) });
  }, { publica: true });
  ruta('POST', /^\/api\/portal\/([A-Za-z0-9_-]+)$/, async (req, res, [, tok]) => {
    const e = enlaceValido(req, tok), b = await leerCuerpo(req, 5e4), ks = JSON.parse(e.tests); let crisis = false;
    if (!b.resp || typeof b.resp !== 'object') fallar(400, 'Faltan respuestas');
    for (const k of ks) { const m = Escalas.validar(k, b.resp[k]); if (m) fallar(400, `${Escalas.T[k].corto}: ${m}`); }
    base.tx(() => {
      if (!base.EN.marcarUsado(e.id)) fallar(404, 'Este enlace ya se usó.');
      for (const k of ks) {
        const r = b.resp[k], p = Escalas.puntaje(k, r), now = new Date().toISOString(), id = C.aleatorio(9).toLowerCase().replace(/[^a-z0-9]/g, 'x');
        base.R.crear('tests', { id, pid: e.pid, test: k, fecha: hoy(), momento: e.momento, resp: r, puntaje: p, nivel: Escalas.nivel(k, p), origen: 'enlace', creado: now, actualizado: now, fecha_alta: hoy() });
        if (k === 'phq' && r[8] > 0) crisis = true;
        aud(req, { usuario: 'paciente (enlace)', entidad: 'tests', accion: 'respondió por enlace: ' + k, ref: id, pid: e.pid });
      }
      marcarCambio();
    });
    enviar(res, 200, { ok: true, crisis });
  }, { publica: true });

  // ---- descarga de un adjunto (el contenido no viaja en bootstrap) ----
  ruta('GET', /^\/api\/adjunto\/([a-z0-9]+)$/, (req, res, [, id]) => {
    permiso(req, 'adjuntos', 'leer'); const a = base.R.obtener('adjuntos', id); if (!a) fallar(404, 'No existe el adjunto');
    aud(req, { entidad: 'adjuntos', accion: 'descargar adjunto', ref: id, pid: a.pid }); enviar(res, 200, { nombre: a.nombre, mime: a.mime, data: a.data });
  });

  // ---- eventos de auditoría que solo el navegador conoce (consultas, impresiones) ----
  const ACC = { consultar: 'pacientes', 'imprimir historia': 'reportes', 'imprimir caja': 'reportes', 'imprimir informe': 'reportes', 'imprimir comprobante': 'reportes', exportar: 'reportes', 'imprimir consentimiento': 'reportes', recordatorio: 'sesiones', 'imprimir plan de seguridad': 'reportes' };
  ruta('POST', /^\/api\/audit$/, async (req, res) => {
    const b = await leerCuerpo(req, 1e4), ent = ACC[b.accion];
    if (!ent) fallar(400, 'Acción no registrable'); if (!P.puede(req.user.rol, ent === 'reportes' ? 'pacientes' : ent, 'leer')) fallar(403, 'Sin permiso');
    const pid = b.pid && ID_RE.test(String(b.pid)) && base.R.obtener('pacientes', b.pid) ? b.pid : null;
    aud(req, { entidad: ent, accion: b.accion, ref: ID_RE.test(String(b.ref || '')) ? b.ref : null, pid }); enviar(res, 200, { ok: true });
  });
  ruta('GET', /^\/api\/auditoria$/, (req, res) => { requiereRol(req, 'admin'); enviar(res, 200, { eventos: base.A.recientes(500), total: base.db.prepare('SELECT COUNT(*) n FROM auditoria').get().n }); });
  ruta('GET', /^\/api\/auditoria\/verificar$/, (req, res) => { requiereRol(req, 'admin'); enviar(res, 200, base.A.verificar()); });

  // ---- usuarios (solo admin) ----
  ruta('GET', /^\/api\/usuarios$/, (req, res) => { requiereRol(req, 'admin'); enviar(res, 200, base.U.todos()); });
  ruta('POST', /^\/api\/usuarios$/, async (req, res) => {
    requiereRol(req, 'admin'); const b = await leerCuerpo(req, 1e4), usuario = String(b.usuario || '').trim(), nombre = String(b.nombre || '').trim();
    if (!/^[a-z0-9._-]{3,32}$/i.test(usuario)) fallar(400, 'Usuario: 3 a 32 caracteres (letras, números, punto, guion)'); if (!nombre) fallar(400, 'Escribe el nombre');
    if (!P.TODOS.includes(b.rol)) fallar(400, 'Rol no válido'); if (base.U.porNombre(usuario)) fallar(409, 'Ese usuario ya existe');
    const temp = C.claveTemporal(), id = C.aleatorio(9).toLowerCase().replace(/[^a-z0-9]/g, 'x');
    base.U.crear({ id, usuario, nombre, rol: b.rol, hash: C.hashClave(temp), cambiar: true }); aud(req, { entidad: 'usuarios', accion: 'crear usuario (' + b.rol + ')', ref: id });
    enviar(res, 201, { id, usuario, claveTemporal: temp });
  });
  ruta('PATCH', /^\/api\/usuarios\/([a-z0-9]+)$/, async (req, res, [, id]) => {
    requiereRol(req, 'admin'); const u = base.U.porId(id); if (!u) fallar(404, 'No existe el usuario'); const b = await leerCuerpo(req, 1e4), c = {};
    if (b.rol !== undefined) { if (!P.TODOS.includes(b.rol)) fallar(400, 'Rol no válido'); c.rol = b.rol; }
    if (b.activo !== undefined) c.activo = b.activo ? 1 : 0; if (b.nombre) c.nombre = String(b.nombre).trim();
    if ((c.rol && c.rol !== 'admin' || c.activo === 0) && u.rol === 'admin' && u.activo && base.U.adminsActivos() <= 1) fallar(409, 'Debe quedar al menos un administrador activo');
    base.U.set(id, c); if (c.activo === 0 || c.rol) base.SE.cerrarDe(id);
    aud(req, { entidad: 'usuarios', accion: 'editar usuario ' + Object.keys(c).join(','), ref: id }); enviar(res, 200, { ok: true });
  });
  ruta('POST', /^\/api\/usuarios\/([a-z0-9]+)\/reiniciar$/, (req, res, [, id]) => {
    requiereRol(req, 'admin'); const u = base.U.porId(id); if (!u) fallar(404, 'No existe el usuario');
    const temp = C.claveTemporal(); base.U.set(id, { hash: C.hashClave(temp), cambiar: 1, fallos: 0, bloqueado_hasta: 0 }); base.SE.cerrarDe(id);
    aud(req, { entidad: 'usuarios', accion: 'reiniciar contraseña', ref: id }); enviar(res, 200, { claveTemporal: temp });
  });

  // ---- respaldos (solo admin) ----
  ruta('GET', /^\/api\/respaldos$/, (req, res) => {
    requiereRol(req, 'admin'); const ult = JSON.parse(base.M.get('resp_ultimo') || 'null');
    enviar(res, 200, { archivos: Resp.listar(ctx.dirRespaldos), ultimo: ult, carpeta: ctx.dirRespaldos, carpetaExtra: ctx.dirExtra, fraseConfigurada: !!ctx.frase(), cambiosPendientes: +base.M.get('cambios_desde_respaldo') || 0, claveOrigen: origen });
  });
  ruta('POST', /^\/api\/respaldos$/, (req, res) => {
    requiereRol(req, 'admin'); const r = Resp.crear(ctx, 'manual'); base.M.set('cambios_desde_respaldo', 0); aud(req, { entidad: 'respaldo', accion: 'respaldo manual', ref: r.nombre, nombre: null }); enviar(res, 201, r);
  });
  ruta('GET', /^\/api\/respaldos\/(respaldo-\d{8}-\d{6}\.cerp)$/, (req, res, [, nombre]) => {
    requiereRol(req, 'admin'); const f = path.join(ctx.dirRespaldos, nombre); if (!fs.existsSync(f)) fallar(404, 'No existe');
    aud(req, { entidad: 'respaldo', accion: 'descargar respaldo', ref: nombre, nombre: null });
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${nombre}"`, 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
  });

  // ---- importar datos de la versión anterior (localStorage .json) ----
  ruta('POST', /^\/api\/importar-legacy$/, async (req, res) => {
    requiereRol(req, 'admin'); const b = await leerCuerpo(req, 60e6), cuenta = {}; let omitidos = 0;
    base.tx(() => {
      const orden = ['pacientes', ...Object.keys(P.ENTIDADES).filter(e => e !== 'pacientes')];
      for (const ent of orden) {
        if (!Array.isArray(b[ent])) continue; cuenta[ent] = 0;
        for (const r0 of b[ent]) {
          const r = limpiar(r0); if (!ID_RE.test(String(r.id || '')) || base.R.obtener(ent, r.id)) { omitidos++; continue; }
          if (P.ENTIDADES[ent].hijo && !base.R.obtener('pacientes', String(r.pid || ''))) { omitidos++; continue; }
          const now = new Date().toISOString(); r.creado = r.creado || now; r.actualizado = r.actualizado || r.creado; r.fecha_alta = r.fecha_alta || hoy();
          if (P.ENTIDADES[ent].validar && P.ENTIDADES[ent].validar(r)) { omitidos++; continue; }
          base.R.crear(ent, r); cuenta[ent]++;
        }
      }
      marcarCambio(); aud(req, { entidad: 'respaldo', accion: 'importar datos anteriores', ref: JSON.stringify(cuenta).slice(0, 200), nombre: null });
    });
    enviar(res, 200, { importados: cuenta, omitidos });
  });

  // ---------- servidor de archivos estáticos ----------
  // La interfaz vive en la raíz del proyecto: se sirve SOLO esta lista (nunca server/, data/, tests/, etc.)
  const PUB = RAIZ, PUBLICOS = new Set(['index.html', 'responder.html']), CARPETAS = new Set(['css', 'js', 'vendor']);
  function estatico(req, res) {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html'; else if (/^\/r\/[A-Za-z0-9_-]{20,64}$/.test(p)) p = '/responder.html';
    const f = path.normalize(path.join(PUB, p)); if (!f.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
    const rel = path.relative(PUB, f).split(path.sep); if (!(rel.length === 1 ? PUBLICOS.has(rel[0]) : CARPETAS.has(rel[0]))) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(d); });
  }
  const CABECERAS = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };

  const servidor = http.createServer(async (req, res) => {
    for (const [k, v] of Object.entries(CABECERAS)) res.setHeader(k, v);
    if (esHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith('/api/')) return req.method === 'GET' ? estatico(req, res) : (res.writeHead(405), res.end());
    try {
      // Anti-CSRF: encabezado propio + Origin coherente en métodos que modifican
      if (req.method !== 'GET') {
        if (req.headers['x-erp'] !== '1') fallar(403, 'Petición no autorizada');
        if (req.headers.origin) { let h; try { h = new URL(req.headers.origin).host; } catch { h = ''; } if (h !== req.headers.host && !origenesOk.includes(String(req.headers.origin).replace(/\/+$/, ''))) fallar(403, 'Origen no permitido'); }
      }
      let r = null, m = null;
      for (const x of rutas) if (x.metodo === req.method && (m = url.pathname.match(x.re))) { r = x; break; }
      if (!r) fallar(404, 'Ruta no encontrada');
      req.user = autenticar(req);
      if (!r.publica) {
        if (!req.user) fallar(401, 'Sesión no iniciada o expirada');
        if (req.user.cambiar && !r.permitirCambiar) fallar(403, 'Debes cambiar tu contraseña antes de continuar');
      }
      await r.fn(req, res, m);
    } catch (e) {
      if (e instanceof HttpError) return enviar(res, e.code, { error: e.message });
      log('ERROR ' + req.method + ' ' + url.pathname + ': ' + (e && e.stack || e)); enviar(res, 500, { error: 'Error interno del servidor' });
    }
  });

  const limpieza = setInterval(() => {
    const t = Date.now(), limite = t - 600000;
    for (const mapa of [intentosIP, intentosPortal]) {
      for (const [ip, lista] of mapa) {
        const recientes = lista.filter(x => x >= limite);
        if (recientes.length) mapa.set(ip, recientes); else mapa.delete(ip);
      }
    }
    for (const [tok, ultimo] of ultBoot) if (t - ultimo > IDLE) ultBoot.delete(tok);
    try { base.SE.limpiar(IDLE, ABS); } catch {}
  }, 5 * 60000); limpieza.unref();
  const plan = Resp.planificar(ctx, log);
  function cerrar() {
    clearInterval(plan); clearInterval(limpieza);
    return new Promise(ok => servidor.close(() => { try { if ((+base.M.get('cambios_desde_respaldo') || 0) > 0 && ctx.frase() && !opts.sinRespaldoAlCerrar) Resp.crear(ctx, 'cierre'); } catch {} try { base.cerrar(); } catch {} ok(); }));
  }
  return { servidor, ctx, base, cerrar, log, origen };
}

if (require.main === module) {
  const PORT = +process.env.PORT || 3000, HOST = process.env.HOST || '127.0.0.1';
  const local = HOST === '127.0.0.1' || HOST === 'localhost';
  const conLogin = process.env.ERP_SIN_LOGIN === '0';
  if (!conLogin && !local) { console.error('ERROR: el modo sin login solo se permite en este equipo (HOST=127.0.0.1). Para exponer el servidor en la red activa el login con ERP_SIN_LOGIN=0.'); process.exit(1); }
  const s = crearServidor({ sinLogin: !conLogin });
  if (!conLogin) s.log('MODO DESARROLLO: sin inicio de sesión. Para volver a activarlo: ERP_SIN_LOGIN=0 npm start');
  s.servidor.listen(PORT, HOST, () => {
    s.log(`Consultorio ERP en http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}  (datos en ${s.ctx.dirDatos})`);
    if (s.origen === 'archivo-nuevo') s.log('Se generó una clave de cifrado nueva en data/clave.key. Se incluye dentro de cada respaldo cifrado.');
    if (HOST !== '127.0.0.1' && HOST !== 'localhost') s.log('AVISO: el servidor es accesible desde la red. Usa HTTPS (ver docs/DESPLIEGUE.md).');
  });
  const salir = () => { s.log('Cerrando…'); s.cerrar().then(() => process.exit(0)); };
  process.on('SIGINT', salir); process.on('SIGTERM', salir);
}
module.exports = { crearServidor };
