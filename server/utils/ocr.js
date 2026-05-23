/**
 * OCR 模拟模块
 *
 * 当前为模拟实现，用于开发和测试。
 * 后续替换为真实 OCR API（如百度 OCR、腾讯 OCR）时，
 * 只需修改此文件中的 recognize 函数，不改动其他代码。
 *
 * 真实接入示例：
 *   const res = await axios.post('https://api.ocr.com/recognize', { image: imageBase64 })
 *   return res.data.text
 */

// 模拟 OCR：接收图片路径，返回一段包含食品标签信息的文本
function recognize(imagePath) {
  console.log('🔍 [模拟OCR] 正在识别:', imagePath)

  // 模拟食品标签文本（包含所有 GB 7718 必需标示项）
  const mockText = `
    产品名称：纯牛奶
    配料表：生牛乳
    净含量：250毫升
    生产者名称：光明乳业股份有限公司
    生产日期：2026年4月15日
    保质期：6个月
    贮存条件：请于2℃-6℃冷藏保存
    食品生产许可证编号：SC10512345678901
  `

  console.log('✅ [模拟OCR] 识别完成')
  return mockText
}

module.exports = { recognize }
