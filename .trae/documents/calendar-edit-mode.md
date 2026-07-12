# 日历编辑模式开关

## Summary

为日历增加"编辑模式"开关。开启后点击日期可在原始类型与"加班/请假"之间切换：
- 工作日 / 调休 → 加班
- 周末 / 节假日 → 请假
- 再次点击加班/请假 → 切回原始类型

编辑结果持久化到 SQLite，重启 App 后保留。工作日统计随编辑动态更新：加班计入工作日，请假不计入。同时更新图例：新增"加班""请假"，"调休补班"改为"调休"。

## Current State Analysis

- `DayType` 枚举（[types.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/types.ts)）只有 4 种类型：Workday/Weekend/Holiday/AdjustedWorkday，无 Overtime/Leave。
- 日历组件 [MonthCalendar.tsx](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/components/MonthCalendar.tsx) 是只读的，`<Calendar>` 未传 `onDayPress`。
- 图例内联在 [App.tsx#L188-L193](file:///d:/softwares/TRAE_prj/ai-credits-pace/App.tsx#L188-L193)，"调休补班" 在 L192。
- 工作日统计 [workdayCalc.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/utils/workdayCalc.ts) 只把 Workday + AdjustedWorkday 计为工作日。
- DB 表 `monthly_workdays` 列：`year, month, day, date_iso, type, name`，无 `original_type` 列。
- App 状态：`workdays` 为 `useState<DayInfo[]>`，`workdaysCache` 为 `useRef<Map>`。
- 已有依赖 `react-native-paper` 提供 `Switch` 组件，无需新增依赖。

## Proposed Changes

### 1. [src/types.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/types.ts) — 扩展枚举与接口

- `DayType` 枚举新增 `Overtime = 4`（加班）、`Leave = 5`（请假）。
- `DayInfo` 接口新增 `originalType: DayType | null` 字段，记录被编辑前的原始类型（未编辑时为 null）。

### 2. [src/theme.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/theme.ts) — 新增配色

在 `themeColors` 中新增（与现有 4 色区分）：
- `overtime: '#8B5CF6'`（Violet）+ `overtimeLight: '#A78BFA'`
- `leave: '#3B82F6'`（Blue）+ `leaveLight: '#60A5FA'`

### 3. [src/db/database.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/db/database.ts) — 迁移加 original_type 列

在 `initSchema` 建表后增加幂等迁移：用 `PRAGMA table_info(monthly_workdays)` 检查是否已有 `original_type` 列，没有则 `ALTER TABLE monthly_workdays ADD COLUMN original_type INTEGER`。SQLite 不支持 `ADD COLUMN IF NOT EXISTS`，故用 pragma 判断。

### 4. [src/db/queries.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/db/queries.ts) — 读写 original_type + 单日更新

- `getWorkdays`：SELECT 增加 `original_type`，映射到 `originalType`（null 时为 null）。
- `saveWorkdays`：INSERT 语句增加 `original_type` 列，值取 `d.originalType ?? null`（API 原始数据无此字段）。
- 新增 `updateWorkdayType(year, month, day, newType, originalType)`：单行 `UPDATE monthly_workdays SET type=?, original_type=? WHERE year=? AND month=? AND day=?`。

### 5. [src/utils/workdayCalc.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/utils/workdayCalc.ts) — 统计加班为工作日

- `countTotalWorkdays` 和 `countPassedWorkdays` 的过滤条件增加 `|| d.type === DayType.Overtime`。
- 语义：加班 = 你工作了，计入工作日；请假 = 你没工作，不计入。

### 6. [src/components/MonthCalendar.tsx](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/components/MonthCalendar.tsx) — 支持点击与新配色

- `Props` 新增 `editMode: boolean` 和 `onDayPress: (dateIso: string) => void`。
- `<Calendar>` 传入 `onDayPress={(d) => onDayPress(d.dateString)}`。
- `markedDates` 的 switch 增加 `Overtime`（`overtimeLight` 背景 + 白字）和 `Leave`（`leaveLight` 背景 + 白字）两个 case。

### 7. [App.tsx](file:///d:/softwares/TRAE_prj/ai-credits-pace/App.tsx) — 开关 + 编辑逻辑 + 图例

- 新增 state：`const [editMode, setEditMode] = useState(false)`。
- 新增 `handleDayPress(dateIso)`：
  1. 在 `workdays` 中找到对应 day。
  2. 按当前 type 计算新 type：
     - Workday / AdjustedWorkday → Overtime（记 originalType = 当前 type）
     - Weekend / Holiday → Leave（记 originalType = 当前 type）
     - Overtime → originalType ?? Workday（切回原始，清空 originalType）
     - Leave → originalType ?? Weekend（切回原始，清空 originalType）
  3. 调用 `updateWorkdayType(...)` 持久化。
  4. 更新 `workdays` state 和 `workdaysCache` ref 中对应条目。
- 将 `editMode` 和 `handleDayPress` 传给 `MonthCalendar`。
- 日历上方加 `Switch` + "编辑模式"标签（Paper `Switch` + `Text`，行布局）。
- 图例更新：`"调休补班"` → `"调休"`；新增 `<LegendChip color={themeColors.overtime} label="加班" />` 和 `<LegendChip color={themeColors.leave} label="请假" />`。

## Assumptions & Decisions

1. **加班/请假的统计语义**：加班计入工作日（你工作了），请假不计入（你没工作）。`workdayCalc.ts` 过滤条件增加 Overtime。
2. **持久化**：编辑结果存入 SQLite `original_type` 列，重启后保留。切回原始类型时清空 `original_type`。
3. **切回原始类型**：加班/请假记录了被编辑前的 `originalType`，再次点击恢复。若 `originalType` 缺失（异常），加班回退到 Workday，请假回退到 Weekend。
4. **配色**：加班=Violet，请假=Blue，与现有绿/灰/红/橙区分明显。
5. **编辑模式 UI**：日历上方 Switch + "编辑模式"文字。非编辑模式不传 `onDayPress`。
6. **迁移方式**：用 `PRAGMA table_info` 检查列是否存在，幂等安全。

## Verification

1. 图例显示 6 项：工作日、周末、节假日、调休、加班、请假，"调休补班"已变为"调休"。
2. 开启编辑模式，点击工作日（绿）→ 变紫（加班）；再点击 → 变回绿。
3. 点击调休日（橙）→ 变紫（加班）；再点击 → 变回橙。
4. 点击周末（灰）→ 变蓝（请假）；再点击 → 变回灰。
5. 点击节假日（红）→ 变蓝（请假）；再点击 → 变回红。
6. 切换月份再切回，编辑结果保留。
7. 重启 App，编辑结果仍保留。
8. 工作日进度条数字随编辑正确变化（加班计入，请假不计）。
9. 关闭编辑模式后点击日期无反应。
10. 首次启动（旧 DB 无 original_type 列）迁移不报错。
