# VIVO 桌面组件 (2x2) 实现计划

## Summary

为「月度工作日进度」应用增加一个 2x2 的 Android 桌面组件，显示**工作日进度条**和 **AI Credits 进度条**两条横向进度条（左右对齐、等宽），进度条下方显示文字 `工作日：xx.x%` 和 `Credits：xx.x%`。组件面向 VIVO OriginOS/Funtouch 桌面，使用标准 Android `AppWidgetProvider` API（无需 VIVO 专用 SDK）。数据计算逻辑从 `src/utils/workdayCalc.ts` 移植到 Kotlin，直接读取 `monthlyProgress.db`。

## 决策摘要（已与用户确认）

| 决策点 | 选择 |
|---|---|
| 小数位数 | **1 位小数**（与 app 内 `calcProgressPercent` 完全一致） |
| 配色方案 | **完全复用 app 配色**：工作日条 `#6366F1` 靛蓝；Credits 条按使用率动态变色（<70% 绿 `#10B981` / 70-100% 橙 `#F59E0B` / >100% 红 `#EF4444`） |
| 刷新策略 | **定时 30 分钟 + app 切到前台时通过原生模块广播刷新** |
| 实现架构 | **原生 Kotlin `AppWidgetProvider` + RemoteViews**（将 TS 计算公式移植到 Kotlin，不引入 JS 依赖） |

## Current State Analysis

基于 Phase 1 探索结论：

- **工作流**：Expo managed + 已 prebuild 出 `android/` 目录；New Architecture 已开启（`newArchEnabled=true`），Hermes 已开启。
- **现有组件**：无。`android/app/src/main/res/` 下不存在 `xml/` 和 `layout/` 目录；`AndroidManifest.xml` 中无任何 `<receiver>`。
- **包名**：`com.vibecoding.monthlyprogress`（Kotlin 源码位于 `android/app/src/main/java/com/vibecoding/monthlyprogress/`，仅有 `MainActivity.kt` 和 `MainApplication.kt`）。
- **进度计算逻辑**：纯函数位于 [workdayCalc.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/utils/workdayCalc.ts)，需移植到 Kotlin 的有：`isWorkdayType`、`countTotalWorkdays`、`countPassedWorkdays`、`calcProgressPercent`、`calcCreditsRatio`。
- **DayType 枚举**：位于 [types.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/types.ts)，工作日类型 = `{0: Workday, 3: AdjustedWorkday, 4: Overtime}`。
- **数据源**：SQLite `monthlyProgress.db`（DB 名见 [database.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/db/database.ts) 第 3 行 `const DB_NAME = 'monthlyProgress.db'`）。两张表：
  - `monthly_workdays` 列：`year, month, day, date_iso, type, name, original_type`
  - `monthly_credits` 列：`year, month, total_credits, used_credits, updated_at`
