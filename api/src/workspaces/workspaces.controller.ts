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
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { AuthGuard } from '../auth/auth.guard';
import { WorkspaceGuard, WorkspaceRole } from './workspace.guard';
import { Request } from 'express';
import { UserRepository } from '../database/repositories/user.repo';
import { SecurityLogger } from '../common/security-logger.service';
import { sanitizeHtml, stripHtml } from '../common/sanitize';

@ApiTags('workspaces')
@Controller('api/workspaces')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class WorkspacesController {
  constructor(
    private readonly svc: WorkspacesService,
    private readonly usersRepo: UserRepository,
    private readonly audit: SecurityLogger,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create workspace' })
  create(@Body() body: CreateWorkspaceDto, @Req() req: Request & { user?: any }) {
    // enforce ownerId from token
    return this.svc.create({ ...body, ownerId: req.user!.id } as any);
  }

  @Get()
  @ApiOperation({ summary: 'List workspaces for owner' })
  list(@Req() req: Request & { user?: any }) {
    return this.svc.list(req.user!.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace by id' })
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  update(@Param('id') id: string, @Body() body: UpdateWorkspaceDto) {
    const patch: any = { ...body };
    if (patch.settings && typeof patch.settings.description === 'string') {
      patch.settings.description = sanitizeHtml(patch.settings.description);
    }
    if (typeof patch.name === 'string') patch.name = stripHtml(patch.name);
    return this.svc.update(id, patch);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete workspace' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  // Membership management
  @Get(':workspaceId/members')
  @UseGuards(WorkspaceGuard)
  @WorkspaceRole('admin')
  @ApiOperation({ summary: 'List workspace members' })
  listMembers(@Param('workspaceId') workspaceId: string) {
    return this.svc.listMembers(workspaceId);
  }

  @Post(':workspaceId/members')
  @UseGuards(WorkspaceGuard)
  @WorkspaceRole('admin')
  @ApiOperation({ summary: 'Add or update a member role' })
  async addMember(
    @Param('workspaceId') workspaceId: string,
    @Body() body: { userId?: string; email?: string; role: 'viewer' | 'editor' | 'admin' },
  ) {
    let userId = body.userId;
    if (!userId && body.email) {
      const user = await this.usersRepo.findByEmail(body.email.toLowerCase().trim());
      if (!user) throw new Error('User not found');
      userId = (user as any)._id;
    }
    if (!userId) throw new Error('userId or email required');
    const result = await this.svc.addOrUpdateMember(workspaceId, userId, body.role);
    await this.audit.log('security.role.update', { workspaceId, userId, role: body.role });
    return result;
  }

  @Delete(':workspaceId/members/:userId')
  @UseGuards(WorkspaceGuard)
  @WorkspaceRole('admin')
  @ApiOperation({ summary: 'Remove a member from workspace' })
  removeMember(@Param('workspaceId') workspaceId: string, @Param('userId') userId: string) {
    return this.svc.removeMember(workspaceId, userId);
  }

  @Patch(':workspaceId/settings')
  @UseGuards(WorkspaceGuard)
  @WorkspaceRole('admin')
  @ApiOperation({ summary: 'Update workspace settings' })
  updateSettings(@Param('workspaceId') workspaceId: string, @Body() body: { settings: any }) {
    return this.svc.update(workspaceId, { ...(body as any) });
  }
}
