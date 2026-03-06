// apps/api/src/services/simulation.ts

import { prisma } from "../lib/prisma";

// ── Machine type catalogue ─────────────────────────────────────────────────────
// Prices are on-demand USD/hr (us-central1), mirroring GCP's 2024 public rates.
// Sources: cloud.google.com/compute/vm-instance-pricing
// Series covered: E2 (cost-optimised), N1 (general), N2 (balanced), N2D (AMD),
//   C2 (compute-optimised), C3 (3rd-gen Intel), T2D (AMD scale-out),
//   M1/M2 (memory-optimised), A2 (GPU/accelerator).

const MACHINE_TYPES: Record<string, { vcpus: number; ram: number; price: number }> = {
  // ── E2 (Cost-optimised, Haswell) ─────────────────────────────────────────
  "e2-micro":       { vcpus: 2,  ram: 1,     price: 0.0076  },
  "e2-small":       { vcpus: 2,  ram: 2,     price: 0.0134  },
  "e2-medium":      { vcpus: 2,  ram: 4,     price: 0.0268  },
  "e2-standard-2":  { vcpus: 2,  ram: 8,     price: 0.0671  },
  "e2-standard-4":  { vcpus: 4,  ram: 16,    price: 0.1341  },
  "e2-standard-8":  { vcpus: 8,  ram: 32,    price: 0.2683  },
  "e2-standard-16": { vcpus: 16, ram: 64,    price: 0.5366  },
  "e2-highcpu-2":   { vcpus: 2,  ram: 2,     price: 0.0497  },
  "e2-highcpu-8":   { vcpus: 8,  ram: 8,     price: 0.1988  },
  "e2-highmem-2":   { vcpus: 2,  ram: 16,    price: 0.0903  },
  "e2-highmem-8":   { vcpus: 8,  ram: 64,    price: 0.3612  },

  // ── N1 (General-purpose, Skylake) ────────────────────────────────────────
  "n1-standard-1":  { vcpus: 1,  ram: 3.75,  price: 0.0475  },
  "n1-standard-2":  { vcpus: 2,  ram: 7.5,   price: 0.0950  },
  "n1-standard-4":  { vcpus: 4,  ram: 15,    price: 0.1900  },
  "n1-standard-8":  { vcpus: 8,  ram: 30,    price: 0.3800  },
  "n1-standard-16": { vcpus: 16, ram: 60,    price: 0.7600  },
  "n1-standard-32": { vcpus: 32, ram: 120,   price: 1.5200  },
  "n1-highcpu-4":   { vcpus: 4,  ram: 3.6,   price: 0.1418  },
  "n1-highcpu-8":   { vcpus: 8,  ram: 7.2,   price: 0.2836  },
  "n1-highmem-4":   { vcpus: 4,  ram: 26,    price: 0.2040  },
  "n1-highmem-8":   { vcpus: 8,  ram: 52,    price: 0.4080  },

  // ── N2 (Balanced, 3rd-gen Intel Cascade Lake) ────────────────────────────
  "n2-standard-2":  { vcpus: 2,  ram: 8,     price: 0.0971  },
  "n2-standard-4":  { vcpus: 4,  ram: 16,    price: 0.1943  },
  "n2-standard-8":  { vcpus: 8,  ram: 32,    price: 0.3885  },
  "n2-standard-16": { vcpus: 16, ram: 64,    price: 0.7771  },
  "n2-standard-32": { vcpus: 32, ram: 128,   price: 1.5542  },
  "n2-highcpu-4":   { vcpus: 4,  ram: 4,     price: 0.1567  },
  "n2-highcpu-8":   { vcpus: 8,  ram: 8,     price: 0.3134  },
  "n2-highmem-4":   { vcpus: 4,  ram: 32,    price: 0.2256  },
  "n2-highmem-8":   { vcpus: 8,  ram: 64,    price: 0.4512  },

  // ── N2D (Balanced, AMD EPYC Milan) ───────────────────────────────────────
  "n2d-standard-2": { vcpus: 2,  ram: 8,     price: 0.0840  },
  "n2d-standard-4": { vcpus: 4,  ram: 16,    price: 0.1680  },
  "n2d-standard-8": { vcpus: 8,  ram: 32,    price: 0.3360  },
  "n2d-highcpu-4":  { vcpus: 4,  ram: 4,     price: 0.1374  },
  "n2d-highmem-4":  { vcpus: 4,  ram: 32,    price: 0.1949  },

  // ── T2D (Scale-out, AMD EPYC Milan) ─────────────────────────────────────
  "t2d-standard-1": { vcpus: 1,  ram: 4,     price: 0.0422  },
  "t2d-standard-4": { vcpus: 4,  ram: 16,    price: 0.1688  },
  "t2d-standard-8": { vcpus: 8,  ram: 32,    price: 0.3376  },

  // ── C2 (Compute-optimised, Intel Cascade Lake) ───────────────────────────
  "c2-standard-4":  { vcpus: 4,  ram: 16,    price: 0.2088  },
  "c2-standard-8":  { vcpus: 8,  ram: 32,    price: 0.4176  },
  "c2-standard-16": { vcpus: 16, ram: 64,    price: 0.8353  },
  "c2-standard-30": { vcpus: 30, ram: 120,   price: 1.5661  },
  "c2-standard-60": { vcpus: 60, ram: 240,   price: 3.1322  },

  // ── C3 (General-purpose, Intel Sapphire Rapids) ──────────────────────────
  "c3-standard-4":  { vcpus: 4,  ram: 16,    price: 0.2115  },
  "c3-standard-8":  { vcpus: 8,  ram: 32,    price: 0.4229  },
  "c3-standard-22": { vcpus: 22, ram: 88,    price: 1.1630  },
  "c3-highcpu-4":   { vcpus: 4,  ram: 8,     price: 0.1687  },
  "c3-highmem-4":   { vcpus: 4,  ram: 32,    price: 0.2557  },

  // ── M1 (Memory-optimised) ────────────────────────────────────────────────
  "m1-ultramem-40": { vcpus: 40, ram: 961,   price: 6.3036  },
  "m1-ultramem-80": { vcpus: 80, ram: 1922,  price: 12.6073 },
  "m1-megamem-96":  { vcpus: 96, ram: 1433.6,price: 10.6740 },

  // ── A2 (Accelerator-optimised, NVIDIA A100) ──────────────────────────────
  "a2-highgpu-1g":  { vcpus: 12, ram: 85,    price: 3.6730  },
  "a2-highgpu-2g":  { vcpus: 24, ram: 170,   price: 7.3461  },
  "a2-highgpu-4g":  { vcpus: 48, ram: 340,   price: 14.6921 },
  "a2-highgpu-8g":  { vcpus: 96, ram: 680,   price: 29.3842 },
};

