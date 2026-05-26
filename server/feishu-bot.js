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

      // 优先检查管理命令
      const senderOpenId = event.sender?.open_id || ''
      const isAdmin = await handleAdminCommand(msg.message_id, senderOpenId, userText)
      if (isAdmin) return

      const reply = await aiChat(userText)
      await sendReply(msg.message_id, reply)
    } catch (e) {
      console.error('飞书消息处理失败:', e.message)
    }
    return
  }

  res.json({ code: 0 })
}
