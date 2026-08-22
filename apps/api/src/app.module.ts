import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './database/prisma.module';
import { EmployeesModule } from './employees/employees.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './health/health.module';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { CalendarModule } from './calendar/calendar.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { PayrollModule } from './payroll/payroll.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EmailModule } from './notifications/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: (environment) => {
        const required = [
          'DATABASE_URL',
          'JWT_ACCESS_SECRET',
          'JWT_REFRESH_SECRET',
        ];
        const missing = required.filter((key) => !environment[key]);
        if (missing.length > 0) {
          throw new Error(
            'Missing environment variables: ' + missing.join(', '),
          );
        }
        return environment;
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    PrismaModule,
    EmailModule,
    AuthModule,
    EmployeesModule,
    FilesModule,
    CalendarModule,
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    DashboardModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('{*path}');
  }
}
