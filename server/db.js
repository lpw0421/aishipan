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
`)

console.log('✅ 数据库已就绪（users + certificates + health_certs + labels + audit_rules + indexes + 迁移）')

module.exports = db
