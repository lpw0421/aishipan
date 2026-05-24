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

// 多国出口标签审核提示词
const EXPORT_PROMPTS = {
  '印度尼西亚': `你是一个印尼食品标签审核专家。请根据 BPOM 法规要求审核以下食品标签文本。
检查项：清真认证标识、印尼语标注、进口商信息、营养成分表格式、添加剂标注。
请输出 JSON：{"results": [{"item": "检查项名称", "passed": true/false, "detail": "说明"}], "summary": "总结"}`,

  '日本': `你是一个日本食品标签审核专家。请根据 JAS 法和食品表示法审核以下食品标签文本。
检查项：过敏原标注方式、营养强调表述、添加剂分类、原产地标识、赏味期限标注。
请输出 JSON：{"results": [{"item": "检查项名称", "passed": true/false, "detail": "说明"}], "summary": "总结"}`,

  '美国': `你是一个美国 FDA 食品标签审核专家。请根据 FDA 21 CFR Part 101 审核以下食品标签文本。
检查项：营养成分表格式（美式）、过敏原声明(FALCPA)、健康声称、净含量单位、配料表排序。
请输出 JSON：{"results": [{"item": "检查项名称", "passed": true/false, "detail": "说明"}], "summary": "总结"}`,

  '马来西亚': `你是一个马来西亚食品标签审核专家。请根据 Food Regulations 1985 审核以下食品标签文本。
检查项：清真认证标识、马来语标注、营养成分表格式、添加剂编码、进口商信息。
请输出 JSON：{"results": [{"item": "检查项名称", "passed": true/false, "detail": "说明"}], "summary": "总结"}`,

  '加拿大': `你是一个加拿大食品标签审核专家。请根据 Safe Food for Canadians Regulations 审核以下食品标签文本。
检查项：英法双语标注、营养成分表格式、过敏原声明、净含量声明、生产商信息。
请输出 JSON：{"results": [{"item": "检查项名称", "passed": true/false, "detail": "说明"}], "summary": "总结"}`,

  '港澳地区': `你是一个港澳食品标签审核专家。请根据香港/澳门食品标签规定审核以下食品标签文本。
检查项：繁体中文标注、营养声称方式、添加剂标注方式、净含量单位、贮存条件。
请输出 JSON：{"results": [{"item": "检查项名称", "passed": true/false, "detail": "说明"}], "summary": "总结"}`
}

// AI 多国出口标签审核
async function aiExportAudit(ocrText, targetMarket) {
  const apiKey = process.env.AI_API_KEY
  const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com'

  if (!apiKey) {
    console.log('⚠️  未配置 AI_API_KEY，无法进行出口标签审核')
    return null
  }

  const systemPrompt = EXPORT_PROMPTS[targetMarket] || EXPORT_PROMPTS['日本']

  try {
    const response = await fetch(baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '请审核以下标签文本：\n\n' + ocrText }
        ],
        temperature: 0.1, max_tokens: 2000
      })
    })
    if (!response.ok) return null
    const data = await response.json()
    const content = data.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch (err) {
    console.error('❌ AI 出口审核异常:', err.message)
    return null
  }
}

// AI 营养成分生成
async function aiNutritionGen(productName, ingredients) {
  const apiKey = process.env.AI_API_KEY
  const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com'

  if (!apiKey) {
    console.log('⚠️  未配置 AI_API_KEY，无法生成营养成分')
    return null
  }

  const ingredientList = ingredients.map((ing, i) =>
    `${i + 1}. ${ing.name} — 用量 ${ing.amount}g/100g产品`
  ).join('\n')

  const systemPrompt = `你是一个食品营养学专家。请根据提供的产品配方，计算每100g产品的营养成分表，符合中国 GB 28050 标准。
输出 JSON 格式：
{
  "product_name": "产品名称",
  "nutrition": {
    "energy": {"value": 数字, "unit": "kJ", "nrv": "数字%"},
    "protein": {"value": 数字, "unit": "g", "nrv": "数字%"},
    "fat": {"value": 数字, "unit": "g", "nrv": "数字%"},
    "carbohydrate": {"value": 数字, "unit": "g", "nrv": "数字%"},
    "sodium": {"value": 数字, "unit": "mg", "nrv": "数字%"}
  },
  "basis": "每100克(g)",
  "note": "计算说明"
}
NRV% 参考值：能量 8400kJ，蛋白质 60g，脂肪 ≤60g，碳水化合物 300g，钠 2000mg。`

  try {
    const response = await fetch(baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `产品名称：${productName}\n原料配方（每100g产品）：\n${ingredientList}` }
        ],
        temperature: 0.1, max_tokens: 2000
      })
    })
    if (!response.ok) return null
    const data = await response.json()
    const content = data.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch (err) {
    console.error('❌ AI 营养成分生成异常:', err.message)
    return null
  }
}

