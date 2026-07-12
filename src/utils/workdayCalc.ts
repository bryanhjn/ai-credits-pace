import { DayType, type DayInfo } from '../types';

// 判断是否为工作日（正常工作日 + 调休 + 加班）
function isWorkdayType(type: DayType): boolean {
  return type === DayType.Workday || type === DayType.AdjustedWorkday || type === DayType.Overtime;
}

// 统计某月工作日总数（正常工作日 + 调休 + 加班）
export function countTotalWorkdays(days: DayInfo[]): number {
  return days.filter((d) => isWorkdayType(d.type)).length;
}

// 统计已度过的工作日数（包含当天，date <= today）
export function countPassedWorkdays(days: DayInfo[], todayDay: number): number {
  return days.filter((d) => d.day <= todayDay && isWorkdayType(d.type)).length;
}

// 计算进度百分比（0-100，保留 1 位小数）
export function calcProgressPercent(passed: number, total: number): number {
  if (total <= 0) return 0;
  const pct = (passed / total) * 100;
  return Math.round(pct * 10) / 10;
}

// 计算 Credits 使用比例
export function calcCreditsRatio(used: number, total: number): number {
  if (total <= 0) return 0;
  return used / total;
}
