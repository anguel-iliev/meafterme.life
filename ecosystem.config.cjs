// ecosystem.config.cjs — PM2 configuration (for local sandbox testing only)
// For SuperHosting cPanel deployment, use server.js directly (not PM2)
module.exports = {
  apps: [
    {
      name: 'meafterme',
      script: 'server.js',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        APP_URL: 'https://3000-if5o3go68dcdg310xzcxy-2b54fc91.sandbox.novita.ai',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
