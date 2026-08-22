import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { utcDate } from '../calendar/calendar.service';
import {
  AttendanceStatus,
  PayrollPeriodStatus,
  Prisma,
  SalaryAssignmentStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { calculateSalary, prorateSalary } from './salary-calculator';
import {
  CreatePayrollRunDto,
  CreateSalaryAssignmentDto,
  CreateSalaryStructureDto,
  PayrollRunQueryDto,
  SalaryAssignmentQueryDto,
  UpdateSalaryStructureDto,
  VersionDto,
} from './payroll.dto';

const DAY = 86_400_000;
const priorDay = (date: Date) => new Date(date.getTime() - DAY);
@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}
  listStructures(user: AuthUser) {
    return this.prisma.salaryStructure.findMany({
      where: { organizationId: user.organizationId },
      include: { components: { orderBy: { displayOrder: 'asc' } } },
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
    });
  }
  async createStructure(user: AuthUser, dto: CreateSalaryStructureDto) {
    calculateSalary('1000000000000', dto.components);
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.salaryStructure.findFirst({
        where: {
          organizationId: user.organizationId,
          code: dto.code.trim().toUpperCase(),
        },
        orderBy: { version: 'desc' },
      });
      if (latest)
        throw new ConflictException({
          code: 'SALARY_STRUCTURE_CODE_EXISTS',
          message: 'Use PATCH to create a new version of this structure.',
        });
      const structure = await tx.salaryStructure.create({
        data: {
          organizationId: user.organizationId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          currency: dto.currency.toUpperCase(),
          effectiveFrom: utcDate(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? utcDate(dto.effectiveTo) : null,
          version: 1,
          components: {
            create: dto.components.map((component) => ({
              ...component,
              code: component.code.trim().toUpperCase(),
              name: component.name.trim(),
              basisComponentCode: component.basisComponentCode
                ?.trim()
                .toUpperCase(),
            })),
          },
        },
        include: { components: { orderBy: { displayOrder: 'asc' } } },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'salary_structure.created',
          resourceType: 'SalaryStructure',
          resourceId: structure.id,
          changes: { code: structure.code, version: 1 },
        },
      });
      return structure;
    });
  }
  async updateStructure(
    user: AuthUser,
    id: string,
    dto: UpdateSalaryStructureDto,
  ) {
    calculateSalary('1000000000000', dto.components);
    const from = utcDate(dto.effectiveFrom);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.salaryStructure.findFirst({
        where: { id, organizationId: user.organizationId },
        include: { components: true },
      });
      if (!current)
        throw new NotFoundException({
          code: 'SALARY_STRUCTURE_NOT_FOUND',
          message: 'Salary structure not found.',
        });
      if (current.version !== dto.version)
        throw new ConflictException({
          code: 'SALARY_STRUCTURE_VERSION_CONFLICT',
          message: 'The structure changed. Refresh and retry.',
        });
      if (from <= current.effectiveFrom)
        throw new BadRequestException({
          code: 'SALARY_STRUCTURE_EFFECTIVE_DATE_INVALID',
          message: 'A new version must start after the current one.',
        });
      await tx.salaryStructure.update({
        where: { id },
        data: { active: false, effectiveTo: priorDay(from) },
      });
      const structure = await tx.salaryStructure.create({
        data: {
          organizationId: user.organizationId,
          code: current.code,
          name: dto.name.trim(),
          currency: dto.currency.toUpperCase(),
          effectiveFrom: from,
          effectiveTo: dto.effectiveTo ? utcDate(dto.effectiveTo) : null,
          version: current.version + 1,
          components: {
            create: dto.components.map((component) => ({
              ...component,
              code: component.code.trim().toUpperCase(),
              name: component.name.trim(),
              basisComponentCode: component.basisComponentCode
                ?.trim()
                .toUpperCase(),
            })),
          },
        },
        include: { components: { orderBy: { displayOrder: 'asc' } } },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'salary_structure.versioned',
          resourceType: 'SalaryStructure',
          resourceId: structure.id,
          changes: { previousId: current.id, version: structure.version },
        },
      });
      return structure;
    });
  }
  assignments(user: AuthUser, query: SalaryAssignmentQueryDto) {
    return this.prisma.salaryAssignment.findMany({
      where: {
        organizationId: user.organizationId,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      include: {
        structure: {
          include: { components: { orderBy: { displayOrder: 'asc' } } },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true, loginId: true },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }
  async assign(user: AuthUser, dto: CreateSalaryAssignmentDto) {
    const from = utcDate(dto.effectiveFrom);
    const to = dto.effectiveTo ? utcDate(dto.effectiveTo) : null;
    if (to && to < from)
      throw new BadRequestException({
        code: 'SALARY_ASSIGNMENT_RANGE_INVALID',
        message: 'Effective end cannot precede start.',
      });
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${user.organizationId}:${dto.employeeId}:salary-assignment`}))`;
        const [employee, structure] = await Promise.all([
          tx.employee.findFirst({
            where: {
              id: dto.employeeId,
              organizationId: user.organizationId,
              archivedAt: null,
            },
          }),
          tx.salaryStructure.findFirst({
            where: { id: dto.structureId, organizationId: user.organizationId },
            include: { components: true },
          }),
        ]);
        if (!employee || !structure)
          throw new NotFoundException({
            code: 'SALARY_ASSIGNMENT_TARGET_NOT_FOUND',
            message: 'Employee or salary structure not found.',
          });
        if (structure.currency !== dto.currency.toUpperCase())
          throw new BadRequestException({
            code: 'SALARY_CURRENCY_MISMATCH',
            message: 'Assignment and structure currencies must match.',
          });
        calculateSalary(dto.monthlyWage, structure.components);
        const overlap = await tx.salaryAssignment.findFirst({
          where: {
            organizationId: user.organizationId,
            employeeId: dto.employeeId,
            status: SalaryAssignmentStatus.ACTIVE,
            effectiveFrom: { lte: to ?? new Date('9999-12-31') },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
          },
        });
        if (overlap) {
          if (from <= overlap.effectiveFrom)
            throw new ConflictException({
              code: 'SALARY_ASSIGNMENT_OVERLAP',
              message: 'The salary assignment overlaps an existing version.',
            });
          await tx.salaryAssignment.update({
            where: { id: overlap.id },
            data: {
              effectiveTo: priorDay(from),
              status: SalaryAssignmentStatus.CLOSED,
            },
          });
        }
        const assignment = await tx.salaryAssignment.create({
          data: {
            organizationId: user.organizationId,
            employeeId: dto.employeeId,
            structureId: dto.structureId,
            monthlyWage: dto.monthlyWage,
            workingDaysPerWeek: dto.workingDaysPerWeek,
            breakMinutes: dto.breakMinutes,
            currency: dto.currency.toUpperCase(),
            effectiveFrom: from,
            effectiveTo: to,
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorUserId: user.userId,
            action: 'salary_assignment.created',
            resourceType: 'SalaryAssignment',
            resourceId: assignment.id,
            changes: {
              employeeId: dto.employeeId,
              effectiveFrom: dto.effectiveFrom,
            },
          },
        });
        return assignment;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  runs(user: AuthUser, query: PayrollRunQueryDto) {
    return this.prisma.payrollPeriod.findMany({
      where: {
        organizationId: user.organizationId,
        ...(query.status ? { status: query.status } : {}),
      },
      include: { _count: { select: { records: true } } },
      orderBy: { startDate: 'desc' },
    });
  }
  async createRun(user: AuthUser, dto: CreatePayrollRunDto) {
    const start = utcDate(dto.startDate);
    const end = utcDate(dto.endDate);
    const cutoffAt = new Date(dto.cutoffAt);
    if (end < start || end.getTime() - start.getTime() > 45 * DAY)
      throw new BadRequestException({
        code: 'PAYROLL_PERIOD_RANGE_INVALID',
        message: 'Payroll period must be between 1 and 46 days.',
      });
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollPeriod.create({
        data: {
          organizationId: user.organizationId,
          name: dto.name.trim(),
          startDate: start,
          endDate: end,
          cutoffAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'payroll_run.created',
          resourceType: 'PayrollPeriod',
          resourceId: run.id,
        },
      });
      return run;
    });
  }
  async getRun(user: AuthUser, id: string) {
    const run = await this.prisma.payrollPeriod.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        records: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                loginId: true,
              },
            },
          },
          orderBy: { employee: { firstName: 'asc' } },
        },
      },
    });
    if (!run)
      throw new NotFoundException({
        code: 'PAYROLL_RUN_NOT_FOUND',
        message: 'Payroll run not found.',
      });
    return run;
  }
  private async scheduledDays(
    tx: Prisma.TransactionClient,
    organizationId: string,
    employeeId: string,
    start: Date,
    end: Date,
  ) {
    const assignment = await tx.workScheduleAssignment.findFirst({
      where: {
        organizationId,
        employeeId,
        primary: true,
        effectiveFrom: { lte: start },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: end } }],
      },
      include: { schedule: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!assignment)
      return { days: [] as Date[], exception: 'NO_EFFECTIVE_SCHEDULE' };
    const job = await tx.employmentAssignment.findFirst({
      where: {
        organizationId,
        employeeId,
        primary: true,
        effectiveFrom: { lte: end },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
      },
      select: { locationId: true },
    });
    const holidays = await tx.holiday.findMany({
      where: {
        organizationId,
        active: true,
        date: { gte: start, lte: end },
        OR: [
          { locationId: null },
          ...(job?.locationId ? [{ locationId: job.locationId }] : []),
        ],
      },
      select: { date: true },
    });
    const holidayKeys = new Set(
      holidays.map((item) => item.date.toISOString().slice(0, 10)),
    );
    const days: Date[] = [];
    for (
      let date = new Date(start);
      date <= end;
      date = new Date(date.getTime() + DAY)
    ) {
      const weekday = date.getUTCDay() || 7;
      if (
        assignment.schedule.workingWeekdays.includes(weekday) &&
        !holidayKeys.has(date.toISOString().slice(0, 10))
      )
        days.push(date);
    }
    return { days, exception: null };
  }
  async calculate(user: AuthUser, id: string, dto: VersionDto) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${user.organizationId}:${id}:payroll-run`}))`;
        const run = await tx.payrollPeriod.findFirst({
          where: { id, organizationId: user.organizationId },
        });
        if (!run)
          throw new NotFoundException({
            code: 'PAYROLL_RUN_NOT_FOUND',
            message: 'Payroll run not found.',
          });
        if (run.status === PayrollPeriodStatus.FINALIZED)
          throw new ConflictException({
            code: 'PAYROLL_RUN_FINALIZED',
            message: 'Finalized payroll is immutable.',
          });
        if (run.version !== dto.version)
          throw new ConflictException({
            code: 'PAYROLL_RUN_VERSION_CONFLICT',
            message: 'Payroll run changed. Refresh and retry.',
          });
        const employees = await tx.employee.findMany({
          where: {
            organizationId: user.organizationId,
            archivedAt: null,
            dateOfJoining: { lte: run.endDate },
            employmentStatus: { in: ['ACTIVE', 'ON_LEAVE'] },
          },
          select: {
            id: true,
            dateOfJoining: true,
            bankDetail: {
              select: {
                accountNumberLast4: true,
                bankName: true,
              },
            },
            statutoryDetail: {
              select: {
                panLast4: true,
                uanLast4: true,
              },
            },
          },
        });
        const periodExceptions: Array<{ employeeId: string; code: string }> =
          [];
        for (const employee of employees) {
          const employeeStart =
            employee.dateOfJoining > run.startDate
              ? employee.dateOfJoining
              : run.startDate;
          const salaryVersions = await tx.salaryAssignment.findMany({
            where: {
              organizationId: user.organizationId,
              employeeId: employee.id,
              effectiveFrom: { lte: run.endDate },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: employeeStart } },
              ],
            },
            include: {
              structure: {
                include: {
                  components: {
                    where: { active: true },
                    orderBy: { displayOrder: 'asc' },
                  },
                },
              },
            },
            orderBy: { effectiveFrom: 'desc' },
          });
          const salary = salaryVersions.length === 1 ? salaryVersions[0] : null;
          const scheduled = await this.scheduledDays(
            tx,
            user.organizationId,
            employee.id,
            employeeStart,
            run.endDate,
          );
          const exceptions: Array<{
            code: string;
            blocking: boolean;
            dates?: string[];
          }> = [];
          if (salaryVersions.length === 0)
            exceptions.push({ code: 'NO_EFFECTIVE_SALARY', blocking: true });
          if (salaryVersions.length > 1)
            exceptions.push({
              code: 'MULTIPLE_SALARY_VERSIONS_IN_PERIOD',
              blocking: true,
            });
          if (scheduled.exception)
            exceptions.push({ code: scheduled.exception, blocking: true });
          if (
            !employee.bankDetail?.accountNumberLast4 ||
            !employee.bankDetail.bankName
          )
            exceptions.push({
              code: 'INCOMPLETE_BANK_DETAILS',
              blocking: false,
            });
          if (
            !employee.statutoryDetail?.panLast4 ||
            !employee.statutoryDetail.uanLast4
          )
            exceptions.push({
              code: 'INCOMPLETE_STATUTORY_DETAILS',
              blocking: false,
            });
          const records = scheduled.days.length
            ? await tx.attendanceRecord.findMany({
                where: {
                  organizationId: user.organizationId,
                  employeeId: employee.id,
                  workDate: { in: scheduled.days },
                },
              })
            : [];
          const recordByDate = new Map(
            records.map((record) => [
              record.workDate.toISOString().slice(0, 10),
              record,
            ]),
          );
          const missing = scheduled.days
            .filter(
              (date) => !recordByDate.has(date.toISOString().slice(0, 10)),
            )
            .map((date) => date.toISOString().slice(0, 10));
          if (missing.length)
            exceptions.push({
              code: 'MISSING_ATTENDANCE',
              blocking: true,
              dates: missing,
            });
          const incomplete = records
            .filter(
              (record) =>
                record.status === AttendanceStatus.INCOMPLETE ||
                record.status === AttendanceStatus.PENDING_CORRECTION,
            )
            .map((record) => record.workDate.toISOString().slice(0, 10));
          if (incomplete.length)
            exceptions.push({
              code: 'UNRESOLVED_ATTENDANCE',
              blocking: true,
              dates: incomplete,
            });
          const payable = records.reduce(
            (sum, record) => sum.plus(record.payableUnits),
            new Prisma.Decimal(0),
          );
          const scheduledUnits = new Prisma.Decimal(scheduled.days.length);
          let components: Prisma.InputJsonValue = [];
          let gross = '0';
          let deductions = '0';
          let employer = '0';
          let net = '0';
          if (salary && scheduledUnits.gt(0)) {
            const calculated = calculateSalary(
              salary.monthlyWage,
              salary.structure.components,
            );
            const prorated = prorateSalary(calculated, payable, scheduledUnits);
            components = prorated.components;
            gross = prorated.gross;
            deductions = prorated.deductions;
            employer = prorated.employerContributions;
            net = prorated.net;
          }
          const blocking = exceptions.filter((item) => item.blocking).length;
          if (blocking)
            periodExceptions.push(
              ...exceptions
                .filter((item) => item.blocking)
                .map((item) => ({ employeeId: employee.id, code: item.code })),
            );
          await tx.payrollRecord.upsert({
            where: {
              payrollPeriodId_employeeId: {
                payrollPeriodId: run.id,
                employeeId: employee.id,
              },
            },
            create: {
              organizationId: user.organizationId,
              payrollPeriodId: run.id,
              employeeId: employee.id,
              salaryAssignmentId: salary?.id,
              scheduledUnits,
              payableUnits: payable,
              unpaidUnits: Prisma.Decimal.max(0, scheduledUnits.minus(payable)),
              grossEarnings: gross,
              deductions,
              employerContributions: employer,
              netPay: net,
              componentsSnapshot: components,
              inputsSnapshot: {
                salaryAssignmentId: salary?.id ?? null,
                structureId: salary?.structureId ?? null,
                monthlyWage: salary?.monthlyWage.toString() ?? null,
                scheduledDates: scheduled.days.map((date) =>
                  date.toISOString().slice(0, 10),
                ),
                attendanceRecordVersions: records.map((record) => ({
                  id: record.id,
                  version: record.version,
                  payableUnits: record.payableUnits.toString(),
                  status: record.status,
                })),
              },
              exceptions,
              blockingExceptionCount: blocking,
            },
            update: {
              salaryAssignmentId: salary?.id,
              scheduledUnits,
              payableUnits: payable,
              unpaidUnits: Prisma.Decimal.max(0, scheduledUnits.minus(payable)),
              grossEarnings: gross,
              deductions,
              employerContributions: employer,
              netPay: net,
              componentsSnapshot: components,
              inputsSnapshot: {
                salaryAssignmentId: salary?.id ?? null,
                structureId: salary?.structureId ?? null,
                monthlyWage: salary?.monthlyWage.toString() ?? null,
                scheduledDates: scheduled.days.map((date) =>
                  date.toISOString().slice(0, 10),
                ),
                attendanceRecordVersions: records.map((record) => ({
                  id: record.id,
                  version: record.version,
                  payableUnits: record.payableUnits.toString(),
                  status: record.status,
                })),
              },
              exceptions,
              blockingExceptionCount: blocking,
            },
          });
        }
        await tx.payrollRecord.deleteMany({
          where: {
            payrollPeriodId: run.id,
            employeeId: { notIn: employees.map((employee) => employee.id) },
          },
        });
        await tx.payrollPeriod.update({
          where: { id: run.id },
          data: {
            status: PayrollPeriodStatus.CALCULATED,
            calculatedAt: new Date(),
            exceptions: periodExceptions,
            version: { increment: 1 },
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorUserId: user.userId,
            action: 'payroll.calculated',
            resourceType: 'PayrollPeriod',
            resourceId: run.id,
            changes: {
              employeeCount: employees.length,
              blockingExceptionCount: periodExceptions.length,
            },
          },
        });
        return tx.payrollPeriod.findUniqueOrThrow({
          where: { id: run.id },
          include: { records: true },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 60_000,
      },
    );
  }
  async review(user: AuthUser, id: string, dto: VersionDto) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollPeriod.findFirst({
        where: { id, organizationId: user.organizationId },
        include: { records: true },
      });
      if (!run)
        throw new NotFoundException({
          code: 'PAYROLL_RUN_NOT_FOUND',
          message: 'Payroll run not found.',
        });
      if (
        run.status !== PayrollPeriodStatus.CALCULATED ||
        run.version !== dto.version
      )
        throw new ConflictException({
          code: 'PAYROLL_RUN_NOT_REVIEWABLE',
          message: 'Recalculate or refresh this payroll run before review.',
        });
      if (run.records.some((record) => record.blockingExceptionCount > 0))
        throw new ConflictException({
          code: 'PAYROLL_BLOCKING_EXCEPTIONS',
          message: 'Resolve all blocking payroll exceptions before review.',
        });
      const reviewed = await tx.payrollPeriod.update({
        where: { id },
        data: {
          status: PayrollPeriodStatus.REVIEWED,
          reviewedAt: new Date(),
          version: { increment: 1 },
        },
        include: { records: true },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'payroll.reviewed',
          resourceType: 'PayrollPeriod',
          resourceId: id,
        },
      });
      return reviewed;
    });
  }
  async finalize(user: AuthUser, id: string, dto: VersionDto) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${user.organizationId}:${id}:payroll-run`}))`;
        const run = await tx.payrollPeriod.findFirst({
          where: { id, organizationId: user.organizationId },
          include: { records: true },
        });
        if (!run)
          throw new NotFoundException({
            code: 'PAYROLL_RUN_NOT_FOUND',
            message: 'Payroll run not found.',
          });
        if (run.status === PayrollPeriodStatus.FINALIZED) return run;
        if (
          run.status !== PayrollPeriodStatus.REVIEWED ||
          run.version !== dto.version
        )
          throw new ConflictException({
            code: 'PAYROLL_RUN_NOT_READY',
            message: 'Review or refresh this payroll run before finalizing.',
          });
        if (run.records.some((record) => record.blockingExceptionCount > 0))
          throw new ConflictException({
            code: 'PAYROLL_BLOCKING_EXCEPTIONS',
            message:
              'Resolve all blocking payroll exceptions before finalization.',
          });
        const session = await tx.session.findFirst({
          where: { id: user.sessionId, userId: user.userId, revokedAt: null },
        });
        if (!session || Date.now() - session.createdAt.getTime() > 30 * 60_000)
          throw new ForbiddenException({
            code: 'PAYROLL_RECENT_AUTH_REQUIRED',
            message: 'Sign in again before finalizing payroll.',
          });
        const now = new Date();
        await tx.payrollRecord.updateMany({
          where: { payrollPeriodId: run.id },
          data: { finalizedAt: now },
        });
        await tx.attendanceRecord.updateMany({
          where: {
            organizationId: user.organizationId,
            workDate: { gte: run.startDate, lte: run.endDate },
            lockedAt: null,
          },
          data: { lockedAt: now },
        });
        const finalized = await tx.payrollPeriod.update({
          where: { id: run.id },
          data: {
            status: PayrollPeriodStatus.FINALIZED,
            finalizedAt: now,
            finalizedById: user.userId,
            version: { increment: 1 },
          },
          include: { records: true },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorUserId: user.userId,
            action: 'payroll.finalized',
            resourceType: 'PayrollPeriod',
            resourceId: run.id,
            changes: { employeeCount: run.records.length },
          },
        });
        await tx.outboxEvent.create({
          data: {
            organizationId: user.organizationId,
            aggregateType: 'PayrollPeriod',
            aggregateId: run.id,
            eventType: 'payroll.finalized',
            payload: {
              employeeCount: run.records.length,
              finalizedAt: now.toISOString(),
            },
          },
        });
        return finalized;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  myPayroll(user: AuthUser) {
    if (!user.employeeId)
      throw new ForbiddenException({
        code: 'PAYROLL_EMPLOYEE_REQUIRED',
        message: 'An employee profile is required.',
      });
    return this.prisma.payrollRecord.findMany({
      where: {
        organizationId: user.organizationId,
        employeeId: user.employeeId,
        finalizedAt: { not: null },
        period: { status: PayrollPeriodStatus.FINALIZED },
      },
      select: {
        id: true,
        scheduledUnits: true,
        payableUnits: true,
        unpaidUnits: true,
        grossEarnings: true,
        deductions: true,
        netPay: true,
        componentsSnapshot: true,
        finalizedAt: true,
        period: {
          select: { id: true, name: true, startDate: true, endDate: true },
        },
      },
      orderBy: { period: { startDate: 'desc' } },
    });
  }
}
