#!/bin/bash
# Arranque para Mac y Linux. Si no hay Node 22.13+, descarga una copia local en .node/ (sin instalar nada ni pedir contraseña).
cd "$(dirname "$0")" || exit 1
set -o pipefail

NODE_VER="22.14.0"
SO="$(uname -s)"

# Mac: quitar el bloqueo de "archivo descargado de internet" y asegurar permisos
[ "$SO" = "Darwin" ] && xattr -dr com.apple.quarantine . 2>/dev/null
chmod +x iniciar.sh iniciar.command 2>/dev/null

version_ok() { "$1" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' >/dev/null 2>&1; }

NODE=""
for c in "./.node/bin/node" "$(command -v node 2>/dev/null)" "/opt/homebrew/bin/node" "/usr/local/bin/node"; do
  [ -n "$c" ] && [ -x "$c" ] && version_ok "$c" && { NODE="$c"; break; }
done

if [ -z "$NODE" ]; then
  echo "Se necesita Node.js 22.13 o superior. Descargando una copia local (~45 MB, solo para esta carpeta)..."
  case "$SO" in Darwin) P=darwin;; *) P=linux;; esac
  case "$(uname -m)" in arm64|aarch64) A=arm64;; *) A=x64;; esac
  rm -rf .node && mkdir -p .node
  if curl -fL --progress-bar "https://nodejs.org/dist/v$NODE_VER/node-v$NODE_VER-$P-$A.tar.gz" | tar -xz --strip-components=1 -C .node && version_ok ./.node/bin/node; then
    NODE="./.node/bin/node"
  else
    rm -rf .node
    echo ""
    echo "No se pudo descargar Node.js. Revisa tu conexión a internet o instálalo desde https://nodejs.org (versión LTS) y vuelve a abrir este archivo."
    read -r -p "Presiona Enter para cerrar..." _
    exit 1
  fi
fi

# Puerto: 3000 o el primero libre hasta 3010
P0="${PORT:-3000}"
PORT=$("$NODE" -e '
const net=require("net");let p=+process.argv[1];const max=p+10;
(function probar(){const s=net.createServer();s.once("error",()=>{if(++p>max){console.log(process.argv[1]);return}probar()});
s.once("listening",()=>s.close(()=>console.log(p)));s.listen(p,"127.0.0.1")})();' "$P0" 2>/dev/null)
PORT="${PORT:-$P0}"
[ "$PORT" != "$P0" ] && echo "El puerto $P0 está ocupado; usando $PORT."
export PORT

# Abrir el navegador
if [ "$SO" = "Darwin" ]; then ( sleep 2; open "http://localhost:$PORT" ) &
elif command -v xdg-open >/dev/null 2>&1; then ( sleep 2; xdg-open "http://localhost:$PORT" >/dev/null 2>&1 ) &
fi

echo "Consultorio ERP en http://localhost:$PORT  (Ctrl+C para cerrar)"
exec "$NODE" --disable-warning=ExperimentalWarning server/server.js
