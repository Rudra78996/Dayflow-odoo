import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, employeeProfiles, documents } from "../../db/Schema/index.js";
import { AppError } from "../../utils/response.js";
import type { UpdateEmployeeProfileInput, UpdateAdminProfileInput } from "./profile.schema.js";

export class ProfileService {
  static async getProfileByUserId(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }

    const profile = await db.query.employeeProfiles.findFirst({
      where: eq(employeeProfiles.userId, userId),
    });

    const userDocs = await db.query.documents.findMany({
      where: eq(documents.userId, userId),
    });

    return {
      id: profile?.id || null,
      user_id: user.id,
      employee_id: user.employeeId,
      email: user.email,
      role: user.role,
      is_verified: user.isVerified,
      full_name: profile?.fullName || "",
      phone: profile?.phone || null,
      address: profile?.address || null,
      profile_picture_url: profile?.profilePictureUrl || null,
      designation: profile?.designation || null,
      department: profile?.department || null,
      date_of_joining: profile?.dateOfJoining || null,
      employment_type: profile?.employmentType || null,
      documents: userDocs.map((doc) => ({
        id: doc.id,
        user_id: doc.userId,
        doc_type: doc.docType,
        file_url: doc.fileUrl,
        uploaded_at: doc.uploadedAt,
      })),
      created_at: profile?.createdAt || user.createdAt,
      updated_at: profile?.updatedAt || user.updatedAt,
    };
  }

  static async updateEmployeeProfile(userId: string, data: UpdateEmployeeProfileInput) {
    const existingProfile = await db.query.employeeProfiles.findFirst({
      where: eq(employeeProfiles.userId, userId),
    });

    const updateFields: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (data.full_name !== undefined) updateFields.fullName = data.full_name;
    if (data.phone !== undefined) updateFields.phone = data.phone;
    if (data.address !== undefined) updateFields.address = data.address;
    if (data.profile_picture_url !== undefined) updateFields.profilePictureUrl = data.profile_picture_url;

    if (!existingProfile) {
      await db.insert(employeeProfiles).values({
        userId,
        fullName: data.full_name || "Employee",
        phone: data.phone || null,
        address: data.address || null,
        profilePictureUrl: data.profile_picture_url || null,
      });
    } else {
      await db
        .update(employeeProfiles)
        .set(updateFields)
        .where(eq(employeeProfiles.userId, userId));
    }

    return this.getProfileByUserId(userId);
  }

  static async updateAdminProfile(userId: string, data: UpdateAdminProfileInput) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const existingProfile = await db.query.employeeProfiles.findFirst({
      where: eq(employeeProfiles.userId, userId),
    });

    const updateFields: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (data.full_name !== undefined) updateFields.fullName = data.full_name;
    if (data.phone !== undefined) updateFields.phone = data.phone;
    if (data.address !== undefined) updateFields.address = data.address;
    if (data.profile_picture_url !== undefined) updateFields.profilePictureUrl = data.profile_picture_url;
    if (data.designation !== undefined) updateFields.designation = data.designation;
    if (data.department !== undefined) updateFields.department = data.department;
    if (data.date_of_joining !== undefined) updateFields.dateOfJoining = data.date_of_joining;
    if (data.employment_type !== undefined) updateFields.employmentType = data.employment_type;

    if (!existingProfile) {
      await db.insert(employeeProfiles).values({
        userId,
        fullName: data.full_name || "Employee",
        phone: data.phone || null,
        address: data.address || null,
        profilePictureUrl: data.profile_picture_url || null,
        designation: data.designation || null,
        department: data.department || null,
        dateOfJoining: data.date_of_joining || null,
        employmentType: data.employment_type || "full-time",
      });
    } else {
      await db
        .update(employeeProfiles)
        .set(updateFields)
        .where(eq(employeeProfiles.userId, userId));
    }

    return this.getProfileByUserId(userId);
  }

  static async addDocument(userId: string, docType: string, fileUrl: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const [newDoc] = await db
      .insert(documents)
      .values({
        userId,
        docType,
        fileUrl,
      })
      .returning();

    if (!newDoc) {
      throw new AppError(500, "DOCUMENT_UPLOAD_FAILED", "Failed to save document");
    }

    return {
      id: newDoc.id,
      user_id: newDoc.userId,
      doc_type: newDoc.docType,
      file_url: newDoc.fileUrl,
      uploaded_at: newDoc.uploadedAt,
    };
  }

  static async getDocuments(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const userDocs = await db.query.documents.findMany({
      where: eq(documents.userId, userId),
    });

    return userDocs.map((doc) => ({
      id: doc.id,
      user_id: doc.userId,
      doc_type: doc.docType,
      file_url: doc.fileUrl,
      uploaded_at: doc.uploadedAt,
    }));
  }

  static async deleteDocument(userId: string, documentId: string) {
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc || doc.userId !== userId) {
      throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found for this user");
    }

    await db.delete(documents).where(eq(documents.id, documentId));

    return { message: "Document deleted successfully" };
  }
}
