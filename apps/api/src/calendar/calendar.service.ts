import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../database/prisma.service';
import {
  AssignScheduleDto,
  CreateHolidayDto,
  CreateScheduleDto,
  HolidayQueryDto,
  UpdateHolidayDto,
  UpdateScheduleDto,
} from './calendar.dto';

export const utcDate = (value: string) =>
  new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

function previousUtcDay(date: Date) {
  return new Date(date.getTime() - 86_400_000);
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private validateSchedule(dto: CreateScheduleDto) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: dto.timezone }).format();
    } catch {
      throw new BadRequestException({
        code: 'SCHEDULE_TIMEZONE_INVALID',
        message: 'Use a valid IANA timezone.',
      });
    }
    const weekdays = new Set(dto.workingWeekdays);
    if (
      weekdays.size !== dto.workingWeekdays.length ||
      [...weekdays].some((day) => day < 1 || day > 7)
    ) {
      throw new BadRequestException({
        code: 'SCHEDULE_WEEKDAYS_INVALID',
        message:
          'Working weekdays must be unique ISO weekday numbers 1 through 7.',
      });
    }
    if (!dto.overnight && dto.shiftEndMinutes <= dto.shiftStartMinutes) {
      throw new BadRequestException({
        code: 'SCHEDULE_SHIFT_INVALID',
        message: 'A same-day shift must end after it starts.',
      });
    }
    if (
      dto.halfDayMinutes >= dto.fullDayMinutes ||
      dto.overtimeAfterMinutes < dto.fullDayMinutes
    ) {
      throw new BadRequestException({
        code: 'SCHEDULE_THRESHOLDS_INVALID',
        message:
          'Half-day, full-day and overtime thresholds must be increasing.',
      });
    }
  }

  listSchedules(user: AuthUser) {
    return this.prisma.workSchedule.findMany({
      where: { organizationId: user.organizationId, active: true },
      orderBy: [{ name: 'asc' }, { version: 'desc' }],
    });
  }

  async createSchedule(user: AuthUser, dto: CreateScheduleDto) {
    this.validateSchedule(dto);
    const effectiveFrom = utcDate(dto.effectiveFrom);
    const schedule = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workSchedule.create({
        data: {
          ...dto,
          name: dto.name.trim(),
          workingWeekdays: [...new Set(dto.workingWeekdays)].sort(),
          effectiveFrom,
          effectiveTo: dto.effectiveTo ? utcDate(dto.effectiveTo) : null,
          organizationId: user.organizationId,
          version: 1,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'schedule.created',
          resourceType: 'WorkSchedule',
          resourceId: created.id,
          changes: { version: 1 },
        },
      });
      return created;
    });
    return schedule;
  }

  async updateSchedule(user: AuthUser, id: string, dto: UpdateScheduleDto) {
    this.validateSchedule(dto);
    const effectiveFrom = utcDate(dto.effectiveFrom);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.workSchedule.findFirst({
        where: { id, organizationId: user.organizationId, active: true },
      });
      if (!current)
        throw new NotFoundException({
          code: 'SCHEDULE_NOT_FOUND',
          message: 'Schedule not found.',
        });
      if (current.version !== dto.version)
        throw new ConflictException({
          code: 'SCHEDULE_VERSION_CONFLICT',
          message: 'The schedule changed. Refresh and try again.',
        });
      if (effectiveFrom <= current.effectiveFrom)
        throw new BadRequestException({
          code: 'SCHEDULE_EFFECTIVE_DATE_INVALID',
          message:
            'A new schedule version must start after the current version.',
        });
      await tx.workSchedule.update({
        where: { id },
        data: { active: false, effectiveTo: previousUtcDay(effectiveFrom) },
      });
      const created = await tx.workSchedule.create({
        data: {
          organizationId: user.organizationId,
          name: dto.name.trim(),
          timezone: dto.timezone,
          workingWeekdays: [...new Set(dto.workingWeekdays)].sort(),
          shiftStartMinutes: dto.shiftStartMinutes,
          shiftEndMinutes: dto.shiftEndMinutes,
          overnight: dto.overnight,
          paidBreakMinutes: dto.paidBreakMinutes,
          unpaidBreakMinutes: dto.unpaidBreakMinutes,
          graceMinutes: dto.graceMinutes,
          halfDayMinutes: dto.halfDayMinutes,
          fullDayMinutes: dto.fullDayMinutes,
          overtimeAfterMinutes: dto.overtimeAfterMinutes,
          effectiveFrom,
          effectiveTo: dto.effectiveTo ? utcDate(dto.effectiveTo) : null,
          version: current.version + 1,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'schedule.versioned',
          resourceType: 'WorkSchedule',
          resourceId: created.id,
          changes: { previousId: current.id, version: created.version },
        },
      });
      return created;
    });
  }

  async assignSchedule(
    user: AuthUser,
    scheduleId: string,
    dto: AssignScheduleDto,
  ) {
    const from = utcDate(dto.effectiveFrom);
    const to = dto.effectiveTo ? utcDate(dto.effectiveTo) : null;
    if (to && to < from)
      throw new BadRequestException({
        code: 'SCHEDULE_ASSIGNMENT_RANGE_INVALID',
        message: 'Effective end cannot precede start.',
      });
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${user.organizationId}:${dto.employeeId}:schedule-assignment`}))`;
      const [schedule, employee] = await Promise.all([
        tx.workSchedule.findFirst({
          where: { id: scheduleId, organizationId: user.organizationId },
        }),
        tx.employee.findFirst({
          where: {
            id: dto.employeeId,
            organizationId: user.organizationId,
            archivedAt: null,
          },
          select: { id: true },
        }),
      ]);
      if (!schedule || !employee)
        throw new NotFoundException({
          code: 'SCHEDULE_ASSIGNMENT_TARGET_NOT_FOUND',
          message: 'Schedule or employee not found.',
        });
      const overlap = await tx.workScheduleAssignment.findFirst({
        where: {
          organizationId: user.organizationId,
          employeeId: dto.employeeId,
          primary: true,
          effectiveFrom: { lte: to ?? new Date('9999-12-31') },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
        },
      });
      if (overlap)
        throw new ConflictException({
          code: 'SCHEDULE_ASSIGNMENT_OVERLAP',
          message:
            'This employee already has a primary schedule in that date range.',
        });
      const assignment = await tx.workScheduleAssignment.create({
        data: {
          organizationId: user.organizationId,
          employeeId: dto.employeeId,
          scheduleId,
          effectiveFrom: from,
          effectiveTo: to,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'schedule.assigned',
          resourceType: 'WorkScheduleAssignment',
          resourceId: assignment.id,
          changes: { employeeId: dto.employeeId, scheduleId },
        },
      });
      return assignment;
    });
  }

  listHolidays(user: AuthUser, query: HolidayQueryDto) {
    const year = query.year ?? new Date().getUTCFullYear();
    return this.prisma.holiday.findMany({
      where: {
        organizationId: user.organizationId,
        active: true,
        date: { gte: utcDate(`${year}-01-01`), lte: utcDate(`${year}-12-31`) },
        ...(query.locationId
          ? { OR: [{ locationId: null }, { locationId: query.locationId }] }
          : {}),
      },
      include: {
        location: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });
  }

  async createHoliday(user: AuthUser, dto: CreateHolidayDto) {
    const date = utcDate(dto.date);
    return this.prisma.$transaction(async (tx) => {
      if (dto.locationId) {
        const location = await tx.workLocation.findFirst({
          where: {
            id: dto.locationId,
            organizationId: user.organizationId,
            active: true,
          },
        });
        if (!location)
          throw new NotFoundException({
            code: 'HOLIDAY_LOCATION_NOT_FOUND',
            message: 'Work location not found.',
          });
      }
      const duplicate = await tx.holiday.findFirst({
        where: {
          organizationId: user.organizationId,
          locationId: dto.locationId ?? null,
          date,
          active: true,
        },
      });
      if (duplicate)
        throw new ConflictException({
          code: 'HOLIDAY_DUPLICATE',
          message: 'A holiday already exists for this scope and date.',
        });
      const holiday = await tx.holiday.create({
        data: {
          organizationId: user.organizationId,
          locationId: dto.locationId,
          name: dto.name.trim(),
          date,
          optional: dto.optional,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'holiday.created',
          resourceType: 'Holiday',
          resourceId: holiday.id,
          changes: { date: dto.date, locationId: dto.locationId ?? null },
        },
      });
      return holiday;
    });
  }

  async updateHoliday(user: AuthUser, id: string, dto: UpdateHolidayDto) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.holiday.updateMany({
        where: {
          id,
          organizationId: user.organizationId,
          version: dto.version,
        },
        data: {
          name: dto.name?.trim(),
          optional: dto.optional,
          active: dto.active,
          version: { increment: 1 },
        },
      });
      if (!updated.count)
        throw new ConflictException({
          code: 'HOLIDAY_VERSION_CONFLICT',
          message: 'Holiday not found or changed.',
        });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'holiday.updated',
          resourceType: 'Holiday',
          resourceId: id,
        },
      });
      return tx.holiday.findUniqueOrThrow({ where: { id } });
    });
  }
}
