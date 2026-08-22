import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import {
  AttendanceCorrectionStatus,
  AttendanceEventType,
  AttendanceStatus,
  Prisma,
  RoleCode,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { utcDate } from '../calendar/calendar.service';
import { calculateAttendance, validNextEvent } from './attendance-calculation';
import {
  ClockEventDto,
  CorrectionQueryDto,
  CreateCorrectionDto,
  DecideCorrectionDto,
  MineAttendanceQueryDto,
  TeamAttendanceQueryDto,
} from './attendance.dto';

function localPartsAt(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return {
    date: utcDate(`${get('year')}-${get('month')}-${get('day')}`),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function attendanceWorkDate(
  instant: Date,
  timezone: string,
  overnight: boolean,
  shiftEndMinutes: number,
) {
  const local = localPartsAt(instant, timezone);
  return overnight && local.minutes <= shiftEndMinutes
    ? new Date(local.date.getTime() - 86_400_000)
    : local.date;
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private requireEmployee(user: AuthUser) {
    if (!user.employeeId)
      throw new ForbiddenException({
        code: 'ATTENDANCE_EMPLOYEE_REQUIRED',
        message: 'An employee profile is required.',
      });
    return user.employeeId;
  }

  private async effectiveScheduleAssignment(
    organizationId: string,
    employeeId: string,
    date: Date,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    return tx.workScheduleAssignment.findFirst({
      where: {
        organizationId,
        employeeId,
        primary: true,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      include: { schedule: true },
    });
  }

  private async effectiveSchedule(
    organizationId: string,
    employeeId: string,
    date: Date,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const assignment = await this.effectiveScheduleAssignment(
      organizationId,
      employeeId,
      date,
      tx,
    );
    if (!assignment)
      throw new BadRequestException({
        code: 'ATTENDANCE_SCHEDULE_MISSING',
        message: 'No effective work schedule is assigned.',
      });
    return assignment.schedule;
  }

  async clockState(user: AuthUser) {
    const employeeId = this.requireEmployee(user);
    const serverTime = new Date();
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      select: { timezone: true },
    });
    const localDate = localPartsAt(serverTime, organization.timezone).date;
    const assignment = await this.effectiveScheduleAssignment(
      user.organizationId,
      employeeId,
      localDate,
    );
    if (!assignment) {
      const nextAssignment = await this.prisma.workScheduleAssignment.findFirst(
        {
          where: {
            organizationId: user.organizationId,
            employeeId,
            primary: true,
            effectiveFrom: { gt: localDate },
            schedule: { active: true },
          },
          orderBy: { effectiveFrom: 'asc' },
          select: { effectiveFrom: true },
        },
      );
      return {
        state: 'NOT_CLOCKED_IN' as const,
        since: null,
        workDate: null,
        workedSeconds: 0,
        serverTime,
        attendanceAvailable: false,
        availableFrom: nextAssignment?.effectiveFrom ?? null,
        unavailableReason: nextAssignment
          ? 'Attendance becomes available on your joining date.'
          : 'No work schedule is assigned. Contact an administrator.',
      };
    }
    const schedule = assignment.schedule;
    const currentWorkDate = attendanceWorkDate(
      serverTime,
      organization.timezone,
      schedule.overnight,
      schedule.shiftEndMinutes,
    );
    const latest = await this.prisma.attendanceEvent.findFirst({
      where: {
        organizationId: user.organizationId,
        employeeId,
        workDate: currentWorkDate,
      },
      orderBy: { occurredAt: 'desc' },
    });
    if (!latest) {
      return {
        state: 'NOT_CLOCKED_IN' as const,
        since: null,
        workDate: null,
        workedSeconds: 0,
        serverTime,
        attendanceAvailable: true,
      };
    }
    const events = await this.prisma.attendanceEvent.findMany({
      where: {
        organizationId: user.organizationId,
        employeeId,
        workDate: latest.workDate,
      },
      orderBy: { occurredAt: 'asc' },
      select: { eventType: true, occurredAt: true },
    });
    let workedMilliseconds = 0;
    let runningSince: Date | null = null;
    for (const event of events) {
      if (
        event.eventType === AttendanceEventType.CLOCK_IN ||
        event.eventType === AttendanceEventType.BREAK_END
      ) {
        runningSince ??= event.occurredAt;
      } else if (runningSince) {
        workedMilliseconds += Math.max(
          0,
          event.occurredAt.getTime() - runningSince.getTime(),
        );
        runningSince = null;
      }
    }
    const state =
      latest.eventType === AttendanceEventType.CLOCK_IN ||
      latest.eventType === AttendanceEventType.BREAK_END
        ? ('CLOCKED_IN' as const)
        : latest.eventType === AttendanceEventType.BREAK_START
          ? ('ON_BREAK' as const)
          : ('CLOCKED_OUT' as const);
    if (state === 'CLOCKED_IN' && runningSince) {
      workedMilliseconds += Math.max(
        0,
        serverTime.getTime() - runningSince.getTime(),
      );
    }
    return {
      state,
      since: latest.occurredAt,
      workDate: latest.workDate,
      workedSeconds: Math.floor(workedMilliseconds / 1000),
      serverTime,
      attendanceAvailable: true,
    };
  }

  async clockEvent(user: AuthUser, dto: ClockEventDto) {
    const employeeId = this.requireEmployee(user);
    const eventType = AttendanceEventType[dto.action];
    const now = new Date();
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${user.organizationId}:${employeeId}:attendance`}))`;
        const duplicate = await tx.attendanceEvent.findUnique({
          where: {
            organizationId_employeeId_idempotencyKey: {
              organizationId: user.organizationId,
              employeeId,
              idempotencyKey: dto.idempotencyKey,
            },
          },
        });
        if (duplicate) return { event: duplicate, idempotentReplay: true };
        const organization = await tx.organization.findUniqueOrThrow({
          where: { id: user.organizationId },
          select: { timezone: true },
        });
        const provisionalDate = localPartsAt(now, organization.timezone).date;
        const schedule = await this.effectiveSchedule(
          user.organizationId,
          employeeId,
          provisionalDate,
          tx,
        );
        let workDate = attendanceWorkDate(
          now,
          schedule.timezone,
          schedule.overnight,
          schedule.shiftEndMinutes,
        );
        const latest = await tx.attendanceEvent.findFirst({
          where: { organizationId: user.organizationId, employeeId },
          orderBy: { occurredAt: 'desc' },
        });
        if (
          latest?.eventType === AttendanceEventType.CLOCK_OUT &&
          eventType === AttendanceEventType.CLOCK_IN &&
          latest.workDate.getTime() === workDate.getTime()
        )
          throw new ConflictException({
            code: 'ATTENDANCE_DAY_COMPLETED',
            message:
              'Attendance has already been completed for this work date.',
          });
        if (!validNextEvent(latest?.eventType ?? null, eventType))
          throw new ConflictException({
            code: 'ATTENDANCE_TRANSITION_INVALID',
            message: `Cannot record ${eventType} after ${latest?.eventType ?? 'NOT_CLOCKED_IN'}.`,
          });
        if (eventType !== AttendanceEventType.CLOCK_IN && latest)
          workDate = latest.workDate;
        const event = await tx.attendanceEvent.create({
          data: {
            organizationId: user.organizationId,
            employeeId,
            eventType,
            occurredAt: now,
            workDate,
            timezone: schedule.timezone,
            idempotencyKey: dto.idempotencyKey,
            actorUserId: user.userId,
            clientOccurredAt: dto.clientOccurredAt
              ? new Date(dto.clientOccurredAt)
              : null,
          },
        });
        const events = await tx.attendanceEvent.findMany({
          where: { organizationId: user.organizationId, employeeId, workDate },
          orderBy: { occurredAt: 'asc' },
        });
        const calculated = calculateAttendance(events, schedule);
        const record = await tx.attendanceRecord.upsert({
          where: {
            organizationId_employeeId_workDate: {
              organizationId: user.organizationId,
              employeeId,
              workDate,
            },
          },
          create: {
            organizationId: user.organizationId,
            employeeId,
            workDate,
            scheduleId: schedule.id,
            ...calculated,
          },
          update: {
            scheduleId: schedule.id,
            ...calculated,
            version: { increment: 1 },
            calculatedAt: now,
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorUserId: user.userId,
            action: `attendance.${eventType.toLowerCase()}`,
            resourceType: 'AttendanceEvent',
            resourceId: event.id,
            changes: {
              workDate: workDate.toISOString().slice(0, 10),
              recordStatus: record.status,
            },
          },
        });
        return { event, record, idempotentReplay: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async mine(user: AuthUser, query: MineAttendanceQueryDto) {
    const employeeId = this.requireEmployee(user);
    const anchor = query.date
      ? utcDate(query.date)
      : utcDate(new Date().toISOString().slice(0, 10));
    let from: Date;
    let to: Date;
    if (query.view === 'week') {
      const isoDay = anchor.getUTCDay() || 7;
      from = new Date(anchor.getTime() - (isoDay - 1) * 86_400_000);
      to = new Date(from.getTime() + 6 * 86_400_000);
    } else {
      from = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1),
      );
      to = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
      );
    }
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        organizationId: user.organizationId,
        employeeId,
        workDate: { gte: from, lte: to },
      },
      orderBy: { workDate: 'asc' },
    });
    const summary = records.reduce(
      (result, record) => ({
        presentDays:
          result.presentDays +
          (record.status === AttendanceStatus.PRESENT ? 1 : 0),
        leaveDays:
          result.leaveDays + (record.status === AttendanceStatus.LEAVE ? 1 : 0),
        payableUnits: result.payableUnits + Number(record.payableUnits),
        netMinutes: result.netMinutes + record.netMinutes,
        overtimeMinutes: result.overtimeMinutes + record.overtimeMinutes,
      }),
      {
        presentDays: 0,
        leaveDays: 0,
        payableUnits: 0,
        netMinutes: 0,
        overtimeMinutes: 0,
      },
    );
    return { range: { from, to, view: query.view }, summary, records };
  }

  async team(user: AuthUser, query: TeamAttendanceQueryDto) {
    const from = utcDate(
      query.from ?? query.date ?? new Date().toISOString().slice(0, 10),
    );
    const to = utcDate(
      query.to ?? query.date ?? new Date().toISOString().slice(0, 10),
    );
    if (to < from || to.getTime() - from.getTime() > 31 * 86_400_000)
      throw new BadRequestException({
        code: 'ATTENDANCE_RANGE_INVALID',
        message: 'Choose a range of up to 31 days.',
      });
    const where: Prisma.AttendanceRecordWhereInput = {
      organizationId: user.organizationId,
      workDate: { gte: from, lte: to },
      ...(query.search
        ? {
            employee: {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
                { loginId: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.attendanceRecord.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              loginId: true,
            },
          },
        },
        orderBy: [{ workDate: 'desc' }, { employee: { firstName: 'asc' } }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);
    return {
      records,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async requestCorrection(user: AuthUser, dto: CreateCorrectionDto) {
    const employeeId = this.requireEmployee(user);
    const record = await this.prisma.attendanceRecord.findFirst({
      where: {
        id: dto.attendanceRecordId,
        organizationId: user.organizationId,
        employeeId,
      },
    });
    if (!record)
      throw new NotFoundException({
        code: 'ATTENDANCE_RECORD_NOT_FOUND',
        message: 'Attendance record not found.',
      });
    const existing = await this.prisma.attendanceCorrection.findFirst({
      where: {
        attendanceRecordId: record.id,
        status: AttendanceCorrectionStatus.PENDING,
      },
    });
    if (existing)
      throw new ConflictException({
        code: 'ATTENDANCE_CORRECTION_PENDING',
        message: 'A correction is already pending for this day.',
      });
    return this.prisma.$transaction(async (tx) => {
      const correction = await tx.attendanceCorrection.create({
        data: {
          organizationId: user.organizationId,
          employeeId,
          attendanceRecordId: record.id,
          requestedCheckIn: dto.requestedCheckIn
            ? new Date(dto.requestedCheckIn)
            : null,
          requestedCheckOut: dto.requestedCheckOut
            ? new Date(dto.requestedCheckOut)
            : null,
          reason: dto.reason.trim(),
          requestedById: user.userId,
        },
      });
      await tx.attendanceRecord.update({
        where: { id: record.id },
        data: {
          status: AttendanceStatus.PENDING_CORRECTION,
          version: { increment: 1 },
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'attendance.correction_requested',
          resourceType: 'AttendanceCorrection',
          resourceId: correction.id,
        },
      });
      return correction;
    });
  }

  listCorrections(user: AuthUser, query: CorrectionQueryDto) {
    const privileged =
      user.roles.includes(RoleCode.ADMIN) ||
      user.roles.includes(RoleCode.HR_OFFICER);
    return this.prisma.attendanceCorrection.findMany({
      where: {
        organizationId: user.organizationId,
        ...(!privileged ? { employeeId: this.requireEmployee(user) } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, loginId: true },
        },
        attendanceRecord: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async decideCorrection(
    user: AuthUser,
    id: string,
    approved: boolean,
    dto: DecideCorrectionDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${user.organizationId}:${id}:attendance-correction`}))`;
        const correction = await tx.attendanceCorrection.findFirst({
          where: { id, organizationId: user.organizationId },
          include: { attendanceRecord: true },
        });
        if (!correction)
          throw new NotFoundException({
            code: 'ATTENDANCE_CORRECTION_NOT_FOUND',
            message: 'Correction not found.',
          });
        if (
          correction.status !== AttendanceCorrectionStatus.PENDING ||
          correction.version !== dto.version
        )
          throw new ConflictException({
            code: 'ATTENDANCE_CORRECTION_STALE',
            message: 'This correction has already changed.',
          });
        if (
          approved &&
          correction.requestedCheckIn &&
          correction.requestedCheckOut &&
          correction.requestedCheckOut <= correction.requestedCheckIn
        )
          throw new BadRequestException({
            code: 'ATTENDANCE_CORRECTION_RANGE_INVALID',
            message: 'Check-out must be after check-in.',
          });
        const status = approved
          ? AttendanceCorrectionStatus.APPROVED
          : AttendanceCorrectionStatus.REJECTED;
        await tx.attendanceCorrection.update({
          where: { id },
          data: {
            status,
            decisionComment: dto.comment.trim(),
            decidedById: user.userId,
            decidedAt: new Date(),
            version: { increment: 1 },
          },
        });
        if (approved) {
          if (correction.attendanceRecord.lockedAt) {
            await tx.outboxEvent.create({
              data: {
                organizationId: user.organizationId,
                aggregateType: 'AttendanceCorrection',
                aggregateId: id,
                eventType: 'payroll.adjustment_required',
                payload: {
                  attendanceRecordId: correction.attendanceRecordId,
                  employeeId: correction.employeeId,
                },
              },
            });
          } else {
            const checkIn =
              correction.requestedCheckIn ??
              correction.attendanceRecord.firstCheckIn;
            const checkOut =
              correction.requestedCheckOut ??
              correction.attendanceRecord.lastCheckOut;
            const gross =
              checkIn && checkOut
                ? Math.floor((checkOut.getTime() - checkIn.getTime()) / 60_000)
                : 0;
            const schedule = correction.attendanceRecord.scheduleId
              ? await tx.workSchedule.findUnique({
                  where: { id: correction.attendanceRecord.scheduleId },
                })
              : null;
            const full = schedule?.fullDayMinutes ?? 480;
            const half = schedule?.halfDayMinutes ?? 240;
            await tx.attendanceRecord.update({
              where: { id: correction.attendanceRecordId },
              data: {
                firstCheckIn: checkIn,
                lastCheckOut: checkOut,
                grossMinutes: gross,
                netMinutes: gross,
                overtimeMinutes: Math.max(
                  0,
                  gross - (schedule?.overtimeAfterMinutes ?? 480),
                ),
                status:
                  gross >= full
                    ? AttendanceStatus.PRESENT
                    : gross >= half
                      ? AttendanceStatus.HALF_DAY
                      : AttendanceStatus.ABSENT,
                payableUnits: gross >= full ? 1 : gross >= half ? 0.5 : 0,
                version: { increment: 1 },
                calculatedAt: new Date(),
              },
            });
          }
        } else {
          await tx.attendanceRecord.update({
            where: { id: correction.attendanceRecordId },
            data: {
              status:
                correction.attendanceRecord.firstCheckIn &&
                !correction.attendanceRecord.lastCheckOut
                  ? AttendanceStatus.INCOMPLETE
                  : correction.attendanceRecord.status,
              version: { increment: 1 },
            },
          });
        }
        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorUserId: user.userId,
            action: approved
              ? 'attendance.correction_approved'
              : 'attendance.correction_rejected',
            resourceType: 'AttendanceCorrection',
            resourceId: id,
            changes: {
              comment: dto.comment.trim(),
              lockedPayrollInput: Boolean(correction.attendanceRecord.lockedAt),
            },
          },
        });
        return tx.attendanceCorrection.findUniqueOrThrow({ where: { id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
