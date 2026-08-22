import { DaySession } from '../generated/prisma/client';

const DAY = 86_400_000;
const isoWeekday = (date: Date) => date.getUTCDay() || 7;
export interface LeaveDayOptions {
  workingWeekdays: number[];
  holidays: Set<string>;
  excludeWeekends: boolean;
  excludeHolidays: boolean;
  startSession: DaySession;
  endSession: DaySession;
}
export function countedLeaveDays(
  start: Date,
  end: Date,
  options: LeaveDayOptions,
) {
  if (end < start) throw new Error('Invalid leave date range');
  const dates: Array<{ date: Date; units: number }> = [];
  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor = new Date(cursor.getTime() + DAY)
  ) {
    const key = cursor.toISOString().slice(0, 10);
    if (
      options.excludeWeekends &&
      !options.workingWeekdays.includes(isoWeekday(cursor))
    )
      continue;
    if (options.excludeHolidays && options.holidays.has(key)) continue;
    let units = 1;
    if (
      cursor.getTime() === start.getTime() &&
      options.startSession !== DaySession.FULL_DAY
    )
      units -= 0.5;
    if (
      cursor.getTime() === end.getTime() &&
      options.endSession !== DaySession.FULL_DAY
    )
      units -= 0.5;
    if (
      start.getTime() === end.getTime() &&
      options.startSession !== DaySession.FULL_DAY &&
      options.endSession !== DaySession.FULL_DAY
    )
      units = 0.5;
    if (units > 0) dates.push({ date: new Date(cursor), units });
  }
  return dates;
}
