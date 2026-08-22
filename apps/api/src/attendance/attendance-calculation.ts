import {
  AttendanceEventType,
  AttendanceStatus,
} from '../generated/prisma/client';

export interface CalculationEvent {
  eventType: AttendanceEventType;
  occurredAt: Date;
}
export interface CalculationSchedule {
  paidBreakMinutes: number;
  halfDayMinutes: number;
  fullDayMinutes: number;
  overtimeAfterMinutes: number;
}

export function calculateAttendance(
  events: CalculationEvent[],
  schedule: CalculationSchedule,
) {
  const sorted = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
  const firstIn =
    sorted.find((event) => event.eventType === AttendanceEventType.CLOCK_IN)
      ?.occurredAt ?? null;
  const lastOut =
    [...sorted]
      .reverse()
      .find((event) => event.eventType === AttendanceEventType.CLOCK_OUT)
      ?.occurredAt ?? null;
  let breakStart: Date | null = null;
  let breakMinutes = 0;
  for (const event of sorted) {
    if (event.eventType === AttendanceEventType.BREAK_START)
      breakStart = event.occurredAt;
    if (event.eventType === AttendanceEventType.BREAK_END && breakStart) {
      breakMinutes += Math.max(
        0,
        Math.floor(
          (event.occurredAt.getTime() - breakStart.getTime()) / 60_000,
        ),
      );
      breakStart = null;
    }
  }
  const grossMinutes =
    firstIn && lastOut
      ? Math.max(
          0,
          Math.floor((lastOut.getTime() - firstIn.getTime()) / 60_000),
        )
      : 0;
  const paidBreakMinutes = Math.min(breakMinutes, schedule.paidBreakMinutes);
  const unpaidBreakMinutes = Math.max(0, breakMinutes - paidBreakMinutes);
  const netMinutes = Math.max(0, grossMinutes - unpaidBreakMinutes);
  const incomplete = Boolean(firstIn && !lastOut) || Boolean(breakStart);
  const status = incomplete
    ? AttendanceStatus.INCOMPLETE
    : netMinutes >= schedule.fullDayMinutes
      ? AttendanceStatus.PRESENT
      : netMinutes >= schedule.halfDayMinutes
        ? AttendanceStatus.HALF_DAY
        : AttendanceStatus.ABSENT;
  const payableUnits =
    status === AttendanceStatus.PRESENT
      ? 1
      : status === AttendanceStatus.HALF_DAY
        ? 0.5
        : 0;
  return {
    firstCheckIn: firstIn,
    lastCheckOut: lastOut,
    grossMinutes,
    paidBreakMinutes,
    unpaidBreakMinutes,
    netMinutes,
    overtimeMinutes: Math.max(0, netMinutes - schedule.overtimeAfterMinutes),
    status,
    payableUnits,
  };
}

export function validNextEvent(
  previous: AttendanceEventType | null,
  next: AttendanceEventType,
) {
  if (!previous) return next === AttendanceEventType.CLOCK_IN;
  if (previous === AttendanceEventType.CLOCK_OUT)
    return next === AttendanceEventType.CLOCK_IN;
  if (
    previous === AttendanceEventType.CLOCK_IN ||
    previous === AttendanceEventType.BREAK_END
  )
    return (
      next === AttendanceEventType.BREAK_START ||
      next === AttendanceEventType.CLOCK_OUT
    );
  if (previous === AttendanceEventType.BREAK_START)
    return next === AttendanceEventType.BREAK_END;
  return false;
}
