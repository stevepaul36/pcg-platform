-- v6.0: Firestore, Cloud Logging, Cloud Tasks, Dataproc, CDN, Firewall, Service Accounts, Budgets, Workflows, Cloud Deploy

CREATE TABLE "FirestoreDatabase" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL DEFAULT '(default)',"type" TEXT NOT NULL DEFAULT 'NATIVE',"locationId" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'ACTIVE',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "FirestoreDatabase_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "FirestoreDatabase_projectId_name_key" ON "FirestoreDatabase"("projectId","name");
CREATE INDEX "FirestoreDatabase_projectId_idx" ON "FirestoreDatabase"("projectId");

CREATE TABLE "LogSink" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"destination" TEXT NOT NULL,"filter" TEXT NOT NULL DEFAULT '',"enabled" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "LogSink_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "LogSink_projectId_name_key" ON "LogSink"("projectId","name");
CREATE INDEX "LogSink_projectId_idx" ON "LogSink"("projectId");

CREATE TABLE "TaskQueue" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"region" TEXT NOT NULL,"rateLimitPerSecond" DOUBLE PRECISION NOT NULL DEFAULT 500,"maxConcurrent" INTEGER NOT NULL DEFAULT 1000,"retryMaxAttempts" INTEGER NOT NULL DEFAULT 3,"taskCount" INTEGER NOT NULL DEFAULT 0,"status" TEXT NOT NULL DEFAULT 'RUNNING',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "TaskQueue_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "TaskQueue_projectId_name_key" ON "TaskQueue"("projectId","name");
CREATE INDEX "TaskQueue_projectId_idx" ON "TaskQueue"("projectId");

CREATE TABLE "DataprocCluster" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"region" TEXT NOT NULL,"masterType" TEXT NOT NULL DEFAULT 'n1-standard-4',"workerType" TEXT NOT NULL DEFAULT 'n1-standard-2',"workerCount" INTEGER NOT NULL DEFAULT 2,"imageVersion" TEXT NOT NULL DEFAULT '2.1-debian11',"status" TEXT NOT NULL DEFAULT 'CREATING',"hourlyCost" DOUBLE PRECISION NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DataprocCluster_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "DataprocCluster_projectId_name_key" ON "DataprocCluster"("projectId","name");
CREATE INDEX "DataprocCluster_projectId_idx" ON "DataprocCluster"("projectId");

CREATE TABLE "CDNConfig" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"originUrl" TEXT NOT NULL,"cacheMode" TEXT NOT NULL DEFAULT 'CACHE_ALL_STATIC',"defaultTtlSec" INTEGER NOT NULL DEFAULT 3600,"maxTtlSec" INTEGER NOT NULL DEFAULT 86400,"negativeCaching" BOOLEAN NOT NULL DEFAULT false,"compressionMode" TEXT NOT NULL DEFAULT 'AUTOMATIC',"enabled" BOOLEAN NOT NULL DEFAULT true,"requestCount" BIGINT NOT NULL DEFAULT 0,"cacheHitRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "CDNConfig_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "CDNConfig_projectId_name_key" ON "CDNConfig"("projectId","name");
CREATE INDEX "CDNConfig_projectId_idx" ON "CDNConfig"("projectId");

CREATE TABLE "FirewallRule" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"network" TEXT NOT NULL DEFAULT 'default',"direction" TEXT NOT NULL,"action" TEXT NOT NULL,"priority" INTEGER NOT NULL DEFAULT 1000,"sourceRanges" TEXT[],"targetTags" TEXT[],"protocols" TEXT[],"enabled" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "FirewallRule_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "FirewallRule_projectId_name_key" ON "FirewallRule"("projectId","name");
CREATE INDEX "FirewallRule_projectId_idx" ON "FirewallRule"("projectId");

CREATE TABLE "ServiceAccount" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"displayName" TEXT NOT NULL,"email" TEXT NOT NULL,"description" TEXT NOT NULL DEFAULT '',"disabled" BOOLEAN NOT NULL DEFAULT false,"keyCount" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ServiceAccount_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ServiceAccount_projectId_name_key" ON "ServiceAccount"("projectId","name");
CREATE INDEX "ServiceAccount_projectId_idx" ON "ServiceAccount"("projectId");

CREATE TABLE "BillingBudget" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"amountUSD" DOUBLE PRECISION NOT NULL,"includeCredits" BOOLEAN NOT NULL DEFAULT true,"thresholds" DOUBLE PRECISION[],"notifyEmails" TEXT[],"currentSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,"status" TEXT NOT NULL DEFAULT 'ON_TRACK',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "BillingBudget_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "BillingBudget_projectId_name_key" ON "BillingBudget"("projectId","name");
CREATE INDEX "BillingBudget_projectId_idx" ON "BillingBudget"("projectId");

CREATE TABLE "Workflow" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"region" TEXT NOT NULL,"description" TEXT NOT NULL DEFAULT '',"sourceCode" TEXT NOT NULL DEFAULT 'main:
  steps:
    - init:
        assign:
          - result: ''Hello World''',"status" TEXT NOT NULL DEFAULT 'ACTIVE',"revisionId" TEXT NOT NULL DEFAULT '1',"lastExecutedAt" TIMESTAMP(3),"lastExecStatus" TEXT NOT NULL DEFAULT 'NONE',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Workflow_projectId_name_key" ON "Workflow"("projectId","name");
CREATE INDEX "Workflow_projectId_idx" ON "Workflow"("projectId");

CREATE TABLE "DeliveryPipeline" ("id" TEXT NOT NULL,"projectId" TEXT NOT NULL,"name" TEXT NOT NULL,"description" TEXT NOT NULL DEFAULT '',"region" TEXT NOT NULL,"stages" JSONB NOT NULL DEFAULT '[]',"status" TEXT NOT NULL DEFAULT 'ACTIVE',"lastDeployAt" TIMESTAMP(3),"lastDeployStatus" TEXT NOT NULL DEFAULT 'NONE',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "DeliveryPipeline_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "DeliveryPipeline_projectId_name_key" ON "DeliveryPipeline"("projectId","name");
CREATE INDEX "DeliveryPipeline_projectId_idx" ON "DeliveryPipeline"("projectId");

ALTER TABLE "FirestoreDatabase" ADD CONSTRAINT "FirestoreDatabase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogSink" ADD CONSTRAINT "LogSink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskQueue" ADD CONSTRAINT "TaskQueue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataprocCluster" ADD CONSTRAINT "DataprocCluster_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CDNConfig" ADD CONSTRAINT "CDNConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FirewallRule" ADD CONSTRAINT "FirewallRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceAccount" ADD CONSTRAINT "ServiceAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingBudget" ADD CONSTRAINT "BillingBudget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryPipeline" ADD CONSTRAINT "DeliveryPipeline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
