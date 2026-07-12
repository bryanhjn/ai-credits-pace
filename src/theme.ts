import { MD3LightTheme } from 'react-native-paper';

// 现代 Indigo/Slate 配色体系
export const themeColors = {
  // 主色系
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  primaryBg: '#EEF2FF',

  // 背景与表面
  background: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceVariant: '#F8FAFC',

  // 文字
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',

  // 分隔线
  divider: '#E2E8F0',

  // 日历日期配色
  workday: '#10B981',       // 工作日 - Emerald
  weekend: '#94A3B8',       // 周末 - Slate
  holiday: '#EF4444',       // 节假日 - Red
  adjustedWorkday: '#F59E0B', // 调休补班 - Amber
  today: '#6366F1',         // 今日高亮 - Indigo

  // 日历日期浅色变体（用于日历单元格背景）
  workdayLight: '#34D399',       // 工作日 - Emerald 400
  holidayLight: '#F87171',       // 节假日 - Red 400
  adjustedWorkdayLight: '#FBBF24', // 调休补班 - Amber 400

  // Credits 进度条颜色（按使用比例）
  creditsSafe: '#10B981',    // <70% Emerald
  creditsWarning: '#F59E0B', // 70-100% Amber
  creditsDanger: '#EF4444',  // >100% Red
};

// 根据使用比例返回 Credits 进度条颜色
export function getCreditsColor(ratio: number): string {
  if (ratio > 1) return themeColors.creditsDanger;
  if (ratio >= 0.7) return themeColors.creditsWarning;
  return themeColors.creditsSafe;
}

// 根据使用比例返回 Credits 进度条渐变颜色（深色端）
export function getCreditsDarkColor(ratio: number): string {
  if (ratio > 1) return '#DC2626';
  if (ratio >= 0.7) return '#D97706';
  return '#059669';
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
  },
};