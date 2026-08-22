import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmploymentStatus,
  Prisma,
  RoleCode,
  TokenPurpose,
  UserStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SensitiveDataService } from '../common/sensitive-data.service';
import { EmailService } from '../notifications/email.service';
import { AuthUser } from '../auth/auth-user';
import {
  buildLoginId,
  createOpaqueToken,
  hashOpaqueToken,
  normalizeEmail,
} from '../auth/auth.utils';
import {
  AddSkillDto,
  CreateCertificationDto,
  CreateEmployeeDto,
  EmployeeListQueryDto,
  UpdateBankDetailDto,
  UpdateEmployeeDto,
  UpdatePrivateProfileDto,
  UpdateResumeDto,
  UpdateStatutoryDetailDto,
} from './employees.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sensitiveData: SensitiveDataService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  private isAdmin(user: AuthUser) {
    return user.roles.includes(RoleCode.ADMIN);
  }

  private isHr(user: AuthUser) {
    return user.roles.includes(RoleCode.HR_OFFICER);
  }

  private isSelf(user: AuthUser, employeeId: string) {
    return user.employeeId === employeeId;
  }

  private ensurePrivateAccess(user: AuthUser, employeeId: string) {
    if (
      !this.isAdmin(user) &&
      !this.isHr(user) &&
      !this.isSelf(user, employeeId)
    ) {
      throw new ForbiddenException({
        code: 'EMPLOYEE_PRIVATE_ACCESS_DENIED',
        message: "You cannot access this employee's private information.",
      });
    }
  }

  private ensureRestrictedAccess(user: AuthUser, employeeId: string) {
    if (!this.isAdmin(user) && !this.isSelf(user, employeeId)) {
      throw new ForbiddenException({
        code: 'EMPLOYEE_RESTRICTED_ACCESS_DENIED',
        message: 'You cannot access this restricted employee information.',
      });
    }
  }

  private async requireEmployee(organizationId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, archivedAt: null },
      select: { id: true, organizationId: true },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found.',
      });
    }
    return employee;
  }

  async list(user: AuthUser, query: EmployeeListQueryDto) {
    const search = query.search?.trim();
    const today = new Date(
      `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
    );
    const where: Prisma.EmployeeWhereInput = {
      organizationId: user.organizationId,
      archivedAt: null,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { preferredName: { contains: search, mode: 'insensitive' } },
              { loginId: { contains: search, mode: 'insensitive' } },
              { employeeCode: { contains: search, mode: 'insensitive' } },
              { jobTitle: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          loginId: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          jobTitle: true,
          employmentStatus: true,
          avatarFileId: true,
          attendanceRecords: {
            where: { workDate: today },
            take: 1,
            select: { status: true },
          },
          assignments: {
            where: {
              primary: true,
              effectiveFrom: { lte: new Date() },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
            },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
            select: {
              department: { select: { id: true, name: true } },
              location: { select: { id: true, name: true } },
              manager: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  preferredName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async findSummary(user: AuthUser, employeeId: string) {
    await this.requireEmployee(user.organizationId, employeeId);
    return this.prisma.employee.findFirstOrThrow({
      where: { id: employeeId, organizationId: user.organizationId },
      select: {
        id: true,
        loginId: true,
        employeeCode: true,
        firstName: true,
        middleName: true,
        lastName: true,
        preferredName: true,
        workEmail: true,
        workPhone: true,
        jobTitle: true,
        dateOfJoining: true,
        employmentStatus: true,
        avatarFileId: true,
        version: true,
        assignments: {
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          select: {
            effectiveFrom: true,
            jobTitle: true,
            department: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                preferredName: true,
              },
            },
          },
        },
        resume: true,
        skills: {
          select: {
            proficiency: true,
            skill: { select: { id: true, name: true } },
          },
        },
        certifications: {
          select: {
            id: true,
            name: true,
            issuer: true,
            issuedAt: true,
            expiresAt: true,
            credentialId: true,
            credentialUrl: true,
            fileId: true,
          },
        },
        user: { select: { email: true, status: true } },
      },
    });
  }

  async create(user: AuthUser, dto: CreateEmployeeDto) {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException({
        code: 'EMPLOYEE_CREATE_DENIED',
        message: 'Only an Admin can create employee accounts.',
      });
    }
    if (dto.role === RoleCode.ADMIN) {
      throw new ForbiddenException({
        code: 'EMPLOYEE_ADMIN_GRANT_DENIED',
        message: 'Create additional Admin accounts through security settings.',
      });
    }
    const emailNormalized = normalizeEmail(dto.workEmail);
    const duplicate = await this.prisma.user.findFirst({
      where: { organizationId: user.organizationId, emailNormalized },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'EMPLOYEE_EMAIL_EXISTS',
        message: 'An account already uses this work email.',
      });
    }

    const [department, location, manager] = await Promise.all([
      dto.departmentId
        ? this.prisma.department.findFirst({
            where: {
              id: dto.departmentId,
              organizationId: user.organizationId,
              active: true,
            },
            select: { id: true },
          })
        : null,
      dto.locationId
        ? this.prisma.workLocation.findFirst({
            where: {
              id: dto.locationId,
              organizationId: user.organizationId,
              active: true,
            },
            select: { id: true },
          })
        : null,
      dto.managerId
        ? this.prisma.employee.findFirst({
            where: {
              id: dto.managerId,
              organizationId: user.organizationId,
              archivedAt: null,
            },
            select: { id: true },
          })
        : null,
    ]);
    if (dto.departmentId && !department) {
      throw new BadRequestException({
        code: 'EMPLOYEE_DEPARTMENT_INVALID',
        message: 'Select an active department from this organization.',
      });
    }
    if (dto.locationId && !location) {
      throw new BadRequestException({
        code: 'EMPLOYEE_LOCATION_INVALID',
        message: 'Select an active work location from this organization.',
      });
    }
    if (dto.managerId && !manager) {
      throw new BadRequestException({
        code: 'EMPLOYEE_MANAGER_INVALID',
        message: 'Select an active manager from this organization.',
      });
    }

    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      select: { companyPrefix: true },
    });
    const joiningDate = new Date(dto.dateOfJoining + 'T00:00:00.000Z');
    const joiningYear = joiningDate.getUTCFullYear();
    const activationToken = createOpaqueToken();
    const activationExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const sequence = await tx.organizationSequence.upsert({
        where: {
          organizationId_sequenceType_year: {
            organizationId: user.organizationId,
            sequenceType: 'EMPLOYEE_LOGIN_ID',
            year: joiningYear,
          },
        },
        create: {
          organizationId: user.organizationId,
          sequenceType: 'EMPLOYEE_LOGIN_ID',
          year: joiningYear,
          nextValue: 2,
        },
        update: { nextValue: { increment: 1 } },
      });
      const number = sequence.nextValue - 1;
      const loginId = buildLoginId({
        companyPrefix: organization.companyPrefix,
        firstName: dto.firstName,
        lastName: dto.lastName,
        joiningYear,
        sequence: number,
      });
      const role = await tx.role.findUniqueOrThrow({
        where: {
          organizationId_code: {
            organizationId: user.organizationId,
            code: dto.role,
          },
        },
      });
      const account = await tx.user.create({
        data: {
          organizationId: user.organizationId,
          email: dto.workEmail.trim(),
          emailNormalized,
          status: UserStatus.INVITED,
          roles: { create: { roleId: role.id, assignedBy: user.userId } },
        },
      });
      const employee = await tx.employee.create({
        data: {
          organizationId: user.organizationId,
          userId: account.id,
          loginId,
          employeeCode: loginId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          preferredName: dto.preferredName?.trim() || dto.firstName.trim(),
          workEmail: dto.workEmail.trim(),
          workPhone: dto.workPhone?.trim(),
          jobTitle: dto.jobTitle?.trim(),
          dateOfJoining: joiningDate,
          employmentStatus: EmploymentStatus.ACTIVE,
          privateProfile: { create: { organizationId: user.organizationId } },
          resume: { create: {} },
          assignments:
            dto.departmentId || dto.locationId || dto.managerId || dto.jobTitle
              ? {
                  create: {
                    organizationId: user.organizationId,
                    departmentId: dto.departmentId,
                    locationId: dto.locationId,
                    managerId: dto.managerId,
                    jobTitle: dto.jobTitle,
                    effectiveFrom: joiningDate,
                  },
                }
              : undefined,
        },
      });
      const defaultSchedule = await tx.workSchedule.findFirst({
        where: {
          organizationId: user.organizationId,
          active: true,
          effectiveFrom: { lte: joiningDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: joiningDate } }],
        },
        orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      });
      if (defaultSchedule) {
        await tx.workScheduleAssignment.create({
          data: {
            organizationId: user.organizationId,
            employeeId: employee.id,
            scheduleId: defaultSchedule.id,
            effectiveFrom: joiningDate,
          },
        });
      }
      const leavePolicies = await tx.leavePolicy.findMany({
        where: {
          organizationId: user.organizationId,
          active: true,
          effectiveFrom: { lte: joiningDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: joiningDate } }],
        },
        orderBy: [{ leaveTypeId: 'asc' }, { version: 'desc' }],
        distinct: ['leaveTypeId'],
      });
      const startOfYear = Date.UTC(joiningYear, 0, 1);
      const startOfNextYear = Date.UTC(joiningYear + 1, 0, 1);
      const remainingFraction =
        (startOfNextYear - joiningDate.getTime()) /
        (startOfNextYear - startOfYear);
      for (const policy of leavePolicies) {
        const annual = Number(policy.annualEntitlement);
        const units = policy.prorateJoining
          ? Math.round(annual * remainingFraction * 2) / 2
          : annual;
        if (units <= 0) continue;
        await tx.leaveLedgerEntry.create({
          data: {
            organizationId: user.organizationId,
            employeeId: employee.id,
            leaveTypeId: policy.leaveTypeId,
            entryType: 'ALLOCATION',
            units,
            effectiveDate: joiningDate,
            expiresAt: new Date(Date.UTC(joiningYear, 11, 31)),
            sourceKey: `onboarding:${employee.id}:${policy.id}:${joiningYear}`,
            note: policy.prorateJoining
              ? 'Prorated onboarding entitlement'
              : 'Onboarding entitlement',
            createdById: user.userId,
          },
        });
      }
      await tx.verificationToken.create({
        data: {
          userId: account.id,
          purpose: TokenPurpose.ACTIVATE_ACCOUNT,
          tokenHash: hashOpaqueToken(activationToken),
          expiresAt: activationExpiresAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'employee.created',
          resourceType: 'Employee',
          resourceId: employee.id,
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: user.organizationId,
          aggregateType: 'User',
          aggregateId: account.id,
          eventType: 'auth.activation.requested',
          payload: { email: account.email, employeeId: employee.id },
        },
      });
      return { employee, account };
    });

    const company = await this.prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      select: { displayName: true },
    });
    const delivery = await this.email.sendEmployeeActivation({
      to: result.account.email,
      employeeName: result.employee.preferredName || result.employee.firstName,
      companyName: company.displayName,
      loginId: result.employee.loginId,
      token: activationToken,
    });

    return {
      id: result.employee.id,
      loginId: result.employee.loginId,
      email: result.account.email,
      status: result.account.status,
      activationExpiresAt,
      emailDelivery: delivery.status,
      emailError: delivery.reason,
      developmentToken:
        delivery.status === 'sent' ||
        this.config.get('NODE_ENV', 'development') === 'production'
          ? undefined
          : activationToken,
    };
  }

  async resendActivation(user: AuthUser, employeeId: string) {
    if (!this.isAdmin(user))
      throw new ForbiddenException({
        code: 'EMPLOYEE_INVITATION_DENIED',
        message: 'Only an Admin can generate employee activation links.',
      });
    const activationToken = createOpaqueToken();
    const activationExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const result = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          id: employeeId,
          organizationId: user.organizationId,
          archivedAt: null,
        },
        select: {
          id: true,
          loginId: true,
          firstName: true,
          preferredName: true,
          user: { select: { id: true, email: true, status: true } },
        },
      });
      if (!employee?.user)
        throw new NotFoundException({
          code: 'EMPLOYEE_ACCOUNT_NOT_FOUND',
          message: 'This employee does not have a login account.',
        });
      if (employee.user.status !== UserStatus.INVITED)
        throw new ConflictException({
          code: 'EMPLOYEE_ACCOUNT_ALREADY_ACTIVATED',
          message: 'This employee account is already activated.',
        });
      await tx.verificationToken.updateMany({
        where: {
          userId: employee.user.id,
          purpose: TokenPurpose.ACTIVATE_ACCOUNT,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
      await tx.verificationToken.create({
        data: {
          userId: employee.user.id,
          purpose: TokenPurpose.ACTIVATE_ACCOUNT,
          tokenHash: hashOpaqueToken(activationToken),
          expiresAt: activationExpiresAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.userId,
          action: 'employee.activation_resent',
          resourceType: 'Employee',
          resourceId: employee.id,
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: user.organizationId,
          aggregateType: 'User',
          aggregateId: employee.user.id,
          eventType: 'auth.activation.requested',
          payload: {
            email: employee.user.email,
            employeeId: employee.id,
            expiresAt: activationExpiresAt.toISOString(),
          },
        },
      });
      return employee;
    });
    const company = await this.prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      select: { displayName: true },
    });
    const delivery = await this.email.sendEmployeeActivation({
      to: result.user!.email,
      employeeName: result.preferredName || result.firstName,
      companyName: company.displayName,
      loginId: result.loginId,
      token: activationToken,
    });
    return {
      id: result.id,
      loginId: result.loginId,
      email: result.user!.email,
      status: result.user!.status,
      activationExpiresAt,
      emailDelivery: delivery.status,
      emailError: delivery.reason,
      developmentToken:
        delivery.status === 'sent' ||
        this.config.get('NODE_ENV', 'development') === 'production'
          ? undefined
          : activationToken,
    };
  }

  async update(user: AuthUser, employeeId: string, dto: UpdateEmployeeDto) {
    if (
      !this.isAdmin(user) &&
      !this.isHr(user) &&
      !this.isSelf(user, employeeId)
    ) {
      throw new ForbiddenException({
        code: 'EMPLOYEE_UPDATE_DENIED',
        message: 'You cannot update this employee.',
      });
    }
    await this.requireEmployee(user.organizationId, employeeId);
    const safeData =
      this.isSelf(user, employeeId) && !this.isAdmin(user) && !this.isHr(user)
        ? {
            preferredName: dto.preferredName,
            workPhone: dto.workPhone,
            version: { increment: 1 },
          }
        : {
            preferredName: dto.preferredName,
            workPhone: dto.workPhone,
            jobTitle: dto.jobTitle,
            version: { increment: 1 },
          };
    const updated = await this.prisma.employee.updateMany({
      where: {
        id: employeeId,
        organizationId: user.organizationId,
        version: dto.version,
      },
      data: safeData,
    });
    if (updated.count !== 1) {
      throw new ConflictException({
        code: 'EMPLOYEE_VERSION_CONFLICT',
        message:
          'This profile changed after you opened it. Refresh and try again.',
      });
    }
    await this.prisma.auditEvent.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.userId,
        action: 'employee.updated',
        resourceType: 'Employee',
        resourceId: employeeId,
        changes: {
          fields: Object.keys(dto).filter((key) => key !== 'version'),
        },
      },
    });
    return this.findSummary(user, employeeId);
  }

  async getResume(user: AuthUser, employeeId: string) {
    await this.requireEmployee(user.organizationId, employeeId);
    return this.prisma.employeeResume.findUnique({
      where: { employeeId },
    });
  }

  async updateResume(user: AuthUser, employeeId: string, dto: UpdateResumeDto) {
    await this.requireEmployee(user.organizationId, employeeId);
    if (
      !this.isAdmin(user) &&
      !this.isHr(user) &&
      !this.isSelf(user, employeeId)
    ) {
      throw new ForbiddenException({
        code: 'EMPLOYEE_RESUME_UPDATE_DENIED',
        message: 'You cannot update this resume.',
      });
    }
    return this.prisma.employeeResume.upsert({
      where: { employeeId },
      create: { employeeId, ...dto },
      update: dto,
    });
  }

  async getPrivate(user: AuthUser, employeeId: string) {
    await this.requireEmployee(user.organizationId, employeeId);
    this.ensurePrivateAccess(user, employeeId);
    return this.prisma.employeePrivateProfile.findUnique({
      where: { employeeId },
    });
  }

  async updatePrivate(
    user: AuthUser,
    employeeId: string,
    dto: UpdatePrivateProfileDto,
  ) {
    await this.requireEmployee(user.organizationId, employeeId);
    this.ensurePrivateAccess(user, employeeId);
    const data: Prisma.EmployeePrivateProfileUncheckedCreateInput = {
      employeeId,
      organizationId: user.organizationId,
      ...dto,
      dateOfBirth: dto.dateOfBirth
        ? new Date(dto.dateOfBirth + 'T00:00:00.000Z')
        : undefined,
    };
    return this.prisma.employeePrivateProfile.upsert({
      where: { employeeId },
      create: data,
      update: {
        ...dto,
        dateOfBirth: data.dateOfBirth,
      },
    });
  }

  async getBank(user: AuthUser, employeeId: string) {
    await this.requireEmployee(user.organizationId, employeeId);
    this.ensureRestrictedAccess(user, employeeId);
    const detail = await this.prisma.employeeBankDetail.findUnique({
      where: { employeeId },
    });
    if (!detail) return null;
    return {
      accountHolderName: detail.accountHolderName,
      accountNumberMasked: detail.accountNumberLast4
        ? '•••• ' + detail.accountNumberLast4
        : null,
      bankName: detail.bankName,
      ifscMasked: detail.ifscEncrypted ? 'Configured' : null,
      updatedAt: detail.updatedAt,
    };
  }

  async updateBank(
    user: AuthUser,
    employeeId: string,
    dto: UpdateBankDetailDto,
  ) {
    await this.requireEmployee(user.organizationId, employeeId);
    this.ensureRestrictedAccess(user, employeeId);
    const accountNumber = dto.accountNumber?.replace(/\s+/g, '');
    const data = {
      accountHolderName: dto.accountHolderName,
      accountNumberEncrypted: accountNumber
        ? this.sensitiveData.encrypt(accountNumber)
        : undefined,
      accountNumberLast4: accountNumber?.slice(-4),
      bankName: dto.bankName,
      ifscEncrypted: dto.ifsc
        ? this.sensitiveData.encrypt(dto.ifsc.toUpperCase())
        : undefined,
    };
    await this.prisma.employeeBankDetail.upsert({
      where: { employeeId },
      create: {
        employeeId,
        organizationId: user.organizationId,
        ...data,
      },
      update: data,
    });
    return this.getBank(user, employeeId);
  }

  async getStatutory(user: AuthUser, employeeId: string) {
    await this.requireEmployee(user.organizationId, employeeId);
    this.ensureRestrictedAccess(user, employeeId);
    const detail = await this.prisma.employeeStatutoryDetail.findUnique({
      where: { employeeId },
    });
    if (!detail) return null;
    return {
      panMasked: detail.panLast4 ? '••••••' + detail.panLast4 : null,
      uanMasked: detail.uanLast4 ? '••••••••' + detail.uanLast4 : null,
      updatedAt: detail.updatedAt,
    };
  }

  async updateStatutory(
    user: AuthUser,
    employeeId: string,
    dto: UpdateStatutoryDetailDto,
  ) {
    await this.requireEmployee(user.organizationId, employeeId);
    this.ensureRestrictedAccess(user, employeeId);
    const pan = dto.pan?.toUpperCase();
    const uan = dto.uan;
    const data = {
      panEncrypted: pan ? this.sensitiveData.encrypt(pan) : undefined,
      panLast4: pan?.slice(-4),
      uanEncrypted: uan ? this.sensitiveData.encrypt(uan) : undefined,
      uanLast4: uan?.slice(-4),
    };
    await this.prisma.employeeStatutoryDetail.upsert({
      where: { employeeId },
      create: {
        employeeId,
        organizationId: user.organizationId,
        ...data,
      },
      update: data,
    });
    return this.getStatutory(user, employeeId);
  }

  async addSkill(user: AuthUser, employeeId: string, dto: AddSkillDto) {
    await this.requireEmployee(user.organizationId, employeeId);
    if (
      !this.isAdmin(user) &&
      !this.isHr(user) &&
      !this.isSelf(user, employeeId)
    ) {
      throw new ForbiddenException({
        code: 'EMPLOYEE_SKILL_UPDATE_DENIED',
        message: "You cannot update this employee's skills.",
      });
    }
    const normalizedName = dto.name.trim().toLowerCase();
    const skill = await this.prisma.skill.upsert({
      where: {
        organizationId_normalizedName: {
          organizationId: user.organizationId,
          normalizedName,
        },
      },
      create: {
        organizationId: user.organizationId,
        name: dto.name.trim(),
        normalizedName,
      },
      update: {},
    });
    return this.prisma.employeeSkill.upsert({
      where: { employeeId_skillId: { employeeId, skillId: skill.id } },
      create: {
        employeeId,
        skillId: skill.id,
        proficiency: dto.proficiency,
      },
      update: { proficiency: dto.proficiency },
      include: { skill: true },
    });
  }

  async addCertification(
    user: AuthUser,
    employeeId: string,
    dto: CreateCertificationDto,
  ) {
    await this.requireEmployee(user.organizationId, employeeId);
    if (
      !this.isAdmin(user) &&
      !this.isHr(user) &&
      !this.isSelf(user, employeeId)
    ) {
      throw new ForbiddenException({
        code: 'EMPLOYEE_CERTIFICATION_UPDATE_DENIED',
        message: "You cannot update this employee's certifications.",
      });
    }
    return this.prisma.certification.create({
      data: {
        organizationId: user.organizationId,
        employeeId,
        name: dto.name.trim(),
        issuer: dto.issuer?.trim(),
        issuedAt: dto.issuedAt
          ? new Date(dto.issuedAt + 'T00:00:00.000Z')
          : undefined,
        expiresAt: dto.expiresAt
          ? new Date(dto.expiresAt + 'T00:00:00.000Z')
          : undefined,
        credentialId: dto.credentialId,
        credentialUrl: dto.credentialUrl,
      },
    });
  }
}
