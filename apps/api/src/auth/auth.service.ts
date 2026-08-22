import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { argon2id, hash, verify } from 'argon2';
import { randomUUID } from 'node:crypto';
import {
  EmploymentStatus,
  RoleCode,
  TokenPurpose,
  UserStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  ActivateAccountDto,
  ChangePasswordDto,
  CompanySignUpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SignInDto,
} from './auth.dto';
import { AuthUser } from './auth-user';
import { EmailService } from '../notifications/email.service';
import {
  buildLoginId,
  createOpaqueToken,
  hashOpaqueToken,
  normalizeEmail,
  slugify,
  splitFullName,
} from './auth.utils';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  private passwordHash(password: string) {
    return hash(password, {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  private developmentToken(token: string) {
    return this.config.get('NODE_ENV', 'development') === 'production'
      ? undefined
      : token;
  }

  private async accessToken(input: {
    userId: string;
    organizationId: string;
    sessionId: string;
  }) {
    return this.jwt.signAsync(
      {
        sub: input.userId,
        organizationId: input.organizationId,
        sessionId: input.sessionId,
      },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
  }

  private async newSession(
    user: {
      id: string;
      organizationId: string;
      roles: { role: { code: RoleCode } }[];
      employee?: { id: string } | null;
    },
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    const refreshToken = createOpaqueToken();
    const refreshDays = Number(this.config.get('REFRESH_TOKEN_TTL_DAYS', 30));
    const expiresAt = new Date(Date.now() + refreshDays * 86_400_000);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashOpaqueToken(refreshToken),
        familyId: randomUUID(),
        expiresAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent?.slice(0, 500),
      },
    });

    return {
      accessToken: await this.accessToken({
        userId: user.id,
        organizationId: user.organizationId,
        sessionId: session.id,
      }),
      refreshToken,
      expiresAt,
      user: {
        id: user.id,
        organizationId: user.organizationId,
        employeeId: user.employee?.id,
        roles: user.roles.map((item) => item.role.code),
      },
    };
  }

  async companySignUp(dto: CompanySignUpDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_MISMATCH',
        message: 'Password confirmation does not match.',
      });
    }

    const emailNormalized = normalizeEmail(dto.email);
    const companyPrefix = dto.companyPrefix.toUpperCase();
    const existing = await this.prisma.organization.findFirst({
      where: {
        OR: [{ companyPrefix }, { users: { some: { emailNormalized } } }],
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'AUTH_COMPANY_OR_EMAIL_EXISTS',
        message: 'A company or account already uses these details.',
      });
    }

    const passwordHash = await this.passwordHash(dto.password);
    const verificationToken = createOpaqueToken();
    const { firstName, lastName } = splitFullName(dto.adminName);
    const joiningYear = new Date().getUTCFullYear();
    const loginId = buildLoginId({
      companyPrefix,
      firstName,
      lastName,
      joiningYear,
      sequence: 1,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          legalName: dto.companyName.trim(),
          displayName: dto.companyName.trim(),
          slug:
            slugify(dto.companyName) +
            '-' +
            createOpaqueToken().slice(0, 6).toLowerCase(),
          companyPrefix,
        },
      });

      await tx.role.createMany({
        data: [
          {
            organizationId: organization.id,
            code: RoleCode.ADMIN,
            name: 'Admin',
          },
          {
            organizationId: organization.id,
            code: RoleCode.HR_OFFICER,
            name: 'HR Officer',
          },
          {
            organizationId: organization.id,
            code: RoleCode.EMPLOYEE,
            name: 'Employee',
          },
        ],
      });
      const adminRole = await tx.role.findUniqueOrThrow({
        where: {
          organizationId_code: {
            organizationId: organization.id,
            code: RoleCode.ADMIN,
          },
        },
      });
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: dto.email.trim(),
          emailNormalized,
          passwordHash,
          status: UserStatus.INVITED,
          roles: { create: { roleId: adminRole.id } },
        },
      });
      const employee = await tx.employee.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          loginId,
          employeeCode: loginId,
          firstName,
          lastName,
          preferredName: firstName,
          workEmail: dto.email.trim(),
          workPhone: dto.phone,
          jobTitle: 'Administrator',
          dateOfJoining: new Date(
            Date.UTC(
              joiningYear,
              new Date().getUTCMonth(),
              new Date().getUTCDate(),
            ),
          ),
          employmentStatus: EmploymentStatus.ACTIVE,
          privateProfile: { create: { organizationId: organization.id } },
          resume: { create: {} },
        },
      });
      const effectiveToday = new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate(),
        ),
      );
      const schedule = await tx.workSchedule.create({
        data: {
          organizationId: organization.id,
          name: 'Standard work week',
          timezone: organization.timezone,
          workingWeekdays: [1, 2, 3, 4, 5],
          shiftStartMinutes: 540,
          shiftEndMinutes: 1080,
          paidBreakMinutes: 30,
          graceMinutes: 15,
          halfDayMinutes: 240,
          fullDayMinutes: 480,
          overtimeAfterMinutes: 480,
          effectiveFrom: effectiveToday,
        },
      });
      await tx.workScheduleAssignment.create({
        data: {
          organizationId: organization.id,
          employeeId: employee.id,
          scheduleId: schedule.id,
          effectiveFrom: effectiveToday,
        },
      });
      const defaultLeaveTypes = [
        {
          code: 'PTO',
          name: 'Paid Time Off',
          paid: true,
          color: '#16867A',
          annualEntitlement: 24,
        },
        {
          code: 'SICK',
          name: 'Sick Leave',
          paid: true,
          color: '#7C5AA6',
          annualEntitlement: 7,
        },
        {
          code: 'UNPAID',
          name: 'Unpaid Leave',
          paid: false,
          color: '#C47B36',
          annualEntitlement: 0,
          allowNegative: true,
        },
      ];
      for (const leave of defaultLeaveTypes) {
        const leaveType = await tx.leaveType.create({
          data: {
            organizationId: organization.id,
            code: leave.code,
            name: leave.name,
            paid: leave.paid,
            color: leave.color,
            allowNegative: leave.allowNegative ?? false,
          },
        });
        await tx.leavePolicy.create({
          data: {
            organizationId: organization.id,
            leaveTypeId: leaveType.id,
            name: `${leave.name} default`,
            annualEntitlement: leave.annualEntitlement,
            effectiveFrom: effectiveToday,
          },
        });
        if (leave.annualEntitlement > 0) {
          await tx.leaveLedgerEntry.create({
            data: {
              organizationId: organization.id,
              employeeId: employee.id,
              leaveTypeId: leaveType.id,
              entryType: 'ALLOCATION',
              units: leave.annualEntitlement,
              effectiveDate: effectiveToday,
              expiresAt: new Date(Date.UTC(joiningYear, 11, 31)),
              sourceKey: `onboarding:${employee.id}:${leave.code}:${joiningYear}`,
              note: 'Initial annual entitlement',
              createdById: user.id,
            },
          });
        }
      }
      await tx.organizationSequence.create({
        data: {
          organizationId: organization.id,
          sequenceType: 'EMPLOYEE_LOGIN_ID',
          year: joiningYear,
          nextValue: 2,
        },
      });
      await tx.verificationToken.create({
        data: {
          userId: user.id,
          purpose: TokenPurpose.VERIFY_EMAIL,
          tokenHash: hashOpaqueToken(verificationToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: organization.id,
          actorUserId: user.id,
          action: 'organization.created',
          resourceType: 'Organization',
          resourceId: organization.id,
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: organization.id,
          aggregateType: 'User',
          aggregateId: user.id,
          eventType: 'auth.verification.requested',
          payload: { email: dto.email.trim() },
        },
      });
      return { organization, user, employee };
    });

    const delivery = await this.email.sendAdministratorVerification({
      to: result.user.email,
      administratorName: dto.adminName.trim(),
      companyName: result.organization.displayName,
      token: verificationToken,
    });

    return {
      organizationId: result.organization.id,
      email: result.user.email,
      loginId: result.employee.loginId,
      verificationRequired: true,
      emailDelivery: delivery.status,
      emailError: delivery.reason,
      developmentToken:
        delivery.status === 'sent'
          ? undefined
          : this.developmentToken(verificationToken),
    };
  }

  async verifyEmail(token: string) {
    const tokenHash = hashOpaqueToken(token);
    const record = await this.prisma.verificationToken.findFirst({
      where: {
        tokenHash,
        purpose: TokenPurpose.VERIFY_EMAIL,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) {
      throw new BadRequestException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'This verification link is invalid or expired.',
      });
    }
    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
    ]);
    return { verified: true };
  }

  async activateAccount(dto: ActivateAccountDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_MISMATCH',
        message: 'Password confirmation does not match.',
      });
    }
    const record = await this.prisma.verificationToken.findFirst({
      where: {
        tokenHash: hashOpaqueToken(dto.token),
        purpose: TokenPurpose.ACTIVATE_ACCOUNT,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) {
      throw new BadRequestException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'This activation link is invalid or expired.',
      });
    }
    const passwordHash = await this.passwordHash(dto.password);
    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          passwordChangedAt: new Date(),
        },
      }),
    ]);
    return { activated: true };
  }

  async signIn(
    dto: SignInDto,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    const identifier = dto.identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { emailNormalized: normalizeEmail(identifier) },
          { employee: { loginId: identifier.toUpperCase() } },
        ],
      },
      include: {
        roles: { include: { role: true } },
        employee: { select: { id: true } },
      },
    });

    if (
      !user?.passwordHash ||
      user.status !== UserStatus.ACTIVE ||
      !(await verify(user.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'The email, Login ID, or password is incorrect.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.newSession(user, metadata);
  }

  async refresh(
    rawToken: string | undefined,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    if (!rawToken) {
      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_REQUIRED',
        message: 'A refresh session is required.',
      });
    }
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashOpaqueToken(rawToken) },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
            employee: { select: { id: true } },
          },
        },
      },
    });
    if (session?.revokedAt) {
      await this.prisma.$transaction([
        this.prisma.session.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
        this.prisma.auditEvent.create({
          data: {
            organizationId: session.user.organizationId,
            actorUserId: session.userId,
            action: 'auth.refresh_reuse_detected',
            resourceType: 'Session',
            resourceId: session.id,
            result: 'DENIED',
          },
        }),
      ]);
      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_REUSE_DETECTED',
        message: 'Your session has expired. Sign in again.',
      });
    }
    if (
      !session ||
      session.expiresAt <= new Date() ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_INVALID',
        message: 'Your session has expired. Sign in again.',
      });
    }

    const nextRefresh = createOpaqueToken();
    const nextSession = await this.prisma.$transaction(async (tx) => {
      const rotated = await tx.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      });
      if (rotated.count !== 1) {
        throw new UnauthorizedException({
          code: 'AUTH_REFRESH_RACE_DETECTED',
          message: 'Your session has expired. Sign in again.',
        });
      }
      return tx.session.create({
        data: {
          userId: session.userId,
          tokenHash: hashOpaqueToken(nextRefresh),
          familyId: session.familyId,
          expiresAt: session.expiresAt,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent?.slice(0, 500),
        },
      });
    });
    return {
      accessToken: await this.accessToken({
        userId: session.user.id,
        organizationId: session.user.organizationId,
        sessionId: nextSession.id,
      }),
      refreshToken: nextRefresh,
      expiresAt: session.expiresAt,
      user: {
        id: session.user.id,
        organizationId: session.user.organizationId,
        employeeId: session.user.employee?.id,
        roles: session.user.roles.map((item) => item.role.code),
      },
    };
  }

  async signOut(user: AuthUser) {
    await this.prisma.session.updateMany({
      where: { id: user.sessionId, userId: user.userId },
      data: { revokedAt: new Date() },
    });
    return { signedOut: true };
  }

  async signOutAll(user: AuthUser) {
    const revoked = await this.prisma.session.updateMany({
      where: { userId: user.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.auditEvent.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.userId,
        action: 'auth.sessions_revoked',
        resourceType: 'User',
        resourceId: user.userId,
        changes: { revokedSessions: revoked.count },
      },
    });
    return { signedOut: true, revokedSessions: revoked.count };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailNormalized: normalizeEmail(dto.email),
        status: UserStatus.ACTIVE,
      },
    });
    if (!user) return { accepted: true };

    const token = createOpaqueToken();
    const [employee] = await Promise.all([
      this.prisma.employee.findUnique({
        where: { userId: user.id },
        select: { preferredName: true, firstName: true },
      }),
      this.prisma.verificationToken.create({
        data: {
          userId: user.id,
          purpose: TokenPurpose.RESET_PASSWORD,
          tokenHash: hashOpaqueToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      }),
    ]);
    const delivery = await this.email.sendPasswordReset({
      to: user.email,
      name: employee?.preferredName || employee?.firstName || 'there',
      token,
    });
    return {
      accepted: true,
      emailDelivery: delivery.status,
      emailError: delivery.reason,
      developmentToken:
        delivery.status === 'sent' ? undefined : this.developmentToken(token),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_MISMATCH',
        message: 'Password confirmation does not match.',
      });
    }
    const record = await this.prisma.verificationToken.findFirst({
      where: {
        tokenHash: hashOpaqueToken(dto.token),
        purpose: TokenPurpose.RESET_PASSWORD,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) {
      throw new BadRequestException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'This reset link is invalid or expired.',
      });
    }
    const passwordHash = await this.passwordHash(dto.password);
    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { reset: true };
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });
    if (
      !record.passwordHash ||
      !(await verify(record.passwordHash, dto.currentPassword))
    ) {
      throw new BadRequestException({
        code: 'AUTH_CURRENT_PASSWORD_INVALID',
        message: 'The current password is incorrect.',
      });
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.userId },
        data: {
          passwordHash: await this.passwordHash(dto.newPassword),
          passwordChangedAt: new Date(),
        },
      }),
      this.prisma.session.updateMany({
        where: {
          userId: user.userId,
          id: { not: user.sessionId },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { changed: true };
  }

  async me(user: AuthUser) {
    return this.prisma.user.findFirstOrThrow({
      where: {
        id: user.userId,
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        email: true,
        status: true,
        organization: {
          select: {
            id: true,
            displayName: true,
            timezone: true,
            currency: true,
          },
        },
        roles: { select: { role: { select: { code: true, name: true } } } },
        employee: {
          select: {
            id: true,
            loginId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            jobTitle: true,
          },
        },
      },
    });
  }
}
