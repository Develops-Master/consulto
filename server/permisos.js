// Matriz de permisos por rol. Es la ÚNICA fuente de verdad: el servidor la aplica en cada petición
// y el navegador solo la usa para ocultar botones.
// Roles: admin (todo + usuarios/respaldos/auditoría) · profesional (clínico) · recepcion (agenda y cobros, sin datos clínicos)
const TODOS = ['admin', 'profesional', 'recepcion'], CLINICO = ['admin', 'profesional'];
const RL = require('../js/modules/riesgo-logica');
const ML = require('../js/modules/medicion-logica');
const META = ['id', 'creado', 'actualizado', 'fecha_alta'];

function validarTarea(o) {
  if (!String(o.titulo || '').trim() || String(o.titulo).length > 120) return 'El título es obligatorio y no puede superar 120 caracteres';
  if (String(o.descripcion || '').length > 4000) return 'La descripción no puede superar 4000 caracteres';
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(o.fecha_limite || '') ? new Date(o.fecha_limite + 'T00:00:00Z') : null;
  if (!fecha || Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== o.fecha_limite) return 'La fecha límite no es válida';
  if (!['Pendiente', 'En curso', 'Completada', 'Cancelada'].includes(o.estado)) return 'El estado de la tarea no es válido';
  if (!['Normal', 'Alta'].includes(o.prioridad)) return 'La prioridad no es válida';
  return null;
}

function validarGasto(o) {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(o.fecha || '') ? new Date(o.fecha + 'T00:00:00Z') : null;
  if (!fecha || Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== o.fecha) return 'La fecha del gasto no es válida';
  if (!['Alquiler', 'Servicios', 'Personal', 'Impuestos', 'Materiales', 'Software', 'Marketing', 'Mantenimiento', 'Transporte', 'Otro'].includes(o.categoria)) return 'La categoría del gasto no es válida';
  if (typeof o.monto !== 'number' || !Number.isFinite(o.monto) || o.monto <= 0 || o.monto > 100000000) return 'El monto debe ser mayor que 0';
  if (!String(o.concepto || '').trim() || String(o.concepto).length > 160) return 'El concepto es obligatorio y no puede superar 160 caracteres';
  if (String(o.proveedor || '').length > 120 || String(o.comprobante || '').length > 100 || String(o.nota || '').length > 1000) return 'Uno de los campos supera el máximo permitido';
  if (!['Efectivo', 'Yape/Plin', 'Tarjeta', 'Transferencia', 'Otro'].includes(o.metodo)) return 'El método de pago no es válido';
  if (!['Pagado', 'Pendiente'].includes(o.estado)) return 'El estado del gasto no es válido';
  return null;
}

function validarMedicacion(o) {
  if (!String(o.medicamento || '').trim() || String(o.medicamento).length > 120) return 'El nombre del medicamento es obligatorio y no puede superar 120 caracteres';
  if (!['Receta externa', 'Informado por paciente'].includes(o.fuente)) return 'Indica si proviene de una receta externa o del paciente';
  if (o.fuente === 'Receta externa' && !String(o.prescriptor || '').trim()) return 'Registra el profesional que figura en la receta';
  if (String(o.prescriptor || '').length > 160 || String(o.dosis || '').length > 120 || String(o.frecuencia || '').length > 120 || String(o.observacion || '').length > 2000) return 'Uno de los campos supera el máximo permitido';
  const inicio = /^\d{4}-\d{2}-\d{2}$/.test(o.fecha_inicio || '') ? new Date(o.fecha_inicio + 'T00:00:00Z') : null;
  if (!inicio || Number.isNaN(inicio.getTime()) || inicio.toISOString().slice(0, 10) !== o.fecha_inicio) return 'La fecha de inicio no es válida';
  if (o.fecha_fin) {
    const fin = /^\d{4}-\d{2}-\d{2}$/.test(o.fecha_fin) ? new Date(o.fecha_fin + 'T00:00:00Z') : null;
    if (!fin || Number.isNaN(fin.getTime()) || fin.toISOString().slice(0, 10) !== o.fecha_fin || o.fecha_fin < o.fecha_inicio) return 'La fecha de fin no es válida';
  }
  if (!['En uso', 'Suspendido', 'Finalizado'].includes(o.estado)) return 'El estado del registro no es válido';
  return null;
}

const PAC_RECEP = ['nombre', 'doc', 'nac', 'sexo', 'tel', 'email', 'dir', 'distrito', 'emerg', 'emtel', 'seguro', 'tarifa'];
const SES_RECEP = ['pid', 'fecha', 'hora', 'estado', 'tipo', 'dur', 'modalidad', 'enlace', 'n', 'total', 'reprog', 'recordado'];

