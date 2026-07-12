import { DayType, type DayInfo } from '../types';

// 统计某月工作日总数（正常工作日 + 调休补班）
export function countTotalWorkdays(days: DayInfo[]): number {
  return days.filter((d) => d.type === DayType.Workday || d.type === DayType.AdjustedWorkday).length;
}

// 统计已度过的工作日数（包含当天，date <= today）
export function countPassedWorkdays(days: DayInfo[], todayDay: number): number {
  return days.filter(
    (d) =>
      d.day <= todayDay &&
      (d.type === DayType.Workday || d.type === DayType.AdjustedWorkday)
  ).length;
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
