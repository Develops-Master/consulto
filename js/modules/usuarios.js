// Módulo Usuarios (solo administrador): altas, roles, contraseñas temporales y desactivación
const Usuarios = {
  ROLES: { admin: 'Administrador (todo)', profesional: 'Profesional (clínico)', recepcion: 'Recepción (agenda y cobros)' },
  lista: [],
  async cargar() { try { this.lista = await api('GET', '/api/usuarios'); } catch (e) { App.aviso(e.message); } this.pintar($('view')); },
  pintar(el) {
    el.innerHTML = `<div class="card"><div class="row"><strong>Usuarios del sistema</strong><button class="pri" onclick="Usuarios.form()">+ Nuevo usuario</button></div>
      <p class="mu" style="font-size:15px"><b>Administrador:</b> todo, incluidos usuarios, auditoría y respaldos. <b>Profesional:</b> historias clínicas, sesiones, tests y cobros. <b>Recepción:</b> agenda, datos de contacto y cobros; no ve contenido clínico.</p>
      <div class="wrap"><table><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th></th></tr>` + this.lista.map(u => `<tr><td><b>${esc(u.usuario)}</b>${u.id === App.user.id ? ' <span class="mu">(tú)</span>' : ''}</td><td>${esc(u.nombre)}</td>
        <td><select onchange="Usuarios.rol('${u.id}',this.value)" ${u.id === App.user.id ? 'disabled' : ''}>${Object.entries(this.ROLES).map(([k, l]) => `<option value="${k}" ${k === u.rol ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
        <td>${u.activo ? '<span class="badge">Activo</span>' : '<span class="badge off">Desactivado</span>'}${u.cambiar ? ' <span class="mu">· clave temporal</span>' : ''}</td>
        <td><button onclick="Usuarios.reiniciar('${u.id}')">Reiniciar clave</button> ${u.id === App.user.id ? '' : `<button onclick="Usuarios.activo('${u.id}',${u.activo ? 0 : 1})">${u.activo ? 'Desactivar' : 'Activar'}</button>`}</td></tr>`).join('') + '</table></div></div>';
  },
  form() {
    abrir(`<h3>Nuevo usuario</h3><label>Nombre completo</label><input id="u_n"><label>Usuario (para ingresar)</label><input id="u_u" autocapitalize="none"><label>Rol</label><select id="u_r">${Object.entries(this.ROLES).map(([k, l]) => `<option value="${k}" ${k === 'recepcion' ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <p class="mu" style="font-size:15px">Se generará una contraseña temporal; la persona deberá cambiarla al ingresar.</p><div class="row"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="Usuarios.crear()">Crear</button></div>`);
  },
  mostrarClave(titulo, usuario, clave) { abrir(`<h3>${titulo}</h3><p>Usuario: <b>${esc(usuario)}</b></p><p>Contraseña temporal:</p><p style="font:600 22px ui-monospace,monospace;background:var(--ac2);padding:12px;border-radius:8px;user-select:all">${esc(clave)}</p><p class="mu" style="font-size:15px">Anótala y entrégala en persona: <b>no se volverá a mostrar</b>. Deberá cambiarla al primer ingreso.</p><div class="row"><button class="pri" onclick="cerrar()">Listo</button></div>`); },
  async crear() { try { const r = await api('POST', '/api/usuarios', { nombre: $('u_n').value, usuario: $('u_u').value, rol: $('u_r').value }); this.mostrarClave('Usuario creado', r.usuario, r.claveTemporal); this.cargar(); } catch (e) { App.aviso(e.message); } },
  async reiniciar(id) { if (!await confirmar('¿Generar una contraseña temporal nueva? Se cerrará su sesión actual.', 'Reiniciar contraseña', 'Generar clave', true)) return; try { const r = await api('POST', `/api/usuarios/${id}/reiniciar`); const u = this.lista.find(x => x.id === id); this.mostrarClave('Contraseña reiniciada', u.usuario, r.claveTemporal); this.cargar(); } catch (e) { App.aviso(e.message); } },
  async rol(id, rol) {
    const u = this.lista.find(x => x.id === id); if (!u || u.rol === rol) return;
    const nombreRol = this.ROLES[rol] || rol;
    if (!await confirmar(`Cambiar el rol de ${u.nombre} a ${nombreRol}?`, 'Cambiar rol de usuario', 'Guardar cambio', rol === 'admin')) return this.cargar();
    try { await api('PATCH', `/api/usuarios/${id}`, { rol }); } catch (e) { App.aviso(e.message); }
    this.cargar();
  },
  async activo(id, a) {
    const u = this.lista.find(x => x.id === id), activar = !!a; if (!u || activar === !!u.activo) return;
    if (!await confirmar(activar ? `Reactivar la cuenta de ${u.nombre}?` : `Desactivar la cuenta de ${u.nombre}? No podrá iniciar sesión.`, activar ? 'Reactivar usuario' : 'Desactivar usuario', activar ? 'Activar' : 'Desactivar', !activar)) return this.cargar();
    try { await api('PATCH', `/api/usuarios/${id}`, { activo: activar }); } catch (e) { App.aviso(e.message); }
    this.cargar();
  }
};
App.register({ id: 'usuarios', title: 'Usuarios', menu: true, icon: '🧑‍⚕️', order: 7, render(el) { el.innerHTML = '<p class="mu">Cargando…</p>'; Usuarios.cargar(); } });
