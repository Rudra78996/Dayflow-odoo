import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../database/prisma.service';
import { UserStatus } from '../generated/prisma/client';
import { AuthUser } from './auth-user';

interface AccessTokenPayload {
  sub: string;
  organizationId: string;
  sessionId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: { cookies?: Record<string, string> }) =>
          request.cookies?.dayflow_access ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        organizationId: payload.organizationId,
        status: UserStatus.ACTIVE,
        sessions: {
          some: {
            id: payload.sessionId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      },
      include: {
        roles: { include: { role: true } },
        employee: { select: { id: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_SESSION_INVALID',
        message: 'Your session is no longer valid.',
      });
    }

    return {
      userId: user.id,
      organizationId: user.organizationId,
      employeeId: user.employee?.id,
      roles: user.roles.map((item) => item.role.code),
      sessionId: payload.sessionId,
    };
  }
}
