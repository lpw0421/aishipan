const path = require('path')
const Database = require('better-sqlite3')

// 创建/连接 SQLite 数据库文件
const dbPath = path.join(__dirname, 'data.db')
const db = new Database(dbPath)

// 开启 WAL 模式，提升并发读写性能
db.pragma('journal_mode = WAL')

// ---------- 初始化表 ----------

// 创建 users 表：存储用户账号信息
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// 创建 certificates 表：存储证照信息
db.exec(`
  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    file_path TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'own',
    company_name TEXT NOT NULL DEFAULT '',
    product_name TEXT DEFAULT '',
    file_paths TEXT DEFAULT '[]',
    status TEXT DEFAULT 'valid',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 迁移：为已有 certificates 表补充新列
try { db.exec('ALTER TABLE certificates ADD COLUMN category TEXT NOT NULL DEFAULT \'own\'') } catch {}
try { db.exec('ALTER TABLE certificates ADD COLUMN company_name TEXT NOT NULL DEFAULT \'\'') } catch {}
try { db.exec('ALTER TABLE certificates ADD COLUMN product_name TEXT DEFAULT \'\'') } catch {}
try { db.exec('ALTER TABLE certificates ADD COLUMN file_paths TEXT DEFAULT \'[]\'') } catch {}
try { db.exec('ALTER TABLE certificates ADD COLUMN updated_at DATETIME') } catch {}

// 迁移：旧 file_path 非空且 file_paths 为空时，转为 JSON 数组
try {
  db.exec(`UPDATE certificates SET file_paths = json_array(file_path) WHERE file_path != '' AND file_paths = '[]'`)
} catch {}

// 迁移：统一 own_basic / own_product 为 'own'（简化分类）
try {
  db.exec(`UPDATE certificates SET category = 'own' WHERE category IN ('own_basic', 'own_product')`)
} catch {}

// 迁移：is_permanent 字段（长期有效）
try { db.exec('ALTER TABLE certificates ADD COLUMN is_permanent INTEGER DEFAULT 0') } catch {}

// 迁移：健康证加 department 字段
try { db.exec('ALTER TABLE health_certs ADD COLUMN department TEXT DEFAULT \'\'') } catch {}

// 创建 health_certs 表：存储员工健康证信息
db.exec(`
  CREATE TABLE IF NOT EXISTS health_certs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    employee_name TEXT NOT NULL,
    id_number TEXT DEFAULT '',
    issue_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    file_path TEXT DEFAULT '',
    status TEXT DEFAULT 'valid',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 创建 labels 表：存储标签审核数据
db.exec(`
  CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL,
    file_url TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 为已有 labels 表补充 version 列（迁移旧数据）
try { db.exec('ALTER TABLE labels ADD COLUMN version INTEGER DEFAULT 1') } catch {}

// 创建 regulations 表：存储法规库数据
db.exec(`
  CREATE TABLE IF NOT EXISTS regulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    full_title TEXT NOT NULL,
    category TEXT NOT NULL,
    number TEXT DEFAULT '',
    effective_date TEXT DEFAULT '',
    repeal_date TEXT DEFAULT '',
    content TEXT DEFAULT '',
    url TEXT DEFAULT '',
    file_path TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// 迁移：补充 file_path 列
try { db.exec('ALTER TABLE regulations ADD COLUMN file_path TEXT DEFAULT \'\'') } catch {}

// 初始化法规数据
const regCount = db.prepare('SELECT COUNT(*) AS cnt FROM regulations').get().cnt
if (regCount === 0) {
  const stmt = db.prepare(
    'INSERT INTO regulations (title, full_title, category, number, effective_date, repeal_date, content, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const regs = [
    ['食品安全法', '中华人民共和国食品安全法', 'law', '', '2022-09-01', '',
     '确立食品安全风险监测和评估、食品安全标准、食品生产经营、食品检验、食品进出口、食品安全事故处置、监督管理等基本制度，是食品行业的基本法律。',
     ''],
    ['农产品质量安全法', '中华人民共和国农产品质量安全法', 'law', '', '2023-01-01', '',
     '规范农产品质量安全管理，建立农产品产地安全监测、生产过程记录、包装标识、监督检查等制度，保障农产品从田间到餐桌的质量安全。',
     ''],
    ['产品质量法', '中华人民共和国产品质量法', 'law', '', '2000-09-01', '',
     '明确生产者、销售者的产品质量责任和义务，规定产品标识必须真实、清晰，不得伪造产地、冒用他人厂名厂址、伪造或冒用认证标志。',
     ''],
    ['消费者权益保护法', '中华人民共和国消费者权益保护法', 'law', '', '2014-03-15', '',
     '保障消费者的知情权、安全权、选择权等基本权利，对虚假宣传、欺诈行为作出惩罚性赔偿规定，食品标签误导可依据本法索赔。',
     ''],
    ['GB 7718', 'GB 7718-2025 预包装食品标签通则', 'standard', 'GB 7718-2025', '2025-01-01', '',
     '规定预包装食品标签的基本要求：食品名称、配料表、净含量、生产者名称地址、生产日期和保质期、贮存条件、SC编号、产品标准代号等。',
     ''],
    ['GB 28050', 'GB 28050-2025 预包装食品营养标签通则', 'standard', 'GB 28050-2025', '2025-01-01', '',
     '规定预包装食品营养标签的营养成分表、营养声称和功能声称要求，强制标示能量、核心营养素含量值及NRV百分比。',
     ''],
    ['GB 14881', 'GB 14881-2013 食品生产通用卫生规范', 'standard', 'GB 14881-2013', '2014-06-01', '',
     '规定食品生产过程中原料采购、加工、包装、贮存和运输等环节的场所、设施、人员的基本卫生要求和管理准则。',
     ''],
    ['GB 2760', 'GB 2760-2024 食品添加剂使用标准', 'standard', 'GB 2760-2024', '2025-02-08', '',
     '规定食品添加剂的使用原则、允许使用的添加剂品种、使用范围及最大使用量或残留量，是食品添加剂使用的核心依据。',
     ''],
    ['GB 2762', 'GB 2762-2022 食品中污染物限量', 'standard', 'GB 2762-2022', '2023-06-30', '',
     '规定食品中铅、镉、汞、砷、锡、镍、铬等重金属及亚硝酸盐、苯并[a]芘等污染物限量指标，是食品安全风险控制的核心标准。',
     ''],
    ['GB 2761', 'GB 2761-2023 食品中真菌毒素限量', 'standard', 'GB 2761-2023', '2024-06-30', '',
     '规定食品中黄曲霉毒素B1、M1、脱氧雪腐镰刀菌烯醇（呕吐毒素）、展青霉素等真菌毒素的限量标准。',
     ''],
    ['餐饮操作规范', '餐饮服务食品安全操作规范', 'industry', '', '2018-10-01', '',
     '规范餐饮服务经营者的食品安全操作行为，涵盖场所布局、原料管理、加工制作、清洗消毒、食品留样、有害生物防治等各环节。',
     ''],
    ['食品生产许可管理办法', '食品生产许可管理办法', 'industry', '', '2020-03-01', '',
     '规定食品生产许可证（SC）的申请、受理、审查、决定及监督管理，明确SC编号为食品生产者的唯一标识，须标示于食品标签。',
     ''],
    ['食品经营许可管理办法', '食品经营许可管理办法', 'industry', '', '2015-10-01', '',
     '规范食品经营许可的申请、审核与发放，涵盖食品销售与餐饮服务两大类，是食品经营者合法经营的基础要求。',
     ''],
    ['食品召回管理办法', '食品召回管理办法', 'industry', '', '2015-09-01', '',
     '规定食品生产者发现食品安全问题后应主动召回，根据风险等级分为一级、二级、三级召回，明确召回时限、处置方式及信息报告要求。',
     '']
  ]
  const insertMany = db.transaction(() => {
    regs.forEach(r => stmt.run(...r))
  })
  insertMany()
  console.log('📋 法规库已初始化（14条）')
}

// 法规链接需用户自行补充验证后填入，此处不做预设

// 创建 notifications 表：存储系统通知
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    type TEXT DEFAULT 'warning',
    source_type TEXT DEFAULT '',
    source_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 创建 audit_rules 表：存储 GB 7718 审核规则
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_code TEXT NOT NULL UNIQUE,
    rule_name TEXT NOT NULL,
    rule_desc TEXT NOT NULL,
    check_type TEXT DEFAULT 'keyword'
  )
`)

// 初始化 GB 7718 核心规则（仅当表中无数据时写入）
const ruleCount = db.prepare('SELECT COUNT(*) AS cnt FROM audit_rules').get().cnt
if (ruleCount === 0) {
  const stmt = db.prepare('INSERT INTO audit_rules (rule_code, rule_name, rule_desc, check_type) VALUES (?, ?, ?, ?)')
  const rules = [
    ['R01', '食品名称', '必须标示反映食品真实属性的专用名称', 'keyword'],
    ['R02', '配料表', '必须以"配料"或"配料表"为引导词，按加入量递减顺序排列', 'keyword'],
    ['R03', '净含量和规格', '必须标示净含量，液态用体积、固态用质量、半固态用质量或体积', 'keyword'],
    ['R04', '生产者名称', '必须标示依法登记注册、能够承担食品安全责任的生产者名称', 'keyword'],
    ['R05', '生产日期和保质期', '必须标示生产日期和保质期，日期按年月日顺序排列', 'keyword'],
    ['R06', '贮存条件', '必须标示贮存条件，如温度、湿度等要求', 'keyword'],
    ['R07', '食品生产许可证编号', '必须标示SC食品生产许可证编号', 'keyword']
  ]
  const insertMany = db.transaction(() => {
    rules.forEach(r => stmt.run(...r))
  })
  insertMany()
  console.log('📋 GB 7718 审核规则已初始化（7条）')
}

// 创建 audit_results 表：存储每次审核的结果明细
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label_id INTEGER NOT NULL,
    rule_code TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    passed INTEGER NOT NULL DEFAULT 0,
    detail TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (label_id) REFERENCES labels(id)
  )
`)

// ---------- 性能索引 ----------
// 为高频查询字段创建索引，避免全表扫描
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);
  CREATE INDEX IF NOT EXISTS idx_health_certs_user_id ON health_certs(user_id);
  CREATE INDEX IF NOT EXISTS idx_labels_user_id ON labels(user_id);
  CREATE INDEX IF NOT EXISTS idx_labels_user_product ON labels(user_id, product_name);
  CREATE INDEX IF NOT EXISTS idx_audit_results_label_id ON audit_results(label_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
`)

console.log('✅ 数据库已就绪（users + certificates + health_certs + labels + audit_rules + indexes + 迁移）')

module.exports = db
