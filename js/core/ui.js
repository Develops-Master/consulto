// Utilidades compartidas por todos los módulos
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toLocaleDateString('en-CA');
const uid = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 20);
const abrir = html => { $('dlg').innerHTML = html; if (!$('dlg').open) $('dlg').showModal(); };
const cerrar = () => $('dlg').close();
const colaConfirmaciones = [];
let confirmacionActiva = false;
function mostrarSiguienteConfirmacion() {
	if (confirmacionActiva || !colaConfirmaciones.length) return;
	confirmacionActiva = true;
	const item = colaConfirmaciones.shift(), d = $('confirmdlg');
	d.returnValue = '';
	d.innerHTML = `<form method="dialog"><h3 id="confirm-title">${esc(item.titulo)}</h3><p class="confirm-message">${esc(item.mensaje)}</p><div class="confirm-actions">${item.confirmar ? '<button value="cancel">Cancelar</button>' : ''}<button class="${item.peligro ? 'del' : 'pri'}" value="accept">${esc(item.aceptar)}</button></div></form>`;
	d.addEventListener('close', () => {
		const aceptado = d.returnValue === 'accept';
		item.resolver(!item.confirmar || aceptado);
		confirmacionActiva = false;
		queueMicrotask(mostrarSiguienteConfirmacion);
	}, { once: true });
	d.addEventListener('click', e => { if (e.target === d) d.close('cancel'); }, { once: true });
	d.showModal();
	d.querySelector(item.confirmar ? '[value="cancel"]' : '[value="accept"]').focus();
}
const confirmar = (mensaje, titulo = 'Confirmar', aceptar = 'Continuar', peligro = false) => new Promise(resolver => {
	colaConfirmaciones.push({ mensaje: String(mensaje), titulo, aceptar, peligro, confirmar: true, resolver });
	mostrarSiguienteConfirmacion();
});
