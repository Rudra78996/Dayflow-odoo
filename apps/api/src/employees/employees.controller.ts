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
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RoleCode } from '../generated/prisma/client';
import {
  AddSkillDto,
  CreateCertificationDto,
  CreateEmployeeDto,
  EmployeeListQueryDto,
  UpdateBankDetailDto,
  UpdateEmployeeDto,
  UpdatePrivateProfileDto,
  UpdateResumeDto,
  UpdateStatutoryDetailDto,
} from './employees.dto';
import { EmployeesService } from './employees.service';

@ApiTags('employees')
@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: EmployeeListQueryDto) {
    return this.employees.list(user, query);
  }

  @Roles(RoleCode.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user, dto);
  }

  @Roles(RoleCode.ADMIN)
  @Post(':id/resend-activation')
  resendActivation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) employeeId: string,
  ) {
    return this.employees.resendActivation(user, employeeId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) employeeId: string,
  ) {
    return this.employees.findSummary(user, employeeId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employees.update(user, employeeId, dto);
  }

  @Get(':id/resume')
  resume(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) employeeId: string,
  ) {
    return this.employees.getResume(user, employeeId);
  }

  @Patch(':id/resume')
  updateResume(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdateResumeDto,
  ) {
    return this.employees.updateResume(user, employeeId, dto);
  }

  @Get(':id/private-profile')
  privateProfile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) employeeId: string,
  ) {
    return this.employees.getPrivate(user, employeeId);
  }

  @Patch(':id/private-profile')
  updatePrivate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdatePrivateProfileDto,
  ) {
    return this.employees.updatePrivate(user, employeeId, dto);
  }

  @Get(':id/bank-details')
  bank(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) employeeId: string,
  ) {
    return this.employees.getBank(user, employeeId);
  }

  @Patch(':id/bank-details')
  updateBank(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdateBankDetailDto,
  ) {
    return this.employees.updateBank(user, employeeId, dto);
  }

  @Get(':id/statutory-details')
  statutory(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) employeeId: string,
  ) {
    return this.employees.getStatutory(user, employeeId);
  }

  @Patch(':id/statutory-details')
  updateStatutory(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdateStatutoryDetailDto,
  ) {
    return this.employees.updateStatutory(user, employeeId, dto);
  }

  @Post(':id/skills')
  addSkill(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) employeeId: string,
    @Body() dto: AddSkillDto,
  ) {
    return this.employees.addSkill(user, employeeId, dto);
  }

  @Post(':id/certifications')
  addCertification(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateCertificationDto,
  ) {
    return this.employees.addCertification(user, employeeId, dto);
  }
}
