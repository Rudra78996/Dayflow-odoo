import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CalendarService } from './calendar.service';
import { HolidaysController, SchedulesController } from './calendar.controller';

@Module({
  imports: [AuthModule],
  controllers: [SchedulesController, HolidaysController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
