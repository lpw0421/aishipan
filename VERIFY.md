# AI 食安 — 上线前验证操作指南

> 按顺序逐项执行，每完成一项在前面打 ✅

---

## 一、准备环境（约 2 分钟）

```bash
# 1. 打开两个终端窗口

# 终端 A — 启动后端
cd /Users/lipengwei/ai-shipan/server
npm run dev
# 看到: ✅ AI 食安后端已启动: http://localhost:3001

# 终端 B — 启动前端
cd /Users/lipengwei/ai-shipan/client
npm run dev
# 看到: http://localhost:3000
```

---

## 二、安全加固验证（5 项）

### 2.1 SQL 注入防护

```bash
# 接口不存在，返回 404，而非数据库报错
curl -s 'http://localhost:3001/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin'\'' OR 1=1 --","password":"x"}'
# 预期: {"message":"用户名或密码错误"}
```

### 2.2 XSS 防护

```bash
curl -s -X POST 'http://localhost:3001/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"username":"<img src=x onerror=alert(1)>","password":"x"}'
# 预期: {"message":"用户名或密码错误"}
# （脚本标签被转义，不会执行）
```

### 2.3 密码加密

```bash
# SHA256 哈希，数据库中不存明文
cd /Users/lipengwei/ai-shipan/server
sqlite3 data.db "SELECT username, password FROM users;"
# 预期: admin 的 password 字段是 64 位十六进制哈希值，而非明文
```

### 2.4 接口限流（敏感接口）

```bash
# 连续发送 11 次登录请求
for i in $(seq 1 11); do
  echo -n "第${i}次: "
  curl -s -X POST 'http://localhost:3001/api/auth/login' \
    -H 'Content-Type: application/json' \
    -d '{"username":"test","password":"x"}'
  echo
done
# 预期: 第 1-10 次返回 {"message":"用户名或密码错误"}
#       第 11 次返回 {"message":"操作过于频繁，请1分钟后再试"}
```

### 2.5 接口限流（通用 API）

```bash
# 快速发 101 次健康检查请求
for i in $(seq 1 101); do curl -s 'http://localhost:3001/api/health' > /dev/null; done
curl -s 'http://localhost:3001/api/health'
# 预期: 返回 {"message":"请求过于频繁，请稍后再试"}
```

---

## 三、前端性能优化验证（4 项）

### 3.1 图片压缩

```bash
# 浏览器操作：
# 1. 打开 http://localhost:3000/#/login 登录
# 2. 进入 证照管理 → 添加证照
# 3. 选择一个 >2MB 的 jpg 图片上传
# 4. 打开开发者工具 Network 标签，查看 /api/certificates POST 请求体大小
# 预期: 实际发送的数据量明显小于原文件（压缩后通常 <500KB）
```

### 3.2 路由懒加载

```bash
# 浏览器操作：
# 1. 打开 http://localhost:3000/#/login
# 2. F12 打开开发者工具 → Network 标签 → 勾选 "Disable cache"
# 3. 登录后观察 Network 面板
# 预期: 切换页面时才会加载对应的 JS 文件
#   例如：点击"健康证管理"时，才出现 HealthCerts-xxx.js
#        点击"标签审核"时，才出现 LabelAudit-xxx.js
```

### 3.3 列表分页

```bash
# 浏览器操作：
# 1. 登录后进入 证照管理
# 2. 手动添加超过 10 条证照记录
# 3. 观察表格下方
# 预期: 出现分页组件（上一页/下一页/页码/总数），可正常翻页
# 4. 同样检查 标签审核管理 和 健康证管理 页面的分页
```

### 3.4 生产构建验证

```bash
cd /Users/lipengwei/ai-shipan/client && npm run build
# 预期: ✓ built 成功，输出各页面独立 chunk 文件
# 检查 dist/assets/ 目录，确认每个页面有独立 JS 文件

ls dist/assets/*.js
# 预期: 看到 Login-xxx.js, Register-xxx.js, Dashboard-xxx.js,
#       Credentials-xxx.js, HealthCerts-xxx.js, LabelAudit-xxx.js 等
```

---

## 四、前端功能验证（浏览器操作）

> 打开 Chrome 浏览器，访问 `http://localhost:3000`

### 4.1 注册

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 点击"去注册"链接 | 进入注册页 |
| 2 | 留空，点"注册" | 提示"用户名和密码不能为空" |
| 3 | 填写用户名 `verify`，密码 `123` | 提示"密码长度不能少于6位" |
| 4 | 填写用户名 `verify`，密码 `123456` | 提示"注册成功"，跳转登录页 |

### 4.2 登录

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 用 `verify` / 错误密码登录 | 提示"用户名或密码错误" |
| 2 | 用 `verify` / `123456` 登录 | 提示"登录成功"，跳转系统首页 |

### 4.3 首页看板

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 观察统计卡片 | 4 个卡片（资质总数/异常数/员工总数/健康异常） |
| 2 | 点击"添加证照"快捷卡片 | 跳转证照管理并自动弹出添加弹窗 |
| 3 | 点击"添加健康证"快捷卡片 | 跳转健康证管理并自动弹出添加弹窗 |

