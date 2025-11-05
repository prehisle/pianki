import { ensureSchema } from './db/connection';
import { ensureDirectories, uploadsDir as uploadsDirPath } from './db/paths';
import { migrateJsonToSqlite, needsMigration } from './db/migrate';
import { getDb } from './db/connection';

export const uploadsDir = uploadsDirPath;

export async function initDatabase() {
  ensureDirectories();

  if (await needsMigration()) {
    const migrated = await migrateJsonToSqlite();
    if (migrated) {
      console.log('已将 JSON 数据迁移到 SQLite。');
    }
  }

  await ensureSchema();

  const db = getDb();
  const deckCountRow = db.prepare('SELECT COUNT(*) as count FROM decks').get() as { count: number };
  const cardCountRow = db.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number };

  console.log('✅ 数据库初始化完成');
  console.log(`   - 牌组数量: ${deckCountRow.count}`);
  console.log(`   - 卡片数量: ${cardCountRow.count}`);
}
