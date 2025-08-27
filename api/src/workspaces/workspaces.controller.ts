import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@ApiTags('workspaces')
@Controller('api/workspaces')
export class WorkspacesController {
  constructor(private readonly svc: WorkspacesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create workspace' })
  create(@Body() body: CreateWorkspaceDto) {
    return this.svc.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'List workspaces for owner' })
  list(@Query('ownerId') ownerId: string) {
    return this.svc.list(ownerId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  update(@Param('id') id: string, @Body() body: UpdateWorkspaceDto) {
    return this.svc.update(id, body);
  }
}

