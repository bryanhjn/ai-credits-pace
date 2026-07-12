import { getDatabase } from './database';
import { DayType, type DayInfo, type CreditsData, DEFAULT_TOTAL_CREDITS, DEFAULT_USED_CREDITS } from '../types';
import { nowTimestamp } from '../utils/dateHelpers';

// ===== Workdays CRUD =====

// 检查某月是否已有缓存
export async function hasWorkdaysCache(year: number, month: number): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM monthly_workdays WHERE year = ? AND month = ?',
    year,
    month
  );
  return (row?.cnt ?? 0) > 0;
}

// 获取某月的所有天数信息
export async function getWorkdays(year: number, month: number): Promise<DayInfo[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    year: number;
    month: number;
    day: number;
    date_iso: string;
    type: number;
    name: string | null;
  }>(
    'SELECT year, month, day, date_iso, type, name FROM monthly_workdays WHERE year = ? AND month = ? ORDER BY day ASC',
    year,
    month
  );
  return rows.map((r) => ({
    year: r.year,
    month: r.month,
    day: r.day,
    dateIso: r.date_iso,
    type: r.type as DayType,
    name: r.name,
  }));
}

// 批量保存某月的天数信息（事务）
export async function saveWorkdays(year: number, month: number, days: DayInfo[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const d of days) {
      await db.runAsync(
        'INSERT OR REPLACE INTO monthly_workdays (year, month, day, date_iso, type, name) VALUES (?, ?, ?, ?, ?, ?)',
        d.year,
        d.month,
        d.day,
        d.dateIso,
        d.type,
        d.name
      );
    }
  });
}

// ===== Credits CRUD =====

// 获取某月 Credits（无记录返回默认值，但不写入）
export async function getCredits(year: number, month: number): Promise<CreditsData> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    year: number;
    month: number;
    total_credits: number;
    used_credits: number;
    updated_at: string;
  }>(
    'SELECT year, month, total_credits, used_credits, updated_at FROM monthly_credits WHERE year = ? AND month = ?',
    year,
    month
  );
  if (!row) {
    return {
      year,
      month,
      totalCredits: DEFAULT_TOTAL_CREDITS,
      usedCredits: DEFAULT_USED_CREDITS,
      updatedAt: '',
    };
  }
  return {
    year: row.year,
    month: row.month,
    totalCredits: row.total_credits,
    usedCredits: row.used_credits,
    updatedAt: row.updated_at,
  };
}

// 保存某月 Credits（INSERT OR REPLACE）
export async function upsertCredits(
  year: number,
  month: number,
  totalCredits: number,
  usedCredits: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO monthly_credits (year, month, total_credits, used_credits, updated_at) VALUES (?, ?, ?, ?, ?)',
    year,
    month,
    totalCredits,
    usedCredits,
    nowTimestamp()
  );
}
