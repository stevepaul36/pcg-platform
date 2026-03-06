// apps/api/src/routes/storage.ts

import { Router }      from "express";
import { z }           from "zod";
import { CreateBucketSchema } from "@pcg/shared";
import { prisma }      from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError }    from "../middleware/errorHandler";
import { logActivity } from "../services/activityLog";
import { getEffectivePlan, getPlanQuota } from "../services/subscription";

export const storageRouter = Router();
storageRouter.use(requireAuth);

// ── GET /api/v1/storage/:projectId/buckets ────────────────────────────────────

storageRouter.get("/:projectId/buckets", requireProjectAccess, async (req, res, next) => {
  try {
    const limit  = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const cursor = req.query.cursor as string | undefined;

    const buckets = await prisma.storageBucket.findMany({
      where:   { projectId: req.params.projectId },
      include: { objects: true },
      orderBy: { createdAt: "desc" },
      take:   limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasNextPage = buckets.length > limit;
    const page        = hasNextPage ? buckets.slice(0, -1) : buckets;
    const nextCursor  = hasNextPage ? page[page.length - 1]?.id : null;

    res.json({ success: true, data: page, meta: { hasNextPage, nextCursor } });
  } catch (err) { next(err); }
});

// ── POST /api/v1/storage/:projectId/buckets ───────────────────────────────────

storageRouter.post("/:projectId/buckets", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body      = CreateBucketSchema.parse(req.body);
    const { user }  = req as unknown as AuthenticatedRequest;
    const projectId = req.params.projectId;

    // Quota enforcement — maxBuckets per plan
    const owner = await prisma.user.findFirst({
      where:  { projects: { some: { id: projectId } } },
      select: { plan: true, subscriptionEnd: true },
    });
    const effectivePlan = getEffectivePlan((owner?.plan ?? "free") as any, owner?.subscriptionEnd ?? null);
    const quota         = getPlanQuota(effectivePlan);

    const bucketCount = await prisma.storageBucket.count({ where: { projectId } });
    if (bucketCount >= quota.maxBuckets) {
      throw new AppError(
        429,
        "QUOTA_EXCEEDED",
        `Bucket quota exceeded (max ${quota.maxBuckets} for "${effectivePlan}" plan)`,
      );
    }

    const bucket = await prisma.storageBucket.create({
      data: { projectId, ...body },
    });

    await logActivity(prisma, projectId, user.email, {
      type:        "CREATE_BUCKET",
      description: `Storage bucket "${bucket.name}" created in ${bucket.location}`,
      resourceId:  bucket.id,
    });

    res.status(201).json({ success: true, data: bucket });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/storage/:projectId/buckets/:bucketId ───────────────────────

storageRouter.delete("/:projectId/buckets/:bucketId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const bucket = await prisma.storageBucket.findFirst({
      where: { id: req.params.bucketId, projectId: req.params.projectId },
    });
    if (!bucket) throw new AppError(404, "NOT_FOUND", "Bucket not found");

    await prisma.storageBucket.delete({ where: { id: req.params.bucketId } });

    await logActivity(prisma, req.params.projectId, user.email, {
      type:        "DELETE_BUCKET",
      description: `Storage bucket "${bucket.name}" deleted`,
      resourceId:  bucket.id,
      severity:    "WARNING",
    });

    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

// ── GET /api/v1/storage/:projectId/buckets/:bucketId/objects ──────────────────

storageRouter.get("/:projectId/buckets/:bucketId/objects", requireProjectAccess, async (req, res, next) => {
  try {
    // Verify bucket belongs to this project (prevents IDOR)
    const bucket = await prisma.storageBucket.findFirst({
      where: { id: req.params.bucketId, projectId: req.params.projectId },
    });
    if (!bucket) throw new AppError(404, "NOT_FOUND", "Bucket not found in this project");

    const objects = await prisma.storageObject.findMany({
      where:   { bucketId: req.params.bucketId },
      orderBy: { uploadedAt: "desc" },
    });
    res.json({ success: true, data: objects });
  } catch (err) { next(err); }
});

// ── POST /api/v1/storage/:projectId/buckets/:bucketId/objects ─────────────────

const UploadObjectSchema = z.object({
  name:        z.string().min(1).max(1024),
  sizeBytes:   z.coerce.number().int().min(0).max(5_368_709_120), // 5 GB max
  contentType: z.string().max(255).default("application/octet-stream"),
});

storageRouter.post("/:projectId/buckets/:bucketId/objects", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body = UploadObjectSchema.parse(req.body);

    // Verify bucket belongs to this project (prevents IDOR)
    const bucket = await prisma.storageBucket.findFirst({
      where: { id: req.params.bucketId, projectId: req.params.projectId },
    });
    if (!bucket) throw new AppError(404, "NOT_FOUND", "Bucket not found in this project");

    const [object] = await prisma.$transaction([
      prisma.storageObject.create({
        data: {
          bucketId:    req.params.bucketId,
          name:        body.name,
          sizeBytes:   BigInt(body.sizeBytes),
          contentType: body.contentType,
          etag:        Math.random().toString(36).slice(2, 14),
          generation:  Date.now().toString(),
        },
      }),
      // Update bucket size atomically with object creation
      prisma.storageBucket.update({
        where: { id: req.params.bucketId },
        data:  { totalSizeBytes: { increment: BigInt(body.sizeBytes) } },
      }),
    ]);

    res.status(201).json({ success: true, data: object });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/storage/:projectId/buckets/:bucketId/objects/:objectId ─────

storageRouter.delete("/:projectId/buckets/:bucketId/objects/:objectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;

    // Verify bucket belongs to project
    const bucket = await prisma.storageBucket.findFirst({
      where: { id: req.params.bucketId, projectId: req.params.projectId },
    });
    if (!bucket) throw new AppError(404, "NOT_FOUND", "Bucket not found in this project");

    const object = await prisma.storageObject.findFirst({
      where: { id: req.params.objectId, bucketId: req.params.bucketId },
    });
    if (!object) throw new AppError(404, "NOT_FOUND", "Object not found");

    await prisma.$transaction([
      prisma.storageObject.delete({ where: { id: req.params.objectId } }),
      prisma.storageBucket.update({
        where: { id: req.params.bucketId },
        data:  { totalSizeBytes: { decrement: object.sizeBytes } },
      }),
    ]);

    await logActivity(prisma, req.params.projectId, user.email, {
      type:        "DELETE_OBJECT",
      description: `Object "${object.name}" deleted from bucket "${bucket.name}"`,
      resourceId:  object.id,
    });

    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
