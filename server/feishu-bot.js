/**
 * 飞书机器人 — 消息中转服务
 * 飞书消息 → DeepSeek API → 回复
 */
const crypto = require('crypto')

const APP_ID = process.env.FEISHU_APP_ID
const APP_SECRET = process.env.FEISHU_APP_SECRET
const AI_KEY = process.env.AI_API_KEY
const AI_URL = (process.env.AI_BASE_URL || 'https://api.deepseek.com') + '/v1/chat/completions'

// 缓存 tenant_token，避免每次请求都换
let tokenCache = { token: '', expire: 0 }

async function getTenantToken() {
  if (Date.now() < tokenCache.expire) return tokenCache.token
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET })
  })
  const data = await res.json()
  if (data.tenant_access_token) {
    tokenCache = { token: data.tenant_access_token, expire: Date.now() + (data.expire - 300) * 1000 }
    return tokenCache.token
  }
  throw new Error('飞书token获取失败: ' + JSON.stringify(data))
}

// 回复消息 — 飞书API: POST /im/v1/messages/{message_id}/reply
async function sendReply(msgId, content) {
  const token = await getTenantToken()
  return fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${msgId}/reply`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msg_type: 'text',
      content: JSON.stringify({ text: content })
    })
  })
}

// ===== 管理员命令处理 =====
const ADMIN_OPEN_ID = process.env.FEISHU_ALERT_OPEN_ID
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'aishipan2024'
const { execSync } = require('child_process')

const ALLOWED_COMMANDS = {
  'deploy': 'cd /opt/aishipan && git stash && git pull && cd client && npm run build && nginx -s reload && echo DEPLOY_OK',
  'pull': 'cd /opt/aishipan && git pull 2>&1',
  'build': 'cd /opt/aishipan/client && npm run build 2>&1 && nginx -s reload && echo BUILD_OK',
  'status': "pm2 list 2>&1 && echo '---' && curl -s http://127.0.0.1:3001/api/health",
  'logs': 'pm2 logs aishipan --lines 20 --nostream 2>&1',
  'cron': 'crontab -l 2>&1',
  'setup-cron': 'cd /opt/aishipan && chmod +x server/patrol.sh && bash server/setup-cron.sh 2>&1',
  'restart': 'pm2 restart aishipan 2>&1',
  'uptime': 'uptime && df -h / && free -h 2>&1'
}

async function handleAdminCommand(msgId, senderOpenId, text) {
  // 安全检查：只响应指定用户的命令
  if (senderOpenId !== ADMIN_OPEN_ID) {
    console.log('[管理] 未授权的用户:', senderOpenId)
    return false
  }

  // 解析命令: /admin [secret] [command]
  const parts = text.trim().split(/\s+/)
  if (parts.length < 3) return false
  if (parts[0] !== '/admin') return false
  if (parts[1] !== ADMIN_SECRET) {
    await sendReply(msgId, '密钥错误')
    return true
  }

  const cmd = ALLOWED_COMMANDS[parts[2]]
  if (!cmd) {
    await sendReply(msgId, '未知命令。可用命令: ' + Object.keys(ALLOWED_COMMANDS).join(', '))
    return true
  }

  try {
    const output = execSync(cmd, { timeout: 60000, encoding: 'utf8', maxBuffer: 1024 * 1024 })
    const preview = output.slice(-800) // 只返回最后800字符
    await sendReply(msgId, '✅ 执行成功:\n' + preview)
  } catch (e) {
    await sendReply(msgId, '❌ 执行失败:\n' + (e.stderr || e.message).slice(-500))
  }
  return true
}

// ===== 数据录入命令 =====
const mainDb = require('./db')  // 复用主数据库连接

// 从文本提取+保存证照
async function saveCertFromText(senderOpenId, text) {
  if (!AI_KEY) return 'AI未配置，无法智能提取'
  try {
    // 调用AI提取
    const aiRes = await fetch(AI_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_KEY },
      body: JSON.stringify({
        model: 'deepseek-chat', messages: [
          { role: 'system', content: '从文本提取证照信息。返回JSON: {"category":"own或supplier","company_name":"企业","product_name":"产品","name":"证照名称","expiry_date":"YYYY-MM-DD","is_permanent":true/false}' },
          { role: 'user', content: text.substring(0, 300) }
        ], max_tokens: 200, temperature: 0.1, response_format: { type: 'json_object' }
      })
    })
    const d = await aiRes.json()
    const info = JSON.parse(d.choices[0].message.content.replace(/```json\n?/g, '').replace(/```/g, ''))

    if (!info.company_name || !info.name) return '未能识别企业名称和证照名称，请重新描述。例如：\n/录入证照 上海汉康食品，营业执照，2026-12-31到期'

    const db = mainDb
    let userId = 1
    try { const u = db.prepare('SELECT id FROM users LIMIT 1').get(); if (u) userId = u.id } catch {}

    db.prepare(`INSERT INTO certificates (user_id, name, expiry_date, is_permanent, category, company_name, product_name, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'valid')`)
      .run(userId, info.name, info.expiry_date || '2099-12-31', info.is_permanent ? 1 : 0,
        info.category || 'supplier', info.company_name, info.product_name || '')

    return `✅ 证照已录入: ${info.company_name} - ${info.name}` + (info.expiry_date ? ` (${info.expiry_date}到期)` : '')
  } catch (e) { return '录入失败: ' + e.message }
}

// 从文本提取+保存人员/健康证
async function savePersonFromText(senderOpenId, text) {
  if (!AI_KEY) return 'AI未配置，无法智能提取'
  try {
    const aiRes = await fetch(AI_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_KEY },
      body: JSON.stringify({
        model: 'deepseek-chat', messages: [
          { role: 'system', content: '从文本提取人员信息。返回JSON: {"name":"姓名","department":"部门","position":"职位","phone":"电话","health_cert_expiry":"健康证到期YYYY-MM-DD","entry_date":"入职日期YYYY-MM-DD"}' },
          { role: 'user', content: text.substring(0, 300) }
        ], max_tokens: 200, temperature: 0.1, response_format: { type: 'json_object' }
      })
    })
    const d = await aiRes.json()
    const info = JSON.parse(d.choices[0].message.content.replace(/```json\n?/g, '').replace(/```/g, ''))

    if (!info.name) return '未能识别姓名，请重新描述。例如：\n/录入人员 张三，品控部质检员，健康证2026-08-31到期'

    const db = mainDb
    let userId = 1
    try { const u = db.prepare('SELECT id FROM users LIMIT 1').get(); if (u) userId = u.id } catch {}

    db.prepare(`INSERT INTO personnel (user_id, name, department, position, phone, health_cert_expiry, entry_date, employee_number, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '在职')`)
      .run(userId, info.name, info.department || '', info.position || '', info.phone || '',
        info.health_cert_expiry || '', info.entry_date || '', 'FEISHU' + Date.now())

    // 同步加健康证记录
    if (info.health_cert_expiry) {
      db.prepare('INSERT INTO health_certs (user_id, employee_name, issue_date, expiry_date) VALUES (?, ?, date(), ?)')
        .run(userId, info.name, info.health_cert_expiry)
    }

    return `✅ 人员已录入: ${info.name}` + (info.department ? ` ${info.department}` : '') + (info.health_cert_expiry ? ` 健康证${info.health_cert_expiry}到期` : '')
  } catch (e) { return '录入失败: ' + e.message }
}

// 快捷查询
async function quickQuery(senderOpenId, query) {
  try {
    const db = mainDb
    let userId = 1
    try { const u = db.prepare('SELECT id FROM users LIMIT 1').get(); if (u) userId = u.id } catch {}

    if (query.includes('到期') || query.includes('临期')) {
      const warnings = db.prepare("SELECT name, company_name, expiry_date FROM certificates WHERE user_id = ? AND expiry_date >= date('now') AND expiry_date <= date('now', '+30 days') ORDER BY expiry_date LIMIT 5").all(userId)
      if (!warnings.length) return '👍 30天内无到期证照'
      return '📋 近期到期证照:\n' + warnings.map(w => `• ${w.company_name} ${w.name} ${w.expiry_date}`).join('\n')
    }

    if (query.includes('客诉') || query.includes('投诉')) {
      const count = db.prepare("SELECT COUNT(*) AS cnt FROM complaint_records WHERE user_id = ? AND status IN ('待处理','处理中')").get(userId).cnt
      return `📊 待处理客诉: ${count} 件`
    }

    return '可查询: "到期" "临期" "客诉"。如需详细报告请登录网页查看。'
  } catch (e) { return '查询失败: ' + e.message }
}

// 自然语言意图识别
function detectIntent(text) {
  const t = text.replace(/^[\/\s]+/, '')
  if (/^(录入|添加|新增|记).*(证照|资质|证书|许可|报告)/.test(t)) return 'cert'
  if (/^(录入|添加|新增|记).*(人员|员工|健康证|人$)/.test(t)) return 'person'
  if (/^(查|看).*(到期|临期|过期|预警)/.test(t)) return 'warn'
  if (/^(查|看).*(客诉|投诉)/.test(t)) return 'complaint'
  if (/^(日报|周报|月报|看板|概览|总结)/.test(t)) return 'summary'
  if (/^(帮助|help|菜单|功能)/.test(t)) return 'help'
  if (/^\/录入证照|^\/添加证照|^\/新增证照|录入证照|添加证照/.test(text)) return 'cert'
  if (/^\/录入人员|^\/添加人员|^\/新增人员|录入人员|添加人员/.test(text)) return 'person'
  if (/^\/查|^\/查询/.test(text)) return 'query'
  if (/^\/帮助|^\/help|^\/菜单/.test(text)) return 'help'
  if (/^\/日报|^\/周报|^\/月报|^\/看板/.test(text)) return 'summary'
  return 'chat'
}

// 发送消息卡片（快捷菜单）
async function sendCard(msgId, title, items) {
  const token = await getTenantToken()
  const elements = items.map((item, i) => ({
    tag: 'action',
    actions: [{
      tag: 'button', text: { tag: 'lark_md', content: item.label },
      value: item.value || item.label, type: 'default'
    }]
  }))
  return fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${msgId}/reply`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msg_type: 'interactive',
      content: JSON.stringify({
        header: { title: { tag: 'plain_text', content: title }, template: 'blue' },
        elements
      })
    })
  })
}