- **App 内计算逻辑**（[App.tsx](file:///d:/softwares/TRAE_prj/ai-credits-pace/App.tsx) 第 120-132 行）：
  - 过往月份 → `passedWorkdays = totalWorkdays`
  - 当前月 → `countPassedWorkdays(workdays, today.day)`
  - 未来月份 → `passedWorkdays = 0`
  - Credits 百分比 = `Math.round(creditsRatio * 1000) / 10`（1 位小数）
- **配色常量**：[theme.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/theme.ts) 第 6 行主色 `#6366F1`，第 41-51 行 Credits 阈值配色与 `getCreditsColor()` 函数。
- **VIVO 相关**：无任何现有 VIVO 代码或依赖。VIVO 桌面兼容标准 Android AppWidget 框架，无需引入 VIVO SDK。

## Proposed Changes

### 1. 创建 widget 资源：`appwidget-provider` 元数据

**新建文件**：`android/app/src/main/res/xml/workday_widget_info.xml`

定义 2x2 组件尺寸与刷新周期：

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="180dp"
    android:targetCellWidth="2"
    android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_workday"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:previewImage="@mipmap/ic_launcher" />
```

- `updatePeriodMillis="1800000"` = 30 分钟（Android 系统最短允许值）
- `targetCellWidth/Height=2` 用于 API 31+ 精确 2x2 单元格；`minWidth/Height=180dp` 兼容旧版包括 VIVO OriginOS

### 2. 创建 widget 布局：两条进度条 + 文字

**新建文件**：`android/app/src/main/res/layout/widget_workday.xml`

垂直 LinearLayout，自上而下：工作日进度条 → Credits 进度条 → 工作日文字 → Credits 文字。两条进度条 `layout_width="match_parent"` 实现「左右对齐、等宽」。

```xml
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="12dp"
    android:background="@drawable/widget_background">

    <ProgressBar
        android:id="@+id/workday_bar"
        style="?android:attr/progressBarStyleHorizontal"
        android:layout_width="match_parent"
        android:layout_height="8dp"
        android:max="100"
        android:progress="0"
        android:progressTint="#6366F1" />

    <ProgressBar
        android:id="@+id/credits_bar"
        style="?android:attr/progressBarStyleHorizontal"
        android:layout_width="match_parent"
        android:layout_height="8dp"
        android:layout_marginTop="8dp"
        android:max="100"
        android:progress="0"
        android:progressTint="#10B981" />

    <TextView
        android:id="@+id/workday_text"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:text="工作日：0.0%"
        android:textSize="12sp"
        android:textColor="#1F2937" />

    <TextView
        android:id="@+id/credits_text"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:text="Credits：0.0%"
        android:textSize="12sp"
        android:textColor="#1F2937" />
</LinearLayout>
```

### 3. 创建圆角背景 drawable

**新建文件**：`android/app/src/main/res/drawable/widget_background.xml`

```xml
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FFFFFF" />
    <corners android:radius="16dp" />
</shape>
```

### 4. 创建 Kotlin Widget Provider（核心逻辑）

**新建文件**：`android/app/src/main/java/com/vibecoding/monthlyprogress/WorkdayWidgetProvider.kt`

职责：
1. 继承 `AppWidgetProvider`，重写 `onUpdate` 和 `onReceive`
2. 直接 `SQLiteDatabase.openDatabase(context.getDatabasePath("monthlyProgress.db")...)` 读取当月数据
3. 移植 `workdayCalc.ts` 的计算公式到 Kotlin
4. 根据 Credits 比率应用动态颜色
5. 构建 `RemoteViews`，更新两条 `ProgressBar` 的 `progress` 与 `progressTint`，更新两个 `TextView` 的文字
6. 设置 `PendingIntent` 让点击组件打开 app
7. 监听自定义 action `com.vibecoding.monthlyprogress.ACTION_REFRESH_WIDGET` 触发主动刷新

**移植的计算逻辑**（与 [workdayCalc.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/utils/workdayCalc.ts) 一一对应）：

```kotlin
// DayType: 0=Workday, 1=Weekend, 2=Holiday, 3=AdjustedWorkday, 4=Overtime, 5=Leave
private fun isWorkdayType(type: Int): Boolean = type == 0 || type == 3 || type == 4

private fun calcProgressPercent(passed: Int, total: Int): Double {
    if (total <= 0) return 0.0
    val pct = passed.toDouble() / total * 100
    return Math.round(pct * 10) / 10.0
}

private fun calcCreditsRatio(used: Int, total: Int): Double {
    if (total <= 0) return 0.0
    return used.toDouble() / total
}

private fun getCreditsColor(ratio: Double): Int = when {
    ratio < 0.7  -> 0xFF10B981.toInt()  // 绿
    ratio <= 1.0 -> 0xFFF59E0B.toInt()  // 橙
    else         -> 0xFFEF4444.toInt()  // 红
}
```

**数据查询逻辑**（与 [App.tsx](file:///d:/softwares/TRAE_prj/ai-credits-pace/App.tsx) 第 120-132 行一致）：
- 查询 `monthly_workdays WHERE year=? AND month=?` 得到当月所有 `day, type`
- `totalWorkdays = count { isWorkdayType(type) }`
- 当月：`passedWorkdays = count { day <= today.day && isWorkdayType(type) }`
- 过往月份：`passedWorkdays = totalWorkdays`
- 未来月份：`passedWorkdays = 0`
- 查询 `monthly_credits WHERE year=? AND month=?` 得到 `used_credits, total_credits`（无数据时用默认值 `total=3000, used=0`，见 [types.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/types.ts) 第 32-33 行）
- `workdayPercent = calcProgressPercent(passedWorkdays, totalWorkdays)`
- `creditsRatio = calcCreditsRatio(used, total)`
- `creditsPercent = Math.round(creditsRatio * 1000) / 10.0`

**DB 不存在或无数据的兜底**：若 DB 文件不存在或查询无结果，显示 `工作日：0.0%` 和 `Credits：0.0%`，进度条归零。不崩溃。

### 5. 创建原生模块：暴露「刷新组件」给 JS

**新建文件**：`android/app/src/main/java/com/vibecoding/monthlyprogress/WidgetRefreshModule.kt`

```kotlin
package com.vibecoding.monthlyprogress

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class WidgetRefreshModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "WidgetRefreshModule"
    @ReactMethod
    fun refreshWidget() {
        val intent = Intent(reactApplicationContext, WorkdayWidgetProvider::class.java).apply {
            action = "com.vibecoding.monthlyprogress.ACTION_REFRESH_WIDGET"
        }
        reactApplicationContext.sendBroadcast(intent)
    }
}
```

**新建文件**：`android/app/src/main/java/com/vibecoding/monthlyprogress/WidgetRefreshPackage.kt`

```kotlin
package com.vibecoding.monthlyprogress

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WidgetRefreshPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(WidgetRefreshModule(reactContext))
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
```

### 6. 注册原生模块到 MainApplication

**修改文件**：`android/app/src/main/java/com/vibecoding/monthlyprogress/MainApplication.kt`

在 `PackageList(this).packages.apply { ... }` 块内添加 `add(WidgetRefreshPackage())`（当前该块仅含注释占位，见探索结论第 5 节）。

### 7. 注册 Widget Receiver 到 AndroidManifest

**修改文件**：`android/app/src/main/AndroidManifest.xml`

在 `<application>` 标签内、`MainActivity` 之后添加：

```xml
<receiver
    android:name=".WorkdayWidgetProvider"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="com.vibecoding.monthlyprogress.ACTION_REFRESH_WIDGET"/>
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/workday_widget_info"/>
</receiver>
```

### 8. JS 端：app 切前台时调用刷新

**修改文件**：`App.tsx`

添加 `AppState` 监听器，当 state 变为 `'active'` 时调用 `NativeModules.WidgetRefreshModule.refreshWidget()`。

```ts
import { NativeModules, AppState } from 'react-native'

