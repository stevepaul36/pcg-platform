// apps/api/src/middleware/requestId.ts

import { Request, Response, NextFunction } from "express";
import { randomUUID }                       from "crypto";

// Validate x-request-id from client to prevent log injection.
// Accept only UUID-shaped values; generate fresh ID otherwise.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers["x-request-id"] as string | undefined;
  const id = incoming && UUID_RE.test(incoming) ? incoming : randomUUID();
  (req as any).requestId = id;
  res.setHeader("x-request-id", id);
  next();
}
