# Publicar para que la web FUNCIONE (un solo sitio, sin Netlify)

El proyecto completo corre en un solo servidor: ese servidor entrega `index.html` (raíz) **y** atiende el login y los datos.
Netlify NO sirve aquí (no ejecuta Node ni guarda datos), por eso salía "No hay conexión con el servidor".

## Fly.io (usa el Dockerfile y fly.toml que ya vienen)
Requiere cuenta en fly.io (pide tarjeta) y `flyctl` instalado. Desde esta carpeta:

```bash
fly auth login
fly launch --no-deploy --copy-config        # si el nombre "consultorio-erp" ya existe, elige otro
fly volumes create erp_data --size 1 --region gru
fly secrets set ERP_DATA_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
                ERP_BACKUP_PASS="una-frase-larga-que-no-olvidaras"
fly deploy
fly open                                      # abre https://TU-APP.fly.dev
```
1. Se abre el asistente: crea el administrador (usa la MISMA frase que `ERP_BACKUP_PASS`).
2. En ⚙ Ajustes → "Dirección pública del sistema": `https://TU-APP.fly.dev`.
3. Guarda `ERP_DATA_KEY` y la frase en un gestor de contraseñas: sin ellas no se restauran los datos.
4. Verifica: `https://TU-APP.fly.dev/api/estado` responde JSON con `"sinLogin": false`.

No escales a más de 1 máquina (SQLite). Descarga respaldos periódicamente desde Respaldo.

## Local (solo tu computadora)
Mac: doble clic en `iniciar.command` · Windows: `iniciar.bat` · o `npm start` → http://localhost:3000
