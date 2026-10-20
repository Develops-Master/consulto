// Respaldos automáticos CIFRADOS (AES-256-GCM con una frase que define el administrador).
// Cada archivo .cerp contiene: copia consistente de la base + la clave de datos, todo protegido por la frase.
// Con el archivo y la frase se puede reconstruir el sistema en otro equipo.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const C = require('./cripto');

const pad = n => String(n).padStart(2, '0');
const sello = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

function crear(ctx, motivo = 'auto') {
  const frase = ctx.frase(); if (!frase) throw new Error('No hay frase de respaldo configurada');
  fs.mkdirSync(ctx.dirRespaldos, { recursive: true });
  const tmp = path.join(ctx.dirDatos, `tmp-${Date.now()}.db`);
  try {
    ctx.base.db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    const dbBuf = zlib.gzipSync(fs.readFileSync(tmp));
    const meta = Buffer.from(JSON.stringify({ version: 1, fecha: new Date().toISOString(), motivo, claveDatos: ctx.clave.toString('hex') }));
    const len = Buffer.alloc(4); len.writeUInt32BE(meta.length);
    const out = C.cifrarConFrase(frase, Buffer.concat([len, meta, dbBuf]));
    const nombre = `respaldo-${sello(new Date())}.cerp`, destino = path.join(ctx.dirRespaldos, nombre);
    fs.writeFileSync(destino + '.tmp', out); fs.renameSync(destino + '.tmp', destino);
    const r = { nombre, bytes: out.length, extra: null };
    if (ctx.dirExtra) {
      try { fs.mkdirSync(ctx.dirExtra, { recursive: true }); fs.copyFileSync(destino, path.join(ctx.dirExtra, nombre)); r.extra = 'ok'; }
      catch (e) { r.extra = 'error: ' + e.message; }
    }
    ctx.base.M.set('resp_ultimo', JSON.stringify({ nombre, fecha: new Date().toISOString(), extra: r.extra, error: null }));
    retencion(ctx.dirRespaldos); if (ctx.dirExtra) try { retencion(ctx.dirExtra); } catch {}
    return r;
  } catch (e) {
    ctx.base.M.set('resp_ultimo', JSON.stringify({ ...(JSON.parse(ctx.base.M.get('resp_ultimo') || '{}')), error: e.message, errorFecha: new Date().toISOString() }));
    throw e;
  } finally { try { fs.unlinkSync(tmp); } catch {} }
}

// Retención: todo lo de los últimos 3 días · el último de cada día hasta 30 días · el último de cada mes hasta 12 meses
function retencion(dir) {
  const arch = fs.readdirSync(dir).filter(f => /^respaldo-\d{8}-\d{6}\.cerp$/.test(f)).sort().reverse(), ahora = Date.now(), vistos = new Set();
  for (const f of arch) {
    const [y, m, d] = [f.slice(9, 13), f.slice(13, 15), f.slice(15, 17)], t = new Date(+y, +m - 1, +d).getTime(), dias = (ahora - t) / 864e5;
    const dia = `${y}${m}${d}`, mes = `${y}${m}`;
    let guardar = false;
    if (dias <= 3) guardar = true;
    else if (dias <= 30 && !vistos.has('d' + dia)) guardar = true;
    else if (dias <= 365 && !vistos.has('m' + mes)) guardar = true;
    if (guardar) { vistos.add('d' + dia); vistos.add('m' + mes); } else try { fs.unlinkSync(path.join(dir, f)); } catch {}
  }
}

function listar(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /^respaldo-\d{8}-\d{6}\.cerp$/.test(f)).sort().reverse().map(f => {
    const st = fs.statSync(path.join(dir, f)); return { nombre: f, bytes: st.size, fecha: st.mtime.toISOString() };
  });
}

// Devuelve { meta, dbBuf } (dbBuf = archivo SQLite sin comprimir)
function abrirRespaldo(buf, frase) {
  const p = C.descifrarConFrase(frase, buf), n = p.readUInt32BE(0);
  return { meta: JSON.parse(p.subarray(4, 4 + n).toString()), dbBuf: zlib.gunzipSync(p.subarray(4 + n)) };
}

// Planificador: al iniciar y cada 30 min; respalda si hubo cambios y el último tiene más de 4 h (o no hay ninguno)
function planificar(ctx, log) {
  const tick = () => {
    try {
      if (!ctx.frase()) return;
      const ult = JSON.parse(ctx.base.M.get('resp_ultimo') || '{}'), edad = ult.fecha ? Date.now() - new Date(ult.fecha).getTime() : Infinity;
      const cambios = +ctx.base.M.get('cambios_desde_respaldo') || 0;
      if ((cambios > 0 && edad > 4 * 36e5) || edad === Infinity || edad > 24 * 36e5) {
        const r = crear(ctx, 'auto'); ctx.base.M.set('cambios_desde_respaldo', 0); log(`Respaldo automático: ${r.nombre}${r.extra ? ' · copia extra ' + r.extra : ''}`);
      }
    } catch (e) { log('ERROR en respaldo automático: ' + e.message); }
  };
  setTimeout(tick, 5000).unref(); return setInterval(tick, 30 * 60 * 1000).unref();
}
module.exports = { crear, listar, retencion, abrirRespaldo, planificar };
