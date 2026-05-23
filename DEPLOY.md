# AI 食安 - 生产环境部署指南

## 1. 服务器选购

推荐配置（满足日均 1000 用户）：

| 参数 | 建议 |
|------|------|
| 云服务商 | 阿里云 / 腾讯云 轻量应用服务器 |
| 操作系统 | Ubuntu 22.04 LTS |
| CPU | 2 核及以上 |
| 内存 | 4 GB 及以上 |
| 硬盘 | 40 GB 及以上 |
| 带宽 | 3 Mbps 及以上 |

> 定价参考：轻量应用服务器约 ￥68-112/月

## 2. 服务器初始化

SSH 登录服务器后，执行环境安装：

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 Nginx、Git、PM2
sudo apt install -y nginx git
sudo npm install -g pm2

# 验证
node -v   # v20.x
npm -v    # 10.x
git --version
nginx -v
pm2 -v
```

## 3. 拉取代码

```bash
# 克隆项目（替换为实际仓库地址）
cd /var/www
git clone https://github.com/your-org/ai-shipan.git
cd ai-shipan
```

## 4. 后端部署

```bash
cd /var/www/ai-shipan/server

# 安装依赖
npm ci --production

# 创建必要目录
mkdir -p uploads/labels logs

# 复制生产环境配置
cp .env.production .env
# 编辑 .env，填入真实的 AI_API_KEY
nano .env

# PM2 启动
pm2 start ecosystem.config.js

# 设置 PM2 开机自启
pm2 startup
pm2 save

# 验证
curl http://localhost:3001/api/health
# 应返回: {"message":"AI 食安后端已启动"}
```

## 5. 前端部署

```bash
cd /var/www/ai-shipan/client

# 安装依赖
npm ci

# 构建生产包
npm run build

# 产物在 dist/ 目录
ls dist/
# index.html  assets/
```

## 6. 域名解析

在云服务商控制台添加 DNS 解析记录：

| 记录类型 | 主机记录 | 记录值 | TTL |
|----------|----------|--------|-----|
| A | @ | 你的服务器 IP | 600 |
| A | www | 你的服务器 IP | 600 |

```bash
# 验证解析生效
ping your-domain.com
```

## 7. Nginx 配置 + HTTPS

### 7.1 初始 HTTP 配置

```bash
# 复制 Nginx 配置
sudo cp /var/www/ai-shipan/nginx.production.conf /etc/nginx/sites-available/ai-shipan
sudo nano /etc/nginx/sites-available/ai-shipan
# 替换 your-domain.com 为实际域名（共4处）
# 先注释掉 443 server 块，只启用 80 端口

sudo ln -s /etc/nginx/sites-available/ai-shipan /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 7.2 申请免费 SSL 证书（Let's Encrypt）

```bash
# 安装 certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书（交互式：输入邮箱 → 同意条款）
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 或者使用 webroot 方式：
sudo certbot certonly --webroot \
  -w /var/www/ai-shipan/client/dist \
  -d your-domain.com -d www.your-domain.com
```

### 7.3 启用 HTTPS

```bash
# 编辑 Nginx 配置，取消注释 443 server 块
# 确保证书路径中的域名正确
sudo nano /etc/nginx/sites-available/ai-shipan

sudo nginx -t && sudo systemctl reload nginx

# 访问 https://your-domain.com 验证锁头图标
```

### 7.4 证书自动续期

```bash
# 测试续期流程
sudo certbot renew --dry-run

# certbot 已自动注册定时任务，验证：
sudo systemctl status certbot.timer
```

> 详细指南参见 [DOMAIN_HTTPS.md](DOMAIN_HTTPS.md)

## 8. 防火墙设置

```bash
# 开启 80/443 端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp   # SSH
sudo ufw enable
sudo ufw status
```

## 9. 验证部署

```bash
# 检查后端进程
pm2 status

# 检查 Nginx 状态
sudo systemctl status nginx

# 浏览器访问
# http://服务器IP
# 应展示 AI 食安登录页面
```

## 10. Docker Compose 部署（可选）

如果使用 Docker 部署，无需安装 Node.js/Nginx：

```bash
cd /var/www/ai-shipan

# 复制生产配置
cp server/.env.production server/.env
nano server/.env  # 填入 API Key

# 一键启动
docker compose up -d

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f
```

## 11. 数据备份

```bash
cd /var/www/ai-shipan

# 手动备份
./backup.sh

# 添加定时任务（每天凌晨 2:00 自动备份）
crontab -e
# 添加以下行：
0 2 * * * /var/www/ai-shipan/backup.sh >> /var/log/ai-shipan-backup.log 2>&1

# 查看备份文件
ls -lh backups/

# 恢复数据库（停止后端后）
pm2 stop ai-food-safety-api
gunzip backups/ai-shipan_20260519_020000.db.gz -c > server/data.db
pm2 start ai-food-safety-api
```

> 备份策略：保留最近 30 天，最多 90 个文件，同时打包 uploads 目录。

## 12. PM2 开机自启

```bash
# 生成自启脚本
pm2 startup

# 执行上面输出的命令（需要 sudo）
# 示例：sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# 保存当前进程列表
pm2 save

# 验证
sudo systemctl status pm2-ubuntu
```

## 13. 日常运维命令

```bash
# PM2 管理
pm2 status              # 查看进程状态
pm2 logs ai-food-safety-api    # 查看日志
pm2 restart ai-food-safety-api # 重启后端
pm2 stop ai-food-safety-api    # 停止后端

# Nginx 管理
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl reload nginx
sudo nginx -t            # 测试配置

# 更新代码后重新部署
cd /var/www/ai-shipan
git pull
cd client && npm ci && npm run build  # 前端
cd ../server && npm ci --production && pm2 restart ai-food-safety-api  # 后端
```

## 常见问题

**Q: 访问出现 502 Bad Gateway**
```bash
# 检查后端是否运行
pm2 status
# 检查 Nginx 代理地址是否正确
sudo nginx -t
```

**Q: 上传文件失败**
```bash
# 检查 uploads 目录权限
chmod -R 755 /var/www/ai-shipan/server/uploads
```

**Q: 数据库损坏**
```bash
# SQLite 恢复（停止后端后操作）
pm2 stop ai-food-safety-api
cp data.db data.db.bak
# 重新启动自动创建 WAL 恢复
pm2 start ai-food-safety-api
```
