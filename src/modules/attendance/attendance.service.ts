import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { attendance, users, employeeProfiles } from "../../db/Schema/index.js";
import { AppError } from "../../utils/response.js";

function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0]!;
}

function getMondayToSundayDates(dateStr: string): string[] {
  const d = new Date(dateStr);
  const dayOfWeek = d.getDay();
  // Adjust so Monday is 0, Sunday is 6
  const diffToMonday = (dayOfWeek + 6) % 7;

  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    dates.push(current.toISOString().split("T")[0]!);
  }

  return dates;
}

export class AttendanceService {
  static async checkIn(userId: string) {
    const today = getTodayDateString();

    const existingRecord = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, userId), eq(attendance.date, today)),
    });

    if (existingRecord && existingRecord.checkInTime) {
      throw new AppError(409, "ALREADY_CHECKED_IN", "Already checked in today");
    }

    const now = new Date();

    if (existingRecord) {
      const [updated] = await db
        .update(attendance)
        .set({
          checkInTime: now,
          status: "present",
          updatedAt: now,
        })
        .where(eq(attendance.id, existingRecord.id))
        .returning();

      return {
        id: updated!.id,
        user_id: updated!.userId,
        date: updated!.date,
        check_in_time: updated!.checkInTime,
        check_out_time: updated!.checkOutTime,
        status: updated!.status,
      };
    }

    const [inserted] = await db
      .insert(attendance)
      .values({
        userId,
        date: today,
        checkInTime: now,
        status: "present",
      })
      .returning();

    return {
      id: inserted!.id,
      user_id: inserted!.userId,
      date: inserted!.date,
      check_in_time: inserted!.checkInTime,
      check_out_time: inserted!.checkOutTime,
      status: inserted!.status,
    };
  }

  static async checkOut(userId: string) {
    const today = getTodayDateString();

    const existingRecord = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, userId), eq(attendance.date, today)),
    });

    if (!existingRecord || !existingRecord.checkInTime) {
      throw new AppError(400, "NOT_CHECKED_IN", "Cannot check out without checking in first");
    }

    if (existingRecord.checkOutTime) {
      throw new AppError(400, "ALREADY_CHECKED_OUT", "Already checked out today");
    }

    const now = new Date();

    const [updated] = await db
      .update(attendance)
      .set({
        checkOutTime: now,
        updatedAt: now,
      })
      .where(eq(attendance.id, existingRecord.id))
      .returning();

    return {
      id: updated!.id,
      user_id: updated!.userId,
      date: updated!.date,
      check_in_time: updated!.checkInTime,
      check_out_time: updated!.checkOutTime,
      status: updated!.status,
    };
  }

  static async getUserAttendance(
    userId: string,
    view: "daily" | "weekly" = "daily",
    dateStr?: string
  ) {
    const targetDate = dateStr || getTodayDateString();

    if (view === "daily") {
      const record = await db.query.attendance.findFirst({
        where: and(eq(attendance.userId, userId), eq(attendance.date, targetDate)),
      });

      return {
        view: "daily",
        records: [
          {
            id: record?.id || null,
            date: targetDate,
            status: record?.status || "absent",
            check_in_time: record?.checkInTime || null,
            check_out_time: record?.checkOutTime || null,
          },
        ],
      };
    }

    // Weekly view
    const weekDates = getMondayToSundayDates(targetDate);
    const startDate = weekDates[0]!;
    const endDate = weekDates[6]!;

    const dbRecords = await db.query.attendance.findMany({
      where: and(
        eq(attendance.userId, userId),
        gte(attendance.date, startDate),
        lte(attendance.date, endDate)
      ),
    });

    const recordsMap = new Map<string, typeof dbRecords[0]>();
    for (const rec of dbRecords) {
      recordsMap.set(rec.date, rec);
    }

    const records = weekDates.map((dStr) => {
      const rec = recordsMap.get(dStr);
      return {
        id: rec?.id || null,
        date: dStr,
        status: rec?.status || "absent",
        check_in_time: rec?.checkInTime || null,
        check_out_time: rec?.checkOutTime || null,
      };
    });

    return {
      view: "weekly",
      records,
    };
  }

  static async getAllAttendanceForDay(dateStr?: string) {
    const targetDate = dateStr || getTodayDateString();

    const allUsers = await db.query.users.findMany();
    const allProfiles = await db.query.employeeProfiles.findMany();
    const dayAttendance = await db.query.attendance.findMany({
      where: eq(attendance.date, targetDate),
    });

    const profileMap = new Map<string, typeof allProfiles[0]>();
    for (const p of allProfiles) {
      profileMap.set(p.userId, p);
    }

    const attendanceMap = new Map<string, typeof dayAttendance[0]>();
    for (const a of dayAttendance) {
      attendanceMap.set(a.userId, a);
    }

    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;

    const records = allUsers.map((u) => {
      const prof = profileMap.get(u.id);
      const att = attendanceMap.get(u.id);

      const status = att?.status || "absent";
      if (status === "present") present++;
      else if (status === "absent") absent++;
      else if (status === "half-day") halfDay++;
      else if (status === "leave") leave++;

      return {
        user_id: u.id,
        employee_id: u.employeeId,
        full_name: prof?.fullName || "",
        email: u.email,
        department: prof?.department || null,
        attendance_id: att?.id || null,
        check_in_time: att?.checkInTime || null,
        check_out_time: att?.checkOutTime || null,
        status,
      };
    });

    return {
      date: targetDate,
      summary: {
        total: allUsers.length,
        present,
        absent,
        half_day: halfDay,
        leave,
      },
      records,
    };
  }
}
