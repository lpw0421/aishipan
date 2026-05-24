#!/bin/bash
# ============================================
# AI 食安系统 — 一键部署脚本 (Ubuntu 22.04/24.04)
# 用法：chmod +x deploy.sh && sudo ./deploy.sh
# ============================================

set -e

APP_DIR="/opt/aishipan"
DOMAIN="aishipan.com"
NODE_VERSION="20"

echo "🚀 AI 食安系统 — 开始部署"
echo "============================"

# ---- 1. 更新系统 ----
echo "📦 [1/7] 更新系统包..."
apt update -qq && apt upgrade -y -qq

# ---- 2. 安装 Node.js 20 ----
if ! command -v node &> /dev/null; then
  echo "📦 [2/7] 安装 Node.js ${NODE_VERSION}..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt install -y nodejs
else
  echo "✅ [2/7] Node.js 已安装: $(node -v)"
fi

# ---- 3. 安装 Nginx ----
if ! command -v nginx &> /dev/null; then
  echo "📦 [3/7] 安装 Nginx..."
  apt install -y nginx
  systemctl enable nginx
else
  echo "✅ [3/7] Nginx 已安装"
fi

# ---- 4. 安装 PM2 ----
if ! command -v pm2 &> /dev/null; then
  echo "📦 [4/7] 安装 PM2..."
  npm install -g pm2
else
  echo "✅ [4/7] PM2 已安装: $(pm2 -v)"
fi

# ---- 5. 安装 certbot (Let's Encrypt) ----
if ! command -v certbot &> /dev/null; then
  echo "📦 [5/7] 安装 certbot..."
  apt install -y certbot python3-certbot-nginx
else
  echo "✅ [5/7] certbot 已安装"
fi

# ---- 6. 部署应用代码 ----
echo "📂 [6/7] 部署应用代码..."

# 创建目录结构
mkdir -p ${APP_DIR}/server/uploads/labels
mkdir -p /var/log/aishipan

# 如果是从本机拷贝（开发机），用 rsync；如果是 git clone，改这里
if [ -d "./client" ] && [ -d "./server" ]; then
  echo "  → 从当前目录拷贝代码..."
  rsync -av --delete ./client/dist ${APP_DIR}/client/dist
  rsync -av --delete ./server/ ${APP_DIR}/server/ --exclude node_modules --exclude data.db
else
  echo "  ❌ 未找到项目代码，请将部署脚本放到项目根目录运行"
  exit 1
fi

# 安装依赖
cd ${APP_DIR}/server
npm install --production

# 创建日志目录
mkdir -p /var/log/aishipan
chown -R $USER:$USER /var/log/aishipan

echo "✅ [6/7] 应用代码已部署到 ${APP_DIR}"

# ---- 7. 配置 Nginx + SSL ----
echo "🔧 [7/7] 配置 Nginx + SSL..."

# 复制 Nginx 配置
cp ${APP_DIR}/../nginx.conf /etc/nginx/sites-available/${DOMAIN}
ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试 Nginx 配置
nginx -t

# 申请 SSL 证书（需要域名已解析到本服务器 IP）
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  即将申请 SSL 证书"
echo "   请确保域名 ${DOMAIN} 已解析到本服务器 IP"
echo "   如果还没有，先 Ctrl+C 退出，解析后再运行 certbot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "是否现在申请 SSL 证书？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN}
  # 设置自动续期
  systemctl enable certbot.timer
  echo "✅ SSL 证书已配置，将自动续期"
else
  echo "⏭  跳过 SSL，稍后手动运行：certbot --nginx -d ${DOMAIN}"
fi

# 重载 Nginx
systemctl reload nginx

# ---- 启动应用 ----
echo ""
echo "🚀 启动应用..."

cd ${APP_DIR}/server
pm2 delete aishipan 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u $USER --hp $HOME

echo ""
echo "============================"
echo "✅ 部署完成！"
echo ""
echo "访问地址："
echo "  HTTPS: https://${DOMAIN}"
echo "  HTTP:  http://${DOMAIN}（自动跳转 HTTPS）"
echo ""
echo "管理命令："
echo "  pm2 status         查看进程状态"
echo "  pm2 logs aishipan  查看日志"
echo "  pm2 restart aishipan 重启服务"
echo "  systemctl reload nginx  重载 Nginx"
echo "  certbot renew --dry-run  测试证书续期"
echo "============================"
