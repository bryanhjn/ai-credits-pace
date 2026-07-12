import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { IconButton, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DayType, type DayInfo } from '../types';
import { themeColors } from '../theme';
import { toIsoDate, getToday } from '../utils/dateHelpers';
import CardLoading from './CardLoading';

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

export default function MonthCalendar({ year, month, days, onMonthChange, editMode, onToggleEdit, onDayPress, loading }: Props) {
  const today = getToday();

  const markedDates = useMemo(() => {
    const marks: Record<string, { customStyles: { container: object; text: object }; selected?: boolean }> = {};

    for (const d of days) {
      let bgColor = 'transparent';
      let textColor = themeColors.textPrimary;

      switch (d.type) {
        case DayType.Workday:
          bgColor = themeColors.workdayLight;
          textColor = '#FFFFFF';
          break;
        case DayType.Weekend:
          bgColor = '#F1F5F9';
          textColor = themeColors.weekend;
          break;
        case DayType.Holiday:
          bgColor = themeColors.holidayLight;
          textColor = '#FFFFFF';
          break;
        case DayType.AdjustedWorkday:
          bgColor = themeColors.adjustedWorkdayLight;
          textColor = '#FFFFFF';
          break;
        case DayType.Overtime:
          bgColor = themeColors.overtimeLight;
          textColor = '#FFFFFF';
          break;
        case DayType.Leave:
          bgColor = themeColors.leaveLight;
          textColor = '#FFFFFF';
          break;
      }

      marks[d.dateIso] = {
        customStyles: {
          container: {
            backgroundColor: bgColor,
            borderRadius: 16,
            width: 32,
            height: 32,
            justifyContent: 'center',
            alignItems: 'center',
          },
          text: {
            color: textColor,
            fontWeight: '600',
            fontSize: 14,
          },
        },
      };
    }

    // 今天高亮：圆环边框
    if (today.year === year && today.month === month) {
      const todayKey = today.iso;
      const existing = marks[todayKey];
      if (existing) {
        existing.customStyles.container = {
          ...existing.customStyles.container,
          borderWidth: 2.5,
          borderColor: themeColors.today,
        };
      } else {
        marks[todayKey] = {
          customStyles: {
            container: {
              borderWidth: 2.5,
              borderColor: themeColors.today,
              borderRadius: 16,
              backgroundColor: themeColors.primaryBg,
              width: 32,
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
            },
            text: { color: themeColors.primary, fontWeight: '700', fontSize: 14 },
          },
        };
      }
    }

    return marks;
  }, [days, year, month, today]);

  const currentStr = `${year}-${String(month).padStart(2, '0')}`;

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
          onDayPress={editMode && onDayPress ? (d) => onDayPress(d.dateString) : undefined}
          markedDates={markedDates}
          markingType="custom"
          renderArrow={(direction: string) => (
            <MaterialCommunityIcons
              name={direction === 'left' ? 'chevron-left' : 'chevron-right'}
              size={28}
              color={themeColors.primary}
            />
          )}
          theme={{
            backgroundColor: 'transparent',
            calendarBackground: 'transparent',
            todayTextColor: themeColors.today,
            todayBackgroundColor: 'transparent',
            arrowColor: themeColors.primary,
            monthTextColor: themeColors.textPrimary,
            textMonthFontSize: 17,
            textMonthFontWeight: '700',
            textDayHeaderFontSize: 13,
            textDayHeaderFontWeight: '600',
            textDayFontSize: 14,
            textDayFontWeight: '500',
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
              },
            },
          } as any}
          style={styles.calendar}
        />
        {/* 编辑/保存按钮 */}
        {onToggleEdit && (
          <IconButton
            icon={editMode ? 'content-save' : 'pencil'}
            size={20}
            onPress={onToggleEdit}
            iconColor={editMode ? themeColors.primary : themeColors.textSecondary}
            style={styles.editBtn}
            accessibilityLabel={editMode ? '保存' : '编辑日历'}
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
    borderRadius: 16,
    padding: 8,
    elevation: 2,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  calendarContainer: {
    position: 'relative',
  },
  calendar: {
    borderRadius: 12,
  },
  editBtn: {
    position: 'absolute',
    top: 6,
    right: 0,
    margin: 0,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.surfaceVariant,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 18,
    gap: 5,
  },
  legendChipDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  legendChipText: {
    color: themeColors.textSecondary,
    fontSize: 12,
  },
});