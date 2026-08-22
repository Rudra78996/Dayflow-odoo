import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileScanResultDto } from './files.dto';
import { FilesService } from './files.service';

@ApiTags('file-scanner')
@Controller('internal/file-scans')
export class FileScansController {
  constructor(private readonly files: FilesService) {}

  @Post(':id/result')
  result(
    @Param('id', ParseUUIDPipe) fileId: string,
    @Headers('x-file-scanner-secret') secret: string | undefined,
    @Body() dto: FileScanResultDto,
  ) {
    return this.files.recordScanResult(fileId, secret, dto);
  }
}
