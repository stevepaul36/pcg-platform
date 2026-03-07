// apps/api/src/routes/firewall.ts
import { Router } from "express";
import { CreateFirewallRuleSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const firewallRouter = Router();
firewallRouter.use(requireAuth);

firewallRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const rules = await prisma.firewallRule.findMany({
      where: { projectId: req.params.projectId }, orderBy: { priority: "asc" },
    });
    res.json({ success: true, data: rules });
  } catch (err) { next(err); }
});

firewallRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateFirewallRuleSchema.parse(req.body);

    const rule = await prisma.firewallRule.create({
      data: {
        projectId:    req.params.projectId,
        name:         body.name,
        network:      body.network,
        direction:    body.direction,
        action:       body.action,
        priority:     body.priority,
        sourceRanges: body.sourceRanges,
        targetTags:   body.targetTags,
        protocols:    body.protocols,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "FIREWALL_CREATE", description: `Created firewall rule "${body.name}" (${body.direction} ${body.action})`,
      resourceId: rule.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "FIREWALL_RULE", rule.id, rule.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: rule });
  } catch (err) { next(err); }
});

firewallRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const rule     = await prisma.firewallRule.findFirst({ where: { id: req.params.id, projectId: req.params.projectId } });
    if (!rule) throw new AppError(404, "NOT_FOUND", "Firewall rule not found");

    await prisma.firewallRule.delete({ where: { id: rule.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "FIREWALL_DELETE", description: `Deleted firewall rule "${rule.name}"`,
      resourceId: rule.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "FIREWALL_RULE", rule.id, rule.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
