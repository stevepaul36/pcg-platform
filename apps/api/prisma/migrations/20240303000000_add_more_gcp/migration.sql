-- Migration: add_more_gcp_services
-- Cloud Monitoring, Cloud Build, Artifact Registry, Cloud Scheduler,
-- API Gateway, Memorystore, Cloud Armor

CREATE TABLE "MonitoringAlertPolicy" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"displayName" TEXT NOT NULL,"conditionType" TEXT NOT NULL,"metricType" TEXT NOT NULL,"threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,"duration" TEXT NOT NULL DEFAULT '60s',"enabled" BOOLEAN NOT NULL DEFAULT true,"notifyEmails" TEXT[],"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "MonitoringAlertPolicy_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "MonitoringAlertPolicy_projectId_name_key" ON "MonitoringAlertPolicy"("projectId","name");
CREATE INDEX "MonitoringAlertPolicy_projectId_idx" ON "MonitoringAlertPolicy"("projectId");

CREATE TABLE "UptimeCheck" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"displayName" TEXT NOT NULL,"monitoredUrl" TEXT NOT NULL,"checkInterval" TEXT NOT NULL DEFAULT '60s',"timeout" TEXT NOT NULL DEFAULT '10s',"regions" TEXT[],"status" TEXT NOT NULL DEFAULT 'ACTIVE',"lastCheckAt" TIMESTAMP(3),"lastStatus" TEXT NOT NULL DEFAULT 'OK',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "UptimeCheck_pkey" PRIMARY KEY ("id"));
CREATE INDEX "UptimeCheck_projectId_idx" ON "UptimeCheck"("projectId");

CREATE TABLE "CloudBuildTrigger" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"description" TEXT NOT NULL DEFAULT '','repoSource' TEXT NOT NULL,"branchPattern" TEXT NOT NULL DEFAULT '^main$',"buildSteps" TEXT[],"substitutions" JSONB NOT NULL DEFAULT '{}',"status" TEXT NOT NULL DEFAULT 'ACTIVE',"lastBuildAt" TIMESTAMP(3),"lastBuildStatus" TEXT NOT NULL DEFAULT 'NONE',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "CloudBuildTrigger_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "CloudBuildTrigger_projectId_name_key" ON "CloudBuildTrigger"("projectId","name");
CREATE INDEX "CloudBuildTrigger_projectId_idx" ON "CloudBuildTrigger"("projectId");

CREATE TABLE "ArtifactRepo" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"format" TEXT NOT NULL,"location" TEXT NOT NULL,"description" TEXT NOT NULL DEFAULT '',"sizeBytes" BIGINT NOT NULL DEFAULT 0,"packageCount" INTEGER NOT NULL DEFAULT 0,"cleanupPolicy" TEXT NOT NULL DEFAULT 'KEEP_ALL',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ArtifactRepo_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ArtifactRepo_projectId_name_key" ON "ArtifactRepo"("projectId","name");
CREATE INDEX "ArtifactRepo_projectId_idx" ON "ArtifactRepo"("projectId");

CREATE TABLE "SchedulerJob" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"description" TEXT NOT NULL DEFAULT '',"schedule" TEXT NOT NULL,"timezone" TEXT NOT NULL DEFAULT 'UTC',"targetType" TEXT NOT NULL,"targetUri" TEXT NOT NULL,"httpMethod" TEXT NOT NULL DEFAULT 'POST',"status" TEXT NOT NULL DEFAULT 'ENABLED',"lastRunAt" TIMESTAMP(3),"lastRunStatus" TEXT NOT NULL DEFAULT 'NONE',"retryCount" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "SchedulerJob_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "SchedulerJob_projectId_name_key" ON "SchedulerJob"("projectId","name");
CREATE INDEX "SchedulerJob_projectId_idx" ON "SchedulerJob"("projectId");

CREATE TABLE "ApiGateway" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"displayName" TEXT NOT NULL,"backendUrl" TEXT NOT NULL,"region" TEXT NOT NULL,"protocol" TEXT NOT NULL DEFAULT 'HTTPS',"authType" TEXT NOT NULL DEFAULT 'API_KEY',"rateLimitRpm" INTEGER NOT NULL DEFAULT 1000,"status" TEXT NOT NULL DEFAULT 'ACTIVE',"requestCount" BIGINT NOT NULL DEFAULT 0,"gatewayUrl" TEXT NOT NULL DEFAULT '',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ApiGateway_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ApiGateway_projectId_name_key" ON "ApiGateway"("projectId","name");
CREATE INDEX "ApiGateway_projectId_idx" ON "ApiGateway"("projectId");

CREATE TABLE "MemorystoreInstance" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"engine" TEXT NOT NULL,"version" TEXT NOT NULL,"tier" TEXT NOT NULL,"memorySizeGb" INTEGER NOT NULL,"region" TEXT NOT NULL,"host" TEXT NOT NULL,"port" INTEGER NOT NULL DEFAULT 6379,"status" TEXT NOT NULL DEFAULT 'CREATING',"highAvailability" BOOLEAN NOT NULL DEFAULT false,"hourlyCost" DOUBLE PRECISION NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "MemorystoreInstance_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "MemorystoreInstance_projectId_name_key" ON "MemorystoreInstance"("projectId","name");
CREATE INDEX "MemorystoreInstance_projectId_idx" ON "MemorystoreInstance"("projectId");

CREATE TABLE "CloudArmorPolicy" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"description" TEXT NOT NULL DEFAULT '',"type" TEXT NOT NULL DEFAULT 'CLOUD_ARMOR',"defaultAction" TEXT NOT NULL DEFAULT 'allow',"rules" JSONB NOT NULL DEFAULT '[]',"adaptiveProtection" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "CloudArmorPolicy_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "CloudArmorPolicy_projectId_name_key" ON "CloudArmorPolicy"("projectId","name");
CREATE INDEX "CloudArmorPolicy_projectId_idx" ON "CloudArmorPolicy"("projectId");

ALTER TABLE "MonitoringAlertPolicy" ADD CONSTRAINT "MonitoringAlertPolicy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UptimeCheck" ADD CONSTRAINT "UptimeCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CloudBuildTrigger" ADD CONSTRAINT "CloudBuildTrigger_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArtifactRepo" ADD CONSTRAINT "ArtifactRepo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchedulerJob" ADD CONSTRAINT "SchedulerJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiGateway" ADD CONSTRAINT "ApiGateway_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemorystoreInstance" ADD CONSTRAINT "MemorystoreInstance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CloudArmorPolicy" ADD CONSTRAINT "CloudArmorPolicy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
