import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, View, StyleSheet, AppState, NativeModules } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  PaperProvider,
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
  updateWorkdayType,
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
import { DayType, type DayInfo, type CreditsData, DEFAULT_TOTAL_CREDITS, DEFAULT_USED_CREDITS } from './src/types';
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
  const [editMode, setEditMode] = useState(false);
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

  // app 切回前台时通知桌面组件刷新
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        NativeModules.WidgetRefreshModule?.refreshWidget();
      }
    });
    return () => sub.remove();
  }, []);

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

  // 编辑模式：点击日期切换加班/请假
  const handleDayPress = useCallback(async (dateIso: string) => {
    const idx = workdays.findIndex((d) => d.dateIso === dateIso);
    if (idx === -1) return;
    const day = workdays[idx];

    let newType: DayType;
    let newOriginal: DayType | null;
    switch (day.type) {
      case DayType.Workday:
      case DayType.AdjustedWorkday:
        newType = DayType.Leave;
        newOriginal = day.type;
        break;
      case DayType.Weekend:
      case DayType.Holiday:
        newType = DayType.Overtime;
        newOriginal = day.type;
        break;
      case DayType.Overtime:
        newType = day.originalType ?? DayType.Weekend;
        newOriginal = null;
        break;
      case DayType.Leave:
        newType = day.originalType ?? DayType.Workday;
        newOriginal = null;
        break;
    }

    await updateWorkdayType(year, month, day.day, newType, newOriginal);

    const updatedDay: DayInfo = { ...day, type: newType, originalType: newOriginal };
    const updatedWorkdays = [...workdays];
    updatedWorkdays[idx] = updatedDay;
    setWorkdays(updatedWorkdays);

    const cacheKey = getCacheKey(year, month);
    const cached = workdaysCache.current.get(cacheKey);
    if (cached) {
      const updatedCache = [...cached];
      const cacheIdx = cached.findIndex((d) => d.dateIso === dateIso);
      if (cacheIdx !== -1) {
        updatedCache[cacheIdx] = updatedDay;
        workdaysCache.current.set(cacheKey, updatedCache);
      }
    }
  }, [workdays, year, month, getCacheKey]);

  const monthTitle = formatMonthTitle(year, month);

  return (
    <PaperProvider theme={paperTheme}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container} edges={['top']}>
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
                loading={loading}
              />

              {/* AI Credits 进度条 */}
              <CreditsProgress
                used={credits.usedCredits}
                total={credits.totalCredits}
                percent={creditsPercent}
                onEdit={() => setEditorVisible(true)}
                loading={loading}
              />

              {/* 日历 */}
              <MonthCalendar
                year={year}
                month={month}
                days={workdays}
                onMonthChange={(y, m) => {
                  // 点击切换月份时第一时间显示 Loading
                  setLoading(true);
                  setYear(y);
                  setMonth(m);
                }}
                editMode={editMode}
                onToggleEdit={() => setEditMode(!editMode)}
                onDayPress={handleDayPress}
                loading={loading}
              />

              <View style={styles.bottomSpacer} />
            </ScrollView>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  scroll: {
    padding: 16,
    paddingTop: 16,
  },
  bottomSpacer: {
    height: 32,
  },
});