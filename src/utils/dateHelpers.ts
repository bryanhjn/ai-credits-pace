import { format, getDaysInMonth, getDay, parseISO } from 'date-fns';

// 获取某月天数
export function daysInMonth(year: number, month: number): number {
  // date-fns month 是 0-based，我们用 1-based
  return getDaysInMonth(new Date(year, month - 1));
}

// 格式化为 ISO 字串 'YYYY-MM-DD'
export function toIsoDate(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

// 从 ISO 字串解析
export function fromIsoDate(iso: string): Date {
  return parseISO(iso);
}

// 获取星期几（0=周日, 1=周一, ..., 6=周六）
export function getWeekday(year: number, month: number, day: number): number {
  return getDay(new Date(year, month - 1, day));
}

// 判断是否周末
export function isWeekend(year: number, month: number, day: number): boolean {
  const w = getWeekday(year, month, day);
  return w === 0 || w === 6;
}

// 获取今天的年月日
export function getToday(): { year: number; month: number; day: number; iso: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return { year, month, day, iso: toIsoDate(year, month, day) };
}

// 格式化月份标题 '2026年7月'
export function formatMonthTitle(year: number, month: number): string {
  return `${year}年${month}月`;
}

// 获取上一个月的年月
export function getPreviousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

// 获取下一个月的年月
export function getNextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

// 获取月份英文缩写（react-native-calendars 用）
export function getMonthShortName(month: number): string {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[month - 1] ?? 'Jan';
}

// 格式化时间戳用于 updatedAt
export function nowTimestamp(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");
}
