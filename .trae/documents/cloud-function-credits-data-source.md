# 云函数数据源：替换 GitHub PAT 直连

## 概述

用腾讯云 SCF 云函数 + TencentDB for MongoDB 替换现有的 GitHub PAT 直连 API。PC 端脚本将用量数据按日推送到 MongoDB（每日一条文档，多次推送覆盖当天），App 通过云函数查询当月最新用量。

用户已选择「完全替换」策略：移除 GitHub PAT 配置/UI/类型/存储，云函数成为唯一数据源。

## 当前状态分析

现有数据流：App → `GET api.github.com/users/{username}/settings/billing/ai_credit/usage`（需 fine-grained PAT + Plan 权限）→ 返回月度已用 credits。

关键文件与现有契约：
- [src/api/copilot.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/api/copilot.ts) — 导出 `fetchCopilotCreditsUsed(username, token, year, month): Promise<number>`，内部 `fetchWithTimeout`，失败 throw
- [src/utils/secureStorage.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/utils/secureStorage.ts) — `get/save/clearCopilotConfig` 三件套，key 为 `copilot_username` / `copilot_token`
- [src/types.ts](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/types.ts) — `CopilotConfig { username, token }`
- [src/components/CreditsEditor.tsx](file:///d:/softwares/TRAE_prj/ai-credits-pace/src/components/CreditsEditor.tsx) — GitHub 配置区块（用户名 + PAT 输入 + 帮助弹窗）
- [App.tsx](file:///d:/softwares/TRAE_prj/ai-credits-pace/App.tsx) — `copilotConfig` state/ref、`refreshCopilotUsed`（L128-144）、`handleSaveCredits`、pull-to-refresh guard、配置加载/自动刷新 effects

现有 API 契约：`fetchCopilotCreditsUsed(...) → Promise<number>`，失败时 `refreshCopilotUsed` catch 后静默保留旧值。未来月不拉取（避免 0 覆盖手动值）。

## 架构总览

```
PC 脚本（浏览器cookie抓取）──→ 云函数(write, 用户自行实现) ──→ MongoDB
                                                                 ↑
App ──→ 云函数(read, 本次实现) ──→ MongoDB ──→ 返回当月最新 usedCredits
```

本次实现范围：**读取云函数 + App 端对接**。写入云函数由用户自行实现，但遵循同一数据模型。

---

## 一、数据库设计

### 产品选择：TencentDB for MongoDB

腾讯云的「文档型数据库」即 **TencentDB for MongoDB**（MongoDB 兼容）。与关系型数据库的对照：

| 关系型 | 文档型 (MongoDB) |
|--------|------------------|
| 表 (table) | 集合 (collection) |
| 行 (row) | 文档 (document, JSON 结构) |
| 固定列结构 | 灵活 schema，每条文档字段可不同 |
| 主键需指定 | `_id` 字段自动作为主键 |
| UPSERT 靠主键 | `updateOne(filter, {$set:...}, {upsert:true})` 靠任意条件 |

**「每天一条，多次推送覆盖当天」能否做到？** 可以。MongoDB 的 upsert 完美匹配：以日期字符串为 `_id`，当天首次推送时插入，后续推送时 `updateOne({_id:"2026-07-13"}, {$set:{...}})` 覆盖同一文档。

### 数据库与集合

- 数据库名：`copilot`
- 集合名：`copilot_usage`

### 文档结构

```json
{
  "_id": "2026-07-13",
  "date": "2026-07-13",
  "year": 2026,
  "month": 7,
  "day": 13,
  "usedCredits": 1234.5,
  "queriedAt": "2026-07-13T15:30:00+08:00"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 日期 `YYYY-MM-DD`，天然主键，用于 upsert 去重与范围查询 |
| `date` | string | 同 `_id`，冗余存储便于响应直返 |
| `year`/`month`/`day` | number | 拆分字段，方便日后扩展查询 |
| `usedCredits` | number | **当月累计已用 AI Credits**（截至查询时刻的月度累计值，非当日增量） |
| `queriedAt` | string | PC 脚本抓取时的本地时间（ISO 8601 带时区） |

无需额外索引：`_id` 自动索引，字符串字典序天然按日期排序。

### 查询逻辑

App 查询「某年某月已用 credits」时，云函数：
1. 构造日期范围：`_id: { $gte: "2026-07-01", $lt: "2026-08-01" }`
2. 按 `_id` 降序取第一条（当月最新一天）
3. 返回该文档的 `usedCredits`

### usedCredits 语义假设

每次 PC 脚本抓取到的「已用 AI Credits」是**当月累计值**（Copilot 网页端显示的"本月已用"），非当日增量。因此当月最新一天的 `usedCredits` = 当月已用总量。这与现有 GitHub API 返回语义一致（API 也是返回月度累计 `grossQuantity` 求和）。

---

## 二、云函数代码

### 技术栈选择

- **运行时**：Node.js 18 — SCF 原生支持，与 App 的 JS/TS 生态一致
- **MongoDB 驱动**：`mongodb` 官方 Node.js 驱动（v6）
- **无 Web 框架**：SCF handler 是单个导出函数，不需要 Express

### 创建方式：代码包上传（推荐）

| 方式 | 适合场景 | 缺点 |
|------|----------|------|
| 模板 | 快速试用 | 模板无 MongoDB 逻辑，需大改 |
| **代码包 (zip)** | **单函数、少量依赖** | 每次更新需重新打包 |
| CLI (scf) | 多函数、需 CI/CD | 需安装 scf CLI + 配置凭证 |

推荐**代码包上传**：本场景单函数 + 单依赖（mongodb），zip 打包后控制台上传最直接。

### 云函数代码

**文件：`cloud-function/index.js`**

```js
const { MongoClient } = require('mongodb');

// SCF 容器复用时缓存连接，避免每次冷启动都建连
let cachedClient = null;

async function getClient(uri) {
  if (!cachedClient) {
    cachedClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await cachedClient.connect();
  }
  return cachedClient;
}

// SCF API 网关事件 header 大小写不确定，做不敏感查找
function getHeader(event, name) {
  const headers = event.headers || {};
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) return headers[k];
  }
  return undefined;
}

