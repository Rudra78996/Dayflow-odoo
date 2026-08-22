import type { Request, Response } from "express";
import { PayrollService } from "./payroll.service.js";
import { setSalaryStructureSchema } from "./payroll.schema.js";
import { sendSuccess, AppError } from "../../utils/response.js";

export class PayrollController {
  static async getMySalary(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const result = await PayrollService.getCurrentSalary(req.user.userId);
    return sendSuccess(res, result, 200);
  }

  static async getUserSalary(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const targetUserId = req.params.userId as string;

    if (req.user.role !== "admin" && req.user.userId !== targetUserId) {
      throw new AppError(403, "FORBIDDEN", "You are not allowed to view salary for this user");
    }

    const result = await PayrollService.getCurrentSalary(targetUserId);
    return sendSuccess(res, result, 200);
  }

  static async updateUserSalary(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const targetUserId = req.params.userId as string;
    const validatedData = setSalaryStructureSchema.parse(req.body);

    const result = await PayrollService.setSalaryStructure(
      targetUserId,
      req.user.userId,
      validatedData
    );
    return sendSuccess(res, result, 200);
  }

  static async getSalaryHistory(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const targetUserId = req.params.userId as string;

    if (req.user.role !== "admin" && req.user.userId !== targetUserId) {
      throw new AppError(403, "FORBIDDEN", "You are not allowed to view salary history for this user");
    }

    const result = await PayrollService.getSalaryHistory(targetUserId);
    return sendSuccess(res, result, 200);
  }
}
