// apps/api/src/routes/serviceaccounts.ts
import { Router } from "express";
import { CreateServiceAccountSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }      from "../lib/prisma";
import { logActivity } from "../services/activityLog";
import { AppError }    from "../middleware/errorHandler";

export const serviceaccountsRouter = Router();
serviceaccountsRouter.use(requireAuth);

serviceaccountsRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const accounts = await prisma.serviceAccount.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: accounts });
  } catch (err) { next(err); }
});

serviceaccountsRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateServiceAccountSchema.parse(req.body);

    const existing = await prisma.serviceAccount.findFirst({ where: { projectId: req.params.projectId, name: body.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Service account "${body.name}" already exists`);

    const email   = `${body.name}@${req.params.projectId}.iam.gserviceaccount.com`;
    const account = await prisma.serviceAccount.create({
      data: {
        projectId:   req.params.projectId,
        name:        body.name,
        displayName: body.displayName,
        description: body.description,
        email,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "SA_CREATE", description: `Created service account "${body.name}"`,
      resourceId: account.id,
    });
    res.status(201).json({ success: true, data: account });
  } catch (err) { next(err); }
});

serviceaccountsRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const account  = await prisma.serviceAccount.findFirst({ where: { id: req.params.id, projectId: req.params.projectId } });
    if (!account) throw new AppError(404, "NOT_FOUND", "Service account not found");

    await prisma.serviceAccount.delete({ where: { id: account.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "SA_DELETE", description: `Deleted service account "${account.name}"`,
      resourceId: account.id, severity: "WARNING",
    });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
