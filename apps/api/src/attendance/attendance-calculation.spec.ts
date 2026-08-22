import {
  AttendanceEventType,
  AttendanceStatus,
} from '../generated/prisma/client';
import { calculateAttendance, validNextEvent } from './attendance-calculation';
import { attendanceWorkDate } from './attendance.service';

describe('attendance state and calculation', () => {
  const at = (hour: number, minute = 0) =>
    new Date(Date.UTC(2026, 7, 22, hour, minute));
  it('enforces the clock/break state machine', () => {
    expect(validNextEvent(null, AttendanceEventType.CLOCK_IN)).toBe(true);
    expect(
      validNextEvent(
        AttendanceEventType.CLOCK_IN,
        AttendanceEventType.CLOCK_IN,
      ),
    ).toBe(false);
    expect(
      validNextEvent(
        AttendanceEventType.BREAK_START,
        AttendanceEventType.CLOCK_OUT,
      ),
    ).toBe(false);
    expect(
      validNextEvent(
        AttendanceEventType.BREAK_END,
        AttendanceEventType.CLOCK_OUT,
      ),
    ).toBe(true);
    expect(
      validNextEvent(
        AttendanceEventType.CLOCK_OUT,
        AttendanceEventType.CLOCK_IN,
      ),
    ).toBe(true);
  });
  it('subtracts only unpaid break time and computes overtime', () => {
    const result = calculateAttendance(
      [
        { eventType: AttendanceEventType.CLOCK_IN, occurredAt: at(9) },
        { eventType: AttendanceEventType.BREAK_START, occurredAt: at(13) },
        { eventType: AttendanceEventType.BREAK_END, occurredAt: at(14) },
        { eventType: AttendanceEventType.CLOCK_OUT, occurredAt: at(18) },
      ],
      {
        paidBreakMinutes: 30,
        halfDayMinutes: 240,
        fullDayMinutes: 480,
        overtimeAfterMinutes: 480,
      },
    );
    expect(result).toMatchObject({
      grossMinutes: 540,
      paidBreakMinutes: 30,
      unpaidBreakMinutes: 30,
      netMinutes: 510,
      overtimeMinutes: 30,
      status: AttendanceStatus.PRESENT,
      payableUnits: 1,
    });
  });
  it('marks an open session incomplete', () => {
    const result = calculateAttendance(
      [{ eventType: AttendanceEventType.CLOCK_IN, occurredAt: at(9) }],
      {
        paidBreakMinutes: 0,
        halfDayMinutes: 240,
        fullDayMinutes: 480,
        overtimeAfterMinutes: 480,
      },
    );
    expect(result.status).toBe(AttendanceStatus.INCOMPLETE);
  });
  it('uses timezone-aware local and overnight work dates', () => {
    expect(
      attendanceWorkDate(
        new Date('2026-08-22T20:30:00.000Z'),
        'Asia/Kolkata',
        true,
        360,
      )
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-08-22');
    expect(
      attendanceWorkDate(
        new Date('2026-03-08T06:30:00.000Z'),
        'America/New_York',
        false,
        0,
      )
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-03-08');
  });
});
