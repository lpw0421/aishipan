/**
 * AI热闻 — 每天 8:23 推送
 * 整理近期AI领域重大进展，聚焦食品/供应链行业应用
 */
require('dotenv').config({ path: '/opt/aishipan/server/.env.production' })

const APP_ID = process.env.FEISHU_APP_ID
const APP_SECRET = process.env.FEISHU_APP_SECRET
const AI_KEY = process.env.AI_API_KEY
const USER_OPEN_ID = process.env.FEISHU_ALERT_OPEN_ID
const AI_URL = (process.env.AI_BASE_URL || 'https://api.deepseek.com') + '/v1/chat/completions'

async function getToken() {
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET })
  })
  const data = await res.json()
  if (!data.tenant_access_token) throw new Error('飞书token获取失败: ' + JSON.stringify(data))
  return data.tenant_access_token
}

async function getAINews() {
  if (!AI_KEY) return 'AI未配置'

  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })

  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_KEY },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是AI技术追踪助手。请整理近期AI领域值得关注的进展（3~5条），优先选择对食品安全/供应链/制造业有应用价值的。

格式：

🤖 **AI热闻 | {日期}**

每条新闻：
- 🔥 **标题**
  - 要点：一句话说明
  - 启示：对食安行业的潜在价值

如果近期没有重大进展，诚实说"本周AI领域相对平静"并推荐一篇值得读的文章方向。

总字数300字以内。`
        },
        { role: 'user', content: `今天是${today}，请整理近期AI领域值得关注的进展。` }
      ],
      max_tokens: 800,
      temperature: 0.4
    })
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || 'AI热闻获取失败'
}

async function sendMessage(token, content) {
  await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receive_id: USER_OPEN_ID,
      msg_type: 'text',
      content: JSON.stringify({ text: content })
    })
  })
}

async function main() {
  try {
    console.log('[AI热闻] 生成中...')
    const token = await getToken()
    const news = await getAINews()
    await sendMessage(token, news)
    console.log('[AI热闻] 推送成功')
  } catch (e) {
    console.error('[AI热闻] 失败:', e.message)
    process.exit(1)
  }
}

main()
