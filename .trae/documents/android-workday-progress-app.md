# 月度工作日进度 App 实施计划

## 概述 (Summary)

从零开发一个安卓 App，核心功能：计算当前自然月工作日已度过的百分比，并以进度条形式展示，方便 vibe coding 用户规划 AI Credits 用量。单页面、纯客户端、SQLite 本地存储、调用免费节假日 API 获取法定工作日/调休信息。

## 技术选型 (Tech Stack)

| 类别 | 选型 | 理由 |
|---|---|---|
| 框架 | **React Native + Expo (Managed Workflow)** | 免费、开源、成熟；Expo 简化安卓构建；TS 生态对 vibe coding 用户友好 |
| 语言 | **TypeScript** | 类型安全，减少运行时错误 |
| UI 组件库 | **React Native Paper** | 基于 Material Design 3，Apache 2.0 协议，免费开源成熟，提供 ProgressBar、TextInput、Card 等组件 |
| 本地存储 | **expo-sqlite** (SQLite) | Expo 官方包，原生 SQLite，符合用户要求 |
| 日历组件 | **react-native-calendars** | GitHub 9k+ star，成熟开源，支持日期标记/着色 |
| 日期处理 | **date-fns** | 轻量、tree-shakeable、功能完备 |
| 节假日 API | **holiday-cn (GitHub) via jsDelivr CDN** | MIT 协议；数据源自国务院公告；无速率限制；自动每日更新；无鉴权 |
| HTTP | **fetch** (RN 内置) | 无需额外依赖 |

### 节假日 API 设计

**主源**：`https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/{year}.json`
- 返回该年所有法定节假日和调休补班日
- 字段：`days[]`，每项含 `name`、`date`(ISO)、`isOffDay`(true=放假, false=调休补班)
- 无鉴权、无速率限制

**回退源**：`http://timor.tech/api/holiday/year/{year}`
- 备用，含 wage 倍数数据
- 10,000 次/天/IP（移动端缓存后绰绰有余）

**工作日判定算法**（客户端计算）：
```
对当月每一天：
  - 若在 holiday-cn 的 days 列表中:
      - isOffDay=true  → 类型 2 (法定节假日，休息)
      - isOffDay=false → 类型 3 (调休补班，工作日)
  - 否则按周几判定:
      - 周六/周日 → 类型 1 (周末，休息)
      - 周一到周五 → 类型 0 (正常工作日)
```

## 当前状态分析 (Current State Analysis)

- 工作目录 `d:\softwares\TRAE_prj\monthlyProgress` 为空，从零开始
- 需先初始化 Expo 项目，再分层实现 DB / API / 组件 / 页面

## 数据模型 (SQLite Schema)

数据库文件：`monthlyProgress.db`（expo-sqlite 默认存储于应用沙盒）

### 表 1：`monthly_workdays`（缓存每月每日类型）
```sql
CREATE TABLE IF NOT EXISTS monthly_workdays (
  year    INTEGER NOT NULL,
  month   INTEGER NOT NULL,
  day     INTEGER NOT NULL,
  date_iso TEXT NOT NULL,        -- 'YYYY-MM-DD'
  type    INTEGER NOT NULL,      -- 0=工作日, 1=周末, 2=节假日, 3=调休补班
  name    TEXT,                  -- 节假日名称，无则 NULL
  PRIMARY KEY (year, month, day)
);
```

### 表 2：`monthly_credits`（每月 AI Credits 设置）
```sql
CREATE TABLE IF NOT EXISTS monthly_credits (
  year          INTEGER NOT NULL,
  month         INTEGER NOT NULL,
  total_credits REAL NOT NULL DEFAULT 3000,
  used_credits  REAL NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (year, month)
);
```

## 文件结构 (Proposed File Structure)

```
monthlyProgress/
├── app.json                    # Expo 配置（应用名、Android 包名等）
├── package.json
├── tsconfig.json
├── App.tsx                     # 入口：初始化 DB + 渲染单页面
├── babel.config.js             # react-native-paper 主题配置
├── src/
│   ├── types.ts                # DayType 枚举、MonthData 等类型
│   ├── db/
│   │   ├── database.ts         # SQLite 连接、建表迁移
│   │   └── queries.ts          # workdays / credits 的 CRUD
│   ├── api/
│   │   └── holidays.ts         # 调用 holiday-cn，解析为天数列表
│   ├── utils/
│   │   ├── workdayCalc.ts      # 进度计算：总工作日、已度过工作日、百分比
│   │   └── dateHelpers.ts      # 月首月末、ISO 格式化等
│   ├── components/
│   │   ├── WorkdayProgress.tsx # 顶部工作日进度条 + 文案
│   │   ├── CreditsProgress.tsx # AI Credits 进度条 + 编辑入口
│   │   ├── MonthCalendar.tsx   # 日历，标记工作日/周末/节假日
│   │   └── CreditsEditor.tsx   # Modal：编辑 total/used credits
│   └── theme.ts                # Paper 主题色（进度条/日历配色）
```

## 实施步骤 (Proposed Changes)

### 步骤 1：初始化 Expo 项目与依赖
- 运行 `npx create-expo-app@latest monthlyProgress --template blank-typescript`（在当前目录）
- 安装依赖：
  - `react-native-paper` `react-native-paper-dates`（或直接用 react-native-calendars）
  - `expo-sqlite`
  - `react-native-calendars`
  - `date-fns`
- 配置 `app.json`：应用名 "月度工作日进度"、Android 包名 `com.vibecoding.monthlyprogress`
- 配置 `babel.config.js`：react-native-paper 主题

