import { Router } from "express";
import { CreateArtifactRepoSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
export const artifactsRouter = Router();
artifactsRouter.use(requireAuth);
artifactsRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.artifactRepo.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});
artifactsRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateArtifactRepoSchema.parse(req.body);
    const r = await prisma.artifactRepo.create({ data: { ...body, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "ARTIFACT_REPO_CREATE", description: `Created artifact repo "${body.name}" (${body.format})` });
    res.status(201).json({ success: true, data: r }); } catch(e) { next(e); }
});
artifactsRouter.delete("/:projectId/:repoId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.artifactRepo.delete({ where: { id: req.params.repoId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "ARTIFACT_REPO_DELETE", description: `Deleted artifact repo ${req.params.repoId}` });
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
