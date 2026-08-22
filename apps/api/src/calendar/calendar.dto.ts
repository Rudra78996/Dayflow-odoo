import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateScheduleDto {
  @IsString() @Length(1, 120) name!: string;
  @IsString() @MaxLength(80) timezone!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  workingWeekdays!: number[];
  @IsInt() @Min(0) @Max(1439) shiftStartMinutes!: number;
  @IsInt() @Min(0) @Max(1439) shiftEndMinutes!: number;
  @IsOptional() @IsBoolean() overnight = false;
  @IsOptional() @IsInt() @Min(0) @Max(1440) paidBreakMinutes = 0;
  @IsOptional() @IsInt() @Min(0) @Max(1440) unpaidBreakMinutes = 0;
  @IsOptional() @IsInt() @Min(0) @Max(240) graceMinutes = 0;
  @IsInt() @Min(1) @Max(1440) halfDayMinutes!: number;
  @IsInt() @Min(1) @Max(1440) fullDayMinutes!: number;
  @IsInt() @Min(1) @Max(1440) overtimeAfterMinutes!: number;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}

export class UpdateScheduleDto extends CreateScheduleDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class AssignScheduleDto {
  @IsUUID() employeeId!: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}

export class HolidayQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  year?: number;
  @IsOptional() @IsUUID() locationId?: string;
}

export class CreateHolidayDto {
  @IsString() @Length(1, 160) name!: string;
  @IsDateString() date!: string;
  @IsOptional() @IsUUID() locationId?: string;
  @IsOptional() @IsBoolean() optional = false;
}

export class UpdateHolidayDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @Length(1, 160) name?: string;
  @IsOptional() @IsBoolean() optional?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}