### 步骤 2：实现数据层 `src/db/`
- **database.ts**：用 `expo-sqlite` 的 `openDatabaseAsync` 打开 DB；执行两张表的 CREATE 语句
- **queries.ts**：
  - `getWorkdays(year, month)` → 返回 `DayInfo[]`
  - `saveWorkdays(year, month, days[])` → 批量 INSERT OR REPLACE
  - `hasWorkdaysCache(year, month)` → boolean
  - `getCredits(year, month)` → `{total, used}`（无记录返回默认值）
  - `upsertCredits(year, month, total, used)` → INSERT OR REPLACE

### 步骤 3：实现 API 层 `src/api/holidays.ts`
- `fetchHolidays(year)`：GET jsDelivr CDN 的 `{year}.json`，带 5s 超时
- 失败时回退到 `timor.tech` 源
- 解析为 `{date, isOffDay, name}[]`
- `buildMonthDays(year, month, holidays)`：遍历该月每一天，结合 API 数据 + 周几判定，生成带 type 的天数列表

### 步骤 4：实现工具函数 `src/utils/`
- **workdayCalc.ts**：
  - `countTotalWorkdays(days)`：type∈{0,3} 的天数
  - `countPassedWorkdays(days, today)`：date ≤ today 且 type∈{0,3} 的天数
  - `calcProgressPercent(passed, total)` → 百分比（total=0 时返回 0）
- **dateHelpers.ts**：月首末日、ISO 格式化、加减天

### 步骤 5：实现组件 `src/components/`
- **WorkdayProgress.tsx**：React Native Paper 的 `ProgressBar` + 文案 "已度过 X / Y 个工作日 (Z%)"
- **CreditsProgress.tsx**：ProgressBar + 文案 "已用 A / B Credits (C%)"，右上角"编辑"图标按钮
- **MonthCalendar.tsx**：使用 `react-native-calendars` 的 `CalendarList` 或 `Calendar`：
  - 0=工作日：默认色
  - 1=周末：浅灰
  - 2=节假日：红色（休息）
  - 3=调休补班：橙色（工作日，醒目提示）
  - 当天：高亮圆圈
  - 顶部月份切换按钮（← 当月 →）
- **CreditsEditor.tsx**：Modal 弹窗，两个 TextInput（总额/已用），保存按钮

### 步骤 6：组装单页面 `App.tsx`
- useState：`currentDate`(year, month)、`workdays[]`、`credits`、`loading`、`editorVisible`
- useEffect 初次加载：
  1. 初始化 DB
  2. 检查 `(year, month)` 是否有 workdays 缓存；无则调 API 并保存
  3. 读取 credits（无记录用默认值 3000/0）
- 渲染顺序（自上而下）：
  1. 月份切换条（标题 + ← → 按钮）
  2. 工作日进度条（WorkdayProgress）
  3. AI Credits 进度条（CreditsProgress）+ 编辑按钮
  4. 日历（MonthCalendar）
- 切换月份时重新加载数据；编辑 credits 后刷新进度条

### 步骤 7：Android 构建配置与验证
- `npx expo prebuild --platform android` 生成原生工程
- `npx expo run:android`（需连接 Android 设备/模拟器，或 Android Studio）
- 验证清单见下文

## 假设与决策 (Assumptions & Decisions)

1. **"当天视为已过完"**：计算已度过工作日时，包含今天（若今天本身是工作日）。例如该月首个工作日打开 App → 1/22 = 4.5%。
2. **工作日定义**：type ∈ {0(正常工作日), 3(调休补班)}；周末(1)和节假日(2)不计入工作日总数。
3. **月份切换**：用户可点击 ← → 查看历史/未来月份的进度和 credits 设置；切换时若该月无缓存则按需拉取 API。
4. **跨年 12 月**：按 holiday-cn README 建议，12 月日期应同时检查当年与下一年的 JSON。实现时拉取两年数据合并。
5. **离线可用**：API 仅在无缓存时调用一次；之后全程离线运行（读取 SQLite）。
6. **Credits 默认值**：total=3000，used=0，仅在该月首次访问且 DB 无记录时使用；用户修改后持久化。
7. **进度条颜色**：工作日进度用主题蓝；AI Credits 进度按使用比例变色（<70% 绿、70-100% 橙、>100% 红），便于直观预警。
8. **不实现**：用户登录、云端同步、历史趋势图、通知推送（均超出需求范围）。

## 验证步骤 (Verification)

1. **API 可用性**：在实现 holidays.ts 后，单独 fetch 2026 年 JSON，确认能解析出国庆节、春节调休等条目
2. **工作日计算正确性**：
   - 构造一个已知月份（如 2026-02 春节）的 mock 数据，断言总工作日数与官方调休安排一致
   - 验证"首个工作日打开 → 1/N"
3. **SQLite 持久化**：首次加载后杀掉 App 重启，确认无需再次联网，数据来自本地
4. **月份独立性**：切换到上个月编辑 credits，切回当月，确认当月 credits 不受影响
5. **UI 渲染**：
   - 进度条百分比与文案一致
   - 日历正确标记工作日/周末/节假日/调休补班四类
   - 当天高亮
   - 编辑 Modal 保存后进度条立即刷新
6. **Android 运行**：`npx expo run:android` 成功在模拟器/真机启动，无原生层报错

## 备注

- 由于工作目录为空，全部文件均为新建（符合"从零开发"要求，不违反"优先编辑现有文件"原则）
- 计划保持简单，不引入状态管理库（Redux 等），用 useState + useEffect 足够单页面场景
