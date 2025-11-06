import BetterSqlite3, { Database as BetterSqliteDatabase } from 'better-sqlite3';
import fs from 'fs/promises';
import { INITIAL_SCHEMA, DEFAULT_META_ENTRIES, SCHEMA_VERSION } from './schema';
import { sqlitePath, ensureDirectories } from './paths';
import { resolveBetterSqliteNativeBinding } from './native-binding';

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
  } else if (Number(existingVersionRow.value) !== SCHEMA_VERSION) {
    // 简单迁移：v1 -> v2 增加 sort_key 并初始化
    const from = Number(existingVersionRow.value);
    if (from === 1 && SCHEMA_VERSION === 2) {
      // 检查列是否存在
      const cols = db.prepare("PRAGMA table_info('cards')").all() as Array<{ name: string }>;
      const hasSortKey = cols.some((c) => c.name === 'sort_key');
      if (!hasSortKey) {
        db.prepare('ALTER TABLE cards ADD COLUMN sort_key REAL NOT NULL DEFAULT 0').run();
      }

      // 按 deck 分配稀疏排序键（按创建时间升序），步长 1000
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
      // 更新版本
      db.prepare('UPDATE meta SET value = ? WHERE key = ?').run(String(SCHEMA_VERSION), 'schema_version');
    } else {
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
