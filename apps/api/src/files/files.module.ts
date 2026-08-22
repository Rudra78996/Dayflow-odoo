import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileScansController } from './file-scans.controller';

@Module({
  imports: [AuthModule],
  controllers: [FilesController, FileScansController],
  providers: [FilesService],
})
export class FilesModule {}
