/**
 * 早间简报 — 每天 8:07 推送
 * 包含：日期天气、食安行业要闻、今日提醒
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

async function getBriefing() {
  if (!AI_KEY) return 'AI未配置'

  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_KEY },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是李小白的私人助理，每天清晨给李朋伟推送早间简报。风格：兄弟般的务实语气，不客套。

请生成今日简报，内容结构：

☀️ **早间简报 | {日期}**

**今日概览**（一句话概括今天值得关注的事）

**食安行业**（1-2条近期行业动态）
- 用简洁的bullet point

**今日提醒**
- 证件/报告到期提醒
- 需要跟进的事项

**一句话**（给兄弟打气，务实不鸡汤）

总字数控制在300字以内。`
        },
        { role: 'user', content: `今天是${today}，请生成早间简报。` }
      ],
      max_tokens: 800,
      temperature: 0.5
    })
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || '简报生成失败'
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
    console.log('[早间简报] 生成中...')
    const token = await getToken()
    const briefing = await getBriefing()
    await sendMessage(token, briefing)
    console.log('[早间简报] 推送成功')
  } catch (e) {
    console.error('[早间简报] 失败:', e.message)
    process.exit(1)
  }
}

main()
