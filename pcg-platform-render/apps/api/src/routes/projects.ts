// apps/api/src/routes/projects.ts

import { Router } from "express";
import { z }      from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logActivity } from "../services/activityLog";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

// ── GET /api/v1/projects ──────────────────────────────────────────────────────

projectsRouter.get("/", async (req, res, next) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { iamMembers: { some: { email: user.email } } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: projects });
  } catch (err) { next(err); }
});

// ── GET /api/v1/projects/:projectId ───────────────────────────────────────────

projectsRouter.get("/:projectId", async (req, res, next) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.projectId,
        OR: [
          { ownerId: user.id },
          { iamMembers: { some: { email: user.email } } },
        ],
      },
      include: {
        _count: { select: { vms: true, buckets: true, sqlInstances: true } },
      },
    });

    if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/projects/:projectId ─────────────────────────────────────────

const UpdateProjectSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(128),
});

projectsRouter.patch("/:projectId", async (req, res, next) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const body = UpdateProjectSchema.parse(req.body);

    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, ownerId: user.id },
    });
    if (!project) throw new AppError(403, "FORBIDDEN", "Only the project owner can update settings");

    const updated = await prisma.project.update({
      where: { id: req.params.projectId },
      data: { displayName: body.displayName },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ── POST /api/v1/projects ─────────────────────────────────────────────────────
// Create a new project. Max 5 projects per user (prevents abuse).

const CreateProjectSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(128),
});

projectsRouter.post("/", async (req, res, next) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const body = CreateProjectSchema.parse(req.body);

    // Enforce per-user project limit
    const projectCount = await prisma.project.count({ where: { ownerId: user.id } });
    if (projectCount >= 5) {
      throw new AppError(429, "QUOTA_EXCEEDED", "Maximum 5 projects per account");
    }

    const projectName = `pcg-${Math.random().toString(36).slice(2, 10)}`;

    const project = await prisma.project.create({
      data: {
        name:        projectName,
        displayName: body.displayName,
        ownerId:     user.id,
        iamMembers: {
          create: { email: user.email, role: "Owner", type: "user", addedBy: "system" },
        },
      },
    });

    await logActivity(prisma, project.id, user.email, {
      type:        "CREATE_PROJECT",
      description: `Project "${body.displayName}" created`,
      resourceId:  project.id,
    });

    res.status(201).json({ success: true, data: project });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/projects/:projectId ────────────────────────────────────────
// Only the owner can delete. All child resources are cascade-deleted by Prisma.

projectsRouter.delete("/:projectId", async (req, res, next) => {
  try {
    const { user } = req as AuthenticatedRequest;

    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, ownerId: user.id },
    });
    if (!project) throw new AppError(403, "FORBIDDEN", "Only the project owner can delete a project");

    // Check for running VMs — refuse to delete if resources are still active
    const activeVMs = await prisma.vMInstance.count({
      where: { projectId: project.id, status: { in: ["RUNNING", "PROVISIONING"] } },
    });
    if (activeVMs > 0) {
      throw new AppError(
        409,
        "ACTIVE_RESOURCES",
        `Cannot delete project with ${activeVMs} active VM(s). Terminate all VMs first.`,
      );
    }

    await prisma.project.delete({ where: { id: project.id } });

    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
