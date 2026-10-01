# The API runs its TypeScript directly through tsx: there is nothing to
# publish, so a compile step would exist only to satisfy Docker.
FROM node:22-alpine

RUN corepack enable

ENV TZ=Europe/Rome
ENV NODE_ENV=production

WORKDIR /app

# Manifests first, so a source change does not reinstall dependencies. The
# frontend's manifest too: the lockfile names it, but nothing of it is installed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --prod --filter @gymlog/backend

COPY --chown=node:node backend/tsconfig.json backend/
COPY --chown=node:node backend/src backend/src

USER node
WORKDIR /app/backend

CMD ["node_modules/.bin/tsx", "src/main.ts"]
