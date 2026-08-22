import { Router } from "express";
import { PayrollController } from "./payroll.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

// Logged in employee salary view
router.get("/me", requireAuth, asyncHandler(PayrollController.getMySalary));

// Admin/Self history view
router.get("/:userId/history", requireAuth, asyncHandler(PayrollController.getSalaryHistory));

// Admin/Self single salary structure view
router.get("/:userId", requireAuth, asyncHandler(PayrollController.getUserSalary));

// Admin update/create salary structure (PUT /payroll/:userId)
router.put(
  "/:userId",
  requireAuth,
  requireRole("admin"),
  asyncHandler(PayrollController.updateUserSalary)
);

export const payrollRouter = router;
