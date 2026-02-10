#!/bin/bash
set -e
cd "$(dirname "$0")/.."

if [ -n "$TURSO_DB_NAME" ]; then
  echo "推送 Schema 到 Turso 远程数据库: $TURSO_DB_NAME ..."
  npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script 2>/dev/null \
    | turso db shell "$TURSO_DB_NAME"
else
  echo "推送 Schema 到本地 SQLite..."
  npx prisma db push
fi

npx prisma generate
echo "完成"
