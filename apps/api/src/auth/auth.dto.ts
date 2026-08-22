import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CompanySignUpDto {
  @ApiProperty({ example: 'Odoo India' })
  @IsString()
  @Length(2, 180)
  companyName!: string;

  @ApiProperty({ example: 'OI' })
  @Matches(/^[A-Z0-9]{2,4}$/)
  companyPrefix!: string;

  @ApiProperty({ example: 'Jordan Doe' })
  @IsString()
  @Length(2, 160)
  adminName!: string;

  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'Password must include uppercase, lowercase, number, and symbol characters.',
  })
  password!: string;

  @ApiProperty()
  @IsString()
  confirmPassword!: string;
}

export class SignInDto {
  @ApiProperty({ description: 'Work email or generated Login ID' })
  @IsString()
  @Length(2, 254)
  identifier!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  password!: string;
}

export class TokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  token!: string;
}

export class ActivateAccountDto extends TokenDto {
  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'Password must include uppercase, lowercase, number, and symbol characters.',
  })
  password!: string;

  @ApiProperty()
  @IsString()
  confirmPassword!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto extends ActivateAccountDto {}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'Password must include uppercase, lowercase, number, and symbol characters.',
  })
  newPassword!: string;
}
