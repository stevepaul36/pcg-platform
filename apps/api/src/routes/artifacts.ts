// apps/api/src/routes/artifacts.ts
import { Router } from "express";
import { CreateArtifactRepoSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const artifactsRouter = Router();
artifactsRouter.use(requireAuth);

artifactsRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const repos = await prisma.artifactRepo.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: repos });
  } catch (err) { next(err); }
});

artifactsRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateArtifactRepoSchema.parse(req.body);

    const repo = await prisma.artifactRepo.create({
      data: {
        projectId:     req.params.projectId,
        name:          body.name,
        format:        body.format,
        location:      body.location,
        description:   body.description,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "ARTIFACT_REPO_CREATE", description: `Created Artifact Registry repo "${body.name}" (${body.format})`,
      resourceId: repo.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "ARTIFACT_REPO", repo.id, repo.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: repo });
  } catch (err) { next(err); }
});

artifactsRouter.delete("/:projectId/:repoId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const repo = await prisma.artifactRepo.findFirst({ where: { id: req.params.repoId, projectId: req.params.projectId } });
    if (!repo) throw new AppError(404, "NOT_FOUND", "Artifact repo not found");

    await prisma.artifactRepo.delete({ where: { id: repo.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "ARTIFACT_REPO_DELETE", description: `Deleted Artifact Registry repo "${repo.name}"`,
      resourceId: repo.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "ARTIFACT_REPO", repo.id, repo.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
