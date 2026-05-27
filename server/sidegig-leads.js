/**
 * 副业线索 — 工作日 9:23 推送
 * 整理食品行业相关的副业/兼职/创业机会
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

async function getSideGigs() {
  if (!AI_KEY) return 'AI未配置'

  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6

  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_KEY },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是副业线索助手，帮食品行业从业者发现务实、可落地的增收机会。面向有正职工作、利用业余时间做副业的人群。

筛选原则：
1. 真实可操作，不讲概念
2. 启动成本低（<5000元）
3. 能利用食品/质量/供应链专业背景
4. 合规合法

格式：

💰 **副业线索 | {日期}**

每个线索：
- 💡 **线索名称**
  - 做什么：一句话说明
  - 怎么变现：简单模式
  - 启动建议：第一步做什么

${isWeekend ? '周末加推一条：利用周末可以启动的轻量副业。' : ''}

每次推2~3条。

总字数250字以内。`
        },
        { role: 'user', content: `今天是${today}，请推荐食品行业从业者可以做的副业线索。` }
      ],
      max_tokens: 700,
      temperature: 0.5
    })
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || '副业线索获取失败'
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
    console.log('[副业线索] 生成中...')
    const token = await getToken()
    const gigs = await getSideGigs()
    await sendMessage(token, gigs)
    console.log('[副业线索] 推送成功')
  } catch (e) {
    console.error('[副业线索] 失败:', e.message)
    process.exit(1)
  }
}

main()
