// apps/api/src/lib/bigintPatch.ts
// ─── BigInt JSON serialization ──────────────────────────────────────────────
// Prisma models like StorageBucket.totalSizeBytes use BigInt. Express's
// res.json() calls JSON.stringify() internally, which throws:
//   "TypeError: Do not know how to serialize a BigInt"
//
// This patch makes BigInt serialize as a number string. Import it once at the
// top of server.ts BEFORE any route handlers run.

(BigInt.prototype as any).toJSON = function () {
  // If the value fits safely in a JS number, return it as a number.
  // Otherwise return a string to avoid precision loss.
  const n = Number(this);
  return Number.isSafeInteger(n) ? n : this.toString();
};
