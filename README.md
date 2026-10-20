# Consultorio ERP · v1.6 (bloques 1 a 6 + rediseño visual)

Sistema de gestión para consultorio de psicología. Ahora funciona con **servidor + base de datos**, usuarios con contraseña, auditoría confiable y respaldos cifrados.

## v1.6: rediseño visual (multicolor)
- **Colores (estilo profesional):** menú lateral gris oscuro, un color principal verde azulado y colores apagados solo para indicar estados (verde correcto, ámbar atención, rojo error). Sin degradados. Botones con color según la acción. Siempre en **modo claro**, aunque el equipo esté en modo oscuro (para volver a seguir el modo del equipo, ver el comentario al inicio del bloque v1.6 de `styles.css`).
- **Bootstrap 5.3** incluido en `vendor/bootstrap/` (sin internet ni CDN, porque el servidor bloquea scripts externos). `js/core/tema.js` aplica automáticamente las clases de Bootstrap a tablas, formularios y botones, también en diálogos.
- **Toasts de Bootstrap** (`App.aviso(mensaje, tipo?, milisegundos?)`): verde éxito, rojo error, amarillo atención, celeste información; el tipo se detecta solo por el texto o se indica como 2.º parámetro. Ahora además avisa «Guardado correctamente» y «Conexión recuperada».
- **Pantalla completa:** el contenido ocupa todo el ancho (antes máx. 1020 px).
- **Letra más grande:** base de 17 px y ningún texto menor de 14 px (antes había textos de 11 a 13 px).
- No se tocó la lógica, el servidor ni la base de datos; las pruebas automáticas siguen pasando.

## Ver la web SIN servidor (modo local)
Abre `index.html` con doble clic (o sírvelo desde cualquier hosting estático). Si no hay servidor Node, la web pasa sola a **modo local**: funciona completa en el navegador, trae 3 pacientes de ejemplo y guarda los datos en ese navegador (aviso en el pie del menú; "restablecer" vuelve a los datos de ejemplo). Limitaciones: un solo usuario administrador, sin cuestionarios por enlace, sin respaldos cifrados (el botón de respaldo descarga un `.json`). Si ejecutas `iniciar.bat`, se usa el servidor normal.

