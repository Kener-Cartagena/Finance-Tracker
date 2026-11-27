# syntax=docker/dockerfile:1

# ── Build: compila la SPA con Vite ──
FROM node:26-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Vacío = la SPA llama a /api en su mismo origen y nginx lo reenvía al backend.
# Pasa una URL absoluta (--build-arg VITE_API_URL=https://api.ejemplo.com) si el
# backend vive en otro dominio.
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build


# ── Runtime: nginx sirve los estáticos y hace proxy al backend ──
FROM nginx:1.27-alpine

ENV BACKEND_URL=http://backend:8000

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
