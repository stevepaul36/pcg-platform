-- Add autoscaling to DataprocCluster, update default imageVersion
ALTER TABLE "DataprocCluster" ADD COLUMN IF NOT EXISTS "autoscaling" BOOLEAN NOT NULL DEFAULT false;
