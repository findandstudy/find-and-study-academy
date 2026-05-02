// PM2 yapılandırması — Hostinger VPS'te bu dosyayla başlatılır.
// Kullanım:
//   pm2 start ecosystem.config.cjs --env production
//   pm2 save && pm2 startup
//
// Not: Cluster mode tüm CPU çekirdeklerini kullanır; bu uygulamada
// process-local cache (memoChat) olduğu için 'fork' modu öneriliyor.
// Yatay ölçekleme için önce Redis'e geçmeli.

module.exports = {
  apps: [
    {
      name: 'findandstudy',
      script: 'dist/index.js',
      cwd: '/var/www/findandstudy',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '1G',
      autorestart: true,
      restart_delay: 4000,
      max_restarts: 10,
      watch: false,
      kill_timeout: 5000,
      listen_timeout: 10000,

      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
