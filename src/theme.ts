import { MD3LightTheme } from 'react-native-paper';

// 精致 Indigo/Slate 配色体系 — premium iOS grade
export const themeColors = {
  // 主色系
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  primaryBg: '#EEF2FF',

  // 背景与表面
  background: '#FAF9F5',
  surface: '#FFFFFF',
  surfaceVariant: '#F6F7F9',

  // 发丝级描边（hairline）—— 用于卡片/输入框的精致边缘
  hairline: 'rgba(15, 23, 42, 0.06)',
  hairlineStrong: 'rgba(15, 23, 42, 0.10)',

  // 文字
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  // 分隔线
  divider: 'rgba(15, 23, 42, 0.06)',

  // 日历日期配色（图例点 / 强调色）
  workday: '#10B981',         // 工作日 - Emerald
  weekend: '#94A3B8',         // 周末 - Slate
  holiday: '#EF4444',         // 节假日 - Red
  adjustedWorkday: '#F59E0B', // 调休 - Amber
  overtime: '#8B5CF6',        // 加班 - Violet
  leave: '#3B82F6',          // 请假 - Blue
  today: '#6366F1',          // 今日高亮 - Indigo

  // 日历单元格背景 —— 100/200 级淡色，加大色相差异，更易辨别
  workdayTint: '#D1FAE5',         // Emerald 100
  holidayTint: '#FEE2E2',         // Red 100
  adjustedWorkdayTint: '#FEF3C7', // Amber 100
  overtimeTint: '#EDE9FE',        // Violet 100
  leaveTint: '#DBEAFE',          // Blue 100
  weekendTint: '#E2E8F0',         // Slate 200

  // 日历日期文字色 —— 600 级，在淡色背景上保证对比度
  workdayText: '#059669',         // Emerald 600
  holidayText: '#DC2626',         // Red 600
  adjustedWorkdayText: '#D97706', // Amber 600
  overtimeText: '#7C3AED',        // Violet 600
  leaveText: '#2563EB',          // Blue 600
  weekendText: '#64748B',         // Slate 500

  // Credits 进度条颜色（按配速差值：Credits% − 工作日%）
  creditsSafe: '#10B981',    // 用量落后进度 → 绿
  creditsWarning: '#F59E0B', // 节奏匹配 → 黄
  creditsDanger: '#EF4444',  // 用量超前进度 → 红
};

// hex (#RRGGBB) -> 'rgba(r,g,b,a)' —— 用于 LinearGradient 的透明色阶
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Credits 配速阈值（百分比点）—— Credits 使用率与工作日进度差值超过此值即变色
export const PACE_THRESHOLD_PERCENT = 5;

// 根据 Credits 使用率与工作日进度的差值返回颜色
// diff = creditsPercent - workdayPercent
// diff < -阈值 → 绿（用量落后进度，充裕）
// diff >  阈值 → 红（用量超前进度，紧张）
// 其间         → 黄（节奏匹配）
export function getCreditsColor(diff: number): string {
  if (diff < -PACE_THRESHOLD_PERCENT) return themeColors.creditsSafe;
  if (diff > PACE_THRESHOLD_PERCENT) return themeColors.creditsDanger;
  return themeColors.creditsWarning;
}

// 根据差值返回 Credits 进度条渐变颜色（深色端）
export function getCreditsDarkColor(diff: number): string {
  if (diff < -PACE_THRESHOLD_PERCENT) return '#059669';
  if (diff > PACE_THRESHOLD_PERCENT) return '#DC2626';
  return '#D97706';
}

// Paper 主题
export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: themeColors.primary,
    primaryContainer: themeColors.primaryBg,
    onPrimaryContainer: themeColors.primaryDark,
    secondary: themeColors.workday,
    secondaryContainer: '#ECFDF5',
    surface: themeColors.surface,
    surfaceVariant: themeColors.surfaceVariant,
    background: themeColors.background,
    outline: themeColors.divider,
    onSurface: themeColors.textPrimary,
    onSurfaceVariant: themeColors.textSecondary,
    backdrop: 'rgba(15, 23, 42, 0.18)',
  },
};
