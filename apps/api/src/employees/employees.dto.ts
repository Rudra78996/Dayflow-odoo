import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Gender, MaritalStatus, RoleCode } from '../generated/prisma/client';

export class EmployeeListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 24;
}

export class CreateEmployeeDto {
  @ApiProperty()
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredName?: string;

  @ApiProperty()
  @IsEmail()
  workEmail!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  workPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @ApiProperty({ example: '2026-08-22' })
  @IsDateString()
  dateOfJoining!: string;

  @ApiPropertyOptional({ enum: [RoleCode.EMPLOYEE, RoleCode.HR_OFFICER] })
  @IsOptional()
  @IsEnum(RoleCode)
  role: RoleCode = RoleCode.EMPLOYEE;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;
}

export class UpdateEmployeeDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  workPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;
}

export class UpdateResumeDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  about?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  jobLove?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  interests?: string;
}

export class UpdatePrivateProfileDto {
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsObject()
  residentialAddress?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @IsOptional()
  @IsEmail()
  personalEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  personalPhone?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;
}

export class UpdateBankDetailDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  accountHolderName?: string;

  @IsOptional()
  @IsString()
  @Length(6, 34)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankName?: string;

  @IsOptional()
  @IsString()
  @Length(6, 20)
  ifsc?: string;
}

export class UpdateStatutoryDetailDto {
  @IsOptional()
  @IsString()
  @Length(10, 10)
  pan?: string;

  @IsOptional()
  @IsString()
  @Length(12, 12)
  uan?: string;
}

export class AddSkillDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  proficiency?: number;
}

export class CreateCertificationDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  issuer?: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  credentialId?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  credentialUrl?: string;
}
