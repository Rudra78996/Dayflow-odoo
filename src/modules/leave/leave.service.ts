import { eq, and, inArray, lte, gte, desc, count } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  leaveRequests,
  notifications,
  attendance,
  users,
  employeeProfiles,
} from "../../db/Schema/index.js";
import { AppError } from "../../utils/response.js";
import type {
  ApplyLeaveInput,
  LeaveDecisionInput,
  AdminLeaveQueryInput,
} from "./leave.schema.js";

function getDateRangeArray(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const curr = new Date(startStr);
  const end = new Date(endStr);

  while (curr <= end) {
    dates.push(curr.toISOString().split("T")[0]!);
    curr.setDate(curr.getDate() + 1);
  }

  return dates;
}

export class LeaveService {
  static async applyLeave(userId: string, data: ApplyLeaveInput) {
    if (data.end_date < data.start_date) {
      throw new AppError(
        400,
        "INVALID_DATE_RANGE",
        "end_date must be greater than or equal to start_date"
      );
    }

    // Check overlapping leave requests
    const overlappingRequests = await db.query.leaveRequests.findFirst({
      where: and(
        eq(leaveRequests.userId, userId),
        inArray(leaveRequests.status, ["pending", "approved"]),
        lte(leaveRequests.startDate, data.end_date),
        gte(leaveRequests.endDate, data.start_date)
      ),
    });

    if (overlappingRequests) {
      throw new AppError(
        409,
        "LEAVE_OVERLAP",
        "You already have a pending or approved leave request during this date range"
      );
    }

    const [newLeave] = await db
      .insert(leaveRequests)
      .values({
        userId,
        leaveType: data.leave_type,
        startDate: data.start_date,
        endDate: data.end_date,
        remarks: data.remarks || null,
        status: "pending",
      })
      .returning();

    if (!newLeave) {
      throw new AppError(500, "LEAVE_APPLY_FAILED", "Failed to submit leave request");
    }

    return {
      id: newLeave.id,
      user_id: newLeave.userId,
      leave_type: newLeave.leaveType,
      start_date: newLeave.startDate,
      end_date: newLeave.endDate,
      remarks: newLeave.remarks,
      status: newLeave.status,
      created_at: newLeave.createdAt,
    };
  }

  static async getMyLeaveRequests(userId: string, statusFilter?: string) {
    const conditions = [eq(leaveRequests.userId, userId)];

    if (statusFilter) {
      conditions.push(eq(leaveRequests.status, statusFilter as any));
    }

    const requests = await db.query.leaveRequests.findMany({
      where: and(...conditions),
      orderBy: [desc(leaveRequests.createdAt)],
    });

    return requests.map((req) => ({
      id: req.id,
      user_id: req.userId,
      leave_type: req.leaveType,
      start_date: req.startDate,
      end_date: req.endDate,
      remarks: req.remarks,
      status: req.status,
      reviewed_by: req.reviewedBy,
      admin_comment: req.adminComment,
      created_at: req.createdAt,
      updated_at: req.updatedAt,
    }));
  }

  static async getAdminLeaveRequests(query: AdminLeaveQueryInput) {
    const conditions: any[] = [];

    if (query.status) {
      conditions.push(eq(leaveRequests.status, query.status));
    }
    if (query.user_id) {
      conditions.push(eq(leaveRequests.userId, query.user_id));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allRequests = await db.query.leaveRequests.findMany({
      where: whereClause,
      orderBy: [desc(leaveRequests.createdAt)],
    });

    const page = query.page || 1;
    const limit = query.limit || 10;
    const total = allRequests.length;
    const startIndex = (page - 1) * limit;
    const paginatedRequests = allRequests.slice(startIndex, startIndex + limit);

    const allUsers = await db.query.users.findMany();
    const allProfiles = await db.query.employeeProfiles.findMany();

    const userMap = new Map<string, typeof allUsers[0]>();
    for (const u of allUsers) userMap.set(u.id, u);

    const profileMap = new Map<string, typeof allProfiles[0]>();
    for (const p of allProfiles) profileMap.set(p.userId, p);

    const records = paginatedRequests.map((req) => {
      const u = userMap.get(req.userId);
      const prof = profileMap.get(req.userId);

      return {
        id: req.id,
        user_id: req.userId,
        employee_id: u?.employeeId || "",
        full_name: prof?.fullName || "",
        email: u?.email || "",
        department: prof?.department || null,
        leave_type: req.leaveType,
        start_date: req.startDate,
        end_date: req.endDate,
        remarks: req.remarks,
        status: req.status,
        reviewed_by: req.reviewedBy,
        admin_comment: req.adminComment,
        created_at: req.createdAt,
        updated_at: req.updatedAt,
      };
    });

    return {
      page,
      limit,
      total,
      records,
    };
  }

  static async processLeaveDecision(
    leaveId: string,
    adminUserId: string,
    data: LeaveDecisionInput
  ) {
    const request = await db.query.leaveRequests.findFirst({
      where: eq(leaveRequests.id, leaveId),
    });

    if (!request) {
      throw new AppError(404, "LEAVE_NOT_FOUND", "Leave request not found");
    }

    if (request.status !== "pending") {
      throw new AppError(
        400,
        "LEAVE_ALREADY_PROCESSED",
        "Leave request has already been reviewed"
      );
    }

    const [updated] = await db
      .update(leaveRequests)
      .set({
        status: data.decision,
        reviewedBy: adminUserId,
        adminComment: data.admin_comment || null,
        updatedAt: new Date(),
      })
      .where(eq(leaveRequests.id, leaveId))
      .returning();

    if (!updated) {
      throw new AppError(500, "LEAVE_UPDATE_FAILED", "Failed to update leave request");
    }

    // Side Effect 1: Insert notification for applicant
    const notifType = data.decision === "approved" ? "leave_approved" : "leave_rejected";
    const notifMessage = `Your ${updated.leaveType} leave request from ${updated.startDate} to ${updated.endDate} was ${data.decision}.`;

    await db.insert(notifications).values({
      userId: updated.userId,
      type: notifType,
      message: notifMessage,
    });

    // Side Effect 2: If approved, backfill matching attendance rows for that date range with status='leave'
    if (data.decision === "approved") {
      const datesToBackfill = getDateRangeArray(updated.startDate, updated.endDate);

      for (const dStr of datesToBackfill) {
        const existingAtt = await db.query.attendance.findFirst({
          where: and(eq(attendance.userId, updated.userId), eq(attendance.date, dStr)),
        });

        if (existingAtt) {
          await db
            .update(attendance)
            .set({
              status: "leave",
              updatedAt: new Date(),
            })
            .where(eq(attendance.id, existingAtt.id));
        } else {
          await db.insert(attendance).values({
            userId: updated.userId,
            date: dStr,
            status: "leave",
          });
        }
      }
    }

    return {
      id: updated.id,
      user_id: updated.userId,
      leave_type: updated.leaveType,
      start_date: updated.startDate,
      end_date: updated.endDate,
      remarks: updated.remarks,
      status: updated.status,
      reviewed_by: updated.reviewedBy,
      admin_comment: updated.adminComment,
      created_at: updated.createdAt,
      updated_at: updated.updatedAt,
    };
  }
}
