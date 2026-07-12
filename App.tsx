import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, AppState, NativeModules } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  PaperProvider,
  FAB,
} from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

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
import { fetchCopilotCreditsUsed } from './src/api/copilot';
import { getCopilotConfig, saveCopilotConfig, clearCopilotConfig } from './src/utils/secureStorage';
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
import { DayType, type DayInfo, type CreditsData, type CopilotConfig, DEFAULT_TOTAL_CREDITS, DEFAULT_USED_CREDITS } from './src/types';
import { paperTheme, themeColors } from './src/theme';
import { expo } from './app.json';

// 应用版本号 —— 以 app.json 为单一真源，debug 构建加 "Dev" 前缀
const APP_VERSION = expo.version;
const VERSION_LABEL = `${__DEV__ ? 'Dev ' : ''}Ver ${APP_VERSION}`;

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
  const [copilotConfig, setCopilotConfig] = useState<CopilotConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const dbReady = useRef(false);
  const workdaysCache = useRef<Map<string, DayInfo[]>>(new Map());
  const creditsCache = useRef<Map<string, CreditsData>>(new Map());
  const copilotConfigRef = useRef<CopilotConfig | null>(null);
  const yearRef = useRef(year);
  const monthRef = useRef(month);
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

  // 从 GitHub Copilot 拉取当前周期已用额度（非阻塞，失败静默保留旧值）
  const refreshCopilotUsed = useCallback(async (y: number, m: number) => {
    const cfg = copilotConfigRef.current;
    if (!cfg) return;
    // 未来月不拉取，避免用 0 覆盖手动值
    if (y > today.year || (y === today.year && m > today.month)) return;
    try {
      const used = await fetchCopilotCreditsUsed(cfg.username, cfg.token, y, m);
      const cur = creditsCache.current.get(getCacheKey(y, m)) ?? await getCredits(y, m);
      await upsertCredits(y, m, cur.totalCredits, used);
      const updated = await getCredits(y, m);
      creditsCache.current.set(getCacheKey(y, m), updated);
      // 仅当用户仍在看该月时更新 UI
      if (yearRef.current === y && monthRef.current === m) setCredits(updated);
    } catch {
      // 静默失败，保留旧值
    }
  }, [today.year, today.month, getCacheKey]);

  // 镜像 state 到 ref，供异步回调读取最新值
  useEffect(() => { yearRef.current = year; }, [year]);
  useEffect(() => { monthRef.current = month; }, [month]);
  useEffect(() => { copilotConfigRef.current = copilotConfig; }, [copilotConfig]);

  // 初次加载 + 月份切换
  useEffect(() => {
    loadMonth(year, month);
  }, [year, month, loadMonth]);

  // 启动时加载 Copilot 配置
  useEffect(() => {
    getCopilotConfig().then(setCopilotConfig);
  }, []);

  // 配置存在时：启动后配置加载完成 / 切月 / 保存配置后，自动拉取已用额度
  useEffect(() => {
    if (copilotConfig) refreshCopilotUsed(year, month);
  }, [year, month, copilotConfig, refreshCopilotUsed]);

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
  const handleSaveCredits = async (
    total: number,
    used: number,
    config: CopilotConfig | null
  ) => {
    await upsertCredits(year, month, total, used);
    if (config) await saveCopilotConfig(config.username, config.token);
    else await clearCopilotConfig();
    copilotConfigRef.current = config;
    setCopilotConfig(config);
    const updated = await getCredits(year, month);
    creditsCache.current.set(getCacheKey(year, month), updated);
    setCredits(updated);
    setEditorVisible(false);
    // 保存配置后立即触发一次拉取（若 config 非空）
    if (config) refreshCopilotUsed(year, month);
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
                workdayPercent={workdayPercent}
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

              <Text style={styles.versionText}>{VERSION_LABEL}</Text>
            </ScrollView>

          {/* Credits 编辑弹窗 */}
          <CreditsEditor
            visible={editorVisible}
            totalCredits={credits.totalCredits}
            usedCredits={credits.usedCredits}
            monthTitle={monthTitle}
            copilotConfig={copilotConfig}
            onSave={handleSaveCredits}
            onClose={() => setEditorVisible(false)}
          />

          <FAB
            icon="refresh"
            style={styles.fab}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (!copilotConfigRef.current) {
                setEditorVisible(true);
                return;
              }
              setRefreshing(true);
              refreshCopilotUsed(year, month).finally(() => setRefreshing(false));
            }}
            loading={refreshing}
            color="#FFFFFF"
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
    padding: 20,
    paddingTop: 20,
  },
  versionText: {
    textAlign: 'center',
    color: themeColors.textMuted,
    fontSize: 12,
    marginTop: 18,
    marginBottom: 16,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: themeColors.primary,
    borderRadius: 16,
  },
});