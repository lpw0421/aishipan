/**
 * PDF 审核报告生成模块
 *
 * 使用 pdfkit 生成专业的食品标签审核报告。
 */

const PDFDocument = require('pdfkit')

// 中文字体暂用系统默认（Helvetica）。如需完整中文支持，
// 可下载思源黑体 .ttf 文件并调用 doc.font('xxx.ttf')

function generateReport(label, auditResults) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const doc = new PDFDocument({ size: 'A4', margin: 50 })

    // 收集 PDF 数据
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))

    // ----- 头部 -----
    doc.fontSize(22).text('AI 食安', { align: 'center' })
    doc.fontSize(14).text('食品标签审核报告', { align: 'center' })
    doc.moveDown(0.3)
    doc.fontSize(10).text('生成日期：' + new Date().toLocaleDateString('zh-CN'), { align: 'center' })
    doc.moveDown(0.5)

    // 分隔线
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(1)

    // ----- 基本信息 -----
    doc.fontSize(13).text('一、基本信息', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(11)
    doc.text('  产品名称：' + label.product_name)
    doc.text('  食品分类：' + label.category)
    doc.text('  上传时间：' + label.created_at)
    doc.text('  审核方式：' + (process.env.AI_API_KEY ? 'AI 智能审核' : 'V1.0 规则审核'))
    doc.moveDown(0.5)

    // ----- 审核结论 -----
    const allPassed = auditResults.every(r => r.passed)
    const passedCount = auditResults.filter(r => r.passed).length
    const totalCount = auditResults.length

    doc.fontSize(13).text('二、审核结论', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(12)
    const conclusionColor = allPassed ? '#67c23a' : '#f56c6c'
    doc.fillColor(conclusionColor)
      .text('  ' + (allPassed ? '✅ 审核通过' : '❌ 审核未通过') + '（' + passedCount + '/' + totalCount + '）')
    doc.fillColor('#000')
    doc.moveDown(0.5)

    // ----- 审核明细 -----
    doc.fontSize(13).text('三、审核明细', { underline: true })
    doc.moveDown(0.5)

    // 表头
    const tableTop = doc.y
    const colX = [50, 120, 200, 280, 390]
    doc.fontSize(10)
    doc.text('编号', colX[0], tableTop)
    doc.text('规则名称', colX[1], tableTop)
    doc.text('检测项', colX[2], tableTop)
    doc.text('结果', colX[3], tableTop)
    doc.text('说明', colX[4], tableTop)
    doc.moveDown(0.3)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.3)

    // 表体
    auditResults.forEach((row, i) => {
      const rowY = doc.y
      doc.fontSize(9)
      doc.text(row.rule_code, colX[0], rowY)
      doc.text(row.rule_name, colX[1], rowY)
      doc.text(row.passed ? '通过' : '不通过', colX[2], rowY, { width: 60 })
      const resultColor = row.passed ? '#67c23a' : '#f56c6c'
      doc.fillColor(resultColor).text(row.passed ? '✓ 合规' : '✗ 不合规', colX[3], rowY, { width: 80 })
      doc.fillColor('#000')
      doc.text(row.detail || '', colX[4], rowY, { width: 150 })
      doc.moveDown(0.8)
    })

    doc.moveDown(0.5)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(1)

    // ----- AI 建议 -----
    if (process.env.AI_API_KEY) {
      doc.fontSize(13).text('四、AI 整改建议', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(10)
      auditResults
        .filter(r => !r.passed && r.detail)
        .forEach(r => {
          doc.text('  【' + r.rule_name + '】' + (r.detail || ''))
          doc.moveDown(0.3)
        })
      doc.moveDown(0.5)
    }

    // ----- 免责声明 -----
    doc.fontSize(9).fillColor('#999')
    doc.text('免责声明：本报告由 AI 食安系统自动生成，审核结果仅供参考，不作为法律依据。', { align: 'center' })
    doc.text('食品标签合规性请以国家市场监督管理总局官方规定为准。', { align: 'center' })

    doc.end()
  })
}

module.exports = { generateReport }
