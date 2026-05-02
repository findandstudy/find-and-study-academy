// PM2 yapılandırması — Docker kullanmıyorsanız Hostinger VPS'te bu yöntemi
// kullanın. Kullanım:
//   1) npm install -g pm2
//   2) cp .env.production.example .env.production && nano .env.production
//   3) npm ci && npm run build
//   4) pm2 start ecosystem.config.cjs --env production
//   5) pm2 save && pm2 startup
//
// Cluster mode tüm CPU çekirdeklerini kullanır; bellekte process-local cache
// olduğu için bu uygulamada cluster yerine 'fork' modu öneriliyor (ya da
// memcached/redis'e geçilmeden cluster'a geçilmemeli).

module.exports = {
  apps: [
    {
      name: 'findandstudy',
      script: 'dist/index.js',
      instances: 1,             // process-local cache var; cluster yapmadan önce redis'e geçin
      exec_mode: 'fork',
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      max_memory_restart: '1G',
      autorestart: true,
      restart_delay: 4000,
      max_restarts: 10,
      watch: false,
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000,

      // Loglar
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
