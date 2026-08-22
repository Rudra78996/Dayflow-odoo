import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient, RoleCode } from '../generated/prisma/client';

config({ path: resolve(process.cwd(), '../../.env') });

const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL or DIRECT_URL is required to seed Dayflow.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const organizationId = '00000000-0000-4000-8000-000000000001';
  await prisma.$transaction(async (tx) => {
    await tx.organization.upsert({
      where: { id: organizationId },
      create: {
        id: organizationId,
        legalName: 'Dayflow Demo Organization',
        displayName: 'Dayflow Demo',
        slug: 'dayflow-demo',
        companyPrefix: 'DF',
      },
      update: {},
    });
    const roles: Array<{ code: RoleCode; name: string }> = [
      { code: RoleCode.ADMIN, name: 'Admin' },
      { code: RoleCode.HR_OFFICER, name: 'HR Officer' },
      { code: RoleCode.EMPLOYEE, name: 'Employee' },
    ];
    await Promise.all(
      roles.map(({ code, name }) =>
        tx.role.upsert({
          where: { organizationId_code: { organizationId, code } },
          create: { organizationId, code, name },
          update: { name },
        }),
      ),
    );
    await tx.department.upsert({
      where: { organizationId_code: { organizationId, code: 'PEOPLE' } },
      create: {
        organizationId,
        code: 'PEOPLE',
        name: 'People Operations',
      },
      update: {},
    });
    await tx.workLocation.upsert({
      where: { organizationId_name: { organizationId, name: 'Bengaluru' } },
      create: {
        organizationId,
        name: 'Bengaluru',
        timezone: 'Asia/Kolkata',
      },
      update: {},
    });
    await tx.workSchedule.upsert({
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
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      },
      update: {},
    });
    const leaveDefaults = [
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
    for (const leave of leaveDefaults) {
      const leaveType = await tx.leaveType.upsert({
        where: {
          organizationId_code: { organizationId, code: leave.code },
        },
        create: {
          organizationId,
          code: leave.code,
          name: leave.name,
          paid: leave.paid,
          color: leave.color,
          attachmentAfterUnits: leave.attachmentAfterUnits,
          allowNegative: leave.allowNegative ?? false,
        },
        update: {},
      });
      await tx.leavePolicy.upsert({
        where: {
          organizationId_leaveTypeId_name_version: {
            organizationId,
            leaveTypeId: leaveType.id,
            name: `${leave.name} default`,
            version: 1,
          },
        },
        create: {
          organizationId,
          leaveTypeId: leaveType.id,
          name: `${leave.name} default`,
          annualEntitlement: leave.entitlement,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        },
        update: {},
      });
    }
  });
}

void main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
