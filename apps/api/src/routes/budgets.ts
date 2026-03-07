// apps/api/src/routes/budgets.ts
import { Router } from "express";
import { CreateBudgetSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }      from "../lib/prisma";
import { logActivity } from "../services/activityLog";
import { AppError }    from "../middleware/errorHandler";

export const budgetsRouter = Router();
budgetsRouter.use(requireAuth);

budgetsRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const budgets = await prisma.billingBudget.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: budgets });
  } catch (err) { next(err); }
});

budgetsRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateBudgetSchema.parse(req.body);

    const budget = await prisma.billingBudget.create({
      data: {
        projectId:     req.params.projectId,
        name:          body.name,
        amountUSD:     body.amountUSD,
        thresholds:    body.thresholds,
        notifyEmails:  body.notifyEmails,
        includeCredits: true,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "BUDGET_CREATE", description: `Created billing budget "${body.name}" ($${body.amountUSD})`,
      resourceId: budget.id,
    });
    res.status(201).json({ success: true, data: budget });
  } catch (err) { next(err); }
});

budgetsRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const budget   = await prisma.billingBudget.findFirst({ where: { id: req.params.id, projectId: req.params.projectId } });
    if (!budget) throw new AppError(404, "NOT_FOUND", "Budget not found");

    await prisma.billingBudget.delete({ where: { id: budget.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "BUDGET_DELETE", description: `Deleted billing budget "${budget.name}"`,
      resourceId: budget.id, severity: "WARNING",
    });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