// AI 配料表校验
async function aiIngredientsVerify(ingredientText) {
  const apiKey = process.env.AI_API_KEY
  const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com'

  if (!apiKey) {
    console.log('⚠️  未配置 AI_API_KEY，无法校验配料表')
    return null
  }

  const systemPrompt = `你是一个食品标签审核专家。请根据 GB 7718 对配料表进行深度校验。
检查维度：
1. 添加量排序：是否按递减顺序排列
2. 配料名称规范：是否使用国家标准名称
3. 过敏原提示：是否含致敏物质并标注
4. 添加剂标识：是否使用标准名称或 INS 编号
5. 复配添加剂：展开标注是否合规

输出 JSON：
{
  "results": [
    {"dimension": "维度名称", "passed": true/false/partial, "detail": "具体说明", "suggestion": "建议"}
  ],
  "allergens": ["识别的过敏原列表"],
  "additives": ["识别的添加剂列表"],
  "summary": "总体评价"
}`

  try {
    const response = await fetch(baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '请校验以下配料表：\n\n' + ingredientText }
        ],
        temperature: 0.1, max_tokens: 2000
      })
    })
    if (!response.ok) return null
    const data = await response.json()
    const content = data.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch (err) {
    console.error('❌ AI 配料表校验异常:', err.message)
    return null
  }
}

// AI 供应商评分
async function aiSupplierScore(supplierData) {
  const apiKey = process.env.AI_API_KEY
  const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com'

  if (!apiKey) {
    console.log('⚠️  未配置 AI_API_KEY，无法进行供应商评分')
    return null
  }

  const systemPrompt = `你是一个供应链食品安全管理专家。请根据提供的供应商数据，对供应商进行多维度评分。

评分维度（满分100分）：
1. 资质完整性（30分）：证照数量、是否齐全、是否在有效期内
2. 产品质量（30分）：检测报告合格率、不合格次数
3. 历史表现（20分）：合作记录、稳定性
4. 合规性（20分）：证照过期情况、风险提示

评分等级：A(90-100), B(75-89), C(60-74), D(<60)

请输出 JSON：
{
  "total_score": 85,
  "level": "B",
  "level_label": "良好",
  "dimensions": [
    {"name": "资质完整性", "score": 26, "max": 30, "comment": "评价说明"},
    {"name": "产品质量", "score": 25, "max": 30, "comment": "评价说明"},
    {"name": "历史表现", "score": 18, "max": 20, "comment": "评价说明"},
    {"name": "合规性", "score": 16, "max": 20, "comment": "评价说明"}
  ],
  "summary": "总体评价和改进建议",
  "risk_tips": ["风险提示1", "风险提示2"]
}`

  const dataText = JSON.stringify(supplierData, null, 2)

  try {
    const response = await fetch(baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '请评估以下供应商：\n\n' + dataText }
        ],
        temperature: 0.1, max_tokens: 2000
      })
    })
    if (!response.ok) return null
    const data = await response.json()
    const content = data.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch (err) {
    console.error('❌ AI 供应商评分异常:', err.message)
    return null
  }
}

