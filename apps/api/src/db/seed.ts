// apps/api/src/db/seed.ts
// ─── Database Seed ──────────────────────────────────────────────────────────
// Creates demo data for local development. Run:
//   npm run db:seed
//   # or: npx ts-node apps/api/src/db/seed.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── Admin user ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Admin123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@pcg.dev" },
    update: {},
    create: {
      email:        "admin@pcg.dev",
      name:         "PCG Admin",
      passwordHash,
      plan:         "personal",
      emailDomain:  "pcg.dev",
    },
  });
  console.log(`✓ Admin user: admin@pcg.dev / Admin123!`);

  // ── Demo user ─────────────────────────────────────────────────────────────
  const demoHash = await bcrypt.hash("Demo1234!", 12);
  const demo = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email:        "demo@example.com",
      name:         "Demo User",
      passwordHash: demoHash,
      plan:         "free",
      emailDomain:  "example.com",
    },
  });
  console.log(`✓ Demo user:  demo@example.com / Demo1234!`);

  // ── Project ───────────────────────────────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { name: "pcg-demo-seed" },
    update: {},
    create: {
      name:         "pcg-demo-seed",
      displayName:  "PCG Demo Project",
      ownerId:      admin.id,
      totalSpendUSD: 12.47,
    },
  });
  console.log(`✓ Project: ${project.displayName} (${project.name})`);

  // ── IAM ───────────────────────────────────────────────────────────────────
  await prisma.iAMMember.upsert({
    where: { projectId_email_role: { projectId: project.id, email: admin.email, role: "Owner" } },
    update: {},
    create: { projectId: project.id, email: admin.email, role: "Owner", type: "user", addedBy: "system" },
  });
  await prisma.iAMMember.upsert({
    where: { projectId_email_role: { projectId: project.id, email: demo.email, role: "Editor" } },
    update: {},
    create: { projectId: project.id, email: demo.email, role: "Editor", type: "user", addedBy: admin.email },
  });
  console.log(`✓ IAM: Admin=Owner, Demo=Editor`);

  // ── VMs ───────────────────────────────────────────────────────────────────
  const vms = [
    {
      name: "web-server-1", zone: "us-central1-a", region: "us-central1",
      machineType: "e2-medium", vcpus: 2, ramGb: 4, diskGb: 50, diskType: "pd-balanced",
      osImage: "ubuntu-2204-lts", status: "RUNNING", hourlyCost: 0.0268, diskHourlyCost: 0.005480,
      cpuUsage: 34.2, ramUsage: 58.1, netIn: 120, netOut: 85,
      uptimeSec: 86400, cpuHistory: Array.from({ length: 30 }, () => 20 + Math.random() * 40),
      ramHistory: Array.from({ length: 30 }, () => 45 + Math.random() * 25),
    },
    {
      name: "db-replica-1", zone: "us-east1-b", region: "us-east1",
      machineType: "n1-standard-2", vcpus: 2, ramGb: 7.5, diskGb: 200, diskType: "pd-ssd",
      osImage: "debian-12", status: "RUNNING", hourlyCost: 0.0950, diskHourlyCost: 0.046576,
      cpuUsage: 12.8, ramUsage: 72.3, netIn: 45, netOut: 210,
      uptimeSec: 259200, cpuHistory: Array.from({ length: 30 }, () => 8 + Math.random() * 15),
      ramHistory: Array.from({ length: 30 }, () => 65 + Math.random() * 15),
    },
    {
      name: "batch-worker-1", zone: "us-central1-b", region: "us-central1",
      machineType: "c2-standard-4", vcpus: 4, ramGb: 16, diskGb: 100, diskType: "pd-standard",
      osImage: "ubuntu-2404-lts", status: "STOPPED", hourlyCost: 0.2088, diskHourlyCost: 0.005484,
      cpuUsage: 0, ramUsage: 0, netIn: 0, netOut: 0, uptimeSec: 0,
      cpuHistory: [], ramHistory: [],
    },
  ];

  for (const vm of vms) {
    await prisma.vMInstance.upsert({
      where: { projectId_name: { projectId: project.id, name: vm.name } },
      update: {},
      create: {
        projectId: project.id,
        ...vm,
        preemptible: false,
        tags: [],
        internalIp: `10.128.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 253) + 2}`,
        externalIp: `34.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 253) + 2}`,
      },
    });
  }
  console.log(`✓ VMs: ${vms.length} instances (2 running, 1 stopped)`);

  // ── Storage ───────────────────────────────────────────────────────────────
  const bucket = await prisma.storageBucket.upsert({
    where: { name: "pcg-demo-assets" },
    update: {},
    create: {
      projectId:      project.id,
      name:           "pcg-demo-assets",
      location:       "us-central1",
      storageClass:   "Standard",
      versioning:     false,
      totalSizeBytes: BigInt(52428800), // ~50 MB
    },
  });

  await prisma.storageObject.upsert({
    where: { bucketId_name: { bucketId: bucket.id, name: "index.html" } },
    update: {},
    create: {
      bucketId:    bucket.id,
      name:        "index.html",
      sizeBytes:   BigInt(4096),
      contentType: "text/html",
      etag:        "abc123def456",
      generation:  Date.now().toString(),
    },
  });

  await prisma.storageObject.upsert({
    where: { bucketId_name: { bucketId: bucket.id, name: "data/backup.tar.gz" } },
    update: {},
    create: {
      bucketId:    bucket.id,
      name:        "data/backup.tar.gz",
      sizeBytes:   BigInt(52424704), // ~50 MB
      contentType: "application/gzip",
      etag:        "xyz789ghi012",
      generation:  Date.now().toString(),
    },
  });
  console.log(`✓ Storage: 1 bucket, 2 objects`);

  // ── SQL Instances ─────────────────────────────────────────────────────────
  await prisma.sQLInstance.upsert({
    where: { projectId_name: { projectId: project.id, name: "main-db" } },
    update: {},
    create: {
      projectId:        project.id,
      name:             "main-db",
      dbType:           "PostgreSQL",
      dbVersion:        "POSTGRES_16",
      tier:             "db-n1-standard-1",
      region:           "us-central1",
      storageGb:        50,
      highAvailability: false,
      backups:          true,
      status:           "RUNNABLE",
      privateIp:        "10.45.12.3",
      connectionName:   `${project.id}:us-central1:main-db`,
      hourlyCost:       0.0965,
    },
  });
  console.log(`✓ SQL: 1 PostgreSQL instance`);

  // ── Activity Logs ─────────────────────────────────────────────────────────
  const logEntries = [
    { type: "CREATE_VM",     description: 'VM "web-server-1" created in us-central1-a', severity: "INFO" },
    { type: "CREATE_VM",     description: 'VM "db-replica-1" created in us-east1-b',    severity: "INFO" },
    { type: "CREATE_BUCKET", description: 'Bucket "pcg-demo-assets" created',            severity: "INFO" },
    { type: "CREATE_SQL",    description: 'SQL instance "main-db" created',              severity: "INFO" },
    { type: "ADD_IAM_MEMBER",description: 'demo@example.com granted "Editor" role',      severity: "INFO" },
    { type: "STOP_VM",       description: 'VM "batch-worker-1" stopped',                 severity: "WARNING" },
  ];

  for (const entry of logEntries) {
    await prisma.activityLog.create({
      data: {
        projectId: project.id,
        type:        entry.type,
        description: entry.description,
        severity:    entry.severity,
        user:        admin.email,
        metadata:    {},
      },
    });
  }
  console.log(`✓ Activity logs: ${logEntries.length} entries`);

  // ── Announcements ─────────────────────────────────────────────────────────
  await prisma.announcement.create({
    data: {
      title:       "Welcome to PCG Platform 2.0",
      body:        "The platform has been upgraded with enhanced security, real-time billing, and improved IAM controls. Check out the new improvements tracker to vote on upcoming features.",
      type:        "feature",
      pinned:      true,
      authorEmail: admin.email,
    },
  });
  await prisma.announcement.create({
    data: {
      title:       "Scheduled maintenance: Feb 28, 2-4 AM UTC",
      body:        "We'll be performing database maintenance during this window. Expect brief interruptions to the dashboard. VM workloads will not be affected.",
      type:        "maintenance",
      authorEmail: admin.email,
    },
  });
  console.log(`✓ Announcements: 2 entries`);

  // ── Improvements ──────────────────────────────────────────────────────────
  const improvements = [
    { title: "Auto-scaling VM groups",           description: "Automatically scale VM instances based on CPU/RAM thresholds", category: "feature",     priority: "high",   votes: 14, status: "planned" },
    { title: "Dark mode for dashboard",          description: "Add a dark theme option for the console UI",                  category: "ux",          priority: "medium", votes: 23, status: "in_progress" },
    { title: "Export billing data as CSV",        description: "Allow users to download billing history in CSV format",       category: "feature",     priority: "low",    votes: 8,  status: "planned" },
    { title: "Fix slow VM list loading",          description: "VM list takes >3s to load when project has 50+ VMs",         category: "performance", priority: "high",   votes: 11, status: "completed" },
    { title: "Bucket lifecycle policies",         description: "Implement automatic object expiration and storage class transitions", category: "feature", priority: "medium", votes: 6, status: "planned" },
  ];

  for (const imp of improvements) {
    await prisma.improvement.create({
      data: { ...imp, authorEmail: admin.email },
    });
  }
  console.log(`✓ Improvements: ${improvements.length} entries`);

  console.log("\n🎉 Seed complete!\n");
  console.log("  Login as admin:  admin@pcg.dev / Admin123!");
  console.log("  Login as demo:   demo@example.com / Demo1234!\n");
}

main()
  .catch(e => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
