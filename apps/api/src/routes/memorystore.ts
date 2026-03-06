import { Router } from "express";
import { CreateMemorystoreSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
export const memorystoreRouter = Router();
memorystoreRouter.use(requireAuth);
memorystoreRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.memorystoreInstance.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});
memorystoreRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateMemorystoreSchema.parse(req.body);
    const costMap: Record<string, number> = { BASIC: 0.049, STANDARD_HA: 0.098 };
    const cost = (costMap[body.tier] ?? 0.049) * body.memorySizeGb;
    const ip = `10.${Math.floor(Math.random()*200)+10}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
    const inst = await prisma.memorystoreInstance.create({ data: { ...body, projectId: req.params.projectId, host: ip, port: body.engine === "REDIS" ? 6379 : 11211, highAvailability: body.tier === "STANDARD_HA", hourlyCost: cost } });
    setTimeout(async () => { try { await prisma.memorystoreInstance.update({ where: { id: inst.id }, data: { status: "READY" } }); } catch {} }, 3000);
    await logActivity(prisma, req.params.projectId, user.email, { type: "MEMORYSTORE_CREATE", description: `Created ${body.engine} instance "${body.name}" (${body.memorySizeGb}GB)` });
    ResourceTracker.onCreate(req.params.projectId, "MEMORYSTORE", r.id, body.name ?? r.id).catch(() => {});
    res.status(201).json({ success: true, data: inst }); } catch(e) { next(e); }
});
memorystoreRouter.delete("/:projectId/:instId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.memorystoreInstance.delete({ where: { id: req.params.instId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "MEMORYSTORE_DELETE", description: `Deleted Memorystore instance ${req.params.instId}` });
    ResourceTracker.onDelete(req.params.projectId, "MEMORYSTORE", req.params.id ?? req.params.datasetId ?? "", "").catch(() => {});
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
