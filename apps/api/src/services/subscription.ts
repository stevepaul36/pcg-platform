// apps/api/src/services/subscription.ts

import type { Plan, PlanQuota } from "@pcg/shared";

export type { Plan };

// ── Plan quota definitions ────────────────────────────────────────────────────
// Mirrors GCP's free tier and sensible limits for a learning/demo platform.
// References: GCP Developer's Cheat Sheet — Compute, Storage, Database,
// Networking, Security, Data Analytics sections.

export const PLAN_QUOTAS: Record<Plan, PlanQuota> = {
  free: {
    // Compute
    maxVMs:               2,
    maxGKEClusters:       1,
    maxCloudRunServices:  3,
    maxCloudFunctions:    5,
    // Storage & Database
    maxBuckets:           1,
    maxSQLInstances:      0,
    maxMemorystoreInstances: 0,
    // Analytics
    maxBQDatasets:        3,
    maxPubSubTopics:      5,
    // Networking
    maxVPCs:              2,
    maxLoadBalancers:     0,
    // Security
    maxSecrets:           5,
    maxServiceAccounts:   5,
    sessionDays:          7,
    label:                "Free",
  },
  student: {
    // Compute
    maxVMs:               5,
    maxGKEClusters:       2,
    maxCloudRunServices:  10,
    maxCloudFunctions:    20,
    // Storage & Database
    maxBuckets:           5,
    maxSQLInstances:      2,
    maxMemorystoreInstances: 1,
    // Analytics
    maxBQDatasets:        10,
    maxPubSubTopics:      20,
    // Networking
    maxVPCs:              5,
    maxLoadBalancers:     2,
    // Security
    maxSecrets:           20,
    maxServiceAccounts:   20,
    sessionDays:          90,
    label:                "Student (3 months free)",
  },
  personal: {
    // Compute
    maxVMs:               10,
    maxGKEClusters:       5,
    maxCloudRunServices:  25,
    maxCloudFunctions:    50,
    // Storage & Database
    maxBuckets:           10,
    maxSQLInstances:      5,
    maxMemorystoreInstances: 3,
    // Analytics
    maxBQDatasets:        25,
    maxPubSubTopics:      50,
    // Networking
    maxVPCs:              10,
    maxLoadBalancers:     5,
    // Security
    maxSecrets:           100,
    maxServiceAccounts:   50,
    sessionDays:          30,
    label:                "Personal",
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
