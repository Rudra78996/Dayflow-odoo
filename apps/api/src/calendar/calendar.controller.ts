import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import {
  AssignScheduleDto,
  CreateHolidayDto,
  CreateScheduleDto,
  HolidayQueryDto,
  UpdateHolidayDto,
  UpdateScheduleDto,
} from './calendar.dto';
import { CalendarService } from './calendar.service';

@ApiTags('schedules')
@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER)
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly calendar: CalendarService) {}
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.calendar.listSchedules(user);
  }
  @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.calendar.createSchedule(user, dto);
  }
  @Patch(':id') update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.calendar.updateSchedule(user, id, dto);
  }
  @Post(':id/assignments') assign(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignScheduleDto,
  ) {
    return this.calendar.assignSchedule(user, id, dto);
  }
}

@ApiTags('holidays')
@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly calendar: CalendarService) {}
  @Get() list(@CurrentUser() user: AuthUser, @Query() query: HolidayQueryDto) {
    return this.calendar.listHolidays(user, query);
  }
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER) @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateHolidayDto,
  ) {
    return this.calendar.createHoliday(user, dto);
  }
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER) @Patch(':id') update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.calendar.updateHoliday(user, id, dto);
  }
}
