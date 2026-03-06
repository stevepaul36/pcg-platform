// apps/api/src/middleware/timeout.ts
// ─── Request Timeout ──────────────────────────────────────────────────────────
// Returns 408 Request Timeout if a request takes longer than the specified
// duration. This prevents slow clients or runaway queries from consuming
// server resources indefinitely.

import { Request, Response, NextFunction } from "express";

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

export function requestTimeout(timeoutMs = DEFAULT_TIMEOUT_MS) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: {
            code: "REQUEST_TIMEOUT",
            message: `Request timed out after ${timeoutMs / 1000}s`,
          },
        });
      }
    }, timeoutMs);

    // Clean up the timer when the response finishes
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}