exports.main_handler = async (event) => {
  // 1. 鉴权
  const apiKey = getHeader(event, 'X-Api-Key');
  if (!apiKey || apiKey !== process.env.API_SECRET) {
    return {
      isBase64Encoded: false,
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // 2. 解析参数
  const qs = event.queryString || event.queryStringParameters || {};
  const year = parseInt(qs.year, 10);
  const month = parseInt(qs.month, 10);
  if (!year || !month || month < 1 || month > 12) {
    return {
      isBase64Encoded: false,
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid year/month' }),
    };
  }

  // 3. 构造当月日期范围 [月初, 下月初)
  const mm = String(month).padStart(2, '0');
  const startDate = `${year}-${mm}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextStart = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  // 4. 查询当月最新一条
  try {
    const client = await getClient(process.env.MONGODB_URI);
    const db = client.db(process.env.MONGODB_DB || 'copilot');
    const col = db.collection('copilot_usage');

    const doc = await col.findOne(
      { _id: { $gte: startDate, $lt: nextStart } },
      { sort: { _id: -1 } }
    );

    if (!doc) {
      return {
        isBase64Encoded: false,
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usedCredits: null, date: null, queriedAt: null }),
      };
    }

    return {
      isBase64Encoded: false,
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usedCredits: doc.usedCredits,
        date: doc.date,
        queriedAt: doc.queriedAt,
      }),
    };
  } catch (err) {
    console.error('DB error:', err);
    return {
      isBase64Encoded: false,
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Database error' }),
    };
  }
};
```

**文件：`cloud-function/package.json`**

```json
{
  "name": "copilot-usage-reader",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "mongodb": "^6.3.0"
  }
}
```

---

## 三、部署步骤

### 1. 创建 MongoDB 实例

- 腾讯云控制台 → 数据库 → MongoDB → 新建实例
- 选「副本集」最低配即可（单用户场景）
- 记下：连接地址、端口、用户名、密码
- **建议与 SCF 同地域、同 VPC**（内网访问，低延迟、免公网暴露）

### 2. 打包云函数

```powershell
cd d:\softwares\TRAE_prj\ai-credits-pace\cloud-function
npm install
Compress-Archive -Path index.js, package.json, node_modules -DestinationPath copilot-reader.zip
```

### 3. 创建 SCF 函数

- 腾讯云控制台 → 云函数 → 新建函数
- 函数名：`copilot-usage-reader`
- 运行环境：**Node.js 18**
- 上传方式：**代码包上传** → 选 `copilot-reader.zip`
- 执行超时：**5 秒**

### 4. 配置环境变量

函数详情 → 函数配置 → 环境变量：

| Key | Value |
|-----|-------|
| `MONGODB_URI` | `mongodb://用户名:密码@内网地址:端口/copilot` |
| `MONGODB_DB` | `copilot` |
| `API_SECRET` | 自定义一个密钥（如 32 位随机字符串，之后填入 App） |

### 5. 配置 VPC 访问

如果 MongoDB 用 VPC 内网地址：函数配置 → VPC → 勾选与 MongoDB 同一 VPC + 子网。

### 6. 添加 API 网关触发器

- 函数详情 → 触发管理 → 创建触发器
- 触发方式：**API 网关触发**
- 请求方法：**GET**
- 鉴权方式：**免鉴权**（由函数内 `X-Api-Key` 校验）
- 创建后获得 URL，形如：`https://service-xxx.region.apigw.tencentcs.com/release/copilot-usage-reader`

### 7. 测试

```powershell
curl "https://<触发器URL>/?year=2026&month=7" -H "X-Api-Key: <你的密钥>"
```

预期返回：`{"usedCredits":1234,"date":"2026-07-13","queriedAt":"2026-07-13T15:30:00+08:00"}`

---

## 四、手动插入测试数据

### 方式 A：腾讯云控制台（推荐，无需装工具）

腾讯云控制台 → MongoDB → 实例 → 数据管理 → 选 `copilot` 库 → `copilot_usage` 集合 → 插入文档，逐条粘贴：

```json
{"_id":"2026-07-11","date":"2026-07-11","year":2026,"month":7,"day":11,"usedCredits":950,"queriedAt":"2026-07-11T17:00:00+08:00"}
```
```json
{"_id":"2026-07-12","date":"2026-07-12","year":2026,"month":7,"day":12,"usedCredits":1100,"queriedAt":"2026-07-12T17:00:00+08:00"}
```
```json
{"_id":"2026-07-13","date":"2026-07-13","year":2026,"month":7,"day":13,"usedCredits":1234,"queriedAt":"2026-07-13T15:30:00+08:00"}
```

### 方式 B：mongosh

```bash
mongosh "mongodb://用户名:密码@地址:端口/copilot"
```
```js
db.copilot_usage.insertMany([
  { _id: "2026-07-11", date: "2026-07-11", year: 2026, month: 7, day: 11, usedCredits: 950,  queriedAt: "2026-07-11T17:00:00+08:00" },
  { _id: "2026-07-12", date: "2026-07-12", year: 2026, month: 7, day: 12, usedCredits: 1100, queriedAt: "2026-07-12T17:00:00+08:00" },
  { _id: "2026-07-13", date: "2026-07-13", year: 2026, month: 7, day: 13, usedCredits: 1234, queriedAt: "2026-07-13T15:30:00+08:00" }
])
```

### 验证

查询 2026 年 7 月 → 返回 `usedCredits: 1234`（最新一天 07-13 的值）。

---

## 五、App 端代码变更

### 5.1 `src/types.ts` — 替换类型

删除 `CopilotConfig`，新增：

```ts
// 云函数数据源配置
export interface CloudFunctionConfig {
  endpoint: string;  // SCF API 网关触发器 URL
  secret: string;    // X-Api-Key 鉴权密钥
}
```

### 5.2 `src/utils/secureStorage.ts` — 替换存储函数

替换 key 常量与三个函数，逻辑不变（get/save/clear 三件套）：

- key：`copilot_username` / `copilot_token` → `cf_endpoint` / `cf_secret`
- 函数：`getCopilotConfig` → `getCloudFunctionConfig`，`saveCopilotConfig` → `saveCloudFunctionConfig`，`clearCopilotConfig` → `clearCloudFunctionConfig`
- 返回类型：`CloudFunctionConfig | null`

### 5.3 `src/api/copilot.ts` — 完全重写

保留文件名与导出函数名 `fetchCopilotCreditsUsed`（减少 App.tsx 改动），但参数与实现改为调用云函数：

- 参数：`(username, token, year, month)` → `(endpoint, secret, year, month)`
- URL：`{endpoint}?year={year}&month={month}`
- Header：`X-Api-Key: {secret}`
- 响应类型：`{ usedCredits: number | null; date: string | null; queriedAt: string | null }`
- `usedCredits` 为 null 时 throw（被 `refreshCopilotUsed` catch 后静默保留旧值）
- 保留 `fetchWithTimeout`（10s）与 `!resp.ok → throw` 模式

### 5.4 `src/components/CreditsEditor.tsx` — 替换配置区块

- Props 类型：`copilotConfig: CopilotConfig | null` → `cloudFunctionConfig: CloudFunctionConfig | null`
- `onSave` 签名第三参数：`CopilotConfig | null` → `CloudFunctionConfig | null`
- state：`githubUser` / `githubToken` → `cfEndpoint` / `cfSecret`
- 回填 effect：`copilotConfig?.username` → `cloudFunctionConfig?.endpoint`，`copilotConfig?.token` → `cloudFunctionConfig?.secret`
- 输入框：
  - GitHub 用户名 → 云函数 URL（label: "云函数 URL"，autoCapitalize none，left icon `cloud-outline`）
  - PAT → 鉴权密钥（label: "API 密钥"，secureTextEntry，left icon `key`）
- sectionHeader：图标 `github` → `cloud-outline`，标题 "GitHub Copilot 自动获取" → "云函数自动获取"
- 删除 PAT 格式提示（`github_pat_` 前缀检查）
- 帮助弹窗内容更新为：云函数 URL 与密钥的获取说明
- `handleSave`：构造 `{ endpoint, secret }` 或 null

### 5.5 `App.tsx` — 更新引用

- import：`CopilotConfig` → `CloudFunctionConfig`；`getCopilotConfig/saveCopilotConfig/clearCopilotConfig` → `getCloudFunctionConfig/saveCloudFunctionConfig/clearCloudFunctionConfig`
- state：`const [copilotConfig, setCopilotConfig]` → `const [cfConfig, setCfConfig]`
- ref：`copilotConfigRef` → `cfConfigRef`（`useRef<CloudFunctionConfig | null>(null)`）
- `refreshCopilotUsed`（L128-144）：
  - `const cfg = cfConfigRef.current`
  - `fetchCopilotCreditsUsed(cfg.endpoint, cfg.secret, y, m)`
- `handleSaveCredits`（L191+）：
  - 参数类型 `config: CloudFunctionConfig | null`
  - `saveCloudFunctionConfig(config.endpoint, config.secret)` / `clearCloudFunctionConfig()`
  - `cfConfigRef.current = config`；`setCfConfig(config)`
- 配置加载 effect（L157-159）：`getCloudFunctionConfig().then(setCfConfig)`
- 自动刷新 effect（L162-164）：`if (cfConfig) refreshCopilotUsed(year, month)`，deps 中 `copilotConfig` → `cfConfig`
- pull-to-refresh guard（L289）：`if (!cfConfigRef.current) return`
- CreditsEditor props：`copilotConfig={copilotConfig}` → `cloudFunctionConfig={cfConfig}`

---

## 假设与决策

1. **数据库产品**：TencentDB for MongoDB（腾讯云文档型数据库标准产品）
2. **usedCredits 语义**：每次抓取值是当月累计已用（非当日增量），与 GitHub API 一致。最新一天的值即当月已用总量
3. **鉴权方式**：简单共享密钥（`X-Api-Key` header），存入 SCF 环境变量 `API_SECRET`。单用户无需 OAuth/JWT
4. **云函数创建方式**：代码包上传（zip），单函数单依赖最简单
5. **MongoDB 连接**：SCF 与 MongoDB 同 VPC 内网访问；首次连接后缓存 MongoClient（SCF 容器复用）
6. **完全替换**：移除 GitHub PAT 相关代码（类型、存储、UI、API 实现），云函数成为唯一数据源
7. **API 契约不变**：app 端 `fetchCopilotCreditsUsed` 仍返回 `Promise<number>`，`refreshCopilotUsed` 逻辑不变（静默失败、未来月不拉取）
8. **数据缺失处理**：云函数返回 `usedCredits: null` → app 端 throw → `refreshCopilotUsed` catch 后静默保留旧值
9. **云函数代码位置**：放在仓库 `cloud-function/` 目录，与 app 代码同版本管理

## 验证步骤

### 云函数

- [ ] `curl "https://<URL>/?year=2026&month=7" -H "X-Api-Key: <密钥>"` → `{"usedCredits":1234,...}`
- [ ] 缺少/错误 X-Api-Key → 401
- [ ] 无数据的月份 → `{"usedCredits":null,...}`
- [ ] 无效 year/month → 400

### App 端

- [ ] CreditsEditor 输入云函数 URL + 密钥 → 保存成功
- [ ] 下拉刷新 → 成功获取 usedCredits 并更新 UI（显示 1234）
- [ ] 云函数返回 null（无数据月）→ 静默保留旧值，不崩溃
- [ ] 关闭网络下拉刷新 → 静默保留旧值
- [ ] 切换月份 → 自动拉取该月数据（非未来月）
- [ ] `npx tsc --noEmit` 无错误
