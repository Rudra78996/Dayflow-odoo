import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RoleCode } from '../generated/prisma/client';
import { AttendanceService } from './attendance.service';
import {
  ClockEventDto,
  CorrectionQueryDto,
  CreateCorrectionDto,
  DecideCorrectionDto,
  MineAttendanceQueryDto,
  TeamAttendanceQueryDto,
} from './attendance.dto';

@ApiTags('attendance')
@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}
  @Get('clock-state') state(@CurrentUser() user: AuthUser) {
    return this.attendance.clockState(user);
  }
  @Post('clock-events') event(
    @CurrentUser() user: AuthUser,
    @Body() dto: ClockEventDto,
  ) {
    return this.attendance.clockEvent(user, dto);
  }
  @Get('me') mine(
    @CurrentUser() user: AuthUser,
    @Query() query: MineAttendanceQueryDto,
  ) {
    return this.attendance.mine(user, query);
  }
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER) @Get('team') team(
    @CurrentUser() user: AuthUser,
    @Query() query: TeamAttendanceQueryDto,
  ) {
    return this.attendance.team(user, query);
  }
  @Get('corrections') corrections(
    @CurrentUser() user: AuthUser,
    @Query() query: CorrectionQueryDto,
  ) {
    return this.attendance.listCorrections(user, query);
  }
  @Post('corrections') correction(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCorrectionDto,
  ) {
    return this.attendance.requestCorrection(user, dto);
  }
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER)
  @Post('corrections/:id/approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideCorrectionDto,
  ) {
    return this.attendance.decideCorrection(user, id, true, dto);
  }
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER)
  @Post('corrections/:id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideCorrectionDto,
  ) {
    return this.attendance.decideCorrection(user, id, false, dto);
  }
}
