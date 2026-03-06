// apps/api/src/middleware/rateLimiter.ts
// Extracted from server.ts to break the circular-dependency chain:
//   server.ts → auth.ts → server.ts (authLimiter import)

import rateLimit from "express-rate-limit";

// Global: 200 req / min
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: { code: "RATE_LIMIT", message: "Too many requests" } },
});

// Auth: 10 req / min — brute-force protection on login/register
export const authLimiter = rateLimit({
  windowMs: 60_000,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  skipSuccessfulRequests: false,   // count ALL attempts (was `true` — allowed email enumeration)
  message: { success: false, error: { code: "AUTH_RATE_LIMIT", message: "Too many auth attempts, try again in a minute" } },
});

// Refresh: 20 req / min — prevents brute-forcing refresh tokens
export const refreshLimiter = rateLimit({
  windowMs: 60_000,
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: { code: "RATE_LIMIT", message: "Too many refresh attempts" } },
});
