# Despliegue y operación

## Opción A (recomendada para empezar): un solo equipo
El servidor escucha solo en `127.0.0.1` (únicamente ese equipo puede entrar). Ejecuta `iniciar.bat` al abrir el consultorio.

## Opción B: usar desde otros equipos / celulares de la red
El tráfico contiene datos de salud: **no uses HTTP plano en la red**. Pon un proxy con HTTPS delante. Ejemplo con Caddy (certificado automático si tienes dominio, o `tls internal` en red local):

```
consultorio.tudominio.pe {
    reverse_proxy 127.0.0.1:3000
}
```
y arranca el servidor con:  `ERP_SIN_LOGIN=0 ERP_TRUST_PROXY=1 COOKIE_SECURE=1 node --disable-warning=ExperimentalWarning server/server.js`. `ERP_SIN_LOGIN=0` es obligatorio al publicarlo: activa la autenticación y el asistente para crear la cuenta administradora.
(el servidor sigue en 127.0.0.1; solo el proxy es público). Si lo expones a internet, añade además firewall y actualizaciones al sistema operativo.

## Opción C (recomendada para cuestionarios por enlace): exponer SOLO la página del paciente
Para que un paciente abra el enlace desde su celular, la dirección tiene que ser pública y con HTTPS. **No hace falta (ni conviene) publicar todo el sistema**: el proxy puede dejar pasar solo lo que necesita la página del paciente y devolver 404 a lo demás. Tú sigues usando el sistema en `http://localhost:3000`.
Ejemplo con Caddy (no lo pude probar aquí; revísalo con quien administre tu equipo):

```
consultorio.tudominio.pe {
    @paciente path /r/* /api/portal/* /css/* /js/responder.js
    handle @paciente {
        reverse_proxy 127.0.0.1:3000
    }
    respond 404
}
```
Arranca el servidor con `ERP_TRUST_PROXY=1` (para que el límite de intentos use la IP real del paciente y no la del proxy) y escribe `https://consultorio.tudominio.pe` en ⚙ Ajustes → *Dirección pública del sistema*. El sistema solo acepta direcciones `https://` (o `localhost`).
Notas: el equipo debe estar encendido y con internet cuando el paciente responda; el enlace vence solo (3, 7 o 14 días) y se puede anular desde la ficha. Si publicas el sistema completo (opción B) el portal funciona igual, pero entonces el inicio de sesión queda expuesto a internet.

## Variables de entorno (todas opcionales)
| Variable | Para qué |
|---|---|
| `PORT`, `HOST` | Puerto (3000) y dirección (127.0.0.1) |
| `ERP_DATA_DIR` | Carpeta de datos (por defecto `./data`) |
| `ERP_BACKUP_DIR2` | **Carpeta extra de respaldos** (USB, carpeta sincronizada de OneDrive/Drive/Dropbox). Los archivos van cifrados |
| `ERP_BACKUP_PASS` | Frase de respaldo (si no, usa la de `data/config.json`) |
| `ERP_DATA_KEY` | Clave de datos de 64 hex; si no se define se usa `data/clave.key`. Si la defines por entorno, no queda en el disco junto a la base |
| `ERP_IDLE_MIN` | Minutos de inactividad antes de cerrar sesión (30) |
| `ERP_TRUST_PROXY`, `COOKIE_SECURE` | Detrás de proxy HTTPS |

## Qué hay en `data/`
`erp.db` (base, campos clínicos cifrados) · `clave.key` (clave de datos) · `config.json` (frase de respaldo) · `respaldos/` (archivos `.cerp`).
**Importante:** `erp.db` sin `clave.key` es ilegible, y viceversa. Cada respaldo `.cerp` ya incluye la clave, protegida por tu frase.

## Respaldos
Automáticos: al iniciar, cada 4 h si hubo cambios, y al cerrar con Ctrl+C. Conserva: todo de 3 días, uno por día hasta 30 días, uno por mes hasta 12 meses.
**Un respaldo solo en el mismo equipo no te protege si el equipo se pierde**: configura `ERP_BACKUP_DIR2` o copia periódicamente la carpeta `data/respaldos/` a un USB que guardes fuera del consultorio. Recomendación: una vez al mes, prueba restaurar en otra carpeta.

## Restaurar (servidor detenido)
```
node --disable-warning=ExperimentalWarning tools/restaurar.js ruta/respaldo-AAAAMMDD-HHMMSS.cerp
```
Pide la frase. Lo actual se mueve a `data/anterior-<fecha>/` (no se borra). Al terminar verifica que todo descifra y que la auditoría es íntegra. En un equipo nuevo: instala Node, copia la carpeta del programa, ejecuta el comando anterior.

## Olvidé la contraseña de administrador
En el equipo del servidor: `node --disable-warning=ExperimentalWarning tools/reset-clave.js nombre_de_usuario` (genera una temporal y deja constancia en la auditoría).

## Recuperar algo eliminado
Los borrados se guardan cifrados en la tabla `papelera` de la base. Hoy no hay pantalla para recuperar; se hace con ayuda técnica (pendiente de incluir en un próximo bloque).
