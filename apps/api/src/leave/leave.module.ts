import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  LeaveAllocationsController,
  LeaveBalancesController,
  LeaveCalendarController,
  LeavePoliciesController,
  LeaveRequestsController,
  LeaveTypesController,
} from './leave.controller';
import { LeaveService } from './leave.service';
@Module({
  imports: [AuthModule],
  controllers: [
    LeaveTypesController,
    LeavePoliciesController,
    LeaveBalancesController,
    LeaveAllocationsController,
    LeaveRequestsController,
    LeaveCalendarController,
  ],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
