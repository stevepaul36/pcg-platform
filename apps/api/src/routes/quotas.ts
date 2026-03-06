import { Router } from "express";
import { requireAuth, requireProjectAccess, AuthenticatedRequest } from "../middleware/auth";
import { QuotaEngine } from "../services/quotaEngine";
export const quotasRouter = Router();
quotasRouter.use(requireAuth);
quotasRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { const quotas = await QuotaEngine.getProjectQuotas(req.params.projectId);
    res.json({ success: true, data: quotas }); } catch(e) { next(e); }
});
