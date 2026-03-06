// apps/api/src/routes/logs.ts

import { Router } from "express";
import { z }      from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectAccess } from "../middleware/auth";

export const logsRouter = Router();
logsRouter.use(requireAuth);

const LogQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  type:   z.string().optional(),
});

// ── GET /api/v1/logs/:projectId ───────────────────────────────────────────────

logsRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const { limit, cursor, type } = LogQuerySchema.parse(req.query);

    const logs = await prisma.activityLog.findMany({
      where: {
        projectId: req.params.projectId,
        ...(type && { type }),
      },
      orderBy: { timestamp: "desc" },
      take:   limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasNextPage = logs.length > limit;
    const page        = hasNextPage ? logs.slice(0, -1) : logs;
    const nextCursor  = hasNextPage ? page[page.length - 1]?.id : null;

    res.json({
      success: true,
      data:    page,
      meta:    { hasNextPage, nextCursor },
    });
  } catch (err) { next(err); }
});
