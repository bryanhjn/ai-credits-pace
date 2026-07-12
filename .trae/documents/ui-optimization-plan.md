# UI 优化方案

## 概述
对本项目的整体 UI 进行现代化改造，涵盖配色方案、布局结构、卡片样式、进度条、日历、弹窗等所有视觉元素。

---

## 当前状态分析

**技术栈**：Expo 57 + React Native 0.86 + react-native-paper 5.x + react-native-calendars

**当前 UI 问题**：
1. 配色散乱 —— 绿色/红色/橙色/灰色/蓝色混搭，缺乏统一调性
2. 背景色为单调的 `#F5F5F5`，缺乏层次感
3. 卡片样式过于朴素，仅有默认 elevation
4. 进度条视觉单调，无状态变化反馈
5. 日历自定义样式不够精致，彩色方块略显突兀
6. 月历导航栏排版简陋
7. 弹窗设计简单
8. 整体缺乏现代应用的视觉质感（圆角、阴影、间距节奏等）

**涉及文件**：
- `src/theme.ts` — 配色与主题定义
- `App.tsx` — 主布局、导航、图例
- `src/components/WorkdayProgress.tsx` — 工作日进度卡片
- `src/components/CreditsProgress.tsx` — Credits 进度卡片
- `src/components/MonthCalendar.tsx` — 日历组件
- `src/components/CreditsEditor.tsx` — 编辑弹窗
- `app.json` — 自适应图标背景色

---

## 改造方案

### 1. 配色方案重构 (`src/theme.ts`)

采用现代 Indigo/Slate 配色体系，统一色彩语言：

| 用途 | 旧色值 | 新色值 | 说明 |
|------|--------|--------|------|
| 主色 primary | `#1976D2` | `#6366F1` | Indigo-500，更现代 |
| 主色变体 | - | `#4F46E5` / `#818CF8` | 深浅变体用于渐变 |
| 背景色 | `#F5F5F5` | `#F1F5F9` | Slate-100，更柔和 |
| 卡片背景 | 默认白 | `#FFFFFF` | 保持白色 |
| 工作日 | `#4CAF50` | `#10B981` | Emerald-500 |
| 周末 | `#9E9E9E` | `#94A3B8` | Slate-400 |
| 节假日 | `#F44336` | `#EF4444` | Red-500 |
| 调休补班 | `#FF9800` | `#F59E0B` | Amber-500 |
| 今日高亮 | `#1976D2` | `#6366F1` | 与主色一致 |
| Credits 安全 | `#4CAF50` | `#10B981` | Emerald |
| Credits 警告 | `#FF9800` | `#F59E0B` | Amber |
| Credits 危险 | `#F44336` | `#EF4444` | Red |
| 文字主色 | - | `#1E293B` | Slate-800 |
| 文字辅色 | - | `#64748B` | Slate-500 |
| 分隔线 | - | `#E2E8F0` | Slate-200 |

同时更新 `paperTheme`，添加 surface、surfaceVariant 等 Paper 3.0 相关色值。

### 2. 主布局优化 (`App.tsx`)

- **背景**：添加微妙的渐变背景（顶部浅蓝到白色），增加层次感
- **月导航栏**：重新设计为带圆角背景的 pill 形状容器，箭头 + 标题在一个整体卡片内，视觉更聚焦
- **卡片间距**：统一调整为 16px 间距，增加呼吸感
- **图例区**：改用圆角更柔和的 pill 标签样式，居中排列，增加视觉权重
- **底部留白**：适度增加
- **加载状态**：使用更现代的加载动画

### 3. 工作日进度卡片 (`WorkdayProgress.tsx`)

- **卡片头部**：左侧添加图标（如 calendar-check），标题加粗
- **数字展示**：将已过工作日数字放大展示，使用大号字体 + 主色，形成视觉焦点
- **进度条**：增高到 14px，使用主色渐变背景（左深右浅），增加视觉动态感
- **百分比**：放在进度条右侧，使用大号加粗字体
- **整体卡片**：增加圆角到 16px，使用更柔和的阴影

### 4. Credits 进度卡片 (`CreditsProgress.tsx`)

- **卡片头部**：左侧添加图标（如 brain/robot），标题加粗
- **数字展示**：与工作日卡片保持一致的展示风格
- **进度条**：增高到 14px，根据用量比例动态切换颜色（绿→橙→红），使用渐变效果
- **超预算提示**：改为醒目的红色芯片/badge 样式，而非纯文字
- **编辑按钮**：使用 filled-tonal 风格，更融入卡片

### 5. 日历组件 (`MonthCalendar.tsx`)

- **整体**：增加圆角到 16px，添加白色背景 + 柔和阴影
- **日期标记**：将方块背景改为圆角胶囊形状（borderRadius: 16），更柔和
- **今日标记**：改为圆环高亮（borderWidth: 2.5, borderColor: primary），配合浅色背景填充
- **周末文字**：使用柔和的灰色而非纯色方块
- **日历头部**：星期标题使用主色文字，月份标题加粗

### 6. 编辑弹窗 (`CreditsEditor.tsx`)

- **弹窗**：增加圆角到 20px，添加柔和阴影
- **输入框**：使用 filled 模式替代 outlined，更现代
- **按钮组**：保存按钮使用主色渐变，取消按钮使用 outlined 风格
- **标题**：添加图标装饰

### 7. 自适应图标背景 (`app.json`)

- 将 `android.adaptiveIcon.backgroundColor` 从 `#E6F4FE` 更新为 `#EEF2FF`（Indigo-50），与新的主色调保持一致

---

## 实施步骤

1. **修改 `src/theme.ts`**：重构全部配色变量，更新 paperTheme
2. **修改 `App.tsx`**：优化主布局、月导航、图例样式
3. **修改 `src/components/WorkdayProgress.tsx`**：优化进度卡片样式
4. **修改 `src/components/CreditsProgress.tsx`**：优化 Credits 卡片样式
5. **修改 `src/components/MonthCalendar.tsx`**：优化日历样式
6. **修改 `src/components/CreditsEditor.tsx`**：优化弹窗样式
7. **修改 `app.json`**：更新自适应图标背景色

---

## 假设与决策

- 保持 react-native-paper 和 react-native-calendars 依赖不变，仅通过 props/theme 自定义样式
- 不引入新的第三方 UI 库
- 保持单屏滚动布局不变
- 保持所有现有功能逻辑不变，仅修改样式
- 不添加暗色模式（当前 `userInterfaceStyle: "light"`）

---

## 验证步骤

1. `npx expo start` 启动应用
2. 检查各月份切换时 UI 表现
3. 验证 Credits 编辑弹窗打开/关闭/保存
4. 验证不同 Credits 用量比例下进度条颜色正确切换
5. 验证日历中各类日期（工作日/周末/节假日/调休/今天）标记正确
6. 验证 Android 自适应图标背景色已更新