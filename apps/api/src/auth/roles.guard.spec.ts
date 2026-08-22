import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleCode } from '../generated/prisma/client';
import { RolesGuard } from './roles.guard';

function contextWithRoles(roles: RoleCode[]) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({ user: { roles } }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows a matching role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([RoleCode.ADMIN]),
    } as unknown as Reflector;
    expect(
      new RolesGuard(reflector).canActivate(contextWithRoles([RoleCode.ADMIN])),
    ).toBe(true);
  });

  it('denies a non-matching role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([RoleCode.ADMIN]),
    } as unknown as Reflector;
    expect(() =>
      new RolesGuard(reflector).canActivate(
        contextWithRoles([RoleCode.EMPLOYEE]),
      ),
    ).toThrow(ForbiddenException);
  });
});
