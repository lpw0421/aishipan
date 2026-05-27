/**
 * 岗位雷达 — 工作日 9:07 推送
 * 整理食品安全/质量相关招聘信息
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

async function getJobs() {
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
          content: `你是岗位雷达助手，帮食品行业从业者发现好机会。请根据你的知识，推荐食品行业近期值得关注的岗位方向（3个以内）。

关注方向：
1. 食品安全/质量管理岗（经理/主管级）
2. 供应链/采购质量管理岗
3. 食品法规/合规岗
4. 新兴方向：AI+食品、数字化质量

格式：

💼 **岗位雷达 | {日期}**

每个岗位方向：
- 🎯 **方向名称**
  - 薪资参考：XX万-XX万/年
  - 技能要求：核心3项
  - 建议：为什么值得关注

${isWeekend ? '今天周末，加上一句"周末看看机会，不着急，享受休息日。"' : ''}

如果没有特别值得关注的方向，就说"今日市场平稳"并给出一个职业发展建议。

总字数250字以内。`
        },
        { role: 'user', content: `今天是${today}，请推荐食品行业近期值得关注的岗位方向。` }
      ],
      max_tokens: 700,
      temperature: 0.5
    })
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || '岗位信息获取失败'
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
    console.log('[岗位雷达] 生成中...')
    const token = await getToken()
    const jobs = await getJobs()
    await sendMessage(token, jobs)
    console.log('[岗位雷达] 推送成功')
  } catch (e) {
    console.error('[岗位雷达] 失败:', e.message)
    process.exit(1)
  }
}

main()
