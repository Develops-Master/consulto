"""Prueba en Chromium REAL del bloque 6 (medición continua + cuestionarios por enlace). Genera capturas en docs/pruebas/.
Uso:  python tests/e2e_medicion.py   (requiere playwright + chromium; ver e2e_navegador.py)"""
import os, time, json, shutil, subprocess, tempfile, urllib.request, datetime
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(RAIZ, 'docs', 'pruebas'); os.makedirs(OUT, exist_ok=True)
PORT = 3197; URL = f'http://127.0.0.1:{PORT}'; DATOS = tempfile.mkdtemp(prefix='erp-e2e-med-')
ENV = {**os.environ, 'PORT': str(PORT), 'ERP_DATA_DIR': DATOS}
res = []; errores = []
hoy = datetime.date.today(); f = lambda d: (hoy - datetime.timedelta(days=d)).isoformat()

def check(n, c, d=''):
    res.append((n, bool(c))); print(('  ✓ ' if c else '  ✗ ') + n + (f'  [{d}]' if d and not c else ''))
def api(m, u, b=None):
    r = urllib.request.Request(URL + u, method=m, data=None if b is None else json.dumps(b).encode(), headers={'X-ERP': '1', 'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(r).read() or b'{}')
def test_reg(i, pid, test, dias, resp, puntaje, nivel):
    api('POST', '/api/r/tests', {'id': i, 'pid': pid, 'test': test, 'fecha': f(dias), 'momento': 'Inicio' if dias > 60 else 'Seguimiento', 'resp': resp, 'puntaje': puntaje, 'nivel': nivel})

srv = subprocess.Popen(['node', '--disable-warning=ExperimentalWarning', os.path.join(RAIZ, 'server', 'server.js')], env=ENV, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try: urllib.request.urlopen(URL + '/api/estado'); break
        except Exception: time.sleep(0.2)
    api('POST', '/api/r/pacientes', {'id': 'pac222222', 'nombre': 'Rosa Prueba Medición', 'tel': '987654321'})
    # PHQ-9: 17 hace 80 días → 16 hace 12 días (≈10 semanas, casi sin cambio) = sin mejoría
    test_reg('tphq0001', 'pac222222', 'phq', 80, [2, 2, 2, 2, 2, 2, 2, 2, 1], 17, 'Moderadamente severa')
    test_reg('tphq0002', 'pac222222', 'phq', 12, [2, 2, 2, 2, 2, 2, 2, 2, 0], 16, 'Moderadamente severa')
    test_reg('tgad0001', 'pac222222', 'gad', 80, [2, 2, 2, 2, 2, 2, 1], 13, 'Moderada')
    test_reg('tgad0002', 'pac222222', 'gad', 10, [1, 1, 1, 1, 1, 1, 1], 7, 'Leve')
    with sync_playwright() as pw:
        br = pw.chromium.launch(); pg = br.new_page(viewport={'width': 1100, 'height': 1000})
        pg.on('pageerror', lambda e: errores.append(str(e)))
        pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        dialogos = []; pg.on('dialog', lambda d: (dialogos.append(d.message), d.accept()))
        pg.goto(URL); pg.wait_for_selector('#nav .nav-item')

        # 1) Ficha: gráficos y alerta de sin mejoría
        pg.evaluate("App.go('pacientes','pac222222')"); pg.wait_for_selector('#med-card')
        check('la ficha muestra la tarjeta de evolución', 'Evolución de resultados' in pg.inner_text('#med-card'))
        check('hay un gráfico por escala aplicada (PHQ-9 y GAD-7)', pg.locator('#med-card svg').count() == 2)
        check('el gráfico dibuja los puntos de cada aplicación', pg.locator('#med-card svg').first.locator('circle.pt').count() == 2)
        check('alerta: PHQ-9 sin mejoría', 'sin mejoría' in pg.inner_text('#med-card .alerta-med').lower() and 'PHQ-9' in pg.inner_text('#med-card .alerta-med'), pg.inner_text('#med-card'))
        check('GAD-7 (13 → 7) figura como mejoría, sin alerta', pg.locator('#med-card .alerta-med').count() == 1)
        check('aviso superior en la ficha', pg.locator('main > .alerta-med, #view .alerta-med').count() >= 2)
        pg.locator('#med-card').scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, '22_medicion_ficha.png'), full_page=False)
        # 2) Hoy y lista de pacientes
        pg.evaluate("App.go('hoy')"); pg.wait_for_selector('text=pacientes para revisar')
        check('el panel Hoy lista al paciente', 'Rosa Prueba Medición' in pg.inner_text('main') and 'sin mejoría' in pg.inner_text('main'))
        pg.screenshot(path=os.path.join(OUT, '23_medicion_hoy.png'))
        pg.evaluate("App.go('pacientes')"); check('la lista de pacientes marca 🔔', '🔔' in pg.inner_text('main'))
        # 3) Revisar el plan: exige nota y apaga el aviso
        pg.evaluate("App.go('pacientes','pac222222')"); pg.wait_for_selector('#med-card')
        pg.click('button:has-text("Revisé el plan")'); pg.wait_for_selector('#mr_n'); dialogos.clear()
        pg.click('button:has-text("Guardar revisión")'); check('sin nota no guarda', pg.is_visible('#mr_n') and any('Anota' in d for d in dialogos), str(dialogos))
        pg.fill('#mr_n', 'Se agrega activación conductual; reevaluar en 4 semanas'); pg.click('button:has-text("Guardar revisión")')
        pg.wait_for_function("!document.querySelector('#med-card .alerta-med')")
        check('tras revisar el plan desaparece el aviso', pg.locator('#med-card .alerta-med').count() == 0)
        check('queda constancia de la revisión', 'activación conductual' in pg.inner_text('#med-card'))
        check('el gráfico marca la revisión del plan', pg.locator('#med-card line.rev').count() == 1)
        # 4) Escalas nuevas desde el formulario: PCL-5 (20 ítems) y ORS (0–10)
        pg.click('button:has-text("+ PCL-5")'); pg.wait_for_selector('#q19_1')
        for i in range(20): pg.check(f'#q{i}_2')
        pg.click('button:has-text("Calcular y guardar")'); pg.wait_for_selector('text=PCL-5 · Estrés postraumático')
        check('PCL-5: 20 ítems × 2 = 40, sobre el punto de corte', 'posible TEPT' in pg.inner_text('main') and '40' in pg.inner_text('main'))
        pg.click('button:has-text("+ ORS")'); pg.wait_for_selector('#q3_10')
        for i, v in enumerate([3, 4, 5, 4]): pg.check(f'#q{i}_{v}')
        pg.click('button:has-text("Calcular y guardar")'); pg.wait_for_selector('text=ORS · Escala de resultado')
        check('ORS: 3+4+5+4 = 16, rango clínico', 'Rango clínico' in pg.inner_text('main'))
        check('aparecen 4 gráficos', pg.locator('#med-card svg').count() == 4)
        # 5) Enlace para el paciente
        pg.click('button:has-text("Cuestionario por enlace")'); pg.wait_for_selector('.en_k')
        pg.check('.en_k[value="phq"]'); pg.check('.en_k[value="srs"]'); pg.click('#en_go'); pg.wait_for_selector('#en_res input')
        url = pg.input_value('#en_res input')
        check('el enlace tiene la forma /r/<token>', '/r/' in url and len(url.split('/r/')[1]) >= 20, url)
        check('avisa que localhost solo sirve en este equipo', 'solo funciona en este equipo' in pg.inner_text('#en_res'))
        check('queda listado como pendiente', 'PHQ-9 + SRS' in pg.inner_text('#en_lista'), pg.inner_text('#en_lista'))
        pg.screenshot(path=os.path.join(OUT, '24_enlace_dialogo.png'))
        # 6) El paciente, en su celular y sin sesión
        ctx = br.new_context(viewport={'width': 390, 'height': 800}, has_touch=True); cel = ctx.new_page()
        cel.on('pageerror', lambda e: errores.append('portal: ' + str(e)))
        cel.on('console', lambda m: errores.append('portal: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        cel.goto(url); cel.wait_for_selector('.preg')
        check('el paciente ve el cuestionario 1 de 2 (PHQ-9) y el aviso de crisis', 'Cuestionario 1 de 2' in cel.inner_text('#p') and '113' in cel.inner_text('#crisis'))
        check('el portal no muestra el nombre del paciente ni el menú', 'Rosa' not in cel.inner_text('body') and cel.locator('#nav').count() == 0)
        cel.click('#sig'); check('si falta una respuesta lo señala', 'Falta responder la pregunta 1' in cel.inner_text('#err'))
        for i in range(9): cel.check(f'input[name="q{i}"][value="{1 if i == 8 else 0}"]', force=True)
        cel.screenshot(path=os.path.join(OUT, '25_portal_cel.png'))
        cel.click('#sig'); cel.wait_for_selector('text=Cuestionario 2 de 2')
        for i in range(4): cel.check(f'input[name="q{i}"][value="9"]', force=True)
        cel.click('#sig'); cel.wait_for_selector('.crisis-box')
        check('ítem 9 positivo: el paciente ve recursos de crisis', '113' in cel.inner_text('.crisis-box') and 'Gracias' in cel.inner_text('#p'))
        cel.screenshot(path=os.path.join(OUT, '26_portal_crisis.png'))
        cel.reload(); cel.wait_for_selector('text=Enlace no disponible'); check('el enlace ya no se puede reutilizar', True)
        ctx.close()
        # 7) El profesional ve lo respondido, y el ítem 9 vuelve a disparar el aviso de riesgo
        pg.keyboard.press('Escape'); pg.evaluate("App.recargar()"); pg.wait_for_selector('text=📲 enlace')
        check('las respuestas del paciente aparecen con la marca de enlace', pg.locator('text=📲 enlace').count() == 2)
        pg.evaluate("App.go('hoy')"); pg.wait_for_selector('text=Pacientes con alerta de riesgo')
        check('PHQ-9 ítem 9 por enlace dispara el aviso de riesgo suicida', 'Rosa Prueba Medición' in pg.inner_text('main'))
        pg.evaluate("App.go('pacientes','pac222222')"); pg.wait_for_selector('#med-card'); pg.set_viewport_size({'width': 390, 'height': 800})
        pg.locator('#med-card').scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, '27_medicion_cel.png'))
        br.close()
    check('sin errores de consola/JS', not errores, str(errores))
finally:
    srv.terminate(); srv.wait(timeout=20); shutil.rmtree(DATOS, ignore_errors=True)
ok = sum(1 for _, c in res if c); print(f'\n{ok}/{len(res)} comprobaciones OK'); raise SystemExit(0 if ok == len(res) else 1)
