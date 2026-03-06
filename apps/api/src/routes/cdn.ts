import { Router } from "express";
import { CreateCDNConfigSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
export const cdnRouter = Router();
cdnRouter.use(requireAuth);
cdnRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.cDNConfig.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});

cdnRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateCDNConfigSchema.parse(req.body);
    const r = await prisma.cDNConfig.create({ data: { ...body, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "CDN_CREATE", description: `Created CDN Config "${body.name}"` });
    ResourceTracker.onCreate(req.params.projectId, "CDN", r.id, body.name ?? r.id).catch(() => {});
    res.status(201).json({ success: true, data: r }); } catch(e) { next(e); }
});

cdnRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.cDNConfig.delete({ where: { id: req.params.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "CDN_DELETE", description: `Deleted CDN Config ${req.params.id}`, severity: "WARNING" });
    ResourceTracker.onDelete(req.params.projectId, "CDN", req.params.id ?? req.params.datasetId ?? "", "").catch(() => {});
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
