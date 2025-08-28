import { Connection } from 'mongoose';

export async function up(db: Connection) {
  await db
    .collection('workspaces')
    .updateMany(
      { $or: [{ settings: { $exists: false } }, { 'settings.defaultRole': { $exists: false } }] },
      { $set: { 'settings.defaultRole': 'editor' } },
    );
}

export async function down(db: Connection) {
  await db.collection('workspaces').updateMany({}, { $unset: { 'settings.defaultRole': '' } });
}
