# AI Pace 新功能与优化建议

## 背景与定位回顾

AI Pace 的核心价值：**将「本月工作日已过进度」与「AI Credits 已使用进度」并排对比，让用户一眼看出 AI 消耗节奏是否合理**。

使用者：你自己（GitHub Copilot 订阅），顺带开源。
原则：保持简单、聚焦核心价值、不过度工程化。

---

## 一、推荐优先级总览

| 优先级 | 类别 | 项目 | 价值 | 复杂度 |
|---|---|---|---|---|
| P0 | Bug 修复 | 版本号三处不一致 | 高 | 低 |
| P0 | Bug 修复 | Credits 默认总额不一致 | 高 | 低 |
| P0 | Bug 修复 | Widget 与 App 颜色逻辑不一致 | 高 | 中 |
| P1 | 新功能 | 历史月份趋势图 | 高 | 中 |
| P1 | 新功能 | Copilot 每日用量明细 | 高 | 中 |
| P1 | 细节优化 | CreditsEditor 输入校验 | 中 | 低 |
| P2 | 新功能 | 配速预警通知 | 中 | 中 |
| P2 | 细节优化 | 清除日历编辑批量操作 | 中 | 低 |
| P2 | 细节优化 | 节假日回退源改 HTTPS | 中 | 低 |
| P3 | 新功能 | 暗色模式 | 中 | 中 |
| P3 | 新功能 | 数据导出/备份 | 低 | 低 |

---

## 二、P0：Bug 修复（建议立即处理）

### 2.1 版本号三处不一致

