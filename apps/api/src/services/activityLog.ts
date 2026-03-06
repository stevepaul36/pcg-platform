// apps/api/src/services/activityLog.ts

import { PrismaClient, Prisma } from "@prisma/client";

interface LogParams {
  type:        string;
  description: string;
  resourceId?: string;
  severity?:   "INFO" | "WARNING" | "ERROR";
  metadata?:   Record<string, unknown>;
}

export async function logActivity(
  prisma:    PrismaClient,
  projectId: string,
  userEmail: string,
  params:    LogParams,
): Promise<void> {
  const severity = params.severity
    ?? (params.type.includes("DELETE") || params.type.includes("TERMINATE") ? "WARNING" : "INFO");

  await prisma.activityLog.create({
    data: {
      projectId,
      type:        params.type,
      description: params.description,
      resourceId:  params.resourceId ?? null,
      severity,
      user:        userEmail,
      metadata:    (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
