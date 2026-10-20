# Despliegue con Netlify

**Importante:** Netlify solo aloja sitios estáticos y funciones sin estado. Este sistema tiene un servidor Node con base SQLite y archivos en disco, que **no puede correr en Netlify**. La solución:

```
Navegador ──► Netlify (raíz del proyecto + proxy /api/*) ──► Servidor Node (Docker + disco persistente)
```

El navegador ve un único dominio (`https://tu-sitio.netlify.app`), así que las cookies `SameSite=Strict` y la protección CSRF siguen funcionando.

## 1. Servidor (ejemplo con Fly.io; sirve cualquier host con Docker y disco persistente)
```bash
fly launch --no-deploy --copy-config          # usa fly.toml; cambia el nombre si ya existe
fly volumes create erp_data --size 1 --region gru
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # genera ERP_DATA_KEY
fly secrets set ERP_DATA_KEY=<la_clave_de_64_hex> \
                ERP_BACKUP_PASS="<frase_de_respaldo_larga>" \
                ERP_ALLOWED_ORIGINS=https://tu-sitio.netlify.app
fly deploy
```
- **Guarda `ERP_DATA_KEY` y la frase fuera del servidor** (gestor de contraseñas). Sin ellas no se pueden restaurar los datos. Con `ERP_DATA_KEY` como secreto, la clave ya no queda junto a la base en el disco.
- Al crear la cuenta de administrador, escribe **la misma frase** que pusiste en `ERP_BACKUP_PASS`.
- Si usas un dominio propio en Netlify, agrégalo también a `ERP_ALLOWED_ORIGINS` (separados por coma).
- Los respaldos se guardan en el mismo volumen: **descárgalos periódicamente** desde Respaldo (admin) y guárdalos en otro lugar.

## 2. Netlify
1. Edita `netlify.toml`: cambia `https://consultorio-erp.fly.dev` por la dirección real de tu servidor.
2. Sube el proyecto a GitHub (el `.gitignore` ya excluye `data/`) y en Netlify: *Add new site → Import from Git*. No necesita comando de build; el directorio de publicación (`public`) ya está en `netlify.toml`. Alternativa: `npx netlify-cli deploy --prod` (arrastrar solo la carpeta `public` **no** aplica las redirecciones).
3. Abre `https://tu-sitio.netlify.app`: el asistente pide crear el administrador.
4. En ⚙ Ajustes → *Dirección pública del sistema* escribe `https://tu-sitio.netlify.app` (para los enlaces de cuestionarios de pacientes).

## 3. Verificación
- `https://tu-sitio.netlify.app/api/estado` debe responder JSON con `"sinLogin": false`.
- Inicia sesión, crea un paciente y recarga: los datos deben persistir. Reinicia la máquina (`fly machine restart`) y confirma que siguen.

## Límites y avisos
- **Datos de salud en la nube:** el servidor queda accesible desde internet (la dirección `*.fly.dev` también responde directamente). La defensa es el login, el bloqueo por intentos y HTTPS; no hay 2FA. Revisa `docs/LEGAL-para-asesor.md` (Ley 29733) antes de cargar pacientes reales.
- El proxy de Netlify tiene un tiempo máximo de espera (~26 s): suficiente para el uso normal, pero no para respaldos o importaciones muy grandes (esos hazlos directamente contra la dirección del servidor).
- Una sola instancia: no escales a varias máquinas (SQLite).
- Para probar localmente todo sigue igual: `iniciar.command` / `iniciar.bat` o `npm start`.


## Estructura
`index.html`, `responder.html`, `css/`, `js/` y `vendor/` están en la **raíz** del proyecto. El servidor solo entrega esos archivos (no `server/`, `data/` ni `tests/`). `netlify.toml` publica la raíz y `_redirects` oculta el código interno.
