// apps/api/src/routes/announcements.ts

import { Router }   from "express";
import { z }        from "zod";
import { CreateAnnouncementSchema } from "@pcg/shared";
import { prisma }   from "../lib/prisma";
import { requireAuth, requireAdmin, AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const announcementsRouter = Router();

const PaginationSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),   // id of the last item from the previous page
});

// ── GET /api/v1/announcements ─────────────────────────────────────────────────
// Public. Cursor-based pagination. Returns non-expired announcements,
// pinned entries first, then newest-first.

announcementsRouter.get("/", async (req, res, next) => {
  try {
    const { limit, cursor } = PaginationSchema.parse(req.query);
    const now = new Date();

    const announcements = await prisma.announcement.findMany({
      where: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take:   limit + 1,                    // fetch one extra to detect next page
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasNextPage = announcements.length > limit;
    const page        = hasNextPage ? announcements.slice(0, -1) : announcements;
    const nextCursor  = hasNextPage ? page[page.length - 1]?.id : null;

    res.json({
      success: true,
      data:    page,
      meta:    { hasNextPage, nextCursor },
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/announcements ────────────────────────────────────────────────
// Admin only. (Any logged-in user in original — security gap fixed.)

announcementsRouter.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body    = CreateAnnouncementSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;

    const announcement = await prisma.announcement.create({
      data: {
        title:       body.title,
        body:        body.body,
        type:        body.type,
        pinned:      body.pinned,
        expiresAt:   body.expiresAt ? new Date(body.expiresAt) : null,
        authorEmail: user.email,
      },
    });

    res.status(201).json({ success: true, data: announcement });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/announcements/:id ──────────────────────────────────────────
// Admin only.

const UpdateAnnouncementSchema = z.object({
  title:     z.string().min(3).max(120).optional(),
  body:      z.string().min(10).max(4000).optional(),
  type:      z.enum(["info", "warning", "feature", "maintenance"]).optional(),
  pinned:    z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

announcementsRouter.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = UpdateAnnouncementSchema.parse(req.body);

    const ann = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!ann) throw new AppError(404, "NOT_FOUND", "Announcement not found");

    const updated = await prisma.announcement.update({
      where: { id: req.params.id },
      data:  {
        ...body,
        ...(body.expiresAt !== undefined && {
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/announcements/:id ─────────────────────────────────────────
// Admin or original author.

announcementsRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const { user, isAdmin } = req as unknown as AuthenticatedRequest;

    const ann = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!ann) throw new AppError(404, "NOT_FOUND", "Announcement not found");

    if (!isAdmin && ann.authorEmail !== user.email) {
      throw new AppError(403, "FORBIDDEN", "You may only delete your own announcements");
    }

    await prisma.announcement.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
