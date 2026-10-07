#!/usr/bin/env bash
# Local development PostgreSQL cluster owned by the current user (no sudo needed).
# Data lives in ./.devdb (gitignored). Production uses DATABASE_URL instead.
set -euo pipefail

PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA_DIR="$(cd "$(dirname "$0")/.." && pwd)/.devdb"
PORT="${DEV_DB_PORT:-54329}"
DB_NAME="almanac"

case "${1:-start}" in
  start)
    if [ ! -d "$DATA_DIR" ]; then
      "$PG_BIN/initdb" -D "$DATA_DIR" -U postgres --auth=trust >/dev/null
    fi
    if ! "$PG_BIN/pg_ctl" -D "$DATA_DIR" status >/dev/null 2>&1; then
      "$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$DATA_DIR/server.log" \
        -o "-p $PORT -k /tmp -c listen_addresses=localhost" start >/dev/null
    fi
    for db in "$DB_NAME" "${DB_NAME}_test"; do
      "$PG_BIN/psql" -h localhost -p "$PORT" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 \
        || "$PG_BIN/createdb" -h localhost -p "$PORT" -U postgres "$db"
    done
    echo "Dev database ready on port $PORT"
    ;;
  stop)
    "$PG_BIN/pg_ctl" -D "$DATA_DIR" stop
    ;;
  *)
    echo "usage: $0 [start|stop]" >&2; exit 1
    ;;
esac
