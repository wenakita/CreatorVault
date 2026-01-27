FROM node:20-bookworm-slim

# Native deps for some Node modules (bufferutil, etc.)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/
COPY frontend/ frontend/

RUN pnpm -C frontend install

ENV NODE_ENV=production

# Long-lived XMTP agent runtime
WORKDIR /app/frontend
CMD ["pnpm", "tsx", "server/keepr/runtime.ts"]

