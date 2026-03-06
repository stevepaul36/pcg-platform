import { prisma } from "../lib/prisma";
import { SimulationService, BillingService } from "./simulation";
import { logActivity } from "./activityLog";
import { AppError } from "../middleware/errorHandler";

export class ComputeService {
  static async listVMs(projectId: string, opts: { limit?: number; cursor?: string; status?: string } = {}) {
    const limit = Math.min(Math.max(opts.limit || 50, 1), 200);
    const vms = await prisma.vMInstance.findMany({
      where: { projectId, ...(opts.status && { status: opts.status }) },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(opts.cursor && { cursor: { id: opts.cursor }, skip: 1 }),
    });
    const hasNextPage = vms.length > limit;
    const page = hasNextPage ? vms.slice(0, -1) : vms;
    return { data: page, meta: { hasNextPage, nextCursor: hasNextPage ? page[page.length - 1]?.id : null } };
  }

  static async createVM(projectId: string, data: any, userEmail: string) {
    const existing = await prisma.vMInstance.findFirst({ where: { projectId, name: data.name } });
    if (existing) throw new AppError(409, "CONFLICT", `VM "${data.name}" already exists`);
    const spec = SimulationService.getMachineSpec(data.machineType);
    const hourlyCost = BillingService.computeVMCost(data.machineType, data.diskSizeGb ?? 10);
    const vm = await prisma.vMInstance.create({ data: {
      ...data, projectId, status: "STAGING",
      internalIP: SimulationService.generateInternalIP(),
      externalIP: SimulationService.generateExternalIP(),
      vCPUs: spec.vCPUs, memoryMB: spec.memoryMB, hourlyCost,
    }});
    SimulationService.simulateProvisioning(vm.id);
    await logActivity(prisma, projectId, userEmail, { type: "VM_CREATE", description: `Created VM "${data.name}" (${data.machineType})`, resourceId: vm.id });
    return vm;
  }

  static async updateVMStatus(projectId: string, vmId: string, action: string, userEmail: string) {
    const vm = await prisma.vMInstance.findFirst({ where: { id: vmId, projectId } });
    if (!vm) throw new AppError(404, "NOT_FOUND", "VM not found");
    const statusMap: Record<string, string> = { start: "RUNNING", stop: "STOPPED", suspend: "SUSPENDED" };
    const newStatus = statusMap[action];
    if (!newStatus) throw new AppError(400, "INVALID_ACTION", `Unknown action: ${action}`);
    const updated = await prisma.vMInstance.update({ where: { id: vmId }, data: { status: newStatus } });
    await logActivity(prisma, projectId, userEmail, { type: `VM_${action.toUpperCase()}`, description: `${action} VM "${vm.name}"`, resourceId: vmId });
    return updated;
  }

  static async deleteVM(projectId: string, vmId: string, userEmail: string) {
    const vm = await prisma.vMInstance.findFirst({ where: { id: vmId, projectId } });
    if (!vm) throw new AppError(404, "NOT_FOUND", "VM not found");
    await prisma.vMInstance.update({ where: { id: vmId }, data: { status: "TERMINATED" } });
    SimulationService.simulateTermination(vmId);
    await logActivity(prisma, projectId, userEmail, { type: "VM_TERMINATE", description: `Terminated VM "${vm.name}"`, resourceId: vmId, severity: "WARNING" });
    return vm;
  }
}
