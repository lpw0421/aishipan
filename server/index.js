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
const { aiAudit } = require('./utils/ai')
const { generateReport } = require('./utils/report')

const app = express()
const PORT = process.env.PORT || 3001
const isProduction = process.env.NODE_ENV === 'production'

// ---------- 中间件 ----------
app.use(cors())
app.use(express.json())

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

  const rows = [...certRows, ...healthRows]
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
    const typeLabel = row.type === 'certificate' ? '资质' : '健康证'
    const companyLabel = row.company_name ? ` [${row.company_name}]` : ''
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

  // 合并并按到期时间升序排列
  const warnings = [...warnCerts, ...warnHealths]
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
    .map(item => ({
      ...item,
      daysLeft: Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
    }))

  res.json({
    certificates: certStats,
    healthCerts: healthStats,
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

// ---------- 定时任务 ----------

// 每天早上 9:00 执行临期证照检查（第二个参数：分钟 小时 日 月 星期）
cron.schedule('0 9 * * *', () => {
  checkAndNotify()
})

console.log('⏰ 定时任务已注册：每天 09:00 检查证照到期情况')

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
