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

// 产品检测报告表
db.exec(`
  CREATE TABLE IF NOT EXISTS product_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    product_batch TEXT DEFAULT '',
    report_number TEXT DEFAULT '',
    report_type TEXT NOT NULL DEFAULT '微生物检测',
    agency_name TEXT DEFAULT '',
    test_date TEXT DEFAULT '',
    expiry_date TEXT NOT NULL,
    conclusion TEXT NOT NULL DEFAULT '合格',
    unqualified_items TEXT DEFAULT '',
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 体系文件表（统一管理手册/程序文件/SOP/记录表单/外部文件）
db.exec(`
  CREATE TABLE IF NOT EXISTS sys_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL DEFAULT 'procedure',
    doc_number TEXT DEFAULT '',
    doc_name TEXT NOT NULL,
    version TEXT DEFAULT 'V1.0',
    author TEXT DEFAULT '',
    reviewer TEXT DEFAULT '',
    approver TEXT DEFAULT '',
    effective_date TEXT DEFAULT '',
    review_date TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT '现行有效',
    category TEXT DEFAULT '',
    associated_doc TEXT DEFAULT '',
    applicable_dept TEXT DEFAULT '',
    retention_period TEXT DEFAULT '',
    content TEXT DEFAULT '',
    url TEXT DEFAULT '',
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 体系文件版本历史表
db.exec(`
  CREATE TABLE IF NOT EXISTS sys_doc_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id INTEGER NOT NULL,
    version TEXT NOT NULL,
    change_log TEXT DEFAULT '',
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doc_id) REFERENCES sys_docs(id)
  )
`)

// ===== 培训考核模块 =====
db.exec(`CREATE TABLE IF NOT EXISTS training_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  plan_number TEXT DEFAULT '', plan_name TEXT NOT NULL,
  training_type TEXT NOT NULL DEFAULT '在岗复训', planned_date TEXT DEFAULT '',
  trainer TEXT DEFAULT '', duration TEXT DEFAULT '',
  planned_attendees INTEGER DEFAULT 0, actual_attendees INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT '待执行', remark TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id))`)
db.exec(`CREATE TABLE IF NOT EXISTS training_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  course_number TEXT DEFAULT '', course_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '基础知识', duration TEXT DEFAULT '',
  exam_method TEXT NOT NULL DEFAULT '笔试', pass_score INTEGER DEFAULT 80,
  material TEXT DEFAULT '', file_paths TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id))`)
db.exec(`CREATE TABLE IF NOT EXISTS training_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  record_number TEXT DEFAULT '', plan_id INTEGER, course_id INTEGER,
  employee_name TEXT NOT NULL, department TEXT DEFAULT '',
  training_type TEXT DEFAULT '在岗复训', training_date TEXT DEFAULT '',
  trainer TEXT DEFAULT '', duration TEXT DEFAULT '',
  attendance TEXT NOT NULL DEFAULT '已签到',
  exam_score INTEGER, exam_result TEXT DEFAULT '',
  file_paths TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id))`)
db.exec(`CREATE TABLE IF NOT EXISTS training_exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  exam_number TEXT DEFAULT '', record_id INTEGER,
  employee_name TEXT NOT NULL, course_name TEXT DEFAULT '',
  exam_method TEXT NOT NULL DEFAULT '笔试', total_score INTEGER DEFAULT 100,
  score INTEGER DEFAULT 0, pass_score INTEGER DEFAULT 80,
  result TEXT NOT NULL DEFAULT '合格', retake_count INTEGER DEFAULT 0,
  retake_date TEXT DEFAULT '', retake_score INTEGER,
  remark TEXT DEFAULT '', file_paths TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id))`)
db.exec(`CREATE TABLE IF NOT EXISTS training_certs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  cert_number TEXT DEFAULT '', employee_name TEXT NOT NULL,
  cert_type TEXT NOT NULL DEFAULT '食品安全管理员', issuing_agency TEXT DEFAULT '',
  issue_date TEXT DEFAULT '', expiry_date TEXT DEFAULT '',
  status TEXT DEFAULT 'valid', file_paths TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id))`)

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

// ===== 虫害管理模块 =====

// 供应商资质文档（合同/证照/资质/保险合一，doc_type 区分）
db.exec(`
  CREATE TABLE IF NOT EXISTS pest_supplier_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL DEFAULT 'cert',
    company_name TEXT NOT NULL DEFAULT '',
    doc_name TEXT NOT NULL DEFAULT '',
    doc_number TEXT DEFAULT '',
    issue_date TEXT DEFAULT '',
    expiry_date TEXT DEFAULT '',
    coverage TEXT DEFAULT '',
    service_scope TEXT DEFAULT '',
    amount TEXT DEFAULT '',
    file_paths TEXT DEFAULT '[]',
    status TEXT DEFAULT 'valid',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 虫害服务人员基本信息
db.exec(`
  CREATE TABLE IF NOT EXISTS pest_staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    employee_number TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 人员证件（健康证+培训证合一，cert_type 区分）
db.exec(`
  CREATE TABLE IF NOT EXISTS pest_staff_certs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    cert_type TEXT NOT NULL DEFAULT 'health',
    cert_name TEXT NOT NULL DEFAULT '',
    issuing_agency TEXT DEFAULT '',
    cert_number TEXT DEFAULT '',
    issue_date TEXT DEFAULT '',
    expiry_date TEXT DEFAULT '',
    file_paths TEXT DEFAULT '[]',
    status TEXT DEFAULT 'valid',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 化学品清单
db.exec(`
  CREATE TABLE IF NOT EXISTS pest_chemicals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    cas_number TEXT DEFAULT '',
    formulation TEXT DEFAULT '',
    usage_area TEXT DEFAULT '',
    storage_location TEXT DEFAULT '',
    quantity TEXT DEFAULT '',
    supplier TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 化学品文档（MSDS/农药登记证/标签合一，doc_type 区分）
db.exec(`
  CREATE TABLE IF NOT EXISTS pest_chemical_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    chemical_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL DEFAULT 'msds',
    doc_name TEXT NOT NULL DEFAULT '',
    doc_number TEXT DEFAULT '',
    version TEXT DEFAULT '',
    issue_date TEXT DEFAULT '',
    expiry_date TEXT DEFAULT '',
    ghs_classification TEXT DEFAULT '',
    holder TEXT DEFAULT '',
    active_ingredient TEXT DEFAULT '',
    usage_scope TEXT DEFAULT '',
    is_compliant INTEGER DEFAULT -1,
    file_paths TEXT DEFAULT '[]',
    status TEXT DEFAULT 'valid',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 布防图
db.exec(`
  CREATE TABLE IF NOT EXISTS pest_layout_maps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    map_name TEXT NOT NULL DEFAULT '',
    version TEXT DEFAULT '',
    coverage_area TEXT DEFAULT '',
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 检查记录
db.exec(`
  CREATE TABLE IF NOT EXISTS pest_inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    inspection_date TEXT NOT NULL DEFAULT '',
    inspector TEXT DEFAULT '',
    area TEXT DEFAULT '',
    findings_type TEXT DEFAULT '',
    findings_count TEXT DEFAULT '',
    findings_location TEXT DEFAULT '',
    measures TEXT DEFAULT '',
    next_inspection_date TEXT DEFAULT '',
    status TEXT DEFAULT '正常',
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 月度报告
db.exec(`
  CREATE TABLE IF NOT EXISTS pest_monthly_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    report_month TEXT NOT NULL DEFAULT '',
    author TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    improvements TEXT DEFAULT '',
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 服务报告（客户签字）
db.exec(`
  CREATE TABLE IF NOT EXISTS pest_service_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    report_number TEXT NOT NULL DEFAULT '',
    service_date TEXT DEFAULT '',
    supplier TEXT DEFAULT '',
    service_staff TEXT DEFAULT '',
    service_area TEXT DEFAULT '',
    service_content TEXT DEFAULT '',
    findings TEXT DEFAULT '',
    measures TEXT DEFAULT '',
    chemicals_used TEXT DEFAULT '',
    customer_signee TEXT DEFAULT '',
    sign_date TEXT DEFAULT '',
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 投诉整改
db.exec(`
  CREATE TABLE IF NOT EXISTS pest_complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    complaint_number TEXT NOT NULL DEFAULT '',
    complaint_date TEXT DEFAULT '',
    reporter TEXT DEFAULT '',
    area TEXT DEFAULT '',
    description TEXT DEFAULT '',
    severity TEXT NOT NULL DEFAULT '一般',
    handler TEXT DEFAULT '',
    deadline TEXT DEFAULT '',
    measures TEXT DEFAULT '',
    review_result TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT '待处理',
    close_date TEXT DEFAULT '',
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 虫害管理索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_pest_supplier_docs_user_id ON pest_supplier_docs(user_id);
  CREATE INDEX IF NOT EXISTS idx_pest_staff_user_id ON pest_staff(user_id);
  CREATE INDEX IF NOT EXISTS idx_pest_staff_certs_user_id ON pest_staff_certs(user_id);
  CREATE INDEX IF NOT EXISTS idx_pest_staff_certs_staff_id ON pest_staff_certs(staff_id);
  CREATE INDEX IF NOT EXISTS idx_pest_chemicals_user_id ON pest_chemicals(user_id);
  CREATE INDEX IF NOT EXISTS idx_pest_chemical_docs_user_id ON pest_chemical_docs(user_id);
  CREATE INDEX IF NOT EXISTS idx_pest_chemical_docs_chemical_id ON pest_chemical_docs(chemical_id);
  CREATE INDEX IF NOT EXISTS idx_pest_layout_maps_user_id ON pest_layout_maps(user_id);
  CREATE INDEX IF NOT EXISTS idx_pest_inspections_user_id ON pest_inspections(user_id);
  CREATE INDEX IF NOT EXISTS idx_pest_monthly_reports_user_id ON pest_monthly_reports(user_id);
  CREATE INDEX IF NOT EXISTS idx_pest_service_reports_user_id ON pest_service_reports(user_id);
  CREATE INDEX IF NOT EXISTS idx_pest_complaints_user_id ON pest_complaints(user_id);
`)

// ===== 计量校准模块 =====

// 计量设备台账
db.exec(`
  CREATE TABLE IF NOT EXISTS calibration_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_number TEXT NOT NULL DEFAULT '',
    device_name TEXT NOT NULL DEFAULT '',
    device_type TEXT NOT NULL DEFAULT '温度测量',
    brand_model TEXT DEFAULT '',
    accuracy TEXT DEFAULT '',
    measure_range TEXT DEFAULT '',
    location TEXT DEFAULT '',
    responsible_person TEXT DEFAULT '',
    start_date TEXT DEFAULT '',
    calibration_cycle TEXT DEFAULT '12',
    last_calibration_date TEXT DEFAULT '',
    next_calibration_date TEXT DEFAULT '',
    calibration_status TEXT DEFAULT '正常',
    device_status TEXT DEFAULT '在用',
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 校准计划
db.exec(`
  CREATE TABLE IF NOT EXISTS calibration_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_number TEXT NOT NULL DEFAULT '',
    device_id INTEGER NOT NULL,
    planned_date TEXT NOT NULL DEFAULT '',
    actual_date TEXT DEFAULT '',
    agency_id INTEGER,
    method TEXT DEFAULT '外校',
    plan_status TEXT DEFAULT '待执行',
    result TEXT DEFAULT '',
    remark TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 校准记录（含测试数据 JSON）
db.exec(`
  CREATE TABLE IF NOT EXISTS calibration_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    cert_number TEXT NOT NULL DEFAULT '',
    device_id INTEGER NOT NULL,
    plan_id INTEGER,
    calibration_date TEXT DEFAULT '',
    agency_name TEXT DEFAULT '',
    agency_qualification TEXT DEFAULT '',
    standard TEXT DEFAULT '',
    method TEXT DEFAULT '外校',
    environment TEXT DEFAULT '',
    test_data TEXT DEFAULT '[]',
    max_error TEXT DEFAULT '',
    conclusion TEXT DEFAULT '合格',
    limit_note TEXT DEFAULT '',
    next_calibration_date TEXT DEFAULT '',
    calibrator TEXT DEFAULT '',
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 校准机构
db.exec(`
  CREATE TABLE IF NOT EXISTS calibration_agencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    agency_name TEXT NOT NULL DEFAULT '',
    qualification TEXT DEFAULT '',
    cert_number TEXT DEFAULT '',
    cert_expiry TEXT DEFAULT '',
    service_scope TEXT DEFAULT '',
    contact_person TEXT DEFAULT '',
    contact_phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    cooperation_status TEXT DEFAULT '合作中',
    total_orders INTEGER DEFAULT 0,
    rating INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 校准异常
db.exec(`
  CREATE TABLE IF NOT EXISTS calibration_exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    exception_number TEXT NOT NULL DEFAULT '',
    device_id INTEGER NOT NULL,
    exception_type TEXT DEFAULT '校准不合格',
    description TEXT DEFAULT '',
    severity TEXT DEFAULT '一般',
    discover_date TEXT DEFAULT '',
    impact_assessment TEXT DEFAULT '',
    measures TEXT DEFAULT '',
    handler TEXT DEFAULT '',
    handle_date TEXT DEFAULT '',
    recalibration_date TEXT DEFAULT '',
    status TEXT DEFAULT '待处理',
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 计量校准索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_cal_devices_user_id ON calibration_devices(user_id);
  CREATE INDEX IF NOT EXISTS idx_cal_plans_user_id ON calibration_plans(user_id);
  CREATE INDEX IF NOT EXISTS idx_cal_plans_device_id ON calibration_plans(device_id);
  CREATE INDEX IF NOT EXISTS idx_cal_records_user_id ON calibration_records(user_id);
  CREATE INDEX IF NOT EXISTS idx_cal_records_device_id ON calibration_records(device_id);
  CREATE INDEX IF NOT EXISTS idx_cal_agencies_user_id ON calibration_agencies(user_id);
  CREATE INDEX IF NOT EXISTS idx_cal_exceptions_user_id ON calibration_exceptions(user_id);
`)

// ===== 原料与标准管理模块 =====

// 原料基础信息
db.exec(`
  CREATE TABLE IF NOT EXISTS raw_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    material_number TEXT NOT NULL DEFAULT '',
    material_name TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '其他',
    risk_level TEXT NOT NULL DEFAULT '中',
    specification TEXT DEFAULT '',
    shelf_life INTEGER DEFAULT 0,
    storage_condition TEXT DEFAULT '',
    executive_standard TEXT DEFAULT '',
    allergen_info TEXT DEFAULT '',
    suppliers TEXT DEFAULT '[]',
    status TEXT DEFAULT '启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 验收标准配置
db.exec(`
  CREATE TABLE IF NOT EXISTS raw_material_standards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    temp_standard TEXT DEFAULT '',
    cert_requirements TEXT DEFAULT '[]',
    sensory_items TEXT DEFAULT '[]',
    packaging_requirement TEXT DEFAULT '',
    shelf_life_ratio REAL DEFAULT 0.33,
    judge_rules TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (material_id) REFERENCES raw_materials(id)
  )
`)

// 原料批次主记录
db.exec(`
  CREATE TABLE IF NOT EXISTS raw_material_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    batch_number TEXT NOT NULL DEFAULT '',
    arrival_time TEXT DEFAULT '',
    material_name TEXT NOT NULL DEFAULT '',
    material_id INTEGER,
    supplier TEXT DEFAULT '',
    po_number TEXT DEFAULT '',
    planned_quantity REAL DEFAULT 0,
    actual_quantity REAL DEFAULT 0,
    inspector TEXT DEFAULT '',
    judge_result TEXT DEFAULT '',
    judge_time TEXT DEFAULT '',
    judge_approver TEXT DEFAULT '',
    status TEXT DEFAULT '待验收',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 验收检查记录
db.exec(`
  CREATE TABLE IF NOT EXISTS raw_material_inspection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    cert_check TEXT DEFAULT '{}',
    sensory_check TEXT DEFAULT '{}',
    temp_check TEXT DEFAULT '{}',
    packaging_check TEXT DEFAULT '{}',
    inspect_photos TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (batch_id) REFERENCES raw_material_batches(id)
  )
`)

// AI 风险评估结果
db.exec(`
  CREATE TABLE IF NOT EXISTS raw_material_ai_risk (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    risk_level TEXT DEFAULT '',
    risk_score INTEGER DEFAULT 0,
    risk_prompt TEXT DEFAULT '',
    ai_suggestion TEXT DEFAULT '',
    supplier_history_rate REAL DEFAULT 0,
    dimension_scores TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (batch_id) REFERENCES raw_material_batches(id)
  )
`)

// 拒收记录
db.exec(`
  CREATE TABLE IF NOT EXISTS raw_material_rejections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    rejection_number TEXT NOT NULL DEFAULT '',
    batch_id INTEGER NOT NULL,
    rejection_reason TEXT DEFAULT '',
    rejection_quantity REAL DEFAULT 0,
    return_time TEXT DEFAULT '',
    supplier_penalty INTEGER DEFAULT 0,
    status TEXT DEFAULT '已退货',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (batch_id) REFERENCES raw_material_batches(id)
  )
`)

// 让步接收记录
db.exec(`
  CREATE TABLE IF NOT EXISTS raw_material_concessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    concession_number TEXT NOT NULL DEFAULT '',
    batch_id INTEGER NOT NULL,
    concession_reason TEXT DEFAULT '',
    usage_limit TEXT DEFAULT '',
    approver TEXT DEFAULT '',
    approve_time TEXT DEFAULT '',
    usage_deadline TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (batch_id) REFERENCES raw_material_batches(id)
  )
`)

// 产品标准管理
db.exec(`
  CREATE TABLE IF NOT EXISTS product_standards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    standard_number TEXT NOT NULL DEFAULT '',
    standard_name TEXT NOT NULL DEFAULT '',
    standard_type TEXT NOT NULL DEFAULT '企标',
    standard_code TEXT DEFAULT '',
    applicable_products TEXT DEFAULT '',
    issued_date TEXT DEFAULT '',
    effective_date TEXT DEFAULT '',
    expiry_date TEXT DEFAULT '',
    status TEXT DEFAULT '现行有效',
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 产品标准指标明细
db.exec(`
  CREATE TABLE IF NOT EXISTS product_standard_indicators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    standard_id INTEGER NOT NULL,
    indicator_category TEXT NOT NULL DEFAULT '感官',
    indicator_name TEXT NOT NULL DEFAULT '',
    requirement TEXT DEFAULT '',
    test_method TEXT DEFAULT '',
    internal_control TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (standard_id) REFERENCES product_standards(id)
  )
`)

// 检验项目库
db.exec(`
  CREATE TABLE IF NOT EXISTS test_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_number TEXT NOT NULL DEFAULT '',
    item_name TEXT NOT NULL DEFAULT '',
    test_method TEXT DEFAULT '',
    method_name TEXT DEFAULT '',
    detection_limit TEXT DEFAULT '',
    applicable_scope TEXT DEFAULT '',
    equipment TEXT DEFAULT '',
    method_status TEXT DEFAULT '现行有效',
    replacement_method TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 留样管理
db.exec(`
  CREATE TABLE IF NOT EXISTS samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sample_number TEXT NOT NULL DEFAULT '',
    sample_type TEXT NOT NULL DEFAULT '原料留样',
    related_batch TEXT DEFAULT '',
    material_product_name TEXT NOT NULL DEFAULT '',
    sample_quantity TEXT DEFAULT '',
    sample_date TEXT DEFAULT '',
    storage_location TEXT DEFAULT '',
    storage_condition TEXT DEFAULT '',
    retention_days INTEGER DEFAULT 0,
    expiry_date TEXT DEFAULT '',
    sampler TEXT DEFAULT '',
    status TEXT DEFAULT '留样中',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 留样处置记录
db.exec(`
  CREATE TABLE IF NOT EXISTS sample_disposal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sample_id INTEGER NOT NULL,
    disposal_method TEXT DEFAULT '',
    disposer TEXT DEFAULT '',
    disposal_date TEXT DEFAULT '',
    remark TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (sample_id) REFERENCES samples(id)
  )
`)

// 不合格品记录
db.exec(`
  CREATE TABLE IF NOT EXISTS non_conforming (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nc_number TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT '原料验收',
    related_batch TEXT DEFAULT '',
    nc_description TEXT DEFAULT '',
    severity TEXT NOT NULL DEFAULT '一般',
    status TEXT DEFAULT '待处理',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 不合格品处置记录
db.exec(`
  CREATE TABLE IF NOT EXISTS non_conforming_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nc_id INTEGER NOT NULL,
    action_type TEXT DEFAULT '',
    handler TEXT DEFAULT '',
    action_date TEXT DEFAULT '',
    verify_result TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (nc_id) REFERENCES non_conforming(id)
  )
`)

// 标准变更记录
db.exec(`
  CREATE TABLE IF NOT EXISTS standard_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    change_number TEXT NOT NULL DEFAULT '',
    standard_id INTEGER,
    change_type TEXT NOT NULL DEFAULT '新增',
    change_content TEXT DEFAULT '',
    impact_assessment TEXT DEFAULT '',
    approver TEXT DEFAULT '',
    publish_date TEXT DEFAULT '',
    status TEXT DEFAULT '草稿',
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 批次追溯记录
db.exec(`
  CREATE TABLE IF NOT EXISTS batch_traceability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    trace_number TEXT NOT NULL DEFAULT '',
    trace_type TEXT NOT NULL DEFAULT '正向追溯',
    input_batch TEXT DEFAULT '',
    trace_chain TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 原料与标准索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_raw_materials_user_id ON raw_materials(user_id);
  CREATE INDEX IF NOT EXISTS idx_raw_materials_category ON raw_materials(category);
  CREATE INDEX IF NOT EXISTS idx_raw_material_standards_material_id ON raw_material_standards(material_id);
  CREATE INDEX IF NOT EXISTS idx_raw_material_batches_user_id ON raw_material_batches(user_id);
  CREATE INDEX IF NOT EXISTS idx_raw_material_batches_status ON raw_material_batches(status);
  CREATE INDEX IF NOT EXISTS idx_raw_material_inspection_batch_id ON raw_material_inspection(batch_id);
  CREATE INDEX IF NOT EXISTS idx_product_standards_user_id ON product_standards(user_id);
  CREATE INDEX IF NOT EXISTS idx_product_standard_indicators_standard_id ON product_standard_indicators(standard_id);
  CREATE INDEX IF NOT EXISTS idx_test_items_user_id ON test_items(user_id);
  CREATE INDEX IF NOT EXISTS idx_samples_user_id ON samples(user_id);
  CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);
  CREATE INDEX IF NOT EXISTS idx_non_conforming_user_id ON non_conforming(user_id);
  CREATE INDEX IF NOT EXISTS idx_non_conforming_status ON non_conforming(status);
  CREATE INDEX IF NOT EXISTS idx_standard_changes_user_id ON standard_changes(user_id);
  CREATE INDEX IF NOT EXISTS idx_batch_traceability_user_id ON batch_traceability(user_id);
`)

// ===== 客诉管理模块 =====

// 客诉主记录
db.exec(`
  CREATE TABLE IF NOT EXISTS complaint_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    complaint_number TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL DEFAULT '',
    customer_phone TEXT DEFAULT '',
    complaint_date TEXT NOT NULL DEFAULT '',
    complaint_channel TEXT NOT NULL DEFAULT '电话',
    complaint_type TEXT NOT NULL DEFAULT '其他',
    product_name TEXT DEFAULT '',
    batch_no TEXT DEFAULT '',
    problem_desc TEXT DEFAULT '',
    urgency TEXT NOT NULL DEFAULT '一般',
    risk_level TEXT DEFAULT '中',
    handler TEXT DEFAULT '',
    handle_measure TEXT DEFAULT '',
    ai_reply TEXT DEFAULT '',
    investigation_record TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT '待处理',
    close_date TEXT DEFAULT '',
    satisfaction_score INTEGER DEFAULT 0,
    file_paths TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// 客诉处理记录
db.exec(`
  CREATE TABLE IF NOT EXISTS complaint_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    complaint_id INTEGER NOT NULL,
    action_date TEXT DEFAULT '',
    handler TEXT DEFAULT '',
    action_content TEXT DEFAULT '',
    action_result TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (complaint_id) REFERENCES complaint_records(id)
  )
`)

// 客诉索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_complaint_records_user_id ON complaint_records(user_id);
  CREATE INDEX IF NOT EXISTS idx_complaint_records_status ON complaint_records(status);
  CREATE INDEX IF NOT EXISTS idx_complaint_actions_complaint_id ON complaint_actions(complaint_id);
`)

console.log('✅ 数据库已就绪（users + certificates + health_certs + labels + audit_rules + regulations + pest + calibration + complaint + indexes + 迁移）')

module.exports = db
