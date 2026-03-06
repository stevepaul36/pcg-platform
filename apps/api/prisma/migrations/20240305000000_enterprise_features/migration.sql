-- v6.1: Organization hierarchy, billing engine, quotas, lifecycle tracking

CREATE TABLE "Organization" ("id" TEXT NOT NULL,"name" TEXT NOT NULL,"displayName" TEXT NOT NULL,"domain" TEXT NOT NULL DEFAULT '','ownerId' TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "Organization_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");
CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");

CREATE TABLE "Folder" ("id" TEXT NOT NULL,"name" TEXT NOT NULL,"displayName" TEXT NOT NULL,"orgId" TEXT NOT NULL,"parentId" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "Folder_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Folder_orgId_name_key" ON "Folder"("orgId","name");
CREATE INDEX "Folder_orgId_idx" ON "Folder"("orgId");
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");

CREATE TABLE "UsageRecord" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"resourceType" TEXT NOT NULL,"resourceId" TEXT NOT NULL,"resourceName" TEXT NOT NULL,"usageHours" DOUBLE PRECISION NOT NULL DEFAULT 0,"costPerHour" DOUBLE PRECISION NOT NULL DEFAULT 0,"totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,"periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"periodEnd" TIMESTAMP(3),"status" TEXT NOT NULL DEFAULT 'ACTIVE',CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id"));
CREATE INDEX "UsageRecord_projectId_idx" ON "UsageRecord"("projectId");
CREATE INDEX "UsageRecord_resourceType_idx" ON "UsageRecord"("resourceType");
CREATE INDEX "UsageRecord_periodStart_idx" ON "UsageRecord"("periodStart");

CREATE TABLE "CostSummary" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"computeCost" DOUBLE PRECISION NOT NULL DEFAULT 0,"storageCost" DOUBLE PRECISION NOT NULL DEFAULT 0,"networkCost" DOUBLE PRECISION NOT NULL DEFAULT 0,"databaseCost" DOUBLE PRECISION NOT NULL DEFAULT 0,"aiCost" DOUBLE PRECISION NOT NULL DEFAULT 0,"otherCost" DOUBLE PRECISION NOT NULL DEFAULT 0,"totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,CONSTRAINT "CostSummary_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "CostSummary_projectId_date_key" ON "CostSummary"("projectId","date");
CREATE INDEX "CostSummary_projectId_idx" ON "CostSummary"("projectId");

CREATE TABLE "ResourceQuota" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"resourceType" TEXT NOT NULL,"limitValue" INTEGER NOT NULL,"currentUsage" INTEGER NOT NULL DEFAULT 0,"region" TEXT NOT NULL DEFAULT 'global',CONSTRAINT "ResourceQuota_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ResourceQuota_projectId_resourceType_region_key" ON "ResourceQuota"("projectId","resourceType","region");
CREATE INDEX "ResourceQuota_projectId_idx" ON "ResourceQuota"("projectId");

CREATE TABLE "ResourceState" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"resourceType" TEXT NOT NULL,"resourceId" TEXT NOT NULL,"status" TEXT NOT NULL,"previousStatus" TEXT,"message" TEXT NOT NULL DEFAULT '',"changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ResourceState_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ResourceState_projectId_idx" ON "ResourceState"("projectId");
CREATE INDEX "ResourceState_resourceId_idx" ON "ResourceState"("resourceId");
CREATE INDEX "ResourceState_changedAt_idx" ON "ResourceState"("changedAt");

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostSummary" ADD CONSTRAINT "CostSummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceQuota" ADD CONSTRAINT "ResourceQuota_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceState" ADD CONSTRAINT "ResourceState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
