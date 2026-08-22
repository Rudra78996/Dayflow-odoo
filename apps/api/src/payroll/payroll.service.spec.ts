import { ConflictException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { PayrollPeriodStatus, RoleCode } from '../generated/prisma/client';
import { PayrollService } from './payroll.service';

describe('PayrollService lifecycle', () => {
  const user: AuthUser = {
    userId: '10000000-0000-4000-8000-000000000001',
    organizationId: '20000000-0000-4000-8000-000000000001',
    employeeId: '30000000-0000-4000-8000-000000000001',
    roles: [RoleCode.ADMIN],
    sessionId: '40000000-0000-4000-8000-000000000001',
  };

  it('does not allow a calculated run to skip the reviewed state', async () => {
    const transactionClient = {
      $executeRaw: jest.fn((): Promise<number> => Promise.resolve(1)),
      payrollPeriod: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: '50000000-0000-4000-8000-000000000001',
            status: PayrollPeriodStatus.CALCULATED,
            version: 2,
            records: [],
          }),
        ),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (
          operation: (client: typeof transactionClient) => Promise<unknown>,
        ) => operation(transactionClient),
      ),
    };
    const service = new PayrollService(prisma as never);

    await expect(
      service.finalize(user, '50000000-0000-4000-8000-000000000001', {
        version: 2,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
