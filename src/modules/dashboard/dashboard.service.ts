import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  users,
  employeeProfiles,
  attendance,
  leaveRequests,
  notifications,
  salaryStructures,
} from "../../db/Schema/index.js";
import { AppError } from "../../utils/response.js";
import type { AttendanceReportQueryInput } from "./dashboard.schema.js";

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0]!;
}

function getFirstDayOfMonthString(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0]!;
}

export class DashboardService {
  static async getEmployeeDashboard(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const profile = await db.query.employeeProfiles.findFirst({
      where: eq(employeeProfiles.userId, userId),
    });

    const today = getTodayDateString();
    const todayAtt = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, userId), eq(attendance.date, today)),
    });

    const pendingLeaves = await db.query.leaveRequests.findMany({
      where: and(
        eq(leaveRequests.userId, userId),
        eq(leaveRequests.status, "pending")
      ),
    });

    const recentAlerts = await db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: [desc(notifications.createdAt)],
      limit: 5,
    });

    return {
      profile_summary: {
        full_name: profile?.fullName || "",
        employee_id: user.employeeId,
        designation: profile?.designation || null,
        department: profile?.department || null,
        profile_picture_url: profile?.profilePictureUrl || null,
      },
      today_attendance: {
        status: todayAtt?.status || "not_checked_in",
        check_in_time: todayAtt?.checkInTime || null,
        check_out_time: todayAtt?.checkOutTime || null,
      },
      pending_leaves: pendingLeaves.length,
      recent_alerts: recentAlerts.map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        is_read: n.isRead,
        created_at: n.createdAt,
      })),
    };
  }

  static async getAdminDashboard(adminUserId: string) {
    const allUsers = await db.query.users.findMany();
    const today = getTodayDateString();

    const todayAttendanceRecords = await db.query.attendance.findMany({
      where: eq(attendance.date, today),
    });

    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;

    const userAttMap = new Map<string, string>();
    for (const att of todayAttendanceRecords) {
      userAttMap.set(att.userId, att.status);
    }

    for (const u of allUsers) {
      const st = userAttMap.get(u.id) || "absent";
      if (st === "present") present++;
      else if (st === "absent") absent++;
      else if (st === "half-day") halfDay++;
      else if (st === "leave") leave++;
    }

    const pendingLeaves = await db.query.leaveRequests.findMany({
      where: eq(leaveRequests.status, "pending"),
    });

    const recentAlerts = await db.query.notifications.findMany({
      where: eq(notifications.userId, adminUserId),
      orderBy: [desc(notifications.createdAt)],
      limit: 5,
    });

    return {
      employee_count: allUsers.length,
      today_attendance_summary: {
        present,
        absent,
        half_day: halfDay,
        leave,
      },
      pending_leave_approvals: pendingLeaves.length,
      recent_alerts: recentAlerts.map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        is_read: n.isRead,
        created_at: n.createdAt,
      })),
    };
  }

  static async getNotifications(userId: string) {
    const alerts = await db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: [desc(notifications.createdAt)],
    });

    return alerts.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      is_read: n.isRead,
      created_at: n.createdAt,
    }));
  }

  static async markNotificationRead(notificationId: string, userId: string) {
    const notif = await db.query.notifications.findFirst({
      where: and(eq(notifications.id, notificationId), eq(notifications.userId, userId)),
    });

    if (!notif) {
      throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
    }

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));

    return { message: "Notification marked as read" };
  }

  static async markAllNotificationsRead(userId: string) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));

    return { message: "All notifications marked as read" };
  }

  static async getAttendanceReport(query: AttendanceReportQueryInput) {
    const fromStr = query.from || getFirstDayOfMonthString();
    const toStr = query.to || getTodayDateString();

    const conditions = [
      gte(attendance.date, fromStr),
      lte(attendance.date, toStr),
    ];

    if (query.user_id) {
      conditions.push(eq(attendance.userId, query.user_id));
    }

    const records = await db.query.attendance.findMany({
      where: and(...conditions),
      orderBy: [desc(attendance.date)],
    });

    const allUsers = await db.query.users.findMany();
    const allProfiles = await db.query.employeeProfiles.findMany();

    const userMap = new Map<string, typeof allUsers[0]>();
    for (const u of allUsers) userMap.set(u.id, u);

    const profileMap = new Map<string, typeof allProfiles[0]>();
    for (const p of allProfiles) profileMap.set(p.userId, p);

    const formattedRecords = records.map((r) => {
      const u = userMap.get(r.userId);
      const p = profileMap.get(r.userId);
      return {
        date: r.date,
        user_id: r.userId,
        employee_id: u?.employeeId || "",
        full_name: p?.fullName || "",
        department: p?.department || null,
        check_in_time: r.checkInTime ? r.checkInTime.toISOString() : null,
        check_out_time: r.checkOutTime ? r.checkOutTime.toISOString() : null,
        status: r.status,
      };
    });

    if (query.format === "csv") {
      const headers = "Date,Employee ID,Full Name,Department,Status,Check In,Check Out\n";
      const rows = formattedRecords
        .map(
          (rec) =>
            `"${rec.date}","${rec.employee_id}","${rec.full_name}","${rec.department || ""}","${rec.status}","${rec.check_in_time || ""}","${rec.check_out_time || ""}"`
        )
        .join("\n");
      return headers + rows;
    }

    return {
      from: fromStr,
      to: toStr,
      total_records: formattedRecords.length,
      records: formattedRecords,
    };
  }

  static async getSalarySlipData(targetUserId: string, monthStr?: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const profile = await db.query.employeeProfiles.findFirst({
      where: eq(employeeProfiles.userId, targetUserId),
    });

    const currentMonth = monthStr || new Date().toISOString().substring(0, 7); // YYYY-MM
    const [year, month] = currentMonth.split("-").map(Number);

    const firstDateStr = `${currentMonth}-01`;
    const lastDayNum = new Date(year!, month!, 0).getDate();
    const lastDateStr = `${currentMonth}-${String(lastDayNum).padStart(2, "0")}`;

    // Get salary structure applicable for that month
    const salary = await db.query.salaryStructures.findFirst({
      where: and(
        eq(salaryStructures.userId, targetUserId),
        lte(salaryStructures.effectiveFrom, lastDateStr)
      ),
      orderBy: [desc(salaryStructures.effectiveFrom), desc(salaryStructures.createdAt)],
    });

    // Attendance summary for the month
    const monthAtt = await db.query.attendance.findMany({
      where: and(
        eq(attendance.userId, targetUserId),
        gte(attendance.date, firstDateStr),
        lte(attendance.date, lastDateStr)
      ),
    });

    let daysPresent = 0;
    let daysLeave = 0;
    let daysAbsent = 0;

    for (const a of monthAtt) {
      if (a.status === "present") daysPresent++;
      else if (a.status === "leave") daysLeave++;
      else if (a.status === "absent") daysAbsent++;
    }

    const basic = salary ? Number(salary.basic) : 0;
    const hra = salary ? Number(salary.hra) : 0;
    const allowances = salary ? Number(salary.allowances) : 0;
    const deductions = salary ? Number(salary.deductions) : 0;
    const netSalary = salary ? Number(salary.netSalary) : 0;

    return {
      month: currentMonth,
      employee_details: {
        user_id: user.id,
        employee_id: user.employeeId,
        full_name: profile?.fullName || "",
        email: user.email,
        designation: profile?.designation || null,
        department: profile?.department || null,
      },
      attendance_summary: {
        total_days_in_month: lastDayNum,
        days_present: daysPresent,
        days_leave: daysLeave,
        days_absent: daysAbsent,
      },
      earnings: {
        basic,
        hra,
        allowances,
        total_earnings: basic + hra + allowances,
      },
      deductions: {
        pf_tax_deductions: deductions,
        total_deductions: deductions,
      },
      net_salary: netSalary,
      effective_from: salary?.effectiveFrom || null,
    };
  }
}
