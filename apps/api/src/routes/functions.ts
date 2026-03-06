// apps/api/src/routes/functions.ts
import { Router } from "express";
import { CreateFunctionSchema } from "@pcg/shared";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logActivity } from "../services/activityLog";
import { BillingService } from "../services/simulation";
import { BillingEngine } from "../services/billingEngine";

export const functionsRouter = Router();
functionsRouter.use(requireAuth);

functionsRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const fns = await prisma.cloudFunction.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: fns });
  } catch (err) { next(err); }
});

functionsRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body = CreateFunctionSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;
    const existing = await prisma.cloudFunction.findFirst({ where: { projectId: req.params.projectId, name: body.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Function "${body.name}" already exists`);

    // Accurate Cloud Functions pricing: invocation cost + compute (GB-seconds)
    const hourlyCost = BillingService.cloudFunctionHourlyCost(body.memoryMb);
    const fn = await prisma.cloudFunction.create({
      data: { ...body, projectId: req.params.projectId, hourlyCost, status: "DEPLOYING" },
    });

    // Start billing on deploy, not just when active
    BillingEngine.trackUsage(req.params.projectId, "CLOUD_FUNCTION", fn.id, fn.name, hourlyCost).catch(() => {});

    // Simulate deploy completing
    setTimeout(async () => {
      await prisma.cloudFunction.update({ where: { id: fn.id }, data: { status: "ACTIVE" } });
    }, 3000);

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "FUNCTION_CREATE", description: `Created Cloud Function ${body.name}`,
      resourceId: fn.id, severity: "INFO",
      metadata: { runtime: body.runtime, memoryMb: body.memoryMb, trigger: body.trigger, hourlyCost },
    });
    res.status(201).json({ success: true, data: fn });
  } catch (err) { next(err); }
});

functionsRouter.delete("/:projectId/:fnId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const fn = await prisma.cloudFunction.findFirst({ where: { id: req.params.fnId, projectId: req.params.projectId } });
    if (!fn) throw new AppError(404, "NOT_FOUND", "Function not found");
    await prisma.cloudFunction.delete({ where: { id: fn.id } });
    BillingEngine.stopUsage(fn.id).catch(() => {});
    await logActivity(prisma, req.params.projectId, user.email, { type: "FUNCTION_DELETE", description: `Deleted Cloud Function ${fn.name}`, resourceId: fn.id, severity: "WARNING" });
    res.json({ success: true });
  } catch (err) { next(err); }
});
