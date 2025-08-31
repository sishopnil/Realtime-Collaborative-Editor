import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { Workspace, WorkspaceSchema } from './schemas/workspace.schema';
import { DocumentContent, DocumentContentSchema } from './schemas/document-content.schema';
import { Document, DocumentSchema } from './schemas/document.schema';
import { DocumentUpdate, DocumentUpdateSchema } from './schemas/document-update.schema';
import { DocumentSnapshot, DocumentSnapshotSchema } from './schemas/document-snapshot.schema';
import { WorkspaceMember, WorkspaceMemberSchema } from './schemas/workspace-member.schema';
import { DocumentPermission, DocumentPermissionSchema } from './schemas/document-permission.schema';
import { UserRepository } from './repositories/user.repo';
import { WorkspaceRepository } from './repositories/workspace.repo';
import { DocumentRepository } from './repositories/document.repo';
import { WorkspaceMemberRepository } from './repositories/workspace-member.repo';
import { DocumentPermissionRepository } from './repositories/document-permission.repo';
import { DocumentUpdateRepository } from './repositories/document-update.repo';
import { DocumentSnapshotRepository } from './repositories/document-snapshot.repo';
import mongoose from 'mongoose';
import { slowQueryPlugin } from './plugins/slow-query.plugin';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URL || 'mongodb://localhost:27017/rce', {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL || '10', 10),
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL || '2', 10),
      retryWrites: true,
      w: 'majority',
      readPreference: 'primary',
      socketTimeoutMS: 45000,
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: Document.name, schema: DocumentSchema },
      { name: WorkspaceMember.name, schema: WorkspaceMemberSchema },
      { name: DocumentPermission.name, schema: DocumentPermissionSchema },
      { name: DocumentContent.name, schema: DocumentContentSchema },
      { name: DocumentUpdate.name, schema: DocumentUpdateSchema },
      { name: DocumentSnapshot.name, schema: DocumentSnapshotSchema },
    ]),
  ],
  providers: [
    UserRepository,
    WorkspaceRepository,
    DocumentRepository,
    DocumentUpdateRepository,
    DocumentSnapshotRepository,
    WorkspaceMemberRepository,
    DocumentPermissionRepository,
  ],
  exports: [
    MongooseModule,
    UserRepository,
    WorkspaceRepository,
    DocumentRepository,
    DocumentUpdateRepository,
    DocumentSnapshotRepository,
    WorkspaceMemberRepository,
    DocumentPermissionRepository,
  ],
})
export class DatabaseModule {}

// Global Mongoose configuration
mongoose.set('debug', process.env.MONGO_DEBUG === '1');
mongoose.plugin(slowQueryPlugin, { thresholdMs: parseInt(process.env.MONGO_SLOW_MS || '200', 10) });
