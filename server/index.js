// 按环境加载对应的 .env 文件
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development'
require('dotenv').config({ path: require('path').join(__dirname, envFile) })
// 再加载通用 .env 兜底
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
const path = require('path')
const multer = require('multer')
const cron = require('node-cron')
const XLSX = require('xlsx')
const rateLimit = require('express-rate-limit')
const db = require('./db')
const { recognize } = require('./utils/ocr')
const { aiAudit, aiExportAudit, aiNutritionGen, aiIngredientsVerify, aiSupplierScore, aiComplaintClassify, aiComplaintReply, aiComplaintAnalysis } = require('./utils/ai')
const { generateReport } = require('./utils/report')
const feishuWebhook = require('./feishu-bot')

const app = express()
const PORT = process.env.PORT || 3001
const isProduction = process.env.NODE_ENV === 'production'

// ---------- 中间件 ----------
app.use(cors())
app.use(express.json())

// 飞书 Webhook 路由——必须放在 sanitize 中间件之前，否则 content 中的 JSON 会被破坏
app.post('/api/feishu/webhook', feishuWebhook)

// XSS 防护：对请求体中的字符串字段做 HTML 转义
function sanitize(obj) {
  if (typeof obj === 'string') {
    return obj
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
  }
  if (Array.isArray(obj)) return obj.map(sanitize)
  if (obj && typeof obj === 'object') {
    const cleaned = {}
    for (const key of Object.keys(obj)) {
      cleaned[key] = sanitize(obj[key])
    }
    return cleaned
  }
  return obj
}

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitize(req.body)
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitize(req.query)
  }
  next()
})

// 文件上传路由需要额外执行 sanitize，因为 multer 处理 body 在此中间件之后
function sanitizeUploadBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitize(req.body)
  }
  next()
}

// 通用限流：每个 IP 每分钟最多 100 次请求
// express-rate-limit v8: standardHeaders/legacyHeaders 已废弃，使用默认头
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: '请求过于频繁，请稍后再试' }
})

// 敏感接口限流：登录/注册/AI 审核，每个 IP 每分钟最多 10 次
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: '操作过于频繁，请1分钟后再试' }
})

app.use('/api', generalLimiter)

// 托管 uploads 文件夹，使前端可通过 /uploads/xxx.jpg 访问上传的图片
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// ---------- multer 文件上传配置 ----------
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext
    cb(null, name)
  }
})

// 允许的 MIME 类型 + 扩展名双重校验（JPEG 不同系统可能报 image/jpg）
const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx']

function fileFilter(req, file, cb) {
  const ext = file.originalname.split('.').pop().toLowerCase()
  if (ALLOWED_TYPES.includes(file.mimetype) || ALLOWED_EXTS.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error('不支持的文件格式，仅允许 jpg/png/gif/pdf/doc/docx'))
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },  // 10MB
  fileFilter
})

// multer 配置：标签文件存入 uploads/labels 子目录
const labelsStorage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads', 'labels'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext
    cb(null, name)
  }
})
const labelsUpload = multer({ storage: labelsStorage })

// ---------- 工具函数 ----------

// SHA256 密码哈希
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

// 根据到期日期和是否长期有效计算证照状态
function getStatus(expiryDate, isPermanent = false) {
  if (isPermanent) return 'valid'  // 长期有效永远正常
  const now = new Date()
  const expiry = new Date(expiryDate)
  const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'expiring_soon'
  return 'valid'
}

// ---------- 预警推送配置 ----------

// 企业微信/钉钉 Webhook 地址（配置真实地址后启用）
const WEBHOOK_URL = ''

// 检查临期证照并发送预警通知
function checkAndNotify() {
  console.log('\n===== [预警任务] 开始检查证照到期情况 =====')
  console.log('时间:', new Date().toLocaleString())

  // 查询所有 30 天内到期且尚未过期的证照（资质 + 健康证）
  const today = new Date().toISOString().slice(0, 10)
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + 30)
  const deadlineStr = deadline.toISOString().slice(0, 10)

  // 临期资质（排除长期有效）
  const certRows = db.prepare(`
    SELECT c.name AS title, c.company_name, c.expiry_date, 'certificate' AS type, u.username
    FROM certificates c
    JOIN users u ON c.user_id = u.id
    WHERE c.is_permanent = 0 AND c.expiry_date >= ? AND c.expiry_date <= ?
    ORDER BY c.expiry_date ASC
  `).all(today, deadlineStr)

  // 临期健康证
  const healthRows = db.prepare(`
    SELECT h.employee_name AS title, h.expiry_date, 'health_cert' AS type, u.username
    FROM health_certs h
    JOIN users u ON h.user_id = u.id
    WHERE h.expiry_date >= ? AND h.expiry_date <= ?
    ORDER BY h.expiry_date ASC
  `).all(today, deadlineStr)

  // 虫害-供应商资质文档临期
  const pestSupplierRows = db.prepare(`
    SELECT psd.doc_name AS title, psd.company_name, psd.expiry_date, 'pest_supplier_doc' AS type, u.username
    FROM pest_supplier_docs psd
    JOIN users u ON psd.user_id = u.id
    WHERE psd.expiry_date != '' AND psd.expiry_date >= ? AND psd.expiry_date <= ?
    ORDER BY psd.expiry_date ASC
  `).all(today, deadlineStr)

  // 虫害-人员证件临期
  const pestStaffCertRows = db.prepare(`
    SELECT psc.cert_name AS title, s.name AS employee_name, psc.expiry_date, 'pest_staff_cert' AS type, u.username
    FROM pest_staff_certs psc
    JOIN users u ON psc.user_id = u.id
    LEFT JOIN pest_staff s ON psc.staff_id = s.id
    WHERE psc.expiry_date != '' AND psc.expiry_date >= ? AND psc.expiry_date <= ?
    ORDER BY psc.expiry_date ASC
  `).all(today, deadlineStr)

  // 虫害-化学品文档临期
  const pestChemDocRows = db.prepare(`
    SELECT pcd.doc_name AS title, c.name AS chemical_name, pcd.expiry_date, 'pest_chemical_doc' AS type, u.username
    FROM pest_chemical_docs pcd
    JOIN users u ON pcd.user_id = u.id
    LEFT JOIN pest_chemicals c ON pcd.chemical_id = c.id
    WHERE pcd.expiry_date != '' AND pcd.expiry_date >= ? AND pcd.expiry_date <= ?
    ORDER BY pcd.expiry_date ASC
  `).all(today, deadlineStr)

  // 计量校准-设备下次校准临期
  const calDeviceRows = db.prepare(`
    SELECT cd.device_name AS title, cd.device_number, cd.next_calibration_date AS expiry_date, 'calibration_device' AS type, u.username
    FROM calibration_devices cd
    JOIN users u ON cd.user_id = u.id
    WHERE cd.next_calibration_date != '' AND cd.next_calibration_date >= ? AND cd.next_calibration_date <= ?
      AND cd.calibration_status != '停用'
    ORDER BY cd.next_calibration_date ASC
  `).all(today, deadlineStr)

  // 产品报告临期
  const productReportRows = db.prepare(`
    SELECT pr.product_name AS title, pr.expiry_date, 'product_report' AS type, u.username
    FROM product_reports pr
    JOIN users u ON pr.user_id = u.id
    WHERE pr.expiry_date != '' AND pr.expiry_date >= ? AND pr.expiry_date <= ?
    ORDER BY pr.expiry_date ASC
  `).all(today, deadlineStr)

  // 体系文件评审临期
  const sysDocRows = db.prepare(`
    SELECT sd.doc_name AS title, sd.review_date AS expiry_date, 'sys_doc' AS type, u.username
    FROM sys_docs sd
    JOIN users u ON sd.user_id = u.id
    WHERE sd.review_date != '' AND sd.review_date >= ? AND sd.review_date <= ?
      AND sd.status = '现行有效'
    ORDER BY sd.review_date ASC
  `).all(today, deadlineStr)

  // 培训证书临期
  const trainingCertRows = db.prepare(`
    SELECT tc.employee_name AS title, tc.cert_type, tc.expiry_date, 'training_cert' AS type, u.username
    FROM training_certs tc
    JOIN users u ON tc.user_id = u.id
    WHERE tc.expiry_date != '' AND tc.expiry_date >= ? AND tc.expiry_date <= ?
    ORDER BY tc.expiry_date ASC
  `).all(today, deadlineStr)

  const rows = [...certRows, ...healthRows, ...pestSupplierRows, ...pestStaffCertRows, ...pestChemDocRows, ...calDeviceRows, ...productReportRows, ...sysDocRows, ...trainingCertRows]
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))

  if (rows.length === 0) {
    console.log('✅ 暂无临期证照')
    return
  }

  console.log(`⚠️  发现 ${rows.length} 个临期证照:`)
  const insertNotify = db.prepare(
    'INSERT INTO notifications (user_id, title, content, type, source_type) VALUES (?, ?, ?, ?, ?)'
  )
  rows.forEach((row, i) => {
    const diff = Math.ceil((new Date(row.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
        const typeMap = { certificate: '资质', health_cert: '健康证', pest_supplier_doc: '虫害供应商文档', pest_staff_cert: '虫害人员证件', pest_chemical_doc: '虫害化学品文档', calibration_device: '计量校准设备', product_report: '产品检测报告', sys_doc: '体系文件评审', training_cert: '培训证书' }
    const typeLabel = typeMap[row.type] || row.type
    const companyLabel = row.company_name ? ` [${row.company_name}]` : (row.employee_name ? ` [${row.employee_name}]` : (row.device_number ? ` [${row.device_number}]` : ''))
    console.log(`  ${i + 1}. [${row.username}] ${row.title}${companyLabel}（${typeLabel}）- ${row.expiry_date}（剩余 ${diff} 天）`)
    // 写入通知表（同一个证照同一天不重复通知）
    const title = row.company_name ? `${row.company_name} - ${row.title}` : row.title
    const content = `${typeLabel}「${row.title}」将于 ${row.expiry_date} 到期，剩余 ${diff} 天`
    const userId = db.prepare('SELECT id FROM users WHERE username = ?').get(row.username)?.id
    if (userId) {
      const exists = db.prepare(
        "SELECT id FROM notifications WHERE user_id = ? AND source_type = ? AND content = ? AND date(created_at) = date('now')"
      ).get(userId, row.type, content)
      if (!exists) {
        insertNotify.run(userId, title, content, 'warning', row.type)
      }
    }
  })

  // 如果有 Webhook URL，则发送通知
  if (WEBHOOK_URL) {
    const message = rows.map(r =>
      `【${r.username}】${r.title} 将于 ${r.expiry_date} 到期`
    ).join('\n')

    console.log('📤 已推送到 Webhook:', WEBHOOK_URL)
    console.log('📋 推送内容:\n' + message)
  } else {
    console.log('💡 提示：配置 WEBHOOK_URL 后可自动推送到企业微信/钉钉')
  }

  console.log('===== [预警任务] 检查完毕 =====\n')
}

// ---------- 接口 ----------

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ message: 'AI 食安后端已启动' })
})

// 飞书机器人 webhook 已移至中间件之前（绕过 XSS sanitize）

// ===== 注册接口 =====
app.post('/api/auth/register', strictLimiter, (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' })
  }
  if (password.length < 6) {
    return res.status(400).json({ message: '密码长度不能少于6位' })
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) {
    return res.status(409).json({ message: '用户名已存在，请换一个' })
  }

  const hashed = hashPassword(password)
  const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashed)

  res.json({ message: '注册成功', userId: result.lastInsertRowid })
})

// ===== 登录接口 =====
app.post('/api/auth/login', strictLimiter, (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' })
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user) {
    return res.status(401).json({ message: '用户名或密码错误' })
  }

  if (hashPassword(password) !== user.password) {
    return res.status(401).json({ message: '用户名或密码错误' })
  }

  res.json({
    message: '登录成功',
    user: { id: user.id, username: user.username, createdAt: user.created_at }
  })
})

// ===== 证照管理接口 =====

// 获取当前用户的证照列表（支持按分类筛选和关键词搜索）
app.get('/api/certificates', (req, res) => {
  const userId = req.query.user_id
  const category = req.query.category || ''
  const keyword = req.query.keyword || ''

  if (!userId) {
    return res.status(400).json({ message: '缺少用户标识' })
  }

  let sql = 'SELECT * FROM certificates WHERE user_id = ?'
  const params = [userId]

  if (category) {
    sql += ' AND category = ?'
    params.push(category)
  }

  if (keyword) {
    sql += ' AND (company_name LIKE ? OR name LIKE ? OR product_name LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw, kw)
  }

  sql += ' ORDER BY created_at DESC'

  const rows = db.prepare(sql).all(...params)

  // 动态计算每个证照的过期状态
  const list = rows.map(row => ({
    ...row,
    status: getStatus(row.expiry_date, row.is_permanent)
  }))

  res.json({ list })
})

// 导出证照为 Excel 文件（支持 ?ids=1,2,3 批量导出）
app.get('/api/certificates/export', (req, res) => {
  const userId = req.query.user_id
  const ids = req.query.ids ? req.query.ids.split(',').map(Number).filter(n => n > 0) : []
  if (!userId) {
    return res.status(400).json({ message: '缺少用户标识' })
  }

  let sql = 'SELECT * FROM certificates WHERE user_id = ?'
  const params = [userId]
  if (ids.length > 0) {
    sql += ` AND id IN (${ids.map(() => '?').join(',')})`
    params.push(...ids)
  }
  sql += ' ORDER BY created_at DESC'
  const rows = db.prepare(sql).all(...params)

  const data = rows.map(row => ({
    '资质分类': { own: '自有资质', supplier: '供应商资质' }[row.category] || row.category,
    '公司名称': row.company_name,
    '供应产品': row.product_name || '',
    '证照名称': row.name,
    '到期时间': row.is_permanent ? '长期' : row.expiry_date,
    '状态': getStatus(row.expiry_date, row.is_permanent) === 'expired' ? '已过期' :
            getStatus(row.expiry_date, row.is_permanent) === 'expiring_soon' ? '临期' : '正常',
    '创建时间': row.created_at
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 12 },  // 资质分类
    { wch: 25 },  // 公司名称
    { wch: 20 },  // 供应产品
    { wch: 20 },  // 证照名称
    { wch: 15 },  // 到期时间
    { wch: 10 },  // 状态
    { wch: 20 }   // 创建时间
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '证照列表')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('证照列表.xlsx'))
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

// 新增证照（支持多文件上传：最多5个，单个≤10MB）
app.post('/api/certificates', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, category, company_name, product_name, name, expiry_date, is_permanent } = req.body
  if (!user_id || !name || !company_name) {
    return res.status(400).json({ message: '请填写证照名称和公司名称' })
  }
  // 长期有效时不需要到期时间
  if (!is_permanent && !expiry_date) {
    return res.status(400).json({ message: '请填写到期时间或选择长期有效' })
  }

  const finalExpiry = is_permanent ? '2099-12-31' : expiry_date

  // 多文件路径存为 JSON 数组
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  const filePaths = JSON.stringify(paths)

  const result = db.prepare(
    'INSERT INTO certificates (user_id, category, company_name, product_name, name, expiry_date, file_paths, is_permanent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(user_id, category || 'own', company_name, product_name || '', name, finalExpiry, filePaths, is_permanent ? 1 : 0)

  res.json({
    message: '证照添加成功',
    id: result.lastInsertRowid
  })
})

// 编辑证照
app.put('/api/certificates/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, category, company_name, product_name, name, expiry_date, is_permanent } = req.body

  const existing = db.prepare('SELECT * FROM certificates WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) {
    return res.status(404).json({ message: '证照不存在或无权编辑' })
  }

  // is_permanent：前端传 'true'/'false' 字符串或布尔
  const permanent = is_permanent === 'true' || is_permanent === true ? 1 : 0
  const finalExpiry = permanent ? '2099-12-31' : (expiry_date || existing.expiry_date)

  // 如果上传了新文件则合并路径：保留的旧文件 + 新上传的文件
  let filePaths = existing.file_paths || '[]'
  // existing_files 经过 XSS 过滤引号已被转义，需还原后再解析 JSON
  const existingRaw = (req.body.existing_files || '[]')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
  const existingKept = JSON.parse(existingRaw)

  if (req.files && req.files.length > 0) {
    const newPaths = req.files.map(f => '/uploads/' + f.filename)
    filePaths = JSON.stringify([...existingKept, ...newPaths])
  } else {
    // 没有新文件时，使用用户保留的已有文件列表
    filePaths = JSON.stringify(existingKept)
  }

  db.prepare(
    'UPDATE certificates SET category=?, company_name=?, product_name=?, name=?, expiry_date=?, file_paths=?, is_permanent=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(category || existing.category, company_name || existing.company_name, product_name || '', name || existing.name, finalExpiry, filePaths, permanent, id)

  res.json({ message: '证照更新成功' })
})

// 删除证照（同时物理删除附件文件）
app.delete('/api/certificates/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const fs = require('fs')

  const cert = db.prepare('SELECT * FROM certificates WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!cert) {
    return res.status(404).json({ message: '证照不存在或无权删除' })
  }

  // 删除服务器上的附件文件
  try {
    const paths = JSON.parse(cert.file_paths || '[]')
    paths.forEach(p => {
      const filePath = path.join(__dirname, p)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    })
  } catch {}

  db.prepare('DELETE FROM certificates WHERE id = ?').run(id)
  res.json({ message: '证照已删除' })
})

// 批量删除证照
app.post('/api/certificates/batch-delete', (req, res) => {
  const { user_id, ids } = req.body
  const fs = require('fs')

  if (!user_id || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: '请选择要删除的证照' })
  }

  // 先查出所有文件路径用于物理删除
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(
    `SELECT * FROM certificates WHERE id IN (${placeholders}) AND user_id = ?`
  ).all(...ids, user_id)

  if (rows.length === 0) {
    return res.status(404).json({ message: '未找到可删除的证照' })
  }

  // 物理删除附件
  let deletedFiles = 0
  rows.forEach(cert => {
    try {
      const paths = JSON.parse(cert.file_paths || '[]')
      paths.forEach(p => {
        const filePath = path.join(__dirname, p)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          deletedFiles++
        }
      })
    } catch {}
  })

  // 批量删除数据库记录
  db.prepare(`DELETE FROM certificates WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, user_id)

  res.json({ message: `已删除 ${rows.length} 条证照记录`, deletedFiles, count: rows.length })
})

// ===== 产品检测报告 =====

app.get('/api/product-reports', (req, res) => {
  const { user_id, keyword, report_type, conclusion } = req.query
  let sql = 'SELECT * FROM product_reports WHERE user_id = ?'
  const params = [user_id]
  if (keyword) { sql += ' AND (product_name LIKE ? OR report_number LIKE ? OR agency_name LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%', '%'+keyword+'%') }
  if (report_type) { sql += ' AND report_type = ?'; params.push(report_type) }
  if (conclusion) { sql += ' AND conclusion = ?'; params.push(conclusion) }
  sql += ' ORDER BY created_at DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.post('/api/product-reports', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, product_name, product_batch, report_number, report_type, agency_name, test_date, expiry_date, conclusion, unqualified_items } = req.body
  if (!product_name) return res.status(400).json({ message: '请填写产品名称' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  db.prepare(
    'INSERT INTO product_reports (user_id, product_name, product_batch, report_number, report_type, agency_name, test_date, expiry_date, conclusion, unqualified_items, file_paths) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(user_id, product_name, product_batch || '', report_number || '', report_type || '微生物检测', agency_name || '', test_date || '', expiry_date || '', conclusion || '合格', unqualified_items || '', JSON.stringify(paths))
  res.json({ message: '添加成功' })
})

app.put('/api/product-reports/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, product_name, product_batch, report_number, report_type, agency_name, test_date, expiry_date, conclusion, unqualified_items } = req.body
  const existing = db.prepare('SELECT * FROM product_reports WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '记录不存在' })
  let paths = JSON.parse(existing.file_paths || '[]')
  try { const keep = JSON.parse(req.body.existing_files || '[]'); paths = [...keep] } catch {}
  if (req.files && req.files.length > 0) { req.files.forEach(f => paths.push('/uploads/' + f.filename)) }
  const filePaths = JSON.stringify(paths)
  db.prepare(
    'UPDATE product_reports SET product_name=?, product_batch=?, report_number=?, report_type=?, agency_name=?, test_date=?, expiry_date=?, conclusion=?, unqualified_items=?, file_paths=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(product_name || existing.product_name, product_batch || existing.product_batch, report_number || existing.report_number, report_type || existing.report_type, agency_name || existing.agency_name, test_date || existing.test_date, expiry_date || existing.expiry_date, conclusion || existing.conclusion, unqualified_items || existing.unqualified_items, filePaths, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/product-reports/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const report = db.prepare('SELECT * FROM product_reports WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!report) return res.status(404).json({ message: '记录不存在' })
  try { JSON.parse(report.file_paths || '[]').forEach(p => { try { require('fs').unlinkSync('.' + p) } catch {} }) } catch {}
  db.prepare('DELETE FROM product_reports WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

app.post('/api/product-reports/batch-delete', (req, res) => {
  const { user_id, ids } = req.body
  if (!user_id || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '请选择要删除的报告' })
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(`SELECT * FROM product_reports WHERE id IN (${placeholders}) AND user_id = ?`).all(...ids, user_id)
  if (rows.length === 0) return res.status(404).json({ message: '未找到可删除的报告' })
  rows.forEach(r => { try { JSON.parse(r.file_paths || '[]').forEach(p => { try { require('fs').unlinkSync('.' + p) } catch {} }) } catch {} })
  db.prepare(`DELETE FROM product_reports WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, user_id)
  res.json({ message: `已删除 ${rows.length} 条报告`, count: rows.length })
})

