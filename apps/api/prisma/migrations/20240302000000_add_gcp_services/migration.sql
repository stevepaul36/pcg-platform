-- BigQuery
CREATE TABLE "BQDataset" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "location" TEXT NOT NULL DEFAULT 'US', "description" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, UNIQUE("projectId","name"));
CREATE TABLE "BQTable" ("id" TEXT NOT NULL PRIMARY KEY, "datasetId" TEXT NOT NULL REFERENCES "BQDataset"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "schema" JSONB NOT NULL DEFAULT '[]', "rowCount" BIGINT NOT NULL DEFAULT 0, "sizeBytes" BIGINT NOT NULL DEFAULT 0, "tableType" TEXT NOT NULL DEFAULT 'TABLE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, UNIQUE("datasetId","name"));
CREATE INDEX "BQDataset_projectId_idx" ON "BQDataset"("projectId");
CREATE INDEX "BQTable_datasetId_idx" ON "BQTable"("datasetId");

-- Pub/Sub
CREATE TABLE "PubSubTopic" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "messageCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("projectId","name"));
CREATE TABLE "PubSubSubscription" ("id" TEXT NOT NULL PRIMARY KEY, "topicId" TEXT NOT NULL REFERENCES "PubSubTopic"("id") ON DELETE CASCADE, "projectId" TEXT NOT NULL, "name" TEXT NOT NULL, "ackDeadline" INTEGER NOT NULL DEFAULT 10, "messageCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("projectId","name"));
CREATE INDEX "PubSubTopic_projectId_idx" ON "PubSubTopic"("projectId");
CREATE INDEX "PubSubSubscription_topicId_idx" ON "PubSubSubscription"("topicId");
CREATE INDEX "PubSubSubscription_projectId_idx" ON "PubSubSubscription"("projectId");

-- Cloud Functions
CREATE TABLE "CloudFunction" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "runtime" TEXT NOT NULL, "region" TEXT NOT NULL, "entryPoint" TEXT NOT NULL, "trigger" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "invocations" INTEGER NOT NULL DEFAULT 0, "avgDurationMs" INTEGER NOT NULL DEFAULT 0, "memoryMb" INTEGER NOT NULL DEFAULT 256, "timeoutSec" INTEGER NOT NULL DEFAULT 60, "hourlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, UNIQUE("projectId","name"));
CREATE INDEX "CloudFunction_projectId_idx" ON "CloudFunction"("projectId");

-- GKE
CREATE TABLE "GKECluster" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "zone" TEXT NOT NULL, "version" TEXT NOT NULL DEFAULT '1.29', "nodeCount" INTEGER NOT NULL DEFAULT 3, "machineType" TEXT NOT NULL DEFAULT 'e2-medium', "diskGb" INTEGER NOT NULL DEFAULT 100, "status" TEXT NOT NULL DEFAULT 'PROVISIONING', "endpoint" TEXT NOT NULL, "hourlyCost" DOUBLE PRECISION NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, UNIQUE("projectId","name"));
CREATE INDEX "GKECluster_projectId_idx" ON "GKECluster"("projectId");

-- Cloud Run
CREATE TABLE "CloudRunService" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "region" TEXT NOT NULL, "image" TEXT NOT NULL, "cpu" TEXT NOT NULL DEFAULT '1', "memoryMb" INTEGER NOT NULL DEFAULT 512, "minInstances" INTEGER NOT NULL DEFAULT 0, "maxInstances" INTEGER NOT NULL DEFAULT 100, "status" TEXT NOT NULL DEFAULT 'DEPLOYING', "url" TEXT NOT NULL, "requestCount" INTEGER NOT NULL DEFAULT 0, "hourlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, UNIQUE("projectId","name"));
CREATE INDEX "CloudRunService_projectId_idx" ON "CloudRunService"("projectId");

-- Networking
CREATE TABLE "VPCNetwork" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "subnet" TEXT NOT NULL, "region" TEXT NOT NULL, "mode" TEXT NOT NULL DEFAULT 'AUTO', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("projectId","name"));
CREATE TABLE "LoadBalancer" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "type" TEXT NOT NULL, "region" TEXT NOT NULL DEFAULT 'global', "ip" TEXT NOT NULL, "backends" INTEGER NOT NULL DEFAULT 1, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "hourlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0.025, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("projectId","name"));
CREATE TABLE "CloudDNSZone" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "dnsName" TEXT NOT NULL, "visibility" TEXT NOT NULL DEFAULT 'public', "recordCount" INTEGER NOT NULL DEFAULT 2, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("projectId","name"));
CREATE INDEX "VPCNetwork_projectId_idx" ON "VPCNetwork"("projectId");
CREATE INDEX "LoadBalancer_projectId_idx" ON "LoadBalancer"("projectId");
CREATE INDEX "CloudDNSZone_projectId_idx" ON "CloudDNSZone"("projectId");

-- Secret Manager
CREATE TABLE "SecretManagerSecret" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "replication" TEXT NOT NULL DEFAULT 'automatic', "versions" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, UNIQUE("projectId","name"));
CREATE INDEX "SecretManagerSecret_projectId_idx" ON "SecretManagerSecret"("projectId");

-- KMS
CREATE TABLE "KMSKeyRing" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "location" TEXT NOT NULL DEFAULT 'global', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("projectId","name"));
CREATE TABLE "KMSKey" ("id" TEXT NOT NULL PRIMARY KEY, "keyRingId" TEXT NOT NULL REFERENCES "KMSKeyRing"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "purpose" TEXT NOT NULL DEFAULT 'ENCRYPT_DECRYPT', "algorithm" TEXT NOT NULL DEFAULT 'GOOGLE_SYMMETRIC_ENCRYPTION', "rotationDays" INTEGER NOT NULL DEFAULT 90, "state" TEXT NOT NULL DEFAULT 'ENABLED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("keyRingId","name"));
CREATE INDEX "KMSKeyRing_projectId_idx" ON "KMSKeyRing"("projectId");
CREATE INDEX "KMSKey_keyRingId_idx" ON "KMSKey"("keyRingId");

-- Vertex AI
CREATE TABLE "VertexModel" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "displayName" TEXT NOT NULL, "framework" TEXT NOT NULL, "region" TEXT NOT NULL DEFAULT 'us-central1', "status" TEXT NOT NULL DEFAULT 'DEPLOYED', "versionId" TEXT NOT NULL DEFAULT '1', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("projectId","name"));
CREATE TABLE "VertexEndpoint" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "modelId" TEXT NOT NULL REFERENCES "VertexModel"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "region" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DEPLOYING', "requestCount" INTEGER NOT NULL DEFAULT 0, "hourlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0.1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "VertexModel_projectId_idx" ON "VertexModel"("projectId");
CREATE INDEX "VertexEndpoint_projectId_idx" ON "VertexEndpoint"("projectId");
CREATE INDEX "VertexEndpoint_modelId_idx" ON "VertexEndpoint"("modelId");

-- Dataflow
CREATE TABLE "DataflowJob" ("id" TEXT NOT NULL PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "template" TEXT NOT NULL, "region" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'JOB_STATE_RUNNING', "workers" INTEGER NOT NULL DEFAULT 1, "maxWorkers" INTEGER NOT NULL DEFAULT 10, "bytesProcessed" BIGINT NOT NULL DEFAULT 0, "hourlyCost" DOUBLE PRECISION NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "DataflowJob_projectId_idx" ON "DataflowJob"("projectId");
