import { Router } from "express";
import { LeaveController } from "./leave.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

// Employee apply for leave (POST /leave)
router.post("/", requireAuth, asyncHandler(LeaveController.applyLeave));

// Employee list own requests (GET /leave/me?status=)
router.get("/me", requireAuth, asyncHandler(LeaveController.getMyLeaves));

// Admin list/filter all requests (GET /leave?status=&user_id=)
router.get("/", requireAuth, requireRole("admin"), asyncHandler(LeaveController.getAdminLeaves));

// Admin decision (PATCH /leave/:id/decision)
router.patch(
  "/:id/decision",
  requireAuth,
  requireRole("admin"),
  asyncHandler(LeaveController.processDecision)
);

export const leaveRouter = router;
