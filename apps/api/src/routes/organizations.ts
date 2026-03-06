import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
export const organizationsRouter = Router();
organizationsRouter.use(requireAuth);

const CreateOrgSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9-]*$/), displayName: z.string().min(1).max(128), domain: z.string().default("") });
const CreateFolderSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9-]*$/), displayName: z.string().min(1).max(128), parentId: z.string().optional() });

organizationsRouter.get("/", async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    const orgs = await prisma.organization.findMany({ where: { ownerId: user.id }, include: { folders: true } });
    res.json({ success: true, data: orgs }); } catch(e) { next(e); }
});
organizationsRouter.post("/", async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateOrgSchema.parse(req.body);
    const org = await prisma.organization.create({ data: { ...body, ownerId: user.id } });
    res.status(201).json({ success: true, data: org }); } catch(e) { next(e); }
});
organizationsRouter.get("/:orgId/folders", async (req, res, next) => {
  try { const folders = await prisma.folder.findMany({ where: { orgId: req.params.orgId }, include: { children: true }, orderBy: { name: "asc" } });
    res.json({ success: true, data: folders }); } catch(e) { next(e); }
});
organizationsRouter.post("/:orgId/folders", async (req, res, next) => {
  try { const body = CreateFolderSchema.parse(req.body);
    const folder = await prisma.folder.create({ data: { ...body, orgId: req.params.orgId } });
    res.status(201).json({ success: true, data: folder }); } catch(e) { next(e); }
});
organizationsRouter.delete("/:orgId", async (req, res, next) => {
  try { await prisma.organization.delete({ where: { id: req.params.orgId } });
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
