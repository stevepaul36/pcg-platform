import { Router } from "express";
import { requireAuth, requireProjectAccess } from "../middleware/auth";
import { LifecycleEngine } from "../services/lifecycleEngine";
export const lifecycleRouter = Router();
lifecycleRouter.use(requireAuth);
lifecycleRouter.get("/:projectId/events", requireProjectAccess, async (req, res, next) => {
  try { const limit = parseInt(req.query.limit as string) || 50;
    const events = await LifecycleEngine.getProjectEvents(req.params.projectId, limit);
    res.json({ success: true, data: events }); } catch(e) { next(e); }
});
lifecycleRouter.get("/:projectId/resource/:resourceId", requireProjectAccess, async (req, res, next) => {
  try { const history = await LifecycleEngine.getResourceHistory(req.params.resourceId);
    res.json({ success: true, data: history }); } catch(e) { next(e); }
});
