import { prisma } from "../lib/prisma";
import { logActivity } from "./activityLog";
import { SimulationService } from "./simulation";
import { AppError } from "../middleware/errorHandler";

export class NetworkService {
  static async createVPC(projectId: string, data: any, userEmail: string) {
    const existing = await prisma.vPCNetwork.findFirst({ where: { projectId, name: data.name } });
    if (existing) throw new AppError(409, "CONFLICT", `VPC "${data.name}" already exists`);
    const vpc = await prisma.vPCNetwork.create({ data: { ...data, projectId } });
    await logActivity(prisma, projectId, userEmail, { type: "VPC_CREATE", description: `Created VPC ${data.name}`, resourceId: vpc.id });
    return vpc;
  }
  static async createLB(projectId: string, data: any, userEmail: string) {
    const ip = SimulationService.generateExternalIP();
    const lb = await prisma.loadBalancer.create({ data: { ...data, projectId, ip, status: "ACTIVE", hourlyCost: 0.025 } });
    await logActivity(prisma, projectId, userEmail, { type: "LB_CREATE", description: `Created LB ${data.name}`, resourceId: lb.id });
    return lb;
  }
  static async createDNSZone(projectId: string, data: any, userEmail: string) {
    const zone = await prisma.cloudDNSZone.create({ data: { ...data, projectId, recordCount: 2 } });
    await logActivity(prisma, projectId, userEmail, { type: "DNS_CREATE", description: `Created DNS zone ${data.dnsName}`, resourceId: zone.id });
    return zone;
  }
}
