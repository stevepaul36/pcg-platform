import { Router } from "express";
import { CreateFirewallRuleSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
export const firewallRouter = Router();
firewallRouter.use(requireAuth);
firewallRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.firewallRule.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});

firewallRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateFirewallRuleSchema.parse(req.body);
    const r = await prisma.firewallRule.create({ data: { ...body, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "FIREWALL_CREATE", description: `Created Firewall Rule "${body.name}"` });
    res.status(201).json({ success: true, data: r }); } catch(e) { next(e); }
});

firewallRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.firewallRule.delete({ where: { id: req.params.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "FIREWALL_DELETE", description: `Deleted Firewall Rule ${req.params.id}`, severity: "WARNING" });
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
