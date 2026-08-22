import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateUploadIntentDto } from './files.dto';
import { FilesService } from './files.service';

@ApiTags('files')
@ApiCookieAuth('dayflow_access')
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload-intents')
  createIntent(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateUploadIntentDto,
  ) {
    return this.files.createUploadIntent(user, dto);
  }

  @Post(':id/complete')
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) fileId: string,
  ) {
    return this.files.complete(user, fileId);
  }

  @Get(':id/download')
  download(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) fileId: string,
  ) {
    return this.files.download(user, fileId);
  }
}
