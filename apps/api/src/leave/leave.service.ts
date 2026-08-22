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
  DaySession,
  LeaveLedgerEntryType,
  LeaveRequestStatus,
  Prisma,
  RoleCode,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { countedLeaveDays } from './leave-days';
import { calculateAttendance } from '../attendance/attendance-calculation';
import {
  CreateAllocationDto,
  CreateLeavePolicyDto,
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  DecideLeaveDto,
  LeaveBalanceQueryDto,
  LeaveCalendarQueryDto,
  LeaveRequestQueryDto,
  RunLeaveAccrualDto,
  UpdateLeaveTypeDto,
} from './leave.dto';

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}
  private privileged(user: AuthUser) {
    return (
      user.roles.includes(RoleCode.ADMIN) ||
      user.roles.includes(RoleCode.HR_OFFICER)
    );
  }
  private employeeFor(user: AuthUser, requested?: string) {
    if (requested && requested !== user.employeeId && !this.privileged(user))
      throw new ForbiddenException({
        code: 'LEAVE_EMPLOYEE_ACCESS_DENIED',
        message: 'You can access only your own leave.',
      });
    const id = requested ?? user.employeeId;
    if (!id)
      throw new ForbiddenException({
        code: 'LEAVE_EMPLOYEE_REQUIRED',
        message: 'An employee profile is required.',
      });
    return id;
  }
  listTypes(user: AuthUser) {
    return this.prisma.leaveType.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: 'asc' },
    });
  }
  async createType(user: AuthUser, dto: CreateLeaveTypeDto) {
    return this.prisma.$transaction(async (tx) => {
      const type = await tx.leaveType.create({
        data: {
          organizationId: user.organizationId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          paid: dto.paid,
          color: dto.color,
          halfDaySupported: dto.halfDaySupported,
          approvalRequired: dto.approvalRequired,
          allowNegative: dto.allowNegative,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'leave_type.created',
          resourceType: 'LeaveType',
          resourceId: type.id,
        },
      });
      return type;
    });
  }
  async updateType(user: AuthUser, id: string, dto: UpdateLeaveTypeDto) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveType.updateMany({
        where: {
          id,
          organizationId: user.organizationId,
          version: dto.version,
        },
        data: {
          name: dto.name?.trim(),
          color: dto.color,
          paid: dto.paid,
          active: dto.active,
          allowNegative: dto.allowNegative,
          version: { increment: 1 },
        },
      });
      if (!updated.count)
        throw new ConflictException({
          code: 'LEAVE_TYPE_VERSION_CONFLICT',
          message: 'Leave type not found or changed.',
        });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'leave_type.updated',
          resourceType: 'LeaveType',
          resourceId: id,
        },
      });
      return tx.leaveType.findUniqueOrThrow({ where: { id } });
    });
  }
  listPolicies(user: AuthUser) {
    return this.prisma.leavePolicy.findMany({
      where: { organizationId: user.organizationId },
      include: { leaveType: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }
  async createPolicy(user: AuthUser, dto: CreateLeavePolicyDto) {
    const from = utcDate(dto.effectiveFrom);
    const to = dto.effectiveTo ? utcDate(dto.effectiveTo) : null;
    if (to && to < from)
      throw new BadRequestException({
        code: 'LEAVE_POLICY_RANGE_INVALID',
        message: 'Effective end cannot precede start.',
      });
    return this.prisma.$transaction(async (tx) => {
      const type = await tx.leaveType.findFirst({
        where: { id: dto.leaveTypeId, organizationId: user.organizationId },
      });
      if (!type)
        throw new NotFoundException({
          code: 'LEAVE_TYPE_NOT_FOUND',
          message: 'Leave type not found.',
        });
      const latest = await tx.leavePolicy.findFirst({
        where: {
          organizationId: user.organizationId,
          leaveTypeId: dto.leaveTypeId,
          name: dto.name.trim(),
        },
        orderBy: { version: 'desc' },
      });
      const policy = await tx.leavePolicy.create({
        data: {
          organizationId: user.organizationId,
          leaveTypeId: dto.leaveTypeId,
          name: dto.name.trim(),
          annualEntitlement: dto.annualEntitlement,
          accrualFrequency: dto.accrualFrequency,
          carryForward: dto.carryForward,
          carryForwardCap: dto.carryForwardCap,
          carryForwardExpiryMonths: dto.carryForwardExpiryMonths,
          prorateJoining: dto.prorateJoining,
          excludeWeekends: dto.excludeWeekends,
          excludeHolidays: dto.excludeHolidays,
          cancellationAllowed: dto.cancellationAllowed,
          effectiveFrom: from,
          effectiveTo: to,
          version: (latest?.version ?? 0) + 1,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'leave_policy.created',
          resourceType: 'LeavePolicy',
          resourceId: policy.id,
          changes: { version: policy.version },
        },
      });
      return policy;
    });
  }
  async runAccrual(user: AuthUser, dto: RunLeaveAccrualDto) {
    const asOf = utcDate(dto.asOf);
    const year = asOf.getUTCFullYear();
    const month = asOf.getUTCMonth();
    const quarter = Math.floor(month / 3) + 1;
    const endOfYear = new Date(Date.UTC(year, 11, 31));
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${user.organizationId}:${dto.asOf}:leave-accrual`}))`;
        const [policies, employees] = await Promise.all([
          tx.leavePolicy.findMany({
            where: {
              organizationId: user.organizationId,
              active: true,
              effectiveFrom: { lte: asOf },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
            },
            orderBy: [{ leaveTypeId: 'asc' }, { version: 'desc' }],
            distinct: ['leaveTypeId'],
          }),
          tx.employee.findMany({
            where: {
              organizationId: user.organizationId,
              archivedAt: null,
              dateOfJoining: { lte: asOf },
              employmentStatus: { in: ['ACTIVE', 'ON_LEAVE'] },
            },
            select: { id: true },
          }),
        ]);
        let created = 0;
        for (const policy of policies) {
          if (policy.accrualFrequency === 'NONE') continue;
          const periodKey =
            policy.accrualFrequency === 'MONTHLY'
              ? `${year}-${String(month + 1).padStart(2, '0')}`
              : policy.accrualFrequency === 'QUARTERLY'
                ? `${year}-Q${quarter}`
                : `${year}`;
          const divisor =
            policy.accrualFrequency === 'MONTHLY'
              ? 12
              : policy.accrualFrequency === 'QUARTERLY'
                ? 4
                : 1;
          const units = new Prisma.Decimal(policy.annualEntitlement)
            .div(divisor)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
          for (const employee of employees) {
            if (month === 0 && policy.carryForward) {
              const priorYearEnd = new Date(Date.UTC(year - 1, 11, 31));
              const prior = await tx.leaveLedgerEntry.aggregate({
                where: {
                  organizationId: user.organizationId,
                  employeeId: employee.id,
                  leaveTypeId: policy.leaveTypeId,
                  effectiveDate: { lte: priorYearEnd },
                  OR: [
                    { expiresAt: null },
                    { expiresAt: { gte: priorYearEnd } },
                  ],
                },
                _sum: { units: true },
              });
              const available = Prisma.Decimal.max(
                0,
                new Prisma.Decimal(prior._sum.units ?? 0),
              );
              const carryUnits = policy.carryForwardCap
                ? Prisma.Decimal.min(available, policy.carryForwardCap)
                : available;
              if (carryUnits.gt(0)) {
                const sourceKey = `carry:${policy.id}:${employee.id}:${year}`;
                const result = await tx.leaveLedgerEntry.createMany({
                  data: [
                    {
                      organizationId: user.organizationId,
                      employeeId: employee.id,
                      leaveTypeId: policy.leaveTypeId,
                      entryType: 'ALLOCATION',
                      units: carryUnits,
                      effectiveDate: asOf,
                      expiresAt: policy.carryForwardExpiryMonths
                        ? new Date(
                            Date.UTC(year, policy.carryForwardExpiryMonths, 0),
                          )
                        : endOfYear,
                      sourceKey,
                      note: 'Policy carry-forward',
                      createdById: user.userId,
                    },
                  ],
                  skipDuplicates: true,
                });
                created += result.count;
              }
            }
            const sourceKey = `accrual:${policy.id}:${employee.id}:${periodKey}`;
            const result = await tx.leaveLedgerEntry.createMany({
              data: [
                {
                  organizationId: user.organizationId,
                  employeeId: employee.id,
                  leaveTypeId: policy.leaveTypeId,
                  entryType: 'ACCRUAL',
                  units,
                  effectiveDate: asOf,
                  expiresAt: endOfYear,
                  sourceKey,
                  note: `${policy.accrualFrequency.toLowerCase()} policy accrual`,
                  createdById: user.userId,
                },
              ],
              skipDuplicates: true,
            });
            created += result.count;
          }
        }
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorUserId: user.userId,
            action: 'leave.accrual_processed',
            resourceType: 'LeavePolicy',
            changes: { asOf: dto.asOf, entriesCreated: created },
          },
        });
        return { asOf: dto.asOf, entriesCreated: created };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async balances(user: AuthUser, query: LeaveBalanceQueryDto) {
    const employeeId = this.employeeFor(user, query.employeeId);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!employee)
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found.',
      });
    const [types, grouped] = await Promise.all([
      this.prisma.leaveType.findMany({
        where: { organizationId: user.organizationId, active: true },
      }),
      this.prisma.leaveLedgerEntry.groupBy({
        by: ['leaveTypeId'],
        where: {
          organizationId: user.organizationId,
          employeeId,
          AND: [
            {
              OR: [
                {
                  entryType: {
                    in: [
                      LeaveLedgerEntryType.DEBIT,
                      LeaveLedgerEntryType.REVERSAL,
                    ],
                  },
                },
                { effectiveDate: { lte: new Date() } },
              ],
            },
            { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
          ],
        },
        _sum: { units: true },
      }),
    ]);
    const sums = new Map(
      grouped.map((entry) => [
        entry.leaveTypeId,
        Number(entry._sum.units ?? 0),
      ]),
    );
    return types.map((type) => ({
      leaveType: type,
      balance: sums.get(type.id) ?? 0,
    }));
  }
  allocations(user: AuthUser) {
    return this.prisma.leaveLedgerEntry.findMany({
      where: {
        organizationId: user.organizationId,
        entryType: {
          in: [
            LeaveLedgerEntryType.ALLOCATION,
            LeaveLedgerEntryType.ACCRUAL,
            LeaveLedgerEntryType.ADJUSTMENT,
          ],
        },
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, loginId: true },
        },
        leaveType: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async allocate(user: AuthUser, dto: CreateAllocationDto) {
    if (dto.units === 0)
      throw new BadRequestException({
        code: 'LEAVE_ALLOCATION_ZERO',
        message: 'Allocation units cannot be zero.',
      });
    return this.prisma.$transaction(async (tx) => {
      const [employee, type] = await Promise.all([
        tx.employee.findFirst({
          where: { id: dto.employeeId, organizationId: user.organizationId },
        }),
        tx.leaveType.findFirst({
          where: { id: dto.leaveTypeId, organizationId: user.organizationId },
        }),
      ]);
      if (!employee || !type)
        throw new NotFoundException({
          code: 'LEAVE_ALLOCATION_TARGET_NOT_FOUND',
          message: 'Employee or leave type not found.',
        });
      const sourceKey = `manual:${dto.idempotencyKey}`;
      const existing = await tx.leaveLedgerEntry.findUnique({
        where: {
          organizationId_sourceKey: {
            organizationId: user.organizationId,
            sourceKey,
          },
        },
      });
      if (existing) return existing;
      const entry = await tx.leaveLedgerEntry.create({
        data: {
          organizationId: user.organizationId,
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          entryType: LeaveLedgerEntryType.ALLOCATION,
          units: dto.units,
          effectiveDate: utcDate(dto.effectiveDate),
          expiresAt: dto.expiresAt ? utcDate(dto.expiresAt) : null,
          sourceKey,
          note: dto.note?.trim(),
          createdById: user.userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'leave.allocated',
          resourceType: 'LeaveLedgerEntry',
          resourceId: entry.id,
          changes: {
            employeeId: dto.employeeId,
            leaveTypeId: dto.leaveTypeId,
            units: dto.units,
          },
        },
      });
      return entry;
    });
  }
  private async requestDates(
    tx: Prisma.TransactionClient,
    organizationId: string,
    employeeId: string,
    leaveTypeId: string,
    start: Date,
    end: Date,
    startSession: DaySession,
    endSession: DaySession,
  ) {
    const policy = await tx.leavePolicy.findFirst({
      where: {
        organizationId,
        leaveTypeId,
        active: true,
        effectiveFrom: { lte: start },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: end } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
    });
    if (!policy)
      throw new BadRequestException({
        code: 'LEAVE_POLICY_MISSING',
        message: 'No effective leave policy is configured.',
      });
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
      throw new BadRequestException({
        code: 'LEAVE_SCHEDULE_MISSING',
        message: 'No effective work schedule is assigned.',
      });
    const job = await tx.employmentAssignment.findFirst({
      where: {
        organizationId,
        employeeId,
        primary: true,
        effectiveFrom: { lte: start },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: end } }],
      },
      select: { locationId: true },
      orderBy: { effectiveFrom: 'desc' },
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
    return {
      policy,
      dates: countedLeaveDays(start, end, {
        workingWeekdays: assignment.schedule.workingWeekdays,
        holidays: new Set(
          holidays.map((h) => h.date.toISOString().slice(0, 10)),
        ),
        excludeWeekends: policy.excludeWeekends,
        excludeHolidays: policy.excludeHolidays,
        startSession,
        endSession,
      }),
    };
  }
  async requests(user: AuthUser, query: LeaveRequestQueryDto) {
    const privileged = this.privileged(user);
    const employeeId = privileged ? query.employeeId : this.employeeFor(user);
    return this.prisma.leaveRequest.findMany({
      where: {
        organizationId: user.organizationId,
        ...(employeeId ? { employeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        leaveType: true,
        employee: {
          select: { id: true, firstName: true, lastName: true, loginId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async createRequest(user: AuthUser, dto: CreateLeaveRequestDto) {
    const employeeId = this.employeeFor(user, dto.employeeId);
    const start = utcDate(dto.startDate);
    const end = utcDate(dto.endDate);
    if (end < start)
      throw new BadRequestException({
        code: 'LEAVE_RANGE_INVALID',
        message: 'End date cannot precede start date.',
      });
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${user.organizationId}:${employeeId}:leave-request`}))`;
        const type = await tx.leaveType.findFirst({
          where: {
            id: dto.leaveTypeId,
            organizationId: user.organizationId,
            active: true,
          },
        });
        if (!type)
          throw new NotFoundException({
            code: 'LEAVE_TYPE_NOT_FOUND',
            message: 'Leave type not found.',
          });
        if (
          !type.halfDaySupported &&
          (dto.startSession !== 'FULL_DAY' || dto.endSession !== 'FULL_DAY')
        )
          throw new BadRequestException({
            code: 'LEAVE_HALF_DAY_UNSUPPORTED',
            message: 'This leave type does not support half-days.',
          });
        const overlap = await tx.leaveRequest.findFirst({
          where: {
            organizationId: user.organizationId,
            employeeId,
            status: {
              in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED],
            },
            startDate: { lte: end },
            endDate: { gte: start },
          },
        });
        if (overlap)
          throw new ConflictException({
            code: 'LEAVE_REQUEST_OVERLAP',
            message: 'An active leave request overlaps this range.',
          });
        const { dates } = await this.requestDates(
          tx,
          user.organizationId,
          employeeId,
          dto.leaveTypeId,
          start,
          end,
          dto.startSession,
          dto.endSession,
        );
        const units = dates.reduce((sum, day) => sum + day.units, 0);
        if (!units)
          throw new BadRequestException({
            code: 'LEAVE_NO_COUNTED_DAYS',
            message: 'The selected range has no countable leave days.',
          });
        const balance = await tx.leaveLedgerEntry.aggregate({
          where: {
            organizationId: user.organizationId,
            employeeId,
            leaveTypeId: dto.leaveTypeId,
            effectiveDate: { lte: start },
            OR: [{ expiresAt: null }, { expiresAt: { gte: start } }],
          },
          _sum: { units: true },
        });
        if (!type.allowNegative && Number(balance._sum.units ?? 0) < units)
          throw new ConflictException({
            code: 'LEAVE_BALANCE_INSUFFICIENT',
            message: 'The available leave balance is insufficient.',
          });
        const request = await tx.leaveRequest.create({
          data: {
            organizationId: user.organizationId,
            employeeId,
            leaveTypeId: dto.leaveTypeId,
            startDate: start,
            endDate: end,
            startSession: dto.startSession,
            endSession: dto.endSession,
            requestedUnits: units,
            remarks: dto.remarks?.trim(),
            requestedById: user.userId,
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorUserId: user.userId,
            action: 'leave.requested',
            resourceType: 'LeaveRequest',
            resourceId: request.id,
            changes: { units, startDate: dto.startDate, endDate: dto.endDate },
          },
        });
        return {
          ...request,
          projectedBalance: Number(balance._sum.units ?? 0) - units,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async decide(
    user: AuthUser,
    id: string,
    approved: boolean,
    dto: DecideLeaveDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const request = await tx.leaveRequest.findFirst({
          where: { id, organizationId: user.organizationId },
          include: { leaveType: true },
        });
        if (!request)
          throw new NotFoundException({
            code: 'LEAVE_REQUEST_NOT_FOUND',
            message: 'Leave request not found.',
          });
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${user.organizationId}:${request.employeeId}:${request.leaveTypeId}:leave-balance`}))`;
        if (
          request.status !== LeaveRequestStatus.PENDING ||
          request.version !== dto.version
        )
          throw new ConflictException({
            code: 'LEAVE_REQUEST_STALE',
            message: 'This leave request has already changed.',
          });
        if (approved) {
          const balance = await tx.leaveLedgerEntry.aggregate({
            where: {
              organizationId: user.organizationId,
              employeeId: request.employeeId,
              leaveTypeId: request.leaveTypeId,
              effectiveDate: { lte: request.startDate },
              OR: [
                { expiresAt: null },
                { expiresAt: { gte: request.startDate } },
              ],
            },
            _sum: { units: true },
          });
          if (
            !request.leaveType.allowNegative &&
            Number(balance._sum.units ?? 0) < Number(request.requestedUnits)
          )
            throw new ConflictException({
              code: 'LEAVE_BALANCE_INSUFFICIENT',
              message: 'Balance changed and is now insufficient.',
            });
          await tx.leaveLedgerEntry.create({
            data: {
              organizationId: user.organizationId,
              employeeId: request.employeeId,
              leaveTypeId: request.leaveTypeId,
              requestId: request.id,
              entryType: LeaveLedgerEntryType.DEBIT,
              units: -Number(request.requestedUnits),
              effectiveDate: request.startDate,
              sourceKey: `request:${request.id}:debit`,
              createdById: user.userId,
            },
          });
          const { dates } = await this.requestDates(
            tx,
            user.organizationId,
            request.employeeId,
            request.leaveTypeId,
            request.startDate,
            request.endDate,
            request.startSession,
            request.endSession,
          );
          for (const day of dates)
            await tx.attendanceRecord.upsert({
              where: {
                organizationId_employeeId_workDate: {
                  organizationId: user.organizationId,
                  employeeId: request.employeeId,
                  workDate: day.date,
                },
              },
              create: {
                organizationId: user.organizationId,
                employeeId: request.employeeId,
                workDate: day.date,
                status: AttendanceStatus.LEAVE,
                payableUnits: request.leaveType.paid ? day.units : 0,
              },
              update: {
                status: AttendanceStatus.LEAVE,
                payableUnits: request.leaveType.paid ? day.units : 0,
                version: { increment: 1 },
                calculatedAt: new Date(),
              },
            });
        }
        const status = approved
          ? LeaveRequestStatus.APPROVED
          : LeaveRequestStatus.REJECTED;
        await tx.leaveRequest.update({
          where: { id },
          data: {
            status,
            decisionComment: dto.comment?.trim(),
            decidedById: user.userId,
            decidedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorUserId: user.userId,
            action: approved ? 'leave.approved' : 'leave.rejected',
            resourceType: 'LeaveRequest',
            resourceId: id,
            changes: {
              comment: dto.comment?.trim() ?? null,
              units: Number(request.requestedUnits),
            },
          },
        });
        await tx.outboxEvent.create({
          data: {
            organizationId: user.organizationId,
            aggregateType: 'LeaveRequest',
            aggregateId: id,
            eventType: approved ? 'leave.approved' : 'leave.rejected',
            payload: {
              employeeId: request.employeeId,
              startDate: request.startDate.toISOString(),
              endDate: request.endDate.toISOString(),
            },
          },
        });
        return tx.leaveRequest.findUniqueOrThrow({
          where: { id },
          include: { leaveType: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async cancel(user: AuthUser, id: string, dto: DecideLeaveDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const request = await tx.leaveRequest.findFirst({
          where: { id, organizationId: user.organizationId },
          include: { leaveType: true },
        });
        if (!request)
          throw new NotFoundException({
            code: 'LEAVE_REQUEST_NOT_FOUND',
            message: 'Leave request not found.',
          });
        if (request.employeeId !== user.employeeId && !this.privileged(user))
          throw new ForbiddenException({
            code: 'LEAVE_CANCEL_DENIED',
            message: 'You cannot cancel this request.',
          });
        if (request.version !== dto.version)
          throw new ConflictException({
            code: 'LEAVE_REQUEST_STALE',
            message: 'The leave request changed. Refresh it and try again.',
          });
        if (request.status === LeaveRequestStatus.PENDING) {
          const cancelled = await tx.leaveRequest.update({
            where: { id },
            data: {
              status: LeaveRequestStatus.CANCELLED,
              cancelledAt: new Date(),
              decisionComment: dto.comment?.trim(),
              version: { increment: 1 },
            },
          });
          await tx.outboxEvent.create({
            data: {
              organizationId: user.organizationId,
              aggregateType: 'LeaveRequest',
              aggregateId: id,
              eventType: 'leave.cancelled',
              payload: { employeeId: request.employeeId, wasPending: true },
            },
          });
          await tx.auditEvent.create({
            data: {
              organizationId: user.organizationId,
              actorUserId: user.userId,
              action: 'leave.cancelled',
              resourceType: 'LeaveRequest',
              resourceId: id,
            },
          });
          return cancelled;
        }
        if (request.status !== LeaveRequestStatus.APPROVED)
          throw new ConflictException({
            code: 'LEAVE_REQUEST_NOT_CANCELLABLE',
            message: 'Only a pending or approved request can be cancelled.',
          });
        const today = utcDate(new Date().toISOString().slice(0, 10));
        if (request.startDate <= today && !this.privileged(user))
          throw new ForbiddenException({
            code: 'LEAVE_CANCELLATION_REQUIRES_HR',
            message:
              'HR or an administrator must cancel leave after it starts.',
          });
        const policy = await tx.leavePolicy.findFirst({
          where: {
            organizationId: user.organizationId,
            leaveTypeId: request.leaveTypeId,
            active: true,
            effectiveFrom: { lte: request.startDate },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: request.endDate } },
            ],
          },
          orderBy: { version: 'desc' },
        });
        if (!policy?.cancellationAllowed)
          throw new ForbiddenException({
            code: 'LEAVE_CANCELLATION_DISABLED',
            message: 'This leave policy does not allow cancellation.',
          });
        await tx.leaveLedgerEntry.create({
          data: {
            organizationId: user.organizationId,
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            requestId: request.id,
            entryType: LeaveLedgerEntryType.REVERSAL,
            units: request.requestedUnits,
            effectiveDate: new Date(),
            sourceKey: `request:${request.id}:reversal`,
            createdById: user.userId,
          },
        });
        await tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveRequestStatus.CANCELLED,
            cancelledAt: new Date(),
            decisionComment: dto.comment?.trim(),
            version: { increment: 1 },
          },
        });
        const unlockedRecords = await tx.attendanceRecord.findMany({
          where: {
            organizationId: user.organizationId,
            employeeId: request.employeeId,
            workDate: { gte: request.startDate, lte: request.endDate },
            status: AttendanceStatus.LEAVE,
            lockedAt: null,
          },
        });
        for (const record of unlockedRecords) {
          const [events, schedule] = await Promise.all([
            tx.attendanceEvent.findMany({
              where: {
                organizationId: user.organizationId,
                employeeId: request.employeeId,
                workDate: record.workDate,
              },
              orderBy: { occurredAt: 'asc' },
            }),
            record.scheduleId
              ? tx.workSchedule.findUnique({ where: { id: record.scheduleId } })
              : null,
          ]);
          if (events.length && schedule) {
            await tx.attendanceRecord.update({
              where: { id: record.id },
              data: {
                ...calculateAttendance(events, schedule),
                version: { increment: 1 },
                calculatedAt: new Date(),
              },
            });
          } else {
            await tx.attendanceRecord.update({
              where: { id: record.id },
              data: {
                status: AttendanceStatus.ABSENT,
                payableUnits: 0,
                version: { increment: 1 },
                calculatedAt: new Date(),
              },
            });
          }
        }
        await tx.outboxEvent.create({
          data: {
            organizationId: user.organizationId,
            aggregateType: 'LeaveRequest',
            aggregateId: id,
            eventType: 'leave.cancelled_recalculation_required',
            payload: { employeeId: request.employeeId },
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorUserId: user.userId,
            action: 'leave.cancelled',
            resourceType: 'LeaveRequest',
            resourceId: id,
          },
        });
        return tx.leaveRequest.findUniqueOrThrow({ where: { id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async calendar(user: AuthUser, query: LeaveCalendarQueryDto) {
    const employeeId = this.employeeFor(user, query.employeeId);
    const from = utcDate(`${query.year}-01-01`);
    const to = utcDate(`${query.year}-12-31`);
    const assignment = await this.prisma.employmentAssignment.findFirst({
      where: {
        organizationId: user.organizationId,
        employeeId,
        primary: true,
        effectiveFrom: { lte: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      select: { locationId: true },
    });
    const [requests, holidays] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: {
          organizationId: user.organizationId,
          employeeId,
          startDate: { lte: to },
          endDate: { gte: from },
        },
        include: { leaveType: true },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.holiday.findMany({
        where: {
          organizationId: user.organizationId,
          date: { gte: from, lte: to },
          active: true,
          OR: assignment?.locationId
            ? [{ locationId: null }, { locationId: assignment.locationId }]
            : [{ locationId: null }],
        },
        orderBy: { date: 'asc' },
      }),
    ]);
    return { year: query.year, requests, holidays };
  }
}
