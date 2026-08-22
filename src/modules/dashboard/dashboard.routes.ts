import { Router } from "express";
import { DashboardController } from "./dashboard.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// Dashboard Router (GET /dashboard)
export const dashboardRouter = Router();
dashboardRouter.get("/", requireAuth, asyncHandler(DashboardController.getDashboard));

// Notifications Router (GET /notifications, PATCH /notifications/:id/read, etc.)
export const notificationsRouter = Router();
notificationsRouter.get("/", requireAuth, asyncHandler(DashboardController.getNotifications));
notificationsRouter.patch(
  "/read-all",
  requireAuth,
  asyncHandler(DashboardController.markAllNotificationsRead)
);
notificationsRouter.patch(
  "/:id/read",
  requireAuth,
  asyncHandler(DashboardController.markNotificationRead)
);

// Reports Router (GET /reports/attendance, GET /reports/salary-slip/:userId)
export const reportsRouter = Router();
reportsRouter.get(
  "/attendance",
  requireAuth,
  requireRole("admin"),
  asyncHandler(DashboardController.getAttendanceReport)
);
reportsRouter.get(
  "/salary-slip/:userId",
  requireAuth,
  asyncHandler(DashboardController.getSalarySlip)
);
