import { prisma } from "../lib/prisma";
import { logActivity } from "./activityLog";
import { AppError } from "../middleware/errorHandler";

export class SecurityService {
  static async createSecret(projectId: string, data: any, userEmail: string) {
    const existing = await prisma.secretManagerSecret.findFirst({ where: { projectId, name: data.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Secret "${data.name}" already exists`);
    const s = await prisma.secretManagerSecret.create({ data: { ...data, projectId } });
    await logActivity(prisma, projectId, userEmail, { type: "SECRET_CREATE", description: `Created secret ${data.name}`, resourceId: s.id });
    return s;
  }
  static async createKeyRing(projectId: string, data: any, userEmail: string) {
    const ring = await prisma.kMSKeyRing.create({ data: { ...data, projectId }, include: { keys: true } });
    await logActivity(prisma, projectId, userEmail, { type: "KMS_KEYRING_CREATE", description: `Created keyring ${data.name}`, resourceId: ring.id });
    return ring;
  }
  static async createKey(projectId: string, ringId: string, data: any, userEmail: string) {
    const ring = await prisma.kMSKeyRing.findFirst({ where: { id: ringId, projectId } });
    if (!ring) throw new AppError(404, "NOT_FOUND", "Key ring not found");
    const key = await prisma.kMSKey.create({ data: { ...data, keyRingId: ring.id } });
    await logActivity(prisma, projectId, userEmail, { type: "KMS_KEY_CREATE", description: `Created key ${data.name}`, resourceId: key.id });
    return key;
  }
}
