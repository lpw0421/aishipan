# AI 食安 — 食品企业 SaaS 管理系统

面向中小食品企业的智能合规管理平台，覆盖资质管理、员工健康证管理、标签 AI 审核、法规库查阅等核心场景。

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Vue 3 (Composition API) | ^3.5 |
| UI 组件库 | Element Plus | ^2.14 |
| 构建工具 | Vite | ^8.0 |
| 路由 | Vue Router 4 | ^4.6 |
| HTTP 客户端 | Axios | ^1.16 |
| 后端框架 | Express | ^5.2 |
| 数据库 | better-sqlite3 | ^12.10 |
| 定时任务 | node-cron | - |
| Excel 导出 | xlsx | - |
| PDF 报告 | pdfkit | ^0.18 |
| 进程管理 | PM2 | - |
| 反向代理 | Nginx | - |

## 项目结构

```
ai-shipan/
├── client/                     # 前端项目
│   ├── src/
│   │   ├── views/              # 页面组件
│   │   │   ├── Login.vue       #   登录
│   │   │   ├── Register.vue    #   注册
│   │   │   ├── MainLayout.vue  #   后台框架（侧边栏+顶栏）
│   │   │   ├── Dashboard.vue   #   首页数据看板
│   │   │   ├── Credentials.vue #   资质证照管理
│   │   │   ├── HealthCerts.vue #   员工健康证管理
│   │   │   ├── LabelAudit.vue  #   标签 AI 审核
│   │   │   └── Regulations.vue #   法规库
│   │   ├── router/             # 路由配置（懒加载）
│   │   ├── utils/              # 工具函数
│   │   │   ├── request.js      #   Axios 封装
│   │   │   └── compress.js     #   图片压缩
│   │   └── App.vue             # 根组件
│   ├── vite.config.js          # Vite 配置（含 API 代理）
│   └── package.json
├── server/                     # 后端项目
│   ├── index.js                # Express 服务入口（所有接口）
│   ├── db.js                   # 数据库初始化 + 索引
│   ├── utils/
│   │   ├── ocr.js              #   OCR 识别（模拟）
│   │   ├── ai.js               #   AI 审核（DeepSeek）
│   │   └── report.js           #   PDF 报告生成
│   ├── ecosystem.config.js     # PM2 配置
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml          # Docker 编排
├── nginx.production.conf       # 生产 Nginx 配置（HTTP + HTTPS）
├── .gitignore
├── README.md                   # 本文件
├── DEPLOY.md                   # 部署指南
├── DOMAIN_HTTPS.md             # 域名与 HTTPS 指南
├── TEST.md                     # 回归测试清单
└── USER_MANUAL.md              # 用户操作手册
```

## 快速开始（本地开发）

### 环境要求

- Node.js 20+
- npm 9+

### 1. 克隆项目

```bash
git clone <仓库地址>
cd ai-shipan
```

### 2. 启动后端

```bash
cd server
npm install
npm run dev          # nodemon 热重载，监听 :3001
```

### 3. 启动前端

```bash
cd client
npm install
npm run dev          # Vite 开发服务器，监听 :3000
```

### 4. 访问系统

打开浏览器访问 `http://localhost:3000`，注册一个账号即可登录使用。

> 前端 /api 和 /uploads 请求通过 Vite 代理自动转发到后端 :3001，无需手动处理跨域。

## AI 审核配置（可选）

编辑 `server/.env`：

```env
AI_API_KEY=你的DeepSeek API Key
AI_BASE_URL=https://api.deepseek.com
```

- 配置后，标签审核优先使用 AI 大模型
- 未配置或调用失败时，自动降级为规则匹配审核，不影响使用

## 数据库

- 开发/生产共用 SQLite（单文件 `server/data.db`）
- WAL 模式，支持并发读写
- 首次启动自动建表 + 初始化 7 条 GB 7718 审核规则
- 迁移策略：`ALTER TABLE ... ADD COLUMN` + `try/catch` 兜底

### 核心表

| 表 | 说明 |
|----|------|
| users | 用户账户 |
| certificates | 资质证照 |
| health_certs | 员工健康证 |
| labels | 标签审核记录 |
| audit_rules | GB 7718 审核规则 |
| audit_results | 审核结果明细 |

## 生产部署

详见 [DEPLOY.md](DEPLOY.md)，包含：
- 云服务器选购建议
- 环境初始化脚本
- Nginx + PM2 部署
- Docker Compose 部署（可选）
- 域名 + 免费 SSL 证书（Let's Encrypt）
- 日常运维命令

## 核心功能

- **证照管理** — 上传/查看/删除资质证照，自动计算是否临期/过期，Excel 导出
- **健康证管理** — 员工健康证 CRUD，按姓名搜索，到期预警
- **标签 AI 审核** — 上传食品标签图片 → OCR 识别 → AI/规则审核 → PDF 报告
- **版本管理** — 同产品再次上传自动版本号 +1，历史版本时间线可追溯
- **首页看板** — 证照/健康证统计卡片 + 临期预警列表
- **法规库** — GB 7718、GB 28050、食品安全法查阅
- **定时预警** — 每天早上 9:00 自动检查临期证照
- **安全加固** — 密码 SHA256 哈希、XSS 过滤、接口限流、HTTPS + HSTS

## 文档索引

| 文档 | 说明 |
|------|------|
| [README.md](README.md) | 项目概述与技术栈 |
| [DEPLOY.md](DEPLOY.md) | 生产环境部署指南 |
| [DOMAIN_HTTPS.md](DOMAIN_HTTPS.md) | 域名解析与 SSL 证书 |
| [TEST.md](TEST.md) | 全功能回归测试清单 |
| [USER_MANUAL.md](USER_MANUAL.md) | 用户操作手册 |
| [OPERATIONS.md](OPERATIONS.md) | 运营推广计划 |
