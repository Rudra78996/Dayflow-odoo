import type { Request, Response } from "express";
import { DashboardService } from "./dashboard.service.js";
import {
  attendanceReportQuerySchema,
  salarySlipQuerySchema,
} from "./dashboard.schema.js";
import { sendSuccess, AppError } from "../../utils/response.js";

export class DashboardController {
  static async getDashboard(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    if (req.user.role === "admin") {
      const data = await DashboardService.getAdminDashboard(req.user.userId);
      return sendSuccess(res, data, 200);
    }

    const data = await DashboardService.getEmployeeDashboard(req.user.userId);
    return sendSuccess(res, data, 200);
  }

  static async getNotifications(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const alerts = await DashboardService.getNotifications(req.user.userId);
    return sendSuccess(res, alerts, 200);
  }

  static async markNotificationRead(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const notifId = req.params.id as string;
    const result = await DashboardService.markNotificationRead(notifId, req.user.userId);
    return sendSuccess(res, result, 200);
  }

  static async markAllNotificationsRead(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const result = await DashboardService.markAllNotificationsRead(req.user.userId);
    return sendSuccess(res, result, 200);
  }

  static async getAttendanceReport(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const validatedQuery = attendanceReportQuerySchema.parse(req.query);
    const result = await DashboardService.getAttendanceReport(validatedQuery);

    if (validatedQuery.format === "csv" && typeof result === "string") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="attendance_report.csv"');
      return res.status(200).send(result);
    }

    return sendSuccess(res, result, 200);
  }

  static async getSalarySlip(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const targetUserId = req.params.userId as string;

    if (req.user.role !== "admin" && req.user.userId !== targetUserId) {
      throw new AppError(403, "FORBIDDEN", "You are not allowed to view salary slip for this user");
    }

    const validatedQuery = salarySlipQuerySchema.parse(req.query);
    const result = await DashboardService.getSalarySlipData(
      targetUserId,
      validatedQuery.month
    );
    return sendSuccess(res, result, 200);
  }
}
