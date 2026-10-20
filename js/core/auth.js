// Pantallas de acceso: configuración inicial, inicio de sesión, cambio de contraseña, menú de usuario
const Auth = {
  _msg: '',
  mostrar(html) { document.body.classList.add('locked'); $('auth').hidden = false; $('auth').innerHTML = `<div class="auth-card"><div class="auth-brand"><span class="auth-mark" aria-hidden="true">🩺</span><span><b>Consultorio</b><small>Gestión clínica</small></span></div><div class="auth-divider"></div><div class="auth-content">${html}</div></div>`; const f = $('auth').querySelector('input'); if (f) f.focus(); },
  ocultar() { document.body.classList.remove('locked'); $('auth').hidden = true; $('auth').innerHTML = ''; },
  err: m => `<p class="auth-err" role="alert">${esc(m)}</p>`,
  // Muestra un error sin redibujar el formulario (así no se borra lo que la persona ya escribió)
  errorEn(m, contenedor) {
    const raiz = contenedor || $('auth'); let e = raiz.querySelector('.auth-err');
    if (!e) { e = document.createElement('p'); e.className = 'auth-err'; e.setAttribute('role', 'alert'); const h = raiz.querySelector('h2,h3'); h.after(e); }
    e.textContent = m;
  },
  async boot() {
    try {
      const e = await api('GET', '/api/estado'); App.inactividad = e.inactividadMin; App.sinLogin = !!e.sinLogin;
      if (!e.configurado) return this.setup();
      if (!e.usuario) return this.login();
      if (e.usuario.cambiar) return this.cambiar(true);
      await this.entrar();
    } catch (e) { this.mostrar(`<h2>No hay conexión con el servidor</h2><p class="mu">Verifica que el programa del consultorio esté en ejecución (iniciar.bat) y recarga la página.</p><button class="pri" onclick="location.reload()">Reintentar</button>`); }
  },
  async entrar() { await App.cargar(); this.ocultar(); const f = document.querySelector('.foot'); if (f && Local.activo) { f.classList.add('dev'); f.innerHTML = '⚠ Modo local (sin servidor): datos solo en este navegador · <a href="#" onclick="if(confirm(\'¿Borrar todos los datos locales y volver a los de ejemplo?\'))Local.reiniciar();return false">restablecer</a>'; } else if (f && App.sinLogin) { f.classList.add('dev'); f.textContent = '⚠ Modo desarrollo: sin inicio de sesión'; } App.go('hoy'); },
  login(msg) {
    this.mostrar(`<h2>Iniciar sesión</h2><p class="auth-intro">Acceso privado para el equipo del consultorio.</p>${msg ? this.err(msg) : ''}
      <form class="auth-form" onsubmit="event.preventDefault();Auth.doLogin()">
        <div class="auth-field"><label for="a_u">Usuario</label><input id="a_u" autocomplete="username" autocapitalize="none" required></div>
        <div class="auth-field"><label for="a_p">Contraseña</label><input id="a_p" type="password" autocomplete="current-password" required></div>
        <button class="pri auth-submit" type="submit">Ingresar</button>
      </form><p class="auth-footnote">La sesión se cierra tras un periodo de inactividad.</p>`);
  },
  async doLogin() {
    try { const r = await api('POST', '/api/login', { usuario: $('a_u').value, password: $('a_p').value }); r.usuario.cambiar ? this.cambiar(true) : await this.entrar(); }
    catch (e) { this.errorEn(e.message); $('a_p').value = ''; $('a_p').focus(); }
  },
  setup(msg) {
    this.mostrar(`<h2>Configuración inicial</h2><p class="mu">Crea la cuenta de <b>administrador</b> (tú). Con ella agregarás luego a otros usuarios.</p>${msg ? this.err(msg) : ''}
      <label for="s_n">Tu nombre</label><input id="s_n" placeholder="Ps. Nombre Apellido" autocomplete="name">
      <label for="s_u">Usuario</label><input id="s_u" autocomplete="username" autocapitalize="none">
      <label for="s_p">Contraseña (mín. 10 caracteres, con letras y números)</label><input id="s_p" type="password" autocomplete="new-password">
      <label for="s_f">Frase de respaldo (mín. 12 caracteres)</label><input id="s_f" type="password" autocomplete="off">
      <p class="mu" style="font-size:14.5px">⚠️ La frase cifra tus respaldos automáticos. <b>Anótala en papel y guárdala aparte</b>: si la pierdes y se daña este equipo, los respaldos no se podrán abrir. Nadie (ni yo) puede recuperarla.</p>
      <p><button class="pri" style="width:100%" onclick="Auth.doSetup()">Crear y entrar</button></p>`);
  },
  async doSetup() {
    try { await api('POST', '/api/setup', { nombre: $('s_n').value, usuario: $('s_u').value, password: $('s_p').value, fraseRespaldo: $('s_f').value }); await this.entrar(); }
    catch (e) { this.errorEn(e.message); }
  },
  cambiar(forzado, msg) {
    const cuerpo = `<h2>${forzado ? 'Crea tu contraseña' : 'Cambiar contraseña'}</h2>${forzado ? '<p class="mu">Estás usando una contraseña temporal. Elige una propia para continuar.</p>' : ''}${msg ? this.err(msg) : ''}
      <label for="c_a">Contraseña actual</label><input id="c_a" type="password" autocomplete="current-password">
      <label for="c_n">Nueva contraseña (mín. 10, letras y números)</label><input id="c_n" type="password" autocomplete="new-password">
      <div class="row" style="margin-top:14px">${forzado ? '<button onclick="Auth.salir()">Salir</button>' : '<button onclick="cerrar()">Cancelar</button>'}<button class="pri" onclick="Auth.doCambiar(${forzado})">Guardar</button></div>`;
    forzado ? this.mostrar(cuerpo) : abrir(cuerpo);
  },
  async doCambiar(forzado) {
    try { await api('POST', '/api/password', { actual: $('c_a').value, nueva: $('c_n').value }); if (forzado) await this.entrar(); else { cerrar(); App.aviso('Contraseña actualizada'); } }
    catch (e) { this.errorEn(e.message, forzado ? $('auth') : $('dlg')); }
  },
  menu() { abrir(`<h3>${esc(App.user.nombre)}</h3><p class="mu">Usuario: ${esc(App.user.usuario)} · Rol: ${esc(App.user.rol)}</p><div class="row"><button onclick="cerrar();Auth.cambiar(false)">Cambiar contraseña</button><button class="del" onclick="Auth.salir()">Cerrar sesión</button></div><div class="row"><button onclick="cerrar()">Cerrar</button></div>`); },
  async salir() { try { await api('POST', '/api/logout'); } catch (e) {} location.reload(); },
  expirada() { App.user = null; App.cache = {}; if ($('dlg').open) cerrar(); this.login('Tu sesión expiró por inactividad. Ingresa de nuevo.'); }
};
