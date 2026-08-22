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
  CreateAllocationDto,
  CreateLeavePolicyDto,
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  DecideLeaveDto,
  LeaveBalanceQueryDto,
  LeaveCalendarQueryDto,
  LeaveRequestQueryDto,
  RunLeaveAccrualDto,
  UpdateLeaveTypeDto,
} from './leave.dto';
import { LeaveService } from './leave.service';

@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('leave types')
@Controller('leave-types')
export class LeaveTypesController {
  constructor(private readonly leave: LeaveService) {}
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.leave.listTypes(user);
  }
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER) @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLeaveTypeDto,
  ) {
    return this.leave.createType(user, dto);
  }
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER) @Patch(':id') update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    return this.leave.updateType(user, id, dto);
  }
}

@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('leave policies')
@Controller('leave-policies')
export class LeavePoliciesController {
  constructor(private readonly leave: LeaveService) {}
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER) @Get() list(
    @CurrentUser() user: AuthUser,
  ) {
    return this.leave.listPolicies(user);
  }
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER) @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLeavePolicyDto,
  ) {
    return this.leave.createPolicy(user, dto);
  }
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER)
  @Post('accrue')
  accrue(@CurrentUser() user: AuthUser, @Body() dto: RunLeaveAccrualDto) {
    return this.leave.runAccrual(user, dto);
  }
}
@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('leave balances')
@Controller('leave-balances')
export class LeaveBalancesController {
  constructor(private readonly leave: LeaveService) {}
  @Get() list(
    @CurrentUser() user: AuthUser,
    @Query() query: LeaveBalanceQueryDto,
  ) {
    return this.leave.balances(user, query);
  }
}
@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('leave allocations')
@Controller('leave-allocations')
export class LeaveAllocationsController {
  constructor(private readonly leave: LeaveService) {}
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER) @Get() list(
    @CurrentUser() user: AuthUser,
  ) {
    return this.leave.allocations(user);
  }
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER) @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAllocationDto,
  ) {
    return this.leave.allocate(user, dto);
  }
}
@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('leave requests')
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leave: LeaveService) {}
  @Get() list(
    @CurrentUser() user: AuthUser,
    @Query() query: LeaveRequestQueryDto,
  ) {
    return this.leave.requests(user, query);
  }
  @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leave.createRequest(user, dto);
  }
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER) @Post(':id/approve') approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideLeaveDto,
  ) {
    return this.leave.decide(user, id, true, dto);
  }
  @Roles(RoleCode.ADMIN, RoleCode.HR_OFFICER) @Post(':id/reject') reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideLeaveDto,
  ) {
    return this.leave.decide(user, id, false, dto);
  }
  @Post(':id/cancel') cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideLeaveDto,
  ) {
    return this.leave.cancel(user, id, dto);
  }
}
@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('leave calendar')
@Controller('leave-calendar')
export class LeaveCalendarController {
  constructor(private readonly leave: LeaveService) {}
  @Get() list(
    @CurrentUser() user: AuthUser,
    @Query() query: LeaveCalendarQueryDto,
  ) {
    return this.leave.calendar(user, query);
  }
}
