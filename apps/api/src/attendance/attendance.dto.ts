import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum ClockAction {
  CLOCK_IN = 'CLOCK_IN',
  BREAK_START = 'BREAK_START',
  BREAK_END = 'BREAK_END',
  CLOCK_OUT = 'CLOCK_OUT',
}
export class ClockEventDto {
  @IsEnum(ClockAction) action!: ClockAction;
  @IsString() @Length(8, 120) idempotencyKey!: string;
  @IsOptional() @IsDateString() clientOccurredAt?: string;
}
export class MineAttendanceQueryDto {
  @IsOptional() @IsEnum(['week', 'month'] as const) view: 'week' | 'month' =
    'month';
  @IsOptional() @IsDateString() date?: string;
}
export class TeamAttendanceQueryDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
export class CreateCorrectionDto {
  @IsUUID() attendanceRecordId!: string;
  @IsOptional() @IsDateString() requestedCheckIn?: string;
  @IsOptional() @IsDateString() requestedCheckOut?: string;
  @IsString() @Length(3, 1000) reason!: string;
}
export class CorrectionQueryDto {
  @IsOptional() @IsEnum(['PENDING', 'APPROVED', 'REJECTED'] as const) status?:
    'PENDING' | 'APPROVED' | 'REJECTED';
}
export class DecideCorrectionDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsString() @Length(1, 1000) comment!: string;
}
