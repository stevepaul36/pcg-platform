// apps/api/src/lib/logger.ts
// Extracted logger — avoids the circular-dependency chain:
//   prisma.ts → server.ts → prisma.ts

import { pino } from "pino";
import { env }  from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === "development" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
  // Redact sensitive fields so they never appear in logs
  redact: {
    paths: [
      "req.headers.authorization",
      "body.password",
      "body.passwordHash",
      "body.currentPassword",
      "body.newPassword",
      "body.refreshToken",
      "body.accessToken",
    ],
    censor: "[REDACTED]",
  },
});
