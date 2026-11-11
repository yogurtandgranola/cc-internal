#!/usr/bin/env bash
# Browser test of real sign-in and the People and access screen. Starts a throwaway Postgres, a stand-in for Supabase Auth, and the app.
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || { echo "Postgres server binaries not found. Set PGBIN or install postgresql."; exit 2; }
ROOT="$(pwd)"; WORK="$(mktemp -d)"; PORT="${PGTEST_PORT:-54331}"
RUN=()
if [ "$(id -u)" = "0" ]; then chown postgres "$WORK"; chmod -R a+rX "$ROOT/supabase" "$ROOT/tests"; RUN=(su postgres -s /bin/bash -c); fi
run() { if [ ${#RUN[@]} -gt 0 ]; then "${RUN[@]}" "$*"; else bash -c "$*"; fi; }
cleanup() { run "$PGBIN/pg_ctl -D $WORK/data stop -m immediate >/dev/null 2>&1 || true"; rm -rf "$WORK"; }
trap cleanup EXIT
run "$PGBIN/initdb -D $WORK/data -A trust -U postgres >/dev/null"
run "$PGBIN/pg_ctl -D $WORK/data -o '-p $PORT -k $WORK -c listen_addresses=' -w start >/dev/null"
run "$PGBIN/psql -h $WORK -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f $ROOT/tests/db/shim.sql" >/dev/null
export LIVE_E2E_DB_URL="postgresql://postgres@localhost:$PORT/postgres?host=$WORK"
node "$ROOT/tests/db/migrate-only.mjs" "$LIVE_E2E_DB_URL"
npx playwright test -c playwright.live.config.ts --trace off "$@"
