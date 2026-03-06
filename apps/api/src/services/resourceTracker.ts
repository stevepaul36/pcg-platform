// resourceTracker.ts — Single call to track billing + quota + lifecycle + events for any resource
import { BillingEngine } from "./billingEngine";
import { QuotaEngine } from "./quotaEngine";
import { LifecycleEngine } from "./lifecycleEngine";
import { eventBus } from "./eventBus";

export class ResourceTracker {
  static async onCreate(projectId: string, resourceType: string, resourceId: string, resourceName: string, costPerHour?: number) {
    await Promise.allSettled([
      BillingEngine.trackUsage(projectId, resourceType, resourceId, resourceName, costPerHour),
      QuotaEngine.incrementUsage(projectId, resourceType).catch(() => {}),
      LifecycleEngine.trackStateChange(projectId, resourceType, resourceId, "CREATED"),
      eventBus.emit({ type: "RESOURCE_CREATED", projectId, resourceType, resourceId, resourceName, costPerHour, status: "CREATED", timestamp: new Date() }),
    ]);
  }

  static async onDelete(projectId: string, resourceType: string, resourceId: string, resourceName: string) {
    await Promise.allSettled([
      BillingEngine.stopUsage(resourceId),
      QuotaEngine.decrementUsage(projectId, resourceType).catch(() => {}),
      LifecycleEngine.trackStateChange(projectId, resourceType, resourceId, "DELETED", "ACTIVE"),
      eventBus.emit({ type: "RESOURCE_DELETED", projectId, resourceType, resourceId, resourceName, timestamp: new Date() }),
    ]);
  }

  static async onStatusChange(projectId: string, resourceType: string, resourceId: string, resourceName: string, status: string, previousStatus?: string) {
    await Promise.allSettled([
      LifecycleEngine.trackStateChange(projectId, resourceType, resourceId, status, previousStatus),
      eventBus.emit({ type: "RESOURCE_STATUS_CHANGED", projectId, resourceType, resourceId, resourceName, status, previousStatus, timestamp: new Date() }),
    ]);
  }
}
