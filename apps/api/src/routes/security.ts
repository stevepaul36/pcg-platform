// apps/api/src/routes/security.ts
import { Router } from "express";
import { CreateSecretSchema, CreateKMSKeyRingSchema, CreateKMSKeySchema } from "@pcg/shared";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logActivity } from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";

export const securityRouter = Router();
securityRouter.use(requireAuth);

// ── Secret Manager ─────────────────────────────────────────────────────────────
securityRouter.get("/:projectId/secrets", requireProjectAccess, async (req, res, next) => {
  try {
    const secrets = await prisma.secretManagerSecret.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } });
    res.json({ success: true, data: secrets });
  } catch (err) { next(err); }
});

securityRouter.post("/:projectId/secrets", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body = CreateSecretSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;
    const existing = await prisma.secretManagerSecret.findFirst({ where: { projectId: req.params.projectId, name: body.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Secret "${body.name}" already exists`);
    const secret = await prisma.secretManagerSecret.create({ data: { ...body, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "SECRET_CREATE", description: `Created secret ${body.name}`, resourceId: secret.id, severity: "INFO" });
    ResourceTracker.onCreate(req.params.projectId, "SECRET", r.id, body.name ?? r.id).catch(() => {});
    res.status(201).json({ success: true, data: secret });
  } catch (err) { next(err); }
});

securityRouter.delete("/:projectId/secrets/:secretId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const secret = await prisma.secretManagerSecret.findFirst({ where: { id: req.params.secretId, projectId: req.params.projectId } });
    if (!secret) throw new AppError(404, "NOT_FOUND", "Secret not found");
    await prisma.secretManagerSecret.delete({ where: { id: secret.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "SECRET_DELETE", description: `Deleted secret ${secret.name}`, resourceId: secret.id, severity: "WARNING" });
    ResourceTracker.onDelete(req.params.projectId, "SECRET", req.params.id ?? req.params.datasetId ?? "", "").catch(() => {});
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── KMS ────────────────────────────────────────────────────────────────────────
securityRouter.get("/:projectId/keyrings", requireProjectAccess, async (req, res, next) => {
  try {
    const rings = await prisma.kMSKeyRing.findMany({ where: { projectId: req.params.projectId }, include: { keys: true }, orderBy: { createdAt: "desc" } });
    res.json({ success: true, data: rings });
  } catch (err) { next(err); }
});

securityRouter.post("/:projectId/keyrings", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body = CreateKMSKeyRingSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;
    const existing = await prisma.kMSKeyRing.findFirst({ where: { projectId: req.params.projectId, name: body.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Key ring "${body.name}" already exists`);
    const ring = await prisma.kMSKeyRing.create({ data: { ...body, projectId: req.params.projectId }, include: { keys: true } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "KMS_KEYRING_CREATE", description: `Created KMS key ring ${body.name}`, resourceId: ring.id, severity: "INFO" });
    res.status(201).json({ success: true, data: ring });
  } catch (err) { next(err); }
});

securityRouter.post("/:projectId/keyrings/:ringId/keys", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body = CreateKMSKeySchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;
    const ring = await prisma.kMSKeyRing.findFirst({ where: { id: req.params.ringId, projectId: req.params.projectId } });
    if (!ring) throw new AppError(404, "NOT_FOUND", "Key ring not found");
    const key = await prisma.kMSKey.create({ data: { ...body, keyRingId: ring.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "KMS_KEY_CREATE", description: `Created KMS key ${body.name}`, resourceId: key.id, severity: "INFO" });
    res.status(201).json({ success: true, data: key });
  } catch (err) { next(err); }
});

securityRouter.delete("/:projectId/keyrings/:ringId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const ring = await prisma.kMSKeyRing.findFirst({ where: { id: req.params.ringId, projectId: req.params.projectId } });
    if (!ring) throw new AppError(404, "NOT_FOUND", "Key ring not found");
    await prisma.kMSKeyRing.delete({ where: { id: ring.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "KMS_KEYRING_DELETE", description: `Deleted KMS key ring ${ring.name}`, resourceId: ring.id, severity: "WARNING" });
    res.json({ success: true });
  } catch (err) { next(err); }
});
