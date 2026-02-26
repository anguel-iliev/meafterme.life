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
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
