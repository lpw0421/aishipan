/**
 * 食品安全法规追踪 — 每日定时推送
 * 每天早上推送近期食品安全相关新规
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
  if (!data.tenant_access_token) throw new Error('token获取失败: ' + JSON.stringify(data))
  return data.tenant_access_token
}

async function getRegulationNews() {
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
          content: `你是食品安全法规追踪助手。请根据你的知识，列出最近一个月内中国发布的食品安全相关新法规、标准或政策（5条以内）。

对每条法规，按以下格式输出（严格换行）：
---
📜 **法规名称**
- 发布机构：XXX
- 发布日期：YYYY-MM-DD
- 生效日期：YYYY-MM-DD
- 核心内容：一句话概括要点
- 影响范围：对食品企业的影响
---

如果近期没有重大新规，就说"近期无重大食品安全新规发布"并给出一个行业提醒。

末尾加一句：⚠️ 以上信息基于AI知识库，具体请以国家市场监管总局、国家卫健委等官方发布为准。`
        },
        { role: 'user', content: `今天是${today}，请整理近期食品安全法规动态。` }
      ],
      max_tokens: 1500,
      temperature: 0.3
    })
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || '法规信息获取失败'
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
    console.log('[法规追踪] 开始获取...')
    const token = await getToken()
    const news = await getRegulationNews()
    const today = new Date().toLocaleDateString('zh-CN')
    const msg = `📋 食品安全法规追踪 — ${today}\n\n${news}`
    await sendMessage(token, msg)
    console.log('[法规追踪] 推送成功')
  } catch (e) {
    console.error('[法规追踪] 失败:', e.message)
    process.exit(1)
  }
}

main()
