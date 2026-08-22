import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/response.js";

export function requireRole(...allowedRoles: ("employee" | "admin")[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action"));
    }

    next();
  };
}
