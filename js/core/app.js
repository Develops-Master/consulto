// Núcleo: módulos, navegación, datos (caché en memoria + guardado inmediato en el servidor), roles
const App = { modules: {}, _bus: {}, state: { view: 'hoy', param: null }, cache: {}, user: null, permisos: { leer: [], borrar: [], campos: {}, clinico: false }, entities: [] };
App.on = (e, f) => (App._bus[e] ??= []).push(f);
App.emit = (e, d) => (App._bus[e] || []).forEach(f => f(d));
App.register = m => { App.modules[m.id] = m; };
App.toggle = force => document.body.classList.toggle('open', force);
// Qué módulos puede ver cada rol (la seguridad real está en el servidor; esto solo ordena el menú)
App.acceso = { auditoria: ['admin'], respaldo: ['admin'], usuarios: ['admin'], reportes: ['admin', 'profesional'], derivaciones: ['admin', 'profesional'], tareas: ['admin', 'profesional'], gastos: ['admin'] };
App.puedeVer = id => !App.acceso[id] || App.acceso[id].includes(App.user && App.user.rol);
App.clinico = () => !!App.permisos.clinico;
App.puedeBorrar = ent => App.permisos.borrar.includes(ent);

App.go = (id, param) => {
  if (!App.modules[id] || !App.puedeVer(id)) id = 'hoy';
  App.state = { view: id, param };
  if (id === 'pacientes' && param) App.audit('pacientes', 'consultar', param, param);
  App.toggle(false); App.render(); window.scrollTo(0, 0);
};
App.render = () => {
  const s = App.state, cur = App.modules[s.view];
  const menu = Object.values(App.modules).filter(m => m.menu && App.puedeVer(m.id)).sort((a, b) => a.order - b.order);
  $('nav').innerHTML = menu.map(m => `<button class="nav-item ${m.id === s.view ? 'on' : ''} ${m.order >= 9 ? 'bottom' : ''}" onclick="App.go('${m.id}')"><span class="ic">${m.icon || '•'}</span><span>${m.title}</span></button>`).join('');
  $('title').textContent = cur.title;
  $('date').textContent = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('quien').textContent = App.user ? '👤 ' + App.user.nombre : '';
  cur.render($('view'), s.param);
};

// Auditoría: el servidor registra solo todo cambio; aquí se avisan consultas e impresiones (el servidor pone usuario y hora)
App.audit = (entidad, accion, ref, pid) => { api('POST', '/api/audit', { accion, ref, pid }).catch(() => {}); };

// ---- Estado de guardado ----
App.sync = { cola: Promise.resolve(), pendientes: 0, estado: 'ok' };
App.setEstado = (e, msg) => {
  App.sync.estado = e; const el = $('sync'); if (!el) return;
  el.className = 'sync ' + e; el.textContent = e === 'ok' ? '✓ Guardado' : e === 'guardando' ? '… Guardando' : '⚠ ' + (msg || 'Sin conexión: reintentando');
};
// Avisos: toasts de Bootstrap con color según el tipo (verde éxito, rojo error, amarillo atención, celeste información)
App.tipoAviso = msg => /no se guard|error|sin conexi|rechaz|no se pudo|inv[aá]lid|incorrect|fall[oó]|expir/i.test(msg) ? 'danger'
  : /atenci|cuidado|⚠|se liber|choque|solap|pendiente/i.test(msg) ? 'warning'
  : /guardad|creado|actualizad|enviad|copiad|elimin|listo|✓|restaur|correct/i.test(msg) ? 'success' : 'info';
App.aviso = (msg, tipo, ms) => {
  tipo = tipo || App.tipoAviso(String(msg));
  const box = $('toasts');
  if (!box || !window.bootstrap) { const t = $('toast'); if (t) { t.textContent = msg; } return; } // sin Bootstrap: no se rompe nada
  const ico = { success: '✓', danger: '✕', warning: '!', info: 'i' }[tipo];
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${tipo} border-0 shadow`; el.setAttribute('role', tipo === 'danger' ? 'alert' : 'status');
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${ico} ${esc(msg)}</div><button type="button" class="btn-close ${tipo === 'warning' || tipo === 'info' ? '' : 'btn-close-white'} me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button></div>`;
  box.appendChild(el);
  el.addEventListener('hidden.bs.toast', () => el.remove());
  while (box.children.length > 4) box.firstElementChild.remove(); // máximo 4 a la vez
  new bootstrap.Toast(el, { delay: ms || (tipo === 'danger' ? 8000 : 4500) }).show();
};
window.alert = mensaje => App.aviso(String(mensaje));
window.addEventListener('beforeunload', e => { if (App.sync.pendientes > 0) { e.preventDefault(); e.returnValue = ''; } });

