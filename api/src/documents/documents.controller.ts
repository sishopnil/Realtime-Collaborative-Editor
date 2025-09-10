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
  @ApiResponse({ status: 201, description: 'Document created', schema: { example: { _id: '64f0...', workspaceId: '64ef...', title: 'My Doc', ownerId: '64ab...', status: 'active', tags: [], version: 0, createdAt: '2024-08-28T00:00:00.000Z', updatedAt: '2024-08-28T00:00:00.000Z' } } })
  @WorkspaceRole('editor')
  create(@Body() body: CreateDocumentDto, @Req() req: Request & { user?: any }) {
    const title = stripHtml(body.title) || body.title;
    return this.svc.create({ ...body, title, ownerId: req.user!.id });
  }

  @Get()
  @ApiOperation({ summary: 'List documents in a workspace' })
  @ApiResponse({ status: 200, description: 'List of documents', schema: { example: [{ _id: '64f0...', title: 'Doc A', status: 'active', tags: ['notes'], version: 10 }, { _id: '64f1...', title: 'Doc B', status: 'archived', tags: [], version: 2 }] } })
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

  // History & snapshots
  @Get(':id/snapshots')
  @ApiOperation({ summary: 'List recent snapshots' })
  @UseGuards(DocumentGuard)
  @DocumentRole('viewer')
  listSnaps(@Param('id') id: string) {
    return this.svc.listSnapshots(id);
  }

  @Post(':id/snapshots')
  @ApiOperation({ summary: 'Create a snapshot now' })
  @UseGuards(DocumentGuard)
  @DocumentRole('editor')
  async createSnap(@Param('id') id: string) {
    const state = await this.svc.getYState(id);
    // The service auto-snapshots at intervals; to force one, we can apply a no-op update (state itself)
    await this.svc.applyYUpdate(id, state.update);
    return { ok: true };
  }

  @Post(':id/rollback')
  @ApiOperation({ summary: 'Rollback to a snapshot' })
  @UseGuards(DocumentGuard)
  @DocumentRole('editor')
  rollback(@Param('id') id: string, @Body() body: { snapshotId: string }) {
    return this.svc.rollbackToSnapshot(id, body.snapshotId);
  }

  @Post(':id/repair')
  @ApiOperation({ summary: 'Validate and attempt repair of document state' })
  @UseGuards(DocumentGuard)
  @DocumentRole('editor')
  repair(@Param('id') id: string) {
    return this.svc.validateAndRepair(id);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export document' })
  @UseGuards(DocumentGuard)
  @DocumentRole('viewer')
  async export(@Param('id') id: string, @Query('format') format: 'yupdate' | 'json' = 'yupdate') {
    const state = await this.svc.getYState(id);
    if (format === 'json') {
      return { yupdateB64: state.update, vectorB64: state.vector };
    }
    // default yupdate – identical to json wrapper above for now
    return { yupdateB64: state.update, vectorB64: state.vector };
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
  delPerm(@Param('id') id: string, @Param('userId') userId: string): Promise<any> {
    return this.svc.removePermission(id, userId);
  }

  // Yjs content endpoints
  @Get(':id/y')
  @ApiOperation({ summary: 'Get Yjs document state (gzipped base64 update and vector)' })
  @ApiResponse({ status: 200, description: 'State payload', schema: { example: { update: 'base64...', vector: 'base64...' } } })
  @UseGuards(DocumentGuard)
  @DocumentRole('viewer')
  yGet(@Param('id') id: string) {
    return this.svc.getYState(id);
  }

  @Post(':id/y')
  @ApiOperation({ summary: 'Apply Yjs update (gzipped base64)' })
  @ApiResponse({ status: 200, description: 'Update applied', schema: { example: { ok: true } } })
  @UseGuards(DocumentGuard)
  @DocumentRole('editor')
  yPost(@Param('id') id: string, @Body() body: { update: string }) {
    if (!body.update) return { ok: false } as any;
    return this.svc.applyYUpdate(id, body.update);
  }
}
