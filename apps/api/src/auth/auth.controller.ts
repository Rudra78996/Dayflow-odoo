import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  ActivateAccountDto,
  ChangePasswordDto,
  CompanySignUpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SignInDto,
  TokenDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './auth-user';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(maxAge: number) {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', 'false') === 'true',
      sameSite: 'lax' as const,
      path: '/',
      maxAge,
    };
  }

  private setSessionCookies(
    response: Response,
    session: { accessToken: string; refreshToken: string; expiresAt: Date },
  ) {
    response.cookie(
      'dayflow_access',
      session.accessToken,
      this.cookieOptions(15 * 60 * 1000),
    );
    response.cookie(
      'dayflow_refresh',
      session.refreshToken,
      this.cookieOptions(Math.max(0, session.expiresAt.getTime() - Date.now())),
    );
  }

  @Post('company-sign-up')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  companySignUp(@Body() dto: CompanySignUpDto) {
    return this.auth.companySignUp(dto);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: TokenDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Post('activate')
  activate(@Body() dto: ActivateAccountDto) {
    return this.auth.activateAccount(dto);
  }

  @Post('sign-in')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async signIn(
    @Body() dto: SignInDto,
    @Ip() ipAddress: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.signIn(dto, {
      ipAddress,
      userAgent: request.headers['user-agent'],
    });
    this.setSessionCookies(response, session);
    return { user: session.user };
  }

  @Post('refresh')
  async refresh(
    @Ip() ipAddress: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.refresh(
      request.cookies?.dayflow_refresh as string | undefined,
      {
        ipAddress,
        userAgent: request.headers['user-agent'],
      },
    );
    this.setSessionCookies(response, session);
    return { user: session.user };
  }

  @ApiCookieAuth('dayflow_access')
  @UseGuards(JwtAuthGuard)
  @Post('sign-out')
  async signOut(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.signOut(user);
    response.clearCookie('dayflow_access', { path: '/' });
    response.clearCookie('dayflow_refresh', { path: '/' });
    return result;
  }

  @ApiCookieAuth('dayflow_access')
  @UseGuards(JwtAuthGuard)
  @Post('sign-out-all')
  async signOutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.signOutAll(user);
    response.clearCookie('dayflow_access', { path: '/' });
    response.clearCookie('dayflow_refresh', { path: '/' });
    return result;
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @ApiCookieAuth('dayflow_access')
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user, dto);
  }

  @ApiCookieAuth('dayflow_access')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }
}
