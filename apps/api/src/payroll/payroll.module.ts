import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  MyPayrollController,
  PayrollRunsController,
  SalaryAssignmentsController,
  SalaryStructuresController,
} from './payroll.controller';
import { PayrollService } from './payroll.service';
@Module({
  imports: [AuthModule],
  controllers: [
    SalaryStructuresController,
    SalaryAssignmentsController,
    PayrollRunsController,
    MyPayrollController,
  ],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
