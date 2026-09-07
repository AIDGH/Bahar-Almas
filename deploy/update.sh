#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/bahar-almas"
STATE_DIR="/var/lib/bahar-almas"
STATE_FILE="${STATE_DIR}/deployed-sha"
LOCK_FILE="/var/lock/bahar-almas-deploy.lock"

mkdir -p "${STATE_DIR}"
cd "${APP_DIR}"

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  exit 0
fi

git fetch origin main --quiet
remote_sha="$(git rev-parse origin/main)"
deployed_sha="$(cat "${STATE_FILE}" 2>/dev/null || true)"

if [[ "${remote_sha}" == "${deployed_sha}" ]] && curl --fail --silent --show-error http://127.0.0.1/api/v1/health >/dev/null; then
  exit 0
fi

git merge --ff-only origin/main

compose=(
  docker compose
  --env-file "${APP_DIR}/.env"
  --file "${APP_DIR}/deploy/compose.prod.yml"
)

"${compose[@]}" build --pull
"${compose[@]}" run --rm migrate
"${compose[@]}" up --detach --remove-orphans

healthy=0
for _ in {1..45}; do
  if curl --fail --silent --show-error http://127.0.0.1/api/v1/health >/dev/null; then
    healthy=1
    break
  fi
  sleep 2
done

if [[ "${healthy}" -ne 1 ]]; then
  "${compose[@]}" ps
  exit 1
fi

printf '%s\n' "${remote_sha}" >"${STATE_FILE}"
docker image prune --force --filter "until=168h" >/dev/null
"${compose[@]}" ps
