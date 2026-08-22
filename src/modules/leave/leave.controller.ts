import type { Request, Response } from "express";
import { LeaveService } from "./leave.service.js";
import {
  applyLeaveSchema,
  leaveDecisionSchema,
  myLeaveQuerySchema,
  adminLeaveQuerySchema,
} from "./leave.schema.js";
import { sendSuccess, AppError } from "../../utils/response.js";

export class LeaveController {
  static async applyLeave(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const validatedData = applyLeaveSchema.parse(req.body);
    const result = await LeaveService.applyLeave(req.user.userId, validatedData);
    return sendSuccess(res, result, 201);
  }

  static async getMyLeaves(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const validatedQuery = myLeaveQuerySchema.parse(req.query);
    const result = await LeaveService.getMyLeaveRequests(
      req.user.userId,
      validatedQuery.status
    );
    return sendSuccess(res, result, 200);
  }

  static async getAdminLeaves(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const validatedQuery = adminLeaveQuerySchema.parse(req.query);
    const result = await LeaveService.getAdminLeaveRequests(validatedQuery);
    return sendSuccess(res, result, 200);
  }

  static async processDecision(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const leaveId = req.params.id as string;
    const validatedData = leaveDecisionSchema.parse(req.body);

    const result = await LeaveService.processLeaveDecision(
      leaveId,
      req.user.userId,
      validatedData
    );
    return sendSuccess(res, result, 200);
  }
}
