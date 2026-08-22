import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SensitiveDataService } from '../common/sensitive-data.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [AuthModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, SensitiveDataService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
