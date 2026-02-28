// apps/api/src/routes/improvements.ts

import { Router }   from "express";
import { z }        from "zod";
import { CreateImprovementSchema } from "@pcg/shared";
import { prisma }   from "../lib/prisma";
import { requireAuth, requireAdmin, AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const improvementsRouter = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  status:   z.enum(["planned", "in_progress", "completed", "cancelled"]).optional(),
  category: z.enum(["feature", "bug", "performance", "ux"]).optional(),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  cursor:   z.string().optional(),
});

// Bug fix: original used `d.vote || d.status || d.priority` but `vote` is a
// boolean, so `{ vote: false }` would incorrectly fail the refinement check.
const PatchImprovementSchema = z.object({
  vote:     z.literal(true).optional(),           // upvote only; false is a no-op
  status:   z.enum(["planned", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
}).refine(d => d.vote === true || d.status !== undefined || d.priority !== undefined, {
  message: "Provide at least one of: vote, status, priority",
});

// ── GET /api/v1/improvements ──────────────────────────────────────────────────
// Public. Cursor-based pagination, sorted by votes → newest.

improvementsRouter.get("/", async (req, res, next) => {
  try {
    const { status, category, limit, cursor } = QuerySchema.parse(req.query);

    const improvements = await prisma.improvement.findMany({
      where: {
        ...(status   && { status }),
        ...(category && { category }),
      },
      orderBy: [{ votes: "desc" }, { createdAt: "desc" }],
      take:   limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasNextPage = improvements.length > limit;
    const page        = hasNextPage ? improvements.slice(0, -1) : improvements;
    const nextCursor  = hasNextPage ? page[page.length - 1]?.id : null;

    res.json({ success: true, data: page, meta: { hasNextPage, nextCursor } });
  } catch (err) { next(err); }
});

// ── POST /api/v1/improvements ─────────────────────────────────────────────────

improvementsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const body = CreateImprovementSchema.parse(req.body);
    const { user } = req as AuthenticatedRequest;

    const improvement = await prisma.improvement.create({
      data: { ...body, status: "planned", authorEmail: user.email },
    });
    res.status(201).json({ success: true, data: improvement });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/improvements/:id ───────────────────────────────────────────
// vote: any authenticated user, once per improvement (deduped via UserVote).
// status / priority: admin only.

improvementsRouter.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const body    = PatchImprovementSchema.parse(req.body);
    const { user, isAdmin } = req as AuthenticatedRequest;

    const imp = await prisma.improvement.findUnique({ where: { id: req.params.id } });
    if (!imp) throw new AppError(404, "NOT_FOUND", "Improvement not found");

    // Status / priority changes — admin only
    if ((body.status !== undefined || body.priority !== undefined) && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "Only admins can change status or priority");
    }

    const data: Record<string, unknown> = {};

    // Vote deduplication — one vote per user per improvement
    if (body.vote === true) {
      const existingVote = await prisma.userVote.findUnique({
        where: { userId_improvementId: { userId: user.id, improvementId: imp.id } },
      });

      if (existingVote) {
        throw new AppError(409, "ALREADY_VOTED", "You have already voted for this improvement");
      }

      // Atomic: create vote + increment count in a single transaction
      await prisma.$transaction([
        prisma.userVote.create({
          data: { userId: user.id, improvementId: imp.id },
        }),
        prisma.improvement.update({
          where: { id: imp.id },
          data:  { votes: { increment: 1 } },
        }),
      ]);
      data.votes = imp.votes + 1; // reflect in response without re-reading
    }

    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === "completed" && imp.status !== "completed") {
        data.completedAt = new Date();
      }
    }
    if (body.priority !== undefined) {
      data.priority = body.priority;
    }

    // Only issue an update if there are status/priority changes (vote is already persisted above)
    let updated: typeof imp;
    if (Object.keys(data).length > 0 && (data.status !== undefined || data.priority !== undefined)) {
      updated = await prisma.improvement.update({
        where: { id: req.params.id },
        data,
      });
    } else {
      // Re-read to get accurate vote count
      updated = (await prisma.improvement.findUnique({ where: { id: req.params.id } }))!;
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/improvements/:id ──────────────────────────────────────────
// Admin or original author.

improvementsRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const { user, isAdmin } = req as AuthenticatedRequest;

    const imp = await prisma.improvement.findUnique({ where: { id: req.params.id } });
    if (!imp) throw new AppError(404, "NOT_FOUND", "Improvement not found");

    if (!isAdmin && imp.authorEmail !== user.email) {
      throw new AppError(403, "FORBIDDEN", "You may only delete your own improvements");
    }

    await prisma.improvement.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
