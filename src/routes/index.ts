import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { profileRouter } from "../modules/profile/profile.routes.js";
import { attendanceRouter } from "../modules/attendance/attendance.routes.js";
import { payrollRouter } from "../modules/payroll/payroll.routes.js";

const router = Router();

router.use("/auth", authRouter);
router.use("/profile", profileRouter);
router.use("/attendance", attendanceRouter);
router.use("/payroll", payrollRouter);

export default router;
