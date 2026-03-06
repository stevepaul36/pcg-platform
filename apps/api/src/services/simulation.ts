// apps/api/src/services/simulation.ts

import { prisma } from "../lib/prisma";

// ── Machine type catalogue ────────────────────────────────────────────────────

const MACHINE_TYPES: Record<string, { vcpus: number; ram: number; price: number }> = {
  "e2-micro":      { vcpus: 2,  ram: 1,    price: 0.0076  },
  "e2-small":      { vcpus: 2,  ram: 2,    price: 0.0134  },
  "e2-medium":     { vcpus: 2,  ram: 4,    price: 0.0268  },
  "n1-standard-1": { vcpus: 1,  ram: 3.75, price: 0.0475  },
  "n1-standard-2": { vcpus: 2,  ram: 7.5,  price: 0.0950  },
  "n1-standard-4": { vcpus: 4,  ram: 15,   price: 0.1900  },
  "n2-standard-2": { vcpus: 2,  ram: 8,    price: 0.0971  },
  "n2-standard-4": { vcpus: 4,  ram: 16,   price: 0.1943  },
  "c2-standard-4": { vcpus: 4,  ram: 16,   price: 0.2088  },
  "c2-standard-8": { vcpus: 8,  ram: 32,   price: 0.4176  },
};

const REGION_MULTIPLIERS: Record<string, number> = {
  "us-central1":    1.00,
  "us-east1":       1.00,
  "us-west1":       1.00,
  "europe-west1":   1.08,
  "europe-west2":   1.12,
  "asia-south1":    1.05,
  "asia-east1":     1.05,
  "asia-southeast1":1.10,
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

    const diskRates: Record<string, number> = {
      "pd-standard": 0.00005484,
      "pd-balanced": 0.00010959,
      "pd-ssd":      0.00023288,
    };

    return {
      compute: parseFloat((spec.price * mult).toFixed(6)),
      disk:    parseFloat(((diskRates[diskType] ?? 0.00005484) * diskGb).toFixed(6)),
    };
  }

  /** Converts an hourly rate to a monthly estimate (730 hours). */
  static monthlyCost(hourlyCost: number): number {
    return parseFloat((hourlyCost * 730).toFixed(2));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
