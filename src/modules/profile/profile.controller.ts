import type { Request, Response } from "express";
import { ProfileService } from "./profile.service.js";
import {
  updateEmployeeProfileSchema,
  updateAdminProfileSchema,
  uploadDocumentSchema,
} from "./profile.schema.js";
import { sendSuccess, AppError } from "../../utils/response.js";

export class ProfileController {
  static async getMe(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const profile = await ProfileService.getProfileByUserId(req.user.userId);
    return sendSuccess(res, profile, 200);
  }

  static async updateMe(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const validatedData = updateEmployeeProfileSchema.parse(req.body);
    const updatedProfile = await ProfileService.updateEmployeeProfile(
      req.user.userId,
      validatedData
    );
    return sendSuccess(res, updatedProfile, 200);
  }

  static async getProfileById(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const targetUserId = req.params.userId as string;

    if (req.user.role !== "admin" && req.user.userId !== targetUserId) {
      throw new AppError(403, "FORBIDDEN", "You are not allowed to view this profile");
    }

    const profile = await ProfileService.getProfileByUserId(targetUserId);
    return sendSuccess(res, profile, 200);
  }

  static async updateProfileById(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const targetUserId = req.params.userId as string;
    const validatedData = updateAdminProfileSchema.parse(req.body);
    const updatedProfile = await ProfileService.updateAdminProfile(
      targetUserId,
      validatedData
    );
    return sendSuccess(res, updatedProfile, 200);
  }

  static async uploadDocument(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const targetUserId = req.params.userId as string;

    if (req.user.role !== "admin" && req.user.userId !== targetUserId) {
      throw new AppError(403, "FORBIDDEN", "You are not allowed to upload documents for this user");
    }

    let docType = req.body.doc_type;
    let fileUrl = req.body.file_url;

    if (req.file) {
      fileUrl = `/uploads/${req.file.filename}`;
      if (!docType) {
        docType = req.file.originalname || "Document";
      }
    } else {
      const validatedData = uploadDocumentSchema.parse(req.body);
      docType = validatedData.doc_type;
      fileUrl = validatedData.file_url;
    }

    if (!fileUrl) {
      throw new AppError(400, "VALIDATION_ERROR", "A file or file_url is required");
    }

    const document = await ProfileService.addDocument(targetUserId, docType, fileUrl);
    return sendSuccess(res, document, 201);
  }

  static async getDocuments(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const targetUserId = req.params.userId as string;

    if (req.user.role !== "admin" && req.user.userId !== targetUserId) {
      throw new AppError(403, "FORBIDDEN", "You are not allowed to view documents for this user");
    }

    const docs = await ProfileService.getDocuments(targetUserId);
    return sendSuccess(res, docs, 200);
  }

  static async deleteDocument(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const targetUserId = req.params.userId as string;
    const documentId = req.params.documentId as string;

    if (req.user.role !== "admin" && req.user.userId !== targetUserId) {
      throw new AppError(403, "FORBIDDEN", "You are not allowed to delete documents for this user");
    }

    const result = await ProfileService.deleteDocument(targetUserId, documentId);
    return sendSuccess(res, result, 200);
  }
}
