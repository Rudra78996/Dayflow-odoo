import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  Min,
  ValidateNested,
} from 'class-validator';
import {
  SalaryBasis,
  SalaryCalculationMode,
  SalaryComponentType,
} from '../generated/prisma/client';

export class SalaryComponentDto {
  @IsString() @Length(1, 40) code!: string;
  @IsString() @Length(1, 120) name!: string;
  @IsEnum(SalaryComponentType) componentType!: SalaryComponentType;
  @IsEnum(SalaryCalculationMode) calculationMode!: SalaryCalculationMode;
  @IsOptional() @IsEnum(SalaryBasis) basis?: SalaryBasis;
  @IsOptional() @IsString() @Length(1, 40) basisComponentCode?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) value!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000) displayOrder!: number;
  @IsOptional() @IsBoolean() taxable = false;
}
export class CreateSalaryStructureDto {
  @IsString() @Length(2, 40) code!: string;
  @IsString() @Length(1, 120) name!: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => SalaryComponentDto)
  components!: SalaryComponentDto[];
}
export class UpdateSalaryStructureDto extends CreateSalaryStructureDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}
export class CreateSalaryAssignmentDto {
  @IsUUID() employeeId!: string;
  @IsUUID() structureId!: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monthlyWage!: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(7)
  workingDaysPerWeek!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1440) breakMinutes =
    0;
  @IsString() @Length(3, 3) currency!: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}
export class SalaryAssignmentQueryDto {
  @IsOptional() @IsUUID() employeeId?: string;
}
export class CreatePayrollRunDto {
  @IsString() @Length(1, 120) name!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsDateString() cutoffAt!: string;
}
export class PayrollRunQueryDto {
  @IsOptional()
  @IsEnum(['DRAFT', 'CALCULATED', 'REVIEWED', 'FINALIZED'] as const)
  status?: 'DRAFT' | 'CALCULATED' | 'REVIEWED' | 'FINALIZED';
}
export class VersionDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}
