import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { ProfileController } from "./profile.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const router = Router();

// Logged-in user routes
router.get("/me", requireAuth, asyncHandler(ProfileController.getMe));
router.patch("/me", requireAuth, asyncHandler(ProfileController.updateMe));

// Specified user profile routes
router.get("/:userId", requireAuth, asyncHandler(ProfileController.getProfileById));
router.patch(
  "/:userId",
  requireAuth,
  requireRole("admin"),
  asyncHandler(ProfileController.updateProfileById)
);

// Document management routes
router.post(
  "/:userId/documents",
  requireAuth,
  upload.single("file"),
  asyncHandler(ProfileController.uploadDocument)
);
router.get("/:userId/documents", requireAuth, asyncHandler(ProfileController.getDocuments));
router.delete(
  "/:userId/documents/:documentId",
  requireAuth,
  asyncHandler(ProfileController.deleteDocument)
);

export const profileRouter = router;
