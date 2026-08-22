import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { RoleCode, TokenPurpose, UserStatus } from '../generated/prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { SensitiveDataService } from '../common/sensitive-data.service';
import { EmployeesService } from './employees.service';

describe('EmployeesService tenant isolation', () => {
  const user: AuthUser = {
    userId: '10000000-0000-4000-8000-000000000001',
    organizationId: '20000000-0000-4000-8000-000000000001',
    employeeId: '30000000-0000-4000-8000-000000000001',
    roles: [RoleCode.ADMIN],
    sessionId: '40000000-0000-4000-8000-000000000001',
  };

  it('returns not found when the employee is outside the active organization', async () => {
    let capturedQuery: unknown;
    const findFirst = jest.fn((query: unknown): Promise<null> => {
      capturedQuery = query;
      return Promise.resolve(null);
    });
    const employee = {
      findFirst,
      findFirstOrThrow: jest.fn(),
    };
    const prisma = { employee };
    const config = new ConfigService({
      DATA_ENCRYPTION_KEY: 'test-encryption-key-at-least-32-characters',
    });
    const service = new EmployeesService(
      prisma as never,
      new SensitiveDataService(config),
      config,
      { sendEmployeeActivation: jest.fn() } as never,
    );

    await expect(
      service.findSummary(user, '50000000-0000-4000-8000-000000000001'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(employee.findFirst).toHaveBeenCalledTimes(1);
    expect(capturedQuery).toMatchObject({
      where: {
        organizationId: user.organizationId,
      },
    });
    expect(employee.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it('invalidates prior activation tokens before issuing a fresh invitation', async () => {
    const employeeId = '50000000-0000-4000-8000-000000000001';
    const invitedUserId = '60000000-0000-4000-8000-000000000001';
    const updateMany = jest.fn((input: unknown) =>
      Promise.resolve({ input, count: 1 }),
    );
    const createToken = jest.fn((input: unknown) =>
      Promise.resolve({ input, id: 'token-id' }),
    );
    const transaction = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: employeeId,
          loginId: 'DFTEUS20260002',
          firstName: 'Riya',
          preferredName: 'Riya',
          user: {
            id: invitedUserId,
            email: 'employee@example.com',
            status: UserStatus.INVITED,
          },
        }),
      },
      verificationToken: {
        updateMany,
        create: createToken,
      },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
      outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-id' }) },
    };
    const prisma = {
      organization: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ displayName: 'Dayflow Test' }),
      },
      $transaction: jest.fn(
        (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    };
    const config = new ConfigService({
      NODE_ENV: 'development',
      DATA_ENCRYPTION_KEY: 'test-encryption-key-at-least-32-characters',
    });
    const service = new EmployeesService(
      prisma as never,
      new SensitiveDataService(config),
      config,
      {
        sendEmployeeActivation: jest
          .fn()
          .mockResolvedValue({ status: 'console' }),
      } as never,
    );

    const result = await service.resendActivation(user, employeeId);

    expect(result).toMatchObject({
      id: employeeId,
      loginId: 'DFTEUS20260002',
      email: 'employee@example.com',
      status: UserStatus.INVITED,
    });
    expect(result.developmentToken).toHaveLength(43);
    const updateInput = updateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: { consumedAt: Date };
    };
    expect(updateInput.where).toEqual({
      userId: invitedUserId,
      purpose: TokenPurpose.ACTIVATE_ACCOUNT,
      consumedAt: null,
    });
    expect(updateInput.data.consumedAt).toBeInstanceOf(Date);
    const createInput = createToken.mock.calls[0]?.[0] as {
      data: {
        userId: string;
        purpose: TokenPurpose;
        tokenHash: string;
        expiresAt: Date;
      };
    };
    expect(createInput.data.userId).toBe(invitedUserId);
    expect(createInput.data.purpose).toBe(TokenPurpose.ACTIVATE_ACCOUNT);
    expect(createInput.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createInput.data.expiresAt).toBeInstanceOf(Date);
  });
});
