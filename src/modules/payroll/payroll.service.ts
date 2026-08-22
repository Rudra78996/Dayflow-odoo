import { eq, and, lte, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { salaryStructures, users } from "../../db/Schema/index.js";
import { AppError } from "../../utils/response.js";
import type { SetSalaryStructureInput } from "./payroll.schema.js";

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0]!;
}

function formatSalaryRecord(record: typeof salaryStructures.$inferSelect) {
  return {
    id: record.id,
    user_id: record.userId,
    basic: Number(record.basic),
    hra: Number(record.hra),
    allowances: Number(record.allowances),
    deductions: Number(record.deductions),
    net_salary: Number(record.netSalary),
    effective_from: record.effectiveFrom,
    updated_by: record.updatedBy,
    created_at: record.createdAt,
  };
}

export class PayrollService {
  static async getCurrentSalary(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const today = getTodayDateString();

    const currentStructure = await db.query.salaryStructures.findFirst({
      where: and(
        eq(salaryStructures.userId, userId),
        lte(salaryStructures.effectiveFrom, today)
      ),
      orderBy: [desc(salaryStructures.effectiveFrom), desc(salaryStructures.createdAt)],
    });

    if (!currentStructure) {
      return {
        id: null,
        user_id: userId,
        basic: 0,
        hra: 0,
        allowances: 0,
        deductions: 0,
        net_salary: 0,
        effective_from: null,
      };
    }

    return formatSalaryRecord(currentStructure);
  }

  static async setSalaryStructure(
    targetUserId: string,
    adminUserId: string,
    data: SetSalaryStructureInput
  ) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "Target user not found");
    }

    const basic = data.basic;
    const hra = data.hra ?? 0;
    const allowances = data.allowances ?? 0;
    const deductions = data.deductions ?? 0;
    const netSalary = basic + hra + allowances - deductions;

    const [newRecord] = await db
      .insert(salaryStructures)
      .values({
        userId: targetUserId,
        basic: String(basic),
        hra: String(hra),
        allowances: String(allowances),
        deductions: String(deductions),
        netSalary: String(netSalary),
        effectiveFrom: data.effective_from,
        updatedBy: adminUserId,
      })
      .returning();

    if (!newRecord) {
      throw new AppError(500, "PAYROLL_UPDATE_FAILED", "Failed to create salary structure");
    }

    return formatSalaryRecord(newRecord);
  }

  static async getSalaryHistory(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const history = await db.query.salaryStructures.findMany({
      where: eq(salaryStructures.userId, userId),
      orderBy: [desc(salaryStructures.effectiveFrom), desc(salaryStructures.createdAt)],
    });

    return history.map((rec) => formatSalaryRecord(rec));
  }
}