## Cómo usarlo
1. Instala **Node.js 22.13 o superior** (https://nodejs.org, versión LTS).
2. **Windows:** doble clic en `iniciar.bat`. **Mac:** doble clic en `iniciar.command` (si macOS lo bloquea: clic derecho → Abrir → Abrir). **Linux:** `./iniciar.sh`.
   - En Mac/Linux, si no tienes Node 22.13+, el lanzador descarga una copia local en `.node/` (sin instalar nada ni pedir contraseña) y abre el navegador solo. Si el puerto 3000 está ocupado, usa el siguiente libre.
   - Alternativa manual en Terminal: `cd consultorio-erp && npm start`.
3. Abre http://localhost:3000. **Mientras se implementan las funciones, el sistema arranca SIN login** (entra directo como Administrador y el menú muestra "Modo desarrollo"). Solo funciona en este equipo; para volver a activar el login: `ERP_SIN_LOGIN=0 npm start`. Con login activo: La primera vez te pide crear la cuenta de administrador y la **frase de respaldo** (anótala en papel).
4. Para otros equipos o celulares de la red, mira `docs/DESPLIEGUE.md` (**usa HTTPS**).

No hay que instalar nada más (`npm install` no es necesario: cero dependencias).

## Qué cambió respecto a la versión anterior
| Antes | Ahora |
|---|---|
| Datos en el navegador de un equipo | Base de datos SQLite en el servidor (`data/erp.db`), campos clínicos cifrados |
| Cualquiera ve todo | Usuarios, contraseñas (scrypt), sesión que expira a los 30 min, bloqueo tras 5 intentos |
| Sin roles | Administrador · Profesional · Recepción (recepción no ve contenido clínico; lo impone el servidor) |
| Auditoría escrita por el navegador, alterable | Auditoría escrita por el servidor con el usuario real, encadenada con HMAC; botón "Verificar integridad" |
| Respaldo manual en `.json` sin cifrar | Respaldo automático cifrado (AES-256-GCM), retención, copia a carpeta extra, restauración por consola |
| Borrar = perder | Todo borrado va a una papelera en el servidor |

## Carpetas
- `server/` servidor (HTTP, permisos, base de datos, cifrado, respaldos) · `index.html`, `css/`, `js/`, `vendor/` (interfaz, en la raíz) · `tools/` restaurar respaldo / recuperar contraseña
- `tests/` pruebas automáticas (`npm test`) y prueba en navegador real (`python tests/e2e_navegador.py`)
- `docs/` despliegue, seguridad, resultados de pruebas y dossier legal

## Agregar un módulo o entidad nueva
1. En `server/permisos.js` añade la entidad a `ENTIDADES` (quién puede leer/crear/editar/borrar).
2. En `js/modules/` crea el módulo con `App.repo('entidad')` y `App.register(...)` como antes; añade su `<script>` en `index.html`.

## Importar datos de la versión anterior
Si usaste la versión de navegador: Respaldo → "Importar datos de la versión anterior" y elige tu `.json`.

## Bloque 2: funciones clínicas
- **Tests psicológicos** (Rosenberg, PHQ-9, GAD-7) con puntaje y nivel automáticos; se compara el test de *Inicio* con el de *Cierre* en la ficha y en el informe final.
- **Cierre del tratamiento**: estado Activo / Alta / Abandono, informe psicológico final imprimible (con botón "Autocompletar resumen") y seguimientos posteriores (botón para programar 1, 3 y 6 meses).
- **Adjuntos**: informes, exámenes y documentos por paciente (máx. 5 MB), cifrados en la base; la descarga queda en la auditoría.
- **Plan de tratamiento**: los objetivos ahora se pueden editar (texto, meta, fecha meta, estado y nota de avance).
- **Medicación registrada**: en la ficha clínica se puede conciliar lo informado por el paciente o transcribir una receta externa con profesional, pauta textual, fechas y estado. No es inventario, prescripción ni recomendación farmacológica; solo administración y profesionales acceden.
- **CIE-10**: el campo diagnóstico ofrece sugerencias de códigos frecuentes y consulta el navegador oficial de la OMS (edición 2019). La lista local es parcial; verifica la denominación aplicable y registra el código solo cuando corresponda clínicamente. No propone diagnósticos.

## Bloque 3: agenda y citas
- **Reprogramar** una sesión (📅): cambia fecha y hora sin borrarla; queda el historial (“↻ Reprogramada 2x”) y se reactiva el recordatorio.
- **Calendario** semanal y mensual (Agenda → Semana / Mes / Lista). Toca una cita para ver, cambiar estado, reprogramar, enviar recordatorio o abrir la ficha; el “+” de cada día programa una sesión ahí.
- **Choques de horario**: al programar, reprogramar o crear un ciclo avisa si se solapa con otra cita (usa la duración); en el calendario se marca con ⚠️.
- **Lista de espera**: personas sin horario (nuevas o pacientes existentes) con prioridad y disponibilidad; “Agendar” crea al paciente si hace falta y abre la programación. Si se cancela una cita o alguien no asiste, avisa que hay gente esperando.
- **Recordatorios**: el sistema detecta las citas de hoy y de los próximos días (configurable) sin recordatorio, lo muestra en *Hoy* y *Agenda*, y desde “Revisar y enviar” abres WhatsApp con el mensaje listo en un clic; queda marcado ✓. El mensaje es editable. *Nota:* el envío totalmente automático (sin tocar nada) requiere un servicio de pago de WhatsApp/SMS; no se incluye.

## Bloque 4: administración y pagos
- **Saldos y deudas**: en la ficha de cada paciente, *Cuenta y pagos* (cargos, pagado, debe / a favor). Los cargos = sesiones atendidas fuera de paquete × **tarifa por sesión** (campo nuevo en la ficha) + paquetes vendidos. En *Pagos* aparece la lista de saldos pendientes, el total por cobrar y un botón 📲 para recordar la deuda por WhatsApp.
- **Paquetes prepagados** (ej. ciclo de 10 sesiones): se registran con precio y, si quieres, el pago inicial. Las sesiones atendidas desde la fecha de compra se descuentan solas (“quedan 6”); se pueden editar y anular.
- **Editar cobros** (✎): fecha, monto, método, concepto, paquete y comprobante. Cada cambio queda en la auditoría.
- **Comprobantes**: ticket/recibo interno de impresión compacta con numeración correlativa (serie configurable en ⚙, solo admin). Para boletas o facturas emitidas en SUNAT u otro sistema autorizado, registra el número, nombre/razón social y documento del adquirente para imprimir una constancia de referencia. *El ERP no emite CPE ni reemplaza el comprobante tributario.*
- **Devoluciones**: administración puede registrar devoluciones parciales o totales vinculadas al cobro original. El sistema limita el acumulado, ajusta el saldo y registra cada movimiento; si hubo boleta/factura externa, pide el número de la nota de crédito correspondiente. No emite la nota de crédito electrónica.
- **Exportar** a Excel (.xls) o CSV: cobros, saldos, pacientes (solo datos de contacto) y sesiones, con rango de fechas. Queda en la auditoría.
- **Búsqueda global** (🔍 arriba o Ctrl+K): pacientes (nombre, DNI, teléfono, correo), sesiones, cobros (monto, concepto, N.º de recibo), paquetes y lista de espera. No busca en el contenido clínico.

## Bloque 5: riesgo suicida y plan de seguridad
Reemplaza el campo suelto de "riesgo" por un flujo estructurado. Es una **ayuda para tu criterio clínico, no lo reemplaza**.
- **Evaluación C-SSRS (tamizaje)** en la ficha → *Riesgo suicida y plan de seguridad* → "+ Evaluación C-SSRS". Los ítems 3 a 5 aparecen solo si el 2 es "Sí". El sistema **sugiere** el nivel con el triage del tamizaje: *Alto* = ítem 4 o 5, o conducta suicida en los últimos 3 meses · *Moderado* = ítem 3, o conducta suicida hace más de 3 meses · *Bajo* = ítem 1 o 2.
- **Entrevista clínica**: factores de riesgo, factores protectores, acceso a medios letales, observaciones y acciones realizadas. El **nivel final lo decides tú**; si cambias el sugerido, debes escribir la justificación (el servidor también lo exige).
- **Alerta visible**: con nivel Moderado o Alto aparece un aviso rojo/ámbar al abrir la ficha, una 🚩 en la lista de pacientes y en la agenda, y un panel *Pacientes con alerta de riesgo* en **Hoy**. Se mantiene hasta que la levantas (con motivo). Avisa además cuando toca **reevaluar** (Alto: 7 días · Moderado: 14 días) y cuando **falta el plan de seguridad** (o no se revisó después de la evaluación).
- **Recordatorio automático si hay ideación**: (a) PHQ-9 con ítem 9 positivo ofrece abrir la evaluación y deja un aviso hasta que se evalúe; (b) en la nota SOAP hay una casilla "Hubo ideación suicida o autolesión en esta sesión" que ofrece evaluar y elaborar el plan.
- **Plan de seguridad Stanley-Brown** (6 pasos + razón para vivir), editable y con los teléfonos de crisis de Perú precargados (Línea 113 opción 5, WhatsApp 955 557 000, SAMU 106, Policía 105; verifícalos de vez en cuando). Botón 🖨 para imprimir **"Mi plan de seguridad"** para el paciente.
- La evaluación actualiza el campo *Riesgo* de la historia clínica y la historia impresa incluye un resumen. Recepción **no ve nada de esto** (lo impone el servidor). Borrar evaluaciones o planes: solo administrador, con copia en la papelera; todo queda en la auditoría.
- Pruebas: `npm test` (22 pruebas, incluye las reglas del tamizaje y permisos) y `python tests/e2e_riesgo.py` (navegador real, capturas en `docs/pruebas/17` a `21`).

**Importante sobre la escala:** la C-SSRS es de uso clínico gratuito (© The Research Foundation for Mental Hygiene, Columbia University). La redacción de los ítems es una adaptación mía: **reemplázala por la versión oficial en español** en cssrs.columbia.edu (edita `PREG` y `P6` en `js/modules/riesgo.js`). Las reglas de nivel están en `riesgo-logica.js`; revísalas con tu criterio y protocolo.

## Bloque 6: medición continua de resultados
Convierte las escalas (antes aplicadas "a mano" y sin seguimiento) en un seguimiento del avance. Es una **ayuda para tu criterio clínico, no lo reemplaza**.
- **Más escalas**: PCL-5 (estrés postraumático, 20 ítems; corte 33), **ORS** (resultado, 4 ítems 0–10; corte 25) y **SRS** (alianza en la sesión, 4 ítems 0–10), además de PHQ-9, GAD-7 y Rosenberg. Todas se definen en `js/modules/escalas.js`.
- **Gráfico de evolución** por escala en la ficha (*Evolución de resultados*): puntaje en el tiempo, punto de corte y marcas donde revisaste el plan.
- **Alerta de "sin mejoría"** (reglas en `medicion-logica.js`, solo para pacientes con tratamiento *Activo*): se compara la línea base con la última medición. **Sin mejoría** = pasaron 8 semanas y el cambio no llegó al mínimo relevante (PHQ-9: 5 puntos · GAD-7: 4 · PCL-5: 10 · ORS: 5). **Empeoró** = avisa sin esperar las 8 semanas. No avisa si el paciente ya está en rango no clínico. Avisa también cuando **falta una segunda medición** o la última tiene más de 28 días, y cuando el **SRS** sugiere una dificultad en la alianza (total menor de 36 o algún ítem menor de 9). Rosenberg solo se grafica (no hay un umbral de cambio aceptado).
- **"Revisé el plan"**: dejas constancia de lo que decidiste (la nota es obligatoria) y **se reinicia el conteo de 8 semanas** para esa escala, así el aviso no insiste mientras pruebas el ajuste.
- **Dónde se ve**: aviso en la ficha, panel *Medición de resultados* en **Hoy**, 🔔 en la lista de pacientes.
- **Cuestionario por enlace** (📲 en la tarjeta): eliges escalas, momento y vencimiento (3, 7 o 14 días) y el sistema genera un enlace **personal, de un solo uso**, que envías por WhatsApp. El paciente responde en su celular, **sin cuenta**; el servidor valida las respuestas, **calcula él mismo el puntaje** y lo guarda en la ficha con la marca 📲 enlace. Puedes anular enlaces pendientes. Del enlace solo se guarda un hash (si lo pierdes, anúlalo y crea otro). La página del paciente **no muestra su nombre** ni datos de la ficha, limita intentos por IP y queda registrada en la auditoría como *paciente (enlace)*.
- **Seguridad clínica del enlace**: la página avisa siempre que el cuestionario **no se revisa de inmediato** y da la Línea 113 opción 5 y el 106. Si el PHQ-9 llega con el **ítem 9 positivo**, el paciente ve los recursos de crisis y, en tu sistema, se activa el mismo aviso del bloque 5 (panel *Pacientes con alerta de riesgo* en Hoy). **El aviso aparece cuando abres el sistema; no te llama ni te escribe.** Por eso el enlace no debe usarse como canal de emergencia.
- **Para que el paciente pueda abrir el enlace** el sistema tiene que ser alcanzable desde internet con HTTPS: mira **la opción C de `docs/DESPLIEGUE.md`** (expone solo la página del paciente, no el sistema) y registra la dirección en ⚙ Ajustes (*Dirección pública*). Mientras uses solo `localhost`, el enlace funciona únicamente en este equipo (el sistema te lo avisa).
- Pruebas: `npm test` (31 pruebas, incluye tareas clínicas, gastos, devoluciones y exportación iCalendar) y `python tests/e2e_medicion.py` (navegador real, el paciente en un celular simulado; capturas `docs/pruebas/22` a `27`).

## Tareas clínicas
- **Seguimiento entre sesiones**: crea tareas privadas vinculadas a cada paciente, define prioridad y fecha límite, y actualiza su estado desde la ficha o el módulo *Tareas*. *Hoy* muestra tareas vencidas y las que vencen hoy. Solo administración y profesionales pueden consultarlas; al borrar un paciente, pasan a la papelera junto con el resto de su historia.

## Exportar la agenda
- Desde *Agenda → Calendario*, descarga las citas programadas en un archivo `.ics` compatible con calendarios comunes. Puedes elegir el rango y añadir un recordatorio; los eventos usan un título genérico y no incluyen nombres, notas clínicas ni enlaces privados.

## Gastos del consultorio
- Módulo privado para administración: registra egresos por categoría, proveedor, método, comprobante y estado pagado/pendiente. Incluye filtros, exportación CSV, gastos por categoría y un neto estimado (cobros registrados menos gastos pagados). No sustituye la contabilidad ni la facturación tributaria.

## Reportes operativos
- *Reportes → Asistencia* resume citas atendidas, canceladas y no asistidas por tipo en un intervalo. *Sin próxima cita* identifica pacientes con tratamiento activo sin una cita futura y permite programar una desde la lista.
- *Derivaciones* agrupa pacientes por el campo “Derivado por”, compara activos/altas/abandono, filtra por fecha de registro y exporta solo totales agregados (sin nombres ni notas clínicas). Disponible para administración y profesionales.

**Importante sobre las escalas y los umbrales:** PHQ-9, GAD-7, PCL-5 y Rosenberg son de uso libre; **ORS y SRS** (S. Miller / B. Duncan) son gratuitas para clínicos individuales con licencia: revisa sus términos en scottdmiller.com. La redacción de los ítems de todas es una adaptación mía: si tienes las versiones oficiales en español, reemplaza los textos en `escalas.js` sin cambiar el orden ni la cantidad. Los umbrales de cambio y de corte son valores de referencia habituales; están en `CFG` de `medicion-logica.js` y conviene que los revises con tu criterio y protocolo.

