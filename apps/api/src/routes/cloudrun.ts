// apps/api/src/routes/cloudrun.ts
import { Router } from "express";
import { CreateCloudRunSchema } from "@pcg/shared";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logActivity } from "../services/activityLog";

export const cloudrunRouter = Router();
cloudrunRouter.use(requireAuth);

cloudrunRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const services = await prisma.cloudRunService.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: services });
  } catch (err) { next(err); }
});

cloudrunRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body = CreateCloudRunSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;
    const existing = await prisma.cloudRunService.findFirst({ where: { projectId: req.params.projectId, name: body.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Service "${body.name}" already exists`);
    const cpuNum = parseFloat(body.cpu);
    const hourlyCost = (cpuNum * 0.000024 + body.memoryMb * 0.0000025) * body.minInstances;
    const url = `https://${body.name}-${Math.random().toString(36).slice(2,8)}-${body.region.replace(/-/g, "")}.a.run.app`;
    const svc = await prisma.cloudRunService.create({
      data: { ...body, projectId: req.params.projectId, status: "DEPLOYING", url, hourlyCost },
    });
    setTimeout(async () => {
      await prisma.cloudRunService.update({ where: { id: svc.id }, data: { status: "ACTIVE" } });
    }, 3000);
    await logActivity(prisma, req.params.projectId, user.email, { type: "CLOUDRUN_CREATE", description: `Deployed Cloud Run service ${body.name}`, resourceId: svc.id, severity: "INFO" });
    res.status(201).json({ success: true, data: svc });
  } catch (err) { next(err); }
});

cloudrunRouter.delete("/:projectId/:serviceId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const svc = await prisma.cloudRunService.findFirst({ where: { id: req.params.serviceId, projectId: req.params.projectId } });
    if (!svc) throw new AppError(404, "NOT_FOUND", "Service not found");
    await prisma.cloudRunService.delete({ where: { id: svc.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "CLOUDRUN_DELETE", description: `Deleted Cloud Run service ${svc.name}`, resourceId: svc.id, severity: "WARNING" });
    res.json({ success: true });
  } catch (err) { next(err); }
});
