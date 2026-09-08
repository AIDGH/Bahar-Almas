ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE}

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @bahar-almas/api...

COPY apps/api apps/api
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN pnpm --filter @bahar-almas/api build

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=4002

EXPOSE 4002

CMD ["node", "dist/main.js"]
