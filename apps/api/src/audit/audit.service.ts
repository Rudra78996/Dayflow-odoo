import { Injectable } from '@nestjs/common';
import { AuditResult, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface AuditWrite {
  organizationId: string;
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  result?: AuditResult;
  changes?: Prisma.InputJsonValue;
  context?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  write(event: AuditWrite) {
    return this.prisma.auditEvent.create({
      data: {
        ...event,
        result: event.result ?? AuditResult.SUCCESS,
      },
    });
  }
}
