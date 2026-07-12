import { DayType, type DayInfo, type HolidayEntry } from '../types';
import { daysInMonth, isWeekend, toIsoDate } from '../utils/dateHelpers';

// holiday-cn 数据结构
interface HolidayCnResponse {
  year: number;
  papers: string[];
  days: HolidayEntry[];
}

// 主源：jsDelivr CDN
const PRIMARY_URL = (year: number) =>
  `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`;

// 回退源：timor.tech（格式不同，单独处理）
const FALLBACK_URL = (year: number) => `https://timor.tech/api/holiday/year/${year}`;

// timor.tech 响应结构
interface TimorResponse {
  code: number;
  holiday: Record<string, { holiday: boolean; name: string; date: string }>;
}

const FETCH_TIMEOUT = 8000;

// 带超时的 fetch
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

// 获取某年的节假日列表
export async function fetchHolidays(year: number): Promise<HolidayEntry[]> {
  // 1. 尝试主源
  try {
    const resp = await fetchWithTimeout(PRIMARY_URL(year));
    if (resp.ok) {
      const data = (await resp.json()) as HolidayCnResponse;
      if (data && Array.isArray(data.days) && data.days.length > 0) {
        return data.days;
      }
    }
  } catch {
    // 主源失败，尝试回退
  }

  // 2. 回退到 timor.tech
  const resp = await fetchWithTimeout(FALLBACK_URL(year));
  const data = (await resp.json()) as TimorResponse;
  if (data.code !== 0 || !data.holiday) {
    throw new Error(`Holiday API error for year ${year}`);
  }
  const entries: HolidayEntry[] = Object.values(data.holiday).map((d) => ({
    name: d.name,
    date: d.date,
    isOffDay: d.holiday, // timor 中 holiday=true 表示放假
  }));
  return entries;
}

// 根据 API 数据构建某月的天数列表
export function buildMonthDays(
  year: number,
  month: number,
  holidays: HolidayEntry[]
): DayInfo[] {
  const total = daysInMonth(year, month);
  const holidayMap = new Map<string, HolidayEntry>();
  for (const h of holidays) {
    holidayMap.set(h.date, h);
  }

  const days: DayInfo[] = [];
  for (let day = 1; day <= total; day++) {
    const iso = toIsoDate(year, month, day);
    const entry = holidayMap.get(iso);
    let type: DayType;
    let name: string | null = null;

    if (entry) {
      if (entry.isOffDay) {
        type = DayType.Holiday;
        name = entry.name;
      } else {
        type = DayType.AdjustedWorkday;
        name = entry.name;
      }
    } else if (isWeekend(year, month, day)) {
      type = DayType.Weekend;
    } else {
      type = DayType.Workday;
    }

    days.push({ year, month, day, dateIso: iso, type, name, originalType: null });
  }
  return days;
}

// 获取某月所需年份的节假日（处理跨年 12 月情况）
export async function fetchHolidaysForMonth(
  year: number,
  month: number
): Promise<DayInfo[]> {
  const entries: HolidayEntry[] = [];
  // 当年数据
  entries.push(...(await fetchHolidays(year)));
  // 12 月需额外检查下一年（holiday-cn README 建议）
  if (month === 12) {
    try {
      entries.push(...(await fetchHolidays(year + 1)));
    } catch {
      // 下一年数据可能尚未发布，忽略
    }
  }
  return buildMonthDays(year, month, entries);
}
