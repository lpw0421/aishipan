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

// 回复消息
async function sendReply(receiveIdType, receiveId, content, msgId) {
  const token = await getTenantToken()
  return fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${receiveIdType}/reply`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receive_id: receiveId,
      msg_type: 'text',
      content: JSON.stringify({ text: content })
    })
  })
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

      // 兼容两种 sender 格式
      const senderId = event.sender?.open_id || event.sender?.sender_id?.open_id

      const reply = await aiChat(userText)
      const receiveId = msg.chat_type === 'p2p' ? senderId : msg.chat_id
      const receiveType = msg.chat_type === 'p2p' ? 'open_id' : 'chat_id'
      await sendReply(receiveType, receiveId, reply, msg.message_id)
    } catch (e) {
      console.error('飞书消息处理失败:', e.message, e.stack)
    }
    return
  }

  res.json({ code: 0 })
}
