import { SetMetadata } from '@nestjs/common';
import { RoleCode } from '../generated/prisma/client';

export const ROLES_KEY = 'dayflow_roles';
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);
