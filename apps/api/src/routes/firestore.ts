import { Router } from "express";
import { CreateFirestoreDBSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
export const firestoreRouter = Router();
firestoreRouter.use(requireAuth);
firestoreRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.firestoreDatabase.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});

firestoreRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateFirestoreDBSchema.parse(req.body);
    const r = await prisma.firestoreDatabase.create({ data: { ...body, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "FIRESTORE_CREATE", description: `Created Firestore DB "${body.name}"` });
    ResourceTracker.onCreate(req.params.projectId, "FIRESTORE", r.id, body.name ?? r.id).catch(() => {});
    res.status(201).json({ success: true, data: r }); } catch(e) { next(e); }
});

firestoreRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.firestoreDatabase.delete({ where: { id: req.params.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "FIRESTORE_DELETE", description: `Deleted Firestore DB ${req.params.id}`, severity: "WARNING" });
    ResourceTracker.onDelete(req.params.projectId, "FIRESTORE", req.params.id ?? req.params.datasetId ?? "", "").catch(() => {});
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
