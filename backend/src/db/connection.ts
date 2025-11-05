import BetterSqlite3, { Database as BetterSqliteDatabase } from 'better-sqlite3';
import fs from 'fs/promises';
import { INITIAL_SCHEMA, DEFAULT_META_ENTRIES, SCHEMA_VERSION } from './schema';
import { sqlitePath, ensureDirectories } from './paths';

let dbInstance: BetterSqliteDatabase | null = null;

export function getDb(): BetterSqliteDatabase {
  if (dbInstance) {
    return dbInstance;
  }

  ensureDirectories();
  dbInstance = new BetterSqlite3(sqlitePath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export async function ensureSchema() {
  const db = getDb();
  db.exec(INITIAL_SCHEMA);

  const existingVersionRow = db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version') as
    | { value: string }
    | undefined;

  if (!existingVersionRow) {
    const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    const transaction = db.transaction(() => {
      Object.entries(DEFAULT_META_ENTRIES).forEach(([key, value]) => {
        insertMeta.run(key, value);
      });
    });
    transaction();
  } else if (Number(existingVersionRow.value) !== SCHEMA_VERSION) {
    // Placeholder for future migrations
    await fs.writeFile(
      sqlitePath + '.migration-required',
      `Unsupported schema version ${existingVersionRow.value}. Expected ${SCHEMA_VERSION}.`,
      { flag: 'w' }
    );
    throw new Error(
      `Unsupported schema version ${existingVersionRow.value}. Please implement migrations before continuing.`
    );
  }
}
