import 'reflect-metadata';
import mongoose from 'mongoose';
import { UserSchema } from '../database/schemas/user.schema';
import { WorkspaceSchema } from '../database/schemas/workspace.schema';
import { DocumentSchema } from '../database/schemas/document.schema';

async function run() {
  const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/rce';
  console.log(`Connecting to ${MONGO_URL}`);
  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 5000 });
  try {
    const User = mongoose.model('User', UserSchema);
    const Workspace = mongoose.model('Workspace', WorkspaceSchema);
    const Doc = mongoose.model('Document', DocumentSchema);
    await Promise.all([User.syncIndexes(), Workspace.syncIndexes(), Doc.syncIndexes()]);
    console.log('Indexes synced.');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

