# AI 食安 - 域名与 HTTPS 配置指南

## 1. 域名购买与解析

### 1.1 购买域名
推荐平台：阿里云（万网）、腾讯云（DNSPod）

### 1.2 添加 DNS 解析记录

登录云服务商控制台 → 域名解析 → 添加记录：

| 记录类型 | 主机记录 | 记录值 | TTL |
|----------|----------|--------|-----|
| A | @ | 你的服务器 IP | 600 |
| A | www | 你的服务器 IP | 600 |

> 示例：服务器 IP 为 `123.45.67.89`，则两条 A 记录都指向此 IP。
> DNS 解析生效需要 1-10 分钟。

### 1.3 验证解析

```bash
# 在本机执行（替换为你的域名）
ping your-domain.com
# 应返回服务器 IP

nslookup your-domain.com
```

---

## 2. 免费 SSL 证书申请（Let's Encrypt）

### 2.1 首先确保 Nginx 只加载了 HTTP（80 端口）配置

```bash
# 使用安装脚本安装 certbot
sudo apt install -y certbot python3-certbot-nginx

# 或者使用 snap（推荐，版本更新）
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

### 2.2 确保 Nginx 已运行且域名可访问

```bash
# 先用 HTTP 确保站点可达
sudo nginx -t
sudo systemctl reload nginx

# 从外网测试（在本机执行）
curl http://your-domain.com
# 应返回 AI 食安前端页面 HTML
```

### 2.3 申请证书

```bash
# 方式一：certbot 自动配置 Nginx（推荐）
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 方式二：仅获取证书，手动配置 Nginx
sudo certbot certonly --webroot \
  -w /var/www/ai-shipan/client/dist \
  -d your-domain.com -d www.your-domain.com

# 按提示输入邮箱、同意条款
# 成功后证书路径：
#   /etc/letsencrypt/live/your-domain.com/fullchain.pem
#   /etc/letsencrypt/live/your-domain.com/privkey.pem
```

### 2.4 两步部署策略（推荐）

为了避免 SSL 配置错误导致站点不可用，分两步走：

**步骤 A — 先用 HTTP 验证站点正常：**

```bash
# 1. 编辑 nginx.production.conf，只保留 80 端口 server 块
#    （注释掉 443 的 server 块）
sudo cp /var/www/ai-shipan/nginx.production.conf /etc/nginx/sites-available/ai-shipan
sudo nano /etc/nginx/sites-available/ai-shipan
# 将两处 your-domain.com 改为你的真实域名
# 确认 443 server 块已注释

sudo nginx -t && sudo systemctl reload nginx

# 2. 浏览器访问 http://your-domain.com 确认可用
```

**步骤 B — 申请证书并启用 HTTPS：**

```bash
# 3. 申请证书
sudo certbot certonly --webroot \
  -w /var/www/ai-shipan/client/dist \
  -d your-domain.com -d www.your-domain.com

# 4. 编辑 Nginx 配置，取消注释 443 server 块，
#    并将 ssl_certificate 路径中的域名改为真实域名
sudo nano /etc/nginx/sites-available/ai-shipan

sudo nginx -t && sudo systemctl reload nginx

# 5. 浏览器访问 https://your-domain.com 确认锁头图标
```

---

## 3. SSL 证书自动续期

Let's Encrypt 证书有效期为 90 天，需定期续期：

```bash
# 测试续期流程（不实际续期）
sudo certbot renew --dry-run

# certbot 会自动注册定时任务，手动检查：
sudo systemctl status certbot.timer

# 如果没有自动注册，手动添加 crontab：
sudo crontab -e
# 添加以下行（每天凌晨 3 点检查并续期）：
0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

## 4. 验证 HTTPS 安全评级

申请完证书后，在以下网站测试 SSL 配置得分：

- [SSL Labs Server Test](https://www.ssllabs.com/ssltest/)
- [Security Headers](https://securityheaders.com/)

目标：SSL Labs 评级 A+，Security Headers 评级 A。

---

## 5. 完整检查清单

- [ ] 域名可 ping 通服务器 IP
- [ ] `http://域名` 正常显示 AI 食安登录页
- [ ] `https://域名` 显示绿色锁头
- [ ] `http://域名` 自动跳转到 `https://域名`
- [ ] 登录/注册功能正常
- [ ] 上传证照/标签功能正常
- [ ] SSL Labs 评级 A 以上
- [ ] 证书自动续期已配置
