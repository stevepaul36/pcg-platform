// Event Bus — decouples resource creation from billing/quota/lifecycle tracking
import { BillingEngine } from "./billingEngine";
import { QuotaEngine } from "./quotaEngine";
import { LifecycleEngine } from "./lifecycleEngine";

type EventType = "RESOURCE_CREATED" | "RESOURCE_UPDATED" | "RESOURCE_DELETED" | "RESOURCE_STATUS_CHANGED";

interface CloudEvent {
  type: EventType;
  projectId: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  status?: string;
  previousStatus?: string;
  costPerHour?: number;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

type EventHandler = (event: CloudEvent) => Promise<void>;

class EventBusImpl {
  private handlers: Map<EventType, EventHandler[]> = new Map();
  private eventLog: CloudEvent[] = [];

  on(type: EventType, handler: EventHandler) {
    const list = this.handlers.get(type) || [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  async emit(event: CloudEvent) {
    this.eventLog.push(event);
    if (this.eventLog.length > 1000) this.eventLog.shift();
    const handlers = this.handlers.get(event.type) || [];
    await Promise.allSettled(handlers.map(h => h(event)));
  }

  getRecentEvents(limit = 50) {
    return this.eventLog.slice(-limit).reverse();
  }
}

export const eventBus = new EventBusImpl();

// ── Wire up default handlers ──────────────────────────────────────────────────

// Track billing on resource creation
eventBus.on("RESOURCE_CREATED", async (event) => {
  try {
    await BillingEngine.trackUsage(event.projectId, event.resourceType, event.resourceId, event.resourceName, event.costPerHour);
  } catch {}
});

// Stop billing on resource deletion
eventBus.on("RESOURCE_DELETED", async (event) => {
  try {
    await BillingEngine.stopUsage(event.resourceId);
  } catch {}
});

// Track quota on creation
eventBus.on("RESOURCE_CREATED", async (event) => {
  try {
    await QuotaEngine.incrementUsage(event.projectId, event.resourceType);
  } catch {}
});

// Decrement quota on deletion
eventBus.on("RESOURCE_DELETED", async (event) => {
  try {
    await QuotaEngine.decrementUsage(event.projectId, event.resourceType);
  } catch {}
});

// Track lifecycle state changes
eventBus.on("RESOURCE_STATUS_CHANGED", async (event) => {
  try {
    await LifecycleEngine.trackStateChange(event.projectId, event.resourceType, event.resourceId, event.status ?? "UNKNOWN", event.previousStatus);
  } catch {}
});

// Also track creation as a lifecycle event
eventBus.on("RESOURCE_CREATED", async (event) => {
  try {
    await LifecycleEngine.trackStateChange(event.projectId, event.resourceType, event.resourceId, event.status ?? "CREATING");
  } catch {}
});
