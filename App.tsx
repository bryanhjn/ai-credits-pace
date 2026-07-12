import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, View, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  PaperProvider,
  Text,
  Divider,
} from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import WorkdayProgress from './src/components/WorkdayProgress';
import CreditsProgress from './src/components/CreditsProgress';
import MonthCalendar from './src/components/MonthCalendar';
import CreditsEditor from './src/components/CreditsEditor';

import { getDatabase } from './src/db/database';
import {
  hasWorkdaysCache,
  getWorkdays,
  saveWorkdays,
  getCredits,
  upsertCredits,
} from './src/db/queries';
import { fetchHolidaysForMonth, buildMonthDays } from './src/api/holidays';
import {
  countTotalWorkdays,
  countPassedWorkdays,
  calcProgressPercent,
  calcCreditsRatio,
} from './src/utils/workdayCalc';
import {
  getToday,
  formatMonthTitle,
} from './src/utils/dateHelpers';
import { type DayInfo, type CreditsData, DEFAULT_TOTAL_CREDITS, DEFAULT_USED_CREDITS } from './src/types';
import { paperTheme, themeColors } from './src/theme';

export default function App() {
  const today = getToday();
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [workdays, setWorkdays] = useState<DayInfo[]>([]);
  const [credits, setCredits] = useState<CreditsData>({
    year: today.year,
    month: today.month,
    totalCredits: DEFAULT_TOTAL_CREDITS,
    usedCredits: DEFAULT_USED_CREDITS,
    updatedAt: '',
  });
  const [loading, setLoading] = useState(true);
  const [editorVisible, setEditorVisible] = useState(false);
  const dbReady = useRef(false);
  const workdaysCache = useRef<Map<string, DayInfo[]>>(new Map());
  const creditsCache = useRef<Map<string, CreditsData>>(new Map());
  const getCacheKey = useCallback((y: number, m: number) => `${y}-${m}`, []);

  // 加载某月数据
  const loadMonth = useCallback(async (y: number, m: number) => {
    const cacheKey = getCacheKey(y, m);
    const cachedWorkdays = workdaysCache.current.get(cacheKey);
    const cachedCredits = creditsCache.current.get(cacheKey);

    setLoading(true);

    if (cachedWorkdays && cachedCredits) {
      // 缓存命中：短暂显示 Loading 以提供月份切换的视觉反馈
      await new Promise(resolve => setTimeout(resolve, 300));
      setWorkdays(cachedWorkdays);
      setCredits(cachedCredits);
      setLoading(false);
      return;
    }

    try {
      if (!dbReady.current) {
        await getDatabase();
        dbReady.current = true;
      }

      const hasCache = await hasWorkdaysCache(y, m);
      if (!hasCache) {
        try {
          const days = await fetchHolidaysForMonth(y, m);
          await saveWorkdays(y, m, days);
        } catch {
          const fallbackDays = buildMonthDays(y, m, []);
          await saveWorkdays(y, m, fallbackDays);
        }
      }
      const days = await getWorkdays(y, m);
      workdaysCache.current.set(cacheKey, days);
      setWorkdays(days);

      const c = await getCredits(y, m);
      creditsCache.current.set(cacheKey, c);
      setCredits(c);
    } catch (e) {
      const fallbackDays = buildMonthDays(y, m, []);
      workdaysCache.current.set(cacheKey, fallbackDays);
      setWorkdays(fallbackDays);
      const c = await getCredits(y, m).catch(() => ({
        year: y,
        month: m,
        totalCredits: DEFAULT_TOTAL_CREDITS,
        usedCredits: DEFAULT_USED_CREDITS,
        updatedAt: '',
      }));
      creditsCache.current.set(cacheKey, c);
      setCredits(c);
    } finally {
      setLoading(false);
    }
  }, [getCacheKey]);

  // 初次加载 + 月份切换
  useEffect(() => {
    loadMonth(year, month);
  }, [year, month, loadMonth]);

  // 计算工作日进度
  const totalWorkdays = countTotalWorkdays(workdays);
  let passedWorkdays = 0;
  if (year < today.year || (year === today.year && month < today.month)) {
    passedWorkdays = totalWorkdays;
  } else if (year === today.year && month === today.month) {
    passedWorkdays = countPassedWorkdays(workdays, today.day);
  }
  const workdayPercent = calcProgressPercent(passedWorkdays, totalWorkdays);

  // 计算 Credits 进度
  const creditsRatio = calcCreditsRatio(credits.usedCredits, credits.totalCredits);
  const creditsPercent = Math.round(creditsRatio * 1000) / 10;

  // 保存 Credits
  const handleSaveCredits = async (total: number, used: number) => {
    await upsertCredits(year, month, total, used);
    const updated = await getCredits(year, month);
    creditsCache.current.set(getCacheKey(year, month), updated);
    setCredits(updated);
    setEditorVisible(false);
  };

  const monthTitle = formatMonthTitle(year, month);

  return (
    <PaperProvider theme={paperTheme}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container} edges={['top']}>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={themeColors.primary} />
              <Text variant="bodyMedium" style={styles.loadingText}>加载中...</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              {/* 工作日进度条 */}
              <WorkdayProgress
                passed={passedWorkdays}
                total={totalWorkdays}
                percent={workdayPercent}
                monthTitle={monthTitle}
              />

              {/* AI Credits 进度条 */}
              <CreditsProgress
                used={credits.usedCredits}
                total={credits.totalCredits}
                percent={creditsPercent}
                onEdit={() => setEditorVisible(true)}
              />

              {/* 日历 */}
              <MonthCalendar
                year={year}
                month={month}
                days={workdays}
                onMonthChange={(y, m) => {
                  setYear(y);
                  setMonth(m);
                }}
              />

              {/* 图例 */}
              <View style={styles.legend}>
                <LegendChip color={themeColors.workday} label="工作日" />
                <LegendChip color={themeColors.weekend} label="周末" />
                <LegendChip color={themeColors.holiday} label="节假日" />
                <LegendChip color={themeColors.adjustedWorkday} label="调休补班" />
              </View>

              <View style={styles.bottomSpacer} />
            </ScrollView>
          )}

          {/* Credits 编辑弹窗 */}
          <CreditsEditor
            visible={editorVisible}
            totalCredits={credits.totalCredits}
            usedCredits={credits.usedCredits}
            monthTitle={monthTitle}
            onSave={handleSaveCredits}
            onClose={() => setEditorVisible(false)}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </PaperProvider>
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
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: themeColors.background,
  },
  loadingText: {
    marginTop: 16,
    color: themeColors.textSecondary,
  },
  scroll: {
    padding: 16,
    paddingTop: 16,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  legendChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendChipText: {
    color: themeColors.textSecondary,
  },
  divider: {
    marginVertical: 16,
    backgroundColor: themeColors.divider,
  },
  bottomSpacer: {
    height: 32,
  },
});