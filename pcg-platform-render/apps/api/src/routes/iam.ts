// apps/api/src/routes/iam.ts

import { Router }      from "express";
import { AddIAMMemberSchema } from "@pcg/shared";
import { prisma }      from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError }    from "../middleware/errorHandler";
import { logActivity } from "../services/activityLog";

export const iamRouter = Router();
iamRouter.use(requireAuth);

// ── GET /api/v1/iam/:projectId ────────────────────────────────────────────────

iamRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const limit  = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const cursor = req.query.cursor as string | undefined;

    const members = await prisma.iAMMember.findMany({
      where:   { projectId: req.params.projectId },
      orderBy: { addedAt: "desc" },
      take:   limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasNextPage = members.length > limit;
    const page        = hasNextPage ? members.slice(0, -1) : members;
    const nextCursor  = hasNextPage ? page[page.length - 1]?.id : null;

    res.json({ success: true, data: page, meta: { hasNextPage, nextCursor } });
  } catch (err) { next(err); }
});

// ── POST /api/v1/iam/:projectId ───────────────────────────────────────────────

iamRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body     = AddIAMMemberSchema.parse(req.body);
    const { user } = req as AuthenticatedRequest;

    const member = await prisma.iAMMember.create({
      data: {
        projectId: req.params.projectId,
        email:     body.email,
        role:      body.role,
        type:      body.type,
        addedBy:   user.email,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type:        "ADD_IAM_MEMBER",
      description: `${body.email} granted "${body.role}" role`,
      resourceId:  member.id,
    });

    res.status(201).json({ success: true, data: member });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/iam/:projectId/:memberId ───────────────────────────────────

iamRouter.delete("/:projectId/:memberId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const member = await prisma.iAMMember.findFirst({
      where: { id: req.params.memberId, projectId: req.params.projectId },
    });
    if (!member) throw new AppError(404, "NOT_FOUND", "IAM member not found");

    if (member.role === "Owner" && member.email === user.email) {
      throw new AppError(400, "BAD_REQUEST", "Cannot remove yourself as project owner");
    }

    await prisma.iAMMember.delete({ where: { id: req.params.memberId } });

    await logActivity(prisma, req.params.projectId, user.email, {
      type:        "REMOVE_IAM_MEMBER",
      description: `${member.email} removed from "${member.role}" role`,
      resourceId:  member.id,
      severity:    "WARNING",
    });

    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
