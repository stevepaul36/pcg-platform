// apps/api/src/routes/monitoring.ts
import { Router } from "express";
import { CreateAlertPolicySchema, CreateUptimeCheckSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const monitoringRouter = Router();
monitoringRouter.use(requireAuth);

// ── Alert Policies ────────────────────────────────────────────────────────────

monitoringRouter.get("/:projectId/alerts", requireProjectAccess, async (req, res, next) => {
  try {
    const policies = await prisma.monitoringAlertPolicy.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: policies });
  } catch (err) { next(err); }
});

monitoringRouter.post("/:projectId/alerts", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateAlertPolicySchema.parse(req.body);

    const policy = await prisma.monitoringAlertPolicy.create({
      data: {
        projectId:     req.params.projectId,
        name:          body.name,
        displayName:   body.displayName,
        conditionType: body.conditionType,
        metricType:    body.metricType,
        threshold:     body.threshold,
        duration:      body.duration,
        notifyEmails:  body.notifyEmails,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "MONITORING_ALERT_CREATE", description: `Created alert policy "${body.displayName}"`,
      resourceId: policy.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "MONITORING_ALERT", policy.id, policy.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: policy });
  } catch (err) { next(err); }
});

monitoringRouter.delete("/:projectId/alerts/:alertId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const policy   = await prisma.monitoringAlertPolicy.findFirst({ where: { id: req.params.alertId, projectId: req.params.projectId } });
    if (!policy) throw new AppError(404, "NOT_FOUND", "Alert policy not found");

    await prisma.monitoringAlertPolicy.delete({ where: { id: policy.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "MONITORING_ALERT_DELETE", description: `Deleted alert policy "${policy.displayName}"`,
      resourceId: policy.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "MONITORING_ALERT", policy.id, policy.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

// ── Uptime Checks ─────────────────────────────────────────────────────────────

monitoringRouter.get("/:projectId/uptime", requireProjectAccess, async (req, res, next) => {
  try {
    const checks = await prisma.uptimeCheck.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: checks });
  } catch (err) { next(err); }
});

monitoringRouter.post("/:projectId/uptime", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateUptimeCheckSchema.parse(req.body);

    const check = await prisma.uptimeCheck.create({
      data: {
        projectId:     req.params.projectId,
        displayName:   body.displayName,
        monitoredUrl:  body.monitoredUrl,
        checkInterval: body.checkInterval,
        timeout:       body.timeout,
        regions:       body.regions,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "UPTIME_CHECK_CREATE", description: `Created uptime check "${body.displayName}"`,
      resourceId: check.id,
    });
    res.status(201).json({ success: true, data: check });
  } catch (err) { next(err); }
});

monitoringRouter.delete("/:projectId/uptime/:checkId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const check    = await prisma.uptimeCheck.findFirst({ where: { id: req.params.checkId, projectId: req.params.projectId } });
    if (!check) throw new AppError(404, "NOT_FOUND", "Uptime check not found");

    await prisma.uptimeCheck.delete({ where: { id: check.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "UPTIME_CHECK_DELETE", description: `Deleted uptime check "${check.displayName}"`,
      resourceId: check.id, severity: "WARNING",
    });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
