import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@ApiTags('documents')
@Controller('api/docs')
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create document (metadata only)' })
  create(@Body() body: CreateDocumentDto) {
    return this.svc.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'List documents in a workspace' })
  list(@Query('workspaceId') workspaceId: string) {
    return this.svc.list(workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update document (title/status)' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  update(@Param('id') id: string, @Body() body: UpdateDocumentDto) {
    return this.svc.update(id, body);
  }
}

