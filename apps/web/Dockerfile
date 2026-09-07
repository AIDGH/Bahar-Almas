FROM node:24-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV API_BASE_URL="http://api:4002/api/v1"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @bahar-almas/web...

COPY apps/web apps/web
RUN pnpm --filter @bahar-almas/web build

WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

EXPOSE 3002

CMD ["pnpm", "start"]
