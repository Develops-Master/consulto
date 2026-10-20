// Tema multicolor con Bootstrap: pone las clases de Bootstrap a tablas, formularios y botones
// (también a lo que se dibuja después: diálogos, pantallas, formularios). No cambia ninguna lógica.
(function () {
  // Modo claro/oscuro de Bootstrap según el sistema (igual que el resto de la interfaz)
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const tema = () => { document.documentElement.setAttribute('data-bs-theme', 'light'); }; // modo claro fijo
  tema(); mq.addEventListener && mq.addEventListener('change', tema);

  // Color del botón según lo que dice (así cada acción tiene su color)
  const REGLAS = [
    [/eliminar|borrar|quitar|anular|🗑|papelera/i, 'danger'],
    [/cancelar|cerrar|volver|salir|^\s*no\b|omitir/i, 'secondary'],
    [/imprimir|🖨|exportar|descargar|⬇|pdf|csv|excel|informe|copiar|enlace/i, 'info'],
    [/whatsapp|📲|recordatorio|enviar|llamar|📞/i, 'teal'],
    [/guardar|crear|agregar|añadir|nuevo|nueva|\+|registrar|programar|agendar|ingresar|cobrar|confirmar|aceptar|activar/i, 'success'],
    [/editar|✏|reprogramar|📅|cambiar|modificar|renovar/i, 'warning'],
    [/ver|abrir|buscar|🔍|ficha|detalle/i, 'primary'],
  ];
  const SALTAR = '.nav-item,.chip,.burger,.quien,#gbtn,.btn-close,.sync,.cal-h button,.opc,[data-no-tema]';
  const color = b => {
    if (b.classList.contains('del')) return 'danger';
    const t = (b.textContent || '') + ' ' + (b.getAttribute('title') || '') + ' ' + (b.getAttribute('aria-label') || '');
    for (const [re, c] of REGLAS) if (re.test(t)) return c;
    return 'primary';
  };
  const decorarBoton = b => {
    if (b.classList.contains('btn') || b.matches(SALTAR) || b.closest('#prt')) return;
    const c = color(b), solido = b.classList.contains('pri') && !b.classList.contains('del');
    b.classList.add('btn', `btn-${solido ? '' : 'outline-'}${c}`.replace('btn--', 'btn-'));
    if (b.closest('td,th,.alerta-riesgo,.alerta-med,.row')) b.classList.add('btn-sm');
  };
  const decorar = raiz => {
    if (!raiz || raiz.nodeType !== 1) return;
    const q = (sel, fn) => { if (raiz.matches && raiz.matches(sel)) fn(raiz); raiz.querySelectorAll(sel).forEach(fn); };
    q('button', decorarBoton);
    q('table', t => { if (!t.closest('#prt')) t.classList.add('table', 'table-hover', 'align-middle'); });
    q('textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=hidden]):not([type=color])', i => { if (!i.closest('.opc,#prt')) i.classList.add('form-control'); });
    q('select', s => { if (!s.closest('#prt')) s.classList.add('form-select'); });
    q('input[type=checkbox],input[type=radio]', i => { if (!i.closest('.opc')) i.classList.add('form-check-input'); });
  };
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(decorar))).observe(document.body, { childList: true, subtree: true });
  decorar(document.body);
})();
