// apps/api/src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from "express";
import { ZodError }                         from "zod";
import { Prisma }                           from "@prisma/client";
import { logger }                           from "../lib/logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code:       string,
    message:           string,
    public details?:   unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err:   Error,
  req:   Request,
  res:   Response,
  _next: NextFunction,
): void {
  const requestId = (req as any).requestId ?? "unknown";
  const meta      = { requestId, timestamp: new Date().toISOString() };

  // Zod validation errors → 400
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code:    "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.flatten().fieldErrors,
      },
      meta,
    });
    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error({ err, requestId }, "Application error");
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
      meta,
    });
    return;
  }

  // Prisma unique constraint → 409
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({
        success: false,
        error: { code: "CONFLICT", message: "Resource already exists", details: err.meta },
        meta,
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Resource not found" },
        meta,
      });
      return;
    }
  }

  // Unexpected — never leak internals in production
  logger.error({ err, requestId }, "Unhandled error");
  res.status(500).json({
    success: false,
    error: {
      code:    "INTERNAL_ERROR",
      message: process.env.NODE_ENV === "production" ? "An internal error occurred" : err.message,
    },
    meta,
  });
}
