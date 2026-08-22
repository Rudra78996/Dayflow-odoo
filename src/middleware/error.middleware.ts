import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, sendError } from "../utils/response.js";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ZodError) {
    const issueMessages = err.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    return sendError(res, issueMessages, "VALIDATION_ERROR", 400);
  }

  if (err instanceof AppError) {
    return sendError(res, err.message, err.code, err.statusCode);
  }

  console.error("Unhandled Error:", err);
  return sendError(
    res,
    err.message || "An unexpected error occurred",
    "INTERNAL_SERVER_ERROR",
    500
  );
}
