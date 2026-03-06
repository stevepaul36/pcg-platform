import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

// GCP-style permission model
const ROLE_PERMISSIONS: Record<string, string[]> = {
  "roles/viewer": [
    "*.list", "*.get", "projects.get",
  ],
  "roles/editor": [
    "*.list", "*.get", "*.create", "*.update", "*.delete",
    "projects.get", "projects.update",
  ],
  "roles/owner": [
    "*.list", "*.get", "*.create", "*.update", "*.delete",
    "projects.get", "projects.update", "projects.delete",
    "iam.members.add", "iam.members.remove", "iam.roles.update",
  ],
  "roles/compute.admin": [
    "compute.instances.*", "compute.disks.*", "compute.firewalls.*",
  ],
  "roles/storage.admin": [
    "storage.buckets.*", "storage.objects.*",
  ],
  "roles/bigquery.admin": [
    "bigquery.datasets.*", "bigquery.tables.*", "bigquery.jobs.*",
  ],
  "roles/cloudsql.admin": [
    "cloudsql.instances.*",
  ],
  "roles/monitoring.admin": [
    "monitoring.alertPolicies.*", "monitoring.uptimeChecks.*",
  ],
  "roles/secretmanager.admin": [
    "secretmanager.secrets.*", "secretmanager.versions.*",
  ],
  "roles/iam.admin": [
    "iam.members.*", "iam.roles.*", "iam.serviceAccounts.*",
  ],
};

export class IAMEngine {
  static getAvailableRoles() {
    return Object.keys(ROLE_PERMISSIONS).map(role => ({
      name: role,
      title: role.replace("roles/", "").replace(/\./g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      permissions: ROLE_PERMISSIONS[role],
    }));
  }

  static getRolePermissions(role: string): string[] {
    return ROLE_PERMISSIONS[role] ?? [];
  }

  static hasPermission(userRoles: string[], requiredPermission: string): boolean {
    for (const role of userRoles) {
      const perms = ROLE_PERMISSIONS[role] || [];
      for (const perm of perms) {
        if (perm === requiredPermission) return true;
        // Wildcard matching: "compute.instances.*" matches "compute.instances.create"
        if (perm.endsWith(".*")) {
          const prefix = perm.slice(0, -2);
          if (requiredPermission.startsWith(prefix)) return true;
        }
        // Category wildcard: "*.list" matches "compute.instances.list"
        if (perm.startsWith("*.")) {
          const suffix = perm.slice(2);
          if (requiredPermission.endsWith(suffix)) return true;
        }
      }
    }
    return false;
  }

  static async checkProjectPermission(projectId: string, userEmail: string, requiredPermission: string) {
    // Project owner always has full access
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { owner: true } });
    if (project?.owner.email === userEmail) return true;

    // Check IAM members
    const members = await prisma.iAMMember.findMany({ where: { projectId, email: userEmail } });
    const roles = members.map(m => m.role);
    if (!this.hasPermission(roles, requiredPermission)) {
      throw new AppError(403, "PERMISSION_DENIED", `Missing permission: ${requiredPermission}`);
    }
    return true;
  }
}
