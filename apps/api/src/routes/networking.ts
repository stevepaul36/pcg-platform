// apps/api/src/routes/networking.ts
import { Router } from "express";
import { CreateVPCSchema, CreateLoadBalancerSchema, CreateDNSZoneSchema } from "@pcg/shared";
import { prisma }          from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError }        from "../middleware/errorHandler";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { SimulationService } from "../services/simulation";
import { logger }          from "../lib/logger";

export const networkingRouter = Router();
networkingRouter.use(requireAuth);

// ── VPC Networks ──────────────────────────────────────────────────────────────

networkingRouter.get("/:projectId/vpcs", requireProjectAccess, async (req, res, next) => {
  try {
    const vpcs = await prisma.vPCNetwork.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: vpcs });
  } catch (err) { next(err); }
});

networkingRouter.post("/:projectId/vpcs", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body     = CreateVPCSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;

    const existing = await prisma.vPCNetwork.findFirst({ where: { projectId: req.params.projectId, name: body.name } });
    if (existing) throw new AppError(409, "CONFLICT", `VPC "${body.name}" already exists`);

    const vpc = await prisma.vPCNetwork.create({
      data: {
        projectId: req.params.projectId,
        name:      body.name,
        subnet:    body.subnet,
        region:    body.region,
        mode:      body.mode,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "VPC_CREATE", description: `Created VPC network "${body.name}"`, resourceId: vpc.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "VPC", vpc.id, vpc.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: vpc });
  } catch (err) { next(err); }
});

networkingRouter.delete("/:projectId/vpcs/:vpcId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const vpc      = await prisma.vPCNetwork.findFirst({ where: { id: req.params.vpcId, projectId: req.params.projectId } });
    if (!vpc) throw new AppError(404, "NOT_FOUND", "VPC not found");

    await prisma.vPCNetwork.delete({ where: { id: vpc.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "VPC_DELETE", description: `Deleted VPC network "${vpc.name}"`,
      resourceId: vpc.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "VPC", vpc.id, vpc.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

// ── Load Balancers ────────────────────────────────────────────────────────────

networkingRouter.get("/:projectId/loadbalancers", requireProjectAccess, async (req, res, next) => {
  try {
    const lbs = await prisma.loadBalancer.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: lbs });
  } catch (err) { next(err); }
});

networkingRouter.post("/:projectId/loadbalancers", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body     = CreateLoadBalancerSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;

    const existing = await prisma.loadBalancer.findFirst({ where: { projectId: req.params.projectId, name: body.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Load balancer "${body.name}" already exists`);

    const lb = await prisma.loadBalancer.create({
      data: {
        projectId:  req.params.projectId,
        name:       body.name,
        type:       body.type,
        region:     body.region,
        backends:   body.backends,
        ip:         SimulationService.generateExternalIP(),
        status:     "ACTIVE",
        hourlyCost: 0.025,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "LB_CREATE", description: `Created ${body.type} load balancer "${body.name}"`, resourceId: lb.id,
    });
    res.status(201).json({ success: true, data: lb });
  } catch (err) { next(err); }
});

networkingRouter.delete("/:projectId/loadbalancers/:lbId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const lb       = await prisma.loadBalancer.findFirst({ where: { id: req.params.lbId, projectId: req.params.projectId } });
    if (!lb) throw new AppError(404, "NOT_FOUND", "Load balancer not found");

    await prisma.loadBalancer.delete({ where: { id: lb.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "LB_DELETE", description: `Deleted load balancer "${lb.name}"`,
      resourceId: lb.id, severity: "WARNING",
    });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

// ── Cloud DNS ─────────────────────────────────────────────────────────────────

networkingRouter.get("/:projectId/dns", requireProjectAccess, async (req, res, next) => {
  try {
    const zones = await prisma.cloudDNSZone.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: zones });
  } catch (err) { next(err); }
});

networkingRouter.post("/:projectId/dns", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body     = CreateDNSZoneSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;

    const existing = await prisma.cloudDNSZone.findFirst({ where: { projectId: req.params.projectId, name: body.name } });
    if (existing) throw new AppError(409, "CONFLICT", `DNS zone "${body.name}" already exists`);

    const zone = await prisma.cloudDNSZone.create({
      data: {
        projectId:   req.params.projectId,
        name:        body.name,
        dnsName:     body.dnsName,
        visibility:  body.visibility,
        recordCount: 2,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "DNS_ZONE_CREATE", description: `Created DNS zone "${body.dnsName}"`, resourceId: zone.id,
    });
    res.status(201).json({ success: true, data: zone });
  } catch (err) { next(err); }
});

networkingRouter.delete("/:projectId/dns/:zoneId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const zone     = await prisma.cloudDNSZone.findFirst({ where: { id: req.params.zoneId, projectId: req.params.projectId } });
    if (!zone) throw new AppError(404, "NOT_FOUND", "DNS zone not found");

    await prisma.cloudDNSZone.delete({ where: { id: zone.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "DNS_ZONE_DELETE", description: `Deleted DNS zone "${zone.dnsName}"`,
      resourceId: zone.id, severity: "WARNING",
    });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
