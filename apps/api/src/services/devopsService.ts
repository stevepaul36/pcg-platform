import { prisma } from "../lib/prisma";
import { logActivity } from "./activityLog";

export class DevOpsService {
  static async createBuildTrigger(projectId: string, data: any, userEmail: string) {
    const trigger = await prisma.cloudBuildTrigger.create({ data: { ...data, projectId } });
    await logActivity(prisma, projectId, userEmail, { type: "BUILD_TRIGGER_CREATE", description: `Created trigger "${data.name}"`, resourceId: trigger.id });
    return trigger;
  }
  static async createArtifactRepo(projectId: string, data: any, userEmail: string) {
    const repo = await prisma.artifactRepo.create({ data: { ...data, projectId } });
    await logActivity(prisma, projectId, userEmail, { type: "ARTIFACT_REPO_CREATE", description: `Created repo "${data.name}" (${data.format})`, resourceId: repo.id });
    return repo;
  }
  static async createSchedulerJob(projectId: string, data: any, userEmail: string) {
    const job = await prisma.schedulerJob.create({ data: { ...data, projectId } });
    await logActivity(prisma, projectId, userEmail, { type: "SCHEDULER_CREATE", description: `Created job "${data.name}"`, resourceId: job.id });
    return job;
  }
  static async toggleSchedulerJob(projectId: string, jobId: string, status: string, userEmail: string) {
    const job = await prisma.schedulerJob.update({ where: { id: jobId }, data: { status } });
    await logActivity(prisma, projectId, userEmail, { type: "SCHEDULER_UPDATE", description: `${status} job "${job.name}"`, resourceId: jobId });
    return job;
  }
}