**现状**：
- [package.json](file:///d:/softwares/TRAE_prj/ai-credits-pace/package.json): `1.0.1`
- [app.json](file:///d:/softwares/TRAE_prj/ai-credits-pace/app.json): `1.1.1`
- [App.tsx](file:///d:/softwares/TRAE_prj/ai-credits-pace/App.tsx): 硬编码 `'1.2.0'`
- README 标题：`1.0.1`

**问题**：开源后用户无法判断真实版本，构建产物版本号混乱。

**方案**：以 `app.json` 为单一真源，`App.tsx` 通过 `expo-constants` 读取 `expo.version`，`package.json` 与 `app.json` 对齐，README 同步。

### 2.2 Credits 默认总额不一致

**现状**：
- [src/types.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/types.ts): `DEFAULT_TOTAL_CREDITS = 6000`
- [src/db/database.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/db/database.ts) schema: `DEFAULT 3000`
- [android/.../WorkdayWidgetProvider.kt](file:///d:/softwares/TRAE_prj/ai-credits-pace/android/app/src/main/java/com/bryanhjn/aicreditspace/WorkdayWidgetProvider.kt): `DEFAULT_TOTAL_CREDITS = 6000`

**问题**：虽然运行时查询走 types.ts 的 6000，但 schema default 仍是 3000，潜在数据不一致。

**方案**：统一为 6000（Copilot Pro 月度额度）。修改 `database.ts` 的 schema default，并写一次性迁移（已有数据不受影响，仅影响新插入的兜底值）。

### 2.3 Widget 与 App 颜色逻辑不一致

**现状**：
- [src/theme.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/theme.ts) `getCreditsColor`: 基于 `paceDiff = creditsPercent - workdayPercent`，阈值 ±5%
- [WorkdayWidgetProvider.kt](file:///d:/softwares/TRAE_prj/ai-credits-pace/android/app/src/main/java/com/bryanhjn/aicreditspace/WorkdayWidgetProvider.kt) `getCreditsColor`: 基于 `ratio = used/total`，>1 红 / >=0.7 橙 / 否则绿

**问题**：同一份数据在 App 内和桌面组件上颜色可能完全不同，违反了 `vivo-widget-2x2.md` 中"完全复用 app 配色"的决策。

**方案**：将 Widget 的 `getCreditsColor` 改为与 App 一致的配速差值逻辑（需要把 `workdayPercent` 传给 Widget，Widget 已有工作日计算逻辑，可直接复用）。

---

## 三、P1：高价值新功能

### 3.1 历史月份趋势图

**价值**：核心功能的自然延伸——不仅看本月，还能回顾过去几个月的配速对比，判断自己的 AI 消耗趋势是否在恶化。

**现状基础**：SQLite 已有 `monthly_credits` 表按月存储 `total_credits` / `used_credits` / `updated_at`，数据基础完备。

**方案**：
- 在主屏增加一个「趋势」入口（顶部 Tab 或底部按钮）
- 展示最近 6 个月的柱状图/折线图：
  - 每月一根柱子，高度 = credits 使用百分比
  - 叠加工作日进度的参考线
  - 颜色复用 `getCreditsColor` 配速逻辑
- 可用 `react-native-svg`（已在依赖中）手绘简易图表，无需引入图表库
- 数据源：扩展现有 `queries.ts` 增加 `getRecentMonthsCredits(months: number)`

**范围**：仅展示，不可编辑；不含预测/外推。

### 3.2 Copilot 每日用量明细

**价值**：Copilot API 返回的 `usageItems` 实际包含按日的明细数据。当前只取 `grossQuantity` 求和，浪费了已有信息。展示每日用量能帮你定位"哪天突然用量飙升"。

**现状基础**：[src/api/copilot.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/api/copilot.ts) 已在请求 `usageItems`，只是只取了 sum。

**方案**：
- 先确认 API 返回结构：`usageItems` 是否包含 `date` 或 `day` 字段（需查 GitHub Billing API 文档或实际打印一次响应）
- 若有按日数据：
  - 在 Credits 卡片点击后展开一个迷你柱状图，展示本月每日用量
  - 或在趋势页（3.1）中增加本月日维度视图
- 若无按日数据：降级为按月对比即可（合并到 3.1）

**风险**：需先验证 API 实际返回字段，可能不含按日粒度。

### 3.3 CreditsEditor 输入校验

**价值**：当前 `parseFloat(totalStr) || 0` 允许任意输入，负数、NaN 被 0 兜底但用户无感知。开源后其他用户更容易误操作。

**现状**：[src/components/CreditsEditor.tsx](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/components/CreditsEditor.tsx)

**方案**：
- 总额度：限制为正整数，非法输入时输入框下方红色提示
- 已用额度：允许 0，不允许负数，不超过总额度时给软警告（黄色提示）
- PAT：检测 `github_pat_` 前缀，不符时提示"请确认是 fine-grained PAT"
- 保持轻量，不引入表单库

---

## 四、P2：中等价值

### 4.1 配速预警通知

**价值**：当 credits 配速明显超前进度时主动提醒，避免月底才发现超额。

**方案**：
- 利用 Expo 的本地通知（`expo-notifications`）
- 触发条件：`creditsPercent - workdayPercent > 10%` 时推送一条本地通知
- 触发时机：每日首次打开 App 时检查（不依赖后台任务，简单可靠）
- 可在设置中开关

**范围**：仅本地通知，无推送服务。

### 4.2 清除日历编辑批量操作

**价值**：当前日历编辑模式需逐日点击还原，月末清理麻烦。

**方案**：
- 在日历编辑模式下增加一个「清除本月编辑」按钮
- 弹确认对话框，确认后批量 `UPDATE monthly_workdays SET type = original_type WHERE ...`
- 仅清除本月，不影响其他月

### 4.3 节假日回退源改 HTTPS

**价值**：当前回退源 `http://timor.tech` 是明文 HTTP，Android 9+ 默认禁用，主源失败时回退会直接挂掉。

**方案**：
- 确认 `timor.tech` 是否支持 HTTPS（大概率支持）
- 改为 `https://timor.tech/api/holiday/year/{year}`
- 若不支持，寻找替代回退源或移除回退逻辑

---

## 五、P3：锦上添花（可选）

### 5.1 暗色模式

- `app.json` 当前写死 `userInterfaceStyle: "light"`
- 增加 `MD3DarkTheme`，跟随系统
- 工作量主要在调色和测试，价值因人而异

### 5.2 数据导出/备份

- 将 SQLite 数据导出为 JSON / CSV
- 方便换设备或备份
- 开源用户也能迁移数据

---

## 六、不推荐的方向（明确排除）

- **多 AI 服务商支持**（Claude/Cursor/ChatGPT）：不同厂商 API 差异大，且你只用 Copilot，属于 YAGNI
- **国际化/其他国家节假日**：你在中国，节假日源已够用
- **iOS Widget**：你用 Android，无必要
- **引入状态管理库**（Zustand/Redux）：单屏应用，现有 hooks + refs 够用
- **引入测试框架**：AGENTS.md 提倡测试，但个人小工具引入 jest 性价比低，除非要开源规范化

---

## 七、假设与决策

1. **假设**：你主要关心"让这个工具更好用"，而非"做成产品"。因此推荐聚焦核心价值延伸，不做用户系统/云同步等。
2. **假设**：Copilot Pro 月度额度为 6000（当前 types.ts 的默认值），如有变化需调整。
3. **决策**：优先修复 P0 的三个 Bug，因为它们影响正确性且成本低。
4. **决策**：P1 的趋势图和每日明细是核心价值延伸，建议作为下一阶段重点。
5. **待确认**：Copilot API 的 `usageItems` 是否包含按日粒度数据，需实际验证。

---

## 八、建议的实施顺序

如果你认可上述方向，建议按以下顺序实施（每一步都是独立可交付的）：

1. **P0 Bug 修复三连**（版本号 + 默认总额 + Widget 颜色）→ 验证：构建通过，Widget 颜色与 App 一致
2. **P1.3 CreditsEditor 输入校验** → 验证：非法输入有提示
3. **P1.1 历史月份趋势图** → 验证：能看到最近 6 个月柱状图
4. **P1.2 Copilot 每日用量明细**（需先验证 API）→ 验证：展示每日用量
5. **P2 项按需选择**

---

## 九、下一步

请告诉我：
- 你最想先做哪几项？
- 是否有我没提到但你想要的功能？
- 对"不推荐的方向"中某项是否有不同看法？

确认后我会针对选定项给出详细实施计划。
