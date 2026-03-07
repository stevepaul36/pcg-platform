// apps/api/src/routes/firestore.ts
import { Router } from "express";
import { CreateFirestoreDBSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const firestoreRouter = Router();
firestoreRouter.use(requireAuth);

firestoreRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const dbs = await prisma.firestoreDatabase.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: dbs });
  } catch (err) { next(err); }
});

firestoreRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateFirestoreDBSchema.parse(req.body);

    const db = await prisma.firestoreDatabase.create({
      data: {
        projectId:  req.params.projectId,
        name:       body.name,
        type:       body.type,
        locationId: body.locationId,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "FIRESTORE_CREATE", description: `Created Firestore database "${body.name}"`, resourceId: db.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "FIRESTORE", db.id, db.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: db });
  } catch (err) { next(err); }
});

firestoreRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const db       = await prisma.firestoreDatabase.findFirst({ where: { id: req.params.id, projectId: req.params.projectId } });
    if (!db) throw new AppError(404, "NOT_FOUND", "Firestore database not found");

    await prisma.firestoreDatabase.delete({ where: { id: db.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "FIRESTORE_DELETE", description: `Deleted Firestore database "${db.name}"`,
      resourceId: db.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "FIRESTORE", db.id, db.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
