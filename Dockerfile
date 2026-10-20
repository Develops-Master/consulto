# Servidor del Consultorio ERP (Node >= 22.13, sin dependencias). Los datos viven en el volumen /data.
FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY index.html responder.html ./
COPY css ./css
COPY js ./js
COPY vendor ./vendor
COPY tools ./tools
ENV NODE_ENV=production \
    PORT=8080 HOST=0.0.0.0 \
    ERP_SIN_LOGIN=0 ERP_TRUST_PROXY=1 COOKIE_SECURE=1 \
    ERP_DATA_DIR=/data TZ=America/Lima
VOLUME /data
EXPOSE 8080
CMD ["node", "--disable-warning=ExperimentalWarning", "server/server.js"]
