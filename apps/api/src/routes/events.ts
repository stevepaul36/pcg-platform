import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { eventBus } from "../services/eventBus";
export const eventsRouter = Router();
eventsRouter.use(requireAuth);
eventsRouter.get("/recent", async (req, res, next) => {
  try { const limit = parseInt(req.query.limit as string) || 50;
    res.json({ success: true, data: eventBus.getRecentEvents(limit) }); } catch(e) { next(e); }
});
