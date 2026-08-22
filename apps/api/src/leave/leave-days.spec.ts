import { DaySession } from '../generated/prisma/client';
import { countedLeaveDays } from './leave-days';
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
describe('countedLeaveDays', () => {
  it('excludes weekends and holidays and supports half day boundaries', () => {
    const result = countedLeaveDays(date('2026-08-14'), date('2026-08-18'), {
      workingWeekdays: [1, 2, 3, 4, 5],
      holidays: new Set(['2026-08-17']),
      excludeWeekends: true,
      excludeHolidays: true,
      startSession: DaySession.SECOND_HALF,
      endSession: DaySession.FULL_DAY,
    });
    expect(
      result.map((day) => [day.date.toISOString().slice(0, 10), day.units]),
    ).toEqual([
      ['2026-08-14', 0.5],
      ['2026-08-18', 1],
    ]);
  });
  it('counts one half unit for a single half day', () => {
    expect(
      countedLeaveDays(date('2026-08-18'), date('2026-08-18'), {
        workingWeekdays: [2],
        holidays: new Set(),
        excludeWeekends: true,
        excludeHolidays: true,
        startSession: DaySession.FIRST_HALF,
        endSession: DaySession.FIRST_HALF,
      })[0]?.units,
    ).toBe(0.5);
  });
});
