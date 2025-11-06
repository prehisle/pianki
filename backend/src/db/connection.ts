import BetterSqlite3, { Database as BetterSqliteDatabase } from 'better-sqlite3';
import fs from 'fs/promises';
import { INITIAL_SCHEMA, DEFAULT_META_ENTRIES, SCHEMA_VERSION } from './schema';
import { sqlitePath, ensureDirectories } from './paths';
import { resolveBetterSqliteNativeBinding } from './native-binding';
import { randomBytes, createHash } from 'crypto';

let dbInstance: BetterSqliteDatabase | null = null;

export function getDb(): BetterSqliteDatabase {
  if (dbInstance) {
    return dbInstance;
  }

  ensureDirectories();
  const nativeBinding = resolveBetterSqliteNativeBinding();
  dbInstance = nativeBinding
    ? new BetterSqlite3(sqlitePath, { nativeBinding })
    : new BetterSqlite3(sqlitePath);
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
  } else {
    let currentVersion = Number(existingVersionRow.value);

    if (currentVersion < 2 && SCHEMA_VERSION >= 2) {
      migrateV1ToV2(db);
      currentVersion = 2;
      db.prepare('UPDATE meta SET value = ? WHERE key = ?').run('2', 'schema_version');
    }

    if (currentVersion < 3 && SCHEMA_VERSION >= 3) {
      migrateV2ToV3(db);
      currentVersion = 3;
      db.prepare('UPDATE meta SET value = ? WHERE key = ?').run('3', 'schema_version');
    }

    if (currentVersion !== SCHEMA_VERSION) {
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
}

function migrateV1ToV2(db: BetterSqliteDatabase) {
  const cols = db.prepare("PRAGMA table_info('cards')").all() as Array<{ name: string }>;
  const hasSortKey = cols.some((c) => c.name === 'sort_key');
  if (!hasSortKey) {
    db.prepare('ALTER TABLE cards ADD COLUMN sort_key REAL NOT NULL DEFAULT 0').run();
  }

  const deckRows = db.prepare('SELECT id FROM decks ORDER BY id').all() as Array<{ id: number }>;
  for (const d of deckRows) {
    const rows = db
      .prepare('SELECT id FROM cards WHERE deck_id = ? ORDER BY datetime(created_at) ASC, id ASC')
      .all(d.id) as Array<{ id: number }>;
    let key = 1000;
    for (const r of rows) {
      db.prepare('UPDATE cards SET sort_key = ? WHERE id = ?').run(key, r.id);
      key += 1000;
    }
  }
}

function migrateV2ToV3(db: BetterSqliteDatabase) {
  const cols = db.prepare("PRAGMA table_info('cards')").all() as Array<{ name: string }>;
  const hasGuid = cols.some((c) => c.name === 'guid');
  if (!hasGuid) {
    db.prepare('ALTER TABLE cards ADD COLUMN guid TEXT').run();
  }

  const selectExisting = db.prepare('SELECT guid FROM cards WHERE guid = ? LIMIT 1');
  const updateGuid = db.prepare('UPDATE cards SET guid = ? WHERE id = ?');
  const rows = db
    .prepare('SELECT id, guid FROM cards')
    .all() as Array<{ id: number; guid: string | null | undefined }>;
  for (const row of rows) {
    if (row.guid && row.guid.trim().length > 0) {
      continue;
    }
    let guid: string;
    do {
      guid = createHash('sha1').update(randomBytes(32)).digest('hex');
    } while (selectExisting.get(guid));
    updateGuid.run(guid, row.id);
  }

  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_guid ON cards (guid)').run();
}
