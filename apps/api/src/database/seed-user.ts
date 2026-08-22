import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import {
  AttendanceCorrectionStatus,
  AttendanceStatus,
  DaySession,
  EmploymentStatus,
  LeaveLedgerEntryType,
  LeaveRequestStatus,
  PayrollPeriodStatus,
  PrismaClient,
  SalaryAssignmentStatus,
  SalaryBasis,
  SalaryCalculationMode,
  SalaryComponentType,
} from '../generated/prisma/client';

config({ path: resolve(process.cwd(), '../../.env') });

const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
const targetEmail = process.env.SEED_USER_EMAIL?.trim().toLowerCase();

if (!connectionString)
  throw new Error('DATABASE_URL or DIRECT_URL is required to seed Dayflow.');
if (!targetEmail)
  throw new Error('SEED_USER_EMAIL is required for the targeted demo seed.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const instant = (value: string) => new Date(value);
const money = (value: number) => Math.round(value * 100) / 100;

async function main() {
  const target = await prisma.user.findFirst({
    where: { emailNormalized: targetEmail },
    include: { organization: true, employee: true },
  });
  if (!target) throw new Error(`No Dayflow user was found for ${targetEmail}.`);
  if (!target.employee)
    throw new Error(`The user ${targetEmail} has no employee profile.`);

  const result = await prisma.$transaction(async (tx) => {
    const organizationId = target.organizationId;
    const actorUserId = target.id;
    const targetEmployee = target.employee!;

    const [engineering, people, location] = await Promise.all([
      tx.department.upsert({
        where: {
          organizationId_code: { organizationId, code: 'ENGINEERING' },
        },
        create: {
          organizationId,
          code: 'ENGINEERING',
          name: 'Engineering',
        },
        update: { name: 'Engineering', active: true },
      }),
      tx.department.upsert({
        where: { organizationId_code: { organizationId, code: 'PEOPLE' } },
        create: {
          organizationId,
          code: 'PEOPLE',
          name: 'People Operations',
        },
        update: { name: 'People Operations', active: true },
      }),
      tx.workLocation.upsert({
        where: {
          organizationId_name: { organizationId, name: 'Bengaluru' },
        },
        create: {
          organizationId,
          name: 'Bengaluru',
          timezone: 'Asia/Kolkata',
          address: { city: 'Bengaluru', country: 'India' },
        },
        update: { active: true, timezone: 'Asia/Kolkata' },
      }),
    ]);

    const schedule = await tx.workSchedule.upsert({
      where: {
        organizationId_name_version: {
          organizationId,
          name: 'Standard work week',
          version: 1,
        },
      },
      create: {
        organizationId,
        name: 'Standard work week',
        timezone: 'Asia/Kolkata',
        workingWeekdays: [1, 2, 3, 4, 5],
        shiftStartMinutes: 540,
        shiftEndMinutes: 1080,
        paidBreakMinutes: 30,
        graceMinutes: 15,
        halfDayMinutes: 240,
        fullDayMinutes: 480,
        overtimeAfterMinutes: 480,
        effectiveFrom: date('2026-01-01'),
      },
      update: { active: true },
    });

    const colleagues = await Promise.all(
      [
        {
          loginId: '12AISH20260002',
          employeeCode: 'HZ-0002',
          firstName: 'Aisha',
          lastName: 'Kapoor',
          workEmail: 'aisha.kapoor@heizen.example',
          jobTitle: 'People Operations Lead',
          departmentId: people.id,
        },
        {
          loginId: '12ARJU20260003',
          employeeCode: 'HZ-0003',
          firstName: 'Arjun',
          lastName: 'Mehta',
          workEmail: 'arjun.mehta@heizen.example',
          jobTitle: 'Senior Software Engineer',
          departmentId: engineering.id,
        },
        {
          loginId: '12MAYA20260004',
          employeeCode: 'HZ-0004',
          firstName: 'Maya',
          lastName: 'Rao',
          workEmail: 'maya.rao@heizen.example',
          jobTitle: 'Product Designer',
          departmentId: engineering.id,
        },
      ].map(async (person) => {
        const employee = await tx.employee.upsert({
          where: {
            organizationId_employeeCode: {
              organizationId,
              employeeCode: person.employeeCode,
            },
          },
          create: {
            organizationId,
            loginId: person.loginId,
            employeeCode: person.employeeCode,
            firstName: person.firstName,
            lastName: person.lastName,
            preferredName: person.firstName,
            workEmail: person.workEmail,
            jobTitle: person.jobTitle,
            dateOfJoining: date('2026-01-05'),
            employmentStatus: EmploymentStatus.ACTIVE,
          },
          update: {
            firstName: person.firstName,
            lastName: person.lastName,
            preferredName: person.firstName,
            workEmail: person.workEmail,
            jobTitle: person.jobTitle,
            employmentStatus: EmploymentStatus.ACTIVE,
            archivedAt: null,
          },
        });
        const assignment = await tx.employmentAssignment.findFirst({
          where: {
            organizationId,
            employeeId: employee.id,
            primary: true,
            effectiveTo: null,
          },
        });
        if (assignment)
          await tx.employmentAssignment.update({
            where: { id: assignment.id },
            data: {
              departmentId: person.departmentId,
              locationId: location.id,
              managerId: targetEmployee.id,
              jobTitle: person.jobTitle,
            },
          });
        else
          await tx.employmentAssignment.create({
            data: {
              organizationId,
              employeeId: employee.id,
              departmentId: person.departmentId,
              locationId: location.id,
              managerId: targetEmployee.id,
              jobTitle: person.jobTitle,
              effectiveFrom: date('2026-01-05'),
            },
          });
        const scheduleAssignment = await tx.workScheduleAssignment.findFirst({
          where: {
            organizationId,
            employeeId: employee.id,
            scheduleId: schedule.id,
            effectiveTo: null,
          },
        });
        if (!scheduleAssignment)
          await tx.workScheduleAssignment.create({
            data: {
              organizationId,
              employeeId: employee.id,
              scheduleId: schedule.id,
              effectiveFrom: date('2026-01-05'),
            },
          });
        return employee;
      }),
    );

    const targetAssignment = await tx.employmentAssignment.findFirst({
      where: {
        organizationId,
        employeeId: targetEmployee.id,
        primary: true,
        effectiveTo: null,
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (targetAssignment)
      await tx.employmentAssignment.update({
        where: { id: targetAssignment.id },
        data: {
          departmentId: people.id,
          locationId: location.id,
          jobTitle: targetEmployee.jobTitle ?? 'Administrator',
        },
      });
    else
      await tx.employmentAssignment.create({
        data: {
          organizationId,
          employeeId: targetEmployee.id,
          departmentId: people.id,
          locationId: location.id,
          jobTitle: targetEmployee.jobTitle ?? 'Administrator',
          effectiveFrom: targetEmployee.dateOfJoining,
        },
      });
    const targetSchedule = await tx.workScheduleAssignment.findFirst({
      where: {
        organizationId,
        employeeId: targetEmployee.id,
        scheduleId: schedule.id,
        effectiveTo: null,
      },
    });
    if (!targetSchedule)
      await tx.workScheduleAssignment.create({
        data: {
          organizationId,
          employeeId: targetEmployee.id,
          scheduleId: schedule.id,
          effectiveFrom: date('2026-01-01'),
        },
      });

    for (const holiday of [
      { name: 'Independence Day', day: '2026-08-15', optional: false },
      { name: 'Gandhi Jayanti', day: '2026-10-02', optional: false },
      { name: 'Diwali', day: '2026-11-08', optional: false },
      { name: 'Year-end wellness day', day: '2026-12-24', optional: true },
    ]) {
      const existing = await tx.holiday.findFirst({
        where: {
          organizationId,
          name: holiday.name,
          date: date(holiday.day),
        },
      });
      if (!existing)
        await tx.holiday.create({
          data: {
            organizationId,
            locationId: location.id,
            name: holiday.name,
            date: date(holiday.day),
            optional: holiday.optional,
          },
        });
    }

    const leaveDefinitions = [
      {
        code: 'PTO',
        name: 'Paid Time Off',
        paid: true,
        color: '#16867A',
        entitlement: 24,
      },
      {
        code: 'SICK',
        name: 'Sick Leave',
        paid: true,
        color: '#7C5AA6',
        entitlement: 7,
        attachmentAfterUnits: 2,
      },
      {
        code: 'UNPAID',
        name: 'Unpaid Leave',
        paid: false,
        color: '#C47B36',
        entitlement: 0,
        allowNegative: true,
      },
    ];
    const leaveTypes = new Map<string, string>();
    for (const definition of leaveDefinitions) {
      const leaveType = await tx.leaveType.upsert({
        where: {
          organizationId_code: { organizationId, code: definition.code },
        },
        create: {
          organizationId,
          code: definition.code,
          name: definition.name,
          paid: definition.paid,
          color: definition.color,
          attachmentAfterUnits: definition.attachmentAfterUnits,
          allowNegative: definition.allowNegative ?? false,
        },
        update: { active: true },
      });
      leaveTypes.set(definition.code, leaveType.id);
      await tx.leavePolicy.upsert({
        where: {
          organizationId_leaveTypeId_name_version: {
            organizationId,
            leaveTypeId: leaveType.id,
            name: `${definition.name} default`,
            version: 1,
          },
        },
        create: {
          organizationId,
          leaveTypeId: leaveType.id,
          name: `${definition.name} default`,
          annualEntitlement: definition.entitlement,
          carryForward: definition.code === 'PTO',
          carryForwardCap: definition.code === 'PTO' ? 5 : undefined,
          effectiveFrom: date('2026-01-01'),
        },
        update: { active: true },
      });
    }

    for (const allocation of [
      { code: 'PTO', units: 24 },
      { code: 'SICK', units: 7 },
    ])
      await tx.leaveLedgerEntry.upsert({
        where: {
          organizationId_sourceKey: {
            organizationId,
            sourceKey: `targeted-demo:2026:${targetEmployee.id}:${allocation.code}`,
          },
        },
        create: {
          organizationId,
          employeeId: targetEmployee.id,
          leaveTypeId: leaveTypes.get(allocation.code)!,
          entryType: LeaveLedgerEntryType.ALLOCATION,
          units: allocation.units,
          effectiveDate: date('2026-01-01'),
          sourceKey: `targeted-demo:2026:${targetEmployee.id}:${allocation.code}`,
          note: '2026 opening allocation',
          createdById: actorUserId,
        },
        update: { units: allocation.units },
      });

    let approvedLeave = await tx.leaveRequest.findFirst({
      where: {
        organizationId,
        employeeId: targetEmployee.id,
        remarks: 'Targeted demo seed: personal day',
      },
    });
    if (!approvedLeave)
      approvedLeave = await tx.leaveRequest.create({
        data: {
          organizationId,
          employeeId: targetEmployee.id,
          leaveTypeId: leaveTypes.get('PTO')!,
          startDate: date('2026-08-14'),
          endDate: date('2026-08-14'),
          startSession: DaySession.FULL_DAY,
          endSession: DaySession.FULL_DAY,
          requestedUnits: 1,
          remarks: 'Targeted demo seed: personal day',
          status: LeaveRequestStatus.APPROVED,
          decisionComment: 'Approved sample request',
          requestedById: actorUserId,
          decidedById: actorUserId,
          decidedAt: instant('2026-08-10T07:00:00.000Z'),
          version: 2,
        },
      });
    await tx.leaveLedgerEntry.upsert({
      where: {
        organizationId_sourceKey: {
          organizationId,
          sourceKey: `targeted-demo:request:${approvedLeave.id}:debit`,
        },
      },
      create: {
        organizationId,
        employeeId: targetEmployee.id,
        leaveTypeId: leaveTypes.get('PTO')!,
        requestId: approvedLeave.id,
        entryType: LeaveLedgerEntryType.DEBIT,
        units: -1,
        effectiveDate: date('2026-08-14'),
        sourceKey: `targeted-demo:request:${approvedLeave.id}:debit`,
        note: 'Approved personal day',
        createdById: actorUserId,
      },
      update: { units: -1 },
    });

    const attendanceDays = [
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
    ];
    for (const [index, day] of attendanceDays.entries()) {
      const checkIn = instant(
        `${day}T03:${index % 3 === 0 ? '35' : '40'}:00.000Z`,
      );
      const checkOut = instant(
        `${day}T12:${index % 2 === 0 ? '30' : '20'}:00.000Z`,
      );
      const netMinutes = index % 2 === 0 ? 505 : 490;
      await tx.attendanceRecord.upsert({
        where: {
          organizationId_employeeId_workDate: {
            organizationId,
            employeeId: targetEmployee.id,
            workDate: date(day),
          },
        },
        create: {
          organizationId,
          employeeId: targetEmployee.id,
          workDate: date(day),
          scheduleId: schedule.id,
          firstCheckIn: checkIn,
          lastCheckOut: checkOut,
          grossMinutes: netMinutes + 30,
          paidBreakMinutes: 30,
          netMinutes,
          overtimeMinutes: Math.max(netMinutes - 480, 0),
          payableUnits: 1,
          status: AttendanceStatus.PRESENT,
        },
        update: {
          scheduleId: schedule.id,
          firstCheckIn: checkIn,
          lastCheckOut: checkOut,
          grossMinutes: netMinutes + 30,
          paidBreakMinutes: 30,
          netMinutes,
          overtimeMinutes: Math.max(netMinutes - 480, 0),
          payableUnits: 1,
          status: AttendanceStatus.PRESENT,
        },
      });
    }
    await tx.attendanceRecord.upsert({
      where: {
        organizationId_employeeId_workDate: {
          organizationId,
          employeeId: targetEmployee.id,
          workDate: date('2026-08-14'),
        },
      },
      create: {
        organizationId,
        employeeId: targetEmployee.id,
        workDate: date('2026-08-14'),
        scheduleId: schedule.id,
        payableUnits: 1,
        status: AttendanceStatus.LEAVE,
      },
      update: {
        scheduleId: schedule.id,
        payableUnits: 1,
        status: AttendanceStatus.LEAVE,
      },
    });

    const correctionRecord = await tx.attendanceRecord.upsert({
      where: {
        organizationId_employeeId_workDate: {
          organizationId,
          employeeId: colleagues[1].id,
          workDate: date('2026-08-20'),
        },
      },
      create: {
        organizationId,
        employeeId: colleagues[1].id,
        workDate: date('2026-08-20'),
        scheduleId: schedule.id,
        firstCheckIn: instant('2026-08-20T03:45:00.000Z'),
        netMinutes: 0,
        status: AttendanceStatus.INCOMPLETE,
      },
      update: { status: AttendanceStatus.INCOMPLETE },
    });
    const existingCorrection = await tx.attendanceCorrection.findFirst({
      where: {
        organizationId,
        attendanceRecordId: correctionRecord.id,
        reason: 'Targeted demo seed: forgot to clock out',
      },
    });
    if (!existingCorrection)
      await tx.attendanceCorrection.create({
        data: {
          organizationId,
          attendanceRecordId: correctionRecord.id,
          employeeId: colleagues[1].id,
          requestedCheckIn: instant('2026-08-20T03:45:00.000Z'),
          requestedCheckOut: instant('2026-08-20T12:30:00.000Z'),
          reason: 'Targeted demo seed: forgot to clock out',
          status: AttendanceCorrectionStatus.PENDING,
          requestedById: actorUserId,
        },
      });

    const existingPendingLeave = await tx.leaveRequest.findFirst({
      where: {
        organizationId,
        employeeId: colleagues[2].id,
        remarks: 'Targeted demo seed: family event',
      },
    });
    if (!existingPendingLeave)
      await tx.leaveRequest.create({
        data: {
          organizationId,
          employeeId: colleagues[2].id,
          leaveTypeId: leaveTypes.get('PTO')!,
          startDate: date('2026-09-07'),
          endDate: date('2026-09-08'),
          requestedUnits: 2,
          remarks: 'Targeted demo seed: family event',
          status: LeaveRequestStatus.PENDING,
          requestedById: actorUserId,
        },
      });

    const salaryStructure = await tx.salaryStructure.upsert({
      where: {
        organizationId_code_version: {
          organizationId,
          code: 'INDIA_STANDARD',
          version: 1,
        },
      },
      create: {
        organizationId,
        code: 'INDIA_STANDARD',
        name: 'India Standard',
        currency: 'INR',
        effectiveFrom: date('2026-01-01'),
        version: 1,
      },
      update: { active: true },
    });
    for (const component of [
      {
        code: 'BASIC',
        name: 'Basic Salary',
        componentType: SalaryComponentType.EARNING,
        calculationMode: SalaryCalculationMode.PERCENTAGE,
        basis: SalaryBasis.WAGE,
        value: 50,
        displayOrder: 10,
        taxable: true,
      },
      {
        code: 'HRA',
        name: 'House Rent Allowance',
        componentType: SalaryComponentType.EARNING,
        calculationMode: SalaryCalculationMode.PERCENTAGE,
        basis: SalaryBasis.BASIC,
        value: 50,
        displayOrder: 20,
        taxable: true,
      },
      {
        code: 'FIXED_ALLOWANCE',
        name: 'Fixed Allowance',
        componentType: SalaryComponentType.BALANCING,
        calculationMode: SalaryCalculationMode.FIXED,
        value: 0,
        displayOrder: 30,
        taxable: true,
      },
      {
        code: 'EMPLOYEE_PF',
        name: 'Employee PF',
        componentType: SalaryComponentType.DEDUCTION,
        calculationMode: SalaryCalculationMode.PERCENTAGE,
        basis: SalaryBasis.BASIC,
        value: 12,
        displayOrder: 40,
        taxable: false,
      },
      {
        code: 'PROFESSIONAL_TAX',
        name: 'Professional Tax',
        componentType: SalaryComponentType.DEDUCTION,
        calculationMode: SalaryCalculationMode.FIXED,
        value: 200,
        displayOrder: 50,
        taxable: false,
      },
      {
        code: 'EMPLOYER_PF',
        name: 'Employer PF',
        componentType: SalaryComponentType.EMPLOYER_CONTRIBUTION,
        calculationMode: SalaryCalculationMode.PERCENTAGE,
        basis: SalaryBasis.BASIC,
        value: 12,
        displayOrder: 60,
        taxable: false,
      },
    ])
      await tx.salaryComponent.upsert({
        where: {
          structureId_code: {
            structureId: salaryStructure.id,
            code: component.code,
          },
        },
        create: { structureId: salaryStructure.id, ...component },
        update: component,
      });

    let salaryAssignment = await tx.salaryAssignment.findFirst({
      where: {
        organizationId,
        employeeId: targetEmployee.id,
        status: SalaryAssignmentStatus.ACTIVE,
        effectiveTo: null,
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!salaryAssignment)
      salaryAssignment = await tx.salaryAssignment.create({
        data: {
          organizationId,
          employeeId: targetEmployee.id,
          structureId: salaryStructure.id,
          monthlyWage: 50000,
          workingDaysPerWeek: 5,
          breakMinutes: 30,
          currency: 'INR',
          effectiveFrom: date('2026-01-01'),
        },
      });

    const wage = Number(salaryAssignment.monthlyWage);
    const basic = money(wage * 0.5);
    const hra = money(basic * 0.5);
    const allowance = money(wage - basic - hra);
    const employeePf = money(basic * 0.12);
    const employerPf = money(basic * 0.12);
    const professionalTax = 200;
    const deductions = money(employeePf + professionalTax);
    const netPay = money(wage - deductions);
    const payrollPeriod = await tx.payrollPeriod.upsert({
      where: {
        organizationId_startDate_endDate: {
          organizationId,
          startDate: date('2026-07-01'),
          endDate: date('2026-07-31'),
        },
      },
      create: {
        organizationId,
        name: 'July 2026',
        startDate: date('2026-07-01'),
        endDate: date('2026-07-31'),
        cutoffAt: instant('2026-08-01T12:00:00.000Z'),
        status: PayrollPeriodStatus.FINALIZED,
        calculatedAt: instant('2026-08-01T12:05:00.000Z'),
        reviewedAt: instant('2026-08-01T12:10:00.000Z'),
        finalizedAt: instant('2026-08-01T12:15:00.000Z'),
        finalizedById: actorUserId,
        version: 4,
      },
      update: {},
    });
    await tx.payrollRecord.upsert({
      where: {
        payrollPeriodId_employeeId: {
          payrollPeriodId: payrollPeriod.id,
          employeeId: targetEmployee.id,
        },
      },
      create: {
        organizationId,
        payrollPeriodId: payrollPeriod.id,
        employeeId: targetEmployee.id,
        salaryAssignmentId: salaryAssignment.id,
        scheduledUnits: 23,
        payableUnits: 23,
        unpaidUnits: 0,
        grossEarnings: wage,
        deductions,
        employerContributions: employerPf,
        netPay,
        componentsSnapshot: [
          { code: 'BASIC', amount: basic.toFixed(2) },
          { code: 'HRA', amount: hra.toFixed(2) },
          { code: 'FIXED_ALLOWANCE', amount: allowance.toFixed(2) },
          { code: 'EMPLOYEE_PF', amount: employeePf.toFixed(2) },
          { code: 'PROFESSIONAL_TAX', amount: professionalTax.toFixed(2) },
          { code: 'EMPLOYER_PF', amount: employerPf.toFixed(2) },
        ],
        inputsSnapshot: {
          monthlyWage: wage.toFixed(2),
          scheduledUnits: 23,
          payableUnits: 23,
          currency: salaryAssignment.currency,
        },
        exceptions: [],
        finalizedAt: instant('2026-08-01T12:15:00.000Z'),
      },
      update: {
        salaryAssignmentId: salaryAssignment.id,
        grossEarnings: wage,
        deductions,
        employerContributions: employerPf,
        netPay,
      },
    });

    const seedAudit = await tx.auditEvent.findFirst({
      where: {
        organizationId,
        actorUserId,
        action: 'development.targeted_seed.completed',
        resourceType: 'Organization',
        resourceId: organizationId,
      },
    });
    if (!seedAudit)
      await tx.auditEvent.create({
        data: {
          organizationId,
          actorUserId,
          action: 'development.targeted_seed.completed',
          resourceType: 'Organization',
          resourceId: organizationId,
          context: { targetEmail },
        },
      });

    return {
      organization: target.organization.displayName,
      employee: `${targetEmployee.firstName} ${targetEmployee.lastName}`,
      colleagues: colleagues.length,
      attendanceRecords: attendanceDays.length + 1,
      leaveBalance: { PTO: 23, SICK: 7 },
      finalizedPayroll: {
        period: payrollPeriod.name,
        gross: wage.toFixed(2),
        net: netPay.toFixed(2),
      },
    };
  });

  console.log(JSON.stringify(result, null, 2));
}

void main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
