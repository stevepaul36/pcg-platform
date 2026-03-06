import { prisma } from "../lib/prisma";
import { logActivity } from "./activityLog";

export class MonitoringService {
  static async createAlert(projectId: string, data: any, userEmail: string) {
    const alert = await prisma.monitoringAlertPolicy.create({ data: { ...data, projectId } });
    await logActivity(prisma, projectId, userEmail, { type: "ALERT_CREATE", description: `Created alert "${data.displayName}"`, resourceId: alert.id });
    return alert;
  }
  static async createUptimeCheck(projectId: string, data: any, userEmail: string) {
    const check = await prisma.uptimeCheck.create({ data: { ...data, projectId } });
    await logActivity(prisma, projectId, userEmail, { type: "UPTIME_CREATE", description: `Created uptime check "${data.displayName}"`, resourceId: check.id });
    return check;
  }
}
