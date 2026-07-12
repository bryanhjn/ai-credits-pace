import * as SQLite from 'expo-sqlite';

const DB_NAME = 'monthlyProgress.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

// 获取数据库实例（单例）
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  await initSchema(dbInstance);
  return dbInstance;
}

// 初始化表结构
async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS monthly_workdays (
      year     INTEGER NOT NULL,
      month    INTEGER NOT NULL,
      day      INTEGER NOT NULL,
      date_iso TEXT NOT NULL,
      type     INTEGER NOT NULL,
      name     TEXT,
      PRIMARY KEY (year, month, day)
    );

    CREATE TABLE IF NOT EXISTS monthly_credits (
      year          INTEGER NOT NULL,
      month         INTEGER NOT NULL,
      total_credits REAL NOT NULL DEFAULT 6000,
      used_credits  REAL NOT NULL DEFAULT 0,
      updated_at    TEXT NOT NULL,
      PRIMARY KEY (year, month)
    );
  `);

  // 迁移：为旧库添加 original_type 列（幂等）
  const cols = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(monthly_workdays)'
  );
  const hasOriginalType = cols.some((c) => c.name === 'original_type');
  if (!hasOriginalType) {
    await db.execAsync(
      'ALTER TABLE monthly_workdays ADD COLUMN original_type INTEGER'
    );
  }
}
