# The front: the Svelte PWA, built here with Vite, served by nginx, which also
# passes /api to the API container.

# --- Build: the Svelte app ----------------------------------------------------------
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter frontend

COPY frontend frontend
RUN pnpm --filter frontend build

# --- Serve -------------------------------------------------------------------------
FROM nginx:1.27-alpine
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/web/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/frontend/dist/ /usr/share/nginx/html/