// Cola serial de escrituras: conserva el orden (crear antes que editar). Reintenta si no hay red.
App.enviar = (metodo, url, cuerpo, alResponder) => {
  App.sync.pendientes++; App.setEstado('guardando');
  App.sync.cola = App.sync.cola.then(async function intentar() {
    for (;;) {
      try { const r = await api(metodo, url, cuerpo); if (alResponder) alResponder(r); break; }
      catch (e) {
        if (e.red || e.status >= 500) { App.setEstado('red'); await new Promise(r => setTimeout(r, 3000)); continue; }
        if (e.status === 401) { Auth.expirada(); break; }
        App.aviso('No se guardó: ' + e.message); App.sync.fallo = true; await App.recargar(); break; // rechazo del servidor: volver al estado real
      }
    }
    App.sync.pendientes--; if (!App.sync.pendientes) { const venia = App.sync.estado; App.setEstado('ok'); if (App.sync.fallo) App.sync.fallo = false; else App.aviso(venia === 'red' ? 'Conexión recuperada: cambios guardados' : 'Guardado correctamente', 'success', 1800); }
  });
};

// Carga (o recarga) todos los datos permitidos para este usuario
App.cargar = async () => {
  const b = await api('GET', '/api/bootstrap'); App.user = b.usuario; App.permisos = b.permisos; App._huella = null;
  App.cache = b.datos; App.ajustes = b.ajustes || {}; return b;
};
App.recargar = async () => { try { await App.cargar(); if (App.user) App.render(); } catch (e) { if (e.status === 401) Auth.expirada(); } };
// Refresco periódico (otros usuarios pueden haber cambiado datos). No interrumpe si hay un formulario abierto o cambios pendientes.
setInterval(async () => {
  if (!App.user || App.sync.pendientes || $('dlg').open || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') || document.hidden) return;
  try { const b = await api('GET', '/api/bootstrap'), h = JSON.stringify(b.datos); if (App._huella && h !== App._huella && !$('dlg').open) { App.cache = b.datos; App.render(); } App._huella = h; }
  catch (e) { if (e.status === 401) Auth.expirada(); }
}, 60000);

// Repositorio genérico por entidad: lecturas desde la caché, escrituras al servidor
App.repo = name => {
  App.entities.push(name);
  const C = () => App.cache[name] ??= [];
  const sello = r => ({ creado: r.creado, actualizado: r.actualizado, fecha_alta: r.fecha_alta });
  return {
    all: () => C().slice(),
    get: id => C().find(x => x.id === id),
    save(o) {
      const a = C(), now = new Date().toISOString();
      if (o.id) {
        const i = a.findIndex(x => x.id === o.id); if (i < 0) return o;
        a[i] = { ...a[i], ...o, actualizado: now }; const r = a[i], parche = { ...o }; delete parche.id;
        App.enviar('PATCH', `/api/r/${name}/${r.id}`, parche, s => Object.assign(r, sello(s))); App.emit(name + ':changed', r); return r;
      }
      const r = { ...o, id: uid(), creado: now, actualizado: now, fecha_alta: today() }; a.push(r);
      App.enviar('POST', `/api/r/${name}`, r, s => Object.assign(r, sello(s))); App.emit(name + ':changed', r); return r;
    },
    remove(id) { App.cache[name] = C().filter(x => x.id !== id); App.enviar('DELETE', `/api/r/${name}/${id}`); App.emit(name + ':changed', id); },
    removeWhere(fn) { const ids = C().filter(fn).map(x => x.id); if (!ids.length) return; App.cache[name] = C().filter(x => !ids.includes(x.id)); App.enviar('POST', `/api/r/${name}/borrar-varios`, { ids }); }
  };
};
