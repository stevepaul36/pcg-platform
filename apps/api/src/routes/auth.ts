// apps/api/src/routes/auth.ts

import { Router }    from "express";
import bcrypt        from "bcryptjs";
import jwt           from "jsonwebtoken";
import { z }         from "zod";
import { prisma }    from "../lib/prisma";
import { env }       from "../lib/env";
import { authLimiter, refreshLimiter } from "../middleware/rateLimiter";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { AppError }  from "../middleware/errorHandler";
import {
  detectPlanFromEmail,
  getEffectivePlan,
  PLAN_QUOTAS,
} from "../services/subscription";

export const authRouter = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  email:    z.string().email(),
  password: z.string()
    .min(8,  "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name:     z.string().min(2).max(64),
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword:     z.string()
    .min(8,  "New password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
}).refine(d => d.currentPassword !== d.newPassword, {
  message: "New password must differ from current password",
  path:    ["newPassword"],
});

// ── POST /api/v1/auth/register ────────────────────────────────────────────────

authRouter.post("/register", authLimiter, async (req, res, next) => {
  try {
    const raw = RegisterSchema.parse(req.body);
    const body = { ...raw, email: raw.email.toLowerCase().trim() };

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");

    const passwordHash  = await bcrypt.hash(body.password, 12);
    const projectName   = `pcg-${Math.random().toString(36).slice(2, 10)}`;
    const detectedPlan  = detectPlanFromEmail(body.email);
    const emailDomain   = body.email.split("@")[1];
    const subscriptionEnd = detectedPlan === "student"
      ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      : null;

    const user = await prisma.user.create({
      data: {
        email: body.email, name: body.name, passwordHash,
        plan: detectedPlan, emailDomain, subscriptionEnd,
        projects: {
          create: {
            name:        projectName,
            displayName: `${body.name}'s Project`,
            iamMembers: {
              create: { email: body.email, role: "Owner", type: "user", addedBy: "system" },
            },
          },
        },
      },
      select: { id: true, email: true, name: true, plan: true, subscriptionEnd: true },
    });

    const tokens = await createSessionPair(user.id, req);

    res.status(201).json({
      success: true,
      data:    { user, ...tokens, detectedPlan },
      meta:    { requestId: (req as any).requestId, timestamp: new Date().toISOString() },
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/auth/login ───────────────────────────────────────────────────

authRouter.post("/login", authLimiter, async (req, res, next) => {
  try {
    const raw = LoginSchema.parse(req.body);
    const body = { ...raw, email: raw.email.toLowerCase().trim() };

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    // Constant-time comparison even on "not found" to prevent timing attacks
    const dummyHash = "$2a$12$dummyhashfortimingequalisation";
    const valid = user
      ? await bcrypt.compare(body.password, user.passwordHash)
      : (await bcrypt.compare(body.password, dummyHash), false);

    if (!user || !valid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const tokens      = await createSessionPair(user.id, req);
    const effectivePlan = getEffectivePlan(user.plan as any, user.subscriptionEnd);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id, email: user.email, name: user.name,
          plan: effectivePlan, subscriptionEnd: user.subscriptionEnd,
        },
        ...tokens,
      },
      meta: { requestId: (req as any).requestId, timestamp: new Date().toISOString() },
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/auth/refresh ─────────────────────────────────────────────────
// Exchange a valid refresh token for a new access-token / refresh-token pair.
// Old refresh token is revoked (rotation).

const RefreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

authRouter.post("/refresh", refreshLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);

    // Verify signature & expiry
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
    } catch {
      throw new AppError(401, "INVALID_TOKEN", "Refresh token is invalid or expired");
    }

    // DB lookup — rotation: revoke old, issue new
    const rt = await prisma.refreshToken.findFirst({
      where:   { token: refreshToken, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!rt) {
      // SECURITY: If the token exists but was already revoked, this is likely
      // token theft (replay attack). Revoke ALL tokens for the affected user.
      const revokedToken = await prisma.refreshToken.findFirst({
        where: { token: refreshToken },
        select: { userId: true, revokedAt: true },
      });

      if (revokedToken?.revokedAt) {
        // Token was previously used — revoke entire family
        await prisma.refreshToken.updateMany({
          where: { userId: revokedToken.userId, revokedAt: null },
          data:  { revokedAt: new Date() },
        });
        await prisma.session.deleteMany({ where: { userId: revokedToken.userId } });
      }

      throw new AppError(401, "TOKEN_REUSE", "Refresh token has already been used or revoked");
    }

    // Revoke old refresh token (rotation)
    await prisma.refreshToken.update({
      where: { id: rt.id },
      data:  { revokedAt: new Date() },
    });

    const tokens = await createSessionPair(rt.userId, req);

    res.json({ success: true, data: { user: rt.user, ...tokens } });
  } catch (err) { next(err); }
});

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const token = req.headers.authorization!.slice(7);
    // Revoke access-token session
    await prisma.session.deleteMany({ where: { token } });
    // Also revoke any active refresh tokens for this user
    const { user } = req as unknown as AuthenticatedRequest;
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

// ── GET /api/v1/auth/me ───────────────────────────────────────────────────────

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;

    const dbUser = await prisma.user.findUnique({
      where:  { id: user.id },
      select: { id: true, email: true, name: true, plan: true, subscriptionEnd: true, createdAt: true },
    });
    if (!dbUser) throw new AppError(404, "NOT_FOUND", "User not found");

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { iamMembers: { some: { email: user.email } } },
        ],
      },
      select: { id: true, name: true, displayName: true, createdAt: true, totalSpendUSD: true },
    });

    const effectivePlan = getEffectivePlan(dbUser.plan as any, dbUser.subscriptionEnd);
    const quota         = PLAN_QUOTAS[effectivePlan];

    res.json({
      success: true,
      data: { user: { ...dbUser, effectivePlan }, quota, projects },
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/auth/change-password ────────────────────────────────────────

authRouter.post("/change-password", authLimiter, requireAuth, async (req, res, next) => {
  try {
    const { user }  = req as unknown as AuthenticatedRequest;
    const body      = ChangePasswordSchema.parse(req.body);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) throw new AppError(404, "NOT_FOUND", "User not found");

    const currentValid = await bcrypt.compare(body.currentPassword, dbUser.passwordHash);
    if (!currentValid) throw new AppError(401, "INVALID_CREDENTIALS", "Current password is incorrect");

    const newHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

    // Revoke all existing sessions so other devices are signed out
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data:  { revokedAt: new Date() },
    });

    res.json({ success: true, data: { message: "Password updated. Please sign in again." } });
  } catch (err) { next(err); }
});

