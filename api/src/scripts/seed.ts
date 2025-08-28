import 'reflect-metadata';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { getBcryptCost } from '../common/security';
import { UserSchema } from '../database/schemas/user.schema';
import { WorkspaceSchema } from '../database/schemas/workspace.schema';
import { DocumentSchema } from '../database/schemas/document.schema';

async function run() {
  const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/rce?replicaSet=rs0';
  await mongoose.connect(MONGO_URL);
  const User = mongoose.model('User', UserSchema);
  const Workspace = mongoose.model('Workspace', WorkspaceSchema);
  const Doc = mongoose.model('Document', DocumentSchema);

  const email = 'owner@example.com';
  const existing = await User.findOne({ email });
  let user = existing;
  if (!user) {
    user = await User.create({ email, passwordHash: await bcrypt.hash('password', getBcryptCost()), name: 'Owner' });
  }

  const slug = 'demo';
  const ws = await Workspace.findOneAndUpdate(
    { slug },
    { $setOnInsert: { name: 'Demo Workspace', slug, ownerId: user._id } },
    { upsert: true, new: true },
  );

  await Doc.findOneAndUpdate(
    { workspaceId: ws._id, title: 'Welcome' },
    { $setOnInsert: { workspaceId: ws._id, title: 'Welcome', ownerId: user._id, tags: [] } },
    { upsert: true, new: true },
  );

  // eslint-disable-next-line no-console
  console.log('Seeded user, workspace, and document');
  await mongoose.disconnect();
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