// 在 App 组件内 useEffect 中：
useEffect(() => {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      NativeModules.WidgetRefreshModule?.refreshWidget()
    }
  })
  return () => sub.remove()
}, [])
```

使用可选链 `?.` 保护：若原生模块未注册（如调试构建未包含）不会崩溃。

## Assumptions & Decisions

1. **直接修改 `android/` 目录，不写 config plugin**：当前 `android/` 目录已存在并已提交，用户做本地 gradle 构建。若后续使用 `expo prebuild --clean` 或 EAS Build，原生改动会丢失——届时可补一个 config plugin（`withVivoWidget.js`）注入 manifest 和资源。本次按「Simplicity First」原则不预先实现。
2. **New Architecture 兼容性**：`ReactContextBaseJavaModule` 在 New Arch 下通过 interop layer 自动生成 TurboModule 包装，应可用。实施时需验证 `NativeModules.WidgetRefreshModule` 在 JS 端可访问；若不可用，回退方案是改用 Expo Modules API（在 `modules/widget-refresh/` 下创建模块）。
3. **DB 路径**：使用 `context.getDatabasePath("monthlyProgress.db")`。widget 与 app 同进程（widget 渲染时由 app 进程承载），可直接读 DB，无需 ContentProvider。
4. **点击组件行为**：点击组件打开 app（`PendingIntent` 启动 `MainActivity`）。这是标准行为，用户未明确要求但属合理默认。
5. **无 DB 数据时**：显示 `0.0%` 和空进度条，不报错。
6. **布局理解**：「两个条状的进度条，左右对齐」= 两条进度条 `match_parent` 等宽、左右边缘对齐；「文字显示在进度条下方」= 两条文字位于两条进度条之下。最终结构：[工作日条] → [Credits 条] → `工作日：xx.x%` → `Credits：xx.x%`。

## Verification Steps

实施完成后按顺序验证：

1. **编译通过** → 运行 `cd android && ./gradlew assembleDebug`（或 Windows `gradlew.bat assembleDebug`）确认无编译错误。
2. **组件可添加** → 安装到 VIVO 设备/模拟器，长按桌面 → 添加组件 → 列表中能找到「月度工作日进度」2x2 组件。
3. **组件渲染正确** → 添加组件后，两条进度条等宽、左右对齐；下方显示 `工作日：xx.x%` 和 `Credits：xx.x%`（1 位小数）。
4. **数据正确** → 组件显示的百分比与 app 内当月进度数字一致（同一个月、同一天）。
5. **配色正确** → 工作日条为靛蓝色；Credits 条颜色随使用率变化（<70% 绿 / 70-100% 橙 / >100% 红），与 app 内 [theme.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/theme.ts) 的 `getCreditsColor()` 一致。
6. **前台广播刷新** → 在 app 内修改当月数据后切到后台，再切回前台，组件百分比立即更新（无需等 30 分钟）。
7. **定时刷新** → 保持桌面不动，30 分钟后组件数据自动更新。
8. **点击行为** → 点击组件打开 app。
9. **DB 缺失兜底** → 清除 app 数据后（DB 不存在）添加组件，应显示 `工作日：0.0%` / `Credits：0.0%`，不崩溃。
10. **JS 模块可访问** → 确认 `NativeModules.WidgetRefreshModule` 在 JS 端非 `undefined`（New Arch interop 生效）。

## 涉及文件清单

**新建（7 个）**：
- `android/app/src/main/res/xml/workday_widget_info.xml`
- `android/app/src/main/res/layout/widget_workday.xml`
- `android/app/src/main/res/drawable/widget_background.xml`
- `android/app/src/main/java/com/vibecoding/monthlyprogress/WorkdayWidgetProvider.kt`
- `android/app/src/main/java/com/vibecoding/monthlyprogress/WidgetRefreshModule.kt`
- `android/app/src/main/java/com/vibecoding/monthlyprogress/WidgetRefreshPackage.kt`
- （可选）`android/app/src/main/res/values/strings.xml` 中补充 widget 描述字符串

**修改（3 个）**：
- `android/app/src/main/AndroidManifest.xml`（添加 `<receiver>`）
- `android/app/src/main/java/com/vibecoding/monthlyprogress/MainApplication.kt`（注册 `WidgetRefreshPackage`）
- `App.tsx`（添加 `AppState` 监听调用 `refreshWidget`）
