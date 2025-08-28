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
import { stripHtml } from '../common/sanitize';
import { gzipSync } from 'zlib';

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
    const title = stripHtml(body.title) || body.title;
    return this.svc.create({ ...body, title, ownerId: req.user!.id });
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
    const patch: any = { ...body };
    if (typeof patch.title === 'string') patch.title = stripHtml(patch.title);
    return this.svc.update(id, patch);
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

  // Yjs content endpoints
  @Get(':id/y')
  @ApiOperation({ summary: 'Get Yjs document state (gzipped base64 update and vector)' })
  @UseGuards(DocumentGuard)
  @DocumentRole('viewer')
  yGet(@Param('id') id: string) {
    return this.svc.getYState(id);
  }

  @Post(':id/y')
  @ApiOperation({ summary: 'Apply Yjs update (gzipped base64)' })
  @UseGuards(DocumentGuard)
  @DocumentRole('editor')
  yPost(@Param('id') id: string, @Body() body: { update: string }) {
    if (!body.update) return { ok: false } as any;
    return this.svc.applyYUpdate(id, body.update);
  }
}
