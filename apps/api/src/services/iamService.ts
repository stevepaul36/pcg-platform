import { prisma } from "../lib/prisma";
import { logActivity } from "./activityLog";
import { AppError } from "../middleware/errorHandler";

export class IAMService {
  static async listMembers(projectId: string) {
    return prisma.iAMMember.findMany({ where: { projectId }, orderBy: { addedAt: "desc" } });
  }
  static async addMember(projectId: string, data: any, userEmail: string) {
    const existing = await prisma.iAMMember.findFirst({ where: { projectId, email: data.email } });
    if (existing) throw new AppError(409, "CONFLICT", `Member "${data.email}" already exists`);
    const member = await prisma.iAMMember.create({ data: { ...data, projectId } });
    await logActivity(prisma, projectId, userEmail, { type: "IAM_ADD", description: `Added ${data.email} as ${data.role}`, resourceId: member.id });
    return member;
  }
  static async removeMember(projectId: string, memberId: string, userEmail: string) {
    const member = await prisma.iAMMember.findFirst({ where: { id: memberId, projectId } });
    if (!member) throw new AppError(404, "NOT_FOUND", "Member not found");
    await prisma.iAMMember.delete({ where: { id: memberId } });
    await logActivity(prisma, projectId, userEmail, { type: "IAM_REMOVE", description: `Removed ${member.email}`, resourceId: memberId, severity: "WARNING" });
  }
}
