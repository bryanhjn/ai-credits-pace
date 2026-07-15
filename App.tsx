import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, AppState, NativeModules, RefreshControl, Animated, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  PaperProvider,
} from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
import { getCloudFunctionConfig, saveCloudFunctionConfig, clearCloudFunctionConfig } from './src/utils/secureStorage';
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
import { DayType, type DayInfo, type CreditsData, type CloudFunctionConfig, DEFAULT_TOTAL_CREDITS, DEFAULT_USED_CREDITS } from './src/types';
import { paperTheme, themeColors } from './src/theme';
import { expo } from './app.json';

// 应用版本号 —— 以 app.json 为单一真源，debug 构建加 "Dev" 前缀
const APP_VERSION = expo.version;
const VERSION_LABEL = `${__DEV__ ? 'Dev ' : ''}Ver ${APP_VERSION}`;

// 屏幕物理纵向分辨率 > 2700 时，内容已可一屏展示，禁用滚动
const screenInfo = Dimensions.get('screen');
const SCREEN_HEIGHT_PX = screenInfo.height * screenInfo.scale;
const SCROLL_ENABLED = SCREEN_HEIGHT_PX <= 2700;

// 自动刷新节流间隔：距上次刷新不足 15 分钟时跳过自动刷新（手动刷新不受影响）
const AUTO_REFRESH_THROTTLE_MS = 15 * 60 * 1000;

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
  const [cfConfig, setCfConfig] = useState<CloudFunctionConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // 顶部反馈条：云函数查询成功/失败时短暂展示
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbReady = useRef(false);
  const workdaysCache = useRef<Map<string, DayInfo[]>>(new Map());
  const creditsCache = useRef<Map<string, CreditsData>>(new Map());
  const cfConfigRef = useRef<CloudFunctionConfig | null>(null);
  const yearRef = useRef(year);
  const monthRef = useRef(month);
  // 上次成功刷新的时间戳，用于自动刷新节流（手动刷新不受限）
  const lastRefreshAtRef = useRef(0);
  // 标记冷启动时 cfConfig 是否已加载，加载完成时触发一次自动刷新
  const cfConfigLoadedRef = useRef(false);
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

  // 顶部反馈条：滑入展示后 2.4s 自动滑出
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 2400);
  }, [toastAnim]);

  // 从云函数拉取当前周期已用额度（非阻塞，失败保留旧值，顶部反馈结果）
  const refreshCopilotUsed = useCallback(async (y: number, m: number) => {
    const cfg = cfConfigRef.current;
    if (!cfg) return;
    // 未来月不拉取，避免用 0 覆盖手动值
    if (y > today.year || (y === today.year && m > today.month)) return;
    try {
      const used = await fetchCopilotCreditsUsed(cfg.endpoint, cfg.secret, y, m);
      const cur = creditsCache.current.get(getCacheKey(y, m)) ?? await getCredits(y, m);
      await upsertCredits(y, m, cur.totalCredits, used);
      const updated = await getCredits(y, m);
      creditsCache.current.set(getCacheKey(y, m), updated);
      // 仅当用户仍在看该月时更新 UI
      if (yearRef.current === y && monthRef.current === m) setCredits(updated);
      // 记录成功刷新时间，用于自动刷新节流（手动刷新同样更新该时间）
      lastRefreshAtRef.current = Date.now();
      showToast('已更新 Copilot 用量', 'success');
    } catch {
      // 失败保留旧值，顶部反馈
      showToast('查询失败，已保留上次数据', 'error');
    }
  }, [today.year, today.month, getCacheKey, showToast]);

  // 自动刷新：受 15 分钟节流限制，距上次刷新不足阈值则静默跳过
  // 用于冷启动与后台恢复；手动刷新（下拉/保存配置）直接调用 refreshCopilotUsed 不受限
  const autoRefreshCopilot = useCallback((y: number, m: number) => {
    if (Date.now() - lastRefreshAtRef.current < AUTO_REFRESH_THROTTLE_MS) return;
    refreshCopilotUsed(y, m);
  }, [refreshCopilotUsed]);

  // 镜像 state 到 ref，供异步回调读取最新值
  useEffect(() => { yearRef.current = year; }, [year]);
  useEffect(() => { monthRef.current = month; }, [month]);
  useEffect(() => { cfConfigRef.current = cfConfig; }, [cfConfig]);

  // 初次加载 + 月份切换
  useEffect(() => {
    loadMonth(year, month);
  }, [year, month, loadMonth]);

  // 启动时加载 Copilot 配置
  useEffect(() => {
    getCloudFunctionConfig().then(setCfConfig);
  }, []);

  // 冷启动：cfConfig 首次加载完成时触发一次自动刷新（切换月份不触发，避免重复请求）
  useEffect(() => {
    if (cfConfig && !cfConfigLoadedRef.current) {
      cfConfigLoadedRef.current = true;
      autoRefreshCopilot(yearRef.current, monthRef.current);
    }
  }, [cfConfig, autoRefreshCopilot]);

  // app 切回前台时：触发自动刷新（受节流限制）并通知桌面组件刷新
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        autoRefreshCopilot(yearRef.current, monthRef.current);
        NativeModules.WidgetRefreshModule?.refreshWidget();
      }
    });
    return () => sub.remove();
  }, [autoRefreshCopilot]);

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
    config: CloudFunctionConfig | null
  ) => {
    await upsertCredits(year, month, total, used);
    if (config) await saveCloudFunctionConfig(config.endpoint, config.secret);
    else await clearCloudFunctionConfig();
    cfConfigRef.current = config;
    setCfConfig(config);
    const updated = await getCredits(year, month);
    creditsCache.current.set(getCacheKey(year, month), updated);
    setCredits(updated);
    setEditorVisible(false);
    // 保存配置后立即触发一次拉取（若 config 非空）
    if (config) refreshCopilotUsed(year, month);
  };

  // 滑动加减已用 Credits：乐观更新 UI + 持久化到 DB
  // 没缓存（月份未加载完成）时拒绝调整，避免误改其他月份数据
  const handleAdjustUsed = useCallback(async (delta: number) => {
    if (delta === 0) return;
    const cacheKey = getCacheKey(year, month);
    const cur = creditsCache.current.get(cacheKey);
    if (!cur) return;
    const newUsed = Math.max(0, cur.usedCredits + delta);
    if (newUsed === cur.usedCredits) return;
    const updated = { ...cur, usedCredits: newUsed };
    creditsCache.current.set(cacheKey, updated);
    setCredits(updated);
    try {
      await upsertCredits(year, month, cur.totalCredits, newUsed);
    } catch {
      // 静默失败：UI 已乐观更新，下次加载回退到 DB 值
    }
  }, [year, month, getCacheKey]);

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
            {toast && (
              <View pointerEvents="none" style={styles.toastWrap}>
                <Animated.View
                  style={[
                    styles.toast,
                    styles[toast.type === 'success' ? 'toastSuccess' : 'toastError'],
                    {
                      opacity: toastAnim,
                      transform: [{
                        translateY: toastAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-48, 0],
                        }),
                      }],
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={toast.type === 'success' ? 'check-circle' : 'alert-circle'}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.toastText}>{toast.message}</Text>
                </Animated.View>
              </View>
            )}
            <ScrollView
              scrollEnabled={SCROLL_ENABLED}
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    if (!cfConfigRef.current) return;
                    setRefreshing(true);
                    refreshCopilotUsed(year, month).finally(() => setRefreshing(false));
                  }}
                  tintColor={themeColors.primary}
                  colors={[themeColors.primary]}
                />
              }
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
                onAdjustUsed={handleAdjustUsed}
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
            cloudFunctionConfig={cfConfig}
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
    padding: 20,
    paddingTop: 20,
  },
  versionText: {
    textAlign: 'center',
    color: themeColors.textMuted,
    fontSize: 12,
    marginTop: 28,
    marginBottom: 16,
  },
  toastWrap: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  toastSuccess: {
    backgroundColor: themeColors.creditsSafe,
  },
  toastError: {
    backgroundColor: themeColors.creditsDanger,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});