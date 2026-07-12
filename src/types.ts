// 日期类型枚举
export enum DayType {
  Workday = 0, // 正常工作日（周一到周五）
  Weekend = 1, // 周末休息
  Holiday = 2, // 法定节假日（休息）
  AdjustedWorkday = 3, // 调休补班（周末但需上班）
  Overtime = 4, // 加班（编辑标记）
  Leave = 5, // 请假（编辑标记）
}

// 单日信息
export interface DayInfo {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  dateIso: string; // 'YYYY-MM-DD'
  type: DayType;
  name: string | null; // 节假日名称，无则 null
  originalType: DayType | null; // 编辑前的原始类型，未编辑时为 null
}

// 月度 AI Credits 设置
export interface CreditsData {
  year: number;
  month: number;
  totalCredits: number;
  usedCredits: number;
  updatedAt: string;
}

// 默认值
export const DEFAULT_TOTAL_CREDITS = 3000;
export const DEFAULT_USED_CREDITS = 0;

// 节假日 API 返回的单条数据
export interface HolidayEntry {
  name: string;
  date: string; // 'YYYY-MM-DD'
  isOffDay: boolean; // true=放假, false=调休补班
}
