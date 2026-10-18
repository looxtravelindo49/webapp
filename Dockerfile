# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 membawa binary prebuilt di dalam paketnya. npm 10 (bawaan Node 22) tetap
# memanggil node-gyp bila ada binding.gyp, jadi skrip install dimatikan.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/app.db \
    BODY_SIZE_LIMIT=8M
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
# BODY_SIZE_LIMIT: bawaan adapter-node 512 KB menolak unggahan foto (maks. 5 MB + overhead multipart).
# Foto unggahan disimpan di /data/uploads (UPLOAD_DIR bawaan) dan ikut volume.
# Direktori data dimiliki user non-root; volume baru mewarisi kepemilikan ini.
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "build"]
