# GitHub Copilot AI Credits 自动获取 — 完成剩余实现

## Summary

为本 App 增加自动获取 GitHub Copilot 当前周期已用 AI Credits 数量的功能。用户在现有 CreditsEditor 弹窗中录入 GitHub 用户名 + 细粒度 PAT，App 在启动、切月、保存配置后自动拉取，并支持右下角 FAB 手动刷新。

**注：本次为续作。前序会话已完成约 90% 实现，仅剩 App.tsx 中 4 处收尾编辑 + 类型检查。**

## API 调研结论（已验证）

- **端点**：`GET /users/{username}/settings/billing/ai_credit/usage?year={y}&month={m}`
- **文档**：https://docs.github.com/en/rest/billing/usage#get-billing-ai-credit-usage-report-for-a-user
- **认证**：Fine-grained PAT，需 "Plan" user permissions (read)
- **请求头**：`Authorization: Bearer <token>`、`Accept: application/vnd.github+json`、`X-GitHub-Api-Version: 2026-03-10`
- **响应**：`usageItems[].grossQuantity` 求和 = 该月已用总量（含免费额度内部分，区别于 `netQuantity` 超额计费部分）
- **适用范围**：仅个人版 Copilot（用户自购）。组织/企业管理的不走此端点。

## Current State Analysis

已完成的部分（经 Phase 1 探索确认）：

| 文件 | 状态 |
|---|---|
| `package.json` | ✅ 已加 `expo-secure-store@~57.0.0` |
| `app.json` | ✅ plugins 已含 `expo-secure-store` |
| `src/types.ts` | ✅ 已加 `CopilotConfig` 接口 |
| `src/api/copilot.ts` | ✅ 完整实现 `fetchCopilotCreditsUsed`，端点/请求头/求和逻辑均正确 |
| `src/utils/secureStorage.ts` | ✅ 完整实现 `getCopilotConfig` / `saveCopilotConfig` / `clearCopilotConfig` |
| `src/components/CreditsEditor.tsx` | ✅ 已扩展：Props 加 `copilotConfig`、`onSave` 签名加 `config`、新增 GitHub 用户名/PAT 输入区、handleSave 计算并回传 config |
| `App.tsx` | ⚠️ 部分完成：imports、state、refs、`refreshCopilotUsed`、4 个 useEffect 均已就位。**缺失 4 处收尾**（见下） |

App.tsx 中缺失的 4 处：
1. `handleSaveCredits` 仍是旧签名 `(total, used)`，未接受 `config` 参数
2. `<CreditsEditor>` 未传 `copilotConfig={copilotConfig}` prop
3. JSX 中无 FAB 悬浮按钮
4. `styles` 中无 `fab` 样式

## Proposed Changes

### 1. App.tsx — 改造 `handleSaveCredits`（第 188-194 行）

**现状**：
```typescript
const handleSaveCredits = async (total: number, used: number) => {
  await upsertCredits(year, month, total, used);
  const updated = await getCredits(year, month);
  creditsCache.current.set(getCacheKey(year, month), updated);
  setCredits(updated);
  setEditorVisible(false);
};
```

**改为**：
```typescript
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
```

**Why**：CreditsEditor 已改成传 3 参数，App 侧必须接收 config 并持久化到 SecureStore + 同步 state/ref + 触发一次拉取。

### 2. App.tsx — 给 `<CreditsEditor>` 传 `copilotConfig` prop（第 295-302 行）

在现有 `<CreditsEditor>` 元素上加一行：
```tsx
<CreditsEditor
  visible={editorVisible}
  totalCredits={credits.totalCredits}
  usedCredits={credits.usedCredits}
  monthTitle={monthTitle}
  copilotConfig={copilotConfig}   // 新增
  onSave={handleSaveCredits}
  onClose={() => setEditorVisible(false)}
/>
```

**Why**：CreditsEditor 打开时需从现有配置回填 GitHub 用户名/PAT 字段。

### 3. App.tsx — 加 FAB 悬浮按钮

在 `<CreditsEditor />` 同级（SafeAreaView 内，ScrollView 外）加：
```tsx
<FAB
  icon="refresh"
  style={styles.fab}
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!copilotConfigRef.current) {
      // 未配置则打开编辑器引导填写
      setEditorVisible(true);
      return;
    }
    setRefreshing(true);
    refreshCopilotUsed(year, month).finally(() => setRefreshing(false));
  }}
  loading={refreshing}
  color="#FFFFFF"
/>
```

**Why**：用户明确要求"右下角增加一个悬浮按钮用于手动刷新"。未配置时点击直接打开编辑器，避免无意义的空刷新。

### 4. App.tsx — 加 `styles.fab`

在 `styles` 对象中追加：
```typescript
fab: {
  position: 'absolute',
  right: 20,
  bottom: 24,
  backgroundColor: themeColors.primary,
  borderRadius: 16,
},
```

### 5. 类型检查

完成上述编辑后运行 `npx tsc --noEmit` 确保无类型错误。

## Assumptions & Decisions

1. **`grossQuantity` 而非 `netQuantity`**：grossQuantity 是消耗总量（含免费额度），netQuantity 是超额计费部分。用户想看"已用多少"应取 gross。
2. **PAT 类型**：Fine-grained PAT（非 classic），仅需 "Plan" user permission (read)。最小权限原则。
3. **存储**：PAT 通过 `expo-secure-store` 存入 Android Keystore / iOS Keychain，不明文落 SQLite。
4. **静默失败**：拉取失败不弹 toast/snackbar，保留旧值。符合最小改动原则，且网络错误对用户并非关键信息。
5. **未来月不拉取**：避免 GitHub API 返回 0 覆盖用户手动输入的值。
6. **FAB 未配置时打开编辑器**：避免空刷新，引导用户填写配置。
7. **不加 loading 遮罩**：`refreshing` 仅驱动 FAB 自身 `loading` 图标，不阻塞 UI。
8. **不新增 Snackbar/Toast 依赖**：保持现有依赖栈不变。

## Verification

1. `npx tsc --noEmit` 无类型错误
2. 启动 App，打开 Credits 编辑器，确认出现 GitHub 用户名 + PAT 输入框及 helper 文案
3. 填入测试配置保存，确认右下角 FAB 出现
4. 点击 FAB，确认 loading 旋转，结束后已用额度更新（需真实 PAT）
5. 切月后确认已用额度自动刷新（当月及过去月）
6. 清空 GitHub 字段保存，确认 FAB 点击后打开编辑器而非空刷新
