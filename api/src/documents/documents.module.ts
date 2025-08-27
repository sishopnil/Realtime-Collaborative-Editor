import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Document, DocumentSchema } from '../database/schemas/document.schema';
import { DocumentRepository } from '../database/repositories/document.repo';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Document.name, schema: DocumentSchema }])],
  providers: [DocumentRepository, DocumentsService],
  controllers: [DocumentsController],
})
export class DocumentsModule {}
