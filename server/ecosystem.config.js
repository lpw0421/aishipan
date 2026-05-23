// PM2 进程管理配置
module.exports = {
  apps: [{
    name: 'ai-food-safety-api',
    script: 'index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production'
    },
    // 日志
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    // 自动重启
    max_memory_restart: '300M',
    // 优雅退出
    kill_timeout: 5000,
    watch: false
  }]
}
