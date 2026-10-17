#!/usr/bin/env bash
# Writes .env.local from the running local Supabase stack. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."
eval "$(npx supabase status -o env 2>/dev/null)"
cat > .env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
DATABASE_URL=${DB_URL}
NEXT_PUBLIC_CURRENCY=USD
APP_TIMEZONE=UTC
ENV
echo "Wrote .env.local for ${API_URL}"
