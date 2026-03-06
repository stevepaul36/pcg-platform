import { Router } from "express";
import { requireAuth, requireProjectAccess, AuthenticatedRequest } from "../middleware/auth";
import { IAMEngine } from "../services/iamEngine";
export const iamrolesRouter = Router();
iamrolesRouter.use(requireAuth);
iamrolesRouter.get("/roles", async (_req, res, next) => {
  try { res.json({ success: true, data: IAMEngine.getAvailableRoles() }); } catch(e) { next(e); }
});
iamrolesRouter.get("/roles/:role/permissions", async (req, res, next) => {
  try { const perms = IAMEngine.getRolePermissions(req.params.role);
    res.json({ success: true, data: perms }); } catch(e) { next(e); }
});
iamrolesRouter.post("/:projectId/check", requireProjectAccess, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    const { permission } = req.body;
    const allowed = await IAMEngine.checkProjectPermission(req.params.projectId, user.email, permission);
    res.json({ success: true, data: { allowed } }); } catch(e) { next(e); }
});
