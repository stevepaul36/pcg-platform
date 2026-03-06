import { Router } from "express";
import { CreateServiceAccountSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
export const serviceaccountsRouter = Router();
serviceaccountsRouter.use(requireAuth);
serviceaccountsRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.serviceAccount.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});

serviceaccountsRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateServiceAccountSchema.parse(req.body);
    const email = `${body.name}@${req.params.projectId}.iam.gserviceaccount.com`;
    const r = await prisma.serviceAccount.create({ data: { ...body, email, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "SA_CREATE", description: `Created SA "${body.name}"` });
    res.status(201).json({ success: true, data: r }); } catch(e) { next(e); }
});
serviceaccountsRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.serviceAccount.delete({ where: { id: req.params.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "SA_DELETE", description: `Deleted Service Account ${req.params.id}`, severity: "WARNING" });
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
