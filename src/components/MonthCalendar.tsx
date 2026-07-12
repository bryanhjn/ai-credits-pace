import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { DayType, type DayInfo } from '../types';
import { themeColors } from '../theme';
import { toIsoDate, getToday } from '../utils/dateHelpers';

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
}

export default function MonthCalendar({ year, month, days, onMonthChange }: Props) {
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
      <Calendar
        current={currentStr}
        minDate={`${year - 1}-01-01`}
        maxDate={`${year + 1}-12-31`}
        onMonthChange={(date) => {
          onMonthChange(date.year, date.month);
        }}
        markedDates={markedDates}
        markingType="custom"
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
        }}
        style={styles.calendar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: themeColors.surface,
    borderRadius: 16,
    padding: 8,
    elevation: 2,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  calendar: {
    borderRadius: 12,
  },
});