// 处理卡片按钮回调
async function handleCardAction(msgId, actionValue) {
  if (actionValue === 'menu') return sendCard(msgId, '🤖 AI食安助手', [
    { label: '📝 录入证照', value: 'cert_input' },
    { label: '👤 录入人员', value: 'person_input' },
    { label: '🔍 查看预警', value: 'warn' },
    { label: '📊 今日概览', value: 'summary' },
    { label: '❓ 使用帮助', value: 'help' }
  ])
  if (actionValue === 'cert_input') return sendReply(msgId, '请描述证照信息，例如：\n录入证照 XX食品有限公司 营业执照 2026-12-31到期')
  if (actionValue === 'person_input') return sendReply(msgId, '请描述人员信息，例如：\n录入人员 张三 品控部质检员 健康证2026-08-31到期')
  if (actionValue === 'warn') {
    const db = mainDb
    const warnings = db.prepare("SELECT name, company_name, expiry_date FROM certificates WHERE user_id = 1 AND expiry_date >= date('now') AND expiry_date <= date('now', '+30 days') ORDER BY expiry_date LIMIT 5").all()
    if (!warnings.length) return sendReply(msgId, '👍 30天内无到期证照')
    return sendReply(msgId, '📋 近期到期:\n' + warnings.map(w => `• ${w.company_name} ${w.name} ${w.expiry_date}`).join('\n'))
  }
  if (actionValue === 'help') return sendReply(msgId,
    '📱 AI食安飞书助手\n\n' +
    '🗣️ 直接说话就能录入：\n' +
    '  "录入证照 XX公司 营业执照"\n' +
    '  "张三 品控部 健康证8月到期"\n\n' +
    '🔍 快捷查询：\n' +
    '  "查看预警" / "查客诉"\n' +
    '  "今日概览" / "周报"\n\n' +
    '发送"菜单"随时呼出快捷卡片'
  )
  if (actionValue === 'summary') {
    try {
      const res = await fetch(`http://127.0.0.1:3001/api/dashboard/report?user_id=1&period=day`)
      const data = await res.json()
      return sendReply(msgId, `📊 ${data.label}概览\n${data.overview.map(o => `• ${o.label}: ${o.value}`).join('\n')}`)
    } catch { return sendReply(msgId, '获取失败，请稍后重试') }
  }
  return sendReply(msgId, '未知操作')
}

