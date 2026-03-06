import { prisma } from "../lib/prisma";

export class LifecycleEngine {
  static async trackStateChange(projectId: string, resourceType: string, resourceId: string, status: string, previousStatus?: string, message = "") {
    return prisma.resourceState.create({ data: {
      projectId, resourceType, resourceId, status, previousStatus, message,
    }});
  }

  static async getResourceHistory(resourceId: string) {
    return prisma.resourceState.findMany({
      where: { resourceId }, orderBy: { changedAt: "desc" }, take: 50,
    });
  }

  static async getProjectEvents(projectId: string, limit = 50) {
    return prisma.resourceState.findMany({
      where: { projectId }, orderBy: { changedAt: "desc" }, take: limit,
    });
  }

  static async simulateProvision(projectId: string, resourceType: string, resourceId: string, updateFn: (status: string) => Promise<void>, stages: string[] = ["CREATING", "PROVISIONING", "RUNNING"]) {
    for (let i = 0; i < stages.length; i++) {
      const status = stages[i];
      const prev = i > 0 ? stages[i - 1] : undefined;
      await this.trackStateChange(projectId, resourceType, resourceId, status, prev);
      try { await updateFn(status); } catch {}
      if (i < stages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500));
      }
    }
  }
}
