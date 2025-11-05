import { migrateJsonToSqlite } from '../src/db/migrate';
import { sqlitePath } from '../src/db/paths';

async function migrate() {
  const migrated = await migrateJsonToSqlite();
  if (migrated) {
    console.log(`迁移完成。SQLite 数据库位置: ${sqlitePath}`);
  } else {
    console.log('未找到 db.json，跳过迁移。');
  }
}

// 兼容直接运行 `node` / `tsx`
if (require.main === module) {
  migrate().catch(error => {
    console.error('迁移失败:', error);
    process.exitCode = 1;
  });
}
