// 通过腾讯云 SCF 云函数获取 Copilot AI Credits 用量
// 云函数内部查询 MongoDB，返回当月最新一条文档的 usedCredits

// 云函数响应结构
interface CloudUsageResponse {
  usedCredits: number | null;
  date: string | null;
  queriedAt: string | null;
}

const FETCH_TIMEOUT = 10000; // 云函数冷启动可能较慢，给 10s

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

// 返回某年某月已用 AI Credits（当月最新一条文档的累计值）
export async function fetchCopilotCreditsUsed(
  endpoint: string,
  secret: string,
  year: number,
  month: number
): Promise<number> {
  const url = `${endpoint}?year=${year}&month=${month}`;

  const resp = await fetchWithTimeout(url, {
    headers: { 'X-Api-Key': secret },
  });

  if (!resp.ok) {
    throw new Error(`Cloud function ${resp.status}`);
  }

  const data = (await resp.json()) as CloudUsageResponse;
  if (data.usedCredits == null) {
    throw new Error('No usage data for this month');
  }
  return data.usedCredits;
}
