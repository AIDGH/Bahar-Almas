FROM node:24-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @bahar-almas/api...

COPY apps/api apps/api
RUN pnpm --filter @bahar-almas/api build

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=4002

EXPOSE 4002

CMD ["node", "dist/main.js"]
