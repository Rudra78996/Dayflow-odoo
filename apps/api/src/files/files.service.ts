import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../database/prisma.service';
import {
  FileClassification,
  FileScanStatus,
  RoleCode,
} from '../generated/prisma/client';
import { CreateUploadIntentDto, FileScanResultDto } from './files.dto';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

@Injectable()
export class FilesService {
  private readonly client?: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.bucket = config.get('OBJECT_STORAGE_BUCKET', 'dayflow-development');
    const accessKeyId = config.get<string>('OBJECT_STORAGE_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>(
      'OBJECT_STORAGE_SECRET_ACCESS_KEY',
    );
    if (accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: config.get('OBJECT_STORAGE_REGION', 'auto'),
        endpoint: config.get<string>('OBJECT_STORAGE_ENDPOINT') || undefined,
        forcePathStyle: Boolean(config.get<string>('OBJECT_STORAGE_ENDPOINT')),
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  private canManageEmployeeFile(user: AuthUser, employeeId?: string) {
    if (!employeeId) {
      return (
        user.roles.includes(RoleCode.ADMIN) ||
        user.roles.includes(RoleCode.HR_OFFICER)
      );
    }
    return (
      user.employeeId === employeeId ||
      user.roles.includes(RoleCode.ADMIN) ||
      user.roles.includes(RoleCode.HR_OFFICER)
    );
  }

  async createUploadIntent(user: AuthUser, dto: CreateUploadIntentDto) {
    if (!ALLOWED_MIME_TYPES.has(dto.mimeType)) {
      throw new BadRequestException({
        code: 'FILE_TYPE_NOT_ALLOWED',
        message: 'Upload a PDF, JPEG, PNG, or WebP file.',
      });
    }
    if (!this.canManageEmployeeFile(user, dto.employeeId)) {
      throw new ForbiddenException({
        code: 'FILE_UPLOAD_DENIED',
        message: 'You cannot upload a file for this employee.',
      });
    }
    if (
      dto.classification === FileClassification.RESTRICTED &&
      dto.employeeId !== user.employeeId &&
      !user.roles.includes(RoleCode.ADMIN)
    ) {
      throw new ForbiddenException({
        code: 'FILE_RESTRICTED_UPLOAD_DENIED',
        message: 'Only the employee or an Admin can upload restricted files.',
      });
    }
    if (dto.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: {
          id: dto.employeeId,
          organizationId: user.organizationId,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (!employee) {
        throw new NotFoundException({
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Employee not found.',
        });
      }
    }

    const safeName = dto.originalName.replace(/[^a-zA-Z0-9._-]+/g, '-');
    const objectKey = [
      user.organizationId,
      dto.employeeId ?? 'organization',
      new Date().getUTCFullYear(),
      randomUUID(),
      safeName,
    ].join('/');
    const record = await this.prisma.fileObject.create({
      data: {
        organizationId: user.organizationId,
        employeeId: dto.employeeId,
        bucket: this.bucket,
        objectKey,
        originalName: dto.originalName,
        mimeType: dto.mimeType,
        sizeBytes: BigInt(dto.sizeBytes),
        checksumSha256: dto.checksumSha256,
        classification: dto.classification,
        scanStatus: FileScanStatus.PENDING_UPLOAD,
        createdById: user.userId,
      },
    });

    const uploadUrl = this.client
      ? await getSignedUrl(
          this.client,
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: objectKey,
            ContentType: dto.mimeType,
            ContentLength: dto.sizeBytes,
            ChecksumSHA256: Buffer.from(dto.checksumSha256, 'hex').toString(
              'base64',
            ),
            Metadata: {
              organization: user.organizationId,
              file: record.id,
            },
          }),
          { expiresIn: 300 },
        )
      : null;

    return {
      fileId: record.id,
      uploadUrl,
      expiresInSeconds: uploadUrl ? 300 : null,
      storageConfigured: Boolean(this.client),
      requiredHeaders: {
        'content-type': dto.mimeType,
        'x-amz-checksum-sha256': Buffer.from(
          dto.checksumSha256,
          'hex',
        ).toString('base64'),
      },
    };
  }

