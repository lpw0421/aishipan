// ============================================
// AI 食安系统 — PM2 进程管理配置
// 文件位置：/opt/aishipan/server/ecosystem.config.cjs
// ============================================

module.exports = {
  apps: [
    {
      name: 'aishipan',
      script: 'index.js',
      cwd: '/opt/aishipan/server',
      // 生产模式
      env: {
        NODE_ENV: 'production'
      },
      // 单机用 fork 模式（SQLite 不支持多进程写入）
      exec_mode: 'fork',
      // 实例数
      instances: 1,
      // 内存超限自动重启
      max_memory_restart: '512M',
      // 崩溃自动重启
      autorestart: true,
      // 文件变更不自动重启（生产环境不需要）
      watch: false,
      // 日志配置
      error_file: '/var/log/aishipan/error.log',
      out_file: '/var/log/aishipan/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // 启动时合并日志
      merge_logs: true,
      // 优雅关闭：给 5 秒处理完当前请求
      kill_timeout: 5000,
      // 重启间隔（防止频繁重启）
      min_uptime: '10s',
      max_restarts: 10
    }
  ]
}
