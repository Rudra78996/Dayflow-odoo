import { Router } from "express";
import { AttendanceController } from "./attendance.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

// Employee check-in & check-out
router.post("/check-in", requireAuth, asyncHandler(AttendanceController.checkIn));
router.post("/check-out", requireAuth, asyncHandler(AttendanceController.checkOut));

// Current user attendance record
router.get("/me", requireAuth, asyncHandler(AttendanceController.getMyAttendance));

// Admin route: all employees' attendance for a given day (GET /attendance?date=YYYY-MM-DD)
router.get("/", requireAuth, requireRole("admin"), asyncHandler(AttendanceController.getAllAttendance));

// Specified user attendance record (GET /attendance/:userId?view=daily|weekly&date=YYYY-MM-DD)
router.get("/:userId", requireAuth, asyncHandler(AttendanceController.getUserAttendance));

export const attendanceRouter = router;
