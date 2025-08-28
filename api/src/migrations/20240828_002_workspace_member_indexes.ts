import { Connection } from 'mongoose';

export async function up(db: Connection) {
  await db.collection('workspacemembers').createIndex({ workspaceId: 1, role: 1 });
}

export async function down(db: Connection) {
  await db.collection('workspacemembers').dropIndex('workspaceId_1_role_1');
}
