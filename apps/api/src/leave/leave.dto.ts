import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DaySession, LeaveAccrualFrequency } from '../generated/prisma/client';

export class CreateLeaveTypeDto {
  @IsString() @Length(2, 40) code!: string;
  @IsString() @Length(1, 120) name!: string;
  @IsBoolean() paid!: boolean;
  @IsString() @Length(4, 20) color!: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  attachmentAfterUnits?: number;
  @IsOptional() @IsBoolean() halfDaySupported = true;
  @IsOptional() @IsBoolean() approvalRequired = true;
  @IsOptional() @IsBoolean() allowNegative = false;
}
export class UpdateLeaveTypeDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsString() @Length(4, 20) color?: string;
  @IsOptional() @IsBoolean() paid?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() allowNegative?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  attachmentAfterUnits?: number;
}
export class CreateLeavePolicyDto {
  @IsUUID() leaveTypeId!: string;
  @IsString() @Length(1, 120) name!: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  annualEntitlement!: number;
  @IsOptional()
  @IsEnum(LeaveAccrualFrequency)
  accrualFrequency: LeaveAccrualFrequency = LeaveAccrualFrequency.ANNUAL;
  @IsOptional() @IsBoolean() carryForward = false;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  carryForwardCap?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  carryForwardExpiryMonths?: number;
  @IsOptional() @IsBoolean() prorateJoining = true;
  @IsOptional() @IsBoolean() excludeWeekends = true;
  @IsOptional() @IsBoolean() excludeHolidays = true;
  @IsOptional() @IsBoolean() cancellationAllowed = true;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}
export class RunLeaveAccrualDto {
  @IsDateString() asOf!: string;
}
export class CreateAllocationDto {
  @IsUUID() employeeId!: string;
  @IsUUID() leaveTypeId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) units!: number;
  @IsDateString() effectiveDate!: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsString() @Length(8, 120) idempotencyKey!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class LeaveBalanceQueryDto {
  @IsOptional() @IsUUID() employeeId?: string;
}
export class CreateLeaveRequestDto {
  @IsOptional() @IsUUID() employeeId?: string;
  @IsUUID() leaveTypeId!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsEnum(DaySession) startSession: DaySession =
    DaySession.FULL_DAY;
  @IsOptional() @IsEnum(DaySession) endSession: DaySession =
    DaySession.FULL_DAY;
  @IsOptional() @IsString() @MaxLength(2000) remarks?: string;
  @IsOptional() @IsUUID() evidenceFileId?: string;
}
export class LeaveRequestQueryDto {
  @IsOptional()
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const)
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  @IsOptional() @IsUUID() employeeId?: string;
}
export class DecideLeaveDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
export class LeaveCalendarQueryDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2200) year =
    new Date().getUTCFullYear();
  @IsOptional() @IsUUID() employeeId?: string;
}
