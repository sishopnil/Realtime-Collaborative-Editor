import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { AuthGuard } from '../auth/auth.guard';
import { WorkspaceGuard, WorkspaceRole } from '../workspaces/workspace.guard';
import { DocumentGuard, DocumentRole } from './document.guard';
import { Request } from 'express';

@ApiTags('documents')
@Controller('api/docs')
@UseGuards(AuthGuard, WorkspaceGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create document (metadata only)' })
  @WorkspaceRole('editor')
  create(@Body() body: CreateDocumentDto, @Req() req: Request & { user?: any }) {
    return this.svc.create({ ...body, ownerId: req.user!.id });
  }

  @Get()
  @ApiOperation({ summary: 'List documents in a workspace' })
  @WorkspaceRole('viewer')
  list(
    @Query('workspaceId') workspaceId: string,
    @Query('q') q?: string,
    @Query('tag') tag?: string,
  ) {
    return this.svc.list(workspaceId, { q, tag });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update document (title/status)' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @UseGuards(DocumentGuard)
  @DocumentRole('editor')
  update(@Param('id') id: string, @Body() body: UpdateDocumentDto) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete document' })
  @UseGuards(DocumentGuard)
  @DocumentRole('editor')
  remove(@Param('id') id: string) {
    return this.svc.softDelete(id);
  }

  // Permissions management
  @Get(':id/permissions')
  @ApiOperation({ summary: 'List document sharing/permissions' })
  @UseGuards(DocumentGuard)
  @DocumentRole('editor')
  listPerms(@Param('id') id: string) {
    return this.svc.listPermissions(id);
  }

  @Post(':id/permissions')
  @ApiOperation({ summary: 'Add or update document permission' })
  @UseGuards(DocumentGuard)
  @DocumentRole('editor')
  addPerm(
    @Param('id') id: string,
    @Body() body: { userId?: string; email?: string; role: 'viewer' | 'editor' },
  ) {
    return this.svc.addPermission(id, body);
  }

  @Delete(':id/permissions/:userId')
  @ApiOperation({ summary: 'Remove document permission' })
  @UseGuards(DocumentGuard)
  @DocumentRole('editor')
  delPerm(@Param('id') id: string, @Param('userId') userId: string) {
    return this.svc.removePermission(id, userId);
  }
}
