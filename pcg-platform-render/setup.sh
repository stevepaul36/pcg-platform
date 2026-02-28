#!/usr/bin/env bash
set -euo pipefail

# ── PCG Platform — Quick Setup ───────────────────────────────────────────────
# Usage: bash setup.sh [docker|local]
# Default: local

MODE="${1:-local}"
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

info()  { echo -e "${GREEN}✓${RESET} $1"; }
warn()  { echo -e "${YELLOW}⚠${RESET} $1"; }
error() { echo -e "${RED}✗${RESET} $1"; }
step()  { echo -e "\n${BOLD}── $1 ──${RESET}"; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────

step "Pre-flight checks"

command -v node >/dev/null 2>&1 || { error "Node.js is required (v18+). Install: https://nodejs.org"; exit 1; }

NODE_VERSION=$(node -v | grep -oP '\d+' | head -1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js v18+ required (found $(node -v))"
  exit 1
fi
info "Node.js $(node -v)"

command -v npm >/dev/null 2>&1 || { error "npm is required"; exit 1; }
info "npm $(npm -v)"

if [ "$MODE" = "docker" ]; then
  command -v docker >/dev/null 2>&1 || { error "Docker is required for docker mode"; exit 1; }
  info "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+')"
fi

# ── Environment file ──────────────────────────────────────────────────────────

step "Environment configuration"

if [ ! -f apps/api/.env ]; then
  cp apps/api/.env.example apps/api/.env

  # Generate random secrets
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|REPLACE_ME_WITH_32_CHAR_HEX_SECRET_FOR_ACCESS_TOKENS|${JWT_SECRET}|" apps/api/.env
    sed -i '' "s|REPLACE_ME_WITH_32_CHAR_HEX_SECRET_FOR_REFRESH_TOKENS|${JWT_REFRESH_SECRET}|" apps/api/.env
  else
    sed -i "s|REPLACE_ME_WITH_32_CHAR_HEX_SECRET_FOR_ACCESS_TOKENS|${JWT_SECRET}|" apps/api/.env
    sed -i "s|REPLACE_ME_WITH_32_CHAR_HEX_SECRET_FOR_REFRESH_TOKENS|${JWT_REFRESH_SECRET}|" apps/api/.env
  fi

  info "Created apps/api/.env with auto-generated JWT secrets"
  warn "Edit apps/api/.env to set ANTHROPIC_API_KEY and ADMIN_EMAILS"
else
  info "apps/api/.env already exists — skipping"
fi

# ── Docker mode ────────────────────────────────────────────────────────────────

if [ "$MODE" = "docker" ]; then
  step "Starting Docker services"
  cd infra/docker

  # Source .env for docker-compose interpolation
  set -a
  source ../../apps/api/.env 2>/dev/null || true
  set +a

  docker compose up -d --build

  info "Waiting for Postgres to be ready..."
  sleep 5

  step "Running database migrations"
  docker compose exec api npx prisma migrate deploy 2>/dev/null || \
    docker compose exec api npx prisma db push 2>/dev/null

  info "Generating Prisma client"
  docker compose exec api npx prisma generate

  echo ""
  info "PCG Platform is running!"
  echo "  API:  http://localhost:4000/health"
  echo "  Web:  http://localhost:3000"
  echo "  DB:   postgresql://pcg:pcg_dev_pass@localhost:5432/pcg_db"
  echo ""
  echo "  Logs: docker compose -f infra/docker/docker-compose.yml logs -f"
  echo "  Stop: docker compose -f infra/docker/docker-compose.yml down"
  exit 0
fi

# ── Local mode ─────────────────────────────────────────────────────────────────

step "Installing dependencies"
npm install
info "Root dependencies installed"

step "Building shared package"
npm run -w packages/shared build
info "@pcg/shared built"

step "Generating Prisma client"
cd apps/api
npx prisma generate
cd ../..
info "Prisma client generated"

# ── Database ────────────────────────────────────────────────────────────────────

step "Database setup"

echo "Checking if Postgres is reachable..."
if command -v pg_isready >/dev/null 2>&1; then
  if pg_isready -h localhost -p 5432 -U pcg >/dev/null 2>&1; then
    info "Postgres is running"

    echo "Running migrations..."
    cd apps/api
    npx prisma migrate dev --name init 2>/dev/null || npx prisma db push
    cd ../..
    info "Database schema applied"
  else
    warn "Postgres is not running on localhost:5432"
    echo "  Start it with: docker run -d --name pcg-postgres -e POSTGRES_USER=pcg -e POSTGRES_PASSWORD=pcg_dev_pass -e POSTGRES_DB=pcg_db -p 5432:5432 postgres:16-alpine"
    echo "  Then re-run: bash setup.sh"
    exit 1
  fi
else
  warn "pg_isready not found — assuming Postgres is running"
  cd apps/api
  npx prisma migrate dev --name init 2>/dev/null || npx prisma db push 2>/dev/null || warn "Migration failed — ensure DATABASE_URL is correct in .env"
  cd ../..
fi

echo ""
info "Setup complete! Start the dev server:"
echo ""
echo "  ${BOLD}npm run dev${RESET}            # starts API + Web via Turbo"
echo ""
echo "  Or individually:"
echo "  ${BOLD}npm run -w @pcg/api dev${RESET}         # API on :4000"
echo "  ${BOLD}npm run -w @pcg/api dev:worker${RESET}  # Metrics worker"
echo "  ${BOLD}npm run -w @pcg/web dev${RESET}         # Web on :3000"
echo ""
echo "  ${BOLD}npm run db:seed${RESET}                 # Seed demo data (admin@pcg.dev / Admin123!)"