### 4.4 资质证照管理

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 点击"添加证照" | 弹出添加弹窗 |
| 2 | 填写名称"食品经营许可证"，选到期日（选30天内），上传图片 | 上传区域出现缩略图 |
| 3 | 点击"上传" | 提示"证照添加成功"，列表刷新 |
| 4 | 查看列表状态列 | 显示"临期"（橙色标签） |
| 5 | 点击顶部"临期"卡片筛选 | 列表只显示临期记录 |
| 6 | 再次点击"临期"卡片 | 取消筛选，显示全部 |
| 7 | 添加更多证照，选不同到期日 | 状态分别显示正常(绿)/临期(橙)/过期(红) |
| 8 | 添加超过 10 条 | 表格下方出现分页组件 |
| 9 | 点击"导出 Excel" | 浏览器下载 .xlsx 文件 |

### 4.5 员工健康证管理

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 点击"添加健康证" | 弹出添加弹窗 |
| 2 | 填写员工信息，选中日期，上传图片 → 上传 | 提示"健康证添加成功" |
| 3 | 搜索框输入员工姓名 | 列表实时过滤 |
| 4 | 点击"编辑"修改信息 → 保存 | 提示"健康证更新成功" |
| 5 | 点击"删除" → 确认 | 提示"健康证已删除" |

### 4.6 标签 AI 审核（核心功能）

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 点击"查看审核规则" | 弹窗显示 7 条 GB 7718 规则（R01-R07） |
| 2 | 关闭，点击"上传新标签" | 弹出上传弹窗 |
| 3 | 填写产品名"验证样品"，选分类"饮料"，拖入一张图片 | 文件区域显示图片 |
| 4 | 点击"上传" | 提示"标签上传成功"，列表出现新记录 |
| 5 | 列表 version 列 | 显示 v1 |
| 6 | 点击缩略图 | 弹窗预览图片 |
| 7 | 点击"开始审核" | 按钮 loading → 提示"审核通过"或"审核未通过" |
| 8 | 状态更新 | 变为"通过"（绿色）或"不通过"（红色） |
| 9 | 点击"下载报告" | 浏览器打开/下载 PDF |
| 10 | 查看 PDF 内容 | 包含：基本信息 / 审核结论(颜色标识) / 审核明细表 / 免责声明 |

### 4.7 版本管理与历史

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 再次上传，产品名填"验证样品"（同名），分类改"乳制品"，上传图片 | version 显示 v2 |
| 2 | 点击 v2 记录的"历史"按钮 | 弹窗时间线显示 v2 和 v1 两个版本 |
| 3 | 在历史弹窗中点击 v1 的"查看图片" | 显示 v1 上传的图片 |
| 4 | 对 v2 执行审核 → 下载报告 | v2 记录可下载报告 |

### 4.8 法规库

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 左侧菜单进入"法规库" | 显示标签页 |
| 2 | 切换到"GB 7718" | 显示预包装食品标签通则内容 |
| 3 | 切换到"GB 28050" | 显示营养标签通则内容 |

### 4.9 退出登录

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 点击右上角用户名 → "退出登录" | 跳转到登录页 |
| 2 | 在地址栏输入 `/dashboard` | 被路由守卫拦截，重回登录页 |

---

## 五、移动端适配验证

```bash
# 浏览器操作：
# 1. F12 打开开发者工具
# 2. 点击设备模拟按钮（Ctrl+Shift+M / Cmd+Shift+M）
# 3. 选择 iPhone 14 或 Pixel 5
# 4. 访问以下页面，确认无横向滚动条和错位
```

| 页面 | 检查点 |
|------|--------|
| 登录页 | 卡片不超出屏幕，输入框完整可见 |
| 注册页 | 同登录页 |
| 系统首页 | 统计卡片纵向堆叠，不挤压 |
| 证照管理 | 表格可横向滚动 |
| 健康证管理 | 表格可横向滚动 |
| 标签审核 | 操作按钮不换行混乱 |

---

## 六、生产部署相关验证

### 6.1 Docker（可选）

```bash
cd /Users/lipengwei/ai-shipan
docker compose build
# 预期: 两个镜像构建成功（backend + frontend）
```

### 6.2 备份脚本

```bash
cd /Users/lipengwei/ai-shipan
./backup.sh
# 预期: 在 backups/ 目录下生成 .db.gz 和 .tar.gz 文件

ls -lh backups/
# 应该看到备份文件
```

### 6.3 数据库索引

```bash
cd /Users/lipengwei/ai-shipan/server
sqlite3 data.db "SELECT name FROM sqlite_master WHERE type='index';"
# 预期输出至少包含:
#   idx_users_username
#   idx_certificates_user_id
#   idx_health_certs_user_id
#   idx_labels_user_id
#   idx_labels_user_product
#   idx_audit_results_label_id
```

### 6.4 Nginx 配置检查

```bash
# 仅在有 Nginx 的机器上执行
sudo nginx -t
# 预期: syntax is ok / test is successful
```

---

## 七、文档完整性检查

```bash
cd /Users/lipengwei/ai-shipan
ls -1 *.md *.sh *.yml *.conf 2>/dev/null
```

预期看到：

```
backup.sh
DEPLOY.md
docker-compose.yml
DOMAIN_HTTPS.md
nginx.production.conf
OPERATIONS.md
README.md
TEST.md
USER_MANUAL.md
VERIFY.md
```

---

## 验证结果汇总

| 模块 | 项目数 | 通过 | 失败 |
|------|--------|------|------|
| 安全加固 | 5 | | |
| 前端性能 | 4 | | |
| 功能验证 | 8 | | |
| 移动端 | 6 | | |
| 生产部署 | 4 | | |
| 文档完整性 | 1 | | |
| **合计** | **28** | | |

---

> 全部项目通过后，系统即达到上线标准。祝贺！
