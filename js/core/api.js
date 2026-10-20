// Cliente HTTP del servidor. Todas las peticiones llevan X-ERP (protección anti-CSRF).
// Si NO hay servidor (p. ej. abriste index.html con doble clic), pasa solo al MODO LOCAL (js/core/api-local.js):
// la web funciona completa en este navegador y guarda los datos en él.
const api = async (metodo, url, cuerpo) => {
  if (Local.activo) return Local.handle(metodo, url, cuerpo);
  if (url === '/api/estado' && location.protocol === 'file:') { Local.activo = true; return Local.handle(metodo, url, cuerpo); }
  let r;
  try { r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json', 'X-ERP': '1' }, credentials: 'same-origin', body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }); }
  catch (e) {
    if (url === '/api/estado') { Local.activo = true; return Local.handle(metodo, url, cuerpo); } // primer contacto sin servidor → modo local
    const x = new Error('Sin conexión con el servidor'); x.red = true; throw x;
  }
  let j = null; try { j = await r.json(); } catch (e) {}
  if (url === '/api/estado' && (!r.ok || !j || typeof j !== 'object')) { Local.activo = true; return Local.handle(metodo, url, cuerpo); } // hay un sitio estático, pero no el servidor
  if (!r.ok) { const x = new Error((j && j.error) || 'Error ' + r.status); x.status = r.status; throw x; }
  return j;
};
