import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FileClassification } from '../generated/prisma/client';
import { FileScanStatus } from '../generated/prisma/client';

export class CreateUploadIntentDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsString()
  @MaxLength(255)
  originalName!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  sizeBytes!: number;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  checksumSha256!: string;

  @IsEnum(FileClassification)
  classification!: FileClassification;
}

export class FileScanResultDto {
  @IsEnum(FileScanStatus)
  status!: FileScanStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  scannerReference?: string;
}
