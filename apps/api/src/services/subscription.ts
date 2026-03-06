// apps/api/src/services/subscription.ts

import type { Plan, PlanQuota } from "@pcg/shared";

export type { Plan };

// ── Plan quota definitions ────────────────────────────────────────────────────

export const PLAN_QUOTAS: Record<Plan, PlanQuota> = {
  free: {
    maxVMs:          2,
    maxBuckets:      1,
    maxSQLInstances: 0,
    sessionDays:     7,
    label:           "Free",
  },
  student: {
    maxVMs:          5,
    maxBuckets:      5,
    maxSQLInstances: 2,
    sessionDays:     90,
    label:           "Student (3 months free)",
  },
  personal: {
    maxVMs:          10,
    maxBuckets:      10,
    maxSQLInstances: 5,
    sessionDays:     30,
    label:           "Personal",
  },
};

// ── Student domain detection ──────────────────────────────────────────────────

const STUDENT_DOMAIN_PATTERNS: RegExp[] = [
  /\.edu$/i,
  /\.ac\.[a-z]{2}$/i,      // .ac.in  .ac.uk  .ac.nz
  /\.edu\.[a-z]{2}$/i,     // .edu.au .edu.br .edu.pk
  /college\./i,
  /university\./i,
  /\.uni\./i,
];

export function isStudentEmail(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return STUDENT_DOMAIN_PATTERNS.some(p => p.test(domain));
}

export function detectPlanFromEmail(email: string): Plan {
  return isStudentEmail(email) ? "student" : "free";
}

// ── Quota helpers ─────────────────────────────────────────────────────────────

export function getPlanQuota(plan: Plan): PlanQuota {
  return PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.free;
}

export function isSubscriptionActive(subscriptionEnd: Date | null, plan: Plan): boolean {
  if (plan === "free") return true;
  if (!subscriptionEnd) return false;
  return subscriptionEnd > new Date();
}

/**
 * Returns the effective plan. Downgrades to "free" if paid subscription expired.
 */
export function getEffectivePlan(plan: Plan, subscriptionEnd: Date | null): Plan {
  if (plan === "free") return "free";
  return isSubscriptionActive(subscriptionEnd, plan) ? plan : "free";
}
