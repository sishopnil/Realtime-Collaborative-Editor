import { Connection } from 'mongoose';

export async function up(db: Connection) {
  await db
    .collection('documents')
    .createIndex(
      { deletedAt: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 30, partialFilterExpression: { status: 'deleted' } },
    );
}

export async function down(db: Connection) {
  await db.collection('documents').dropIndex('deletedAt_1');
}
