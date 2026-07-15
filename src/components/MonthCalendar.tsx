import React, { useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { DayType, type DayInfo } from '../types';
import { themeColors } from '../theme';
import { toIsoDate, getToday } from '../utils/dateHelpers';
import CardLoading from './CardLoading';
import GlassIconButton from './GlassIconButton';

// 配置中文 locale
LocaleConfig.locales['zh'] = {
  monthNames: [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月',
  ],
  monthNamesShort: [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月',
  ],
  dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  dayNamesShort: ['日', '一', '二', '三', '四', '五', '六'],
};
LocaleConfig.defaultLocale = 'zh';

interface Props {
  year: number;
  month: number;
  days: DayInfo[];
  onMonthChange: (year: number, month: number) => void;
  editMode?: boolean;
  onToggleEdit?: () => void;
  onDayPress?: (dateIso: string) => void;
  loading?: boolean;
}

// 自定义日期单元格组件 —— 使用 SVG 径向渐变实现边缘高斯模糊
function DayComponent({ date, state, marking, onPress, children }: any) {
  const dayNumber = date?.day;
  if (dayNumber === undefined) {
    return <View style={{ width: 32, height: 32 }} />;
  }

  const customStyles = marking?.customStyles;
  const containerStyle = customStyles?.container || {};
  const textStyle = customStyles?.text || {};
  const bgColor: string = containerStyle.backgroundColor || 'transparent';
  const textColor: string = textStyle.color || themeColors.textPrimary;
  const fontWeight = (textStyle.fontWeight || '600') as '600' | '700';
  const isToday = containerStyle.borderColor === themeColors.today;
  const isDisabled = state === 'disabled';
  const isInactive = state === 'inactive';
  const dateString: string = date?.dateString || '';

  if (isDisabled || isInactive) {
    return (
      <View style={cellStyles.base}>
        <Text style={cellStyles.mutedText}>{children}</Text>
      </View>
    );
  }

  if (bgColor === 'transparent') {
    return (
      <TouchableOpacity onPress={() => onPress?.(date)} activeOpacity={0.6}>
        <View style={cellStyles.base}>
          <Text style={[cellStyles.dayText, { color: textColor, fontWeight }]}>{children}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const gradientId = `rg-${dateString.replace(/-/g, '')}`;

  return (
    <TouchableOpacity onPress={() => onPress?.(date)} activeOpacity={0.6}>
      <View style={[cellStyles.base, isToday && cellStyles.todayRing]}>
        <Svg width={32} height={32} style={cellStyles.svgLayer}>
          <Defs>
            <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
              <Stop offset="75%" stopColor={bgColor} stopOpacity="1" />
              <Stop offset="100%" stopColor={bgColor} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="16" cy="16" r="16" fill={`url(#${gradientId})`} />
        </Svg>
        <Text style={[cellStyles.dayText, { color: textColor, fontWeight }]}>{children}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MonthCalendar({ year, month, days, onMonthChange, editMode, onToggleEdit, onDayPress, loading }: Props) {
  const today = getToday();

  const markedDates = useMemo(() => {
    const marks: Record<string, { customStyles: { container: object; text: object }; selected?: boolean }> = {};

    for (const d of days) {
      let bgColor = 'transparent';
      let textColor = themeColors.textPrimary;

      switch (d.type) {
        case DayType.Workday:
          bgColor = themeColors.workdayTint;
          textColor = themeColors.workdayText;
          break;
        case DayType.Weekend:
          bgColor = themeColors.weekendTint;
          textColor = themeColors.weekendText;
          break;
        case DayType.Holiday:
          bgColor = themeColors.holidayTint;
          textColor = themeColors.holidayText;
          break;
        case DayType.AdjustedWorkday:
          bgColor = themeColors.adjustedWorkdayTint;
          textColor = themeColors.adjustedWorkdayText;
          break;
        case DayType.Overtime:
          bgColor = themeColors.overtimeTint;
          textColor = themeColors.overtimeText;
          break;
        case DayType.Leave:
          bgColor = themeColors.leaveTint;
          textColor = themeColors.leaveText;
          break;
      }

      marks[d.dateIso] = {
        customStyles: {
          container: {
            backgroundColor: bgColor,
          },
          text: {
            color: textColor,
            fontWeight: '600',
            fontSize: 14,
          },
        },
      };
    }

    // 今天高亮：精致圆环
    if (today.year === year && today.month === month) {
      const todayKey = today.iso;
      const existing = marks[todayKey];
      if (existing) {
        existing.customStyles.container = {
          ...existing.customStyles.container,
          borderWidth: 2,
          borderColor: themeColors.today,
        };
        existing.customStyles.text = {
          ...existing.customStyles.text,
          color: themeColors.primaryDark,
          fontWeight: '700',
        };
      } else {
        marks[todayKey] = {
          customStyles: {
            container: {
              borderWidth: 2,
              borderColor: themeColors.today,
              backgroundColor: themeColors.primaryBg,
            },
            text: { color: themeColors.primaryDark, fontWeight: '700', fontSize: 14 },
          },
        };
      }
    }

    return marks;
  }, [days, year, month, today]);

  const currentStr = `${year}-${String(month).padStart(2, '0')}`;

  const handleToggleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleEdit?.();
  };

  const handleDayPress = editMode && onDayPress
    ? (d: { dateString: string }) => {
        Haptics.selectionAsync();
        onDayPress(d.dateString);
      }
    : undefined;

  return (
    <View style={styles.wrapper}>
      <CardLoading loading={!!loading} />
      <View style={styles.calendarContainer}>
        <Calendar
          current={currentStr}
          minDate={`${year - 1}-01-01`}
          maxDate={`${year + 1}-12-31`}
          monthFormat="yyyy年M月"
          onMonthChange={(date) => {
            onMonthChange(date.year, date.month);
          }}
          onDayPress={handleDayPress}
          markedDates={markedDates}
          markingType="custom"
          dayComponent={DayComponent}
          renderArrow={(direction: string) => (
            <MaterialCommunityIcons
              name={direction === 'left' ? 'chevron-left' : 'chevron-right'}
              size={26}
              color={themeColors.primary}
            />
          )}
          theme={{
            backgroundColor: 'transparent',
            calendarBackground: 'transparent',
            weekVerticalMargin: 5,
            todayTextColor: themeColors.today,
            todayBackgroundColor: 'transparent',
            arrowColor: themeColors.primary,
            monthTextColor: themeColors.textPrimary,
            textMonthFontSize: 18,
            textMonthFontWeight: '700',
            textDayHeaderFontSize: 12,
            textDayHeaderFontWeight: '600',
            textDayFontSize: 14,
            textDayFontWeight: '600',
            dayTextColor: themeColors.textPrimary,
            textDisabledColor: themeColors.textMuted,
            selectedDayBackgroundColor: 'transparent',
            selectedDayTextColor: themeColors.textPrimary,
            'stylesheet.calendar.header': {
              header: {
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 12,
                alignItems: 'center',
                marginTop: -4,
              },
            },
          } as any}
          style={styles.calendar}
        />
        {/* 编辑/保存按钮 */}
        {onToggleEdit && (
          <GlassIconButton
            name={editMode ? 'check' : 'pencil-outline'}
            active={editMode}
            onPress={handleToggleEdit}
            accessibilityLabel={editMode ? '保存' : '编辑日历'}
            style={styles.editBtn}
          />
        )}
      </View>
      {/* 图例 */}
      <View style={styles.legend}>
        <LegendChip color={themeColors.workday} label="工作日" />
        <LegendChip color={themeColors.weekend} label="周末" />
        <LegendChip color={themeColors.holiday} label="节假日" />
        <LegendChip color={themeColors.adjustedWorkday} label="调休" />
        <LegendChip color={themeColors.leave} label="请假" />
        <LegendChip color={themeColors.overtime} label="加班" />
      </View>
    </View>
  );
}

// 图例 Chip 组件
function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendChip}>
      <View style={[styles.legendChipDot, { backgroundColor: color }]} />
      <Text variant="labelSmall" style={styles.legendChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    backgroundColor: themeColors.surface,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: themeColors.hairline,
    elevation: 6,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.20,
    shadowRadius: 20,
  },
  calendarContainer: {
    position: 'relative',
  },
  calendar: {
    borderRadius: 12,
  },
  editBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    margin: 0,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 5,
  },
  legendChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendChipText: {
    color: themeColors.textMuted,
    fontSize: 11,
    letterSpacing: 0.2,
  },
});

// 日期单元格组件的样式
const cellStyles = StyleSheet.create({
  base: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayRing: {
    borderWidth: 2,
    borderColor: themeColors.today,
    borderRadius: 16,
  },
  svgLayer: {
    position: 'absolute',
  },
  dayText: {
    fontSize: 14,
  },
  mutedText: {
    color: themeColors.textMuted,
    fontSize: 14,
  },
});
