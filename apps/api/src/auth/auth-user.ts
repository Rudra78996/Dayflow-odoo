import { RoleCode } from '../generated/prisma/client';

export interface AuthUser {
  userId: string;
  organizationId: string;
  employeeId?: string;
  roles: RoleCode[];
  sessionId: string;
}