// Agregar una entidad nueva = agregar una entrada aquí.
const ENTIDADES = {
  pacientes:       { hijo: false, leer: TODOS, crear: TODOS, editar: TODOS, borrar: ['admin'], campos: { recepcion: PAC_RECEP } },
  medicaciones:    { hijo: true,  leer: CLINICO, crear: CLINICO, editar: CLINICO, borrar: ['admin'], validar: validarMedicacion },
  tareas:          { hijo: true,  leer: CLINICO, crear: CLINICO, editar: CLINICO, borrar: CLINICO, validar: validarTarea },
  gastos:          { hijo: false, leer: ['admin'], crear: ['admin'], editar: ['admin'], borrar: ['admin'], validar: validarGasto },
  sesiones:        { hijo: true,  leer: TODOS, crear: TODOS, editar: TODOS, borrar: CLINICO, campos: { recepcion: SES_RECEP } },
  espera:          { hijo: false, leer: TODOS, crear: TODOS, editar: TODOS, borrar: TODOS },
  paquetes:        { hijo: true,  leer: TODOS, crear: TODOS, editar: TODOS, borrar: ['admin'] },
  pagos:           { hijo: true,  leer: TODOS, crear: TODOS, editar: TODOS, borrar: ['admin'] },
  objetivos:       { hijo: true,  leer: CLINICO, crear: CLINICO, editar: CLINICO, borrar: CLINICO },
  tests:           { hijo: true,  leer: CLINICO, crear: CLINICO, editar: CLINICO, borrar: CLINICO },
  cierres:         { hijo: true,  leer: CLINICO, crear: CLINICO, editar: CLINICO, borrar: CLINICO },
  seguimientos:    { hijo: true,  leer: CLINICO, crear: CLINICO, editar: CLINICO, borrar: CLINICO },
  adjuntos:        { hijo: true,  leer: CLINICO, crear: CLINICO, editar: CLINICO, borrar: CLINICO, max: 9e6, pesado: 'data' },
  evalriesgo:      { hijo: true,  leer: CLINICO, crear: CLINICO, editar: CLINICO, borrar: ['admin'], validar: o => RL.validarEval(o) },
  planseguridad:   { hijo: true,  leer: CLINICO, crear: CLINICO, editar: CLINICO, borrar: ['admin'], validar: o => RL.validarPlan(o) },
  revisionesplan:  { hijo: true,  leer: CLINICO, crear: CLINICO, editar: CLINICO, borrar: ['admin'], validar: o => ML.validarRev(o) },
  consentimientos: { hijo: true,  leer: CLINICO, crear: CLINICO, editar: CLINICO, borrar: ['admin'] }
};
const puede = (rol, ent, op) => !!ENTIDADES[ent] && ENTIDADES[ent][op].includes(rol);
const camposRol = (rol, ent) => (ENTIDADES[ent].campos || {})[rol] || null; // null = todos
// Lectura: quita lo que el rol no puede ver
function filtrarLectura(rol, ent, rec, conPesado) {
  const pz = ENTIDADES[ent].pesado; if (pz && !conPesado && pz in rec) { rec = { ...rec }; delete rec[pz]; }
  const c = camposRol(rol, ent); if (!c) return rec;
  const o = {}; [...META, ...c].forEach(k => { if (k in rec) o[k] = rec[k]; }); return o;
}
// Escritura: devuelve los campos permitidos y los rechazados
function filtrarEscritura(rol, ent, patch) {
  const c = camposRol(rol, ent), ok = {}, no = [];
  for (const k of Object.keys(patch)) {
    if (META.includes(k)) continue;
    if (c && !c.includes(k)) no.push(k); else ok[k] = patch[k];
  }
  return { ok, no };
}
// Qué ve el navegador para ajustar su interfaz
const paraCliente = rol => ({
  leer: Object.keys(ENTIDADES).filter(e => puede(rol, e, 'leer')),
  borrar: Object.keys(ENTIDADES).filter(e => puede(rol, e, 'borrar')),
  campos: Object.fromEntries(Object.keys(ENTIDADES).filter(e => camposRol(rol, e)).map(e => [e, camposRol(rol, e)])),
  clinico: CLINICO.includes(rol)
});
module.exports = { ENTIDADES, puede, filtrarLectura, filtrarEscritura, paraCliente, CLINICO, TODOS };
