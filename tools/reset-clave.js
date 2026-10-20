// Recupera el acceso de un usuario (p. ej. si el administrador olvidó su contraseña).
// Requiere acceso físico/administrativo al equipo del servidor. USO:  node tools/reset-clave.js nombre_de_usuario
process.env.TZ = process.env.TZ || 'America/Lima';
const path = require('node:path'), C = require('../server/cripto'), { abrir } = require('../server/db');
const dir = path.resolve(process.env.ERP_DATA_DIR || path.join(__dirname, '..', 'data')), nom = process.argv[2];
if (!nom) { console.error('Uso: node tools/reset-clave.js usuario'); process.exit(1); }
const { clave } = C.cargarClave(dir), base = abrir(dir, clave), u = base.U.porNombre(nom);
if (!u) { console.error('No existe el usuario "' + nom + '". Usuarios: ' + base.U.todos().map(x => x.usuario).join(', ')); process.exit(1); }
const temp = C.claveTemporal();
base.U.set(u.id, { hash: C.hashClave(temp), cambiar: 1, fallos: 0, bloqueado_hasta: 0, activo: 1 }); base.SE.cerrarDe(u.id);
base.A.registrar({ usuario: 'consola-servidor', rol: 'sistema', entidad: 'usuarios', accion: 'reinicio de contraseña por consola', ref: u.id });
base.cerrar(); console.log(`Contraseña temporal de "${u.usuario}": ${temp}\nSe le pedirá cambiarla al ingresar.`);
