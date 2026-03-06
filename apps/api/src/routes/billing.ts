import { Router } from "express";
import { requireAuth, requireProjectAccess, AuthenticatedRequest } from "../middleware/auth";
import { BillingEngine } from "../services/billingEngine";
export const billingRouter = Router();
billingRouter.use(requireAuth);
billingRouter.get("/:projectId/costs", requireProjectAccess, async (req, res, next) => {
  try { const costs = await BillingEngine.getProjectCosts(req.params.projectId);
    res.json({ success: true, data: costs }); } catch(e) { next(e); }
});
billingRouter.get("/:projectId/summary", requireProjectAccess, async (req, res, next) => {
  try { const summary = await BillingEngine.getProjectCostSummary(req.params.projectId);
    res.json({ success: true, data: summary }); } catch(e) { next(e); }
});
