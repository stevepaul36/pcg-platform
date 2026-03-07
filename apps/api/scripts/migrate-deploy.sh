#!/usr/bin/env bash
# migrate-deploy.sh
#
# Baselines all known migrations before running `prisma migrate deploy`.
# This is required when the production DB was created outside of Prisma
# migrations (P3005: database schema is not empty).
#
# Each `prisma migrate resolve --applied` call is idempotent:
# if the migration is already recorded it exits 0, so re-deploys are safe.

set -euo pipefail

MIGRATIONS=(
  "20240301000000_init"
  "20240302000000_add_gcp_services"
  "20240303000000_add_more_gcp"
  "20240304000000_add_v6_services"
  "20240305000000_enterprise_features"
  "20240306000000_add_dataproc_autoscaling"
)

echo "==> Baselining existing migrations..."
for migration in "${MIGRATIONS[@]}"; do
  echo "    Marking ${migration} as applied"
  npx prisma migrate resolve --applied "${migration}" || true
done

echo "==> Running prisma migrate deploy..."
npx prisma migrate deploy

echo "==> Migration complete."