// ── POST /api/v1/auth/forgot-password ────────────────────────────────────────
// Generates a time-limited reset token. In production, this would send an email
// with a link containing the token. For this simulator, we return the token
// directly (useful for development/testing).

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

authRouter.post("/forgot-password", authLimiter, async (req, res, next) => {
  try {
    const { email } = ForgotPasswordSchema.parse(req.body);
    const normalised = email.toLowerCase().trim();

    // Always return 200 to prevent email enumeration
    const successResponse = {
      success: true,
      data: { message: "If an account with that email exists, a password reset link has been sent." },
    };

    const user = await prisma.user.findUnique({ where: { email: normalised } });
    if (!user) {
      res.json(successResponse);
      return;
    }

    // Generate a secure random token with 1-hour expiry
    const { randomBytes } = await import("crypto");
    const token     = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing reset tokens for this user
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data:  { usedAt: new Date() },
    });

    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    // In production: send email with reset link containing the token.
    // For dev/simulator: token is logged server-side.
    const { logger } = await import("../lib/logger");
    logger.info({ email: normalised, token }, "Password reset token generated (dev only — send via email in production)");

    res.json(successResponse);
  } catch (err) { next(err); }
});

// ── POST /api/v1/auth/reset-password ─────────────────────────────────────────
// Consumes a reset token and sets a new password.

const ResetPasswordSchema = z.object({
  token:       z.string().min(1, "Reset token is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
});

authRouter.post("/reset-password", authLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = ResetPasswordSchema.parse(req.body);

    const resetRecord = await prisma.passwordReset.findFirst({
      where: { token, usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!resetRecord) {
      throw new AppError(400, "INVALID_TOKEN", "Reset token is invalid or has expired");
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    // Atomic: mark token used + update password + revoke all sessions
    await prisma.$transaction([
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data:  { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: resetRecord.userId },
        data:  { passwordHash: newHash },
      }),
      prisma.session.deleteMany({ where: { userId: resetRecord.userId } }),
      prisma.refreshToken.updateMany({
        where: { userId: resetRecord.userId, revokedAt: null },
        data:  { revokedAt: new Date() },
      }),
    ]);

    res.json({ success: true, data: { message: "Password has been reset. Please sign in with your new password." } });
  } catch (err) { next(err); }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a DB session + access-token + refresh-token atomically.
 * Access token is short-lived (env.JWT_EXPIRES_IN, default 15 min).
 * Refresh token is long-lived (env.JWT_REFRESH_EXPIRES_IN, default 30 days).
 *
 * Bug fix over original: generates the token FIRST then saves it in one
 * create call (not create → update), making it atomic.
 */
async function createSessionPair(userId: string, req: any) {
  const accessExpiresAt  = parseExpiry(env.JWT_EXPIRES_IN);
  const refreshExpiresAt = parseExpiry(env.JWT_REFRESH_EXPIRES_IN);

  const accessToken = jwt.sign({ sub: userId, type: "access" }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
  const refreshToken = jwt.sign({ sub: userId, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  });

  const [session] = await prisma.$transaction([
    prisma.session.create({
      data: {
        userId,
        token:     accessToken,
        expiresAt: accessExpiresAt,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    }),
    prisma.refreshToken.create({
      data: {
        userId,
        token:     refreshToken,
        expiresAt: refreshExpiresAt,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    }),
  ]);

  return {
    accessToken,
    refreshToken,
    expiresAt:        accessExpiresAt,
    refreshExpiresAt,
  };
}

function parseExpiry(expiry: string): Date {
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`);
  return new Date(Date.now() + parseInt(match[1]) * (units[match[2]] ?? 1) * 1000);
}
