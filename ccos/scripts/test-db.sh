#!/usr/bin/env bash
# Runs the RLS test suite against a throwaway local Postgres. Needs Postgres server binaries (any 15+).
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || { echo "Postgres server binaries not found. Set PGBIN or install postgresql."; exit 2; }
ROOT="$(pwd)"
WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
RUN=()
if [ "$(id -u)" = "0" ]; then chown postgres "$WORK"; chmod -R a+rX "$ROOT/supabase" "$ROOT/tests"; RUN=(su postgres -s /bin/bash -c); fi
run() { if [ ${#RUN[@]} -gt 0 ]; then "${RUN[@]}" "$*"; else bash -c "$*"; fi; }
cleanup() { run "$PGBIN/pg_ctl -D $WORK/data stop -m immediate >/dev/null 2>&1 || true"; rm -rf "$WORK"; }
trap cleanup EXIT
run "$PGBIN/initdb -D $WORK/data -A trust -U postgres >/dev/null"
run "$PGBIN/pg_ctl -D $WORK/data -o '-p $PORT -k $WORK -c listen_addresses=' -w start >/dev/null"
psqlf() { run "$PGBIN/psql -h $WORK -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f $1 >/dev/null"; }
psqlf "$ROOT/tests/db/shim.sql"
psqlf "$ROOT/supabase/migrations/0001_schema.sql"
psqlf "$ROOT/supabase/migrations/0002_rls.sql"
psqlf "$ROOT/supabase/seed_roles.sql"
psqlf "$ROOT/tests/db/fixture.sql"
psqlf "$ROOT/tests/db/rls.test.sql" 2>&1 | sed -E "s/^psql:[^ ]+ NOTICE:  //" | grep -v "^$"

# The migration runner used by the Vercel build: apply to a fresh database, then repeat safely.
run "$PGBIN/psql -h $WORK -p $PORT -U postgres -d postgres -q -c 'create database migtest'" >/dev/null
# Roles belong to the whole cluster and already exist from the first database, so the second shim skips them.
sed '/^create role/d' "$ROOT/tests/db/shim.sql" > "$WORK/shim2.sql"; chmod a+r "$WORK/shim2.sql"
run "$PGBIN/psql -h $WORK -p $PORT -U postgres -d migtest -v ON_ERROR_STOP=1 -q -f $WORK/shim2.sql" >/dev/null
node "$ROOT/tests/db/migrate-check.mjs" "postgresql://postgres@localhost:$PORT/migtest?host=$WORK"

# People and permissions, end to end on a real database (first owner, adding people, every safety rule).
run "$PGBIN/psql -h $WORK -p $PORT -U postgres -d postgres -q -c 'create database admintest'" >/dev/null
run "$PGBIN/psql -h $WORK -p $PORT -U postgres -d admintest -v ON_ERROR_STOP=1 -q -f $WORK/shim2.sql" >/dev/null
node "$ROOT/tests/db/migrate-only.mjs" "postgresql://postgres@localhost:$PORT/admintest?host=$WORK"
CCOS_TEST_DB_URL="postgresql://postgres@localhost:$PORT/admintest?host=$WORK" npx vitest run tests/live-admin.db.test.ts
