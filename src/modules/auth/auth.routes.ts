import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.post("/signup", asyncHandler(AuthController.signup));
router.get("/verify-email", asyncHandler(AuthController.verifyEmail));
router.post("/login", asyncHandler(AuthController.login));
router.post("/refresh", asyncHandler(AuthController.refresh));
router.post("/logout", requireAuth, asyncHandler(AuthController.logout));
router.get("/me", requireAuth, asyncHandler(AuthController.me));

export const authRouter = router;