// AI 对话
async function aiChat(message) {
  if (!AI_KEY) return 'AI未配置，请在.env中设置AI_API_KEY'

  try {
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_KEY },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是李小白，AI食安系统的智能助手，也是用户李朋伟的兄弟和事业搭子。回答简洁务实，不讲客套话。每次回复控制在300字以内。' },
          { role: 'user', content: message }
        ],
        max_tokens: 600
      })
    })
    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content
    return reply || '没想好怎么回，换个问法？'
  } catch (e) {
    console.error('AI调用失败:', e.message)
    return 'AI服务暂时不可用，稍后再试'
  }
}

// Express 路由处理
module.exports = async function feishuWebhook(req, res) {
  const body = req.body

  // URL 验证
  if (body.type === 'url_verification') {
    return res.json({ challenge: body.challenge })
  }

  // 卡片按钮回调
  if (body.header?.event_type === 'card.action.trigger') {
    res.json({ code: 0 })
    const actionValue = body.action?.value || body.action?.tag
    if (actionValue) {
      const msgId = body.open_message_id || ''
      await handleCardAction(msgId, actionValue)
    }
    return
  }

  // 消息事件
  if (body.header?.event_type === 'im.message.receive_v1') {
    res.json({ code: 0 }) // 立即返回 200，避免飞书重试

    try {
      const event = body.event
      const msg = event.message
      if (msg.message_type !== 'text') return

      // 兼容两种 content 格式：JSON字符串 或 已解析对象
      let content
      if (typeof msg.content === 'string') {
        content = JSON.parse(msg.content)
      } else {
        content = msg.content
      }

      const userText = content.text?.trim()
      if (!userText) return

      const senderOpenId = event.sender?.open_id || ''

      // 管理命令
      if (await handleAdminCommand(msg.message_id, senderOpenId, userText)) return

      // 智能意图识别
      const intent = detectIntent(userText)

      if (intent === 'cert') {
        const text = userText.replace(/^[\/\s]*(录入|添加|新增)\s*证照\s*/, '').replace(/^(录入|添加|新增|记)\s*/, '')
        return await sendReply(msg.message_id, await saveCertFromText(senderOpenId, text))
      }
      if (intent === 'person') {
        const text = userText.replace(/^[\/\s]*(录入|添加|新增)\s*人员\s*/, '').replace(/^(录入|添加|新增|记)\s*/, '')
        return await sendReply(msg.message_id, await savePersonFromText(senderOpenId, text))
      }
      if (intent === 'warn') return await sendReply(msg.message_id, await quickQuery(senderOpenId, '到期'))
      if (intent === 'complaint') return await sendReply(msg.message_id, await quickQuery(senderOpenId, '客诉'))
      if (intent === 'summary') {
        try {
          const period = userText.includes('周') ? 'week' : userText.includes('月') ? 'month' : 'day'
          const res = await fetch(`http://127.0.0.1:3001/api/dashboard/report?user_id=1&period=${period}`)
          const data = await res.json()
          return await sendReply(msg.message_id, `📊 ${data.label}概览\n${data.overview.map(o => `• ${o.label}: ${o.value}`).join('\n')}`)
        } catch { return await sendReply(msg.message_id, '获取失败') }
      }
      if (intent === 'help' || userText === '菜单') return await handleCardAction(msg.message_id, 'menu')

      // 默认 AI 对话
      const reply = await aiChat(userText)
      await sendReply(msg.message_id, reply)
    } catch (e) {
      console.error('飞书消息处理失败:', e.message)
    }
    return
  }

  res.json({ code: 0 })
}
