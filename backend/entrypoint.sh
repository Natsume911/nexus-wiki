#!/bin/sh
set -e

# Hocuspocus patch (prevents crash on undefined reason.toString())
node -e "const f='/app/node_modules/@hocuspocus/server/dist/hocuspocus-server.esm.js';const s=require('fs').readFileSync(f,'utf8');require('fs').writeFileSync(f,s.replace('reason.toString()','(reason||\"\").toString()'))"

# Run Prisma migrations
npx prisma migrate deploy

# Run init.sql (custom functions, triggers, indexes) — idempotent
if [ -f /app/prisma/init.sql ]; then
  echo "[entrypoint] Running init.sql..."
  PGPASSWORD=$(echo $DATABASE_URL | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/') \
  psql -h $(echo $DATABASE_URL | sed 's/.*@\([^:]*\):.*/\1/') \
       -p $(echo $DATABASE_URL | sed 's/.*:\([0-9]*\)\/.*/\1/') \
       -U $(echo $DATABASE_URL | sed 's/.*:\/\/\([^:]*\):.*/\1/') \
       -d $(echo $DATABASE_URL | sed 's/.*\/\([^?]*\).*/\1/') \
       -f /app/prisma/init.sql 2>&1 | tail -3
  echo "[entrypoint] init.sql done"
fi

# Regenerate Prisma client
npx prisma generate

# Start the app
exec npx tsx watch src/index.ts
