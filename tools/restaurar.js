// Restaura un respaldo cifrado (.cerp). USO:  node tools/restaurar.js ruta/al/respaldo.cerp
// El servidor debe estar DETENIDO. Pide la frase de respaldo (o usa la variable ERP_BACKUP_PASS).
// Lo actual NO se borra: se mueve a data/anterior-<fecha>/.
process.env.TZ = process.env.TZ || 'America/Lima';
const fs = require('node:fs'), path = require('node:path'), readline = require('node:readline');
const Resp = require('../server/respaldo'), { abrir } = require('../server/db'), P = require('../server/permisos');

const archivo = process.argv[2], dir = path.resolve(process.env.ERP_DATA_DIR || path.join(__dirname, '..', 'data'));
if (!archivo) { console.error('Uso: node tools/restaurar.js archivo.cerp'); process.exit(1); }
const preguntar = t => new Promise(ok => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(t, a => { rl.close(); ok(a); }); });

(async () => {
  const frase = process.env.ERP_BACKUP_PASS || await preguntar('Frase de respaldo: ');
  let r; try { r = Resp.abrirRespaldo(fs.readFileSync(archivo), frase); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
  console.log(`Respaldo del ${new Date(r.meta.fecha).toLocaleString('es-PE')} (${r.meta.motivo}).`);
  if (process.env.ERP_ASUME_SI !== '1' && (await preguntar('Esto reemplazará los datos actuales (se guardará una copia aparte). ¿Continuar? (escribe SI): ')).trim() !== 'SI') { console.log('Cancelado.'); process.exit(0); }
  fs.mkdirSync(dir, { recursive: true });
  const ant = path.join(dir, 'anterior-' + new Date().toISOString().replace(/[:.]/g, '-')); let movido = false;
  for (const f of ['erp.db', 'erp.db-wal', 'erp.db-shm', 'clave.key']) { const p = path.join(dir, f); if (fs.existsSync(p)) { fs.mkdirSync(ant, { recursive: true }); fs.renameSync(p, path.join(ant, f)); movido = true; } }
  fs.writeFileSync(path.join(dir, 'erp.db'), r.dbBuf);
  if (!process.env.ERP_DATA_KEY) fs.writeFileSync(path.join(dir, 'clave.key'), r.meta.claveDatos, { mode: 0o600 });
  const cfgP = path.join(dir, 'config.json'); let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(cfgP, 'utf8')); } catch {}
  if (!cfg.fraseRespaldo) { cfg.fraseRespaldo = frase; fs.writeFileSync(cfgP, JSON.stringify(cfg, null, 2), { mode: 0o600 }); }
  // Verificación: abrir, descifrar todo y comprobar la cadena de auditoría
  const base = abrir(dir, Buffer.from(r.meta.claveDatos, 'hex')); const n = {};
  for (const e of Object.keys(P.ENTIDADES)) n[e] = base.R.todos(e).length;
  const v = base.A.verificar(); base.cerrar();
  console.log('✓ Restaurado. Registros:', JSON.stringify(n));
  console.log(v.ok ? `✓ Auditoría íntegra (${v.eventos} eventos)` : '⚠ Auditoría: ' + v.motivo);
  if (movido) console.log('Datos anteriores guardados en: ' + ant);
  console.log('Ya puedes iniciar el servidor.');
})();
