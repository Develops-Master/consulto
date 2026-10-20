"""Prueba en Chromium REAL del flujo de riesgo suicida (bloque 5). Genera capturas en docs/pruebas/.
Uso:  python tests/e2e_riesgo.py   (requiere playwright + chromium; ver e2e_navegador.py)"""
import os, time, json, shutil, subprocess, tempfile, urllib.request
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(RAIZ, 'docs', 'pruebas'); os.makedirs(OUT, exist_ok=True)
PORT = 3198; URL = f'http://127.0.0.1:{PORT}'; DATOS = tempfile.mkdtemp(prefix='erp-e2e-rs-')
ENV = {**os.environ, 'PORT': str(PORT), 'ERP_DATA_DIR': DATOS}   # modo sin login (desarrollo)
res = []; errores = []

def check(n, c, d=''):
    res.append((n, bool(c))); print(('  ✓ ' if c else '  ✗ ') + n + (f'  [{d}]' if d and not c else ''))
def api(m, u, b=None):
    r = urllib.request.Request(URL + u, method=m, data=None if b is None else json.dumps(b).encode(), headers={'X-ERP': '1', 'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(r).read() or b'{}')

srv = subprocess.Popen(['node', '--disable-warning=ExperimentalWarning', os.path.join(RAIZ, 'server', 'server.js')], env=ENV, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try: urllib.request.urlopen(URL + '/api/estado'); break
        except Exception: time.sleep(0.2)
    api('POST', '/api/r/pacientes', {'id': 'pac111111', 'nombre': 'Lucía Prueba Riesgo', 'tel': '999888777'})
    with sync_playwright() as pw:
        br = pw.chromium.launch(); pg = br.new_page(viewport={'width': 1100, 'height': 900})
        pg.on('pageerror', lambda e: errores.append(str(e)))
        pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        pg.add_init_script("window.print = () => { window.__imprimio = true; }")
        dialogos = []
        pg.on('dialog', lambda d: (dialogos.append(d.message), d.accept()))
        pg.goto(URL); pg.wait_for_selector('#nav .nav-item')

        # 1) Ficha: abrir evaluación, tamizaje con ideación + método → Moderado sugerido
        pg.evaluate("App.go('pacientes','pac111111')"); pg.wait_for_selector('text=Riesgo suicida y plan de seguridad')
        check('la ficha muestra la tarjeta de riesgo suicida', True)
        pg.click('button:has-text("+ Evaluación C-SSRS")'); pg.wait_for_selector('#rk_sug')
        check('los ítems 3 a 5 están ocultos hasta responder el 2', pg.is_hidden('#rk_b_q3'))
        pg.check('#rk_q1_1'); pg.check('#rk_q2_1'); pg.wait_for_selector('#rk_b_q3', state='visible')
        pg.check('#rk_q3_1'); pg.check('#rk_q4_0'); pg.check('#rk_q5_0'); pg.check('#rk_q6_0')
        check('nivel sugerido = Moderado', 'Moderado' in pg.inner_text('#rk_sug'), pg.inner_text('#rk_sug'))
        check('el nivel final se ajusta solo al sugerido', pg.input_value('#rk_nf') == 'Moderado')
        pg.select_option('#rk_nf', 'Alto'); check('al cambiar el nivel pide justificación', pg.is_visible('#rk_jb'))
        pg.screenshot(path=os.path.join(OUT, '17_riesgo_formulario.png'))
        pg.click('button:has-text("Guardar evaluación")')
        check('sin justificación no guarda', pg.is_visible('#rk_sug') and any('justificación' in d for d in dialogos), str(dialogos))
        pg.fill('#rk_just', 'Acceso a medicación acumulada'); pg.check('#rk_ac0')
        pg.click('button:has-text("Guardar evaluación")')
        pg.wait_for_selector('.alerta-riesgo')
        check('aparece la alerta ALTO en la ficha', 'ALTO' in pg.inner_text('.alerta-riesgo'))
        check('avisa que falta el plan de seguridad', 'Falta el plan' in pg.inner_text('.alerta-riesgo'))
        check('ofreció elaborar el plan de seguridad', any('plan de seguridad' in d for d in dialogos))
        check('se actualizó el campo Riesgo de la ficha', 'Riesgo alto' in pg.inner_text('main'))
        pg.wait_for_selector('#pl_alerta')  # el confirm aceptado abre el plan
        # 2) Plan de seguridad
        check('el plan trae los teléfonos de crisis por defecto', '113' in pg.input_value('#pl_profesionales'))
        pg.fill('#pl_alerta', 'No dormir varios días\nDiscusiones con mi pareja'); pg.fill('#pl_interno', 'Caminar\nEscuchar música')
        pg.fill('#pl_apoyo', 'Rosa (hermana) 999111222'); pg.fill('#pl_razon', 'Mi hija'); pg.check('#pl_ent')
        pg.screenshot(path=os.path.join(OUT, '18_plan_seguridad.png'))
        pg.click('button:has-text("Guardar plan")'); pg.wait_for_selector('text=Plan de seguridad: ✅')
        check('el aviso de "falta plan" desaparece', 'Falta el plan' not in pg.inner_text('.alerta-riesgo'))
        pg.screenshot(path=os.path.join(OUT, '19_riesgo_ficha_alerta.png'))
        # 3) Impresión del plan
        pg.click('button[title="Copia para entregar al paciente"]')
        check('imprime el plan para el paciente', pg.evaluate('window.__imprimio') and 'Mi plan de seguridad' in pg.inner_html('#prt') and 'Mi hija' in pg.inner_html('#prt'))
        # 4) Panel Hoy y lista de pacientes
        pg.evaluate("App.go('hoy')"); pg.wait_for_selector('text=Pacientes con alerta de riesgo')
        check('el panel Hoy lista al paciente con alerta', 'Lucía Prueba Riesgo' in pg.inner_text('main'))
        pg.screenshot(path=os.path.join(OUT, '20_riesgo_hoy.png'))
        pg.evaluate("App.go('pacientes')"); check('la lista de pacientes marca 🚩', '🚩' in pg.inner_text('main'))
        # 5) Levantar la alerta
        pg.evaluate("App.go('pacientes','pac111111')"); pg.click('button:has-text("Ver")'); pg.click('button:has-text("Levantar alerta")')
        pg.fill('#rk_lev', 'Nueva evaluación sin riesgo'); pg.click('button.pri:has-text("Levantar alerta")')
        pg.wait_for_selector('text=alerta levantada')
        check('al levantar la alerta desaparece el banner', pg.locator('.alerta-riesgo').count() == 0)
        # 6) PHQ-9 con ítem 9 positivo abre la evaluación
        dialogos.clear()
        pg.click('button:has-text("+ PHQ-9")'); pg.wait_for_selector('#q8_1')
        for i in range(9): pg.check(f'#q{i}_{1 if i == 8 else 0}')
        pg.click('button:has-text("Calcular y guardar")'); pg.wait_for_selector('#rk_sug')
        check('PHQ-9 ítem 9 ofrece la evaluación C-SSRS', any('Ítem 9' in d for d in dialogos))
        pg.click('button:has-text("Cancelar")'); pg.wait_for_selector('text=ítem 9 positivo')
        check('queda un aviso mientras no se evalúe', 'Ítem 9' in pg.inner_text('.alerta-riesgo') or 'ítem 9' in pg.inner_text('.alerta-riesgo'))
        # 7) Impresión de historia incluye riesgo
        pg.evaluate("Reportes.historia('pac111111')"); check('la historia impresa incluye riesgo suicida', 'Riesgo suicida' in pg.inner_html('#prt'))
        # 8) Celular
        pg.set_viewport_size({'width': 390, 'height': 800}); pg.evaluate("App.go('pacientes','pac111111')"); pg.wait_for_selector('text=Riesgo suicida y plan de seguridad')
        pg.screenshot(path=os.path.join(OUT, '21_riesgo_cel.png'))
        br.close()
    check('sin errores de consola/JS', not errores, str(errores))
finally:
    srv.terminate(); srv.wait(timeout=20); shutil.rmtree(DATOS, ignore_errors=True)
ok = sum(1 for _, c in res if c); print(f'\n{ok}/{len(res)} comprobaciones OK'); raise SystemExit(0 if ok == len(res) else 1)
