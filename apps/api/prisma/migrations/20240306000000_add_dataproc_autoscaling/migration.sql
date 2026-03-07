-- Migration: 20240306000000_add_dataproc_autoscaling
--
-- Adds the `autoscaling` boolean column to DataprocCluster.
-- IF NOT EXISTS makes this migration safe to re-run (idempotent).
-- The NOT NULL DEFAULT false ensures existing rows are back-filled
-- immediately without a table lock on most Postgres versions (≥ 11).

ALTER TABLE "DataprocCluster"
  ADD COLUMN IF NOT EXISTS "autoscaling" BOOLEAN NOT NULL DEFAULT false;