  async complete(user: AuthUser, fileId: string) {
    const file = await this.prisma.fileObject.findFirst({
      where: { id: fileId, organizationId: user.organizationId },
    });
    if (!file) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'File not found.',
      });
    }
    if (!this.canManageEmployeeFile(user, file.employeeId ?? undefined)) {
      throw new ForbiddenException({
        code: 'FILE_COMPLETE_DENIED',
        message: 'You cannot complete this upload.',
      });
    }
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_NOT_CONFIGURED',
        message: 'Object storage is not configured.',
      });
    }
    const object = await this.client.send(
      new HeadObjectCommand({ Bucket: file.bucket, Key: file.objectKey }),
    );
    if (
      object.ContentLength === undefined ||
      BigInt(object.ContentLength) !== file.sizeBytes ||
      object.ContentType !== file.mimeType
    ) {
      throw new BadRequestException({
        code: 'FILE_UPLOAD_MISMATCH',
        message: 'The uploaded object does not match the requested file.',
      });
    }
    const updated = await this.prisma.fileObject.update({
      where: { id: file.id },
      data: {
        scanStatus: FileScanStatus.PENDING_SCAN,
        uploadedAt: new Date(),
      },
    });
    return {
      id: updated.id,
      scanStatus: updated.scanStatus,
      message: 'Upload received and queued for security scanning.',
    };
  }

  async recordScanResult(
    fileId: string,
    suppliedSecret: string | undefined,
    dto: FileScanResultDto,
  ) {
    const expectedSecret = this.config.get<string>(
      'FILE_SCANNER_WEBHOOK_SECRET',
    );
    if (!expectedSecret || !suppliedSecret) {
      throw new ForbiddenException({
        code: 'FILE_SCANNER_AUTH_FAILED',
        message: 'Scanner authentication failed.',
      });
    }
    const expected = Buffer.from(expectedSecret);
    const supplied = Buffer.from(suppliedSecret);
    if (
      expected.length !== supplied.length ||
      !timingSafeEqual(expected, supplied)
    ) {
      throw new ForbiddenException({
        code: 'FILE_SCANNER_AUTH_FAILED',
        message: 'Scanner authentication failed.',
      });
    }
    if (
      dto.status !== FileScanStatus.CLEAN &&
      dto.status !== FileScanStatus.REJECTED
    ) {
      throw new BadRequestException({
        code: 'FILE_SCAN_STATUS_INVALID',
        message: 'A scanner may only mark a file clean or rejected.',
      });
    }
    const file = await this.prisma.fileObject.findUnique({
      where: { id: fileId },
    });
    if (!file) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'File not found.',
      });
    }
    if (file.scanStatus !== FileScanStatus.PENDING_SCAN) {
      throw new BadRequestException({
        code: 'FILE_SCAN_STATE_INVALID',
        message: 'This file is not awaiting a scan result.',
      });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.fileObject.update({
        where: { id: file.id },
        data: { scanStatus: dto.status },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: file.organizationId,
          action: 'file.scan_completed',
          resourceType: 'FileObject',
          resourceId: file.id,
          result: dto.status === FileScanStatus.CLEAN ? 'SUCCESS' : 'DENIED',
          context: dto.scannerReference
            ? { scannerReference: dto.scannerReference }
            : undefined,
        },
      });
      return record;
    });
    return { id: updated.id, scanStatus: updated.scanStatus };
  }

  async download(user: AuthUser, fileId: string) {
    const file = await this.prisma.fileObject.findFirst({
      where: { id: fileId, organizationId: user.organizationId },
    });
    if (!file) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'File not found.',
      });
    }
    if (!this.canManageEmployeeFile(user, file.employeeId ?? undefined)) {
      throw new ForbiddenException({
        code: 'FILE_DOWNLOAD_DENIED',
        message: 'You cannot download this file.',
      });
    }
    if (file.scanStatus !== FileScanStatus.CLEAN) {
      throw new BadRequestException({
        code: 'FILE_NOT_CLEAN',
        message:
          'This file is not available until security scanning completes.',
      });
    }
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_NOT_CONFIGURED',
        message: 'Object storage is not configured.',
      });
    }
    return {
      url: await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: file.bucket, Key: file.objectKey }),
        { expiresIn: 60 },
      ),
      expiresInSeconds: 60,
    };
  }
}
