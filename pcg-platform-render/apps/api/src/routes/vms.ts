// apps/api/src/routes/vms.ts

import { Router }      from "express";
import { z }           from "zod";
import { CreateVMSchema } from "@pcg/shared";
import { prisma }      from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError }    from "../middleware/errorHandler";
import { SimulationService, BillingService } from "../services/simulation";
import { logActivity } from "../services/activityLog";
import { getEffectivePlan, getPlanQuota } from "../services/subscription";

export const vmRouter = Router();
vmRouter.use(requireAuth);

// ── GET /api/v1/vms/:projectId ────────────────────────────────────────────────

vmRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const limit  = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const cursor = req.query.cursor as string | undefined;
    const status = req.query.status as string | undefined;

    const vms = await prisma.vMInstance.findMany({
      where: {
        projectId: req.params.projectId,
        ...(status && { status }),
      },
      orderBy: { createdAt: "desc" },
      take:   limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasNextPage = vms.length > limit;
    const page        = hasNextPage ? vms.slice(0, -1) : vms;
    const nextCursor  = hasNextPage ? page[page.length - 1]?.id : null;

    res.json({ success: true, data: page, meta: { hasNextPage, nextCursor } });
  } catch (err) { next(err); }
});

// ── POST /api/v1/vms/:projectId ───────────────────────────────────────────────

vmRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body      = CreateVMSchema.parse(req.body);
    const { user }  = req as AuthenticatedRequest;
    const projectId = req.params.projectId;

    // Resolve the project owner's plan for quota enforcement
    const owner = await prisma.user.findFirst({
      where:  { projects: { some: { id: projectId } } },
      select: { plan: true, subscriptionEnd: true },
    });
    const effectivePlan = getEffectivePlan((owner?.plan ?? "free") as any, owner?.subscriptionEnd ?? null);
    const quota         = getPlanQuota(effectivePlan);

    const activeCount = await prisma.vMInstance.count({
      where: { projectId, status: { not: "TERMINATED" } },
    });
    if (activeCount >= quota.maxVMs) {
      throw new AppError(
        429,
        "QUOTA_EXCEEDED",
        `VM quota exceeded (max ${quota.maxVMs} for the "${effectivePlan}" plan)`,
      );
    }

    // Name must be unique within the project (enforced by DB @@unique but caught here for UX)
    const existing = await prisma.vMInstance.findFirst({ where: { projectId, name: body.name } });
    if (existing) {
      throw new AppError(409, "CONFLICT", `VM named "${body.name}" already exists in this project`);
    }

    const costs = BillingService.computeVMCost(body.machineType, body.zone, body.diskGb, body.diskType);
    const spec  = SimulationService.getMachineSpec(body.machineType);

    const vm = await prisma.vMInstance.create({
      data: {
        projectId,
        name:           body.name,
        zone:           body.zone,
        region:         body.region,
        machineType:    body.machineType,
        vcpus:          spec.vcpus,
        ramGb:          spec.ram,
        diskGb:         body.diskGb,
        diskType:       body.diskType,
        osImage:        body.osImage,
        preemptible:    body.preemptible,
        tags:           body.tags,
        internalIp:     SimulationService.generateInternalIP(),
        externalIp:     SimulationService.generateExternalIP(),
        status:         "PROVISIONING",
        hourlyCost:     costs.compute,
        diskHourlyCost: costs.disk,
        cpuUsage:       0,
        ramUsage:       0,
      },
    });

    await logActivity(prisma, projectId, user.email, {
      type:        "CREATE_VM",
      description: `VM instance "${vm.name}" created in ${vm.zone}`,
      resourceId:  vm.id,
      metadata:    { machineType: vm.machineType, hourlyCost: costs.compute },
    });

    // Non-blocking: transitions PROVISIONING → RUNNING after ~3.8 s
    SimulationService.simulateProvisioning(vm.id).catch(() => {});

    res.status(201).json({ success: true, data: vm });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/vms/:projectId/:vmId/action ────────────────────────────────
// Valid actions: "start" | "stop" | "suspend" | "terminate"

const VALID_ACTIONS = ["start", "stop", "suspend", "terminate"] as const;
type VMAction = typeof VALID_ACTIONS[number];

const VMActionSchema = z.object({
  action: z.enum(VALID_ACTIONS),
});

// State-machine transition table
const ALLOWED_FROM: Record<VMAction, string[]> = {
  start:     ["STOPPED", "SUSPENDED"],
  stop:      ["RUNNING"],
  suspend:   ["RUNNING"],
  terminate: ["RUNNING", "STOPPED", "SUSPENDED", "FAILED"],
};

vmRouter.patch("/:projectId/:vmId/action", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { vmId, projectId } = req.params;
    const { action }          = VMActionSchema.parse(req.body);
    const { user }            = req as AuthenticatedRequest;

    const vm = await prisma.vMInstance.findFirst({ where: { id: vmId, projectId } });
    if (!vm) throw new AppError(404, "NOT_FOUND", "VM not found");

    if (!ALLOWED_FROM[action]?.includes(vm.status)) {
      throw new AppError(
        409,
        "INVALID_STATE",
        `Cannot "${action}" a VM in "${vm.status}" state. Allowed from: ${ALLOWED_FROM[action]?.join(", ")}`,
      );
    }

    let updates: Record<string, unknown>;
    if (action === "terminate") {
      updates = { status: "STOPPING", cpuUsage: 0, ramUsage: 0, netIn: 0, netOut: 0 };
    } else if (action === "start") {
      updates = { status: "RUNNING", cpuUsage: 5 + Math.random() * 25, ramUsage: 20 + Math.random() * 40 };
    } else {
      const nextStatus = action === "stop" ? "STOPPED" : "SUSPENDED";
      updates = { status: nextStatus, cpuUsage: 0, ramUsage: 0, netIn: 0, netOut: 0 };
    }

    const updated = await prisma.vMInstance.update({ where: { id: vmId }, data: updates });

    await logActivity(prisma, projectId, user.email, {
      type:        `${action.toUpperCase()}_VM`,
      description: `VM "${vm.name}" ${action === "terminate" ? "terminating" : action + "ped"}`,
      resourceId:  vmId,
      severity:    action === "terminate" ? "WARNING" : "INFO",
    });

    if (action === "terminate") {
      SimulationService.simulateTermination(vmId).catch(() => {});
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/vms/:projectId/:vmId ──────────────────────────────────────

vmRouter.delete("/:projectId/:vmId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { vmId, projectId } = req.params;
    const { user }            = req as AuthenticatedRequest;

    const vm = await prisma.vMInstance.findFirst({ where: { id: vmId, projectId } });
    if (!vm) throw new AppError(404, "NOT_FOUND", "VM not found");

    if (vm.status !== "TERMINATED") {
      throw new AppError(
        409,
        "INVALID_STATE",
        `VM must be in "TERMINATED" state before deletion (current: "${vm.status}"). Use the terminate action first.`,
      );
    }

    await prisma.vMInstance.delete({ where: { id: vmId } });

    await logActivity(prisma, projectId, user.email, {
      type:        "DELETE_VM",
      description: `VM instance "${vm.name}" permanently deleted`,
      resourceId:  vmId,
      severity:    "WARNING",
    });

    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
