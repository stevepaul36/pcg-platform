// apps/api/src/routes/apigateway.ts
import { Router } from "express";
import { CreateApiGatewaySchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const apigatewayRouter = Router();
apigatewayRouter.use(requireAuth);

apigatewayRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const gateways = await prisma.apiGateway.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: gateways });
  } catch (err) { next(err); }
});

apigatewayRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateApiGatewaySchema.parse(req.body);

    const gw = await prisma.apiGateway.create({
      data: {
        projectId:    req.params.projectId,
        name:         body.name,
        displayName:  body.displayName,
        backendUrl:   body.backendUrl,
        region:       body.region,
        protocol:     body.protocol,
        authType:     body.authType,
        rateLimitRpm: body.rateLimitRpm,
        gatewayUrl:   `https://${body.name}-gateway.a.run.app`,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "API_GATEWAY_CREATE", description: `Created API Gateway "${body.displayName}"`, resourceId: gw.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "API_GATEWAY", gw.id, body.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: gw });
  } catch (err) { next(err); }
});

apigatewayRouter.delete("/:projectId/:gwId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const gw = await prisma.apiGateway.findFirst({ where: { id: req.params.gwId, projectId: req.params.projectId } });
    if (!gw) throw new AppError(404, "NOT_FOUND", "API Gateway not found");

    await prisma.apiGateway.delete({ where: { id: gw.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "API_GATEWAY_DELETE", description: `Deleted API Gateway "${gw.displayName}"`,
      resourceId: gw.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "API_GATEWAY", gw.id, gw.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
