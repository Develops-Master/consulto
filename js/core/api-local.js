// MODO LOCAL (sin servidor): imita la API del servidor dentro del navegador.
// Los datos se guardan en localStorage de este navegador. Se activa solo cuando no hay servidor
// (por ejemplo al abrir index.html con doble clic). Si el servidor Node responde, no se usa.
const Local = {
  activo: false,
  KEY: 'consultorio_local_v1',
  ADMIN: { id: 'local-admin', usuario: 'admin', nombre: 'Administrador (modo local)', rol: 'admin', cambiar: false, activo: 1 },
  ENT: {
    pacientes: { clinico: false }, medicaciones: { clinico: true }, tareas: { clinico: true }, gastos: {}, sesiones: {}, espera: {},
    paquetes: {}, pagos: {}, objetivos: {}, tests: {}, cierres: {}, seguimientos: {}, adjuntos: { pesado: 'data' }, evalriesgo: {},
    planseguridad: {}, revisionesplan: {}, consentimientos: {}
  },
  _mem: null,

  load() {
    if (this._mem) return this._mem;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) {}
    if (!s || !s.datos) { s = { v: 1, datos: {}, ajustes: { consultorio: 'Consultorio de Psicología', serie: 'R001' }, auditoria: [], corr: 0 }; this.demo(s); this._mem = s; this.save(); }
    this._mem = s; return s;
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this._mem)); }
    catch (e) { if (!this._avisoCuota) { this._avisoCuota = true; setTimeout(() => window.App && App.aviso && App.aviso('El navegador no tiene espacio para guardar más datos locales (se mantienen hasta cerrar la pestaña).', 'warning', 8000), 0); } }
  },
  reiniciar() { try { localStorage.removeItem(this.KEY); } catch (e) {} this._mem = null; location.reload(); },

  // Datos de ejemplo para que la web no se vea vacía la primera vez
  demo(s) {
    const d = s.datos, now = new Date().toISOString(), hoy = new Date(), f = n => { const x = new Date(hoy); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
    const mk = (o) => ({ ...o, creado: now, actualizado: now, fecha_alta: f(0) });
    const pac = [
      { id: 'demo-p1', nombre: 'María Fernanda Quispe', doc: '45871236', nac: '1991-04-12', sexo: 'Femenino', tel: '987654321', email: 'maria.quispe@example.com', distrito: 'Lunahuaná', tarifa: '80', motivo: 'Ansiedad y dificultad para dormir', cie: 'F41.1' },
      { id: 'demo-p2', nombre: 'Carlos Alberto Rojas', doc: '40125698', nac: '1985-09-30', sexo: 'Masculino', tel: '956321478', email: '', distrito: 'Cañete', tarifa: '90', motivo: 'Estrés laboral', cie: '' },
      { id: 'demo-p3', nombre: 'Lucía Paredes Huamán', doc: '72001458', nac: '2004-01-22', sexo: 'Femenino', tel: '912345678', email: 'lucia.p@example.com', distrito: 'Imperial', tarifa: '70', motivo: 'Autoestima baja', cie: '' }
    ];
    d.pacientes = pac.map(mk);
    const ses = [
      ['demo-p1', f(0), '09:00', 'Programada'], ['demo-p2', f(0), '11:00', 'Programada'], ['demo-p3', f(0), '16:30', 'Programada'],
      ['demo-p1', f(-7), '09:00', 'Atendida'], ['demo-p2', f(-5), '11:00', 'Atendida'], ['demo-p3', f(-3), '16:30', 'Atendida'],
      ['demo-p1', f(7), '09:00', 'Programada'], ['demo-p2', f(2), '11:00', 'Programada']
    ];
    d.sesiones = ses.map(([pid, fecha, hora, estado], i) => mk({ id: 'demo-s' + i, pid, fecha, hora, estado, tipo: 'Psicoterapia individual', dur: 50, tema: '', modalidad: 'Presencial', enlace: '', nota: '' }));
    d.pagos = [
      mk({ id: 'demo-g1', pid: 'demo-p1', fecha: f(-7), monto: 80, metodo: 'Efectivo', concepto: 'Sesión individual', paquete: '', comp_tipo: '', comp_num: '', comp_nombre: '', comp_doc_tipo: '', comp_doc_num: '' }),
      mk({ id: 'demo-g2', pid: 'demo-p2', fecha: f(-5), monto: 90, metodo: 'Yape/Plin', concepto: 'Sesión individual', paquete: '', comp_tipo: '', comp_num: '', comp_nombre: '', comp_doc_tipo: '', comp_doc_num: '' })
    ];
    d.gastos = [mk({ id: 'demo-x1', fecha: f(-10), categoria: 'Servicios', monto: 120, concepto: 'Internet del consultorio', proveedor: '', comprobante: '', nota: '', metodo: 'Transferencia', estado: 'Pagado' })];
    d.tareas = [mk({ id: 'demo-t1', pid: 'demo-p1', titulo: 'Enviar informe de avance', descripcion: '', fecha_limite: f(3), estado: 'Pendiente', prioridad: 'Normal' })];
  },

  // ---- utilidades ----
  err(status, msg) { const e = new Error(msg); e.status = status; return e; },
  aud(accion, entidad, ref, pid) {
    const s = this.load(), pac = pid && (s.datos.pacientes || []).find(p => p.id === pid);
    s.auditoria.unshift({ id: uid(), fecha: new Date().toISOString(), usuario: this.ADMIN.usuario, rol: 'admin', accion, entidad, ref: ref || null, pid: pid || null, nombre: pac ? pac.nombre : null });
    if (s.auditoria.length > 1000) s.auditoria.length = 1000;
  },
  lista(ent) { const s = this.load(); return s.datos[ent] ??= []; },
  hijosDe(pid) { const s = this.load(), out = []; for (const e of Object.keys(this.ENT)) if (e !== 'pacientes') for (const r of (s.datos[e] || [])) if (r.pid === pid) out.push({ e, id: r.id }); return out; },
  sinPesado(ent, r) { const pz = this.ENT[ent].pesado; if (pz && pz in r) { r = { ...r }; delete r[pz]; } return r; },
  clon: o => JSON.parse(JSON.stringify(o)),

  // ---- "servidor" ----
  async handle(metodo, url, cuerpo) {
    const s = this.load(); let m;
    url = String(url).split('?')[0];
    if (metodo === 'GET' && url === '/api/estado') return { configurado: true, usuario: this.ADMIN, inactividadMin: 0, sinLogin: true, local: true };
    if (url === '/api/login' || url === '/api/setup') return { usuario: this.ADMIN };
    if (url === '/api/logout') return { ok: true };
    if (url === '/api/password') return { ok: true };
    if (metodo === 'GET' && url === '/api/bootstrap') {
      const datos = {}; for (const e of Object.keys(this.ENT)) datos[e] = this.clon(this.lista(e)).map(r => this.sinPesado(e, r));
      return { usuario: this.ADMIN, permisos: { leer: Object.keys(this.ENT), borrar: Object.keys(this.ENT), campos: {}, clinico: true }, datos, ajustes: this.clon(s.ajustes) };
    }
    if ((m = url.match(/^\/api\/r\/([a-z]+)$/)) && metodo === 'POST') {
      const ent = m[1]; if (!this.ENT[ent]) throw this.err(404, 'Entidad desconocida');
      const b = this.clon(cuerpo || {}), L = this.lista(ent);
      if (!b.id) throw this.err(400, 'Identificador no válido');
      if (L.some(x => x.id === b.id)) throw this.err(409, 'Ya existe un registro con ese identificador');
      if (ent === 'pacientes' && !String(b.nombre || '').trim()) throw this.err(422, 'El nombre es obligatorio');
      const now = new Date().toISOString(), o = { ...b, creado: now, actualizado: now, fecha_alta: today() };
      L.push(o); this.aud('crear', ent, o.id, ent === 'pacientes' ? o.id : o.pid); this.save();
      return this.sinPesado(ent, this.clon(o));
    }
    if ((m = url.match(/^\/api\/r\/([a-z]+)\/borrar-varios$/)) && metodo === 'POST') {
      const ent = m[1], ids = (cuerpo && cuerpo.ids) || [], L = this.lista(ent), antes = L.length;
      s.datos[ent] = L.filter(x => !ids.includes(x.id)); this.aud('eliminar', ent); this.save(); return { borrados: antes - s.datos[ent].length };
    }
    if ((m = url.match(/^\/api\/r\/([a-z]+)\/([a-z0-9-]+)$/))) {
      const ent = m[1], id = m[2]; if (!this.ENT[ent]) throw this.err(404, 'Entidad desconocida');
      const L = this.lista(ent), i = L.findIndex(x => x.id === id);
      if (metodo === 'PATCH') {
        if (i < 0) throw this.err(404, 'No existe el registro');
        const b = this.clon(cuerpo || {}); delete b.pid; delete b.id; delete b.creado; delete b.fecha_alta;
        if (ent === 'pacientes' && 'nombre' in b && !String(b.nombre).trim()) throw this.err(422, 'El nombre es obligatorio');
        L[i] = { ...L[i], ...b, actualizado: new Date().toISOString() }; this.aud('editar', ent, id, ent === 'pacientes' ? id : L[i].pid); this.save();
        return this.sinPesado(ent, this.clon(L[i]));
      }
      if (metodo === 'DELETE') {
        if (i < 0) throw this.err(404, 'No existe el registro');
        const pid = ent === 'pacientes' ? id : L[i].pid;
        if (ent === 'pacientes') for (const h of this.hijosDe(id)) s.datos[h.e] = this.lista(h.e).filter(x => x.id !== h.id);
        s.datos[ent] = this.lista(ent).filter(x => x.id !== id); this.aud('eliminar', ent, id, pid); this.save(); return { ok: true };
      }
    }
    if (metodo === 'POST' && url === '/api/correlativo') {
      s.corr = (s.corr || 0) + 1; const serie = /^[A-Z0-9]{2,6}$/.test(s.ajustes.serie || '') ? s.ajustes.serie : 'R001';
      this.save(); return { numero: serie + '-' + String(s.corr).padStart(6, '0') };
    }
    if (metodo === 'POST' && url === '/api/ajustes') {
      const o = {}; for (const k of ['consultorio', 'ruc', 'direccion', 'telefono', 'serie', 'urlPublica']) if (cuerpo && cuerpo[k] !== undefined) o[k] = String(cuerpo[k]).trim().slice(0, 200);
      if (o.serie && !/^[A-Z0-9]{2,6}$/.test(o.serie)) throw this.err(400, 'La serie debe tener 2 a 6 letras mayúsculas o números (ej. R001)');
      s.ajustes = o; this.save(); return o;
    }
    if (metodo === 'POST' && url === '/api/audit') { this.aud((cuerpo && cuerpo.accion) || 'consultar', 'pacientes', cuerpo && cuerpo.ref, cuerpo && cuerpo.pid); this.save(); return { ok: true }; }
    if (metodo === 'GET' && url === '/api/auditoria') return { eventos: this.clon(s.auditoria.slice(0, 500)), total: s.auditoria.length };
    if (metodo === 'GET' && url === '/api/auditoria/verificar') return { ok: true, eventos: s.auditoria.length };
    if ((m = url.match(/^\/api\/adjunto\/([a-z0-9-]+)$/)) && metodo === 'GET') {
      const a = this.lista('adjuntos').find(x => x.id === m[1]); if (!a) throw this.err(404, 'No existe el adjunto'); return { data: a.data, nombre: a.nombre, tipo: a.tipo };
    }
    if (metodo === 'GET' && url === '/api/usuarios') return [this.ADMIN];
    if (url.startsWith('/api/usuarios')) throw this.err(400, 'La gestión de usuarios requiere el servidor (iniciar.bat). En modo local solo hay un administrador.');
    if (metodo === 'GET' && url === '/api/respaldos') return { ultimo: null, fraseConfigurada: true, cambiosPendientes: 0, carpeta: 'Almacenamiento del navegador (modo local)', carpetaExtra: '', archivos: [] };
    if (metodo === 'POST' && url === '/api/respaldos') {
      const blob = new Blob([JSON.stringify(s, null, 1)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'consultorio-respaldo-' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove();
      return { nombre: a.download };
    }
    if (url.startsWith('/api/enlaces')) { if (metodo === 'GET') return []; throw this.err(400, 'Los cuestionarios por enlace requieren el servidor publicado (no funcionan en modo local).'); }
    if (url === '/api/importar-legacy') throw this.err(400, 'Importar requiere el servidor.');
    throw this.err(404, 'No disponible en modo local');
  }
};