// ── Region pricing multipliers ────────────────────────────────────────────────
// Based on GCP regional pricing differentials (us-central1 = 1.00 baseline).
// All regions from the GCP Developer's Cheat Sheet regions/network map.

const REGION_MULTIPLIERS: Record<string, number> = {
  // North America
  "us-central1":       1.00,
  "us-east1":          1.00,
  "us-east4":          1.00,
  "us-east5":          1.00,
  "us-south1":         1.03,
  "us-west1":          1.00,
  "us-west2":          1.06,
  "us-west3":          1.07,
  "us-west4":          1.07,
  "northamerica-northeast1": 1.06,
  "northamerica-northeast2": 1.07,
  // South America
  "southamerica-east1":  1.24,
  "southamerica-west1":  1.23,
  // Europe
  "europe-central2":     1.10,
  "europe-north1":       1.07,
  "europe-southwest1":   1.09,
  "europe-west1":        1.08,
  "europe-west2":        1.12,
  "europe-west3":        1.12,
  "europe-west4":        1.08,
  "europe-west6":        1.14,
  "europe-west8":        1.10,
  "europe-west9":        1.10,
  "europe-west10":       1.14,
  "europe-west12":       1.10,
  // Middle East
  "me-central1":         1.15,
  "me-west1":            1.15,
  // Africa
  "africa-south1":       1.18,
  // Asia Pacific
  "asia-east1":          1.05,
  "asia-east2":          1.16,
  "asia-northeast1":     1.14,
  "asia-northeast2":     1.14,
  "asia-northeast3":     1.14,
  "asia-south1":         1.05,
  "asia-south2":         1.05,
  "asia-southeast1":     1.10,
  "asia-southeast2":     1.12,
  "australia-southeast1":1.14,
  "australia-southeast2":1.14,
};

// ── Simulation Service ────────────────────────────────────────────────────────

export class SimulationService {
  static getMachineSpec(machineType: string) {
    return MACHINE_TYPES[machineType] ?? { vcpus: 2, ram: 4, price: 0.0268 };
  }

  /** Returns a unique-ish 10.128.x.y internal IP */
  static generateInternalIP(): string {
    const oct3 = Math.floor(Math.random() * 256);
    const oct4 = Math.floor(Math.random() * 253) + 2;
    return `10.128.${oct3}.${oct4}`;
  }

