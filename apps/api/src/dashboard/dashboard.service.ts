import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import {
  AttendanceEventType,
  AttendanceCorrectionStatus,
  LeaveRequestStatus,
  PayrollPeriodStatus,
  RoleCode,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: AuthUser) {
    const privileged =
      user.roles.includes(RoleCode.ADMIN) ||
      user.roles.includes(RoleCode.HR_OFFICER);
    const isAdmin = user.roles.includes(RoleCode.ADMIN);
    const [
      latestEvent,
      leaveBalances,
      employeeCount,
      pendingLeave,
      pendingCorrections,
      payrollRuns,
    ] = await Promise.all([
      user.employeeId
        ? this.prisma.attendanceEvent.findFirst({
            where: {
              organizationId: user.organizationId,
              employeeId: user.employeeId,
            },
            orderBy: { occurredAt: 'desc' },
            select: { eventType: true, occurredAt: true, workDate: true },
          })
        : null,
      user.employeeId
        ? this.prisma.leaveLedgerEntry.groupBy({
            by: ['leaveTypeId'],
            where: {
              organizationId: user.organizationId,
              employeeId: user.employeeId,
              AND: [
                {
                  OR: [
                    { entryType: { in: ['DEBIT', 'REVERSAL'] } },
                    { effectiveDate: { lte: new Date() } },
                  ],
                },
                {
                  OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
                },
              ],
            },
            _sum: { units: true },
          })
        : [],
      privileged
        ? this.prisma.employee.count({
            where: {
              organizationId: user.organizationId,
              archivedAt: null,
            },
          })
        : Promise.resolve(null),
      privileged
        ? this.prisma.leaveRequest.count({
            where: {
              organizationId: user.organizationId,
              status: LeaveRequestStatus.PENDING,
            },
          })
        : Promise.resolve(null),
      privileged
        ? this.prisma.attendanceCorrection.count({
            where: {
              organizationId: user.organizationId,
              status: AttendanceCorrectionStatus.PENDING,
            },
          })
        : Promise.resolve(null),
      isAdmin
        ? this.prisma.payrollPeriod.count({
            where: {
              organizationId: user.organizationId,
              status: {
                in: [PayrollPeriodStatus.DRAFT, PayrollPeriodStatus.CALCULATED],
              },
            },
          })
        : Promise.resolve(null),
    ]);

    return {
      clock: {
        state:
          latestEvent?.eventType === AttendanceEventType.BREAK_START
            ? 'ON_BREAK'
            : latestEvent?.eventType === AttendanceEventType.CLOCK_IN ||
                latestEvent?.eventType === AttendanceEventType.BREAK_END
              ? 'CLOCKED_IN'
              : latestEvent?.eventType === AttendanceEventType.CLOCK_OUT
                ? 'CLOCKED_OUT'
                : 'NOT_CLOCKED_IN',
        since: latestEvent?.occurredAt ?? null,
        workDate: latestEvent?.workDate ?? null,
      },
      leaveBalances: leaveBalances.map((balance) => ({
        leaveTypeId: balance.leaveTypeId,
        units: Number(balance._sum.units ?? 0),
      })),
      team: privileged
        ? { employeeCount, pendingLeave, pendingCorrections }
        : null,
      payroll: isAdmin ? { openRuns: payrollRuns } : null,
    };
  }
}
