#!/usr/bin/env bash
# Runs the RLS test against a throwaway local Postgres (no Docker needed).
# Usage: bash supabase/tests/run_local.sh   (PG_BIN overrides the Postgres bin folder)
set -euo pipefail

PG_BIN="${PG_BIN:-/c/Program Files/PostgreSQL/17/bin}"
PORT="${PORT:-54329}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATA="$(mktemp -d)"
export PGCLIENTENCODING=UTF8

cleanup() { "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

"$PG_BIN/initdb" -D "$DATA" -U postgres -A trust -E UTF8 >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT" -l "$DATA/pg.log" -w start >/dev/null </dev/null

psql() { "$PG_BIN/psql" -h localhost -p "$PORT" -U postgres "$@"; }
psql -q -c "create database rls"
psql -d rls -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/00_stubs_local.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  psql -d rls -q -v ON_ERROR_STOP=1 -f "$f"
done
psql -d rls -f "$ROOT/supabase/tests/01_rls_test.sql"

echo "===== 02_features_test.sql"
OUT="$(psql -d rls -f "$ROOT/supabase/tests/02_features_test.sql" 2>&1)"
echo "$OUT" | grep -E "^(ok|FAIL):" || true
echo "$OUT" | grep -iE "ERROR|FATAL" | grep -v "should have errored" || true
if echo "$OUT" | grep -q "^FAIL:"; then echo "TESTES DE FUNCIONALIDADES FALHARAM"; exit 1; fi
echo "Todos os testes de funcionalidades passaram: $(echo "$OUT" | grep -c '^ok:')"

echo "===== 03_partners_test.sql"
OUT="$(psql -d rls -f "$ROOT/supabase/tests/03_partners_test.sql" 2>&1)"
echo "$OUT" | grep -E "^(ok|FAIL):" || true
echo "$OUT" | grep -iE "ERROR|FATAL" | grep -v "should have errored" || true
if echo "$OUT" | grep -q "^FAIL:"; then echo "TESTES DE CORRETORES FALHARAM"; exit 1; fi
echo "Todos os testes de corretores passaram: $(echo "$OUT" | grep -c '^ok:')"
