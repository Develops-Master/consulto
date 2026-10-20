// Cifrado: AES-256-GCM para datos en la base y para respaldos; scrypt para contraseñas y frases.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Clave de datos: variable ERP_DATA_KEY (64 hex) o archivo data/clave.key (se crea la primera vez).
function cargarClave(dir) {
  const env = process.env.ERP_DATA_KEY;
  if (env) {
    if (!/^[0-9a-f]{64}$/i.test(env)) throw new Error('ERP_DATA_KEY debe tener 64 caracteres hexadecimales');
    return { clave: Buffer.from(env, 'hex'), origen: 'env' };
  }
  const f = path.join(dir, 'clave.key');
  if (fs.existsSync(f)) return { clave: Buffer.from(fs.readFileSync(f, 'utf8').trim(), 'hex'), origen: 'archivo' };
  const k = crypto.randomBytes(32);
  fs.writeFileSync(f, k.toString('hex'), { mode: 0o600 });
  return { clave: k, origen: 'archivo-nuevo' };
}

function cifrar(clave, texto, aad) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', clave, iv);
  if (aad) c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function descifrar(clave, s, aad) {
  if (!s || !s.startsWith('v1:')) throw new Error('formato cifrado desconocido');
  const b = Buffer.from(s.slice(3), 'base64'), d = crypto.createDecipheriv('aes-256-gcm', clave, b.subarray(0, 12));
  if (aad) d.setAAD(Buffer.from(aad));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}
const hmac = (clave, texto) => crypto.createHmac('sha256', Buffer.from(crypto.hkdfSync('sha256', clave, '', 'erp-auditoria', 32))).update(texto).digest('hex');

// Contraseñas: scrypt con sal propia
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
function hashClave(pw) {
  const sal = crypto.randomBytes(16);
  return `scrypt$${sal.toString('base64')}$${crypto.scryptSync(pw, sal, 64, SCRYPT).toString('base64')}`;
}
function verificarClave(pw, almacenado) {
  const [t, s, h] = String(almacenado || '').split('$');
  const sal = Buffer.from(s || 'AAAAAAAAAAAAAAAAAAAAAA==', 'base64'), esperado = Buffer.from(h || '', 'base64');
  const obtenido = crypto.scryptSync(pw, sal, 64, SCRYPT);
  return t === 'scrypt' && esperado.length === 64 && crypto.timingSafeEqual(obtenido, esperado);
}
const claveFalsa = hashClave('relleno-contra-enumeracion');

// Respaldos: frase -> clave (scrypt más costoso)
const derivarFrase = (frase, sal) => crypto.scryptSync(frase, sal, 32, { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
function cifrarConFrase(frase, buf) {
  const sal = crypto.randomBytes(16), iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', derivarFrase(frase, sal), iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([Buffer.from('CERP1'), sal, iv, c.getAuthTag(), ct]);
}
function descifrarConFrase(frase, buf) {
  if (buf.subarray(0, 5).toString() !== 'CERP1') throw new Error('No es un respaldo de este sistema');
  const sal = buf.subarray(5, 21), iv = buf.subarray(21, 33), tag = buf.subarray(33, 49);
  const d = crypto.createDecipheriv('aes-256-gcm', derivarFrase(frase, sal), iv); d.setAuthTag(tag);
  try { return Buffer.concat([d.update(buf.subarray(49)), d.final()]); } catch { throw new Error('Frase incorrecta o archivo dañado'); }
}

const aleatorio = n => crypto.randomBytes(n).toString('base64url');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
// Contraseña temporal legible (sin caracteres ambiguos)
function claveTemporal() { const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 12; i++) s += a[crypto.randomInt(a.length)]; return s + '7'; }

module.exports = { cargarClave, cifrar, descifrar, hmac, hashClave, verificarClave, claveFalsa, cifrarConFrase, descifrarConFrase, aleatorio, sha, claveTemporal };
