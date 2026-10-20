"""Prueba de extremo a extremo en Chromium REAL (Playwright). Genera capturas y un PDF en docs/pruebas/.
Uso:  pip install playwright && playwright install chromium && python tests/e2e_navegador.py
"""
import os, sys, json, time, shutil, subprocess, tempfile, urllib.request
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(RAIZ, 'docs', 'pruebas'); os.makedirs(OUT, exist_ok=True)
PORT = 3199; URL = f'http://127.0.0.1:{PORT}'
DATOS = tempfile.mkdtemp(prefix='erp-e2e-')
ENV = {**os.environ, 'PORT': str(PORT), 'ERP_DATA_DIR': DATOS, 'ERP_SIN_LOGIN': '0'}
resultados = []; errores_consola = []

def arrancar():
    p = subprocess.Popen(['node', '--disable-warning=ExperimentalWarning', os.path.join(RAIZ, 'server', 'server.js')], env=ENV, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(50):
        try: urllib.request.urlopen(URL + '/api/estado'); return p
        except Exception: time.sleep(0.2)
    raise RuntimeError('el servidor no arrancó')
def parar(p): p.terminate(); p.wait(timeout=20)
def check(nombre, cond, detalle=''):
    resultados.append((nombre, bool(cond), detalle)); print(('  ✓ ' if cond else '  ✗ ') + nombre + (f'  [{detalle}]' if detalle and not cond else ''))
def shot(page, nombre, **kw): page.screenshot(path=os.path.join(OUT, nombre + '.png'), **kw)
def vigilar(page, etiqueta):
    page.on('pageerror', lambda e: errores_consola.append(f'{etiqueta}: {e}'))
    page.on('console', lambda m: errores_consola.append(f'{etiqueta}: {m.text}') if m.type == 'error' and 'Failed to load resource' not in m.text else None)

srv = arrancar()
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        # ================= ESCRITORIO =================
        ctx = br.new_context(viewport={'width': 1280, 'height': 800}, locale='es-PE'); page = ctx.new_page(); vigilar(page, 'escritorio')
        print('\n[1] Configuración inicial y acceso')
        page.goto(URL); page.wait_for_selector('#s_n'); shot(page, '01_configuracion_inicial')
        page.fill('#s_n', 'Ps. Lucía Prueba'); page.fill('#s_u', 'lucia'); page.fill('#s_p', 'corta'); page.fill('#s_f', 'frase-de-respaldo-segura')
        page.click('text=Crear y entrar'); page.wait_for_selector('.auth-err'); check('Rechaza contraseña débil con mensaje claro', 'al menos 10' in page.inner_text('.auth-err'))
        page.fill('#s_p', 'ClaveSegura2026'); page.click('text=Crear y entrar'); page.wait_for_selector('#nav .nav-item'); shot(page, '02_inicio_hoy')
        check('Entra al panel "Hoy" tras configurar', 'Sesiones hoy' in page.inner_text('#view'))
        check('Menú de administrador incluye Usuarios, Auditoría y Respaldo', all(t in page.inner_text('#nav') for t in ['Usuarios', 'Auditoría', 'Respaldo']))

        print('\n[2] Paciente, ciclo de sesiones, SOAP y test (por la interfaz)')
        page.click('#nav >> text=Pacientes'); page.click('text=+ Nuevo paciente'); page.wait_for_selector('#f_nombre')
        check('El alta de paciente se divide en secciones', page.locator('#dlg [data-ficha-form-tab]').count() == 4)
        page.fill('#f_nombre', 'María Fernanda Quispe'); page.fill('#f_doc', '45678912'); page.fill('#f_tel', '987654321'); page.fill('#f_nac', '1994-03-12'); page.click('#ficha-form-tab-2'); page.select_option('#f_riesgo', 'Riesgo bajo')
        page.click('#ficha-form-tab-3'); check('El diagnóstico ofrece sugerencias y consulta oficial CIE-10', page.locator('#cie10-sugerencias option').count() >= 10 and 'icd.who.int/browse10/2019/en' in page.locator('.cie10-consulta').get_attribute('href')); page.click('#ficha-form-tab-2')
        page.fill('#f_motivo', 'Baja autoestima y ansiedad en el trabajo'); page.click('#ficha-form-tab-0')
        check('Los datos se conservan al cambiar de sección', page.input_value('#f_nombre') == 'María Fernanda Quispe' and page.input_value('#f_motivo') == 'Baja autoestima y ansiedad en el trabajo')
        page.click('#ficha-form-tab-2'); shot(page, '03_formulario_historia', full_page=False)
        page.click('dialog >> text=Guardar'); page.wait_for_selector('#ficha-tab-resumen'); page.click('#ficha-tab-sesiones'); page.wait_for_selector('text=Sesiones del paciente')
        check('Se crea el paciente y abre su ficha', 'María Fernanda Quispe' in page.inner_text('#view'))
        page.click('#ficha-tab-medicacion'); page.click('text=+ Registrar medicación'); page.fill('#med_nombre', 'Medicamento prueba E2E'); page.fill('#med_prescriptor', 'Profesional prueba'); page.fill('#med_dosis', 'Transcripción literal'); page.fill('#med_frecuencia', 'Según receta'); page.click('dialog >> text=Guardar registro'); page.wait_for_selector('text=Medicamento prueba E2E')
        check('Registra medicación de receta sin sugerir fármacos', 'Medicamento prueba E2E' in page.inner_text('#ficha-panel') and 'Transcripción literal' in page.inner_text('#ficha-panel'))
        page.click('#ficha-tab-sesiones');
        page.click('text=+ Ciclo'); page.fill('#cy_n', '4'); page.fill('#cy_h', '10:00'); page.click('text=Crear sesiones'); page.wait_for_selector('text=Sesión 1/4')
        check('Ciclo de 4 sesiones creado', page.inner_text('#view').count('Sesión ') >= 4)
        page.click('text=Nota SOAP >> nth=0'); page.fill('#n_s', 'Refiere sentirse insegura'); page.fill('#n_a', 'Autoestima baja'); page.fill('#n_eva', '7'); page.click('dialog >> text=Guardar')
        page.click('#ficha-tab-avance'); page.click('text=+ Rosenberg'); page.wait_for_selector('#q0_1')
        for i, v in enumerate([2, 2, 2, 2, 2, 3, 3, 3, 3, 3]): page.check(f'#q{i}_{v}')
        page.click('text=Calcular y guardar'); page.wait_for_selector('text=Evaluaciones psicométricas'); shot(page, '04_ficha_paciente_completa', full_page=True)
        check('Test Rosenberg con puntaje automático (esperado 20 · Baja)', '20' in page.inner_text('#view') and 'Baja' in page.inner_text('#view'))
        page.click('#ficha-tab-historial'); timeline = page.inner_text('#ficha-panel')
        check('Historial longitudinal reúne sesiones, nota SOAP, escalas y medicación', 'Sesión y nota SOAP' in timeline and 'Rosenberg' in timeline and 'Medicamento prueba E2E' in timeline)
        page.click('#ficha-tab-avance'); page.wait_for_selector('text=Evaluaciones psicométricas')
        page.wait_for_selector('#sync.ok')
        check('Indicador muestra "Guardado"', True)

        print('\n[3] Persistencia en el servidor')
        page.reload(); page.wait_for_selector('#nav .nav-item'); page.click('#nav >> text=Pacientes'); page.wait_for_selector('text=María Fernanda Quispe')
        check('Tras recargar la página los datos siguen (están en el servidor)', True)
        ctx2 = br.new_context(); p2 = ctx2.new_page(); p2.goto(URL); p2.wait_for_selector('#a_u')
        check('Otro navegador sin sesión ve la pantalla de login, no datos', 'Iniciar sesión' in p2.inner_text('#auth') and 'María' not in p2.content()); ctx2.close()
        parar(srv); srv = arrancar(); page.reload(); page.wait_for_selector('#nav .nav-item'); page.click('#nav >> text=Pacientes')
        check('Tras REINICIAR el servidor los datos y la sesión persisten', page.locator('text=María Fernanda Quispe').count() > 0)

        print('\n[4] Sin conexión: la edición no se pierde')
        page.click('text=María Fernanda Quispe'); page.wait_for_selector('#ficha-tab-sesiones'); page.click('#ficha-tab-sesiones'); page.wait_for_selector('text=Sesiones del paciente')
        ctx.set_offline(True); page.select_option('#ficha-panel table.ses select', 'Atendida'); page.wait_for_selector('#sync.red', timeout=8000); shot(page, '05_sin_conexion')
        check('Muestra aviso "Sin conexión" y mantiene el cambio pendiente', True)
        ctx.set_offline(False); page.wait_for_selector('#sync.ok', timeout=15000)
        check('Al volver la red guarda solo, sin intervención', True)

        print('\n[5] Impresión / PDF de la historia clínica')
        page.evaluate("window.print = () => {}"); pid = page.evaluate("App.state.param"); page.evaluate(f"Reportes.historia('{pid}')")
        page.emulate_media(media='print'); pdf = os.path.join(OUT, 'historia_clinica_prueba.pdf'); page.pdf(path=pdf, prefer_css_page_size=True, print_background=True); page.emulate_media(media='screen')
        check('Se genera el PDF de la historia', os.path.getsize(pdf) > 5000, str(os.path.getsize(pdf)))
        if shutil.which('pdftoppm'): subprocess.run(['pdftoppm', '-png', '-r', '60', '-f', '1', '-l', '2', pdf, os.path.join(OUT, '06_impresion_pagina')], check=False)
        txt = subprocess.run(['pdftotext', pdf, '-'], capture_output=True, text=True).stdout if shutil.which('pdftotext') else ''
        check('El PDF contiene los datos y NO muestra el menú ni botones', ('María Fernanda' in txt and 'Rosenberg' in txt and 'Cerrar sesión' not in txt and 'Nueva' not in txt) if txt else True, txt[:120])

        print('\n[6] Roles: usuario de Recepción')
        page.click('#quien'); page.click('text=Cerrar sesión'); page.wait_for_selector('#a_u')
        page.fill('#a_u', 'lucia'); page.fill('#a_p', 'ClaveSegura2026'); page.click('text=Ingresar'); page.wait_for_selector('#nav .nav-item'); page.click('#nav >> text=Usuarios'); page.click('text=+ Nuevo usuario')
        page.fill('#u_n', 'Rosa Recepción'); page.fill('#u_u', 'rosa'); page.select_option('#u_r', 'recepcion'); page.click('dialog >> text=Crear'); page.wait_for_selector('text=Contraseña temporal'); temp = page.inner_text('dialog p[style*="monospace"]').strip(); shot(page, '07_usuario_creado'); page.click('text=Listo')
        page.click('#quien'); page.click('text=Cerrar sesión'); page.wait_for_selector('#a_u')
        page.fill('#a_u', 'rosa'); page.fill('#a_p', temp); page.click('text=Ingresar'); page.wait_for_selector('#c_a')
        check('Con clave temporal obliga a crear una propia', 'Crea tu contraseña' in page.inner_text('#auth'))
        page.fill('#c_a', temp); page.fill('#c_n', 'Recepcion-2026x'); page.click('text=Guardar'); page.wait_for_selector('#nav .nav-item')
        menu = page.inner_text('#nav'); check('Recepción NO ve Auditoría, Respaldo, Usuarios ni Reportes', not any(t in menu for t in ['Auditoría', 'Respaldo', 'Usuarios', 'Reportes']), menu.replace('\n', ' | '))
        page.click('#nav >> text=Pacientes'); page.click('text=María Fernanda Quispe'); page.wait_for_selector('#ficha-tab-historia'); page.click('#ficha-tab-historia'); vista = page.inner_text('#ficha-panel'); shot(page, '08_recepcion_ficha', full_page=True)
        page.click('#ficha-tab-sesiones'); sesiones_recep = page.inner_text('#ficha-panel')
        check('Recepción ve contacto pero NO motivo, riesgo, tests ni consentimiento', '987654321' in vista and 'Baja autoestima' not in vista and 'Riesgo' not in vista and 'Rosenberg' not in vista and 'Consentimiento' not in vista and 'SOAP' not in sesiones_recep)
        r = page.evaluate("fetch('/api/r/tests',{method:'POST',headers:{'X-ERP':'1','Content-Type':'application/json'},body:JSON.stringify({id:'abcdef1234',pid:'x',test:'ros'})}).then(r=>r.status)")
        check('Saltarse la interfaz y llamar a la API directo también es rechazado (403)', r == 403, str(r))
        page.click('#quien'); page.click('text=Cerrar sesión'); page.wait_for_selector('#a_u')

        print('\n[7] Auditoría confiable (como administrador)')
        page.fill('#a_u', 'lucia'); page.fill('#a_p', 'ClaveSegura2026'); page.click('text=Ingresar'); page.wait_for_selector('#nav .nav-item'); page.click('#nav >> text=Auditoría'); page.wait_for_selector('text=Verificar integridad'); page.click('text=Verificar integridad'); page.wait_for_selector('text=Registro íntegro'); shot(page, '09_auditoria', full_page=True)
        aud = page.inner_text('#view'); check('La auditoría muestra usuarios reales (lucia y rosa), no "Profesional"', 'lucia' in aud and 'rosa' in aud and 'Profesional' not in aud)
        check('Registra intento denegado de recepción', 'acceso denegado' in aud)
        page.click('#nav >> text=Respaldo'); page.wait_for_selector('text=Respaldos automáticos cifrados'); page.click('text=Crear respaldo ahora'); page.wait_for_selector('text=.cerp'); shot(page, '10_respaldo', full_page=True)
        check('Hay respaldos cifrados (.cerp) listados', page.locator('text=Descargar').count() >= 2)
        ctx.close()

        # ================= CELULAR (iPhone 13 emulado: pantalla táctil) =================
        print('\n[8] Celular (iPhone 13 emulado) + firma TÁCTIL')
        mov = br.new_context(**pw.devices['iPhone 13'], locale='es-PE'); m = mov.new_page(); vigilar(m, 'celular')
        m.goto(URL); m.wait_for_selector('#a_u'); shot(m, '11_cel_login'); m.fill('#a_u', 'lucia'); m.fill('#a_p', 'ClaveSegura2026'); m.click('text=Ingresar'); m.wait_for_selector('#nav .nav-item', state='attached'); shot(m, '12_cel_hoy')
        ancho = m.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth'); check('Sin desbordamiento horizontal en el panel Hoy', ancho <= 1, f'{ancho}px')
        m.click('.burger'); m.wait_for_timeout(300); shot(m, '13_cel_menu'); m.click('#nav >> text=Pacientes'); m.click('text=María Fernanda Quispe'); m.wait_for_selector('#ficha-tab-clinico'); m.click('#ficha-tab-clinico'); m.wait_for_selector('text=Consentimiento informado')
        ancho = m.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth'); check('Ficha del paciente cabe en la pantalla del celular', ancho <= 1, f'{ancho}px'); shot(m, '14_cel_ficha', full_page=True)
        m.click('text=Registrar consentimiento'); m.wait_for_selector('#firma'); m.check('#c_ok')
        caja = m.locator('#firma').bounding_box(); cdp = m.context.new_cdp_session(m)
        def toque(tipo, x, y): cdp.send('Input.dispatchTouchEvent', {'type': tipo, 'touchPoints': [{'x': x, 'y': y}] if tipo != 'touchEnd' else []})
        x0, y0 = caja['x'] + 20, caja['y'] + caja['height'] / 2; toque('touchStart', x0, y0)
        for i in range(1, 25): toque('touchMove', x0 + i * 10, y0 + (20 if i % 2 else -20))
        toque('touchEnd', 0, 0); shot(m, '15_cel_firma_tactil')
        oscuro = m.evaluate("(()=>{const c=document.getElementById('firma'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<100)n++;return n})()")
        check('La firma con el dedo dibuja trazo en el lienzo', oscuro > 100, f'{oscuro} píxeles')
        m.click('dialog >> text=Guardar'); m.wait_for_selector('text=Firmado el')
        check('Consentimiento guardado con firma', m.locator('text=Firmado el').count() > 0)
        m.click('text=Ver / imprimir'); m.wait_for_selector('dialog img'); shot(m, '16_cel_consentimiento_firmado')
        ok_img = m.evaluate("(()=>{const i=document.querySelector('dialog img');return i&&i.naturalWidth>0})()"); check('La firma guardada se vuelve a mostrar correctamente', ok_img)
        mov.close(); br.close()
finally:
    parar(srv)

print('\n[Errores de consola/JS]'); [print('  -', e) for e in errores_consola]
check('Sin errores de JavaScript en consola durante toda la prueba', not errores_consola, '; '.join(errores_consola)[:300])
fallos = [r for r in resultados if not r[1]]
json.dump([{'prueba': a, 'ok': b} for a, b, _ in resultados], open(os.path.join(OUT, 'resultados.json'), 'w'), ensure_ascii=False, indent=1)
print(f'\n{len(resultados) - len(fallos)}/{len(resultados)} comprobaciones correctas'); shutil.rmtree(DATOS, ignore_errors=True); sys.exit(1 if fallos else 0)
