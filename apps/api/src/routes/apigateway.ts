import { Router } from "express";
import { CreateApiGatewaySchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
export const apigatewayRouter = Router();
apigatewayRouter.use(requireAuth);
apigatewayRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.apiGateway.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});
apigatewayRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateApiGatewaySchema.parse(req.body);
    const gw = await prisma.apiGateway.create({ data: { ...body, projectId: req.params.projectId, gatewayUrl: `https://${body.name}-gateway.a.run.app` } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "API_GATEWAY_CREATE", description: `Created API gateway "${body.displayName}"` });
    res.status(201).json({ success: true, data: gw }); } catch(e) { next(e); }
});
apigatewayRouter.delete("/:projectId/:gwId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.apiGateway.delete({ where: { id: req.params.gwId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "API_GATEWAY_DELETE", description: `Deleted API gateway ${req.params.gwId}` });
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
