// apps/api/src/routes/pubsub.ts
import { Router } from "express";
import { z } from "zod";
import { CreatePubSubTopicSchema } from "@pcg/shared";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logActivity } from "../services/activityLog";

export const pubsubRouter = Router();
pubsubRouter.use(requireAuth);

// GET /api/v1/pubsub/:projectId
pubsubRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const topics = await prisma.pubSubTopic.findMany({
      where: { projectId: req.params.projectId },
      include: { subscriptions: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: topics });
  } catch (err) { next(err); }
});

// POST /api/v1/pubsub/:projectId/topics
pubsubRouter.post("/:projectId/topics", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body = CreatePubSubTopicSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;
    const existing = await prisma.pubSubTopic.findFirst({ where: { projectId: req.params.projectId, name: body.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Topic "${body.name}" already exists`);
    const topic = await prisma.pubSubTopic.create({ data: { ...body, projectId: req.params.projectId }, include: { subscriptions: true } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "PUBSUB_TOPIC_CREATE", description: `Created Pub/Sub topic ${body.name}`, resourceId: topic.id, severity: "INFO" });
    res.status(201).json({ success: true, data: topic });
  } catch (err) { next(err); }
});

// DELETE /api/v1/pubsub/:projectId/topics/:topicId
pubsubRouter.delete("/:projectId/topics/:topicId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const topic = await prisma.pubSubTopic.findFirst({ where: { id: req.params.topicId, projectId: req.params.projectId } });
    if (!topic) throw new AppError(404, "NOT_FOUND", "Topic not found");
    await prisma.pubSubTopic.delete({ where: { id: topic.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "PUBSUB_TOPIC_DELETE", description: `Deleted Pub/Sub topic ${topic.name}`, resourceId: topic.id, severity: "WARNING" });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/v1/pubsub/:projectId/topics/:topicId/subscriptions
const CreateSubSchema = z.object({
  name: z.string().min(1).max(255),
  ackDeadline: z.number().int().min(10).max(600).default(10),
});

pubsubRouter.post("/:projectId/topics/:topicId/subscriptions", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body = CreateSubSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;
    const topic = await prisma.pubSubTopic.findFirst({ where: { id: req.params.topicId, projectId: req.params.projectId } });
    if (!topic) throw new AppError(404, "NOT_FOUND", "Topic not found");
    const sub = await prisma.pubSubSubscription.create({ data: { ...body, topicId: topic.id, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "PUBSUB_SUB_CREATE", description: `Created subscription ${body.name}`, resourceId: sub.id, severity: "INFO" });
    res.status(201).json({ success: true, data: sub });
  } catch (err) { next(err); }
});

// DELETE /api/v1/pubsub/:projectId/subscriptions/:subId
pubsubRouter.delete("/:projectId/subscriptions/:subId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const sub = await prisma.pubSubSubscription.findFirst({ where: { id: req.params.subId, projectId: req.params.projectId } });
    if (!sub) throw new AppError(404, "NOT_FOUND", "Subscription not found");
    await prisma.pubSubSubscription.delete({ where: { id: sub.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "PUBSUB_SUB_DELETE", description: `Deleted subscription ${sub.name}`, resourceId: sub.id, severity: "WARNING" });
    res.json({ success: true });
  } catch (err) { next(err); }
});
