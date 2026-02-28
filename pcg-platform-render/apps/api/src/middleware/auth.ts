// apps/api/src/middleware/auth.ts

import { Request, Response, NextFunction } from "express";
import jwt                                  from "jsonwebtoken";
import { prisma }                           from "../lib/prisma";
import { env, isAdminEmail }               from "../lib/env";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  user:      { id: string; email: string; name: string };
  projectId?: string;
  isAdmin?:  boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function unauthorized(res: Response, code: string, message: string): void {
  res.status(401).json({ success: false, error: { code, message } });
}

function forbidden(res: Response, message: string): void {
  res.status(403).json({ success: false, error: { code: "FORBIDDEN", message } });
}

// ── requireAuth ───────────────────────────────────────────────────────────────
// Validates the Bearer token, performs DB-level session revocation check,
// and attaches `req.user` and `req.isAdmin`.

export async function requireAuth(
  req:  Request,
  res:  Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    unauthorized(res, "UNAUTHORIZED", "Missing or invalid Authorization header");
    return;
  }

  const token = authHeader.slice(7);

  try {
    jwt.verify(token, env.JWT_SECRET);

    // DB check ensures server-side revocation (logout) is respected
    const session = await prisma.session.findFirst({
      where:   { token, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!session) {
      unauthorized(res, "SESSION_EXPIRED", "Session expired or revoked");
      return;
    }

    const r = req as AuthenticatedRequest;
    r.user    = session.user;
    r.isAdmin = isAdminEmail(session.user.email);
    next();
  } catch (err) {
    const code = err instanceof jwt.TokenExpiredError ? "TOKEN_EXPIRED" : "INVALID_TOKEN";
    unauthorized(res, code, "Invalid or expired token");
  }
}

// ── requireAdmin ──────────────────────────────────────────────────────────────
// Must be used after requireAuth. Rejects non-admin users with 403.

export function requireAdmin(
  req:  Request,
  res:  Response,
  next: NextFunction,
): void {
  if (!(req as AuthenticatedRequest).isAdmin) {
    forbidden(res, "This action requires administrator privileges");
    return;
  }
  next();
}

// ── requireProjectAccess ──────────────────────────────────────────────────────
// Checks BOTH direct ownership AND IAM membership.
// Bug fix: the original only checked `ownerId`, which locked out IAM-granted
// collaborators from every resource endpoint.

export async function requireProjectAccess(
  req:  Request,
  res:  Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { projectId } = req.params;
    const user = (req as AuthenticatedRequest).user;

    // Owner check
    const asOwner = await prisma.project.findFirst({
      where:  { id: projectId, ownerId: user.id },
      select: { id: true },
    });

    if (!asOwner) {
      // IAM member check (Viewer / Editor / Owner role)
      const asMember = await prisma.iAMMember.findFirst({
        where: { projectId, email: user.email },
        select: { role: true },
      });

      if (!asMember) {
        forbidden(res, "You do not have access to this project");
        return;
      }

      (req as any).iamRole = asMember.role;
    } else {
      (req as any).iamRole = "Owner";
    }

    (req as AuthenticatedRequest).projectId = projectId;
    next();
  } catch (err) {
    next(err);
  }
}

// ── requireProjectWrite ───────────────────────────────────────────────────────
// Must be used after requireProjectAccess. Rejects IAM Viewers from write
// operations (create, update, delete). Only Editor and Owner roles can write.

export function requireProjectWrite(
  req:  Request,
  res:  Response,
  next: NextFunction,
): void {
  const role = (req as any).iamRole;
  if (role === "Viewer") {
    forbidden(res, "Viewer role does not have write access. Contact your project Owner to upgrade your role.");
    return;
  }
  next();
}
