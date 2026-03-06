// apps/api/src/routes/monitoring.ts
import { Router } from "express";
import { CreateAlertPolicySchema, CreateUptimeCheckSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";

export const monitoringRouter = Router();
monitoringRouter.use(requireAuth);

monitoringRouter.get("/:projectId/alerts", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.monitoringAlertPolicy.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});
monitoringRouter.post("/:projectId/alerts", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateAlertPolicySchema.parse(req.body);
    const p = await prisma.monitoringAlertPolicy.create({ data: { ...body, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "MONITORING_ALERT_CREATE", description: `Created alert policy "${body.displayName}"` });
    res.status(201).json({ success: true, data: p }); } catch(e) { next(e); }
});
monitoringRouter.delete("/:projectId/alerts/:alertId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.monitoringAlertPolicy.delete({ where: { id: req.params.alertId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "MONITORING_ALERT_DELETE", description: `Deleted alert policy ${req.params.alertId}` });
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});

monitoringRouter.get("/:projectId/uptime", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.uptimeCheck.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});
monitoringRouter.post("/:projectId/uptime", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateUptimeCheckSchema.parse(req.body);
    const u = await prisma.uptimeCheck.create({ data: { ...body, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "UPTIME_CHECK_CREATE", description: `Created uptime check "${body.displayName}"` });
    res.status(201).json({ success: true, data: u }); } catch(e) { next(e); }
});
monitoringRouter.delete("/:projectId/uptime/:checkId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.uptimeCheck.delete({ where: { id: req.params.checkId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "UPTIME_CHECK_DELETE", description: `Deleted uptime check ${req.params.checkId}` });
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