  /** Returns a plausible public IP in 34.x.x.x–213.x.x.x range */
  static generateExternalIP(): string {
    return [
      34 + Math.floor(Math.random() * 180),
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 253) + 2,
    ].join(".");
  }

  /**
   * Simulates GCP provisioning latency (~3.8s), then transitions
   * PROVISIONING → RUNNING with randomised initial metrics.
   */
  static async simulateProvisioning(vmId: string): Promise<void> {
    await sleep(3_800);
    await prisma.vMInstance.updateMany({
      where: { id: vmId, status: "PROVISIONING" },
      data:  {
        status:   "RUNNING",
        cpuUsage: 5  + Math.random() * 30,
        ramUsage: 20 + Math.random() * 50,
      },
    });
  }

  /**
   * Simulates graceful shutdown (~2.2s), then transitions
   * STOPPING → TERMINATED.
   */
  static async simulateTermination(vmId: string): Promise<void> {
    await sleep(2_200);
    await prisma.vMInstance.updateMany({
      where: { id: vmId, status: "STOPPING" },
      data:  { status: "TERMINATED", cpuUsage: 0, ramUsage: 0, netIn: 0, netOut: 0 },
    });
  }

  /**
   * Adds realistic random walk noise to a metric value.
   * Biased slightly upward (0.48 vs 0.50) to simulate real-world idle drift.
   */
  static jitterMetrics(
    current:  number,
    maxDelta: number,
    min:      number,
    max:      number,
  ): number {
    return Math.min(max, Math.max(min, current + (Math.random() - 0.48) * maxDelta));
  }
}

// ── Billing Service ───────────────────────────────────────────────────────────

export class BillingService {
  /**
   * Returns hourly compute cost + hourly disk cost for a VM configuration.
   * Prices are USD and mirror real GCP rates (as of 2024).
   * Disk pricing: $/GB/month → $/GB/hr = rate / 730
   */
  static computeVMCost(
    machineType: string,
    zone:        string,
    diskGb:      number,
    diskType:    string,
  ): { compute: number; disk: number } {
    const spec   = MACHINE_TYPES[machineType] ?? { price: 0.0268 };
    const region = zone.split("-").slice(0, 2).join("-");
    const mult   = REGION_MULTIPLIERS[region] ?? 1.0;

    // Disk pricing: monthly $/GB → hourly $/GB
    // pd-standard: $0.04/GB/mo, pd-balanced: $0.10/GB/mo, pd-ssd: $0.17/GB/mo
    // hyperdisk-extreme: $0.125/GB/mo (new high-perf tier)
    const diskMonthlyPerGB: Record<string, number> = {
      "pd-standard":      0.04,
      "pd-balanced":      0.10,
      "pd-ssd":           0.17,
      "pd-extreme":       0.125,
      "hyperdisk-balanced":0.10,
      "hyperdisk-extreme": 0.125,
    };

    const diskRate = (diskMonthlyPerGB[diskType] ?? 0.04) / 730;

    return {
      compute: parseFloat((spec.price * mult).toFixed(6)),
      disk:    parseFloat((diskRate * diskGb).toFixed(6)),
    };
  }

  /** Converts an hourly rate to a monthly estimate (730 hours). */
  static monthlyCost(hourlyCost: number): number {
    return parseFloat((hourlyCost * 730).toFixed(2));
  }

  /**
   * Returns accurate hourly cost for a GKE cluster node.
   * GKE Standard adds $0.10/hr cluster management fee (waived for Autopilot first cluster).
   */
  static gkeClusterCost(machineType: string, nodeCount: number, autopilot = false): number {
    const spec         = MACHINE_TYPES[machineType] ?? { price: 0.05 };
    const mgmtFee      = autopilot ? 0 : 0.10;          // cluster management fee/hr
    return parseFloat(((spec.price * nodeCount) + mgmtFee).toFixed(6));
  }

  /**
   * Cloud Run pricing: per-vCPU-second + per-GB-second (only while processing requests).
   * Minimum instances contribute idle cost.
   */
  static cloudRunHourlyCost(cpu: string, memoryMb: number, minInstances: number): number {
    const cpuNum     = parseFloat(cpu);
    // Allocated CPU: $0.00002400/vCPU-second = $0.0864/vCPU-hour
    // Allocated RAM: $0.00000250/GB-second   = $0.009/GB-hour
    const cpuHourly  = cpuNum * 0.0864;
    const ramHourly  = (memoryMb / 1024) * 0.009;
    return parseFloat(((cpuHourly + ramHourly) * Math.max(minInstances, 0)).toFixed(6));
  }

  /**
   * Cloud Functions pricing: per invocation + per GB-second.
   * Approximation based on runtime and memory.
   */
  static cloudFunctionHourlyCost(memoryMb: number, estimatedInvocationsPerHour = 1000): number {
    const invocationCost = estimatedInvocationsPerHour * 0.0000004; // $0.40/million
    const computeCost    = estimatedInvocationsPerHour * (memoryMb / 1024) * 0.0000025 * 0.2; // avg 200ms
    return parseFloat((invocationCost + computeCost).toFixed(6));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
