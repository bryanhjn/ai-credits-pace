const tcb = require('@cloudbase/node-sdk');

// 云开发环境内自动识别环境，无需传 env
const app = tcb.init();
const db = app.database();
const _ = db.command;

// SCF 事件 header 大小写不确定，做不敏感查找
function getHeader(event, name) {
  const headers = event.headers || {};
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) return headers[k];
  }
  return undefined;
}

exports.main = async (event) => {
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

  // 4. 查询当月最新一条（_id 降序）
  try {
    const result = await db.collection('copilot_usage')
      .where({
        _id: _.gte(startDate).and(_.lt(nextStart))
      })
      .orderBy('_id', 'desc')
      .limit(1)
      .get();

    if (!result.data || result.data.length === 0) {
      return {
        isBase64Encoded: false,
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usedCredits: null, date: null, queriedAt: null }),
      };
    }

    const doc = result.data[0];
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
