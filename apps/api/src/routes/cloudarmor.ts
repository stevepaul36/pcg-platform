import { Router } from "express";
import { CreateCloudArmorSchema } from "@pcg/shared";
import { Prisma } from "@prisma/client";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
export const cloudarmorRouter = Router();
cloudarmorRouter.use(requireAuth);
cloudarmorRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.cloudArmorPolicy.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});
cloudarmorRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateCloudArmorSchema.parse(req.body);
    const defaultRule = [{ priority: 2147483647, action: body.defaultAction, match: "*", description: "Default rule" }];
    const p = await prisma.cloudArmorPolicy.create({ data: { ...body, rules: defaultRule as unknown as Prisma.InputJsonValue, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "ARMOR_POLICY_CREATE", description: `Created Cloud Armor policy "${body.name}"` });
    ResourceTracker.onCreate(req.params.projectId, "CLOUD_ARMOR", r.id, body.name ?? r.id).catch(() => {});
    res.status(201).json({ success: true, data: p }); } catch(e) { next(e); }
});
cloudarmorRouter.delete("/:projectId/:policyId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.cloudArmorPolicy.delete({ where: { id: req.params.policyId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "ARMOR_POLICY_DELETE", description: `Deleted Cloud Armor policy ${req.params.policyId}` });
    ResourceTracker.onDelete(req.params.projectId, "CLOUD_ARMOR", req.params.id ?? req.params.datasetId ?? "", "").catch(() => {});
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
