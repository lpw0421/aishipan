/**
 * AI 大模型审核模块
 *
 * 使用 DeepSeek / 通义千问的 OpenAI 兼容接口进行食品标签智能审核。
 * 未配置 AI_API_KEY 时，系统自动降级为 V1.0 规则审核。
 */

// AI 审核提示词
const SYSTEM_PROMPT = `你是一个食品标签审核专家。请根据 GB 7718-2025《食品安全国家标准 预包装食品标签通则》审核以下食品标签文本。

审核规则（7项）：
R01: 必须标示食品名称
R02: 必须标示配料表
R03: 必须标示净含量和规格
R04: 必须标示生产者名称
R05: 必须标示生产日期和保质期
R06: 必须标示贮存条件
R07: 必须标示食品生产许可证编号(SC)

请严格输出以下 JSON 格式（不要输出其他内容）：
{
  "passed": true或false,
  "results": [
    {"rule_code": "R01", "rule_name": "食品名称", "passed": true或false, "detail": "具体检测说明", "suggestion": "整改建议（不通过时填写）"},
    ...
  ],
  "summary": "总体评价和建议"
}`

// 调用 AI 大模型进行审核
async function aiAudit(ocrText) {
  const apiKey = process.env.AI_API_KEY
  const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com'

  if (!apiKey) {
    console.log('⚠️  未配置 AI_API_KEY，降级使用规则审核')
    return null
  }

  console.log('🤖 正在调用 AI 大模型进行智能审核...')
  console.log('   模型服务:', baseUrl)

  try {
    const response = await fetch(baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: '请审核以下食品标签文本：\n\n' + ocrText }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('❌ AI 调用失败:', response.status, errText)
      return null
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // 提取 JSON（AI 可能在 JSON 前后加了说明文字）
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('❌ AI 返回格式异常，无法解析 JSON')
      return null
    }

    const result = JSON.parse(jsonMatch[0])
    console.log('✅ AI 审核完成')
    return result
  } catch (err) {
    console.error('❌ AI 调用异常:', err.message)
    return null  // 返回 null 使调用方降级
  }
}

module.exports = { aiAudit }
