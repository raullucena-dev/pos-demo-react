# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Unprivileged nginx: runs as a non-root user and listens on a high port.
FROM nginxinc/nginx-unprivileged:1.27-alpine
ENV PORT=8080 \
    API_UPSTREAM=http://api:8000 \
    NGINX_ENVSUBST_FILTER="^(PORT|API_UPSTREAM)$"
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1
