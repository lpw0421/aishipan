/**
 * 食品安全舆情监控 — 每日推送
 * 使用 DeepSeek API 整理近期食品安全违规/召回/抽检不合格新闻
 */
const fs = require('fs')
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

async function getSentimentNews() {
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
          content: `你是食品安全舆情监控助手。请根据你的知识，列出最近两周内中国食品安全领域最值得关注的舆情事件（3~5条）。

筛选标准：
1. 重大食品召回/安全事件
2. 知名品牌被处罚/曝光
3. 市场监管总局抽检中发现的严重问题（兽药残留、违法添加、假冒伪劣等）
4. 引发社会广泛关注的食品安全话题

对每个事件，严格按以下格式输出：
---
⚠️ **事件标题（一句话）**
- 来源：发布机构/媒体
- 时间：YYYY-MM-DD
- 概要：一句话概括核心问题
- 影响：对食品企业的启示
---

如果近期没有重大事件，输出"今日无重大食安舆情"。

末尾加一句：⚠️ 以上信息基于AI知识库，具体请以官方发布为准。`}
        , { role: 'user', content: `今天是${today}，请整理近期重大食品安全舆情事件。只推送真正有价值的信息，日常例行抽检结果不必列入。` }
      ],
      max_tokens: 1500,
      temperature: 0.3
    })
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || '舆情信息获取失败'
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
    console.log('[舆情监控] 开始获取...')
    const token = await getToken()
    const news = await getSentimentNews()

    // 无重大事件则静默退出
    if (news.includes('无重大食安舆情')) {
      console.log('[舆情监控] 今日无重大事件，静默退出')
      return
    }

    const today = new Date().toLocaleDateString('zh-CN')
    const msg = `🔍 食安舆情预警 — ${today}\n\n${news}`
    await sendMessage(token, msg)
    console.log('[舆情监控] 推送成功')
  } catch (e) {
    console.error('[舆情监控] 失败:', e.message)
    process.exit(1)
  }
}

main()
