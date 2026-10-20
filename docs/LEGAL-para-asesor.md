# Dossier para tu asesor legal (consentimiento y datos de salud)

> No soy abogado y **no puedo certificar el cumplimiento legal**. Esto es un resumen técnico de lo que hace el sistema y una lista de preguntas concretas para que un asesor las responda. Las referencias normativas deben ser verificadas por él.

## 1. Qué hace hoy el sistema (hechos técnicos)
- Registra datos de salud, incluida salud mental, y datos de contacto (datos sensibles según la Ley N.º 29733, como indica el propio texto del consentimiento).
- Guarda por paciente un consentimiento con: texto (versión `v1`), nombre del firmante, relación (paciente/representante), fecha, firma manuscrita digital (imagen PNG) y marca de tiempo del servidor.
- Auditoría de accesos y cambios con usuario real, hora e IP; sin contenido clínico.
- Datos cifrados en base y respaldos; roles de acceso (recepción sin acceso clínico).
- Papelera: lo eliminado se conserva cifrado en el servidor (no se destruye de inmediato).
- Los datos viven en el equipo del consultorio (o en el servidor que elijas); no se envían a terceros. El recordatorio por WhatsApp abre WhatsApp con el texto y lo envía la persona.

## 2. Texto actual del consentimiento (modelo)
"Declaro haber sido informado/a de forma clara sobre la evaluación y el tratamiento terapéutico propuesto, sus beneficios y posibles molestias, y autorizo su realización. Autorizo además, de manera previa, libre, expresa, informada e inequívoca, el tratamiento de mis datos personales y de salud (datos sensibles) para mi atención, seguimiento y registro en mi historia clínica, conforme a la Ley N.º 29733. Puedo ejercer mis derechos de acceso, rectificación, cancelación y oposición solicitándolo al consultorio."

## 3. Preguntas para el asesor
**Consentimiento**
1. ¿El texto es suficiente para tratamiento psicológico y para datos sensibles? ¿Debe indicar responsable del tratamiento, finalidad específica, plazo de conservación, transferencias (p. ej. proveedor de hosting o respaldo en la nube) y canal concreto para derechos ARCO?
2. ¿Es válida la firma manuscrita digital sobre pantalla como evidencia? ¿Conviene guardar además hora/dispositivo o entregar copia al paciente?
3. Menores de edad, personas con representante legal y terapia de pareja/familia: ¿qué consentimiento(s) y de quién se necesitan? (hoy el sistema solo permite un firmante por registro).
4. Teleconsulta (sesiones virtuales por Meet/Zoom): ¿requiere un consentimiento específico y qué condiciones de privacidad?
5. Límites de la confidencialidad (riesgo suicida/daño a terceros, requerimiento judicial): ¿deben figurar en el consentimiento?

**Datos personales**
6. ¿El consultorio debe inscribir su banco de datos de salud ante la Autoridad Nacional de Protección de Datos Personales? ¿Qué medidas de seguridad y documento de seguridad exige el reglamento vigente para datos sensibles?
7. ¿Es aceptable el servidor local con las medidas descritas en `SEGURIDAD.md`? ¿Hay requisitos sobre dónde se almacenan los respaldos (ubicación, proveedor)?
8. Plazo de conservación de historias clínicas y qué hacer al vencimiento (hoy el sistema no destruye nada automáticamente).
9. Procedimiento ante un incidente (pérdida/robo de equipo o respaldo): ¿hay obligación de notificar?

**Riesgo suicida (bloque 5)**
- El plan de seguridad guarda nombres y teléfonos de terceros (familiares, amigos) y la entrevista de riesgo guarda datos sensibles. ¿Hace falta informarlo o recabar consentimiento específico del paciente (y de esos terceros)?
- Contactar a un familiar o derivar a urgencias sin consentimiento cuando hay riesgo inminente: ¿qué respalda legal y deontológicamente al profesional, y debe constar en el consentimiento informado?
- Conservación de las evaluaciones de riesgo y del plan dentro de la historia clínica (mismos plazos que el resto).

**Cuestionarios por enlace (bloque 6)**
- El paciente responde escalas clínicas (PHQ-9, GAD-7, PCL-5…) desde su celular, por un enlace personal de un solo uso que se envía por WhatsApp (el mensaje contiene el enlace, no datos clínicos). ¿Basta el consentimiento informado actual o debe mencionar expresamente este canal, la finalidad y el uso de un proveedor de internet/proxy en la ruta de los datos?
- Si las respuestas pasan por un servicio de terceros (dominio, proxy, hosting) ¿se considera transferencia o encargo de tratamiento? ¿Debe firmarse un contrato o cláusulas con ese proveedor, y importa si está fuera del Perú?
- El enlace funciona sin cuenta ni verificación de identidad (quien tenga el enlace puede responder, una sola vez). ¿Es una medida de seguridad suficiente para datos de salud, o conviene un segundo factor (p. ej. DNI o fecha de nacimiento)?
- Un paciente puede responder fuera de sesión que tiene ideas de hacerse daño y el profesional no verlo hasta abrir el sistema. ¿Qué advertencias o límites del servicio debe contener el consentimiento y la propia página para delimitar la responsabilidad del profesional?
- Las escalas ORS y SRS tienen licencia de uso (gratuita para clínicos individuales con registro). Verificar que el uso del consultorio cumpla sus términos.

**Historia clínica electrónica / RENHICE**
10. Según lo que pude verificar: el Reglamento de la Ley N.º 30024 (art. 27) indica que los establecimientos de salud o servicios médicos de apoyo, públicos, privados o mixtos, que usan historias manuscritas deben implementar **progresivamente** la historia clínica electrónica, siguiendo los estándares de acreditación de sistemas ante el RENHICE; el MINSA regula esa acreditación (R.M. N.º 164-2025/MINSA) y el reglamento fue modificado por D.S. N.º 020-2025-SA. **Pregunta:** ¿tu consultorio (por su tipo y registro como IPRESS o servicio médico de apoyo, o profesional independiente) está obligado a usar un sistema acreditado y/o a interoperar con el RENHICE? ¿Desde cuándo y con qué plazos?
11. Si lo está: ¿esta herramienta debe pasar por acreditación, o conviene usar un sistema ya acreditado? (Esto influiría en una eventual exportación de historias en un formato estándar.)
12. Firma y validez de la historia clínica electrónica (¿firma digital del profesional?), y registro profesional/Colegio de Psicólogos: ¿alguna exigencia deontológica sobre registros digitales?

## 4. Ajustes que haré cuando tu asesor responda
Actualizar el texto (versionado: los consentimientos firmados guardan la versión que se firmó), añadir firmantes múltiples, política de conservación y borrado, y lo que indique sobre RENHICE.
