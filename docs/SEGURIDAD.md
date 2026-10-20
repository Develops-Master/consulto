# Seguridad: qué está implementado y qué NO

## Implementado y comprobado con pruebas automáticas (`npm test`, 31 pruebas)
- Contraseñas con scrypt y sal individual; política mínima (10 caracteres, letras y números, sin el nombre de usuario).
- Bloqueo de cuenta 15 min tras 5 fallos; límite por IP; mismo mensaje exista o no el usuario.
- Sesión por cookie `HttpOnly` + `SameSite=Strict`; cierre por inactividad (30 min) y máximo 12 h; cambio de clave cierra otras sesiones.
- Protección anti-CSRF (encabezado propio + verificación de Origin); cabeceras CSP, X-Frame-Options, nosniff.
- Roles aplicados **en el servidor** (`server/permisos.js`): aunque alguien llame a la API directamente, recepción no recibe ni puede escribir datos clínicos.
- Datos clínicos y nombres en auditoría cifrados en la base con AES-256-GCM (cada registro atado a su identificador).
- Auditoría escrita por el servidor, solo-agregar (triggers que bloquean UPDATE/DELETE) y encadenada con HMAC; detecta ediciones, huecos y borrado de los últimos eventos. No guarda contenido clínico.
- Respaldos cifrados con frase (scrypt + AES-256-GCM), restauración verificada.
- Borrados a papelera; solo administrador borra pacientes y cobros.

## Limitaciones conocidas (honestas)
1. **Quien tenga acceso de administrador al equipo del servidor y a `data/clave.key` puede leer todo.** El cifrado protege contra robo del archivo `erp.db` o de un respaldo, no contra quien controla el servidor en ejecución.
2. **La auditoría de "consultar paciente" la informa el navegador** (el servidor entrega todos los datos permitidos al iniciar sesión y lo registra como "cargar datos"). Un usuario técnico malintencionado podría leer sin generar el evento por paciente. Solución prevista: carga por paciente desde el servidor.
3. La cadena de auditoría detecta manipulación, pero un atacante que además tenga la clave y una copia antigua de la base podría reponer una versión previa completa. Para eso sirve compararla con los respaldos.
4. `script-src-attr 'unsafe-inline'` en la CSP: los botones usan `onclick` en línea. Bloquea scripts inyectados, pero habría que migrar a eventos delegados para endurecerlo más.
5. Sin autenticación en dos pasos (2FA). Sin HTTPS propio: depende del proxy de `DESPLIEGUE.md`.
6. El módulo `node:sqlite` de Node figura como "experimental"; funciona de forma estable en las pruebas, pero conviene revisarlo en cada actualización mayor de Node.
7. Edición simultánea: gana la última escritura por campo (suficiente para un consultorio pequeño; no hay control de versiones por registro).
8. **Portal del paciente (bloque 6):** el enlace es la única credencial (32 caracteres aleatorios, de un solo uso, con vencimiento; se guarda solo su hash). Quien tenga el enlace puede responder una vez; no hay verificación de identidad adicional. La ruta es pública, por lo que se limita a 60 consultas por IP cada 10 minutos (los enlaces inválidos cuentan más) y no revela datos del paciente. Detrás de un proxy, usa `ERP_TRUST_PROXY=1` o el límite se aplicará a la IP del proxy.
9. **Avisos solo dentro del sistema:** una respuesta con ideación (PHQ-9 ítem 9) genera el aviso de riesgo cuando abres el sistema; no hay notificación por correo ni WhatsApp.
