import type { Request, Response } from "express";
import { AttendanceService } from "./attendance.service.js";
import { attendanceQuerySchema, adminAttendanceQuerySchema } from "./attendance.schema.js";
import { sendSuccess, AppError } from "../../utils/response.js";

export class AttendanceController {
  static async checkIn(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const result = await AttendanceService.checkIn(req.user.userId);
    return sendSuccess(res, result, 200);
  }

  static async checkOut(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const result = await AttendanceService.checkOut(req.user.userId);
    return sendSuccess(res, result, 200);
  }

  static async getMyAttendance(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const validatedQuery = attendanceQuerySchema.parse(req.query);
    const result = await AttendanceService.getUserAttendance(
      req.user.userId,
      validatedQuery.view,
      validatedQuery.date
    );
    return sendSuccess(res, result, 200);
  }

  static async getUserAttendance(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const targetUserId = req.params.userId as string;

    if (req.user.role !== "admin" && req.user.userId !== targetUserId) {
      throw new AppError(403, "FORBIDDEN", "You are not allowed to view attendance for this user");
    }

    const validatedQuery = attendanceQuerySchema.parse(req.query);
    const result = await AttendanceService.getUserAttendance(
      targetUserId,
      validatedQuery.view,
      validatedQuery.date
    );
    return sendSuccess(res, result, 200);
  }

  static async getAllAttendance(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const validatedQuery = adminAttendanceQuerySchema.parse(req.query);
    const result = await AttendanceService.getAllAttendanceForDay(validatedQuery.date);
    return sendSuccess(res, result, 200);
  }
}
