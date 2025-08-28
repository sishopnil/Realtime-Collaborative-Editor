import 'reflect-metadata';
import path from 'path';
import fs from 'fs';
import mongoose, { Connection } from 'mongoose';

type Migration = {
  id: string;
  up: (db: Connection) => Promise<void>;
  down: (db: Connection) => Promise<void>;
};

async function loadMigrations(dir: string): Promise<Migration[]> {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .sort();
  const list: Migration[] = [];
  for (const f of files) {
    const mod = await import(path.join(dir, f));
    const id = path.basename(f).replace(path.extname(f), '');
    if (!mod.up || !mod.down) throw new Error(`Migration ${f} missing up/down`);
    list.push({ id, up: mod.up, down: mod.down });
  }
  return list;
}

async function ensureMigrationsCollection(db: Connection) {
  const coll = db.collection('migrations');
  await coll.createIndex({ id: 1 }, { unique: true });
}

async function getApplied(db: Connection): Promise<string[]> {
  const coll = db.collection('migrations');
  const docs = await coll.find({}).sort({ appliedAt: 1 }).toArray();
  return docs.map((d) => d.id as string);
}

async function markApplied(db: Connection, id: string) {
  await db.collection('migrations').insertOne({ id, appliedAt: new Date() });
}
async function unmarkApplied(db: Connection, id: string) {
  await db.collection('migrations').deleteOne({ id });
}

async function main() {
  const cmd = process.argv[2] || 'status';
  const target = process.argv[3];
  const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/rce';
  const dir = path.join(__dirname, '..', 'migrations');
  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection;
  try {
    await ensureMigrationsCollection(db);
    const migrations = await loadMigrations(dir);
    const applied = new Set(await getApplied(db));

    if (cmd === 'status') {
      for (const m of migrations) {
        console.log(`${applied.has(m.id) ? 'UP' : 'DOWN'} \t ${m.id}`);
      }
      return;
    }

    if (cmd === 'up') {
      for (const m of migrations) {
        if (!applied.has(m.id)) {
          console.log(`Applying ${m.id}...`);
          await m.up(db);
          await markApplied(db, m.id);
        }
      }
      console.log('Migrations applied');
      return;
    }

    if (cmd === 'down') {
      const steps = Number(target || '1');
      const appliedList = (await getApplied(db)).reverse();
      const toRevert = appliedList.slice(0, steps);
      for (const id of toRevert) {
        const m = migrations.find((x) => x.id === id);
        if (m) {
          console.log(`Reverting ${m.id}...`);
          await m.down(db);
          await unmarkApplied(db, m.id);
        }
      }
      console.log('Reverted');
      return;
    }

    if (cmd === 'to') {
      if (!target) throw new Error('Usage: to <migration-id>');
      // bring db up to target id (inclusive)
      const currentApplied = new Set(await getApplied(db));
      for (const m of migrations) {
        if (m.id <= target && !currentApplied.has(m.id)) {
          console.log(`Applying ${m.id}...`);
          await m.up(db);
          await markApplied(db, m.id);
        }
      }
      // if beyond target, rollback extras
      const appliedList = (await getApplied(db)).filter((id) => id > target).reverse();
      for (const id of appliedList) {
        const m = migrations.find((x) => x.id === id);
        if (m) {
          console.log(`Reverting ${m.id}...`);
          await m.down(db);
          await unmarkApplied(db, m.id);
        }
      }
      console.log('Migrated to target');
      return;
    }

    throw new Error(`Unknown command: ${cmd}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
