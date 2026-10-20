# Resultados de pruebas en navegador real (bloque 1)

**Cómo se probó:** Chromium 141 real (no simulado) controlado con Playwright, contra el servidor real con una base temporal. 27 comprobaciones + 15 pruebas de servidor, todas correctas. Se revisaron visualmente las capturas de `docs/pruebas/`.
Repetir: `python tests/e2e_navegador.py` (necesita `pip install playwright && playwright install chromium`) y `npm test`.

## Defectos que la prueba en navegador encontró y se corrigieron
| # | Defecto | Corrección |
|---|---|---|
| 1 | Si el servidor rechazaba la configuración inicial, la pantalla se redibujaba y **borraba la frase de respaldo y la contraseña** | El error se muestra sin redibujar el formulario |
| 2 | En celular, la tabla de sesiones recortaba el selector de estado ("Pr") y cada fila era altísima | Cada sesión es ahora una tarjeta en pantallas chicas |
| 3 | El PDF impreso salía **sin márgenes** (texto pegado al borde de la hoja) | `@page` con márgenes A4 y filas que no se parten entre páginas |

## Lo verificado
Alta del administrador y rechazo de clave débil · crear paciente, ciclo de 4 sesiones, nota SOAP, test Rosenberg (puntaje 20 · Baja) por la interfaz · persistencia tras recargar y tras **reiniciar el servidor** · corte de internet (aviso "Sin conexión", el cambio se guarda solo al volver la red) · PDF de la historia (datos presentes, sin menú ni botones) · usuario Recepción (no ve Auditoría/Respaldo/Usuarios/Reportes ni contenido clínico; la API directa responde 403) · auditoría con usuarios reales y verificación de integridad · respaldos `.cerp` listados · celular iPhone 13 emulado: sin desbordamiento horizontal, menú, **firma con toques reales (CDP)**, consentimiento guardado y firma visible de nuevo · ningún error de JavaScript en consola.
La política de seguridad (CSP) está activa: bloqueó incluso un `eval` de mi propio script de prueba.

## Lo que NO pude verificar (hazlo tú, 10 minutos)
- **Un celular físico** (el táctil es emulado por el motor del navegador; los dedos reales, el teclado en pantalla y Safari de iPhone pueden comportarse distinto). Prueba la firma con tu dedo en tu teléfono.
- **Una impresora real** y el diálogo de impresión de tu navegador: verifiqué el PDF generado, no el papel.
- Safari y Firefox (solo probé Chromium).
- Rendimiento con cientos de pacientes y años de datos.
- Instalación en tu Windows (probé en Linux; `iniciar.bat` no se pudo ejecutar aquí).

## Capturas
`01`–`05` escritorio · `06` impresión · `07`–`10` usuarios, recepción, auditoría, respaldo · `11`–`16` celular y firma táctil · `historia_clinica_prueba.pdf`.
- Bloque 5 (riesgo suicida): `python tests/e2e_riesgo.py` (capturas 17 a 21).
- Bloque 6 (medición continua y enlace al paciente): `python tests/e2e_medicion.py` (capturas 22 a 27; incluye un celular simulado que responde el cuestionario sin sesión).