// AI 客诉分类定级
async function aiComplaintClassify(complaintText) {
  const apiKey = process.env.AI_API_KEY
  const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com'

  if (!apiKey) {
    console.log('⚠️  未配置 AI_API_KEY，无法进行客诉分类')
    return null
  }

  const systemPrompt = `你是一个食品企业客诉管理专家。请根据客诉内容进行自动分类定级。

投诉类型：异物/变质/过敏/标签错误/包装破损/缺斤少两/服务态度/其他
紧急程度：🔴紧急(食品安全相关:异物/变质/过敏) / 🟡一般(标签/包装) / 🟢轻微(服务态度/缺斤少两)
风险等级：高/中/低

输出 JSON：
{
  "complaint_type": "投诉类型",
  "type_confidence": "置信度百分比",
  "urgency": "紧急/一般/轻微",
  "urgency_reason": "定级原因",
  "risk_level": "高/中/低",
  "keywords": ["识别的关键词"],
  "suggested_handler": "建议处理部门(质量部/客服部/生产部)",
  "similar_cases": "可能的相似案例类型",
  "sla_response": "建议响应时效(2h/24h/48h)",
  "sla_resolve": "建议处理时效"
}`

  try {
    const response = await fetch(baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '请对以下客诉内容进行分类定级：\n\n' + complaintText }
        ],
        temperature: 0.1, max_tokens: 1000
      })
    })
    if (!response.ok) return null
    const data = await response.json()
    const content = data.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch (err) {
    console.error('❌ AI 客诉分类异常:', err.message)
    return null
  }
}

// AI 客诉回复生成
async function aiComplaintReply(complaintInfo) {
  const apiKey = process.env.AI_API_KEY
  const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com'

  if (!apiKey) {
    console.log('⚠️  未配置 AI_API_KEY，无法生成客诉回复')
    return null
  }

  const systemPrompt = `你是一个食品企业客服专家。请根据客诉信息生成专业、诚恳的回复话术。

要求：
1. 语气诚恳、表示歉意
2. 说明已采取的调查或处理措施
3. 给出具体解决方案（换货/退款/补偿）
4. 提供联系方式供客户进一步沟通
5. 回复简洁专业，200字以内

输出 JSON：
{
  "reply_content": "完整回复话术",
  "tone": "正式/亲切/严肃",
  "compensation_suggested": "建议的补偿方式",
  "follow_up_action": "建议的后续跟进措施",
  "reply_channel": "建议的回复渠道(电话/短信/邮件)"
}`

  const infoText = JSON.stringify(complaintInfo, null, 2)

  try {
    const response = await fetch(baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '请为以下客诉生成回复话术：\n\n' + infoText }
        ],
        temperature: 0.3, max_tokens: 1500
      })
    })
    if (!response.ok) return null
    const data = await response.json()
    const content = data.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch (err) {
    console.error('❌ AI 客诉回复异常:', err.message)
    return null
  }
}

// AI 客诉根因分析
async function aiComplaintAnalysis(analysisData) {
  const apiKey = process.env.AI_API_KEY
  const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com'

  if (!apiKey) {
    console.log('⚠️  未配置 AI_API_KEY，无法进行根因分析')
    return null
  }

  const systemPrompt = `你是一个食品企业质量管理专家。请对客诉进行根因分析。

分析维度：
1. 直接原因：导致问题的直接因素
2. 根本原因：流程/管理/设备/人员的深层原因
3. 影响范围：该问题可能影响的批次、产品范围
4. 整改建议：具体的整改措施和预防方案

输出 JSON：
{
  "possible_causes": [
    {"cause": "可能原因", "probability": "概率百分比", "evidence": "支持证据", "check_items": ["排查项1", "排查项2"]}
  ],
  "affected_scope": "影响范围分析",
  "rectification_plan": [
    {"action": "整改措施", "responsible": "责任部门", "deadline": "建议期限"}
  ],
  "prevention_measures": ["预防措施1", "预防措施2"],
  "risk_level_after": "整改后残余风险(高/中/低/无)",
  "summary": "综合分析结论"
}`

  const dataText = JSON.stringify(analysisData, null, 2)

  try {
    const response = await fetch(baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '请对以下客诉进行根因分析：\n\n' + dataText }
        ],
        temperature: 0.1, max_tokens: 2000
      })
    })
    if (!response.ok) return null
    const data = await response.json()
    const content = data.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch (err) {
    console.error('❌ AI 根因分析异常:', err.message)
    return null
  }
}

module.exports = { aiAudit, aiExportAudit, aiNutritionGen, aiIngredientsVerify, aiSupplierScore, aiComplaintClassify, aiComplaintReply, aiComplaintAnalysis }
