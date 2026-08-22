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
  CreatePayrollRunDto,
  CreateSalaryAssignmentDto,
  CreateSalaryStructureDto,
  PayrollRunQueryDto,
  SalaryAssignmentQueryDto,
  UpdateSalaryStructureDto,
  VersionDto,
} from './payroll.dto';
import { PayrollService } from './payroll.service';
const admin = RoleCode.ADMIN;
@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(admin)
@ApiTags('salary structures')
@Controller('salary-structures')
export class SalaryStructuresController {
  constructor(private readonly payroll: PayrollService) {}
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.payroll.listStructures(user);
  }
  @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSalaryStructureDto,
  ) {
    return this.payroll.createStructure(user, dto);
  }
  @Patch(':id') update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalaryStructureDto,
  ) {
    return this.payroll.updateStructure(user, id, dto);
  }
}
@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(admin)
@ApiTags('salary assignments')
@Controller('salary-assignments')
export class SalaryAssignmentsController {
  constructor(private readonly payroll: PayrollService) {}
  @Get() list(
    @CurrentUser() user: AuthUser,
    @Query() query: SalaryAssignmentQueryDto,
  ) {
    return this.payroll.assignments(user, query);
  }
  @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSalaryAssignmentDto,
  ) {
    return this.payroll.assign(user, dto);
  }
}
@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(admin)
@ApiTags('payroll runs')
@Controller('payroll-runs')
export class PayrollRunsController {
  constructor(private readonly payroll: PayrollService) {}
  @Get() list(
    @CurrentUser() user: AuthUser,
    @Query() query: PayrollRunQueryDto,
  ) {
    return this.payroll.runs(user, query);
  }
  @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePayrollRunDto,
  ) {
    return this.payroll.createRun(user, dto);
  }
  @Get(':id') get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payroll.getRun(user, id);
  }
  @Post(':id/calculate') calculate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.payroll.calculate(user, id, dto);
  }
  @Post(':id/review') review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.payroll.review(user, id, dto);
  }
  @Post(':id/finalize') finalize(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
  ) {
    return this.payroll.finalize(user, id, dto);
  }
}
@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('my payroll')
@Controller('me/payroll')
export class MyPayrollController {
  constructor(private readonly payroll: PayrollService) {}
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.payroll.myPayroll(user);
  }
}
