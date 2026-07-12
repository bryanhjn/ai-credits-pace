// GitHub Copilot AI Credits 用量 API
// 端点：GET /users/{username}/settings/billing/ai_credit/usage
// 文档：https://docs.github.com/en/rest/billing/usage#get-billing-ai-credit-usage-report-for-a-user

// 响应中单条用量项（仅取需要的字段）
interface AiCreditUsageItem {
  grossQuantity: number;
}

interface AiCreditUsageResponse {
  timePeriod: { year: number };
  user: string;
  usageItems: AiCreditUsageItem[];
}

const GITHUB_API = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const FETCH_TIMEOUT = 10000; // 网络可能较慢，给 10s

// 带超时的 fetch
async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// 返回某年某月已用 AI Credits（usageItems 中 grossQuantity 求和）
// grossQuantity = 消耗总量（含免费额度内部分）；netQuantity 是超额计费部分，不取
export async function fetchCopilotCreditsUsed(
  username: string,
  token: string,
  year: number,
  month: number
): Promise<number> {
  const url =
    `${GITHUB_API}/users/${encodeURIComponent(username)}` +
    `/settings/billing/ai_credit/usage?year=${year}&month=${month}`;

  const resp = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
    },
  });

  if (!resp.ok) {
    throw new Error(`GitHub API ${resp.status}`);
  }

  const data = (await resp.json()) as AiCreditUsageResponse;
  return (data.usageItems ?? []).reduce((sum, it) => sum + (it.grossQuantity ?? 0), 0);
}