app.get('/api/product-reports/export', (req, res) => {
  const { user_id } = req.query
  const rows = db.prepare('SELECT * FROM product_reports WHERE user_id = ? ORDER BY created_at DESC').all(user_id)
  const data = rows.map(r => ({
    '产品名称': r.product_name, '产品批次': r.product_batch, '报告编号': r.report_number,
    '报告类型': r.report_type, '检测机构': r.agency_name, '检测日期': r.test_date,
    '有效期至': r.expiry_date, '检测结论': r.conclusion, '不合格项': r.unqualified_items
  }))
  const XLSX = require('xlsx')
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '产品报告')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename=product_reports.xlsx')
  res.send(buf)
})

// ===== 体系文件管理 =====

app.get('/api/sys-docs', (req, res) => {
  const { user_id, doc_type, keyword, status } = req.query
  let sql = 'SELECT * FROM sys_docs WHERE user_id = ?'
  const params = [user_id]
  if (doc_type) { sql += ' AND doc_type = ?'; params.push(doc_type) }
  if (keyword) { sql += ' AND (doc_name LIKE ? OR doc_number LIKE ? OR content LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%', '%'+keyword+'%') }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  sql += ' ORDER BY doc_type, doc_number'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.post('/api/sys-docs', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, doc_type, doc_number, doc_name, version, author, reviewer, approver, effective_date, review_date, status, category, associated_doc, applicable_dept, retention_period, content, url } = req.body
  if (!doc_name) return res.status(400).json({ message: '请填写文件名称' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  db.prepare(
    'INSERT INTO sys_docs (user_id, doc_type, doc_number, doc_name, version, author, reviewer, approver, effective_date, review_date, status, category, associated_doc, applicable_dept, retention_period, content, url, file_paths) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(user_id, doc_type || 'procedure', doc_number || '', doc_name, version || 'V1.0', author || '', reviewer || '', approver || '', effective_date || '', review_date || '', status || '现行有效', category || '', associated_doc || '', applicable_dept || '', retention_period || '', content || '', url || '', JSON.stringify(paths))
  res.json({ message: '添加成功' })
})

app.put('/api/sys-docs/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, doc_type, doc_number, doc_name, version, author, reviewer, approver, effective_date, review_date, status, category, associated_doc, applicable_dept, retention_period, content, url } = req.body
  const existing = db.prepare('SELECT * FROM sys_docs WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '文件不存在' })
  let paths = JSON.parse(existing.file_paths || '[]')
  try { const keep = JSON.parse(req.body.existing_files || '[]'); paths = [...keep] } catch {}
  if (req.files && req.files.length > 0) { req.files.forEach(f => paths.push('/uploads/' + f.filename)) }
  const filePaths = JSON.stringify(paths)
  // 如果版本号变更，记录版本历史
  if (version && version !== existing.version) {
    db.prepare('INSERT INTO sys_doc_versions (doc_id, version, change_log, file_paths) VALUES (?,?,?,?)').run(id, version, req.body.change_log || '', filePaths)
  }
  db.prepare(
    'UPDATE sys_docs SET doc_type=?, doc_number=?, doc_name=?, version=?, author=?, reviewer=?, approver=?, effective_date=?, review_date=?, status=?, category=?, associated_doc=?, applicable_dept=?, retention_period=?, content=?, url=?, file_paths=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(doc_type || existing.doc_type, doc_number || existing.doc_number, doc_name || existing.doc_name, version || existing.version, author || existing.author, reviewer || existing.reviewer, approver || existing.approver, effective_date || existing.effective_date, review_date || existing.review_date, status || existing.status, category || existing.category, associated_doc || existing.associated_doc, applicable_dept || existing.applicable_dept, retention_period || existing.retention_period, content || existing.content, url || existing.url, filePaths, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/sys-docs/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const doc = db.prepare('SELECT * FROM sys_docs WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!doc) return res.status(404).json({ message: '文件不存在' })
  try { JSON.parse(doc.file_paths || '[]').forEach(p => { try { require('fs').unlinkSync('.' + p) } catch {} }) } catch {}
  db.prepare('DELETE FROM sys_doc_versions WHERE doc_id = ?').run(id)
  db.prepare('DELETE FROM sys_docs WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

app.post('/api/sys-docs/batch-delete', (req, res) => {
  const { user_id, ids } = req.body
  if (!user_id || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '请选择要删除的文件' })
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(`SELECT * FROM sys_docs WHERE id IN (${placeholders}) AND user_id = ?`).all(...ids, user_id)
  if (rows.length === 0) return res.status(404).json({ message: '未找到可删除的文件' })
  rows.forEach(r => { try { JSON.parse(r.file_paths || '[]').forEach(p => { try { require('fs').unlinkSync('.' + p) } catch {} }) } catch {} })
  db.prepare(`DELETE FROM sys_doc_versions WHERE doc_id IN (${placeholders})`).run(...ids)
  db.prepare(`DELETE FROM sys_docs WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, user_id)
  res.json({ message: `已删除 ${rows.length} 个文件`, count: rows.length })
})

app.get('/api/sys-docs/export', (req, res) => {
  const { user_id, doc_type } = req.query
  let sql = 'SELECT * FROM sys_docs WHERE user_id = ?'
  const params = [user_id]
  if (doc_type) { sql += ' AND doc_type = ?'; params.push(doc_type) }
  const rows = db.prepare(sql).all(...params)
  const data = rows.map(r => ({
    '文件编号': r.doc_number, '文件名称': r.doc_name, '类型': r.doc_type,
    '版本': r.version, '编制人': r.author, '审核人': r.reviewer, '批准人': r.approver,
    '生效日期': r.effective_date, '下次评审': r.review_date, '状态': r.status
  }))
  const XLSX = require('xlsx')
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '体系文件')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename=sys_docs.xlsx')
  res.send(buf)
})

app.get('/api/sys-docs/:id/versions', (req, res) => {
  const versions = db.prepare('SELECT * FROM sys_doc_versions WHERE doc_id = ? ORDER BY created_at DESC').all(req.params.id)
  res.json({ list: versions })
})

// ===== 培训考核模块 =====

// ---- 培训计划 ----
app.get('/api/training/plans', (req, res) => {
  const { user_id, training_type, status, keyword } = req.query
  let sql = 'SELECT * FROM training_plans WHERE user_id = ?'; const params = [user_id]
  if (training_type) { sql += ' AND training_type = ?'; params.push(training_type) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (keyword) { sql += ' AND (plan_name LIKE ? OR plan_number LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%') }
  sql += ' ORDER BY planned_date DESC'
  res.json({ list: db.prepare(sql).all(...params) })
})
app.post('/api/training/plans', (req, res) => {
  const { user_id, plan_number, plan_name, training_type, planned_date, trainer, duration, planned_attendees, remark } = req.body
  if (!plan_name) return res.status(400).json({ message: '请填写计划名称' })
  db.prepare('INSERT INTO training_plans (user_id, plan_number, plan_name, training_type, planned_date, trainer, duration, planned_attendees, remark) VALUES (?,?,?,?,?,?,?,?,?)').run(user_id, plan_number||'', plan_name, training_type||'在岗复训', planned_date||'', trainer||'', duration||'', planned_attendees||0, remark||'')
  res.json({ message: '添加成功' })
})
app.put('/api/training/plans/:id', (req, res) => {
  const { id } = req.params; const existing = db.prepare('SELECT * FROM training_plans WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ message: '不存在' })
  const { plan_name, training_type, planned_date, trainer, duration, planned_attendees, actual_attendees, status, remark } = req.body
  db.prepare('UPDATE training_plans SET plan_name=?, training_type=?, planned_date=?, trainer=?, duration=?, planned_attendees=?, actual_attendees=?, status=?, remark=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(plan_name||existing.plan_name, training_type||existing.training_type, planned_date||existing.planned_date, trainer||existing.trainer, duration||existing.duration, planned_attendees!=null?planned_attendees:existing.planned_attendees, actual_attendees!=null?actual_attendees:existing.actual_attendees, status||existing.status, remark||existing.remark, id)
  res.json({ message: '更新成功' })
})
app.delete('/api/training/plans/:id', (req, res) => {
  db.prepare('DELETE FROM training_plans WHERE id = ? AND user_id = ?').run(req.params.id, req.body.user_id)
  res.json({ message: '已删除' })
})

// ---- 培训课程 ----
app.get('/api/training/courses', (req, res) => {
  const { user_id, category, keyword } = req.query
  let sql = 'SELECT * FROM training_courses WHERE user_id = ?'; const params = [user_id]
  if (category) { sql += ' AND category = ?'; params.push(category) }
  if (keyword) { sql += ' AND (course_name LIKE ? OR course_number LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%') }
  sql += ' ORDER BY course_number'
  res.json({ list: db.prepare(sql).all(...params) })
})
app.post('/api/training/courses', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, course_number, course_name, category, duration, exam_method, pass_score, material } = req.body
  if (!course_name) return res.status(400).json({ message: '请填写课程名称' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  db.prepare('INSERT INTO training_courses (user_id, course_number, course_name, category, duration, exam_method, pass_score, material, file_paths) VALUES (?,?,?,?,?,?,?,?,?)').run(user_id, course_number||'', course_name, category||'基础知识', duration||'', exam_method||'笔试', pass_score||80, material||'', JSON.stringify(paths))
  res.json({ message: '添加成功' })
})
app.put('/api/training/courses/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params; const existing = db.prepare('SELECT * FROM training_courses WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ message: '不存在' })
  const { course_name, category, duration, exam_method, pass_score, material } = req.body
  let paths = JSON.parse(existing.file_paths || '[]')
  try { const keep = JSON.parse(req.body.existing_files || '[]'); paths = [...keep] } catch {}
  if (req.files) req.files.forEach(f => paths.push('/uploads/' + f.filename))
  db.prepare('UPDATE training_courses SET course_name=?, category=?, duration=?, exam_method=?, pass_score=?, material=?, file_paths=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(course_name||existing.course_name, category||existing.category, duration||existing.duration, exam_method||existing.exam_method, pass_score||existing.pass_score, material||existing.material, JSON.stringify(paths), id)
  res.json({ message: '更新成功' })
})
app.delete('/api/training/courses/:id', (req, res) => {
  db.prepare('DELETE FROM training_courses WHERE id = ? AND user_id = ?').run(req.params.id, req.body.user_id)
  res.json({ message: '已删除' })
})

// ---- 培训记录 ----
app.get('/api/training/records', (req, res) => {
  const { user_id, keyword, training_type, department } = req.query
  let sql = 'SELECT * FROM training_records WHERE user_id = ?'; const params = [user_id]
  if (training_type) { sql += ' AND training_type = ?'; params.push(training_type) }
  if (department) { sql += ' AND department = ?'; params.push(department) }
  if (keyword) { sql += ' AND (employee_name LIKE ? OR record_number LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%') }
  sql += ' ORDER BY training_date DESC'
  res.json({ list: db.prepare(sql).all(...params) })
})
app.post('/api/training/records', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, record_number, plan_id, course_id, employee_name, department, training_type, training_date, trainer, duration, attendance, exam_score, exam_result } = req.body
  if (!employee_name) return res.status(400).json({ message: '请填写员工姓名' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  db.prepare('INSERT INTO training_records (user_id, record_number, plan_id, course_id, employee_name, department, training_type, training_date, trainer, duration, attendance, exam_score, exam_result, file_paths) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(user_id, record_number||'', plan_id||null, course_id||null, employee_name, department||'', training_type||'在岗复训', training_date||'', trainer||'', duration||'', attendance||'已签到', exam_score||null, exam_result||'', JSON.stringify(paths))
  res.json({ message: '添加成功' })
})
app.put('/api/training/records/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params; const existing = db.prepare('SELECT * FROM training_records WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ message: '不存在' })
  const { employee_name, department, training_type, training_date, trainer, duration, attendance, exam_score, exam_result } = req.body
  let paths = JSON.parse(existing.file_paths || '[]')
  try { const keep = JSON.parse(req.body.existing_files || '[]'); paths = [...keep] } catch {}
  if (req.files) req.files.forEach(f => paths.push('/uploads/' + f.filename))
  db.prepare('UPDATE training_records SET employee_name=?, department=?, training_type=?, training_date=?, trainer=?, duration=?, attendance=?, exam_score=?, exam_result=?, file_paths=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(employee_name||existing.employee_name, department||existing.department, training_type||existing.training_type, training_date||existing.training_date, trainer||existing.trainer, duration||existing.duration, attendance||existing.attendance, exam_score!=null?exam_score:existing.exam_score, exam_result||existing.exam_result, JSON.stringify(paths), id)
  res.json({ message: '更新成功' })
})
app.delete('/api/training/records/:id', (req, res) => {
  db.prepare('DELETE FROM training_records WHERE id = ? AND user_id = ?').run(req.params.id, req.body.user_id)
  res.json({ message: '已删除' })
})

// ---- 考核管理 ----
app.get('/api/training/exams', (req, res) => {
  const { user_id, keyword, result, exam_method } = req.query
  let sql = 'SELECT * FROM training_exams WHERE user_id = ?'; const params = [user_id]
  if (result) { sql += ' AND result = ?'; params.push(result) }
  if (exam_method) { sql += ' AND exam_method = ?'; params.push(exam_method) }
  if (keyword) { sql += ' AND (employee_name LIKE ? OR course_name LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%') }
  sql += ' ORDER BY created_at DESC'
  res.json({ list: db.prepare(sql).all(...params) })
})
app.post('/api/training/exams', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, exam_number, record_id, employee_name, course_name, exam_method, total_score, score, pass_score, result, remark } = req.body
  if (!employee_name) return res.status(400).json({ message: '请填写员工姓名' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  db.prepare('INSERT INTO training_exams (user_id, exam_number, record_id, employee_name, course_name, exam_method, total_score, score, pass_score, result, remark, file_paths) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(user_id, exam_number||'', record_id||null, employee_name, course_name||'', exam_method||'笔试', total_score||100, score||0, pass_score||80, result||'合格', remark||'', JSON.stringify(paths))
  res.json({ message: '添加成功' })
})
app.put('/api/training/exams/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params; const existing = db.prepare('SELECT * FROM training_exams WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ message: '不存在' })
  const { employee_name, course_name, exam_method, total_score, score, pass_score, result, retake_count, retake_date, retake_score, remark } = req.body
  let paths = JSON.parse(existing.file_paths || '[]')
  try { const keep = JSON.parse(req.body.existing_files || '[]'); paths = [...keep] } catch {}
  if (req.files) req.files.forEach(f => paths.push('/uploads/' + f.filename))
  db.prepare('UPDATE training_exams SET employee_name=?, course_name=?, exam_method=?, total_score=?, score=?, pass_score=?, result=?, retake_count=?, retake_date=?, retake_score=?, remark=?, file_paths=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(employee_name||existing.employee_name, course_name||existing.course_name, exam_method||existing.exam_method, total_score!=null?total_score:existing.total_score, score!=null?score:existing.score, pass_score!=null?pass_score:existing.pass_score, result||existing.result, retake_count!=null?retake_count:existing.retake_count, retake_date||existing.retake_date, retake_score!=null?retake_score:existing.retake_score, remark||existing.remark, JSON.stringify(paths), id)
  res.json({ message: '更新成功' })
})
app.delete('/api/training/exams/:id', (req, res) => {
  db.prepare('DELETE FROM training_exams WHERE id = ? AND user_id = ?').run(req.params.id, req.body.user_id)
  res.json({ message: '已删除' })
})

// ---- 培训证书 ----
app.get('/api/training/certs', (req, res) => {
  const { user_id, keyword, cert_type } = req.query
  let sql = 'SELECT * FROM training_certs WHERE user_id = ?'; const params = [user_id]
  if (cert_type) { sql += ' AND cert_type = ?'; params.push(cert_type) }
  if (keyword) { sql += ' AND (employee_name LIKE ? OR cert_number LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%') }
  sql += ' ORDER BY expiry_date ASC'
  const list = db.prepare(sql).all(...params).map(r => ({...r, status: getStatus(r.expiry_date)}))
  res.json({ list })
})
app.post('/api/training/certs', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, cert_number, employee_name, cert_type, issuing_agency, issue_date, expiry_date } = req.body
  if (!employee_name) return res.status(400).json({ message: '请填写员工姓名' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  db.prepare('INSERT INTO training_certs (user_id, cert_number, employee_name, cert_type, issuing_agency, issue_date, expiry_date, file_paths) VALUES (?,?,?,?,?,?,?,?)').run(user_id, cert_number||'', employee_name, cert_type||'食品安全管理员', issuing_agency||'', issue_date||'', expiry_date||'', JSON.stringify(paths))
  res.json({ message: '添加成功' })
})
app.put('/api/training/certs/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params; const existing = db.prepare('SELECT * FROM training_certs WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ message: '不存在' })
  const { employee_name, cert_type, issuing_agency, issue_date, expiry_date } = req.body
  let paths = JSON.parse(existing.file_paths || '[]')
  try { const keep = JSON.parse(req.body.existing_files || '[]'); paths = [...keep] } catch {}
  if (req.files) req.files.forEach(f => paths.push('/uploads/' + f.filename))
  db.prepare('UPDATE training_certs SET employee_name=?, cert_type=?, issuing_agency=?, issue_date=?, expiry_date=?, file_paths=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(employee_name||existing.employee_name, cert_type||existing.cert_type, issuing_agency||existing.issuing_agency, issue_date||existing.issue_date, expiry_date||existing.expiry_date, JSON.stringify(paths), id)
  res.json({ message: '更新成功' })
})
app.delete('/api/training/certs/:id', (req, res) => {
  db.prepare('DELETE FROM training_certs WHERE id = ? AND user_id = ?').run(req.params.id, req.body.user_id)
  res.json({ message: '已删除' })
})

// ===== 仪表盘聚合接口 =====

// 一次性返回统计数据和预警列表，减少前端请求
app.get('/api/dashboard/stats', (req, res) => {
  const userId = req.query.user_id
  if (!userId) {
    return res.status(400).json({ message: '缺少用户标识' })
  }

  // 资质统计数据
  const certs = db.prepare('SELECT expiry_date, is_permanent FROM certificates WHERE user_id = ?').all(userId)
  const certStats = { total: certs.length, valid: 0, expiring_soon: 0, expired: 0 }
  certs.forEach(c => { certStats[getStatus(c.expiry_date, c.is_permanent)]++ })

  // 健康证统计数据
  const healths = db.prepare('SELECT expiry_date FROM health_certs WHERE user_id = ?').all(userId)
  const healthStats = { total: healths.length, valid: 0, expiring_soon: 0, expired: 0 }
  healths.forEach(h => { healthStats[getStatus(h.expiry_date)]++ })

  // 预警列表：合并资质和健康证中 30 天内到期且尚未过期的数据
  const today = new Date().toISOString().slice(0, 10)
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + 30)
  const deadlineStr = deadline.toISOString().slice(0, 10)

  const warnCerts = db.prepare(`
    SELECT name AS title, company_name, expiry_date, 'certificate' AS type, id
    FROM certificates
    WHERE user_id = ? AND is_permanent = 0 AND expiry_date >= ? AND expiry_date <= ?
  `).all(userId, today, deadlineStr)

  const warnHealths = db.prepare(`
    SELECT employee_name AS title, expiry_date, 'health_cert' AS type, id
    FROM health_certs
    WHERE user_id = ? AND expiry_date >= ? AND expiry_date <= ?
  `).all(userId, today, deadlineStr)

  // 虫害管理统计数据
  const pestSupplierDocs = db.prepare("SELECT expiry_date FROM pest_supplier_docs WHERE user_id = ? AND expiry_date != ''").all(userId)
  const pestSupplierStats = { total: pestSupplierDocs.length, valid: 0, expiring_soon: 0, expired: 0 }
  pestSupplierDocs.forEach(d => { pestSupplierStats[getStatus(d.expiry_date)]++ })

  const pestStaffCerts = db.prepare("SELECT expiry_date FROM pest_staff_certs WHERE user_id = ? AND expiry_date != ''").all(userId)
  const pestStaffCertStats = { total: pestStaffCerts.length, valid: 0, expiring_soon: 0, expired: 0 }
  pestStaffCerts.forEach(d => { pestStaffCertStats[getStatus(d.expiry_date)]++ })

  // 虫害预警
  const warnPestSupplier = db.prepare(
    `SELECT doc_name AS title, company_name, expiry_date, 'pest_supplier_doc' AS type, id
    FROM pest_supplier_docs
    WHERE user_id = ? AND expiry_date != '' AND expiry_date >= ? AND expiry_date <= ?`
  ).all(userId, today, deadlineStr)

  const warnPestStaffCerts = db.prepare(
    `SELECT cert_name AS title, expiry_date, 'pest_staff_cert' AS type, id
    FROM pest_staff_certs
    WHERE user_id = ? AND expiry_date != '' AND expiry_date >= ? AND expiry_date <= ?`
  ).all(userId, today, deadlineStr)

  // 产品报告统计
  const productReports = db.prepare("SELECT expiry_date, conclusion FROM product_reports WHERE user_id = ? AND expiry_date != ''").all(userId)
  const productReportStats = { total: productReports.length, valid: 0, expiring_soon: 0, expired: 0, qualified: 0, unqualified: 0 }
  productReports.forEach(r => {
    productReportStats[getStatus(r.expiry_date)]++
    if (r.conclusion === '合格') productReportStats.qualified++
    else productReportStats.unqualified++
  })

  // 体系文件统计
  const sysDocs = db.prepare("SELECT doc_type, status, review_date FROM sys_docs WHERE user_id = ?").all(userId)
  const sysDocStats = { total: sysDocs.length, manual: 0, procedure: 0, sop: 0, form: 0, external: 0, active: 0, revising: 0, obsolete: 0 }
  sysDocs.forEach(d => {
    if (sysDocStats[d.doc_type] !== undefined) sysDocStats[d.doc_type]++
    if (d.status === '现行有效') sysDocStats.active++
    else if (d.status === '修订中') sysDocStats.revising++
    else if (d.status === '已作废') sysDocStats.obsolete++
  })

  // 产品报告临期预警
  const warnProductReports = db.prepare(
    `SELECT product_name AS title, expiry_date, 'product_report' AS type, id
    FROM product_reports
    WHERE user_id = ? AND expiry_date != '' AND expiry_date >= ? AND expiry_date <= ?`
  ).all(userId, today, deadlineStr)

  // 培训考核统计
  const trainingPlansCount = db.prepare('SELECT COUNT(*) AS cnt FROM training_plans WHERE user_id = ?').get(userId).cnt
  const trainingCoursesCount = db.prepare('SELECT COUNT(*) AS cnt FROM training_courses WHERE user_id = ?').get(userId).cnt
  const trainingRecordsCount = db.prepare('SELECT COUNT(*) AS cnt FROM training_records WHERE user_id = ?').get(userId).cnt
  const trainingExams = db.prepare("SELECT result FROM training_exams WHERE user_id = ?").all(userId)
  const trainingCerts = db.prepare("SELECT expiry_date FROM training_certs WHERE user_id = ? AND expiry_date != ''").all(userId)
  const trainingExamStats = { total: trainingExams.length, pass: 0, fail: 0 }
  trainingExams.forEach(e => { if (e.result === '合格') trainingExamStats.pass++; else trainingExamStats.fail++ })
  const trainingCertStats = { total: trainingCerts.length, valid: 0, expiring_soon: 0, expired: 0 }
  trainingCerts.forEach(c => { trainingCertStats[getStatus(c.expiry_date)]++ })

  // 培训证书临期预警
  const warnTrainingCerts = db.prepare(
    `SELECT employee_name AS title, cert_type, expiry_date, 'training_cert' AS type, id
    FROM training_certs
    WHERE user_id = ? AND expiry_date != '' AND expiry_date >= ? AND expiry_date <= ?`
  ).all(userId, today, deadlineStr)

  // 合并并按到期时间升序排列
  const warnings = [...warnCerts, ...warnHealths, ...warnPestSupplier, ...warnPestStaffCerts, ...warnProductReports, ...warnTrainingCerts]
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
    .map(item => ({
      ...item,
      daysLeft: Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
    }))

  res.json({
    certificates: certStats,
    healthCerts: healthStats,
    pest: {
      supplierDocs: pestSupplierStats,
      staffCerts: pestStaffCertStats
    },
    productReports: productReportStats,
    sysDocs: sysDocStats,
    training: {
      plans: trainingPlansCount,
      courses: trainingCoursesCount,
      records: trainingRecordsCount,
      exams: trainingExamStats,
      certs: trainingCertStats
    },
    complaints: {
      total: db.prepare('SELECT COUNT(*) AS cnt FROM complaint_records WHERE user_id = ?').get(userId).cnt,
      processing: db.prepare("SELECT COUNT(*) AS cnt FROM complaint_records WHERE user_id = ? AND status IN ('待处理','处理中','待回复')").get(userId).cnt,
      closed: db.prepare("SELECT COUNT(*) AS cnt FROM complaint_records WHERE user_id = ? AND status = '已关闭'").get(userId).cnt,
      urgent: db.prepare("SELECT COUNT(*) AS cnt FROM complaint_records WHERE user_id = ? AND urgency = '紧急' AND status != '已关闭'").get(userId).cnt
    },
    warnings
  })
})

// ===== 健康证管理接口 =====

// 获取健康证列表（支持按姓名/部门搜索）
app.get('/api/health-certs', (req, res) => {
  const userId = req.query.user_id
  const keyword = req.query.keyword || ''

  if (!userId) {
    return res.status(400).json({ message: '缺少用户标识' })
  }

  let sql = 'SELECT * FROM health_certs WHERE user_id = ?'
  const params = [userId]

  if (keyword) {
    sql += ' AND (employee_name LIKE ? OR department LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw)
  }

  sql += ' ORDER BY created_at DESC'

  const rows = db.prepare(sql).all(...params)

  // 动态计算状态
  const list = rows.map(row => ({
    ...row,
    status: getStatus(row.expiry_date)
  }))

  res.json({ list })
})

// 新增健康证（支持多文件上传）
app.post('/api/health-certs', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, employee_name, department, expiry_date } = req.body
  if (!user_id || !employee_name || !expiry_date) {
    return res.status(400).json({ message: '请填写员工姓名和到期日期' })
  }

  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  const filePaths = JSON.stringify(paths)
  // 向后兼容：单文件路径也存 file_path
  const singlePath = paths.length > 0 ? paths[0] : ''

  const result = db.prepare(
    'INSERT INTO health_certs (user_id, employee_name, id_number, issue_date, department, expiry_date, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(user_id, employee_name, '', '', department || '', expiry_date, singlePath)

  res.json({ message: '健康证添加成功', id: result.lastInsertRowid })
})

// 编辑健康证
app.put('/api/health-certs/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, employee_name, department, expiry_date } = req.body

  // 校验权限
  const existing = db.prepare('SELECT * FROM health_certs WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) {
    return res.status(404).json({ message: '记录不存在或无权编辑' })
  }

  let filePath = existing.file_path
  if (req.files && req.files.length > 0) {
    const paths = req.files.map(f => '/uploads/' + f.filename)
    filePath = paths[0]  // 取第一个作为主文件路径
  }

  db.prepare(
    'UPDATE health_certs SET employee_name=?, department=?, expiry_date=?, file_path=? WHERE id=?'
  ).run(employee_name || existing.employee_name, department || '', expiry_date || existing.expiry_date, filePath, id)

  res.json({ message: '健康证更新成功' })
})

// 删除健康证
app.delete('/api/health-certs/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body

  const cert = db.prepare('SELECT * FROM health_certs WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!cert) {
    return res.status(404).json({ message: '记录不存在或无权删除' })
  }

  // 物理删除附件
  const fs = require('fs')
  if (cert.file_path) {
    const filePath = path.join(__dirname, cert.file_path)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  }

  db.prepare('DELETE FROM health_certs WHERE id = ?').run(id)
  res.json({ message: '健康证已删除' })
})

// 批量删除健康证
app.post('/api/health-certs/batch-delete', (req, res) => {
  const { user_id, ids } = req.body
  const fs = require('fs')

  if (!user_id || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: '请选择要删除的健康证' })
  }

  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(
    `SELECT * FROM health_certs WHERE id IN (${placeholders}) AND user_id = ?`
  ).all(...ids, user_id)

  if (rows.length === 0) {
    return res.status(404).json({ message: '未找到可删除的记录' })
  }

  rows.forEach(cert => {
    if (cert.file_path) {
      const filePath = path.join(__dirname, cert.file_path)
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch {}
    }
  })

  db.prepare(`DELETE FROM health_certs WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, user_id)
  res.json({ message: `已删除 ${rows.length} 条健康证记录`, count: rows.length })
})

// 导出健康证为 Excel
app.get('/api/health-certs/export', (req, res) => {
  const userId = req.query.user_id
  const ids = req.query.ids ? req.query.ids.split(',').map(Number).filter(n => n > 0) : []
  if (!userId) {
    return res.status(400).json({ message: '缺少用户标识' })
  }

  let sql = 'SELECT * FROM health_certs WHERE user_id = ?'
  const params = [userId]
  if (ids.length > 0) {
    sql += ` AND id IN (${ids.map(() => '?').join(',')})`
    params.push(...ids)
  }
  sql += ' ORDER BY created_at DESC'
  const rows = db.prepare(sql).all(...params)

  const data = rows.map(row => ({
    '员工姓名': row.employee_name,
    '部门': row.department || '',
    '到期日期': row.expiry_date,
    '状态': getStatus(row.expiry_date) === 'expired' ? '已过期' :
            getStatus(row.expiry_date) === 'expiring_soon' ? '临期' : '正常',
    '创建时间': row.created_at
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 20 }
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '健康证列表')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('健康证列表.xlsx'))
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

// ===== 通知接口 =====

// 获取通知列表（最近50条）和未读数
app.get('/api/notifications', (req, res) => {
  const userId = req.query.user_id
  if (!userId) {
    return res.status(400).json({ message: '缺少用户标识' })
  }
  const list = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(userId)
  const unreadCount = db.prepare(
    'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(userId).cnt
  res.json({ list, unreadCount })
})

// 标记单条已读
app.put('/api/notifications/:id/read', (req, res) => {
  const { id } = req.params
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id)
  res.json({ message: '已标记为已读' })
})

// 全部标记已读
app.put('/api/notifications/read-all', (req, res) => {
  const { user_id } = req.body
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(user_id)
  res.json({ message: '全部已读' })
})

// ===== 法规库接口 =====

// 获取法规列表（支持按分类和关键词搜索）
app.get('/api/regulations', (req, res) => {
  const category = req.query.category || ''
  const keyword = req.query.keyword || ''

  let sql = 'SELECT * FROM regulations WHERE 1=1'
  const params = []

  if (category) {
    sql += ' AND category = ?'
    params.push(category)
  }

  if (keyword) {
    sql += ' AND (title LIKE ? OR full_title LIKE ? OR content LIKE ? OR number LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw, kw, kw)
  }

  sql += ' ORDER BY category, effective_date DESC'

  const rows = db.prepare(sql).all(...params)
  res.json({ list: rows })
})

// 新增法规（支持附件上传，同时推送通知给所有用户）
app.post('/api/regulations', upload.single('file'), (req, res) => {
  const { title, full_title, category, number, effective_date, repeal_date, content, url } = req.body
  if (!title || !full_title || !category) {
    return res.status(400).json({ message: '请填写法规名称和分类' })
  }

  const filePath = req.file ? '/uploads/' + req.file.filename : ''

  const result = db.prepare(
    'INSERT INTO regulations (title, full_title, category, number, effective_date, repeal_date, content, url, file_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(title, full_title, category, number || '', effective_date || '', repeal_date || '', content || '', url || '', filePath)

  // 推送通知给所有用户
  const users = db.prepare('SELECT id FROM users').all()
  const notifyStmt = db.prepare(
    'INSERT INTO notifications (user_id, title, content, type, source_type, source_id) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const categoryLabel = { law: '法律', standard: '国家标准', industry: '行业规范' }[category] || '法规'
  users.forEach(u => {
    notifyStmt.run(u.id, `新法规：${title}`, `${categoryLabel}「${full_title}」已于法规库更新`, 'info', 'regulation', result.lastInsertRowid)
  })

  res.json({ message: '法规添加成功', id: result.lastInsertRowid })
})

// ===== 审核规则接口 =====

// 获取审核规则列表
app.get('/api/rules', (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_rules ORDER BY id').all()
  res.json({ list: rows })
})

// ===== 标签审核接口 =====

// 上传标签（文件存入 uploads/labels/）
app.post('/api/labels', labelsUpload.single('file'), sanitizeUploadBody, (req, res) => {
  const { user_id, product_name, category } = req.body
  if (!user_id || !product_name || !category) {
    return res.status(400).json({ message: '请填写产品名称和分类' })
  }

  // 文件路径：相对于 uploads 目录
  const fileUrl = req.file ? '/uploads/labels/' + req.file.filename : ''

  // 版本号：同一用户、同一产品名称再次上传时版本号 +1
  const latest = db.prepare(
    'SELECT MAX(version) AS maxVer FROM labels WHERE user_id = ? AND product_name = ?'
  ).get(user_id, product_name)
  const version = (latest.maxVer || 0) + 1

  const result = db.prepare(
    'INSERT INTO labels (user_id, product_name, category, file_url, version) VALUES (?, ?, ?, ?, ?)'
  ).run(user_id, product_name, category, fileUrl, version)

  res.json({ message: '标签上传成功', id: result.lastInsertRowid, version })
})

// 获取标签列表
app.get('/api/labels', (req, res) => {
  const userId = req.query.user_id
  if (!userId) {
    return res.status(400).json({ message: '缺少用户标识' })
  }

  const rows = db.prepare(
    'SELECT * FROM labels WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId)

  res.json({ list: rows })
})

// 审核标签（AI 优先，自动降级为规则审核）
app.post('/api/labels/:id/audit', strictLimiter, async (req, res) => {
  const { id } = req.params
  const { user_id } = req.body

  // 获取标签信息
  const label = db.prepare('SELECT * FROM labels WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!label) {
    return res.status(404).json({ message: '标签不存在或无权操作' })
  }
  if (!label.file_url) {
    return res.status(400).json({ message: '标签没有上传图片，无法审核' })
  }

  // 获取 OCR 文本
  const imagePath = path.join(__dirname, label.file_url)
  const ocrText = recognize(imagePath)

  // 清除旧审核结果
  db.prepare('DELETE FROM audit_results WHERE label_id = ?').run(id)

  let results, auditMethod

  // 优先尝试 AI 大模型审核
  const aiResult = await aiAudit(ocrText)

  if (aiResult && aiResult.results) {
    // ===== AI 审核成功 =====
    auditMethod = 'ai'
    results = aiResult.results.map(r => ({
      rule_code: r.rule_code,
      rule_name: r.rule_name,
      passed: r.passed ? 1 : 0,
      detail: (r.detail || '') + (r.suggestion ? ' | 建议：' + r.suggestion : '')
    }))
    console.log('✅ AI 审核完成')
  } else {
    // ===== 降级：V1.0 规则审核 =====
    auditMethod = 'rule'
    const rules = db.prepare('SELECT * FROM audit_rules ORDER BY id').all()

    const keywordMap = {
      R01: ['产品名称', '食品名称'],
      R02: ['配料', '配料表'],
      R03: ['净含量', '规格'],
      R04: ['生产者', '制造商', '生产商', '出品商'],
      R05: ['生产日期', '保质期'],
      R06: ['贮存条件', '保存方法', '贮藏'],
      R07: ['生产许可证编号', 'SC', '食品生产许可证']
    }

    results = rules.map(rule => {
      const keywords = keywordMap[rule.rule_code] || [rule.rule_name]
      const passed = keywords.some(kw => ocrText.includes(kw))
      return {
        rule_code: rule.rule_code,
        rule_name: rule.rule_name,
        passed: passed ? 1 : 0,
        detail: passed ? '检测通过：文本中找到"' + keywords.find(kw => ocrText.includes(kw)) + '"' : '未检测到相关关键词'
      }
    })
    console.log('📋 规则审核完成（已降级）')
  }

  // 存入 audit_results
  const insertResult = db.prepare(
    'INSERT INTO audit_results (label_id, rule_code, rule_name, passed, detail) VALUES (?, ?, ?, ?, ?)'
  )
  const insertMany = db.transaction(() => {
    results.forEach(r => insertResult.run(id, r.rule_code, r.rule_name, r.passed, r.detail))
  })
  insertMany()

  // 更新标签状态
  const allPassed = results.every(r => r.passed)
  db.prepare('UPDATE labels SET status = ? WHERE id = ?').run(allPassed ? 'pass' : 'failed', id)

  res.json({
    message: allPassed ? '审核通过' : '审核未通过',
    status: allPassed ? 'pass' : 'failed',
    auditMethod,
    passedCount: results.filter(r => r.passed).length,
    totalCount: results.length,
    results
  })
})

// 获取同产品历史版本
app.get('/api/labels/:id/history', (req, res) => {
  const { id } = req.params
  const userId = req.query.user_id

  const current = db.prepare('SELECT * FROM labels WHERE id = ? AND user_id = ?').get(id, userId)
  if (!current) {
    return res.status(404).json({ message: '标签不存在' })
  }

  // 查询同一产品的所有版本
  const versions = db.prepare(
    'SELECT * FROM labels WHERE user_id = ? AND product_name = ? ORDER BY version DESC'
  ).all(userId, current.product_name)

  res.json({ list: versions })
})

// 下载审核报告 PDF
app.get('/api/labels/:id/report', async (req, res) => {
  const { id } = req.params
  const userId = req.query.user_id

  // 获取标签信息
  const label = db.prepare('SELECT * FROM labels WHERE id = ? AND user_id = ?').get(id, userId)
  if (!label) {
    return res.status(404).json({ message: '标签不存在或无权访问' })
  }
  if (label.status === 'pending') {
    return res.status(400).json({ message: '标签尚未审核，请先完成审核' })
  }

  // 获取审核结果
  const results = db.prepare('SELECT * FROM audit_results WHERE label_id = ? ORDER BY id').all(id)

  // 生成 PDF
  const pdfBuffer = await generateReport(label, results)

  // 返回下载
  const filename = encodeURIComponent(label.product_name + '_审核报告.pdf')
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + filename)
  res.setHeader('Content-Type', 'application/pdf')
  res.send(pdfBuffer)
})

// 删除标签
app.delete('/api/labels/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body

  const label = db.prepare('SELECT * FROM labels WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!label) {
    return res.status(404).json({ message: '标签不存在或无权删除' })
  }

  db.prepare('DELETE FROM labels WHERE id = ?').run(id)
  res.json({ message: '标签已删除' })
})

// ===== AI 标签审核 — 多国出口审核 =====
app.post('/api/ai-audit/export', strictLimiter, upload.single('file'), sanitizeUploadBody, async (req, res) => {
  const { target_market, user_id } = req.body
  if (!target_market) return res.status(400).json({ message: '请选择目标市场' })

  let ocrText = ''
  // 如果上传了文件，先 OCR 识别
  if (req.file) {
    const imagePath = path.join(__dirname, '/uploads/' + req.file.filename)
    ocrText = recognize(imagePath)
  } else if (req.body.ocr_text) {
    ocrText = req.body.ocr_text
  }

  if (!ocrText) return res.status(400).json({ message: '请上传标签图片或提供文本内容' })

  // AI 审核（未配置 AI_KEY 时降级提示）
  const aiResult = await aiExportAudit(ocrText, target_market)
  if (!aiResult) {
    return res.json({
      auditMethod: 'fallback',
      message: 'AI 服务未配置，请配置 AI_API_KEY 后使用出口审核功能',
      target_market,
      results: []
    })
  }

  res.json({ auditMethod: 'ai', target_market, ...aiResult })
})

// ===== AI 标签审核 — 营养成分生成 =====
app.post('/api/ai-audit/nutrition', strictLimiter, async (req, res) => {
  const { product_name, ingredients } = req.body
  if (!product_name || !ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ message: '请填写产品名称和至少一种原料' })
  }

  const aiResult = await aiNutritionGen(product_name, ingredients)
  if (!aiResult) {
    return res.json({
      method: 'fallback',
      message: 'AI 服务未配置，请配置 AI_API_KEY 后使用营养成分生成功能',
      product_name,
      nutrition: null
    })
  }

  res.json({ method: 'ai', ...aiResult })
})

// ===== AI 标签审核 — 配料表校验 =====
app.post('/api/ai-audit/ingredients', strictLimiter, async (req, res) => {
  const { ingredient_text } = req.body
  if (!ingredient_text || !ingredient_text.trim()) {
    return res.status(400).json({ message: '请输入配料表文字' })
  }

  const aiResult = await aiIngredientsVerify(ingredient_text.trim())
  if (!aiResult) {
    return res.json({
      method: 'fallback',
      message: 'AI 服务未配置，请配置 AI_API_KEY 后使用配料表校验功能',
      results: [],
      allergens: [],
      additives: []
    })
  }

  res.json({ method: 'ai', ...aiResult })
})

// ===== AI 供应商评分 =====
app.post('/api/ai/supplier-score', strictLimiter, async (req, res) => {
  const { user_id, company_name } = req.body
  if (!user_id || !company_name) return res.status(400).json({ message: '请提供供应商名称' })

  // 汇总该供应商的相关数据
  const certs = db.prepare("SELECT name, expiry_date, is_permanent FROM certificates WHERE user_id = ? AND company_name = ?").all(user_id, company_name)
  const productReports = db.prepare("SELECT product_name, conclusion, expiry_date FROM product_reports WHERE user_id = ?").all(user_id)
  // 简单匹配：报告产品名可能与供应商相关联
  const reportsForSupplier = productReports.filter(r => {
    // 尝试匹配产品报告与供应商（通过产品名模糊匹配或直接关联）
    return true  // 实际应用中应有更精确的关联
  })

  const certStatuses = certs.map(c => {
    const status = getStatus(c.expiry_date, c.is_permanent)
    return { name: c.name, expiry_date: c.expiry_date, is_permanent: !!c.is_permanent, status }
  })

  const supplierData = {
    company_name,
    certs: certStatuses,
    cert_count: certs.length,
    valid_certs: certStatuses.filter(c => c.status === 'valid').length,
    expiring_soon_certs: certStatuses.filter(c => c.status === 'expiring_soon').length,
    expired_certs: certStatuses.filter(c => c.status === 'expired').length,
    product_reports: reportsForSupplier.map(r => ({
      product_name: r.product_name,
      conclusion: r.conclusion,
      expiry_date: r.expiry_date
    })),
    report_count: reportsForSupplier.length,
    qualified_reports: reportsForSupplier.filter(r => r.conclusion === '合格').length
  }

  const aiResult = await aiSupplierScore(supplierData)
  if (!aiResult) {
    return res.json({
      method: 'fallback',
      message: 'AI 服务未配置，请配置 AI_API_KEY 后使用供应商评分功能',
      supplier_data: supplierData
    })
  }

  res.json({ method: 'ai', ...aiResult, supplier_data: supplierData })
})

// ===== AI 客诉分类定级 =====
app.post('/api/ai/complaint-classify', strictLimiter, async (req, res) => {
  const { complaint_text } = req.body
  if (!complaint_text || !complaint_text.trim()) return res.status(400).json({ message: '请提供客诉内容' })

  const aiResult = await aiComplaintClassify(complaint_text.trim())
  if (!aiResult) {
    return res.json({
      method: 'fallback',
      message: 'AI 服务未配置，请配置 AI_API_KEY 后使用客诉分类功能。\n\n系统内置规则：\n- 含"异物/虫子/金属/毛发/塑料"等 → 异物类 🔴紧急\n- 含"发霉/变质/异味/涨袋"等 → 变质类 🔴紧急\n- 含"过敏/红疹/拉肚子"等 → 过敏类 🔴紧急\n- 含"标签/日期/配料"等 → 标签错误类 🟡一般\n- 含"破损/漏气/漏液"等 → 包装破损类 🟡一般\n- 含"态度/不理人/服务差"等 → 服务态度类 🟢轻微'
    })
  }
  res.json({ method: 'ai', ...aiResult })
})

// ===== AI 客诉回复生成 =====
app.post('/api/ai/complaint-reply', strictLimiter, async (req, res) => {
  const { complaint_type, customer_name, product_name, problem_desc, handle_measure } = req.body
  if (!problem_desc) return res.status(400).json({ message: '请提供客诉问题描述' })

  const complaintInfo = {
    complaint_type: complaint_type || '未分类',
    customer_name: customer_name || '尊敬的客户',
    product_name: product_name || '相关产品',
    problem_desc,
    handle_measure: handle_measure || '待确定'
  }

  const aiResult = await aiComplaintReply(complaintInfo)
  if (!aiResult) {
    return res.json({
      method: 'fallback',
      message: 'AI 服务未配置，请配置 AI_API_KEY 后使用回复生成功能。',
      template_reply: `尊敬的${complaintInfo.customer_name}：\n非常感谢您的反馈。对于您在使用${complaintInfo.product_name}过程中遇到的问题，我们深表歉意。\n我们已经启动调查程序，将在24小时内给您反馈处理结果。\n如有任何疑问，请随时联系我们的客服热线。\n再次向您致以诚挚的歉意。`
    })
  }
  res.json({ method: 'ai', ...aiResult })
})

// ===== AI 客诉根因分析 =====
app.post('/api/ai/complaint-analysis', strictLimiter, async (req, res) => {
  const { complaint_text, product_name, batch_no, production_line, supplier_info } = req.body
  if (!complaint_text) return res.status(400).json({ message: '请提供客诉内容' })

  const analysisData = {
    complaint_text,
    product_name: product_name || '未知产品',
    batch_no: batch_no || '未知批次',
    production_line: production_line || '未知产线',
    supplier_info: supplier_info || '暂无'
  }

  const aiResult = await aiComplaintAnalysis(analysisData)
  if (!aiResult) {
    return res.json({
      method: 'fallback',
      message: 'AI 服务未配置，请配置 AI_API_KEY 后使用根因分析功能。\n\n建议排查步骤：\n1. 检查该批次生产记录中的关键控制点\n2. 检查原料供应商的资质和验收记录\n3. 检查相关设备的维护和校准记录\n4. 检查该批次产品的检测报告\n5. 排查同类产品是否有类似客诉'
    })
  }
  res.json({ method: 'ai', ...aiResult })
})

// ===== 客诉管理 CRUD =====

function generateComplaintNumber() {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const count = db.prepare("SELECT COUNT(*) AS cnt FROM complaint_records WHERE complaint_date LIKE ?").get(now.toISOString().slice(0, 10) + '%').cnt
  return `KC-${dateStr}-${String(count + 1).padStart(3, '0')}`
}

// 获取客诉列表
app.get('/api/complaints', (req, res) => {
  const { user_id, keyword, status, type, urgency, start_date, end_date } = req.query
  if (!user_id) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT * FROM complaint_records WHERE user_id = ?'
  const params = [user_id]

  if (keyword) {
    sql += ' AND (complaint_number LIKE ? OR customer_name LIKE ? OR product_name LIKE ? OR problem_desc LIKE ?)'
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (type) { sql += ' AND complaint_type = ?'; params.push(type) }
  if (urgency) { sql += ' AND urgency = ?'; params.push(urgency) }
  if (start_date) { sql += ' AND complaint_date >= ?'; params.push(start_date) }
  if (end_date) { sql += ' AND complaint_date <= ?'; params.push(end_date) }

  sql += ' ORDER BY created_at DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

// 获取客诉详情

// 客诉看板统计数据（必须在 :id 前面，避免 stats 被当作 id 匹配）
app.get('/api/complaints/stats', (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ message: '缺少用户标识' })

  const total = db.prepare('SELECT COUNT(*) AS cnt FROM complaint_records WHERE user_id = ?').get(user_id).cnt
  const processing = db.prepare("SELECT COUNT(*) AS cnt FROM complaint_records WHERE user_id = ? AND status IN ('待处理','处理中','待回复')").get(user_id).cnt
  const closed = db.prepare("SELECT COUNT(*) AS cnt FROM complaint_records WHERE user_id = ? AND status = '已关闭'").get(user_id).cnt
  const urgent = db.prepare("SELECT COUNT(*) AS cnt FROM complaint_records WHERE user_id = ? AND urgency = '紧急' AND status != '已关闭'").get(user_id).cnt

  const byType = db.prepare("SELECT complaint_type, COUNT(*) AS cnt FROM complaint_records WHERE user_id = ? GROUP BY complaint_type").all(user_id)
  const byChannel = db.prepare("SELECT complaint_channel, COUNT(*) AS cnt FROM complaint_records WHERE user_id = ? GROUP BY complaint_channel").all(user_id)
  const monthlyTrend = db.prepare(`
    SELECT strftime('%Y-%m', complaint_date) AS month, COUNT(*) AS cnt
    FROM complaint_records WHERE user_id = ? AND complaint_date >= date('now', '-5 months', 'start of month')
    GROUP BY month ORDER BY month`).all(user_id)

  const avgSatisfaction = db.prepare("SELECT AVG(satisfaction_score) AS avg FROM complaint_records WHERE user_id = ? AND satisfaction_score > 0").get(user_id).avg || 0

  res.json({ total, processing, closed, urgent, avgSatisfaction: Math.round(avgSatisfaction * 10) / 10, byType, byChannel, monthlyTrend })
})

// 获取客诉详情
app.get('/api/complaints/:id', (req, res) => {
  const record = db.prepare('SELECT * FROM complaint_records WHERE id = ?').get(req.params.id)
  if (!record) return res.status(404).json({ message: '客诉记录不存在' })
  const actions = db.prepare('SELECT * FROM complaint_actions WHERE complaint_id = ? ORDER BY created_at DESC').all(req.params.id)
  res.json({ record, actions })
})

// 新增客诉
app.post('/api/complaints', (req, res) => {
  const { user_id, customer_name, customer_phone, complaint_date, complaint_channel, complaint_type,
    product_name, batch_no, problem_desc, urgency, handler, file_paths } = req.body
  if (!user_id || !customer_name || !problem_desc) return res.status(400).json({ message: '请填写投诉人、问题描述等必填信息' })

  const complaint_number = generateComplaintNumber()
  const result = db.prepare(`INSERT INTO complaint_records
    (user_id, complaint_number, customer_name, customer_phone, complaint_date, complaint_channel,
     complaint_type, product_name, batch_no, problem_desc, urgency, handler, file_paths)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(user_id, complaint_number, customer_name, customer_phone || '', complaint_date || new Date().toISOString().slice(0, 10),
      complaint_channel || '电话', complaint_type || '其他', product_name || '', batch_no || '', problem_desc,
      urgency || '一般', handler || '', file_paths || '[]')
  res.json({ id: result.lastInsertRowid, complaint_number })
})

// 更新客诉（处理/回复/关闭）
app.put('/api/complaints/:id', (req, res) => {
  const { user_id, status, handler, handle_measure, ai_reply, investigation_record,
    satisfaction_score, close_date, action_log } = req.body

  const record = db.prepare('SELECT * FROM complaint_records WHERE id = ?').get(req.params.id)
  if (!record) return res.status(404).json({ message: '客诉记录不存在' })

  const updates = []
  const params = []

  if (status) { updates.push('status = ?'); params.push(status) }
  if (handler) { updates.push('handler = ?'); params.push(handler) }
  if (handle_measure) { updates.push('handle_measure = ?'); params.push(handle_measure) }
  if (ai_reply) { updates.push('ai_reply = ?'); params.push(ai_reply) }
  if (investigation_record) { updates.push('investigation_record = ?'); params.push(investigation_record) }
  if (satisfaction_score) { updates.push('satisfaction_score = ?'); params.push(satisfaction_score) }
  if (close_date) { updates.push('close_date = ?'); params.push(close_date) }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(req.params.id)
    db.prepare(`UPDATE complaint_records SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  }

  // 记录处理动作
  if (action_log) {
    db.prepare(`INSERT INTO complaint_actions (user_id, complaint_id, action_date, handler, action_content, action_result)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(user_id || record.user_id, req.params.id, new Date().toISOString().slice(0, 10),
        handler || record.handler, action_log, status || record.status)
  }

  res.json({ message: '更新成功' })
})

// 删除客诉
app.delete('/api/complaints/:id', (req, res) => {
  const { user_id } = req.body
  db.prepare('DELETE FROM complaint_actions WHERE complaint_id = ?').run(req.params.id)
  db.prepare('DELETE FROM complaint_records WHERE id = ? AND user_id = ?').run(req.params.id, user_id)
  res.json({ message: '已删除' })
})

// ===== 虫害管理 - 供应商资质文档 =====

app.get('/api/pest/supplier-docs', (req, res) => {
  const userId = req.query.user_id
  const docType = req.query.doc_type || ''
  const keyword = req.query.keyword || ''
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT * FROM pest_supplier_docs WHERE user_id = ?'
  const params = [userId]
  if (docType) { sql += ' AND doc_type = ?'; params.push(docType) }
  if (keyword) {
    sql += ' AND (company_name LIKE ? OR doc_name LIKE ? OR doc_number LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw, kw)
  }
  sql += ' ORDER BY created_at DESC'
  const rows = db.prepare(sql).all(...params)
  const list = rows.map(row => ({ ...row, status: getStatus(row.expiry_date) }))
  res.json({ list })
})

app.get('/api/pest/supplier-docs/export', (req, res) => {
  const userId = req.query.user_id
  const ids = req.query.ids ? req.query.ids.split(',').map(Number).filter(n => n > 0) : []
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT * FROM pest_supplier_docs WHERE user_id = ?'
  const params = [userId]
  if (ids.length > 0) {
    sql += ` AND id IN (${ids.map(() => '?').join(',')})`
    params.push(...ids)
  }
  sql += ' ORDER BY created_at DESC'
  const rows = db.prepare(sql).all(...params)

  const typeLabel = { contract: '合同', license: '营业执照', cert: '资质证书', insurance: '保险' }
  const data = rows.map(row => ({
    '文档类型': typeLabel[row.doc_type] || row.doc_type,
    '公司名称': row.company_name,
    '文档名称': row.doc_name,
    '编号': row.doc_number,
    '到期时间': row.expiry_date,
    '状态': getStatus(row.expiry_date) === 'expired' ? '已过期' : getStatus(row.expiry_date) === 'expiring_soon' ? '临期' : '正常'
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 10 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '供应商资质')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('供应商资质.xlsx'))
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

app.post('/api/pest/supplier-docs', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, doc_type, company_name, doc_name, doc_number, issue_date, expiry_date, coverage, service_scope, amount } = req.body
  if (!user_id || !doc_name || !company_name) return res.status(400).json({ message: '请填写公司名称和文档名称' })

  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  const result = db.prepare(
    'INSERT INTO pest_supplier_docs (user_id, doc_type, company_name, doc_name, doc_number, issue_date, expiry_date, coverage, service_scope, amount, file_paths) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(user_id, doc_type || 'cert', company_name, doc_name, doc_number || '', issue_date || '', expiry_date || '', coverage || '', service_scope || '', amount || '', JSON.stringify(paths))
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/pest/supplier-docs/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, doc_type, company_name, doc_name, doc_number, issue_date, expiry_date, coverage, service_scope, amount } = req.body
  const existing = db.prepare('SELECT * FROM pest_supplier_docs WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '文档不存在或无权编辑' })

  const existingRaw = (req.body.existing_files || '[]').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  const existingKept = JSON.parse(existingRaw)
  let filePaths
  if (req.files && req.files.length > 0) {
    const newPaths = req.files.map(f => '/uploads/' + f.filename)
    filePaths = JSON.stringify([...existingKept, ...newPaths])
  } else {
    filePaths = JSON.stringify(existingKept)
  }

  db.prepare(
    'UPDATE pest_supplier_docs SET doc_type=?, company_name=?, doc_name=?, doc_number=?, issue_date=?, expiry_date=?, coverage=?, service_scope=?, amount=?, file_paths=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(doc_type || existing.doc_type, company_name || existing.company_name, doc_name || existing.doc_name, doc_number || existing.doc_number, issue_date || existing.issue_date, expiry_date || existing.expiry_date, coverage || existing.coverage, service_scope || existing.service_scope, amount || existing.amount, filePaths, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/pest/supplier-docs/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const fs = require('fs')
  const doc = db.prepare('SELECT * FROM pest_supplier_docs WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!doc) return res.status(404).json({ message: '文档不存在或无权删除' })
  try {
    JSON.parse(doc.file_paths || '[]').forEach(p => {
      const fp = path.join(__dirname, p)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    })
  } catch {}
  db.prepare('DELETE FROM pest_supplier_docs WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

app.post('/api/pest/supplier-docs/batch-delete', (req, res) => {
  const { user_id, ids } = req.body
  const fs = require('fs')
  if (!user_id || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '请选择要删除的文档' })
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(`SELECT * FROM pest_supplier_docs WHERE id IN (${placeholders}) AND user_id = ?`).all(...ids, user_id)
  rows.forEach(r => {
    try {
      JSON.parse(r.file_paths || '[]').forEach(p => {
        const fp = path.join(__dirname, p)
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      })
    } catch {}
  })
  db.prepare(`DELETE FROM pest_supplier_docs WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, user_id)
  res.json({ message: '批量删除成功', count: rows.length })
})

// ===== 虫害管理 - 人员 =====

app.get('/api/pest/staff', (req, res) => {
  const userId = req.query.user_id
  const keyword = req.query.keyword || ''
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT * FROM pest_staff WHERE user_id = ?'
  const params = [userId]
  if (keyword) {
    sql += ' AND (name LIKE ? OR employee_number LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw)
  }
  sql += ' ORDER BY created_at DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.post('/api/pest/staff', (req, res) => {
  const { user_id, name, employee_number, phone } = req.body
  if (!user_id || !name) return res.status(400).json({ message: '请填写人员姓名' })
  const result = db.prepare('INSERT INTO pest_staff (user_id, name, employee_number, phone) VALUES (?,?,?,?)').run(user_id, name, employee_number || '', phone || '')
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/pest/staff/:id', (req, res) => {
  const { id } = req.params
  const { user_id, name, employee_number, phone } = req.body
  const existing = db.prepare('SELECT * FROM pest_staff WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '人员不存在或无权编辑' })
  db.prepare('UPDATE pest_staff SET name=?, employee_number=?, phone=? WHERE id=?').run(name || existing.name, employee_number || existing.employee_number, phone || existing.phone, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/pest/staff/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const staff = db.prepare('SELECT * FROM pest_staff WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!staff) return res.status(404).json({ message: '人员不存在或无权删除' })
  // 同时删除关联的证件文件
  const fs = require('fs')
  const certs = db.prepare('SELECT * FROM pest_staff_certs WHERE staff_id = ?').all(id)
  certs.forEach(c => {
    try {
      JSON.parse(c.file_paths || '[]').forEach(p => {
        const fp = path.join(__dirname, p)
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      })
    } catch {}
  })
  db.prepare('DELETE FROM pest_staff_certs WHERE staff_id = ?').run(id)
  db.prepare('DELETE FROM pest_staff WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

app.post('/api/pest/staff/batch-delete', (req, res) => {
  const { user_id, ids } = req.body
  const fs = require('fs')
  if (!user_id || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '请选择要删除的人员' })
  const placeholders = ids.map(() => '?').join(',')
  ids.forEach(id => {
    const certs = db.prepare('SELECT * FROM pest_staff_certs WHERE staff_id = ?').all(id)
    certs.forEach(c => {
      try {
        JSON.parse(c.file_paths || '[]').forEach(p => {
          const fp = path.join(__dirname, p)
          if (fs.existsSync(fp)) fs.unlinkSync(fp)
        })
      } catch {}
    })
  })
  db.prepare(`DELETE FROM pest_staff_certs WHERE staff_id IN (${placeholders})`).run(...ids)
  db.prepare(`DELETE FROM pest_staff WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, user_id)
  res.json({ message: '批量删除成功', count: ids.length })
})

// ===== 虫害管理 - 人员证件 =====

app.get('/api/pest/staff-certs', (req, res) => {
  const userId = req.query.user_id
  const staffId = req.query.staff_id || ''
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT * FROM pest_staff_certs WHERE user_id = ?'
  const params = [userId]
  if (staffId) { sql += ' AND staff_id = ?'; params.push(staffId) }
  sql += ' ORDER BY created_at DESC'
  const rows = db.prepare(sql).all(...params)
  const list = rows.map(row => ({ ...row, status: getStatus(row.expiry_date) }))
  res.json({ list })
})

app.get('/api/pest/staff-certs/export', (req, res) => {
  const userId = req.query.user_id
  const ids = req.query.ids ? req.query.ids.split(',').map(Number).filter(n => n > 0) : []
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT sc.*, s.name AS staff_name FROM pest_staff_certs sc LEFT JOIN pest_staff s ON sc.staff_id = s.id WHERE sc.user_id = ?'
  const params = [userId]
  if (ids.length > 0) {
    sql += ` AND sc.id IN (${ids.map(() => '?').join(',')})`
    params.push(...ids)
  }
  sql += ' ORDER BY sc.created_at DESC'
  const rows = db.prepare(sql).all(...params)

  const certLabel = { health: '健康证', training: '培训合格证' }
  const data = rows.map(row => ({
    '人员姓名': row.staff_name || '',
    '证件类型': certLabel[row.cert_type] || row.cert_type,
    '证件名称': row.cert_name,
    '发证机构': row.issuing_agency,
    '证件编号': row.cert_number,
    '到期时间': row.expiry_date,
    '状态': getStatus(row.expiry_date) === 'expired' ? '已过期' : getStatus(row.expiry_date) === 'expiring_soon' ? '临期' : '正常'
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 10 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '人员证件')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('人员证件.xlsx'))
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

app.post('/api/pest/staff-certs', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, staff_id, cert_type, cert_name, issuing_agency, cert_number, issue_date, expiry_date } = req.body
  if (!user_id || !staff_id || !cert_name) return res.status(400).json({ message: '请填写证件名称' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  const result = db.prepare(
    'INSERT INTO pest_staff_certs (user_id, staff_id, cert_type, cert_name, issuing_agency, cert_number, issue_date, expiry_date, file_paths) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(user_id, staff_id, cert_type || 'health', cert_name, issuing_agency || '', cert_number || '', issue_date || '', expiry_date || '', JSON.stringify(paths))
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/pest/staff-certs/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, cert_type, cert_name, issuing_agency, cert_number, issue_date, expiry_date } = req.body
  const existing = db.prepare('SELECT * FROM pest_staff_certs WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '证件不存在或无权编辑' })

  const existingRaw = (req.body.existing_files || '[]').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  const existingKept = JSON.parse(existingRaw)
  let filePaths
  if (req.files && req.files.length > 0) {
    const newPaths = req.files.map(f => '/uploads/' + f.filename)
    filePaths = JSON.stringify([...existingKept, ...newPaths])
  } else {
    filePaths = JSON.stringify(existingKept)
  }

  db.prepare(
    'UPDATE pest_staff_certs SET cert_type=?, cert_name=?, issuing_agency=?, cert_number=?, issue_date=?, expiry_date=?, file_paths=? WHERE id=?'
  ).run(cert_type || existing.cert_type, cert_name || existing.cert_name, issuing_agency || existing.issuing_agency, cert_number || existing.cert_number, issue_date || existing.issue_date, expiry_date || existing.expiry_date, filePaths, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/pest/staff-certs/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const fs = require('fs')
  const cert = db.prepare('SELECT * FROM pest_staff_certs WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!cert) return res.status(404).json({ message: '证件不存在或无权删除' })
  try {
    JSON.parse(cert.file_paths || '[]').forEach(p => {
      const fp = path.join(__dirname, p)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    })
  } catch {}
  db.prepare('DELETE FROM pest_staff_certs WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

app.post('/api/pest/staff-certs/batch-delete', (req, res) => {
  const { user_id, ids } = req.body
  const fs = require('fs')
  if (!user_id || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '请选择要删除的证件' })
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(`SELECT * FROM pest_staff_certs WHERE id IN (${placeholders}) AND user_id = ?`).all(...ids, user_id)
  rows.forEach(r => {
    try {
      JSON.parse(r.file_paths || '[]').forEach(p => {
        const fp = path.join(__dirname, p)
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      })
    } catch {}
  })
  db.prepare(`DELETE FROM pest_staff_certs WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, user_id)
  res.json({ message: '批量删除成功', count: rows.length })
})

// ===== 虫害管理 - 化学品 =====

app.get('/api/pest/chemicals', (req, res) => {
  const userId = req.query.user_id
  const keyword = req.query.keyword || ''
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT * FROM pest_chemicals WHERE user_id = ?'
  const params = [userId]
  if (keyword) {
    sql += ' AND (name LIKE ? OR cas_number LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw)
  }
  sql += ' ORDER BY created_at DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.post('/api/pest/chemicals', (req, res) => {
  const { user_id, name, cas_number, formulation, usage_area, storage_location, quantity, supplier } = req.body
  if (!user_id || !name) return res.status(400).json({ message: '请填写化学品名称' })
  const result = db.prepare(
    'INSERT INTO pest_chemicals (user_id, name, cas_number, formulation, usage_area, storage_location, quantity, supplier) VALUES (?,?,?,?,?,?,?,?)'
  ).run(user_id, name, cas_number || '', formulation || '', usage_area || '', storage_location || '', quantity || '', supplier || '')
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/pest/chemicals/:id', (req, res) => {
  const { id } = req.params
  const { user_id, name, cas_number, formulation, usage_area, storage_location, quantity, supplier } = req.body
  const existing = db.prepare('SELECT * FROM pest_chemicals WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '化学品不存在或无权编辑' })
  db.prepare(
    'UPDATE pest_chemicals SET name=?, cas_number=?, formulation=?, usage_area=?, storage_location=?, quantity=?, supplier=? WHERE id=?'
  ).run(name || existing.name, cas_number || existing.cas_number, formulation || existing.formulation, usage_area || existing.usage_area, storage_location || existing.storage_location, quantity || existing.quantity, supplier || existing.supplier, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/pest/chemicals/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const chem = db.prepare('SELECT * FROM pest_chemicals WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!chem) return res.status(404).json({ message: '化学品不存在或无权删除' })
  // 同时删除关联的文档文件
  const fs = require('fs')
  const docs = db.prepare('SELECT * FROM pest_chemical_docs WHERE chemical_id = ?').all(id)
  docs.forEach(d => {
    try {
      JSON.parse(d.file_paths || '[]').forEach(p => {
        const fp = path.join(__dirname, p)
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      })
    } catch {}
  })
  db.prepare('DELETE FROM pest_chemical_docs WHERE chemical_id = ?').run(id)
  db.prepare('DELETE FROM pest_chemicals WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

app.post('/api/pest/chemicals/batch-delete', (req, res) => {
  const { user_id, ids } = req.body
  const fs = require('fs')
  if (!user_id || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '请选择要删除的化学品' })
  const placeholders = ids.map(() => '?').join(',')
  ids.forEach(id => {
    const docs = db.prepare('SELECT * FROM pest_chemical_docs WHERE chemical_id = ?').all(id)
    docs.forEach(d => {
      try {
        JSON.parse(d.file_paths || '[]').forEach(p => {
          const fp = path.join(__dirname, p)
          if (fs.existsSync(fp)) fs.unlinkSync(fp)
        })
      } catch {}
    })
  })
  db.prepare(`DELETE FROM pest_chemical_docs WHERE chemical_id IN (${placeholders})`).run(...ids)
  db.prepare(`DELETE FROM pest_chemicals WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, user_id)
  res.json({ message: '批量删除成功', count: ids.length })
})

// ===== 虫害管理 - 化学品文档 =====

app.get('/api/pest/chemical-docs', (req, res) => {
  const userId = req.query.user_id
  const docType = req.query.doc_type || ''
  const chemicalId = req.query.chemical_id || ''
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT cd.*, c.name AS chemical_name FROM pest_chemical_docs cd LEFT JOIN pest_chemicals c ON cd.chemical_id = c.id WHERE cd.user_id = ?'
  const params = [userId]
  if (docType) { sql += ' AND cd.doc_type = ?'; params.push(docType) }
  if (chemicalId) { sql += ' AND cd.chemical_id = ?'; params.push(chemicalId) }
  sql += ' ORDER BY cd.created_at DESC'
  const rows = db.prepare(sql).all(...params)
  const list = rows.map(row => ({ ...row, status: getStatus(row.expiry_date) }))
  res.json({ list })
})

app.post('/api/pest/chemical-docs', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, chemical_id, doc_type, doc_name, doc_number, version, issue_date, expiry_date, ghs_classification, holder, active_ingredient, usage_scope, is_compliant } = req.body
  if (!user_id || !chemical_id || !doc_name) return res.status(400).json({ message: '请填写文档名称' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  const result = db.prepare(
    'INSERT INTO pest_chemical_docs (user_id, chemical_id, doc_type, doc_name, doc_number, version, issue_date, expiry_date, ghs_classification, holder, active_ingredient, usage_scope, is_compliant, file_paths) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(user_id, chemical_id, doc_type || 'msds', doc_name, doc_number || '', version || '', issue_date || '', expiry_date || '', ghs_classification || '', holder || '', active_ingredient || '', usage_scope || '', is_compliant ? 1 : -1, JSON.stringify(paths))
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/pest/chemical-docs/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, doc_type, doc_name, doc_number, version, issue_date, expiry_date, ghs_classification, holder, active_ingredient, usage_scope, is_compliant } = req.body
  const existing = db.prepare('SELECT * FROM pest_chemical_docs WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '文档不存在或无权编辑' })

  const existingRaw = (req.body.existing_files || '[]').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  const existingKept = JSON.parse(existingRaw)
  let filePaths
  if (req.files && req.files.length > 0) {
    const newPaths = req.files.map(f => '/uploads/' + f.filename)
    filePaths = JSON.stringify([...existingKept, ...newPaths])
  } else {
    filePaths = JSON.stringify(existingKept)
  }

  db.prepare(
    'UPDATE pest_chemical_docs SET doc_type=?, doc_name=?, doc_number=?, version=?, issue_date=?, expiry_date=?, ghs_classification=?, holder=?, active_ingredient=?, usage_scope=?, is_compliant=?, file_paths=? WHERE id=?'
  ).run(doc_type || existing.doc_type, doc_name || existing.doc_name, doc_number || existing.doc_number, version || existing.version, issue_date || existing.issue_date, expiry_date || existing.expiry_date, ghs_classification || existing.ghs_classification, holder || existing.holder, active_ingredient || existing.active_ingredient, usage_scope || existing.usage_scope, is_compliant !== undefined ? (is_compliant ? 1 : 0) : existing.is_compliant, filePaths, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/pest/chemical-docs/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const fs = require('fs')
  const doc = db.prepare('SELECT * FROM pest_chemical_docs WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!doc) return res.status(404).json({ message: '文档不存在或无权删除' })
  try {
    JSON.parse(doc.file_paths || '[]').forEach(p => {
      const fp = path.join(__dirname, p)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    })
  } catch {}
  db.prepare('DELETE FROM pest_chemical_docs WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

app.post('/api/pest/chemical-docs/batch-delete', (req, res) => {
  const { user_id, ids } = req.body
  const fs = require('fs')
  if (!user_id || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '请选择要删除的文档' })
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(`SELECT * FROM pest_chemical_docs WHERE id IN (${placeholders}) AND user_id = ?`).all(...ids, user_id)
  rows.forEach(r => {
    try {
      JSON.parse(r.file_paths || '[]').forEach(p => {
        const fp = path.join(__dirname, p)
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      })
    } catch {}
  })
  db.prepare(`DELETE FROM pest_chemical_docs WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, user_id)
  res.json({ message: '批量删除成功', count: rows.length })
})

// ===== 虫害管理 - 布防图 =====

app.get('/api/pest/layout-maps', (req, res) => {
  const userId = req.query.user_id
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })
  const list = db.prepare('SELECT * FROM pest_layout_maps WHERE user_id = ? ORDER BY created_at DESC').all(userId)
  res.json({ list })
})

app.post('/api/pest/layout-maps', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, map_name, version, coverage_area } = req.body
  if (!user_id || !map_name) return res.status(400).json({ message: '请填写布防图名称' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  const result = db.prepare(
    'INSERT INTO pest_layout_maps (user_id, map_name, version, coverage_area, file_paths) VALUES (?,?,?,?,?)'
  ).run(user_id, map_name, version || '', coverage_area || '', JSON.stringify(paths))
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/pest/layout-maps/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, map_name, version, coverage_area } = req.body
  const existing = db.prepare('SELECT * FROM pest_layout_maps WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '布防图不存在或无权编辑' })

  const existingRaw = (req.body.existing_files || '[]').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  const existingKept = JSON.parse(existingRaw)
  let filePaths
  if (req.files && req.files.length > 0) {
    const newPaths = req.files.map(f => '/uploads/' + f.filename)
    filePaths = JSON.stringify([...existingKept, ...newPaths])
  } else {
    filePaths = JSON.stringify(existingKept)
  }

  db.prepare('UPDATE pest_layout_maps SET map_name=?, version=?, coverage_area=?, file_paths=? WHERE id=?')
    .run(map_name || existing.map_name, version || existing.version, coverage_area || existing.coverage_area, filePaths, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/pest/layout-maps/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const fs = require('fs')
  const doc = db.prepare('SELECT * FROM pest_layout_maps WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!doc) return res.status(404).json({ message: '布防图不存在或无权删除' })
  try {
    JSON.parse(doc.file_paths || '[]').forEach(p => {
      const fp = path.join(__dirname, p)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    })
  } catch {}
  db.prepare('DELETE FROM pest_layout_maps WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

// ===== 虫害管理 - 检查记录 =====

app.get('/api/pest/inspections', (req, res) => {
  const userId = req.query.user_id
  const keyword = req.query.keyword || ''
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT * FROM pest_inspections WHERE user_id = ?'
  const params = [userId]
  if (keyword) {
    sql += ' AND (inspector LIKE ? OR area LIKE ? OR findings_type LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw, kw)
  }
  sql += ' ORDER BY inspection_date DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.get('/api/pest/inspections/export', (req, res) => {
  const userId = req.query.user_id
  const ids = req.query.ids ? req.query.ids.split(',').map(Number).filter(n => n > 0) : []
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT * FROM pest_inspections WHERE user_id = ?'
  const params = [userId]
  if (ids.length > 0) {
    sql += ` AND id IN (${ids.map(() => '?').join(',')})`
    params.push(...ids)
  }
  sql += ' ORDER BY inspection_date DESC'
  const rows = db.prepare(sql).all(...params)

  const data = rows.map(row => ({
    '检查日期': row.inspection_date,
    '检查人员': row.inspector,
    '检查区域': row.area,
    '发现问题': row.findings_type,
    '数量': row.findings_count,
    '位置': row.findings_location,
    '处理措施': row.measures,
    '下次检查': row.next_inspection_date,
    '状态': row.status
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 8 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 10 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '检查记录')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('检查记录.xlsx'))
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

app.post('/api/pest/inspections', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, inspection_date, inspector, area, findings_type, findings_count, findings_location, measures, next_inspection_date } = req.body
  if (!user_id || !inspection_date) return res.status(400).json({ message: '请填写检查日期' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  const result = db.prepare(
    'INSERT INTO pest_inspections (user_id, inspection_date, inspector, area, findings_type, findings_count, findings_location, measures, next_inspection_date, file_paths) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(user_id, inspection_date, inspector || '', area || '', findings_type || '', findings_count || '', findings_location || '', measures || '', next_inspection_date || '', JSON.stringify(paths))
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/pest/inspections/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, inspection_date, inspector, area, findings_type, findings_count, findings_location, measures, next_inspection_date } = req.body
  const existing = db.prepare('SELECT * FROM pest_inspections WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '检查记录不存在或无权编辑' })

  const existingRaw = (req.body.existing_files || '[]').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  const existingKept = JSON.parse(existingRaw)
  let filePaths
  if (req.files && req.files.length > 0) {
    const newPaths = req.files.map(f => '/uploads/' + f.filename)
    filePaths = JSON.stringify([...existingKept, ...newPaths])
  } else {
    filePaths = JSON.stringify(existingKept)
  }

  db.prepare(
    'UPDATE pest_inspections SET inspection_date=?, inspector=?, area=?, findings_type=?, findings_count=?, findings_location=?, measures=?, next_inspection_date=?, file_paths=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(inspection_date || existing.inspection_date, inspector || existing.inspector, area || existing.area, findings_type || existing.findings_type, findings_count || existing.findings_count, findings_location || existing.findings_location, measures || existing.measures, next_inspection_date || existing.next_inspection_date, filePaths, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/pest/inspections/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const fs = require('fs')
  const doc = db.prepare('SELECT * FROM pest_inspections WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!doc) return res.status(404).json({ message: '检查记录不存在或无权删除' })
  try {
    JSON.parse(doc.file_paths || '[]').forEach(p => {
      const fp = path.join(__dirname, p)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    })
  } catch {}
  db.prepare('DELETE FROM pest_inspections WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

app.post('/api/pest/inspections/batch-delete', (req, res) => {
  const { user_id, ids } = req.body
  const fs = require('fs')
  if (!user_id || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '请选择要删除的记录' })
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(`SELECT * FROM pest_inspections WHERE id IN (${placeholders}) AND user_id = ?`).all(...ids, user_id)
  rows.forEach(r => {
    try {
      JSON.parse(r.file_paths || '[]').forEach(p => {
        const fp = path.join(__dirname, p)
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      })
    } catch {}
  })
  db.prepare(`DELETE FROM pest_inspections WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, user_id)
  res.json({ message: '批量删除成功', count: rows.length })
})

// ===== 虫害管理 - 月度报告 =====

app.get('/api/pest/monthly-reports', (req, res) => {
  const userId = req.query.user_id
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })
  const list = db.prepare('SELECT * FROM pest_monthly_reports WHERE user_id = ? ORDER BY report_month DESC').all(userId)
  res.json({ list })
})

app.post('/api/pest/monthly-reports', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, report_month, author, summary, improvements } = req.body
  if (!user_id || !report_month) return res.status(400).json({ message: '请填写报告月份' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  const result = db.prepare(
    'INSERT INTO pest_monthly_reports (user_id, report_month, author, summary, improvements, file_paths) VALUES (?,?,?,?,?,?)'
  ).run(user_id, report_month, author || '', summary || '', improvements || '', JSON.stringify(paths))
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/pest/monthly-reports/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, report_month, author, summary, improvements } = req.body
  const existing = db.prepare('SELECT * FROM pest_monthly_reports WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '报告不存在或无权编辑' })

  const existingRaw = (req.body.existing_files || '[]').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  const existingKept = JSON.parse(existingRaw)
  let filePaths
  if (req.files && req.files.length > 0) {
    const newPaths = req.files.map(f => '/uploads/' + f.filename)
    filePaths = JSON.stringify([...existingKept, ...newPaths])
  } else {
    filePaths = JSON.stringify(existingKept)
  }

  db.prepare('UPDATE pest_monthly_reports SET report_month=?, author=?, summary=?, improvements=?, file_paths=? WHERE id=?')
    .run(report_month || existing.report_month, author || existing.author, summary || existing.summary, improvements || existing.improvements, filePaths, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/pest/monthly-reports/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const fs = require('fs')
  const doc = db.prepare('SELECT * FROM pest_monthly_reports WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!doc) return res.status(404).json({ message: '报告不存在或无权删除' })
  try {
    JSON.parse(doc.file_paths || '[]').forEach(p => {
      const fp = path.join(__dirname, p)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    })
  } catch {}
  db.prepare('DELETE FROM pest_monthly_reports WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

// ===== 虫害管理 - 服务报告 =====

app.get('/api/pest/service-reports', (req, res) => {
  const userId = req.query.user_id
  const keyword = req.query.keyword || ''
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT * FROM pest_service_reports WHERE user_id = ?'
  const params = [userId]
  if (keyword) {
    sql += ' AND (report_number LIKE ? OR supplier LIKE ? OR service_area LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw, kw)
  }
  sql += ' ORDER BY service_date DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.get('/api/pest/service-reports/export', (req, res) => {
  const userId = req.query.user_id
  const ids = req.query.ids ? req.query.ids.split(',').map(Number).filter(n => n > 0) : []
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT * FROM pest_service_reports WHERE user_id = ?'
  const params = [userId]
  if (ids.length > 0) {
    sql += ` AND id IN (${ids.map(() => '?').join(',')})`
    params.push(...ids)
  }
  sql += ' ORDER BY service_date DESC'
  const rows = db.prepare(sql).all(...params)

  const data = rows.map(row => ({
    '报告编号': row.report_number,
    '服务日期': row.service_date,
    '供应商': row.supplier,
    '服务人员': row.service_staff,
    '服务区域': row.service_area,
    '服务内容': row.service_content,
    '发现问题': row.findings,
    '处理措施': row.measures,
    '使用药剂': row.chemicals_used,
    '客户签字': row.customer_signee,
    '签字日期': row.sign_date
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '服务报告')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('服务报告.xlsx'))
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

app.post('/api/pest/service-reports', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, report_number, service_date, supplier, service_staff, service_area, service_content, findings, measures, chemicals_used, customer_signee, sign_date } = req.body
  if (!user_id || !report_number) return res.status(400).json({ message: '请填写报告编号' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  const result = db.prepare(
    'INSERT INTO pest_service_reports (user_id, report_number, service_date, supplier, service_staff, service_area, service_content, findings, measures, chemicals_used, customer_signee, sign_date, file_paths) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(user_id, report_number, service_date || '', supplier || '', service_staff || '', service_area || '', service_content || '', findings || '', measures || '', chemicals_used || '', customer_signee || '', sign_date || '', JSON.stringify(paths))
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/pest/service-reports/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, report_number, service_date, supplier, service_staff, service_area, service_content, findings, measures, chemicals_used, customer_signee, sign_date } = req.body
  const existing = db.prepare('SELECT * FROM pest_service_reports WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '报告不存在或无权编辑' })

  const existingRaw = (req.body.existing_files || '[]').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  const existingKept = JSON.parse(existingRaw)
  let filePaths
  if (req.files && req.files.length > 0) {
    const newPaths = req.files.map(f => '/uploads/' + f.filename)
    filePaths = JSON.stringify([...existingKept, ...newPaths])
  } else {
    filePaths = JSON.stringify(existingKept)
  }

  db.prepare(
    'UPDATE pest_service_reports SET report_number=?, service_date=?, supplier=?, service_staff=?, service_area=?, service_content=?, findings=?, measures=?, chemicals_used=?, customer_signee=?, sign_date=?, file_paths=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(report_number || existing.report_number, service_date || existing.service_date, supplier || existing.supplier, service_staff || existing.service_staff, service_area || existing.service_area, service_content || existing.service_content, findings || existing.findings, measures || existing.measures, chemicals_used || existing.chemicals_used, customer_signee || existing.customer_signee, sign_date || existing.sign_date, filePaths, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/pest/service-reports/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const fs = require('fs')
  const doc = db.prepare('SELECT * FROM pest_service_reports WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!doc) return res.status(404).json({ message: '报告不存在或无权删除' })
  try {
    JSON.parse(doc.file_paths || '[]').forEach(p => {
      const fp = path.join(__dirname, p)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    })
  } catch {}
  db.prepare('DELETE FROM pest_service_reports WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

app.post('/api/pest/service-reports/batch-delete', (req, res) => {
  const { user_id, ids } = req.body
  const fs = require('fs')
  if (!user_id || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '请选择要删除的报告' })
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(`SELECT * FROM pest_service_reports WHERE id IN (${placeholders}) AND user_id = ?`).all(...ids, user_id)
  rows.forEach(r => {
    try {
      JSON.parse(r.file_paths || '[]').forEach(p => {
        const fp = path.join(__dirname, p)
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      })
    } catch {}
  })
  db.prepare(`DELETE FROM pest_service_reports WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, user_id)
  res.json({ message: '批量删除成功', count: rows.length })
})

// ===== 虫害管理 - 投诉整改 =====

app.get('/api/pest/complaints', (req, res) => {
  const userId = req.query.user_id
  const status = req.query.status || ''
  const keyword = req.query.keyword || ''
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT * FROM pest_complaints WHERE user_id = ?'
  const params = [userId]
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (keyword) {
    sql += ' AND (area LIKE ? OR description LIKE ? OR reporter LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw, kw)
  }
  sql += ' ORDER BY created_at DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.get('/api/pest/complaints/export', (req, res) => {
  const userId = req.query.user_id
  const ids = req.query.ids ? req.query.ids.split(',').map(Number).filter(n => n > 0) : []
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT * FROM pest_complaints WHERE user_id = ?'
  const params = [userId]
  if (ids.length > 0) {
    sql += ` AND id IN (${ids.map(() => '?').join(',')})`
    params.push(...ids)
  }
  sql += ' ORDER BY created_at DESC'
  const rows = db.prepare(sql).all(...params)

  const data = rows.map(row => ({
    '投诉编号': row.complaint_number,
    '投诉日期': row.complaint_date,
    '投诉人': row.reporter,
    '区域': row.area,
    '问题描述': row.description,
    '严重等级': row.severity,
    '处理人': row.handler,
    '处理时限': row.deadline,
    '处理措施': row.measures,
    '复查结果': row.review_result,
    '状态': row.status,
    '关闭日期': row.close_date
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '投诉整改')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('投诉整改.xlsx'))
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

app.post('/api/pest/complaints', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, complaint_number, complaint_date, reporter, area, description, severity, deadline } = req.body
  if (!user_id || !complaint_number) return res.status(400).json({ message: '请填写投诉编号' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  // 根据严重等级自动计算时限
  let dl = deadline || ''
  if (!dl && severity) {
    const now = new Date()
    const hours = severity === '严重' ? 4 : severity === '一般' ? 24 : 48
    now.setHours(now.getHours() + hours)
    dl = now.toISOString().slice(0, 16).replace('T', ' ')
  }
  const result = db.prepare(
    'INSERT INTO pest_complaints (user_id, complaint_number, complaint_date, reporter, area, description, severity, deadline, file_paths) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(user_id, complaint_number, complaint_date || '', reporter || '', area || '', description || '', severity || '一般', dl, JSON.stringify(paths))
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/pest/complaints/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, complaint_number, complaint_date, reporter, area, description, severity, handler, deadline, measures, review_result, status, close_date } = req.body
  const existing = db.prepare('SELECT * FROM pest_complaints WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '投诉不存在或无权编辑' })

  const existingRaw = (req.body.existing_files || '[]').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  const existingKept = JSON.parse(existingRaw)
  let filePaths
  if (req.files && req.files.length > 0) {
    const newPaths = req.files.map(f => '/uploads/' + f.filename)
    filePaths = JSON.stringify([...existingKept, ...newPaths])
  } else {
    filePaths = JSON.stringify(existingKept)
  }

  db.prepare(
    'UPDATE pest_complaints SET complaint_number=?, complaint_date=?, reporter=?, area=?, description=?, severity=?, handler=?, deadline=?, measures=?, review_result=?, status=?, close_date=?, file_paths=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(complaint_number || existing.complaint_number, complaint_date || existing.complaint_date, reporter || existing.reporter, area || existing.area, description || existing.description, severity || existing.severity, handler || existing.handler, deadline || existing.deadline, measures || existing.measures, review_result || existing.review_result, status || existing.status, close_date || existing.close_date, filePaths, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/pest/complaints/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const fs = require('fs')
  const doc = db.prepare('SELECT * FROM pest_complaints WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!doc) return res.status(404).json({ message: '投诉不存在或无权删除' })
  try {
    JSON.parse(doc.file_paths || '[]').forEach(p => {
      const fp = path.join(__dirname, p)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    })
  } catch {}
  db.prepare('DELETE FROM pest_complaints WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

app.post('/api/pest/complaints/batch-delete', (req, res) => {
  const { user_id, ids } = req.body
  const fs = require('fs')
  if (!user_id || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '请选择要删除的投诉' })
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(`SELECT * FROM pest_complaints WHERE id IN (${placeholders}) AND user_id = ?`).all(...ids, user_id)
  rows.forEach(r => {
    try {
      JSON.parse(r.file_paths || '[]').forEach(p => {
        const fp = path.join(__dirname, p)
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      })
    } catch {}
  })
  db.prepare(`DELETE FROM pest_complaints WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, user_id)
  res.json({ message: '批量删除成功', count: rows.length })
})

// 投诉状态流转快捷接口
app.put('/api/pest/complaints/:id/assign', (req, res) => {
  const { id } = req.params
  const { user_id, handler } = req.body
  const existing = db.prepare('SELECT * FROM pest_complaints WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '投诉不存在' })
  db.prepare('UPDATE pest_complaints SET handler=?, status=\'处理中\', updated_at=CURRENT_TIMESTAMP WHERE id=?').run(handler || '', id)
  res.json({ message: '已派单' })
})

app.put('/api/pest/complaints/:id/review', (req, res) => {
  const { id } = req.params
  const { user_id, review_result } = req.body
  const existing = db.prepare('SELECT * FROM pest_complaints WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '投诉不存在' })
  const newStatus = review_result === '合格' ? '已关闭' : '待复查'
  const closeDate = newStatus === '已关闭' ? new Date().toISOString().slice(0, 10) : ''
  db.prepare('UPDATE pest_complaints SET review_result=?, status=?, close_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(review_result || '', newStatus, closeDate, id)
  res.json({ message: '复查完成' })
})

app.put('/api/pest/complaints/:id/close', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const existing = db.prepare('SELECT * FROM pest_complaints WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '投诉不存在' })
  db.prepare("UPDATE pest_complaints SET status='已关闭', close_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(new Date().toISOString().slice(0, 10), id)
  res.json({ message: '投诉已关闭' })
})



// ===== 计量校准 - 设备台账 =====

app.get('/api/calibration/devices', (req, res) => {
  const userId = req.query.user_id
  const keyword = req.query.keyword || ''
  const deviceType = req.query.device_type || ''
  const status = req.query.status || ''
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })

  let sql = 'SELECT * FROM calibration_devices WHERE user_id = ?'
  const params = [userId]
  if (deviceType) { sql += ' AND device_type = ?'; params.push(deviceType) }
  if (status) { sql += ' AND calibration_status = ?'; params.push(status) }
  if (keyword) {
    sql += ' AND (device_number LIKE ? OR device_name LIKE ? OR location LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw, kw)
  }
  sql += ' ORDER BY created_at DESC'
  const rows = db.prepare(sql).all(...params)
  const list = rows.map(row => ({ ...row, status: getStatus(row.next_calibration_date) }))
  res.json({ list })
})

app.get('/api/calibration/devices/export', (req, res) => {
  const userId = req.query.user_id
  const ids = req.query.ids ? req.query.ids.split(',').map(Number).filter(n => n > 0) : []
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })
  let sql = 'SELECT * FROM calibration_devices WHERE user_id = ?'
  const params = [userId]
  if (ids.length > 0) { sql += ' AND id IN (' + ids.map(() => '?').join(',') + ')'; params.push(...ids) }
  sql += ' ORDER BY created_at DESC'
  const rows = db.prepare(sql).all(...params)
  const data = rows.map(row => ({
    '设备编号': row.device_number, '设备名称': row.device_name, '设备类型': row.device_type,
    '品牌型号': row.brand_model, '存放位置': row.location, '责任人': row.responsible_person,
    '上次校准': row.last_calibration_date, '下次校准': row.next_calibration_date, '校准状态': row.calibration_status
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }]
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '设备台账')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('设备台账.xlsx'))
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

app.post('/api/calibration/devices', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, device_number, device_name, device_type, brand_model, accuracy, measure_range, location, responsible_person, start_date, calibration_cycle, last_calibration_date, next_calibration_date } = req.body
  if (!user_id || !device_name) return res.status(400).json({ message: '请填写设备名称' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  const result = db.prepare(
    'INSERT INTO calibration_devices (user_id, device_number, device_name, device_type, brand_model, accuracy, measure_range, location, responsible_person, start_date, calibration_cycle, last_calibration_date, next_calibration_date, file_paths) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(user_id, device_number || '', device_name, device_type || '温度测量', brand_model || '', accuracy || '', measure_range || '', location || '', responsible_person || '', start_date || '', calibration_cycle || '12', last_calibration_date || '', next_calibration_date || '', JSON.stringify(paths))
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/calibration/devices/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, device_number, device_name, device_type, brand_model, accuracy, measure_range, location, responsible_person, start_date, calibration_cycle, last_calibration_date, next_calibration_date, calibration_status, device_status } = req.body
  const existing = db.prepare('SELECT * FROM calibration_devices WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '设备不存在或无权编辑' })
  const existingRaw = (req.body.existing_files || '[]').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  const existingKept = JSON.parse(existingRaw)
  let filePaths
  if (req.files && req.files.length > 0) {
    filePaths = JSON.stringify([...existingKept, ...req.files.map(f => '/uploads/' + f.filename)])
  } else {
    filePaths = JSON.stringify(existingKept)
  }
  db.prepare(
    'UPDATE calibration_devices SET device_number=?, device_name=?, device_type=?, brand_model=?, accuracy=?, measure_range=?, location=?, responsible_person=?, start_date=?, calibration_cycle=?, last_calibration_date=?, next_calibration_date=?, calibration_status=?, device_status=?, file_paths=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(device_number || existing.device_number, device_name || existing.device_name, device_type || existing.device_type, brand_model || existing.brand_model, accuracy || existing.accuracy, measure_range || existing.measure_range, location || existing.location, responsible_person || existing.responsible_person, start_date || existing.start_date, calibration_cycle || existing.calibration_cycle, last_calibration_date || existing.last_calibration_date, next_calibration_date || existing.next_calibration_date, calibration_status || existing.calibration_status, device_status || existing.device_status, filePaths, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/calibration/devices/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const fs = require('fs')
  const dev = db.prepare('SELECT * FROM calibration_devices WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!dev) return res.status(404).json({ message: '设备不存在或无权删除' })
  try { JSON.parse(dev.file_paths || '[]').forEach(p => { const fp = path.join(__dirname, p); if (fs.existsSync(fp)) fs.unlinkSync(fp) }) } catch {}
  db.prepare('DELETE FROM calibration_devices WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

app.post('/api/calibration/devices/batch-delete', (req, res) => {
  const { user_id, ids } = req.body
  const fs = require('fs')
  if (!user_id || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '请选择要删除的设备' })
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare('SELECT * FROM calibration_devices WHERE id IN (' + placeholders + ') AND user_id = ?').all(...ids, user_id)
  rows.forEach(r => { try { JSON.parse(r.file_paths || '[]').forEach(p => { const fp = path.join(__dirname, p); if (fs.existsSync(fp)) fs.unlinkSync(fp) }) } catch {} })
  db.prepare('DELETE FROM calibration_devices WHERE id IN (' + placeholders + ') AND user_id = ?').run(...ids, user_id)
  res.json({ message: '批量删除成功', count: rows.length })
})

// ===== 计量校准 - 校准计划 =====

app.get('/api/calibration/plans', (req, res) => {
  const userId = req.query.user_id
  const status = req.query.status || ''
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })
  let sql = 'SELECT cp.*, cd.device_name, cd.device_number FROM calibration_plans cp LEFT JOIN calibration_devices cd ON cp.device_id = cd.id WHERE cp.user_id = ?'
  const params = [userId]
  if (status) { sql += ' AND cp.plan_status = ?'; params.push(status) }
  sql += ' ORDER BY cp.planned_date DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.post('/api/calibration/plans', (req, res) => {
  const { user_id, plan_number, device_id, planned_date, agency_id, method, remark } = req.body
  if (!user_id || !device_id || !planned_date) return res.status(400).json({ message: '请填写必填项' })
  const result = db.prepare(
    'INSERT INTO calibration_plans (user_id, plan_number, device_id, planned_date, agency_id, method, remark) VALUES (?,?,?,?,?,?,?)'
  ).run(user_id, plan_number || '', device_id, planned_date, agency_id || null, method || '外校', remark || '')
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/calibration/plans/:id', (req, res) => {
  const { id } = req.params
  const { user_id, plan_number, device_id, planned_date, actual_date, agency_id, method, plan_status, result, remark } = req.body
  const existing = db.prepare('SELECT * FROM calibration_plans WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '计划不存在或无权编辑' })
  db.prepare(
    'UPDATE calibration_plans SET plan_number=?, device_id=?, planned_date=?, actual_date=?, agency_id=?, method=?, plan_status=?, result=?, remark=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(plan_number || existing.plan_number, device_id || existing.device_id, planned_date || existing.planned_date, actual_date || existing.actual_date, agency_id || existing.agency_id, method || existing.method, plan_status || existing.plan_status, result || existing.result, remark || existing.remark, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/calibration/plans/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const plan = db.prepare('SELECT * FROM calibration_plans WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!plan) return res.status(404).json({ message: '计划不存在或无权删除' })
  db.prepare('DELETE FROM calibration_plans WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

// ===== 计量校准 - 校准记录 =====

app.get('/api/calibration/records', (req, res) => {
  const userId = req.query.user_id
  const keyword = req.query.keyword || ''
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })
  let sql = 'SELECT cr.*, cd.device_name, cd.device_number FROM calibration_records cr LEFT JOIN calibration_devices cd ON cr.device_id = cd.id WHERE cr.user_id = ?'
  const params = [userId]
  if (keyword) {
    sql += ' AND (cr.cert_number LIKE ? OR cd.device_number LIKE ? OR cr.agency_name LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw, kw)
  }
  sql += ' ORDER BY cr.calibration_date DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.get('/api/calibration/records/export', (req, res) => {
  const userId = req.query.user_id
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })
  const rows = db.prepare(
    'SELECT cr.*, cd.device_name, cd.device_number FROM calibration_records cr LEFT JOIN calibration_devices cd ON cr.device_id = cd.id WHERE cr.user_id = ? ORDER BY cr.calibration_date DESC'
  ).all(userId)
  const data = rows.map(row => ({
    '证书编号': row.cert_number, '设备编号': row.device_number, '设备名称': row.device_name,
    '校准日期': row.calibration_date, '校准机构': row.agency_name, '校准结论': row.conclusion,
    '下次校准': row.next_calibration_date
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [{ wch: 15 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 12 }]
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '校准记录')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('校准记录.xlsx'))
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

app.post('/api/calibration/records', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, cert_number, device_id, plan_id, calibration_date, agency_name, agency_qualification, standard, method, environment, test_data, max_error, conclusion, limit_note, next_calibration_date, calibrator } = req.body
  if (!user_id || !cert_number || !device_id) return res.status(400).json({ message: '请填写必填项' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  // 解析测试数据 JSON
  let testData = '[]'
  try {
    if (test_data) {
      const raw = test_data.replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
      testData = JSON.stringify(JSON.parse(raw))
    }
  } catch {}
  const result = db.prepare(
    'INSERT INTO calibration_records (user_id, cert_number, device_id, plan_id, calibration_date, agency_name, agency_qualification, standard, method, environment, test_data, max_error, conclusion, limit_note, next_calibration_date, calibrator, file_paths) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(user_id, cert_number, device_id, plan_id || null, calibration_date || '', agency_name || '', agency_qualification || '', standard || '', method || '外校', environment || '', testData, max_error || '', conclusion || '合格', limit_note || '', next_calibration_date || '', calibrator || '', JSON.stringify(paths))
  // 更新设备的校准日期
  if (next_calibration_date) {
    db.prepare('UPDATE calibration_devices SET last_calibration_date=?, next_calibration_date=?, calibration_status=? WHERE id=?').run(calibration_date || '', next_calibration_date, conclusion === '合格' ? '正常' : '异常', device_id)
  }
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/calibration/records/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, cert_number, calibration_date, agency_name, agency_qualification, standard, method, environment, test_data, max_error, conclusion, limit_note, next_calibration_date, calibrator } = req.body
  const existing = db.prepare('SELECT * FROM calibration_records WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '记录不存在或无权编辑' })
  const existingRaw = (req.body.existing_files || '[]').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  const existingKept = JSON.parse(existingRaw)
  let filePaths
  if (req.files && req.files.length > 0) {
    filePaths = JSON.stringify([...existingKept, ...req.files.map(f => '/uploads/' + f.filename)])
  } else {
    filePaths = JSON.stringify(existingKept)
  }
  let testData = existing.test_data
  if (test_data) {
    try { const raw = test_data.replace(/&quot;/g, '"').replace(/&#x27;/g, "'"); testData = JSON.stringify(JSON.parse(raw)) } catch {}
  }
  db.prepare(
    'UPDATE calibration_records SET cert_number=?, calibration_date=?, agency_name=?, agency_qualification=?, standard=?, method=?, environment=?, test_data=?, max_error=?, conclusion=?, limit_note=?, next_calibration_date=?, calibrator=?, file_paths=? WHERE id=?'
  ).run(cert_number || existing.cert_number, calibration_date || existing.calibration_date, agency_name || existing.agency_name, agency_qualification || existing.agency_qualification, standard || existing.standard, method || existing.method, environment || existing.environment, testData, max_error || existing.max_error, conclusion || existing.conclusion, limit_note || existing.limit_note, next_calibration_date || existing.next_calibration_date, calibrator || existing.calibrator, filePaths, id)
  if (next_calibration_date) {
    db.prepare('UPDATE calibration_devices SET next_calibration_date=?, calibration_status=? WHERE id=?').run(next_calibration_date, conclusion === '合格' ? '正常' : '异常', existing.device_id)
  }
  res.json({ message: '更新成功' })
})

app.delete('/api/calibration/records/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const fs = require('fs')
  const rec = db.prepare('SELECT * FROM calibration_records WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!rec) return res.status(404).json({ message: '记录不存在或无权删除' })
  try { JSON.parse(rec.file_paths || '[]').forEach(p => { const fp = path.join(__dirname, p); if (fs.existsSync(fp)) fs.unlinkSync(fp) }) } catch {}
  db.prepare('DELETE FROM calibration_records WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

// ===== 计量校准 - 校准机构 =====

app.get('/api/calibration/agencies', (req, res) => {
  const userId = req.query.user_id
  const keyword = req.query.keyword || ''
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })
  let sql = 'SELECT * FROM calibration_agencies WHERE user_id = ?'
  const params = [userId]
  if (keyword) {
    sql += ' AND (agency_name LIKE ? OR contact_person LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw)
  }
  sql += ' ORDER BY created_at DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.post('/api/calibration/agencies', (req, res) => {
  const { user_id, agency_name, qualification, cert_number, cert_expiry, service_scope, contact_person, contact_phone, address } = req.body
  if (!user_id || !agency_name) return res.status(400).json({ message: '请填写机构名称' })
  const result = db.prepare(
    'INSERT INTO calibration_agencies (user_id, agency_name, qualification, cert_number, cert_expiry, service_scope, contact_person, contact_phone, address) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(user_id, agency_name, qualification || '', cert_number || '', cert_expiry || '', service_scope || '', contact_person || '', contact_phone || '', address || '')
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/calibration/agencies/:id', (req, res) => {
  const { id } = req.params
  const { user_id, agency_name, qualification, cert_number, cert_expiry, service_scope, contact_person, contact_phone, address, cooperation_status, rating } = req.body
  const existing = db.prepare('SELECT * FROM calibration_agencies WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '机构不存在或无权编辑' })
  db.prepare(
    'UPDATE calibration_agencies SET agency_name=?, qualification=?, cert_number=?, cert_expiry=?, service_scope=?, contact_person=?, contact_phone=?, address=?, cooperation_status=?, rating=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(agency_name || existing.agency_name, qualification || existing.qualification, cert_number || existing.cert_number, cert_expiry || existing.cert_expiry, service_scope || existing.service_scope, contact_person || existing.contact_person, contact_phone || existing.contact_phone, address || existing.address, cooperation_status || existing.cooperation_status, rating !== undefined ? rating : existing.rating, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/calibration/agencies/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const agency = db.prepare('SELECT * FROM calibration_agencies WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!agency) return res.status(404).json({ message: '机构不存在或无权删除' })
  db.prepare('DELETE FROM calibration_agencies WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

// ===== 计量校准 - 异常处理 =====

app.get('/api/calibration/exceptions', (req, res) => {
  const userId = req.query.user_id
  const status = req.query.status || ''
  const keyword = req.query.keyword || ''
  if (!userId) return res.status(400).json({ message: '缺少用户标识' })
  let sql = 'SELECT ce.*, cd.device_name, cd.device_number FROM calibration_exceptions ce LEFT JOIN calibration_devices cd ON ce.device_id = cd.id WHERE ce.user_id = ?'
  const params = [userId]
  if (status) { sql += ' AND ce.status = ?'; params.push(status) }
  if (keyword) {
    sql += ' AND (ce.description LIKE ? OR cd.device_number LIKE ?)'
    const kw = '%' + keyword + '%'
    params.push(kw, kw)
  }
  sql += ' ORDER BY ce.created_at DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.post('/api/calibration/exceptions', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { user_id, exception_number, device_id, exception_type, description, severity, discover_date, impact_assessment } = req.body
  if (!user_id || !exception_number || !device_id) return res.status(400).json({ message: '请填写必填项' })
  const paths = (req.files || []).map(f => '/uploads/' + f.filename)
  const result = db.prepare(
    'INSERT INTO calibration_exceptions (user_id, exception_number, device_id, exception_type, description, severity, discover_date, impact_assessment, file_paths) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(user_id, exception_number, device_id, exception_type || '校准不合格', description || '', severity || '一般', discover_date || '', impact_assessment || '', JSON.stringify(paths))
  res.json({ message: '添加成功', id: result.lastInsertRowid })
})

app.put('/api/calibration/exceptions/:id', upload.array('files', 5), sanitizeUploadBody, (req, res) => {
  const { id } = req.params
  const { user_id, exception_number, exception_type, description, severity, discover_date, impact_assessment, measures, handler, handle_date, recalibration_date, status } = req.body
  const existing = db.prepare('SELECT * FROM calibration_exceptions WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '异常不存在或无权编辑' })
  const existingRaw = (req.body.existing_files || '[]').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  const existingKept = JSON.parse(existingRaw)
  let filePaths
  if (req.files && req.files.length > 0) {
    filePaths = JSON.stringify([...existingKept, ...req.files.map(f => '/uploads/' + f.filename)])
  } else {
    filePaths = JSON.stringify(existingKept)
  }
  db.prepare(
    'UPDATE calibration_exceptions SET exception_number=?, exception_type=?, description=?, severity=?, discover_date=?, impact_assessment=?, measures=?, handler=?, handle_date=?, recalibration_date=?, status=?, file_paths=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(exception_number || existing.exception_number, exception_type || existing.exception_type, description || existing.description, severity || existing.severity, discover_date || existing.discover_date, impact_assessment || existing.impact_assessment, measures || existing.measures, handler || existing.handler, handle_date || existing.handle_date, recalibration_date || existing.recalibration_date, status || existing.status, filePaths, id)
  res.json({ message: '更新成功' })
})

app.delete('/api/calibration/exceptions/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const fs = require('fs')
  const rec = db.prepare('SELECT * FROM calibration_exceptions WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!rec) return res.status(404).json({ message: '异常不存在或无权删除' })
  try { JSON.parse(rec.file_paths || '[]').forEach(p => { const fp = path.join(__dirname, p); if (fs.existsSync(fp)) fs.unlinkSync(fp) }) } catch {}
  db.prepare('DELETE FROM calibration_exceptions WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

// ===== 原料与标准管理 =====

// ---- 原料库 ----

app.get('/api/raw-materials', (req, res) => {
  const { user_id, keyword, category, risk_level, status } = req.query
  let sql = 'SELECT * FROM raw_materials WHERE user_id = ?'
  const params = [user_id]
  if (category) { sql += ' AND category = ?'; params.push(category) }
  if (risk_level) { sql += ' AND risk_level = ?'; params.push(risk_level) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (keyword) { sql += ' AND (material_name LIKE ? OR material_number LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%') }
  sql += ' ORDER BY created_at DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.post('/api/raw-materials', (req, res) => {
  const { user_id, material_name, category, risk_level, specification, shelf_life, storage_condition, executive_standard, allergen_info, suppliers } = req.body
  if (!material_name) return res.status(400).json({ message: '请填写原料名称' })
  // 自动生成原料编号
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM raw_materials WHERE user_id = ?').get(user_id).cnt
  const material_number = 'RM-' + String(count + 1).padStart(3, '0')
  db.prepare(
    'INSERT INTO raw_materials (user_id, material_number, material_name, category, risk_level, specification, shelf_life, storage_condition, executive_standard, allergen_info, suppliers) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(user_id, material_number, material_name, category || '其他', risk_level || '中', specification || '', shelf_life || 0, storage_condition || '', executive_standard || '', allergen_info || '', JSON.stringify(suppliers || []))
  res.json({ message: '原料添加成功' })
})

app.put('/api/raw-materials/:id', (req, res) => {
  const { id } = req.params
  const { user_id, material_name, category, risk_level, specification, shelf_life, storage_condition, executive_standard, allergen_info, suppliers, status } = req.body
  const existing = db.prepare('SELECT * FROM raw_materials WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!existing) return res.status(404).json({ message: '原料不存在' })
  db.prepare(
    'UPDATE raw_materials SET material_name=?, category=?, risk_level=?, specification=?, shelf_life=?, storage_condition=?, executive_standard=?, allergen_info=?, suppliers=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(material_name || existing.material_name, category || existing.category, risk_level || existing.risk_level, specification || existing.specification, shelf_life != null ? shelf_life : existing.shelf_life, storage_condition || existing.storage_condition, executive_standard || existing.executive_standard, allergen_info || existing.allergen_info, suppliers ? JSON.stringify(suppliers) : existing.suppliers, status || existing.status, id)
  res.json({ message: '原料更新成功' })
})

app.delete('/api/raw-materials/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM raw_materials WHERE id = ? AND user_id = ?').get(id, req.body.user_id)
  if (!existing) return res.status(404).json({ message: '原料不存在' })
  db.prepare('DELETE FROM raw_materials WHERE id = ?').run(id)
  res.json({ message: '原料已删除' })
})

// ---- 验收标准 ----

app.get('/api/raw-materials/standards/templates', (req, res) => {
  res.json({ list: [
    { name: '肉类通用模板', category: '肉类/海鲜', temp_standard: '冷藏 0~4°C / 冷冻 ≤-18°C', cert_count: 5, sensory_count: 6 },
    { name: '蔬菜通用模板', category: '蔬菜/水果', temp_standard: '冷藏 0~8°C', cert_count: 3, sensory_count: 4 },
    { name: '常温原料模板', category: '粮食/调料/包材', temp_standard: '常温 ≤25°C', cert_count: 2, sensory_count: 3 },
    { name: '乳制品模板', category: '乳制品/蛋类', temp_standard: '冷藏 0~4°C', cert_count: 4, sensory_count: 5 }
  ]})
})

app.get('/api/raw-materials/:id/standards', (req, res) => {
  const { id } = req.params
  const standard = db.prepare('SELECT * FROM raw_material_standards WHERE material_id = ?').get(id)
  res.json({ standard: standard || null })
})

app.post('/api/raw-materials/:id/standards', (req, res) => {
  const { id } = req.params
  const { user_id, temp_standard, cert_requirements, sensory_items, packaging_requirement, shelf_life_ratio, judge_rules } = req.body
  const material = db.prepare('SELECT * FROM raw_materials WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!material) return res.status(404).json({ message: '原料不存在' })
  // 检查是否已有标准配置
  const existing = db.prepare('SELECT * FROM raw_material_standards WHERE material_id = ?').get(id)
  if (existing) {
    db.prepare(
      'UPDATE raw_material_standards SET temp_standard=?, cert_requirements=?, sensory_items=?, packaging_requirement=?, shelf_life_ratio=?, judge_rules=?, updated_at=CURRENT_TIMESTAMP WHERE material_id=?'
    ).run(temp_standard || existing.temp_standard, cert_requirements ? JSON.stringify(cert_requirements) : existing.cert_requirements, sensory_items ? JSON.stringify(sensory_items) : existing.sensory_items, packaging_requirement || existing.packaging_requirement, shelf_life_ratio != null ? shelf_life_ratio : existing.shelf_life_ratio, judge_rules ? JSON.stringify(judge_rules) : existing.judge_rules, id)
  } else {
    db.prepare(
      'INSERT INTO raw_material_standards (user_id, material_id, temp_standard, cert_requirements, sensory_items, packaging_requirement, shelf_life_ratio, judge_rules) VALUES (?,?,?,?,?,?,?,?)'
    ).run(user_id, id, temp_standard || '', JSON.stringify(cert_requirements || []), JSON.stringify(sensory_items || []), packaging_requirement || '', shelf_life_ratio || 0.33, JSON.stringify(judge_rules || {}))
  }
  res.json({ message: '验收标准保存成功' })
})

// ---- 原料验收 ----

app.get('/api/raw-material/batches', (req, res) => {
  const { user_id, keyword, status, judge_result } = req.query
  let sql = 'SELECT * FROM raw_material_batches WHERE user_id = ?'
  const params = [user_id]
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (judge_result) { sql += ' AND judge_result = ?'; params.push(judge_result) }
  if (keyword) { sql += ' AND (batch_number LIKE ? OR material_name LIKE ? OR supplier LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%', '%'+keyword+'%') }
  sql += ' ORDER BY created_at DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.get('/api/raw-material/batches/stats', (req, res) => {
  const { user_id } = req.query
  const total = db.prepare('SELECT COUNT(*) AS cnt FROM raw_material_batches WHERE user_id = ?').get(user_id).cnt
  const pending = db.prepare("SELECT COUNT(*) AS cnt FROM raw_material_batches WHERE user_id = ? AND status = '待验收'").get(user_id).cnt
  const qualified = db.prepare("SELECT COUNT(*) AS cnt FROM raw_material_batches WHERE user_id = ? AND judge_result = '合格'").get(user_id).cnt
  const rejected = db.prepare("SELECT COUNT(*) AS cnt FROM raw_material_batches WHERE user_id = ? AND judge_result = '拒收'").get(user_id).cnt
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = db.prepare("SELECT COUNT(*) AS cnt FROM raw_material_batches WHERE user_id = ? AND date(arrival_time) = ?").get(user_id, today).cnt
  res.json({ total, pending, qualified, rejected, todayCount })
})

app.get('/api/raw-material/batches/:id', (req, res) => {
  const { id } = req.params
  const batch = db.prepare('SELECT * FROM raw_material_batches WHERE id = ?').get(id)
  if (!batch) return res.status(404).json({ message: '批次不存在' })
  const inspection = db.prepare('SELECT * FROM raw_material_inspection WHERE batch_id = ?').get(id)
  const aiRisk = db.prepare('SELECT * FROM raw_material_ai_risk WHERE batch_id = ?').get(id)
  const rejection = db.prepare('SELECT * FROM raw_material_rejections WHERE batch_id = ?').get(id)
  const concession = db.prepare('SELECT * FROM raw_material_concessions WHERE batch_id = ?').get(id)
  res.json({ batch, inspection, aiRisk, rejection, concession })
})

app.post('/api/raw-material/batches', (req, res) => {
  const { user_id, arrival_time, material_name, material_id, supplier, po_number, planned_quantity, actual_quantity, inspector } = req.body
  if (!material_name) return res.status(400).json({ message: '请填写原料名称' })
  // 自动生成批次号
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const count = db.prepare("SELECT COUNT(*) AS cnt FROM raw_material_batches WHERE user_id = ? AND batch_number LIKE 'RM-' || ? || '%'").get(user_id, today).cnt
  const batch_number = 'RM-' + today + '-' + String(count + 1).padStart(3, '0')
  const result = db.prepare(
    'INSERT INTO raw_material_batches (user_id, batch_number, arrival_time, material_name, material_id, supplier, po_number, planned_quantity, actual_quantity, inspector) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(user_id, batch_number, arrival_time || new Date().toISOString(), material_name, material_id || null, supplier || '', po_number || '', planned_quantity || 0, actual_quantity || 0, inspector || '')
  res.json({ message: '到货登记成功', id: result.lastInsertRowid, batch_number })
})

app.put('/api/raw-material/batches/:id/inspect', (req, res) => {
  const { id } = req.params
  const { user_id, cert_check, sensory_check, temp_check, packaging_check, inspect_photos } = req.body
  const batch = db.prepare('SELECT * FROM raw_material_batches WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!batch) return res.status(404).json({ message: '批次不存在' })
  // 插入或更新检查记录
  const existing = db.prepare('SELECT * FROM raw_material_inspection WHERE batch_id = ?').get(id)
  if (existing) {
    db.prepare(
      'UPDATE raw_material_inspection SET cert_check=?, sensory_check=?, temp_check=?, packaging_check=?, inspect_photos=? WHERE batch_id=?'
    ).run(JSON.stringify(cert_check || {}), JSON.stringify(sensory_check || {}), JSON.stringify(temp_check || {}), JSON.stringify(packaging_check || {}), JSON.stringify(inspect_photos || []), id)
  } else {
    db.prepare(
      'INSERT INTO raw_material_inspection (user_id, batch_id, cert_check, sensory_check, temp_check, packaging_check, inspect_photos) VALUES (?,?,?,?,?,?,?)'
    ).run(user_id, id, JSON.stringify(cert_check || {}), JSON.stringify(sensory_check || {}), JSON.stringify(temp_check || {}), JSON.stringify(packaging_check || {}), JSON.stringify(inspect_photos || []))
  }
  db.prepare("UPDATE raw_material_batches SET status = '已检查', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id)
  res.json({ message: '检查记录保存成功' })
})

app.put('/api/raw-material/batches/:id/judge', (req, res) => {
  const { id } = req.params
  const { user_id, judge_result, judge_approver } = req.body
  if (!judge_result) return res.status(400).json({ message: '请选择判定结果' })
  const batch = db.prepare('SELECT * FROM raw_material_batches WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!batch) return res.status(404).json({ message: '批次不存在' })
  const judgeTime = new Date().toISOString()
  db.prepare(
    "UPDATE raw_material_batches SET judge_result=?, judge_time=?, judge_approver=?, status='已完成', updated_at=CURRENT_TIMESTAMP WHERE id=?"
  ).run(judge_result, judgeTime, judge_approver || '', id)
  // 拒收时自动创建拒收记录
  if (judge_result === '拒收') {
    const rjCount = db.prepare('SELECT COUNT(*) AS cnt FROM raw_material_rejections WHERE user_id = ?').get(user_id).cnt
    const rjNumber = 'RJ-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(rjCount + 1).padStart(3, '0')
    db.prepare(
      'INSERT INTO raw_material_rejections (user_id, rejection_number, batch_id, rejection_reason, rejection_quantity) VALUES (?,?,?,?,?)'
    ).run(user_id, rjNumber, id, '验收判定拒收', batch.actual_quantity)
  }
  res.json({ message: '判定完成' })
})

// 删除批次
app.delete('/api/raw-material/batches/:id', (req, res) => {
  const { id } = req.params
  const { user_id } = req.body
  const batch = db.prepare('SELECT * FROM raw_material_batches WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!batch) return res.status(404).json({ message: '批次不存在' })
  db.prepare('DELETE FROM raw_material_inspection WHERE batch_id = ?').run(id)
  db.prepare('DELETE FROM raw_material_ai_risk WHERE batch_id = ?').run(id)
  db.prepare('DELETE FROM raw_material_rejections WHERE batch_id = ?').run(id)
  db.prepare('DELETE FROM raw_material_concessions WHERE batch_id = ?').run(id)
  db.prepare('DELETE FROM raw_material_batches WHERE id = ?').run(id)
  res.json({ message: '批次已删除' })
})

// AI 风险评估
app.post('/api/raw-material/ai-risk', strictLimiter, async (req, res) => {
  const { user_id, batch_id, material_id, cert_score, temp_deviation, sensory_abnormal } = req.body
  if (!batch_id) return res.status(400).json({ message: '缺少批次信息' })
  const batch = db.prepare('SELECT * FROM raw_material_batches WHERE id = ?').get(batch_id)
  if (!batch) return res.status(404).json({ message: '批次不存在' })

  // 获取供应商历史合格率
  let supplierHistoryRate = 100
  if (batch.supplier) {
    const total = db.prepare("SELECT COUNT(*) AS cnt FROM raw_material_batches WHERE supplier = ? AND judge_result != ''").get(batch.supplier).cnt
    const pass = db.prepare("SELECT COUNT(*) AS cnt FROM raw_material_batches WHERE supplier = ? AND judge_result = '合格'").get(batch.supplier).cnt
    supplierHistoryRate = total > 0 ? Math.round(pass / total * 100) : 100
  }

  // 获取原料固有风险
  let materialRisk = '中'
  if (material_id) {
    const mat = db.prepare('SELECT risk_level FROM raw_materials WHERE id = ?').get(material_id)
    if (mat) materialRisk = mat.risk_level
  }

  // 计算风险得分
  const riskLevelScore = { 高: 25, 中: 15, 低: 5 }[materialRisk] || 15
  const supplierScore = Math.round(supplierHistoryRate * 0.3)
  const certScore2 = (cert_score || 100) * 0.2
  const tempScore = Math.max(0, 15 - (temp_deviation || 0) * 3)
  const sensoryScore = Math.max(0, 10 - (sensory_abnormal || 0) * 10)
  const totalScore = Math.round(supplierScore + certScore2 + tempScore + sensoryScore + riskLevelScore)

  const riskLevel = totalScore >= 80 ? '低' : totalScore >= 60 ? '中' : '高'
  const suggestion = riskLevel === '低' ? '各项指标良好，建议接收' :
    riskLevel === '中' ? '存在一定风险，建议限期使用或让步接收' :
    '风险较高，建议拒收或严格审批后让步接收'

  // AI 增强（有 AI_KEY 时调用）
  let aiSuggestion = ''
  const aiKey = process.env.AI_API_KEY
  if (aiKey) {
    try {
      const response = await fetch((process.env.AI_BASE_URL || 'https://api.deepseek.com') + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + aiKey },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是食品原料验收风险评估专家。根据提供的数据给出风险评估建议（100字以内）。' },
            { role: 'user', content: `供应商历史合格率:${supplierHistoryRate}%，原料风险等级:${materialRisk}，证件得分:${cert_score || 100}，温度偏差:${temp_deviation || 0}°C，感官异常项:${sensory_abnormal || 0}。风险总分:${totalScore}/100。请给出建议。` }
          ],
          max_tokens: 300, temperature: 0.3
        })
      })
      const data = await response.json()
      aiSuggestion = data.choices?.[0]?.message?.content || ''
    } catch { aiSuggestion = suggestion }
  } else {
    aiSuggestion = suggestion
  }

  // 保存风险评估
  const existingRisk = db.prepare('SELECT * FROM raw_material_ai_risk WHERE batch_id = ?').get(batch_id)
  if (existingRisk) {
    db.prepare(
      'UPDATE raw_material_ai_risk SET risk_level=?, risk_score=?, risk_prompt=?, ai_suggestion=?, supplier_history_rate=?, dimension_scores=? WHERE batch_id=?'
    ).run(riskLevel, totalScore, '', aiSuggestion, supplierHistoryRate, JSON.stringify({ supplierHistoryRate, materialRisk: riskLevelScore, certScore: certScore2, tempScore, sensoryScore }), batch_id)
  } else {
    db.prepare(
      'INSERT INTO raw_material_ai_risk (user_id, batch_id, risk_level, risk_score, risk_prompt, ai_suggestion, supplier_history_rate, dimension_scores) VALUES (?,?,?,?,?,?,?)'
    ).run(user_id, batch_id, riskLevel, totalScore, '', aiSuggestion, supplierHistoryRate, JSON.stringify({ supplierHistoryRate, materialRisk: riskLevelScore, certScore: certScore2, tempScore, sensoryScore }))
  }

  res.json({ risk_level: riskLevel, risk_score: totalScore, ai_suggestion: aiSuggestion, supplier_history_rate: supplierHistoryRate, dimension_scores: { supplierHistoryRate, materialRisk: riskLevelScore, certScore: certScore2, tempScore, sensoryScore } })
})

app.get('/api/raw-material/rejections', (req, res) => {
  const { user_id } = req.query
  const list = db.prepare(`
    SELECT r.*, b.batch_number, b.material_name, b.supplier
    FROM raw_material_rejections r
    LEFT JOIN raw_material_batches b ON r.batch_id = b.id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(user_id)
  res.json({ list })
})

app.get('/api/raw-material/concessions', (req, res) => {
  const { user_id } = req.query
  const list = db.prepare(`
    SELECT c.*, b.batch_number, b.material_name, b.supplier
    FROM raw_material_concessions c
    LEFT JOIN raw_material_batches b ON c.batch_id = b.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `).all(user_id)
  res.json({ list })
})

app.post('/api/raw-material/concessions', (req, res) => {
  const { user_id, batch_id, concession_reason, usage_limit, approver, usage_deadline } = req.body
  if (!batch_id) return res.status(400).json({ message: '缺少批次信息' })
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM raw_material_concessions WHERE user_id = ?').get(user_id).cnt
  const concession_number = 'RB-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(count + 1).padStart(3, '0')
  db.prepare(
    'INSERT INTO raw_material_concessions (user_id, concession_number, batch_id, concession_reason, usage_limit, approver, approve_time, usage_deadline) VALUES (?,?,?,?,?,?,?,?)'
  ).run(user_id, concession_number, batch_id, concession_reason || '', usage_limit || '', approver || '', new Date().toISOString(), usage_deadline || '')
  res.json({ message: '让步接收记录已创建' })
})

// ---- 产品标准 ----

app.get('/api/product-standards', (req, res) => {
  const { user_id, keyword, standard_type, status } = req.query
  let sql = 'SELECT * FROM product_standards WHERE user_id = ?'
  const params = [user_id]
  if (standard_type) { sql += ' AND standard_type = ?'; params.push(standard_type) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (keyword) { sql += ' AND (standard_name LIKE ? OR standard_number LIKE ? OR standard_code LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%', '%'+keyword+'%') }
  sql += ' ORDER BY created_at DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.post('/api/product-standards', (req, res) => {
  const { user_id, standard_name, standard_type, standard_code, applicable_products, issued_date, effective_date, expiry_date } = req.body
  if (!standard_name) return res.status(400).json({ message: '请填写标准名称' })
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM product_standards WHERE user_id = ?').get(user_id).cnt
  const standard_number = 'PS-' + String(count + 1).padStart(3, '0')
  db.prepare(
    'INSERT INTO product_standards (user_id, standard_number, standard_name, standard_type, standard_code, applicable_products, issued_date, effective_date, expiry_date) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(user_id, standard_number, standard_name, standard_type || '企标', standard_code || '', applicable_products || '', issued_date || '', effective_date || '', expiry_date || '')
  res.json({ message: '产品标准添加成功' })
})

app.put('/api/product-standards/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM product_standards WHERE id = ? AND user_id = ?').get(id, req.body.user_id)
  if (!existing) return res.status(404).json({ message: '标准不存在' })
  const { standard_name, standard_type, standard_code, applicable_products, issued_date, effective_date, expiry_date, status } = req.body
  db.prepare(
    'UPDATE product_standards SET standard_name=?, standard_type=?, standard_code=?, applicable_products=?, issued_date=?, effective_date=?, expiry_date=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(standard_name || existing.standard_name, standard_type || existing.standard_type, standard_code || existing.standard_code, applicable_products || existing.applicable_products, issued_date || existing.issued_date, effective_date || existing.effective_date, expiry_date || existing.expiry_date, status || existing.status, id)
  res.json({ message: '标准更新成功' })
})

app.delete('/api/product-standards/:id', (req, res) => {
  db.prepare('DELETE FROM product_standard_indicators WHERE standard_id = ?').run(req.params.id)
  db.prepare('DELETE FROM product_standards WHERE id = ? AND user_id = ?').run(req.params.id, req.body.user_id)
  res.json({ message: '标准已删除' })
})

app.get('/api/product-standards/:id/indicators', (req, res) => {
  const list = db.prepare('SELECT * FROM product_standard_indicators WHERE standard_id = ? ORDER BY indicator_category, id').all(req.params.id)
  res.json({ list })
})

app.post('/api/product-standards/:id/indicators', (req, res) => {
  const { user_id, indicator_category, indicator_name, requirement, test_method, internal_control } = req.body
  if (!indicator_name) return res.status(400).json({ message: '请填写指标名称' })
  db.prepare(
    'INSERT INTO product_standard_indicators (user_id, standard_id, indicator_category, indicator_name, requirement, test_method, internal_control) VALUES (?,?,?,?,?,?,?)'
  ).run(user_id, req.params.id, indicator_category || '感官', indicator_name, requirement || '', test_method || '', internal_control || '')
  res.json({ message: '指标添加成功' })
})

app.put('/api/product-standards/indicators/:id', (req, res) => {
  const { id } = req.params
  const { indicator_category, indicator_name, requirement, test_method, internal_control } = req.body
  const existing = db.prepare('SELECT * FROM product_standard_indicators WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ message: '指标不存在' })
  db.prepare(
    'UPDATE product_standard_indicators SET indicator_category=?, indicator_name=?, requirement=?, test_method=?, internal_control=? WHERE id=?'
  ).run(indicator_category || existing.indicator_category, indicator_name || existing.indicator_name, requirement || existing.requirement, test_method || existing.test_method, internal_control || existing.internal_control, id)
  res.json({ message: '指标更新成功' })
})

app.delete('/api/product-standards/indicators/:id', (req, res) => {
  db.prepare('DELETE FROM product_standard_indicators WHERE id = ?').run(req.params.id)
  res.json({ message: '指标已删除' })
})

// ---- 检验项目 ----

app.get('/api/test-items', (req, res) => {
  const { user_id, keyword, method_status } = req.query
  let sql = 'SELECT * FROM test_items WHERE user_id = ?'
  const params = [user_id]
  if (method_status) { sql += ' AND method_status = ?'; params.push(method_status) }
  if (keyword) { sql += ' AND (item_name LIKE ? OR item_number LIKE ? OR test_method LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%', '%'+keyword+'%') }
  sql += ' ORDER BY item_number'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.post('/api/test-items', (req, res) => {
  const { user_id, item_name, test_method, method_name, detection_limit, applicable_scope, equipment } = req.body
  if (!item_name) return res.status(400).json({ message: '请填写检验项目' })
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM test_items WHERE user_id = ?').get(user_id).cnt
  const item_number = 'TI-' + String(count + 1).padStart(3, '0')
  db.prepare(
    'INSERT INTO test_items (user_id, item_number, item_name, test_method, method_name, detection_limit, applicable_scope, equipment) VALUES (?,?,?,?,?,?,?,?)'
  ).run(user_id, item_number, item_name, test_method || '', method_name || '', detection_limit || '', applicable_scope || '', equipment || '')
  res.json({ message: '检验项目添加成功' })
})

app.put('/api/test-items/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM test_items WHERE id = ? AND user_id = ?').get(id, req.body.user_id)
  if (!existing) return res.status(404).json({ message: '项目不存在' })
  const { item_name, test_method, method_name, detection_limit, applicable_scope, equipment, method_status, replacement_method } = req.body
  db.prepare(
    'UPDATE test_items SET item_name=?, test_method=?, method_name=?, detection_limit=?, applicable_scope=?, equipment=?, method_status=?, replacement_method=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(item_name || existing.item_name, test_method || existing.test_method, method_name || existing.method_name, detection_limit || existing.detection_limit, applicable_scope || existing.applicable_scope, equipment || existing.equipment, method_status || existing.method_status, replacement_method || existing.replacement_method, id)
  res.json({ message: '项目更新成功' })
})

app.delete('/api/test-items/:id', (req, res) => {
  db.prepare('DELETE FROM test_items WHERE id = ? AND user_id = ?').run(req.params.id, req.body.user_id)
  res.json({ message: '项目已删除' })
})

// ---- 留样管理 ----

app.get('/api/samples', (req, res) => {
  const { user_id, keyword, sample_type, status } = req.query
  let sql = 'SELECT * FROM samples WHERE user_id = ?'
  const params = [user_id]
  if (sample_type) { sql += ' AND sample_type = ?'; params.push(sample_type) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (keyword) { sql += ' AND (sample_number LIKE ? OR material_product_name LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%') }
  sql += ' ORDER BY expiry_date ASC'
  const list = db.prepare(sql).all(...params)
  // 动态更新状态
  const today = new Date().toISOString().slice(0, 10)
  list.forEach(s => {
    if (s.status === '留样中' && s.expiry_date && s.expiry_date < today) {
      s.status = '已到期'
    }
  })
  res.json({ list })
})

app.get('/api/samples/stats', (req, res) => {
  const { user_id } = req.query
  const total = db.prepare('SELECT COUNT(*) AS cnt FROM samples WHERE user_id = ?').get(user_id).cnt
  const keeping = db.prepare("SELECT COUNT(*) AS cnt FROM samples WHERE user_id = ? AND status = '留样中'").get(user_id).cnt
  const expired = db.prepare("SELECT COUNT(*) AS cnt FROM samples WHERE user_id = ? AND status IN ('已到期','已处置')").get(user_id).cnt
  const today = new Date()
  const deadline = new Date(today)
  deadline.setDate(deadline.getDate() + 7)
  const soonExpire = db.prepare(
    "SELECT COUNT(*) AS cnt FROM samples WHERE user_id = ? AND status = '留样中' AND expiry_date <= ?"
  ).get(user_id, deadline.toISOString().slice(0, 10)).cnt
  res.json({ total, keeping, expired, soonExpire })
})

app.post('/api/samples', (req, res) => {
  const { user_id, sample_type, related_batch, material_product_name, sample_quantity, sample_date, storage_location, storage_condition, retention_days, sampler } = req.body
  if (!material_product_name) return res.status(400).json({ message: '请填写原料/产品名称' })
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const count = db.prepare("SELECT COUNT(*) AS cnt FROM samples WHERE user_id = ? AND sample_number LIKE 'SY-' || ? || '%'").get(user_id, today).cnt
  const sample_number = 'SY-' + today + '-' + String(count + 1).padStart(3, '0')
  const sampleDate = sample_date || new Date().toISOString().slice(0, 10)
  const retention = retention_days || 180
  const expiry = new Date(sampleDate)
  expiry.setDate(expiry.getDate() + retention)
  const expiry_date = expiry.toISOString().slice(0, 10)
  db.prepare(
    'INSERT INTO samples (user_id, sample_number, sample_type, related_batch, material_product_name, sample_quantity, sample_date, storage_location, storage_condition, retention_days, expiry_date, sampler) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(user_id, sample_number, sample_type || '原料留样', related_batch || '', material_product_name, sample_quantity || '', sampleDate, storage_location || '', storage_condition || '', retention, expiry_date, sampler || '')
  res.json({ message: '留样添加成功' })
})

app.put('/api/samples/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM samples WHERE id = ? AND user_id = ?').get(id, req.body.user_id)
  if (!existing) return res.status(404).json({ message: '留样不存在' })
  const { status } = req.body
  db.prepare('UPDATE samples SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status || existing.status, id)
  res.json({ message: '留样状态更新成功' })
})

app.post('/api/samples/:id/dispose', (req, res) => {
  const { id } = req.params
  const { user_id, disposal_method, disposer, remark } = req.body
  const sample = db.prepare('SELECT * FROM samples WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!sample) return res.status(404).json({ message: '留样不存在' })
  db.prepare('INSERT INTO sample_disposal (user_id, sample_id, disposal_method, disposer, disposal_date, remark) VALUES (?,?,?,?,?,?)').run(user_id, id, disposal_method || '销毁', disposer || '', new Date().toISOString().slice(0, 10), remark || '')
  db.prepare("UPDATE samples SET status = '已处置', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id)
  res.json({ message: '留样处置成功' })
})

// ---- 批次追溯 ----

app.post('/api/traceability/forward', (req, res) => {
  const { user_id, batch_number } = req.body
  if (!batch_number) return res.status(400).json({ message: '请输入原料批次号' })
  // 查找原料批次
  const batch = db.prepare('SELECT * FROM raw_material_batches WHERE batch_number = ? AND user_id = ?').get(batch_number, user_id)
  if (!batch) return res.status(404).json({ message: '未找到该原料批次' })
  // 构建正向追溯链
  const traceChain = {
    raw_material_batch: batch,
    inspection: db.prepare('SELECT * FROM raw_material_inspection WHERE batch_id = ?').get(batch.id),
    ai_risk: db.prepare('SELECT * FROM raw_material_ai_risk WHERE batch_id = ?').get(batch.id)
  }
  // 保存追溯记录
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM batch_traceability WHERE user_id = ?').get(user_id).cnt
  const trace_number = 'TR-' + String(count + 1).padStart(4, '0')
  db.prepare(
    'INSERT INTO batch_traceability (user_id, trace_number, trace_type, input_batch, trace_chain) VALUES (?,?,?,?,?)'
  ).run(user_id, trace_number, '正向追溯', batch_number, JSON.stringify(traceChain))
  res.json({ trace_number, trace_type: '正向追溯', trace_chain: traceChain })
})

app.post('/api/traceability/backward', (req, res) => {
  const { user_id, batch_number } = req.body
  if (!batch_number) return res.status(400).json({ message: '请输入成品批次号' })
  // 这里假设成品批次也以 FG- 开头，关联到原料批次
  const traceChain = {
    finished_goods_batch: batch_number,
    message: '逆向追溯功能需要与生产批次系统对接，当前为占位实现'
  }
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM batch_traceability WHERE user_id = ?').get(user_id).cnt
  const trace_number = 'TR-' + String(count + 1).padStart(4, '0')
  db.prepare(
    'INSERT INTO batch_traceability (user_id, trace_number, trace_type, input_batch, trace_chain) VALUES (?,?,?,?,?)'
  ).run(user_id, trace_number, '逆向追溯', batch_number, JSON.stringify(traceChain))
  res.json({ trace_number, trace_type: '逆向追溯', trace_chain: traceChain })
})

// ---- 不合格品管理 ----

app.get('/api/non-conforming', (req, res) => {
  const { user_id, keyword, source_type, severity, status } = req.query
  let sql = 'SELECT * FROM non_conforming WHERE user_id = ?'
  const params = [user_id]
  if (source_type) { sql += ' AND source_type = ?'; params.push(source_type) }
  if (severity) { sql += ' AND severity = ?'; params.push(severity) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (keyword) { sql += ' AND (nc_number LIKE ? OR nc_description LIKE ? OR related_batch LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%', '%'+keyword+'%') }
  sql += ' ORDER BY created_at DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.post('/api/non-conforming', (req, res) => {
  const { user_id, source_type, related_batch, nc_description, severity } = req.body
  if (!nc_description) return res.status(400).json({ message: '请填写不合格描述' })
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const count = db.prepare("SELECT COUNT(*) AS cnt FROM non_conforming WHERE user_id = ? AND nc_number LIKE 'NC-' || ? || '%'").get(user_id, today).cnt
  const nc_number = 'NC-' + today + '-' + String(count + 1).padStart(3, '0')
  db.prepare(
    'INSERT INTO non_conforming (user_id, nc_number, source_type, related_batch, nc_description, severity) VALUES (?,?,?,?,?,?)'
  ).run(user_id, nc_number, source_type || '原料验收', related_batch || '', nc_description, severity || '一般')
  res.json({ message: '不合格品记录已创建' })
})

app.put('/api/non-conforming/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM non_conforming WHERE id = ? AND user_id = ?').get(id, req.body.user_id)
  if (!existing) return res.status(404).json({ message: '记录不存在' })
  const { source_type, nc_description, severity, status } = req.body
  db.prepare(
    'UPDATE non_conforming SET source_type=?, nc_description=?, severity=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(source_type || existing.source_type, nc_description || existing.nc_description, severity || existing.severity, status || existing.status, id)
  res.json({ message: '更新成功' })
})

app.post('/api/non-conforming/:id/action', (req, res) => {
  const { id } = req.params
  const { user_id, action_type, handler, verify_result } = req.body
  const nc = db.prepare('SELECT * FROM non_conforming WHERE id = ? AND user_id = ?').get(id, user_id)
  if (!nc) return res.status(404).json({ message: '记录不存在' })
  db.prepare(
    'INSERT INTO non_conforming_actions (user_id, nc_id, action_type, handler, action_date, verify_result) VALUES (?,?,?,?,?,?)'
  ).run(user_id, id, action_type || '返工', handler || '', new Date().toISOString().slice(0, 10), verify_result || '')
  db.prepare("UPDATE non_conforming SET status = '已验证', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id)
  res.json({ message: '处置措施已记录' })
})

// 删除不合格品记录
app.delete('/api/non-conforming/:id', (req, res) => {
  const { id } = req.params
  const nc = db.prepare('SELECT * FROM non_conforming WHERE id = ? AND user_id = ?').get(id, req.body.user_id)
  if (!nc) return res.status(404).json({ message: '记录不存在' })
  db.prepare('DELETE FROM non_conforming_actions WHERE nc_id = ?').run(id)
  db.prepare('DELETE FROM non_conforming WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

// ---- 标准变更管理 ----

app.get('/api/standard-changes', (req, res) => {
  const { user_id, keyword, change_type, status } = req.query
  let sql = 'SELECT * FROM standard_changes WHERE user_id = ?'
  const params = [user_id]
  if (change_type) { sql += ' AND change_type = ?'; params.push(change_type) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (keyword) { sql += ' AND (change_number LIKE ? OR change_content LIKE ?)'; params.push('%'+keyword+'%', '%'+keyword+'%') }
  sql += ' ORDER BY created_at DESC'
  const list = db.prepare(sql).all(...params)
  res.json({ list })
})

app.post('/api/standard-changes', (req, res) => {
  const { user_id, standard_id, change_type, change_content, impact_assessment } = req.body
  if (!change_content) return res.status(400).json({ message: '请填写变更内容' })
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM standard_changes WHERE user_id = ?').get(user_id).cnt
  const change_number = 'SC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(count + 1).padStart(3, '0')
  db.prepare(
    'INSERT INTO standard_changes (user_id, change_number, standard_id, change_type, change_content, impact_assessment) VALUES (?,?,?,?,?,?)'
  ).run(user_id, change_number, standard_id || null, change_type || '新增', change_content, impact_assessment || '')
  res.json({ message: '变更已发起' })
})

app.put('/api/standard-changes/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM standard_changes WHERE id = ? AND user_id = ?').get(id, req.body.user_id)
  if (!existing) return res.status(404).json({ message: '变更不存在' })
  const { change_type, change_content, impact_assessment, approver, publish_date, status } = req.body
  db.prepare(
    'UPDATE standard_changes SET change_type=?, change_content=?, impact_assessment=?, approver=?, publish_date=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(change_type || existing.change_type, change_content || existing.change_content, impact_assessment || existing.impact_assessment, approver || existing.approver, publish_date || existing.publish_date, status || existing.status, id)
  res.json({ message: '变更更新成功' })
})

// 删除标准变更
app.delete('/api/standard-changes/:id', (req, res) => {
  const { id } = req.params
  const sc = db.prepare('SELECT * FROM standard_changes WHERE id = ? AND user_id = ?').get(id, req.body.user_id)
  if (!sc) return res.status(404).json({ message: '变更不存在' })
  db.prepare('DELETE FROM standard_changes WHERE id = ?').run(id)
  res.json({ message: '已删除' })
})

// ---- 供应商质量评估 ----

app.get('/api/supplier-quality', (req, res) => {
  const { user_id } = req.query
  // 从验收数据聚合供应商质量评估
  const suppliers = db.prepare(
    "SELECT DISTINCT supplier FROM raw_material_batches WHERE user_id = ? AND supplier != ''"
  ).all(user_id)

  const list = suppliers.map(s => {
    const total = db.prepare("SELECT COUNT(*) AS cnt FROM raw_material_batches WHERE supplier = ? AND judge_result != ''").get(s.supplier).cnt
    const pass = db.prepare("SELECT COUNT(*) AS cnt FROM raw_material_batches WHERE supplier = ? AND judge_result = '合格'").get(s.supplier).cnt
    const reject = db.prepare("SELECT COUNT(*) AS cnt FROM raw_material_batches WHERE supplier = ? AND judge_result = '拒收'").get(s.supplier).cnt
    const concession = db.prepare("SELECT COUNT(*) AS cnt FROM raw_material_batches WHERE supplier = ? AND judge_result = '让步接收'").get(s.supplier).cnt
    const acceptRate = total > 0 ? Math.round(pass / total * 100) : 0
    const score = Math.round(acceptRate * 0.4 + Math.max(0, 100 - reject * 10) * 0.2 + Math.max(0, 100 - concession * 5) * 0.15 + 100 * 0.25)
    const level = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D'
    return { supplier: s.supplier, total, pass, reject, concession, acceptRate, score, level, suggest: level === 'A' ? '优先采购' : level === 'B' ? '正常合作' : level === 'C' ? '限期整改' : '暂停采购' }
  }).sort((a, b) => b.score - a.score)

  res.json({ list })
})

app.get('/api/supplier-quality/:supplier/detail', (req, res) => {
  const { supplier } = req.params
  const { user_id } = req.query
  const batches = db.prepare(
    "SELECT * FROM raw_material_batches WHERE user_id = ? AND supplier = ? AND judge_result != '' ORDER BY created_at DESC LIMIT 20"
  ).all(user_id, supplier)

  const total = batches.length
  const pass = batches.filter(b => b.judge_result === '合格').length
  const reject = batches.filter(b => b.judge_result === '拒收').length
  const concession = batches.filter(b => b.judge_result === '让步接收').length
  const acceptRate = total > 0 ? Math.round(pass / total * 100) : 0
  const score = Math.round(acceptRate * 0.4 + Math.max(0, 100 - reject * 10) * 0.2 + Math.max(0, 100 - concession * 5) * 0.15 + 100 * 0.25)
  const level = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D'

  res.json({ supplier, total, pass, reject, concession, acceptRate, score, level, recent_batches: batches })
})

// ---------- 定时任务 ----------

// 每天早上 9:00 执行临期证照检查（第二个参数：分钟 小时 日 月 星期）
cron.schedule('0 9 * * *', () => {
  checkAndNotify()
})

console.log('⏰ 定时任务已注册：每天 09:00 检查证照到期情况')

// 生产环境：托管前端打包文件 + SPA fallback
if (isProduction) {
  const clientDist = path.join(__dirname, '..', 'client', 'dist')
  app.use(express.static(clientDist))
  // Vue Router history 模式：非 API/非静态文件请求返回 index.html
  app.get('/{*path}', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientDist, 'index.html'))
    }
  })
  console.log('📦 生产模式：已托管前端静态文件')
}

// 生产环境错误处理：隐藏详细堆栈信息
app.use((err, req, res, next) => {
  console.error('❌ 服务器错误:', err.message)
  res.status(500).json({
    message: isProduction ? '服务器内部错误' : err.message
  })
})

// ---------- 启动服务器 ----------
app.listen(PORT, () => {
  console.log(`✅ AI 食安后端已启动: http://localhost:${PORT}`)
  // 开发环境启动时执行一次检查，方便测试
  if (!isProduction) checkAndNotify()
})
