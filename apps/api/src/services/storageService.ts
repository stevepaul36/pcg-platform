import { prisma } from "../lib/prisma";
import { logActivity } from "./activityLog";
import { AppError } from "../middleware/errorHandler";

export class StorageService {
  static async listBuckets(projectId: string) {
    return prisma.storageBucket.findMany({ where: { projectId }, include: { objects: true }, orderBy: { createdAt: "desc" } });
  }

  static async createBucket(projectId: string, data: any, userEmail: string) {
    const existing = await prisma.storageBucket.findUnique({ where: { name: data.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Bucket "${data.name}" already exists`);
    const bucket = await prisma.storageBucket.create({ data: { ...data, projectId } });
    await logActivity(prisma, projectId, userEmail, { type: "BUCKET_CREATE", description: `Created bucket "${data.name}"`, resourceId: bucket.id });
    return bucket;
  }

  static async deleteBucket(projectId: string, bucketId: string, userEmail: string) {
    const bucket = await prisma.storageBucket.findFirst({ where: { id: bucketId, projectId } });
    if (!bucket) throw new AppError(404, "NOT_FOUND", "Bucket not found");
    await prisma.storageBucket.delete({ where: { id: bucketId } });
    await logActivity(prisma, projectId, userEmail, { type: "BUCKET_DELETE", description: `Deleted bucket "${bucket.name}"`, resourceId: bucketId, severity: "WARNING" });
  }

  static async uploadObject(projectId: string, bucketId: string, data: any, userEmail: string) {
    const bucket = await prisma.storageBucket.findFirst({ where: { id: bucketId, projectId } });
    if (!bucket) throw new AppError(404, "NOT_FOUND", "Bucket not found");
    const sizeBytes = BigInt(Math.floor(Math.random() * 50_000_000));
    const obj = await prisma.storageObject.create({ data: { ...data, bucketId, sizeBytes, contentType: data.contentType ?? "application/octet-stream" } });
    await prisma.storageBucket.update({ where: { id: bucketId }, data: { totalSizeBytes: { increment: sizeBytes } } });
    await logActivity(prisma, projectId, userEmail, { type: "OBJECT_CREATE", description: `Uploaded "${data.name}" to ${bucket.name}`, resourceId: obj.id });
    return obj;
  }

  static async deleteObject(projectId: string, bucketId: string, objectId: string, userEmail: string) {
    const obj = await prisma.storageObject.findFirst({ where: { id: objectId, bucketId } });
    if (!obj) throw new AppError(404, "NOT_FOUND", "Object not found");
    await prisma.storageObject.delete({ where: { id: objectId } });
    await logActivity(prisma, projectId, userEmail, { type: "OBJECT_DELETE", description: `Deleted "${obj.name}"`, resourceId: objectId, severity: "WARNING" });
  }
}
